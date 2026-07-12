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
  'src/stickers/tile/economy.js',
  'src/stickers/tile/scoring.js',
  'src/stickers/tile/utility.js',
  'src/score_engine.js',
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
    boardStickers: emptyBoard(), placed: [], hotbar: [], cooldowns: new Set(),
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
    score({ tiles, boardStickers: board, hotbar: [{ id: 'the_purist' }] }).total, 8); // 3 + 1×4 + 1
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

// ── 6. Hotbar order matters: Marshall (+15 letters) vs Drunk Text (÷2) ───────
{
  function withHotbar(hotbar) {
    const tiles = emptyBoard();
    place(tiles, 7, 7, 'h', 'CAT');
    return score({
      tiles, hotbar,
      state: { pendingBountyReward: true, drunkValid: false, drunkStreak: 0 }
    }).total;
  }
  const marshallFirst = withHotbar([{ id: 'the_marshall' }, { id: 'drunk_text' }]);
  const drunkFirst = withHotbar([{ id: 'drunk_text' }, { id: 'the_marshall' }]);
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
// _solverGenMoves reads S.bt (board), DICT (cross-checks) and GADDAG.
function genSetup(bt, dict) {
  sandbox.S.bt = bt;
  sandbox.DICT = new Set(dict);
  sandbox.buildGaddagSync(dict);
}
function moveKeys(moves) {
  return moves.map(m => m.word + '@' + m.r + ',' + m.c + (m.isH ? 'h' : 'v')).sort().join(' ');
}

// ── 10. Empty board: every placement covers the centre, both directions ─────
{
  genSetup(new Array(B * B).fill(null), ['CAT', 'CATS', 'AT', 'TA']);
  const moves = sandbox._solverGenMoves({ C: 1, A: 1, T: 1 }, 0);
  // CAT: 3 starts × 2 dirs; AT/TA: 2 starts × 2 dirs each = 6+4+4
  eq('empty board move count', moves.length, 14);
  eq('empty board contains CAT@7,7h', moves.some(m => m.word === 'CAT' && m.r === 7 && m.c === 7 && m.isH), true);
}

// ── 11. Extending an existing word: CAT on board + S in hand → only CATS ────
{
  const bt = new Array(B * B).fill(null);
  'CAT'.split('').forEach((L, i) => { bt[7 * B + 7 + i] = { letter: L, isBlank: false }; });
  genSetup(bt, ['CAT', 'CATS', 'AT', 'TA']);
  const moves = sandbox._solverGenMoves({ S: 1 }, 0);
  eq('extension moves', moveKeys(moves), 'CATS@7,7h');
  eq('extension placements', moves[0].placements.length, 1); // only the S is new
}

// ── 12. Cross-check masks reject invalid cross words ─────────────────────────
{
  const bt = new Array(B * B).fill(null);
  'CAT'.split('').forEach((L, i) => { bt[7 * B + 7 + i] = { letter: L, isBlank: false }; });
  // TA is valid vertically through the A (T above it); TC through C is not a word
  genSetup(bt, ['CAT', 'TA']);
  const moves = sandbox._solverGenMoves({ T: 1 }, 0);
  eq('crossword moves', moveKeys(moves), 'TA@6,8v');
}

// ── 13. Blanks fill missing letters ──────────────────────────────────────────
{
  const bt = new Array(B * B).fill(null);
  'CAT'.split('').forEach((L, i) => { bt[7 * B + 7 + i] = { letter: L, isBlank: false }; });
  genSetup(bt, ['CAT', 'CATS']);
  const moves = sandbox._solverGenMoves({}, 1); // empty rack, one blank
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

console.log(failed ? '\n' + failed + ' test(s) FAILED' : '\nAll tests passed');
process.exit(failed ? 1 : 0);
