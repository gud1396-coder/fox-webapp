import type { AreaColor } from './types.js';

/**
 * 테마 = 표현 계층. 규칙/점수 계산에는 전혀 관여하지 않는다.
 * 게임의 '구조'를 그대로 두고 어휘와 해설만 바꾼다 —
 * 그래야 검증된 규칙이 유지되고, 원작으로도 계속 플레이할 수 있다.
 */
export interface AreaTheme {
  name: string;
  /** 이 영역의 규칙이 왜 그렇게 생겼는지 = 과학 개념 */
  concept: string;
  /** 학생에게 보여줄 한 줄 해설 */
  blurb: string;
}

export interface Theme {
  id: string;
  title: string;
  subtitle: string;
  areas: Record<AreaColor, AreaTheme>;
  /** 여우(최저 영역 × 마리수) 대체 개념 */
  fox: { name: string; icon: string; law: string; blurb: string };
  terms: {
    platter: string;
    reroll: string;
    plusOne: string;
    round: string;
    score: string;
    dice: string;
  };
  /** 게임 종료 후 학생에게 던질 발문 */
  reflection: string[];
}

export const ORIGINAL: Theme = {
  id: 'original',
  title: '영리한 여우',
  subtitle: 'Ganz schön clever',
  areas: {
    yellow: { name: '빨강', concept: '', blurb: '같은 숫자를 지워 열을 완성하세요.' },
    blue: { name: '파랑', concept: '', blurb: '파랑 + 흰색의 합을 지웁니다.' },
    green: { name: '초록', concept: '', blurb: '왼쪽부터, 요구값 이상으로.' },
    orange: { name: '주황', concept: '', blurb: '눈을 그대로 적되 배수 칸을 노리세요.' },
    purple: { name: '보라', concept: '', blurb: '직전보다 큰 값. 6 다음은 자유.' },
  },
  fox: {
    name: '여우', icon: '🦊',
    law: '',
    blurb: '여우 1마리 = 가장 점수가 낮은 영역의 점수.',
  },
  terms: {
    platter: '은쟁반', reroll: '재굴림', plusOne: '추가 주사위',
    round: '라운드', score: '점수', dice: '주사위',
  },
  reflection: [],
};

/**
 * 통합과학 테마 — '지구시스템의 다섯 권역'.
 *
 * 이 게임의 기존 메커니즘이 실제 과학 개념과 구조적으로 맞아떨어지는 지점만 골라 붙였다.
 * 라벨만 바꾼 리스킨이 아니라, 규칙을 따라 플레이하면 개념이 몸에 남도록 하는 것이 목표.
 */
export const EARTH_SYSTEM: Theme = {
  id: 'earth-system',
  title: '지구시스템',
  subtitle: '다섯 권역과 제한 요인',
  areas: {
    yellow: {
      name: '지권',
      concept: '물질 순환 (탄소 순환)',
      blurb: '순환은 고리가 닫혀야 의미가 있다 — 열을 완성해야 점수가 된다.',
    },
    blue: {
      name: '수권',
      concept: '양의 되먹임 (얼음–알베도)',
      blurb: '1·2·4·7·11·16·22·29·37·46·56 — 늘어날수록 증가폭이 커진다.',
    },
    green: {
      name: '생물권',
      concept: '생태 천이 / 문턱값',
      blurb: '단계를 건너뛸 수 없고, 다음 단계로 갈수록 더 큰 조건이 필요하다.',
    },
    orange: {
      name: '기권',
      concept: '증폭 (온실효과)',
      blurb: '×2·×3 칸 — 작은 입력이 큰 결과로 증폭된다.',
    },
    purple: {
      name: '외권 · 에너지',
      concept: '열역학 제2법칙 (엔트로피)',
      blurb: '한 방향으로만 커진다. 6에 도달해야 비로소 되돌릴 수 있다.',
    },
  },
  fox: {
    name: '제한 요인',
    icon: '🛢️',
    law: '최소량의 법칙 (리비히의 물통)',
    blurb:
      '물통에 담기는 물의 양은 가장 짧은 널빤지가 정한다. ' +
      '제한 요인 1개 = 가장 점수가 낮은 권역의 점수. 한 권역이 0이면 전부 0이 된다.',
  },
  terms: {
    platter: '공유 관측값',
    reroll: '재관측',
    plusOne: '추가 관측',
    round: '관측 주기',
    score: '안정도',
    dice: '관측값',
  },
  reflection: [
    '한 권역에만 집중한 사람과 고르게 올린 사람 중 누가 더 높았나요? 왜 그랬을까요?',
    '내 시스템의 제한 요인은 어느 권역이었나요? 그 권역을 1점 올리면 총점은 몇 점 오르나요?',
    '보너스로 한 권역이 다른 권역을 채워준 순간을 찾아보세요. 실제 지구에서 이에 해당하는 상호작용은?',
    '수권(파랑)의 점수 곡선은 왜 뒤로 갈수록 가팔라질까요? 되먹임과 어떻게 연결되나요?',
    '외권(보라)에서 한 번 큰 값을 적으면 되돌릴 수 없습니다. 이것이 엔트로피와 어떻게 닮았나요?',
  ],
};

export const THEMES: Record<string, Theme> = {
  [ORIGINAL.id]: ORIGINAL,
  [EARTH_SYSTEM.id]: EARTH_SYSTEM,
};
