import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DIE_COLORS, THEMES, ORIGINAL,
  yellowCandidates, hasFreeYellow, hasFreeBlue, findBlueCell,
  BLUE_GRID, totalScore, canUseDie,
} from '@fox/engine';
import type { AreaColor, DieColor, Dice, Player } from '@fox/engine';
import { useRoom } from './useRoom.js';
import { Sheet, RoundTrack } from './Sheet.jsx';

const DIE_KO: Record<DieColor, string> = {
  yellow: '노랑', blue: '파랑', green: '초록', orange: '주황', purple: '보라', white: '핑크',
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
        playerId={playerId}
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

  const leaveRoom = () => {
    send({ t: 'leave', playerId });
    joinSent.current = false;
    setJoined(false);
    setCode('');
    // hash = '' 는 '#' 가 남고 hashchange 도 안 뜬다. 주소만 조용히 정리한다.
    history.replaceState(null, '', location.pathname + location.search);
  };

  return (
    <Game
      state={state} me={me} playerId={playerId} theme={theme} themeId={themeId}
      setThemeId={setThemeId} send={send} error={error} clearError={clearError}
      mode={mode} status={status} code={code} onLeave={leaveRoom}
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
          {p.mode === 'online' && p.code && <ShareBox code={p.code} />}

          <div className="players-head">
            <span>참가자 {p.players.length}명</span>
            <span className="live"><i />실시간</span>
          </div>
          <ul className="players">
            {p.players.map((x: Player) => (
              <li key={x.id}>
                {x.name}
                {x.id === p.playerId && <em> (나)</em>}
              </li>
            ))}
          </ul>

          {p.mode === 'online' && p.players.length < 2 ? (
            <>
              <button className="primary" disabled>
                <span className="dots" aria-hidden="true"><i /><i /><i /></span>
                다른 사람을 기다리는 중
              </button>
              <p className="note sub-note">
                한 명이라도 더 들어오면 시작 버튼이 켜집니다.
                {' '}<button className="linkish" onClick={p.onStart}>혼자 연습하기</button>
              </p>
            </>
          ) : (
            <button className="primary" disabled={p.players.length < 1} onClick={p.onStart}>
              시작 ({p.players.length}명)
            </button>
          )}
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

/** 로비에서 방 코드와 링크를 크게 보여준다 — 혼자 먼저 시작해버리는 사고를 줄인다. */
function ShareBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const url = location.origin + location.pathname + '#/' + code;
  return (
    <div className="sharebox">
      <div className="sb-label">방 코드</div>
      <div className="sb-code">{code}</div>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(url).then(
            () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
            () => {},
          );
        }}
      >
        {copied ? '복사됨' : '참가 링크 복사'}
      </button>
      <p className="sb-hint">
        다른 사람은 같은 방 코드를 입력하거나 이 링크로 들어오면 됩니다.
      </p>
    </div>
  );
}

// ---------------- 게임 ----------------

function Game({ state, me, playerId, theme, send, error, clearError, mode, status, code, onLeave }: any) {
  const [sel, setSel] = useState<DieColor | null>(null);
  const [cellMode, setCellMode] = useState<null | { die: DieColor }>(null);
  const [draft, setDraft] = useState<Partial<Dice>>({});
  const [tab, setTab] = useState<'me' | 'others' | 'score'>('me');
  const [manual, setManual] = useState(false);
  const [askLeave, setAskLeave] = useState(false);

  const isActive = state.players[state.activeIdx]?.id === playerId;
  const s = state as any;

  // 이번에 고를 수 있는 주사위 목록
  // 은쟁반에 쓸 수 있는 주사위가 있으면 액티브의 주사위 칸에서는 가져올 수 없다(룰북 특례).
  const sum = s.dice.blue + s.dice.white;
  const usable = (d: DieColor) => canUseDie(me.sheet, d, s.dice[d], sum);
  const platterUsable = s.platter.some(usable);

  const choosable: DieColor[] =
    s.phase === 'active' && isActive ? s.pool
    : s.phase === 'passive' && !me.pickedThisTurn
      ? (platterUsable ? s.platter : [...s.platter, ...s.placed])
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
        <div className="head-right">
          <button className="manual-btn" onClick={() => setManual(true)}>설명서</button>
          {askLeave ? (
            <span className="leave-ask">
              정말 나갈까요?
              <button className="leave" onClick={onLeave}>나가기</button>
              <button onClick={() => setAskLeave(false)}>취소</button>
            </span>
          ) : (
            <button className="leave" onClick={() => setAskLeave(true)}>방 나가기</button>
          )}
        </div>
      </header>

      {error && <div className="err" onClick={clearError}>{error} (눌러서 닫기)</div>}

      {s.phase === 'gameOver' ? (
        <GameOver state={state} theme={theme} />
      ) : (
        <div className="layout">
          {/* ---- 왼쪽 컨트롤바 ---- */}
          <aside className="sidebar">
            <nav className="tabs">
              <button className={tab === 'me' ? 'on' : ''} onClick={() => setTab('me')}>
                내 {theme.terms.score}판
              </button>
              <button
                className={tab === 'others' ? 'on' : ''}
                disabled={others.length === 0}
                onClick={() => setTab('others')}
              >
                다른 사람 ({others.length})
              </button>
              <button className={tab === 'score' ? 'on' : ''} onClick={() => setTab('score')}>
                {theme.terms.score}표
              </button>
            </nav>

            <RoundTrack round={s.round} totalRounds={s.totalRounds} theme={theme} />

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

            {/* 재굴림 · 추가 주사위 · 턴 종료 */}
            <Actions state={state} me={me} isActive={isActive} playerId={playerId} send={send} theme={theme}
              canPick={[...s.platter, ...s.placed].some(usable)} />


            <Platter state={state} theme={theme} playerId={playerId} />
          </aside>

          {/* ---- 가운데 보드 ---- */}
          <main className="board">
            {tab === 'me' ? (
              <Sheet
                player={me} theme={theme}
                yellowTargets={yellowTargets} blueTargets={blueTargets}
                onYellow={onYellow} onBlue={onBlue}
              />
            ) : tab === 'others' ? (
              <div className="others">
                {others.map((p: Player) => (
                  <Sheet key={p.id} player={p} theme={theme} />
                ))}
              </div>
            ) : (
              <ScorePad state={state} theme={theme} playerId={playerId} />
            )}
          </main>
        </div>
      )}

      {manual && <Manual theme={theme} onClose={() => setManual(false)} />}
    </div>
  );
}

/** 컨트롤바에서 켜고 끄는 설명서. 테마 용어를 그대로 쓴다. */
function Manual({ theme, onClose }: any) {
  const A = theme.areas;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="manual-overlay" onClick={onClose}>
      <div className="manual" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
      <div className="manual-head">
        <h3>설명서</h3>
        <button onClick={onClose}>닫기</button>
      </div>

      <h4>한 턴의 흐름</h4>
      <ol>
        <li>액티브는 {theme.terms.dice} 6개를 굴려 눈을 입력합니다.</li>
        <li>1개를 골라 {theme.terms.dice} 칸에 올리고 같은 색 영역에 기입합니다.</li>
        <li>고른 것보다 <b>낮은 눈</b>은 전부 {theme.terms.platter}으로 내려갑니다.</li>
        <li>남은 것으로 다시 굴려 총 <b>3번</b> 반복합니다.</li>
        <li>그다음 나머지 사람들이 {theme.terms.platter}에서 <b>각자 1개씩</b> 고릅니다. 같은 것을 여러 명이 골라도 됩니다.</li>
      </ol>

      <h4>주사위 색</h4>
      <ul>
        <li><b className="c-pink">핑크</b>는 조커입니다. {A.yellow.name}·{A.green.name}·{A.orange.name}·{A.purple.name} 아무 데나 쓰거나, 파랑과 합쳐 {A.blue.name}에 씁니다.</li>
        <li>{A.blue.name}은 <b>파랑 + 핑크의 합</b>으로만 기입합니다. 한쪽 값만으로는 안 됩니다.</li>
      </ul>

      <h4>영역별 규칙</h4>
      <ul>
        <li><b className="c-yellow">{A.yellow.name}</b> 같은 숫자 한 칸을 X. 순서 자유. 세로 완성 = 점수, 가로 완성 = 보너스, 대각선 = {theme.terms.plusOne}.</li>
        <li><b className="c-blue">{A.blue.name}</b> 합에 해당하는 칸을 X. 순서 자유. 체크한 <b>개수</b>로 점수가 정해집니다.</li>
        <li><b className="c-green">{A.green.name}</b> 왼쪽부터 순서대로. 칸에 적힌 <b>최소값 이상</b>이어야 합니다. 마지막 칸 위 숫자가 점수.</li>
        <li><b className="c-orange">{A.orange.name}</b> 왼쪽부터 순서대로 눈을 그대로 적습니다. ×2·×3 칸은 곱해서 적습니다. 합이 점수.</li>
        <li><b className="c-purple">{A.purple.name}</b> 왼쪽부터 순서대로 <b>직전보다 큰 값</b>. 단 6 다음엔 아무 값이나 가능. 합이 점수.</li>
      </ul>

      <h4>보너스와 액션</h4>
      <ul>
        <li><b>보너스</b>는 저장할 수 없고 <b>즉시</b> 처리합니다. 보너스가 또 보너스를 부르면 연쇄로 이어집니다.</li>
        <li><b>↻ {theme.terms.reroll}</b> 액티브만 사용. 손에 남은 {theme.terms.dice}를 <b>전부</b> 다시 굴립니다. 굴림 횟수는 줄지 않습니다.</li>
        <li><b>+1 {theme.terms.plusOne}</b> 턴 마지막에 사용. 6개 중 아무거나 하나를 더 씁니다. 같은 것은 턴당 한 번만.</li>
        <li>두 액션은 <b>저장했다가 나중에 써도 됩니다.</b></li>
      </ul>

      <h4>{theme.fox.name}</h4>
      <p>{theme.fox.law} 다섯 영역 중 <b>가장 낮은 점수</b>만큼만 쳐주므로, 한 영역이라도 0점이면 전부 0점이 됩니다.</p>

      <h4>화면 사용법</h4>
      <ul>
        <li>영역 이름이나 보너스 아이콘에 <b>커서를 올리면</b> 해당 규칙 설명이 나옵니다.</li>
        <li>왼쪽 위 탭으로 내 판 / 다른 사람 판 / {theme.terms.score}표를 넘길 수 있습니다.</li>
        <li><b>Esc</b> 를 누르거나 바깥을 클릭하면 이 설명서가 닫힙니다.</li>
      </ul>
      </div>
    </div>
  );
}

/** 실시간 점수표 — 실물 시트 뒷면의 집계표에 해당한다. 매 수 자동 갱신. */
function ScorePad({ state, theme, playerId }: any) {
  const AREAS: AreaColor[] = ['yellow', 'blue', 'green', 'orange', 'purple'];
  const rows = state.players
    .map((p: Player) => ({ p, ...totalScore(p.sheet) }))
    .sort((a: any, b: any) => b.total - a.total);

  return (
    <div className="scorepad">
      <table>
        <thead>
          <tr>
            <th>이름</th>
            {AREAS.map((a) => (
              <th key={a} title={theme.areas[a].blurb ?? theme.areas[a].name}>{theme.areas[a].name}</th>
            ))}
            <th title={theme.fox.law}>{theme.fox.icon} {theme.fox.name}</th>
            <th>합계</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, i: number) => (
            <tr key={r.p.id} className={r.p.id === playerId ? 'me' : ''}>
              <td>
                <span className="rank">{i + 1}</span>{r.p.name}
                {!r.p.connected && ' (끊김)'}
              </td>
              {AREAS.map((a) => (
                <td key={a} className={r.areas[a] === 0 ? 'zero' : ''}>{r.areas[a]}</td>
              ))}
              <td title={`${r.p.sheet.foxes}마리 x 최저 영역 ${Math.min(...(Object.values(r.areas) as number[]))}점`}>
                {r.p.sheet.foxes ? `${r.p.sheet.foxes}x = ${r.fox}` : '0'}
              </td>
              <td className="total">{r.total}</td>
            </tr>
          ))}
        </tbody>
        <caption>
          매 기입마다 자동으로 다시 계산됩니다.
          {theme.fox.name} 은(는) 다섯 영역 중 가장 낮은 점수만큼만 쳐주므로,
          <b> 0점인 영역이 하나라도 있으면 전부 0점</b>이 됩니다 (빨간 숫자).
        </caption>
      </table>
    </div>
  );
}

/** 은쟁반과 액티브의 주사위 칸 — 언제나 보이는 현재 상태. */
function Platter({ state, theme, playerId }: any) {
  const s = state as any;
  const active = state.players[state.activeIdx];
  const chip = (d: DieColor, where: string) => (
    <span key={where + d} className={'chip-die d-' + d} title={DIE_KO[d]}>
      <b>{s.dice[d]}</b>{DIE_KO[d]}
    </span>
  );
  return (
    <div className="platter">
      <div className="pl-row">
        <span className="pl-label">{theme.terms.platter}</span>
        {s.platter.length
          ? s.platter.map((d: DieColor) => chip(d, 'p'))
          : <span className="pl-empty">비어 있음</span>}
      </div>
      <div className="pl-row">
        <span className="pl-label">
          {active?.id === playerId ? '내' : active?.name + ' 의'} {theme.terms.dice} 칸
        </span>
        {[0, 1, 2].map((i) => {
          const d = s.placed[i] as DieColor | undefined;
          return d
            ? chip(d, 'f' + i)
            : <span key={'f' + i} className="chip-die empty">·</span>;
        })}
      </div>
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
  return (
    <div className="status">
      <div className="msg">{msg}</div>
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

function Actions({ state, me, isActive, playerId, send, theme, canPick }: any) {
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
      {state.phase === 'passive' && !me.pickedThisTurn && !canPick && (
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
