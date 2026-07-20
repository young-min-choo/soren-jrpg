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
    gamepad: true
  },
  scene: [BootScene, TitleScene, OverworldScene, TownScene]
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

// Global safety net: reset all keyboard state when window loses focus
// This prevents "stuck key" bugs where keyup is missed
window.addEventListener('blur', function() {
  if (game.input && game.input.keyboard) {
    game.input.keyboard.resetKeys();
  }
});

// Also reset on visibility change (tab switch)
document.addEventListener('visibilitychange', function() {
  if (document.hidden && game.input && game.input.keyboard) {
    game.input.keyboard.resetKeys();
  }
});