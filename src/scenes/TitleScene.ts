import Phaser from 'phaser';
import { dayPillar } from '../saju/pillar';
import { button, ELEMENT_LIGHT, panel, txt, PAPER } from '../ui/kit';
import { hasSave, loadGame } from '../game/save';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const { width, height } = this.scale;
    this.drawBackdrop();

    txt(this, width / 2, height * 0.17, '사주 RPG', 56, '#fff3d6', { originX: 0.5, originY: 0.5, stroke: '#3b2a1a', strokeThickness: 8 });
    txt(this, width / 2, height * 0.245, '오행의 난 · 동방 청림', 20, '#ffe6a8', { originX: 0.5, originY: 0.5, stroke: '#3b2a1a', strokeThickness: 5 });

    const today = new Date();
    const p = dayPillar(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const box = panel(this, width / 2 - 150, height * 0.3, 300, 54, 'light');
    box.setAlpha(0.95);
    txt(this, width / 2, height * 0.3 + 27, `오늘의 일진  ${p.name}(${p.stem.hanja}${p.branch.hanja})일`, 19, '#3b2a1a', { originX: 0.5, originY: 0.5 });
    txt(this, width / 2 + 110, height * 0.3 + 27, '●', 16, ELEMENT_LIGHT[p.stem.element], { originX: 0.5, originY: 0.5, stroke: '#3b2a1a', strokeThickness: 3 });

    const menuY = height * 0.5;
    panel(this, width / 2 - 140, menuY - 20, 280, hasSave() ? 250 : 190, 'brown');
    let y = menuY + 16;
    const saved = hasSave() ? loadGame() : null;
    if (saved) {
      button(this, width / 2, y, 230, 52, '이어하기', () => {
        this.registry.set('state', saved);
        this.scene.start('World');
      }, 'beige', 20);
      txt(this, width / 2, y + 34, `${saved.data.name} · Lv${saved.data.level} ${saved.character.jobClass.name}`, 13, PAPER, { originX: 0.5 });
      y += 76;
    }
    button(this, width / 2, y, 230, 52, saved ? '새로 태어나기' : '새로 태어나기 (시작)', () => {
      if (saved && !window.confirm('새로 시작하면 지금 저장된 캐릭터가 사라집니다. 계속할까요?')) return;
      this.scene.start('Create');
    }, saved ? 'brown' : 'beige', 20);
    y += 64;
    button(this, width / 2, y, 230, 46, '조작 방법', () => this.showHelp(), 'grey', 17);

    txt(this, width / 2, height - 44, '태어난 순간의 시각이 곧 캐릭터의 사주가 됩니다', 13, '#fff3d6', { originX: 0.5, stroke: '#3b2a1a', strokeThickness: 4 });
    txt(this, width / 2, height - 22, '그림: Kenney 외 CC0 무료 에셋 (CREDITS.md)', 11, '#e8d8b8', { originX: 0.5, stroke: '#3b2a1a', strokeThickness: 3 });
  }

  private drawBackdrop() {
    const { width, height } = this.scale;
    const bg = this.add.tileSprite(0, 0, width / 2, height / 2, 'town', 0).setOrigin(0).setScale(2);
    bg.setTint(0xb8d8a0);
    const trees = [4, 16, 28, 3, 15];
    for (let i = 0; i < 26; i++) {
      const x = (i * 97) % width;
      const y = i < 13 ? 20 + (i % 3) * 30 : height - 60 - (i % 3) * 36;
      this.add.image(x, y, 'town', trees[i % trees.length]).setScale(3);
    }
    this.add.image(width * 0.18, height * 0.43, 'town', 16).setScale(5);
    this.add.image(width * 0.84, height * 0.44, 'town', 16).setScale(5);
    this.add.rectangle(0, 0, width, height, 0x1a120a, 0.18).setOrigin(0);
  }

  private showHelp() {
    const { width, height } = this.scale;
    const layer = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0).setInteractive();
    const box = panel(this, 24, 120, width - 48, 500, 'light');
    const body = [
      '■ PC',
      '이동: 방향키 / WASD',
      '공격·대화: Space',
      '오행 스킬: 1 목 · 2 화 · 3 토 · 4 금 · 5 수',
      '물약: 6 체력 · 7 마력',
      '창: I 가방 · C 장비 · P 능력치 · K 스킬',
      '     L 퀘스트 · M 지도 · Esc 메뉴/닫기',
      '',
      '■ 휴대폰',
      '왼쪽 아래 원을 끌어서 이동',
      '오른쪽 아래 큰 버튼: 공격 (NPC 앞에서는 대화)',
      '작은 오행 버튼: 스킬 · 맨 아래 줄: 메뉴',
    ].join('\n');
    const t = txt(this, 48, 150, body, 16, '#3b2a1a', { lineSpacing: 8 });
    const ok = button(this, width / 2, 580, 180, 48, '알겠어요', () => layer.destroy(), 'brown');
    layer.add([dim, box, t, ok]);
  }
}
