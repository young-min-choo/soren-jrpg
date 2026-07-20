# Game Dev Agent Skills — JRPG

This is the agent skill harness for building a turn-based JRPG with Phaser 3.
The AI reads these files on demand to understand how to work on the project.

## Project Overview
A traditional turn-based JRPG (FF1-3 / Golden Sun lineage) built with Phaser 3.
See `DESIGN-DOCUMENT.md` for the full specification — it is the canonical source of truth.

## Reference Files

| File | When to read |
|---|---|
| `DESIGN-DOCUMENT.md` | **Always read first.** Full game spec. |
| `.agent/PREREQUISITES.md` | Environment setup, dependencies, tooling |
| `.agent/WORKFLOW.md` | How to approach each task — read before implementing |
| `.agent/GAME-ENGINE.md` | Phaser 3 patterns, APIs, and conventions used in this project |
| `.agent/ASSETS.md` | How to handle sprites, tilesets, audio, and asset organization |
| `.agent/DATA-STRUCTURE.md` | JSON formats for game data (characters, enemies, items, spells, jobs) |
| `.agent/TESTING.md` | How to test the game in browser and verify changes |
| `PROGRESS.md` | What has been done so far — read before starting new work |

## Golden Rules
1. **DESIGN-DOCUMENT.md is the source of truth.** If code and doc disagree, the doc wins unless explicitly overridden.
2. **Implement one feature at a time.** Small, testable increments.
3. **Update PROGRESS.md after every change.** Future sessions need to know what's done.
4. **Test before claiming done.** Run the game, verify the feature works.
5. **Never fabricate results.** If something doesn't work, say so.