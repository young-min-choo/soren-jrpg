import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import OverworldScene from './scenes/OverworldScene.js';
import TownScene from './scenes/TownScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 256,
  height: 224,
  pixelArt: true,
  zoom: 3,
  backgroundColor: '#000000',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  input: {
    gamepad: true,
    keyboard: {
      target: 'window'
    }
  },
  scene: [BootScene, TitleScene, OverworldScene, TownScene]
};

const game = new Phaser.Game(config);

// Expose for debugging/testing
window.game = game;