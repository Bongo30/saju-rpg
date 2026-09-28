import { parsePillarName, type FourPillars } from '../saju/pillar';
import { analyzeSaju, computeStats } from '../saju/analyze';

export interface MonsterDef {
  id: string;
  name: string;
  isBoss: boolean;
  intro: string;
  hint?: string;
  victoryText: string;
}

function pillars(year: string, month: string, day: string, hour: string): FourPillars {
  return {
    year: parsePillarName(year),
    month: parsePillarName(month),
    day: parsePillarName(day),
    hour: parsePillarName(hour),
  };
}

// 동방 청림 잔몹 — 가시멧돼지 (일간 후보 갑, monsters.md 5.1). 사주는 데모용으로 고정한 값.
export const WILD_BOAR: MonsterDef = {
  id: 'wild-boar',
  name: '가시멧돼지',
  isBoss: false,
  intro: '가시멧돼지가 돌진 자세를 취한다!',
  hint: '목 기운이 강해 약한 금 공격은 튕겨 나갈 수 있다 (반극).',
  victoryText: '가시멧돼지를 물리쳤다! 가시 가죽을 얻었다.',
};
export const WILD_BOAR_PILLARS = pillars('을묘', '무인', '갑진', '병인');

// 동방 지역 보스 — 천년 신단수 (world-and-bosses.md 2.2). 갑인 병인 갑인 병인, 목 51 / 화 35.
export const SINDANSU: MonsterDef = {
  id: 'sindansu',
  name: '천년 신단수',
  isBoss: true,
  intro: '천 년을 산 신단수가 뿌리를 곤두세운다. 목과 화의 기운이 소용돌이친다!',
  hint: '목 기운이 너무 강해 금 공격이 바로 통하지 않는다(목견금결). 먼저 화로 기운을 빼면(설기) 금 공격이 제대로 들어간다.',
  victoryText: '신단수의 뒤엉킨 기운이 풀리며 본래의 수호목으로 돌아온다. 동방에 봄바람이 다시 분다.',
};
export const SINDANSU_PILLARS = pillars('갑인', '병인', '갑인', '병인');

export function monsterAnalysis(p: FourPillars) {
  const analysis = analyzeSaju(p);
  const stats = computeStats(analysis.scores);
  return { analysis, stats };
}
