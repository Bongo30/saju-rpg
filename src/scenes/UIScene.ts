import Phaser from 'phaser';
import { bus, type BuffInfo, type DialogueScript, type TargetInfo } from '../game/bus';
import type { GameState } from '../game/state';
import { SKILLS, ELEMENT_HANJA } from '../data/skills';
import { buildMap, minimapColor, MAP_H, MAP_W, CELL } from '../game/map';
import { controls, type Element } from '../saju/ganji';
import { dayPillar } from '../saju/pillar';
import { itemDef } from '../data/items';
import { Bar, ELEMENT_NUM, ELEMENT_TEXT, GOLD, INK, INK_SOFT, panel, PAPER, swallow, txt } from '../ui/kit';
import {
  DeathWindow, EquipWindow, GameWindow, HelpWindow, InventoryWindow, MapWindow, MenuWindow, QuestWindow, ShopWindow, SkillWindow,
  StatsWindow, type UIHost,
} from '../ui/windows';
import type { WorldScene } from './WorldScene';

const W = 480;
const H = 800;
const MENU_Y = 748;

const JOY = { x: 92, y: 650, r: 62 };
const ATTACK = { x: 402, y: 660, r: 42 };
const SKILL_R = 24;
const POTIONS: Array<{ kind: 'hp' | 'mp'; x: number; y: number; key: string }> = [
  { kind: 'hp', x: 452, y: 584, key: '6' },
  { kind: 'mp', x: 452, y: 536, key: '7' },
];

const MINI = { x: 356, y: 8, w: 116, h: 116, s: 1.29 };

interface SkillButton {
  id: string;
  element: Element;
  mp: number;
  x: number;
  y: number;
  ring: Phaser.GameObjects.Graphics;
  pie: Phaser.GameObjects.Graphics;
  body: Phaser.GameObjects.Arc;
}

type WindowName = 'inventory' | 'equip' | 'stats' | 'skills' | 'quests' | 'map' | 'menu' | 'help' | 'shop' | 'death';

/** 게임 화면 위에 겹쳐 그리는 UI (HUD, 조작 버튼, 대화창, 각종 창) */
export class UIScene extends Phaser.Scene implements UIHost {
  state!: GameState;

  private hpBar!: Bar;
  private mpBar!: Bar;
  private expBar!: Bar;
  private nameText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private buffLayer!: Phaser.GameObjects.Container;
  private buffs: BuffInfo[] = [];

  private miniImg!: Phaser.GameObjects.Image;
  private miniDots!: Phaser.GameObjects.Graphics;
  private regionText!: Phaser.GameObjects.Text;
  private questText!: Phaser.GameObjects.Text;

  private targetLayer!: Phaser.GameObjects.Container;
  private target: TargetInfo | null = null;

  private logLines: Array<{ text: Phaser.GameObjects.Text; born: number }> = [];
  private bannerText!: Phaser.GameObjects.Text;
  private interactText!: Phaser.GameObjects.Text;
  private attackLabel!: Phaser.GameObjects.Text;

  private joyKnob!: Phaser.GameObjects.Arc;
  private joyPointer?: number;

  private skillButtons: SkillButton[] = [];
  private cooldowns = new Map<string, { readyAt: number; cd: number }>();
  private attackPie!: Phaser.GameObjects.Graphics;
  private potionCounts: Record<string, Phaser.GameObjects.Text> = {};
  private menuDots: Record<string, Phaser.GameObjects.Arc> = {};

  private win?: GameWindow;
  private winName?: WindowName;
  private dialogue?: DialogueBox;
  private closing = false;
  private lastModal = false;

  private stateHandlers: Array<[string, (...a: unknown[]) => void]> = [];
  private busHandlers: Array<[string, (...a: never[]) => void]> = [];

  constructor() {
    super('UI');
  }

  create() {
    this.state = this.registry.get('state') as GameState;
    this.input.addPointer(2);
    this.skillButtons = [];
    this.logLines = [];
    this.cooldowns.clear();
    this.win = undefined;
    this.winName = undefined;
    this.dialogue = undefined;
    this.joyPointer = undefined;
    this.target = null;
    this.buffs = [];

    this.buildMinimapTexture();
    this.buildHud();
    this.buildMinimap();
    this.buildTarget();
    this.buildControls();
    this.buildMenuBar();

    this.bannerText = txt(this, W / 2, 250, '', 26, GOLD, { originX: 0.5, originY: 0.5, stroke: '#2a1d12', strokeThickness: 6, align: 'center' })
      .setAlpha(0)
      .setDepth(900);

    this.setupEvents();
    this.setupKeys();
    this.refreshHud();
    this.refreshQuestTracker();
  }

  // ------------------------------------------------------------------
  // HUD
  // ------------------------------------------------------------------
  private buildHud() {
    panel(this, 6, 6, 262, 96, 'brown');
    panel(this, 14, 16, 62, 62, 'inset');
    this.add.image(45, 47, 'hero_face').setDisplaySize(52, 44);
    const job = this.state.character.jobClass;
    this.add.circle(66, 72, 11, ELEMENT_NUM[job.element]).setStrokeStyle(2, 0x2a1d12);
    txt(this, 66, 72, ELEMENT_HANJA[job.element], 12, '#ffffff', { originX: 0.5, originY: 0.5, stroke: '#2a1d12', strokeThickness: 3 });

    this.nameText = txt(this, 86, 13, '', 15, PAPER, { stroke: '#2a1d12', strokeThickness: 3 });
    this.hpBar = new Bar(this, 86, 36, 172, 16, 'red', true);
    this.mpBar = new Bar(this, 86, 56, 172, 14, 'blue', true);
    this.expBar = new Bar(this, 86, 73, 172, 7, 'yellow');
    this.add.image(22, 91, 'items', 45).setScale(1.1);
    this.goldText = txt(this, 34, 84, '', 13, GOLD, { stroke: '#2a1d12', strokeThickness: 3 });
    const today = new Date();
    const p = dayPillar(today.getFullYear(), today.getMonth() + 1, today.getDate());
    txt(this, 258, 84, `오늘 ${p.name}일`, 12, ELEMENT_TEXT[p.stem.element], { originX: 1, stroke: '#2a1d12', strokeThickness: 3 });

    this.buffLayer = this.add.container(0, 0);
  }

  private refreshHud() {
    const st = this.state;
    const d = st.derived();
    this.nameText.setText(`${st.data.name}  Lv${st.data.level} ${st.character.jobClass.name}`);
    this.hpBar.setRatio(st.data.hp / d.maxHp, `${Math.ceil(st.data.hp)} / ${d.maxHp}`);
    this.mpBar.setRatio(st.data.mp / d.maxMp, `${Math.ceil(st.data.mp)} / ${d.maxMp}`);
    this.expBar.setRatio(st.data.exp / st.expToNext());
    this.goldText.setText(`${st.data.gold.toLocaleString()}전`);

    const count = (kind: 'hp' | 'mp') =>
      st.data.inventory.filter((s) => itemDef(s.itemId).type === 'consumable' && (kind === 'hp' ? itemDef(s.itemId).heal : itemDef(s.itemId).mana)).reduce((n, s) => n + s.count, 0);
    for (const p of POTIONS) this.potionCounts[p.kind]?.setText(`${count(p.kind)}`);

    this.menuDots.stats?.setVisible(st.data.statPoints > 0);
    this.menuDots.quests?.setVisible(st.data.quests.some((q) => q.status === 'ready'));
    for (const b of this.skillButtons) b.body.setAlpha(st.data.mp >= b.mp ? 1 : 0.45);
  }

  private drawBuffs() {
    this.buffLayer.removeAll(true);
    const now = this.time.now;
    this.buffs = this.buffs.filter((b) => b.until > now);
    this.buffs.forEach((b, i) => {
      const x = 290 + i * 34;
      const y = 26;
      const c = this.add.circle(x, y, 14, b.color).setStrokeStyle(2, 0x2a1d12);
      const t = txt(this, x, y, b.hanja, 13, '#ffffff', { originX: 0.5, originY: 0.5, stroke: '#2a1d12', strokeThickness: 3 });
      const left = txt(this, x, y + 22, `${Math.ceil((b.until - now) / 1000)}`, 11, PAPER, { originX: 0.5, originY: 0.5, stroke: '#2a1d12', strokeThickness: 3 });
      this.buffLayer.add([c, t, left]);
    });
  }

  // ------------------------------------------------------------------
  // 미니맵
  // ------------------------------------------------------------------
  private buildMinimapTexture() {
    if (this.textures.exists('minimap')) return;
    const map = buildMap();
    const tex = this.textures.createCanvas('minimap', MAP_W * 3, MAP_H * 3)!;
    const ctx = tex.getContext();
    for (let r = 0; r < MAP_H; r++) {
      for (let c = 0; c < MAP_W; c++) {
        ctx.fillStyle = minimapColor(map.ground[r][c], map.objects[r][c]);
        ctx.fillRect(c * 3, r * 3, 3, 3);
      }
    }
    tex.refresh();
  }

  private buildMinimap() {
    panel(this, MINI.x - 6, MINI.y - 2, MINI.w + 12, MINI.h + 10, 'brown');
    this.miniImg = this.add.image(MINI.x, MINI.y + 3, 'minimap').setOrigin(0).setScale(MINI.s);
    this.miniDots = this.add.graphics();
    this.regionText = txt(this, W - 8, MINI.y + MINI.h + 14, '', 13, '#fff3d6', { originX: 1, stroke: '#2a1d12', strokeThickness: 4 });
    this.questText = txt(this, W - 8, MINI.y + MINI.h + 36, '', 13, '#ffe6a8', { originX: 1, align: 'right', stroke: '#2a1d12', strokeThickness: 4, lineSpacing: 3 });
    const hit = this.add.rectangle(MINI.x, MINI.y, MINI.w, MINI.h, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      this.toggleWindow('map');
    });
  }

  private updateMinimap() {
    const dots = this.getWorldDots();
    if (!dots) return;
    const texRows = MAP_H * 3;
    const viewTex = MINI.h / MINI.s;
    const py = (dots.player.y / CELL) * 3;
    const cropY = Phaser.Math.Clamp(py - viewTex / 2, 0, texRows - viewTex);
    this.miniImg.setCrop(0, cropY, MAP_W * 3, viewTex);
    this.miniImg.y = MINI.y + 3 - cropY * MINI.s;

    const g = this.miniDots;
    g.clear();
    const f = (3 * MINI.s) / CELL;
    const toY = (y: number) => MINI.y + 3 + y * f - cropY * MINI.s;
    const inView = (y: number) => y >= MINI.y + 2 && y <= MINI.y + MINI.h + 2;
    for (const m of dots.monsters) {
      const y = toY(m.y);
      if (inView(y)) g.fillStyle(m.boss ? 0xc77dff : 0xff5a4a, 1).fillCircle(MINI.x + m.x * f, y, m.boss ? 5 : 2.5);
    }
    for (const n of dots.npcs) {
      const y = toY(n.y);
      if (inView(y)) g.fillStyle(n.quest ? 0xffd23f : 0x9fe0ff, 1).fillCircle(MINI.x + n.x * f, y, 3);
    }
    const on = Math.floor(this.time.now / 350) % 2 === 0;
    g.fillStyle(0xffffff, 1).lineStyle(1.5, 0x000000, 1);
    g.fillCircle(MINI.x + dots.player.x * f, toY(dots.player.y), on ? 4 : 3);
    g.strokeCircle(MINI.x + dots.player.x * f, toY(dots.player.y), on ? 4 : 3);
  }

  private refreshQuestTracker() {
    const t = this.state.trackedQuest();
    if (!t) {
      this.questText.setText('');
      return;
    }
    const goal = t.state.status === 'ready' ? `완료! 보고하러 가자` : questGoalShort(this.state, t.def.id);
    this.questText.setText(`${t.def.main ? '◆' : '◇'} ${t.def.title}\n${goal}`);
    this.questText.setColor(t.state.status === 'ready' ? '#9fe0a0' : '#ffe6a8');
  }

  getWorldDots() {
    const world = this.scene.get('World') as WorldScene | undefined;
    if (!world || !this.scene.isActive('World')) return null;
    try {
      return world.getDots();
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------------
  // 대상 정보 (몬스터 / 보스)
  // ------------------------------------------------------------------
  private buildTarget() {
    this.targetLayer = this.add.container(0, 0).setVisible(false);
  }

  private drawTarget() {
    const t = this.target;
    this.targetLayer.removeAll(true);
    if (!t) {
      this.targetLayer.setVisible(false);
      this.refreshSkillRings();
      return;
    }
    this.targetLayer.setVisible(true);
    const x = 6;
    const y = 108;
    const w = t.isBoss ? 340 : 262;
    const h = t.isBoss ? 92 : 62;
    const bg = panel(this, x, y, w, h, 'brown');
    const el = t.element as Element;
    const badge = this.add.circle(x + 22, y + 22, 13, ELEMENT_NUM[el]).setStrokeStyle(2, 0x2a1d12);
    const badgeT = txt(this, x + 22, y + 22, ELEMENT_HANJA[el], 13, '#ffffff', { originX: 0.5, originY: 0.5, stroke: '#2a1d12', strokeThickness: 3 });
    const name = txt(this, x + 42, y + 10, `Lv${t.level} ${t.name}`, 14, t.isBoss ? '#ffb3ff' : PAPER, { stroke: '#2a1d12', strokeThickness: 3 });
    const saju = txt(this, x + w - 10, y + 12, `${t.dayPillar}일주`, 12, '#e8d8b8', { originX: 1 });
    const hp = new Bar(this, x + 42, y + 32, w - 54, 14, 'red', true).setRatio(t.hp / t.maxHp, `${Math.ceil(t.hp)} / ${t.maxHp}`);
    this.targetLayer.add([bg, badge, badgeT, name, saju, hp]);
    if (t.isBoss && t.gauge !== undefined) {
      const g = new Bar(this, x + 42, y + 52, w - 54, 12, 'green', false).setRatio(t.gauge / 100);
      const lbl = txt(this, x + 14, y + 52, '목기', 11, '#9fe0a0', { stroke: '#2a1d12', strokeThickness: 3 });
      const hint = txt(this, x + 14, y + 70, t.weakened ? '기운이 약해졌다! 지금 금(金)으로 베자' : '목기가 넘친다. 화(火)로 기운을 빼자', 12, t.weakened ? '#ffe066' : '#ffcf9f', { stroke: '#2a1d12', strokeThickness: 3 });
      this.targetLayer.add([g, lbl, hint]);
    } else if (t.note) {
      const note = txt(this, x + 10, y + h + 2, t.note, 11, '#ffe6a8', { stroke: '#2a1d12', strokeThickness: 3, wrap: 300 });
      this.targetLayer.add(note);
    }
    this.refreshSkillRings();
  }

  /** 대상의 오행에 대해 유리(초록) / 불리(빨강) 테두리 */
  private refreshSkillRings() {
    const el = this.target?.element as Element | undefined;
    for (const b of this.skillButtons) {
      let color = 0x3b2a1a;
      let width = 3;
      if (el && SKILLS.find((s) => s.id === b.id)?.kind === 'attack') {
        if (controls(b.element, el)) {
          color = 0x5cff5c;
          width = 4;
        } else if (controls(el, b.element)) {
          color = 0xff4a4a;
          width = 4;
        }
      }
      b.ring.clear().lineStyle(width, color, 1).strokeCircle(b.x, b.y, SKILL_R);
    }
  }

  // ------------------------------------------------------------------
  // 조작 버튼
  // ------------------------------------------------------------------
  private buildControls() {
    // 조이스틱
    this.add.circle(JOY.x, JOY.y, JOY.r, 0x2a1d12, 0.35).setStrokeStyle(3, 0xfff3d6, 0.5);
    this.joyKnob = this.add.circle(JOY.x, JOY.y, 26, 0xfff3d6, 0.75).setStrokeStyle(3, 0x3b2a1a, 0.8);
    const zone = this.add.circle(JOY.x, JOY.y, JOY.r + 40, 0, 0).setInteractive();
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.isModal()) return;
      this.joyPointer = p.id;
      this.moveJoy(p);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id === this.joyPointer) this.moveJoy(p);
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.joyPointer) return;
      this.joyPointer = undefined;
      this.joyKnob.setPosition(JOY.x, JOY.y);
      bus.emit('joystick', 0, 0);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    // 공격 / 대화
    const atk = this.add.circle(ATTACK.x, ATTACK.y, ATTACK.r, 0xb5482f, 0.92).setStrokeStyle(4, 0x3b2a1a).setInteractive({ useHandCursor: true });
    this.attackPie = this.add.graphics();
    this.attackLabel = txt(this, ATTACK.x, ATTACK.y, '공격', 18, '#ffffff', { originX: 0.5, originY: 0.5, stroke: '#3b2a1a', strokeThickness: 4 });
    atk.on('pointerdown', () => {
      atk.setScale(0.92);
      bus.emit('cmd', { type: 'attack' });
    });
    atk.on('pointerup', () => atk.setScale(1));
    atk.on('pointerout', () => atk.setScale(1));

    // 오행 스킬 (공격 버튼 둘레 반원)
    SKILLS.forEach((s, i) => {
      const ang = Phaser.Math.DegToRad(180 + i * 22.5);
      const x = ATTACK.x + Math.cos(ang) * 82;
      const y = ATTACK.y + Math.sin(ang) * 82;
      const body = this.add.circle(x, y, SKILL_R, ELEMENT_NUM[s.element], 0.95).setInteractive({ useHandCursor: true });
      const ring = this.add.graphics();
      txt(this, x, y - 2, s.hanja, 18, '#ffffff', { originX: 0.5, originY: 0.5, stroke: '#2a1d12', strokeThickness: 4 });
      txt(this, x + 16, y - 20, `${i + 1}`, 10, '#fff3d6', { originX: 0.5, originY: 0.5, stroke: '#2a1d12', strokeThickness: 3 });
      txt(this, x, y + 16, `${s.mp}`, 10, '#bfe3ff', { originX: 0.5, originY: 0.5, stroke: '#2a1d12', strokeThickness: 3 });
      const pie = this.add.graphics();
      body.on('pointerdown', () => {
        body.setScale(0.9);
        bus.emit('cmd', { type: 'skill', id: s.id });
      });
      body.on('pointerup', () => body.setScale(1));
      body.on('pointerout', () => body.setScale(1));
      this.skillButtons.push({ id: s.id, element: s.element, mp: s.mp, x, y, ring, pie, body });
    });
    this.refreshSkillRings();

    // 물약
    for (const p of POTIONS) {
      const c = this.add.circle(p.x, p.y, 20, 0x3b2a1a, 0.85).setStrokeStyle(2, 0xfff3d6, 0.7).setInteractive({ useHandCursor: true });
      this.add.image(p.x, p.y, 'items', p.kind === 'hp' ? itemDef('herb').icon : itemDef('elixir').icon).setDisplaySize(26, 26);
      this.potionCounts[p.kind] = txt(this, p.x + 14, p.y + 12, '0', 11, '#ffffff', { originX: 0.5, originY: 0.5, stroke: '#2a1d12', strokeThickness: 3 });
      txt(this, p.x - 14, p.y - 14, p.key, 10, '#fff3d6', { originX: 0.5, originY: 0.5, stroke: '#2a1d12', strokeThickness: 3 });
      c.on('pointerdown', () => bus.emit('cmd', { type: 'potion', kind: p.kind }));
    }

    this.interactText = txt(this, W / 2, 560, '', 15, '#fff3d6', { originX: 0.5, originY: 0.5, stroke: '#2a1d12', strokeThickness: 5 }).setVisible(false);
  }

  private moveJoy(p: Phaser.Input.Pointer) {
    const dx = p.x - JOY.x;
    const dy = p.y - JOY.y;
    const len = Math.hypot(dx, dy);
    const max = JOY.r;
    const k = len > max ? max / len : 1;
    this.joyKnob.setPosition(JOY.x + dx * k, JOY.y + dy * k);
    const nx = (dx * k) / max;
    const ny = (dy * k) / max;
    bus.emit('joystick', Math.hypot(nx, ny) < 0.2 ? 0 : nx, Math.hypot(nx, ny) < 0.2 ? 0 : ny);
  }

  private drawCooldowns() {
    const now = this.time.now;
    const pie = (g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, id: string) => {
      g.clear();
      const cd = this.cooldowns.get(id);
      if (!cd || cd.readyAt <= now) return;
      const ratio = (cd.readyAt - now) / cd.cd;
      g.fillStyle(0x000000, 0.55);
      g.slice(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, false);
      g.fillPath();
    };
    pie(this.attackPie, ATTACK.x, ATTACK.y, ATTACK.r, 'basic');
    for (const b of this.skillButtons) pie(b.pie, b.x, b.y, SKILL_R, b.id);
  }

  // ------------------------------------------------------------------
  // 아래 메뉴 줄
  // ------------------------------------------------------------------
  private buildMenuBar() {
    panel(this, 0, MENU_Y, W, H - MENU_Y, 'brown');
    const entries: Array<[WindowName, string, string]> = [
      ['inventory', '가방', 'I'],
      ['equip', '장비', 'C'],
      ['stats', '능력', 'P'],
      ['skills', '스킬', 'K'],
      ['quests', '퀘스트', 'L'],
      ['map', '지도', 'M'],
      ['menu', '메뉴', 'Esc'],
    ];
    const w = W / entries.length;
    entries.forEach(([name, label, key], i) => {
      const cx = w * i + w / 2;
      const cy = MENU_Y + (H - MENU_Y) / 2;
      const bg = this.add.nineslice(cx, cy, 'buttonLong_beige', undefined, w - 6, 40, 14, 14, 12, 14).setInteractive({ useHandCursor: true });
      txt(this, cx, cy - 4, label, 15, INK, { originX: 0.5, originY: 0.5 });
      txt(this, cx, cy + 12, key, 9, INK_SOFT, { originX: 0.5, originY: 0.5 });
      bg.on('pointerdown', () => bg.setTexture('buttonLong_beige_pressed'));
      bg.on('pointerout', () => bg.setTexture('buttonLong_beige'));
      bg.on('pointerup', () => {
        bg.setTexture('buttonLong_beige');
        this.toggleWindow(name);
      });
      this.menuDots[name] = this.add.circle(cx + w / 2 - 10, cy - 14, 6, 0xe53935).setStrokeStyle(2, 0xffffff).setVisible(false);
    });
  }

  // ------------------------------------------------------------------
  // 창 관리
  // ------------------------------------------------------------------
  openWindow(name: string, arg?: unknown) {
    this.closeWindow(true);
    const n = name as WindowName;
    let w: GameWindow;
    switch (n) {
      case 'inventory': w = new InventoryWindow(this); break;
      case 'equip': w = new EquipWindow(this); break;
      case 'stats': w = new StatsWindow(this); break;
      case 'skills': w = new SkillWindow(this); break;
      case 'quests': w = new QuestWindow(this); break;
      case 'map': w = new MapWindow(this); break;
      case 'menu': w = new MenuWindow(this); break;
      case 'help': w = new HelpWindow(this); break;
      case 'shop': {
        const a = arg as { shop: string; mode: 'buy' | 'sell' };
        w = new ShopWindow(this, a.shop, a.mode);
        break;
      }
      case 'death': w = new DeathWindow(this, arg as number); break;
      default: return;
    }
    this.win = w;
    this.winName = n;
    this.syncModal();
  }

  closeWindow(silent = false) {
    if (!this.win) return;
    if (this.winName === 'death' && !silent) return; // 기절 창은 버튼으로만 닫는다
    this.win.destroy();
    this.win = undefined;
    this.winName = undefined;
    if (!silent) this.syncModal();
  }

  private toggleWindow(name: WindowName) {
    if (this.winName === 'death' || this.dialogue) return;
    if (this.winName === name) this.closeWindow();
    else this.openWindow(name);
  }

  private isModal() {
    return !!this.win || !!this.dialogue || this.closing;
  }

  private syncModal() {
    const m = this.isModal();
    if (m && this.joyPointer !== undefined) {
      this.joyPointer = undefined;
      this.joyKnob.setPosition(JOY.x, JOY.y);
    }
    if (m !== this.lastModal) {
      this.lastModal = m;
      bus.emit('modal', m);
    }
  }

  /** 대화·창을 닫은 직후 같은 키 입력이 게임으로 새지 않도록 잠깐 막는다 */
  private holdModal() {
    this.closing = true;
    this.time.delayedCall(150, () => {
      this.closing = false;
      this.syncModal();
    });
  }

  // ------------------------------------------------------------------
  // 대화창
  // ------------------------------------------------------------------
  private openDialogue(script: DialogueScript) {
    if (this.winName === 'death') return;
    this.closeWindow(true);
    this.dialogue?.destroy();
    this.dialogue = new DialogueBox(this, script, (choice) => {
      this.dialogue?.destroy();
      this.dialogue = undefined;
      this.holdModal();
      this.syncModal();
      script.onClose?.();
      choice?.();
    });
    this.syncModal();
  }

  // ------------------------------------------------------------------
  // 알림
  // ------------------------------------------------------------------
  toast(msg: string, color = '#fff3d6') {
    const t = txt(this, W / 2, 210, msg, 17, color, { originX: 0.5, originY: 0.5, stroke: '#2a1d12', strokeThickness: 5 }).setDepth(2000);
    this.tweens.add({ targets: t, y: 180, alpha: 0, delay: 900, duration: 700, onComplete: () => t.destroy() });
  }

  private banner(text: string, color = GOLD) {
    this.bannerText.setText(text).setColor(color).setAlpha(0).setScale(0.7);
    this.tweens.killTweensOf(this.bannerText);
    this.tweens.add({ targets: this.bannerText, alpha: 1, scale: 1, duration: 250, ease: 'Back.Out' });
    this.tweens.add({ targets: this.bannerText, alpha: 0, delay: 2200, duration: 600 });
  }

  private addLog(msg: string, color: string) {
    const t = txt(this, 12, 0, msg, 13, color, { stroke: '#1a120a', strokeThickness: 4, wrap: 300 });
    this.logLines.push({ text: t, born: this.time.now });
    while (this.logLines.length > 5) this.logLines.shift()!.text.destroy();
    this.layoutLog();
  }

  private layoutLog() {
    let y = 572;
    for (let i = this.logLines.length - 1; i >= 0; i--) {
      const t = this.logLines[i].text;
      y -= t.height + 2;
      t.y = y;
    }
  }

  private fadeLog() {
    const now = this.time.now;
    for (const l of this.logLines) {
      const age = now - l.born;
      l.text.setAlpha(age < 6000 ? 1 : Math.max(0, 1 - (age - 6000) / 1500));
    }
  }

  // ------------------------------------------------------------------
  // 이벤트
  // ------------------------------------------------------------------
  private setupEvents() {
    const onState = (ev: string, fn: (...a: unknown[]) => void) => {
      this.state.on(ev, fn);
      this.stateHandlers.push([ev, fn]);
    };
    onState('change', (ev) => {
      this.refreshHud();
      if (ev === 'quest' || ev === 'inventory') this.refreshQuestTracker();
      // 체력·경험치처럼 자주 바뀌는 값에는 창을 다시 그리지 않는다
      if (this.win && ev !== 'vitals' && ev !== 'exp' && ev !== 'log') this.win.refresh();
    });
    onState('log', (msg, color) => this.addLog(String(msg), String(color ?? PAPER)));

    const onBus = <T extends unknown[]>(ev: string, fn: (...a: T) => void) => {
      bus.on(ev, fn);
      this.busHandlers.push([ev, fn as unknown as (...a: never[]) => void]);
    };
    onBus('dialogue', (s: DialogueScript) => this.openDialogue(s));
    onBus('shop', (shop: string, mode: 'buy' | 'sell') => this.openWindow('shop', { shop, mode }));
    onBus('death', (lost: number) => {
      this.dialogue?.destroy();
      this.dialogue = undefined;
      this.openWindow('death', lost);
    });
    onBus('target', (t: TargetInfo | null) => {
      this.target = t;
      this.drawTarget();
    });
    onBus('buffs', (b: BuffInfo[]) => {
      this.buffs = b;
      this.drawBuffs();
    });
    onBus('cooldown', (id: string, readyAt: number, cd: number) => this.cooldowns.set(id, { readyAt, cd }));
    onBus('region', (name: string) => {
      this.regionText.setText(name);
      this.banner(name, '#fff3d6');
    });
    onBus('interact', (label: string | null) => {
      this.attackLabel.setText(label ? '대화' : '공격');
      this.interactText.setText(label ? `${label}에게 말 걸기 (Space)` : '').setVisible(!!label);
    });
    onBus('banner', (text: string, color?: string) => this.banner(text, color));

    this.events.once('shutdown', () => {
      for (const [ev, fn] of this.stateHandlers) this.state.off(ev, fn);
      for (const [ev, fn] of this.busHandlers) bus.off(ev, fn);
      this.stateHandlers = [];
      this.busHandlers = [];
      this.lastModal = false;
      this.closing = false;
      bus.emit('modal', false);
    });
  }

  private setupKeys() {
    const kb = this.input.keyboard!;
    const map: Array<[string, WindowName]> = [
      ['I', 'inventory'],
      ['C', 'equip'],
      ['P', 'stats'],
      ['K', 'skills'],
      ['L', 'quests'],
      ['M', 'map'],
    ];
    for (const [key, name] of map) kb.on(`keydown-${key}`, () => this.toggleWindow(name));
    kb.on('keydown-ESC', () => {
      if (this.dialogue) this.dialogue.cancel();
      else if (this.win) this.closeWindow();
      else this.openWindow('menu');
    });
    const advance = () => this.dialogue?.advance();
    kb.on('keydown-ENTER', advance);
    kb.on('keydown-SPACE', advance);
    kb.on('keydown-E', advance);
  }

  update(_time: number, delta: number) {
    this.updateMinimap();
    this.drawCooldowns();
    this.fadeLog();
    if (this.buffs.length) this.drawBuffs();
    if (this.win instanceof MapWindow) this.win.tick(delta);
    this.dialogue?.tick(delta);
  }
}

function questGoalShort(state: GameState, id: string): string {
  const q = state.quest(id);
  const t = state.trackedQuest();
  if (!q || !t) return '';
  const g = t.def.goal;
  if (g.kind === 'kill') return `처치 ${q.count}/${g.count}`;
  return `${itemDef(g.itemId).name} ${Math.min(state.countItem(g.itemId), g.count)}/${g.count}`;
}

// ----------------------------------------------------------------------
// 대화창: 한 글자씩 나오는 글, 초상화, 선택지
// ----------------------------------------------------------------------
class DialogueBox extends Phaser.GameObjects.Container {
  private script: DialogueScript;
  private page = 0;
  private shown = 0;
  private full = '';
  private acc = 0;
  private textObj: Phaser.GameObjects.Text;
  private nameObj: Phaser.GameObjects.Text;
  private portrait: Phaser.GameObjects.Image;
  private arrow: Phaser.GameObjects.Text;
  private choiceLayer: Phaser.GameObjects.Container;
  private onDone: (choice?: () => void) => void;
  private choosing = false;
  private openedAt: number;

  constructor(scene: Phaser.Scene, script: DialogueScript, onDone: (choice?: () => void) => void) {
    super(scene, 0, 0);
    this.script = script;
    this.onDone = onDone;
    this.openedAt = scene.time.now;
    const top = 552;
    const catcher = swallow(scene.add.rectangle(0, 0, W, H, 0x000000, 0.25).setOrigin(0));
    catcher.on('pointerup', () => this.advance());
    const box = swallow(panel(scene, 8, top, W - 16, 192, 'light'));
    box.on('pointerup', () => this.advance());
    const pFrame = panel(scene, 22, top + 18, 84, 84, 'inset');
    this.portrait = scene.add.image(64, top + 60, 'hero_face');
    const plate = panel(scene, 116, top - 16, 170, 36, 'brown');
    this.nameObj = txt(scene, 201, top + 2, '', 16, PAPER, { originX: 0.5, originY: 0.5 });
    this.textObj = txt(scene, 120, top + 28, '', 17, INK, { wrap: W - 160, lineSpacing: 6 });
    this.arrow = txt(scene, W - 36, top + 168, '▼', 16, INK_SOFT, { originX: 0.5, originY: 0.5 });
    scene.tweens.add({ targets: this.arrow, y: top + 162, yoyo: true, repeat: -1, duration: 400 });
    this.choiceLayer = scene.add.container(0, 0);
    const hint = txt(scene, 30, top + 170, 'Space / 화면을 눌러 넘기기', 11, INK_SOFT, { originY: 0.5 });
    this.add([catcher, box, pFrame, this.portrait, plate, this.nameObj, this.textObj, this.arrow, hint, this.choiceLayer]);
    scene.add.existing(this);
    this.setDepth(1500);
    this.showPage(0);
  }

  private showPage(i: number) {
    const p = this.script.pages[i];
    this.page = i;
    this.full = p.text;
    this.shown = 0;
    this.acc = 0;
    this.textObj.setText('');
    this.nameObj.setText(p.speaker);
    if (p.portrait === 'hero') this.portrait.setTexture('hero_face').setDisplaySize(72, 60);
    else this.portrait.setTexture('dungeon', p.portrait).setDisplaySize(64, 64);
    this.arrow.setVisible(false);
  }

  tick(dt: number) {
    if (this.shown >= this.full.length) return;
    this.acc += dt;
    const per = 28;
    while (this.acc >= per && this.shown < this.full.length) {
      this.acc -= per;
      this.shown++;
    }
    this.textObj.setText(this.full.slice(0, this.shown));
    if (this.shown >= this.full.length) this.onPageDone();
  }

  private onPageDone() {
    const last = this.page >= this.script.pages.length - 1;
    if (last && this.script.choices?.length) this.showChoices();
    else this.arrow.setVisible(true);
  }

  private showChoices() {
    if (this.choosing) return;
    this.choosing = true;
    this.arrow.setVisible(false);
    const choices = this.script.choices!;
    const bw = 230;
    const bh = 46;
    choices.forEach((c, i) => {
      const y = 552 - 30 - (choices.length - 1 - i) * (bh + 8);
      const bg = swallow(this.scene.add.nineslice(W - 20 - bw / 2, y, 'buttonLong_brown', undefined, bw, bh, 14, 14, 12, 14));
      bg.setInteractive({ useHandCursor: true });
      const t = txt(this.scene, W - 20 - bw / 2, y - 2, `${i + 1}. ${c.label}`, 16, PAPER, { originX: 0.5, originY: 0.5 });
      bg.on('pointerup', () => this.pick(i));
      this.choiceLayer.add([bg, t]);
    });
    const kb = this.scene.input.keyboard!;
    const keys = ['ONE', 'TWO', 'THREE', 'FOUR'];
    choices.forEach((_c, i) => kb.once(`keydown-${keys[i]}`, () => this.choosing && this.pick(i)));
  }

  private pick(i: number) {
    const c = this.script.choices?.[i];
    if (!c || !this.active) return;
    this.choosing = false;
    this.onDone(c.action);
  }

  advance() {
    if (!this.active || this.scene.time.now - this.openedAt < 120) return;
    if (this.shown < this.full.length) {
      this.shown = this.full.length;
      this.textObj.setText(this.full);
      this.onPageDone();
      return;
    }
    if (this.choosing) return;
    if (this.page < this.script.pages.length - 1) this.showPage(this.page + 1);
    else this.onDone();
  }

  cancel() {
    if (!this.active) return;
    this.onDone();
  }

  destroy(fromScene?: boolean) {
    if (this.scene) {
      const kb = this.scene.input.keyboard;
      for (const k of ['ONE', 'TWO', 'THREE', 'FOUR']) kb?.removeAllListeners(`keydown-${k}`);
    }
    super.destroy(fromScene);
  }
}
