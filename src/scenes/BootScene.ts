import Phaser from 'phaser';
import { FONT, PAPER, txt } from '../ui/kit';

const UI_IMAGES = [
  'panel_brown', 'panel_beige', 'panel_beigeLight', 'panelInset_beige', 'panelInset_brown',
  'buttonLong_brown', 'buttonLong_brown_pressed', 'buttonLong_beige', 'buttonLong_beige_pressed', 'buttonLong_grey',
  'buttonSquare_beige', 'buttonSquare_beige_pressed', 'buttonSquare_brown', 'buttonSquare_brown_pressed', 'buttonSquare_grey',
  'buttonRound_brown', 'buttonRound_beige', 'iconCross_beige', 'iconCross_brown', 'iconCheck_beige', 'arrowBeige_left', 'arrowBeige_right',
];
const BAR_COLORS = ['Back', 'Red', 'Blue', 'Green', 'Yellow'];

const TIPS = [
  '사주는 태어난 순간의 연·월·일·시 네 기둥, 여덟 글자입니다.',
  '목은 화를 낳고, 화는 토를, 토는 금을, 금은 수를, 수는 목을 낳습니다 (상생).',
  '금은 목을, 목은 토를, 토는 수를, 수는 화를, 화는 금을 누릅니다 (상극).',
  '적의 보완 오행으로 공격하면 오히려 적이 편해집니다.',
  '장비의 오행이 내 보완 오행이면 "공명"해서 능력치가 20% 오릅니다.',
  '몬스터도 태어난 시각의 사주를 가집니다. 같은 멧돼지도 개체마다 다릅니다.',
];

/** 모든 그림을 한 번에 불러오고, 바 텍스처·걷기 애니메이션을 준비한다. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#17120d');
    const title = this.add.text(width / 2, height * 0.38, '사주 RPG', { fontFamily: FONT, fontSize: '40px', color: '#f5deb3', resolution: 2 }).setOrigin(0.5);
    const barBg = this.add.rectangle(width / 2, height * 0.5, width * 0.7, 14, 0x3a2a1a).setStrokeStyle(2, 0x8a6a42);
    const bar = this.add.rectangle(width * 0.15 + 2, height * 0.5, 0, 10, 0xe0b050).setOrigin(0, 0.5);
    const label = this.add.text(width / 2, height * 0.5 + 26, '불러오는 중...', { fontFamily: FONT, fontSize: '14px', color: '#c9b18a', resolution: 2 }).setOrigin(0.5);
    const tip = this.add
      .text(width / 2, height * 0.62, TIPS[Math.floor(Math.random() * TIPS.length)], {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#a89070',
        align: 'center',
        wordWrap: { width: width * 0.8 },
        resolution: 2,
      })
      .setOrigin(0.5);
    this.load.on('progress', (v: number) => {
      bar.width = (width * 0.7 - 4) * v;
      label.setText(`불러오는 중... ${Math.round(v * 100)}%`);
    });
    this.load.once('complete', () => {
      title.destroy();
      barBg.destroy();
      bar.destroy();
      label.destroy();
      tip.destroy();
    });

    for (const k of UI_IMAGES) this.load.image(k, `assets/ui/${k}.png`);
    for (const c of BAR_COLORS) {
      this.load.image(`bar${c}L`, `assets/ui/bar${c}_horizontalLeft.png`);
      this.load.image(`bar${c}M`, `assets/ui/bar${c}_horizontalMid.png`);
      this.load.image(`bar${c}R`, `assets/ui/bar${c}_horizontalRight.png`);
    }
    this.load.spritesheet('town', 'assets/tiles/town.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('dungeon', 'assets/tiles/dungeon.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('items', 'assets/sprites/items.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('hero', 'assets/sprites/hero_walk.png', { frameWidth: 24, frameHeight: 32 });
    this.load.image('hero_face', 'assets/sprites/hero_face.png');
    for (const k of ['boar', 'snake', 'toad', 'woodpecker']) this.load.image(k, `assets/sprites/${k}.png`);
  }

  async create() {
    for (const k of ['town', 'dungeon', 'items', 'hero', 'hero_face', 'boar', 'snake', 'toad', 'woodpecker']) {
      this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.buildBarTextures();
    this.buildFxTextures();
    this.buildAnimations();

    const t = txt(this, this.scale.width / 2, this.scale.height / 2, '글꼴 준비 중...', 14, '#c9b18a', { originX: 0.5, originY: 0.5 });
    await Promise.race([
      document.fonts?.load(`16px Jua`).catch(() => undefined),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
    t.destroy();
    this.cameras.main.setBackgroundColor(PAPER);
    this.scene.start('Title');
  }

  private buildBarTextures() {
    for (const c of BAR_COLORS) {
      const key = `bar_${c.toLowerCase()}`;
      const canvas = this.textures.createCanvas(key, 36, 18);
      if (!canvas) continue;
      const ctx = canvas.getContext();
      const src = (k: string) => this.textures.get(k).getSourceImage() as HTMLImageElement;
      ctx.drawImage(src(`bar${c}L`), 0, 0);
      ctx.drawImage(src(`bar${c}M`), 9, 0);
      ctx.drawImage(src(`bar${c}R`), 27, 0);
      canvas.refresh();
    }
  }

  private buildFxTextures() {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
    g.generateTexture('fx_dot', 8, 8);
    g.clear();
    g.fillStyle(0xffffff, 1).fillCircle(12, 12, 12);
    g.generateTexture('fx_ball', 24, 24);
    g.clear();
    g.fillStyle(0x000000, 0.28).fillEllipse(16, 6, 30, 11);
    g.generateTexture('shadow', 32, 12);
    g.clear();
    g.lineStyle(3, 0xffffff, 1).strokeEllipse(24, 10, 44, 16);
    g.generateTexture('target_ring', 48, 20);
    g.destroy();
  }

  private buildAnimations() {
    const dirs: Array<[string, number]> = [
      ['down', 0],
      ['up', 8],
      ['side', 16],
    ];
    for (const [d, start] of dirs) {
      this.anims.create({
        key: `hero-walk-${d}`,
        frames: this.anims.generateFrameNumbers('hero', { start, end: start + 7 }),
        frameRate: 12,
        repeat: -1,
      });
    }
  }
}
