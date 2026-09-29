import Phaser from 'phaser';
import { bus, type BuffInfo, type Command, type DialogueScript, type TargetInfo } from '../game/bus';
import type { GameState } from '../game/state';
import { saveGame } from '../game/save';
import { computeDamage } from '../game/battle';
import { SPECIES, spawnIndividual, type MonsterIndividual, type SpeciesDef } from '../data/monsters';
import { BASIC_ATTACK, JOB_SKILL_BONUS, SKILLS, type SkillDef } from '../data/skills';
import { itemDef } from '../data/items';
import type { Element } from '../saju/ganji';
import {
  buildMap, BOSS_SPOT, CELL, GATE_ROW, MAP_H, MAP_W, NPCS, PLAYER_SPAWN, SCALE, SOLID_TILES, SPAWNS, regionAt,
  WORLD_PX_H, WORLD_PX_W, type MapData, type NpcSpot,
} from '../game/map';
import { BARKS, npcDialogue } from '../game/dialogue';
import { ELEMENT_NUM, FONT, txt } from '../ui/kit';

type Body = Phaser.Physics.Arcade.Body;
type PhysSprite = Phaser.GameObjects.Sprite & { body: Body };

const WOOD_SPECIES = new Set(['dokkaebi', 'boar', 'snake']);
const RESPAWN_MS = 18000;
const INTERACT_RANGE = 62;
const TARGET_RANGE = 260;
const BOSS_GAUGE_MAX = 100;

interface Monster {
  id: number;
  ind: MonsterIndividual;
  sprite: PhysSprite;
  shadow: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  hp: number;
  home: Phaser.Math.Vector2;
  alive: boolean;
  lastAttack: number;
  nextThink: number;
  wander: Phaser.Math.Vector2;
  slowUntil: number;
  bloomUntil: number;
  lastHealAt: number;
  gauge: number;
  weakened: boolean;
  radius: number;
  dormant: boolean;
}

interface Npc {
  spot: NpcSpot;
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  marker: Phaser.GameObjects.Text;
  body: Phaser.GameObjects.Rectangle;
  wanderTarget?: Phaser.Math.Vector2;
}

interface Loot {
  sprite: Phaser.GameObjects.Image;
  gold?: number;
  itemId?: string;
  pillar?: string;
  readyAt: number;
}

interface Buff extends BuffInfo {
  defBonus?: number;
  atkBonus?: number;
}

export class WorldScene extends Phaser.Scene {
  state!: GameState;
  mapData!: MapData;
  player!: PhysSprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private playerLabel!: Phaser.GameObjects.Text;
  private objectsLayer!: Phaser.Tilemaps.TilemapLayer;
  monsters: Monster[] = [];
  npcs: Npc[] = [];
  private loot: Loot[] = [];
  private gateBlocks: Phaser.GameObjects.GameObject[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private joy = new Phaser.Math.Vector2(0, 0);
  private facing = new Phaser.Math.Vector2(0, 1);
  private cooldowns = new Map<string, number>();
  private buffs: Buff[] = [];
  private target?: Monster;
  private targetRing!: Phaser.GameObjects.Image;
  private interactNpc?: Npc;
  private interactBoss = false;
  private lastHurtAt = -99999;
  private regionName = '';
  private forestShade!: Phaser.GameObjects.Rectangle;
  private dead = false;
  private nextMonsterId = 1;
  private modal = false;
  private stateHandlers: Array<[string, (...a: unknown[]) => void]> = [];
  private busHandlers: Array<[string, (...a: never[]) => void]> = [];

  constructor() {
    super('World');
  }

  create() {
    this.state = this.registry.get('state') as GameState;
    this.monsters = [];
    this.npcs = [];
    this.loot = [];
    this.buffs = [];
    this.cooldowns.clear();
    this.dead = false;
    this.target = undefined;
    this.regionName = '';

    this.physics.world.setBounds(0, 0, WORLD_PX_W, WORLD_PX_H);
    this.buildTilemap();
    this.buildPlayer();
    this.buildNpcs();
    this.buildGate();
    this.buildMonsters();
    this.targetRing = this.add.image(0, 0, 'target_ring').setVisible(false).setDepth(2).setTint(0xff5a4a);
    this.tweens.add({ targets: this.targetRing, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });

    this.cameras.main.setBounds(0, 0, WORLD_PX_W, WORLD_PX_H);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(400, 23, 18, 13);

    this.setupInput();
    this.setupEvents();

    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickSecond() });
    this.time.addEvent({ delay: 20000, loop: true, callback: () => this.autosave() });
    this.time.addEvent({ delay: 7000, loop: true, callback: () => this.randomBark() });

    this.scene.launch('UI');
    this.scene.bringToTop('UI');
    this.refreshQuestMarkers();

    if (!this.state.data.quests.length) {
      this.time.delayedCall(700, () => {
        this.state.log('촌장님이 부르신다. 가까이 가서 Space(또는 대화 버튼)를 누르자.', '#ffd27f');
      });
    }
  }

  // ---------------- 맵 ----------------
  private buildTilemap() {
    this.mapData = buildMap();
    const map = this.make.tilemap({ tileWidth: 16, tileHeight: 16, width: MAP_W, height: MAP_H });
    const tiles = map.addTilesetImage('town', 'town', 16, 16, 0, 0)!;
    const ground = map.createBlankLayer('ground', tiles)!;
    ground.putTilesAt(this.mapData.ground, 0, 0);
    ground.setScale(SCALE).setDepth(0);
    const objects = map.createBlankLayer('objects', tiles)!;
    objects.putTilesAt(this.mapData.objects, 0, 0);
    objects.setScale(SCALE).setDepth(1);
    objects.setCollision([...SOLID_TILES]);
    this.objectsLayer = objects;

    // 숲은 어둡게
    this.forestShade = this.add
      .rectangle(0, (GATE_ROW + 1) * CELL, WORLD_PX_W, WORLD_PX_H - (GATE_ROW + 1) * CELL, 0x0b2412, 0.28)
      .setOrigin(0)
      .setDepth(1.5);

    // 가게 간판 글씨
    const labels: Array<[number, number, string]> = [
      [14.5, 1.6, '촌장 댁'],
      [5, 5.6, '잡화점'],
      [25, 5.6, '대장간 · 무기점'],
      [5, 11.6, '포목점 · 옷가게'],
    ];
    for (const [c, r, s] of labels) {
      txt(this, c * CELL, r * CELL, s, 14, '#fff3d6', { originX: 0.5, originY: 0.5, stroke: '#3b2a1a', strokeThickness: 4 }).setDepth(3);
    }
  }

  // ---------------- 플레이어 ----------------
  private buildPlayer() {
    const pos = this.state.data.pos;
    const x = pos && pos.x > 0 && pos.x < WORLD_PX_W ? pos.x : (PLAYER_SPAWN.col + 0.5) * CELL;
    const y = pos && pos.y > 0 && pos.y < WORLD_PX_H ? pos.y : (PLAYER_SPAWN.row + 0.5) * CELL;
    const element = this.state.character.jobClass.element;
    this.playerShadow = this.add.image(x, y, 'shadow').setDepth(4).setTint(ELEMENT_NUM[element]).setAlpha(0.9);
    const p = this.add.sprite(x, y, 'hero', 0).setScale(1.35) as PhysSprite;
    p.setOrigin(0.5, 0.85);
    this.physics.add.existing(p);
    p.body.setSize(12, 8).setOffset(6, 22);
    p.body.setCollideWorldBounds(true);
    this.player = p;
    this.physics.add.collider(p, this.objectsLayer);
    this.playerLabel = txt(this, x, y - 50, `${this.state.data.name}`, 13, '#ffffff', { originX: 0.5, originY: 1, stroke: '#1d1409', strokeThickness: 4 }).setDepth(9000);
  }

  // ---------------- NPC ----------------
  private buildNpcs() {
    for (const spot of NPCS) {
      const x = spot.col * CELL + CELL / 2;
      const y = spot.row * CELL + CELL / 2;
      this.add.image(x, y + 14, 'shadow').setDepth(4);
      const sprite = this.add.image(x, y, 'dungeon', spot.frame).setScale(2.4).setOrigin(0.5, 0.8).setDepth(5 + y / 100);
      const label = txt(this, x, y - 38, spot.title ? `${spot.title}\n${this.npcLabel(spot.id)}` : this.npcLabel(spot.id), 12, spot.shop ? '#ffe39a' : '#bfe8ff', {
        originX: 0.5,
        originY: 1,
        align: 'center',
        stroke: '#1d1409',
        strokeThickness: 4,
        lineSpacing: 0,
      }).setDepth(9000);
      const marker = txt(this, x, y - 72, '', 26, '#ffd23f', { originX: 0.5, originY: 1, stroke: '#3b2a1a', strokeThickness: 5 }).setDepth(9001);
      this.tweens.add({ targets: marker, y: marker.y - 6, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      const body = this.add.rectangle(x, y + 6, 22, 16, 0, 0);
      this.physics.add.existing(body, !spot.wander);
      if (spot.wander) (body.body as Body).setImmovable(true);
      this.physics.add.collider(this.player, body);
      this.npcs.push({ spot, sprite, label, marker, body });
    }
  }

  private npcLabel(id: string) {
    return this.state ? (NPC_DISPLAY[id] ?? id) : id;
  }

  refreshQuestMarkers() {
    for (const n of this.npcs) {
      const active = this.state.activeQuestAt(n.spot.id);
      const offer = this.state.offerableQuest(n.spot.id);
      if (active?.state.status === 'ready') n.marker.setText('?').setColor('#ffd23f');
      else if (offer) n.marker.setText('!').setColor(offer.main ? '#ffd23f' : '#9fe0ff');
      else if (active) n.marker.setText('…').setColor('#d8d8d8');
      else n.marker.setText('');
    }
  }

  private randomBark() {
    const cam = this.cameras.main.worldView;
    const visible = this.npcs.filter((n) => cam.contains(n.sprite.x, n.sprite.y) && BARKS[n.spot.id]);
    if (!visible.length || this.modal) return;
    const n = Phaser.Utils.Array.GetRandom(visible);
    const line = Phaser.Utils.Array.GetRandom(BARKS[n.spot.id]);
    this.bubble(n.sprite.x, n.sprite.y - 90, line);
  }

  private bubble(x: number, y: number, text: string) {
    const t = txt(this, x, y, text, 13, '#3b2a1a', { originX: 0.5, originY: 1 }).setDepth(9500);
    const bg = this.add
      .rectangle(x, y + 3, t.width + 16, t.height + 8, 0xfffaf0, 0.95)
      .setOrigin(0.5, 1)
      .setStrokeStyle(2, 0x8a6a42)
      .setDepth(9499);
    this.time.delayedCall(2600, () => {
      this.tweens.add({ targets: [t, bg], alpha: 0, duration: 300, onComplete: () => { t.destroy(); bg.destroy(); } });
    });
  }

  // ---------------- 숲 입구 봉인 ----------------
  private buildGate() {
    if (this.state.data.flags.gateOpen) return;
    for (const [c, r] of this.mapData.gateCells) {
      const x = c * CELL + CELL / 2;
      const y = r * CELL + CELL / 2;
      const img = this.add.image(x, y, 'town', 81).setScale(SCALE).setTint(0xff8866).setDepth(2);
      const block = this.add.rectangle(x, y, CELL, CELL, 0, 0);
      this.physics.add.existing(block, true);
      this.physics.add.collider(this.player, block);
      this.gateBlocks.push(img, block);
    }
    const seal = txt(this, 15 * CELL, GATE_ROW * CELL + CELL / 2, '封 봉인', 18, '#ffdddd', { originX: 0.5, originY: 0.5, stroke: '#6a1a1a', strokeThickness: 5 }).setDepth(3);
    this.gateBlocks.push(seal);
  }

  private openGate() {
    if (!this.gateBlocks.length) return;
    this.state.log('숲의 봉인이 풀렸다! 신단수 숲으로 갈 수 있다.', '#ffd27f');
    const blocks = this.gateBlocks;
    this.gateBlocks = [];
    this.tweens.add({
      targets: blocks,
      alpha: 0,
      duration: 700,
      onComplete: () => blocks.forEach((b) => b.destroy()),
    });
    for (const b of blocks) {
      const body = (b as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.StaticBody | undefined;
      if (body) body.enable = false;
    }
  }

  // ---------------- 몬스터 ----------------
  private buildMonsters() {
    for (const sp of SPAWNS) {
      this.spawnMonster(SPECIES[sp.species], (sp.col + 0.5) * CELL, (sp.row + 0.5) * CELL);
    }
    if (!this.state.data.flags.bossDefeated) {
      this.spawnMonster(SPECIES.sindansu, BOSS_SPOT.col * CELL + CELL / 2, BOSS_SPOT.row * CELL);
    } else {
      this.placeRestoredTree();
    }
  }

  private placeRestoredTree() {
    const x = BOSS_SPOT.col * CELL + CELL / 2;
    const y = BOSS_SPOT.row * CELL;
    this.add.image(x, y + 40, 'shadow').setScale(3, 2.4).setDepth(4);
    this.add.image(x, y, 'town', 16).setScale(6).setOrigin(0.5, 0.75).setDepth(5 + y / 100).setTint(0xc8ffb8);
    const block = this.add.rectangle(x, y + 10, 70, 40, 0, 0);
    this.physics.add.existing(block, true);
    this.physics.add.collider(this.player, block);
    txt(this, x, y - 88, '수호목 신단수', 14, '#c8ffb8', { originX: 0.5, originY: 1, stroke: '#1d1409', strokeThickness: 4 }).setDepth(9000);
  }

  private spawnMonster(species: SpeciesDef, x: number, y: number, reuse?: Monster): Monster {
    const ind = spawnIndividual(species, new Date());
    const key = species.sprite.key;
    const frame = species.sprite.frame;
    const sprite = (frame !== undefined ? this.add.sprite(x, y, key, frame) : this.add.sprite(x, y, key)) as PhysSprite;
    sprite.setScale(species.sprite.scale).setOrigin(0.5, 0.75);
    this.physics.add.existing(sprite);
    const tw = sprite.width;
    const th = sprite.height;
    const r = Math.min(tw, th) * (species.isBoss ? 0.38 : 0.36);
    sprite.body.setCircle(r, tw / 2 - r, th * 0.75 - r);
    sprite.body.setCollideWorldBounds(true);
    sprite.body.setImmovable(true);
    if (!species.isBoss) this.physics.add.collider(sprite, this.objectsLayer);
    this.physics.add.collider(this.player, sprite);

    const shadow = this.add.image(x, y, 'shadow').setDepth(4).setScale(species.isBoss ? 3 : 1.1, species.isBoss ? 2.4 : 1);
    const nameColor = species.isBoss ? '#ff9a7a' : '#ffffff';
    const label = txt(this, x, y, `Lv${ind.level} ${species.name}`, species.isBoss ? 15 : 12, nameColor, {
      originX: 0.5,
      originY: 1,
      stroke: '#1d1409',
      strokeThickness: 4,
    }).setDepth(9000);
    const barW = species.isBoss ? 90 : 40;
    const hpBg = this.add.rectangle(x, y, barW, 6, 0x1d1409).setDepth(9000);
    const hpFill = this.add.rectangle(x - barW / 2 + 1, y, barW - 2, 4, 0xe84a3a).setOrigin(0, 0.5).setDepth(9001);

    const m: Monster = reuse ?? ({} as Monster);
    Object.assign(m, {
      id: this.nextMonsterId++,
      ind,
      sprite,
      shadow,
      label,
      hpBg,
      hpFill,
      hp: ind.maxHp,
      home: new Phaser.Math.Vector2(x, y),
      alive: true,
      lastAttack: 0,
      nextThink: 0,
      wander: new Phaser.Math.Vector2(0, 0),
      slowUntil: 0,
      bloomUntil: 0,
      lastHealAt: 0,
      gauge: BOSS_GAUGE_MAX,
      weakened: false,
      radius: r * species.sprite.scale,
      dormant: false,
    });
    if (!reuse) this.monsters.push(m);
    if (species.isBoss) this.updateBossDormancy();
    sprite.setAlpha(0);
    this.tweens.add({ targets: sprite, alpha: 1, duration: 500 });
    return m;
  }

  private updateBossDormancy() {
    const boss = this.monsters.find((m) => m.ind.species.isBoss && m.alive);
    if (!boss) return;
    const q = this.state.quest('q3');
    boss.dormant = !q || q.status === 'done';
    boss.sprite.setTint(boss.dormant ? 0x8fa08a : 0xffffff);
    boss.label.setText(boss.dormant ? '천년 신단수 (잠듦)' : `Lv${boss.ind.level} 천년 신단수`);
  }

  // ---------------- 입력 ----------------
  private setupInput() {
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys('W,A,S,D') as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
    kb.on('keydown-SPACE', () => this.command({ type: this.canInteract() ? 'interact' : 'attack' }));
    kb.on('keydown-E', () => this.command({ type: 'interact' }));
    const skillKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'];
    SKILLS.forEach((s, i) => kb.on(`keydown-${skillKeys[i]}`, () => this.command({ type: 'skill', id: s.id })));
    kb.on('keydown-SIX', () => this.command({ type: 'potion', kind: 'hp' }));
    kb.on('keydown-SEVEN', () => this.command({ type: 'potion', kind: 'mp' }));
  }

  private setupEvents() {
    const onBus = <T extends unknown[]>(ev: string, fn: (...a: T) => void) => {
      bus.on(ev, fn);
      this.busHandlers.push([ev, fn as unknown as (...a: never[]) => void]);
    };
    onBus('cmd', (c: Command) => this.command(c));
    onBus('joystick', (x: number, y: number) => this.joy.set(x, y));
    onBus('modal', (v: boolean) => {
      this.modal = v;
      if (v) {
        this.joy.set(0, 0);
        this.player.body.setVelocity(0, 0);
      }
    });

    const onState = (ev: string, fn: (...a: unknown[]) => void) => {
      this.state.on(ev, fn);
      this.stateHandlers.push([ev, fn]);
    };
    onState('quest', () => {
      this.refreshQuestMarkers();
      if (this.state.data.flags.gateOpen) this.openGate();
      this.updateBossDormancy();
      this.autosave();
    });
    onState('inventory', () => this.refreshQuestMarkers());
    onState('levelup', () => {
      this.levelUpFx();
      this.autosave();
    });
    onState('equipment', () => this.autosave());

    this.events.once('shutdown', () => {
      for (const [ev, fn] of this.busHandlers) bus.off(ev, fn);
      for (const [ev, fn] of this.stateHandlers) this.state.off(ev, fn);
      this.busHandlers = [];
      this.stateHandlers = [];
    });
  }

  private command(c: Command) {
    if (this.dead && c.type !== 'revive') return;
    if (this.modal && (c.type === 'attack' || c.type === 'interact' || c.type === 'skill')) return;
    switch (c.type) {
      case 'attack':
        if (this.canInteract()) this.interact();
        else this.basicAttack();
        break;
      case 'interact':
        this.interact();
        break;
      case 'skill':
        this.castSkill(c.id);
        break;
      case 'potion': {
        const r = this.state.usePotion(c.kind);
        this.state.log(r.msg, r.ok ? '#9fe0a0' : '#ff9a8a');
        if (r.ok) this.floatText(this.player.x, this.player.y - 50, c.kind === 'hp' ? '+체력' : '+마력', c.kind === 'hp' ? '#7ef07e' : '#8ccaff', 15);
        break;
      }
      case 'useItem':
        this.useItem(c.uid);
        break;
      case 'revive':
        this.revive();
        break;
      case 'save':
        this.autosave(true);
        break;
    }
  }

  private useItem(uid: number) {
    const r = this.state.use(uid);
    this.state.log(r.msg, r.ok ? '#9fe0a0' : '#ff9a8a');
    if (!r.ok) return;
    if (r.effect === 'return') {
      this.cameras.main.flash(300, 255, 255, 220);
      this.player.setPosition((PLAYER_SPAWN.col + 0.5) * CELL, (PLAYER_SPAWN.row + 0.5) * CELL);
    } else if (r.effect === 'fireCharm') {
      this.addBuff({ id: 'fireCharm', name: '화기 부적 (공격 +20%)', hanja: '符', color: 0xe53935, until: this.time.now + 30000, duration: 30000, atkBonus: 0.2 });
    }
  }

  // ---------------- 상호작용 ----------------
  private canInteract() {
    return !!this.interactNpc || this.interactBoss;
  }

  private interact() {
    if (this.interactBoss) {
      const boss = this.monsters.find((m) => m.ind.species.isBoss && m.alive);
      if (boss?.dormant) {
        this.openDialogue({
          pages: [{ speaker: '천년 신단수', portrait: 'hero', text: '(신단수가 깊은 잠에 빠져 있다. 촌장님께 먼저 이야기를 듣자.)' }],
        });
      }
      return;
    }
    const npc = this.interactNpc;
    if (!npc) return;
    const script = npcDialogue(npc.spot.id, this.state, {
      openShop: (shop, mode) => bus.emit('shop', shop, mode),
      reopen: (id) => {
        this.refreshQuestMarkers();
        const n = this.npcs.find((x) => x.spot.id === id);
        if (n) this.time.delayedCall(50, () => this.openDialogue(npcDialogue(id, this.state, { openShop: (s, m) => bus.emit('shop', s, m), reopen: () => undefined })));
      },
    });
    this.openDialogue(script);
  }

  private openDialogue(script: DialogueScript) {
    bus.emit('dialogue', script);
  }

  // ---------------- 전투 ----------------
  private pickTarget(): Monster | undefined {
    let best: Monster | undefined;
    let bestD = TARGET_RANGE;
    for (const m of this.monsters) {
      if (!m.alive || m.dormant) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.sprite.x, m.sprite.y) - m.radius;
      if (d < bestD) {
        best = m;
        bestD = d;
      }
    }
    return best;
  }

  private distTo(m: Monster) {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, m.sprite.x, m.sprite.y) - m.radius;
  }

  private ready(id: string, cd: number): boolean {
    const now = this.time.now;
    if ((this.cooldowns.get(id) ?? 0) > now) return false;
    this.cooldowns.set(id, now + cd);
    bus.emit('cooldown', id, now + cd, cd);
    return true;
  }

  private basicAttack() {
    const t = this.target;
    if (!t || this.distTo(t) > BASIC_ATTACK.range) {
      this.state.log(t ? '조금 더 가까이 다가가자.' : '주변에 공격할 대상이 없다.', '#d8c8a8');
      return;
    }
    if (!this.ready('basic', BASIC_ATTACK.cooldown)) return;
    const el = this.state.character.jobClass.element;
    this.faceTo(t.sprite.x, t.sprite.y);
    this.lunge(t);
    this.burst(t.sprite.x, t.sprite.y - 14, ELEMENT_NUM[el], 8);
    this.hitMonster(t, el, BASIC_ATTACK.power);
  }

  private castSkill(id: string) {
    const skill = SKILLS.find((s) => s.id === id);
    if (!skill) return;
    if ((this.cooldowns.get(id) ?? 0) > this.time.now) return;
    if (this.state.data.mp < skill.mp) {
      this.state.log(`마력이 모자란다 (${skill.name}: 마력 ${skill.mp})`, '#8ccaff');
      return;
    }
    if (skill.kind === 'attack') {
      const t = this.target;
      if (!t || this.distTo(t) > (skill.range ?? 100)) {
        this.state.log(t ? `${skill.name}: 대상이 너무 멀다.` : '주변에 공격할 대상이 없다.', '#d8c8a8');
        return;
      }
      if (!this.ready(id, skill.cooldown)) return;
      this.spendMp(skill.mp);
      this.faceTo(t.sprite.x, t.sprite.y);
      this.skillFx(skill, t);
      return;
    }
    if (!this.ready(id, skill.cooldown)) return;
    this.spendMp(skill.mp);
    if (skill.kind === 'buff') {
      this.addBuff({ id: 'rockShield', name: '바위 방패 (방어 +60%)', hanja: '土', color: ELEMENT_NUM['토'], until: this.time.now + (skill.duration ?? 8000), duration: skill.duration ?? 8000, defBonus: skill.defBonus });
      this.ringFx(ELEMENT_NUM['토']);
      this.state.log('바위 방패! 방어력이 오른다.', '#f0cf7a');
    } else if (skill.kind === 'heal') {
      const amount = Math.round(this.state.derived().maxHp * (skill.healRatio ?? 0.3) * (skill.element === this.state.character.jobClass.element ? JOB_SKILL_BONUS : 1));
      this.state.heal(amount);
      this.rise(this.player.x, this.player.y, ELEMENT_NUM['수']);
      this.floatText(this.player.x, this.player.y - 56, `+${amount}`, '#7ef07e', 18);
    }
  }

  private spendMp(n: number) {
    this.state.data.mp = Math.max(0, this.state.data.mp - n);
    this.state.emit('vitals');
  }

  private skillFx(skill: SkillDef, t: Monster) {
    const color = ELEMENT_NUM[skill.element];
    if (skill.projectile) {
      const ball = this.add.image(this.player.x, this.player.y - 24, 'fx_ball').setTint(0xff7a2a).setDepth(9200).setScale(0.9);
      const trail = this.add.particles(0, 0, 'fx_dot', {
        follow: ball,
        lifespan: 300,
        speed: { min: 5, max: 30 },
        scale: { start: 1.2, end: 0 },
        tint: [0xffd23f, 0xff7a2a, 0xe53935],
        frequency: 16,
        blendMode: 'ADD',
      }).setDepth(9199);
      const d = Phaser.Math.Distance.Between(ball.x, ball.y, t.sprite.x, t.sprite.y);
      this.tweens.add({
        targets: ball,
        x: t.sprite.x,
        y: t.sprite.y - 14,
        duration: Math.max(120, d * 2.2),
        onComplete: () => {
          ball.destroy();
          trail.stop();
          this.time.delayedCall(400, () => trail.destroy());
          this.burst(t.sprite.x, t.sprite.y - 14, 0xff7a2a, 22, 160);
          if (t.alive) this.hitMonster(t, skill.element, skill.power ?? 1);
        },
      });
      return;
    }
    if (skill.id === 'wood') {
      const line = this.add.graphics().setDepth(9200);
      line.lineStyle(5, 0x4caf50, 1).lineBetween(this.player.x, this.player.y - 20, t.sprite.x, t.sprite.y - 14);
      line.lineStyle(2, 0xb8f0a0, 1).lineBetween(this.player.x, this.player.y - 20, t.sprite.x, t.sprite.y - 14);
      this.tweens.add({ targets: line, alpha: 0, duration: 350, onComplete: () => line.destroy() });
      this.burst(t.sprite.x, t.sprite.y - 14, color, 14);
      this.hitMonster(t, skill.element, skill.power ?? 1);
      if (t.alive && skill.slow) {
        t.slowUntil = this.time.now + 3000;
        this.floatText(t.sprite.x, t.sprite.y - 60, '느려짐', '#8fe08f', 13);
      }
      return;
    }
    // 금강참
    const g = this.add.graphics().setDepth(9200);
    g.lineStyle(6, 0xffffff, 1);
    g.beginPath();
    g.arc(t.sprite.x, t.sprite.y - 14, 26, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
    this.lunge(t);
    this.burst(t.sprite.x, t.sprite.y - 14, 0xe8e8ff, 16, 140);
    this.hitMonster(t, skill.element, skill.power ?? 1);
  }

  private atkMultiplier() {
    return 1 + this.buffs.reduce((s, b) => s + (b.atkBonus ?? 0), 0);
  }

  private defMultiplier() {
    return 1 + this.buffs.reduce((s, b) => s + (b.defBonus ?? 0), 0);
  }

  /** 플레이어 → 몬스터 피해 */
  private hitMonster(m: Monster, element: Element, power: number) {
    if (!m.alive) return;
    const d = this.state.derived();
    const job = this.state.character.jobClass.element;
    let base = d.atk * power * this.atkMultiplier() * (element === job ? JOB_SKILL_BONUS : 1);
    base *= 0.9 + Math.random() * 0.2;
    const crit = Math.random() < d.critChance;
    if (crit) base *= d.critMult;
    const sp = m.ind.species;
    let dominant = m.ind.analysis.dominant;
    let note = '';
    let noteColor = '#ffffff';

    if (sp.isBoss) {
      if (element === '화') {
        m.gauge = Math.max(0, m.gauge - 38);
        note = '설기!';
        noteColor = '#ffb07a';
        if (!m.weakened && m.gauge <= 30) {
          m.weakened = true;
          this.state.log('신단수의 목 기운이 빠졌다! 지금 금 공격이 통한다!', '#ffd27f');
          this.cameras.main.flash(200, 255, 200, 120);
        }
      }
      if (element === '금') {
        if (!m.weakened) {
          base *= 0.3;
          note = '목견금결! 튕겨 나갔다';
          noteColor = '#d8d8d8';
        } else {
          base *= 1.5;
          note = '금극목!';
          noteColor = '#fff3a0';
        }
      }
      dominant = '목';
    } else if (sp.gimmick === 'bounceMetal' && element === '금' && m.ind.analysis.scores.목 >= 35 && !crit) {
      base *= 0.5;
      note = '튕겨 냈다 (반극)';
      noteColor = '#d8d8d8';
    } else if (sp.gimmick === 'bloomOnFire' && element === '화') {
      m.bloomUntil = this.time.now + 6000;
      m.sprite.setTint(0xffb0d0);
      note = '꽃이 피었다! (목화통명)';
      noteColor = '#ffb0d0';
    }

    const r = computeDamage(base, element, dominant, m.ind.analysis.yong);
    const dmg = r.damage;
    m.hp = Math.max(0, m.hp - dmg);
    this.hitFlash(m.sprite, m);
    if (!note) {
      if (r.relation.multiplier >= 1.25) {
        note = '상극!';
        noteColor = '#9ff09f';
      } else if (r.relation.multiplier <= 0.75) {
        note = '효과가 약하다';
        noteColor = '#c0c0c0';
      } else if (r.yongBonus) {
        note = '보완 오행이라 약해짐';
        noteColor = '#c0c0c0';
      }
    }
    this.floatText(m.sprite.x + Phaser.Math.Between(-8, 8), m.sprite.y - 40, `${crit ? '치명! ' : ''}${dmg}`, crit ? '#ffd23f' : '#ffffff', crit ? 24 : 18);
    if (note) this.floatText(m.sprite.x, m.sprite.y - 64, note, noteColor, 13, 900);
    if (crit || sp.isBoss) this.cameras.main.shake(90, 0.004);
    // 맞으면 살짝 밀려남
    if (!sp.isBoss) {
      const push = new Phaser.Math.Vector2(m.sprite.x - this.player.x, m.sprite.y - this.player.y).normalize().scale(8);
      this.tweens.add({ targets: m.sprite, x: m.sprite.x + push.x, y: m.sprite.y + push.y, duration: 80 });
    }
    if (m.hp <= 0) this.killMonster(m, true);
    this.emitTarget();
  }

  private hitFlash(s: Phaser.GameObjects.Sprite, m?: Monster) {
    s.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(90, () => {
      s.setTintMode(Phaser.TintModes.MULTIPLY);
      if (m && m.bloomUntil > this.time.now) s.setTint(0xffb0d0);
      else if (m?.dormant) s.setTint(0x8fa08a);
      else s.clearTint();
    });
  }

  private killMonster(m: Monster, byPlayer: boolean) {
    m.alive = false;
    m.sprite.body.enable = false;
    const sp = m.ind.species;
    this.tweens.add({ targets: [m.sprite, m.shadow, m.label, m.hpBg, m.hpFill], alpha: 0, duration: 450 });
    this.burst(m.sprite.x, m.sprite.y - 10, 0xffffff, 18, 120);
    if (this.target === m) this.setTarget(undefined);

    if (byPlayer) {
      const exp = Math.round(sp.exp * (1 + 0.2 * (m.ind.level - 1)));
      this.floatText(m.sprite.x, m.sprite.y - 70, `+${exp} 경험치`, '#b8a0ff', 14, 1100);
      this.state.log(`${sp.name}(${m.ind.pillars.day.name}일주)을 물리쳤다. 경험치 +${exp}`, '#e0d0ff');
      this.state.onKill(sp.id);
      this.state.gainExp(exp);
      this.dropLoot(m);
    }

    if (sp.isBoss) {
      this.state.data.flags.bossDefeated = true;
      this.bossDefeatedFx();
      this.autosave();
      return;
    }
    this.time.delayedCall(RESPAWN_MS, () => {
      m.sprite.destroy();
      m.shadow.destroy();
      m.label.destroy();
      m.hpBg.destroy();
      m.hpFill.destroy();
      this.spawnMonster(sp, m.home.x, m.home.y, m);
    });
  }

  private bossDefeatedFx() {
    this.cameras.main.flash(800, 220, 255, 200);
    bus.emit('banner', '천년 신단수의 균형을 되찾았다!', '#c8ffb8');
    this.state.log('신단수의 뒤엉킨 기운이 풀리며 본래의 수호목으로 돌아온다. 촌장님께 알리자.', '#ffd27f');
    this.time.delayedCall(1200, () => this.placeRestoredTree());
  }

  private dropLoot(m: Monster) {
    const sp = m.ind.species;
    const gold = Phaser.Math.Between(sp.gold[0], sp.gold[1]);
    const drops: Array<Omit<Loot, 'sprite' | 'readyAt'> & { frame: number }> = [{ gold, frame: 45 }];
    for (const d of sp.drops) {
      if (Math.random() < d.chance) {
        const def = itemDef(d.itemId);
        const pillar = def.grade !== 'common' && !def.fixedPillars && (def.type !== 'consumable' && def.type !== 'material') ? m.ind.pillars.day.name : undefined;
        drops.push({ itemId: d.itemId, pillar, frame: def.icon });
      }
    }
    drops.forEach((d, i) => {
      const angle = (i / drops.length) * Math.PI * 2 + Math.random();
      const tx = m.sprite.x + Math.cos(angle) * 26;
      const ty = m.sprite.y + Math.sin(angle) * 16;
      const img = this.add.image(m.sprite.x, m.sprite.y - 10, 'items', d.frame).setScale(1.8).setDepth(6);
      if (d.itemId && itemDef(d.itemId).grade !== 'common') {
        const glow = this.add.image(tx, ty, 'fx_ball').setTint(itemDef(d.itemId).grade === 'legendary' ? 0xffa640 : 0x7ee07e).setAlpha(0.5).setDepth(5.9);
        this.tweens.add({ targets: glow, scale: 1.4, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
        img.setData('glow', glow);
      }
      this.tweens.add({ targets: img, x: tx, y: ty, duration: 380, ease: 'Quad.out' });
      this.tweens.add({ targets: img, scale: 2, duration: 190, yoyo: true });
      this.loot.push({ sprite: img, gold: d.gold, itemId: d.itemId, pillar: d.pillar, readyAt: this.time.now + 450 });
    });
  }

  private pickupLoot() {
    const now = this.time.now;
    for (const l of [...this.loot]) {
      if (now < l.readyAt) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y - 10, l.sprite.x, l.sprite.y);
      if (d > 46) continue;
      if (l.gold) {
        this.state.addGold(l.gold);
        this.floatText(l.sprite.x, l.sprite.y - 20, `+${l.gold}전`, '#ffe066', 14, 800);
      } else if (l.itemId) {
        const left = this.state.addItem(l.itemId, 1, l.pillar);
        if (left > 0) {
          if (!l.sprite.getData('warned')) this.state.log('가방이 가득 찼다! 물건을 팔거나 버리자.', '#ff9a8a');
          l.sprite.setData('warned', true);
          continue;
        }
        const def = itemDef(l.itemId);
        this.state.log(`${l.pillar ? `${l.pillar} ` : ''}${def.name}을(를) 얻었다`, def.grade === 'common' ? '#f4ecd8' : '#7ee07e');
        this.floatText(l.sprite.x, l.sprite.y - 20, def.name, '#fff3d6', 13, 800);
      }
      (l.sprite.getData('glow') as Phaser.GameObjects.Image | undefined)?.destroy();
      this.tweens.add({ targets: l.sprite, y: l.sprite.y - 24, alpha: 0, duration: 250, onComplete: () => l.sprite.destroy() });
      this.loot = this.loot.filter((x) => x !== l);
    }
  }

  /** 몬스터 → 플레이어 피해 */
  private hurtPlayer(m: Monster) {
    const d = this.state.derived();
    const atk = m.ind.atk * (m.bloomUntil > this.time.now ? 1.35 : 1);
    const r = computeDamage(atk, m.ind.analysis.dominant, this.state.character.analysis.dominant, this.state.character.analysis.yong);
    const mitigated = Math.max(1, Math.round((r.damage * 60) / (60 + d.def * this.defMultiplier())));
    this.state.data.hp = Math.max(0, this.state.data.hp - mitigated);
    this.state.emit('vitals');
    this.lastHurtAt = this.time.now;
    this.hitFlash(this.player);
    this.floatText(this.player.x, this.player.y - 56, `-${mitigated}`, '#ff6a5a', 17);
    if (m.ind.species.isBoss) this.cameras.main.shake(140, 0.006);
    if (this.state.data.hp <= 0) this.die();
  }

  private die() {
    if (this.dead) return;
    this.dead = true;
    this.player.body.setVelocity(0, 0);
    this.player.anims.stop();
    this.player.setAngle(90);
    const lost = this.state.applyDeathPenalty();
    this.state.log(`쓰러졌다... 돈 ${lost}전을 잃었다.`, '#ff9a8a');
    bus.emit('death', lost);
  }

  private revive() {
    this.dead = false;
    this.player.setAngle(0);
    this.player.setPosition((PLAYER_SPAWN.col + 0.5) * CELL, (PLAYER_SPAWN.row + 0.5) * CELL);
    this.cameras.main.fadeIn(500);
    this.state.emit('vitals');
    this.state.log('새싹마을 어귀에서 정신을 차렸다.', '#f4ecd8');
  }

  private addBuff(b: Buff) {
    this.buffs = this.buffs.filter((x) => x.id !== b.id);
    this.buffs.push(b);
    this.emitBuffs();
  }

  private emitBuffs() {
    bus.emit('buffs', this.buffs.map((b) => ({ id: b.id, name: b.name, hanja: b.hanja, color: b.color, until: b.until, duration: b.duration })));
  }

  private setTarget(m: Monster | undefined) {
    if (this.target === m) return;
    this.target = m;
    this.emitTarget();
  }

  private emitTarget() {
    const m = this.target;
    if (!m || !m.alive) {
      bus.emit('target', null);
      return;
    }
    const sp = m.ind.species;
    const info: TargetInfo = {
      name: sp.name,
      level: m.ind.level,
      dayPillar: m.ind.pillars.day.name,
      element: m.ind.analysis.dominant,
      yong: m.ind.analysis.yong,
      hp: m.hp,
      maxHp: m.ind.maxHp,
      isBoss: !!sp.isBoss,
      note: sp.gimmickText,
      gauge: sp.isBoss ? m.gauge : undefined,
      weakened: m.weakened,
    };
    bus.emit('target', info);
  }

  // ---------------- 연출 ----------------
  floatText(x: number, y: number, s: string, color: string, size = 16, duration = 700) {
    const t = this.add
      .text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#1d1409', strokeThickness: 4, resolution: 2 })
      .setOrigin(0.5)
      .setDepth(9800);
    this.tweens.add({ targets: t, y: y - 34, alpha: { from: 1, to: 0 }, duration, ease: 'Quad.out', onComplete: () => t.destroy() });
  }

  private burst(x: number, y: number, color: number, n = 12, speed = 110) {
    const e = this.add.particles(x, y, 'fx_dot', {
      speed: { min: speed * 0.3, max: speed },
      lifespan: 420,
      scale: { start: 1, end: 0 },
      tint: color,
      emitting: false,
      blendMode: 'ADD',
    }).setDepth(9300);
    e.explode(n);
    this.time.delayedCall(600, () => e.destroy());
  }

  private rise(x: number, y: number, color: number) {
    const e = this.add.particles(x, y, 'fx_dot', {
      x: { min: -18, max: 18 },
      speedY: { min: -90, max: -40 },
      lifespan: 700,
      scale: { start: 1.1, end: 0 },
      tint: [color, 0xffffff],
      emitting: false,
      blendMode: 'ADD',
    }).setDepth(9300);
    e.explode(26);
    this.time.delayedCall(900, () => e.destroy());
  }

  private ringFx(color: number) {
    const ring = this.add.circle(this.player.x, this.player.y - 16, 30).setStrokeStyle(4, color).setDepth(9300);
    this.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
  }

  private lunge(t: Monster) {
    const v = new Phaser.Math.Vector2(t.sprite.x - this.player.x, t.sprite.y - this.player.y).normalize().scale(6);
    this.tweens.add({ targets: this.player, x: this.player.x + v.x, y: this.player.y + v.y, duration: 60, yoyo: true });
  }

  private levelUpFx() {
    const beam = this.add.rectangle(this.player.x, this.player.y, 44, 200, 0xfff3a0, 0.6).setOrigin(0.5, 1).setDepth(9400).setBlendMode('ADD');
    this.tweens.add({ targets: beam, alpha: 0, scaleX: 0.2, duration: 900, onComplete: () => beam.destroy() });
    this.rise(this.player.x, this.player.y, 0xffe066);
    this.floatText(this.player.x, this.player.y - 80, 'LEVEL UP!', '#ffe066', 26, 1400);
    bus.emit('banner', `레벨 업! Lv${this.state.data.level}`, '#ffe066');
  }

  private faceTo(x: number, y: number) {
    this.facing.set(x - this.player.x, y - this.player.y).normalize();
    this.applyFacingFrame(false);
  }

  private applyFacingFrame(moving: boolean) {
    const f = this.facing;
    let dir: 'down' | 'up' | 'side';
    if (Math.abs(f.x) > Math.abs(f.y)) dir = 'side';
    else dir = f.y < 0 ? 'up' : 'down';
    this.player.setFlipX(dir === 'side' && f.x > 0);
    if (moving) {
      const key = `hero-walk-${dir}`;
      if (this.player.anims.currentAnim?.key !== key || !this.player.anims.isPlaying) this.player.play(key, true);
    } else {
      this.player.anims.stop();
      this.player.setFrame(dir === 'down' ? 0 : dir === 'up' ? 8 : 16);
    }
  }

  // ---------------- 저장 ----------------
  autosave(announce = false) {
    this.state.data.pos = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
    const ok = saveGame(this.state);
    if (announce) this.state.log(ok ? '저장했다.' : '저장하지 못했다 (브라우저 저장소 확인).', ok ? '#9fe0a0' : '#ff9a8a');
  }

  // ---------------- 매 프레임 ----------------
  private tickSecond() {
    if (this.dead) return;
    this.state.data.playMs += 1000;
    const d = this.state.derived();
    const calm = this.time.now - this.lastHurtAt > 4000;
    const hpGain = d.hpRegen * (calm ? 0.8 : 0.15);
    const mpGain = d.mpRegen * 0.6;
    const before = [this.state.data.hp, this.state.data.mp];
    this.state.data.hp = Math.min(d.maxHp, this.state.data.hp + hpGain);
    this.state.data.mp = Math.min(d.maxMp, this.state.data.mp + mpGain);
    if (before[0] !== this.state.data.hp || before[1] !== this.state.data.mp) this.state.emit('vitals');

    const now = this.time.now;
    const expired = this.buffs.filter((b) => b.until <= now);
    if (expired.length) {
      this.buffs = this.buffs.filter((b) => b.until > now);
      this.emitBuffs();
    }
    // 보스 목 기운은 천천히 다시 찬다
    for (const m of this.monsters) {
      if (m.alive && m.ind.species.isBoss && !m.dormant && m.gauge < BOSS_GAUGE_MAX) {
        m.gauge = Math.min(BOSS_GAUGE_MAX, m.gauge + 4);
        if (m.weakened && m.gauge > 60) {
          m.weakened = false;
          this.state.log('신단수의 목 기운이 다시 차올랐다. 다시 화로 설기하자!', '#ffb07a');
        }
        if (this.target === m) this.emitTarget();
      }
    }
  }

  update(_t: number, _dt: number) {
    if (!this.player?.body) return;
    const now = this.time.now;

    // 이동
    if (!this.dead) {
      const v = new Phaser.Math.Vector2(0, 0);
      if (!this.modal) {
        if (this.cursors.left?.isDown || this.wasd.A.isDown) v.x -= 1;
        if (this.cursors.right?.isDown || this.wasd.D.isDown) v.x += 1;
        if (this.cursors.up?.isDown || this.wasd.W.isDown) v.y -= 1;
        if (this.cursors.down?.isDown || this.wasd.S.isDown) v.y += 1;
        if (v.lengthSq() === 0 && this.joy.lengthSq() > 0.02) v.copy(this.joy);
      }
      const moving = v.lengthSq() > 0.01;
      if (moving) {
        const mag = Math.min(1, v.length());
        v.normalize();
        this.facing.copy(v);
        const speed = this.state.derived().moveSpeed * mag;
        this.player.body.setVelocity(v.x * speed, v.y * speed);
      } else {
        this.player.body.setVelocity(0, 0);
      }
      this.applyFacingFrame(moving);
    }
    this.player.setDepth(10 + this.player.y / 10);
    this.playerShadow.setPosition(this.player.x, this.player.y + 2);
    this.playerLabel.setPosition(this.player.x, this.player.y - 44);

    // 지역
    const row = Math.floor(this.player.y / CELL);
    const region = regionAt(row).name;
    if (region !== this.regionName) {
      this.regionName = region;
      bus.emit('region', region);
    }

    // 상호작용 대상
    let nearNpc: Npc | undefined;
    let best = INTERACT_RANGE;
    for (const n of this.npcs) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, n.sprite.x, n.sprite.y);
      if (d < best) {
        best = d;
        nearNpc = n;
      }
    }
    const boss = this.monsters.find((m) => m.ind.species.isBoss && m.alive);
    const nearBoss = !!boss && boss.dormant && Phaser.Math.Distance.Between(this.player.x, this.player.y, boss.sprite.x, boss.sprite.y) < 110;
    if (nearNpc !== this.interactNpc || nearBoss !== this.interactBoss) {
      this.interactNpc = nearNpc;
      this.interactBoss = nearBoss;
      bus.emit('interact', nearNpc ? NPC_DISPLAY[nearNpc.spot.id] : nearBoss ? '신단수' : null);
    }

    // 마을 아이 산책
    for (const n of this.npcs) {
      if (!n.spot.wander) continue;
      if (!n.wanderTarget || Phaser.Math.Distance.Between(n.sprite.x, n.sprite.y, n.wanderTarget.x, n.wanderTarget.y) < 4) {
        n.wanderTarget = new Phaser.Math.Vector2((Phaser.Math.Between(10, 20) + 0.5) * CELL, (Phaser.Math.Between(10, 12) + 0.5) * CELL);
      }
      const dir = new Phaser.Math.Vector2(n.wanderTarget.x - n.sprite.x, n.wanderTarget.y - n.sprite.y).normalize().scale(0.5);
      n.sprite.x += dir.x;
      n.sprite.y += dir.y;
      n.sprite.setFlipX(dir.x < 0);
      n.label.setPosition(n.sprite.x, n.sprite.y - 38);
      n.marker.setPosition(n.sprite.x, n.marker.y);
      n.body.setPosition(n.sprite.x, n.sprite.y + 6);
      (n.body.body as Body).reset(n.sprite.x, n.sprite.y + 6);
    }

    // 대상 자동 선택
    const t = this.pickTarget();
    if (t !== this.target) this.setTarget(t);
    if (this.target && this.target.alive) {
      this.targetRing.setVisible(true).setPosition(this.target.sprite.x, this.target.sprite.y + 4);
      this.targetRing.setScale(this.target.ind.species.isBoss ? 2.6 : 1);
    } else {
      this.targetRing.setVisible(false);
    }

    this.updateMonsters(now);
    this.pickupLoot();
  }

  private updateMonsters(now: number) {
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const sp = m.ind.species;
      const s = m.sprite;
      s.setDepth(10 + s.y / 10);
      m.shadow.setPosition(s.x, s.y + 2);
      const top = s.y - s.displayHeight * 0.75;
      m.label.setPosition(s.x, top - 10);
      m.hpBg.setPosition(s.x, top - 4);
      m.hpFill.setPosition(s.x - m.hpBg.width / 2 + 1, top - 4);
      m.hpFill.width = (m.hpBg.width - 2) * (m.hp / m.ind.maxHp);
      if (m.bloomUntil && m.bloomUntil < now) {
        m.bloomUntil = 0;
        s.clearTint();
      }
      if (this.dead || this.modal) {
        s.body.setVelocity(0, 0);
        continue;
      }
      const toPlayer = Phaser.Math.Distance.Between(s.x, s.y, this.player.x, this.player.y);

      if (sp.isBoss) {
        if (m.dormant) continue;
        if (toPlayer < 150 && now - m.lastAttack > 1700) {
          m.lastAttack = now;
          this.bossSlam(m);
        }
        continue;
      }

      // 이끼 두꺼비: 주변 목 몬스터 회복 (수생목)
      if (sp.gimmick === 'healWood' && now - m.lastHealAt > 4000) {
        m.lastHealAt = now;
        for (const o of this.monsters) {
          if (o === m || !o.alive || !WOOD_SPECIES.has(o.ind.species.id) || o.hp >= o.ind.maxHp) continue;
          if (Phaser.Math.Distance.Between(s.x, s.y, o.sprite.x, o.sprite.y) > 160) continue;
          const heal = Math.round(o.ind.maxHp * 0.12);
          o.hp = Math.min(o.ind.maxHp, o.hp + heal);
          this.floatText(o.sprite.x, o.sprite.y - 50, `+${heal} 수생목`, '#8ccaff', 13);
          this.burst(o.sprite.x, o.sprite.y - 10, 0x42a5f5, 8, 60);
        }
      }

      const speedMul = m.slowUntil > now ? 0.45 : 1;
      let chase: { x: number; y: number } | null = null;
      let prey: Monster | undefined;

      // 쇠부리 딱따구리: 목 몬스터를 먼저 쫀다 (금극목)
      if (sp.gimmick === 'huntWood') {
        let bestD = 150;
        for (const o of this.monsters) {
          if (!o.alive || !WOOD_SPECIES.has(o.ind.species.id)) continue;
          const d = Phaser.Math.Distance.Between(s.x, s.y, o.sprite.x, o.sprite.y);
          if (d < bestD) {
            bestD = d;
            prey = o;
          }
        }
      }

      const leash = Phaser.Math.Distance.Between(s.x, s.y, m.home.x, m.home.y) > 340;
      if (leash) {
        chase = m.home;
        m.hp = Math.min(m.ind.maxHp, m.hp + m.ind.maxHp * 0.01);
      } else if (prey) {
        chase = prey.sprite;
        if (Phaser.Math.Distance.Between(s.x, s.y, prey.sprite.x, prey.sprite.y) < m.radius + prey.radius + 14 && now - m.lastAttack > 1300) {
          m.lastAttack = now;
          const dmg = Math.round(m.ind.atk * 1.3);
          prey.hp = Math.max(0, prey.hp - dmg);
          this.floatText(prey.sprite.x, prey.sprite.y - 44, `-${dmg} 금극목`, '#e0e0e0', 13);
          this.hitFlash(prey.sprite, prey);
          if (prey.hp <= 0) this.killMonster(prey, false);
        }
      } else if (toPlayer < sp.aggro || m.hp < m.ind.maxHp) {
        if (toPlayer < 420) chase = this.player;
      }

      if (chase) {
        const reach = m.radius + 16;
        const d = Phaser.Math.Distance.Between(s.x, s.y, chase.x, chase.y);
        if (chase === this.player && d < reach + 10) {
          s.body.setVelocity(0, 0);
          if (now - m.lastAttack > 1300) {
            m.lastAttack = now;
            this.tweens.add({ targets: s, y: s.y - 6, duration: 90, yoyo: true });
            this.hurtPlayer(m);
          }
        } else {
          const v = new Phaser.Math.Vector2(chase.x - s.x, chase.y - s.y).normalize().scale(sp.speed * speedMul * (leash ? 1.5 : 1));
          s.body.setVelocity(v.x, v.y);
          s.setFlipX(v.x > 0 !== (sp.sprite.key === 'dungeon'));
        }
      } else {
        if (now > m.nextThink) {
          m.nextThink = now + 1500 + Math.random() * 2000;
          if (Math.random() < 0.4) m.wander.set(0, 0);
          else {
            const a = Math.random() * Math.PI * 2;
            m.wander.set(Math.cos(a), Math.sin(a));
          }
        }
        s.body.setVelocity(m.wander.x * sp.speed * 0.4, m.wander.y * sp.speed * 0.4);
      }
    }
  }

  private bossSlam(m: Monster) {
    const s = m.sprite;
    const warn = this.add.circle(this.player.x, this.player.y, 44, 0xff3b2a, 0.25).setStrokeStyle(3, 0xff3b2a).setDepth(3);
    const px = this.player.x;
    const py = this.player.y;
    this.tweens.add({ targets: s, scaleY: s.scaleY * 1.06, duration: 250, yoyo: true });
    this.time.delayedCall(550, () => {
      warn.destroy();
      if (!m.alive || this.dead) return;
      this.burst(px, py, 0x6b8f3a, 20, 150);
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, px, py) < 50) this.hurtPlayer(m);
      else this.floatText(this.player.x, this.player.y - 50, '피했다!', '#ffffff', 14);
    });
  }

  /** 미니맵용 점 */
  getDots() {
    return {
      player: { x: this.player.x, y: this.player.y },
      npcs: this.npcs.map((n) => ({ x: n.sprite.x, y: n.sprite.y, quest: n.marker.text })),
      monsters: this.monsters.filter((m) => m.alive).map((m) => ({ x: m.sprite.x, y: m.sprite.y, boss: !!m.ind.species.isBoss })),
    };
  }
}

export const NPC_DISPLAY: Record<string, string> = {
  chief: '촌장',
  grocer: '복순 할멈',
  smith: '대장장이 쇠돌',
  tailor: '비단 아씨',
  guard: '수문장',
  cheongsol: '청솔',
  kid: '돌이',
};
