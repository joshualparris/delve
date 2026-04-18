# Sigil Delve

Sigil Delve is a static-browser tactical dungeon crawler built with plain HTML, CSS, and vanilla JavaScript.
It is designed as a tight vertical slice rather than a sprawling RPG: a short branching run, a 4-hero party, real tactical fights, and a final boss.

The design targets the uploaded project brief, including a mobile-friendly UI, deterministic RNG, local save/load, reactions, concentration, conditions, a combat log, and a small but coherent content layer.

---

## Files

- `index.html` — shell and screen layout
- `style.css` — responsive UI and board styling
- `content.js` — content-as-data definitions for classes, abilities, monsters, terrain, events, relics, and dungeon route blueprints
- `game.js` — state, combat engine, AI, rendering, save/load, undo, and run flow
- `manifest.webmanifest` — install metadata
- `sw.js` — offline cache/service worker
- `LICENSE` — MIT license

---

## Design overview

### Core shape
- 4 fixed heroes: Fighter, Rogue, Cleric, Wizard
- 7 stage route with branching choices
- combat / treasure / event / rest rooms
- deterministic seeded dungeon content
- final boss: the Sigil Tyrant
- run summary with score and grade

### Tactical goals
The game tries to feel recognisably 5e-inspired without pretending to be full rules-complete 5e.

Included:
- initiative
- movement
- action / bonus action / reaction
- attack rolls
- damage rolls
- saving throws
- advantage / disadvantage
- concentration
- opportunity attacks
- cover
- conditions
- short rests
- limited-use class resources

### Party identity
- **Fighter** — durable frontliner with Guard Stance, Shield Bash, Sweeping Blow, Second Wind, and Parry
- **Rogue** — mobile finisher with Backstab, Throw Knife, Quickstep, and Smoke Bomb
- **Cleric** — support/control with Radiant Bolt, Healing Word, Sanctify, and Turn the Profane
- **Wizard** — ranged burst/control with Fire Bolt, Frost Bind, Arc Burst, Misty Step, and Warding Shield

### Tactical environment
Included board elements:
- walls / pillars for line-of-sight and cover
- spikes
- difficult ground (mire)
- explosive barrels
- necrotic sigils
- healing shrines

### Conditions implemented
- prone
- stunned
- poisoned
- restrained
- invisible
- frightened
- burning

### Monster roster
- Cultist
- Skulk
- Bone Archer
- Grave Hound
- Iron Warden
- Ember Mage
- Bog Brute
- Chain Caller
- Sigil Tyrant (boss)

---

## Architecture overview

### Content-as-data
`content.js` stores:
- class definitions
- abilities
- monsters
- terrain definitions
- room templates
- encounters
- events
- relics
- route blueprint

The engine in `game.js` reads that data rather than hardcoding every encounter or unit directly into rendering code.

### State separation
`game.js` keeps a serializable state tree that contains:
- run meta
- dungeon progress
- party data
- relics / potions / rests
- combat state
- log entries
- UI selection state
- RNG state

Rendering functions read state and paint the UI. They do not own the game rules.

### Deterministic RNG
A small linear congruential generator is used.
The state stores `rngState`, and **all** gameplay randomness flows through that value:
- initiative
- attack rolls
- saves
- damage
- event outcomes
- relic selection order

That makes save/load and undo coherent.

---

## Exact rules simplifications made

This is intentionally *5e-style*, not a full 5e simulator.

### Simplified scope
- No multi-classing
- No levelling from 1 to 20
- No character creator
- No inventory weight or equipment swapping
- No narrative dialogue tree system
- No full spell list

### Combat simplifications
- One fixed party of four heroes
- Basic attacks are class-specific actions rather than a full weapon inventory layer
- Cover is simplified to a clean +2 AC from adjacent blocking terrain for ranged attacks
- Reactions auto-trigger where appropriate instead of prompting the player every time
- Concentration only supports the included concentration effects
- Conditions use clean, contained behaviours rather than every edge case from tabletop play
- Short rests restore part of each class resource kit and some HP rather than reproducing every hit-die rule

### AI simplifications
- Monsters use role-driven tactics, not search-heavy optimal planning
- Boss logic is scripted but still dynamic: pulse, summon, melee pressure, and terrain interaction

---

## Save / load approach

Local save uses `localStorage`.

Saved state includes:
- dungeon progress
- current room / stage
- party HP and resources
- relics / potions / rests
- full combat state if a fight is active
- turn order
- active conditions
- concentration links
- reaction availability
- RNG state
- log history

The save serializer strips the temporary undo snapshot to avoid recursive nesting and bloated saves.

---

## Undo approach

Undo is intentionally narrow and explicit.

### What it does
It rewinds the **current hero turn** to the start of that turn.

### What it is for
- repositioning after movement
- cancelling non-random setup before committing to a real roll outcome

### What stops undo
Once random information is revealed, undo locks out for that turn. Examples:
- attack roll
- damage roll
- saving throw
- potion / heal dice
- hazard damage

That matches the design goal of “undo before fate is revealed”.

---

## Mobile / touch approach

This game is built to work on Android browser, not just desktop.

### UX decisions
- tap to select a hero
- tap **Move**, then tap a highlighted tile
- tap an ability, then tap a valid target / tile
- no hover-only info required
- big action buttons
- readable combat log and side panels
- portrait-safe overlays
- board and action bar remain usable on small screens

### Layout strategy
- desktop: 3-column layout
- smaller screens: single-column stack with the board first
- sticky action bar for easier thumb access

---

## GitHub Pages publish instructions

### Simple method
1. Put all files in one folder.
2. Create a GitHub repo.
3. Upload the files to the repo root.
4. In GitHub, open **Settings → Pages**.
5. Under **Build and deployment**, choose:
   - **Source:** Deploy from a branch
   - **Branch:** `main`
   - **Folder:** `/ (root)`
6. Save.
7. Wait for Pages to publish.

Your site URL will usually be:

```text
https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/
```

### Command line example
```bash
git init
git add .
git commit -m "Add Sigil Delve"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git push -u origin main
```

---

## Extension points for Prompt 2 and Prompt 3

### Prompt 2 — content expansion
Safest extension targets:
- add more monster entries in `content.js`
- add more encounter sets
- add more event definitions
- add more relics
- add more room templates
- add more abilities, provided the engine hooks already exist or are added carefully
- extend route blueprint length or variety

### Prompt 3 — engine expansion
Good next engine upgrades:
- explicit status icons and richer tooltips
- better barrel targeting for single-target ranged attacks
- summon queue preview in boss fights
- more sophisticated AI positioning
- difficulty presets
- new heroes or alternate party rosters
- richer rest / campfire choices
- more detailed run history and analytics
- tutorial mode / codex panel
- sound via Web Audio synthesis
- richer save slots instead of one local save

### Important note for future prompts
The cleanest boundary is:
- **content changes** mostly in `content.js`
- **rule / system changes** mostly in `game.js`
- **layout / usability changes** mostly in `style.css` and `index.html`

---

## Running locally

Because this project includes a service worker, use a tiny local web server rather than opening the file directly.

### Python
```bash
python -m http.server 8000
```
Then visit:
```text
http://localhost:8000/
```

### Node (if you use one)
Any simple static server works.

---

## Notes

This is meant to be a sharp, replayable, portable tactical slice.
It is not trying to fake a full CRPG. The focus is interlocking systems, readable combat, and a small complete loop.
