import Phaser from 'phaser';
import type { Character } from '../game/character';
import {
  WILD_BOAR,
  WILD_BOAR_PILLARS,
  SINDANSU,
  SINDANSU_PILLARS,
  monsterAnalysis,
  type MonsterDef,
} from '../data/monsters';
import { computeDamage } from '../game/battle';
import { ELEMENT_HEX } from '../game/ui';
import type { Element } from '../saju/ganji';
import { ELEMENTS } from '../saju/analyze';
import type { FourPillars } from '../saju/pillar';

const WORLD_W = 440;
const WORLD_H = 1500;
const PLAYER_SPEED = 150;
const MONSTER_SPEED = 60;
const PLAYER_ATTACK_RANGE = 110;
const MONSTER_ATTACK_RANGE = 32;
const ATTACK_COOLDOWN_MS = 480;
const MONSTER_ATTACK_COOLDOWN_MS = 1400;
const AGGRO_RANGE = 150;

type ArcadeCircle = Phaser.GameObjects.Arc & { body: Phaser.Physics.Arcade.Body };

interface MonsterActor {
  def: MonsterDef;
  sprite: ArcadeCircle;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBar: Phaser.GameObjects.Rectangle;
  dominant: Element;
  yong: Element;
  atk: number;
  hp: number;
  maxHp: number;
  lastAttackAt: number;
  nextWanderAt: number;
  wanderDir: Phaser.Math.Vector2;
  alive: boolean;
  fireHits: number;
  weakened: boolean;
}

/** 마을+들판+보스숲을 한 맵으로 잇는 실시간 액션 씬. 이동은 방향키/WASD/화면 패드, 공격은 오행 버튼/숫자키. */
export class WorldScene extends Phaser.Scene {
  private character!: Character;
  private player!: ArcadeCircle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private touchDir = new Phaser.Math.Vector2(0, 0);
  private monsters: MonsterActor[] = [];
  private boarDefeatedCount = 0;
  private bossUnlocked = false;
  private gate?: Phaser.GameObjects.Container;
  private toastText!: Phaser.GameObjects.Text;
  private selectedElement: Element = '목';
  private elementButtons = new Map<Element, Phaser.GameObjects.Container>();
  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private playerHpText!: Phaser.GameObjects.Text;
  private lastAttackAt = 0;
  private spawnPoint = new Phaser.Math.Vector2(WORLD_W / 2, 130);
  private victoryShown = false;

  constructor() {
    super('World');
  }

  create() {
    this.character = this.registry.get('character') as Character;
    this.character.hp = this.character.hp || this.character.maxHp;
    this.boarDefeatedCount = Number(this.registry.get('boarDefeatedCount') ?? 0);
    this.bossUnlocked = this.boarDefeatedCount >= 1;
    this.selectedElement = this.character.jobClass.element;
    this.victoryShown = false;
    this.monsters = [];

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    this.buildWorld();
    this.buildPlayer();
    this.buildMonsters();
    this.buildHud();
    this.buildControls();

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
  }

  private buildWorld() {
    this.add.rectangle(WORLD_W / 2, 100, WORLD_W, 200, 0x2e5d33).setDepth(-10);
    this.add.rectangle(WORLD_W / 2, 700, WORLD_W, 1000, 0x1f3d22).setDepth(-10);
    this.add.rectangle(WORLD_W / 2, 1300, WORLD_W, 400, 0x142a17).setDepth(-10);
    this.add.text(WORLD_W / 2, 40, '동방 청림 · 새싹마을', { fontSize: '17px', color: '#f5deb3' }).setOrigin(0.5).setDepth(-5);
    this.add.text(WORLD_W / 2, 230, '들판 (가시멧돼지 출몰)', { fontSize: '12px', color: '#9bd39b' }).setOrigin(0.5).setDepth(-5);
    this.add.text(WORLD_W / 2, 1120, '신단수 숲', { fontSize: '12px', color: '#e0a0a0' }).setOrigin(0.5).setDepth(-5);

    // 촌장 NPC
    const chief = this.add.circle(WORLD_W / 2, 100, 15, 0xf5deb3).setDepth(1);
    this.physics.add.existing(chief, true);
    this.add.text(WORLD_W / 2, 74, '촌장', { fontSize: '11px', color: '#f5deb3' }).setOrigin(0.5).setDepth(1);

    // 보스 구역 입구 문 (가시멧돼지를 한 마리 이상 잡기 전까지 막힘)
    const gateBar = this.add.rectangle(WORLD_W / 2, 1150, WORLD_W - 40, 14, 0x8a3b3b).setDepth(2);
    const gateLabel = this.add
      .text(WORLD_W / 2, 1150, this.bossUnlocked ? '' : '봉인됨 — 가시멧돼지를 물리치면 열린다', {
        fontSize: '11px',
        color: '#ffdddd',
      })
      .setOrigin(0.5)
      .setDepth(2);
    this.physics.add.existing(gateBar, true);
    this.gate = this.add.container(0, 0, [gateBar, gateLabel]);
    if (this.bossUnlocked) {
      gateBar.setVisible(false);
      (gateBar.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    }
    (this.gate as Phaser.GameObjects.Container & { bar?: Phaser.GameObjects.Rectangle; label?: Phaser.GameObjects.Text }).bar = gateBar;
    (this.gate as Phaser.GameObjects.Container & { bar?: Phaser.GameObjects.Rectangle; label?: Phaser.GameObjects.Text }).label = gateLabel;
  }

  private buildPlayer() {
    const jobColor = ELEMENT_HEX[this.character.jobClass.element];
    const player = this.add.circle(this.spawnPoint.x, this.spawnPoint.y, 14, jobColor) as ArcadeCircle;
    this.physics.add.existing(player);
    player.body.setCollideWorldBounds(true);
    player.body.setCircle(14);
    this.player = player;
    this.add
      .text(0, -26, this.character.jobClass.name, { fontSize: '10px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(3)
      .setName('playerLabel');
    // 라벨을 플레이어를 따라다니게
    const label = this.children.getByName('playerLabel') as Phaser.GameObjects.Text;
    this.events.on('update', () => {
      label.setPosition(this.player.x, this.player.y - 26);
    });

    if (this.gate) {
      const bar = (this.gate as unknown as { bar: Phaser.GameObjects.Rectangle }).bar;
      this.physics.add.collider(player, bar);
    }
  }

  private spawnMonster(def: MonsterDef, pillars: FourPillars, x: number, y: number, isBoss: boolean): MonsterActor {
    const { analysis, stats } = monsterAnalysis(pillars);
    const maxHp = Math.round((isBoss ? 260 : 60) + stats.방어 * (isBoss ? 1.6 : 0.7));
    const radius = isBoss ? 30 : 15;
    const color = isBoss ? 0x8a3b3b : 0x6a4a2a;
    const sprite = this.add.circle(x, y, radius, color) as ArcadeCircle;
    this.physics.add.existing(sprite);
    sprite.body.setCircle(radius);
    sprite.body.setCollideWorldBounds(true);
    // 플레이어가 밀어붙여 통과하지 못하게: 몬스터는 부딪혀도 밀리지 않는다(자기 AI로만 움직임).
    sprite.body.setImmovable(true);

    const nameText = this.add.text(x, y - radius - 26, def.name, { fontSize: '11px', color: '#ffffff' }).setOrigin(0.5).setDepth(3);
    const hpBarBg = this.add.rectangle(x, y - radius - 14, 44, 6, 0x333333).setDepth(3);
    const hpBar = this.add.rectangle(x - 22, y - radius - 14, 44, 6, 0xcc4444).setOrigin(0, 0.5).setDepth(3);

    const actor: MonsterActor = {
      def,
      sprite,
      hpBarBg,
      hpBar,
      dominant: analysis.dominant,
      yong: analysis.yong,
      atk: stats.공격 * (isBoss ? 0.55 : 0.4),
      hp: maxHp,
      maxHp,
      lastAttackAt: 0,
      nextWanderAt: 0,
      wanderDir: new Phaser.Math.Vector2(0, 0),
      alive: true,
      fireHits: 0,
      weakened: false,
    };
    (sprite as unknown as { __label: Phaser.GameObjects.Text }).__label = nameText;
    this.monsters.push(actor);
    // 플레이어가 몬스터를 뚫고 지나가지 않도록 물리 충돌을 건다 (공격 사거리 안에 붙어있게).
    this.physics.add.collider(this.player, sprite);
    return actor;
  }

  private buildMonsters() {
    const boarSpots: Array<[number, number]> = [
      [110, 420],
      [330, 560],
      [180, 780],
    ];
    for (const [x, y] of boarSpots) {
      this.spawnMonster(WILD_BOAR, WILD_BOAR_PILLARS, x, y, false);
    }
    const bossY = 1300;
    this.spawnMonster(SINDANSU, SINDANSU_PILLARS, WORLD_W / 2, bossY, true);
    // 보스 뒤에 벽을 둬서 좌우로 스쳐 지나가지 않고 사거리 안에서 멈추게 한다.
    const backWall = this.add.rectangle(WORLD_W / 2, bossY + 55, WORLD_W, 20, 0x000000, 0);
    this.physics.add.existing(backWall, true);
    this.physics.add.collider(this.player, backWall);
  }

  private buildHud() {
    const { width } = this.scale;
    this.add.rectangle(width / 2, 26, width, 52, 0x000000, 0.35).setScrollFactor(0).setDepth(20);
    this.add
      .text(10, 8, `${this.character.jobClass.name}`, { fontSize: '13px', color: '#f5deb3' })
      .setScrollFactor(0)
      .setDepth(21);
    this.add.rectangle(10, 30, width - 80, 12, 0x333333).setOrigin(0, 0.5).setScrollFactor(0).setDepth(21);
    this.playerHpBar = this.add
      .rectangle(10, 30, width - 80, 12, 0x44aa66)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(21);
    this.playerHpText = this.add
      .text(width - 10, 24, `${this.character.hp}/${this.character.maxHp}`, { fontSize: '11px', color: '#dddddd' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(21);

    this.toastText = this.add
      .text(width / 2, 70, '방향키/WASD로 이동, 오행 버튼으로 공격', {
        fontSize: '13px',
        color: '#ffffff',
        wordWrap: { width: width * 0.85 },
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(21);
  }

  private showToast(msg: string) {
    this.toastText.setText(msg);
  }

  private buildControls() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as unknown as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;

    const keyNames: Record<Element, string> = { 목: 'ONE', 화: 'TWO', 토: 'THREE', 금: 'FOUR', 수: 'FIVE' };
    ELEMENTS.forEach((e) => {
      this.input.keyboard!.on(`keydown-${keyNames[e]}`, () => this.selectElement(e));
    });
    this.input.keyboard!.on('keydown-SPACE', () => this.tryAttack());

    const { width, height } = this.scale;

    // 오행 공격 버튼 (오른쪽 아래)
    const btnSize = 46;
    const positions: Array<[Element, number, number]> = [
      ['목', width - 120, height - 150],
      ['화', width - 60, height - 190],
      ['토', width - 60, height - 110],
      ['금', width - 20, height - 150],
      ['수', width - 90, height - 60],
    ];
    positions.forEach(([e, x, y]) => {
      const circle = this.add
        .circle(x, y, btnSize / 2, ELEMENT_HEX[e])
        .setStrokeStyle(2, 0xffffff)
        .setScrollFactor(0)
        .setDepth(22)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(x, y, e, { fontSize: '16px', color: '#111111' }).setOrigin(0.5).setScrollFactor(0).setDepth(23);
      circle.on('pointerdown', () => {
        this.selectElement(e);
        this.tryAttack();
      });
      const container = this.add.container(0, 0, [circle, label]);
      this.elementButtons.set(e, container);
    });
    this.refreshElementButtonHighlight();

    // 이동 D패드 (왼쪽 아래)
    const padCx = 70;
    const padCy = height - 110;
    const dirs: Array<[string, number, number, () => void]> = [
      ['↑', 0, -46, () => this.touchDir.set(0, -1)],
      ['↓', 0, 46, () => this.touchDir.set(0, 1)],
      ['←', -46, 0, () => this.touchDir.set(-1, 0)],
      ['→', 46, 0, () => this.touchDir.set(1, 0)],
    ];
    dirs.forEach(([label, dx, dy, onDown]) => {
      const btn = this.add
        .rectangle(padCx + dx, padCy + dy, 40, 40, 0x33334d, 0.85)
        .setStrokeStyle(2, 0xf5deb3)
        .setScrollFactor(0)
        .setDepth(22)
        .setInteractive({ useHandCursor: true });
      this.add.text(padCx + dx, padCy + dy, label, { fontSize: '18px', color: '#f5deb3' }).setOrigin(0.5).setScrollFactor(0).setDepth(23);
      btn.on('pointerdown', onDown);
      btn.on('pointerup', () => this.touchDir.set(0, 0));
      btn.on('pointerout', () => this.touchDir.set(0, 0));
    });
  }

  private selectElement(e: Element) {
    this.selectedElement = e;
    this.refreshElementButtonHighlight();
  }

  private refreshElementButtonHighlight() {
    this.elementButtons.forEach((container, e) => {
      const circle = container.list[0] as Phaser.GameObjects.Arc;
      circle.setStrokeStyle(e === this.selectedElement ? 4 : 2, e === this.selectedElement ? 0xffff00 : 0xffffff);
    });
  }

  private nearestMonsterInRange(): MonsterActor | undefined {
    let best: MonsterActor | undefined;
    let bestDist = Infinity;
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.sprite.x, m.sprite.y);
      if (d <= PLAYER_ATTACK_RANGE && d < bestDist) {
        best = m;
        bestDist = d;
      }
    }
    return best;
  }

  private tryAttack() {
    const now = this.time.now;
    if (now - this.lastAttackAt < ATTACK_COOLDOWN_MS) return;
    const target = this.nearestMonsterInRange();
    if (!target) {
      this.showToast('공격 범위 안에 몬스터가 없다. 가까이 다가가자.');
      return;
    }
    this.lastAttackAt = now;

    const jobElement = this.character.jobClass.element;
    const base = this.character.stats.공격 * (this.selectedElement === jobElement ? 1.15 : 1.0) * 0.35;

    let effectiveDominant = target.dominant;
    if (target.def.id === 'sindansu' && !target.weakened) {
      if (this.selectedElement === '금') {
        const dmg = Math.max(1, Math.round(base * 0.6));
        this.applyDamageToMonster(target, dmg);
        this.showToast(`금 공격이 신단수의 굳센 목 기운에 튕겨 나갔다! (${dmg}, 목견금결)`);
        this.flash(target.sprite, 0xffffff);
        return;
      }
      if (this.selectedElement === '화') {
        target.fireHits += 1;
        if (target.fireHits >= 2) {
          target.weakened = true;
          this.showToast('신단수의 목 기운이 빠지며 약해졌다! 이제 금 공격이 통한다.');
        }
      }
    }
    if (target.def.id === 'sindansu' && target.weakened) {
      effectiveDominant = '목';
    }

    const result = computeDamage(base, this.selectedElement, effectiveDominant, target.yong);
    this.applyDamageToMonster(target, result.damage);
    this.flash(target.sprite, 0xffffff);
    if (target.hp > 0) {
      this.showToast(`${this.selectedElement} 공격! ${result.damage} 피해 (${result.relation.message}${result.yongBonus ? ', 보완 오행이라 약해짐' : ''})`);
    }
  }

  private applyDamageToMonster(m: MonsterActor, dmg: number) {
    m.hp = Math.max(0, m.hp - dmg);
    m.hpBar.width = 44 * (m.hp / m.maxHp);
    if (m.hp <= 0 && m.alive) {
      this.killMonster(m);
    }
  }

  private killMonster(m: MonsterActor) {
    m.alive = false;
    this.showToast(m.def.victoryText);
    const label = (m.sprite as unknown as { __label: Phaser.GameObjects.Text }).__label;
    this.tweens.add({
      targets: [m.sprite, m.hpBar, m.hpBarBg, label],
      alpha: 0,
      duration: 400,
      onComplete: () => {
        m.sprite.destroy();
        m.hpBar.destroy();
        m.hpBarBg.destroy();
        label.destroy();
      },
    });
    if (!m.def.isBoss) {
      this.boarDefeatedCount += 1;
      this.registry.set('boarDefeatedCount', this.boarDefeatedCount);
      if (!this.bossUnlocked) {
        this.bossUnlocked = true;
        this.openGate();
      }
    } else {
      this.showVictory();
    }
  }

  private openGate() {
    if (!this.gate) return;
    const bar = (this.gate as unknown as { bar: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }).bar;
    const label = (this.gate as unknown as { bar: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }).label;
    this.showToast('신단수 숲으로 가는 길이 열렸다!');
    this.tweens.add({
      targets: [bar, label],
      alpha: 0,
      duration: 500,
      onComplete: () => {
        (bar.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        bar.setVisible(false);
        label.setVisible(false);
      },
    });
  }

  private showVictory() {
    if (this.victoryShown) return;
    this.victoryShown = true;
    const { width, height } = this.scale;
    const box = this.add.rectangle(width / 2, height / 2, width * 0.85, 160, 0x000000, 0.85).setScrollFactor(0).setDepth(30);
    const text = this.add
      .text(width / 2, height / 2 - 20, '신단수의 뒤엉킨 기운이 풀리며\n본래의 수호목으로 돌아온다.\n동방에 봄바람이 다시 분다.', {
        fontSize: '14px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(31);
    const btn = this.add
      .rectangle(width / 2, height / 2 + 55, width * 0.5, 44, 0x2e5d33)
      .setStrokeStyle(2, 0xf5deb3)
      .setScrollFactor(0)
      .setDepth(31)
      .setInteractive({ useHandCursor: true });
    const btnText = this.add.text(width / 2, height / 2 + 55, '제목 화면으로', { fontSize: '15px', color: '#f5deb3' }).setOrigin(0.5).setScrollFactor(0).setDepth(32);
    btn.on('pointerdown', () => {
      box.destroy();
      text.destroy();
      btn.destroy();
      btnText.destroy();
      this.registry.remove('boarDefeatedCount');
      this.scene.start('Title');
    });
  }

  private flash(target: Phaser.GameObjects.Arc, color: number) {
    const original = target.fillColor;
    target.setFillStyle(color);
    this.time.delayedCall(120, () => target.setFillStyle(original));
  }

  private respawnPlayer() {
    this.character.hp = this.character.maxHp;
    this.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
    this.showToast('쓰러졌다... 마을 어귀에서 정신을 차렸다.');
  }

  update(_time: number, delta: number) {
    // 이동
    const dir = new Phaser.Math.Vector2(0, 0);
    if (this.cursors.left?.isDown || this.wasd.A.isDown) dir.x -= 1;
    if (this.cursors.right?.isDown || this.wasd.D.isDown) dir.x += 1;
    if (this.cursors.up?.isDown || this.wasd.W.isDown) dir.y -= 1;
    if (this.cursors.down?.isDown || this.wasd.S.isDown) dir.y += 1;
    if (dir.lengthSq() === 0 && this.touchDir.lengthSq() > 0) dir.copy(this.touchDir);
    dir.normalize();
    this.player.body.setVelocity(dir.x * PLAYER_SPEED, dir.y * PLAYER_SPEED);

    // 몬스터 AI + 전투
    const now = this.time.now;
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.sprite.x, m.sprite.y);
      const label = (m.sprite as unknown as { __label: Phaser.GameObjects.Text }).__label;
      label.setPosition(m.sprite.x, m.sprite.y - (m.def.isBoss ? 56 : 41));
      m.hpBarBg.setPosition(m.sprite.x, m.sprite.y - (m.def.isBoss ? 44 : 29));
      m.hpBar.setPosition(m.sprite.x - 22, m.sprite.y - (m.def.isBoss ? 44 : 29));

      if (!m.def.isBoss) {
        if (dist < AGGRO_RANGE) {
          const toPlayer = new Phaser.Math.Vector2(this.player.x - m.sprite.x, this.player.y - m.sprite.y).normalize();
          m.sprite.body.setVelocity(toPlayer.x * MONSTER_SPEED, toPlayer.y * MONSTER_SPEED);
        } else {
          if (now > m.nextWanderAt) {
            const angle = Math.random() * Math.PI * 2;
            m.wanderDir.set(Math.cos(angle), Math.sin(angle));
            m.nextWanderAt = now + 1500 + Math.random() * 1500;
          }
          m.sprite.body.setVelocity(m.wanderDir.x * MONSTER_SPEED * 0.4, m.wanderDir.y * MONSTER_SPEED * 0.4);
        }
      }

      if (dist < MONSTER_ATTACK_RANGE && now - m.lastAttackAt > MONSTER_ATTACK_COOLDOWN_MS) {
        m.lastAttackAt = now;
        const result = computeDamage(m.atk, m.dominant, this.character.analysis.dominant, this.character.analysis.yong);
        this.character.hp = Math.max(0, this.character.hp - result.damage);
        this.flash(this.player, 0xff6666);
        this.showToast(`${m.def.name}의 ${m.dominant} 공격! ${result.damage} 피해`);
        if (this.character.hp <= 0) {
          this.respawnPlayer();
        }
      }
    }

    this.playerHpBar.width = (this.scale.width - 80) * Phaser.Math.Clamp(this.character.hp / this.character.maxHp, 0, 1);
    this.playerHpText.setText(`${this.character.hp}/${this.character.maxHp}`);
  }
}
