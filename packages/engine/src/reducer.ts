import { ROUND_BONUS, totalRounds } from './sheet.js';
import {
  advanceGreen, answerChoice, blocked, createSheet, drain,
  findBlueCell, markBlue, markYellow, writeOrange, writePurple,
} from './sheetOps.js';
import type { Action, Bonus, DieColor, GameState, Placement, Player } from './types.js';
import { DIE_COLORS, RuleError } from './types.js';

export function createGame(): GameState {
  return {
    players: [],
    round: 0,
    totalRounds: 0,
    activeIdx: 0,
    phase: 'lobby',
    dice: { yellow: 1, blue: 1, green: 1, orange: 1, purple: 1, white: 1 },
    pool: [],
    platter: [],
    placed: [],
    rollsUsed: 0,
    rerolling: false,
    soloPassiveRoll: false,
    log: [],
  };
}

function newPlayer(id: string, name: string): Player {
  return {
    id, name,
    sheet: createSheet(),
    queue: [],
    awaiting: null,
    ready: false,
    pickedThisTurn: false,
    plusOneDice: [],
    connected: true,
  };
}

const find = (s: GameState, id: string): Player => {
  const p = s.players.find((x) => x.id === id);
  if (!p) throw new RuleError('그런 플레이어가 없습니다');
  return p;
};

const isActive = (s: GameState, id: string) => s.players[s.activeIdx]?.id === id;

function need(cond: boolean, msg: string): void {
  if (!cond) throw new RuleError(msg);
}

// ---------- 주사위 -> 시트 기입 ----------

function applyPlacement(s: GameState, p: Player, pl: Placement): void {
  need(!blocked(p), '먼저 보너스를 처리하세요');
  const val = s.dice[pl.die];
  need(pl.die === 'white' || pl.as === pl.die, '그 주사위는 ' + pl.as + ' 영역에 쓸 수 없습니다');

  switch (pl.as) {
    case 'yellow':
      need(!!pl.cell, '노랑은 어느 칸인지 지정해야 합니다');
      markYellow(p, pl.cell!.r, pl.cell!.c, val);
      break;
    case 'blue': {
      need(pl.die === 'blue' || pl.die === 'white', '파랑은 파랑/흰 주사위로만 기입합니다');
      // 규칙: 항상 파랑 + 흰색의 합. 한쪽 값만으로는 절대 기입할 수 없다.
      const sum = s.dice.blue + s.dice.white;
      const cell = findBlueCell(sum);
      need(!!cell, '파랑에 ' + sum + ' 칸이 없습니다');
      markBlue(p, cell!.r, cell!.c);
      break;
    }
    case 'green':
      advanceGreen(p, val);
      break;
    case 'orange':
      writeOrange(p, val);
      break;
    case 'purple':
      writePurple(p, val, true);
      break;
  }
  drain(p);
}

// ---------- 페이즈 전이 ----------

function resetTurnFlags(s: GameState): void {
  for (const p of s.players) {
    p.ready = false;
    p.pickedThisTurn = false;
    p.plusOneDice = [];
  }
}

function beginRound(s: GameState): void {
  resetTurnFlags(s);
  const rb = ROUND_BONUS[s.round - 1];
  for (const p of s.players) {
    if (Array.isArray(rb)) p.awaiting = { t: 'roundBonus', options: rb as [Bonus, Bonus] };
    else if (rb) p.queue.push(rb as Bonus);
    drain(p);
  }
  s.phase = 'roundBonus';
  s.log.push('라운드 ' + s.round + ' 시작');
  afterRoundBonus(s);
}

function afterRoundBonus(s: GameState): void {
  if (s.phase !== 'roundBonus') return;
  if (s.players.some(blocked)) return;
  beginActiveTurn(s);
}

function beginActiveTurn(s: GameState): void {
  resetTurnFlags(s);
  s.pool = [...DIE_COLORS];
  s.platter = [];
  s.placed = [];
  s.rollsUsed = 0;
  s.rerolling = false;
  s.soloPassiveRoll = false;
  s.phase = 'enterDice';
  s.log.push(s.players[s.activeIdx].name + ' 차례 — 주사위를 굴려 눈을 입력하세요');
}

function afterPick(s: GameState): void {
  if (s.placed.length >= 3 || s.pool.length === 0 || s.rollsUsed >= 3) endActiveTurn(s);
  else s.phase = 'enterDice';
}

function endActiveTurn(s: GameState): void {
  // 남은 주사위는 전부 은쟁반으로. 은쟁반의 주사위는 소비되지 않는다.
  s.platter.push(...s.pool);
  s.pool = [];
  s.players[s.activeIdx].pickedThisTurn = true;

  if (s.players.length === 1) {
    // 솔로: 패시브 역할일 때 6개를 다시 굴려 가장 낮은 3개를 은쟁반에 올린다.
    s.platter = [];
    s.soloPassiveRoll = true;
    s.phase = 'enterDice';
    s.log.push('패시브 역할 — 6개를 굴려 눈을 입력하세요');
    return;
  }
  s.phase = 'passive';
  s.log.push('은쟁반: ' + s.platter.map((d) => d + s.dice[d]).join(', '));
}

function afterPassive(s: GameState): void {
  if (s.phase !== 'passive') return;
  const allDone = s.players.every((p) => p.pickedThisTurn && p.ready && !blocked(p));
  if (!allDone) return;
  advanceTurn(s);
}

function advanceTurn(s: GameState): void {
  s.activeIdx++;
  if (s.activeIdx < s.players.length) {
    beginActiveTurn(s);
    return;
  }
  s.activeIdx = 0;
  s.round++;
  if (s.round > s.totalRounds) {
    s.phase = 'gameOver';
    s.log.push('게임 종료');
  } else {
    beginRound(s);
  }
}

// ---------- 리듀서 ----------

export function reduce(state: GameState, action: Action): GameState {
  const s: GameState = structuredClone(state);

  switch (action.t) {
    case 'join': {
      need(s.phase === 'lobby', '이미 시작된 게임입니다');
      if (s.players.some((p) => p.id === action.playerId)) {
        find(s, action.playerId).connected = true;
        return s;
      }
      need(s.players.length < 4, '최대 4명입니다');
      s.players.push(newPlayer(action.playerId, action.name));
      s.log.push(action.name + ' 참가');
      return s;
    }

    case 'leave': {
      const p = s.players.find((x) => x.id === action.playerId);
      if (!p) return s;
      if (s.phase === 'lobby') s.players = s.players.filter((x) => x.id !== action.playerId);
      else p.connected = false;
      return s;
    }

    case 'start': {
      need(s.phase === 'lobby', '이미 시작되었습니다');
      need(s.players.length >= 1, '최소 1명이 필요합니다');
      s.totalRounds = totalRounds(s.players.length);
      s.round = 1;
      s.activeIdx = 0;
      beginRound(s);
      return s;
    }

    case 'setDice': {
      need(s.phase === 'enterDice', '지금은 눈을 입력할 때가 아닙니다');
      need(isActive(s, action.playerId), '액티브 플레이어만 입력할 수 있습니다');
      const targets: DieColor[] = s.soloPassiveRoll ? [...DIE_COLORS] : s.pool;
      for (const d of targets) {
        const v = action.dice[d];
        need(typeof v === 'number' && v >= 1 && v <= 6 && Number.isInteger(v),
          d + ' 주사위 눈(1~6)을 입력하세요');
        s.dice[d] = v as number;
      }
      if (s.soloPassiveRoll) {
        // 낮은 순 3개를 은쟁반에. 동점은 색 순서로 결정(실물의 "가까운 것" 규칙 대체).
        s.platter = [...DIE_COLORS].sort((a, b) => s.dice[a] - s.dice[b]).slice(0, 3);
        s.soloPassiveRoll = false;
        s.phase = 'passive';
        s.log.push('은쟁반: ' + s.platter.map((d) => d + s.dice[d]).join(', '));
        return s;
      }
      if (!s.rerolling) s.rollsUsed++;
      s.rerolling = false;
      s.phase = 'active';
      return s;
    }

    case 'useReroll': {
      need(s.phase === 'active', '지금은 재굴림을 쓸 수 없습니다');
      need(isActive(s, action.playerId), '재굴림은 액티브 플레이어만 쓸 수 있습니다');
      const p = find(s, action.playerId);
      need(p.sheet.rerollEarned - p.sheet.rerollUsed > 0, '남은 재굴림 액션이 없습니다');
      p.sheet.rerollUsed++;
      s.rerolling = true; // 굴림 횟수를 소모하지 않는다
      s.phase = 'enterDice';
      s.log.push(p.name + ' 재굴림');
      return s;
    }

    case 'pick': {
      need(s.phase === 'active', '지금은 주사위를 고를 때가 아닙니다');
      need(isActive(s, action.playerId), '액티브 플레이어만 고를 수 있습니다');
      need(s.pool.includes(action.die), '고를 수 없는 주사위입니다');
      const p = find(s, action.playerId);
      const val = s.dice[action.die];
      applyPlacement(s, p, action);
      s.pool = s.pool.filter((d) => d !== action.die);
      s.placed.push(action.die);
      // 고른 것보다 낮은 눈은 전부 은쟁반으로
      const lower = s.pool.filter((d) => s.dice[d] < val);
      s.platter.push(...lower);
      s.pool = s.pool.filter((d) => s.dice[d] >= val);
      s.log.push(p.name + ' → ' + action.die + val + ' (' + action.as + ')');
      afterPick(s);
      return s;
    }

    case 'skipPick': {
      need(s.phase === 'active', '지금은 넘길 때가 아닙니다');
      need(isActive(s, action.playerId), '액티브 플레이어만 넘길 수 있습니다');
      s.log.push('쓸 수 있는 주사위 없음 — 이 굴림은 낭비됩니다');
      afterPick(s);
      return s;
    }

    case 'pickPlatter': {
      need(s.phase === 'passive', '지금은 은쟁반을 고를 때가 아닙니다');
      const p = find(s, action.playerId);
      need(!p.pickedThisTurn, '이미 이번 턴 기입을 마쳤습니다');
      // 은쟁반의 어떤 것도 쓸 수 없을 때만 액티브의 주사위 칸에서 가져올 수 있다.
      need(s.platter.includes(action.die) || s.placed.includes(action.die),
        '은쟁반에 없는 주사위입니다');
      applyPlacement(s, p, action);
      p.pickedThisTurn = true;
      s.log.push(p.name + ' → ' + action.die + s.dice[action.die] + ' (' + action.as + ')');
      afterPassive(s);
      return s;
    }

    case 'skipPlatter': {
      need(s.phase === 'passive', '지금은 넘길 때가 아닙니다');
      const p = find(s, action.playerId);
      need(!p.pickedThisTurn, '이미 기입을 마쳤습니다');
      p.pickedThisTurn = true;
      s.log.push(p.name + ' 기입 불가 — 넘어감');
      afterPassive(s);
      return s;
    }

    case 'usePlusOne': {
      need(s.phase === 'passive', '추가 주사위는 턴 마지막에만 쓸 수 있습니다');
      const p = find(s, action.playerId);
      need(p.pickedThisTurn, '정규 기입을 먼저 마치세요');
      need(p.sheet.plusOneEarned - p.sheet.plusOneUsed > 0, '남은 추가 주사위 액션이 없습니다');
      need(!p.plusOneDice.includes(action.die), '같은 주사위는 턴당 한 번만 쓸 수 있습니다');
      applyPlacement(s, p, action);
      p.sheet.plusOneUsed++;
      p.plusOneDice.push(action.die);
      s.log.push(p.name + ' +1 → ' + action.die + s.dice[action.die]);
      afterPassive(s);
      return s;
    }

    case 'choose': {
      const p = find(s, action.playerId);
      answerChoice(p, action.answer);
      afterRoundBonus(s);
      afterPassive(s);
      return s;
    }

    case 'ready': {
      need(s.phase === 'passive', '지금은 턴을 끝낼 때가 아닙니다');
      const p = find(s, action.playerId);
      need(p.pickedThisTurn, '먼저 기입을 마치세요');
      need(!blocked(p), '먼저 보너스를 처리하세요');
      p.ready = true;
      afterPassive(s);
      return s;
    }
  }
}
