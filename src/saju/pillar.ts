import { BRANCHES, STEMS, type Branch, type Stem } from './ganji';

export interface Pillar {
  index: number; // 60갑자 순번 (0 = 갑자)
  stem: Stem;
  branch: Branch;
  name: string; // 예: '갑자'
}

export function pillarFromIndex(index: number): Pillar {
  const i = ((index % 60) + 60) % 60;
  const stem = STEMS[i % 10];
  const branch = BRANCHES[i % 12];
  return { index: i, stem, branch, name: stem.hangul + branch.hangul };
}

/** 천간 인덱스와 지지 인덱스를 각각 알 때 60갑자 순번을 역산한다 (둘 다 유효한 간지 조합이라고 가정). */
export function pillarFromStemBranch(stemIndex: number, branchIndex: number): Pillar {
  const s = ((stemIndex % 10) + 10) % 10;
  const b = ((branchIndex % 12) + 12) % 12;
  for (let i = 0; i < 60; i++) {
    if (i % 10 === s && i % 12 === b) return pillarFromIndex(i);
  }
  throw new Error(`유효하지 않은 간지 조합: 천간 ${s}, 지지 ${b}`);
}

/** '갑인' 같은 두 글자 간지 문자열로 기둥을 만든다 (설계 문서 예시를 그대로 코드에 옮길 때 사용). */
export function parsePillarName(name: string): Pillar {
  const stemChar = name[0];
  const branchChar = name[1];
  const stemIndex = STEMS.findIndex((s) => s.hangul === stemChar);
  const branchIndex = BRANCHES.findIndex((b) => b.hangul === branchChar);
  if (stemIndex < 0 || branchIndex < 0) throw new Error(`알 수 없는 간지: ${name}`);
  return pillarFromStemBranch(stemIndex, branchIndex);
}

// 기준일: 1900-01-01 = 갑술일(60갑자 순번 10)
const EPOCH_UTC = Date.UTC(1900, 0, 1);
const EPOCH_INDEX = 10;
const DAY_MS = 86_400_000;

/**
 * 양력 날짜의 일주(日柱).
 * 자정 기준으로 날짜를 나눕니다. 야자시/조자시 처리와 시간대 보정은 fourPillars에서 합니다.
 */
export function dayPillar(year: number, month: number, day: number): Pillar {
  const days = Math.round((Date.UTC(year, month - 1, day) - EPOCH_UTC) / DAY_MS);
  return pillarFromIndex(EPOCH_INDEX + days);
}

export interface FourPillars {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar;
}

// 설계서 2.5 확정: 서울 기준 경도 보정 약 -32분
const LONGITUDE_FIX_MIN = 32;

// 12절 근사 날짜 (월, 일) → 월지 인덱스 (설계서 2.3, monster_prototype.py JIE와 동일한 근사값).
// 실제 서비스에서는 천문 데이터로 대체해야 하는 [게임 규칙] 근사치.
const JIE: Array<[[number, number], number]> = [
  [[1, 6], 1],
  [[2, 4], 2],
  [[3, 6], 3],
  [[4, 5], 4],
  [[5, 6], 5],
  [[6, 6], 6],
  [[7, 7], 7],
  [[8, 8], 8],
  [[9, 8], 9],
  [[10, 8], 10],
  [[11, 7], 11],
  [[12, 7], 0],
];

// 오호둔 (연간 → 인월의 천간)
const TIGER_MONTH_STEM: Record<number, number> = { 0: 2, 5: 2, 1: 4, 6: 4, 2: 6, 7: 6, 3: 8, 8: 8, 4: 0, 9: 0 };
// 오서둔 (일간 → 자시의 천간)
const RAT_HOUR_STEM: Record<number, number> = { 0: 0, 5: 0, 1: 2, 6: 2, 2: 4, 7: 4, 3: 6, 8: 6, 4: 8, 9: 8 };

/**
 * 한국 표준시 기준 시각으로부터 네 기둥(연월일시)을 계산한다.
 * 통자시(23시부터 다음날 일주)와 서울 경도 보정(-32분)을 반영한다 (설계서 2.2~2.5, 확정 사항).
 * 절기는 천문 계산 대신 근사 날짜 표를 쓴다 — 경계 근처(하루 이틀)는 실제와 다를 수 있다.
 */
export function fourPillars(date: Date): FourPillars {
  const shifted = new Date(date.getTime() - LONGITUDE_FIX_MIN * 60_000);

  // 통자시: 23시~24시 출생은 다음날 일주로 본다 (확정)
  const dayDate = new Date(shifted);
  if (shifted.getHours() === 23) {
    dayDate.setDate(dayDate.getDate() + 1);
  }
  const day = dayPillar(dayDate.getFullYear(), dayDate.getMonth() + 1, dayDate.getDate());

  // 연주: 입춘(양력 2/4 근사) 이전은 전년도로 본다
  let year = shifted.getFullYear();
  const md: [number, number] = [shifted.getMonth() + 1, shifted.getDate()];
  if (md[0] === 1 || (md[0] === 2 && md[1] < 4)) {
    year -= 1;
  }
  const yearIndex = ((year - 4) % 60 + 60) % 60;
  const yearPillar = pillarFromIndex(yearIndex);
  const yearStemIndex = yearIndex % 10;

  // 월주: 절기 근사 표로 월지를 정하고, 오호둔으로 월간을 정한다
  let monthBranch = 0;
  for (const [[m, d], b] of JIE) {
    if (md[0] > m || (md[0] === m && md[1] >= d)) monthBranch = b;
  }
  const monthStem = (TIGER_MONTH_STEM[yearStemIndex] + ((monthBranch - 2 + 12) % 12)) % 10;
  const monthPillar = pillarFromStemBranch(monthStem, monthBranch);

  // 시주: 2시간 단위 지지, 오서둔으로 시간을 정한다
  const hourBranch = Math.floor((shifted.getHours() + 1) / 2) % 12;
  const dayStemIndex = day.index % 10;
  const hourStem = (RAT_HOUR_STEM[dayStemIndex] + hourBranch) % 10;
  const hourPillar = pillarFromStemBranch(hourStem, hourBranch);

  return { year: yearPillar, month: monthPillar, day, hour: hourPillar };
}
