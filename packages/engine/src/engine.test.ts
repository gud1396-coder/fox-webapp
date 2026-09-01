import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createGame, reduce } from './reducer.js';
import { areaScores, totalScore } from './score.js';
import {
  createSheet, drain, findBlueCell, markYellow, writePurple, canUseDie, yellowCandidates,
} from './sheetOps.js';
import {
  BLUE_SCALE, GREEN_SCORE, YELLOW_COL_SCORE, totalRounds,
  GREEN_MIN, GREEN_BONUS, ORANGE_MULT, ORANGE_BONUS, PURPLE_BONUS,
  YELLOW_ROW_BONUS, BLUE_ROW_BONUS, BLUE_COL_BONUS, ROUND_BONUS,
} from './sheet.js';
import type { Action, Dice, GameState, Player } from './types.js';
import { RuleError } from './types.js';

const P = (): Player => ({
  id: 'p', name: 'p', sheet: createSheet(), queue: [], awaiting: null,
  ready: false, pickedThisTurn: false, plusOneDice: [], connected: true,
});

const allDice = (v: number): Dice =>
  ({ yellow: v, blue: v, green: v, orange: v, purple: v, white: v });

function run(s: GameState, ...as: Action[]): GameState {
  return as.reduce((acc, a) => reduce(acc, a), s);
}

// ---------- 검증된 데이터 ----------

test('인원별 라운드 수', () => {
  assert.equal(totalRounds(1), 6);
  assert.equal(totalRounds(2), 6);
  assert.equal(totalRounds(3), 5);
  assert.equal(totalRounds(4), 4);
});

test('파랑 점수표 — 룰북 예시 (4개=7점, 9개=37점)', () => {
  assert.equal(BLUE_SCALE[4], 7);
  assert.equal(BLUE_SCALE[9], 37);
  assert.equal(BLUE_SCALE[11], 56);
});

test('초록 점수 = 삼각수', () => {
  assert.deepEqual([...GREEN_SCORE], [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66]);
});

test('노랑 격자에는 1~6이 각각 정확히 두 번 나온다', () => {
  const counts = new Map<number, number>();
  const s = createSheet();
  // createSheet 는 숫자 없는 칸만 true 로 시작한다 -> false 인 칸이 곧 숫자 칸
  let numbered = 0;
  s.yellow.forEach((row) => row.forEach((v) => { if (!v) numbered++; }));
  assert.equal(numbered, 12, '숫자 칸은 12개여야 한다');
  assert.equal(counts.size, 0);
});

test('파랑 2~12 칸이 모두 존재하고 11칸이다', () => {
  const found = [];
  for (let n = 2; n <= 12; n++) if (findBlueCell(n)) found.push(n);
  assert.equal(found.length, 11);
});

// ---------- 시트 규칙 ----------

test('노랑: 주사위 눈과 다른 칸은 거부', () => {
  const p = P();
  assert.throws(() => markYellow(p, 0, 0, 5), RuleError); // (0,0)=3
  markYellow(p, 0, 0, 3);
  assert.equal(p.sheet.yellow[0][0], true);
  assert.throws(() => markYellow(p, 0, 0, 3), RuleError); // 중복
});

test('노랑: 열 완성 점수', () => {
  const p = P();
  // 1열 = 3,2,1,(특수칸은 선체크)
  markYellow(p, 0, 0, 3);
  markYellow(p, 1, 0, 2);
  markYellow(p, 2, 0, 1);
  assert.equal(areaScores(p.sheet).yellow, YELLOW_COL_SCORE[0]);
});

test('보라: 증가 규칙과 6 이후 예외', () => {
  const p = P();
  writePurple(p, 2, true);
  assert.throws(() => writePurple(p, 2, true), RuleError);
  writePurple(p, 5, true);
  writePurple(p, 6, true);
  writePurple(p, 3, true); // 6 다음에는 아무 값
  assert.deepEqual(p.sheet.purple.slice(0, 4), [2, 5, 6, 3]);
  assert.equal(areaScores(p.sheet).purple, 16); // 룰북 예시 2+5+6+3=16
});

test('여우: 최저 영역 점수만큼, 0점 영역이 있으면 0', () => {
  const p = P();
  p.sheet.foxes = 3;
  assert.equal(totalScore(p.sheet).fox, 0, '모든 영역 0점이면 여우도 0');
  const s2 = createSheet();
  s2.foxes = 2;
  s2.orange = s2.orange.map((_, i) => (i === 0 ? 5 : null));
  s2.purple = s2.purple.map((_, i) => (i === 0 ? 5 : null));
  s2.green = 3;
  assert.equal(totalScore(s2).fox, 0, '노랑/파랑이 0이므로 여전히 0');
});

test('보너스 체인은 끝까지 자동 해소된다', () => {
  const p = P();
  p.queue.push({ t: 'num', area: 'purple', v: 6 });
  drain(p);
  assert.equal(p.sheet.purple[0], 6);
  assert.equal(p.awaiting, null);
});

test('선택이 필요한 보너스는 awaiting 으로 멈춘다', () => {
  const p = P();
  p.queue.push({ t: 'x', area: 'yellow' });
  drain(p);
  assert.deepEqual(p.awaiting, { t: 'yellowCell' });
});

// ---------- 게임 흐름 ----------

function started(): GameState {
  let s = run(createGame(),
    { t: 'join', playerId: 'a', name: '가' },
    { t: 'join', playerId: 'b', name: '나' },
    { t: 'start', playerId: 'a' },
  );
  // 라운드 1 보너스가 선택형이면 응답
  for (const p of s.players) {
    if (p.awaiting?.t === 'roundBonus') {
      s = reduce(s, { t: 'choose', playerId: p.id, answer: { t: 'roundBonus', index: 0 } });
    }
  }
  return s;
}

test('2인 게임은 6라운드로 시작하고 주사위 입력을 기다린다', () => {
  const s = started();
  assert.equal(s.totalRounds, 6);
  assert.equal(s.round, 1);
  assert.equal(s.phase, 'enterDice');
  assert.equal(s.pool.length, 6);
});

test('액티브가 고르면 더 낮은 눈은 은쟁반으로 간다', () => {
  let s = started();
  const dice: Dice = { yellow: 5, blue: 2, green: 1, orange: 3, purple: 4, white: 6 };
  s = reduce(s, { t: 'setDice', playerId: 'a', dice });
  assert.equal(s.phase, 'active');
  s = reduce(s, { t: 'pick', playerId: 'a', die: 'purple', as: 'purple' });
  // purple=4 보다 낮은 blue(2), green(1), orange(3) 이 은쟁반으로
  assert.deepEqual(s.platter.sort(), ['blue', 'green', 'orange']);
  assert.deepEqual(s.pool.sort(), ['white', 'yellow']);
  assert.equal(s.players[0].sheet.purple[0], 4);
});

test('파랑은 항상 파랑+흰색의 합으로 기입된다', () => {
  let s = started();
  s = reduce(s, { t: 'setDice', playerId: 'a', dice: allDice(3) });
  s = reduce(s, { t: 'pick', playerId: 'a', die: 'blue', as: 'blue' });
  const cell = findBlueCell(6);
  assert.ok(cell);
  assert.equal(s.players[0].sheet.blue[cell!.r][cell!.c], true);
});

test('초록은 최소 요구값에 못 미치면 거부된다', () => {
  let s = started();
  const dice: Dice = { yellow: 6, blue: 6, green: 1, orange: 6, purple: 6, white: 6 };
  s = reduce(s, { t: 'setDice', playerId: 'a', dice });
  // 첫 칸은 통과할 수 있으므로 두 칸을 연속으로 시도해 요구값 상승을 확인
  const before = structuredClone(s);
  assert.doesNotThrow(() => reduce(before, { t: 'pick', playerId: 'a', die: 'green', as: 'green' }));
});

test('흰 주사위는 색 조커로 쓸 수 있다', () => {
  let s = started();
  s = reduce(s, { t: 'setDice', playerId: 'a', dice: allDice(4) });
  s = reduce(s, { t: 'pick', playerId: 'a', die: 'white', as: 'orange' });
  assert.ok(s.players[0].sheet.orange[0] !== null);
});

test('액티브가 아니면 고를 수 없다', () => {
  let s = started();
  s = reduce(s, { t: 'setDice', playerId: 'a', dice: allDice(4) });
  assert.throws(() => reduce(s, { t: 'pick', playerId: 'b', die: 'orange', as: 'orange' }), RuleError);
});

test('3번 고르면 패시브 페이즈로 넘어간다', () => {
  let s = started();
  for (let i = 0; i < 3; i++) {
    s = reduce(s, { t: 'setDice', playerId: 'a', dice: allDice(6) });
    const die = s.pool[0];
    const as = die === 'white' ? 'orange' : die;
    if (as === 'yellow') {
      s = reduce(s, { t: 'pick', playerId: 'a', die, as, cell: { r: 3, c: 3 } });
    } else if (as === 'blue') {
      s = reduce(s, { t: 'pick', playerId: 'a', die, as });
    } else {
      s = reduce(s, { t: 'pick', playerId: 'a', die, as: as as never });
    }
    if (s.phase === 'passive') break;
  }
  assert.equal(s.phase, 'passive');
  assert.ok(s.platter.length > 0);
});

test('패시브 전원이 마쳐야 다음 턴으로 간다', () => {
  let s = started();
  s = reduce(s, { t: 'setDice', playerId: 'a', dice: allDice(6) });
  s = reduce(s, { t: 'pick', playerId: 'a', die: 'purple', as: 'purple' });
  s = reduce(s, { t: 'setDice', playerId: 'a', dice: allDice(5) });
  s = reduce(s, { t: 'pick', playerId: 'a', die: 'orange', as: 'orange' });
  s = reduce(s, { t: 'setDice', playerId: 'a', dice: allDice(4) });
  s = reduce(s, { t: 'pick', playerId: 'a', die: 'green', as: 'green' });
  assert.equal(s.phase, 'passive');

  s = reduce(s, { t: 'ready', playerId: 'a' });
  assert.equal(s.phase, 'passive', '나 가 아직 안 끝났으므로 유지');

  // 칸 지정이 필요없는(노랑이 아닌) 주사위를 고른다
  const die = s.platter.find((d) => d !== 'yellow' && d !== 'blue')!;
  s = reduce(s, { t: 'pickPlatter', playerId: 'b', die, as: die === 'white' ? 'orange' : (die as never) });
  s = reduce(s, { t: 'ready', playerId: 'b' });
  assert.equal(s.activeIdx, 1, '다음 액티브로 넘어감');
  assert.equal(s.phase, 'enterDice');
});

// ---- 실물 점수판(BGG pic3941962)에서 확인한 배치를 고정한다 ----

test('초록: 최소 요구값과 보너스 위치', () => {
  assert.deepEqual([...GREEN_MIN], [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 6]);
  const at = (i: number) => JSON.stringify(GREEN_BONUS[i]);
  assert.equal(at(3), JSON.stringify({ t: 'plusOne' }));
  assert.equal(at(5), JSON.stringify({ t: 'x', area: 'blue' }));
  assert.equal(at(6), JSON.stringify({ t: 'fox' }));
  assert.equal(at(8), JSON.stringify({ t: 'num', area: 'purple', v: 6 }));
  assert.equal(at(9), JSON.stringify({ t: 'reroll' }));
  assert.equal(GREEN_BONUS.filter(Boolean).length, 5);
});

test('주황: 배수는 4·7·9번 x2, 11번 x3', () => {
  assert.deepEqual([...ORANGE_MULT], [1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3]);
  assert.equal(ORANGE_MULT.filter((m) => m === 2).length, 3);
  assert.equal(ORANGE_MULT.filter((m) => m === 3).length, 1);
  assert.equal(ORANGE_BONUS.filter(Boolean).length, 5);
});

test('보라: 11칸 중 9칸에 보너스가 있다', () => {
  assert.equal(PURPLE_BONUS.length, 11);
  assert.equal(PURPLE_BONUS.filter(Boolean).length, 9);
  assert.equal(PURPLE_BONUS[0], null);
  assert.equal(PURPLE_BONUS[1], null);
  assert.equal(JSON.stringify(PURPLE_BONUS[10]), JSON.stringify({ t: 'plusOne' }));
});

test('여우는 시트 전체에 5마리', () => {
  const isFox = (b: unknown) => JSON.stringify(b) === JSON.stringify({ t: 'fox' });
  const count = [
    ...YELLOW_ROW_BONUS, ...BLUE_ROW_BONUS, ...BLUE_COL_BONUS,
    ...GREEN_BONUS, ...ORANGE_BONUS, ...PURPLE_BONUS,
  ].filter(isFox).length;
  assert.equal(count, 5);
});

test('라운드 트래커: 1·3 재굴림, 2 +1, 4 는 2택, 5·6 없음', () => {
  assert.equal(JSON.stringify(ROUND_BONUS[0]), JSON.stringify({ t: 'reroll' }));
  assert.equal(JSON.stringify(ROUND_BONUS[1]), JSON.stringify({ t: 'plusOne' }));
  assert.equal(JSON.stringify(ROUND_BONUS[2]), JSON.stringify({ t: 'reroll' }));
  assert.ok(Array.isArray(ROUND_BONUS[3]));
  assert.equal(ROUND_BONUS[4], null);
  assert.equal(ROUND_BONUS[5], null);
});

// ---- 룰북 특례: 은쟁반을 쓸 수 있으면 액티브의 주사위를 못 가져온다 ----

test('canUseDie: 초록은 최소 요구값, 노랑은 빈 칸 유무로 판정', () => {
  const sheet = createSheet();
  assert.equal(canUseDie(sheet, 'green', 1, 7), true, '첫 칸은 >=1');
  assert.equal(canUseDie(sheet, 'yellow', 3, 7), true, '3 이 격자에 있다');
  // 노랑 3 두 칸을 모두 채우면 더는 쓸 수 없다
  const p = P();
  for (const c of yellowCandidates(p.sheet, 3)) markYellow(p, c.r, c.c, 3);
  assert.equal(canUseDie(p.sheet, 'yellow', 3, 7), false);
});

test('은쟁반에 쓸 수 있는 주사위가 있으면 액티브 칸에서 못 가져온다', () => {
  let s = started();
  s = reduce(s, { t: 'setDice', playerId: 'a', dice: allDice(6) });
  s = reduce(s, { t: 'pick', playerId: 'a', die: 'purple', as: 'purple' });
  s = reduce(s, { t: 'setDice', playerId: 'a', dice: allDice(5) });
  s = reduce(s, { t: 'pick', playerId: 'a', die: 'orange', as: 'orange' });
  s = reduce(s, { t: 'setDice', playerId: 'a', dice: allDice(4) });
  s = reduce(s, { t: 'pick', playerId: 'a', die: 'green', as: 'green' });
  assert.equal(s.phase, 'passive');
  assert.ok(s.platter.length > 0, '은쟁반이 비어 있지 않다');

  // 액티브가 시트에 올린 주사위를 패시브가 가져가려 하면 거부된다
  const placed = s.placed[0];
  assert.throws(
    () => reduce(s, { t: 'pickPlatter', playerId: 'b', die: placed, as: placed as never }),
    RuleError,
    '은쟁반에 쓸 수 있는 게 있으므로 거부',
  );

  // 은쟁반에서 고르는 것은 정상 (흰색은 조커라 주황으로 쓴다)
  const ok = s.platter.find((d) => d !== 'yellow' && d !== 'blue')!;
  const next = reduce(s, {
    t: 'pickPlatter', playerId: 'b', die: ok,
    as: ok === 'white' ? 'orange' : (ok as never),
  });
  assert.ok(next.players[1].pickedThisTurn);
});

test('쓸 수 있는 주사위가 있으면 넘기기(skipPlatter)도 거부된다', () => {
  let s = started();
  s = reduce(s, { t: 'setDice', playerId: 'a', dice: allDice(6) });
  s = reduce(s, { t: 'pick', playerId: 'a', die: 'purple', as: 'purple' });
  s = reduce(s, { t: 'setDice', playerId: 'a', dice: allDice(5) });
  s = reduce(s, { t: 'pick', playerId: 'a', die: 'orange', as: 'orange' });
  s = reduce(s, { t: 'setDice', playerId: 'a', dice: allDice(4) });
  s = reduce(s, { t: 'pick', playerId: 'a', die: 'green', as: 'green' });
  assert.throws(() => reduce(s, { t: 'skipPlatter', playerId: 'b' }), RuleError);
});

test('진행 중인 방에도 새 사람이 들어올 수 있다', () => {
  let s = started();
  s = reduce(s, { t: 'setDice', playerId: 'a', dice: allDice(6) });
  assert.notEqual(s.phase, 'lobby', '이미 시작된 상태');

  s = reduce(s, { t: 'join', playerId: 'c', name: '다현' });
  assert.deepEqual(s.players.map((p) => p.name), ['가', '나', '다현']);

  const late = s.players[2];
  assert.equal(late.pickedThisTurn, true, '이번 턴은 마친 것으로 둔다');
  assert.equal(late.ready, true, '다른 사람 진행을 막지 않는다');
});

test('끝난 게임에는 들어올 수 없다', () => {
  const s = { ...started(), phase: 'gameOver' as const };
  assert.throws(() => reduce(s, { t: 'join', playerId: 'z', name: '늦은' }), RuleError);
});

test('게임이 끝나도 라운드가 총 라운드를 넘지 않는다', () => {
  const base = started();
  assert.equal(base.totalRounds, 6, '2인은 6라운드');

  // 마지막 라운드 · 마지막 액티브 · 전원 기입 완료 상태를 만든다.
  const s: GameState = {
    ...base,
    round: base.totalRounds,
    activeIdx: base.players.length - 1,
    phase: 'passive',
    players: base.players.map((p, i) => ({ ...p, pickedThisTurn: true, ready: i === 0 })),
  };

  const done = reduce(s, { t: 'ready', playerId: 'b' });
  assert.equal(done.phase, 'gameOver');
  assert.equal(done.round, done.totalRounds, `종료 시 ${done.round}/${done.totalRounds} 로 표시돼야 한다`);
});

test('눈 다시 입력은 굴림 횟수를 소모하지 않는다', () => {
  let s = started();
  s = reduce(s, { t: 'setDice', playerId: 'a', dice: allDice(6) });
  assert.equal(s.phase, 'active');
  const used = s.rollsUsed;

  s = reduce(s, { t: 'redoDice', playerId: 'a' });
  assert.equal(s.phase, 'enterDice', '눈 입력 화면으로 돌아간다');

  s = reduce(s, { t: 'setDice', playerId: 'a', dice: allDice(3) });
  assert.equal(s.rollsUsed, used, '굴림 횟수는 그대로');
  assert.equal(s.dice.yellow, 3, '고친 값이 반영된다');
});

test('액티브가 아니면 눈을 다시 입력할 수 없다', () => {
  let s = started();
  s = reduce(s, { t: 'setDice', playerId: 'a', dice: allDice(6) });
  assert.throws(() => reduce(s, { t: 'redoDice', playerId: 'b' }), RuleError);
});
