import Phaser from 'phaser';
import { itemDef, GRADE_COLORS } from '../data/items';

export const FONT = '"Jua", "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
export const INK = '#3b2a1a';
export const INK_SOFT = '#6b5335';
export const PAPER = '#f4ecd8';
export const GOLD = '#ffe066';

export const ELEMENT_TEXT: Record<string, string> = {
  목: '#4caf50',
  화: '#e53935',
  토: '#c8a14a',
  금: '#9e9e9e',
  수: '#42a5f5',
};
export const ELEMENT_LIGHT: Record<string, string> = {
  목: '#8fe08f',
  화: '#ff8a80',
  토: '#f0cf7a',
  금: '#f0f0f0',
  수: '#8ccaff',
};
export const ELEMENT_NUM: Record<string, number> = {
  목: 0x4caf50,
  화: 0xe53935,
  토: 0xc8a14a,
  금: 0xcfcfcf,
  수: 0x42a5f5,
};

export interface TextOpts {
  stroke?: string;
  strokeThickness?: number;
  align?: string;
  wrap?: number;
  originX?: number;
  originY?: number;
  lineSpacing?: number;
}

export function txt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size = 14,
  color = INK,
  opts: TextOpts = {},
): Phaser.GameObjects.Text {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    resolution: 2,
    align: opts.align ?? 'left',
    lineSpacing: opts.lineSpacing ?? 2,
  };
  if (opts.stroke) {
    style.stroke = opts.stroke;
    style.strokeThickness = opts.strokeThickness ?? 3;
  }
  if (opts.wrap) style.wordWrap = { width: opts.wrap, useAdvancedWrap: true };
  return scene.add.text(x, y, str, style).setOrigin(opts.originX ?? 0, opts.originY ?? 0);
}

export type PanelKind = 'brown' | 'beige' | 'light' | 'inset' | 'insetBrown';
const PANEL: Record<PanelKind, { key: string; s: number }> = {
  brown: { key: 'panel_brown', s: 18 },
  beige: { key: 'panel_beige', s: 18 },
  light: { key: 'panel_beigeLight', s: 18 },
  inset: { key: 'panelInset_beige', s: 12 },
  insetBrown: { key: 'panelInset_brown', s: 12 },
};

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, kind: PanelKind = 'brown') {
  const p = PANEL[kind];
  return scene.add.nineslice(x, y, p.key, undefined, w, h, p.s, p.s, p.s, p.s).setOrigin(0, 0);
}

export type ButtonKind = 'brown' | 'beige' | 'grey';

export class Button extends Phaser.GameObjects.Container {
  bg: Phaser.GameObjects.NineSlice;
  label: Phaser.GameObjects.Text;
  private kind: ButtonKind;
  private enabled = true;
  private onClick: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string, onClick: () => void, kind: ButtonKind = 'brown', size = 16) {
    super(scene, x, y);
    this.kind = kind;
    this.onClick = onClick;
    this.bg = scene.add.nineslice(0, 0, `buttonLong_${kind}`, undefined, w, h, 14, 14, 12, 14);
    this.label = txt(scene, 0, -2, text, size, kind === 'brown' ? PAPER : INK, { originX: 0.5, originY: 0.5 });
    this.add([this.bg, this.label]);
    this.setSize(w, h);
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      if (!this.enabled) return;
      this.bg.setTexture(`buttonLong_${this.kind}_pressed`);
      this.label.y = 0;
    });
    const release = () => {
      this.bg.setTexture(`buttonLong_${this.kind}`);
      this.label.y = -2;
    };
    this.bg.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      release();
      if (this.enabled) this.onClick();
    });
    this.bg.on('pointerout', release);
    scene.add.existing(this);
  }

  setText(t: string) {
    this.label.setText(t);
    return this;
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    this.setAlpha(v ? 1 : 0.5);
    return this;
  }
}

export function button(scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string, onClick: () => void, kind: ButtonKind = 'brown', size = 16) {
  return new Button(scene, x, y, w, h, text, onClick, kind, size);
}

/** 둥근 닫기 버튼 */
export function closeButton(scene: Phaser.Scene, x: number, y: number, onClick: () => void) {
  const c = scene.add.container(x, y);
  const bg = scene.add.image(0, 0, 'buttonRound_brown').setInteractive({ useHandCursor: true });
  const icon = scene.add.image(0, -1, 'iconCross_beige');
  c.add([bg, icon]);
  bg.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev?.stopPropagation?.();
    onClick();
  });
  return c;
}

/** 가로 게이지 바 (Kenney 바 조각을 붙여 만든 텍스처 사용) */
export class Bar extends Phaser.GameObjects.Container {
  private fill: Phaser.GameObjects.NineSlice;
  private barW: number;
  private barH: number;
  valueText?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color: 'red' | 'blue' | 'green' | 'yellow', showText = false) {
    super(scene, x, y);
    this.barW = w;
    this.barH = h;
    const s = Math.min(9, Math.floor(h / 2));
    const back = scene.add.nineslice(0, 0, 'bar_back', undefined, w, h, s, s, 0, 0).setOrigin(0, 0);
    this.fill = scene.add.nineslice(0, 0, `bar_${color}`, undefined, w, h, s, s, 0, 0).setOrigin(0, 0);
    // 가로 3조각 모드에서는 높이가 텍스처 높이(18px)로 고정되므로 세로로 늘이거나 줄여 맞춘다
    back.setScale(1, h / back.height);
    this.fill.setScale(1, h / this.fill.height);
    this.add([back, this.fill]);
    if (showText) {
      this.valueText = txt(scene, w / 2, h / 2, '', Math.max(10, h - 5), '#ffffff', { originX: 0.5, originY: 0.5, stroke: '#2a1d12', strokeThickness: 3 });
      this.add(this.valueText);
    }
    scene.add.existing(this);
  }

  setRatio(r: number, label?: string) {
    const ratio = Phaser.Math.Clamp(r, 0, 1);
    const minW = Math.min(this.barW, this.barH);
    this.fill.setVisible(ratio > 0.001);
    this.fill.width = Math.max(minW, this.barW * ratio);
    if (label !== undefined && this.valueText) this.valueText.setText(label);
    return this;
  }
}

export function itemIcon(scene: Phaser.Scene, x: number, y: number, itemId: string, size = 32) {
  const def = itemDef(itemId);
  return scene.add.image(x, y, 'items', def.icon).setDisplaySize(size, size);
}

export function gradeColor(itemId: string): string {
  return GRADE_COLORS[itemDef(itemId).grade];
}

export function hexNum(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

/** 이벤트가 아래(게임 화면)로 새지 않게 막는다 */
export function swallow(obj: Phaser.GameObjects.GameObject) {
  obj.setInteractive();
  obj.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => ev?.stopPropagation?.());
  obj.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => ev?.stopPropagation?.());
  return obj;
}
