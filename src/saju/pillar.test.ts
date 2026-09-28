import { dayPillar, pillarFromIndex } from './pillar';
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

describe('오행 상생상극', () => {
  it('목생화, 수극화', () => {
    expect(generates('목', '화')).toBe(true);
    expect(controls('수', '화')).toBe(true);
    expect(controls('화', '수')).toBe(false);
  });
});
