import Phaser from 'phaser';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.cameras.main.setBackgroundColor('#000000');

    const cx = 128;
    const cy = 112;

    // Title text
    const titleText = this.add.text(cx, cy - 20, 'SOREN', {
      fontFamily: '"Courier New", monospace',
      fontSize: '20px',
      color: '#ffffff',
      align: 'center'
    });
    titleText.setResolution(3);
    titleText.setOrigin(0.5);

    // Subtitle
    const subtitle = this.add.text(cx, cy + 8, 'A JRPG', {
      fontFamily: '"Courier New", monospace',
      fontSize: '10px',
      color: '#888888',
      align: 'center'
    });
    subtitle.setResolution(3);
    subtitle.setOrigin(0.5);

    // "Press Start" prompt (blinking)
    const pressStart = this.add.text(cx, 184, 'Press Z to Start', {
      fontFamily: '"Courier New", monospace',
      fontSize: '8px',
      color: '#ffffff',
      align: 'center'
    });
    pressStart.setResolution(3);
    pressStart.setOrigin(0.5);

    // Blink animation
    this.tweens.add({
      targets: pressStart,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      yoyo: true,
      repeat: -1
    });

    // Input — Z or Enter to start
    this.input.keyboard.once('keydown-Z', () => {
      this.scene.start('Overworld');
    });

    this.input.keyboard.once('keydown-ENTER', () => {
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
      this.scene.start('Overworld');
    }
  }
}