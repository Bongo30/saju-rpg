import Phaser from 'phaser';
import { createCharacter, type Character } from '../game/character';
import { ELEMENTS } from '../saju/analyze';
import { GameState } from '../game/state';
import { saveGame } from '../game/save';
import { button, ELEMENT_NUM, ELEMENT_TEXT, INK, INK_SOFT, panel, txt } from '../ui/kit';

export class CreateScene extends Phaser.Scene {
  private character!: Character;
  private info!: Phaser.GameObjects.Container;
  private nameInput?: HTMLInputElement;

  constructor() {
    super('Create');
  }

  create() {
    const { width, height } = this.scale;
    this.add.tileSprite(0, 0, width / 2, height / 2, 'town', 0).setOrigin(0).setScale(2).setTint(0x9fbf8a);
    panel(this, 12, 12, width - 24, height - 24, 'light');
    txt(this, width / 2, 44, '사주팔자 (四柱八字)', 28, INK, { originX: 0.5, originY: 0.5 });
    txt(this, width / 2, 74, '"출발" 을 누르는 순간의 시각이 사주로 확정됩니다', 13, INK_SOFT, { originX: 0.5, originY: 0.5 });

    this.character = createCharacter();
    this.info = this.add.container(0, 0);
    this.renderCharacter();

    txt(this, 40, height - 196, '이름', 16, INK, { originY: 0.5 });
    this.createNameInput();

    button(this, width / 2, height - 136, 300, 50, '지금 시각으로 다시 보기', () => {
      this.character = createCharacter();
      this.renderCharacter();
    }, 'beige', 17);
    button(this, width / 2, height - 74, 300, 56, '동방 새싹마을로 출발', () => this.depart(), 'brown', 20);
    button(this, 60, 44, 76, 38, '← 뒤로', () => this.scene.start('Title'), 'grey', 13);

    this.events.once('shutdown', () => this.removeNameInput());
  }

  private depart() {
    const name = (this.nameInput?.value ?? '').trim().slice(0, 8) || '나그네';
    // 사주는 출발하는 이 순간의 시각으로 최종 확정된다 (설계서 3.1)
    const state = GameState.newGame(name, new Date());
    saveGame(state);
    this.registry.set('state', state);
    this.scene.start('World');
  }

  private createNameInput() {
    const canvas = this.game.canvas;
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 8;
    input.placeholder = '나그네';
    input.value = '나그네';
    Object.assign(input.style, {
      position: 'fixed',
      fontFamily: 'Jua, sans-serif',
      fontSize: '18px',
      border: '2px solid #8a6a42',
      borderRadius: '6px',
      background: '#fffaf0',
      color: '#3b2a1a',
      padding: '4px 8px',
      boxSizing: 'border-box',
      zIndex: '10',
    } as CSSStyleDeclaration);
    document.body.appendChild(input);
    this.nameInput = input;
    const place = () => {
      const r = canvas.getBoundingClientRect();
      const sx = r.width / this.scale.width;
      const sy = r.height / this.scale.height;
      input.style.left = `${r.left + 90 * sx}px`;
      input.style.top = `${r.top + (this.scale.height - 214) * sy}px`;
      input.style.width = `${240 * sx}px`;
      input.style.height = `${36 * sy}px`;
    };
    place();
    this.scale.on('resize', place);
    window.addEventListener('resize', place);
    this.events.once('shutdown', () => {
      this.scale.off('resize', place);
      window.removeEventListener('resize', place);
    });
  }

  private removeNameInput() {
    this.nameInput?.remove();
    this.nameInput = undefined;
  }

  private renderCharacter() {
    this.info.removeAll(true);
    const { width } = this.scale;
    const c = this.character;
    const pillars = [
      ['시주', c.pillars.hour],
      ['일주', c.pillars.day],
      ['월주', c.pillars.month],
      ['연주', c.pillars.year],
    ] as const;

    const colW = (width - 60) / 4;
    pillars.forEach(([label, pillar], i) => {
      const x = 30 + colW * i + colW / 2;
      const isDay = label === '일주';
      const card = panel(this, x - colW / 2 + 4, 96, colW - 8, 128, isDay ? 'insetBrown' : 'inset');
      this.info.add(card);
      this.info.add(txt(this, x, 110, label + (isDay ? ' (나)' : ''), 13, isDay ? '#fff3d6' : INK_SOFT, { originX: 0.5 }));
      this.info.add(txt(this, x, 150, pillar.stem.hanja, 34, ELEMENT_TEXT[pillar.stem.element], { originX: 0.5, originY: 0.5, stroke: '#fffaf0', strokeThickness: 3 }));
      this.info.add(txt(this, x, 190, pillar.branch.hanja, 34, ELEMENT_TEXT[pillar.branch.element], { originX: 0.5, originY: 0.5, stroke: '#fffaf0', strokeThickness: 3 }));
      this.info.add(txt(this, x, 214, pillar.name, 12, isDay ? '#fff3d6' : INK, { originX: 0.5, originY: 0.5 }));
    });

    const a = c.analysis;
    let y = 244;
    this.info.add(txt(this, width / 2, y, `일간 ${c.pillars.day.stem.hangul}(${c.pillars.day.stem.hanja}) → ${c.jobClass.name}`, 22, INK, { originX: 0.5 }));
    y += 30;
    this.info.add(txt(this, width / 2, y, `${c.jobClass.description} · 주 오행 ${c.jobClass.element}`, 14, INK_SOFT, { originX: 0.5 }));
    y += 32;

    const barW = width - 170;
    const barX = 76;
    ELEMENTS.forEach((e) => {
      const v = a.scores[e];
      this.info.add(txt(this, barX - 14, y, e, 16, ELEMENT_TEXT[e], { originX: 1, originY: 0.5 }));
      const bg = this.add.rectangle(barX, y, barW, 14, 0xd8c8a8).setOrigin(0, 0.5);
      const bar = this.add.rectangle(barX, y, Math.max(2, (barW * v) / 60), 14, ELEMENT_NUM[e]).setOrigin(0, 0.5);
      bar.width = Math.min(barW, bar.width);
      const pct = txt(this, barX + barW + 8, y, `${v}%`, 13, INK, { originY: 0.5 });
      this.info.add([bg, bar, pct]);
      y += 24;
    });

    y += 8;
    this.info.add(
      txt(this, width / 2, y, `신강도 ${a.strength} · 한난 ${a.temp >= 0 ? '+' : ''}${a.temp} · 조습 ${a.humid >= 0 ? '+' : ''}${a.humid}`, 14, INK, { originX: 0.5 }),
    );
    y += 26;
    const yong = txt(this, width / 2, y, `보완 오행(용신): ${a.yong}${a.isJongwang ? ' · 종왕형!' : ''}`, 18, ELEMENT_TEXT[a.yong], { originX: 0.5, stroke: '#fffaf0', strokeThickness: 3 });
    this.info.add(yong);
    y += 30;
    const s = c.stats;
    this.info.add(txt(this, width / 2, y, `생명 ${s.생명재생} · 공격 ${s.공격} · 방어 ${s.방어} · 치명 ${s.치명} · 기력 ${s.기력}`, 14, INK, { originX: 0.5 }));
    y += 24;
    this.info.add(txt(this, width / 2, y, `${a.yong} 기운의 장비를 입으면 공명해서 더 강해집니다`, 12, INK_SOFT, { originX: 0.5 }));
  }
}
