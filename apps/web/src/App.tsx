import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DIE_COLORS, THEMES, ORIGINAL,
  yellowCandidates, hasFreeYellow, hasFreeBlue, findBlueCell,
  BLUE_GRID, totalScore, greenNeeds, purpleNeeds,
} from '@fox/engine';
import type { AreaColor, DieColor, Dice, Player } from '@fox/engine';
import { useRoom } from './useRoom.js';
import { Sheet } from './Sheet.jsx';

const DIE_KO: Record<DieColor, string> = {
  yellow: '노랑', blue: '파랑', green: '초록', orange: '주황', purple: '보라', white: '흰색',
};

function useLocal(key: string, init: string): [string, (v: string) => void] {
  const [v, setV] = useState(() => localStorage.getItem(key) ?? init);
  useEffect(() => { localStorage.setItem(key, v); }, [key, v]);
  return [v, setV];
}

const roomFromHash = () => (location.hash.replace(/^#\/?/, '').toUpperCase() || '');

export default function App() {
  const [playerId] = useLocal('fox.pid', Math.random().toString(36).slice(2, 10));
  const [name, setName] = useLocal('fox.name', '');
  const [themeId, setThemeId] = useLocal('fox.theme', 'earth-system');
  const [code, setCode] = useState(roomFromHash);
  const [joined, setJoined] = useState(false);

  const theme = THEMES[themeId] ?? ORIGINAL;
  const { state, send, error, clearError, mode, status } = useRoom(joined ? code : '');

  useEffect(() => {
    const h = () => setCode(roomFromHash());
    addEventListener('hashchange', h);
    return () => removeEventListener('hashchange', h);
  }, []);

  // 참가는 joined 가 true 가 된 다음 렌더에서 보낸다. 클릭 시점의 send 는
  // 아직 로컬 모드용이라 서버로 가지 않는다. 소켓이 아직 안 열렸으면
  // useRoom 이 큐에 담아 두었다가 열릴 때 보낸다.
  const joinSent = useRef(false);
  useEffect(() => {
    if (!joined || joinSent.current) return;
    joinSent.current = true;
    send({ t: 'join', playerId, name: name.trim() });
  }, [joined, send, playerId, name]);

  const me = state.players.find((p) => p.id === playerId) ?? null;

  // 참가에 성공해도 아직 시작 전이면 로비에 머문다 — 시작 버튼이 로비에만 있다.
  if (!joined || !me || state.phase === 'lobby') {
    return (
      <Lobby
        name={name} setName={setName} code={code} setCode={setCode}
        themeId={themeId} setThemeId={setThemeId} theme={theme}
        mode={mode}
        players={state.players}
        joined={joined}
        onJoin={() => {
          if (!name.trim()) return;
          location.hash = '/' + (code || 'LOCAL');
          setJoined(true);
        }}
        onStart={() => send({ t: 'start', playerId })}
        error={error} clearError={clearError}
      />
    );
  }

  return (
    <Game
      state={state} me={me} playerId={playerId} theme={theme} themeId={themeId}
      setThemeId={setThemeId} send={send} error={error} clearError={clearError}
      mode={mode} status={status} code={code}
    />
  );
}

// ---------------- 로비 ----------------

function Lobby(p: any) {
  return (
    <div className="wrap lobby">
      <h1>{p.theme.title}</h1>
      <p className="sub">{p.theme.subtitle}</p>

      <label>이름
        <input value={p.name} onChange={(e) => p.setName(e.target.value)} placeholder="이름" maxLength={12} />
      </label>

      <label>방 코드
        <input value={p.code} onChange={(e) => p.setCode(e.target.value.toUpperCase())}
          placeholder={p.mode === 'online' ? '예: SCIENCE1' : '로컬 모드 (한 대로 진행)'} maxLength={16} />
      </label>

      <label>테마
        <select value={p.themeId} onChange={(e) => p.setThemeId(e.target.value)}>
          <option value="earth-system">지구시스템 (통합과학)</option>
          <option value="original">원작 (영리한 여우)</option>
        </select>
      </label>

      {!p.joined ? (
        <button className="primary" disabled={!p.name.trim()} onClick={p.onJoin}>참가</button>
      ) : (
        <>
          <ul className="players">
            {p.players.map((x: Player) => <li key={x.id}>{x.name}</li>)}
          </ul>
          <button className="primary" disabled={p.players.length < 1} onClick={p.onStart}>
            시작 ({p.players.length}명)
          </button>
        </>
      )}

      <p className="note">
        {p.mode === 'online'
          ? '온라인 모드 — 같은 방 코드를 입력하면 함께 플레이합니다.'
          : '로컬 모드 — 이 브라우저에서만 진행됩니다. 온라인으로 하려면 VITE_SERVER_URL 을 설정하세요.'}
      </p>
      {p.error && <div className="err" onClick={p.clearError}>{p.error}</div>}
    </div>
  );
}

// ---------------- 게임 ----------------

function Game({ state, me, playerId, theme, themeId, setThemeId, send, error, clearError, mode, status, code }: any) {
  const [sel, setSel] = useState<DieColor | null>(null);
  const [cellMode, setCellMode] = useState<null | { die: DieColor }>(null);
  const [draft, setDraft] = useState<Partial<Dice>>({});

  const isActive = state.players[state.activeIdx]?.id === playerId;
  const s = state as any;

  // 이번에 고를 수 있는 주사위 목록
  const choosable: DieColor[] =
    s.phase === 'active' && isActive ? s.pool
    : s.phase === 'passive' && !me.pickedThisTurn ? [...s.platter, ...s.placed]
    : s.phase === 'passive' && me.pickedThisTurn ? [...DIE_COLORS].filter((d) => !me.plusOneDice.includes(d))
    : [];

  const legalAreas = (die: DieColor): AreaColor[] =>
    die === 'white' ? ['yellow', 'blue', 'green', 'orange', 'purple'] : [die as AreaColor];

  const submit = (die: DieColor, as: AreaColor, cell?: { r: number; c: number }) => {
    const base = { playerId, die, as, ...(cell ? { cell } : {}) } as any;
    if (s.phase === 'active') send({ t: 'pick', ...base });
    else if (!me.pickedThisTurn) send({ t: 'pickPlatter', ...base });
    else send({ t: 'usePlusOne', ...base });
    setSel(null); setCellMode(null);
  };

  const chooseArea = (die: DieColor, as: AreaColor) => {
    if (as === 'yellow') { setCellMode({ die }); return; }
    submit(die, as);
  };

  // 보너스 체인에서 칸을 골라야 하는 상태
  const awaitYellow = me.awaiting?.t === 'yellowCell';
  const awaitBlue = me.awaiting?.t === 'blueCell';

  const yellowTargets = awaitYellow
    ? allFree(me, 'yellow')
    : cellMode ? yellowCandidates(me.sheet, s.dice[cellMode.die]) : [];
  const blueTargets = awaitBlue ? allFree(me, 'blue') : [];

  const onYellow = (r: number, c: number) => {
    if (awaitYellow) send({ t: 'choose', playerId, answer: { t: 'yellowCell', r, c } });
    else if (cellMode) submit(cellMode.die, 'yellow', { r, c });
  };
  const onBlue = (r: number, c: number) => {
    if (awaitBlue) send({ t: 'choose', playerId, answer: { t: 'blueCell', r, c } });
  };

  const others = state.players.filter((p: Player) => p.id !== playerId);

  return (
    <div className="wrap game">
      <header>
        <div>
          <strong>{theme.title}</strong>
          <span className="chip">{theme.terms.round} {s.round}/{s.totalRounds}</span>
          {code && <span className="chip">방 {code}</span>}
          <span className={'chip ' + (mode === 'online' ? 'on' : '')}>
            {mode === 'online' ? (status === 'open' ? '온라인' : '연결 중…') : '로컬'}
          </span>
        </div>
        <select value={themeId} onChange={(e) => setThemeId(e.target.value)}>
          <option value="earth-system">지구시스템</option>
          <option value="original">원작</option>
        </select>
      </header>

      {error && <div className="err" onClick={clearError}>{error} (눌러서 닫기)</div>}

      {s.phase === 'gameOver' ? (
        <GameOver state={state} theme={theme} />
      ) : (
        <>
          <Status state={state} me={me} isActive={isActive} theme={theme} />

          {/* 선택 대기 (보너스 체인) */}
          {me.awaiting && <ChoiceBar me={me} send={send} playerId={playerId} theme={theme} />}

          {/* 주사위 눈 입력 */}
          {s.phase === 'enterDice' && isActive && !me.awaiting && (
            <DiceEntry
              targets={s.soloPassiveRoll ? [...DIE_COLORS] : s.pool}
              draft={draft} setDraft={setDraft}
              onSubmit={() => { send({ t: 'setDice', playerId, dice: draft }); setDraft({}); }}
              theme={theme}
            />
          )}

          {/* 주사위 고르기 */}
          {!me.awaiting && choosable.length > 0 && (
            <DicePick
              dice={s.dice} list={choosable} sel={sel} setSel={setSel}
              legalAreas={legalAreas} chooseArea={chooseArea}
              cellMode={cellMode} cancel={() => { setSel(null); setCellMode(null); }}
              me={me} phase={s.phase} platter={s.platter} placed={s.placed}
              theme={theme}
            />
          )}

          {/* 액션 버튼 */}
          <Actions state={state} me={me} isActive={isActive} playerId={playerId} send={send} theme={theme} />
        </>
      )}

      <Sheet
        player={me} theme={theme}
        yellowTargets={yellowTargets} blueTargets={blueTargets}
        onYellow={onYellow} onBlue={onBlue}
      />

      {others.length > 0 && (
        <div className="others">
          {others.map((p: Player) => <Sheet key={p.id} player={p} theme={theme} compact />)}
        </div>
      )}
    </div>
  );
}

function allFree(me: Player, area: 'yellow' | 'blue') {
  const out: { r: number; c: number }[] = [];
  if (area === 'yellow') {
    if (!hasFreeYellow(me.sheet)) return out;
    me.sheet.yellow.forEach((row, r) => row.forEach((on, c) => { if (!on) out.push({ r, c }); }));
  } else {
    if (!hasFreeBlue(me.sheet)) return out;
    BLUE_GRID.forEach((row, r) => row.forEach((v, c) => {
      if (v !== null && !me.sheet.blue[r][c]) out.push({ r, c });
    }));
  }
  return out;
}

function Status({ state, me, isActive, theme }: any) {
  const active = state.players[state.activeIdx];
  const msg =
    state.phase === 'roundBonus' ? '라운드 시작 보너스를 처리하는 중'
    : state.phase === 'enterDice' ? (state.soloPassiveRoll ? '패시브용 6개를 굴려 입력하세요' : (isActive ? '주사위를 굴려 눈을 입력하세요' : active?.name + ' 이(가) 주사위를 굴리는 중'))
    : state.phase === 'active' ? (isActive ? '주사위를 고르세요 (' + state.placed.length + '/3)' : active?.name + ' 이(가) 고르는 중')
    : !me.pickedThisTurn ? theme.terms.platter + '에서 하나를 고르세요'
    : !me.ready ? theme.terms.plusOne + ' 를 쓰거나 턴을 끝내세요'
    : '다른 사람을 기다리는 중';
  const need = [greenNeeds(me.sheet), purpleNeeds(me.sheet)];
  return (
    <div className="status">
      <div className="msg">{msg}</div>
      <div className="hints">
        {need[0] !== null && <span>{theme.areas.green.name} 다음 칸 ≥{need[0]}</span>}
        {need[1] !== null && <span>{theme.areas.purple.name} 다음 칸 ≥{need[1]}</span>}
      </div>
    </div>
  );
}

function DiceEntry({ targets, draft, setDraft, onSubmit, theme }: any) {
  const ready = targets.every((d: DieColor) => draft[d] >= 1 && draft[d] <= 6);
  return (
    <div className="panel">
      <h3>실물 {theme.terms.dice} 을 굴려 눈을 입력하세요</h3>
      <div className="dice-entry">
        {targets.map((d: DieColor) => (
          <div key={d} className={'die-in d-' + d}>
            <label>{DIE_KO[d]}</label>
            <div className="pips">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button key={n} className={draft[d] === n ? 'on' : ''}
                  onClick={() => setDraft({ ...draft, [d]: n })}>{n}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button className="primary" disabled={!ready} onClick={onSubmit}>입력 완료</button>
    </div>
  );
}

function DicePick({ dice, list, sel, setSel, legalAreas, chooseArea, cellMode, cancel, phase, platter, theme }: any) {
  if (cellMode) {
    return (
      <div className="panel">
        <h3>{theme.areas.yellow.name} 에서 칸을 고르세요 (강조된 칸)</h3>
        <button onClick={cancel}>취소</button>
      </div>
    );
  }
  return (
    <div className="panel">
      <h3>
        {phase === 'active' ? theme.terms.dice + ' 고르기' : theme.terms.platter}
      </h3>
      <div className="dice-row">
        {list.map((d: DieColor) => (
          <button key={d} className={'die d-' + d + (sel === d ? ' sel' : '')} onClick={() => setSel(d)}>
            <span className="v">{dice[d]}</span>
            <span className="n">{DIE_KO[d]}</span>
          </button>
        ))}
      </div>
      {sel && (
        <div className="area-pick">
          <span>어디에 넣을까요?</span>
          {legalAreas(sel).map((a: AreaColor) => (
            <button key={a} className={'areabtn a-' + a} onClick={() => chooseArea(sel, a)}>
              {theme.areas[a].name}
              {a === 'blue' && <em> (합 {dice.blue + dice.white})</em>}
            </button>
          ))}
          <button onClick={cancel}>취소</button>
        </div>
      )}
    </div>
  );
}

function ChoiceBar({ me, send, playerId, theme }: any) {
  const a = me.awaiting;
  const answer = (ans: any) => send({ t: 'choose', playerId, answer: ans });
  if (a.t === 'roundBonus') {
    return (
      <div className="panel choice">
        <h3>라운드 보너스를 선택하세요</h3>
        {a.options.map((o: any, i: number) => (
          <button key={i} className="primary" onClick={() => answer({ t: 'roundBonus', index: i })}>
            {o.t === 'xAny' ? '아무 색 체크 (✗)' : o.t === 'numAny' ? '아무 색에 ' + o.v : o.t}
          </button>
        ))}
      </div>
    );
  }
  if (a.t === 'xArea') {
    return (
      <div className="panel choice">
        <h3>어느 영역을 체크할까요?</h3>
        {(['yellow', 'blue', 'green'] as const).map((x) => (
          <button key={x} className={'areabtn a-' + x} onClick={() => answer({ t: 'xArea', area: x })}>
            {theme.areas[x].name}
          </button>
        ))}
      </div>
    );
  }
  if (a.t === 'numArea') {
    return (
      <div className="panel choice">
        <h3>{a.v} 을(를) 어디에 적을까요?</h3>
        {(['orange', 'purple'] as const).map((x) => (
          <button key={x} className={'areabtn a-' + x} onClick={() => answer({ t: 'numArea', area: x })}>
            {theme.areas[x].name}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="panel choice">
      <h3>아래 시트에서 강조된 칸을 고르세요</h3>
    </div>
  );
}

function Actions({ state, me, isActive, playerId, send, theme }: any) {
  const canReroll = isActive && state.phase === 'active' && me.sheet.rerollEarned > me.sheet.rerollUsed;
  return (
    <div className="actions">
      {canReroll && (
        <button onClick={() => send({ t: 'useReroll', playerId })}>
          ↻ {theme.terms.reroll} ({me.sheet.rerollEarned - me.sheet.rerollUsed})
        </button>
      )}
      {isActive && state.phase === 'active' && (
        <button onClick={() => send({ t: 'skipPick', playerId })}>쓸 수 있는 게 없음</button>
      )}
      {state.phase === 'passive' && !me.pickedThisTurn && (
        <button onClick={() => send({ t: 'skipPlatter', playerId })}>쓸 수 있는 게 없음</button>
      )}
      {state.phase === 'passive' && me.pickedThisTurn && !me.ready && !me.awaiting && me.queue.length === 0 && (
        <button className="primary" onClick={() => send({ t: 'ready', playerId })}>턴 끝내기</button>
      )}
    </div>
  );
}

function GameOver({ state, theme }: any) {
  const rows = state.players
    .map((p: Player) => ({ p, ...totalScore(p.sheet) }))
    .sort((a: any, b: any) => b.total - a.total);
  return (
    <div className="panel over">
      <h2>게임 종료</h2>
      <table>
        <thead>
          <tr>
            <th></th>
            {(['yellow', 'blue', 'green', 'orange', 'purple'] as AreaColor[]).map((a) => (
              <th key={a}>{theme.areas[a].name}</th>
            ))}
            <th>{theme.fox.name}</th><th>합계</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, areas, fox, total }: any) => {
            const min = Math.min(...Object.values(areas) as number[]);
            return (
              <tr key={p.id}>
                <td><strong>{p.name}</strong></td>
                {(['yellow', 'blue', 'green', 'orange', 'purple'] as AreaColor[]).map((a) => (
                  <td key={a} className={areas[a] === min ? 'limiting' : ''}>{areas[a]}</td>
                ))}
                <td>{fox}</td><td><strong>{total}</strong></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {theme.fox.law && (
        <p className="law"><strong>{theme.fox.law}</strong> — {theme.fox.blurb}</p>
      )}
      {theme.reflection.length > 0 && (
        <>
          <h3>생각해 볼 것</h3>
          <ol className="reflect">{theme.reflection.map((q: string, i: number) => <li key={i}>{q}</li>)}</ol>
        </>
      )}
    </div>
  );
}
