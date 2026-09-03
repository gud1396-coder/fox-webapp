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
  /** 백오프를 기다리지 않고 지금 다시 붙는다. 로비의 "다시 연결" 버튼용. */
  reconnect: () => void;
}

/**
 * 서버 URL 이 설정되어 있으면 Durable Object 방에 붙고,
 * 없으면 브라우저 안에서 엔진을 그대로 돌린다(로컬 모드, 한 대로 돌려보기).
 *
 * `hello` 는 소켓이 열릴 때마다 **매번** 먼저 보내는 액션이다(참가). 한 번만
 * 보내면 재접속·방 초기화 뒤에 서버 방에서 빠진 채로 남는다. 리듀서의 `join`
 * 은 멱등이라 여러 번 보내도 안전하다.
 */
export function useRoom(code: string, hello?: Action | null): Room {
  const online = SERVER.length > 0 && code.length > 0;
  const [state, setState] = useState<GameState>(createGame);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(online ? 'connecting' : 'local');
  const ws = useRef<WebSocket | null>(null);
  const retry = useRef(0);
  const alive = useRef(true);
  // 소켓이 열리기 전에 보낸 액션을 담아두었다가 onopen 에서 흘려보낸다.
  const pending = useRef<Action[]>([]);
  // onopen 은 이 이펙트보다 늦게 돌므로 최신 값을 ref 로 읽는다.
  const helloRef = useRef<Action | null>(hello ?? null);
  helloRef.current = hello ?? null;
  // 어떤 소켓에 어떤 hello 를 보냈는지. 같은 소켓에 두 번 보내지 않기 위한 표시.
  const helloOn = useRef<{ sock: WebSocket; action: Action } | null>(null);
  // 재접속 대기 타이머와 현재 connect 함수 — reconnect() 가 쓴다.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<() => void>(() => {});

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
        // 참가를 먼저 보낸다. 재접속일 때도 다시 보내야 서버 방에 남는다.
        const h = helloRef.current;
        if (h) helloOn.current = { sock, action: h };
        const queued = h ? [h, ...pending.current] : pending.current;
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
        timer.current = setTimeout(connect, wait);
      };
      sock.onerror = () => sock.close();
    };

    connectRef.current = connect;
    connect();
    return () => {
      alive.current = false;
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      connectRef.current = () => {};
      helloOn.current = null;
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

  // 로비에서 미리 붙어 있다가 참가를 누른 경우. 소켓이 이미 열려 있으니
  // onopen 이 다시 돌지 않는다 — 여기서 보낸다.
  useEffect(() => {
    if (!online || !hello) return;
    const sock = ws.current;
    if (!sock || sock.readyState !== WebSocket.OPEN) return;
    if (helloOn.current?.sock === sock && helloOn.current.action === hello) return;
    helloOn.current = { sock, action: hello };
    sock.send(JSON.stringify({ t: 'action', action: hello }));
  }, [online, hello, status]);

  // 로컬 모드에는 소켓이 없다. hello 를 엔진에 직접 한 번 적용한다.
  // (hello 는 호출부에서 memo 로 고정한다 — 렌더마다 새 객체면 계속 다시 보낸다.)
  const helloApplied = useRef<Action | null>(null);
  useEffect(() => {
    if (online) return;
    if (!hello) { helloApplied.current = null; return; }
    if (helloApplied.current === hello) return;
    helloApplied.current = hello;
    send(hello);
  }, [online, hello, send]);

  const reconnect = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    retry.current = 0;
    const sock = ws.current;
    // 열려 있거나 여는 중이면 닫는다. onclose 가 백오프 0 으로 곧장 다시 연다.
    if (sock && sock.readyState !== WebSocket.CLOSED) { sock.close(); return; }
    connectRef.current();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { state, send, error, clearError, mode: online ? 'online' : 'local', status, reconnect };
}
