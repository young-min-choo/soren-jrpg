import Phaser from 'phaser';

/**
 * TitleScene — simple title screen.
 * "Press Start" → transitions to Overworld.
 * In later phases, this will have New Game / Load Game options.
 */
export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    // Black background
    this.cameras.main.setBackgroundColor('#000000');

    // Title text
    const titleText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 20,
      'SOREN',
      {
        fontFamily: '"Courier New", monospace',
        fontSize: '32px',
        color: '#ffffff',
        align: 'center'
      }
    );
    titleText.setOrigin(0.5);
    titleText.setResolution(3);

    // Subtitle
    const subtitle = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 10,
      'A JRPG',
      {
        fontFamily: '"Courier New", monospace',
        fontSize: '12px',
        color: '#888888',
        align: 'center'
      }
    );
    subtitle.setOrigin(0.5);
    subtitle.setResolution(3);

    // "Press Start" prompt (blinking)
    const pressStart = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height - 40,
      'Press Z to Start',
      {
        fontFamily: '"Courier New", monospace',
        fontSize: '10px',
        color: '#ffffff',
        align: 'center'
      }
    );
    pressStart.setOrigin(0.5);
    pressStart.setResolution(3);

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
    // Gamepad button 0 (A) to start
    if (this.gamepad && this.gamepad.A) {
      this.scene.start('Overworld');
    }
  }
}