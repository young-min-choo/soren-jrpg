import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import OverworldScene from './scenes/OverworldScene.js';
import TownScene from './scenes/TownScene.js';
import DungeonScene from './scenes/DungeonScene.js';
import MenuScene from './scenes/MenuScene.js';
import DialogueScene from './scenes/DialogueScene.js';
import BattleScene from './scenes/BattleScene.js';

// Canvas is 256×224 with zoom: 3 (Phaser handles scaling).
// pixelArt: true gives crisp sprites. Text uses setResolution(3)
// to render at 3x internal resolution before being canvas-scaled.

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 256,
  height: 224,
  roundPixels: true,
  preserveDrawingBuffer: true,
  backgroundColor: '#000000',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  input: {
    gamepad: true
  },
  scene: [BootScene, TitleScene, OverworldScene, TownScene, DungeonScene, MenuScene, DialogueScene, BattleScene]
};

const game = new Phaser.Game(config);

// Expose for debugging/testing
window.game = game;

// Force keyboard focus on the game canvas once it's created
game.events.once('ready', function() {
  var canvas = document.querySelector('#game-container canvas');
  if (canvas) {
    canvas.setAttribute('tabindex', '0');
    canvas.focus();
  }
});