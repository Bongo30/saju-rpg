import Phaser from 'phaser';
import { createCharacter, type Character } from '../game/character';
import { ELEMENT_COLORS, makeButton } from '../game/ui';
import { ELEMENTS } from '../saju/analyze';

export class CreateScene extends Phaser.Scene {
  private character!: Character;
  private info!: Phaser.GameObjects.Container;

  constructor() {
    super('Create');
  }

  create() {
    const { width, height } = this.scale;
    this.add.text(width / 2, 40, '사주팔자', { fontSize: '28px', color: '#f5deb3' }).setOrigin(0.5);
    this.add
      .text(width / 2, 68, '지금 이 순간의 시각으로 사주를 세웁니다 (택일 가능)', {
        fontSize: '12px',
        color: '#888888',
      })
      .setOrigin(0.5);

    this.character = createCharacter();
    this.info = this.add.container(0, 0);
    this.renderCharacter();

    makeButton(this, width / 2, height - 130, width * 0.6, '다시 뽑기 (택일)', () => {
      this.character = createCharacter();
      this.renderCharacter();
    });
    makeButton(
      this,
      width / 2,
      height - 60,
      width * 0.6,
      '동방 새싹마을로 출발',
      () => {
        this.registry.set('character', this.character);
        this.scene.start('Village');
      },
      0x2e5d33,
    );
  }

  private renderCharacter() {
    this.info.removeAll(true);
    const { width } = this.scale;
    const c = this.character;
    const pillars = [
      ['연주', c.pillars.year],
      ['월주', c.pillars.month],
      ['일주', c.pillars.day],
      ['시주', c.pillars.hour],
    ] as const;

    const colW = width / 4;
    pillars.forEach(([label, pillar], i) => {
      const x = colW * i + colW / 2;
      this.info.add(this.text(x, 100, label, '14px', '#aaaaaa'));
      this.info.add(this.text(x, 128, pillar.stem.hanja, '30px', ELEMENT_COLORS[pillar.stem.element]));
      this.info.add(this.text(x, 162, pillar.branch.hanja, '30px', ELEMENT_COLORS[pillar.branch.element]));
      this.info.add(this.text(x, 192, pillar.name, '13px', '#dddddd'));
    });

    const a = c.analysis;
    let y = 240;
    this.info.add(
      this.text(width / 2, y, `일간 ${c.pillars.day.stem.hangul} → ${c.jobClass.name} (${c.jobClass.description})`, '18px', '#f5deb3'),
    );
    y += 34;

    const barW = width * 0.7;
    const barX = width / 2 - barW / 2;
    ELEMENTS.forEach((e) => {
      const v = a.scores[e];
      this.info.add(this.text(barX - 14, y, e, '14px', ELEMENT_COLORS[e]).setOrigin(1, 0.5));
      const bg = this.add.rectangle(barX, y, barW, 14, 0x333333).setOrigin(0, 0.5);
      const bar = this.add
        .rectangle(barX, y, Math.max(2, (barW * v) / 100), 14, Phaser.Display.Color.HexStringToColor(ELEMENT_COLORS[e]).color)
        .setOrigin(0, 0.5);
      const pct = this.add.text(barX + barW + 8, y, `${v}%`, { fontSize: '12px', color: '#aaaaaa' }).setOrigin(0, 0.5);
      this.info.add([bg, bar, pct]);
      y += 22;
    });

    y += 10;
    this.info.add(
      this.text(
        width / 2,
        y,
        `신강도 ${a.strength} · 한난 ${a.temp >= 0 ? '+' : ''}${a.temp} · 조습 ${a.humid >= 0 ? '+' : ''}${a.humid}`,
        '13px',
        '#cccccc',
      ),
    );
    y += 24;
    this.info.add(
      this.text(width / 2, y, `보완 오행: ${a.yong}${a.isJongwang ? ' (종왕형!)' : ''}`, '16px', ELEMENT_COLORS[a.yong]),
    );
    y += 30;

    const s = c.stats;
    this.info.add(
      this.text(
        width / 2,
        y,
        `생명 ${s.생명재생}  공격 ${s.공격}  방어 ${s.방어}  치명 ${s.치명}  기력 ${s.기력}`,
        '13px',
        '#dddddd',
      ),
    );
  }

  private text(x: number, y: number, str: string, size: string, color: string) {
    return this.add.text(x, y, str, { fontSize: size, color }).setOrigin(0.5);
  }
}
