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

    // ---- 관리자: 서버 연결 차단 on/off ----
    if (url.pathname === '/admin/lock') {
      const origin = req.headers.get('Origin');
      const head = cors(origin, env);
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: head });
      if (!originAllowed(req, env)) return new Response('forbidden origin', { status: 403, headers: head });
      const index = env.ROOM.get(env.ROOM.idFromName(INDEX_NAME));

      if (req.method === 'GET') {
        const r = await index.fetch('https://do/__locked');
        return new Response(await r.text(), {
          headers: { ...head, 'content-type': 'application/json' },
        });
      }
      if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: head });

      let body: { password?: string; locked?: boolean } = {};
      try { body = (await req.json()) as typeof body; } catch { /* 빈 값 */ }
      if (!env.ADMIN_PASSWORD || body.password !== env.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ ok: false, error: '비밀번호가 맞지 않습니다' }), {
          status: 403, headers: { ...head, 'content-type': 'application/json' },
        });
      }
      await index.fetch('https://do/__lock?on=' + (body.locked ? '1' : '0'));
      return new Response(JSON.stringify({ ok: true, locked: !!body.locked }), {
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

    // 관리자가 잠가두면 새 접속을 받지 않는다 (수업 시간 외 사용 제한).
    const idx = env.ROOM.get(env.ROOM.idFromName(INDEX_NAME));
    const lock = (await (await idx.fetch('https://do/__locked')).json()) as { locked: boolean };
    if (lock.locked) return new Response('server locked', { status: 503 });

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
    if (path === '/__lock') {
      const on = new URL(req.url).searchParams.get('on') === '1';
      await this.ctx.storage.put('locked', on);
      return new Response('ok');
    }
    if (path === '/__locked') {
      const on = (await this.ctx.storage.get<boolean>('locked')) ?? false;
      return new Response(JSON.stringify({ locked: on }), {
        headers: { 'content-type': 'application/json' },
      });
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

    // setConnected 는 서버가 소켓 상태를 보고 넣는 것이다. 클라이언트가 보내면
    // 남을 마음대로 "끊긴 사람" 으로 만들어 턴을 건너뛸 수 있다.
    if (msg.action.t === 'setConnected') {
      return this.send(ws, { t: 'error', message: '허용되지 않는 요청입니다' });
    }
    // 이 소켓이 누구인지 기억해 둔다. 끊길 때 누가 나갔는지 알아야 한다.
    // 하이버네이션에서 깨어나도 attachment 는 남는다.
    if (msg.action.t === 'join') {
      try { ws.serializeAttachment({ playerId: msg.action.playerId }); } catch { /* 무시 */ }
    }

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

  async webSocketClose(ws: WebSocket): Promise<void> {
    // 재접속을 허용하므로 상태에서 지우지 않는다. 다만 끊긴 것은 알려야 한다 —
    // 예전에는 여기가 비어 있어서, 끊긴 사람이 액티브면 방 전체가 멈추고
    // "모든 방 초기화" 말고는 손쓸 방법이 없었다.
    let playerId: string | undefined;
    try { playerId = (ws.deserializeAttachment() as { playerId?: string } | null)?.playerId; }
    catch { /* attachment 없음 */ }
    if (!playerId) return;

    // 같은 사람이 다른 탭·기기로 아직 붙어 있으면 끊긴 것이 아니다.
    for (const other of this.ctx.getWebSockets()) {
      if (other === ws) continue;
      try {
        const a = other.deserializeAttachment() as { playerId?: string } | null;
        if (a?.playerId === playerId) return;
      } catch { /* 무시 */ }
    }

    await this.apply({ t: 'setConnected', playerId, connected: false });
  }

  /** 액션을 상태에 반영하고 저장·방송한다. 규칙 위반은 조용히 무시한다. */
  private async apply(action: Action): Promise<void> {
    let next: GameState;
    try {
      next = reduce(this.state ?? createGame(), action);
    } catch {
      return;
    }
    this.state = next;
    await this.ctx.storage.put('state', next);
    this.broadcast({ t: 'state', state: next });
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
