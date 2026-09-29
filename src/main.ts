import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { CreateScene } from './scenes/CreateScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 480,
  height: 800,
  backgroundColor: '#1a120a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  input: { activePointers: 3 },
  scene: [BootScene, TitleScene, CreateScene, WorldScene, UIScene],
});

// 브라우저 콘솔에서 상태를 들여다볼 수 있게 (테스트용)
(window as unknown as { __game: Phaser.Game }).__game = game;
