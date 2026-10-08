import Phaser from 'phaser';
import battleManifest from '../game/battle-sprite-manifest.json';
import npcManifest from '../game/npc-sprite-manifest.json';
import npcSheetManifest from '../game/npc-sheet-manifest.json';
import portraitManifest from '../game/portrait-sprite-manifest.json';

/**
 * BootScene — generates placeholder assets, then transitions to Title.
 * In Phase 1, we generate simple colored tilesets and a player sprite
 * programmatically so we don't need external asset files yet.
 *
 * Phase 9 (design pass): if public/sprites/soren_field_sheet.png exists,
 * load it as the player_field texture (12 frames, 16×24 each) instead of
 * the programmatic placeholder. Same frame layout: 3 cols × 4 rows
 * (down/up/left/right × walk-left/stand/walk-right).
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  init() {
    // Phase 9: real sprites override placeholders when present
    if (window.fetch) {
      // synchronous check not possible for images; use load.image in preload
    }
  }

  preload() {
    // Phase 9: AI-generated player spritesheet (12 frames) if present
    this.load.image('player_field_sheet', 'sprites/soren_field_sheet.png');
    // Phase 9: AI-generated overworld tileset strip (10 tiles × 32px) if present
    this.load.image('ow_tiles_sheet', 'sprites/overworld_tiles.png');
    // Phase 9: AI battle sprites (enemy + party) from the generated manifest.
    // Missing files don't load (textures.exists() returns false) and
    // BattleScene falls back to placeholder rectangles.
    // NOTE: loaded by ART KEY (soren_battle etc.), not display name — the
    // hero can be renamed in the new-game flow; his art key is stable.
    battleManifest.enemies.forEach((key) => {
      this.load.image(`bsprite_${key}`, `sprites/battle/${key}.png`);
    });
    // Party art files, keyed by ART KEY (manifest 'party' maps display-name → art key)
    Object.values(battleManifest.party).forEach((key) => {
      this.load.image(`bsprite_${key}`, `sprites/battle/${key}.png`);
    });
    // Phase 10: battle ACTION sheets (48×96, 12+ frames of 16×24, same grid
    // as field sheets but generated WITH weapons/cast poses). Party members
    // with a sheet get real animated gestures (cast raise, slash lunge);
    // the rest fall back to single-pose images. Consumed by BattleScene.
    ['soren_battle', 'aria_battle', 'kael_battle'].forEach((key) => {
      this.load.spritesheet(`battlesheet_${key}`, `sprites/battle/sheets/${key}.png`,
        { frameWidth: 16, frameHeight: 24, endFrame: 12 });
    });
    // Phase 10b: FE-proportioned i2i frames (Choo's art call). 2-frame pair
    // sheet (104x72, frames 104x72: stand + swing) — if present, the hero
    // battle sprite becomes an FE-style FE-scale figure (52x72 at 2x display).
    this.load.spritesheet('fesheet_soren_battle', 'sprites/battle/fe_soren_pair.png',
      { frameWidth: 52, frameHeight: 72, endFrame: 2 });
    // Phase 9: themed tileset strips (fallback to programmatic if missing)
    ['town_tiles', 'dgn_ember', 'dgn_tide', 'dgn_hollow', 'dgn_spire', 'dgn_ruins'].forEach((key) => {
      this.load.image(`${key}_ai`, `sprites/tiles/${key}.png`);
    });
    // Phase 9: NPC field sprites (16×24) + dialogue portraits (48×48).
    // Keyed by stable art key (npcKey from WorldData), never display name.
    npcManifest.npcs.forEach((key) => {
      this.load.image(`npc_${key}`, `sprites/npc/${key}.png`);
    });
    // Phase 10: NPC walk sheets (48×96, 12 frames of 16×24 — same layout as
    // player_field). Loaded from an explicit manifest so a sheet missing on
    // disk never 404s; keys without a sheet keep the static npc_<key> image.
    npcSheetManifest.npc_sheets.forEach((key) => {
      this.load.spritesheet(`npc_sheet_${key}`, `sprites/npc_sheets/${key}.png`,
        { frameWidth: 16, frameHeight: 24, endFrame: 12 });
    });
    portraitManifest.portraits.forEach((key) => {
      this.load.image(`portrait_${key}`, `sprites/portraits/${key}.png`);
    });
  }

  create() {
    // If the real spritesheet loaded, slice it into 12 named frames with the
    // same indices the game expects (row * 3 + col; rows: 0=down,1=left,2=right,3=up)
    if (this.textures.exists('player_field_sheet') && this.textures.get('player_field_sheet').source[0].width > 8) {
      const sheetTex = this.textures.get('player_field_sheet');
      const frameW = 16, frameH = 24;
      const cols = 3, rows = 4;
      const tex = this.textures.createCanvas('player_field', cols * frameW, rows * frameH);
      const ctx = tex.getContext();
      // Blit the loaded sheet directly into the canvas texture
      const sheetImage = sheetTex.source[0].image;
      ctx.drawImage(sheetImage, 0, 0);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const frameIndex = row * cols + col;
          tex.add(frameIndex, 0, col * frameW, row * frameH, frameW, frameH);
        }
      }
      tex.refresh();
    } else {
      this.generatePlayerSprite('player_field', 16, 24);
    }

    // Phase 9: AI-generated overworld tiles (10 tiles) replace the solid-color set
    if (this.textures.exists('ow_tiles_sheet') && this.textures.get('ow_tiles_sheet').source[0].width >= 320) {
      const sheetTex = this.textures.get('ow_tiles_sheet');
      const TS = 32;
      const count = 10;
      const tex = this.textures.createCanvas('overworld_tiles', count * TS, TS);
      const ctx = tex.getContext();
      ctx.drawImage(sheetTex.source[0].image, 0, 0);
      for (let i = 0; i < count; i++) {
        tex.add(i, 0, i * TS, 0, TS, TS);
      }
      tex.refresh();
    } else {
      this.generateTileset('overworld_tiles', 32, [
        '#3a5f3a', // 0: grass (dark green)
        '#4a7f4a', // 1: grass (light green)
        '#6b8f4a', // 2: forest
        '#8a8a7a', // 3: mountain
        '#4a6a8a', // 4: water
        '#c8c8a8', // 5: path/dirt
        '#aa8855', // 6: bridge
        '#d8c8a0', // 7: desert
        '#e8e8f0', // 8: snow
        '#6a7a5a', // 9: swamp
      ]);
    }

    // Phase 9: AI town/dungeon tiles replace the solid-color set when present
    if (this.textures.exists('town_tiles_ai') && this.textures.get('town_tiles_ai').source[0].width >= 320) {
      const sheetTex = this.textures.get('town_tiles_ai');
      const TS = 32;
      const count = 10;
      const tex = this.textures.createCanvas('town_tiles', count * TS, TS);
      const ctx = tex.getContext();
      ctx.drawImage(sheetTex.source[0].image, 0, 0);
      for (let i = 0; i < count; i++) {
        tex.add(i, 0, i * TS, 0, TS, TS);
      }
      tex.refresh();
      // Per-theme dungeon strips: 10 tiles each (-floor, wall, hazard, door, chest, save, boss, block, switch, exit)
      // mapped onto the dungeon tile indices (floor=0, wall=1, hazard=2, door=4, chest=3)
      ['dgn_ember', 'dgn_tide', 'dgn_hollow', 'dgn_spire', 'dgn_ruins'].forEach((theme) => {
        const aiKey = `${theme}_ai`;
        const stripW = this.textures.exists(aiKey) ? this.textures.get(aiKey).source[0].width : 0;
        if (!this.textures.exists(aiKey) || stripW < 160) return;
        const tenTiles = stripW >= 320; // D0: specials appended (save/boss/block/switch/exit)
        const twelveTiles = stripW >= 384; // D: floor variants appended (10=crack, 11=moss)
        const src = this.textures.get(aiKey).source[0].image;
        const t = this.textures.createCanvas(theme, twelveTiles ? 12 * TS : 10 * TS, TS);
        const c = t.getContext();
        // dungeon tile indices: 0=floor 1=wall 2=hazard 3=chest 4=door 5=save 6=boss 7=block 8=switch 9=exit
        // strip order (first 5):  0=floor 1=wall 2=hazard 3=door 4=chest
        // strip order (D0 ten):  5=save 6=boss 7=block 8=switch 9=exit map 1:1
        const stripIdx = tenTiles
          ? { 0: 0, 1: 1, 2: 2, 4: 3, 3: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9 }
          : { 0: 0, 1: 1, 2: 2, 4: 3, 3: 4 };
        for (let dungeonIdx = 0; dungeonIdx < 10; dungeonIdx++) {
          const s = stripIdx[dungeonIdx];
          if (s !== undefined) {
            c.drawImage(src, s * TS, 0, TS, TS, dungeonIdx * TS, 0, TS, TS);
          } else {
            // tiles without AI art: leave transparent — scenes can fall back
            c.clearRect(dungeonIdx * TS, 0, TS, TS);
          }
          // register real frames so scenes can use add.image(key, frame) for specials
          t.add(dungeonIdx, 0, dungeonIdx * TS, 0, TS, TS);
        }
        if (twelveTiles) {
          // D: floor variant tiles live at strip indices 10/11 = tilemap frames 10/11
          for (const vi of [10, 11]) {
            c.drawImage(src, vi * TS, 0, TS, TS, vi * TS, 0, TS, TS);
            t.add(vi, 0, vi * TS, 0, TS, TS);
          }
        }
        t.refresh();
      });
    } else {
      this.generateTileset('town_tiles', 32, [
      '#8a8a8a', // 0: stone floor (gray)
      '#6a6a6a', // 1: stone wall
      '#c8c8c8', // 2: path
      '#5a5a5a', // 3: building wall
      '#3a3a3a', // 4: building roof
      '#8a6a4a', // 5: wood floor / save point
      '#4a4a6a', // 6: dungeon door (locked)
      '#aa3333', // 7: boss tile
      '#44aa44', // 8: dungeon exit
      '#5566aa', // 9: exit marker (post-boss)
      ]);
    }

    this.scene.start('Title');
    // Phase 9: start the persistent music manager (registered first in the
    // scene list so it can observe all scene starts, but not auto-started)
    if (!this.scene.manager.keys['MusicManager'] || !this.scene.isActive('MusicManager')) {
      this.scene.launch('MusicManager');
    }
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