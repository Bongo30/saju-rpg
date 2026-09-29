import { STEMS, BRANCHES, type Element } from './ganji';
import type { FourPillars, Pillar } from './pillar';

const ELEMENTS: readonly Element[] = ['목', '화', '토', '금', '수'];

// 지장간 (여기·중기·본기, 일수 비중) — 설계서 1.3, saju_stat_prototype.py HIDDEN과 동일
const HIDDEN: Record<string, Array<[string, number]>> = {
  자: [['임', 10], ['계', 20]],
  축: [['계', 9], ['신', 3], ['기', 18]],
  인: [['무', 7], ['병', 7], ['갑', 16]],
  묘: [['갑', 10], ['을', 20]],
  진: [['을', 9], ['계', 3], ['무', 18]],
  사: [['무', 7], ['경', 7], ['병', 16]],
  오: [['병', 10], ['기', 9], ['정', 11]],
  미: [['정', 9], ['을', 3], ['기', 18]],
  신: [['무', 7], ['임', 7], ['경', 16]],
  유: [['경', 10], ['신', 20]],
  술: [['신', 9], ['정', 3], ['무', 18]],
  해: [['무', 7], ['갑', 7], ['임', 16]],
};

// 궁위 가중치 [게임 규칙] — 설계서 3.3
const W_STEM: Record<'연' | '월' | '일' | '시', number> = { 연: 0.8, 월: 1.0, 일: 1.0, 시: 0.9 };
const W_BRANCH: Record<'연' | '월' | '일' | '시', number> = { 연: 1.0, 월: 2.0, 일: 1.4, 시: 1.1 };

const GEN: Record<Element, Element> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' }; // 내가 생하는 오행
const CTRL: Record<Element, Element> = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' }; // 내가 극하는 오행

// 조후 [게임 규칙] — 오행/계절 지지의 한난·조습 기여
const TEMP: Record<Element, number> = { 목: 0.3, 화: 1.0, 토: 0.0, 금: -0.3, 수: -1.0 };
const HUMID: Record<Element, number> = { 목: 0.3, 화: -1.0, 토: 0.0, 금: -0.2, 수: 1.0 };
const BRANCH_TEMP: Record<string, number> = {
  해: -1, 자: -1.5, 축: -1, 사: 1, 오: 1.5, 미: 1, 인: -0.3, 묘: 0.2, 진: 0.3, 신: 0.2, 유: -0.2, 술: 0.3,
};
const BRANCH_HUMID: Record<string, number> = { 진: 0.8, 축: 0.8, 미: -0.8, 술: -0.8 };

type TenGodGroup = '비겁' | '식상' | '재성' | '관성' | '인성';

function tenGodGroup(dayElem: Element, e: Element): TenGodGroup {
  if (e === dayElem) return '비겁';
  if (GEN[dayElem] === e) return '식상';
  if (CTRL[dayElem] === e) return '재성';
  if (CTRL[e] === dayElem) return '관성';
  return '인성';
}

function stemElement(stemHangul: string): Element {
  const s = STEMS.find((x) => x.hangul === stemHangul);
  if (!s) throw new Error(`알 수 없는 천간: ${stemHangul}`);
  return s.element;
}

export interface SajuAnalysis {
  /** 오행별 점수 (백분율, 합계 100) */
  scores: Record<Element, number>;
  /** 일간 기준 십성 그룹 점수 */
  groups: Record<TenGodGroup, number>;
  /** 신강도 (비겁+인성) */
  strength: number;
  /** 체온(한난), 조습(습도) 게이지 */
  temp: number;
  humid: number;
  /** 보완 오행 (게임식 용신) */
  yong: Element;
  /** 주 오행 (점수가 가장 높은 오행) */
  dominant: Element;
  /** 종왕(순세)형 여부 */
  isJongwang: boolean;
}

/** 사주 여덟 글자 → 오행 점수 → 신강·조후·보완 오행 (설계서 3.3, 3.4, 7.3의 단순화 포트). */
export function analyzeSaju(pillars: FourPillars): SajuAnalysis {
  const pos: Array<['연' | '월' | '일' | '시', Pillar]> = [
    ['연', pillars.year],
    ['월', pillars.month],
    ['일', pillars.day],
    ['시', pillars.hour],
  ];

  const score: Record<Element, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };

  for (const [p, pillar] of pos) {
    score[pillar.stem.element] += 10 * W_STEM[p];
    const hidden = HIDDEN[pillar.branch.hangul];
    const total = hidden.reduce((sum, [, d]) => sum + d, 0);
    for (const [stemHangul, d] of hidden) {
      score[stemElement(stemHangul)] += (10 * W_BRANCH[p] * d) / total;
    }
  }

  const totalScore = ELEMENTS.reduce((sum, e) => sum + score[e], 0);
  const scores = Object.fromEntries(
    ELEMENTS.map((e) => [e, Math.round((1000 * score[e]) / totalScore) / 10]),
  ) as Record<Element, number>;

  const dayElem = pillars.day.stem.element;
  const groups: Record<TenGodGroup, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const e of ELEMENTS) {
    groups[tenGodGroup(dayElem, e)] += scores[e];
  }
  const strength = Math.round((groups.비겁 + groups.인성) * 10) / 10;

  let temp = ELEMENTS.reduce((sum, e) => sum + TEMP[e] * scores[e], 0) / 100;
  let humid = ELEMENTS.reduce((sum, e) => sum + HUMID[e] * scores[e], 0) / 100;
  for (const [p, pillar] of pos) {
    temp += (BRANCH_TEMP[pillar.branch.hangul] ?? 0) * 0.15;
    if (p === '월') temp += (BRANCH_TEMP[pillar.branch.hangul] ?? 0) * 0.15; // 월지 계절은 한 번 더
    humid += (BRANCH_HUMID[pillar.branch.hangul] ?? 0) * 0.15;
  }
  temp = Math.round(temp * 100) / 100;
  humid = Math.round(humid * 100) / 100;

  // 보완 오행 (게임식 용신) — 신강·신약이면 설기/억제하는 쪽, 조후 극단이면 조후 우선, 종왕형은 식상으로 흘려보냄
  const candidates = (strength >= 50
    ? ELEMENTS.filter((e) => ['식상', '재성', '관성'].includes(tenGodGroup(dayElem, e)))
    : ELEMENTS.filter((e) => ['비겁', '인성'].includes(tenGodGroup(dayElem, e))));
  let yong: Element = candidates.reduce((min, e) => (scores[e] < scores[min] ? e : min), candidates[0]);
  if (temp <= -0.6) yong = '화';
  else if (temp >= 0.6) yong = '수';

  const isJongwang = strength >= 75 && groups.관성 < 15;
  if (isJongwang) yong = GEN[dayElem]; // 종왕(순세)형: 넘치는 기운을 식상으로 흘려보냄

  const dominant = ELEMENTS.reduce((max, e) => (scores[e] > scores[max] ? e : max), ELEMENTS[0]);

  return { scores, groups, strength, temp, humid, yong, dominant, isJongwang };
}

export interface FiveStats {
  생명재생: number; // 목
  공격: number; // 화
  방어: number; // 토
  치명: number; // 금
  기력: number; // 수
}

/** 오행 점수 → 5대 기본 스탯 (설계서 3.4). */
export function computeStats(scores: Record<Element, number>): FiveStats {
  return {
    생명재생: Math.round(40 + scores.목 * 1.2),
    공격: Math.round(40 + scores.화 * 1.2),
    방어: Math.round(40 + scores.토 * 1.2),
    치명: Math.round(40 + scores.금 * 1.2),
    기력: Math.round(40 + scores.수 * 1.2),
  };
}

export { ELEMENTS };
export function elementOf(hangulChar: string): Element {
  const s = STEMS.find((x) => x.hangul === hangulChar);
  if (s) return s.element;
  const b = BRANCHES.find((x) => x.hangul === hangulChar);
  if (b) return b.element;
  throw new Error(`알 수 없는 간지 글자: ${hangulChar}`);
}
