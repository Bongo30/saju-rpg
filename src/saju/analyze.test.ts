import { analyzeSaju, computeStats } from './analyze';
import { parsePillarName } from './pillar';

function pillarsOf(name: string) {
  const p = parsePillarName(name);
  return { year: p, month: p, day: p, hour: p };
}

describe('analyzeSaju', () => {
  it('오행 점수는 100%로 정규화된다', () => {
    const a = analyzeSaju(pillarsOf('갑인'));
    const total = Object.values(a.scores).reduce((s, v) => s + v, 0);
    expect(Math.round(total)).toBe(100);
  });

  it('전부 수 기운(임자)이면 종왕형으로 판정되고 보완 오행은 목(수생목)', () => {
    const a = analyzeSaju(pillarsOf('임자'));
    expect(a.dominant).toBe('수');
    expect(a.scores.수).toBeCloseTo(100, 0);
    expect(a.strength).toBeCloseTo(100, 0);
    expect(a.isJongwang).toBe(true);
    expect(a.yong).toBe('목');
  });

  it('전부 병오(화)이면 한난이 높고 신약이 아니라 신강', () => {
    const a = analyzeSaju(pillarsOf('병오'));
    expect(a.dominant).toBe('화');
    expect(a.temp).toBeGreaterThan(0.5);
    expect(a.strength).toBeGreaterThan(50);
  });
});

describe('computeStats', () => {
  it('오행 점수가 0인 스탯은 기본값 40', () => {
    const stats = computeStats({ 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 });
    expect(stats).toEqual({ 생명재생: 40, 공격: 40, 방어: 40, 치명: 40, 기력: 40 });
  });
});
