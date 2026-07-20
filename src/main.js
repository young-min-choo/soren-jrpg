import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import OverworldScene from './scenes/OverworldScene.js';
import TownScene from './scenes/TownScene.js';
import DialogueScene from './scenes/DialogueScene.js';

// Canvas is 768×672 (3x the classic 256×224).
// Game world coordinates are 256×224.
// Each scene's camera zooms 3x so the 256×224 world fills the 768×672 canvas.
// Text renders at the full 768×672 canvas resolution = crisp text.
// Scale.FIT auto-sizes the canvas element to fit the browser window.

const SCALE = 3;
const GW = 256;
const GH = 224;

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GW * SCALE,    // 768 — actual canvas pixel resolution
  height: GH * SCALE,  // 672 — text renders at this resolution
  backgroundColor: '#000000',
  preserveDrawingBuffer: true,  // needed for canvas.toDataURL screenshots
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
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
  scene: [BootScene, TitleScene, OverworldScene, TownScene, DialogueScene]
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