import { dayPillar, pillarFromIndex, fourPillars, parsePillarName } from './pillar';
import { controls, generates } from './ganji';

describe('pillarFromIndex', () => {
  it('0은 갑자, 59는 계해', () => {
    expect(pillarFromIndex(0).name).toBe('갑자');
    expect(pillarFromIndex(59).name).toBe('계해');
    expect(pillarFromIndex(60).name).toBe('갑자');
  });
});

describe('dayPillar', () => {
  it('알려진 날짜의 일주와 일치', () => {
    expect(dayPillar(1900, 1, 1).name).toBe('갑술');
    expect(dayPillar(2000, 1, 1).name).toBe('무오');
    expect(dayPillar(1949, 10, 1).name).toBe('갑자');
  });

  it('기준일 이전 날짜도 계산', () => {
    expect(dayPillar(1899, 12, 31).name).toBe('계유');
  });
});

describe('parsePillarName', () => {
  it('두 글자 간지를 기둥으로 만든다', () => {
    expect(parsePillarName('갑인').name).toBe('갑인');
    expect(parsePillarName('계해').name).toBe('계해');
  });
});

describe('fourPillars', () => {
  it('설계서 3.3 예시(2026-12-04 00:30)와 일치 — 병오년 기해월 임자일 경자시', () => {
    // saju_stat_prototype.py / monster_prototype.py의 검증값과 동일한 벡터
    const p = fourPillars(new Date(2026, 11, 4, 0, 30));
    expect(p.year.name).toBe('병오');
    expect(p.month.name).toBe('기해');
    expect(p.day.name).toBe('임자');
    expect(p.hour.name).toBe('경자');
  });

  it('통자시: 23시 출생은 다음날 일주로 계산한다', () => {
    // 경도 보정(-32분) 후 22:59가 되는 23:31은 그대로 당일, 23:32는 통자시로 다음날 일주
    const before = fourPillars(new Date(2026, 8, 28, 23, 31));
    const after = fourPillars(new Date(2026, 8, 28, 23, 32));
    expect(after.day.index).toBe((before.day.index + 1) % 60);
  });
});

describe('오행 상생상극', () => {
  it('목생화, 수극화', () => {
    expect(generates('목', '화')).toBe(true);
    expect(controls('수', '화')).toBe(true);
    expect(controls('화', '수')).toBe(false);
  });
});
