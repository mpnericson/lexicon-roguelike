# Lexicon — Scrabble Roguelike

A browser/Electron Scrabble roguelike. All game logic lives in `src/` JS files loaded via `<script>` tags in `index.html`. No bundler, no framework, no modules.

**Terminology**: **stickers** are board-square effects (placed on squares, formerly "board stickers"); **stamps** are the passive items in the bar above the hand (formerly "hotbar/tile/global stickers"). Both share the `SQ` defs array and the `Assets/stickers/` sprite pipeline.

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
| `src/version.js` | `GAME_VERSION` shown at the bottom of the dropdown menu. Base is hand-edited; build number auto-bumped every commit by `scripts/git-hooks/pre-commit` (enabled via `git config core.hooksPath scripts/git-hooks`). |
| `src/data.js` | Constants: `B=15` (board WIDTH / row stride), `BH=12` (board HEIGHT), `BN=B*BH` (total cells — flat board arrays are length `BN`, `idx = row*B + col`), `LS` (letter scores), `DIST` (tile counts), `BOARDS`/`CONSTRAINTS` (progression), `setTileState` (tile state machine), utility fns (`uid`, `_rng`, `shuffle`, `sqd`). `SQ` sticker defs live in `src/stickers/`. |
| `src/game.js` | Global state `S`, `startGame`, `roundComplete`/`advanceRound`, `showGO`, `toast`, modals, bag modal + letter expand/collapse, WebAudio SFX, `transformTile`, `openBlankChooser`, `hasStamp`/`countStamp`. |
| `src/save.js` | localStorage run persistence: `saveGame`, `loadGame`, `resumeGame`, `clearSave`. |
| `src/achievements.js` | Achievement defs, `achvInit`/`achvCheck`/`achvUnlock`, achievements modal. |
| `src/play.js` | `playWord` (async), `discardTiles`, `shuffleHand`. |
| `src/score_engine.js` | `runScoreEngine(input)` — pure scoring orchestrator. No global reads, no DOM. Unit-tested via `npm test` (`tests/run_tests.js`). |
| `src/scoring.js` | Live-state adapters (`scorePlay`, `buildEngineState`, `newTiles`, `extractAt`, `getAllWords`) + score animation (`runScoreAnim`, sticker floats). |
| `src/render.js` | `renderAll`, `renderBoard`, `renderHand`, `renderSqHand`, `renderHUD`. |
| `src/drag.js` | Pointer-event drag engine: `attachHandTileDrag`, `attachBoardTileDrag`, `attachSqDrag`, `placeTile`, `recallTile`. |
| `src/physics.js` | Spring physics for hand tiles: `HP` object, `hpBounds`, `hpRest`, `hpStep`, `hpDraw`. |
| `src/shop.js` | Shop phase UI, purchasing, sticker application. Slot machines: three symbol machines in `SLOT_MACHINES` (grey button = Budget $2+$1/spin, yellow = Regular $4+$2, pink = Rare $8+$4; per-machine costs reset each shop visit, reel tint = mode light), handle pull spins the armed machine (`spinArmedSlots` → `spinSymbolSlots(machine)`; outcome rolled first from the machine's payout table, reels dressed to match; prizes: stamps by rarity, gold, or ticket/tile/sticker/key packs opened via the consumables overlay). Legacy stamp-icon spin (`spinSlots`) survives only for the tutorial's `TUT.forceSlot`. |
| `src/stickers/` | All sticker + stamp definitions incl. their scoring hooks (board/squares, board/effects, board/indirect, stamps/economy, stamps/scoring, stamps/utility). |
| `src/ui.js` | Dev-mode palette, solver UI, board preview, misc modals. |
| `src/gaddag.js` | GADDAG word index (flat Int32Array, ~48MB, ~0.7s chunked build at startup). `buildGaddag`, `buildGaddagSync`, `gdChild`, `gdEnd`. |
| `src/solver.js` | GADDAG-based solver (`runSolver`, `_rankRunRankSolve`, `findBestMoveBackground`). |
| `src/anim.js` | Board↔shop transition animations. |
| `src/discovery.js` | Cross-run "almanac" tracking for the Collection (localStorage `lexicon_discovery`, separate from the run save): `discoveryInit`/`discoveryScan`/`discMark`/`discHas` record which stamps/stickers/tickets/keys/materials/coloured tiles were ever owned and which constraints/bounty themes were completed. Also home to `positionDescTip(el,triggerEl)` — the SHARED hover-description positioner (float LEFT of the hovered element, vertically centred, flip right if no room) used by the shop, consumables, Collection, and the in-board sticker/stamp tooltip. Plus `COLL_MATERIALS`/`COLL_COLORS`/`COLL_CONSTRAINT_ICONS` metadata. Collection hub UI itself lives in `ui.js` (`openCollection`→`collShowHub`/`collShowSection`); dev mode reveals everything. Dictionary is a hub button that opens the wordbook modal. |
| `src/dict.js` | `loadDict()`, `validWord()` — loads `dictionary.txt`. |
| `src/init.js` | Event listeners, startup: calls `loadDict()` then `startGame()`, kicks off `hpStep` RAF loop. |

## Global state

All mutable game state lives in `S` (declared in `game.js`):

```js
S = {
  bag, hand, board,   // board: BN (B*BH) array of sticker IDs (or null)
  bt,                 // bt: BN array of placed tile objects (or null)
  ai, bi,             // board index, round index into BOARDS
  score, gold, plays, disc,
  phase,              // 'play' | 'placing' | 'shop'
  placed,             // stickers the player has placed on the board
  stamps,             // stamps the player owns — array order = bar order (hooks fire left→right)
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
// width budget ÷ B columns, height budget ÷ BH rows — take the smaller
var sz = Math.max(30, Math.min(64, Math.floor(Math.min((window.innerWidth*0.52-80)/B, (window.innerHeight-250)/BH)))) + 2;
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

`playWord` → `scorePlay(nt, dir, preview)` (scoring.js adapter: builds engine input from `S`) → `runScoreEngine(input)` (score_engine.js, pure) → `runScoreAnim(res.events, res.total)` → `S.score += res.total`.

Per-square sticker hooks (`onTileAdd`, `onTileMult`, `retrigger:true`) fire only for the tile PLAYED on that square this turn (`tile.isNew` gate in `_engTilePasses`) — there is no cooldown state. Committed tiles crossing a sticker square never re-fire it; a square that frees up again (glass retrieve, Worm Hole, Spring Trap) catches the next tile played on it, and a Jenga top stacked onto a sticker square re-fires it.

The engine only controls the ORDER effects fire in; all effect logic lives in the sticker definitions. Bracket order:

- **PRE** — tile-count mult bonus (4/5/6/7 tiles → +1/+1/+3/+7 mult, i.e. total word mult 2/2/4/8; `_lenMultBonus`), then board-sticker `onPreScore` per played square (Gilded).
- **PER TILE** (cross words first, then main word): base letter score → additive (colour bonuses: blue +10 letters, red +4 plusMult; then board `onTileAdd` on the square, additive aura hooks, stamp `onPerTile` hooks **left→right**) → multiplicative (board `onTileMult`: DL/TL/DW/TW, then multiplicative aura hooks: chess pieces; purple ×2 xmult + `ctx.purpleScored` record) → retrigger (`retrigger:true` squares, stamp `onRetrigger` hooks). Retrigger passes re-run all three brackets (mult squares compound — DW/TW rarity is the balance lever; colour bonuses re-fire too). Metallic tile rule: every pass, base or retrigger, is followed by one metallic re-pass — `(1 + retrigger passes) × 2` total on a metallic tile.
- **POST** — tile-count letter bonus (4/5/6/7 tiles → +8/+16/+24/+48 letters, `_lenLetterBonus`; replaces the old bingo +50, though the `bingo` boolean still fires the "use all 7 tiles" achievement) → gold-tile board sweep (every gold tile on the board pays $1) → jade-tile board sweep (every jade tile on the board gives ×1.5) → board `onPostWordAdd` → board `onPostWordMult` → stamp `onPostWord` **left→right** (stamp bar order is a gameplay mechanic) → bounty reward.
- **On-board sweeps** — `boardSweep(ctx, match, fire)` (score_engine.js) runs `fire(tile, sqIdx)` for every matching tile on the board (committed + just played) in reading order. `ctx.boardRetriggers` (The Eagle's `onBuildCtx`, +1 per copy) adds extra triggerings per tile; every triggering routes through `_sweepTrigger`, where the metallic-tile rule lives ("if this tile triggers for any reason, it triggers again") — so a metallic tile fires `(1 + eagles) × 2` times. Used by the engine gold + jade payouts and by stamps like Yuan inside `onPostWord` (keeps stamp-bar order). Push one event per firing so each tile bounces individually.
- **Tile variants** — colours (`tile.variant`): red +4 mult, blue +10 letters, gold $1 board sweep, jade ×1.5 board sweep, purple ×2 with a 1-in-4 vanish rolled at commit in play.js (`res.purpleScored`; never in preview). Materials (`tile.material`): metallic = retrigger rule, glass = commits normally but is retrievable — clicking a committed glass tile floats it up while the hand shakes; clicking a shaking hand tile discards it (no discard charge) and the glass tile arcs to hand, clicking anywhere else cancels (`attachGlassRetrieve`/`_glassRet*` in drag.js, modal via document-capture listeners), varnished = bag draw priority ("anchor", `S.bagBlueAnchors` — name kept for save compat). Both axes are independent and are granted by Ticket/Key consumables (`src/consumables.js`); the shop bag button is a read-only view identical to the play-phase bag modal.
- **FINAL** — `total = round(letters × mult)`, then `ctx.finalTransforms` (Palindrome Engine). **The word mult is folded SEQUENTIALLY** (`ctx.mult`, starts at 1): each `+mult` adds to the running mult and each `×mult` multiplies it, **in the order effects fire** — so a `+mult` applied *after* a `×mult` (e.g. a post-word `+mult` stamp firing after the per-tile chess/DW `×mult`s) is added on top and is NOT retroactively multiplied. Implemented by intercepting `ctx.plusMults.push`/`ctx.xmults.push` (every mult source routes through them; sticker/stamp defs untouched). Consequences: bracket/stamp-bar order now materially changes the mult (a `+mult` stamp left of a `×mult` stamp gets multiplied; right of it does not), and `plusMults[]`/`xmults[]` are kept only as informational bucket totals — they no longer combine as `(1 + Σ plusMults) × Π xmults`.

The solver scores hypothetical moves through the same engine (board overlay + `preview:true`). `preview:true` skips sticker side effects. Engine inputs/ctx surface are documented at the top of `score_engine.js`.

## Async solver (GADDAG)

Three-phase pipeline shared by all entry points:

1. **Generate** — `_solverGenMoves(sv, handCounts, blankCount, jengaActive)` walks the GADDAG (gaddag.js) from each board anchor (empty square adjacent to a tile; centre when empty) and emits every legal placement spellable with the rack. Synchronous, ~20-30ms typical (~200ms with a blank). Cross-words are validated during generation via per-square letter bitmasks (`_solverCrossMasks`). Each move is generated exactly once (the leftward walk never places on another anchor). Blanks are used greedily only when the rack letter is unavailable. **Jenga hook** (`jengaActive`, set in `_solverCore` when the stamp is owned): committed tiles become stackable — their squares join the anchor set and the walk gains an override branch that stacks a rack tile on top (`isTop` placements; no cross-word mask since the buried letter keeps the perpendicular run; single-stack moves are emitted only in the direction `_engWordDir` will infer at play time). Stacked candidates score through the same engine inputs live play uses (`jengaTops`/`jengaUnder`/`jengaCrossIdxs`).
2. **Score** — `_solverScoreMove(sv, mv, hm)` runs each candidate through `runScoreEngine` (preview mode) on a board overlay, chunked via `setTimeout`.
3. **Rank** — top-K insertion while scoring.

All three phases (plus constraint filtering and bounty-score inflation via `_solverInflateBounty`) live in **`_solverCore(opts)`** — the single function every entry point calls, so scoring rules can't drift between them. Options: `position` (the `sv` view: {bt, btTop, board, placed, stamps, bounties}; defaults to live S references via `_solverLivePosition()`), `handTiles`, `topK`, `constraintState` ({palUnlocked, lastWordLen} — the position moves are judged from), `chunk`, `shouldAbort()`, `onProgress(frac, best, total)`, `onDone(best|null)`.

**The pipeline never reads live `S.hand/bt/board` mid-solve and NEVER installs a snapshot into `S`** — background solves pass a frozen `position`, so user input between chunks always sees real game state. (The old swap-`S.hand`-during-solve design let drags/renders mid-solve observe snapshot clones, duplicating tiles.)

Entry points (thin wrappers; all no-op until `GADDAG` is built — kicked off in init.js after `loadDict()`):
- `runSolver()` — dev-mode results panel, top 20, live position, progress UI.
- `_rankObserve(force?)` — the **rack observer** feeding the rank-reward system. Called from every rack mutation site (`drawFull`, `transformTile`, resume, gaddag-ready, shop exit/`confirmPlacement`, mid-play stamp/sticker sells with `force:true`). Signature-gated (tile id|letter|variant), cheap to call liberally. On change it freezes the position **synchronously** via `_rankCapturePosition()` (shared tile references, no clones — preview scoring never writes) and defers only the CPU work (`RANK_SOLVE_DELAY`, 600ms) before `_rankRunRankSolve(pos)` solves top-10 in the background. If GADDAG/phase/solver-mutex block the kick, the pending position is kept and re-kicked by the next observe.
- `findBestMoveBackground(snap, onDone)` — called on game over, top 5, judged from the snapshot's pre-play constraint state; snapshot passed as `position`, nothing to restore. Note: the game-over reveal in play.js prefers the already-computed `_capturedRankTop10` and only calls this as a fallback.

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
- **`S.board` vs `S.bt`**: `S.board[i]` holds the sticker ID (e.g. `'dl'`, `'echo'`). `S.bt[i]` holds the tile object placed on that square. Both are `BN` (`B*BH`) arrays.
- **`isNew` flag**: `S.bt[i].isNew = true` means the tile was placed this turn and can be recalled. Committed tiles have `isNew = false`.
- **Bounties persist** across rounds — `advanceRound` does NOT reset `S.bounties`.
- **No `console.log` spam**: use `toast(msg)` for user-facing feedback.
- **Seeded RNG**: always use `_rng()` not `Math.random()` for anything that should be reproducible. `Math.random()` is only used in dev-mode tile drawing.

## Progression

```
BOARDS[ai][bi] = [name, subtitle, target, constraint?]
8 boards × 3 rounds each = 24 rounds, then endless mode. Targets are
hand-tuned in the BOARDS table (50 → 500,000 across the run).
Endless mirrors the run structure: 3-round boards, board index = S.ai -
BOARDS.length (endlessBoard() in game.js). Openings continue from 500k at
×2.5, with the jump growing ×1.2 per board (endlessTgt(eb,er)); rounds step
×1/×1.4/×2 — eventually unbeatable. The progress tracker (frames 1-24,
25 = complete) loops back to board 1 in endless.
Round 3 of each board applies a constraint from CONSTRAINTS (order shuffled
per run into S.constraintOrder): c_long, c_pal, c_longer, c_letters, c_hand,
c_draw3, c_nodisc, c_oneplay, c_stickers.
```

## Sticker/stamp types (SQ array) and scoring hooks

Two families: **stickers** (`type:'board'`/`'local'`, live in `S.placed` with a `sqIdx`, id mirrored in `S.board[sqIdx]`) and **stamps** (`type:'stamp'`, live in `S.stamps` — array order = stamp bar left→right order, which is the order their hooks fire in).

Scoring hooks (all receive `ctx`; read game state via `ctx.state`, never `S`, so the engine stays pure/testable):

- `onBuildCtx(ctx, inst)` — register flags/auras/final transforms before scoring (chess pieces, Palindrome Engine, The King).
- Auras — for board stickers whose effect targets *other* squares: in `onBuildCtx`, `ctx.auras.push({squares, onTileAdd, onTileMult})`. `squares` is a Set/array of covered indices (omit to evaluate every tile in the hook); `onTileAdd` fires in the per-tile additive bracket, `onTileMult` in the mult bracket. Every matching aura fires — overlapping auras **stack** (two chess pieces covering a square = ×9). Note: DL/TL/DW/TW are NOT auras — they're square-local `onTileMult` hooks on the sticker def; auras are only for ranged effects.
- `onPreScore(tile, ctx, sqIdx)` — board, PRE bracket (Gilded).
- `onTileAdd(tile, ctx, ts, baseSc, sqIdx)` — board, per-tile additive (Void, Spring Trap, Slot Machine). `ctx.curWordTiles` holds the word currently scoring.
- `onPerTile(tile, ctx, ts, inst)` — stamp, per-tile additive, left→right (Commons, NATO letters).
- `onTileMult(tile, ctx, ts, sqIdx)` — board, per-tile multiplicative (DL/TL/DW/TW).
- `onPostWordAdd` / `onPostWordMult(w, wt, ctx, inst)` — board, post-word (Proletariat).
- `onPostWord(w, wt, ctx, inst)` — stamp, post-word, left→right (Scholar, Crossroads, Drunk Text, …).
- `onCrossword(ctx, inst)` — stamp, fired before each cross word scores (Crossroads tooltip tick).
- `retrigger:true` — board flag; engine re-runs the per-tile passes (Red Sticker).
- Non-engine hooks fired from play/game code: `onWordPlayed`, `onEndRound` (every round, in `roundComplete`, before the discard counter resets), `onEndBoard` (round 3 only, in `advanceRound`), `onSell`, `onAcquire`.
- Chess pieces (`chess_*`) — hover to preview attack pattern; click to inspect.
