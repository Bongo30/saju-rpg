import { fourPillars, parsePillarName, type FourPillars } from '../saju/pillar';
import { analyzeSaju, computeStats, type FiveStats, type SajuAnalysis } from '../saju/analyze';

export type Gimmick = 'none' | 'bounceMetal' | 'bloomOnFire' | 'healWood' | 'huntWood' | 'boss';

export interface SpeciesDef {
  id: string;
  name: string;
  /** 텍스처 키와 (스프라이트시트면) 프레임 */
  sprite: { key: string; frame?: number; scale: number };
  /** 일간 후보 (monsters.md 5.1) */
  stems: string[];
  age: [number, number];
  baseLevel: number;
  hp: number;
  atk: number;
  exp: number;
  gold: [number, number];
  speed: number;
  aggro: number;
  drops: Array<{ itemId: string; chance: number }>;
  gimmick: Gimmick;
  gimmickText?: string;
  isBoss?: boolean;
}

export const SPECIES: Record<string, SpeciesDef> = {
  dokkaebi: {
    id: 'dokkaebi',
    name: '새순 도깨비',
    sprite: { key: 'dungeon', frame: 108, scale: 2.2 },
    stems: ['갑', '을'],
    age: [1, 5],
    baseLevel: 1,
    hp: 38,
    atk: 7,
    exp: 7,
    gold: [2, 6],
    speed: 45,
    aggro: 110,
    drops: [{ itemId: 'sprout', chance: 0.6 }, { itemId: 'herb', chance: 0.15 }],
    gimmick: 'none',
  },
  boar: {
    id: 'boar',
    name: '가시멧돼지',
    sprite: { key: 'boar', scale: 1.7 },
    stems: ['갑'],
    age: [2, 10],
    baseLevel: 2,
    hp: 70,
    atk: 11,
    exp: 14,
    gold: [5, 12],
    speed: 62,
    aggro: 150,
    drops: [{ itemId: 'thornHide', chance: 0.55 }, { itemId: 'tuskDagger', chance: 0.06 }, { itemId: 'ruby', chance: 0.03 }],
    gimmick: 'bounceMetal',
    gimmickText: '목 기운이 강한 개체는 약한 금 공격을 튕겨 낸다 (신단수 예고: 목견금결)',
  },
  snake: {
    id: 'snake',
    name: '꽃뱀',
    sprite: { key: 'snake', scale: 1.6 },
    stems: ['을'],
    age: [1, 8],
    baseLevel: 2,
    hp: 55,
    atk: 12,
    exp: 12,
    gold: [4, 10],
    speed: 55,
    aggro: 130,
    drops: [{ itemId: 'flowerScale', chance: 0.5 }, { itemId: 'scaleCharm', chance: 0.06 }],
    gimmick: 'bloomOnFire',
    gimmickText: '불에 맞으면 꽃을 피워 잠시 강해진다 (목화통명)',
  },
  toad: {
    id: 'toad',
    name: '이끼 두꺼비',
    sprite: { key: 'toad', scale: 1.6 },
    stems: ['계'],
    age: [3, 12],
    baseLevel: 3,
    hp: 80,
    atk: 8,
    exp: 16,
    gold: [6, 14],
    speed: 30,
    aggro: 90,
    drops: [{ itemId: 'dewPouch', chance: 0.6 }, { itemId: 'elixir', chance: 0.2 }],
    gimmick: 'healWood',
    gimmickText: '옆의 목 몬스터에게 물기운을 주어 회복시킨다 (수생목). 먼저 잡자',
  },
  woodpecker: {
    id: 'woodpecker',
    name: '쇠부리 딱따구리',
    sprite: { key: 'woodpecker', scale: 1.5 },
    stems: ['신'],
    age: [1, 6],
    baseLevel: 3,
    hp: 60,
    atk: 14,
    exp: 15,
    gold: [5, 12],
    speed: 70,
    aggro: 140,
    drops: [{ itemId: 'ironFeather', chance: 0.55 }, { itemId: 'ruby', chance: 0.03 }],
    gimmick: 'huntWood',
    gimmickText: '목 몬스터의 천적. 가까이 있는 목 몬스터를 먼저 쫀다 (금극목)',
  },
  sindansu: {
    id: 'sindansu',
    name: '천년 신단수',
    sprite: { key: 'town', frame: 16, scale: 6 },
    stems: ['갑'],
    age: [1000, 1000],
    baseLevel: 6,
    hp: 900,
    atk: 20,
    exp: 300,
    gold: [200, 260],
    speed: 0,
    aggro: 260,
    drops: [{ itemId: 'sindansuBranch', chance: 1 }, { itemId: 'ginseng', chance: 1 }],
    gimmick: 'boss',
    gimmickText: '목 기운이 너무 강해 금 공격이 튕겨 나간다(목견금결). 화로 먼저 기운을 빼면(설기) 금이 통한다',
    isBoss: true,
  },
};

/** 신단수의 고정 사주 (world-and-bosses.md 2.2) */
export const SINDANSU_PILLARS = pillarsOf('갑인', '병인', '갑인', '병인');

export function pillarsOf(year: string, month: string, day: string, hour: string): FourPillars {
  return {
    year: parsePillarName(year),
    month: parsePillarName(month),
    day: parsePillarName(day),
    hour: parsePillarName(hour),
  };
}

export interface MonsterIndividual {
  species: SpeciesDef;
  pillars: FourPillars;
  analysis: SajuAnalysis;
  stats: FiveStats;
  age: number;
  level: number;
  maxHp: number;
  atk: number;
}

/**
 * 몬스터 탄생 시각 = 출현 시각 − 나이 (설계서 8장, monster_prototype.py).
 * 종족 일간 후보에 맞는 날이 나올 때까지 하루씩 앞뒤로 찾는다(10일 안에 반드시 돌아온다).
 */
export function spawnIndividual(species: SpeciesDef, spawnAt: Date, rand: () => number = Math.random): MonsterIndividual {
  let pillars: FourPillars;
  let age: number;
  if (species.isBoss) {
    pillars = SINDANSU_PILLARS;
    age = species.age[0];
  } else {
    age = species.age[0] + rand() * (species.age[1] - species.age[0]);
    const birth = new Date(spawnAt.getTime() - (age * 365.25 + rand() * 364) * 86_400_000 - rand() * 86_400_000);
    pillars = fourPillars(birth);
    search: for (let k = 0; k < 10; k++) {
      for (const sign of [1, -1]) {
        const p = fourPillars(new Date(birth.getTime() + sign * k * 86_400_000));
        if (species.stems.includes(p.day.stem.hangul)) {
          pillars = p;
          break search;
        }
      }
    }
  }
  const analysis = analyzeSaju(pillars);
  const stats = computeStats(analysis.scores);
  const level = species.isBoss ? species.baseLevel : species.baseLevel + Math.floor(age / 4);
  const growth = 1 + 0.22 * (level - 1);
  const maxHp = Math.round(species.hp * growth * (0.8 + stats.방어 / 250));
  const atk = species.atk * growth * (0.75 + stats.공격 / 200);
  return { species, pillars, analysis, stats, age, level, maxHp, atk };
}

export function monsterAnalysis(p: FourPillars) {
  const analysis = analyzeSaju(p);
  const stats = computeStats(analysis.scores);
  return { analysis, stats };
}
