/**
 * story — all cutscene/event content for the game.
 * Flags written here are the contract with the rest of the game:
 *
 *  startingJob       — job chosen at new game (story texture)
 *  introDone         — intro cutscene has played
 *  relicWind         — Wind Relic obtained (dungeon boss beaten)
 *
 * Job-texture rule (design doc): light touches only — a few changed
 * lines, not branching plot.
 */
import GameState from '../game/GameState.js';
import { step, runCutscene } from './Cutscene.js';

const playerName = () => GameState.get().party[0].name;
const startingJob = () => GameState.getFlag('startingJob') || 'Warrior';

// ─── Intro: prophecy + first omen (plays on first Overworld entry) ─────────

export function introSteps() {
  const name = playerName();
  return [
    step.say('???', [
      'When the world was young, five relics were forged to bind an ancient power.',
      'They were scattered... hidden... and soon, forgotten.',
    ]),
    step.say('Villager', [
      `${name}! There you are. The elder asked for you.`,
      'He has been muttering about omens again. You know how he gets.',
    ]),
    step.say('Elder', [
      `${name}. Thank you for coming.`,
      'Last night, the eastern sky burned green. The old texts say that is the sign.',
      'The sign that the Wind Relic has awakened in the Ancient Ruins.',
    ]),
    step.choose(
      'Elder',
      ['The relics are real, then...'],
      [
        { text: 'I will go.', value: 'eager' },
        { text: 'Why me?', value: 'why' },
        { text: 'This sounds dangerous.', value: 'afraid' },
      ],
    ),
    step.when(
      (_, ctx) => ctx.choice === 'eager',
      [step.say('Elder', ['So the blood of the old line still burns eager. Ha! Perhaps this is fate.'])],
    ),
    step.when(
      (_, ctx) => ctx.choice === 'why',
      [step.say('Elder', ['I asked myself the same thing. But the omen appeared over OUR village, and the texts speak of one who can hear the relics sing.'])],
    ),
    step.when(
      (_, ctx) => ctx.choice === 'afraid',
      [step.say('Elder', ['Good. Fear keeps the careful alive. But fear must not keep you home.'])],
    ),
    // Job texture: one extra line depending on starting job.
    step.when(
      () => startingJob() === 'Mage',
      [step.say('Elder', ['You are a mage of our village — listen for the relic\'s resonance. If the texts are true, you of all people will hear it.'])],
    ),
    step.when(
      () => startingJob() === 'Warrior',
      [step.say('Elder', ['Your family kept the village guard for generations. Bring your steel, and your wits.'])],
    ),
    step.when(
      () => startingJob() === 'Ranger',
      [step.say('Elder', ['You know the wilds better than any. The ruins lie past the eastern waters.'])],
    ),
    step.when(
      () => startingJob() === 'Monk',
      [step.say('Elder', ['The monastery taught you stillness. You will need it. Not everything that wakes will want to be found.'])],
    ),
    step.say('Elder', [
      'Aria and Kael will go with you. Rest, prepare — and be careful.',
      'The ruins are not empty, ' + name + '.',
    ]),
    step.flag('introDone'),
  ];
}

// ─── Wind Relic: boss victory cutscene (Dungeon) ───────────────────────────

export function relicSteps() {
  const name = playerName();
  return [
    step.panCamera(5 * 32 + 16, 8 * 32 + 16, 900), // glance at the puzzle room
    step.wait(300),
    step.say('Aria', ['The air has changed. Do you feel it?']),
    step.say('', [
      'In the silence after the battle, a soft hum rises from the rubble.',
      `A crystal shard — green as new leaves — drifts into ${name}'s hand.`,
    ]),
    step.say('Kael', ['So the stories were true. The Wind Relic.']),
    step.say('Aria', [
      `${name}... it chose YOU. It did not drift to me, or to Kael.`,
      'Only you can hear it, can\'t you?',
    ]),
    step.choose(
      'Aria',
      ['The relic hums against your palm.'],
      [
        { text: '...Yes. Like a song.', value: 'hear' },
        { text: 'It\'s warm.', value: 'warm' },
      ],
    ),
    step.say('Kael', ['Then the elder\'s texts have it right. "One who can hear the relics sing."']),
    step.say('', [
      'The Wind Relic hums its quiet song.',
      'Four more sleep elsewhere in the world... and somewhere, eyes you have not met are watching them too.',
    ]),
    step.flag('relicWind'),
  ];
}

export function playIntro(scene) {
  return runCutscene(scene, introSteps());
}

export function playRelicScene(scene) {
  return runCutscene(scene, relicSteps());
}

// ─── Fire Relic: Emberlord victory cutscene (Cave of Embers) ───────────────

export function emberRelicSteps() {
  const name = playerName();
  return [
    step.say('Kael', ['Two down. The heat off that thing could melt steel — and you took it head-on.']),
    step.say('', [
      'From the Emberlord\'s ashes, a second shard rises —',
      'crimson, breathing heat like a living thing. It settles beside the first.',
    ]),
    step.say('Aria', [
      `${name}... when it touched your hand, I saw the air bend.`,
      'The monk\'s stories call this "resonance." It is rare. It is not nothing.',
    ]),
    step.choose(
      'Aria',
      ['The Fire Relic hums against your palm — hotter, angrier than the Wind.'],
      [
        { text: 'I can carry it.', value: 'steady' },
        { text: 'It\'s... watching me.', value: 'unease' },
      ],
    ),
    step.when(
      (_, ctx) => ctx.choice === 'steady',
      [step.say('Kael', ['That\'s the spirit. Three more and this prophecy business is behind us.'])],
    ),
    step.when(
      (_, ctx) => ctx.choice === 'uneasy',
      [step.say('Kael', ['Relics watch. Mountains watch. Doesn\'t mean they mean harm. ...Probably.'])],
    ),
    step.say('', [
      'Two relics now sing their quiet, dissonant song.',
      'Deep beneath the world, something ancient stirs — and smiles.',
    ]),
    step.flag('relicFire'),
  ];
}

export function playRelicEmberScene(scene) {
  return runCutscene(scene, emberRelicSteps());
}

// ─── Flag-conditional NPC dialogue (Town) ──────────────────────────────────

/** Returns dialogue data for an NPC, based on current story flags. */
export function npcDialogue(npcKey) {
  const name = playerName();
  const hasRelic = GameState.hasFlag('relicWind');
  const intro = GameState.hasFlag('introDone');

  switch (npcKey) {
    case 'elder':
      if (!intro) {
        return {
          speaker: 'Elder',
          pages: [
            `${name}! Come — we must speak. The omens... meet me outside the village first.`,
          ],
        };
      }
      if (!hasRelic) {
        return {
          speaker: 'Elder',
          pages: [
            'The Ancient Ruins lie east, past the water.',
            'Push through, find the relic — and come back alive.',
          ],
        };
      }
      return {
        speaker: 'Elder',
        pages: [
          'The Wind Relic... so the songs were true.',
          'Four remain. Rest now. When you are ready, the world will point the way.',
        ],
      };

    case 'townsfolk':
      if (!intro) {
        return {
          speaker: 'Townsfolk',
          pages: ['Something strange is in the air today. The elder is asking for you, I think.'],
        };
      }
      if (hasRelic) {
        return {
          speaker: 'Townsfolk',
          pages: [
            'They say you found a relic in the ruins!',
            'My gran used to sing about the five relics. Never thought I\'d meet someone holding one.',
          ],
        };
      }
      return {
        speaker: 'Townsfolk',
        pages: [
          'Heading to the Ancient Ruins? Watch for goblins — and worse.',
          'If you find treasure, the inn\'s the safest place to count it.',
        ],
      };

    default:
      return null;
  }
}