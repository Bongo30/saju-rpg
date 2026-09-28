import Phaser from 'phaser';
import type { Character } from '../game/character';
import { WILD_BOAR, WILD_BOAR_PILLARS, SINDANSU, SINDANSU_PILLARS, monsterAnalysis, type MonsterDef } from '../data/monsters';
import { computeDamage } from '../game/battle';
import { ELEMENT_COLORS, makeButton } from '../game/ui';
import { ELEMENTS } from '../saju/analyze';
import type { Element } from '../saju/ganji';
import type { FourPillars } from '../saju/pillar';

interface BattleData {
  monsterId: string;
}

function monsterByid(id: string): { def: MonsterDef; pillars: FourPillars } {
  if (id === 'sindansu') return { def: SINDANSU, pillars: SINDANSU_PILLARS };
  return { def: WILD_BOAR, pillars: WILD_BOAR_PILLARS };
}

export class BattleScene extends Phaser.Scene {
  private character!: Character;
  private monster!: MonsterDef;
  private monsterHp = 0;
  private monsterMaxHp = 0;
  private monsterAnalysisResult!: ReturnType<typeof monsterAnalysis>;
  private sindansuFireHits = 0;
  private sindansuWeakened = false;
  private sindansuFireHitAnnounced = false;
  private logText!: Phaser.GameObjects.Text;
  private playerHpText!: Phaser.GameObjects.Text;
  private monsterHpText!: Phaser.GameObjects.Text;
  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private monsterHpBar!: Phaser.GameObjects.Rectangle;
  private buttons: Phaser.GameObjects.Container[] = [];
  private over = false;

  constructor() {
    super('Battle');
  }

  create(data: BattleData) {
    const { width, height } = this.scale;
    this.character = this.registry.get('character') as Character;
    this.character.hp = this.character.hp || this.character.maxHp;
    const { def, pillars } = monsterByid(data.monsterId);
    this.monster = def;
    this.monsterAnalysisResult = monsterAnalysis(pillars);
    this.monsterMaxHp = Math.round(
      (def.isBoss ? 90 : 45) + this.monsterAnalysisResult.stats.방어 * (def.isBoss ? 1.0 : 0.6),
    );
    this.monsterHp = this.monsterMaxHp;
    this.sindansuFireHits = 0;
    this.sindansuWeakened = false;
    this.over = false;

    this.add
      .text(width / 2, 30, this.monster.name, { fontSize: '24px', color: '#f5deb3' })
      .setOrigin(0.5);

    const dom = this.monsterAnalysisResult.analysis.dominant;
    const yong = this.monsterAnalysisResult.analysis.yong;
    this.add
      .text(width / 2, 60, `관상: 주 오행 ${dom} · 보완 오행 ${yong}`, {
        fontSize: '13px',
        color: '#bbbbbb',
      })
      .setOrigin(0.5);

    // 몬스터 HP
    this.add.text(20, 90, this.monster.name, { fontSize: '13px', color: '#dddddd' });
    this.add.rectangle(20, 112, width - 40, 16, 0x333333).setOrigin(0, 0.5);
    this.monsterHpBar = this.add.rectangle(20, 112, width - 40, 16, 0xcc4444).setOrigin(0, 0.5);
    this.monsterHpText = this.add
      .text(width - 20, 90, `${this.monsterHp}/${this.monsterMaxHp}`, { fontSize: '13px', color: '#dddddd' })
      .setOrigin(1, 0);

    // 플레이어 HP
    const playerY = height * 0.42;
    this.add.text(20, playerY, `${this.character.jobClass.name} (나)`, { fontSize: '13px', color: '#dddddd' });
    this.add.rectangle(20, playerY + 22, width - 40, 16, 0x333333).setOrigin(0, 0.5);
    this.playerHpBar = this.add.rectangle(20, playerY + 22, width - 40, 16, 0x44aa66).setOrigin(0, 0.5);
    this.playerHpText = this.add
      .text(width - 20, playerY, `${this.character.hp}/${this.character.maxHp}`, { fontSize: '13px', color: '#dddddd' })
      .setOrigin(1, 0);

    this.logText = this.add.text(width / 2, height * 0.56, this.monster.intro, {
      fontSize: '14px',
      color: '#ffffff',
      wordWrap: { width: width * 0.85 },
      align: 'center',
    }).setOrigin(0.5, 0);

    if (this.monster.hint) {
      this.add
        .text(width / 2, height * 0.68, this.monster.hint, {
          fontSize: '12px',
          color: '#888888',
          wordWrap: { width: width * 0.85 },
          align: 'center',
        })
        .setOrigin(0.5, 0);
    }

    this.renderAttackButtons();
    this.updateBars();
  }

  private renderAttackButtons() {
    this.buttons.forEach((b) => b.destroy());
    this.buttons = [];
    const { width, height } = this.scale;
    const jobElement = this.character.jobClass.element;
    const btnW = (width - 60) / 3;
    const startY = height * 0.78;

    ELEMENTS.forEach((e, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 30 + btnW / 2 + col * (btnW + 10);
      const y = startY + row * 62;
      const label = e === jobElement ? `${e} (주특기)` : e;
      const color = Phaser.Display.Color.HexStringToColor(ELEMENT_COLORS[e]).color;
      const btn = makeButton(this, x, y, btnW, label, () => this.playerAttack(e), color);
      this.buttons.push(btn);
    });
  }

  private clearButtons() {
    this.buttons.forEach((b) => b.destroy());
    this.buttons = [];
  }

  private playerAttack(element: Element) {
    if (this.over) return;
    const jobElement = this.character.jobClass.element;
    const base = this.character.stats.공격 * (element === jobElement ? 1.15 : 1.0);
    const dom = this.monsterAnalysisResult.analysis.dominant;
    const yong = this.monsterAnalysisResult.analysis.yong;

    let effectiveDominant = dom;
    let message: string;

    if (this.monster.id === 'sindansu' && !this.sindansuWeakened) {
      if (element === '금') {
        // 목견금결: 목 기운이 강해 약한 금 공격은 튕겨 나간다
        const dmg = Math.max(1, Math.round(base * 0.6));
        this.monsterHp = Math.max(0, this.monsterHp - dmg);
        message = `금 공격이 신단수의 굳센 목 기운에 튕겨 나갔다! (${dmg} 피해, 목견금결)`;
        this.afterPlayerAction(message);
        return;
      }
      if (element === '화') {
        this.sindansuFireHits += 1;
        if (this.sindansuFireHits >= 2) {
          this.sindansuWeakened = true;
        }
      }
    }
    if (this.monster.id === 'sindansu' && this.sindansuWeakened) {
      effectiveDominant = '목'; // 목 기운이 빠져 금극목이 정상적으로 통함
    }

    const result = computeDamage(base, element, effectiveDominant, yong);
    this.monsterHp = Math.max(0, this.monsterHp - result.damage);
    message = `${element} 공격! ${result.damage} 피해 (${result.relation.message}${result.yongBonus ? ', 보완 오행이라 약해짐' : ''})`;
    if (this.monster.id === 'sindansu' && this.sindansuWeakened && !this.sindansuFireHitAnnounced) {
      message += '\n신단수의 목 기운이 빠지며 약해졌다! 이제 금 공격이 제대로 통한다.';
      this.sindansuFireHitAnnounced = true;
    }
    this.afterPlayerAction(message);
  }

  private afterPlayerAction(message: string) {
    this.updateBars();
    if (this.monsterHp <= 0) {
      this.logText.setText(message + '\n\n' + this.monster.victoryText);
      this.onVictory();
      return;
    }
    this.logText.setText(message);
    this.time.delayedCall(600, () => this.monsterAttack());
  }

  private monsterAttack() {
    if (this.over) return;
    const attackElement = this.monsterAnalysisResult.analysis.dominant;
    const base = this.monsterAnalysisResult.stats.공격;
    const playerDominant = this.character.analysis.dominant;
    const playerYong = this.character.analysis.yong;
    const result = computeDamage(base, attackElement, playerDominant, playerYong);
    this.character.hp = Math.max(0, this.character.hp - result.damage);
    this.updateBars();

    const msg = `${this.monster.name}의 ${attackElement} 공격! ${result.damage} 피해`;
    if (this.character.hp <= 0) {
      this.logText.setText(msg + '\n\n쓰러졌다... 마을로 돌아가 다시 채비하자.');
      this.onDefeat();
      return;
    }
    this.logText.setText(msg);
  }

  private updateBars() {
    const monsterRatio = Phaser.Math.Clamp(this.monsterHp / this.monsterMaxHp, 0, 1);
    const playerRatio = Phaser.Math.Clamp(this.character.hp / this.character.maxHp, 0, 1);
    this.monsterHpBar.width = (this.scale.width - 40) * monsterRatio;
    this.playerHpBar.width = (this.scale.width - 40) * playerRatio;
    this.monsterHpText.setText(`${this.monsterHp}/${this.monsterMaxHp}`);
    this.playerHpText.setText(`${this.character.hp}/${this.character.maxHp}`);
  }

  private onVictory() {
    this.over = true;
    this.clearButtons();
    if (this.monster.id === 'wild-boar') {
      this.registry.set('boarDefeated', true);
    }
    const { width, height } = this.scale;
    makeButton(this, width / 2, height * 0.88, width * 0.6, '마을로 돌아가기', () => {
      this.character.hp = this.character.maxHp;
      this.registry.set('character', this.character);
      this.scene.start('Village');
    });
  }

  private onDefeat() {
    this.over = true;
    this.clearButtons();
    const { width, height } = this.scale;
    makeButton(this, width / 2, height * 0.88, width * 0.6, '마을로 돌아가기', () => {
      this.character.hp = this.character.maxHp;
      this.registry.set('character', this.character);
      this.scene.start('Village');
    });
  }
}
