import { fourPillars, type FourPillars } from '../saju/pillar';
import { analyzeSaju, computeStats, type FiveStats, type SajuAnalysis } from '../saju/analyze';
import { jobClassFor, type JobClass } from '../saju/classes';

export interface Character {
  createdAt: Date;
  pillars: FourPillars;
  analysis: SajuAnalysis;
  stats: FiveStats;
  jobClass: JobClass;
  maxHp: number;
  hp: number;
}

/** 캐릭터 생성 시각 하나로 사주를 세운다 (설계서 3.1, 확정). */
export function createCharacter(at: Date = new Date()): Character {
  const pillars = fourPillars(at);
  const analysis = analyzeSaju(pillars);
  const stats = computeStats(analysis.scores);
  const jobClass = jobClassFor(pillars.day.stem.hangul);
  const maxHp = Math.round(80 + stats.방어 * 0.8 + stats.생명재생 * 0.4);
  return { createdAt: at, pillars, analysis, stats, jobClass, maxHp, hp: maxHp };
}
