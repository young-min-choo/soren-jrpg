import Phaser from 'phaser';

/**
 * BootScene — generates placeholder assets, then transitions to Title.
 * In Phase 1, we generate simple colored tilesets and a player sprite
 * programmatically so we don't need external asset files yet.
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.generateTileset('overworld_tiles', 32, [
      '#3a5f3a', // 0: grass (dark green)
      '#4a7f4a', // 1: grass (light green)
      '#6b8f4a', // 2: forest
      '#8a8a7a', // 3: mountain
      '#4a6a8a', // 4: water
      '#c8c8a8', // 5: path/dirt
      '#aa8855', // 6: bridge
    ]);

    this.generateTileset('town_tiles', 32, [
      '#8a8a8a', // 0: stone floor (gray)
      '#6a6a6a', // 1: stone wall
      '#c8c8c8', // 2: path
      '#5a5a5a', // 3: building wall
      '#3a3a3a', // 4: building roof
      '#8a6a4a', // 5: wood floor
    ]);

    this.generatePlayerSprite('player_field', 16, 24);

    this.scene.start('Title');
  }

  /**
   * Generate a simple tileset texture programmatically.
   * Each tile is a solid color with a subtle border for visibility.
   */
  generateTileset(key, tileSize, colors) {
    const cols = colors.length;
    const texture = this.textures.createCanvas(key, cols * tileSize, tileSize);
    const ctx = texture.getContext();

    colors.forEach((color, i) => {
      const x = i * tileSize;
      ctx.fillStyle = color;
      ctx.fillRect(x, 0, tileSize, tileSize);

      // Subtle border for tile visibility
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, 0.5, tileSize - 1, tileSize - 1);
    });

    texture.refresh();
  }

  /**
   * Generate a simple player sprite (16×24) — a basic character silhouette.
   * 4 rows × 3 frames = 12 frames (walk down/left/right/up).
   */
  generatePlayerSprite(key, frameW, frameH) {
    const cols = 3;
    const rows = 4;
    const texture = this.textures.createCanvas(key, cols * frameW, rows * frameH);
    const ctx = texture.getContext();

    const colors = {
      hair: '#3a2a1a',
      skin: '#d8a878',
      body: '#4a4a8a',
      legs: '#3a3a5a',
      outline: '#1a1a1a'
    };

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const ox = col * frameW;
        const oy = row * frameH;

        // Walk offset (frames 0 and 2 have leg offset, frame 1 is standing)
        const legOffset = col === 0 ? -1 : col === 2 ? 1 : 0;

        // Clear frame
        ctx.clearRect(ox, oy, frameW, frameH);

        // Head (rows 0-5)
        ctx.fillStyle = colors.skin;
        ctx.fillRect(ox + 4, oy + 0, 8, 6);
        ctx.fillStyle = colors.hair;
        ctx.fillRect(ox + 3, oy + 0, 10, 3);

        // Body (rows 6-14)
        ctx.fillStyle = colors.body;
        ctx.fillRect(ox + 3, oy + 6, 10, 8);

        // Legs (rows 15-23) — offset based on walk frame
        ctx.fillStyle = colors.legs;
        ctx.fillRect(ox + 4, oy + 14 + legOffset, 3, 8);
        ctx.fillRect(ox + 9, oy + 14 - legOffset, 3, 8);

        // Outline (simple)
        ctx.strokeStyle = colors.outline;
        ctx.lineWidth = 1;
        ctx.strokeRect(ox + 0.5, oy + 0.5, frameW - 1, frameH - 1);

        // Register this frame with Phaser (frame index = row * cols + col)
        const frameIndex = row * cols + col;
        texture.add(frameIndex, 0, ox, oy, frameW, frameH);
      }
    }

    texture.refresh();
  }
}