// 천간(天干), 지지(地支), 오행(五行) 기본 데이터

export type Element = '목' | '화' | '토' | '금' | '수';
export type YinYang = '양' | '음';

export interface Stem {
  hangul: string;
  hanja: string;
  element: Element;
  yinYang: YinYang;
}

export interface Branch {
  hangul: string;
  hanja: string;
  element: Element;
  yinYang: YinYang;
  animal: string;
}

export const STEMS: readonly Stem[] = [
  { hangul: '갑', hanja: '甲', element: '목', yinYang: '양' },
  { hangul: '을', hanja: '乙', element: '목', yinYang: '음' },
  { hangul: '병', hanja: '丙', element: '화', yinYang: '양' },
  { hangul: '정', hanja: '丁', element: '화', yinYang: '음' },
  { hangul: '무', hanja: '戊', element: '토', yinYang: '양' },
  { hangul: '기', hanja: '己', element: '토', yinYang: '음' },
  { hangul: '경', hanja: '庚', element: '금', yinYang: '양' },
  { hangul: '신', hanja: '辛', element: '금', yinYang: '음' },
  { hangul: '임', hanja: '壬', element: '수', yinYang: '양' },
  { hangul: '계', hanja: '癸', element: '수', yinYang: '음' },
];

// 지지 음양은 체용(體用) 중 '체' 기준 (자=양, 해=음 등)
export const BRANCHES: readonly Branch[] = [
  { hangul: '자', hanja: '子', element: '수', yinYang: '양', animal: '쥐' },
  { hangul: '축', hanja: '丑', element: '토', yinYang: '음', animal: '소' },
  { hangul: '인', hanja: '寅', element: '목', yinYang: '양', animal: '호랑이' },
  { hangul: '묘', hanja: '卯', element: '목', yinYang: '음', animal: '토끼' },
  { hangul: '진', hanja: '辰', element: '토', yinYang: '양', animal: '용' },
  { hangul: '사', hanja: '巳', element: '화', yinYang: '음', animal: '뱀' },
  { hangul: '오', hanja: '午', element: '화', yinYang: '양', animal: '말' },
  { hangul: '미', hanja: '未', element: '토', yinYang: '음', animal: '양' },
  { hangul: '신', hanja: '申', element: '금', yinYang: '양', animal: '원숭이' },
  { hangul: '유', hanja: '酉', element: '금', yinYang: '음', animal: '닭' },
  { hangul: '술', hanja: '戌', element: '토', yinYang: '양', animal: '개' },
  { hangul: '해', hanja: '亥', element: '수', yinYang: '음', animal: '돼지' },
];

// 상생: 목→화→토→금→수→목
const GENERATES: Record<Element, Element> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
// 상극: 목→토→수→화→금→목
const CONTROLS: Record<Element, Element> = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };

export function generates(a: Element, b: Element): boolean {
  return GENERATES[a] === b;
}

export function controls(a: Element, b: Element): boolean {
  return CONTROLS[a] === b;
}
