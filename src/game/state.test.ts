import { GameState, INVENTORY_SLOTS } from './state';

const AT = new Date(2026, 8, 28, 14, 0);

describe('GameState', () => {
  it('새 게임은 삼베옷을 입고 약초·영약을 가진 채 시작한다', () => {
    const s = GameState.newGame('나그네', AT);
    expect(s.data.equipment.armor?.itemId).toBe('hempCloth');
    expect(s.countItem('herb')).toBe(3);
    expect(s.data.hp).toBe(s.derived().maxHp);
  });

  it('경험치가 차면 레벨이 오르고 능력치 포인트를 받는다', () => {
    const s = GameState.newGame('나그네', AT);
    const ups = s.gainExp(s.expToNext());
    expect(ups).toBe(1);
    expect(s.data.level).toBe(2);
    expect(s.data.statPoints).toBe(3);
    expect(s.allocate('공격')).toBe(true);
    expect(s.totalStats().공격).toBe(s.character.stats.공격 + 1);
  });

  it('상점에서 사고 팔 수 있다', () => {
    const s = GameState.newGame('나그네', AT);
    const gold = s.data.gold;
    expect(s.buy('herb', 2)).toBeNull();
    expect(s.data.gold).toBe(gold - 24);
    expect(s.countItem('herb')).toBe(5);
    const stack = s.data.inventory.find((i) => i.itemId === 'herb')!;
    expect(s.sell(stack.uid, 5)).toBeNull();
    expect(s.countItem('herb')).toBe(0);
    expect(s.buy('hwando')).toBe('돈이 모자란다.');
  });

  it('레벨 제한이 있는 장비는 장착할 수 없다', () => {
    const s = GameState.newGame('나그네', AT);
    s.addGold(1000);
    s.buy('hwando');
    const sword = s.data.inventory.find((i) => i.itemId === 'hwando')!;
    expect(s.equip(sword.uid)).toContain('레벨 5');
  });

  it('무기를 장착하면 공격력이 오르고, 이전 장비는 가방으로 돌아간다', () => {
    const s = GameState.newGame('나그네', AT);
    const before = s.derived().atk;
    s.buy('bronzeSword');
    s.equip(s.data.inventory.find((i) => i.itemId === 'bronzeSword')!.uid);
    expect(s.derived().atk).toBeGreaterThan(before);
    s.addGold(100);
    s.buy('oakStaff');
    s.equip(s.data.inventory.find((i) => i.itemId === 'oakStaff')!.uid);
    expect(s.data.equipment.weapon?.itemId).toBe('oakStaff');
    expect(s.countItem('bronzeSword')).toBe(1);
  });

  it('가방은 25칸이고 가득 차면 못 넣은 개수를 돌려준다', () => {
    const s = GameState.newGame('나그네', AT);
    const left = s.addItem('bronzeSword', INVENTORY_SLOTS + 5);
    expect(s.data.inventory.length).toBe(INVENTORY_SLOTS);
    expect(left).toBeGreaterThan(0);
  });

  it('처치 퀘스트는 목표를 채우면 보고할 수 있고 보상을 준다', () => {
    const s = GameState.newGame('나그네', AT);
    expect(s.offerableQuest('chief')?.id).toBe('q1');
    s.accept('q1');
    for (let i = 0; i < 3; i++) s.onKill('dokkaebi');
    expect(s.quest('q1')?.status).toBe('ready');
    const gold = s.data.gold;
    expect(s.turnIn('q1')).toBeNull();
    expect(s.data.gold).toBe(gold + 60);
    expect(s.offerableQuest('chief')?.id).toBe('q2');
  });

  it('수집 퀘스트는 가방의 재료 개수로 진행되고 보고하면 재료를 가져간다', () => {
    const s = GameState.newGame('나그네', AT);
    s.accept('s1');
    s.addItem('dewPouch', 2);
    expect(s.quest('s1')?.status).toBe('ready');
    s.turnIn('s1');
    expect(s.countItem('dewPouch')).toBe(0);
  });

  it('저장하고 불러오면 같은 상태다', () => {
    const s = GameState.newGame('나그네', AT);
    s.gainExp(10);
    const loaded = GameState.fromJSON(s.toJSON())!;
    expect(loaded.data.exp).toBe(10);
    expect(loaded.character.pillars.day.name).toBe(s.character.pillars.day.name);
  });
});
