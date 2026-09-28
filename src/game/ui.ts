import type Phaser from 'phaser';

export const ELEMENT_COLORS: Record<string, string> = {
  목: '#4caf50',
  화: '#e53935',
  토: '#c8a14a',
  금: '#e0e0e0',
  수: '#42a5f5',
};

export const ELEMENT_HEX: Record<string, number> = {
  목: 0x4caf50,
  화: 0xe53935,
  토: 0xc8a14a,
  금: 0xcfcfcf,
  수: 0x42a5f5,
};

/** 터치하기 편한 버튼을 만든다 (텍스트 + 배경 사각형). */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  label: string,
  onClick: () => void,
  color = 0x33334d,
): Phaser.GameObjects.Container {
  const height = 56;
  const bg = scene.add.rectangle(0, 0, width, height, color).setStrokeStyle(2, 0xf5deb3);
  const text = scene.add
    .text(0, 0, label, { fontSize: '20px', color: '#f5deb3' })
    .setOrigin(0.5);
  const container = scene.add.container(x, y, [bg, text]);
  container.setSize(width, height);
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerdown', onClick);
  bg.on('pointerover', () => bg.setFillStyle(0x4a4a6a));
  bg.on('pointerout', () => bg.setFillStyle(color));
  return container;
}
