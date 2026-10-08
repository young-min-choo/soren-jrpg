import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { SaveSystem } from '../game/SaveSystem.js';
import { JOBS } from '../game/JobData.js';
import { ITEMS } from '../game/ItemData.js';
import { getEquip } from '../game/EquipmentData.js';
import { getActiveStatuses, STATUS_EFFECTS } from '../game/StatusEffectData.js';

/**
 * MenuScene — main menu overlay (launched on top of field scenes).
 * Options: Status, Items, Jobs, Save, Load, Resume.
 * Opened by pressing X (or Escape) in overworld/town/dungeon.
 */

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(data) {
    this.domElements = [];
    this.parentScene = data?.parentScene || 'Overworld';
    this.menuState = 'main'; // main → sub-menus
    this.selectedIndex = 0;
    this.subIndex = 0;
    this.container = document.getElementById('game-container');

    // Dark overlay
    this.overlayDiv = document.createElement('div');
    this.overlayDiv.style.cssText = `
      position: absolute; left: 0; top: 0;
      width: 768px; height: 672px;
      background: rgba(0, 0, 0, 0.6);
      z-index: 100; pointer-events: none;
    `;
    this.container.appendChild(this.overlayDiv);
    this.domElements.push(this.overlayDiv);

    // Menu panel
    this.menuDiv = document.createElement('div');
    this.menuDiv.style.cssText = `
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: 600px; max-height: 580px;
      background: rgba(20, 20, 50, 0.95); border: 2px solid rgba(255,255,255,0.3);
      padding: 20px; box-sizing: border-box;
      font-family: "VT323", monospace; color: #ffffff;
      z-index: 101; pointer-events: none;
      border-radius: 6px; overflow: hidden;
    `;
    this.container.appendChild(this.menuDiv);
    this.domElements.push(this.menuDiv);

    // Keyboard handler
    this.handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          this.navigateUp();
          e.preventDefault(); break;
        case 'ArrowDown': case 's': case 'S':
          this.navigateDown();
          e.preventDefault(); break;
        case 'ArrowLeft': case 'a': case 'A':
          this.navigateLeft();
          e.preventDefault(); break;
        case 'ArrowRight': case 'd': case 'D':
          this.navigateRight();
          e.preventDefault(); break;
        case 'z': case 'Z': case 'Enter':
          this.confirm();
          e.preventDefault(); break;
        case 'x': case 'X': case 'Escape':
          this.cancel();
          e.preventDefault(); break;
      }
    };
    window.addEventListener('keydown', this.handleKeyDown);

    this.events.on('shutdown', () => {
      window.removeEventListener('keydown', this.handleKeyDown);
      this.domElements.forEach(el => el.remove());
      this.domElements = [];
    });

    this.updateMenu();
  }

  update() {}

  navigateUp() {
    if (this.menuState === 'main') {
      const items = this._mainItems();
      this.selectedIndex = (this.selectedIndex - 1 + items.length) % items.length;
    } else if (this.menuState === 'save' || this.menuState === 'load') {
      const slots = this._saveSlots();
      this.subIndex = (this.subIndex - 1 + slots.length) % slots.length;
    } else if (this.menuState === 'party') {
      const party = GameState.getParty();
      this.subIndex = (this.subIndex - 1 + party.length) % party.length;
    } else if (this.menuState === 'equip_member') {
      const party = GameState.getParty();
      this.subIndex = (this.subIndex - 1 + party.length) % party.length;
    } else if (this.menuState === 'equip_slot') {
      const slots = ['weapon', 'armor', 'accessory'];
      this.subIndex = (this.subIndex - 1 + slots.length) % slots.length;
    } else if (this.menuState === 'equip_item') {
      const opts = this._equipOptions();
      if (opts.length > 0) this.subIndex = (this.subIndex - 1 + opts.length) % opts.length;
    }
    this.updateMenu();
  }

  navigateDown() {
    if (this.menuState === 'main') {
      const items = this._mainItems();
      this.selectedIndex = (this.selectedIndex + 1) % items.length;
    } else if (this.menuState === 'save' || this.menuState === 'load') {
      const slots = this._saveSlots();
      this.subIndex = (this.subIndex + 1) % slots.length;
    } else if (this.menuState === 'party') {
      const party = GameState.getParty();
      this.subIndex = (this.subIndex + 1) % party.length;
    } else if (this.menuState === 'equip_member') {
      const party = GameState.getParty();
      this.subIndex = (this.subIndex + 1) % party.length;
    } else if (this.menuState === 'equip_slot') {
      const slots = ['weapon', 'armor', 'accessory'];
      this.subIndex = (this.subIndex + 1) % slots.length;
    } else if (this.menuState === 'equip_item') {
      const opts = this._equipOptions();
      if (opts.length > 0) this.subIndex = (this.subIndex + 1) % opts.length;
    }
    this.updateMenu();
  }

  navigateLeft() { this.navigateUp(); }
  navigateRight() { this.navigateDown(); }

  confirm() {
    if (this.menuState === 'main') {
      const items = this._mainItems();
      const action = items[this.selectedIndex];
      if (action === 'Status') {
        this.menuState = 'party';
        this.subIndex = 0;
      } else if (action === 'Items') {
        this.menuState = 'items';
        this.subIndex = 0;
      } else if (action === 'Equip') {
        this.menuState = 'equip_member';
        this.subIndex = 0;
        this.equipSlot = null;
      } else if (action === 'Jobs') {
        this.menuState = 'jobs';
        this.subIndex = 0;
      } else if (action === 'Save') {
        this.menuState = 'save';
        this.subIndex = 0;
      } else if (action === 'Load') {
        this.menuState = 'load';
        this.subIndex = 0;
      } else if (action === 'Resume') {
        this.closeMenu();
      }
    } else if (this.menuState === 'save') {
      const slots = this._saveSlots();
      if (this.subIndex < 3) {
        const gs = GameState.get();
        gs.scene = this.parentScene;
        SaveSystem.save(this.subIndex, gs);
        this.menuState = 'main';
      }
    } else if (this.menuState === 'load') {
      const slots = this._saveSlots();
      if (this.subIndex < 3 && !slots[this.subIndex].empty) {
        const data = SaveSystem.load(this.subIndex);
        if (data) {
          // Restore state — need to reload the scene
          // For now, just close menu. Full load requires scene restart.
          this._applyLoadedState(data);
        }
      }
    } else if (this.menuState === 'party' || this.menuState === 'items' || this.menuState === 'jobs') {
      // Sub-screens are view-only for now
      this.menuState = 'main';
    } else if (this.menuState === 'equip_member') {
      this.equipMemberIndex = this.subIndex;
      this.menuState = 'equip_slot';
      this.subIndex = 0;
    } else if (this.menuState === 'equip_slot') {
      this.menuState = 'equip_item';
      this.equipSlot = ['weapon', 'armor', 'accessory'][this.subIndex];
      this.subIndex = 0;
    } else if (this.menuState === 'equip_item') {
      const opts = this._equipOptions();
      const pick = opts[this.subIndex];
      if (pick) {
        if (pick.remove) {
          GameState.unequip(this.equipMemberIndex, this.equipSlot);
        } else {
          GameState.equip(this.equipMemberIndex, this.equipSlot, pick.name);
        }
        this.menuState = 'equip_slot'; // stay on slots, show updated gear
        this.subIndex = ['weapon', 'armor', 'accessory'].indexOf(this.equipSlot);
      }
    }
    this.updateMenu();
  }

  cancel() {
    if (this.menuState === 'main') {
      this.closeMenu();
    } else if (this.menuState === 'equip_item') {
      this.menuState = 'equip_slot';
      this.subIndex = ['weapon', 'armor', 'accessory'].indexOf(this.equipSlot);
    } else if (this.menuState === 'equip_slot') {
      this.menuState = 'equip_member';
      this.subIndex = this.equipMemberIndex || 0;
    } else if (this.menuState === 'equip_member') {
      this.menuState = 'main';
      this.selectedIndex = 0;
    } else {
      this.menuState = 'main';
      this.selectedIndex = 0;
    }
    this.updateMenu();
  }

  closeMenu() {
    this.scene.stop();
    const parent = this.scene.manager.getScene(this.parentScene);
    if (parent && !parent.scene.isActive()) {
      this.scene.resume(this.parentScene);
    }
  }

  _mainItems() {
    return ['Status', 'Items', 'Equip', 'Jobs', 'Save', 'Load', 'Resume'];
  }

  /** Options for the current equip slot: owned items of that slot type. */
  _equipOptions() {
    if (this.equipSlot == null) return [];
    const owned = GameState.getOwnedEquipment();
    const eq = GameState.getParty()[this.equipMemberIndex].equipment || {};
    const opts = [];
    // "Remove" option when something is equipped
    if (eq[this.equipSlot]) opts.push({ remove: true, label: '(remove)' });
    Object.entries(owned).forEach(([name, qty]) => {
      const def = getEquip(name);
      if (!def || def.type !== this.equipSlot) return;
      opts.push({ name, label: `${name} x${qty}`, desc: def.description });
    });
    return opts;
  }

  _saveSlots() {
    return SaveSystem.getSaveSlots();
  }

  _applyLoadedState(data) {
    const gs = GameState.get();
    Object.keys(gs).forEach(key => {
      if (data[key] !== undefined) {
        gs[key] = data[key];
      }
    });
    // Stop all running scenes except Boot, then start the saved scene
    this.scene.stop();
    const sceneManager = this.scene.manager;
    ['Overworld', 'Town', 'Dungeon', 'Dialogue', 'Battle'].forEach(sceneKey => {
      const scene = sceneManager.getScene(sceneKey);
      if (scene && scene.scene.isActive()) sceneManager.stop(sceneKey);
    });
    sceneManager.start(data.scene || 'Overworld');
  }

  updateMenu() {
    if (!this.menuDiv) return;

    const partyColors = ['#4488ff', '#ff8844', '#44ff88', '#ff44ff'];
    const partyInitials = ['S', 'A', 'K', '?'];
    // display name → portrait art key (menu avatar); mirrors PortraitKeys.SPEAKER_MAP
    // but readable synchronously here ( PortraitKeys imports GameState — fine too,
    // kept local to avoid a circular-ish import through the render path).
    const SPEAKER_NAME_TO_KEY = {
      'Aria': 'aria', 'Kael': 'kael', 'Aldric': 'aldric',
    };

    if (this.menuState === 'main') {
      const items = this._mainItems();
      const party = GameState.getParty();
      let html = '<div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">';
      // Party portraits — real 48x48 portrait art (Phase 10 fix: the colored
      // initial boxes predated the portrait pipeline; portraits have been
      // loading as portrait_* textures since Phase 9). Fallback = initial box.
      party.forEach((char, i) => {
        const color = partyColors[i % partyColors.length];
        const initial = char.name[0] || '?';
        const hpPct = Math.max(0, (char.hp / char.maxHp) * 100);
        const hpColor = hpPct > 50 ? '#44dd44' : hpPct > 25 ? '#ddaa44' : '#dd4444';
        const isHero = i === 0;
        const pKey = isHero ? 'soren' : (SPEAKER_NAME_TO_KEY[char.name] || null);
        const tex = pKey && this.textures.exists(`portrait_${pKey}`) ? this.textures.get(`portrait_${pKey}`) : null;
        let avatar;
        if (tex) {
          // draw to an offscreen canvas → dataURL (innerHTML-inserted canvases
          // come back blank — drawImage content isn't serialized by outerHTML)
          // Face-anchored crop (64x64 busts): 8-92% × 20-88% — face centered,
          // cuts the empty halo above the hair.
          const c = document.createElement('canvas');
          c.width = 32; c.height = 32;
          const g = c.getContext('2d');
          g.imageSmoothingEnabled = false;
          const src = tex.getSourceImage();
          g.drawImage(src, src.width * 0.08, src.height * 0.20, src.width * 0.84, src.height * 0.68, 0, 0, 32, 32);
          avatar = `<img src="${c.toDataURL()}" style="width:32px;height:32px;border-radius:4px;border:1px solid rgba(255,255,255,0.3);image-rendering:pixelated;flex-shrink:0" alt="">`;
        } else {
          avatar = `<div style="width:32px;height:32px;border-radius:4px;background:${color};display:flex;align-items:center;justify-content:center;font-size: 26px;font-weight:bold;color:#fff;text-shadow:1px 1px 2px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.3)">${initial}</div>`;
        }
        html += `<div style="display:flex;align-items:center;gap:6px;flex:1">
          ${avatar}
          <div style="flex:1;font-size: 14px">
            <div style="color:#fff;font-weight:bold">${char.name}</div>
            <div style="color:#aaa">${char.job} Lv.${char.level}</div>
            <div style="color:#ccc">HP ${char.hp}/${char.maxHp}</div>
            <div style="height:3px;background:#330000;width:60px;margin:1px 0;border-radius:2px"><div style="height:3px;background:${hpColor};width:${hpPct}%;border-radius:2px"></div></div>
          </div>
        </div>`;
      });
      html += '</div>';
      html += '<div style="border-top:1px solid rgba(255,255,255,0.2);padding-top:12px"></div>';
      // Menu items
      items.forEach((item, i) => {
        const sel = i === this.selectedIndex;
        const prefix = sel ? '▶' : '　';
        const color = sel ? '#ffff00' : '#ccc';
        html += `<div style="color:${color};font-size: 20px;margin:6px 0"><span style="display:inline-block;width:16px">${prefix}</span>${item}</div>`;
      });
      html += '<div style="color:#888;font-size: 14px;margin-top:12px">Z: Select | X: Close</div>';
      this.menuDiv.innerHTML = html;
      return;
    }

    if (this.menuState === 'party') {
      const party = GameState.getParty();
      let html = '<div style="font-size: 22px;color:#ffff00;margin-bottom:12px">Party Status</div>';
      party.forEach((char, i) => {
        const sel = i === this.subIndex;
        const prefix = sel ? '▶' : '　';
        const color = sel ? '#ffff00' : '#ccc';
        const jp = (char.jp && char.jp[char.job]) || 0;
        const abilities = char.learnedAbilities[char.job] || [];
        html += `<div style="color:${color};font-size: 18px;margin:8px 0;padding:6px;border:1px solid rgba(255,255,255,0.1);border-radius:3px">`;
        html += `<div style="font-weight:bold;font-size: 20px">${prefix} ${char.name} — ${char.job} Lv.${char.level}</div>`;
        html += `<div style="font-size: 16px;color:#aaa;margin-top:4px">HP: ${char.hp}/${char.maxHp} | MP: ${char.mp}/${char.maxMp} | JP: ${jp}</div>`;
        html += `<div style="font-size: 16px;color:#aaa">ATK ${char.atk} DEF ${char.def} MAG ${char.mag} MDEF ${char.mdef} AGI ${char.agi} LUCK ${char.luck}</div>`;
        html += `<div style="font-size: 14px;color:#888;margin-top:2px">Abilities: ${abilities.join(', ') || 'none'}</div>`;
        html += `</div>`;
      });
      html += '<div style="color:#888;font-size: 14px;margin-top:8px">X: Back</div>';
      this.menuDiv.innerHTML = html;
      return;
    }

    if (this.menuState === 'items') {
      const inv = GameState.getInventory();
      let html = '<div style="font-size: 22px;color:#ffff00;margin-bottom:12px">Items</div>';
      if (inv.length === 0) {
        html += '<div style="color:#888;font-size: 18px">No items.</div>';
      } else {
        inv.forEach((item, i) => {
          const sel = i === this.subIndex;
          const prefix = sel ? '▶' : '　';
          const color = sel ? '#ffff00' : '#ccc';
          const def = ITEMS[item.name];
          const desc = def ? def.description : '';
          html += `<div style="color:${color};font-size: 18px;margin:4px 0"><span style="display:inline-block;width:16px">${prefix}</span>${item.name} x${item.qty} — <span style="font-size: 14px;color:#888">${desc}</span></div>`;
        });
      }
      html += '<div style="color:#888;font-size: 14px;margin-top:8px">X: Back</div>';
      this.menuDiv.innerHTML = html;
      return;
    }

    if (this.menuState === 'jobs') {
      const party = GameState.getParty();
      const unlocked = GameState.get().unlockedJobs;
      let html = '<div style="font-size: 22px;color:#ffff00;margin-bottom:12px">Jobs</div>';
      party.forEach((char, i) => {
        const sel = i === this.subIndex;
        const prefix = sel ? '▶' : '　';
        const color = sel ? '#ffff00' : '#ccc';
        const jp = (char.jp && char.jp[char.job]) || 0;
        html += `<div style="color:${color};font-size: 18px;margin:6px 0">${prefix} ${char.name} — ${char.job} (${jp} JP) | Lv.${char.level}</div>`;
      });
      html += `<div style="font-size: 16px;color:#aaa;margin-top:12px">Unlocked: ${unlocked.join(', ')}</div>`;
      html += '<div style="color:#888;font-size: 14px;margin-top:8px">Visit Job Master in town to change jobs or learn abilities.</div>';
      html += '<div style="color:#888;font-size: 14px;margin-top:8px">X: Back</div>';
      this.menuDiv.innerHTML = html;
      return;
    }

    if (this.menuState === 'equip_member') {
      const party = GameState.getParty();
      let html = '<div style="font-size: 22px;color:#ffff00;margin-bottom:12px">Equip — Choose a member</div>';
      party.forEach((char, i) => {
        const sel = i === this.subIndex;
        const prefix = sel ? '▶' : '　';
        const color = sel ? '#ffff00' : '#ccc';
        const eq = char.equipment || {};
        html += `<div style="color:${color};font-size: 18px;margin:6px 0">${prefix} ${char.name} — ${char.job} <span style="font-size: 14px;color:#888">[${eq.weapon || '—'} / ${eq.armor || '—'} / ${eq.accessory || '—'}]</span></div>`;
      });
      html += '<div style="color:#888;font-size: 14px;margin-top:8px">Z: Select | X: Back</div>';
      this.menuDiv.innerHTML = html;
      return;
    }

    if (this.menuState === 'equip_slot') {
      const char = GameState.getParty()[this.equipMemberIndex];
      const slots = ['weapon', 'armor', 'accessory'];
      let html = `<div style="font-size: 22px;color:#ffff00;margin-bottom:12px">Equip — ${char.name}</div>`;
      slots.forEach((slot, i) => {
        const sel = i === this.subIndex;
        const prefix = sel ? '▶' : '　';
        const color = sel ? '#ffff00' : '#ccc';
        const current = char.equipment[slot] || '—';
        html += `<div style="color:${color};font-size: 18px;margin:6px 0">${prefix} ${slot}: ${current}</div>`;
      });
      html += '<div style="color:#888;font-size: 14px;margin-top:8px">Z: Change | X: Back</div>';
      this.menuDiv.innerHTML = html;
      return;
    }

    if (this.menuState === 'equip_item') {
      const char = GameState.getParty()[this.equipMemberIndex];
      const opts = this._equipOptions();
      let html = `<div style="font-size: 22px;color:#ffff00;margin-bottom:12px">Equip ${this.equipSlot} — ${char.name}</div>`;
      if (opts.length === 0) {
        html += '<div style="color:#888;font-size: 18px">Nothing owned to equip.</div>';
      } else {
        opts.forEach((opt, i) => {
          const sel = i === this.subIndex;
          const prefix = sel ? '▶' : '　';
          const color = sel ? '#ffff00' : '#ccc';
          const desc = opt.remove ? 'unequip current' : opt.desc;
          html += `<div style="color:${color};font-size: 18px;margin:4px 0">${prefix} ${opt.label} <span style="font-size: 14px;color:#888">${desc}</span></div>`;
        });
      }
      html += '<div style="color:#888;font-size: 14px;margin-top:8px">Z: Equip | X: Back</div>';
      this.menuDiv.innerHTML = html;
      return;
    }

    if (this.menuState === 'save' || this.menuState === 'load') {
      const isSave = this.menuState === 'save';
      const slots = this._saveSlots();
      const party = GameState.getParty();
      const partyColors = ['#4488ff', '#ff8844', '#44ff88', '#ff44ff'];
      let html = `<div style="font-size: 22px;color:#ffff00;margin-bottom:12px">${isSave ? 'Save' : 'Load'} Game</div>`;
      // Show party portraits row — real art (same face-crop as main menu)
      html += '<div style="display:flex;gap:6px;margin-bottom:12px;justify-content:center">';
      party.forEach((char, i) => {
        const color = partyColors[i % partyColors.length];
        const initial = char.name[0] || '?';
        const pKey = i === 0 ? 'soren' : (SPEAKER_NAME_TO_KEY[char.name] || null);
        const tex = pKey && this.textures.exists(`portrait_${pKey}`) ? this.textures.get(`portrait_${pKey}`) : null;
        if (tex) {
          const c = document.createElement('canvas');
          c.width = 28; c.height = 28;
          const g = c.getContext('2d');
          g.imageSmoothingEnabled = false;
          g.drawImage(tex.getSourceImage(), 64 * 0.08, 64 * 0.20, 64 * 0.84, 64 * 0.68, 0, 0, 28, 28);
          html += `<img src="${c.toDataURL()}" style="width:28px;height:28px;border-radius:4px;border:1px solid rgba(255,255,255,0.3);image-rendering:pixelated" alt="">`;
        } else {
          html += `<div style="width:28px;height:28px;border-radius:4px;background:${color};display:flex;align-items:center;justify-content:center;font-size: 20px;font-weight:bold;color:#fff;border:1px solid rgba(255,255,255,0.3)">${initial}</div>`;
        }
      });
      html += '</div>';
      slots.forEach((slot, i) => {
        const sel = i === this.subIndex;
        const prefix = sel ? '▶' : '　';
        const color = sel ? '#ffff00' : '#ccc';
        if (slot.empty) {
          html += `<div style="color:${color};font-size: 18px;margin:6px 0"><span style="display:inline-block;width:16px">${prefix}</span>Slot ${i + 1}: <span style="color:#666">Empty</span></div>`;
        } else {
          html += `<div style="color:${color};font-size: 18px;margin:6px 0"><span style="display:inline-block;width:16px">${prefix}</span>Slot ${i + 1}: ${slot.name} Lv.${slot.level} ${slot.gold}G — <span style="font-size: 14px;color:#888">${slot.timeText}</span></div>`;
        }
      });
      html += '<div style="color:#888;font-size: 14px;margin-top:8px">Z: Confirm | X: Back</div>';
      this.menuDiv.innerHTML = html;
      return;
    }
  }
}