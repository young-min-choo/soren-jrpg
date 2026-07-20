import Phaser from 'phaser';

/**
 * TitleScene — simple title screen.
 * Camera zooms 3x, so game world is 256×224 but canvas is 768×672.
 * Text positions are in game world coordinates (256×224) and get zoomed by camera.
 * Text renders at canvas resolution (768×672) = crisp.
 */
export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    // Camera zoom 3x — game world is 256×224, canvas is 768×672
    this.cameras.main.setZoom(3);
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.setBackgroundColor('#000000');

    const cx = 128; // center X in game world (256/2)
    const cy = 112; // center Y in game world (224/2)

    // Title text
    const titleText = this.add.text(cx, cy - 20, 'SOREN', {
      fontFamily: '"Courier New", monospace',
      fontSize: '32px',
      color: '#ffffff',
      align: 'center'
    });
    titleText.setOrigin(0.5);

    // Subtitle
    const subtitle = this.add.text(cx, cy + 10, 'A JRPG', {
      fontFamily: '"Courier New", monospace',
      fontSize: '12px',
      color: '#888888',
      align: 'center'
    });
    subtitle.setOrigin(0.5);

    // "Press Start" prompt (blinking)
    const pressStart = this.add.text(cx, 184, 'Press Z to Start', {
      fontFamily: '"Courier New", monospace',
      fontSize: '10px',
      color: '#ffffff',
      align: 'center'
    });
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
    // Gamepad button 0 (A) to start
    if (this.gamepad && this.gamepad.A) {
      this.scene.start('Overworld');
    }
  }
}