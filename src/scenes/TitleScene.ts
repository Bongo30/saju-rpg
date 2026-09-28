import Phaser from 'phaser';
import { dayPillar } from '../saju/pillar';
import { ELEMENT_COLORS, makeButton } from '../game/ui';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const { width, height } = this.scale;
    this.add.text(width / 2, height * 0.22, '사주 RPG', { fontSize: '44px', color: '#f5deb3' }).setOrigin(0.5);
    this.add
      .text(width / 2, height * 0.3, '명리학 사주로 세상에 태어난다', { fontSize: '16px', color: '#aaaaaa' })
      .setOrigin(0.5);

    const today = new Date();
    const p = dayPillar(today.getFullYear(), today.getMonth() + 1, today.getDate());
    this.add
      .text(width / 2, height * 0.4, `오늘의 일진: ${p.name}(${p.stem.hanja}${p.branch.hanja})일`, {
        fontSize: '20px',
        color: ELEMENT_COLORS[p.stem.element],
      })
      .setOrigin(0.5);

    makeButton(this, width / 2, height * 0.6, width * 0.6, '캐릭터 만들기', () => {
      this.scene.start('Create');
    });

    this.add
      .text(width / 2, height * 0.9, '지금 이 순간이 캐릭터의 태어난 시각(사주)이 됩니다', {
        fontSize: '13px',
        color: '#888888',
        wordWrap: { width: width * 0.8 },
        align: 'center',
      })
      .setOrigin(0.5);
  }
}
