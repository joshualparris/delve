(() => {
  const C = window.SIGIL_CONTENT;
  const STORAGE_KEY = 'sigil-delve-save-v1';
  const APP_VERSION = '1.0.0';

  const app = {
    state: null,
    els: {},
    busy: false,
    tests: { ok: true, messages: [] }
  };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheEls();
    bindGlobalEvents();
    registerSW();
    runSelfChecks();
    renderTitle();
  }

  function cacheEls() {
    app.els.root = document.getElementById('app');
    app.els.titleScreen = document.getElementById('title-screen');
    app.els.helpScreen = document.getElementById('help-screen');
    app.els.victoryScreen = document.getElementById('victory-screen');
    app.els.defeatScreen = document.getElementById('defeat-screen');
    app.els.gameScreen = document.getElementById('game-screen');
    app.els.overlay = document.getElementById('overlay-panel');
    app.els.mapPanel = document.getElementById('map-panel');
    app.els.partyPanel = document.getElementById('party-panel');
    app.els.turnPanel = document.getElementById('turn-panel');
    app.els.board = document.getElementById('board');
    app.els.log = document.getElementById('combat-log');
    app.els.actions = document.getElementById('action-bar');
    app.els.selection = document.getElementById('selection-panel');
    app.els.topbar = document.getElementById('topbar');
  }

  function bindGlobalEvents() {
    document.getElementById('new-run-btn').addEventListener('click', () => {
      startNewRun();
    });
    document.getElementById('continue-run-btn').addEventListener('click', () => {
      const loaded = loadRun();
      if (!loaded) {
        flashOverlay('No saved run found.');
      }
    });
    document.getElementById('title-help-btn').addEventListener('click', () => {
      showScreen('help');
    });
    document.getElementById('back-to-title-btn').addEventListener('click', () => {
      showScreen('title');
      renderTitle();
    });
    document.getElementById('save-run-btn').addEventListener('click', () => {
      if (!app.state) return;
      saveRun();
      flashOverlay('Run saved.');
    });
    document.getElementById('return-title-btn').addEventListener('click', () => {
      showScreen('title');
      renderTitle();
    });
    document.getElementById('play-again-btn').addEventListener('click', () => {
      startNewRun();
    });
    document.getElementById('defeat-return-btn').addEventListener('click', () => {
      showScreen('title');
      renderTitle();
    });

    app.els.board.addEventListener('click', onBoardClick);
    app.els.actions.addEventListener('click', onActionBarClick);
    app.els.partyPanel.addEventListener('click', onPartyPanelClick);
    app.els.mapPanel.addEventListener('click', onMapPanelClick);
    app.els.overlay.addEventListener('click', onOverlayClick);
  }

  function runSelfChecks() {
    const before = 123456789 >>> 0;
    const one = nextRngValue({ rngState: before });
    const two = nextRngValue({ rngState: before });
    if (one !== two) {
      app.tests.ok = false;
      app.tests.messages.push('Deterministic RNG failed.');
    }
    const sample = parseDice('2d6+3');
    if (!sample || sample.count !== 2 || sample.sides !== 6 || sample.mod !== 3) {
      app.tests.ok = false;
      app.tests.messages.push('Dice parser failed.');
    }
    app.tests.messages.push(app.tests.ok ? 'Self-checks passed.' : 'Self-checks failed.');
    console.info('[Sigil Delve tests]', app.tests.messages.join(' '));
  }

  function renderTitle() {
    const hasSave = !!localStorage.getItem(STORAGE_KEY);
    document.getElementById('continue-run-btn').disabled = !hasSave;
    document.getElementById('title-tests').textContent = app.tests.messages.join(' ');
    showScreen('title');
  }

  function showScreen(name) {
    const screens = ['title', 'help', 'game', 'victory', 'defeat'];
    screens.forEach((id) => {
      const el = document.getElementById(`${id}-screen`);
      if (el) el.hidden = id !== name;
    });
  }

  function startNewRun() {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const dungeonMap = buildDungeonMap(seed);
    app.state = {
      version: APP_VERSION,
      seed,
      rngState: seed,
      screen: 'dungeon',
      stageIndex: 0,
      currentNodeId: null,
      currentEvent: null,
      rewardChoices: null,
      combat: null,
      relics: [],
      potions: 2,
      shortRestCharges: 2,
      dungeonMap,
      stats: {
        roomsCleared: 0,
        damageDealt: 0,
        damageTaken: 0,
        healingDone: 0,
        enemiesSlain: 0,
        downedHeroes: 0,
        turnsTaken: 0,
        score: 0,
        startedAt: Date.now()
      },
      log: [{ text: 'The sigil gate yawns open. Your party descends.', tone: 'system' }],
      ui: {
        selectedId: 'fighter-1',
        mode: 'idle',
        selectedAbility: null,
        selectedTile: null,
        highlights: { move: [], targets: [], aoe: [] },
        message: 'Choose your path into the delve.',
        actionLocked: false
      },
      party: createParty(),
      bossDefeated: false,
      runEnded: false
    };
    autoSave();
    render();
  }

  function createParty() {
    return ['fighter', 'rogue', 'cleric', 'wizard'].map((classId, i) => createHero(classId, i + 1));
  }

  function createHero(classId, index) {
    const cls = C.classes[classId];
    return {
      id: `${classId}-${index}`,
      classId,
      side: 'party',
      name: cls.name,
      role: cls.role,
      color: cls.color,
      maxHp: cls.base.maxHp,
      hp: cls.base.maxHp,
      baseAc: cls.base.ac,
      speed: cls.base.speed,
      initMod: cls.base.init,
      attackBonus: cls.base.attackBonus,
      meleeDie: cls.base.meleeDie,
      rangedDie: cls.base.rangedDie,
      saves: { dex: cls.base.dex, wis: cls.base.wis, con: cls.base.con },
      resource: {
        key: cls.resource.key,
        name: cls.resource.name,
        current: cls.resource.max,
        max: cls.resource.max
      },
      abilities: [...cls.abilities],
      reactionType: cls.reaction,
      alive: true,
      x: 0,
      y: 0,
      conditions: [],
      concentration: null,
      movementLeft: cls.base.speed,
      usedAction: false,
      usedBonus: false,
      reactionAvailable: true,
      temp: { freeMove: 0, noOpportunity: false, guardStance: false },
      status: { downed: false },
      ai: null,
      tags: ['hero']
    };
  }

  function buildDungeonMap(seed) {
    const temp = { rngState: seed };
    return C.routeBlueprint.map((column, colIndex) => column.map((baseNode, nodeIndex) => {
      const node = deepClone(baseNode);
      node.id = `n-${colIndex}-${nodeIndex}`;
      node.column = colIndex;
      node.nodeIndex = nodeIndex;
      node.state = 'locked';
      if (node.type === 'combat') {
        node.templateId = randChoiceFromTemp(temp, ['chapelCross', 'hallSpikes', 'cryptLanes', 'furnace']);
        node.encounterIndex = randIntFromTemp(temp, 0, C.encounters[node.tier].length - 1);
      }
      if (node.type === 'boss') {
        node.templateId = 'sanctumBoss';
        node.encounterIndex = 0;
      }
      return node;
    }));
  }

  function randChoiceFromTemp(stateLike, arr) {
    return arr[randIntFromTemp(stateLike, 0, arr.length - 1)];
  }

  function randIntFromTemp(stateLike, min, max) {
    const v = nextRngValue(stateLike);
    return min + Math.floor(v * (max - min + 1));
  }

  function nextRngValue(stateLike) {
    stateLike.rngState = ((1664525 * stateLike.rngState + 1013904223) >>> 0);
    return stateLike.rngState / 4294967296;
  }

  function random() {
    return nextRngValue(app.state);
  }

  function randInt(min, max) {
    return min + Math.floor(random() * (max - min + 1));
  }

  function randChoice(arr) {
    return arr[randInt(0, arr.length - 1)];
  }

  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function parseDice(expr) {
    const match = /^([0-9]+)d([0-9]+)([+-][0-9]+)?$/i.exec(expr.trim());
    if (!match) return null;
    return {
      count: Number(match[1]),
      sides: Number(match[2]),
      mod: match[3] ? Number(match[3]) : 0
    };
  }

  function rollDice(expr, note) {
    const parsed = parseDice(expr);
    if (!parsed) return { total: 0, parts: [], mod: 0, text: expr };
    const parts = [];
    let total = parsed.mod;
    for (let i = 0; i < parsed.count; i++) {
      const roll = randInt(1, parsed.sides);
      parts.push(roll);
      total += roll;
    }
    return {
      total,
      parts,
      mod: parsed.mod,
      text: `${parsed.count}d${parsed.sides}${parsed.mod >= 0 ? '+' : ''}${parsed.mod}`,
      note: note || ''
    };
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function saveRun() {
    if (!app.state) return;
    const serial = makeSerializableState(app.state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serial));
  }

  function autoSave() {
    if (!app.state || app.state.runEnded) return;
    saveRun();
  }

  function makeSerializableState(state) {
    const serial = deepClone(state);
    if (serial.combat && serial.combat.turnSnapshot) {
      serial.combat.turnSnapshot = null;
    }
    return serial;
  }

  function loadRun() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      app.state = JSON.parse(raw);
      app.state.version = APP_VERSION;
      app.state.ui = app.state.ui || { selectedId: 'fighter-1', mode: 'idle', selectedAbility: null, selectedTile: null, highlights: { move: [], targets: [], aoe: [] }, message: 'Run loaded.' };
      if (app.state.combat && !app.state.combat.turnSnapshot) {
        app.state.combat.turnSnapshot = null;
      }
      render();
      return true;
    } catch (err) {
      console.error(err);
      flashOverlay('Could not load the saved run.');
      return false;
    }
  }

  function clearSave() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function render() {
    if (!app.state) return renderTitle();
    if (app.state.runEnded && app.state.bossDefeated) {
      renderVictory();
      return;
    }
    if (app.state.runEnded && !hasLivingParty()) {
      renderDefeat();
      return;
    }
    showScreen('game');
    renderTopbar();
    renderMapPanel();
    renderPartyPanel();
    renderTurnPanel();
    renderBoard();
    renderActionBar();
    renderSelectionPanel();
    renderLog();
    renderOverlay();
    autoSave();
  }

  function renderTopbar() {
    const floor = app.state.stageIndex + 1;
    const phase = app.state.combat ? `Combat — Round ${app.state.combat.round}` : 'Expedition';
    const alive = app.state.party.filter((p) => p.alive).length;
    app.els.topbar.innerHTML = `
      <div class="topbar-left">
        <div class="brand-mark">SIGIL DELVE</div>
        <div class="subtle">Seed ${app.state.seed}</div>
      </div>
      <div class="topbar-mid">
        <div class="pill">${phase}</div>
        <div class="pill">Room ${Math.min(floor, app.state.dungeonMap.length + 1)} / ${app.state.dungeonMap.length + 1}</div>
        <div class="pill">Potions ${app.state.potions}</div>
        <div class="pill">Rests ${app.state.shortRestCharges}</div>
      </div>
      <div class="topbar-right">
        <div class="pill ${alive < 2 ? 'danger' : ''}">${alive} heroes standing</div>
      </div>
    `;
  }

  function renderMapPanel() {
    const stageIndex = app.state.stageIndex;
    const columnsHtml = app.state.dungeonMap.map((col, colIndex) => {
      const items = col.map((node) => {
        const current = app.state.currentNodeId === node.id;
        const unlocked = colIndex === stageIndex && !app.state.currentNodeId && !app.state.combat && !app.state.currentEvent && !app.state.rewardChoices;
        const cleared = node.state === 'cleared';
        const boss = node.type === 'boss';
        const label = boss ? 'Boss' : titleCase(node.type);
        return `
          <button class="map-node ${current ? 'current' : ''} ${cleared ? 'cleared' : ''} ${boss ? 'boss' : ''} ${unlocked ? 'unlocked' : ''}"
            data-node-id="${node.id}" ${unlocked ? '' : 'disabled'}>
            <span>${label}</span>
            ${node.tier ? `<small>${node.tier}</small>` : ''}
          </button>
        `;
      }).join('');
      return `<div class="map-column ${colIndex < stageIndex ? 'done' : ''}">${items}</div>`;
    }).join('');

    const relics = app.state.relics.length ? app.state.relics.map((rId) => C.relics.find((r) => r.id === rId)).filter(Boolean).map((r) => `<li><strong>${r.name}</strong><span>${r.desc}</span></li>`).join('') : '<li><span>No relics claimed yet.</span></li>';

    app.els.mapPanel.innerHTML = `
      <section class="panel-block">
        <h2>Route</h2>
        <div class="map-grid">${columnsHtml}</div>
      </section>
      <section class="panel-block">
        <h2>Relics</h2>
        <ul class="relic-list">${relics}</ul>
      </section>
    `;
  }

  function renderPartyPanel() {
    const cards = app.state.party.map((hero) => {
      const selected = app.state.ui.selectedId === hero.id;
      const cls = C.classes[hero.classId];
      const ac = getArmorClass(hero);
      const resourceText = `${hero.resource.name}: ${hero.resource.current}/${hero.resource.max}`;
      const conditions = hero.conditions.length ? hero.conditions.map((c) => `<span class="condition-chip">${labelCondition(c.id)}</span>`).join('') : '<span class="subtle">steady</span>';
      return `
        <button class="party-card ${selected ? 'selected' : ''} ${!hero.alive ? 'dead' : ''}" data-party-id="${hero.id}">
          <div class="party-head">
            <span class="hero-dot hero-${hero.classId}"></span>
            <strong>${hero.name}</strong>
            <span class="subtle">${cls.role}</span>
          </div>
          <div class="meter-row"><span>HP</span><div class="meter"><i style="width:${Math.max(0, (hero.hp / hero.maxHp) * 100)}%"></i></div><span>${hero.hp}/${hero.maxHp}</span></div>
          <div class="party-mini"><span>AC ${ac}</span><span>${resourceText}</span></div>
          <div class="condition-row">${conditions}</div>
        </button>
      `;
    }).join('');
    app.els.partyPanel.innerHTML = `<section class="panel-block"><h2>Party</h2><div class="party-grid">${cards}</div></section>`;
  }

  function renderTurnPanel() {
    if (!app.state.combat) {
      app.els.turnPanel.innerHTML = `
        <section class="panel-block">
          <h2>Turn Order</h2>
          <p class="subtle">Turn order appears here once combat begins.</p>
        </section>
      `;
      return;
    }
    const order = app.state.combat.order.map((id, idx) => {
      const entity = getEntity(id);
      if (!entity || !entity.alive) return '';
      const active = idx === app.state.combat.turnIndex;
      return `<div class="turn-pill ${active ? 'active' : ''} ${entity.side}"><span>${entity.name}</span><small>${entity.hp}/${entity.maxHp}</small></div>`;
    }).join('');
    app.els.turnPanel.innerHTML = `
      <section class="panel-block">
        <h2>Turn Order</h2>
        <div class="turn-order-list">${order}</div>
      </section>
    `;
  }

  function renderBoard() {
    if (!app.state.combat) {
      app.els.board.innerHTML = `
        <div class="board-empty">
          <div class="sigil-icon">✦</div>
          <h3>Choose the next room</h3>
          <p>${app.state.ui.message || 'Your path waits ahead.'}</p>
        </div>
      `;
      return;
    }
    const { map } = app.state.combat;
    const selected = getEntity(app.state.ui.selectedId);
    const moveSet = new Set(app.state.ui.highlights.move.map((p) => key(p.x, p.y)));
    const targetSet = new Set(app.state.ui.highlights.targets.map((p) => key(p.x, p.y)));
    const aoeSet = new Set(app.state.ui.highlights.aoe.map((p) => key(p.x, p.y)));
    const tiles = [];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const k = key(x, y);
        const cell = getCell(x, y);
        const entity = entityAt(x, y);
        const terrain = C.terrain[cell.terrain];
        const classes = ['tile', `terrain-${cell.terrain}`];
        if (moveSet.has(k)) classes.push('hl-move');
        if (targetSet.has(k)) classes.push('hl-target');
        if (aoeSet.has(k)) classes.push('hl-aoe');
        if (selected && selected.x === x && selected.y === y) classes.push('selected');
        if (entity) classes.push(entity.side === 'party' ? 'occupied-party' : 'occupied-enemy');
        tiles.push(`
          <button class="${classes.join(' ')}" data-x="${x}" data-y="${y}" aria-label="${terrain.name}${entity ? `, ${entity.name}` : ''}">
            <span class="terrain-mark">${terrainGlyph(cell.terrain)}</span>
            ${entity ? `<span class="unit-token hero-${entity.classId || 'enemy'} ${!entity.alive ? 'dead' : ''}"><i>${tokenGlyph(entity)}</i><b>${entity.hp}</b></span>` : ''}
          </button>
        `);
      }
    }
    app.els.board.style.setProperty('--cols', String(map.width));
    app.els.board.innerHTML = `<div class="board-grid">${tiles.join('')}</div>`;
  }

  function renderActionBar() {
    if (!app.state.combat) {
      app.els.actions.innerHTML = `
        <div class="action-set">
          <button class="action-btn" data-action="save">Save</button>
          <button class="action-btn" data-action="title">Title</button>
        </div>
      `;
      return;
    }
    const active = getActiveEntity();
    if (!active || active.side !== 'party') {
      app.els.actions.innerHTML = `<div class="action-set"><div class="subtle">Enemy turn…</div></div>`;
      return;
    }
    const buttons = [];
    buttons.push(btn('Move', 'mode-move', false, 'Move up to your remaining speed.'));
    buttons.push(btn('Undo', 'undo-turn', !canUndo(), 'Rewind your current turn before random results were revealed.'));
    buttons.push(btn('End Turn', 'end-turn', false, 'Finish this hero’s turn.'));

    buttons.push(btn('Potion', 'ability:potion', active.usedBonus || app.state.potions < 1 || !active.alive, `Bonus action. Spend 1 potion to heal 1d8 + 2.`));

    active.abilities.forEach((abilityId) => {
      const ability = C.abilities[abilityId];
      const disabled = !canUseAbility(active, ability);
      buttons.push(btn(ability.name, `ability:${abilityId}`, disabled, ability.desc));
    });

    app.els.actions.innerHTML = `<div class="action-set">${buttons.join('')}</div>`;

    function btn(label, action, disabled, desc) {
      const selected = app.state.ui.selectedAbility && action === `ability:${app.state.ui.selectedAbility}`;
      return `
        <button class="action-btn ${selected ? 'selected' : ''}" data-action="${action}" ${disabled ? 'disabled' : ''}>
          <strong>${label}</strong>
          <small>${desc}</small>
        </button>
      `;
    }
  }

  function renderSelectionPanel() {
    const selected = app.state.combat ? getEntity(app.state.ui.selectedId) : app.state.party.find((h) => h.id === app.state.ui.selectedId) || app.state.party[0];
    if (!selected) {
      app.els.selection.innerHTML = `<section class="panel-block"><h2>Selection</h2><p class="subtle">Nothing selected.</p></section>`;
      return;
    }
    const conditions = selected.conditions.length ? selected.conditions.map((c) => `<li>${labelCondition(c.id)} ${c.duration ? `(${c.duration})` : ''}</li>`).join('') : '<li>None</li>';
    const concentration = selected.concentration ? C.abilities[selected.concentration.abilityId].name : 'None';
    const body = app.state.combat ? `
      <div class="selection-stats">
        <div><span>HP</span><strong>${selected.hp}/${selected.maxHp}</strong></div>
        <div><span>AC</span><strong>${getArmorClass(selected)}</strong></div>
        <div><span>Move</span><strong>${selected.movementLeft}</strong></div>
        <div><span>Action</span><strong>${selected.usedAction ? 'Spent' : 'Ready'}</strong></div>
        <div><span>Bonus</span><strong>${selected.usedBonus ? 'Spent' : 'Ready'}</strong></div>
        <div><span>Reaction</span><strong>${selected.reactionAvailable ? 'Ready' : 'Spent'}</strong></div>
      </div>
      <div class="subtle">Concentration: ${concentration}</div>
      <div class="subtle">${app.state.ui.message || 'Choose a move.'}</div>
    ` : `
      <p class="subtle">${app.state.ui.message || 'Press onward into the sigil depths.'}</p>
    `;
    app.els.selection.innerHTML = `
      <section class="panel-block">
        <h2>${selected.name}</h2>
        ${body}
        <h3>Conditions</h3>
        <ul class="bulletless">${conditions}</ul>
      </section>
    `;
  }

  function renderLog() {
    const items = app.state.log.slice(-80).reverse().map((entry) => `<div class="log-entry ${entry.tone || ''}">${entry.text}</div>`).join('');
    app.els.log.innerHTML = items || '<div class="log-entry subtle">The delve is quiet.</div>';
  }

  function renderOverlay() {
    if (app.state.combat) {
      app.els.overlay.innerHTML = '';
      app.els.overlay.hidden = true;
      return;
    }

    let html = '';
    const stageIndex = app.state.stageIndex;
    if (app.state.rewardChoices) {
      html = renderRewardOverlay();
    } else if (app.state.currentEvent) {
      html = renderEventOverlay();
    } else if (app.state.currentNodeId) {
      const node = getNodeById(app.state.currentNodeId);
      html = renderNodeOverlay(node);
    } else if (stageIndex >= app.state.dungeonMap.length) {
      html = `<div class="overlay-card"><h2>The gate dims</h2><p>The path is spent.</p></div>`;
    } else {
      const nodes = app.state.dungeonMap[stageIndex];
      html = `
        <div class="overlay-card">
          <h2>Choose your next room</h2>
          <p>Each step spends resources. Short rests are scarce. Pick your risk.</p>
          <div class="overlay-choices">
            ${nodes.map((n) => `<button class="overlay-choice" data-overlay-action="select-node" data-node-id="${n.id}"><strong>${prettyNode(n)}</strong><small>${describeNode(n)}</small></button>`).join('')}
          </div>
        </div>
      `;
    }

    app.els.overlay.hidden = false;
    app.els.overlay.innerHTML = html;
  }

  function renderNodeOverlay(node) {
    if (!node) return '';
    if (node.type === 'combat' || node.type === 'boss') {
      return `
        <div class="overlay-card">
          <h2>${prettyNode(node)}</h2>
          <p>${node.type === 'boss' ? 'The Sigil Tyrant waits beyond the final seal.' : 'A hostile chamber lies ahead.'}</p>
          <div class="overlay-choices">
            <button class="overlay-choice primary" data-overlay-action="enter-node" data-node-id="${node.id}"><strong>Enter combat</strong><small>${describeNode(node)}</small></button>
            <button class="overlay-choice" data-overlay-action="back-out"><strong>Back</strong><small>Reconsider your route.</small></button>
          </div>
        </div>
      `;
    }
    if (node.type === 'event') {
      return `
        <div class="overlay-card">
          <h2>${prettyNode(node)}</h2>
          <p>${describeNode(node)}</p>
          <div class="overlay-choices">
            <button class="overlay-choice primary" data-overlay-action="enter-node" data-node-id="${node.id}"><strong>Enter event</strong><small>See what chance has in store.</small></button>
            <button class="overlay-choice" data-overlay-action="back-out"><strong>Back</strong><small>Reconsider your route.</small></button>
          </div>
        </div>
      `;
    }
    if (node.type === 'treasure') {
      return `
        <div class="overlay-card">
          <h2>Treasure Cache</h2>
          <p>Choose one relic. The others fade once you leave.</p>
          <div class="overlay-choices"><button class="overlay-choice primary" data-overlay-action="treasure-open"><strong>Inspect the cache</strong><small>Reveal three relics.</small></button></div>
        </div>
      `;
    }
    if (node.type === 'rest') {
      return `
        <div class="overlay-card">
          <h2>Short Rest</h2>
          <p>You can pause only briefly. Recover some strength and refresh short-rest resources.</p>
          <div class="overlay-choices">
            <button class="overlay-choice primary" data-overlay-action="take-rest" ${app.state.shortRestCharges < 1 ? 'disabled' : ''}><strong>Take a short rest</strong><small>${app.state.shortRestCharges} remaining this run.</small></button>
            <button class="overlay-choice" data-overlay-action="skip-rest"><strong>Press on</strong><small>Keep your pace, save the rest.</small></button>
          </div>
        </div>
      `;
    }
    return '';
  }

  function renderRewardOverlay() {
    return `
      <div class="overlay-card">
        <h2>Choose a relic</h2>
        <div class="overlay-choices">
          ${app.state.rewardChoices.map((relicId) => {
            const relic = C.relics.find((r) => r.id === relicId);
            return `<button class="overlay-choice primary" data-overlay-action="claim-relic" data-relic-id="${relic.id}"><strong>${relic.name}</strong><small>${relic.desc}</small></button>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderEventOverlay() {
    const ev = C.events[app.state.currentEvent.eventId];
    return `
      <div class="overlay-card">
        <h2>${ev.title}</h2>
        <p>${ev.text}</p>
        <div class="overlay-choices">
          ${ev.choices.map((choice) => `<button class="overlay-choice primary" data-overlay-action="event-choice" data-choice-id="${choice.id}"><strong>${choice.label}</strong><small>${describeEventEffect(choice.effect)}</small></button>`).join('')}
        </div>
      </div>
    `;
  }

  function renderVictory() {
    showScreen('victory');
    const summary = buildRunSummary();
    document.getElementById('victory-summary').innerHTML = summary;
  }

  function renderDefeat() {
    showScreen('defeat');
    const summary = buildRunSummary();
    document.getElementById('defeat-summary').innerHTML = summary;
  }

  function buildRunSummary() {
    const elapsed = Math.max(1, Math.round((Date.now() - app.state.stats.startedAt) / 60000));
    const grade = scoreGrade(app.state.stats.score);
    return `
      <div class="summary-grid">
        <div><span>Grade</span><strong>${grade}</strong></div>
        <div><span>Score</span><strong>${app.state.stats.score}</strong></div>
        <div><span>Rooms cleared</span><strong>${app.state.stats.roomsCleared}</strong></div>
        <div><span>Enemies slain</span><strong>${app.state.stats.enemiesSlain}</strong></div>
        <div><span>Damage dealt</span><strong>${app.state.stats.damageDealt}</strong></div>
        <div><span>Damage taken</span><strong>${app.state.stats.damageTaken}</strong></div>
        <div><span>Healing done</span><strong>${app.state.stats.healingDone}</strong></div>
        <div><span>Minutes</span><strong>${elapsed}</strong></div>
      </div>
    `;
  }

  function scoreGrade(score) {
    if (score >= 850) return 'S';
    if (score >= 700) return 'A';
    if (score >= 550) return 'B';
    if (score >= 400) return 'C';
    return 'D';
  }

  function onPartyPanelClick(event) {
    const card = event.target.closest('[data-party-id]');
    if (!card || !app.state) return;
    const hero = app.state.party.find((p) => p.id === card.dataset.partyId);
    if (!hero) return;
    app.state.ui.selectedId = hero.id;
    app.state.ui.message = `${hero.name} selected.`;
    if (app.state.combat) clearTargeting();
    render();
  }

  function onMapPanelClick(event) {
    const btn = event.target.closest('[data-node-id]');
    if (!btn || !app.state || app.state.combat || app.state.currentNodeId || app.state.currentEvent || app.state.rewardChoices) return;
    selectNode(btn.dataset.nodeId);
  }

  function onOverlayClick(event) {
    const btn = event.target.closest('[data-overlay-action]');
    if (!btn || !app.state) return;
    const action = btn.dataset.overlayAction;
    if (action === 'select-node') return selectNode(btn.dataset.nodeId);
    if (action === 'enter-node') return enterCurrentNode();
    if (action === 'back-out') {
      app.state.currentNodeId = null;
      app.state.ui.message = 'Choose your next room.';
      return render();
    }
    if (action === 'treasure-open') return openTreasureChoices();
    if (action === 'claim-relic') return claimRelic(btn.dataset.relicId);
    if (action === 'take-rest') return takeShortRest();
    if (action === 'skip-rest') return completeCurrentNode('You press on without resting.');
    if (action === 'event-choice') return resolveEventChoice(btn.dataset.choiceId);
  }

  function selectNode(nodeId) {
    const node = getNodeById(nodeId);
    if (!node) return;
    app.state.currentNodeId = nodeId;
    if (node.type === 'event') {
      app.state.ui.message = `Entering ${prettyNode(node)}...`;
      enterCurrentNode();
      return;
    }
    app.state.ui.message = `Preparing ${prettyNode(node)}.`;
    render();
  }

  function enterCurrentNode() {
    const node = getNodeById(app.state.currentNodeId);
    if (!node) return;
    if (node.type === 'combat' || node.type === 'boss') {
      startCombat(node);
      return;
    }
    if (node.type === 'event') {
      app.state.currentEvent = { eventId: node.eventId };
      render();
      return;
    }
    if (node.type === 'treasure' || node.type === 'rest') {
      render();
      return;
    }
  }

  function openTreasureChoices() {
    const pool = shuffle(C.relics.map((r) => r.id).filter((id) => !app.state.relics.includes(id)));
    app.state.rewardChoices = pool.slice(0, 3);
    render();
  }

  function claimRelic(relicId) {
    if (!app.state.relics.includes(relicId)) app.state.relics.push(relicId);
    applyRelicImmediate(relicId);
    app.state.rewardChoices = null;
    completeCurrentNode(`You claim ${C.relics.find((r) => r.id === relicId).name}.`);
  }

  function applyRelicImmediate(relicId) {
    if (relicId === 'amberVial') app.state.potions += 1;
    if (relicId === 'wardedMail') {
      app.state.party.forEach((p) => {
        if (p.classId === 'fighter' || p.classId === 'cleric') p.baseAc += 1;
      });
    }
    if (relicId === 'keenEdges') {
      app.state.party.forEach((p) => { p.attackBonus += 1; });
    }
  }

  function takeShortRest() {
    if (app.state.shortRestCharges < 1) return;
    app.state.shortRestCharges -= 1;
    app.state.party.forEach((hero) => {
      if (!hero.alive) return;
      hero.hp = Math.min(hero.maxHp, hero.hp + Math.ceil(hero.maxHp * 0.25));
      hero.resource.current = Math.min(hero.resource.max, hero.resource.current + C.classes[hero.classId].resource.shortRest);
      hero.conditions = hero.conditions.filter((c) => !['poisoned', 'burning', 'prone', 'frightened'].includes(c.id));
    });
    completeCurrentNode('The party takes a brief rest and regains some strength.');
  }

  function resolveEventChoice(choiceId) {
    const eventDef = C.events[app.state.currentEvent.eventId];
    const choice = eventDef.choices.find((c) => c.id === choiceId);
    if (!choice) return;
    const message = applyEventEffect(choice.effect);
    app.state.currentEvent = null;
    completeCurrentNode(message);
  }

  function applyEventEffect(effect) {
    switch (effect) {
      case 'healAllMinor': {
        app.state.party.forEach((h) => { if (h.alive) healEntity(h, rollDice('1d6+2').total, `${h.name} is soothed by the shrine.`); });
        return 'A quiet blessing mends the party.';
      }
      case 'restoreClericWizard': {
        app.state.party.forEach((h) => {
          if (['cleric', 'wizard'].includes(h.classId)) h.resource.current = Math.min(h.resource.max, h.resource.current + 2);
        });
        return 'Divine and arcane power stirs again.';
      }
      case 'powerAtCost': {
        app.state.party.forEach((h) => {
          h.attackBonus += 1;
          applyDamage(h, 3, { source: 'Cursed Font', kind: 'necrotic', skipLog: true });
        });
        pushLog('The font grants cruel strength. The party gains +1 to hit for the rest of the run, but each hero loses 3 HP.', 'warn');
        return 'The font exacts its price.';
      }
      case 'trapDamageLight': {
        app.state.party.forEach((h) => { if (h.alive) applyDamage(h, rollDice('1d4+1').total, { source: 'Tripwire Hall', kind: 'piercing' }); });
        return 'The hallway bites back.';
      }
      case 'rogueDisarm': {
        const rogue = app.state.party.find((p) => p.classId === 'rogue' && p.alive);
        if (rogue) {
          const check = rollD20({ mod: rogue.saves.dex + 3 });
          if (check.total >= 14) {
            pushLog(`${rogue.name} cuts the tripwire before it springs.`, 'good');
            return 'Your rogue disarms the trap.';
          }
        }
        app.state.party.forEach((h) => { if (h.alive) applyDamage(h, rollDice('1d4+1').total, { source: 'Tripwire Hall', kind: 'piercing' }); });
        return 'The disarm fails and the trap goes off.';
      }
      case 'relicPick': {
        openTreasureChoices();
        return 'Choose a relic.';
      }
      case 'none':
      default:
        return 'You leave the chamber untouched.';
    }
  }

  function completeCurrentNode(message) {
    const node = getNodeById(app.state.currentNodeId);
    if (node) node.state = 'cleared';
    app.state.stats.roomsCleared += node ? 1 : 0;
    app.state.stats.score += scoreForNode(node);
    pushLog(message || 'The room is behind you now.', 'system');
    app.state.currentNodeId = null;
    app.state.currentEvent = null;
    app.state.rewardChoices = null;
    app.state.stageIndex += 1;
    app.state.ui.message = message || 'Choose the next room.';
    if (app.state.stageIndex >= app.state.dungeonMap.length && app.state.bossDefeated) {
      endRun(true);
    }
    render();
  }

  function scoreForNode(node) {
    if (!node) return 0;
    if (node.type === 'boss') return 250;
    if (node.type === 'combat') return node.tier === 'hard' ? 110 : node.tier === 'mid' ? 90 : 70;
    if (node.type === 'treasure') return 60;
    if (node.type === 'rest') return 30;
    return 50;
  }

  function startCombat(node) {
    const template = C.roomTemplates[node.templateId];
    const map = buildCombatMap(template);
    const encounterIds = [...C.encounters[node.type === 'boss' ? 'boss' : node.tier][node.encounterIndex]];
    const enemies = encounterIds.map((monsterId, idx) => createEnemy(monsterId, idx + 1));
    const heroes = app.state.party.filter((p) => p.alive).map((p) => deepClone(p));
    const heroSlots = [{ x: 1, y: 1 }, { x: 1, y: 4 }, { x: 0, y: 2 }, { x: 0, y: 3 }];
    const enemySlots = node.type === 'boss'
      ? [{ x: 6, y: 2 }, { x: 7, y: 1 }, { x: 7, y: 4 }]
      : [{ x: 6, y: 1 }, { x: 6, y: 4 }, { x: 7, y: 2 }, { x: 7, y: 3 }];

    heroes.forEach((hero, i) => placeEntity(hero, heroSlots[i] || { x: 0, y: i }));
    enemies.forEach((enemy, i) => placeEntity(enemy, enemySlots[i] || { x: 7, y: i }));

    const entities = [...heroes, ...enemies];
    const order = buildInitiative(entities);

    app.state.combat = {
      nodeId: node.id,
      map,
      entities,
      order,
      turnIndex: 0,
      round: 1,
      turnSnapshot: null,
      revealedRandom: false,
      activeHistory: [],
      victoryPending: false
    };
    app.state.ui.selectedId = heroes[0]?.id || null;
    app.state.ui.mode = 'idle';
    app.state.ui.selectedAbility = null;
    app.state.ui.highlights = { move: [], targets: [], aoe: [] };
    app.state.ui.message = `${prettyNode(node)} begins.`;
    pushLog(`${prettyNode(node)} begins. Initiative is rolled.`, 'system');
    startTurn();
  }

  function buildCombatMap(template) {
    const cells = [];
    for (let y = 0; y < template.height; y++) {
      for (let x = 0; x < template.width; x++) {
        const terrainId = C.charToTerrain(template.terrain[y][x]);
        const base = { terrain: terrainId, used: false };
        if (terrainId === 'barrel') base.hp = 1;
        cells.push(base);
      }
    }
    return { width: template.width, height: template.height, cells };
  }

  function createEnemy(monsterId, index) {
    const m = C.monsters[monsterId];
    return {
      id: `${monsterId}-${index}-${randInt(100, 999)}`,
      monsterId,
      side: 'enemy',
      name: m.name,
      role: m.role,
      maxHp: m.maxHp,
      hp: m.maxHp,
      baseAc: m.ac,
      speed: m.speed,
      initMod: m.init,
      attackBonus: m.attackBonus,
      meleeDie: m.damage,
      rangedDie: m.damage,
      range: m.range,
      saves: deepClone(m.saveMods),
      resource: { key: 'monster', name: 'Focus', current: 2, max: 2 },
      abilities: [],
      reactionType: 'opportunity',
      alive: true,
      x: 0,
      y: 0,
      conditions: [],
      concentration: null,
      movementLeft: m.speed,
      usedAction: false,
      usedBonus: false,
      reactionAvailable: true,
      temp: { freeMove: 0, noOpportunity: false, guardStance: false },
      status: { downed: false },
      ai: m.ai,
      tags: m.tags,
      traits: m.traits || []
    };
  }

  function placeEntity(entity, pos) {
    entity.x = pos.x;
    entity.y = pos.y;
  }

  function buildInitiative(entities) {
    const rolled = entities.map((e) => ({ id: e.id, initRoll: randInt(1, 20) + e.initMod, tie: randInt(1, 20) }));
    rolled.sort((a, b) => (b.initRoll - a.initRoll) || (b.tie - a.tie));
    rolled.forEach((r) => pushLog(`${getNameById(r.id)} rolls initiative ${r.initRoll}.`, 'system'));
    return rolled.map((r) => r.id);
  }

  function getActiveEntity() {
    if (!app.state?.combat) return null;
    return getEntity(app.state.combat.order[app.state.combat.turnIndex]);
  }

  function getEntity(id) {
    if (!app.state) return null;
    if (app.state.combat) {
      return app.state.combat.entities.find((e) => e.id === id) || null;
    }
    return app.state.party.find((p) => p.id === id) || null;
  }

  function entityAt(x, y) {
    if (!app.state?.combat) return null;
    return app.state.combat.entities.find((e) => e.alive && e.x === x && e.y === y) || null;
  }

  function getCell(x, y) {
    const map = app.state.combat.map;
    return map.cells[y * map.width + x];
  }

  function key(x, y) {
    return `${x},${y}`;
  }

  function onBoardClick(event) {
    const tile = event.target.closest('[data-x][data-y]');
    if (!tile || !app.state || !app.state.combat) return;
    const x = Number(tile.dataset.x);
    const y = Number(tile.dataset.y);
    const clickedEntity = entityAt(x, y);
    const active = getActiveEntity();

    if (clickedEntity && clickedEntity.side === 'party') {
      app.state.ui.selectedId = clickedEntity.id;
      if (clickedEntity.id !== active?.id) {
        clearTargeting();
      }
      render();
      return;
    }

    if (!active || active.side !== 'party' || active.id !== app.state.ui.selectedId) return;

    if (app.state.ui.mode === 'move') {
      const allowed = app.state.ui.highlights.move.find((p) => p.x === x && p.y === y);
      if (allowed) {
        performMove(active, x, y);
      }
      return;
    }

    if (app.state.ui.mode === 'target' && app.state.ui.selectedAbility) {
      performTargetedAbility(active, x, y);
      return;
    }

    if (clickedEntity && clickedEntity.side === 'enemy') {
      app.state.ui.message = `${clickedEntity.name} targeted.`;
      render();
    }
  }

  function onActionBarClick(event) {
    const btn = event.target.closest('[data-action]');
    if (!btn || !app.state) return;
    const action = btn.dataset.action;
    if (action === 'save') {
      saveRun();
      flashOverlay('Run saved.');
      return;
    }
    if (action === 'title') {
      showScreen('title');
      renderTitle();
      return;
    }
    if (!app.state.combat) return;
    const actor = getActiveEntity();
    if (!actor || actor.side !== 'party') return;

    if (action === 'mode-move') {
      app.state.ui.mode = 'move';
      app.state.ui.selectedAbility = null;
      app.state.ui.highlights.move = getReachableTiles(actor);
      app.state.ui.highlights.targets = [];
      app.state.ui.highlights.aoe = [];
      app.state.ui.message = 'Tap a highlighted tile to move.';
      return render();
    }
    if (action === 'undo-turn') return undoTurn();
    if (action === 'end-turn') return endTurn();
    if (action.startsWith('ability:')) {
      const abilityId = action.split(':')[1];
      if (abilityId === 'potion') return activatePotion(actor);
      return chooseAbility(actor, abilityId);
    }
  }

  function chooseAbility(actor, abilityId) {
    const ability = C.abilities[abilityId];
    if (!ability || !canUseAbility(actor, ability)) return;
    app.state.ui.selectedAbility = abilityId;
    app.state.ui.mode = 'target';
    app.state.ui.highlights.move = [];
    app.state.ui.highlights.aoe = [];

    if (['secondWind', 'guardStance', 'quickstep', 'smokeBomb', 'sanctify', 'turnTheProfane'].includes(abilityId)) {
      executeAbility(actor, abilityId, { x: actor.x, y: actor.y });
      return;
    }

    if (abilityId === 'sweepingBlow') {
      executeAbility(actor, abilityId, { x: actor.x, y: actor.y });
      return;
    }

    app.state.ui.highlights.targets = getAbilityTargets(actor, ability);
    app.state.ui.message = ability.mode === 'teleport' ? 'Tap a destination tile.' : 'Tap a valid target.';
    render();
  }

  function canUseAbility(actor, ability) {
    if (!actor.alive) return false;
    if (hasCondition(actor, 'stunned')) return false;
    if (ability.action === 'action' && actor.usedAction) return false;
    if (ability.action === 'bonus' && actor.usedBonus) return false;
    if (ability.cost) {
      const entries = Object.entries(ability.cost);
      for (const [keyName, amount] of entries) {
        if (keyName === actor.resource.key) {
          if (actor.resource.current < amount) return false;
        } else if (keyName === 'arcana' || keyName === 'faith' || keyName === 'grit' || keyName === 'cunning') {
          if (actor.resource.key === keyName && actor.resource.current < amount) return false;
        }
      }
    }
    return true;
  }

  function getAbilityTargets(actor, ability) {
    const targets = [];
    const map = app.state.combat.map;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const dist = manhattan(actor, { x, y });
        const occupant = entityAt(x, y);
        if (ability.mode === 'teleport') {
          if (dist <= ability.range && isPassable(x, y, actor, true)) targets.push({ x, y });
          continue;
        }
        if (ability.type === 'ally') {
          if (occupant && occupant.side === actor.side && dist <= ability.range && hasLineOfSight(actor.x, actor.y, x, y)) targets.push({ x, y });
          continue;
        }
        if (ability.mode === 'aoe') {
          if (dist <= ability.range && hasLineOfSight(actor.x, actor.y, x, y)) targets.push({ x, y });
          continue;
        }
        if (!occupant) continue;
        if (occupant.side === actor.side && ability.type !== 'ally') continue;
        if (dist <= ability.range && (ability.range <= 1 || hasLineOfSight(actor.x, actor.y, x, y))) targets.push({ x, y });
      }
    }
    return targets;
  }

  function performTargetedAbility(actor, x, y) {
    const ability = C.abilities[app.state.ui.selectedAbility];
    const valid = app.state.ui.highlights.targets.find((p) => p.x === x && p.y === y);
    if (!ability || !valid) return;
    executeAbility(actor, ability.id, { x, y });
  }

  function executeAbility(actor, abilityId, targetPos) {
    const ability = abilityId === 'potion' ? null : C.abilities[abilityId];
    if (abilityId !== 'potion' && (!ability || !canUseAbility(actor, ability))) return;

    if (ability) spendAbilityCost(actor, ability);
    clearTargeting();

    switch (abilityId) {
      case 'slash':
      case 'stab':
      case 'mace':
      case 'staff':
      case 'throwKnife':
      case 'radiantBolt':
      case 'fireBolt':
      case 'shieldBash':
      case 'backstab':
        attackWithAbility(actor, targetPos, abilityId);
        break;
      case 'sweepingBlow':
        sweepingBlow(actor);
        break;
      case 'secondWind':
        app.state.combat.revealedRandom = true;
        healEntity(actor, rollDice('1d10+4').total, `${actor.name} finds a second wind.`);
        actor.usedBonus = true;
        break;
      case 'guardStance':
        actor.temp.guardStance = true;
        actor.usedBonus = true;
        pushLog(`${actor.name} braces behind a guarded stance.`, 'good');
        break;
      case 'quickstep':
        actor.temp.freeMove += 3;
        actor.temp.noOpportunity = true;
        actor.usedBonus = true;
        pushLog(`${actor.name} slips into a quickstep, ignoring opportunity attacks this turn.`, 'good');
        break;
      case 'smokeBomb':
        addCondition(actor, { id: 'invisible', duration: 1, ends: 'afterAttack' });
        actor.usedBonus = true;
        pushLog(`${actor.name} vanishes into a bloom of smoke.`, 'good');
        break;
      case 'healingWord': {
        const ally = entityAt(targetPos.x, targetPos.y);
        app.state.combat.revealedRandom = true;
        healEntity(ally, rollDice('1d6+4').total + (hasRelic('saintsThread') ? 2 : 0), `${actor.name} calls healing light over ${ally.name}.`);
        actor.usedBonus = true;
        break;
      }
      case 'sanctify': {
        startConcentration(actor, 'sanctify', []);
        actor.usedAction = true;
        pushLog(`${actor.name} sanctifies the battle. Nearby allies gain a blessing while concentration holds.`, 'good');
        break;
      }
      case 'turnTheProfane':
        actor.usedAction = true;
        applyTurnTheProfane(actor);
        break;
      case 'frostBind':
        actor.usedAction = true;
        resolveFrostBind(actor, targetPos);
        break;
      case 'arcBurst':
        actor.usedAction = true;
        resolveArcBurst(actor, targetPos);
        break;
      case 'mistyStep':
        actor.usedBonus = true;
        moveEntityInstant(actor, targetPos.x, targetPos.y);
        pushLog(`${actor.name} blinks through the veil.`, 'good');
        break;
      default:
        break;
    }

    removeAfterAttackInvisibility(actor, abilityId);
    syncCombatParty();
    checkCombatEnd();
    if (app.state.combat) render();
  }

  function spendAbilityCost(actor, ability) {
    if (!ability.cost) return;
    for (const [keyName, amount] of Object.entries(ability.cost)) {
      if (keyName === actor.resource.key) actor.resource.current -= amount;
    }
    if (ability.action === 'action') actor.usedAction = true;
    if (ability.action === 'bonus') actor.usedBonus = true;
  }

  function activatePotion(actor) {
    if (actor.usedBonus || app.state.potions < 1) return;
    app.state.potions -= 1;
    app.state.combat.revealedRandom = true;
    healEntity(actor, rollDice('1d8+2').total, `${actor.name} drinks a potion.`);
    actor.usedBonus = true;
    syncCombatParty();
    render();
  }

  function attackWithAbility(actor, targetPos, abilityId) {
    const target = entityAt(targetPos.x, targetPos.y);
    if (!target) return;
    const ranged = ['throwKnife', 'radiantBolt', 'fireBolt'].includes(abilityId);
    const mode = ranged ? 'ranged' : 'melee';
    resolveAttack(actor, target, { abilityId, mode });
    if (abilityId === 'shieldBash' && target.alive) {
      const save = rollSave(target, 'dex', 14, actor);
      if (!save.success) addCondition(target, { id: 'prone', duration: 1, ends: 'turnEnd', sourceId: actor.id });
    }
    if (abilityId === 'fireBolt' && target.alive) {
      addCondition(target, { id: 'burning', duration: 2, ends: 'turnEnd', sourceId: actor.id });
    }
  }

  function sweepingBlow(actor) {
    const foes = getAdjacentEnemies(actor).slice(0, 2);
    if (!foes.length) {
      pushLog(`${actor.name} swings wide, but no foe is close enough.`, 'warn');
      return;
    }
    foes.forEach((foe) => resolveAttack(actor, foe, { abilityId: 'sweepingBlow', mode: 'melee', damageExpr: '1d6+3' }));
  }

  function resolveFrostBind(actor, targetPos) {
    const target = entityAt(targetPos.x, targetPos.y);
    if (!target) return;
    const save = rollSave(target, 'dex', 14, actor, { disadvantage: hasCondition(target, 'restrained') || hasCondition(target, 'stunned') });
    if (!save.success) {
      startConcentration(actor, 'frostBind', [target.id]);
      addCondition(target, { id: 'restrained', duration: 99, ends: 'concentration', sourceId: actor.id });
      pushLog(`${target.name} is frozen in place by Frost Bind.`, 'good');
    } else {
      pushLog(`${target.name} slips free of the freezing snare.`, 'warn');
    }
  }

  function resolveArcBurst(actor, targetPos) {
    app.state.combat.revealedRandom = true;
    const victims = getEntitiesInRadius(targetPos.x, targetPos.y, 1).filter((e) => e.side !== actor.side);
    if (!victims.length) {
      pushLog(`${actor.name}'s Arc Burst thunders into empty air.`, 'warn');
      return;
    }
    victims.forEach((victim) => {
      const save = rollSave(victim, 'dex', 14, actor);
      const roll = rollDice('2d6+2');
      let damage = save.success ? Math.floor(roll.total / 2) : roll.total;
      applyDamage(victim, damage, { source: actor.name, kind: 'force' });
    });
    damageBarrelsInRadius(targetPos.x, targetPos.y, 1, actor);
  }

  function applyTurnTheProfane(actor) {
    const foes = getEntitiesInRadius(actor.x, actor.y, 3).filter((e) => e.side !== actor.side && (e.tags.includes('undead') || e.tags.includes('profane')));
    if (!foes.length) {
      pushLog(`${actor.name} raises a warding sign, but nothing profane is close enough.`, 'warn');
      return;
    }
    foes.forEach((foe) => {
      const save = rollSave(foe, 'wis', 14, actor);
      if (!save.success) addCondition(foe, { id: 'frightened', duration: 2, ends: 'turnEnd', sourceId: actor.id });
    });
  }

  function resolveAttack(attacker, target, opts = {}) {
    const abilityId = opts.abilityId || 'attack';
    const mode = opts.mode || 'melee';
    const damageExpr = opts.damageExpr || (mode === 'ranged' ? attacker.rangedDie : attacker.meleeDie);
    app.state.combat.revealedRandom = true;

    let advantage = false;
    let disadvantage = false;
    if (hasCondition(attacker, 'invisible')) advantage = true;
    if (hasCondition(attacker, 'poisoned') || hasCondition(attacker, 'restrained')) disadvantage = true;
    if (hasCondition(target, 'invisible')) disadvantage = true;
    if (hasCondition(target, 'restrained') || hasCondition(target, 'stunned')) advantage = true;
    if (hasCondition(target, 'prone')) {
      if (mode === 'melee' && manhattan(attacker, target) <= 1) advantage = true;
      if (mode === 'ranged') disadvantage = true;
    }
    if (hasCondition(attacker, 'frightened') && app.state.combat && canSeeEntity(attacker, getSourceEntityForFear(attacker))) disadvantage = true;

    const attackRoll = rollAttack(attacker, target, { advantage, disadvantage, mode });
    const abilityLabel = C.abilities[abilityId]?.name || 'Attack';

    if (attemptWardingShield(target, attackRoll, mode)) {
      pushLog(`${target.name} throws up a Warding Shield and the strike turns aside.`, 'good');
      return;
    }

    if (attackRoll.total >= attackRoll.targetAC) {
      const damageRoll = rollDamage(damageExpr, abilityId);
      let damage = damageRoll.total;
      if (attackRoll.critical) damage += rollDamage(damageExpr, abilityId).total - parseDice(damageExpr).mod;
      if (abilityId === 'backstab' && (hasCondition(attacker, 'invisible') || isThreatenedByAlly(target, attacker.side))) {
        damage += rollDice('2d6').total;
      }
      const parried = attemptParry(target, damage, attackRoll, mode);
      damage = Math.max(0, damage - parried);
      applyDamage(target, damage, { source: `${attacker.name} — ${abilityLabel}`, kind: mode === 'ranged' ? 'piercing' : 'weapon' });
      if (mode === 'ranged') damageBarrelAt(target.x, target.y, attacker);
    } else {
      pushLog(`${attacker.name} uses ${abilityLabel}: ${attackRoll.text} misses ${target.name} (AC ${attackRoll.targetAC}).`, 'warn');
    }
  }

  function rollAttack(attacker, target, opts) {
    const cover = opts.mode === 'ranged' ? getCoverBonus(attacker, target) : 0;
    const ac = getArmorClass(target) + cover;
    const roll = rollD20({ mod: getAttackBonus(attacker), advantage: opts.advantage, disadvantage: opts.disadvantage, bless: hasBless(attacker) });
    const text = `${attacker.name} attacks ${target.name}: ${roll.text} vs AC ${ac}${cover ? ` (+${cover} cover)` : ''}`;
    pushLog(text, roll.total >= ac ? 'good' : '');
    return { ...roll, targetAC: ac };
  }

  function rollD20({ mod = 0, advantage = false, disadvantage = false, bless = false }) {
    const first = randInt(1, 20);
    let second = null;
    let picked = first;
    if (advantage || disadvantage) {
      second = randInt(1, 20);
      picked = advantage && !disadvantage ? Math.max(first, second) : disadvantage && !advantage ? Math.min(first, second) : first;
    }
    let total = picked + mod;
    let blessBonus = 0;
    if (bless) {
      blessBonus = rollDice('1d4').total;
      total += blessBonus;
    }
    const parts = second ? `${first}/${second}` : `${first}`;
    const text = `d20 ${parts}${advantage && !disadvantage ? ' adv' : ''}${disadvantage && !advantage ? ' dis' : ''} + ${mod}${blessBonus ? ` + ${blessBonus}` : ''} = ${total}`;
    return { total, natural: picked, critical: picked === 20, text };
  }

  function rollSave(target, saveKey, dc, source, flags = {}) {
    const mod = (target.saves?.[saveKey] || 0);
    const bless = hasBless(target);
    const disadvantage = !!flags.disadvantage;
    const result = rollD20({ mod, bless, disadvantage });
    const success = result.total >= dc;
    pushLog(`${target.name} makes a ${saveKey.toUpperCase()} save: ${result.text} vs DC ${dc}${success ? ' — success' : ' — fail'}.`, success ? 'good' : 'warn');
    return { success, result, dc, sourceId: source?.id || null };
  }

  function rollDamage(expr, abilityId) {
    const base = rollDice(expr);
    if (hasRelic('emberShard') && ['fireBolt'].includes(abilityId)) {
      base.total += parseDice(expr).count;
    }
    return base;
  }

  function attemptWardingShield(target, attackRoll, mode) {
    if (mode !== 'ranged' && mode !== 'melee') return false;
    if (target.side !== 'party' || target.classId !== 'wizard' || !target.reactionAvailable || target.resource.current < 1) return false;
    const baseAc = getArmorClass(target);
    if (attackRoll.total < baseAc || attackRoll.total > baseAc + 4) return false;
    target.reactionAvailable = false;
    target.resource.current -= 1;
    return true;
  }

  function attemptParry(target, damage, attackRoll, mode) {
    if (mode !== 'melee' && mode !== 'ranged') return 0;
    if (target.side !== 'party' || target.classId !== 'fighter' || !target.reactionAvailable) return 0;
    if (damage < 4 && target.hp > Math.floor(target.maxHp / 3)) return 0;
    const reduction = rollDice('1d6+2').total;
    target.reactionAvailable = false;
    pushLog(`${target.name} parries and reduces the damage by ${reduction}.`, 'good');
    return reduction;
  }

  function applyDamage(target, amount, opts = {}) {
    if (!target.alive || amount <= 0) return;
    const actual = Math.max(0, amount);
    target.hp -= actual;
    app.state.stats.damageTaken += target.side === 'party' ? actual : 0;
    app.state.stats.damageDealt += target.side === 'enemy' ? actual : 0;
    if (!opts.skipLog) pushLog(`${target.name} takes ${actual} ${opts.kind || ''} damage${opts.source ? ` from ${opts.source}` : ''}.`, target.side === 'enemy' ? 'good' : 'warn');
    if (target.concentration) maybeBreakConcentration(target, actual);
    if (hasCondition(target, 'invisible')) removeCondition(target, 'invisible', false);
    if (target.hp <= 0) killEntity(target, opts.source);
  }

  function healEntity(target, amount, message) {
    if (!target || !target.alive) return;
    const prev = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    const healed = target.hp - prev;
    app.state.stats.healingDone += healed;
    if (message) pushLog(`${message} (${healed} HP).`, 'good');
  }

  function killEntity(target, source) {
    target.hp = 0;
    target.alive = false;
    target.reactionAvailable = false;
    endConcentration(target, `${target.name} falls and loses concentration.`);
    pushLog(`${target.name} falls${source ? ` to ${source}` : ''}.`, target.side === 'enemy' ? 'good' : 'warn');
    if (target.side === 'enemy') app.state.stats.enemiesSlain += 1;
    if (target.side === 'party') app.state.stats.downedHeroes += 1;
  }

  function maybeBreakConcentration(target, damage) {
    if (!target.concentration) return;
    const dc = Math.max(10, Math.floor(damage / 2));
    const save = rollSave(target, 'con', dc, null);
    if (!save.success) {
      endConcentration(target, `${target.name} loses concentration.`);
    }
  }

  function startConcentration(actor, abilityId, targetIds) {
    if (actor.concentration) endConcentration(actor, `${actor.name} shifts concentration.`);
    actor.concentration = { abilityId, targetIds };
  }

  function endConcentration(actor, message) {
    if (!actor || !actor.concentration) return;
    const data = actor.concentration;
    if (data.abilityId === 'frostBind') {
      data.targetIds.forEach((id) => {
        const entity = getEntity(id);
        if (entity) removeCondition(entity, 'restrained', false);
      });
    }
    actor.concentration = null;
    if (message) pushLog(message, 'warn');
  }

  function removeAfterAttackInvisibility(actor, abilityId) {
    if (!actor || !hasCondition(actor, 'invisible')) return;
    const offensive = ['slash', 'stab', 'mace', 'staff', 'throwKnife', 'radiantBolt', 'fireBolt', 'shieldBash', 'backstab', 'sweepingBlow', 'turnTheProfane', 'frostBind', 'arcBurst'].includes(abilityId);
    if (offensive) removeCondition(actor, 'invisible');
  }

  function performMove(actor, x, y) {
    const path = findPath(actor, { x, y });
    if (!path || !path.length) return;
    moveAlongPath(actor, path);
    clearTargeting();
    app.state.ui.message = `${actor.name} moves.`;
    syncCombatParty();
    render();
  }

  function moveAlongPath(actor, path) {
    for (const step of path) {
      const from = { x: actor.x, y: actor.y };
      const leavingEnemies = getAdjacentEnemiesAt(from.x, from.y, actor.side).filter((enemy) => manhattan(enemy, step) > 1);
      actor.x = step.x;
      actor.y = step.y;
      const cost = Math.max(1, getMoveCost(step.x, step.y));
      if (actor.temp.freeMove > 0) {
        actor.temp.freeMove -= 1;
      } else {
        actor.movementLeft = Math.max(0, actor.movementLeft - cost);
      }
      triggerOnEnterCell(actor, step.x, step.y);
      if (!actor.alive) return;
      if (!actor.temp.noOpportunity) {
        leavingEnemies.forEach((enemy) => triggerOpportunityAttack(enemy, actor));
      }
      if (!actor.alive) return;
    }
  }

  function moveEntityInstant(actor, x, y) {
    actor.x = x;
    actor.y = y;
    triggerOnEnterCell(actor, x, y);
    syncCombatParty();
  }

  function triggerOnEnterCell(actor, x, y) {
    const cell = getCell(x, y);
    if (cell.terrain === 'spikes') {
      app.state.combat.revealedRandom = true;
      applyDamage(actor, rollDice('1d4+1').total, { source: 'spikes', kind: 'piercing' });
    }
    if (cell.terrain === 'shrine' && !cell.used) {
      cell.used = true;
      app.state.combat.revealedRandom = true;
      healEntity(actor, rollDice('1d6+2').total, `${actor.name} draws light from the shrine.`);
    }
  }

  function triggerEndOfTurnCell(actor) {
    const cell = getCell(actor.x, actor.y);
    if (cell.terrain === 'necro') {
      app.state.combat.revealedRandom = true;
      applyDamage(actor, rollDice('1d4').total, { source: 'necrotic sigil', kind: 'necrotic' });
    }
  }

  function triggerOpportunityAttack(attacker, mover) {
    if (!attacker.alive || !attacker.reactionAvailable || hasCondition(attacker, 'stunned')) return;
    if (manhattan(attacker, mover) !== 1) return;
    attacker.reactionAvailable = false;
    pushLog(`${attacker.name} lashes out with an opportunity attack.`, attacker.side === 'party' ? 'good' : 'warn');
    resolveAttack(attacker, mover, { abilityId: 'opportunity', mode: 'melee', damageExpr: attacker.meleeDie });
  }

  function getAdjacentEnemies(actor) {
    return getAdjacentEnemiesAt(actor.x, actor.y, actor.side);
  }

  function getAdjacentEnemiesAt(x, y, ownSide) {
    return app.state.combat.entities.filter((e) => e.alive && e.side !== ownSide && manhattan(e, { x, y }) === 1);
  }

  function canUndo() {
    const active = getActiveEntity();
    return !!(app.state?.combat?.turnSnapshot && active && active.side === 'party' && !app.state.combat.revealedRandom);
  }

  function undoTurn() {
    if (!canUndo()) return;
    const snap = app.state.combat.turnSnapshot;
    app.state = deepClone(snap);
    app.state.ui.message = 'Turn rewound.';
    pushLog('The current turn rewinds before fate locks in.', 'system');
    render();
  }

  function clearTargeting() {
    app.state.ui.mode = 'idle';
    app.state.ui.selectedAbility = null;
    app.state.ui.highlights = { move: [], targets: [], aoe: [] };
  }

  function endTurn() {
    const actor = getActiveEntity();
    if (!actor) return;
    triggerEndOfTurnCell(actor);
    tickConditions(actor, 'turnEnd');
    actor.temp.freeMove = 0;
    actor.temp.noOpportunity = false;
    clearTargeting();
    syncCombatParty();
    advanceTurnIndex();
    checkCombatEnd();
    if (app.state.combat) startTurn();
  }

  function advanceTurnIndex() {
    const combat = app.state.combat;
    if (!combat) return;
    let next = combat.turnIndex + 1;
    const livingOrder = combat.order.filter((id) => getEntity(id)?.alive);
    combat.order = livingOrder;
    if (!livingOrder.length) return;
    if (next >= combat.order.length) {
      combat.round += 1;
      next = 0;
      pushLog(`Round ${combat.round} begins.`, 'system');
    }
    combat.turnIndex = next;
    app.state.stats.turnsTaken += 1;
  }

  function startTurn() {
    const actor = getActiveEntity();
    if (!actor) return;
    if (!actor.alive) {
      advanceTurnIndex();
      return startTurn();
    }
    actor.movementLeft = actor.speed;
    actor.usedAction = false;
    actor.usedBonus = false;
    actor.reactionAvailable = true;
    actor.temp.freeMove = 0;
    actor.temp.noOpportunity = false;
    actor.temp.guardStance = false;
    app.state.combat.revealedRandom = false;
    tickConditions(actor, 'turnStart');
    if (!actor.alive) {
      checkCombatEnd();
      if (app.state.combat) {
        advanceTurnIndex();
        return startTurn();
      }
      return;
    }
    app.state.combat.turnSnapshot = makeSerializableState(app.state);
    app.state.ui.selectedId = actor.side === 'party' ? actor.id : app.state.ui.selectedId;
    app.state.ui.message = `${actor.name}'s turn.`;
    if (hasCondition(actor, 'burning')) {
      app.state.combat.revealedRandom = true;
      applyDamage(actor, rollDice('1d4').total, { source: 'burning', kind: 'fire' });
    }
    if (hasCondition(actor, 'stunned')) {
      pushLog(`${actor.name} is stunned and loses the turn.`, 'warn');
      return endTurn();
    }
    if (actor.side === 'enemy') {
      runEnemyTurn(actor);
    } else {
      render();
    }
  }

  function tickConditions(actor, timing) {
    actor.conditions = actor.conditions.filter((cond) => {
      if (cond.ends === 'concentration') return true;
      if (cond.ends === 'afterAttack') return true;
      if (cond.ends !== timing) return true;
      if (cond.duration != null) cond.duration -= 1;
      return cond.duration > 0;
    });
  }

  function addCondition(target, condition) {
    removeCondition(target, condition.id, false);
    target.conditions.push({ ...condition });
    pushLog(`${target.name} is ${labelCondition(condition.id).toLowerCase()}.`, target.side === 'enemy' ? 'good' : 'warn');
  }

  function removeCondition(target, conditionId, log = true) {
    const before = target.conditions.length;
    target.conditions = target.conditions.filter((c) => c.id !== conditionId);
    if (log && before !== target.conditions.length) {
      pushLog(`${target.name} is no longer ${labelCondition(conditionId).toLowerCase()}.`, 'system');
    }
  }

  function hasCondition(entity, id) {
    return !!entity.conditions.find((c) => c.id === id);
  }

  function getSourceEntityForFear(entity) {
    const fear = entity.conditions.find((c) => c.id === 'frightened');
    return fear?.sourceId ? getEntity(fear.sourceId) : null;
  }

  function hasBless(entity) {
    const cleric = app.state.combat?.entities.find((e) => e.alive && e.side === entity.side && e.classId === 'cleric' && e.concentration?.abilityId === 'sanctify');
    return !!(cleric && manhattan(cleric, entity) <= 2);
  }

  function getArmorClass(entity) {
    return entity.baseAc + (entity.temp.guardStance ? 2 : 0);
  }

  function getAttackBonus(entity) {
    return entity.attackBonus;
  }

  function getMoveCost(x, y) {
    const cell = getCell(x, y);
    if (!cell) return 99;
    if (cell.terrain === 'barrel') return 99;
    return C.terrain[cell.terrain].moveCost || 1;
  }

  function isPassable(x, y, mover, ignoreOccupants = false) {
    const map = app.state.combat.map;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const cell = getCell(x, y);
    if (!cell) return false;
    if (['wall', 'pillar', 'barrel'].includes(cell.terrain)) return false;
    const occ = entityAt(x, y);
    if (occ && occ.alive && !ignoreOccupants && occ.id !== mover?.id) return false;
    return true;
  }

  function getReachableTiles(actor) {
    const frontier = [{ x: actor.x, y: actor.y, cost: 0 }];
    const best = new Map([[key(actor.x, actor.y), 0]]);
    const results = [];
    while (frontier.length) {
      frontier.sort((a, b) => a.cost - b.cost);
      const current = frontier.shift();
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      dirs.forEach(([dx, dy]) => {
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (!isPassable(nx, ny, actor)) return;
        const stepCost = getMoveCost(nx, ny);
        const moveBudget = actor.movementLeft + actor.temp.freeMove;
        const newCost = current.cost + stepCost;
        const k = key(nx, ny);
        if (newCost > moveBudget) return;
        if (!best.has(k) || newCost < best.get(k)) {
          best.set(k, newCost);
          frontier.push({ x: nx, y: ny, cost: newCost });
          results.push({ x: nx, y: ny });
        }
      });
    }
    return results;
  }

  function findPath(actor, goal) {
    const frontier = [{ x: actor.x, y: actor.y, cost: 0 }];
    const came = new Map();
    const costSoFar = new Map([[key(actor.x, actor.y), 0]]);
    while (frontier.length) {
      frontier.sort((a, b) => a.cost - b.cost);
      const current = frontier.shift();
      if (current.x === goal.x && current.y === goal.y) break;
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (!isPassable(nx, ny, actor, nx === goal.x && ny === goal.y)) return;
        const newCost = costSoFar.get(key(current.x, current.y)) + getMoveCost(nx, ny);
        const nk = key(nx, ny);
        if (!costSoFar.has(nk) || newCost < costSoFar.get(nk)) {
          costSoFar.set(nk, newCost);
          frontier.push({ x: nx, y: ny, cost: newCost });
          came.set(nk, { x: current.x, y: current.y });
        }
      });
    }
    const path = [];
    let cursor = goal;
    const goalKey = key(goal.x, goal.y);
    if (!came.has(goalKey)) return null;
    while (cursor.x !== actor.x || cursor.y !== actor.y) {
      path.unshift({ x: cursor.x, y: cursor.y });
      cursor = came.get(key(cursor.x, cursor.y));
    }
    return path;
  }

  function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function terrainGlyph(id) {
    return {
      floor: '', wall: '█', pillar: '◼', spikes: '✦', mire: '≈', barrel: '◍', necro: '☠', shrine: '✚'
    }[id] || '';
  }

  function tokenGlyph(entity) {
    if (entity.side === 'enemy') {
      return entity.monsterId === 'sigilTyrant' ? '♛' : '✧';
    }
    return {
      fighter: 'F', rogue: 'R', cleric: 'C', wizard: 'W'
    }[entity.classId] || '?';
  }

  function labelCondition(id) {
    return {
      prone: 'Prone', stunned: 'Stunned', poisoned: 'Poisoned', restrained: 'Restrained', invisible: 'Invisible', frightened: 'Frightened', burning: 'Burning'
    }[id] || titleCase(id);
  }

  function titleCase(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  function getNodeById(nodeId) {
    for (const col of app.state.dungeonMap) {
      const node = col.find((n) => n.id === nodeId);
      if (node) return node;
    }
    return null;
  }

  function prettyNode(node) {
    if (!node) return 'Unknown room';
    if (node.type === 'combat') return `${titleCase(node.tier)} Combat`;
    if (node.type === 'event') return 'Event Room';
    if (node.type === 'rest') return 'Short Rest';
    if (node.type === 'treasure') return 'Treasure Room';
    if (node.type === 'boss') return 'Final Boss';
    return titleCase(node.type);
  }

  function describeNode(node) {
    if (!node) return '';
    if (node.type === 'combat') return `${node.tier} encounter in ${C.roomTemplates[node.templateId].name}.`;
    if (node.type === 'event') return C.events[node.eventId].title;
    if (node.type === 'treasure') return 'Claim one relic upgrade.';
    if (node.type === 'rest') return 'Recover HP and short-rest resources.';
    if (node.type === 'boss') return 'The Sigil Tyrant with support and lethal terrain.';
    return '';
  }

  function describeEventEffect(effect) {
    return {
      healAllMinor: 'Heal the whole party a little.',
      restoreClericWizard: 'Restore faith and arcana instead of HP.',
      powerAtCost: 'Permanent accuracy boost, but everyone bleeds for it.',
      none: 'Walk away unchanged.',
      trapDamageLight: 'Push through and take some damage.',
      rogueDisarm: 'Try a dextrous disarm; fail and you still get hit.',
      relicPick: 'Pick from three relics.'
    }[effect] || '';
  }

  function hasLivingParty() {
    return app.state.party.some((p) => p.alive);
  }

  function endRun(victory) {
    app.state.runEnded = true;
    app.state.bossDefeated = !!victory;
    clearSave();
    if (victory) app.state.stats.score += 200 + app.state.party.filter((p) => p.alive).length * 40 + app.state.shortRestCharges * 20;
    render();
  }

  function syncCombatParty() {
    if (!app.state.combat) return;
    app.state.party = app.state.party.map((partyMember) => {
      const combatEntity = app.state.combat.entities.find((e) => e.id === partyMember.id);
      if (!combatEntity) return partyMember;
      return deepClone({
        ...combatEntity,
        x: 0,
        y: 0,
        movementLeft: partyMember.speed,
        usedAction: false,
        usedBonus: false,
        reactionAvailable: combatEntity.reactionAvailable,
        temp: { freeMove: 0, noOpportunity: false, guardStance: false }
      });
    });
  }

  function checkCombatEnd() {
    if (!app.state.combat) return;
    const enemiesAlive = app.state.combat.entities.some((e) => e.side === 'enemy' && e.alive);
    const heroesAlive = app.state.combat.entities.some((e) => e.side === 'party' && e.alive);
    if (!heroesAlive) {
      syncCombatParty();
      app.state.combat = null;
      endRun(false);
      return;
    }
    if (!enemiesAlive) {
      const node = getNodeById(app.state.combat.nodeId);
      const boss = node?.type === 'boss';
      pushLog(boss ? 'The Sigil Tyrant falls. The chamber goes still.' : 'The encounter is won.', 'good');
      syncCombatParty();
      app.state.combat = null;
      if (boss) {
        app.state.bossDefeated = true;
        completeCurrentNode('The Tyrant falls and the sigil gate breaks.');
        endRun(true);
      } else {
        completeCurrentNode('The room is cleared.');
      }
    }
  }

  function hasLineOfSight(x0, y0, x1, y1) {
    const points = bresenham(x0, y0, x1, y1);
    for (let i = 1; i < points.length - 1; i++) {
      const cell = getCell(points[i].x, points[i].y);
      if (cell && C.terrain[cell.terrain].blocksLoS) return false;
    }
    return true;
  }

  function bresenham(x0, y0, x1, y1) {
    const points = [];
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    while (true) {
      points.push({ x, y });
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    return points;
  }

  function getCoverBonus(attacker, target) {
    if (!hasLineOfSight(attacker.x, attacker.y, target.x, target.y)) return 999;
    const adj = [
      { x: target.x + 1, y: target.y },
      { x: target.x - 1, y: target.y },
      { x: target.x, y: target.y + 1 },
      { x: target.x, y: target.y - 1 }
    ];
    const hasCover = adj.some((p) => {
      const cell = getCell(p.x, p.y);
      return cell && ['wall', 'pillar', 'barrel'].includes(cell.terrain);
    });
    return hasCover && manhattan(attacker, target) > 1 ? 2 : 0;
  }

  function canSeeEntity(viewer, other) {
    if (!viewer || !other || !other.alive) return false;
    return hasLineOfSight(viewer.x, viewer.y, other.x, other.y);
  }

  function isThreatenedByAlly(target, side) {
    return app.state.combat.entities.some((e) => e.alive && e.side === side && e.id !== target.id && manhattan(e, target) === 1);
  }

  function getEntitiesInRadius(x, y, radius) {
    return app.state.combat.entities.filter((e) => e.alive && Math.abs(e.x - x) <= radius && Math.abs(e.y - y) <= radius);
  }

  function damageBarrelAt(x, y, sourceActor) {
    const cell = getCell(x, y);
    if (!cell || cell.terrain !== 'barrel') return;
    explodeBarrel(x, y, sourceActor);
  }

  function damageBarrelsInRadius(x, y, radius, sourceActor) {
    for (let yy = y - radius; yy <= y + radius; yy++) {
      for (let xx = x - radius; xx <= x + radius; xx++) {
        const cell = getCell(xx, yy);
        if (cell && cell.terrain === 'barrel') explodeBarrel(xx, yy, sourceActor);
      }
    }
  }

  function explodeBarrel(x, y, sourceActor) {
    const cell = getCell(x, y);
    if (!cell || cell.terrain !== 'barrel') return;
    cell.terrain = 'floor';
    pushLog(`A volatile barrel detonates at ${x + 1},${y + 1}.`, 'warn');
    const victims = getEntitiesInRadius(x, y, 1);
    victims.forEach((v) => {
      app.state.combat.revealedRandom = true;
      applyDamage(v, rollDice('2d6').total, { source: sourceActor?.name || 'barrel', kind: 'fire' });
      addCondition(v, { id: 'burning', duration: 2, ends: 'turnEnd', sourceId: sourceActor?.id || null });
    });
  }

  function runEnemyTurn(actor) {
    clearTargeting();
    const action = chooseEnemyPlan(actor);
    if (!action) return endTurn();

    if (action.moveTo) {
      const path = findPath(actor, action.moveTo);
      if (path?.length) moveAlongPath(actor, path.slice(0, Math.max(1, actor.movementLeft)));
    }
    if (!actor.alive) return;

    if (action.kind === 'attack' && action.targetId) {
      const target = getEntity(action.targetId);
      if (target?.alive && manhattan(actor, target) <= (actor.range || 1) && ((actor.range || 1) <= 1 || hasLineOfSight(actor.x, actor.y, target.x, target.y))) resolveMonsterAttack(actor, target);
    }
    if (action.kind === 'restrain' && action.targetId) {
      const target = getEntity(action.targetId);
      if (target?.alive && manhattan(actor, target) <= 4 && hasLineOfSight(actor.x, actor.y, target.x, target.y)) monsterRestrainingCast(actor, target);
    }
    if (action.kind === 'burn' && action.targetId) {
      const target = getEntity(action.targetId);
      if (target?.alive && manhattan(actor, target) <= 5 && hasLineOfSight(actor.x, actor.y, target.x, target.y)) monsterBurnCast(actor, target);
    }
    if (action.kind === 'pulse') {
      bossSigilPulse(actor);
    }
    if (action.kind === 'summon') {
      bossSummon(actor);
    }
    if (action.kind === 'slam' && action.targetId) {
      const target = getEntity(action.targetId);
      if (target?.alive && manhattan(actor, target) <= 1) monsterSlam(actor, target);
    }

    endTurn();
  }

  function chooseEnemyPlan(actor) {
    const heroes = app.state.combat.entities.filter((e) => e.alive && e.side === 'party');
    if (!heroes.length) return null;
    const sortedTargets = heroes.slice().sort((a, b) => targetPriority(actor, a) - targetPriority(actor, b));
    const target = sortedTargets[0];

    if (actor.monsterId === 'sigilTyrant') {
      const pulseTargets = heroes.filter((h) => Math.abs(h.x - actor.x) <= 2 && Math.abs(h.y - actor.y) <= 2);
      if (pulseTargets.length >= 2 && actor.resource.current >= 1) return { kind: 'pulse' };
      const summonsAlive = app.state.combat.entities.filter((e) => e.alive && e.side === 'enemy' && e.id !== actor.id).length;
      if (summonsAlive < 3 && actor.resource.current >= 1 && randInt(1, 100) <= 50) return { kind: 'summon' };
    }

    if (actor.ai === 'controller') {
      const inRange = sortedTargets.find((h) => manhattan(actor, h) <= 4 && hasLineOfSight(actor.x, actor.y, h.x, h.y));
      if (inRange && actor.resource.current > 0) return { kind: 'restrain', targetId: inRange.id };
    }
    if (actor.ai === 'caster') {
      const inRange = sortedTargets.find((h) => manhattan(actor, h) <= 5 && hasLineOfSight(actor.x, actor.y, h.x, h.y));
      if (inRange) return { kind: 'burn', targetId: inRange.id };
    }

    const attackRange = actor.range || 1;
    const immediate = sortedTargets.find((h) => manhattan(actor, h) <= attackRange && (attackRange <= 1 || hasLineOfSight(actor.x, actor.y, h.x, h.y)));
    if (immediate) {
      if (actor.ai === 'bruiser') return { kind: 'slam', targetId: immediate.id };
      return { kind: 'attack', targetId: immediate.id };
    }

    const moveTo = findEnemyMove(actor, target, attackRange);
    return { kind: actor.ai === 'bruiser' ? 'slam' : actor.ai === 'controller' ? 'restrain' : actor.ai === 'caster' ? 'burn' : 'attack', targetId: target.id, moveTo };
  }

  function targetPriority(actor, hero) {
    const dist = manhattan(actor, hero);
    const rolePenalty = hero.classId === 'cleric' || hero.classId === 'wizard' ? -3 : 0;
    const hpPenalty = hero.hp;
    return dist + hpPenalty + rolePenalty;
  }

  function findEnemyMove(actor, target, range) {
    const candidates = [];
    for (let y = 0; y < app.state.combat.map.height; y++) {
      for (let x = 0; x < app.state.combat.map.width; x++) {
        if (!isPassable(x, y, actor, x === actor.x && y === actor.y)) continue;
        const dist = Math.abs(x - target.x) + Math.abs(y - target.y);
        if (dist > range) continue;
        if (range > 1 && !hasLineOfSight(x, y, target.x, target.y)) continue;
        candidates.push({ x, y, distToActor: Math.abs(x - actor.x) + Math.abs(y - actor.y), safety: getAdjacentEnemiesAt(x, y, 'enemy').length });
      }
    }
    candidates.sort((a, b) => a.distToActor - b.distToActor || a.safety - b.safety);
    return candidates[0] || null;
  }

  function resolveMonsterAttack(actor, target) {
    resolveAttack(actor, target, { abilityId: actor.monsterId, mode: actor.range > 1 ? 'ranged' : 'melee' });
    if (actor.traits?.includes('trip') && target.alive) {
      const save = rollSave(target, 'dex', 13, actor);
      if (!save.success) addCondition(target, { id: 'prone', duration: 1, ends: 'turnEnd', sourceId: actor.id });
    }
  }

  function monsterRestrainingCast(actor, target) {
    actor.resource.current = Math.max(0, actor.resource.current - 1);
    const save = rollSave(target, 'dex', 13, actor);
    if (!save.success) addCondition(target, { id: 'restrained', duration: 2, ends: 'turnEnd', sourceId: actor.id });
  }

  function monsterBurnCast(actor, target) {
    resolveAttack(actor, target, { abilityId: 'emberMage', mode: 'ranged', damageExpr: '1d10+2' });
    if (target.alive) addCondition(target, { id: 'burning', duration: 2, ends: 'turnEnd', sourceId: actor.id });
  }

  function monsterSlam(actor, target) {
    resolveAttack(actor, target, { abilityId: 'bogBrute', mode: 'melee', damageExpr: '2d6+3' });
    if (target.alive) {
      const save = rollSave(target, 'dex', 14, actor);
      if (!save.success) addCondition(target, { id: 'prone', duration: 1, ends: 'turnEnd', sourceId: actor.id });
    }
  }

  function bossSigilPulse(actor) {
    actor.resource.current = Math.max(0, actor.resource.current - 1);
    pushLog(`${actor.name} unleashes a sigil pulse.`, 'warn');
    const victims = getEntitiesInRadius(actor.x, actor.y, 2).filter((e) => e.side === 'party');
    victims.forEach((victim) => {
      const save = rollSave(victim, 'wis', 15, actor);
      const damage = rollDice('2d6+3').total;
      applyDamage(victim, save.success ? Math.floor(damage / 2) : damage, { source: actor.name, kind: 'psychic' });
      if (!save.success && randInt(1, 100) <= 50) addCondition(victim, { id: 'frightened', duration: 2, ends: 'turnEnd', sourceId: actor.id });
    });
  }

  function bossSummon(actor) {
    actor.resource.current = Math.max(0, actor.resource.current - 1);
    const choices = ['cultist', 'skulk', 'boneArcher'];
    const empty = [
      { x: actor.x - 1, y: actor.y },
      { x: actor.x + 1, y: actor.y },
      { x: actor.x, y: actor.y - 1 },
      { x: actor.x, y: actor.y + 1 }
    ].filter((p) => isPassable(p.x, p.y, actor) && !entityAt(p.x, p.y));
    if (!empty.length) return;
    const summoned = createEnemy(randChoice(choices), randInt(10, 99));
    placeEntity(summoned, empty[0]);
    app.state.combat.entities.push(summoned);
    app.state.combat.order.push(summoned.id);
    pushLog(`${actor.name} tears open a seal and summons ${summoned.name}.`, 'warn');
  }

  function pushLog(text, tone = '') {
    app.state.log.push({ text, tone });
    if (app.state.log.length > 160) app.state.log.shift();
  }

  function getNameById(id) {
    const hero = app.state?.party?.find((p) => p.id === id);
    if (hero) return hero.name;
    const monster = app.state?.combat?.entities?.find((p) => p.id === id);
    return monster?.name || id;
  }

  function hasRelic(id) {
    return app.state.relics.includes(id);
  }

  function flashOverlay(message) {
    const el = document.getElementById('flash-message');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.hidden = true; }, 1800);
  }

  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW failed', err));
    }
  }
})();
