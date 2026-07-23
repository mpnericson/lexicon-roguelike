// =====================================================================
// SCORE ENGINE — pure scoring orchestrator
//
// runScoreEngine(input) computes the score of a play. It reads NO global
// game state and touches NO DOM: everything it needs arrives in `input`,
// everything it decides comes back in the result. All sticker/stamp behaviour
// lives in the sticker definitions (src/stickers/); the engine only
// controls the ORDER in which effects fire.
//
// input = {
//   tiles          BN array of tile objects — the full board, committed
//                  tiles with isNew:false, this play's tiles isNew:true.
//                  Jenga tops must be pre-merged over the tiles they cover.
//   newIdxs        optional array of indices of the new tiles (skips scan)
//   dir            optional 'h'|'v' (skips direction inference)
//   jengaTops      optional Set of indices holding stacked (Jenga) tiles —
//                  these never form cross-words
//   jengaUnder     optional map {sqIdx: {letter,isBlank,sc,variant}} of the
//                  committed tile buried under each stacked top — scored for
//                  its letter value (Jenga / Deep Roots)
//   jengaCrossIdxs optional array of stacked-top square indices whose (top)
//                  cross word is a VALID word (validity is decided by the
//                  caller, which owns the dictionary); only those jenga tops
//                  form a scoring cross word. The buried tile scores its value
//                  inside every word its square is part of.
//   boardStickers  BN array of board-sticker ids (S.board equivalent)
//   placed         board-sticker instances [{id, sqIdx, …}]
//   stamps         stamp instances, bar order (left → right)
//   bounties       active bounty list (available to sticker/stamp hooks)
//   preview        true → sticker/stamp hooks skip their commit side effects
//   state          plain values that influence scoring:
//     freeHandCount, constraint, usedLetters, stickersSold,
//     pendingBountyReward, drunkValid, magicStreak, drunkStreak, palMult,
//     playerMult, cartographerMult, bhMult, crossroadsCount, ouroborosBonus,
//     gamblerSpins, discardsLeft, discPressure, bagColouredCount,
//     handVowelCount
// }
//
// Bracket order:
//   PRE       1. tile-count mult bonus (4/5/6/7 tiles → +1/+1/+3/+7 mult,
//                i.e. total word mult 2/2/4/8)
//             2. tile-count letter bonus (1/2/3/4/5/6/7 tiles →
//                +2/+2/+4/+8/+16/+24/+48 letters; replaces the old bingo +50).
//                A starting bonus like the mult bonus; total is unchanged by
//                its bracket position since letters × mult is folded once.
//             3. board-sticker onPreScore per played square (e.g. Gilded)
//   PER TILE  for every tile of every word (cross words first):
//             1. base letter score (constraint-aware)
//             2. additive — board onTileAdd on this square, then additive
//                aura hooks, then stamp onPerTile hooks left → right
//             3. multiplicative — board onTileMult on this square
//                (DL/TL/DW/TW), then multiplicative aura hooks
//             4. retrigger — def.retrigger squares, then stamp onRetrigger
//                hooks left → right (Khoomiich). Retrigger passes re-run
//                brackets 1-3 (mult squares compound). Red tile rule: "if
//                this tile triggers for any reason, it triggers again" —
//                every pass, base or retrigger, is followed by one red
//                re-pass ((1 + retrigger passes) × 2 total on a red tile)
//   POST      1. gold-tile board sweep — every gold tile on the board pays
//                $1 (boardSweep, see below)
//             2. board onPostWordAdd, all placed instances
//             3. board onPostWordMult, all placed instances
//             4. stamp onPostWord, left → right — stamp bar order matters
//             5. bounty reward
//
// On-board effects (boardSweep) — POST-bracket effects that fire once for
// every tile of a certain type ON THE BOARD (committed and just-played
// alike), left → right, top → down. Red tile variants retrigger the firing
// for their tile. The engine's gold payout uses it directly; stamps (Yuan)
// call boardSweep(ctx, match, fire) from onPostWord so the sweep runs in
// stamp-bar order.
//   FINAL     total = round(letters × mult), then ctx.finalTransforms apply in
//             order (Palindrome Engine).
//
// The word MULT is folded SEQUENTIALLY, in the order effects fire (ctx.mult,
// starts at 1): a +mult adds to the running mult, a ×mult multiplies it. Order
// therefore matters — a +mult applied AFTER a ×mult (e.g. a post-word +mult
// stamp firing after the per-tile chess/DW ×mults) is added on top and is NOT
// retroactively multiplied by the earlier ×mults. This is implemented by
// intercepting ctx.plusMults.push / ctx.xmults.push (every mult source routes
// through them), so the sticker/stamp defs are untouched. plusMults[]/xmults[]
// are still returned as informational bucket totals but no longer combine as
// (1 + Σ plusMults) × Π xmults.
//
// ctx surface available to sticker/stamp hooks:
//   letters, plusMults[], xmults[], tgold, events[], scoredTiles[],
//   tiles (the full board, for boardSweep scans),
//   curWordTiles (the tiles of the word currently scoring, per-tile bracket),
//   newTileCount, crossWordCount, crossWords (the cross words as strings),
//   mainWord, state, stamps, placed,
//   boardStickers, bounties, preview, stickerLocked,
//   auras[], finalTransforms[] ({factor, label, tsId}), plus any fields
//   hooks set on ctx themselves (slotTransforms, springTraps, …).
//
// Auras — board stickers whose effect targets OTHER squares (chess pieces,
// row/column bonuses, …). Register in onBuildCtx:
// ctx.auras.push({squares, onTileAdd, onTileMult}). Every matching aura
// fires — overlapping auras stack.
//   squares     optional Set or array of square indices the aura covers;
//               omit it to have the hook evaluate every scored tile itself.
//   onTileAdd   fn(tile, ctx, ts, sqIdx) → ts — fires in the per-tile
//               additive bracket (e.g. "+3 letter score to tiles in my row")
//   onTileMult  fn(tile, ctx, ts, sqIdx) → ts — fires in the per-tile
//               multiplicative bracket (e.g. chess ×3)
// =====================================================================

// One scoring copy per square, shared by the main word and cross words so
// a hook that mutates a tile copy (e.g. Gilded) is seen by every pass.
function _engCopy(cache, tiles, idx, jengaTops) {
  if (cache[idx]) return cache[idx];
  var t = tiles[idx];
  if (!t) return null;
  var c = {
    idx: idx, row: Math.floor(idx / B), col: idx % B,
    letter: tileDisplayLetter(t), isNew: !!t.isNew, isBlank: !!t.isBlank,
    sc: t.isBlank ? (t._alchSc || 0) : (LS[t.letter] || 0),
    variant: t.variant || null,
    material: t.material || null,
    jengaTop: !!(jengaTops && jengaTops.has(idx))
  };
  cache[idx] = c;
  return c;
}

// Extract the full run of tiles through (ar, ac) in `dir`.
// Returns {word, tiles} or null if the run is a single tile.
function _engExtract(tiles, cache, jengaTops, ar, ac, dir) {
  var pos = dir === 'h' ? ac : ar, p;
  var lim = dir === 'h' ? B : BH; // cells along the run direction (cols for H, rows for V)
  while (pos > 0) { p = dir === 'h' ? ar * B + (pos - 1) : (pos - 1) * B + ac; if (tiles[p]) pos--; else break; }
  var start = pos;
  pos = dir === 'h' ? ac : ar;
  while (pos < lim - 1) { p = dir === 'h' ? ar * B + (pos + 1) : (pos + 1) * B + ac; if (tiles[p]) pos++; else break; }
  var end = pos;
  if (start === end) return null;
  var wt = [];
  for (var q = start; q <= end; q++) {
    var si = dir === 'h' ? ar * B + q : q * B + ac;
    var c = _engCopy(cache, tiles, si, jengaTops);
    if (!c) return null;
    wt.push(c);
  }
  return { word: wt.map(function (t) { return t.letter; }).join(''), tiles: wt };
}

// Tile-count (word-length) bonuses, shared by the engine, the live preview
// (scoring.js updateLivePreview) and the solver so the curve exists in one
// place. n = number of tiles played this turn.
//   mult delta:   4→+1, 5→+1, 6→+3, 7→+7  (total word mult 2/2/4/8)
//   letter bonus: 1→+2, 2→+2, 3→+4, 4→+8, 5→+16, 6→+24, 7→+48
//                 (replaces the old bingo +50)
// Both cap at the 7-tile value for any larger play (e.g. Jenga stacks).
function _lenMultBonus(n) {
  if (n >= 7) return 7;
  if (n === 6) return 3;
  if (n >= 4) return 1;
  return 0;
}
function _lenLetterBonus(n) {
  if (n >= 7) return 48;
  if (n === 6) return 24;
  if (n === 5) return 16;
  if (n === 4) return 8;
  if (n === 3) return 4;
  if (n === 2) return 2;
  if (n === 1) return 2;
  return 0;
}

function _engWordDir(tiles, nt) {
  if (!nt.length) return null;
  if (nt.length === 1) {
    var r = nt[0].row, c = nt[0].col;
    var hasV = !!((r > 0 && tiles[(r - 1) * B + c]) || (r < BH - 1 && tiles[(r + 1) * B + c]));
    var hasH = !!((c > 0 && tiles[r * B + (c - 1)]) || (c < B - 1 && tiles[r * B + (c + 1)]));
    if (hasV && !hasH) return 'v';
    return 'h';
  }
  var rows = {}, cols = {};
  for (var i = 0; i < nt.length; i++) { rows[nt[i].row] = 1; cols[nt[i].col] = 1; }
  if (Object.keys(rows).length === 1) return 'h';
  if (Object.keys(cols).length === 1) return 'v';
  return null;
}

// Which stacked (Jenga) squares form a valid cross word. The stacked TOP tile
// forms the cross word (its letter is what shows on the board — `tiles` already
// has the top merged in), exactly like a normal new tile; jenga tops are only
// special in that an invalid cross word doesn't reject the play, so the caller
// filters to the valid ones here. The buried tile then scores its value inside
// that word (handled in runScoreEngine). Shared by live play (scoring.js
// _jengaCrossIdxs) and the solver so validity can't drift.
// jengaTops is a Set (or array) of stacked-top square indices.
// Returns an array of square indices (for input.jengaCrossIdxs) or null.
function _engJengaCrossIdxs(tiles, jengaTops, dir, hasWord) {
  if (!jengaTops) return null;
  var cx = dir === 'h' ? 'v' : 'h', out = [];
  var list = jengaTops.forEach ? [] : jengaTops;
  if (jengaTops.forEach) jengaTops.forEach(function (i) { list.push(i); });
  for (var n = 0; n < list.length; n++) {
    var idx = list[n];
    var cw = _engExtract(tiles, {}, null, Math.floor(idx / B), idx % B, cx);
    if (cw && cw.tiles.length >= 2 && hasWord(cw.word)) out.push(idx);
  }
  return out.length ? out : null;
}

// Canonical identifier for a word: its sorted tile-index list. Shared by the
// engine (word doubling) and the callers that decide which words qualify
// (Mirror), so the key can't drift between where it's computed and matched.
function _engWordKey(wt) {
  var a = [];
  for (var i = 0; i < wt.length; i++) a.push(wt[i].idx);
  a.sort(function (x, y) { return x - y; });
  return a.join(',');
}

// Which words (main + cross, ≥2 tiles) are valid read BACKWARDS too — these
// score a second time under Mirror. Pure: the caller owns the dictionary and
// passes it as hasWord(word)→bool. Returns a Set of _engWordKey values (or
// null). Palindromes qualify automatically (their reverse is the same word,
// already valid). Jenga tops don't form cross words, same rule as scoring.
// Shared by live play (scoring.js) and the solver so the two can't disagree.
function _engMirrorWords(tiles, newIdxs, dir, jengaTops, hasWord) {
  if (!newIdxs || !newIdxs.length) return null;
  var cache = {}, set = new Set();
  function _has(s, i) { return s ? (s.has ? s.has(i) : s.indexOf(i) >= 0) : false; }
  function chk(word, wt) {
    var rev = word.split('').reverse().join('');
    if (hasWord(rev)) set.add(_engWordKey(wt));
  }
  var main = _engExtract(tiles, cache, jengaTops, Math.floor(newIdxs[0] / B), newIdxs[0] % B, dir);
  if (!main) return null;
  chk(main.word, main.tiles);
  var cx = dir === 'h' ? 'v' : 'h', seen = {};
  for (var i = 0; i < newIdxs.length; i++) {
    var idx = newIdxs[i], r = Math.floor(idx / B), c = idx % B, k = r + ',' + c;
    if (seen[k]) continue;
    seen[k] = 1;
    if (_has(jengaTops, idx)) continue;
    var cw = _engExtract(tiles, cache, jengaTops, r, c, cx);
    if (cw && cw.tiles.length >= 2) chk(cw.word, cw.tiles);
  }
  return set.size ? set : null;
}

// Score the tile buried under a Jenga stack (fresh top this turn OR a committed
// stack from a previous play — both live in jengaUnder) for its letter value
// inside the word currently being scored, tagging its events with the slide
// axis so the animation can reveal it. Fires once per word the square is in.
function _engScoreBuried(tile, ctx, jengaUnder, axis) {
  if (!jengaUnder || !jengaUnder[tile.idx]) return;
  var u = jengaUnder[tile.idx];
  _engScoreTile({
    idx: tile.idx, row: tile.row, col: tile.col, letter: u.letter,
    isBlank: u.isBlank, sc: u.sc, variant: u.variant || null,
    material: u.material || null, isNew: false,
    jengaUnder: true, jengaAxis: axis
  }, ctx);
}

// True when an aura covers sqIdx (auras without a squares list evaluate
// every tile themselves).
function _engAuraHits(aura, sqIdx) {
  if (!aura.squares) return true;
  if (aura.squares.has) return aura.squares.has(sqIdx);
  return aura.squares.indexOf(sqIdx) >= 0;
}

// ---- Per-tile pass (brackets 1-4) ----
// ts = tile's running score coming in (0 on first pass, current value on
// retrigger). Returns updated tile score. Does NOT touch ctx.letters.

// retrigFloat (optional): stamp id to attach to this pass's base-letter event
// so the stamp bounces on the tile's re-score bounce (Khoomiich), not a beat
// earlier on the retrigger announce event. retrigInst is that stamp's index
// in ctx.stamps, so the right copy bounces when the stamp is owned twice.
function _engTilePasses(tile, ctx, ts, skipRetrigger, retrigFloat, retrigInst) {
  var sqIdx = tile.idx;
  var sid = ctx.boardStickers[sqIdx];
  var def = sid ? sqd(sid) : null;
  // Per-square sticker effects fire only for the tile PLAYED on this square
  // this turn (isNew) — a committed tile crossing the square never re-fires
  // them. This replaces the old per-board cooldown set: a square that frees
  // up again (glass retrieve, Worm Hole, Spring Trap) simply catches the
  // next tile played on it, and a Jenga top stacked onto a sticker square
  // re-fires it (it IS a tile played on the square).
  var sqActive = !!tile.isNew;
  // Jenga buried tile: scores its letter value + variant + stamp per-tile
  // hooks, but the square's own sticker/auras already fired for the top tile,
  // so they are skipped here (no double-dip on DL/TL/chess/etc).
  var ju = tile.jengaUnder;

  // 1. Base letter score
  var baseSc = tile.isBlank ? (tile.sc || 0) : (LS[tile.letter] || 0);
  var _letterUsed = !tile.isBlank && tile.letter && ctx.state.constraint === 'c_letters'
    && ctx.state.usedLetters && ctx.state.usedLetters.has(tile.letter);
  if (_letterUsed) baseSc = 0;
  ts += baseSc;
  var _baseEv = {type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,
    label:tile.letter+(tile.isBlank?' (blank)':'')+(_letterUsed?' (used-0)':'')};
  if (retrigFloat) { _baseEv.floatStampId = retrigFloat; if (retrigInst != null) _baseEv._stampInst = retrigInst; }
  ctx.events.push(_baseEv);

  // 2. Additive — colour bonuses (game mechanics, fire every pass like base
  // letters, so retriggers re-fire them)
  if (tile.variant === 'blue') {
    ts += 10;
    ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'Blue +10'});
  }
  if (tile.variant === 'red') {
    ctx.plusMults.push(4);
    ctx.events.push({type:'plus-mult',delta:4,sqIdx:sqIdx,label:'Red +4 mult'});
  }

  // 2. Additive — board sticker on this square (new-tile-gated)
  if (sqActive && def && def.onTileAdd && !ctx.stickerLocked && !ju) {
    ts = def.onTileAdd(tile, ctx, ts, baseSc, sqIdx);
  }
  // 2. Additive — aura hooks (board stickers acting at range)
  if (!ju) for (var aai = 0; aai < ctx.auras.length; aai++) {
    var aau = ctx.auras[aai];
    if (aau.onTileAdd && _engAuraHits(aau, sqIdx)) ts = aau.onTileAdd(tile, ctx, ts, sqIdx);
  }
  // 2. Additive — stamps, left → right. Each copy of a stamp is its own
  // trigger: events pushed during a hook call are tagged with the instance
  // index (_stampInst), so the animation gives every copy its own beat and
  // bounces the right bar face (two copies must not share a float key).
  // ctx._stampIdx exposes the firing instance's index to the hook itself
  // (Cartographer keys its per-square dedupe on it).
  if (!ctx.stickerLocked) {
    for (var hi = 0; hi < ctx.stamps.length; hi++) {
      var hd = sqd(ctx.stamps[hi].id);
      if (!hd || !hd.onPerTile) continue;
      var _ptEv = ctx.events.length;
      ctx._stampIdx = hi;
      ts = hd.onPerTile(tile, ctx, ts, ctx.stamps[hi]);
      for (; _ptEv < ctx.events.length; _ptEv++)
        if (ctx.events[_ptEv]._stampInst == null) ctx.events[_ptEv]._stampInst = hi;
    }
    ctx._stampIdx = null;
  }

  // 3. Multiplicative — board sticker on this square (DL/TL/DW/TW). Runs on
  // every pass, so retriggers compound mult squares — the balance lever is
  // DW/TW rarity and cost, not the engine.
  if (sqActive && def && def.onTileMult && !ctx.stickerLocked && !ju) {
    ts = def.onTileMult(tile, ctx, ts, sqIdx);
  }
  // 3. Multiplicative — aura hooks (board stickers acting at range)
  if (!ju) for (var ami = 0; ami < ctx.auras.length; ami++) {
    var amu = ctx.auras[ami];
    if (amu.onTileMult && _engAuraHits(amu, sqIdx)) ts = amu.onTileMult(tile, ctx, ts, sqIdx);
  }
  // 3. Multiplicative — purple: ×2 word mult every pass; each scored purple
  // square is recorded so the commit path can roll its 1-in-4 vanish (the
  // engine stays pure — no RNG here, preview/solver just see the ×2).
  if (tile.variant === 'purple') {
    ctx.xmults.push(2);
    ctx.events.push({type:'x-mult',factor:2,sqIdx:sqIdx,label:'Purple ×2'});
    if (!ju) ctx.purpleScored.add(sqIdx);
  }

  // 4. Retrigger — continues from current ts, does NOT reset to 0.
  // Metallic tile rule: "if this tile triggers for any reason, it triggers
  // again" — the base pass and every retrigger source's pass is each followed
  // by a metallic re-pass, so a metallic tile runs (1 + retrigger passes) × 2
  // total. (Formerly the red rule; red is now +4 mult.)
  if (!skipRetrigger) {
    var _isMet = tile.material === 'metallic';
    var _redouble = function () {
      if (!_isMet) return;
      ctx.events.push({type:'retrigger',sqIdx:sqIdx,label:'Metallic'});
      ts = _engTilePasses(tile, ctx, ts, true);
    };
    _redouble(); // metallic doubles the base pass
    if (sqActive && def && def.retrigger && !ctx.stickerLocked && !ju) {
      ctx.events.push({type:'retrigger',sqIdx:sqIdx,label:def.name,floatSqIdx:sqIdx});
      ts = _engTilePasses(tile, ctx, ts, true);
      _redouble();
    }
    // Stamp-driven retriggers (Khoomiich), left → right. onRetrigger returns
    // how many extra times this tile should re-score.
    if (!ctx.stickerLocked) {
      for (var _sri = 0; _sri < ctx.stamps.length; _sri++) {
        var _srd = sqd(ctx.stamps[_sri].id);
        if (!_srd || !_srd.onRetrigger) continue;
        var _srn = _srd.onRetrigger(tile, ctx, ctx.stamps[_sri]) || 0;
        for (var _srj = 0; _srj < _srn; _srj++) {
          // Announce event binks the tile only; the stamp bounce rides the
          // re-score pass's base-letter event so it lands with the score bump.
          ctx.events.push({type:'retrigger',sqIdx:sqIdx,label:_srd.name});
          ts = _engTilePasses(tile, ctx, ts, true, ctx.stamps[_sri].id, _sri);
          _redouble();
        }
      }
    }
  }
  return ts;
}

// ---- On-board sweep (POST bracket) ----
// Shared driver for "on-board" effects: fire(tile, sqIdx) runs once for every
// tile on the board that match(tile) accepts — committed and just-played
// alike — left → right, top → down (index order). ctx.boardRetriggers
// (registered in onBuildCtx by The Eagle, +1 per copy) adds that many extra
// triggerings per tile. Every triggering routes through _sweepTrigger, where
// the red-tile rule lives: "if this tile triggers for any reason, it triggers
// again" — so red doubles the base firing AND each Eagle repeat
// ((1 + eagles) × 2 firings for a red tile). fire() pushes its own events,
// one per firing, so each tile bounces individually in the score animation.
// Used by the engine's gold-tile payout and by stamps (Yuan) inside
// onPostWord, which keeps stamp-bar order.
function _sweepTrigger(ctx, t, i, fire) {
  fire(t, i);
  if (t.material === 'metallic') {
    ctx.events.push({type:'retrigger',sqIdx:i,label:'Metallic'});
    fire(t, i);
  }
}
function boardSweep(ctx, match, fire) {
  var extra = ctx.boardRetriggers || 0;
  for (var i = 0; i < ctx.tiles.length; i++) {
    var t = ctx.tiles[i];
    if (!t || !match(t)) continue;
    _sweepTrigger(ctx, t, i, fire);
    for (var r = 0; r < extra; r++) {
      ctx.events.push({type:'retrigger',sqIdx:i,label:'The Eagle',floatStampId:'the_eagle'});
      _sweepTrigger(ctx, t, i, fire);
    }
  }
}

// Runs all passes for one tile, then adds the completed tile score to
// ctx.letters once. Also handles the animation-sync event bookkeeping.
function _engScoreTile(tile, ctx) {
  // Jenga buried tiles contribute letter value but don't count toward
  // word-composition checks (Scholar/Aristocrat read ctx.scoredTiles).
  if (!tile.jengaUnder) ctx.scoredTiles.push(tile);
  var _startEvt = ctx.events.length;
  var ts = _engTilePasses(tile, ctx, 0, false);
  // If bracket 1 has subsequent tile-local sticker effects, suppress its pop/bounce/ding
  var _hasLater = false;
  for (var _ei = _startEvt + 1; _ei < ctx.events.length; _ei++) { if (ctx.events[_ei].isTileLocal) { _hasLater = true; break; } }
  if (_hasLater) ctx.events[_startEvt].suppressVisual = true;
  ctx.letters += ts;
  // Tag the last isTileLocal event with the global running total so the
  // animation can sync saL at the same frame as the tile bink.
  for (var _li = ctx.events.length - 1; _li >= _startEvt; _li--) {
    if (ctx.events[_li].isTileLocal) { ctx.events[_li]._globalLetters = ctx.letters; break; }
  }
  ctx.events.push({type:'letter',lettersAfter:ctx.letters,isSilent:true});
  // Tag every event this buried tile produced so the animation can slide the
  // Jenga top aside (along jengaAxis) to reveal it while it scores.
  if (tile.jengaUnder) {
    for (var _je = _startEvt; _je < ctx.events.length; _je++) {
      ctx.events[_je].jengaUnder = true;
      if (tile.jengaAxis) ctx.events[_je].jengaSlideAxis = tile.jengaAxis;
    }
  }
}

// ---- Main entry point ----
// Returns {total, tgold, events, mainWord, bingo, letters, plusMults,
// xmults, mult, allWords, crossWordCount, springTraps, slotTransforms,
// wormholes, photocopies}
// or null if no legal word can be derived from the new tiles.

function runScoreEngine(input) {
  var tiles = input.tiles;
  var jengaTops = input.jengaTops || null;
  var cache = {};

  var ntIdxs = input.newIdxs;
  if (!ntIdxs) {
    ntIdxs = [];
    for (var si = 0; si < BN; si++) if (tiles[si] && tiles[si].isNew) ntIdxs.push(si);
  }
  if (!ntIdxs.length) return null;
  var nt = [];
  for (var ni = 0; ni < ntIdxs.length; ni++) {
    var nc = _engCopy(cache, tiles, ntIdxs[ni], jengaTops);
    if (nc) nt.push(nc);
  }
  var dir = input.dir || _engWordDir(tiles, nt);
  if (!dir) return null;
  var main = _engExtract(tiles, cache, jengaTops, nt[0].row, nt[0].col, dir);
  if (!main) return null;

  // Cross words. Each new tile — including a Jenga top — forms a cross word in
  // the cross direction from the merged board (`tiles` already has tops on top),
  // exactly like normal play. A jenga top's cross word is only kept when the
  // caller flagged it valid (input.jengaCrossIdxs), since an invalid one must
  // not reject the play. The tile buried under each jenga top then scores its
  // value inside the cross word (see the per-word loop below).
  var cx = dir === 'h' ? 'v' : 'h', crossWords = [], seenCw = {};
  var jengaCrossSet = input.jengaCrossIdxs && input.jengaCrossIdxs.length ? input.jengaCrossIdxs : null;
  for (var ci = 0; ci < nt.length; ci++) {
    var k = nt[ci].row + ',' + nt[ci].col;
    if (seenCw[k]) continue;
    seenCw[k] = 1;
    if (nt[ci].jengaTop && !(jengaCrossSet && jengaCrossSet.indexOf(nt[ci].idx) >= 0)) continue;
    var cw = _engExtract(tiles, cache, jengaTops, nt[ci].row, nt[ci].col, cx);
    if (cw && cw.tiles.length >= 2) crossWords.push(cw);
  }

  var state = input.state || {};
  var ctx = {
    letters: 0, plusMults: [], xmults: [], tgold: 0, events: [],
    scoredTiles: [], tiles: tiles,
    purpleScored: new Set(),
    mainWord: main.word, newTileCount: nt.length, crossWordCount: crossWords.length,
    crossWords: crossWords.map(function (c) { return c.word; }),
    state: state,
    stamps: input.stamps || [], placed: input.placed || [],
    boardStickers: input.boardStickers || [],
    bounties: input.bounties || [],
    preview: !!input.preview,
    auras: [], finalTransforms: [],
    _freeHandCount: state.freeHandCount || 0,
    stickerLocked: state.constraint === 'c_stickers' && !state.stickersSold // disables stickers AND stamps
  };

  // Sequential mult fold. The word multiplier is a single running value that
  // starts at 1 and is updated IN THE ORDER effects fire: a +mult adds, a ×mult
  // multiplies. Crucially, a +mult applied AFTER a ×mult (e.g. a post-word stamp
  // like Sesquipedalian firing after the chess ×4s) is added on top — it is NOT
  // retroactively multiplied by the earlier ×mults. Every mult source in the
  // game routes through these two arrays' push, so intercepting push here makes
  // the whole engine order-dependent without touching any sticker/stamp def.
  // (plusMults/xmults still collect their raw values for the return payload.)
  ctx.mult = 1;
  ctx.plusMults.push = function(d){ ctx.mult += d; return Array.prototype.push.call(this, d); };
  ctx.xmults.push = function(f){ ctx.mult *= f; return Array.prototype.push.call(this, f); };

  // onBuildCtx — board stickers register auras/flags, then stamps
  if (!ctx.stickerLocked) {
    for (var bci = 0; bci < ctx.placed.length; bci++) {
      var bcd = sqd(ctx.placed[bci].id);
      if (bcd && bcd.onBuildCtx) bcd.onBuildCtx(ctx, ctx.placed[bci]);
    }
    for (var hci = 0; hci < ctx.stamps.length; hci++) {
      var hcd = sqd(ctx.stamps[hci].id);
      if (hcd && hcd.onBuildCtx) hcd.onBuildCtx(ctx, ctx.stamps[hci]);
    }
  }

  // ---- PRE ----
  // 1. Tile-count mult bonus — always first (4/5/6/7 → +1/+1/+3/+7 mult)
  if (ctx.newTileCount >= 4) {
    var _tcb = _lenMultBonus(ctx.newTileCount);
    ctx.plusMults.push(_tcb);
    ctx.events.push({type:'plus-mult',delta:_tcb,label:ctx.newTileCount+' tiles +'+_tcb+' mult',silent:true});
  }
  // 2. Tile-count letter bonus — a starting bonus applied here alongside the
  // mult bonus (1/2/3/4/5/6/7 tiles → +2/+2/+4/+8/+16/+24/+48 letters). The word
  // mult is folded once in FINAL, so the total is independent of where in the
  // brackets these letters are added; front-loading it just matches the mult
  // bonus. Emitted as isSilent (a no-beat display sync, like the per-tile letter
  // syncs) — runScoreAnim seeds the Letters counter with it so the bonus carries
  // over from the live preview instead of blinking 0 → bonus when scoring starts.
  // Replaces the old bingo +50.
  var _tlb = _lenLetterBonus(ctx.newTileCount);
  if (_tlb) {
    ctx.letters += _tlb;
    ctx.events.push({type:'letter',lettersAfter:ctx.letters,isSilent:true});
  }
  // 3. Board-sticker pre hooks on played squares (e.g. Gilded)
  if (!ctx.stickerLocked) {
    for (var pri = 0; pri < nt.length; pri++) {
      var pIdx = nt[pri].idx, pSid = ctx.boardStickers[pIdx];
      if (!pSid) continue;
      var pDef = sqd(pSid);
      if (!pDef || !pDef.onPreScore) continue;
      // PRE hooks fire only on tiles placed THIS turn (nt) by construction.
      pDef.onPreScore(nt[pri], ctx, pIdx);
    }
  }

  var bingo = nt.length > 0 && ctx._freeHandCount === 0;

  // ---- PER TILE — cross words first, then the main word ----
  // Mirror: a word valid in both directions scores a SECOND time immediately
  // after its first pass. mirrorWords (from the caller, which owns the
  // dictionary) is the Set of qualifying word keys; here we just repeat the
  // per-tile pass for those words. The reversed word is display-only.
  var mirrorSet = input.mirrorWords || null;
  function _engScoreWord(wt, word, buriedAxis) {
    ctx.curWordTiles = wt; // the word now scoring — per-tile hooks can target it (Slot Machine jackpot)
    var reps = (mirrorSet && mirrorSet.has(_engWordKey(wt))) ? 2 : 1;
    for (var rp = 0; rp < reps; rp++) {
      if (rp > 0) ctx.events.push({ type: 'retrigger',
        label: 'Mirror ' + word.split('').reverse().join(''), floatStampId: 'mirror' });
      for (var ti = 0; ti < wt.length; ti++) {
        _engScoreTile(wt[ti], ctx);
        _engScoreBuried(wt[ti], ctx, input.jengaUnder, buriedAxis);
      }
    }
  }
  for (var cwi = 0; cwi < crossWords.length; cwi++) {
    if (!ctx.stickerLocked) {
      for (var cbi = 0; cbi < ctx.stamps.length; cbi++) {
        var cbd = sqd(ctx.stamps[cbi].id);
        if (!cbd || !cbd.onCrossword) continue;
        var _cwEv = ctx.events.length;
        cbd.onCrossword(ctx, ctx.stamps[cbi]);
        for (; _cwEv < ctx.events.length; _cwEv++)
          if (ctx.events[_cwEv]._stampInst == null) ctx.events[_cwEv]._stampInst = cbi;
      }
    }
    // Jenga: the buried tile scores inside the cross word; its top slides along
    // the MAIN-word axis (dir) to reveal it.
    _engScoreWord(crossWords[cwi].tiles, crossWords[cwi].word, dir);
  }
  // Jenga (Deep Roots): the buried tile scores in the main word; its top slides
  // along the CROSS axis (cx) to reveal it.
  _engScoreWord(main.tiles, main.word, cx);

  // ---- POST ----
  // (The tile-count letter bonus is applied in PRE, alongside the mult bonus.
  // The `bingo` boolean above still drives the "use all 7 tiles" achievement.)
  // 1. Gold tiles — every gold tile on the board pays $1 (game mechanic,
  // like bingo: not gated by stickerLocked). Metallic gold tiles pay twice.
  boardSweep(ctx, function(t){ return t.variant === 'gold'; }, function(t, gi){
    ctx.tgold++;
    ctx.events.push({type:'gold',delta:1,sqIdx:gi,label:'Gold tile +$1'});
  });
  // 1b. Jade tiles — every jade tile on the board gives ×1.5 mult, every play
  // (same shape as a Y under Yuan; metallic jade fires twice per sweep).
  boardSweep(ctx, function(t){ return t.variant === 'jade'; }, function(t, ji){
    ctx.xmults.push(1.5);
    ctx.events.push({type:'x-mult',factor:1.5,sqIdx:ji,label:'Jade ×1.5'});
  });
  if (!ctx.stickerLocked) {
    // 2. Board stickers — additive effects
    for (var pai = 0; pai < ctx.placed.length; pai++) {
      var pad = sqd(ctx.placed[pai].id);
      if (pad && pad.onPostWordAdd) pad.onPostWordAdd(main.word, main.tiles, ctx, ctx.placed[pai]);
    }
    // 3. Board stickers — multiplicative effects
    for (var pmi = 0; pmi < ctx.placed.length; pmi++) {
      var pmd = sqd(ctx.placed[pmi].id);
      if (pmd && pmd.onPostWordMult) pmd.onPostWordMult(main.word, main.tiles, ctx, ctx.placed[pmi]);
    }
    // 4. Stamps — left → right, each fires all its effects in turn. Every
    // event a hook pushes is tagged with the instance index (_stampInst) so
    // two copies of the same stamp keep separate animation beats and each
    // bounces its own bar face, in bar order.
    for (var hwi = 0; hwi < ctx.stamps.length; hwi++) {
      var hwd = sqd(ctx.stamps[hwi].id);
      if (hwd && hwd.onPostWord) {
        var _evStart = ctx.events.length;
        ctx._stampIdx = hwi;
        hwd.onPostWord(main.word, main.tiles, ctx, ctx.stamps[hwi]);
        for (var evi = _evStart; evi < ctx.events.length; evi++) {
          var tev = ctx.events[evi];
          if ((tev.type==='letter'||tev.type==='plus-mult'||tev.type==='x-mult'||tev.type==='gold')
            && tev.floatSqIdx == null && tev.floatStampId == null) tev.floatStampId = ctx.stamps[hwi].id;
          if (tev._stampInst == null) tev._stampInst = hwi;
        }
      }
    }
    ctx._stampIdx = null;
  }
  // 5. Bounty reward — applied last so it multiplies everything. Count is the
  // number of bounty scrolls completed this play (each applies its own reward).
  if (state.pendingBountyReward && !ctx.preview) {
    var _bqty = (typeof state.pendingBountyReward === 'number') ? state.pendingBountyReward : 1;
    for (var _bq = 0; _bq < _bqty; _bq++) applyBountyReward(ctx);
  }

  // ---- FINAL ----
  // mult was already folded sequentially as each effect fired (ctx.mult). plusSum
  // / xprod are retained only as informational bucket totals for the payload — in
  // the sequential model they no longer combine as (1+plusSum)×xprod.
  var plusSum = 0; for (var psi = 0; psi < ctx.plusMults.length; psi++) plusSum += ctx.plusMults[psi];
  var xprod = 1; for (var xpi = 0; xpi < ctx.xmults.length; xpi++) xprod *= ctx.xmults[xpi];
  var mult = ctx.mult;
  var total = Math.round(ctx.letters * mult);
  var displayMult = mult;
  for (var fti = 0; fti < ctx.finalTransforms.length; fti++) {
    var tr = ctx.finalTransforms[fti];
    total = Math.round(total * tr.factor);
    displayMult *= tr.factor;
    ctx.events.push({type:'final-transform',label:tr.label,total:total,palMult:tr.factor,floatStampId:tr.tsId});
  }
  ctx.events.push({type:'final',letters:ctx.letters,plusSum:plusSum,xprod:xprod,mult:mult,displayMult:displayMult,total:total});

  var allWords = [main.word];
  for (var awi = 0; awi < crossWords.length; awi++) allWords.push(crossWords[awi].word);

  return {
    total: total, tgold: ctx.tgold, events: ctx.events,
    mainWord: main.word, bingo: bingo,
    letters: ctx.letters, plusMults: ctx.plusMults, xmults: ctx.xmults, mult: mult,
    allWords: allWords, crossWordCount: crossWords.length,
    springTraps: ctx.springTraps || [],
    slotTransforms: ctx.slotTransforms || [],
    wormholes: ctx.wormholes || [],
    photocopies: ctx.photocopies || [],
    purpleScored: Array.from(ctx.purpleScored)
  };
}
