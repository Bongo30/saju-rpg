import Phaser from 'phaser';

/** 게임 화면(World)과 UI 화면 사이의 이벤트 통로 */
export const bus = new Phaser.Events.EventEmitter();

export interface DialogueChoice {
  label: string;
  action: () => void;
}

export interface DialoguePage {
  speaker: string;
  /** 초상화: dungeon 프레임 번호, 또는 'hero' */
  portrait: number | 'hero';
  text: string;
}

export interface DialogueScript {
  pages: DialoguePage[];
  choices?: DialogueChoice[];
  onClose?: () => void;
}

export interface TargetInfo {
  name: string;
  level: number;
  dayPillar: string;
  element: string;
  yong: string;
  hp: number;
  maxHp: number;
  isBoss: boolean;
  note?: string;
  /** 보스 전용: 목 기운 게이지 (0~100) */
  gauge?: number;
  weakened?: boolean;
}

export interface BuffInfo {
  id: string;
  name: string;
  hanja: string;
  color: number;
  until: number;
  duration: number;
}

export type Command =
  | { type: 'attack' }
  | { type: 'skill'; id: string }
  | { type: 'potion'; kind: 'hp' | 'mp' }
  | { type: 'useItem'; uid: number }
  | { type: 'interact' }
  | { type: 'revive' }
  | { type: 'save' };
