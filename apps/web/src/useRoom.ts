import { useCallback, useEffect, useRef, useState } from 'react';
import { createGame, reduce, RuleError } from '@fox/engine';
import type { Action, GameState } from '@fox/engine';

const SERVER = (import.meta.env.VITE_SERVER_URL ?? '').trim();

export type Mode = 'local' | 'online';

/** 이 빌드에 서버 주소가 들어 있는가. 참가 여부와 무관하게 판정한다. */
export const HAS_SERVER = SERVER.length > 0;
export type Status = 'local' | 'connecting' | 'open' | 'closed';

export interface Room {
  state: GameState;
  send: (a: Action) => void;
  error: string | null;
  clearError: () => void;
  mode: Mode;
  status: Status;
}

/**
 * 서버 URL 이 설정되어 있으면 Durable Object 방에 붙고,
 * 없으면 브라우저 안에서 엔진을 그대로 돌린다(로컬 모드, 한 대로 돌려보기).
 */
export function useRoom(code: string): Room {
  const online = SERVER.length > 0 && code.length > 0;
  const [state, setState] = useState<GameState>(createGame);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(online ? 'connecting' : 'local');
  const ws = useRef<WebSocket | null>(null);
  const retry = useRef(0);
  const alive = useRef(true);
  // 소켓이 열리기 전에 보낸 액션을 담아두었다가 onopen 에서 흘려보낸다.
  const pending = useRef<Action[]>([]);

  useEffect(() => {
    if (!online) return;
    alive.current = true;

    const connect = () => {
      if (!alive.current) return;
      setStatus('connecting');
      const sock = new WebSocket(`${SERVER}/room/${encodeURIComponent(code)}`);
      ws.current = sock;

      sock.onopen = () => {
        retry.current = 0;
        setStatus('open');
        const queued = pending.current;
        pending.current = [];
        for (const action of queued) sock.send(JSON.stringify({ t: 'action', action }));
      };
      sock.onmessage = (ev) => {
        const msg = JSON.parse(ev.data as string);
        if (msg.t === 'state') setState(msg.state as GameState);
        else if (msg.t === 'error') setError(msg.message as string);
      };
      sock.onclose = () => {
        if (!alive.current) return;
        setStatus('closed');
        // 지수 백오프 재접속
        const wait = Math.min(1000 * 2 ** retry.current++, 15000);
        setTimeout(connect, wait);
      };
      sock.onerror = () => sock.close();
    };

    connect();
    return () => {
      alive.current = false;
      ws.current?.close();
    };
  }, [online, code]);

  const send = useCallback(
    (action: Action) => {
      if (online) {
        const sock = ws.current;
        if (!sock || sock.readyState !== WebSocket.OPEN) {
          // 접속 중이거나 재접속 대기 중 — 버리지 않고 큐에 넣는다.
          pending.current.push(action);
          return;
        }
        sock.send(JSON.stringify({ t: 'action', action }));
        return;
      }
      // 로컬 모드: 엔진을 직접 돌린다
      setState((prev) => {
        try {
          return reduce(prev, action);
        } catch (e) {
          setError(e instanceof RuleError ? e.message : '처리 중 오류가 발생했습니다');
          return prev;
        }
      });
    },
    [online],
  );

  const clearError = useCallback(() => setError(null), []);

  return { state, send, error, clearError, mode: online ? 'online' : 'local', status };
}
