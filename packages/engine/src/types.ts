/** 주사위 색. white 는 색 조커. */
export type DieColor = 'yellow' | 'blue' | 'green' | 'orange' | 'purple' | 'white';
/** 점수 시트의 5개 색 영역. */
export type AreaColor = 'yellow' | 'blue' | 'green' | 'orange' | 'purple';

export const DIE_COLORS = ['yellow', 'blue', 'green', 'orange', 'purple', 'white'] as const;
export const AREA_COLORS = ['yellow', 'blue', 'green', 'orange', 'purple'] as const;

/** 6개 주사위의 현재 눈. 실물 주사위를 굴려 사람이 입력한다. */
export type Dice = Record<DieColor, number>;

/** 보너스. 규칙상 "저장 불가, 즉시 사용"이며 연쇄된다. reroll/plusOne 만 저장 가능한 액션. */
export type Bonus =
  | { t: 'x'; area: 'yellow' | 'blue' | 'green' }
  | { t: 'xAny' }
  | { t: 'num'; area: 'orange' | 'purple'; v: number }
  | { t: 'numAny'; v: number }
  | { t: 'fox' }
  | { t: 'reroll' }
  | { t: 'plusOne' };

/** 보너스 해소 중 플레이어 입력이 필요한 지점. */
export type Choice =
  | { t: 'yellowCell' }
  | { t: 'blueCell' }
  | { t: 'xArea' }
  | { t: 'numArea'; v: number }
  | { t: 'roundBonus'; options: [Bonus, Bonus] };

export type ChoiceAnswer =
  | { t: 'yellowCell'; r: number; c: number }
  | { t: 'blueCell'; r: number; c: number }
  | { t: 'xArea'; area: 'yellow' | 'blue' | 'green' }
  | { t: 'numArea'; area: 'orange' | 'purple' }
  | { t: 'roundBonus'; index: 0 | 1 };

/** 한 플레이어의 점수 시트. */
export interface Sheet {
  /** [행][열]. 숫자가 없는 특수칸은 선체크 상태(true)로 시작. */
  yellow: boolean[][];
  blue: boolean[][];
  /** 초록은 왼쪽부터 채우므로 채운 개수만 저장. */
  green: number;
  orange: (number | null)[];
  purple: (number | null)[];
  foxes: number;
  rerollEarned: number;
  rerollUsed: number;
  plusOneEarned: number;
  plusOneUsed: number;
}

export interface Player {
  id: string;
  name: string;
  sheet: Sheet;
  /** 미처리 보너스 (FIFO — 결정론적 순서). */
  queue: Bonus[];
  /** 입력 대기 중인 선택. */
  awaiting: Choice | null;
  /** 이번 턴 행동을 마쳤는가 (배리어용). */
  ready: boolean;
  /** 이번 턴 정규 기입을 했는가. */
  pickedThisTurn: boolean;
  /** 이번 턴 추가주사위로 사용한 주사위 (주사위별 턴당 1회). */
  plusOneDice: DieColor[];
  connected: boolean;
}

export type Phase =
  | 'lobby'
  /** 라운드 시작 보너스 해소 (전원 동시) */
  | 'roundBonus'
  /** 액티브가 실물 주사위를 굴려 눈을 입력하는 중 */
  | 'enterDice'
  /** 액티브가 주사위를 고르는 중 */
  | 'active'
  /** 패시브 동시 픽 + 전원 추가주사위 창 */
  | 'passive'
  | 'gameOver';

export interface GameState {
  players: Player[];
  round: number;
  totalRounds: number;
  activeIdx: number;
  phase: Phase;
  /** 6개 주사위의 현재 눈. */
  dice: Dice;
  /** 아직 굴릴 수 있는 주사위(시트에도 은쟁반에도 없는 것). */
  pool: DieColor[];
  /** 은쟁반. 주사위는 소비되지 않는다 — 여러 명이 같은 것을 고를 수 있다. */
  platter: DieColor[];
  /** 액티브가 자기 주사위 칸에 올린 것 (최대 3). */
  placed: DieColor[];
  /** 이번 액티브 턴에 소모한 굴림 횟수 (최대 3). */
  rollsUsed: number;
  /** 다음 눈 입력이 재굴림 액션에 의한 것인가 (굴림 횟수 미소모). */
  rerolling: boolean;
  /** 솔로 모드에서 패시브 역할용 굴림을 입력받는 중인가. */
  soloPassiveRoll: boolean;
  /** UI 로그. */
  log: string[];
}

/** 주사위를 어디에 어떻게 쓸지. 노랑만 칸 지정이 필요하다(같은 숫자가 2칸). */
export interface Placement {
  die: DieColor;
  /** 흰 주사위는 자유 선택. 그 외에는 주사위 색과 같아야 한다. */
  as: AreaColor;
  /** as==='yellow' 일 때 필수. */
  cell?: { r: number; c: number };
}

export type Action =
  | { t: 'join'; playerId: string; name: string }
  | { t: 'leave'; playerId: string }
  | { t: 'start'; playerId: string }
  /** 액티브: 굴린 눈 입력 (pool 에 있는 주사위만) */
  | { t: 'setDice'; playerId: string; dice: Partial<Dice> }
  /** 액티브: 주사위 선택 + 기입 */
  | ({ t: 'pick'; playerId: string } & Placement)
  /** 액티브: 이번 굴림에서 쓸 수 있는 주사위가 없음 */
  | { t: 'skipPick'; playerId: string }
  /** 액티브: 잘못 입력한 눈을 고쳐 넣는다 (굴림 횟수 미소모, 액션도 미소모) */
  | { t: 'redoDice'; playerId: string }
  /** 액티브: 재굴림 액션 소모 (굴림 횟수 미소모) */
  | { t: 'useReroll'; playerId: string }
  /** 패시브: 은쟁반에서 선택 + 기입 */
  | ({ t: 'pickPlatter'; playerId: string } & Placement)
  /** 패시브: 은쟁반의 어떤 주사위도 쓸 수 없음 */
  | { t: 'skipPlatter'; playerId: string }
  /** 추가주사위 액션 */
  | ({ t: 'usePlusOne'; playerId: string } & Placement)
  /** 보너스 체인 중 선택 응답 */
  | { t: 'choose'; playerId: string; answer: ChoiceAnswer }
  /** 이번 턴 종료 선언 */
  | { t: 'ready'; playerId: string };

export class RuleError extends Error {}
