import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import OverworldScene from './scenes/OverworldScene.js';
import TownScene from './scenes/TownScene.js';
import { PortMeridianScene, StonewatchScene, SkyholdScene, AureliaScene } from './scenes/TownInstances.js';
import DungeonScene from './scenes/DungeonScene.js';
import { TideTempleScene, HollowDeepScene, StormSpireScene } from './scenes/DungeonInstances.js';
import { ConduitGateScene, ConduitScene } from './scenes/ConduitScenes.js';
import MenuScene from './scenes/MenuScene.js';
import DialogueScene from './scenes/DialogueScene.js';
import BattleScene from './scenes/BattleScene.js';
import NewGameFlowScene from './scenes/NewGameFlowScene.js';
import EmbersScene from './scenes/EmbersScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import MusicManager from './scenes/MusicManager.js';
import { installTestHooks } from './test-hooks.js';

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
  scene: [MusicManager, BootScene, TitleScene, NewGameFlowScene, OverworldScene, TownScene, PortMeridianScene, StonewatchScene, SkyholdScene, AureliaScene, DungeonScene, TideTempleScene, HollowDeepScene, StormSpireScene, ConduitGateScene, ConduitScene, EmbersScene, MenuScene, DialogueScene, BattleScene, GameOverScene]
};

const game = new Phaser.Game(config);

// Phase 9: route scene START events into MusicManager. Each Phaser scene
// emits START on its own emitter (not the manager), so we hook every
// registered scene's emitter once the manager has them.
game.events.once('ready', function () {
  const mm = game.scene.getScene('MusicManager');
  if (!mm) return;
  for (const scene of game.scene.getScenes()) {
    if (scene.scene.key === 'MusicManager') continue;
    scene.events.on('start', (sys) => {
      mm.onSceneStart(scene.scene.key);
    });
  }
});

// Expose for debugging/testing
window.game = game;

// E2E test hooks — inert unless URL has ?test=1
installTestHooks(game);

// Force keyboard focus on the game canvas once it's created
game.events.once('ready', function() {
  var canvas = document.querySelector('#game-container canvas');
  if (canvas) {
    canvas.setAttribute('tabindex', '0');
    canvas.focus();
  }
});