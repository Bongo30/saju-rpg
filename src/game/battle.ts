import type { Element } from '../saju/ganji';

const GEN: Record<Element, Element> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
const CTRL: Record<Element, Element> = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };

export interface RelationResult {
  multiplier: number;
  message: string;
}

/**
 * 공격 오행 X가 대상의 주 오행 D에 어떻게 작용하는지 (설계서 6.3 R을 단순화한 버전).
 * 세력비(p)에 따른 반극·과생 같은 극단 반응은 1차 데모에서는 뺐다.
 */
export function elementRelation(attack: Element, defense: Element): RelationResult {
  if (attack === defense) return { multiplier: 1.0, message: '같은 기운 (비화)' };
  if (CTRL[attack] === defense) return { multiplier: 1.3, message: `${attack}(이)가 ${defense}(을)를 극함` };
  if (CTRL[defense] === attack) return { multiplier: 0.75, message: `${defense}(이)가 ${attack}(을)를 극함 (상극당함)` };
  if (GEN[attack] === defense) return { multiplier: 0.7, message: `${attack}(이)가 ${defense}(을)를 생함` };
  if (GEN[defense] === attack) return { multiplier: 1.1, message: `${defense}(이)가 ${attack}(을)를 생함 (설기)` };
  return { multiplier: 1.0, message: '관계 없음' };
}

export interface DamageResult {
  damage: number;
  relation: RelationResult;
  yongBonus: boolean;
}

/**
 * 공격 오행 X를 대상(주 오행 defense, 보완 오행 yong)에게 가할 때의 피해.
 * 대상의 보완 오행으로 공격하면 오히려 대상이 편해진다 (×0.85, 설계서 6.3 Y 반응).
 */
export function computeDamage(base: number, attack: Element, defense: Element, defenderYong: Element): DamageResult {
  const relation = elementRelation(attack, defense);
  let multiplier = relation.multiplier;
  const yongBonus = attack === defenderYong;
  if (yongBonus) multiplier *= 0.85;
  return { damage: Math.max(1, Math.round(base * multiplier)), relation, yongBonus };
}
