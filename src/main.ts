import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import { CreateScene } from './scenes/CreateScene';
import { WorldScene } from './scenes/WorldScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 480,
  height: 800,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [TitleScene, CreateScene, WorldScene],
});
