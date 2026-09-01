import { YELLOW_COL_SCORE, BLUE_GRID, BLUE_SCALE, GREEN_SCORE } from './sheet.js';
import type { AreaColor, Sheet } from './types.js';

export type AreaScores = Record<AreaColor, number>;

export function areaScores(s: Sheet): AreaScores {
  let yellow = 0;
  for (let c = 0; c < YELLOW_COL_SCORE.length; c++) {
    if (s.yellow.every((row) => row[c])) yellow += YELLOW_COL_SCORE[c];
  }

  let blueCount = 0;
  BLUE_GRID.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v !== null && s.blue[r][c]) blueCount++;
    }),
  );

  const sum = (a: (number | null)[]) => a.reduce<number>((t, v) => t + (v ?? 0), 0);

  return {
    yellow,
    blue: BLUE_SCALE[Math.min(blueCount, BLUE_SCALE.length - 1)],
    green: GREEN_SCORE[Math.min(s.green, GREEN_SCORE.length - 1)],
    orange: sum(s.orange),
    purple: sum(s.purple),
  };
}

/** 여우 1마리의 가치 = 최저 점수 영역의 점수. 한 영역이라도 0이면 0이 된다. */
export function foxValue(s: Sheet): number {
  return Math.min(...Object.values(areaScores(s)));
}

export function totalScore(s: Sheet): { areas: AreaScores; fox: number; total: number } {
  const areas = areaScores(s);
  const fox = s.foxes * Math.min(...Object.values(areas));
  return { areas, fox, total: Object.values(areas).reduce((a, b) => a + b, 0) + fox };
}
