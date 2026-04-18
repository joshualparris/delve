window.SIGIL_CONTENT = (() => {
  const classes = {
    fighter: {
      id: 'fighter',
      name: 'Fighter',
      color: 'var(--c-fighter)',
      role: 'Frontline bruiser',
      base: { maxHp: 34, ac: 17, speed: 5, init: 1, attackBonus: 6, meleeDie: '1d8+3', rangedDie: '1d6+3', con: 3, dex: 1, wis: 1 },
      abilities: ['slash', 'shieldBash', 'sweepingBlow', 'secondWind', 'guardStance'],
      reaction: 'parry',
      resource: { key: 'grit', name: 'Grit', max: 2, shortRest: 2 }
    },
    rogue: {
      id: 'rogue',
      name: 'Rogue',
      color: 'var(--c-rogue)',
      role: 'Mobile finisher',
      base: { maxHp: 26, ac: 15, speed: 6, init: 4, attackBonus: 7, meleeDie: '1d6+4', rangedDie: '1d6+4', con: 1, dex: 4, wis: 1 },
      abilities: ['stab', 'backstab', 'throwKnife', 'quickstep', 'smokeBomb'],
      reaction: 'opportunity',
      resource: { key: 'cunning', name: 'Cunning', max: 2, shortRest: 1 }
    },
    cleric: {
      id: 'cleric',
      name: 'Cleric',
      color: 'var(--c-cleric)',
      role: 'Support and control',
      base: { maxHp: 28, ac: 16, speed: 5, init: 0, attackBonus: 5, meleeDie: '1d6+2', rangedDie: '1d8+3', con: 2, dex: 0, wis: 4 },
      abilities: ['mace', 'radiantBolt', 'healingWord', 'sanctify', 'turnTheProfane'],
      reaction: 'opportunity',
      resource: { key: 'faith', name: 'Faith', max: 4, shortRest: 2 }
    },
    wizard: {
      id: 'wizard',
      name: 'Wizard',
      color: 'var(--c-wizard)',
      role: 'Burst and control',
      base: { maxHp: 22, ac: 13, speed: 5, init: 2, attackBonus: 6, meleeDie: '1d4+1', rangedDie: '1d10+3', con: 1, dex: 2, wis: 2 },
      abilities: ['staff', 'fireBolt', 'frostBind', 'arcBurst', 'mistyStep'],
      reaction: 'wardingShield',
      resource: { key: 'arcana', name: 'Arcana', max: 4, shortRest: 2 }
    }
  };

  const abilities = {
    slash: { id: 'slash', name: 'Slash', type: 'attack', range: 1, cost: {}, action: 'action', mode: 'melee', desc: 'A steady weapon strike.' },
    shieldBash: { id: 'shieldBash', name: 'Shield Bash', type: 'attack', range: 1, cost: { grit: 1 }, action: 'bonus', mode: 'melee', desc: 'Light damage, then a Strength save or the target falls prone.' },
    sweepingBlow: { id: 'sweepingBlow', name: 'Sweeping Blow', type: 'attack', range: 1, cost: { grit: 1 }, action: 'action', mode: 'melee-aoe', desc: 'Strike up to two adjacent foes.' },
    secondWind: { id: 'secondWind', name: 'Second Wind', type: 'self', range: 0, cost: { grit: 1 }, action: 'bonus', mode: 'heal', desc: 'Recover 1d10 + 4 HP.' },
    guardStance: { id: 'guardStance', name: 'Guard Stance', type: 'self', range: 0, cost: {}, action: 'bonus', mode: 'buff', desc: '+2 AC until your next turn.' },
    parry: { id: 'parry', name: 'Parry', type: 'reaction', mode: 'reduce', desc: 'Reduce incoming weapon damage by 1d6 + 2.' },

    stab: { id: 'stab', name: 'Stab', type: 'attack', range: 1, cost: {}, action: 'action', mode: 'melee', desc: 'A quick blade strike.' },
    backstab: { id: 'backstab', name: 'Backstab', type: 'attack', range: 1, cost: {}, action: 'action', mode: 'melee', desc: 'Deals extra damage if the target is threatened or you have advantage.' },
    throwKnife: { id: 'throwKnife', name: 'Throw Knife', type: 'attack', range: 4, cost: {}, action: 'action', mode: 'ranged', desc: 'A precise ranged strike.' },
    quickstep: { id: 'quickstep', name: 'Quickstep', type: 'self', range: 0, cost: { cunning: 1 }, action: 'bonus', mode: 'mobility', desc: 'Gain 3 free movement and ignore opportunity attacks this turn.' },
    smokeBomb: { id: 'smokeBomb', name: 'Smoke Bomb', type: 'self', range: 0, cost: { cunning: 1 }, action: 'bonus', mode: 'stealth', desc: 'Become invisible until after your next attack or spell.' },

    mace: { id: 'mace', name: 'Mace', type: 'attack', range: 1, cost: {}, action: 'action', mode: 'melee', desc: 'Solid melee strike.' },
    radiantBolt: { id: 'radiantBolt', name: 'Radiant Bolt', type: 'attack', range: 5, cost: { faith: 1 }, action: 'action', mode: 'ranged', desc: 'A guided beam of sacred light.' },
    healingWord: { id: 'healingWord', name: 'Healing Word', type: 'ally', range: 4, cost: { faith: 1 }, action: 'bonus', mode: 'heal', desc: 'Restore 1d6 + 4 HP to an ally.' },
    sanctify: { id: 'sanctify', name: 'Sanctify', type: 'self', range: 0, cost: { faith: 1 }, action: 'action', mode: 'concentration', concentration: true, desc: 'Concentrate to bless allies within 2 tiles: +1d4 to attacks and saves.' },
    turnTheProfane: { id: 'turnTheProfane', name: 'Turn the Profane', type: 'area', range: 3, cost: { faith: 2 }, action: 'action', mode: 'control', desc: 'Undead and cult foes in 3 tiles make a Wisdom save or become frightened.' },

    staff: { id: 'staff', name: 'Staff', type: 'attack', range: 1, cost: {}, action: 'action', mode: 'melee', desc: 'Not elegant, but effective.' },
    fireBolt: { id: 'fireBolt', name: 'Fire Bolt', type: 'attack', range: 6, cost: { arcana: 1 }, action: 'action', mode: 'ranged', desc: 'Ranged spell attack; on hit the target burns.' },
    frostBind: { id: 'frostBind', name: 'Frost Bind', type: 'attack', range: 5, cost: { arcana: 1 }, action: 'action', mode: 'save', concentration: true, desc: 'A freezing snare. Dex save or restrained while you concentrate.' },
    arcBurst: { id: 'arcBurst', name: 'Arc Burst', type: 'area', range: 4, radius: 1, cost: { arcana: 2 }, action: 'action', mode: 'aoe', desc: 'Burst a small arcane blast.' },
    mistyStep: { id: 'mistyStep', name: 'Misty Step', type: 'self', range: 4, cost: { arcana: 1 }, action: 'bonus', mode: 'teleport', desc: 'Teleport up to 4 tiles to a clear space.' },
    wardingShield: { id: 'wardingShield', name: 'Warding Shield', type: 'reaction', cost: { arcana: 1 }, mode: 'ac', desc: 'When hit, gain +4 AC against that strike if it turns the hit into a miss.' }
  };

  const monsters = {
    cultist: {
      id: 'cultist', name: 'Cultist', role: 'Skirmisher', maxHp: 12, ac: 12, speed: 5, init: 1, attackBonus: 4, damage: '1d6+2', range: 1, saveMods: { dex: 1, wis: 1, con: 0 }, ai: 'skirmisher', traits: ['pack'], tags: ['humanoid', 'profane']
    },
    skulk: {
      id: 'skulk', name: 'Skulk', role: 'Ambusher', maxHp: 10, ac: 14, speed: 6, init: 4, attackBonus: 5, damage: '1d4+3', range: 1, saveMods: { dex: 3, wis: 0, con: 0 }, ai: 'ambusher', traits: ['mobile'], tags: ['humanoid']
    },
    boneArcher: {
      id: 'boneArcher', name: 'Bone Archer', role: 'Archer', maxHp: 14, ac: 13, speed: 5, init: 2, attackBonus: 5, damage: '1d8+2', range: 6, saveMods: { dex: 2, wis: 0, con: 1 }, ai: 'archer', traits: [], tags: ['undead', 'profane']
    },
    graveHound: {
      id: 'graveHound', name: 'Grave Hound', role: 'Hunter', maxHp: 16, ac: 13, speed: 7, init: 3, attackBonus: 5, damage: '1d6+3', range: 1, saveMods: { dex: 2, wis: 0, con: 1 }, ai: 'hound', traits: ['trip'], tags: ['beast', 'profane']
    },
    ironWarden: {
      id: 'ironWarden', name: 'Iron Warden', role: 'Tank', maxHp: 24, ac: 16, speed: 4, init: 0, attackBonus: 5, damage: '1d8+3', range: 1, saveMods: { dex: 0, wis: 1, con: 3 }, ai: 'tank', traits: ['guard'], tags: ['construct']
    },
    emberMage: {
      id: 'emberMage', name: 'Ember Mage', role: 'Caster', maxHp: 15, ac: 12, speed: 5, init: 2, attackBonus: 5, damage: '1d10+2', range: 5, saveMods: { dex: 1, wis: 2, con: 0 }, ai: 'caster', traits: ['burn'], tags: ['humanoid', 'profane']
    },
    bogBrute: {
      id: 'bogBrute', name: 'Bog Brute', role: 'Bruiser', maxHp: 28, ac: 13, speed: 4, init: -1, attackBonus: 6, damage: '2d6+3', range: 1, saveMods: { dex: -1, wis: 0, con: 3 }, ai: 'bruiser', traits: ['slam'], tags: ['giant']
    },
    chainCaller: {
      id: 'chainCaller', name: 'Chain Caller', role: 'Controller', maxHp: 18, ac: 13, speed: 5, init: 1, attackBonus: 4, damage: '1d6+2', range: 4, saveMods: { dex: 1, wis: 2, con: 1 }, ai: 'controller', traits: ['restrain'], tags: ['humanoid', 'profane']
    },
    sigilTyrant: {
      id: 'sigilTyrant', name: 'Sigil Tyrant', role: 'Boss', maxHp: 70, ac: 17, speed: 5, init: 3, attackBonus: 8, damage: '2d8+4', range: 1, saveMods: { dex: 2, wis: 4, con: 4 }, ai: 'boss', traits: ['boss', 'pulse', 'summon'], tags: ['boss', 'profane']
    }
  };

  const terrain = {
    floor: { id: 'floor', name: 'Floor', passable: true, blocksLoS: false, moveCost: 1 },
    wall: { id: 'wall', name: 'Wall', passable: false, blocksLoS: true, moveCost: 99 },
    pillar: { id: 'pillar', name: 'Pillar', passable: false, blocksLoS: true, moveCost: 99, cover: true },
    spikes: { id: 'spikes', name: 'Spike Trap', passable: true, blocksLoS: false, moveCost: 1, enterDamage: '1d4+1' },
    mire: { id: 'mire', name: 'Difficult Ground', passable: true, blocksLoS: false, moveCost: 2 },
    barrel: { id: 'barrel', name: 'Volatile Barrel', passable: true, blocksLoS: false, moveCost: 1, explosive: true, hp: 1 },
    necro: { id: 'necro', name: 'Necrotic Sigil', passable: true, blocksLoS: false, moveCost: 1, auraDamage: '1d4' },
    shrine: { id: 'shrine', name: 'Healing Shrine', passable: true, blocksLoS: false, moveCost: 1, heal: '1d6+2' }
  };

  const roomTemplates = {
    chapelCross: {
      id: 'chapelCross', name: 'Shattered Chapel', width: 8, height: 6,
      terrain: [
        '........',
        '..p..p..',
        '...mm...',
        '...mm...',
        '..p..p..',
        '........'
      ]
    },
    hallSpikes: {
      id: 'hallSpikes', name: 'Hall of Teeth', width: 8, height: 6,
      terrain: [
        '........',
        '.s.s.s..',
        '........',
        '..pp....',
        '........',
        '....b...'
      ]
    },
    cryptLanes: {
      id: 'cryptLanes', name: 'Split Crypt', width: 8, height: 6,
      terrain: [
        '.p....p.',
        '.p.mm.p.',
        '.p....p.',
        '.p....p.',
        '.p.mm.p.',
        '.p....p.'
      ]
    },
    furnace: {
      id: 'furnace', name: 'Ash Furnace', width: 8, height: 6,
      terrain: [
        '...n....',
        '.m...m..',
        '..b.p...',
        '...p.b..',
        '..m...m.',
        '....n...'
      ]
    },
    sanctumBoss: {
      id: 'sanctumBoss', name: 'Sigil Sanctum', width: 8, height: 6,
      terrain: [
        '..p..p..',
        '.n....n.',
        '...bb...',
        '...ss...',
        '.m....m.',
        '..p..p..'
      ]
    }
  };

  const encounters = {
    easy: [
      ['cultist', 'cultist', 'skulk'],
      ['graveHound', 'cultist', 'boneArcher'],
      ['cultist', 'skulk', 'boneArcher']
    ],
    mid: [
      ['bogBrute', 'cultist', 'boneArcher'],
      ['graveHound', 'graveHound', 'chainCaller'],
      ['ironWarden', 'skulk', 'emberMage']
    ],
    hard: [
      ['ironWarden', 'bogBrute', 'boneArcher'],
      ['emberMage', 'chainCaller', 'graveHound', 'cultist'],
      ['ironWarden', 'emberMage', 'skulk', 'boneArcher']
    ],
    boss: [
      ['sigilTyrant', 'boneArcher', 'chainCaller']
    ]
  };

  const events = {
    healingShrine: {
      id: 'healingShrine',
      title: 'Quiet Shrine',
      text: 'A warded basin still holds a thread of gentle power.',
      choices: [
        { id: 'pray', label: 'Pray for relief', effect: 'healAllMinor' },
        { id: 'channel', label: 'Draw out the blessing', effect: 'restoreClericWizard' }
      ]
    },
    cursedFont: {
      id: 'cursedFont',
      title: 'Cursed Font',
      text: 'Dark water promises strength for a price.',
      choices: [
        { id: 'drink', label: 'Drink the font', effect: 'powerAtCost' },
        { id: 'refuse', label: 'Leave it', effect: 'none' }
      ]
    },
    armoury: {
      id: 'armoury',
      title: 'Forgotten Armoury',
      text: 'You find a rack of workable relics.',
      choices: [
        { id: 'relics', label: 'Take a relic', effect: 'relicPick' }
      ]
    },
    tripwire: {
      id: 'tripwire',
      title: 'Tripwire Hall',
      text: 'Metal teeth snap from the walls as you pass.',
      choices: [
        { id: 'brace', label: 'Brace and push through', effect: 'trapDamageLight' },
        { id: 'disarm', label: 'Try to disarm it', effect: 'rogueDisarm' }
      ]
    }
  };

  const relics = [
    { id: 'keenEdges', name: 'Keen Edges', desc: 'All weapon attacks gain +1 to hit.' },
    { id: 'amberVial', name: 'Amber Vial', desc: 'The party gains 1 extra potion charge.' },
    { id: 'wardedMail', name: 'Warded Mail', desc: 'Frontliners gain +1 AC.' },
    { id: 'saintsThread', name: 'Saint\'s Thread', desc: 'Healing you cast restores +2 HP.' },
    { id: 'emberShard', name: 'Ember Shard', desc: 'Fire effects deal +1 damage per die.' }
  ];

  const routeBlueprint = [
    [{ type: 'combat', tier: 'easy' }, { type: 'event', eventId: 'healingShrine' }],
    [{ type: 'combat', tier: 'easy' }, { type: 'treasure' }],
    [{ type: 'event', eventId: 'tripwire' }, { type: 'combat', tier: 'mid' }],
    [{ type: 'rest' }, { type: 'combat', tier: 'mid' }],
    [{ type: 'combat', tier: 'hard' }, { type: 'event', eventId: 'cursedFont' }],
    [{ type: 'treasure' }, { type: 'combat', tier: 'hard' }],
    [{ type: 'boss' }]
  ];

  function charToTerrain(ch) {
    return {
      '.': 'floor',
      '#': 'wall',
      'p': 'pillar',
      's': 'spikes',
      'm': 'mire',
      'b': 'barrel',
      'n': 'necro',
      'h': 'shrine'
    }[ch] || 'floor';
  }

  return {
    classes,
    abilities,
    monsters,
    terrain,
    roomTemplates,
    encounters,
    events,
    relics,
    routeBlueprint,
    charToTerrain
  };
})();
