import type { Bonus } from './types.js';

/**
 * 점수 시트 정의 — 전부 데이터다. 렌더링도 규칙도 여기서만 읽는다.
 *
 * [VERIFIED] 는 Schmidt Spiele 공식 독일어 룰북(49340) PDF 의
 * 벡터 텍스트를 좌표와 함께 추출해 확인한 값.
 * [UNVERIFIED] 는 시트의 아이콘이 벡터 도형이라 추출되지 않은 부분.
 * 실물 사진으로 확인 후 이 파일만 고치면 된다 (docs/RULES.md 하단 목록 참고).
 */

/** 아직 실물 확인이 안 된 값임을 표시. grep 용. */
const TODO = <T>(v: T): T => v;

/** 노랑 4x4. null = 숫자가 없는 특수칸(선체크 상태로 시작). [VERIFIED] */
export const YELLOW_GRID: readonly (readonly (number | null)[])[] = [
  [3, 6, 5, null],
  [2, 1, null, 5],
  [1, null, 2, 4],
  [null, 3, 4, 6],
];

/** 열 완성 시 점수 (좌->우). [VERIFIED] */
export const YELLOW_COL_SCORE = [10, 14, 16, 20] as const;

/** 행 완성 보너스 (위->아래). 아이콘 종류/대상색 [UNVERIFIED] */
export const YELLOW_ROW_BONUS: readonly (Bonus | null)[] = [
  TODO<Bonus>({ t: 'x', area: 'blue' }),
  TODO<Bonus>({ t: 'num', area: 'purple', v: 4 }),
  TODO<Bonus>({ t: 'x', area: 'green' }),
  TODO<Bonus>({ t: 'fox' }),
];

/** 좌상->우하 대각선(3,1,2,6) 완성 보너스. [VERIFIED: +1 액션] */
export const YELLOW_DIAG_BONUS: Bonus = { t: 'plusOne' };

/** 파랑 3x4. 좌상단은 빈칸. [VERIFIED] */
export const BLUE_GRID: readonly (readonly (number | null)[])[] = [
  [null, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
];

/** 체크 개수 -> 점수. index = 개수. [VERIFIED] (룰북 예시 4개=7점, 9개=37점과 일치) */
export const BLUE_SCALE = [0, 1, 2, 4, 7, 11, 16, 22, 29, 37, 46, 56] as const;

/** 파랑 행 완성 보너스 (위->아래 3행). [UNVERIFIED] */
export const BLUE_ROW_BONUS: readonly (Bonus | null)[] = [
  TODO<Bonus>({ t: 'num', area: 'orange', v: 5 }),
  TODO<Bonus>({ t: 'x', area: 'green' }),
  TODO<Bonus>({ t: 'fox' }),
];

/** 파랑 열 완성 보너스 (좌->우 4열). [UNVERIFIED] */
export const BLUE_COL_BONUS: readonly (Bonus | null)[] = [
  TODO<Bonus>({ t: 'fox' }),
  TODO<Bonus>({ t: 'x', area: 'yellow' }),
  TODO<Bonus>({ t: 'num', area: 'purple', v: 6 }),
  TODO<Bonus>({ t: 'plusOne' }),
];

/** 초록: 칸별 최소 요구 눈. [UNVERIFIED - 실물 확인 필요] */
export const GREEN_MIN: readonly number[] = TODO([1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 6]);

/** 초록: n칸 채웠을 때 점수. index = 채운 개수. [VERIFIED] */
export const GREEN_SCORE = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66] as const;

/** 초록 칸별 보너스 (그 칸을 채우는 즉시). [UNVERIFIED] */
export const GREEN_BONUS: readonly (Bonus | null)[] = TODO([
  null, { t: 'plusOne' }, null, { t: 'x', area: 'blue' }, null,
  { t: 'fox' }, null, { t: 'num', area: 'orange', v: 6 }, null, null, null,
] as (Bonus | null)[]);

/** 주황: 칸별 배수. [VERIFIED: x2/x2/x2/x3 4개 존재 — 위치는 UNVERIFIED] */
export const ORANGE_MULT: readonly number[] = TODO([1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 1]);

/** 주황 칸별 보너스. [UNVERIFIED] */
export const ORANGE_BONUS: readonly (Bonus | null)[] = TODO([
  null, null, null, { t: 'x', area: 'yellow' }, { t: 'plusOne' },
  null, { t: 'fox' }, null, { t: 'num', area: 'purple', v: 6 }, null, null,
] as (Bonus | null)[]);

/** 보라 칸별 보너스. [UNVERIFIED] */
export const PURPLE_BONUS: readonly (Bonus | null)[] = TODO([
  null, { t: 'x', area: 'blue' }, { t: 'plusOne' }, { t: 'x', area: 'green' }, null,
  { t: 'fox' }, { t: 'x', area: 'yellow' }, null, { t: 'num', area: 'orange', v: 6 },
  { t: 'plusOne' }, null,
] as (Bonus | null)[]);

export const GREEN_SLOTS = GREEN_MIN.length;
export const ORANGE_SLOTS = ORANGE_MULT.length;
export const PURPLE_SLOTS = PURPLE_BONUS.length;

/**
 * 라운드 시작 보너스. index = 라운드-1. null = 없음.
 * 2택인 라운드는 배열 2개. [라운드4 2택 VERIFIED, 1/3라운드 아이콘 UNVERIFIED]
 */
export const ROUND_BONUS: readonly (Bonus | [Bonus, Bonus] | null)[] = [
  TODO<Bonus>({ t: 'reroll' }),
  { t: 'plusOne' },
  TODO<Bonus>({ t: 'reroll' }),
  [{ t: 'xAny' }, { t: 'numAny', v: 6 }],
  null,
  null,
];

/** 인원별 라운드 수. [VERIFIED] */
export function totalRounds(playerCount: number): number {
  if (playerCount <= 2) return 6;
  if (playerCount === 3) return 5;
  return 4;
}

/** 솔로 점수 등급. [VERIFIED] */
export const SOLO_LEVELS: readonly { min: number; label: string }[] = [
  { min: 281, label: '영리한걸!' },
  { min: 260, label: '혹시 아인슈타인?' },
  { min: 240, label: '천재인데!' },
  { min: 220, label: '인상적!' },
  { min: 200, label: '모자를 벗겠습니다' },
  { min: 180, label: '훌륭한 결과' },
  { min: 160, label: '꽤 잘했어요' },
  { min: 140, label: '나쁘지 않지만 더 잘할 수 있어요' },
  { min: 0, label: '분발하세요!' },
];
