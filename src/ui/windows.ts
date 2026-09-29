import Phaser from 'phaser';
import type { GameState, ItemStack, StatKey } from '../game/state';
import { STAT_KEYS, STAT_ELEMENT, questGoalText, npcName, INVENTORY_SLOTS } from '../game/state';
import { itemDef, isEquipment, isStackable, GRADE_COLORS, GRADE_NAMES, SHOPS, SLOT_INFO, TYPE_NAMES, type EquipSlot, type ItemDef } from '../data/items';
import { QUEST_BY_ID } from '../data/quests';
import { BASIC_ATTACK, SKILLS, ELEMENT_HANJA, JOB_SKILL_BONUS } from '../data/skills';
import { ELEMENTS } from '../saju/analyze';
import { bus } from '../game/bus';
import { MAP_H, MAP_W, NPCS, BOSS_SPOT, SPAWNS, CELL, REGIONS } from '../game/map';
import {
  Bar, button, closeButton, ELEMENT_NUM, ELEMENT_TEXT, GOLD, INK, INK_SOFT, itemIcon, panel, PAPER, swallow, txt, type Button,
} from './kit';

export const WIN_X = 10;
export const WIN_W = 460;

export interface UIHost extends Phaser.Scene {
  state: GameState;
  toast(msg: string, color?: string): void;
  closeWindow(silent?: boolean, force?: boolean): void;
  openWindow(name: string, arg?: unknown): void;
  getWorldDots(): { player: { x: number; y: number }; npcs: Array<{ x: number; y: number; quest: string }>; monsters: Array<{ x: number; y: number; boss: boolean }> } | null;
}

/** 공통 창: 어두운 배경 + 갈색 판 + 제목 + 닫기 버튼 */
export abstract class GameWindow extends Phaser.GameObjects.Container {
  protected ui: UIHost;
  protected content: Phaser.GameObjects.Container;
  protected top: number;
  protected h: number;
  private titleText: Phaser.GameObjects.Text;

  constructor(ui: UIHost, title: string, top = 56, h = 690) {
    super(ui, 0, 0);
    this.ui = ui;
    this.top = top;
    this.h = h;
    const dim = ui.add.rectangle(0, 0, ui.scale.width, ui.scale.height, 0x0b0805, 0.55).setOrigin(0);
    swallow(dim);
    dim.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.y < top || p.y > top + h) this.ui.closeWindow();
    });
    const bg = panel(ui, WIN_X, top, WIN_W, h, 'brown');
    swallow(bg);
    const titleBg = panel(ui, WIN_X + WIN_W / 2 - 110, top - 18, 220, 44, 'light');
    this.titleText = txt(ui, WIN_X + WIN_W / 2, top + 4, title, 20, INK, { originX: 0.5, originY: 0.5 });
    const close = closeButton(ui, WIN_X + WIN_W - 22, top + 18, () => this.ui.closeWindow());
    this.content = ui.add.container(0, 0);
    this.add([dim, bg, titleBg, this.titleText, this.content, close]);
    ui.add.existing(this);
    this.setDepth(1000);
  }

  setTitle(t: string) {
    this.titleText.setText(t);
  }

  get gs() {
    return this.ui.state;
  }

  /** 내용을 전부 다시 그린다 */
  refresh() {
    this.content.removeAll(true);
    this.build();
  }

  protected abstract build(): void;

  protected add2<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.content.add(o);
    return o;
  }

  protected t(x: number, y: number, s: string, size = 14, color = PAPER, opts = {}) {
    return this.add2(txt(this.ui, x, y, s, size, color, opts));
  }
}

// ------------------------------------------------------------------
// 아이템 설명 (가방·장비·상점 공용)
// ------------------------------------------------------------------
export function itemLines(state: GameState, def: ItemDef, stack?: ItemStack): string[] {
  const lines: string[] = [];
  const bits = [TYPE_NAMES[def.type], GRADE_NAMES[def.grade]];
  if (def.element) bits.push(`${def.element} 기운`);
  if (def.levelReq) bits.push(`Lv${def.levelReq} 이상`);
  lines.push(bits.join(' · '));
  const stat: string[] = [];
  if (def.atk) stat.push(`공격력 +${def.atk}`);
  if (def.def) stat.push(`방어력 +${def.def}`);
  if (def.maxHp) stat.push(`최대 체력 +${def.maxHp}`);
  if (def.maxMp) stat.push(`최대 마력 +${def.maxMp}`);
  if (def.moveSpeed) stat.push(`이동 +${Math.round(def.moveSpeed * 100)}%`);
  for (const [k, v] of Object.entries(def.stats ?? {})) stat.push(`${k} +${v}`);
  if (def.heal) stat.push(`체력 ${def.heal} 회복`);
  if (def.mana) stat.push(`마력 ${def.mana} 회복`);
  if (stat.length) lines.push(stat.join(' · '));
  const pillar = stack?.pillar ?? (def.fixedPillars ? def.fixedPillars.join(' ') : undefined);
  if (pillar) lines.push(`새겨진 사주: ${pillar}`);
  if (isEquipment(def)) {
    const slot = SLOT_INFO[def.type as EquipSlot];
    const res = stack ? state.resonates(stack) : def.element === state.character.analysis.yong;
    lines.push(`${slot.pillar} 자리 장비${res ? ' · 용신 공명! 능력치 +20%' : ''}`);
  }
  return lines;
}

function compareText(state: GameState, def: ItemDef): string {
  if (!isEquipment(def)) return '';
  const cur = state.data.equipment[def.type as EquipSlot];
  const curDef = cur ? itemDef(cur.itemId) : undefined;
  const diff = (k: 'atk' | 'def' | 'maxHp' | 'maxMp') => (def[k] ?? 0) - (curDef?.[k] ?? 0);
  const names: Record<string, string> = { atk: '공격', def: '방어', maxHp: '체력', maxMp: '마력' };
  const parts: string[] = [];
  for (const k of ['atk', 'def', 'maxHp', 'maxMp'] as const) {
    const d = diff(k);
    if (d !== 0) parts.push(`${names[k]} ${d > 0 ? '▲' : '▼'}${Math.abs(d)}`);
  }
  if (!parts.length) return curDef ? '지금 장비와 비슷하다' : '';
  return `${curDef ? `지금(${curDef.name})보다 ` : ''}${parts.join(' ')}`;
}

function slotFrame(ui: Phaser.Scene, x: number, y: number, size: number, selected: boolean, gradeColor?: string) {
  const s = panel(ui, x, y, size, size, selected ? 'insetBrown' : 'inset');
  if (gradeColor && gradeColor !== GRADE_COLORS.common) {
    const border = ui.add.rectangle(x + size / 2, y + size / 2, size - 6, size - 6).setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(gradeColor).color);
    return [s, border];
  }
  return [s];
}

// ------------------------------------------------------------------
// 가방
// ------------------------------------------------------------------
export class InventoryWindow extends GameWindow {
  private selected?: number;

  constructor(ui: UIHost) {
    super(ui, '가방');
    this.build();
  }

  protected build() {
    const st = this.gs;
    const x0 = WIN_X + 22;
    const y0 = this.top + 40;
    this.add2(itemIcon(this.ui, x0 + 10, y0 + 10, 'ruby', 0).setVisible(false));
    this.add2(this.ui.add.image(x0 + 10, y0 + 12, 'items', 45).setScale(1.5));
    this.t(x0 + 26, y0 + 2, `${st.data.gold.toLocaleString()} 전`, 17, GOLD);
    this.t(x0 + 150, y0 + 4, `${st.data.inventory.length} / ${INVENTORY_SLOTS} 칸`, 14, '#e8d8b8');
    this.add2(button(this.ui, WIN_X + WIN_W - 70, y0 + 12, 84, 34, '정렬', () => st.sortInventory(), 'beige', 14));

    const size = 72;
    const gap = 8;
    const gx = WIN_X + (WIN_W - (size * 5 + gap * 4)) / 2;
    const gy = y0 + 40;
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const cx = gx + (i % 5) * (size + gap);
      const cy = gy + Math.floor(i / 5) * (size + gap);
      const stack = st.data.inventory[i];
      const sel = !!stack && stack.uid === this.selected;
      const frames = slotFrame(this.ui, cx, cy, size, sel, stack ? GRADE_COLORS[itemDef(stack.itemId).grade] : undefined);
      frames.forEach((f) => this.add2(f));
      if (!stack) continue;
      const icon = this.add2(itemIcon(this.ui, cx + size / 2, cy + size / 2, stack.itemId, 44));
      if (stack.count > 1) this.t(cx + size - 8, cy + size - 6, `${stack.count}`, 15, '#ffffff', { originX: 1, originY: 1, stroke: '#2a1d12', strokeThickness: 4 });
      if (stack.pillar) this.t(cx + 6, cy + 4, stack.pillar, 11, '#fff3a0', { stroke: '#2a1d12', strokeThickness: 3 });
      if (isEquipment(itemDef(stack.itemId)) && st.resonates(stack)) this.t(cx + size - 6, cy + 4, '★', 13, '#ffd23f', { originX: 1, stroke: '#2a1d12', strokeThickness: 3 });
      const hit = this.add2(this.ui.add.rectangle(cx + size / 2, cy + size / 2, size, size, 0, 0).setInteractive({ useHandCursor: true }));
      hit.on('pointerup', () => {
        if (this.selected === stack.uid) this.useSelected();
        else {
          this.selected = stack.uid;
          this.refresh();
        }
      });
      void icon;
    }

    const dy = gy + 5 * (size + gap) + 4;
    const detail = panel(this.ui, WIN_X + 16, dy, WIN_W - 32, this.top + this.h - dy - 16, 'light');
    this.add2(detail);
    const stack = this.selected !== undefined ? st.findStack(this.selected) : undefined;
    if (!stack) {
      this.selected = undefined;
      this.t(WIN_X + WIN_W / 2, dy + 60, '물건을 누르면 설명이 나옵니다.\n한 번 더 누르면 사용·장착합니다.', 15, INK_SOFT, { originX: 0.5, align: 'center' });
      return;
    }
    const def = itemDef(stack.itemId);
    this.add2(itemIcon(this.ui, WIN_X + 50, dy + 40, stack.itemId, 48));
    this.t(WIN_X + 86, dy + 14, `${stack.pillar ? `${stack.pillar} ` : ''}${def.name}${stack.count > 1 ? ` ×${stack.count}` : ''}`, 19, GRADE_COLORS[def.grade] === GRADE_COLORS.common ? INK : darker(GRADE_COLORS[def.grade]), {});
    const lines = itemLines(st, def, stack);
    this.t(WIN_X + 86, dy + 42, lines.join('\n'), 13, INK, { wrap: WIN_W - 130, lineSpacing: 4 });
    this.t(WIN_X + 32, dy + 124, def.desc, 13, INK_SOFT, { wrap: WIN_W - 64 });
    this.t(WIN_X + WIN_W - 32, dy + 14, `팔면 ${st.sellPrice(stack)}전`, 12, INK_SOFT, { originX: 1 });

    const by = this.top + this.h - 48;
    const useLabel = isEquipment(def) ? '장착하기' : def.type === 'consumable' ? '사용하기' : '쓸 수 없음';
    const useBtn = this.add2(button(this.ui, WIN_X + 150, by, 190, 46, useLabel, () => this.useSelected(), 'brown', 16));
    if (!isEquipment(def) && def.type !== 'consumable') useBtn.setEnabled(false);
    this.add2(button(this.ui, WIN_X + 340, by, 150, 46, '버리기', () => {
      if (def.grade !== 'common' && !window.confirm(`${def.name}을(를) 버릴까요?`)) return;
      st.removeStack(stack.uid, stack.count);
      this.selected = undefined;
      this.ui.toast(`${def.name}을(를) 버렸다`);
    }, 'grey', 15));
  }

  private useSelected() {
    if (this.selected === undefined) return;
    const stack = this.gs.findStack(this.selected);
    if (!stack) return;
    const def = itemDef(stack.itemId);
    if (isEquipment(def)) {
      const err = this.gs.equip(stack.uid);
      this.ui.toast(err ?? `${def.name} 장착!`, err ? '#ff9a8a' : '#9fe0a0');
      if (!err) this.selected = undefined;
    } else if (def.type === 'consumable') {
      bus.emit('cmd', { type: 'useItem', uid: stack.uid });
      if (def.effect === 'return') this.ui.closeWindow();
    }
    this.refresh();
  }
}

function darker(hex: string): string {
  const c = Phaser.Display.Color.HexStringToColor(hex);
  return Phaser.Display.Color.RGBToString(Math.round(c.red * 0.55), Math.round(c.green * 0.55), Math.round(c.blue * 0.55));
}

// ------------------------------------------------------------------
// 장비 (사주 네 기둥 자리)
// ------------------------------------------------------------------
export class EquipWindow extends GameWindow {
  private selected?: EquipSlot;

  constructor(ui: UIHost) {
    super(ui, '장비 · 네 기둥');
    this.build();
  }

  protected build() {
    const st = this.gs;
    const ch = st.character;
    const cx = WIN_X + WIN_W / 2;
    const y0 = this.top + 44;
    this.t(cx, y0, `${st.data.name} · Lv${st.data.level} ${ch.jobClass.name}`, 18, PAPER, { originX: 0.5 });
    this.t(cx, y0 + 26, `보완 오행 ${ch.analysis.yong} 기운의 장비는 공명(★)해서 능력치 +20%`, 13, '#ffe6a8', { originX: 0.5 });

    const stage = panel(this.ui, WIN_X + 20, y0 + 52, WIN_W - 40, 300, 'light');
    this.add2(stage);
    this.add2(this.ui.add.image(cx, y0 + 250, 'shadow').setScale(2.4, 2));
    const hero = this.add2(this.ui.add.sprite(cx, y0 + 250, 'hero', 0).setScale(4.2).setOrigin(0.5, 0.9));
    hero.play('hero-walk-down');
    hero.anims.pause();
    hero.setFrame(0);
    this.add2(this.ui.add.circle(cx, y0 + 248, 70).setStrokeStyle(3, ELEMENT_NUM[ch.jobClass.element], 0.6));

    const slots: Array<[EquipSlot, number, number]> = [
      ['accessory', WIN_X + 40, y0 + 70],
      ['armor', WIN_X + 40, y0 + 210],
      ['weapon', WIN_X + WIN_W - 132, y0 + 70],
      ['sub', WIN_X + WIN_W - 132, y0 + 210],
    ];
    for (const [slot, x, y] of slots) {
      const info = SLOT_INFO[slot];
      const pillar = ch.pillars[info.key];
      const stack = st.data.equipment[slot];
      const size = 92;
      slotFrame(this.ui, x, y + 20, size, this.selected === slot, stack ? GRADE_COLORS[itemDef(stack.itemId).grade] : undefined).forEach((f) => this.add2(f));
      this.t(x + size / 2, y, `${info.name} · ${info.pillar} ${pillar.stem.hanja}${pillar.branch.hanja}`, 13, INK, { originX: 0.5 });
      if (stack) {
        this.add2(itemIcon(this.ui, x + size / 2, y + 20 + size / 2, stack.itemId, 56));
        if (st.resonates(stack)) this.t(x + size - 8, y + 26, '★', 18, '#ffb000', { originX: 1, stroke: '#3b2a1a', strokeThickness: 3 });
      } else {
        this.t(x + size / 2, y + 20 + size / 2, '비어 있음', 12, INK_SOFT, { originX: 0.5, originY: 0.5 });
      }
      const hit = this.add2(this.ui.add.rectangle(x + size / 2, y + 20 + size / 2, size, size, 0, 0).setInteractive({ useHandCursor: true }));
      hit.on('pointerup', () => {
        this.selected = this.selected === slot ? undefined : slot;
        this.refresh();
      });
    }

    const d = st.derived();
    const iy = y0 + 368;
    const info = panel(this.ui, WIN_X + 20, iy, WIN_W - 40, this.top + this.h - iy - 20, 'inset');
    this.add2(info);
    const sel = this.selected ? st.data.equipment[this.selected] : undefined;
    if (sel) {
      const def = itemDef(sel.itemId);
      this.add2(itemIcon(this.ui, WIN_X + 60, iy + 44, sel.itemId, 48));
      this.t(WIN_X + 96, iy + 16, `${sel.pillar ? `${sel.pillar} ` : ''}${def.name}`, 18, INK);
      this.t(WIN_X + 96, iy + 42, itemLines(st, def, sel).join('\n'), 13, INK, { wrap: WIN_W - 140, lineSpacing: 4 });
      this.t(WIN_X + 40, iy + 130, def.desc, 13, INK_SOFT, { wrap: WIN_W - 80 });
      const slot = this.selected!;
      this.add2(button(this.ui, WIN_X + WIN_W / 2, this.top + this.h - 56, 180, 44, '장비 해제', () => {
        const err = st.unequip(slot);
        this.ui.toast(err ?? '장비를 가방에 넣었다', err ? '#ff9a8a' : '#9fe0a0');
        this.selected = undefined;
        this.refresh();
      }, 'brown', 16));
    } else {
      const rows = [
        [`공격력 ${d.atk}`, `방어력 ${d.def}`],
        [`최대 체력 ${d.maxHp}`, `최대 마력 ${d.maxMp}`],
        [`치명 확률 ${Math.round(d.critChance * 100)}%`, `이동 속도 ${d.moveSpeed}`],
        [`체력 회복 ${d.hpRegen}/초`, `마력 회복 ${d.mpRegen}/초`],
      ];
      rows.forEach(([a, b], i) => {
        this.t(WIN_X + 50, iy + 20 + i * 30, a, 16, INK);
        this.t(WIN_X + 250, iy + 20 + i * 30, b, 16, INK);
      });
      this.t(cx, iy + 150, '칸을 누르면 장비 설명과 해제 버튼이 나옵니다.\n장비는 가방(I)에서 물건을 두 번 눌러 입습니다.', 13, INK_SOFT, { originX: 0.5, align: 'center' });
    }
  }
}

// ------------------------------------------------------------------
// 능력치
// ------------------------------------------------------------------
export class StatsWindow extends GameWindow {
  constructor(ui: UIHost) {
    super(ui, '능력치');
    this.build();
  }

  protected build() {
    const st = this.gs;
    const ch = st.character;
    const a = ch.analysis;
    const x0 = WIN_X + 24;
    let y = this.top + 40;

    // 사주 네 기둥
    const pillars = [ch.pillars.hour, ch.pillars.day, ch.pillars.month, ch.pillars.year];
    const labels = ['시', '일', '월', '연'];
    pillars.forEach((p, i) => {
      const px = x0 + 8 + i * 58;
      this.add2(panel(this.ui, px, y, 52, 74, i === 1 ? 'insetBrown' : 'inset'));
      this.t(px + 26, y + 6, labels[i], 11, i === 1 ? '#fff3d6' : INK_SOFT, { originX: 0.5 });
      this.t(px + 26, y + 32, p.stem.hanja, 22, ELEMENT_TEXT[p.stem.element], { originX: 0.5, originY: 0.5, stroke: '#fffaf0', strokeThickness: 3 });
      this.t(px + 26, y + 56, p.branch.hanja, 22, ELEMENT_TEXT[p.branch.element], { originX: 0.5, originY: 0.5, stroke: '#fffaf0', strokeThickness: 3 });
    });
    this.t(x0 + 250, y, `${st.data.name}`, 18, PAPER);
    this.t(x0 + 250, y + 24, `Lv${st.data.level} ${ch.jobClass.name}`, 15, '#ffe6a8');
    this.t(x0 + 250, y + 46, `${ch.jobClass.description}`, 13, '#e8d8b8');
    const expBar = this.add2(new Bar(this.ui, x0 + 250, y + 66, 160, 12, 'yellow'));
    expBar.setRatio(st.data.exp / st.expToNext());
    this.t(x0 + 330, y + 80, `경험치 ${st.data.exp}/${st.expToNext()}`, 11, '#e8d8b8', { originX: 0.5 });
    y += 102;

    // 스탯 표
    const tbl = panel(this.ui, WIN_X + 16, y, WIN_W - 32, 232, 'light');
    this.add2(tbl);
    const pts = st.data.statPoints;
    this.t(x0 + 4, y + 12, pts > 0 ? `남은 포인트 ${pts}  (+를 눌러 올리세요)` : '레벨이 오르면 포인트 3개를 받습니다', 14, pts > 0 ? '#b0400a' : INK_SOFT);
    const cols = [x0 + 4, x0 + 150, x0 + 206, x0 + 262, x0 + 318];
    ['능력치', '사주', '투자', '장비', '합계'].forEach((h, i) => this.t(cols[i], y + 40, h, 12, INK_SOFT, { originX: i === 0 ? 0 : 0.5 }));
    const eq = st.equipmentBonus().stats;
    const total = st.totalStats();
    const desc: Record<StatKey, string> = { 생명재생: '생명 (체력·회복)', 공격: '공격 (공격력)', 방어: '방어 (방어·체력)', 치명: '치명 (치명 확률)', 기력: '기력 (마력·회복)' };
    STAT_KEYS.forEach((k, i) => {
      const ry = y + 62 + i * 32;
      const el = STAT_ELEMENT[k];
      this.add2(this.ui.add.circle(cols[0] + 9, ry + 9, 9, ELEMENT_NUM[el]));
      this.t(cols[0] + 9, ry + 9, ELEMENT_HANJA[el], 11, '#ffffff', { originX: 0.5, originY: 0.5 });
      this.t(cols[0] + 24, ry, desc[k], 14, INK);
      this.t(cols[1], ry, `${ch.stats[k]}`, 15, INK, { originX: 0.5 });
      this.t(cols[2], ry, `${st.data.bonus[k] ? `+${st.data.bonus[k]}` : '-'}`, 15, '#2e7d32', { originX: 0.5 });
      this.t(cols[3], ry, `${eq[k] ? `+${eq[k]}` : '-'}`, 15, '#1565c0', { originX: 0.5 });
      this.t(cols[4], ry, `${total[k]}`, 17, INK, { originX: 0.5 });
      if (pts > 0) {
        this.add2(button(this.ui, WIN_X + WIN_W - 50, ry + 9, 44, 30, '+', () => {
          st.allocate(k);
          this.refresh();
        }, 'brown', 18));
      }
    });
    y += 244;

    // 파생 능력치
    const d = st.derived();
    const rows = [
      `공격력 ${d.atk}`, `방어력 ${d.def}`, `최대 체력 ${d.maxHp}`, `최대 마력 ${d.maxMp}`,
      `치명 ${Math.round(d.critChance * 100)}% (×${d.critMult})`, `이동 ${d.moveSpeed}`,
    ];
    rows.forEach((r, i) => this.t(x0 + (i % 2) * 210, y + Math.floor(i / 2) * 24, r, 15, PAPER));
    y += 80;

    // 오행 분포
    this.t(x0, y, '타고난 오행', 15, '#ffe6a8');
    this.t(x0 + 110, y + 2, `신강 ${Math.round(a.strength)} · 한난 ${a.temp.toFixed(1)} · 조습 ${a.humid.toFixed(1)}`, 12, '#e8d8b8');
    y += 24;
    ELEMENTS.forEach((e, i) => {
      const bx = x0 + i * 84;
      const v = a.scores[e];
      this.add2(this.ui.add.rectangle(bx, y + 44, 70, 44, 0x2a1d12).setOrigin(0, 1));
      this.add2(this.ui.add.rectangle(bx, y + 44, 70, Math.max(2, (44 * v) / 50), ELEMENT_NUM[e]).setOrigin(0, 1));
      this.t(bx + 35, y + 48, `${e} ${v}%`, 12, PAPER, { originX: 0.5 });
    });
    y += 72;
    this.t(WIN_X + WIN_W / 2, y, `보완 오행(용신): ${a.yong}${a.isJongwang ? ' · 종왕형' : ''} · 본업 오행: ${ch.jobClass.element}`, 15, '#fff3a0', { originX: 0.5 });
  }
}

// ------------------------------------------------------------------
// 스킬
// ------------------------------------------------------------------
export class SkillWindow extends GameWindow {
  constructor(ui: UIHost) {
    super(ui, '오행 스킬');
    this.build();
  }

  protected build() {
    const st = this.gs;
    const job = st.character.jobClass.element;
    const d = st.derived();
    let y = this.top + 40;
    this.t(WIN_X + WIN_W / 2, y, `내 일간 오행(${job}) 스킬은 본업이라 위력 +${Math.round((JOB_SKILL_BONUS - 1) * 100)}%`, 14, '#ffe6a8', { originX: 0.5 });
    y += 28;
    const entries = [
      { hanja: ELEMENT_HANJA[job], el: job, name: '기본 공격', key: 'Space', info: `마력 0 · 대기 ${BASIC_ATTACK.cooldown / 1000}초 · 사거리 짧음`, desc: `내 본업 오행(${job})으로 치는 기본 공격. 공격력 ${d.atk}.` },
      ...SKILLS.map((s, i) => ({
        hanja: s.hanja,
        el: s.element,
        name: s.name,
        key: `${i + 1}`,
        info: `마력 ${s.mp} · 대기 ${s.cooldown / 1000}초${s.range ? ` · 사거리 ${s.range >= 150 ? '김' : s.range >= 110 ? '보통' : '짧음'}` : ''}`,
        desc: s.desc,
      })),
    ];
    for (const e of entries) {
      const row = panel(this.ui, WIN_X + 16, y, WIN_W - 32, 96, 'light');
      this.add2(row);
      this.add2(this.ui.add.circle(WIN_X + 60, y + 48, 30, ELEMENT_NUM[e.el]).setStrokeStyle(3, 0x3b2a1a));
      this.t(WIN_X + 60, y + 48, e.hanja, 26, '#ffffff', { originX: 0.5, originY: 0.5, stroke: '#3b2a1a', strokeThickness: 4 });
      this.t(WIN_X + 104, y + 12, e.name, 18, INK);
      if (e.el === job) this.t(WIN_X + 104 + e.name.length * 17 + 8, y + 14, '본업', 12, '#ffffff', { stroke: '#b0400a', strokeThickness: 4 });
      this.t(WIN_X + WIN_W - 34, y + 14, `단축키 ${e.key}`, 12, INK_SOFT, { originX: 1 });
      this.t(WIN_X + 104, y + 38, e.info, 13, '#1565c0');
      this.t(WIN_X + 104, y + 58, e.desc, 13, INK_SOFT, { wrap: WIN_W - 140 });
      y += 102;
    }
  }
}

// ------------------------------------------------------------------
// 퀘스트
// ------------------------------------------------------------------
export class QuestWindow extends GameWindow {
  constructor(ui: UIHost) {
    super(ui, '퀘스트 일지');
    this.build();
  }

  protected build() {
    const st = this.gs;
    let y = this.top + 40;
    const list = [...st.data.quests].sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0));
    if (!list.length) {
      this.t(WIN_X + WIN_W / 2, y + 80, '아직 받은 퀘스트가 없습니다.\n머리 위에 ! 표시가 있는 사람에게 말을 걸어 보세요.', 15, PAPER, { originX: 0.5, align: 'center' });
      return;
    }
    for (const q of list) {
      const def = QUEST_BY_ID[q.id];
      const done = q.status === 'done';
      const h = done ? 56 : 132;
      if (y + h > this.top + this.h - 10) break;
      this.add2(panel(this.ui, WIN_X + 16, y, WIN_W - 32, h, done ? 'inset' : 'light'));
      this.t(WIN_X + 32, y + 12, `${def.main ? '[메인]' : '[서브]'} ${def.title}`, 17, def.main ? '#8a4b00' : '#1b5e20');
      const tag = done ? '완료' : q.status === 'ready' ? `보고하기 → ${npcName(def.giver)}` : '진행 중';
      this.t(WIN_X + WIN_W - 32, y + 14, tag, 13, q.status === 'ready' ? '#b0400a' : INK_SOFT, { originX: 1 });
      if (!done) {
        this.t(WIN_X + 32, y + 40, def.summary, 13, INK, { wrap: WIN_W - 64 });
        this.t(WIN_X + 32, y + 80, `목표: ${questGoalText(def, q)}`, 14, '#1565c0');
        const rew = [`${def.reward.gold}전`, `경험치 ${def.reward.exp}`, ...(def.reward.items ?? []).map((i) => `${itemDef(i.itemId).name}×${i.count}`)];
        this.t(WIN_X + 32, y + 104, `보상: ${rew.join(', ')}`, 12, INK_SOFT);
      } else {
        this.t(WIN_X + 32, y + 34, `보상을 받았습니다 · ${npcName(def.giver)}`, 12, INK_SOFT);
      }
      y += h + 8;
    }
  }
}

// ------------------------------------------------------------------
// 지도
// ------------------------------------------------------------------
export class MapWindow extends GameWindow {
  private dots?: Phaser.GameObjects.Graphics;
  private mapX = 0;
  private mapY = 0;
  private scaleF = 2;
  private blink = 0;

  constructor(ui: UIHost) {
    super(ui, '동방 청림 지도');
    this.build();
  }

  protected build() {
    const texW = MAP_W * 3;
    const texH = MAP_H * 3;
    this.scaleF = Math.min(2, (this.h - 100) / texH);
    const w = texW * this.scaleF;
    const h = texH * this.scaleF;
    this.mapX = WIN_X + 30;
    this.mapY = this.top + 44;
    this.add2(panel(this.ui, this.mapX - 8, this.mapY - 8, w + 16, h + 16, 'inset'));
    this.add2(this.ui.add.image(this.mapX, this.mapY, 'minimap').setOrigin(0).setScale(this.scaleF));
    this.dots = this.add2(this.ui.add.graphics());

    // 지역 이름과 가게 표시
    const lx = this.mapX + w + 20;
    REGIONS.forEach((r) => {
      const ry = this.mapY + ((r.fromRow + r.toRow) / 2) * 3 * this.scaleF;
      this.t(lx, ry, r.name.replace('동방 청림 · ', ''), 14, '#ffe6a8', { originY: 0.5, wrap: 150 });
    });
    const shopMarks: Array<[string, number, number]> = [
      ['잡', 5, 9],
      ['무', 25, 9],
      ['옷', 5, 15],
      ['촌', 14.5, 5],
    ];
    for (const [ch, c, r] of shopMarks) {
      const x = this.mapX + c * 3 * this.scaleF;
      const y = this.mapY + r * 3 * this.scaleF;
      this.add2(this.ui.add.circle(x, y, 9, 0xfff3d6).setStrokeStyle(2, 0x3b2a1a));
      this.t(x, y, ch, 11, INK, { originX: 0.5, originY: 0.5 });
    }

    // 퀘스트 목표 위치
    const tracked = this.gs.trackedQuest();
    if (tracked && tracked.state.status === 'active' && tracked.def.goal.kind === 'kill') {
      const species = tracked.def.goal.species;
      const pts = species === 'sindansu' ? [{ col: BOSS_SPOT.col, row: BOSS_SPOT.row }] : SPAWNS.filter((s) => s.species === species);
      for (const p of pts) {
        const x = this.mapX + (p.col + 0.5) * 3 * this.scaleF;
        const y = this.mapY + (p.row + 0.5) * 3 * this.scaleF;
        this.t(x, y, '★', 18, '#ffd23f', { originX: 0.5, originY: 0.5, stroke: '#3b2a1a', strokeThickness: 4 });
      }
    }

    const ly = this.top + this.h - 150;
    const legend = [
      ['#ffffff', '나'],
      ['#ffd23f', 'NPC (퀘스트)'],
      ['#ff5a4a', '몬스터'],
      ['#c77dff', '보스'],
      ['#ffd23f', '★ 퀘스트 목표'],
    ];
    legend.forEach(([c, s], i) => {
      this.t(lx, ly + i * 24, `● ${s}`, 13, c, { stroke: '#2a1d12', strokeThickness: 3 });
    });
    this.t(lx, ly - 30, 'M 키로 닫기', 12, '#e8d8b8');
  }

  tick(dt: number) {
    if (!this.dots) return;
    const dots = this.ui.getWorldDots();
    if (!dots) return;
    this.blink += dt;
    const g = this.dots;
    g.clear();
    const f = (3 * this.scaleF) / CELL;
    for (const m of dots.monsters) {
      g.fillStyle(m.boss ? 0xc77dff : 0xff5a4a, 1).fillCircle(this.mapX + m.x * f, this.mapY + m.y * f, m.boss ? 6 : 3);
    }
    for (const n of dots.npcs) {
      g.fillStyle(n.quest ? 0xffd23f : 0x9fe0ff, 1).fillCircle(this.mapX + n.x * f, this.mapY + n.y * f, 4);
    }
    const on = Math.floor(this.blink / 350) % 2 === 0;
    g.fillStyle(0xffffff, 1).lineStyle(2, 0x000000, 1);
    g.fillCircle(this.mapX + dots.player.x * f, this.mapY + dots.player.y * f, on ? 6 : 4);
    g.strokeCircle(this.mapX + dots.player.x * f, this.mapY + dots.player.y * f, on ? 6 : 4);
  }
}

// ------------------------------------------------------------------
// 메뉴
// ------------------------------------------------------------------
export class MenuWindow extends GameWindow {
  constructor(ui: UIHost) {
    super(ui, '메뉴', 150, 480);
    this.build();
  }

  protected build() {
    const st = this.gs;
    const cx = WIN_X + WIN_W / 2;
    let y = this.top + 50;
    const created = new Date(st.data.createdAt);
    const mins = Math.floor(st.data.playMs / 60000);
    this.t(cx, y, `${st.data.name} · 태어난 시각 ${created.getFullYear()}.${created.getMonth() + 1}.${created.getDate()} ${created.getHours()}시 ${created.getMinutes()}분`, 13, '#e8d8b8', { originX: 0.5 });
    this.t(cx, y + 22, `플레이 시간 ${Math.floor(mins / 60)}시간 ${mins % 60}분`, 13, '#e8d8b8', { originX: 0.5 });
    y += 80;
    this.add2(button(this.ui, cx, y, 280, 54, '저장하기', () => {
      bus.emit('cmd', { type: 'save' });
      this.ui.toast('저장했습니다', '#9fe0a0');
    }, 'beige', 18));
    y += 70;
    this.add2(button(this.ui, cx, y, 280, 54, '조작 방법', () => this.ui.openWindow('help'), 'brown', 18));
    y += 70;
    this.add2(button(this.ui, cx, y, 280, 54, '제목 화면으로 (자동 저장)', () => {
      bus.emit('cmd', { type: 'save' });
      this.ui.closeWindow();
      this.ui.scene.stop('World');
      this.ui.scene.start('Title');
    }, 'grey', 17));
    y += 70;
    this.add2(button(this.ui, cx, y, 280, 54, '게임으로 돌아가기', () => this.ui.closeWindow(), 'brown', 18));
  }
}

export class HelpWindow extends GameWindow {
  constructor(ui: UIHost) {
    super(ui, '조작 방법', 90, 620);
    this.build();
  }

  protected build() {
    const body = [
      '■ PC 키보드',
      '이동: 방향키 / WASD',
      '공격 · 대화: Space',
      '오행 스킬: 1 목 · 2 화 · 3 토 · 4 금 · 5 수',
      '물약: 6 체력 · 7 마력',
      '창: I 가방 · C 장비 · P 능력치 · K 스킬',
      '     L 퀘스트 · M 지도 · Esc 메뉴·닫기',
      '',
      '■ 휴대폰',
      '왼쪽 아래 원을 끌어 이동',
      '오른쪽 큰 버튼: 공격 (사람 앞에서는 대화)',
      '작은 오행 버튼: 스킬 · 맨 아래 줄: 창 열기',
      '',
      '■ 전투 요령',
      '스킬 버튼 테두리가 초록이면 지금 대상에게 유리,',
      '빨강이면 불리한 오행입니다.',
    ].join('\n');
    this.add2(panel(this.ui, WIN_X + 16, this.top + 36, WIN_W - 32, this.h - 110, 'light'));
    this.t(WIN_X + 36, this.top + 52, body, 15, INK, { lineSpacing: 6 });
    this.add2(button(this.ui, WIN_X + WIN_W / 2, this.top + this.h - 40, 180, 46, '닫기', () => this.ui.closeWindow(), 'brown'));
  }
}

// ------------------------------------------------------------------
// 상점
// ------------------------------------------------------------------
export class ShopWindow extends GameWindow {
  private shopId: string;
  private mode: 'buy' | 'sell';
  private selected?: string | number;
  private qty = 1;

  constructor(ui: UIHost, shopId: string, mode: 'buy' | 'sell') {
    super(ui, SHOPS[shopId].name, 50, 700);
    this.shopId = shopId;
    this.mode = mode;
    this.build();
  }

  protected build() {
    if (!this.shopId) return;
    const st = this.gs;
    const y0 = this.top + 34;
    this.add2(this.ui.add.image(WIN_X + 34, y0 + 14, 'items', 45).setScale(1.5));
    this.t(WIN_X + 50, y0 + 4, `${st.data.gold.toLocaleString()} 전`, 17, GOLD);
    const tabs: Array<['buy' | 'sell', string]> = [
      ['buy', '사기'],
      ['sell', '팔기'],
    ];
    tabs.forEach(([m, label], i) => {
      const b = this.add2(button(this.ui, WIN_X + 270 + i * 100, y0 + 14, 92, 38, label, () => {
        this.mode = m;
        this.selected = undefined;
        this.qty = 1;
        this.refresh();
      }, this.mode === m ? 'beige' : 'grey', 15));
      void b;
    });

    const listY = y0 + 44;
    const rowH = 52;
    const maxRows = 8;
    const rows: Array<{ key: string | number; itemId: string; price: number; pillar?: string; count?: number }> =
      this.mode === 'buy'
        ? SHOPS[this.shopId].items.map((id) => ({ key: id, itemId: id, price: itemDef(id).price }))
        : st.data.inventory.map((s) => ({ key: s.uid, itemId: s.itemId, price: st.sellPrice(s), pillar: s.pillar, count: s.count }));
    if (!rows.length) this.t(WIN_X + WIN_W / 2, listY + 60, '팔 물건이 없습니다.', 15, PAPER, { originX: 0.5 });
    rows.slice(0, maxRows * 2).forEach((r, i) => {
      if (i >= maxRows && this.mode === 'buy') return;
      const compact = rows.length > maxRows;
      const col = compact ? i % 2 : 0;
      const rowIdx = compact ? Math.floor(i / 2) : i;
      if (rowIdx >= maxRows) return;
      const w = compact ? (WIN_W - 40) / 2 : WIN_W - 32;
      const x = WIN_X + 16 + col * (w + 8);
      const y = listY + rowIdx * (rowH + 4);
      const def = itemDef(r.itemId);
      const sel = this.selected === r.key;
      this.add2(panel(this.ui, x, y, w, rowH, sel ? 'insetBrown' : 'light'));
      this.add2(itemIcon(this.ui, x + 26, y + rowH / 2, r.itemId, 34));
      const nameColor = sel ? '#fff3d6' : GRADE_COLORS[def.grade] === GRADE_COLORS.common ? INK : darker(GRADE_COLORS[def.grade]);
      this.t(x + 50, y + 8, `${r.pillar ? `${r.pillar} ` : ''}${def.name}${r.count && r.count > 1 ? ` ×${r.count}` : ''}`, compact ? 13 : 16, nameColor);
      const tooLow = this.mode === 'buy' && (def.levelReq ?? 1) > st.data.level;
      const cant = this.mode === 'buy' && st.data.gold < r.price;
      if (!compact) {
        const brief = itemLines(st, def)[1] ?? itemLines(st, def)[0];
        this.t(x + 50, y + 30, `${brief}${tooLow ? ` · Lv${def.levelReq}` : ''}`, 12, sel ? '#e8d8b8' : tooLow ? '#c0392b' : INK_SOFT);
      }
      this.t(x + w - 12, y + rowH / 2, `${r.price}전`, compact ? 13 : 16, cant ? '#c0392b' : sel ? GOLD : '#8a5a00', { originX: 1, originY: 0.5 });
      const hit = this.add2(this.ui.add.rectangle(x + w / 2, y + rowH / 2, w, rowH, 0, 0).setInteractive({ useHandCursor: true }));
      hit.on('pointerup', () => {
        this.selected = r.key;
        this.qty = 1;
        this.refresh();
      });
    });

    // 아래 설명과 거래 버튼
    const dy = listY + maxRows * (rowH + 4) + 6;
    const dh = this.top + this.h - dy - 14;
    this.add2(panel(this.ui, WIN_X + 16, dy, WIN_W - 32, dh, 'light'));
    const row = rows.find((r) => r.key === this.selected);
    if (!row) {
      this.t(WIN_X + WIN_W / 2, dy + dh / 2 - 10, this.mode === 'buy' ? '살 물건을 고르세요' : '팔 물건을 고르세요 (판 값은 산 값의 절반)', 15, INK_SOFT, { originX: 0.5, originY: 0.5 });
      return;
    }
    const def = itemDef(row.itemId);
    const stack = this.mode === 'sell' ? st.findStack(row.key as number) : undefined;
    this.t(WIN_X + 32, dy + 10, itemLines(st, def, stack).join('\n'), 13, INK, { wrap: WIN_W - 64, lineSpacing: 3 });
    const cmp = this.mode === 'buy' ? compareText(st, def) : '';
    if (cmp) this.t(WIN_X + 32, dy + 76, cmp, 13, cmp.includes('▲') ? '#2e7d32' : '#c0392b');

    const stackable = isStackable(def);
    const maxQty = this.mode === 'sell' ? row.count ?? 1 : stackable ? 99 : 1;
    const by = this.top + this.h - 46;
    if (maxQty > 1) {
      this.add2(button(this.ui, WIN_X + 50, by, 50, 40, '−', () => {
        this.qty = Math.max(1, this.qty - (this.qty > 5 ? 5 : 1));
        this.refresh();
      }, 'grey', 18));
      this.t(WIN_X + 100, by, `${this.qty}개`, 17, INK, { originX: 0.5, originY: 0.5 });
      this.add2(button(this.ui, WIN_X + 150, by, 50, 40, '+', () => {
        this.qty = Math.min(maxQty, this.qty + (this.qty >= 5 ? 5 : 1));
        this.refresh();
      }, 'grey', 18));
    }
    const total = row.price * this.qty;
    const label = this.mode === 'buy' ? `${total}전에 사기` : `${total}전에 팔기`;
    const deal: Button = this.add2(button(this.ui, WIN_X + WIN_W - 118, by, 200, 44, label, () => {
      const err = this.mode === 'buy' ? st.buy(row.itemId, this.qty) : st.sell(row.key as number, this.qty);
      this.ui.toast(err ?? (this.mode === 'buy' ? `${def.name} 구입!` : `${def.name} 판매!`), err ? '#ff9a8a' : '#9fe0a0');
      if (!err && this.mode === 'sell') this.selected = undefined;
      this.qty = 1;
      this.refresh();
    }, 'brown', 16));
    if (this.mode === 'buy' && st.data.gold < total) deal.setEnabled(false);
  }
}

// ------------------------------------------------------------------
// 쓰러짐
// ------------------------------------------------------------------
export class DeathWindow extends GameWindow {
  private lost: number;

  constructor(ui: UIHost, lost: number) {
    super(ui, '기절', 240, 300);
    this.lost = lost;
    this.build();
  }

  protected build() {
    if (this.lost === undefined) return;
    const cx = WIN_X + WIN_W / 2;
    this.t(cx, this.top + 60, '눈앞이 캄캄해진다...', 22, PAPER, { originX: 0.5 });
    this.t(cx, this.top + 104, `떨어뜨린 돈: ${this.lost}전`, 16, '#ff9a8a', { originX: 0.5 });
    this.t(cx, this.top + 134, '마을 어귀에서 체력을 회복하고 깨어납니다.', 14, '#e8d8b8', { originX: 0.5 });
    this.add2(button(this.ui, cx, this.top + 220, 260, 54, '마을에서 깨어나기', () => {
      bus.emit('cmd', { type: 'revive' });
      this.ui.closeWindow(false, true);
    }, 'beige', 18));
  }
}

export { NPCS };
