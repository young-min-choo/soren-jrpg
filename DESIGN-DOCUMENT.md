# DESIGN DOCUMENT — Untitled JRPG
**Version:** 1.0
**Last Updated:** 2026-07-20
**Status:** Design complete — ready for build phase

---

## 1. PURPOSE & SCOPE

### Purpose
A traditional turn-based JRPG in the lineage of Final Fantasy 1-3 and Golden Sun, featuring a job system, field puzzles, choice-driven narrative, and a bittersweet story about moral complexity. Built progressively using the Gothicvania method: design document + agent skills + progressive prompting.

### In Scope
- Phaser 3 engine, 256×224 resolution, pixel-perfect rendering, web desktop-first
- Connected overworld with 5-6 towns, 4-6 dungeons, 1-2 optional areas
- Turn-based combat (agility order, Fight/Magic/Item/Defend/Flee + job abilities)
- Job system: 4 starting + 8 unlockable jobs, FF3-style free change in town
- Party of 4 (Soren + thief + monk-healer + party knight), drops to 3 after betrayal
- Full questline: prophecy → relics → mid-game revelation → betrayal → finale
- Dialogue choices with branching story texture
- Field puzzles in dungeons (push blocks, switches, psynergy-style abilities)
- ~20-25 unique enemy types with stat variations, ~5-7 phase bosses with mechanics
- Save system: 3 slots + autosave, save points in dungeons, save anywhere in towns/overworld
- ~15-18 music tracks (GBA-era synth), full SFX set
- GBA-style pixel art, side-view battles, FFTA-style portraits, Fire Emblem GBA aesthetic
- Keyboard + basic gamepad support, 4-directional movement, sprint
- Level cap 50, gold, shops, inns, equipment, items
- Status effects: Poison, Silence, Sleep, Blind, Stun, KO
- Airship for late-game overworld access

### Out of Scope (v1)
- Tactical grid combat (chose traditional JRPG)
- Multiplayer / online
- Procedural generation (all content hand-designed)
- Voice acting (text-only)
- Full orchestral soundtrack (GBA synth only)
- Custom AI-generated sprites (using curated free asset packs)
- Mobile touch controls (desktop-first)
- Inventory weight / encumbrance
- Crafting system
- New Game+
- Post-game / superbosses
- Day/night cycle
- Weather system
- Side quests (main quest only for v1)
- Branching job trees (jobs are flat, not branching)

---

## 2. TECHNICAL FOUNDATION

| Property | Value |
|---|---|
| Engine | Phaser 3 |
| Internal resolution | 256×224 (SNES) |
| Rendering | `image-rendering: pixelated`, integer scaling (×3/×4), no anti-aliasing |
| Platform | Web browser, desktop-first |
| Architecture | Data-driven JSON + scene-based (Phaser scenes) |
| Save system | localStorage (key-value), 3 slots + autosave |

### Systems Architecture

| System | Implementation |
|---|---|
| Scene Manager | Phaser scenes: Overworld, Battle, Menu, Dialogue, Cutscene, Title |
| Entity Data | JSON data files (player characters, enemies, items, spells, jobs) |
| Tilemap | Tiled map editor → exported JSON, loaded by Phaser |
| Event/Script System | Custom event scripting in JSON (cutscenes, triggers, quest flags) |
| Combat Engine | Custom state machine reading entity data |
| Job System | Data table + logic for class changes and ability learning |
| Puzzle System | Tilemap interaction layer on dungeon scenes |
| Save System | localStorage, autosave on scene change |

---

## 3. STORY / NARRATIVE

### Setting
Fantasy world with remnants of lost ancient technology — relics, ruins, forgotten power sources.

### Tone
Intimate scale, meaningful choices that branch the story, bittersweet undertones. Not "save the world" bombast — personal stakes, moral complexity.

### Theme
No pure good or evil. Everyone has reasons and experiences that lead them to wherever they are, either for you or against you.

### Central Plot
A boy hears prophecies and omens about ancient artifacts, discovers one, and sets out to find the others. The artifact hunt is the spine, but the real story is about the people around him and the truths that unravel along the way.

### Plot Progression
1. Soren hears prophecy → discovers first relic → meets party knight
2. Party forms: thief (sister subplot) + "white mage" (actually monk) + party knight
3. Hunt relics across towns and dungeons
4. **Mid-game revelation:** only the chosen one (Soren) can activate the relics
5. Party knight's plan sharpens — he needs Soren to activate the full set
6. Disgraced knight defeated (visible antagonist, was a pawn)
7. **Party knight reveals himself** — takes activated relics
8. **Conduit opens** — not his lost love, but an unseen force (sequel hook, Option C)
9. Finale with 3-member party vs party knight

### Characters

#### Protagonist — Soren (default, player-renameable)
- Age: 16
- Personality: Introspective, cautious, yet curious. Grows through player decisions.
- Blank slate at start → starting job choice assigns stats + light story texture
- Name customizable via name entry screen

#### Party Members

| Character | Presented as | True nature |
|---|---|---|
| **Party Knight** | Loyal, steadfast knight who joins early | **The true villain.** Manipulates party into collecting relics. Motivation: resurrect his lost love who died of sickness while he was at war — the country he fought for didn't help her. Stays with Soren because only the chosen one can activate the relics (learned mid-game). Plays the long game. |
| **Thief** | Suspicious, seems selfish | Actually doing everything for his sister. Backstory vibes: Fire Emblem Sacred Stones. |
| **"White Mage"** | Presents as a healer | Actually a monk with healing capabilities. Player can figure this out by paying attention. |

#### Antagonist Chain

| Antagonist | Role | Motivation |
|---|---|---|
| **Disgraced Knight** | Visible antagonist, pawn | Former knight who went mad during service. Killed a surrendered enemy soldier in a painful, gratuitous way → discharged in disgrace. Grew more unstable, thirsts for power and control. His "master" (the party knight) fed him info about the relics. Believes he's pursuing them for himself. Genuinely evil, not redeemable, but his madness is almost pitiable — he's being used and doesn't know it. |
| **Party Knight** | True mastermind | Wants to resurrect his lost love using the relics. Commands the disgraced knight from the shadows. |
| **Unseen Forces** | Sequel hook | Mysterious force of good and evil controlling the direction of the story. Only hinted at in this game, to be expanded in sequels. |

### The Manipulation Chain
```
PARTY KNIGHT (real villain)
  │
  ├── commands ──→ DISGRACED KNIGHT (visible antagonist)
  │                  believes he's pursuing relics for
  │                  his own power/eternal life
  │
  └── travels with ──→ SOREN'S PARTY
                        believes they're stopping the
                        disgraced knight and protecting
                        the relics
```

The party knight plays both sides. He told the disgraced knight about the relics to create a visible threat. He joins the party to ensure Soren collects the relics under the guise of "keeping them safe." Once all relics are gathered and activated, he reveals himself and takes them.

### Why It Leads to Chaos (Option C)
The relics don't do what the party knight thinks. The unseen forces embedded something else in them. When activated together, they don't grant a wish — they open a conduit for one of those forces to enter the world. His love isn't what comes back. This sets up the sequel directly.

### Starting Job → Story Texture

| Job | Story angle |
|---|---|
| Warrior | Soren from a guard family; party knight notices his combat instinct and bonds early → betrayal cuts deeper |
| Mage | Soren from scholar/magic background; more attuned to relics' resonance, senses something "off" earlier → foreshadowing |
| Ranger | Soren from the frontier; thief bonds first (outsider-to-outsider) → thief's sister subplot opens earlier |
| Monk | Soren from a monastery; immediately notices the "white mage's" true nature → that reveal happens sooner |

Light touches — a few changed dialogue lines, one early scene that differs, which NPC warms to you first. Not branching plot, just texture.

---

## 4. VISUAL STYLE

| Property | Value |
|---|---|
| Color depth | GBA/SNES-era full color (hundreds of colors, pixel-art aesthetic) |
| Tile size | 32×32 |
| Field sprites | 16×24 (walking around towns/overworld) |
| Battle sprites | 32×32 (side-view combat, animation poses) |
| Battle view | Side-view (party left, enemies right) |
| Portraits | FFTA-style portrait + dialogue box |
| Visual reference | Fire Emblem GBA + FFTA aesthetic |

### Asset Strategy
**Hybrid approach:**
- AI image generation for **concept art and mood boards** during design phase
- Curated **free asset packs** (itch.io, OpenGameArt) for final game assets
- Ensures cohesive, consistent, animation-ready assets without requiring the user to draw

---

## 5. AUDIO

| Property | Value |
|---|---|
| Music style | GBA-era synth (Golden Sun / FFTA feel) |
| Sourcing | Curated free packs (OpenGameArt, itch.io, chiptune communities) |

### Music Track List (~15-18 total)

| Context | Tracks | Phase 1 priority |
|---|---|---|
| Title screen | 1 | ✅ |
| Overworld map | 1-2 | ✅ |
| Town themes | 2-3 | ✅ (1 for demo) |
| Dungeon themes | 2-3 | ✅ (1 for demo) |
| Battle theme (normal) | 1 | ✅ |
| Battle theme (boss) | 1 | Later |
| Battle theme (final) | 1 | Later |
| Cutscene/story | 2-3 | Later |
| Victory fanfare | 1 | ✅ |
| Game over | 1 | Later |
| Ending | 1 | Later |

### SFX List

| Category | SFX |
|---|---|
| UI | Menu navigate, select, cancel, error |
| Combat | Attack swing, hit (physical), magic cast, enemy hit, enemy death |
| Field | Footsteps, door, treasure chest, save point |
| System | Level up, job change, save, load |
| Story | Specific stings for cutscene moments (revelation, betrayal, sadness) |

---

## 6. CONTROLS

### Field Controls

| Action | Key | Notes |
|---|---|---|
| Move | Arrow keys / WASD | 4-directional |
| Interact / Talk / Confirm | Z or Enter | Talk to NPCs, examine, open chests |
| Cancel / Back | X or Esc | Back out of menus, close dialogue |
| Open menu | A or Tab | Party status, inventory, equipment, save |
| Sprint (hold) | Shift | Faster movement |
| Quick-save | S or Q | At save points / towns / overworld |

### Menu Controls

| Action | Key |
|---|---|
| Navigate | Arrows / WASD |
| Select / Confirm | Z or Enter |
| Back / Cancel | X or Esc |
| Tab between sections | Tab / Q / E |

### Battle Controls

| Action | Key |
|---|---|
| Navigate menu | Arrows / WASD |
| Select action | Z or Enter |
| Back / Cancel | X or Esc |
| Target selection | Arrows (up/down for party, left/right for enemy) |

### Gamepad
Basic support — D-pad + buttons mapped to same controls via Phaser Gamepad API.

---

## 7. LEVEL DESIGN

| Property | Value |
|---|---|
| World structure | Connected overworld (one large map, walk to towns/dungeons) |
| Towns | 5-6 (starting town, 2-3 mid-game, 1 major late-game) |
| Dungeons | 4-6 (relic locations, each with field puzzle + boss) |
| Optional areas | 1-2 (side content, hidden items) |
| Overworld style | Slightly elevated/terrain (mountains, rivers, forests as geography) |
| Encounter system | Random encounters (rate configurable per area) |
| Progression gating | Combination — early game story-gated, mid-to-late opens with abilities/airship |

### Dungeon Design Philosophy
Mix of dungeon types for variety:
- **Straightforward** — path through, fight enemies, reach boss, get relic (FF1-3 style)
- **Light puzzles** — 1-2 simple puzzles per dungeon (push block, hit switch)
- **Medium puzzles** — central puzzle mechanic per dungeon, 2-3 puzzles before boss
- **Heavy puzzles** — multi-step puzzles, optional puzzle rooms, puzzle-solved shortcuts (Golden Sun style)

### Encounter Rates
- Overworld: lower encounter rate
- Dungeons: higher encounter rate
- Configurable per area

---

## 8. ENEMIES

### Enemy Categories

| Category | Role | Examples |
|---|---|---|
| Trash mobs | Low HP, simple attacks, easy to kill | Slimes, rats, bats, goblins |
| Spellcasters | Cast offensive magic, low HP | Dark mages, wisps, cultists |
| Bruisers | High HP/ATK, slow, hit hard | Ogres, golems, armored knights |
| Status inflicters | Inflict poison/silence/sleep/blind | Jellyfish, spiders, mushrooms |
| Healers | Heal other enemies, kill first | Priests, fairies, will-o-wisps |
| Counter/retaliation | Punish specific actions | Cactuars, mimics, armored fiends |
| Bosses | Unique, high HP, multiple phases | Dungeon bosses, story bosses |

### Variety
- ~20-25 unique enemy sprites (reused with stat/palette variations for area scaling)
- ~5-7 bosses (one per dungeon + story bosses + final boss)

### AI Behavior
- **Normal enemies:** Weighted random (situation-aware — low HP → heal, player low HP → attack)
- **Bosses:** Scripted patterns (attack, attack, special, repeat) + phase transitions at HP thresholds

### Boss Design
Phase bosses with occasional mechanics (e.g., "only vulnerable after reflect," "counters physical attacks," "must destroy adds first")

### Encounter Formations
Fixed formations — specific enemy combos predefined per area (e.g., "forest encounter = 2-3 slimes or 1 slime + 1 bat")

### Scaling
Per-area stats — each area has its own enemy stat table. Walk into harder area, enemies are stronger. Rewards exploration/leveling naturally.

---

## 9. PLAYER MECHANICS

### Field Mechanics

| Mechanic | Value |
|---|---|
| Movement speed | Normal: 2px/frame, Sprint: 4px/frame |
| Collision | Tile-based (block on solid tiles) |
| Interaction range | 1 tile in facing direction |
| Field puzzles | Push blocks, flip switches, psynergy-style abilities |

### Combat — Turn Order
Agility-based: highest AGI goes first, then descending.

### Combat — Actions

| Action | Description |
|---|---|
| FIGHT | Attack with equipped weapon |
| MAGIC | Cast spells (costs MP) |
| ITEM | Use items (potions, etc.) |
| DEFEND | Halve incoming damage until next turn |
| FLEE | Attempt to escape (fails on bosses) |
| Special abilities | Job-specific skills (e.g., Thief's Steal, Monk's Focus) |

### Combat — Damage Formulas
```
Physical: ATK * (ATK / DEF) * random(0.85–1.15)
Magic:    (MAG * spell_power) / MDEF * random(0.85–1.15)
```

### Job System

**Starting jobs** (chosen at game start, affects story texture):
- Warrior, Mage, Ranger, Monk

**Unlockable jobs** (gained through story progression):
- Knight, Priest, Thief, Berserker, Sage, Paladin, Dark Knight, Ninja

**Mechanics:**
- FF3-style: change jobs freely in town
- Keep learned abilities when switching
- Separate job XP — mastering a job unlocks abilities
- Each job has its own stat growth curve

### Stats

| Stat | Purpose |
|---|---|
| HP | Health. 0 = KO. |
| MP | Magic points. Spells cost MP. |
| ATK | Physical attack power |
| DEF | Physical defense |
| MAG | Magic power (healing + damage) |
| MDEF | Magic defense |
| AGI | Agility (turn order) |
| LUCK | Crit rate, flee success, item drop rate |

### Leveling & Progression

| Mechanic | Value |
|---|---|
| Level cap | 50 |
| XP source | Battles, bosses, key story events |
| Level-up | Stats increase per job's growth curve |
| Job XP | Separate from level XP — mastering a job unlocks abilities |
| Gold | Earned from battles, spent in shops |

### Status Effects

| Effect | Effect |
|---|---|
| Poison | Lose HP each turn, persists after battle, cure with item/magic |
| Silence | Can't cast magic |
| Sleep | Skip turns until hit |
| Blind | Accuracy reduced |
| Stun | Skip next turn |
| KO | 0 HP, must be revived |

---

## 10. GAME STATES

### State List

| State | Description |
|---|---|
| Title | Game logo, "Press Start," load/save select |
| Name Entry | Input Soren's name |
| Job Choice | Pick starting job (Warrior/Mage/Ranger/Monk) |
| Intro Cutscene | Story opening, prophecy, first omen |
| Overworld | Walking the world map, random encounters |
| Town | NPCs, shops, inn, save anywhere |
| Dungeon | Random encounters, puzzles, save points, boss |
| Battle | Turn-based combat |
| Menu | Party status, inventory, equipment, jobs, save |
| Dialogue | NPC conversations, cutscene dialogue (portrait + text box) |
| Cutscene | Scripted story sequences |
| Shop | Buy/sell weapons, armor, items |
| Inn | Rest to restore HP/MP (costs gold) |
| Pause | Game frozen, resume/quit options |
| Game Over | Party wiped → load from last save or quit |
| Victory | Ending sequence + credits |

### State Transition Map
```
Title → New Game → Name Entry → Job Choice → Intro Cutscene → Overworld
Title → Load Save → last position (Overworld/Town/Dungeon)

Overworld ←→ Town
Overworld ←→ Dungeon
Field (Overworld/Town/Dungeon) → Battle (random encounter) → back to field
Field → Menu (press A/Tab) → back to field
Field → Dialogue (talk to NPC) → back to field
Town → Shop → back to Town
Town → Inn → back to Town
Dungeon → Cutscene (story trigger) → back to Dungeon
Any field state → Pause (Esc) → back
Battle → Game Over (party wiped) → Title or Load
Battle → Victory (final boss) → Ending → Credits → Title
```

### Save System

**Slots:** 3 manual slots + autosave

**Save rules:**
- Save anywhere on overworld and in towns
- Save points only in dungeons (Golden Sun hybrid style)

**Saved data:**
- Party members, levels, XP, job levels
- Current job for each character
- HP/MP (current and max)
- Inventory (items, quantities)
- Equipment (weapons, armor)
- Gold
- Player position (map + x/y)
- Story flags (events completed, choices made)
- World state (defeated bosses, opened doors)
- Learned abilities per job

---

## 11. PHASED BUILD PLAN

Each phase ends with something playable. Build progressively, test each phase before moving on.

### Phase 1: Engine Skeleton
- Phaser project setup, config (256×224, pixel-perfect)
- Scene management (Title → Overworld → Town → Dungeon transitions)
- Overworld walking with 4-directional movement + sprint
- Tile-based collision
- Enter-town / enter-dungeon triggers
- **Deliverable:** Walk around an overworld, enter a town, walk around town

### Phase 2: Dialogue System
- Text box rendering (FFTA-style portrait + text)
- Scrolling text, typewriter effect
- NPC interaction (talk in facing direction)
- Branching dialogue choices
- Portrait display
- **Deliverable:** Talk to NPCs in town, see portraits, make choices

### Phase 3: Combat Prototype
- Battle scene (side-view layout)
- Enemy display (right side)
- Party menu (left side)
- Turn order (agility-based)
- Actions: Fight, Magic, Item, Defend, Flee
- Damage calculation
- Win/lose conditions
- Victory fanfare + game over screen
- **Deliverable:** Fight one battle, win or lose, return to field

### Phase 4: Party & Jobs
- Multiple party members (Soren + 2 others)
- Job data tables (stats, growth curves, abilities)
- Job change in town
- Job XP and ability learning
- Status effects in combat
- **Deliverable:** Full party, switch jobs, use job abilities in battle

### Phase 5: First Dungeon
- Tilemap dungeon (Tiled → JSON)
- Random encounters
- Field puzzle (push blocks / switches)
- Save point
- Boss fight (phase boss with mechanic)
- **Deliverable:** Complete a dungeon: explore, puzzle, fight, boss, save

### Phase 6: Save System
- 3 save slots + autosave
- Save/load all party state + position + flags
- Save points in dungeons, save anywhere in towns/overworld
- **Deliverable:** Save and load game, resume from exact position

### Phase 7: Story & Event Scripting
- Cutscene system (character movement, camera, dialogue)
- Event triggers (step here → boss appears, talk to NPC → quest flag)
- Story flags and branching
- Intro cutscene (prophecy, first omen)
- Name entry + job choice screens
- **Deliverable:** Play through intro, make choices, see cutscenes

### Phase 8: Content Expansion
- All towns (5-6)
- All dungeons (4-6) with varied puzzle difficulty
- All enemies (~20-25) and bosses (~5-7)
- All jobs (4 starting + 8 unlockable)
- All items, equipment, spells
- Airship for late-game overworld access
- Shop and inn systems
- **Deliverable:** Full game playable start to finish

### Phase 9: Polish
- All music tracks (~15-18)
- All SFX
- Audio mapping (music per scene, SFX per action)
- Visual polish (transitions, damage flashes, screen effects)
- Balance pass (stats, encounter rates, economy)
- Bug fixing
- **Deliverable:** Complete, polished game

---

## 12. ASSET SOURCING PLAN

### Art
1. Generate AI concept art for: characters, enemies, environments, UI style
2. Search itch.io and OpenGameArt for GBA-style JRPG asset packs matching concept art
3. Curate packs covering: field sprites, battle sprites, enemy sprites, portraits, tilesets (overworld/town/dungeon), UI elements, icons
4. Organize assets by type in project structure

### Audio
1. Search OpenGameArt, itch.io, chiptune communities for GBA-era synth JRPG music
2. Curate tracks per scene type (title, overworld, town, dungeon, battle, etc.)
3. Source SFX packs covering all categories (UI, combat, field, system, story)
4. Organize audio by type in project structure

---

## REFERENCE GAMES

| Game | What we take from it |
|---|---|
| Final Fantasy 1-3 | Turn-based combat, job system, overworld exploration, random encounters |
| Golden Sun | Field puzzles, psynergy-style abilities, save point hybrid system, GBA aesthetic |
| Final Fantasy Tactics Advance | Story quality, moral complexity, portrait dialogue style |
| Fire Emblem (GBA) | Visual aesthetic, sprite style, emotional storytelling |
| Kingdom Hearts | Starting choice affecting gameplay + story texture |