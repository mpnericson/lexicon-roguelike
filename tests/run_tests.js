// Unit tests for the pure scoring engine (src/score_engine.js).
// Run with: node tests/run_tests.js
//
// The game has no module system, so the engine and sticker definitions are
// loaded into a shared vm sandbox exactly as the browser would via <script>
// tags. Because runScoreEngine reads no global game state, each test just
// constructs an input object and asserts on the returned totals.

const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');

const sandbox = {
  console: console,
  setTimeout: setTimeout,
  // UI/game shims — only reached by non-preview side-effect branches
  toast: function () {},
  transformTile: function () {},
  S: {}
};
vm.createContext(sandbox);
[
  'src/data.js',
  'src/stickers/board/squares.js',
  'src/stickers/board/effects.js',
  'src/stickers/board/indirect.js',
  'src/stickers/stamps/economy.js',
  'src/stickers/stamps/scoring.js',
  'src/stickers/stamps/utility.js',
  'src/score_engine.js',
  'src/scoring.js',
  'src/gaddag.js',
  'src/solver.js'
].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
});
vm.runInContext('buildSQMap()', sandbox);

const B = sandbox.B;
function emptyBoard() { return new Array(B * B).fill(null); }
function place(tiles, r, c, dir, word, isNew) {
  for (let i = 0; i < word.length; i++) {
    const idx = dir === 'h' ? r * B + c + i : (r + i) * B + c;
    tiles[idx] = { letter: word[i], isNew: isNew !== false };
  }
}
function score(input) {
  return sandbox.runScoreEngine(Object.assign({
    boardStickers: emptyBoard(), placed: [], stamps: [], cooldowns: new Set(),
    bounties: [], preview: true
  }, input, { state: Object.assign({ freeHandCount: 3 }, input.state || {}) }));
}

let failed = 0;
function eq(name, got, want) {
  if (got === want) console.log('  ok  ' + name);
  else { failed++; console.log('FAIL  ' + name + ' — got ' + got + ', want ' + want); }
}

// ── 1. Plain word, no stickers: CAT = 3+1+1 ──────────────────────────────────
{
  const tiles = emptyBoard();
  place(tiles, 7, 7, 'h', 'CAT');
  const res = score({ tiles });
  eq('plain CAT total', res.total, 5);
  eq('plain CAT mult', res.mult, 1);
}

// ── 2. Double Word square: CAT ×2 ─────────────────────────────────────────────
{
  const tiles = emptyBoard();
  place(tiles, 7, 7, 'h', 'CAT');
  const board = emptyBoard();
  board[7 * B + 7] = 'dw';
  const res = score({ tiles, boardStickers: board });
  eq('DW total', res.total, 10);
}

// ── 3. Double Letter, alone and doubled by The Purist ────────────────────────
{
  const tiles = emptyBoard();
  place(tiles, 7, 7, 'h', 'CAT');
  const board = emptyBoard();
  board[7 * B + 8] = 'dl'; // under the A
  eq('DL total', score({ tiles, boardStickers: board }).total, 6); // 3 + 1×2 + 1
  eq('DL + Purist total',
    score({ tiles, boardStickers: board, stamps: [{ id: 'the_purist' }] }).total, 8); // 3 + 1×4 + 1
}

// ── 4. Bingo: whole hand used adds +50 letters ────────────────────────────────
{
  const tiles = emptyBoard();
  place(tiles, 7, 7, 'h', 'CAT');
  const res = score({ tiles, state: { freeHandCount: 0 } });
  eq('bingo total', res.total, 55);
  eq('bingo flag', res.bingo, true);
}

// ── 5. Tile-count bonus: 4 new tiles = +1 mult in the PRE bracket ────────────
{
  const tiles = emptyBoard();
  place(tiles, 7, 7, 'h', 'CATS');
  const res = score({ tiles });
  eq('4-tile bonus total', res.total, 12); // (3+1+1+1) × 2
}

// ── 6. Stamp order matters: Marshall (+15 letters) vs Drunk Text (÷2) ───────
{
  function withStamps(stamps) {
    const tiles = emptyBoard();
    place(tiles, 7, 7, 'h', 'CAT');
    return score({
      tiles, stamps,
      state: { pendingBountyReward: true, drunkValid: false, drunkStreak: 0 }
    }).total;
  }
  const marshallFirst = withStamps([{ id: 'the_marshall' }, { id: 'drunk_text' }]);
  const drunkFirst = withStamps([{ id: 'drunk_text' }, { id: 'the_marshall' }]);
  eq('Marshall → Drunk Text', marshallFirst, 5); // floor((5+15)/2)=10 × 0.5
  eq('Drunk Text → Marshall', drunkFirst, 9);    // (floor(5/2)+15)=17 × 0.5 → 8.5 → 9
}

// ── 7. Cross words are found and scored from the board alone ─────────────────
{
  const tiles = emptyBoard();
  place(tiles, 7, 7, 'h', 'CAT');
  tiles[8 * B + 7] = { letter: 'O', isNew: false }; // committed O under the C → "CO"
  const res = score({ tiles });
  eq('crossword count', res.crossWordCount, 1);
  eq('crossword words', res.allWords.join(','), 'CAT,CO');
  eq('crossword total', res.total, 9); // CO (3+1) + CAT (3+1+1)
}

// ── 8. Multiplicative aura: knight at (5,6) covers (7,7) with ×3 ─────────────
{
  sandbox.S.bt = new Array(B * B).fill(null); // chessGetAura reads S.bt for blocking
  const tiles = emptyBoard();
  place(tiles, 7, 7, 'h', 'CAT');
  const knightSq = 5 * B + 6; // L-move (+2,+1) lands on (7,7) — the C
  const board = emptyBoard();
  board[knightSq] = 'chess_knight';
  const res = score({ tiles, boardStickers: board, placed: [{ id: 'chess_knight', sqIdx: knightSq }] });
  eq('knight aura total', res.total, 11); // C 3×3=9, A 1, T 1

  // Overlapping auras stack: second knight at (9,6) also covers (7,7) → ×9
  const knight2 = 9 * B + 6;
  const res2 = score({
    tiles, boardStickers: board,
    placed: [{ id: 'chess_knight', sqIdx: knightSq }, { id: 'chess_knight', sqIdx: knight2 }]
  });
  eq('overlapping auras stack', res2.total, 29); // C 3×3×3=27, A 1, T 1
}

// ── 9. Additive aura: synthetic "+3 to all tiles in my row" board sticker ────
// Demonstrates that new ranged stickers only need onBuildCtx + ctx.auras.
{
  vm.runInContext(`
    SQ.push({id:'test_row_bonus',name:'Row Bonus',type:'board',
      onBuildCtx:function(ctx,p){
        var r=Math.floor(p.sqIdx/B),squares=[];
        for(var c=0;c<B;c++)squares.push(r*B+c);
        ctx.auras.push({id:'test_row_bonus',squares:squares,
          onTileAdd:function(tile,ctx2,ts,sqIdx){
            ts+=3;
            ctx2.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'Row Bonus +3'});
            return ts;
          }});
      }});
    buildSQMap();
  `, sandbox);
  const tiles = emptyBoard();
  place(tiles, 7, 7, 'h', 'CAT');
  const src = 7 * B + 0; // same row as the word
  eq('row aura (in row) total',
    score({ tiles, placed: [{ id: 'test_row_bonus', sqIdx: src }] }).total, 14); // (3+3)+(1+3)+(1+3)
  const offRow = 9 * B + 0;
  eq('row aura (off row) total',
    score({ tiles, placed: [{ id: 'test_row_bonus', sqIdx: offRow }] }).total, 5);
}

// ── GADDAG move generation ────────────────────────────────────────────────────
// _solverGenMoves reads the sv position view (bt), DICT (cross-checks) and
// GADDAG. Returns the sv to pass into the pipeline.
function genSetup(bt, dict) {
  sandbox.S.bt = bt; // still read by non-pipeline shims (e.g. chess auras)
  sandbox.DICT = new Set(dict);
  sandbox.buildGaddagSync(dict);
  return { bt: bt, btTop: null, board: new Array(B * B).fill(null),
           placed: [], stamps: [], cooldowns: new Set(), bounties: [] };
}
function moveKeys(moves) {
  return moves.map(m => m.word + '@' + m.r + ',' + m.c + (m.isH ? 'h' : 'v')).sort().join(' ');
}

// ── 10. Empty board: every placement covers the centre, both directions ─────
{
  const sv = genSetup(new Array(B * B).fill(null), ['CAT', 'CATS', 'AT', 'TA']);
  const moves = sandbox._solverGenMoves(sv, { C: 1, A: 1, T: 1 }, 0);
  // CAT: 3 starts × 2 dirs; AT/TA: 2 starts × 2 dirs each = 6+4+4
  eq('empty board move count', moves.length, 14);
  eq('empty board contains CAT@7,7h', moves.some(m => m.word === 'CAT' && m.r === 7 && m.c === 7 && m.isH), true);
}

// ── 11. Extending an existing word: CAT on board + S in hand → only CATS ────
{
  const bt = new Array(B * B).fill(null);
  'CAT'.split('').forEach((L, i) => { bt[7 * B + 7 + i] = { letter: L, isBlank: false }; });
  const sv = genSetup(bt, ['CAT', 'CATS', 'AT', 'TA']);
  const moves = sandbox._solverGenMoves(sv, { S: 1 }, 0);
  eq('extension moves', moveKeys(moves), 'CATS@7,7h');
  eq('extension placements', moves[0].placements.length, 1); // only the S is new
}

// ── 12. Cross-check masks reject invalid cross words ─────────────────────────
{
  const bt = new Array(B * B).fill(null);
  'CAT'.split('').forEach((L, i) => { bt[7 * B + 7 + i] = { letter: L, isBlank: false }; });
  // TA is valid vertically through the A (T above it); TC through C is not a word
  const sv = genSetup(bt, ['CAT', 'TA']);
  const moves = sandbox._solverGenMoves(sv, { T: 1 }, 0);
  eq('crossword moves', moveKeys(moves), 'TA@6,8v');
}

// ── 13. Blanks fill missing letters ──────────────────────────────────────────
{
  const bt = new Array(B * B).fill(null);
  'CAT'.split('').forEach((L, i) => { bt[7 * B + 7 + i] = { letter: L, isBlank: false }; });
  const sv = genSetup(bt, ['CAT', 'CATS']);
  const moves = sandbox._solverGenMoves(sv, {}, 1); // empty rack, one blank
  eq('blank moves', moveKeys(moves), 'CATS@7,7h');
  eq('blank flagged', moves[0].placements[0].isBlank, true);
}

// ── 14. Hand maps count the full rack (game-over snapshot bingo guard) ───────
// The game-over reveal reconstructs the pre-play hand by adding the placed
// final-word tiles back. handTileCount must equal the whole rack so bingo
// (freeHandCount 0) isn't falsely awarded to short words.
{
  const rack = [
    { letter: 'C' }, { letter: 'A' }, { letter: 'T' }, { letter: 'S' },
    { letter: 'D' }, { letter: 'O' }, { letter: 'G' }, { isBlank: true }
  ];
  const hm = sandbox._solverHandMaps(rack);
  eq('handTileCount full rack', hm.handTileCount, 8);
  eq('blank pool size', hm.blankPool.length, 1);
  // A 5-tile word from an 8-tile rack is NOT a bingo (5 < 8).
  eq('short word not bingo', 5 >= hm.handTileCount, false);
  // Playing all 8 would bingo.
  eq('full rack bingos', 8 >= hm.handTileCount, true);
}

// ── 15. Jenga (Deep Roots): buried tile scores its letter value ─────────────
// A stacked top forms the word; the committed tile beneath also scores its
// letter value, but does NOT re-fire the square's own sticker.
{
  const tiles = emptyBoard();
  place(tiles, 7, 7, 'h', 'CAT');
  const jIdx = 7 * B + 8; // the 'A' square holds a Jenga top
  const jengaTops = new Set([jIdx]);
  const jengaUnder = {}; jengaUnder[jIdx] = { letter: 'Q', isBlank: false, sc: 10, variant: null };
  // CAT = 3+1+1 = 5, plus buried Q letter value 10 = 15
  eq('jenga buried tile total', score({ tiles, jengaTops, jengaUnder }).total, 15);

  // Buried tile must not re-fire the square's Double Letter sticker.
  const board = emptyBoard(); board[jIdx] = 'dl';
  // C3 + A(1×2)=2 + T1 + buried Q 10 (DL skipped) = 16
  eq('jenga buried skips square sticker', score({ tiles, jengaTops, jengaUnder, boardStickers: board }).total, 16);
}

// ── 16. Jenga: the TOP forms the cross word; the buried tile scores in BOTH ──
// Main word DOG (top O stacked on a buried A). The top O also forms the vertical
// cross word COT with committed C above and T below. The buried A scores its
// value inside each word — main word DOG and cross word COT.
{
  const jIdx = 7 * B + 8;
  const tiles = emptyBoard();
  place(tiles, 7, 7, 'h', 'D', false);   // committed D to the left
  tiles[jIdx] = { letter: 'O', isNew: true }; // stacked top → main word DOG, cross word COT
  place(tiles, 7, 9, 'h', 'G', false);   // committed G to the right
  place(tiles, 6, 8, 'v', 'C', false);   // committed C above
  place(tiles, 8, 8, 'v', 'T', false);   // committed T below
  const jengaTops = new Set([jIdx]);
  const jengaUnder = {}; jengaUnder[jIdx] = { letter: 'A', isBlank: false, sc: 1, variant: null };

  // Without the flag: only DOG (2+1+2) + Deep Roots A (1) = 6
  eq('jenga cross not scored unflagged',
    score({ tiles, dir: 'h', newIdxs: [jIdx], jengaTops, jengaUnder }).total, 6);

  // Flagged valid: cross word COT (3+1+1) + buried A (1) = 6, main DOG (5) + buried A (1) = 6 → 12
  const res = score({ tiles, dir: 'h', newIdxs: [jIdx], jengaTops, jengaUnder, jengaCrossIdxs: [jIdx] });
  eq('jenga top forms cross word, buried scores in it', res.total, 12);
  eq('jenga cross word is the TOP word (COT)', res.events.some(e => e.label === 'O' && e.sqIdx === jIdx), true);
  eq('jenga cross word count', res.crossWordCount, 1);

  // Animation hooks: the buried tile scores in BOTH words and its letter events
  // carry the slide axis — along the main-word axis (h) while the cross word
  // scores, along the cross axis (v) while the main word scores.
  const buried = res.events.filter(e => e.type === 'letter' && e.jengaUnder && e.sqIdx === jIdx && e.label === 'A');
  eq('jenga buried scores in cross word (axis h)', buried.some(e => e.jengaSlideAxis === 'h'), true);
  eq('jenga buried scores in main word (axis v)', buried.some(e => e.jengaSlideAxis === 'v'), true);
}

// ── 17. Jenga generation: the hook gates stacked-play moves ─────────────────
// CAT on board; rack O,S,B. With the hook on, the walk must find single
// stacks (COT), mixed plays (COTS = stack + fresh tile), and multi-stacks
// (BOT = two overrides), each generated exactly once.
{
  const bt = new Array(B * B).fill(null);
  'CAT'.split('').forEach((L, i) => { bt[7 * B + 7 + i] = { letter: L, isBlank: false }; });
  const sv = genSetup(bt, ['CAT', 'CATS', 'COT', 'BAT', 'BOT', 'COTS']);
  const off = sandbox._solverGenMoves(sv, { O: 1, S: 1, B: 1 }, 0);
  eq('jenga off: no stacked moves', off.some(m => m.placements.some(p => p.isTop)), false);
  const on = sandbox._solverGenMoves(sv, { O: 1, S: 1, B: 1 }, 0, true);
  eq('jenga single stack COT', on.some(m => m.word === 'COT' && m.isH
    && m.placements.length === 1 && m.placements[0].isTop && m.placements[0].idx === 7 * B + 8), true);
  eq('jenga mixed COTS', on.some(m => m.word === 'COTS' && m.isH && m.placements.length === 2
    && m.placements.filter(p => p.isTop).length === 1), true);
  eq('jenga multi stack BOT', on.some(m => m.word === 'BOT' && m.isH
    && m.placements.filter(p => p.isTop).length === 2), true);
  eq('jenga on: classic CATS still found', on.some(m => m.word === 'CATS'
    && m.placements.length === 1 && !m.placements[0].isTop), true);
  const sig = on.map(m => m.word + '@' + m.r + ',' + m.c + (m.isH ? 'h' : 'v') + ':'
    + m.placements.map(p => p.idx + p.letter + (p.isTop ? '^' : '')).sort().join(','));
  eq('jenga no duplicate moves', new Set(sig).size, sig.length);
  // Each square stacks only once: a committed tile that was itself stacked
  // (_stackLevel >= 1) must never take another override.
  bt[7 * B + 8]._stackLevel = 1;
  const on2 = sandbox._solverGenMoves(sv, { O: 1, S: 1, B: 1 }, 0, true);
  eq('jenga no double stack', on2.some(m => m.placements.some(p => p.isTop && p.idx === 7 * B + 8)), false);
  delete bt[7 * B + 8]._stackLevel;
}

// ── 18. Jenga: single-stack direction must match engine inference ───────────
// CAT horizontal and C-O-T vertical sharing the C. A lone stack on the C is
// judged horizontally by _engWordDir (C has a horizontal neighbour), so BAT@h
// is emitted while the equally spellable BOT/DOT@v must be suppressed.
{
  const bt = new Array(B * B).fill(null);
  'CAT'.split('').forEach((L, i) => { bt[7 * B + 7 + i] = { letter: L, isBlank: false }; });
  'OT'.split('').forEach((L, i) => { bt[(8 + i) * B + 7] = { letter: L, isBlank: false }; });
  const sv = genSetup(bt, ['CAT', 'COT', 'BAT', 'BOT', 'DOT', 'DAT']);
  const on = sandbox._solverGenMoves(sv, { B: 1, D: 1 }, 0, true);
  eq('jenga dir: BAT h emitted', on.some(m => m.word === 'BAT' && m.isH
    && m.placements.length === 1 && m.placements[0].isTop), true);
  eq('jenga dir: BOT v suppressed', on.some(m => m.word === 'BOT' && !m.isH
    && m.placements.length === 1 && m.placements[0].isTop && m.placements[0].idx === 7 * B + 7), false);
  eq('jenga dir: DOT v suppressed', on.some(m => m.word === 'DOT' && !m.isH
    && m.placements.length === 1), false);
}

// ── 19. Jenga: solver scores stacked moves like live play would ─────────────
// BAT stacked over the C of CAT (with OT vertical below the C): main word BAT
// (3+1+1) + buried C in main (3); the top B also forms cross word BOT (3+1+1)
// + buried C in it (3) = 8 + 8 = 16.
{
  const bt = new Array(B * B).fill(null);
  'CAT'.split('').forEach((L, i) => { bt[7 * B + 7 + i] = { letter: L, isBlank: false }; });
  'OT'.split('').forEach((L, i) => { bt[(8 + i) * B + 7] = { letter: L, isBlank: false }; });
  const sv = genSetup(bt, ['CAT', 'BAT', 'COT', 'BOT']);
  sandbox.currentConstraint = () => null;
  Object.assign(sandbox.S, { bag: [], board: new Array(B * B).fill(null), placed: [],
    stamps: [], localCooldowns: new Set(), bounties: [] }); // buildEngineState reads S scalars live
  const hm = sandbox._solverHandMaps([{ letter: 'B' }, { letter: 'Q' }, { letter: 'Z' }]);
  const on = sandbox._solverGenMoves(sv, hm.handCounts, 0, true);
  const batMv = on.find(m => m.word === 'BAT' && m.isH && m.placements[0] && m.placements[0].isTop);
  eq('jenga scored move found', !!batMv, true);
  const res = sandbox._solverScoreMove(sv, batMv, hm);
  eq('jenga stacked move score', res.score, 16);
  eq('jenga wt marks top', res.wt[0].isNew && res.wt[0].isTop, true);
}

// ── Mirror: a word valid backwards scores twice ──────────────────────────────
{
  const tiles = emptyBoard();
  place(tiles, 7, 7, 'h', 'ON');
  const newIdxs = [7 * B + 7, 7 * B + 8];
  const key = newIdxs.slice().sort((a, b) => a - b).join(',');
  const mw = sandbox._engMirrorWords(tiles, newIdxs, 'h', null, w => w === 'NO');
  eq('mirror detects ON→NO', !!(mw && mw.has(key)), true);
  // ON = 1+1 = 2 letters, scored a second time = 4, mult ×1
  eq('mirror ON scores twice', score({ tiles, newIdxs, dir: 'h', mirrorWords: mw }).total, 4);
  eq('mirror off ON once', score({ tiles, newIdxs, dir: 'h' }).total, 2);
}

// ── Mirror: a word not valid backwards scores once ───────────────────────────
{
  const tiles = emptyBoard();
  place(tiles, 7, 7, 'h', 'CAT');
  const newIdxs = [7 * B + 7, 7 * B + 8, 7 * B + 9];
  eq('mirror ignores non-reversible', sandbox._engMirrorWords(tiles, newIdxs, 'h', null, w => w === 'DOG'), null);
}

// ── 20. Jenga: a committed stack keeps scoring its buried tile ──────────────
// A stack committed on a previous play keeps its buried tile on _buried, passed
// to the engine via jengaUnder (no jengaTops — it isn't a fresh stack). A word
// formed through it scores the buried tile too, in each word it's part of.
{
  const jIdx = 7 * B + 8;
  const tiles = emptyBoard();
  place(tiles, 6, 8, 'v', 'C');          // new C above
  tiles[jIdx] = { letter: 'O', isNew: false, _stackLevel: 1,
    _buried: { letter: 'A', isBlank: false, _alchSc: 0, variant: null } }; // committed stack O over buried A
  place(tiles, 8, 8, 'v', 'T');          // new T below → vertical COT through the committed O
  const jengaUnder = {}; jengaUnder[jIdx] = { letter: 'A', isBlank: false, sc: 1, variant: null };

  // COT (3+1+1) + buried A (1) = 6; no jengaTops, so it's purely the committed path
  const res = score({ tiles, dir: 'v', newIdxs: [6 * B + 8, 8 * B + 8], jengaUnder });
  eq('committed stack buried scores in word', res.total, 6);
  const buried = res.events.filter(e => e.type === 'letter' && e.jengaUnder && e.sqIdx === jIdx && e.label === 'A');
  eq('committed stack buried tagged for reveal', buried.length, 1);
  // Without the buried info, only COT (5) scores.
  eq('committed stack no buried without jengaUnder', score({ tiles, dir: 'v', newIdxs: [6 * B + 8, 8 * B + 8] }).total, 5);
}

// ── Pantry Soup: ×(discards remaining), ×0 at zero discards ──────────────────
{
  const tiles = emptyBoard();
  place(tiles, 7, 7, 'h', 'CAT'); // 5 letters × 1
  const soup = [{ id: 'pantry_soup' }];
  eq('pantry soup ×3', score({ tiles, stamps: soup, state: { discardsLeft: 3 } }).total, 15);
  eq('pantry soup ×1', score({ tiles, stamps: soup, state: { discardsLeft: 1 } }).total, 5);
  eq('pantry soup ×0 wipes', score({ tiles, stamps: soup, state: { discardsLeft: 0 } }).total, 0);
}

// ── Sesquipedalian: +len mult for words 5+ letters, nothing below ────────────
{
  const sesq = [{ id: 'sesquipedalian' }];
  const short = emptyBoard(); place(short, 7, 7, 'h', 'CAT'); // 4 tiles→below threshold too
  eq('sesq short word ignored', score({ tiles: short, stamps: sesq }).total, 5); // ×1
  const long = emptyBoard(); place(long, 7, 5, 'h', 'CATTLE'); // 6 letters
  // letters CATTLE = 3+1+1+1+1+1 = 8; 6 tiles → +3 tile bonus, +6 sesq → ×10
  eq('sesq 6-letter word', score({ tiles: long, stamps: sesq }).total, 80);
}

// ── Cartographer: applies accumulated corner mult, ×1 is a no-op ─────────────
{
  const tiles = emptyBoard();
  place(tiles, 7, 7, 'h', 'CAT'); // 5 letters
  const carto = [{ id: 'cartographer' }];
  eq('cartographer at ×1 no-op', score({ tiles, stamps: carto, state: { cartographerMult: 1 } }).total, 5);
  eq('cartographer ×2.5', score({ tiles, stamps: carto, state: { cartographerMult: 2.5 } }).total, 13); // 5×2.5=12.5→13
}

// ── Virus: +10 letter score, +2 mult, −$1 on the landing tile ────────────────
{
  const tiles = emptyBoard();
  place(tiles, 7, 7, 'h', 'CAT');
  const board = emptyBoard();
  board[7 * B + 8] = 'virus'; // under the A
  const res = score({ tiles, boardStickers: board });
  // letters: C3 + (A1+10) + T1 = 15; mult (1+2)=3 → 45
  eq('virus total', res.total, 45);
  eq('virus costs $1', res.tgold, -1);
}

console.log(failed ? '\n' + failed + ' test(s) FAILED' : '\nAll tests passed');
process.exit(failed ? 1 : 0);
