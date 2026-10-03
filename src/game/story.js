/**
 * story — all cutscene/event content for the game.
 * Flags written here are the contract with the rest of the game:
 *
 *  startingJob       — job chosen at new game (story texture)
 *  introDone         — intro cutscene has played
 *  relicWind         — Wind Relic obtained (dungeon 1 boss)
 *  relicFire         — Fire Relic obtained (Cave of Embers boss)
 *  aldricJoined      — Aldric (party knight) joined the party
 *  relicWater        — Water Relic obtained (Tide Temple boss)
 *  relicEarth        — Earth Relic obtained (Hollow Deep boss)
 *  airship           — airship access granted (story: after relicEarth)
 *  relicStorm        — Storm Relic obtained (Storm Spire boss)
 *  revelation        — mid-game revelation cutscene played (only Soren can activate)
 *  garethDefeated    — disgraced knight defeated (story battle)
 *  betrayed          — Aldric betrayed the party, took the relics
 *  gameComplete      — finale finished (credits)
 *
 * Job-texture rule (design doc): light touches only — a few changed
 * lines, not branching plot.
 */
import GameState from '../game/GameState.js';
import { step, runCutscene } from './Cutscene.js';

const playerName = () => GameState.get().party[0].name;
const startingJob = () => GameState.getFlag('startingJob') || 'Warrior';
const relicCount = () =>
  ['relicWind', 'relicFire', 'relicWater', 'relicEarth', 'relicStorm']
    .filter(f => GameState.hasFlag(f)).length;

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
      (_, ctx) => ctx.choice === 'unease',
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

// ─── Aldric joins (plays on next Overworld entry after relicFire) ──────────

export function aldricJoinSteps() {
  const name = playerName();
  return [
    step.say('', [
      'At the crossroads east of the village, a knight in worn silver armor waits.',
      'He has been waiting, it seems, for you.',
    ]),
    step.say('Aldric', [
      `${name}. The one the omens chose.`,
      'I am Aldric. Once a knight of Aurelia — before the war chewed it up and spat the borderlands out.',
    ]),
    step.say('Aldric', [
      'I have followed the signs as you have. The relics are waking, and worse things than scholars are following them.',
      'Let me walk with you. My sword is old, but it is honest.',
    ]),
    step.say('Kael', ['A knight who just happens to be camped on our road. That\'s not suspicious at all.']),
    step.say('Aria', ['He watched us fight in the ruins. He could have taken the relic then. He didn\'t.']),
    step.choose(
      'Aldric',
      ['The party knight extends a gauntleted hand.'],
      [
        { text: 'Welcome to the party.', value: 'welcome' },
        { text: 'Why do this for strangers?', value: 'why' },
      ],
    ),
    step.when(
      (_, ctx) => ctx.choice === 'why',
      [step.say('Aldric', ['Because I have lost enough to this world\'s wars. The relics waking is everyone\'s problem. And because you, ' + playerName() + ', will need someone watching your back who is not amazed by you.'])],
    ),
    step.say('Aldric', ['Then it\'s settled. Onward — I hear the sea calling from the east.']),
    step.run((scene) => {
      // Aldric joins the roster (Knight job, story level ~4)
      GameState.addMember('Aldric', 'Knight', 4);
      GameState.unlockJob('Knight');
      GameState.setFlag('aldricJoined');
    }),
  ];
}

export function playAldricJoin(scene) {
  return runCutscene(scene, aldricJoinSteps());
}

// ─── Water Relic: Tide Temple (Leviathan Priest) ───────────────────────────

export function tideRelicSteps() {
  const name = playerName();
  return [
    step.say('Aria', ['The tide has stopped. Do you see it? The water is holding its breath.']),
    step.say('', [
      'From the still water a shard rises, blue as deep evening —',
      'the Water Relic. It settles into your hand like a returning fish.',
    ]),
    step.say('Kael', ['Three. Half of the old set, in one pouch.']),
    step.say('Aldric', ['Half, yes. The elder\'s texts say the other two sleep in the deep earth and the high sky. We will need both.']),
    step.say('Neve', [
      'Kael! You\'re not leaving again without— oh.',
      'You found a boat. You found a BOAT. You\'re going to be insufferable.',
    ]),
    step.say('Kael', ['Neve. I told you to stay in Meridian.']),
    step.say('Neve', ['You told me to stay SAFE. Meridian stopped being safe the day the sky turned green. I\'m coming as far as the city gates, and that\'s final.']),
    step.run((scene) => {
      // Port Meridian's temple-ship sends its Sage and sworn shield (Paladin)
      // to walk with the relic-bearer.
      GameState.unlockJob('Sage');
      GameState.unlockJob('Paladin');
    }),
    step.choose(
      'Neve',
      ['Kael\'s sister looks between you and her brother.'],
      [
        { text: 'She should stay with the party.', value: 'keep' },
        { text: 'Kael\'s right — too dangerous.', value: 'safe' },
      ],
    ),
    step.say('', ['The Water Relic hums. Somewhere far below, something that has been sleeping a very long time rolls over.']),
    step.flag('relicWater'),
  ];
}

export function playRelicTideScene(scene) {
  return runCutscene(scene, tideRelicSteps());
}

// ─── Earth Relic: Hollow Deep (Hollow King) ────────────────────────────────

export function hollowRelicSteps() {
  const name = playerName();
  return [
    step.say('', [
      'The Hollow King collapses into loam and old bones. From the grave-silence, a fourth shard rises:',
      'amber, heavy as a held breath. The Earth Relic.',
    ]),
    step.say('Aldric', ['Four. Only the Storm Relic remains — in the Spire, above Skyhold.']),
    step.say('Aria', ['The Relics... when all five are together, they won\'t just hum. The texts say they will SING, and something will answer.']),
    step.choose(
      'Aria',
      ['Aldric is very quiet.'],
      [
        { text: 'Something will answer. What?', value: 'ask' },
        { text: 'One left. Let\'s finish this.', value: 'push' },
      ],
    ),
    step.say('Aldric', ['What answers depends on the heart that activates them. Or so the old books claim. The way to Skyhold is long — and the passes are closed to carts and feet.']),
    step.say('', [
      'That night, in Stonewatch, a courier from Aurelia arrives with a sealed order: the King\'s airship, the Zephyr, will carry relic-bearers to the high passes.',
      'The Zephyr is yours. The sky is a map now.',
    ]),
    step.run((scene) => {
      GameState.setFlag('airship'); // unlocks Skyhold approach + fast travel docks
    }),
    step.run((scene) => {
      // Stonewatch quarry guilds: the earth-teachings (Berserker) and
      // Aurelia's schola sends its healer (Priest) to the relic-bearer.
      GameState.unlockJob('Berserker');
      GameState.unlockJob('Priest');
    }),
    step.flag('relicEarth'),
  ];
}

export function playRelicHollowScene(scene) {
  return runCutscene(scene, hollowRelicSteps());
}

// ─── Storm Relic: Storm Spire (Storm Sovereign) ────────────────────────────

export function spireRelicSteps() {
  const name = playerName();
  return [
    step.say('', [
      'The storm parts. Above the last stair, the final shard waits in the lightning-wire:',
      'white-silver, cracking with held thunder. The Storm Relic.',
    ]),
    step.say('Kael', ['Five for five. Someone should say something poetic.']),
    step.say('Aria', ['Later. ' + playerName() + ' — look at your hands.']),
    step.say('', [
      'All five relics are singing now. Not a hum — a chord.',
      'And for the first time, you understand the words.',
    ]),
    step.choose(
      '',
      ['The chord resolves into a single, clear sentence.'],
      [
        { text: '“Only the chosen bearer wakes the full set.”', value: 'chosen' },
        { text: '“Speak nothing of this to anyone.”', value: 'secret' },
      ],
    ),
    step.say('Aria', ['You heard it too? The relics only fully wake for their bearer. Anyone else holding them is carrying... stones.']),
    step.say('Aldric', ['Anyone else. Of course. And the full set, woken, does what exactly? The books never say.']),
    step.say('', [
      'Something in Aldric\'s voice has changed. It is very small, and it is very level, and it does not sound like relief.',
    ]),
    // Mid-game revelation — design doc §3 plot point 4
    step.run(() => {
      GameState.setFlag('relicStorm');
      GameState.setFlag('revelation');
      GameState.unlockJob('Ninja'); // Skyhold monastery: the storm-teachings
    }),
  ];
}

export function playRelicSpireScene(scene) {
  return runCutscene(scene, spireRelicSteps());
}

// ─── Gareth, the Disgraced Knight (Conduit Gate approach, part 1) ─────────

export function garethSteps() {
  const name = playerName();
  return [
    step.say('', [
      'The road to the Conduit Gate is older than any kingdom on it.',
      'Halfway along, a figure in rusted crimson armor blocks the way. He has been waiting. Not for you — for ANYONE.',
    ]),
    step.say('Gareth', [
      'THE RELIC-BEARER. Yes. I know your face — he showed me. He showed me everything.',
      'Give me the set, boy, and I\'ll only take your hands off at the wrist.',
    ]),
    step.say('Kael', ['Who told you— who "showed" you anything?']),
    step.say('Gareth', [
      'My master. The one honest voice in a dishonest world. He said the relics would fix what the war broke.',
      'He said, he said, HE SAID—',
    ]),
    step.say('Aldric', ['Gareth. Sir Gareth of the Southern March. You killed a boy who had already surrendered. Look at yourself.']),
    step.say('Gareth', ['...You have kind eyes, relic-bearer. Kinder than mine. It will not save you.']),
    step.flag('garethMet'),
  ];
}

export function playGarethScene(scene) {
  return runCutscene(scene, garethSteps());
}

// ─── Gareth defeated → Betrayal (Aldric reveals himself) ──────────────────

export function betrayalSteps() {
  const name = playerName();
  return [
    step.say('', [
      'Sir Gareth falls. His armor keeps its shape for a moment, then folds like wet paper.',
      'He laughs — a small, surprised sound, as if he finally understands the joke was on him all along.',
    ]),
    step.say('Gareth', [
      'The master... he never needed ME. He needed you to be HERE.',
      'All this road. All this... I was the bell. You were the sheepdog. Hah. Hah—',
    ]),
    step.say('Aria', ['What is he talking about? Aldric — you said you knew him. You never said how.']),
    step.say('Aldric', [
      'Kael. Aria. Step away from the bearer, please.',
      'I am sorry. I have been so terribly, terribly sorry for a very long time.',
    ]),
    step.say('', [
      'Aldric\'s sword is out. It has been out for some time — you realize now it never really went back in.',
      'The relics at your belt begin to hum, and then to wail.',
    ]),
    step.say('Aldric', [
      'My wife died in the border war. Sick with fever, alone, in a country I was bleeding for.',
      'The crown sent condolences. The relics send HER BACK. The texts are clear. The full set, activated by the chosen bearer, opens the door.',
    ]),
    step.say('Kael', ['So all of this — the caves, the temples, the spire — you pointed us at every one of them.']),
    step.say('Aldric', ['I walked you to each. I let you do the bleeding. Only the chosen bearer can wake them — that is the cruelty of it. You must ACTIVATE the set, ' + playerName() + '. And you will.']),
    step.choose(
      'Aldric',
      ['He levels his blade at you. The relics howl.'],
      [
        { text: 'Never. I won\'t wake them for you.', value: 'refuse' },
        { text: '...Aria, Kael — run.', value: 'run' },
      ],
    ),
    step.say('Aldric', ['I have carried her coffin for eleven years. Do not ask me to keep carrying it.']),
    step.say('', [
      'Aldric strikes — not at you. At the relics. The world tears open like wet cloth, and he steps through with all five shards singing.',
      'The Conduit Gate answers. Of course it answers. It was always going to answer HIM.',
    ]),
    step.run((scene) => {
      GameState.removeMember('Aldric');
      GameState.setFlag('betrayed');
      // The fall of a once-honest knight teaches its own dark lesson
      GameState.unlockJob('DarkKnight');
    }),
    step.say('Kael', ['...He\'s gone. With the relics. Through a hole in the world.']),
    step.say('Aria', ['Then we go through the hole too. The Gate is open — the way to the Conduit is open to US now. Finish it.']),
  ];
}

export function playBetrayalScene(scene) {
  return runCutscene(scene, betrayalSteps());
}

// ─── Finale: Conduit interior — Aldric, two phases ─────────────────────────

export function finaleSteps() {
  const name = playerName();
  return [
    step.say('', [
      'Inside the Conduit, the sky is an eye. The five relics spin in a slow orbit above a shallow basin of light.',
      'Aldric stands beneath them, arms open, weeping with joy.',
    ]),
    step.say('Aldric', ['She is coming. She is coming back. Eleven years and she is COMING—']),
    step.say('', [
      'The relics sing. The basin fills with light.',
      'And the light leans out of the basin, and looks at Aldric, and it is not a woman.',
      'It is not anything that ever loved anyone.',
    ]),
    step.say('Aldric', ['...Elaine? ...No. No, that is not— what are you. WHAT ARE YOU—']),
    step.say('', [
      'The unseen force steps out of the Conduit wearing the shape of a woman like a borrowed coat, and Aldric — hollowed, used up, screaming — turns on you with everything he has left.',
      'This is not a fight about relics anymore. It never was.',
    ]),
    step.flag('finaleBegun'),
  ];
}

export function playFinaleScene(scene) {
  return runCutscene(scene, finaleSteps());
}

// ─── Ending: credits + world state ─────────────────────────────────────────

export function endingSteps() {
  const name = playerName();
  return [
    step.say('', [
      'Aldric falls to his knees. The false shape unravels, annoyed, and pours itself back through the Conduit like water finding a drain.',
      'The Gate closes with a sound like a book being shut.',
    ]),
    step.say('Aldric', [
      'I only wanted... her back. I only wanted her BACK.',
      'It wore her face. It knew her face. How did it know her face, ' + playerName() + '?',
    ]),
    step.say('Aria', ['Because the relics remember. Because they have been listening to us the whole way, love. And now they have closed the door on their own.']),
    step.say('Kael', ['The five shards go quiet. Really quiet — like sleeping children. Keep them. Keep them far from anyone who wants anything too badly.']),
    step.say('Aldric', ['Then keep me from myself, if it comes to that. I am... so tired. The world was never honest with me. Perhaps I will try being honest with it.']),
    step.say('', [
      'The road home is long, and quiet, and no one speaks of the shape in the light.',
      'Somewhere far away, something ancient turns its attention elsewhere — and smiles. It has other doors.',
    ]),
    step.say('— THE END —', [
      'Thank you for playing.',
    ]),
    step.run(() => {
      GameState.setFlag('gameComplete');
    }),
  ];
}

export function playEndingScene(scene) {
  return runCutscene(scene, endingSteps());
}

// ─── Flag-conditional NPC dialogue (all towns) ─────────────────────────────

/** Returns dialogue data for an NPC, based on current story flags. */
export function npcDialogue(npcKey) {
  const name = playerName();
  const hasWind = GameState.hasFlag('relicWind');
  const hasFire = GameState.hasFlag('relicFire');
  const hasWater = GameState.hasFlag('relicWater');
  const hasEarth = GameState.hasFlag('relicEarth');
  const hasStorm = GameState.hasFlag('relicStorm');
  const betrayed = GameState.hasFlag('betrayed');
  const complete = GameState.hasFlag('gameComplete');
  const intro = GameState.hasFlag('introDone');

  // Generic townsfolk — react to overall relic progress
  const ambientTown = (townName) => {
    if (complete) return { speaker: 'Townsfolk', pages: ['They say the sky over the Gate tore open and closed again. Whatever you did up there — thank you.'] };
    if (betrayed) return { speaker: 'Townsfolk', pages: ['A knight in silver came through asking after you. There was something wrong with his eyes. Be careful out there.'] };
    if (hasStorm) return { speaker: 'Townsfolk', pages: ['Five relics. FIVE. My grandmother sang about one and you carry five. The world\'s about to change, isn\'t it?'] };
    if (hasEarth) return { speaker: 'Townsfolk', pages: ['The Zephyr docked here last night — the King\'s own airship. And they say it\'s YOURS now. Must be nice, being important.'] };
    if (hasWater) return { speaker: 'Townsfolk', pages: ['The tide\'s been strange since the temple bell stopped. You wouldn\'t know anything about that, would you? ...Didn\'t think so.'] };
    if (hasFire) return { speaker: 'Townsfolk', pages: ['The mountain in the northwest has stopped smoking. Eerie. Good, but eerie.'] };
    if (hasWind) return { speaker: 'Townsfolk', pages: ['They say you found a relic in the ruins! My gran used to sing about the five. Never thought I\'d meet someone holding one.'] };
    if (intro) return { speaker: 'Townsfolk', pages: ['Heading to the Ancient Ruins? Watch for goblins — and worse.', 'If you find treasure, the inn\'s the safest place to count it.'] };
    return { speaker: 'Townsfolk', pages: ['Something strange is in the air today. The elder is asking for you, I think.'] };
  };

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
      if (!hasWind) {
        return {
          speaker: 'Elder',
          pages: [
            'The Ancient Ruins lie east, past the water.',
            'Push through, find the relic — and come back alive.',
          ],
        };
      }
      if (!hasFire) {
        return {
          speaker: 'Elder',
          pages: [
            'The Wind Relic... so the songs were true.',
            'Now the northwest stirs. The Cave of Embers, in the smoking mountains — the Fire Relic sleeps there. Prepare well; its guardian is no goblin.',
          ],
        };
      }
      if (!hasWater) {
        return {
          speaker: 'Elder',
          pages: [
            'Two relics. The world is watching you now, child.',
            'The next omen came by sea-gull this morning, of all things: the Tide Temple, east past Port Meridian. The Water Relic answers to the moon and the tide.',
          ],
        };
      }
      if (!hasEarth) {
        return {
          speaker: 'Elder',
          pages: [
            'Three. Only the deep earth and the high sky remain.',
            'South of Stonewatch the ground has been humming — the Hollow Deep. The Earth Relic sleeps beneath the old graves. Take care. The dead there are not resting.',
          ],
        };
      }
      if (!hasStorm) {
        return {
          speaker: 'Elder',
          pages: [
            'Four! And the King has lent you the Zephyr — the times truly have turned.',
            'The Storm Spire crowns the peaks above Skyhold. No road reaches it; the airship will. The Storm Relic is the last.',
          ],
        };
      }
      if (!betrayed) {
        return {
          speaker: 'Elder',
          pages: [
            'The full set, woken. The texts go quiet here — the last pages are torn out.',
            'Whatever you do next, do it with people you trust. Trust is the only armor that has never once failed me.',
          ],
        };
      }
      return {
        speaker: 'Elder',
        pages: [
          'So the silver knight was the wolf all along. Child — go. The Gate stands open and the world holds its breath.',
          'And come back. That is an order from an old man who has buried too many people this year.',
        ],
      };

    case 'townsfolk':
      return ambientTown();

    // ── Port Meridian ──
    case 'dockhand':
      return {
        speaker: 'Dockhand',
        pages: betrayed
          ? ['Ships won\'t sail east since the sky tore. Captains are calling it the God-wound. You going there? Genuinely?']
          : hasWater
            ? ['The tide\'s turned strange since the temple fell silent. Good strange, I think. You did that, didn\'t you.']
            : ['The Tide Temple lies east across the shallows. You\'ll want a blessing before you wade in. And maybe a rope.'],
      };

    case 'harbormaster':
      return {
        speaker: 'Harbormaster',
        pages: [
          'Port Meridian asks three things of visitors: pay your dock fees, keep your swords sheathed, and don\'t die inside the temple. Bad for trade.',
          hasFire ? 'You\'re the relic-bearer? Then the temple is yours to brave. Meridian\'s gates are open to you.' : 'The temple\'s guardian doesn\'t fight everyone. It fights whoever the relics are humming for. No hum, no entry.',
        ],
      };

    case 'neve':
      return {
        speaker: 'Neve',
        pages: [
          'You\'re the ones Kael runs with? ...He talks about you. Won\'t admit it, but he does.',
          betrayed
            ? 'When this is over, drag my brother home alive. He\'s all I have, and he KNOWS it, the ass.'
            : 'He left me in this port to "keep me safe" while he chases relics. Ask him about the scar on his left hand sometime. He got it climbing INTO my window, not out of trouble.',
        ],
      };

    // ── Stonewatch ──
    case 'quarryChief':
      return {
        speaker: 'Quarry Chief',
        pages: [
          'Stonewatch cuts the stone that built Aurelia\'s spires. Good bones in this ground.',
          hasEarth ? 'The deep roads have gone quiet since your fight. Quiet is good. Quiet means the graves stopped knocking.' : 'Don\'t go into the Hollow Deep, whatever you\'ve heard. The graves down there have been knocking for a month. KNOCKING.',
        ],
      };

    case 'warden':
      return {
        speaker: 'Warden',
        pages: [
          'I keep the grave-tolls and the gate-keys. The Hollow Deep\'s gate has been sealed two hundred years — we unsealed it last spring. Fools and scholars, both.',
          hasEarth ? 'You closed what the scholars opened. Stonewatch owes you a debt we will never speak of again, because speaking of it frightens me.' : 'The Earth Relic is down there, if the old maps lie true. The knocking gets louder every week. If you\'re going, go soon.',
        ],
      };

    // ── Skyhold ──
    case 'windreader':
      return {
        speaker: 'Windreader',
        pages: [
          'We read tomorrow in today\'s wind. Today\'s wind is... difficult. It keeps laughing at a joke it won\'t share.',
          hasStorm ? 'The Spire\'s storm has stopped for the first time in living memory. The monks are calling it an omen. It is. I just can\'t tell you of WHAT yet.' : 'The Storm Spire stands above us. No one has summited it since the relic was set. The wind up there does not want visitors.',
        ],
      };

    case 'abbot':
      return {
        speaker: 'Abbot',
        pages: [
          'Welcome to Skyhold, traveler. The wind is thick with story today.',
          // Aria's true nature — design doc: player can figure this out by paying attention
          'Your companion — the one called Aria. She bows like the mountain monasteries teach. She is no healer of the temples; she is of our order. A monk who heals. We are proud of her.',
        ],
      };

    // ── Aurelia ──
    case 'chronicler':
      return {
        speaker: 'Chronicler',
        pages: [
          'I record what the crown forgets. Lately that is: green skies, silent tides, humming graves, and a stopped storm. All in one season.',
          betrayed ? 'And now a hole in the sky over the eastern wastes. I have no ink for this. I am using silverleaf, which is not done, historically.' : 'The Conduit Gate predates the kingdom. It predates the LANGUAGE, if the dating is honest. Nothing good is behind a door that old.',
        ],
      };

    case 'highScholar':
      return {
        speaker: 'High Scholar',
        pages: [
          'Aurelia lends you the Zephyr because Aurelia is afraid. Fear is honest; that is why scholars distrust it.',
          hasStorm ? 'Five relics, one bearer. The torn pages of the Verdan codex say: "The set wakes for one bearer, and answers one question." Choose your question carefully, bearer.' : 'The Spire\'s relic is the last. Bring it back and the codex\'s final page might finally make sense. Or finally terrify us. One of the two.',
        ],
      };

    default:
      return ambientTown();
  }
}