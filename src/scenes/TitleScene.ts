import Phaser from 'phaser';
import { dayPillar } from '../saju/pillar';

const ELEMENT_COLORS: Record<string, string> = {
  목: '#4caf50',
  화: '#e53935',
  토: '#c8a14a',
  금: '#e0e0e0',
  수: '#42a5f5',
};

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const { width } = this.scale;
    this.add.text(width / 2, 80, '사주 RPG', { fontSize: '40px', color: '#f5deb3' }).setOrigin(0.5);

    const today = new Date();
    const p = dayPillar(today.getFullYear(), today.getMonth() + 1, today.getDate());
    this.add
      .text(width / 2, 180, `오늘의 일진: ${p.name}(${p.stem.hanja}${p.branch.hanja})일`, {
        fontSize: '24px',
        color: ELEMENT_COLORS[p.stem.element],
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 220, `천간 ${p.stem.element} · 지지 ${p.branch.element} (${p.branch.animal})`, {
        fontSize: '18px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);
  }
}
