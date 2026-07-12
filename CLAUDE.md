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
| `src/data.js` | Constants: `B=15` (board size), `LS` (letter scores), `DIST` (tile counts), `STAGES`/`CONSTRAINTS` (progression), `setTileState` (tile state machine), utility fns (`uid`, `_rng`, `shuffle`, `sqd`). `SQ` sticker defs live in `src/stickers/`. |
| `src/game.js` | Global state `S`, `startGame`, `roundComplete`/`advanceRound`, `showGO`, `toast`, modals, bag modal + letter expand/collapse, WebAudio SFX, `transformTile`, `openBlankChooser`, `hasTileSticker`/`countTileSticker`. |
| `src/save.js` | localStorage run persistence: `saveGame`, `loadGame`, `resumeGame`, `clearSave`. |
| `src/achievements.js` | Achievement defs, `achvInit`/`achvCheck`/`achvUnlock`, achievements modal. |
| `src/play.js` | `playWord` (async), `discardTiles`, `shuffleHand`. |
| `src/score_engine.js` | `runScoreEngine(input)` — pure scoring orchestrator. No global reads, no DOM. Unit-tested via `npm test` (`tests/run_tests.js`). |
| `src/scoring.js` | Live-state adapters (`scorePlay`, `buildEngineState`, `newTiles`, `extractAt`, `getAllWords`) + score animation (`runScoreAnim`, sticker floats). |
| `src/render.js` | `renderAll`, `renderBoard`, `renderHand`, `renderSqHand`, `renderHUD`. |
| `src/drag.js` | Pointer-event drag engine: `attachHandTileDrag`, `attachBoardTileDrag`, `attachSqDrag`, `placeTile`, `recallTile`. |
| `src/physics.js` | Spring physics for hand tiles: `HP` object, `hpBounds`, `hpRest`, `hpStep`, `hpDraw`. |
| `src/shop.js` | Shop phase UI, purchasing, sticker application. |
| `src/stickers/` | All sticker definitions incl. their scoring hooks (board/squares, board/effects, board/indirect, tile/economy, tile/scoring, tile/utility). |
| `src/ui.js` | Dev-mode palette, solver UI, board preview, misc modals. |
| `src/gaddag.js` | GADDAG word index (flat Int32Array, ~48MB, ~0.7s chunked build at startup). `buildGaddag`, `buildGaddagSync`, `gdChild`, `gdEnd`. |
| `src/solver.js` | GADDAG-based solver (`runSolver`, `_rankRunRankSolve`, `findBestMoveBackground`). |
| `src/anim.js` | Board↔shop transition animations. |
| `src/dict.js` | `loadDict()`, `validWord()` — loads `dictionary.txt`. |
| `src/init.js` | Event listeners, startup: calls `loadDict()` then `startGame()`, kicks off `hpStep` RAF loop. |

## Global state

All mutable game state lives in `S` (declared in `game.js`):

```js
S = {
  bag, hand, board,   // board: B*B array of sticker IDs (or null)
  bt,                 // bt: B*B array of placed tile objects (or null)
  ai, bi,             // stage index, round index into STAGES
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

`playWord` → `scorePlay(nt, dir, preview)` (scoring.js adapter: builds engine input from `S`, commits cooldowns) → `runScoreEngine(input)` (score_engine.js, pure) → `runScoreAnim(res.events, res.total)` → `S.score += res.total`.

The engine only controls the ORDER effects fire in; all effect logic lives in the sticker definitions. Bracket order:

- **PRE** — tile-count bonus (+1 mult per tile beyond 3), then board-sticker `onPreScore` per played square (Gilded).
- **PER TILE** (cross words first, then main word): base letter score → additive (board `onTileAdd` on the square, additive aura hooks, gold-tile +$1, hotbar `onPerTile` hooks **left→right**) → multiplicative (board `onTileMult`: DL/TL/DW/TW, then multiplicative aura hooks: chess pieces) → retrigger (`retrigger:true` squares, red tiles).
- **POST** — bingo +50 → board `onPostWordAdd` → board `onPostWordMult` → hotbar `onPostWord` **left→right** (hotbar order is a gameplay mechanic) → bounty reward.
- **FINAL** — `total = round(letters × (1 + Σ plusMults) × Π xmults)`, then `ctx.finalTransforms` (Palindrome Engine).

The solver scores hypothetical moves through the same engine (board overlay + `preview:true`). `preview:true` skips cooldown commits and sticker side effects. Engine inputs/ctx surface are documented at the top of `score_engine.js`.

## Async solver (GADDAG)

Three-phase pipeline shared by all entry points:

1. **Generate** — `_solverGenMoves(handCounts, blankCount)` walks the GADDAG (gaddag.js) from each board anchor (empty square adjacent to a tile; centre when empty) and emits every legal placement spellable with the rack. Synchronous, ~20-30ms typical (~200ms with a blank). Cross-words are validated during generation via per-square letter bitmasks (`_solverCrossMasks`). Each move is generated exactly once (the leftward walk never places on another anchor). Blanks are used greedily only when the rack letter is unavailable.
2. **Score** — `_solverScoreMove(mv, hm)` runs each candidate through `runScoreEngine` (preview mode) on a board overlay, chunked via `setTimeout`.
3. **Rank** — top-K insertion while scoring.

All three phases (plus constraint filtering and bounty-score inflation via `_solverInflateBounty`) live in **`_solverCore(opts)`** — the single function every entry point calls, so scoring rules can't drift between them. Options: `handTiles`, `topK`, `constraintState` ({palUnlocked, lastWordLen} — the position moves are judged from), `chunk`, `shouldAbort()`, `onProgress(frac, best, total)`, `onDone(best|null)`.

Entry points (thin wrappers; all no-op until `GADDAG` is built — kicked off in init.js after `loadDict()`):
- `runSolver()` — dev-mode results panel, top 20, live position, progress UI.
- `_rankRunRankSolve(snap)` — background top-10 for the rank-reward system. Swaps `S.hand/bt/board` for the snapshot, restores when done.
- `findBestMoveBackground(snap, onDone)` — called on game over, top 5, judged from the snapshot's pre-play constraint state. Only restores if the gameover modal is still visible (prevents corruption if user starts a new game during solve). Note: the game-over reveal in play.js prefers the already-computed `_capturedRankTop10` and only calls this as a fallback.

## Game-over solver reveal

When `S.plays === 0`:
1. `window._lastPlaySnap` is saved at the start of each `playWord()` call — pre-play state (committed tiles only, full hand available, all `onBoard` flags cleared, plus pre-play `score`/`lastWordLen`/`palUnlocked`).
2. `findBestMoveBackground` is called with the snapshot; it returns the top 5 moves, applying the round's constraint filters from the snapshot state.
3. Everything is judged from the pre-final-word position: words scoring ≥ `tgt() - snap.score` (NOT the post-play `S.score`) are winning plays; up to 5 are listed in `#gameover-best-play`.
4. `showGO()` always hides `#gameover-best-play` to reset between losses.

## Tile state invariant

Each tile object is unique (one instance per `uid`). At any moment a tile lives in **exactly one location** and carries a matching `.state`:

| Location | `.state` |
|---|---|
| `S.hand[]` | `'hand'` (at rest) or `'dragging'` (being dragged) or `'moving'` (arcing back to hand) |
| `S.bt[i]` / `S.btTop[i]` | `'board'` |
| `S.bag[]` | — (not yet drawn) |
| Discarded / destroyed | `'stored'` |

**A tile must never appear in more than one location simultaneously.** Any code that moves a tile must remove it from the source before (or atomically with) adding it to the destination. `setTileState` is the canonical way to update `.state`; it clears sub-properties (`sel`, `isNew`, `boardSq`, etc.) appropriate to the transition.

Corollaries enforced in the codebase:
- `placeTile` uses `filter` (not `indexOf+splice`) to remove **all** occurrences of the tile from `S.hand` before placing it on the board.
- Every `S.hand.push(tile)` in recall paths is guarded with `indexOf(tile) < 0`.
- `_landTile` uses `filter+push` (not `splice+push`) so that if a tile is somehow present twice in `S.hand`, it is deduplicated to a single entry on landing.

## Key conventions

- **No bundler**: everything is vanilla JS in global scope. `<script>` load order matters — `data.js` first, `init.js` last.
- **DOM IDs**: JS accesses elements exclusively via `getElementById` / `querySelector('[data-sq-idx]')`. Never restructure HTML in a way that breaks existing IDs.
- **`S.board` vs `S.bt`**: `S.board[i]` holds the sticker ID (e.g. `'dl'`, `'echo'`). `S.bt[i]` holds the tile object placed on that square. Both are `B*B` arrays.
- **`isNew` flag**: `S.bt[i].isNew = true` means the tile was placed this turn and can be recalled. Committed tiles have `isNew = false`.
- **Bounties persist** across rounds — `advanceRound` does NOT reset `S.bounties`.
- **No `console.log` spam**: use `toast(msg)` for user-facing feedback.
- **Seeded RNG**: always use `_rng()` not `Math.random()` for anything that should be reproducible. `Math.random()` is only used in dev-mode tile drawing.

## Progression

```
STAGES[ai][bi] = [name, subtitle, target, constraint?]
4 stages × 3 rounds each = 12 rounds, then endless mode (targets ×1.4/round).
Round 3 of each stage applies a constraint from CONSTRAINTS (order shuffled
per run into S.constraintOrder): c_long, c_pal, c_longer, c_letters, c_hand,
c_draw3, c_nodisc, c_oneplay, c_stickers.
```

## Sticker types (SQ array) and scoring hooks

Two families: **board stickers** (`type:'board'`/`'local'`, live in `S.placed` with a `sqIdx`, id mirrored in `S.board[sqIdx]`) and **hotbar/tile stickers** (`type:'tile'`, live in `S.tileStickers` — array order = hotbar left→right order, which is the order their hooks fire in).

Scoring hooks (all receive `ctx`; read game state via `ctx.state`, never `S`, so the engine stays pure/testable):

- `onBuildCtx(ctx, inst)` — register flags/auras/final transforms before scoring (Purist, chess pieces, Palindrome Engine, The King).
- Auras — for board stickers whose effect targets *other* squares: in `onBuildCtx`, `ctx.auras.push({squares, onTileAdd, onTileMult})`. `squares` is a Set/array of covered indices (omit to evaluate every tile in the hook); `onTileAdd` fires in the per-tile additive bracket, `onTileMult` in the mult bracket. Every matching aura fires — overlapping auras **stack** (two chess pieces covering a square = ×9). Note: DL/TL/DW/TW are NOT auras — they're square-local `onTileMult` hooks on the sticker def; auras are only for ranged effects.
- `onPreScore(tile, ctx, sqIdx)` — board, PRE bracket (Gilded).
- `onTileAdd(tile, ctx, ts, baseSc, sqIdx)` — board, per-tile additive (Void, Spring Trap, Slot Machine setup).
- `onPerTile(tile, ctx, ts, inst)` — hotbar, per-tile additive, left→right (Commons, NATO letters).
- `onTileMult(tile, ctx, ts, sqIdx)` — board, per-tile multiplicative (DL/TL/DW/TW).
- `onPostWordAdd` / `onPostWordMult(w, wt, ctx, inst)` — board, post-word (Proletariat / Slot Machine payout).
- `onPostWord(w, wt, ctx, inst)` — hotbar, post-word, left→right (Scholar, Crossroads, Drunk Text, …).
- `onCrossword(ctx, inst)` — hotbar, fired before each cross word scores (Crossroads tooltip tick).
- `retrigger:true` — board flag; engine re-runs the per-tile passes (Red Sticker).
- Non-engine hooks fired from play/game code: `onWordPlayed`, `onEndStage`, `onSell`, `onAcquire`.
- Chess pieces (`chess_*`) — hover to preview attack pattern; click to inspect.
