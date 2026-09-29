import type { Element } from '../saju/ganji';

export type SkillKind = 'attack' | 'buff' | 'heal';

export interface SkillDef {
  id: string;
  element: Element;
  name: string;
  hanja: string;
  kind: SkillKind;
  mp: number;
  cooldown: number;
  /** 공격력 배율 (attack) */
  power?: number;
  range?: number;
  /** 덩굴 채찍: 맞은 적 이동 속도 감소 */
  slow?: boolean;
  /** 화염구: 날아가는 투사체 */
  projectile?: boolean;
  /** 바위 방패: 방어력 증가율과 지속 시간 */
  defBonus?: number;
  duration?: number;
  /** 생명수: 최대 체력 대비 회복 비율 */
  healRatio?: number;
  desc: string;
}

export const BASIC_ATTACK = { cooldown: 450, range: 95, power: 1.0 };

export const SKILLS: SkillDef[] = [
  { id: 'wood', element: '목', name: '덩굴 채찍', hanja: '木', kind: 'attack', mp: 6, cooldown: 1200, power: 1.25, range: 120, slow: true, desc: '덩굴로 후려쳐 피해를 주고 3초 동안 느리게 만든다.' },
  { id: 'fire', element: '화', name: '화염구', hanja: '火', kind: 'attack', mp: 10, cooldown: 1800, power: 1.6, range: 170, projectile: true, desc: '불덩이를 날려 큰 피해를 준다. 나무 기운을 빼는(설기) 데 좋다.' },
  { id: 'earth', element: '토', name: '바위 방패', hanja: '土', kind: 'buff', mp: 12, cooldown: 12000, defBonus: 0.6, duration: 8000, desc: '8초 동안 방어력이 60% 오른다.' },
  { id: 'metal', element: '금', name: '금강참', hanja: '金', kind: 'attack', mp: 8, cooldown: 1500, power: 1.5, range: 100, desc: '쇠붙이 같은 기운으로 베어 강한 피해를 준다. 나무를 극한다.' },
  { id: 'water', element: '수', name: '생명수', hanja: '水', kind: 'heal', mp: 14, cooldown: 8000, healRatio: 0.3, desc: '맑은 물기운으로 최대 체력의 30%를 회복한다.' },
];

export const ELEMENT_HANJA: Record<Element, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };

/** 내 일간 오행 스킬은 본업이라 위력 +15% */
export const JOB_SKILL_BONUS = 1.15;
