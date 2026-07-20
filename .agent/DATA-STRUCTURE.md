# Data Structures — JSON Formats

All game data is stored as JSON files in `src/data/`. The game loads these at boot and references them throughout.

## characters.json — Party Members

```json
{
  "soren": {
    "name": "Soren",
    "defaultName": "Soren",
    "renameable": true,
    "age": 16,
    "description": "An introspective youth drawn by prophecy.",
    "baseStats": {
      "hp": 30, "mp": 10,
      "atk": 8, "def": 6,
      "mag": 6, "mdef": 5,
      "agi": 7, "luck": 5
    },
    "startingJob": null,
    "portrait": "soren.png",
    "fieldSprite": "soren_field.png",
    "battleSprite": "soren_battle.png"
  },
  "thief": {
    "name": "???",
    "renameable": false,
    "description": "A suspicious thief with a hidden motive.",
    "baseStats": {
      "hp": 28, "mp": 8,
      "atk": 9, "def": 5,
      "mag": 5, "mdef": 4,
      "agi": 10, "luck": 8
    },
    "startingJob": "thief",
    "portrait": "thief.png",
    "fieldSprite": "thief_field.png",
    "battleSprite": "thief_battle.png"
  },
  "monk": {
    "name": "???",
    "renameable": false,
    "description": "A traveling healer with a secret.",
    "baseStats": {
      "hp": 35, "mp": 12,
      "atk": 7, "def": 7,
      "mag": 8, "mdef": 7,
      "agi": 6, "luck": 4
    },
    "startingJob": "monk",
    "portrait": "monk.png",
    "fieldSprite": "monk_field.png",
    "battleSprite": "monk_battle.png"
  },
  "party_knight": {
    "name": "???",
    "renameable": false,
    "description": "A steadfast knight who joins early.",
    "baseStats": {
      "hp": 40, "mp": 6,
      "atk": 10, "def": 9,
      "mag": 4, "mdef": 5,
      "agi": 5, "luck": 4
    },
    "startingJob": "knight",
    "portrait": "party_knight.png",
    "fieldSprite": "knight_field.png",
    "battleSprite": "knight_battle.png"
  }
}
```

## jobs.json — Job Classes

```json
{
  "warrior": {
    "name": "Warrior",
    "description": "A balanced fighter with strong physical attacks.",
    "statGrowth": {
      "hp": 3.5, "mp": 0.5,
      "atk": 2.0, "def": 1.5,
      "mag": 0.5, "mdef": 0.5,
      "agi": 1.0, "luck": 0.8
    },
    "abilities": ["power_strike"],
    "unlocked": true,
    "starting": true
  },
  "mage": {
    "name": "Mage",
    "description": "A spellcaster with powerful magic but low HP.",
    "statGrowth": {
      "hp": 1.5, "mp": 3.0,
      "atk": 0.5, "def": 0.5,
      "mag": 2.5, "mdef": 2.0,
      "agi": 1.0, "luck": 1.0
    },
    "abilities": ["fire", "blizzard", "thunder"],
    "unlocked": true,
    "starting": true
  },
  "ranger": {
    "name": "Ranger",
    "description": "A fast, balanced fighter from the frontier.",
    "statGrowth": {
      "hp": 2.5, "mp": 1.5,
      "atk": 1.5, "def": 1.0,
      "mag": 1.0, "mdef": 1.0,
      "agi": 2.5, "luck": 1.5
    },
    "abilities": ["quick_shot", "flee_boost"],
    "unlocked": true,
    "starting": true
  },
  "monk": {
    "name": "Monk",
    "description": "A martial artist with healing arts.",
    "statGrowth": {
      "hp": 3.0, "mp": 1.5,
      "atk": 1.8, "def": 1.5,
      "mag": 1.2, "mdef": 1.5,
      "agi": 1.5, "luck": 1.0
    },
    "abilities": ["focus", "healing_hands"],
    "unlocked": true,
    "starting": true
  },
  "knight": {
    "name": "Knight",
    "description": "A heavily armored protector.",
    "statGrowth": { "hp": 4.0, "mp": 0.5, "atk": 2.0, "def": 2.5, "mag": 0.5, "mdef": 1.0, "agi": 0.8, "luck": 0.5 },
    "abilities": ["guard", "cover"],
    "unlocked": false,
    "starting": false
  },
  "priest": {
    "name": "Priest",
    "description": "A dedicated healer and supporter.",
    "statGrowth": { "hp": 2.0, "mp": 3.0, "atk": 0.5, "def": 1.0, "mag": 2.5, "mdef": 2.5, "agi": 1.0, "luck": 1.0 },
    "abilities": ["heal", "cure_poison", "revive"],
    "unlocked": false,
    "starting": false
  },
  "thief": {
    "name": "Thief",
    "description": "A nimble rogue with a knack for stealing.",
    "statGrowth": { "hp": 2.5, "mp": 1.0, "atk": 1.5, "def": 1.0, "mag": 0.8, "mdef": 0.8, "agi": 3.0, "luck": 2.5 },
    "abilities": ["steal", "flee_boost", "double_strike"],
    "unlocked": false,
    "starting": false
  },
  "berserker": {
    "name": "Berserker",
    "description": "A wild fighter who trades defense for raw power.",
    "statGrowth": { "hp": 3.5, "mp": 0.2, "atk": 3.0, "def": 0.8, "mag": 0.2, "mdef": 0.5, "agi": 1.5, "luck": 1.0 },
    "abilities": ["rage", "reckless_swing"],
    "unlocked": false,
    "starting": false
  },
  "sage": {
    "name": "Sage",
    "description": "A master of both offensive and supportive magic.",
    "statGrowth": { "hp": 2.0, "mp": 4.0, "atk": 0.5, "def": 1.0, "mag": 3.0, "mdef": 3.0, "agi": 1.0, "luck": 1.0 },
    "abilities": ["meteor", "full_heal", "barrier"],
    "unlocked": false,
    "starting": false
  },
  "paladin": {
    "name": "Paladin",
    "description": "A holy knight who blends combat with healing.",
    "statGrowth": { "hp": 3.5, "mp": 2.0, "atk": 1.8, "def": 2.0, "mag": 1.5, "mdef": 1.5, "agi": 1.0, "luck": 1.0 },
    "abilities": ["holy_strike", "heal", "smite"],
    "unlocked": false,
    "starting": false
  },
  "dark_knight": {
    "name": "Dark Knight",
    "description": "A fallen warrior who drains life from enemies.",
    "statGrowth": { "hp": 3.5, "mp": 1.5, "atk": 2.5, "def": 1.5, "mag": 1.0, "mdef": 1.0, "agi": 1.0, "luck": 0.8 },
    "abilities": ["drain", "dark_sword", "sacrifice"],
    "unlocked": false,
    "starting": false
  },
  "ninja": {
    "name": "Ninja",
    "description": "A shadow operative who strikes first and hard.",
    "statGrowth": { "hp": 2.5, "mp": 1.5, "atk": 2.2, "def": 1.0, "mag": 1.0, "mdef": 1.0, "agi": 3.5, "luck": 2.0 },
    "abilities": ["throw", "shadow_step", "double_strike"],
    "unlocked": false,
    "starting": false
  }
}
```

## enemies.json — Enemy Definitions

```json
{
  "slime": {
    "name": "Slime",
    "stats": { "hp": 15, "mp": 0, "atk": 5, "def": 2, "mag": 0, "mdef": 1, "agi": 3, "luck": 1 },
    "sprite": "slime.png",
    "actions": ["attack"],
    "xp": 5,
    "gold": 3,
    "drops": [{ "item": "potion", "chance": 0.1 }],
    "aiType": "simple"
  },
  "goblin": {
    "name": "Goblin",
    "stats": { "hp": 22, "mp": 0, "atk": 8, "def": 3, "mag": 0, "mdef": 1, "agi": 6, "luck": 3 },
    "sprite": "goblin.png",
    "actions": ["attack"],
    "xp": 12,
    "gold": 8,
    "drops": [{ "item": "dagger", "chance": 0.05 }],
    "aiType": "weighted"
  },
  "dark_mage": {
    "name": "Dark Mage",
    "stats": { "hp": 18, "mp": 20, "atk": 4, "def": 2, "mag": 12, "mdef": 8, "agi": 5, "luck": 2 },
    "sprite": "dark_mage.png",
    "actions": ["attack", "fire", "silence"],
    "xp": 20,
    "gold": 15,
    "drops": [{ "item": "ether", "chance": 0.15 }],
    "aiType": "weighted"
  }
}
```

### Enemy AI Types
| Type | Behavior |
|---|---|
| `simple` | Random action from list |
| `weighted` | Situation-aware: low HP → defensive, player low HP → attack |
| `scripted` | Fixed pattern (bosses): defined in `script` field |
| `phase` | Changes behavior at HP thresholds (bosses) |

## items.json — Items

```json
{
  "potion": {
    "name": "Potion",
    "type": "consumable",
    "effect": { "hp": 50 },
    "price": 50,
    "description": "Restores 50 HP."
  },
  "ether": {
    "name": "Ether",
    "type": "consumable",
    "effect": { "mp": 30 },
    "price": 100,
    "description": "Restores 30 MP."
  },
  "antidote": {
    "name": "Antidote",
    "type": "consumable",
    "effect": { "cure": "poison" },
    "price": 40,
    "description": "Cures poison."
  },
  "phoenix_down": {
    "name": "Phoenix Down",
    "type": "consumable",
    "effect": { "revive": true, "hp": 1 },
    "price": 200,
    "description": "Revives a KO'd ally with 1 HP."
  }
}
```

## spells.json — Magic Spells

```json
{
  "fire": {
    "name": "Fire",
    "type": "offensive",
    "element": "fire",
    "mpCost": 6,
    "power": 15,
    "target": "enemy",
    "description": "A basic fire spell."
  },
  "blizzard": {
    "name": "Blizzard",
    "type": "offensive",
    "element": "ice",
    "mpCost": 6,
    "power": 15,
    "target": "enemy",
    "description": "A basic ice spell."
  },
  "heal": {
    "name": "Heal",
    "type": "healing",
    "mpCost": 5,
    "power": 30,
    "target": "ally",
    "description": "Restores HP to one ally."
  },
  "silence": {
    "name": "Silence",
    "type": "status",
    "status": "silence",
    "mpCost": 8,
    "target": "enemy",
    "description": "Prevents enemy from casting magic."
  }
}
```

## encounters.json — Fixed Formations per Area

```json
{
  "overworld_start": [
    { "enemies": ["slime", "slime"], "weight": 30 },
    { "enemies": ["slime", "slime", "slime"], "weight": 20 },
    { "enemies": ["goblin"], "weight": 15 },
    { "enemies": ["goblin", "slime"], "weight": 10 }
  ],
  "dungeon_relic1": [
    { "enemies": ["goblin", "goblin"], "weight": 25 },
    { "enemies": ["dark_mage", "goblin"], "weight": 15 },
    { "enemies": ["slime", "slime", "goblin"], "weight": 20 }
  ]
}
```

## Save Data Format (localStorage)

```json
{
  "slot": 1,
  "timestamp": "2026-07-20T15:30:00Z",
  "playerName": "Soren",
  "startingJob": "warrior",
  "party": [
    {
      "id": "soren",
      "name": "Soren",
      "level": 5,
      "xp": 120,
      "currentJob": "warrior",
      "jobLevels": { "warrior": 3, "mage": 1 },
      "hp": 45,
      "mp": 12,
      "maxHp": 50,
      "maxMp": 15,
      "equipment": { "weapon": "iron_sword", "armor": "leather_armor" },
      "learnedAbilities": ["power_strike", "fire"]
    }
  ],
  "inventory": { "potion": 5, "ether": 2 },
  "gold": 150,
  "position": { "map": "overworld", "x": 128, "y": 64 },
  "storyFlags": { "met_party_knight": true, "relic1_obtained": false },
  "worldState": { "bosses_defeated": [], "doors_opened": [] }
}
```