import { createCharacter, type Character } from './character';
import type { FiveStats } from '../saju/analyze';
import type { Element } from '../saju/ganji';
import { elementOf } from '../saju/analyze';
import { ITEMS, itemDef, isEquipment, isStackable, SLOT_INFO, type EquipSlot, type ItemDef } from '../data/items';
import { QUESTS, QUEST_BY_ID, type QuestDef } from '../data/quests';

export const INVENTORY_SLOTS = 25;
export const MAX_STACK = 99;
export const STAT_POINTS_PER_LEVEL = 3;
export const RESONANCE_BONUS = 1.2;

export interface ItemStack {
  uid: number;
  itemId: string;
  count: number;
  /** 드랍 때 새겨진 몬스터 일주 (items.md 5.2) */
  pillar?: string;
}

export type QuestStatus = 'active' | 'ready' | 'done';
export interface QuestState {
  id: string;
  status: QuestStatus;
  count: number;
}

export type StatKey = keyof FiveStats;
export const STAT_KEYS: StatKey[] = ['생명재생', '공격', '방어', '치명', '기력'];
export const STAT_ELEMENT: Record<StatKey, Element> = { 생명재생: '목', 공격: '화', 방어: '토', 치명: '금', 기력: '수' };

export interface SaveData {
  v: 1;
  name: string;
  createdAt: number;
  level: number;
  exp: number;
  gold: number;
  hp: number;
  mp: number;
  bonus: FiveStats;
  statPoints: number;
  inventory: ItemStack[];
  equipment: Partial<Record<EquipSlot, ItemStack>>;
  quests: QuestState[];
  flags: Record<string, boolean>;
  kills: Record<string, number>;
  nextUid: number;
  pos?: { x: number; y: number };
  playMs: number;
}

export interface Derived {
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
  critChance: number;
  critMult: number;
  hpRegen: number;
  mpRegen: number;
  moveSpeed: number;
}

type Listener = (...args: unknown[]) => void;

/** 게임 진행 상태 (레벨, 돈, 가방, 장비, 퀘스트). 화면(Phaser)과 분리된 순수 로직. */
export class GameState {
  data: SaveData;
  private cachedCharacter?: Character;
  private listeners = new Map<string, Listener[]>();

  constructor(data: SaveData) {
    this.data = data;
  }

  static newGame(name: string, createdAt: Date): GameState {
    const zero: FiveStats = { 생명재생: 0, 공격: 0, 방어: 0, 치명: 0, 기력: 0 };
    const s = new GameState({
      v: 1,
      name,
      createdAt: createdAt.getTime(),
      level: 1,
      exp: 0,
      gold: 100,
      hp: 0,
      mp: 0,
      bonus: zero,
      statPoints: 0,
      inventory: [],
      equipment: {},
      quests: [],
      flags: {},
      kills: {},
      nextUid: 1,
      playMs: 0,
    });
    s.addItem('herb', 3);
    s.addItem('elixir', 2);
    const starter = s.addItem('hempCloth', 1);
    if (starter === 0) {
      const cloth = s.data.inventory.find((i) => i.itemId === 'hempCloth');
      if (cloth) s.equip(cloth.uid);
    }
    const d = s.derived();
    s.data.hp = d.maxHp;
    s.data.mp = d.maxMp;
    return s;
  }

  static fromJSON(json: string): GameState | null {
    try {
      const data = JSON.parse(json) as SaveData;
      if (data.v !== 1 || typeof data.createdAt !== 'number') return null;
      return new GameState(data);
    } catch {
      return null;
    }
  }

  toJSON(): string {
    return JSON.stringify(this.data);
  }

  // ---------- 이벤트 ----------
  on(event: string, fn: Listener) {
    const arr = this.listeners.get(event) ?? [];
    arr.push(fn);
    this.listeners.set(event, arr);
  }

  off(event: string, fn: Listener) {
    const arr = this.listeners.get(event);
    if (arr) this.listeners.set(event, arr.filter((f) => f !== fn));
  }

  emit(event: string, ...args: unknown[]) {
    for (const fn of this.listeners.get(event) ?? []) fn(...args);
    if (event !== 'change') for (const fn of this.listeners.get('change') ?? []) fn(event);
  }

  log(msg: string, color = '#f4ecd8') {
    this.emit('log', msg, color);
  }

  // ---------- 캐릭터·능력치 ----------
  get character(): Character {
    if (!this.cachedCharacter) this.cachedCharacter = createCharacter(new Date(this.data.createdAt));
    return this.cachedCharacter;
  }

  /** 장비의 오행(또는 새겨진 일주의 천간 오행)이 내 보완 오행이면 공명 */
  resonates(stack: ItemStack): boolean {
    const def = itemDef(stack.itemId);
    const yong = this.character.analysis.yong;
    if (def.element === yong) return true;
    const pillar = stack.pillar ?? def.fixedPillars?.[2];
    return pillar ? elementOf(pillar[0]) === yong : false;
  }

  equipmentBonus() {
    const total = { atk: 0, def: 0, maxHp: 0, maxMp: 0, moveSpeed: 0, stats: { 생명재생: 0, 공격: 0, 방어: 0, 치명: 0, 기력: 0 } as FiveStats };
    for (const stack of Object.values(this.data.equipment)) {
      if (!stack) continue;
      const def = itemDef(stack.itemId);
      const m = this.resonates(stack) ? RESONANCE_BONUS : 1;
      total.atk += (def.atk ?? 0) * m;
      total.def += (def.def ?? 0) * m;
      total.maxHp += (def.maxHp ?? 0) * m;
      total.maxMp += (def.maxMp ?? 0) * m;
      total.moveSpeed += def.moveSpeed ?? 0;
      for (const k of STAT_KEYS) total.stats[k] += Math.round((def.stats?.[k] ?? 0) * m);
    }
    return total;
  }

  totalStats(): FiveStats {
    const base = this.character.stats;
    const eq = this.equipmentBonus().stats;
    const out = {} as FiveStats;
    for (const k of STAT_KEYS) out[k] = base[k] + this.data.bonus[k] + eq[k];
    return out;
  }

  derived(): Derived {
    const s = this.totalStats();
    const eq = this.equipmentBonus();
    const lv = this.data.level - 1;
    return {
      maxHp: Math.round(80 + s.방어 * 0.8 + s.생명재생 * 0.4 + lv * 14 + eq.maxHp),
      maxMp: Math.round(30 + s.기력 * 0.6 + lv * 6 + eq.maxMp),
      atk: Math.round(s.공격 * 0.3 + lv * 1.8 + eq.atk),
      def: Math.round(s.방어 * 0.12 + lv * 0.8 + eq.def),
      critChance: Math.min(0.4, 0.05 + s.치명 * 0.0015),
      critMult: 1.6,
      hpRegen: Math.round((1 + s.생명재생 * 0.04) * 10) / 10,
      mpRegen: Math.round((1 + s.기력 * 0.03) * 10) / 10,
      moveSpeed: Math.round(150 * (1 + eq.moveSpeed)),
    };
  }

  clampVitals() {
    const d = this.derived();
    this.data.hp = Math.max(0, Math.min(this.data.hp, d.maxHp));
    this.data.mp = Math.max(0, Math.min(this.data.mp, d.maxMp));
  }

  heal(hp: number, mp = 0) {
    const d = this.derived();
    this.data.hp = Math.min(d.maxHp, this.data.hp + hp);
    this.data.mp = Math.min(d.maxMp, this.data.mp + mp);
    this.emit('vitals');
  }

  allocate(stat: StatKey): boolean {
    if (this.data.statPoints <= 0) return false;
    this.data.statPoints -= 1;
    this.data.bonus[stat] += 1;
    this.emit('stats');
    return true;
  }

  // ---------- 성장 ----------
  expToNext(level = this.data.level): number {
    return Math.round(25 * Math.pow(level, 1.7));
  }

  gainExp(amount: number): number {
    this.data.exp += amount;
    let ups = 0;
    while (this.data.exp >= this.expToNext()) {
      this.data.exp -= this.expToNext();
      this.data.level += 1;
      this.data.statPoints += STAT_POINTS_PER_LEVEL;
      ups += 1;
    }
    if (ups > 0) {
      const d = this.derived();
      this.data.hp = d.maxHp;
      this.data.mp = d.maxMp;
      this.emit('levelup', this.data.level);
      this.log(`레벨 업! Lv${this.data.level} · 능력치 포인트 +${STAT_POINTS_PER_LEVEL * ups}`, '#ffe066');
    } else {
      this.emit('exp');
    }
    return ups;
  }

  addGold(n: number) {
    this.data.gold = Math.max(0, this.data.gold + n);
    this.emit('gold');
  }

  // ---------- 가방 ----------
  countItem(itemId: string): number {
    return this.data.inventory.filter((s) => s.itemId === itemId).reduce((n, s) => n + s.count, 0);
  }

  freeSlots(): number {
    return INVENTORY_SLOTS - this.data.inventory.length;
  }

  /** 가방에 넣고, 못 넣은 개수를 돌려준다 */
  addItem(itemId: string, count = 1, pillar?: string): number {
    const def = itemDef(itemId);
    let left = count;
    if (isStackable(def) && !pillar) {
      for (const s of this.data.inventory) {
        if (s.itemId === itemId && !s.pillar && s.count < MAX_STACK) {
          const add = Math.min(left, MAX_STACK - s.count);
          s.count += add;
          left -= add;
          if (left === 0) break;
        }
      }
      while (left > 0 && this.data.inventory.length < INVENTORY_SLOTS) {
        const add = Math.min(left, MAX_STACK);
        this.data.inventory.push({ uid: this.data.nextUid++, itemId, count: add });
        left -= add;
      }
    } else {
      while (left > 0 && this.data.inventory.length < INVENTORY_SLOTS) {
        this.data.inventory.push({ uid: this.data.nextUid++, itemId, count: 1, pillar });
        left -= 1;
      }
    }
    if (left < count) {
      this.refreshCollectQuests();
      this.emit('inventory');
    }
    return left;
  }

  findStack(uid: number): ItemStack | undefined {
    return this.data.inventory.find((s) => s.uid === uid);
  }

  removeStack(uid: number, count = 1) {
    const s = this.findStack(uid);
    if (!s) return;
    s.count -= count;
    if (s.count <= 0) this.data.inventory = this.data.inventory.filter((x) => x.uid !== uid);
    this.refreshCollectQuests();
    this.emit('inventory');
  }

  removeItemById(itemId: string, count: number) {
    let left = count;
    for (const s of [...this.data.inventory]) {
      if (left <= 0) break;
      if (s.itemId !== itemId) continue;
      const take = Math.min(left, s.count);
      this.removeStack(s.uid, take);
      left -= take;
    }
  }

  sortInventory() {
    const order = ['weapon', 'armor', 'accessory', 'sub', 'consumable', 'material'];
    this.data.inventory.sort((a, b) => {
      const da = itemDef(a.itemId);
      const db = itemDef(b.itemId);
      return order.indexOf(da.type) - order.indexOf(db.type) || db.price - da.price || a.itemId.localeCompare(b.itemId);
    });
    this.emit('inventory');
  }

  // ---------- 장비 ----------
  canEquip(def: ItemDef): string | null {
    if (!isEquipment(def)) return '장착할 수 없는 물건이다.';
    if ((def.levelReq ?? 1) > this.data.level) return `레벨 ${def.levelReq} 이상이 필요하다.`;
    return null;
  }

  equip(uid: number): string | null {
    const stack = this.findStack(uid);
    if (!stack) return '가방에 없다.';
    const def = itemDef(stack.itemId);
    const err = this.canEquip(def);
    if (err) return err;
    const slot = def.type as EquipSlot;
    const prev = this.data.equipment[slot];
    this.data.inventory = this.data.inventory.filter((s) => s.uid !== uid);
    this.data.equipment[slot] = stack;
    if (prev) this.data.inventory.push(prev);
    this.clampVitals();
    const resonance = this.resonates(stack) ? ' (용신 공명!)' : '';
    this.log(`${def.name}을(를) ${SLOT_INFO[slot].pillar} 자리에 장착했다${resonance}`, '#9fd7ff');
    this.emit('equipment');
    return null;
  }

  unequip(slot: EquipSlot): string | null {
    const stack = this.data.equipment[slot];
    if (!stack) return null;
    if (this.freeSlots() <= 0) return '가방이 가득 찼다.';
    delete this.data.equipment[slot];
    this.data.inventory.push(stack);
    this.clampVitals();
    this.emit('equipment');
    return null;
  }

  // ---------- 사용 ----------
  use(uid: number): { ok: boolean; msg: string; effect?: ItemDef['effect'] } {
    const stack = this.findStack(uid);
    if (!stack) return { ok: false, msg: '가방에 없다.' };
    const def = itemDef(stack.itemId);
    if (isEquipment(def)) {
      const err = this.equip(uid);
      return { ok: !err, msg: err ?? `${def.name} 장착` };
    }
    if (def.type !== 'consumable') return { ok: false, msg: '쓸 수 없는 물건이다.' };
    const d = this.derived();
    if (def.heal && !def.mana && this.data.hp >= d.maxHp) return { ok: false, msg: '체력이 이미 가득하다.' };
    if (def.mana && !def.heal && this.data.mp >= d.maxMp) return { ok: false, msg: '마력이 이미 가득하다.' };
    this.removeStack(uid, 1);
    if (def.heal || def.mana) this.heal(def.heal ?? 0, def.mana ?? 0);
    const parts: string[] = [];
    if (def.heal) parts.push(`체력 +${def.heal}`);
    if (def.mana) parts.push(`마력 +${def.mana}`);
    return { ok: true, msg: `${def.name} 사용${parts.length ? ` (${parts.join(', ')})` : ''}`, effect: def.effect };
  }

  usePotion(kind: 'hp' | 'mp'): { ok: boolean; msg: string } {
    const candidates = this.data.inventory
      .filter((s) => {
        const d = itemDef(s.itemId);
        return kind === 'hp' ? !!d.heal : !!d.mana;
      })
      .sort((a, b) => (itemDef(a.itemId).price - itemDef(b.itemId).price));
    if (candidates.length === 0) return { ok: false, msg: kind === 'hp' ? '체력 회복약이 없다.' : '마력 회복약이 없다.' };
    return this.use(candidates[0].uid);
  }

  // ---------- 상점 ----------
  buy(itemId: string, qty = 1): string | null {
    const def = itemDef(itemId);
    const cost = def.price * qty;
    if (this.data.gold < cost) return '돈이 모자란다.';
    const need = isStackable(def) ? 1 : qty;
    const hasStack = isStackable(def) && this.data.inventory.some((s) => s.itemId === itemId && !s.pillar && s.count + qty <= MAX_STACK);
    if (!hasStack && this.freeSlots() < need) return '가방이 가득 찼다.';
    this.data.gold -= cost;
    this.addItem(itemId, qty);
    this.log(`${def.name} ${qty}개를 ${cost}전에 샀다`, '#ffe066');
    this.emit('gold');
    return null;
  }

  sellPrice(stack: ItemStack): number {
    return Math.max(1, Math.floor(itemDef(stack.itemId).price / 2));
  }

  sell(uid: number, qty = 1): string | null {
    const stack = this.findStack(uid);
    if (!stack) return '가방에 없다.';
    const n = Math.min(qty, stack.count);
    const gain = this.sellPrice(stack) * n;
    const name = itemDef(stack.itemId).name;
    this.removeStack(uid, n);
    this.data.gold += gain;
    this.log(`${name} ${n}개를 ${gain}전에 팔았다`, '#ffe066');
    this.emit('gold');
    return null;
  }

  // ---------- 퀘스트 ----------
  quest(id: string): QuestState | undefined {
    return this.data.quests.find((q) => q.id === id);
  }

  /** 이 NPC가 지금 줄 수 있는 새 퀘스트 */
  offerableQuest(npcId: string): QuestDef | undefined {
    return QUESTS.find(
      (q) => q.giver === npcId && !this.quest(q.id) && (!q.requires || this.quest(q.requires)?.status === 'done'),
    );
  }

  /** 이 NPC에게 진행 중이거나 보고할 퀘스트 */
  activeQuestAt(npcId: string): { def: QuestDef; state: QuestState } | undefined {
    for (const state of this.data.quests) {
      const def = QUEST_BY_ID[state.id];
      if (def.giver === npcId && state.status !== 'done') return { def, state };
    }
    return undefined;
  }

  accept(id: string) {
    if (this.quest(id)) return;
    this.data.quests.push({ id, status: 'active', count: 0 });
    this.refreshCollectQuests();
    this.log(`퀘스트 수락: ${QUEST_BY_ID[id].title}`, '#ffd27f');
    this.emit('quest');
  }

  onKill(speciesId: string) {
    this.data.kills[speciesId] = (this.data.kills[speciesId] ?? 0) + 1;
    for (const q of this.data.quests) {
      const def = QUEST_BY_ID[q.id];
      if (q.status !== 'active' || def.goal.kind !== 'kill' || def.goal.species !== speciesId) continue;
      q.count = Math.min(def.goal.count, q.count + 1);
      if (q.count >= def.goal.count) {
        q.status = 'ready';
        this.log(`퀘스트 목표 달성: ${def.title} → ${npcName(def.giver)}에게 보고하자`, '#ffd27f');
      }
      this.emit('quest');
    }
  }

  refreshCollectQuests() {
    for (const q of this.data.quests) {
      const def = QUEST_BY_ID[q.id];
      if (q.status === 'done' || def.goal.kind !== 'collect') continue;
      const have = this.countItem(def.goal.itemId);
      const before = q.status;
      q.count = Math.min(def.goal.count, have);
      q.status = have >= def.goal.count ? 'ready' : 'active';
      if (before === 'active' && q.status === 'ready') {
        this.log(`퀘스트 목표 달성: ${def.title} → ${npcName(def.giver)}에게 가져가자`, '#ffd27f');
      }
    }
  }

  turnIn(id: string): string | null {
    const q = this.quest(id);
    const def = QUEST_BY_ID[id];
    if (!q || q.status !== 'ready') return '아직 목표를 이루지 못했다.';
    const itemsNeeded = def.reward.items?.filter((i) => !isStackable(itemDef(i.itemId))).length ?? 0;
    if (this.freeSlots() < itemsNeeded) return '가방이 가득 찼다.';
    if (def.goal.kind === 'collect') this.removeItemById(def.goal.itemId, def.goal.count);
    q.status = 'done';
    this.addGold(def.reward.gold);
    for (const i of def.reward.items ?? []) this.addItem(i.itemId, i.count);
    if (def.reward.flag) this.data.flags[def.reward.flag] = true;
    this.log(`퀘스트 완료: ${def.title} (돈 +${def.reward.gold}, 경험치 +${def.reward.exp})`, '#ffd27f');
    this.gainExp(def.reward.exp);
    this.emit('quest', id, 'done');
    return null;
  }

  trackedQuest(): { def: QuestDef; state: QuestState } | undefined {
    const list = this.data.quests
      .filter((q) => q.status !== 'done')
      .map((state) => ({ def: QUEST_BY_ID[state.id], state }));
    return list.find((x) => x.def.main) ?? list[0];
  }

  // ---------- 쓰러짐 ----------
  applyDeathPenalty(): number {
    const lost = Math.floor(this.data.gold * 0.1);
    this.data.gold -= lost;
    const d = this.derived();
    this.data.hp = d.maxHp;
    this.data.mp = Math.round(d.maxMp / 2);
    this.emit('gold');
    return lost;
  }
}

export const NPC_NAMES: Record<string, string> = {
  chief: '촌장',
  grocer: '복순 할멈',
  smith: '대장장이 쇠돌',
  tailor: '비단 아씨',
  guard: '수문장',
  cheongsol: '청솔',
  kid: '돌이',
};

export function npcName(id: string): string {
  return NPC_NAMES[id] ?? id;
}

export function questGoalText(def: QuestDef, state?: QuestState): string {
  const count = state?.count ?? 0;
  if (def.goal.kind === 'kill') {
    return `${speciesLabel(def.goal.species)} 처치 ${count}/${def.goal.count}`;
  }
  return `${ITEMS[def.goal.itemId].name} 모으기 ${count}/${def.goal.count}`;
}

const SPECIES_LABEL: Record<string, string> = {
  dokkaebi: '새순 도깨비',
  boar: '가시멧돼지',
  snake: '꽃뱀',
  toad: '이끼 두꺼비',
  woodpecker: '쇠부리 딱따구리',
  sindansu: '천년 신단수',
};
function speciesLabel(id: string) {
  return SPECIES_LABEL[id] ?? id;
}
