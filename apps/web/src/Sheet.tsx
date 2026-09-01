import {
  YELLOW_GRID, YELLOW_COL_SCORE, YELLOW_ROW_BONUS, YELLOW_DIAG_BONUS,
  BLUE_GRID, BLUE_SCALE, BLUE_ROW_BONUS, BLUE_COL_BONUS,
  GREEN_MIN, GREEN_SCORE, GREEN_BONUS,
  ORANGE_MULT, ORANGE_BONUS, PURPLE_BONUS, ROUND_BONUS,
  areaScores, totalScore,
} from '@fox/engine';
import type { Bonus, Player, Theme } from '@fox/engine';

export function bonusLabel(b: Bonus | null | undefined): string {
  if (!b) return '';
  switch (b.t) {
    case 'x': return { yellow: '✗노', blue: '✗파', green: '✗초' }[b.area];
    case 'xAny': return '✗?';
    case 'num': return (b.area === 'orange' ? '주' : '보') + b.v;
    case 'numAny': return '?' + b.v;
    case 'fox': return '★';
    case 'reroll': return '↻';
    case 'plusOne': return '+1';
  }
}

/** 보너스 아이콘에 커서를 올렸을 때 나오는 설명. */
export function bonusTip(b: Bonus | null | undefined, theme: Theme): string {
  if (!b) return '';
  const A = (a: 'yellow' | 'blue' | 'green' | 'orange' | 'purple') => theme.areas[a].name;
  switch (b.t) {
    case 'x':
      return b.area === 'green'
        ? `보너스: ${A('green')} 의 다음 칸을 즉시 하나 체크합니다.`
        : `보너스: ${A(b.area)} 에서 원하는 칸 하나를 즉시 체크합니다.`;
    case 'xAny':
      return `보너스: ${A('yellow')}·${A('blue')}·${A('green')} 중 원하는 곳 한 칸을 즉시 체크합니다.`;
    case 'num':
      return `보너스: ${A(b.area)} 의 다음 칸에 즉시 ${b.v} 을(를) 적습니다.`;
    case 'numAny':
      return `보너스: ${A('orange')} 또는 ${A('purple')} 의 다음 칸에 ${b.v} 을(를) 적습니다.`;
    case 'fox':
      return `${theme.fox.name}: ${theme.fox.law}`;
    case 'reroll':
      return `${theme.terms.reroll} 액션을 얻습니다. 저장해 두었다가 나중에 써도 됩니다.`;
    case 'plusOne':
      return `${theme.terms.plusOne} 액션을 얻습니다. 저장해 두었다가 나중에 써도 됩니다.`;
  }
}

/** 각 색 영역의 규칙 설명 — 제목에 커서를 올리면 보인다. */
function areaTip(a: 'yellow' | 'blue' | 'green' | 'orange' | 'purple', theme: Theme): string {
  const n = (x: typeof a) => theme.areas[x].name;
  const W = '핑크(조커)';
  switch (a) {
    case 'yellow':
      return `${n('yellow')}: 고른 노랑(또는 ${W}) 주사위 눈과 같은 숫자 한 칸을 지웁니다. 순서는 자유입니다.\n`
        + `· 세로 한 줄을 다 지우면 아래 숫자가 그대로 점수가 됩니다.\n`
        + `· 가로 한 줄을 다 지우면 오른쪽 보너스를 얻습니다.\n`
        + `· 대각선(3·1·2·6)을 다 지우면 ${theme.terms.plusOne} 을 얻습니다.`;
    case 'blue':
      return `${n('blue')}: 파랑 주사위와 ${W} 주사위의 합(2~12)에 해당하는 칸을 지웁니다. 한쪽 값만으로는 적을 수 없습니다.\n`
        + `· 순서는 자유입니다.\n`
        + `· 가로·세로 줄을 다 지우면 끝의 보너스를 얻습니다.\n`
        + `· 점수는 지운 칸 개수로 정해집니다 (위쪽 눈금 참고).`;
    case 'green':
      return `${n('green')}: 왼쪽부터 순서대로만 체크할 수 있습니다 (건너뛰기 불가).\n`
        + `· 칸에 적힌 최소값 이상의 초록(또는 ${W}) 눈이어야 합니다.\n`
        + `· 마지막으로 체크한 칸 위의 숫자가 그대로 점수입니다.`;
    case 'orange':
      return `${n('orange')}: 왼쪽부터 순서대로 주사위 눈을 그대로 적습니다. 값 제한은 없습니다.\n`
        + `· ×2, ×3 칸에서는 눈에 배수를 곱해 적습니다 (×2 칸에 6 → 12).\n`
        + `· 적은 숫자를 모두 더한 값이 점수입니다.`;
    case 'purple':
      return `${n('purple')}: 왼쪽부터 순서대로, 직전 칸보다 큰 값을 적어야 합니다.\n`
        + `· 예외 — 6 을 적은 다음에는 아무 값이나 올 수 있습니다 (2 < 5 < 6 → 3 가능).\n`
        + `· 적은 숫자를 모두 더한 값이 점수입니다.`;
  }
}

/** 실물 시트의 액션 바 칸 수 (재굴림·추가 주사위 각 7칸). */
const ACTION_SLOTS = 7;

interface Props {
  player: Player;
  theme: Theme;
  compact?: boolean;
  /** 라운드 트랙 표시용. 없으면 트랙을 그리지 않는다. */
  round?: number;
  totalRounds?: number;
  /** 클릭 가능한 노랑 칸 목록 (없으면 비활성) */
  yellowTargets?: { r: number; c: number }[];
  blueTargets?: { r: number; c: number }[];
  onYellow?: (r: number, c: number) => void;
  onBlue?: (r: number, c: number) => void;
}

const key = (r: number, c: number) => r + ':' + c;

export function Sheet({
  player, theme, compact, round, totalRounds, yellowTargets, blueTargets, onYellow, onBlue,
}: Props) {
  const s = player.sheet;
  const areas = areaScores(s);
  const total = totalScore(s);
  const yt = new Set((yellowTargets ?? []).map((t) => key(t.r, t.c)));
  const bt = new Set((blueTargets ?? []).map((t) => key(t.r, t.c)));
  const blueCount = BLUE_GRID.flat().filter((v, i) => v !== null && s.blue[Math.floor(i / 4)][i % 4]).length;

  return (
    <div className={'sheet' + (compact ? ' compact' : '')}>
      <div className="sheet-head">
        <strong>{player.name}</strong>
        <span className="total">{total.total}점</span>
        {!player.connected && <span className="off">연결 끊김</span>}
      </div>

      {/* 실물 시트 상단: 라운드 트랙 + 액션 바 2줄 */}
      <div className="sheet-bars">
        {round !== undefined && totalRounds !== undefined && (
          <div className="bar b-round">
            <span className="bar-ico">{theme.terms.round}</span>
            {Array.from({ length: 6 }, (_, i) => {
              const rb = ROUND_BONUS[i];
              const pair = Array.isArray(rb);
              const label = pair ? bonusLabel(rb[0]) + ' / ' + bonusLabel(rb[1]) : bonusLabel(rb as Bonus);
              const head = `${i + 1}${theme.terms.round} 시작`;
              const tip = pair
                ? `${head}: 둘 중 하나를 고릅니다.\n· ${bonusTip(rb[0], theme)}\n· ${bonusTip(rb[1], theme)}`
                : rb
                  ? `${head}: ${bonusTip(rb as Bonus, theme)}`
                  : `${i + 1}${theme.terms.round} 은 시작 보너스가 없습니다.`;
              return (
                <i key={i} title={tip}
                  className={'box' + (i + 1 < round ? ' done' : '') + (i + 1 === round ? ' now' : '') + (i + 1 > totalRounds ? ' off' : '')}>
                  <b>{i + 1}</b>
                  <u>{label || '—'}</u>
                </i>
              );
            })}
          </div>
        )}
        <ActionBar
          cls="b-reroll" ico="↻" label={theme.terms.reroll}
          earned={s.rerollEarned} used={s.rerollUsed}
        />
        <ActionBar
          cls="b-plus" ico="+1" label={theme.terms.plusOne}
          earned={s.plusOneEarned} used={s.plusOneUsed}
        />
      </div>

      <div className="areas">
        {/* 노랑 */}
        <section className="area a-yellow">
          <h4 title={areaTip('yellow', theme)}>{theme.areas.yellow.name} <em>{areas.yellow}</em></h4>
          <div className="grid g4">
            {YELLOW_GRID.map((row, r) => (
              <div className="grid-row" key={r}>
                {row.map((v, c) => {
                  const on = s.yellow[r][c];
                  const hit = yt.has(key(r, c));
                  return (
                    <button
                      key={c}
                      className={'cell' + (on ? ' on' : '') + (v === null ? ' blank' : '') + (hit ? ' target' : '')}
                      disabled={!hit}
                      onClick={() => onYellow?.(r, c)}
                    >
                      {v ?? '·'}
                    </button>
                  );
                })}
                <span className="rowbonus" title={bonusTip(YELLOW_ROW_BONUS[r], theme)}>{bonusLabel(YELLOW_ROW_BONUS[r])}</span>
              </div>
            ))}
            <div className="grid-row foot">
              {YELLOW_COL_SCORE.map((sc, c) => (
                <span key={c} className={'colscore' + (s.yellow.every((row) => row[c]) ? ' won' : '')}>{sc}</span>
              ))}
              <span className="rowbonus" title={bonusTip(YELLOW_DIAG_BONUS, theme)}>{bonusLabel(YELLOW_DIAG_BONUS)}</span>
            </div>
          </div>
          <p className="area-note dim">세로 줄을 다 채우면 <b>아래 숫자가 점수</b>, 가로 줄은 <b>오른쪽</b> 보너스, 대각선은 맨 오른쪽 아래 보너스입니다.</p>
        </section>

        {/* 파랑 */}
        <section className="area a-blue">
          <h4 title={areaTip('blue', theme)}>{theme.areas.blue.name} <em>{areas.blue}</em></h4>
          <p className="area-note">체크한 칸 수 &rarr; 점수 (지금 <b>{blueCount}칸 = {areas.blue}점</b>)</p>
          <div className="scale">
            {BLUE_SCALE.slice(1).map((p, i) => (
              <span key={i} className={'tick' + (blueCount >= i + 1 ? ' won' : '')}
                title={(i + 1) + '칸을 체크하면 ' + p + '점'}>{p}</span>
            ))}
          </div>
          <div className="grid g4">
            {BLUE_GRID.map((row, r) => (
              <div className="grid-row" key={r}>
                {row.map((v, c) => {
                  const on = s.blue[r][c];
                  const hit = bt.has(key(r, c));
                  // 좌상단은 숫자 칸이 아니라 "파랑 + 핑크의 합" 안내 칸이다.
                  return (
                    <button
                      key={c}
                      className={'cell' + (on ? ' on' : '') + (v === null ? ' sumhint' : '') + (hit ? ' target' : '')}
                      disabled={!hit}
                      onClick={() => onBlue?.(r, c)}
                      title={v === null ? '파랑 주사위 + 핑크 주사위의 합을 기록합니다' : undefined}
                    >
                      {v ?? '파+핑'}
                    </button>
                  );
                })}
                <span className="rowbonus" title={bonusTip(BLUE_ROW_BONUS[r], theme)}>{bonusLabel(BLUE_ROW_BONUS[r])}</span>
              </div>
            ))}
            <div className="grid-row foot">
              {BLUE_COL_BONUS.map((b, c) => <span key={c} className="colscore bonus" title={bonusTip(b, theme)}>{bonusLabel(b)}</span>)}
              <span className="rowbonus" />
            </div>
          </div>
          <p className="area-note dim">세로 줄을 다 채우면 <b>아래</b> 보너스, 가로 줄을 다 채우면 <b>오른쪽</b> 보너스를 즉시 받습니다.</p>
        </section>

        {/* 초록 */}
        <section className="area a-green">
          <h4 title={areaTip('green', theme)}>{theme.areas.green.name} <em>{areas.green}</em></h4>
          <div className="track">
            {GREEN_MIN.map((min, i) => (
              <div key={i} className={'slot' + (i < s.green ? ' on' : '') + (i === s.green ? ' next' : '')}>
                <span className="sc">{GREEN_SCORE[i + 1]}</span>
                <span className="val">≥{min}</span>
                <span className="bn" title={bonusTip(GREEN_BONUS[i], theme)}>{bonusLabel(GREEN_BONUS[i])}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 주황 */}
        <section className="area a-orange">
          <h4 title={areaTip('orange', theme)}>{theme.areas.orange.name} <em>{areas.orange}</em></h4>
          <div className="track">
            {ORANGE_MULT.map((m, i) => (
              <div key={i} className={'slot' + (s.orange[i] !== null ? ' on' : '')}>
                <span className="sc">{m > 1 ? '×' + m : ''}</span>
                <span className="val">{s.orange[i] ?? ''}</span>
                <span className="bn" title={bonusTip(ORANGE_BONUS[i], theme)}>{bonusLabel(ORANGE_BONUS[i])}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 보라 */}
        <section className="area a-purple">
          <h4 title={areaTip('purple', theme)}>{theme.areas.purple.name} <em>{areas.purple}</em></h4>
          <div className="track">
            {PURPLE_BONUS.map((b, i) => (
              <div key={i} className={'slot' + (s.purple[i] !== null ? ' on' : '')}>
                <span className="sc" />
                <span className="val">{s.purple[i] ?? ''}</span>
                <span className="bn" title={bonusTip(b, theme)}>{bonusLabel(b)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="sheet-foot">
        <span title={theme.fox.law}>{theme.fox.icon} {theme.fox.name} ×{s.foxes} = {total.fox}점</span>
        <span>↻ {theme.terms.reroll} {s.rerollEarned - s.rerollUsed}</span>
        <span>+1 {theme.terms.plusOne} {s.plusOneEarned - s.plusOneUsed}</span>
      </div>
    </div>
  );
}

/** 실물 시트의 액션 바 — 획득하면 동그라미, 쓰면 X. */
function ActionBar({ cls, ico, label, earned, used }: {
  cls: string; ico: string; label: string; earned: number; used: number;
}) {
  return (
    <div className={'bar ' + cls} title={label + ' ' + (earned - used) + '개 남음'}>
      <span className="bar-ico">{ico}</span>
      {Array.from({ length: ACTION_SLOTS }, (_, i) => (
        <i key={i} className={'pip' + (i < used ? ' used' : i < earned ? ' got' : '')} />
      ))}
    </div>
  );
}
