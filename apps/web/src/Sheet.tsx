import {
  YELLOW_GRID, YELLOW_COL_SCORE, YELLOW_ROW_BONUS, YELLOW_DIAG_BONUS,
  BLUE_GRID, BLUE_SCALE, BLUE_ROW_BONUS, BLUE_COL_BONUS,
  GREEN_MIN, GREEN_SCORE, GREEN_BONUS,
  ORANGE_MULT, ORANGE_BONUS, PURPLE_BONUS,
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

interface Props {
  player: Player;
  theme: Theme;
  compact?: boolean;
  /** 클릭 가능한 노랑 칸 목록 (없으면 비활성) */
  yellowTargets?: { r: number; c: number }[];
  blueTargets?: { r: number; c: number }[];
  onYellow?: (r: number, c: number) => void;
  onBlue?: (r: number, c: number) => void;
}

const key = (r: number, c: number) => r + ':' + c;

export function Sheet({ player, theme, compact, yellowTargets, blueTargets, onYellow, onBlue }: Props) {
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

      <div className="areas">
        {/* 노랑 */}
        <section className="area a-yellow">
          <h4>{theme.areas.yellow.name} <em>{areas.yellow}</em></h4>
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
                <span className="rowbonus">{bonusLabel(YELLOW_ROW_BONUS[r])}</span>
              </div>
            ))}
            <div className="grid-row foot">
              {YELLOW_COL_SCORE.map((sc, c) => (
                <span key={c} className={'colscore' + (s.yellow.every((row) => row[c]) ? ' won' : '')}>{sc}</span>
              ))}
              <span className="rowbonus">{bonusLabel(YELLOW_DIAG_BONUS)}</span>
            </div>
          </div>
        </section>

        {/* 파랑 */}
        <section className="area a-blue">
          <h4>{theme.areas.blue.name} <em>{areas.blue}</em></h4>
          <div className="scale">
            {BLUE_SCALE.slice(1).map((p, i) => (
              <span key={i} className={'tick' + (blueCount >= i + 1 ? ' won' : '')}>{p}</span>
            ))}
          </div>
          <div className="grid g4">
            {BLUE_GRID.map((row, r) => (
              <div className="grid-row" key={r}>
                {row.map((v, c) => {
                  const on = s.blue[r][c];
                  const hit = bt.has(key(r, c));
                  return (
                    <button
                      key={c}
                      className={'cell' + (on ? ' on' : '') + (v === null ? ' blank' : '') + (hit ? ' target' : '')}
                      disabled={!hit}
                      onClick={() => onBlue?.(r, c)}
                    >
                      {v ?? '·'}
                    </button>
                  );
                })}
                <span className="rowbonus">{bonusLabel(BLUE_ROW_BONUS[r])}</span>
              </div>
            ))}
            <div className="grid-row foot">
              {BLUE_COL_BONUS.map((b, c) => <span key={c} className="colscore">{bonusLabel(b)}</span>)}
              <span className="rowbonus" />
            </div>
          </div>
        </section>

        {/* 초록 */}
        <section className="area a-green">
          <h4>{theme.areas.green.name} <em>{areas.green}</em></h4>
          <div className="track">
            {GREEN_MIN.map((min, i) => (
              <div key={i} className={'slot' + (i < s.green ? ' on' : '') + (i === s.green ? ' next' : '')}>
                <span className="sc">{GREEN_SCORE[i + 1]}</span>
                <span className="val">≥{min}</span>
                <span className="bn">{bonusLabel(GREEN_BONUS[i])}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 주황 */}
        <section className="area a-orange">
          <h4>{theme.areas.orange.name} <em>{areas.orange}</em></h4>
          <div className="track">
            {ORANGE_MULT.map((m, i) => (
              <div key={i} className={'slot' + (s.orange[i] !== null ? ' on' : '')}>
                <span className="sc">{m > 1 ? '×' + m : ''}</span>
                <span className="val">{s.orange[i] ?? ''}</span>
                <span className="bn">{bonusLabel(ORANGE_BONUS[i])}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 보라 */}
        <section className="area a-purple">
          <h4>{theme.areas.purple.name} <em>{areas.purple}</em></h4>
          <div className="track">
            {PURPLE_BONUS.map((b, i) => (
              <div key={i} className={'slot' + (s.purple[i] !== null ? ' on' : '')}>
                <span className="sc" />
                <span className="val">{s.purple[i] ?? ''}</span>
                <span className="bn">{bonusLabel(b)}</span>
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
