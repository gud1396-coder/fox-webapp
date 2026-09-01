import { createGame, reduce, RuleError } from '@fox/engine';
import type { Action, GameState } from '@fox/engine';

export interface Env {
  ROOM: DurableObjectNamespace;
  /** 쉼표로 구분한 허용 오리진. 비우면 전부 허용(로컬 개발용). */
  ALLOWED_ORIGINS?: string;
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
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/health') {
      return new Response('ok', { headers: { 'access-control-allow-origin': '*' } });
    }

    // /room/{CODE}
    const m = url.pathname.match(/^\/room\/([A-Za-z0-9-]{1,32})$/);
    if (!m) return new Response('not found', { status: 404 });

    if (req.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    if (!originAllowed(req, env)) return new Response('forbidden origin', { status: 403 });

    const code = m[1].toUpperCase();
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

  async fetch(_req: Request): Promise<Response> {
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
