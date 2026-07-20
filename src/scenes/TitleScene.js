import Phaser from 'phaser';

/**
 * TitleScene — uses DOM overlay for text (crisp at any resolution).
 * The game canvas stays at 256×224 for sprites/tilemaps.
 * Text is rendered as HTML elements positioned over the canvas.
 */
export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.cameras.main.setBackgroundColor('#000000');

    // Create DOM text overlay
    this.domElements = [];

    const createText = (x, y, text, options) => {
      const div = document.createElement('div');
      div.textContent = text;
      div.style.cssText = `
        position: absolute;
        left: ${(x / 256) * 100}%;
        top: ${(y / 224) * 100}%;
        transform: translate(-50%, -50%);
        color: ${options.color || '#ffffff'};
        font-family: "Courier New", monospace;
        font-size: ${options.fontSize || '16px'};
        font-weight: ${options.bold ? 'bold' : 'normal'};
        text-align: center;
        white-space: nowrap;
        pointer-events: none;
        z-index: 10;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      `;
      const container = document.getElementById('game-container');
      container.appendChild(div);
      this.domElements.push(div);
      return div;
  };

    // Title text
    createText(128, 80, 'SOREN', { fontSize: '48px', bold: true, color: '#ffffff' });

    // Subtitle
    createText(128, 120, 'A JRPG', { fontSize: '18px', color: '#888888' });

    // "Press Start" prompt (blinking)
    const pressStart = createText(128, 190, 'Press Z to Start', { fontSize: '14px', color: '#ffffff' });

    // Blink animation via CSS
    this.blinkInterval = setInterval(() => {
      pressStart.style.opacity = pressStart.style.opacity === '0' ? '1' : '0';
    }, 500);

    // Input — Z or Enter to start
    this.input.keyboard.once('keydown-Z', () => {
      this.cleanup();
      this.scene.start('Overworld');
    });

    this.input.keyboard.once('keydown-ENTER', () => {
      this.cleanup();
      this.scene.start('Overworld');
    });

    // Gamepad support
    this.input.gamepad.once('connected', (pad) => {
      this.gamepad = pad;
    });

    if (this.input.gamepad && this.input.gamepad.total > 0) {
      this.gamepad = this.input.gamepad.getPad(0);
    }
  }

  update() {
    if (this.gamepad && this.gamepad.A) {
      this.cleanup();
      this.scene.start('Overworld');
    }
  }

  cleanup() {
    if (this.blinkInterval) clearInterval(this.blinkInterval);
    this.domElements.forEach(el => el.remove());
    this.domElements = [];
  }

  shutdown() {
    this.cleanup();
  }
}