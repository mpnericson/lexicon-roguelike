# Lexicon — Scrabble Roguelike

A browser/Electron Scrabble roguelike. All game logic lives in `src/` JS files loaded via `<script>` tags in `index.html`. No bundler, no framework, no modules.

## Running the game

```bash
npm start          # Electron desktop app
npx serve .        # Browser via localhost (dev:web)
```

Open `index.html` directly in a browser also works.

## File map

| File | Role |
|------|------|
| `index.html` | All CSS + HTML structure. Loads every JS file via `<script>` tags. |
| `src/data.js` | Constants: `B=15` (board size), `LS` (letter scores), `DIST` (tile counts), `ANTES` (progression tiers), `SQ` (sticker definitions), utility fns (`uid`, `_rng`, `shuffle`, `sqd`). |
| `src/game.js` | Global state `S`, `startGame`, `advanceBlind`, `showGO`, `toast`, modals, `openBagModal`, `openBlankChooser`. |
| `src/play.js` | `playWord` (async), `discardTiles`, `shuffleHand`. |
| `src/scoring.js` | `calcAll`, `scoreWordDetailed`, `runScoreAnim`, `updateLiveScore`. |
| `src/render.js` | `renderAll`, `renderBoard`, `renderHand`, `renderSqHand`, `renderHUD`. |
| `src/drag.js` | Pointer-event drag engine: `attachHandTileDrag`, `attachBoardTileDrag`, `attachSqDrag`, `placeTile`, `recallTile`. |
| `src/physics.js` | Spring physics for hand tiles: `HP` object, `hpBounds`, `hpRest`, `hpStep`, `hpDraw`. |
| `src/shop.js` | Shop phase UI, purchasing, sticker application. |
| `src/stickers_final.js` | Sticker effect logic applied during scoring. |
| `src/ui.js` | Dev-mode palette, solver UI, board preview, misc modals. |
| `src/solver.js` | Async chunk solver (`runSolver`, `findBestMoveBackground`). |
| `src/anim.js` | Board↔shop transition animations. |
| `src/dict.js` | `loadDict()`, `validWord()` — loads `dictionary.txt`. |
| `src/init.js` | Event listeners, startup: calls `loadDict()` then `startGame()`, kicks off `hpStep` RAF loop. |

## Global state

All mutable game state lives in `S` (declared in `game.js`):

```js
S = {
  bag, hand, board,   // board: B*B array of sticker IDs (or null)
  bt,                 // bt: B*B array of placed tile objects (or null)
  ai, bi,             // ante index, blind index into ANTES
  score, gold, plays, disc,
  phase,              // 'play' | 'placing' | 'shop'
  placed,             // stickers the player owns
  bounties,           // active bounty objects — persist across blinds
  sqHand, sqStaged,   // sticker placement phase
  devMode, seed, ...
}
```

`activeDrag` — global drag state object (null when idle).
`HP` — hand physics state (in `physics.js`).
`DICT` — loaded dictionary (Set).
`viewingBoard` — bool, hides new tiles during board preview.

## Layout (CSS in index.html)

```
#app (flex row)
  #left-panel (185px, flex column)
    #live-score-row  — Letter × Mult display
    hud-blocks       — Hands, Discards, Gold
    #bounty-row
    #ante-dots
    #lp-blind-section (flex:1) — blind name, vertical progress bar
  #main-area (flex:1, flex column)
    #top-bar         — right-aligned buttons/menu
    #board-area → #board-wrap (CSS grid, B×B)
    #bottom-bar
      #hand-area     — spring-physics tile area (position:relative)
      #shuffle-btn
      #right-panel   — play/discard buttons, solver btn
```

Board cell size formula (in `renderBoard`):
```js
var sz = Math.max(30, Math.min(64, Math.floor(Math.min(window.innerWidth - 225, window.innerHeight - 172) / B)));
```

## Tile sizing constants

Tile dimensions must be consistent across CSS, physics, render, and drag:
- **Visual size**: 68×78px
- **HP.TILE_W**: 68
- **Center offsets**: left offset = `HP.x[vi] - 34`, drag centering = `clientX - 34` / `clientY - 39`
- Drag clone: `width:68px;height:78px`

## Hand physics (HP)

`hpStep` runs every RAF frame. It springs tiles to rest positions within a box centred on `#hand-area`. Key functions:
- `hpBounds()` — recalculates `HP.aL/aR` from the DOM rect.
- `hpRest(n)` — returns array of centre-x positions for n tiles.
- `hpRebuild(vis)` — called at start of `renderHand`, rebuilds tile list.
- `hpDraw()` — updates `left` CSS on existing `.hand-tile` elements without re-rendering.

## Scoring pipeline

`playWord` → `calcAll` (collect all words, bonus squares, variants) → `runScoreAnim` (animated reveal) → `S.score += res.grand`.

Scoring has three phases per tile: PRE flags → tile loop (letter scores + sticker effects) → POST (accumulate) → FINAL (transform). See `scoring.js` comments.

## Async solver

`runSolver()` — populates the solver results panel (dev mode).
`findBestMoveBackground(snap, onDone)` — called on game over. Takes a snapshot `{hand, bt, board}`, temporarily swaps `S.hand/bt/board`, runs the solver in 2000-word chunks via `setTimeout`, restores state, calls `onDone(best|null)`. Only restores if the gameover modal is still visible (prevents corruption if user starts a new game during solve).

## Game-over solver reveal

When `S.plays === 0`:
1. `window._lastPlaySnap` is saved at the start of each `playWord()` call — pre-play state (committed tiles only, full hand available, all `onBoard` flags cleared).
2. `findBestMoveBackground` is called with the snapshot.
3. If a word scoring ≥ `tgt() - S.score` is found, `#gameover-best-play` is populated and shown.
4. `showGO()` always hides `#gameover-best-play` to reset between losses.

## Key conventions

- **No bundler**: everything is vanilla JS in global scope. `<script>` load order matters — `data.js` first, `init.js` last.
- **DOM IDs**: JS accesses elements exclusively via `getElementById` / `querySelector('[data-sq-idx]')`. Never restructure HTML in a way that breaks existing IDs.
- **`S.board` vs `S.bt`**: `S.board[i]` holds the sticker ID (e.g. `'dl'`, `'echo'`). `S.bt[i]` holds the tile object placed on that square. Both are `B*B` arrays.
- **`isNew` flag**: `S.bt[i].isNew = true` means the tile was placed this turn and can be recalled. Committed tiles have `isNew = false`.
- **Bounties persist** across blinds — `advanceBlind` does NOT reset `S.bounties`.
- **No `console.log` spam**: use `toast(msg)` for user-facing feedback.
- **Seeded RNG**: always use `_rng()` not `Math.random()` for anything that should be reproducible. `Math.random()` is only used in dev-mode tile drawing.

## Progression

```
ANTES[ai][bi] = [name, subtitle, target, boss?]
3 antes × 3 blinds each = 9 rounds total.
Boss constraints: boss_long (5+ tiles), boss_pal (palindrome unlock), boss_hv (5+ point tile required).
```

## Sticker types (SQ array)

- `type:'board'` — placed on a board square, affects scoring when a tile lands there.
- `type:'local'` — placed on a square, `apply(tileCount, tile, word, stats)` called per tile.
- Stickers without `type` or with `onPost` — global effects fired after scoring.
- Chess pieces (`chess_*`) — hover to preview attack pattern; click to inspect.
