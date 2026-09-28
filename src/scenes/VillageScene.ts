import Phaser from 'phaser';
import type { Character } from '../game/character';
import { makeButton, ELEMENT_COLORS } from '../game/ui';

export class VillageScene extends Phaser.Scene {
  constructor() {
    super('Village');
  }

  create() {
    const { width, height } = this.scale;
    const character = this.registry.get('character') as Character;
    const boarDefeated = Boolean(this.registry.get('boarDefeated'));

    this.add.text(width / 2, 50, '동방 청림 · 새싹마을', { fontSize: '24px', color: '#f5deb3' }).setOrigin(0.5);
    this.add
      .text(
        width / 2,
        84,
        `${character.jobClass.name} · 보완 오행 ${character.analysis.yong}`,
        { fontSize: '15px', color: ELEMENT_COLORS[character.analysis.yong] },
      )
      .setOrigin(0.5);
    this.add
      .text(width / 2, 108, 'HP ' + character.hp + ' / ' + character.maxHp, { fontSize: '13px', color: '#aaaaaa' })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.3, '새싹마을 촌장:\n"멀리서 온 여행자여,\n마을 근처 가시멧돼지 때문에\n곤란을 겪고 있다네."', {
        fontSize: '15px',
        color: '#dddddd',
        align: 'center',
      })
      .setOrigin(0.5);

    makeButton(this, width / 2, height * 0.55, width * 0.7, '가시멧돼지 사냥하기', () => {
      this.scene.start('Battle', { monsterId: 'wild-boar' });
    });

    makeButton(
      this,
      width / 2,
      height * 0.68,
      width * 0.7,
      boarDefeated ? '천년 신단수에게 도전' : '천년 신단수 (봉인됨)',
      () => {
        if (!boarDefeated) return;
        this.scene.start('Battle', { monsterId: 'sindansu' });
      },
      boarDefeated ? 0x5d2e2e : 0x22222a,
    );

    makeButton(this, width / 2, height * 0.81, width * 0.7, '사주 다시 보기', () => {
      this.scene.start('Create');
    });
  }
}
