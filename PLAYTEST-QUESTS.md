# PLAYTEST QUEST LOG — Phases 7-8

*Manual verification quests. The E2E suite proves the code works; these quests prove the GAME works. Complete in order — each zone unlocks the next. Est. full clear: 30-40 min.*

**How to report a bug:** zone + quest name + one line of what you did / what happened / what you expected. Screenshot optional. (Example: "Z3-Q3 — pushed block into wall corner, it vanished.")

---

## ZONE 1 — Prologue *(est. 5 min)*

### Q1.1 — A Hero Is Named ⭐
- [ ] Title screen shows "Z: New Game · X: Continue" (X should do nothing — no save exists yet)
- [ ] Type a name letter by letter; Backspace deletes; blank name + Enter = "Soren"
- [ ] Job screen shows all 4 jobs; arrow keys move; each job shows stats + a different story blurb
- ✅ **Clear:** You enter the overworld as your named hero in your chosen job

### Q1.2 — The Omens ⭐
- [ ] Intro cutscene plays automatically — you cannot move during it
- [ ] Dialogue pages advance with Z; the 3-choice moment ("I will go" / "Why me?" / "This sounds dangerous") gives a different elder reply per choice
- [ ] Your job's texture line appears (Mage = relic resonance, Warrior = guard family, Ranger = wilds, Monk = monastery)
- ✅ **Clear:** Cutscene ends, `introDone`; walking the overworld works afterward

### Q1.3 — The Unbroken Loop 🔧 *edge cases*
- [ ] Mash Z as fast as possible through the whole intro — no double-advance bugs, no freeze
- [ ] Try arrow keys during dialogue — player must not move
- ✅ **Clear:** No stuck states, no console-visible weirdness

---

## ZONE 2 — Starting Town *(est. 5 min)*

### Q2.1 — The Elder's counsel
- [ ] Townsfolk and Elder dialogue is now story-aware (mentions the omens / ruins, not the old static lines)
- [ ] Talk to the Elder TWICE — second talk should still work, no soft-lock

### Q2.2 — Merchant's Trust ⭐ *economy check*
- [ ] Shopkeeper (yellow, SW corner) opens the shop; your gold shows **0G**
- [ ] Try to buy a Potion → "Not enough gold!", nothing purchased
- [ ] The shop lists 5 items with prices (Potion 50, Ether 150, Antidote 40, Eyedrop 30, Phoenix Down 300)

### Q2.3 — A Warm Bed ⭐
- [ ] Innkeeper (blue, SE corner): Rest costs **30G**; with 0G you get rejected
- [ ] (After earning gold in Z3) Rest actually restores HP/MP and deducts exactly 30G

### Q2.4 — Paths of the World 🗺️
- [ ] Overworld: yellow ▼ = town (south), red ▼ = Ancient Ruins (east), orange ▼ = Cave of Embers (NW mountains)
- [ ] The orange ▼ is **hidden** until you hold the Wind Relic — confirm it's absent now
- [ ] Walk to the cave entrance and press Z → "something bars the way" message, you stay outside

---

## ZONE 3 — The Wind Relic *(est. 10-15 min)* ⭐⭐ *the core loop*

### Q3.1 — First Blood
- [ ] Battles trigger while walking (roughly every map-crossing or two — not every 3 steps)
- [ ] Battle UI: turn order feels fair, FIGHT/MAGIC/ITEM/DEFEND/FLEE all function
- [ ] Damage numbers readable; hit flash visible (this was broken until recently — confirm flashes show)
- [ ] **Balance probe:** at Lv1, slimes are beatable but not trivial; you should reach Lv2 after roughly 15-25 battles. *If it feels like a grind wall, note it — that's real tuning data.*

### Q3.2 — Treasure Before Toil 💰
- [ ] After ~10 battles you have **150-300G** — enough for a Potion + a rest, or savings toward the Phoenix Down
- [ ] Buy at least one Potion and rest at the inn — the economy loop closes

### Q3.3 — The Ancient Ruins ⭐
- [ ] Red ▼ entrance works; encounters inside are ruins-tier (zombies, wisps appear)
- [ ] Push-block puzzle: walk into blocks to push (no separate key), blocks slide smoothly, can't be pushed into walls/each other
- [ ] Save point restores HP/MP and saves
- ✅ **Clear:** Both switches pressed, boss door opens

### Q3.4 — Goblin Warlord ⭐⭐
- [ ] Boss fight at expected level is winnable with potions, losable if careless
- [ ] Victory → exit tile appears where the boss stood
- [ ] **Relic cutscene plays** — read it once, actually read it: does the "relic chose YOU" beat land?
- [ ] Aria's choice moment works; flag persists (check Menu → Save → reload → Load → elder now speaks about the relic)

---

## ZONE 4 — Cave of Embers *(est. 10 min)* ⭐⭐ *unlocked by Z3*

### Q4.1 — The Gate Opens
- [ ] Orange ▼ marker now visible in the NW mountains
- [ ] Path from town to the cave is walkable (mountains don't block the route)

### Q4.2 — Trial of Vents 🔥
- [ ] Ember-tier enemies hit noticeably harder than ruins-tier (magma slimes, fire imps, golem if unlucky)
- [ ] Lava pools block movement
- [ ] Step on BOTH vent plates (far apart, mid-chamber) → "the path opens" toast, boss door becomes floor
- [ ] Save point works here too

### Q4.3 — Emberlord Ignis ⭐⭐⭐ *the balance spike*
- [ ] At your arrival level (~5-6), the fight is tense but winnable with potions; a fresh Lv3 party should realistically lose
- [ ] He casts Fire (watch for it in the log); damage numbers feel boss-tier
- ✅ **Clear:** Victory → exit tile, **Fire Relic cutscene plays**

### Q4.4 — Resonance 📖
- [ ] Kael/Aria dialogue references "two down" and the mid-game foreshadowing ("something ancient stirs — and smiles")
- [ ] Second choice ("I can carry it" / "It's watching me") gives different replies
- [ ] After: elder/townsfolk lines acknowledge BOTH relics? *(If they still only mention the Wind Relic — that's a known gap, note it as "Z4-Q4: NPC lines not relicFire-aware")*

---

## SIDE QUESTS *(any time)*

### S1 — The Save Crystal ⭐
- [ ] Menu save (X key) works in overworld AND town; dungeon save via save point
- [ ] Save → close tab entirely → reopen → Continue (X on title) → Load → exact position, party, flags intact
- [ ] Save in town, walk to dungeon, load the town save → no leftover dungeon UI (regression check for an old bug)

### S2 — Job Master's Wisdom
- [ ] Change Soren Warrior→Mage→back; learned abilities carry; HP/MP ratio preserved
- [ ] Buy an ability with JP (need a few battles first); new ability appears in battle MAGIC/FIGHT menu

### S3 — Death and Mercy
- [ ] Let the party wipe intentionally (fight the golem at low level, defend-only)
- [ ] "DEFEAT..." → full heal → return to field (classic FF prototype behavior — later becomes Game Over in Phase 9)

### S4 — The Speedrunner 🔧
- [ ] Hold Shift (sprint) into walls, corners, NPCs — no clipping, no stuck keys
- [ ] Open the menu during a fade transition — nothing breaks
- [ ] Alt-tab away mid-battle and back — no phantom key presses

---

## KNOWN GAPS (not bugs — don't report)
- No music/SFX (Phase 9)
- No equipment yet (Phase 8 slice 2)
- No Game Over screen (defeat = full heal, by design for now)
- NPC dialogue doesn't yet react to `relicFire` (only Wind Relic lines exist)
- Battle menu has no mouse support — keyboard only (by design)

## BALANCE CALIBRATION *(your feel → my numbers)*
Answer these three in your report — they directly tune slice 2:
1. Battles to reach Lv3: felt right / too many / too few?
2. Gold after the Wind dungeon: enough to shop meaningfully / starved / swimming?
3. Emberlord difficulty at your arrival level: fair / unfair / trivial?