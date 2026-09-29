import { computeDamage, elementRelation } from './battle';

describe('elementRelation', () => {
  it('극하면 유리하다', () => {
    expect(elementRelation('금', '목').multiplier).toBe(1.3);
  });
  it('극당하면 불리하다', () => {
    expect(elementRelation('목', '금').multiplier).toBe(0.75);
  });
  it('생하면(내가 상대를 도움) 약해진다', () => {
    expect(elementRelation('목', '화').multiplier).toBe(0.7);
  });
  it('설기당하면(상대가 나를 도움) 더 세다', () => {
    expect(elementRelation('화', '목').multiplier).toBe(1.1);
  });
  it('같은 오행은 비화', () => {
    expect(elementRelation('화', '화').multiplier).toBe(1.0);
  });
});

describe('computeDamage', () => {
  it('보완 오행으로 공격하면 오히려 상대가 편해져 피해가 준다', () => {
    const withYong = computeDamage(100, '화', '수', '화');
    const withoutYong = computeDamage(100, '화', '수', '목');
    expect(withYong.yongBonus).toBe(true);
    expect(withYong.damage).toBeLessThan(withoutYong.damage);
  });

  it('최소 피해는 1', () => {
    const result = computeDamage(1, '목', '금', '수');
    expect(result.damage).toBeGreaterThanOrEqual(1);
  });
});
