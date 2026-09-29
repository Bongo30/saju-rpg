import type { Element } from '../saju/ganji';
import type { FiveStats } from '../saju/analyze';

export type ItemType = 'consumable' | 'weapon' | 'armor' | 'accessory' | 'sub' | 'material';
export type Grade = 'common' | 'uncommon' | 'rare' | 'legendary';
export type EquipSlot = 'weapon' | 'armor' | 'accessory' | 'sub';

export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  /** items.png(8×8칸, 16px) 안의 칸 번호 */
  icon: number;
  price: number;
  grade: Grade;
  desc: string;
  element?: Element;
  levelReq?: number;
  atk?: number;
  def?: number;
  maxHp?: number;
  maxMp?: number;
  stats?: Partial<FiveStats>;
  moveSpeed?: number;
  heal?: number;
  mana?: number;
  /** 소모품 특수 효과 */
  effect?: 'return' | 'fireCharm';
  /** 새겨진 네 기둥(전설 장비 등 고정 사주) */
  fixedPillars?: string[];
}

export const GRADE_NAMES: Record<Grade, string> = { common: '일반', uncommon: '고급', rare: '희귀', legendary: '전설' };
export const GRADE_COLORS: Record<Grade, string> = {
  common: '#f4ecd8',
  uncommon: '#7ee07e',
  rare: '#6cb4ff',
  legendary: '#ffa640',
};
export const TYPE_NAMES: Record<ItemType, string> = {
  consumable: '소모품',
  weapon: '무기',
  armor: '갑옷·옷',
  accessory: '장신구',
  sub: '보조 장비',
  material: '재료',
};

/** 장비 슬롯 = 네 기둥 (design/items.md 3장) */
export const SLOT_INFO: Record<EquipSlot, { name: string; pillar: '연주' | '월주' | '일주' | '시주'; key: 'year' | 'month' | 'day' | 'hour' }> = {
  accessory: { name: '장신구', pillar: '연주', key: 'year' },
  armor: { name: '갑옷·옷', pillar: '월주', key: 'month' },
  weapon: { name: '무기', pillar: '일주', key: 'day' },
  sub: { name: '보조', pillar: '시주', key: 'hour' },
};

const list: ItemDef[] = [
  // 잡화점
  { id: 'herb', name: '약초', type: 'consumable', icon: 46, price: 12, grade: 'common', heal: 60, desc: '들판에서 캔 약초. 체력을 60 회복한다.' },
  { id: 'ginseng', name: '산삼', type: 'consumable', icon: 37, price: 45, grade: 'uncommon', heal: 200, desc: '깊은 산의 산삼. 체력을 200 회복한다.' },
  { id: 'elixir', name: '영약', type: 'consumable', icon: 3, price: 15, grade: 'common', mana: 40, desc: '맑은 샘물로 달인 약. 마력을 40 회복한다.' },
  { id: 'elixir2', name: '청심환', type: 'consumable', icon: 5, price: 50, grade: 'uncommon', mana: 120, desc: '마음을 맑게 하는 환약. 마력을 120 회복한다.' },
  { id: 'fireCharm', name: '화기 부적', type: 'consumable', icon: 28, price: 40, grade: 'uncommon', effect: 'fireCharm', element: '화', desc: '30초 동안 공격력이 20% 오른다. 붉은 주사로 쓴 부적.' },
  { id: 'returnCharm', name: '귀환 부적', type: 'consumable', icon: 29, price: 25, grade: 'common', effect: 'return', desc: '새싹마을 어귀로 곧장 돌아간다.' },

  // 무기점 (대장간)
  { id: 'oakStaff', name: '참나무 지팡이', type: 'weapon', icon: 33, price: 40, grade: 'common', element: '목', atk: 4, maxMp: 10, desc: '곧게 자란 참나무 가지. 목 기운이 깃들어 있다.' },
  { id: 'bronzeSword', name: '청동검', type: 'weapon', icon: 1, price: 60, grade: 'common', element: '금', atk: 7, desc: '마을 대장간에서 두드린 짧은 검.' },
  { id: 'fireStaff', name: '불꽃 지팡이', type: 'weapon', icon: 24, price: 150, grade: 'common', element: '화', atk: 10, maxMp: 20, levelReq: 3, desc: '끝에 불씨가 꺼지지 않는 지팡이.' },
  { id: 'waveStaff', name: '물결 지팡이', type: 'weapon', icon: 32, price: 150, grade: 'common', element: '수', atk: 10, maxMp: 20, levelReq: 3, desc: '만지면 서늘한 물기운이 도는 지팡이.' },
  { id: 'crossbow', name: '사냥 쇠뇌', type: 'weapon', icon: 48, price: 120, grade: 'common', element: '목', atk: 9, stats: { 치명: 4 }, levelReq: 2, desc: '멀리서 쏘는 사냥꾼의 쇠뇌.' },
  { id: 'trident', name: '황토 삼지창', type: 'weapon', icon: 51, price: 200, grade: 'common', element: '토', atk: 13, def: 2, levelReq: 4, desc: '황토 흙으로 담금질한 삼지창.' },
  { id: 'ironSpear', name: '무쇠 창', type: 'weapon', icon: 50, price: 190, grade: 'common', element: '금', atk: 13, levelReq: 4, desc: '길고 묵직한 무쇠 창.' },
  { id: 'hwando', name: '환도', type: 'weapon', icon: 42, price: 280, grade: 'uncommon', element: '금', atk: 16, stats: { 치명: 6 }, levelReq: 5, desc: '허리에 차는 조선의 칼. 날이 곧고 빠르다.' },

  // 포목점 (옷가게)
  { id: 'hempCloth', name: '삼베옷', type: 'armor', icon: 22, price: 30, grade: 'common', element: '토', def: 3, desc: '거칠지만 튼튼한 삼베로 지은 옷.' },
  { id: 'greenRobe', name: '청색 도포', type: 'armor', icon: 30, price: 110, grade: 'common', element: '목', def: 4, maxMp: 25, levelReq: 2, desc: '푸른 물을 들인 선비의 도포. 마력이 늘어난다.' },
  { id: 'redRobe', name: '붉은 비단 도포', type: 'armor', icon: 23, price: 160, grade: 'common', element: '화', def: 5, stats: { 공격: 5 }, levelReq: 3, desc: '붉은 비단으로 지은 화려한 도포.' },
  { id: 'leatherVest', name: '가죽 갑옷', type: 'armor', icon: 49, price: 140, grade: 'common', element: '금', def: 8, maxHp: 25, levelReq: 3, desc: '멧돼지 가죽을 겹쳐 댄 갑옷.' },
  { id: 'strawShoes', name: '짚신', type: 'sub', icon: 52, price: 20, grade: 'common', element: '토', def: 1, moveSpeed: 0.05, desc: '가볍게 삼은 짚신. 이동 속도 +5%.' },
  { id: 'leatherBoots', name: '가죽 장화', type: 'sub', icon: 52, price: 90, grade: 'common', element: '금', def: 3, moveSpeed: 0.1, levelReq: 2, desc: '질긴 가죽 장화. 이동 속도 +10%.' },
  { id: 'beadNecklace', name: '구슬 목걸이', type: 'accessory', icon: 14, price: 120, grade: 'common', element: '화', maxHp: 30, desc: '붉은 구슬을 꿴 목걸이. 체력 +30.' },
  { id: 'jadeRing', name: '옥가락지', type: 'accessory', icon: 39, price: 150, grade: 'common', element: '수', maxMp: 20, stats: { 치명: 3 }, levelReq: 2, desc: '푸른 옥으로 깎은 가락지.' },
  { id: 'amberNorigae', name: '호박 노리개', type: 'accessory', icon: 40, price: 180, grade: 'uncommon', element: '토', def: 3, stats: { 생명재생: 6 }, levelReq: 3, desc: '호박 구슬을 단 노리개. 체력 회복이 빨라진다.' },

  // 재료 (monsters.md 드랍)
  { id: 'sprout', name: '새순', type: 'material', icon: 44, price: 6, grade: 'common', element: '목', desc: '새순 도깨비가 떨어뜨린 여린 새순. 목 재료.' },
  { id: 'thornHide', name: '가시 가죽', type: 'material', icon: 43, price: 14, grade: 'common', element: '목', desc: '가시멧돼지의 질긴 가죽.' },
  { id: 'flowerScale', name: '꽃비늘', type: 'material', icon: 18, price: 12, grade: 'common', element: '목', desc: '꽃뱀의 비늘. 은은한 꽃향기가 난다.' },
  { id: 'dewPouch', name: '이슬 주머니', type: 'material', icon: 36, price: 16, grade: 'common', element: '수', desc: '이끼 두꺼비가 품은 이슬. 수 재료.' },
  { id: 'ironFeather', name: '쇠깃털', type: 'material', icon: 16, price: 18, grade: 'common', element: '금', desc: '쇠부리 딱따구리의 단단한 깃털. 금 재료.' },
  { id: 'ruby', name: '홍옥', type: 'material', icon: 57, price: 120, grade: 'rare', element: '화', desc: '몬스터가 드물게 품고 있던 붉은 보석. 비싸게 팔린다.' },

  // 드랍 전용 장비 (몬스터 일주를 물려받는다, items.md 5.2)
  { id: 'tuskDagger', name: '엄니 단검', type: 'weapon', icon: 41, price: 160, grade: 'uncommon', element: '금', atk: 11, stats: { 치명: 5 }, desc: '가시멧돼지 엄니를 갈아 만든 단검. 그 멧돼지의 일주가 새겨져 있다.' },
  { id: 'scaleCharm', name: '꽃비늘 노리개', type: 'accessory', icon: 17, price: 150, grade: 'uncommon', element: '목', maxHp: 20, maxMp: 15, desc: '꽃뱀 비늘을 엮은 노리개. 그 뱀의 일주가 새겨져 있다.' },

  // 보스 전설 드랍 (world-and-bosses.md, 신단수 사주를 그대로 새김)
  {
    id: 'sindansuBranch',
    name: '신단수 가지',
    type: 'weapon',
    icon: 33,
    price: 900,
    grade: 'legendary',
    element: '목',
    atk: 24,
    maxMp: 40,
    stats: { 생명재생: 8, 기력: 8 },
    fixedPillars: ['갑인', '병인', '갑인', '병인'],
    desc: '균형을 되찾은 신단수가 내어 준 가지. 천 년의 목 기운과 화 기운이 함께 흐른다.',
  },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((i) => [i.id, i]));

export function itemDef(id: string): ItemDef {
  const d = ITEMS[id];
  if (!d) throw new Error(`알 수 없는 아이템: ${id}`);
  return d;
}

export function isEquipment(def: ItemDef): def is ItemDef & { type: EquipSlot } {
  return def.type === 'weapon' || def.type === 'armor' || def.type === 'accessory' || def.type === 'sub';
}

export function isStackable(def: ItemDef): boolean {
  return def.type === 'consumable' || def.type === 'material';
}

export const SHOPS: Record<string, { name: string; items: string[] }> = {
  general: { name: '복순네 잡화점', items: ['herb', 'ginseng', 'elixir', 'elixir2', 'fireCharm', 'returnCharm'] },
  weapon: { name: '쇠돌 대장간 (무기점)', items: ['oakStaff', 'bronzeSword', 'crossbow', 'fireStaff', 'waveStaff', 'ironSpear', 'trident', 'hwando'] },
  cloth: { name: '비단 포목점 (옷가게)', items: ['hempCloth', 'strawShoes', 'greenRobe', 'redRobe', 'leatherVest', 'leatherBoots', 'beadNecklace', 'jadeRing', 'amberNorigae'] },
};
