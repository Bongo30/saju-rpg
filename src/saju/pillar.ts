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

// 기준일: 1900-01-01 = 갑술일(60갑자 순번 10)
const EPOCH_UTC = Date.UTC(1900, 0, 1);
const EPOCH_INDEX = 10;
const DAY_MS = 86_400_000;

/**
 * 양력 날짜의 일주(日柱).
 * 자정 기준으로 날짜를 나눕니다. 야자시/조자시 처리와 시간대 보정은 아직 하지 않습니다.
 */
export function dayPillar(year: number, month: number, day: number): Pillar {
  const days = Math.round((Date.UTC(year, month - 1, day) - EPOCH_UTC) / DAY_MS);
  return pillarFromIndex(EPOCH_INDEX + days);
}
