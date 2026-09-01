import { createGame, reduce, RuleError } from '@fox/engine';
import type { Action, GameState } from '@fox/engine';

export interface Env {
  ROOM: DurableObjectNamespace;
  /** 쉼표로 구분한 허용 오리진. 비우면 전부 허용(로컬 개발용). */
  ALLOWED_ORIGINS?: string;
  /** 관리자 모드 비밀번호. wrangler secret 으로 넣는다. */
  ADMIN_PASSWORD?: string;
}

/** 열린 방 코드를 모아두는 색인용 DO 이름. 실제 방 코드와 겹치지 않게 잡았다. */
const INDEX_NAME = '__index__';

function cors(origin: string | null, env: Env): Record<string, string> {
  const list = (env.ALLOWED_ORIGINS ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const allow = list.length === 0 ? (origin ?? '*') : (origin && list.includes(origin) ? origin : '');
  return allow
    ? {
        'access-control-allow-origin': allow,
        'access-control-allow-headers': 'content-type',
        'access-control-allow-methods': 'POST, OPTIONS',
      }
    : {};
}

/** 클라이언트 -> 서버 */
type Inbound =
  | { t: 'action'; action: Action }
  | { t: 'ping' };

/** 서버 -> 클라이언트 */
type Outbound =
  | { t: 'state'; state: GameState }
  | { t: 'error'; message: string }
  | { t: 'pong' };

function originAllowed(req: Request, env: Env): boolean {
  const list = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return true;
  const origin = req.headers.get('Origin');
  return !!origin && list.includes(origin);
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/health') {
      return new Response('ok', { headers: { 'access-control-allow-origin': '*' } });
    }

    // ---- 관리자: 모든 방 초기화 ----
    if (url.pathname === '/admin/reset') {
      const origin = req.headers.get('Origin');
      const head = cors(origin, env);
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: head });
      if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: head });
      if (!originAllowed(req, env)) return new Response('forbidden origin', { status: 403, headers: head });

      let pw = '';
      try { pw = ((await req.json()) as { password?: string }).password ?? ''; } catch { /* 빈 값 */ }
      if (!env.ADMIN_PASSWORD || pw !== env.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ ok: false, error: '비밀번호가 맞지 않습니다' }), {
          status: 403, headers: { ...head, 'content-type': 'application/json' },
        });
      }

      const index = env.ROOM.get(env.ROOM.idFromName(INDEX_NAME));
      const listed = await index.fetch('https://do/__list');
      const codes = (await listed.json()) as string[];
      await Promise.all(
        codes.map((c) => env.ROOM.get(env.ROOM.idFromName(c)).fetch('https://do/__reset')),
      );
      await index.fetch('https://do/__clear');
      return new Response(JSON.stringify({ ok: true, cleared: codes.length, codes }), {
        headers: { ...head, 'content-type': 'application/json' },
      });
    }

    // /room/{CODE}
    const m = url.pathname.match(/^\/room\/([A-Za-z0-9-]{1,32})$/);
    if (!m) return new Response('not found', { status: 404 });

    if (req.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    if (!originAllowed(req, env)) return new Response('forbidden origin', { status: 403 });

    const code = m[1].toUpperCase();
    // 초기화 대상을 알 수 있도록 열린 방 코드를 색인에 적어둔다.
    ctx.waitUntil(
      env.ROOM.get(env.ROOM.idFromName(INDEX_NAME))
        .fetch('https://do/__add?code=' + encodeURIComponent(code))
        .then(() => undefined, () => undefined),
    );
    const id = env.ROOM.idFromName(code);
    return env.ROOM.get(id).fetch(req);
  },
};

export class GameRoom implements DurableObject {
  private state: GameState | null = null;

  constructor(private ctx: DurableObjectState, private env: Env) {
    // 하이버네이션에서 깨어날 때 메모리 상태를 복구한다.
    this.ctx.blockConcurrencyWhile(async () => {
      this.state = (await this.ctx.storage.get<GameState>('state')) ?? createGame();
    });
  }

  async fetch(req: Request): Promise<Response> {
    const path = new URL(req.url).pathname;

    // ---- 색인 역할로 쓰일 때 (INDEX_NAME 인스턴스) ----
    if (path === '/__add') {
      const code = new URL(req.url).searchParams.get('code');
      if (code) {
        const set = (await this.ctx.storage.get<string[]>('codes')) ?? [];
        if (!set.includes(code)) await this.ctx.storage.put('codes', [...set, code]);
      }
      return new Response('ok');
    }
    if (path === '/__list') {
      const set = (await this.ctx.storage.get<string[]>('codes')) ?? [];
      return new Response(JSON.stringify(set), { headers: { 'content-type': 'application/json' } });
    }
    if (path === '/__clear') {
      await this.ctx.storage.delete('codes');
      return new Response('ok');
    }

    // ---- 방 초기화 ----
    if (path === '/__reset') {
      this.state = createGame();
      await this.ctx.storage.delete('state');
      // 붙어 있는 사람들에게 빈 상태를 알리고 연결을 끊는다.
      this.broadcast({ t: 'state', state: this.state });
      for (const ws of this.ctx.getWebSockets()) {
        try { ws.close(1000, '관리자가 방을 초기화했습니다'); } catch { /* 이미 닫힘 */ }
      }
      return new Response('ok');
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    // 하이버네이션 API — 유휴 방은 메모리에서 내려가고 과금도 멈춘다.
    this.ctx.acceptWebSocket(server);
    this.send(server, { t: 'state', state: this.state ?? createGame() });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string') return;
    let msg: Inbound;
    try {
      msg = JSON.parse(raw) as Inbound;
    } catch {
      return this.send(ws, { t: 'error', message: '잘못된 요청' });
    }

    if (msg.t === 'ping') return this.send(ws, { t: 'pong' });
    if (msg.t !== 'action') return;

    const before = this.state ?? createGame();
    let next: GameState;
    try {
      next = reduce(before, msg.action);
    } catch (e) {
      const message = e instanceof RuleError ? e.message : '처리 중 오류가 발생했습니다';
      return this.send(ws, { t: 'error', message });
    }

    this.state = next;
    await this.ctx.storage.put('state', next);
    this.broadcast({ t: 'state', state: next });
  }

  async webSocketClose(): Promise<void> {
    // 재접속을 허용하므로 상태에서 지우지 않는다.
  }

  private send(ws: WebSocket, msg: Outbound): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* 이미 닫힌 소켓 */
    }
  }

  private broadcast(msg: Outbound): void {
    const payload = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        /* ignore */
      }
    }
  }
}
