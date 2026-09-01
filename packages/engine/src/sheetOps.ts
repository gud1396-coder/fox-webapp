import {
  YELLOW_GRID, YELLOW_ROW_BONUS, YELLOW_DIAG_BONUS,
  BLUE_GRID, BLUE_ROW_BONUS, BLUE_COL_BONUS,
  GREEN_MIN, GREEN_BONUS, GREEN_SLOTS,
  ORANGE_MULT, ORANGE_BONUS, ORANGE_SLOTS,
  PURPLE_BONUS, PURPLE_SLOTS,
} from './sheet.js';
import type { Sheet, Player, Bonus, ChoiceAnswer, DieColor } from './types.js';
import { RuleError } from './types.js';

export function createSheet(): Sheet {
  return {
    yellow: YELLOW_GRID.map((row) => row.map((v) => v === null)),
    blue: BLUE_GRID.map((row) => row.map((v) => v === null)),
    green: 0,
    orange: Array<number | null>(ORANGE_SLOTS).fill(null),
    purple: Array<number | null>(PURPLE_SLOTS).fill(null),
    foxes: 0,
    rerollEarned: 0,
    rerollUsed: 0,
    plusOneEarned: 0,
    plusOneUsed: 0,
  };
}

function push(p: Player, b: Bonus | null | undefined): void {
  if (b) p.queue.push(b);
}

// ---------- 노랑 ----------

export function yellowCandidates(sheet: Sheet, value: number): { r: number; c: number }[] {
  const out: { r: number; c: number }[] = [];
  YELLOW_GRID.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v === value && !sheet.yellow[r][c]) out.push({ r, c });
    }),
  );
  return out;
}

export function hasFreeYellow(sheet: Sheet): boolean {
  return YELLOW_GRID.some((row, r) => row.some((v, c) => v !== null && !sheet.yellow[r][c]));
}

/** expect 를 주면 주사위 눈과 칸 숫자가 일치하는지 검사한다. 보너스 체크는 생략한다. */
export function markYellow(p: Player, r: number, c: number, expect?: number): void {
  const cell = YELLOW_GRID[r]?.[c];
  if (cell === undefined) throw new RuleError('노랑: 범위 밖 칸');
  if (cell === null) throw new RuleError('노랑: 숫자가 없는 칸');
  if (p.sheet.yellow[r][c]) throw new RuleError('노랑: 이미 체크된 칸');
  if (expect !== undefined && cell !== expect) {
    throw new RuleError('노랑: 주사위 눈(' + expect + ')과 다른 칸(' + cell + ')');
  }
  p.sheet.yellow[r][c] = true;
  if (p.sheet.yellow[r].every(Boolean)) push(p, YELLOW_ROW_BONUS[r]);
  // 대각선(좌상 -> 우하)은 그 위의 칸을 찍었을 때만 완성될 수 있다.
  if (r === c && [0, 1, 2, 3].every((i) => p.sheet.yellow[i][i])) push(p, YELLOW_DIAG_BONUS);
}

// ---------- 파랑 ----------

export function findBlueCell(sum: number): { r: number; c: number } | null {
  for (let r = 0; r < BLUE_GRID.length; r++) {
    for (let c = 0; c < BLUE_GRID[r].length; c++) {
      if (BLUE_GRID[r][c] === sum) return { r, c };
    }
  }
  return null;
}

export function hasFreeBlue(sheet: Sheet): boolean {
  return BLUE_GRID.some((row, r) => row.some((v, c) => v !== null && !sheet.blue[r][c]));
}

export function markBlue(p: Player, r: number, c: number): void {
  const cell = BLUE_GRID[r]?.[c];
  if (cell === undefined) throw new RuleError('파랑: 범위 밖 칸');
  if (cell === null) throw new RuleError('파랑: 빈 칸');
  if (p.sheet.blue[r][c]) throw new RuleError('파랑: 이미 체크된 칸');
  p.sheet.blue[r][c] = true;
  if (p.sheet.blue[r].every(Boolean)) push(p, BLUE_ROW_BONUS[r]);
  if (p.sheet.blue.every((row) => row[c])) push(p, BLUE_COL_BONUS[c]);
}

// ---------- 초록 ----------

export function greenNeeds(sheet: Sheet): number | null {
  return sheet.green >= GREEN_SLOTS ? null : GREEN_MIN[sheet.green];
}

/** dieValue 를 주면 최소 요구값을 검사한다. 보너스 X 는 요구값을 무시하므로 인자 없이 호출한다. */
export function advanceGreen(p: Player, dieValue?: number): void {
  const i = p.sheet.green;
  if (i >= GREEN_SLOTS) return; // 가득 참 -> 보너스 소멸
  if (dieValue !== undefined && dieValue < GREEN_MIN[i]) {
    throw new RuleError('초록: ' + (i + 1) + '번 칸은 ' + GREEN_MIN[i] + ' 이상 필요');
  }
  p.sheet.green = i + 1;
  push(p, GREEN_BONUS[i]);
}

// ---------- 주황 ----------

export function nextOrange(sheet: Sheet): number {
  return sheet.orange.findIndex((v) => v === null);
}

export function writeOrange(p: Player, v: number): void {
  const i = nextOrange(p.sheet);
  if (i < 0) return; // 가득 참
  p.sheet.orange[i] = v * ORANGE_MULT[i];
  push(p, ORANGE_BONUS[i]);
}

// ---------- 보라 ----------

export function nextPurple(sheet: Sheet): number {
  return sheet.purple.findIndex((v) => v === null);
}

/** 보너스로 기입할 때는 enforce=false. 규칙상 그냥 적는다. */
export function writePurple(p: Player, v: number, enforce: boolean): void {
  const i = nextPurple(p.sheet);
  if (i < 0) return;
  if (enforce && i > 0) {
    const prev = p.sheet.purple[i - 1] as number;
    if (prev !== 6 && v <= prev) {
      throw new RuleError('보라: 직전 값(' + prev + ')보다 커야 합니다');
    }
  }
  p.sheet.purple[i] = v;
  push(p, PURPLE_BONUS[i]);
}

/** 다음 보라 칸에 넣을 수 있는 최소값. null 이면 가득 참. */
export function purpleNeeds(sheet: Sheet): number | null {
  const i = nextPurple(sheet);
  if (i < 0) return null;
  if (i === 0) return 1;
  const prev = sheet.purple[i - 1] as number;
  return prev === 6 ? 1 : prev + 1;
}

/**
 * 이 시트에 해당 주사위를 어느 영역에든 합법적으로 기입할 수 있는가.
 *
 * 룰북의 특례("은쟁반의 어떤 주사위도 쓸 수 없을 때만 액티브의 주사위 칸에서
 * 가져올 수 있다")를 판정하는 데 쓴다. blueWhiteSum 은 파랑+흰색의 합이며,
 * 파랑 영역은 언제나 이 합으로만 기입한다.
 */
export function canUseDie(
  sheet: Sheet,
  die: DieColor,
  value: number,
  blueWhiteSum: number,
): boolean {
  const asYellow = () => yellowCandidates(sheet, value).length > 0;
  const asBlue = () => {
    const cell = findBlueCell(blueWhiteSum);
    return !!cell && !sheet.blue[cell.r][cell.c];
  };
  const asGreen = () => {
    const need = greenNeeds(sheet);
    return need !== null && value >= need;
  };
  const asOrange = () => nextOrange(sheet) >= 0;
  const asPurple = () => {
    const need = purpleNeeds(sheet);
    return need !== null && value >= need;
  };

  switch (die) {
    case 'yellow': return asYellow();
    case 'blue': return asBlue();
    case 'green': return asGreen();
    case 'orange': return asOrange();
    case 'purple': return asPurple();
    // 흰색은 조커 — 파랑에는 합으로, 나머지 색에는 자기 눈으로 들어간다.
    case 'white': return asYellow() || asBlue() || asGreen() || asOrange() || asPurple();
  }
}

// ---------- 보너스 체인 ----------

/**
 * 큐를 입력이 필요할 때까지 소진한다.
 * 보너스가 보너스를 부르면 큐 뒤에 붙는다 (BFS, 결정론적).
 */
export function drain(p: Player): void {
  let guard = 0;
  while (!p.awaiting && p.queue.length > 0) {
    if (++guard > 200) throw new RuleError('보너스 체인이 끝나지 않습니다');
    applyBonus(p, p.queue.shift() as Bonus);
  }
}

function applyBonus(p: Player, b: Bonus): void {
  switch (b.t) {
    case 'fox':
      p.sheet.foxes++;
      return;
    case 'reroll':
      p.sheet.rerollEarned++;
      return;
    case 'plusOne':
      p.sheet.plusOneEarned++;
      return;
    case 'x':
      if (b.area === 'green') {
        advanceGreen(p); // 자동. 최소 요구값 무시
        return;
      }
      if (b.area === 'yellow') {
        if (hasFreeYellow(p.sheet)) p.awaiting = { t: 'yellowCell' };
        return;
      }
      if (hasFreeBlue(p.sheet)) p.awaiting = { t: 'blueCell' };
      return;
    case 'xAny':
      p.awaiting = { t: 'xArea' };
      return;
    case 'num':
      if (b.area === 'orange') writeOrange(p, b.v);
      else writePurple(p, b.v, false);
      return;
    case 'numAny':
      p.awaiting = { t: 'numArea', v: b.v };
      return;
  }
}

export function answerChoice(p: Player, a: ChoiceAnswer): void {
  const want = p.awaiting;
  if (!want) throw new RuleError('대기 중인 선택이 없습니다');
  if (want.t !== a.t) throw new RuleError('선택 종류 불일치: ' + want.t + ' 필요');
  p.awaiting = null;
  switch (a.t) {
    case 'yellowCell':
      markYellow(p, a.r, a.c);
      break;
    case 'blueCell':
      markBlue(p, a.r, a.c);
      break;
    case 'xArea':
      p.queue.unshift({ t: 'x', area: a.area });
      break;
    case 'numArea':
      p.queue.unshift({ t: 'num', area: a.area, v: (want as { v: number }).v });
      break;
    case 'roundBonus':
      p.queue.unshift((want as { options: [Bonus, Bonus] }).options[a.index]);
      break;
  }
  drain(p);
}

/** 아직 보너스를 해소하지 못해 다음 단계로 갈 수 없는 상태. */
export function blocked(p: Player): boolean {
  return p.awaiting !== null || p.queue.length > 0;
}
