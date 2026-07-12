// =====================================================================
// SCORE ENGINE — pure scoring orchestrator
//
// runScoreEngine(input) computes the score of a play. It reads NO global
// game state and touches NO DOM: everything it needs arrives in `input`,
// everything it decides comes back in the result. All sticker behaviour
// lives in the sticker definitions (src/stickers/); the engine only
// controls the ORDER in which effects fire.
//
// input = {
//   tiles          B*B array of tile objects — the full board, committed
//                  tiles with isNew:false, this play's tiles isNew:true.
//                  Jenga tops must be pre-merged over the tiles they cover.
//   newIdxs        optional array of indices of the new tiles (skips scan)
//   dir            optional 'h'|'v' (skips direction inference)
//   jengaTops      optional Set of indices holding stacked (Jenga) tiles —
//                  these never form cross-words
//   boardStickers  B*B array of board-sticker ids (S.board equivalent)
//   placed         board-sticker instances [{id, sqIdx, …}]
//   hotbar         tile-sticker instances, hotbar order (left → right)
//   cooldowns      Set of square indices already used this stage
//   bounties       active bounty list (available to sticker hooks)
//   preview        true → sticker hooks skip their commit side effects
//   state          plain values that influence scoring:
//     freeHandCount, constraint, usedLetters, stickersSold,
//     pendingBountyReward, drunkValid, magicStreak, drunkStreak, palMult,
//     playerMult, bhMult, crossroadsCount, discPressure, bagColouredCount
// }
//
// Bracket order:
//   PRE       1. tile-count bonus (+1 mult per tile beyond 3)
//             2. board-sticker onPreScore per played square (e.g. Gilded)
//   PER TILE  for every tile of every word (cross words first):
//             1. base letter score (constraint-aware)
//             2. additive — board onTileAdd on this square, then additive
//                aura hooks, then gold-tile +$1, then hotbar onPerTile
//                hooks left → right
//             3. multiplicative — board onTileMult on this square
//                (DL/TL/DW/TW), then multiplicative aura hooks
//             4. retrigger — def.retrigger squares, then red tile variant
//   POST      1. bingo +50
//             2. board onPostWordAdd, all placed instances
//             3. board onPostWordMult, all placed instances
//             4. hotbar onPostWord, left → right — hotbar order matters
//             5. bounty reward
//   FINAL     total = round(letters × (1 + Σ plusMults) × Π xmults),
//             then ctx.finalTransforms apply in order (Palindrome Engine)
//
// ctx surface available to sticker hooks:
//   letters, plusMults[], xmults[], tgold, events[], scoredTiles[],
//   newTileCount, crossWordCount, mainWord, state, hotbar, placed,
//   boardStickers, cooldowns, bounties, preview, stickerLocked,
//   auras[], finalTransforms[] ({factor, label, tsId}), plus any fields
//   hooks set on ctx themselves (purist, slotRoll, springTraps, …).
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
    jengaTop: !!(jengaTops && jengaTops.has(idx))
  };
  cache[idx] = c;
  return c;
}

// Extract the full run of tiles through (ar, ac) in `dir`.
// Returns {word, tiles} or null if the run is a single tile.
function _engExtract(tiles, cache, jengaTops, ar, ac, dir) {
  var pos = dir === 'h' ? ac : ar, p;
  while (pos > 0) { p = dir === 'h' ? ar * B + (pos - 1) : (pos - 1) * B + ac; if (tiles[p]) pos--; else break; }
  var start = pos;
  pos = dir === 'h' ? ac : ar;
  while (pos < B - 1) { p = dir === 'h' ? ar * B + (pos + 1) : (pos + 1) * B + ac; if (tiles[p]) pos++; else break; }
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

function _engWordDir(tiles, nt) {
  if (!nt.length) return null;
  if (nt.length === 1) {
    var r = nt[0].row, c = nt[0].col;
    var hasV = !!((r > 0 && tiles[(r - 1) * B + c]) || (r < B - 1 && tiles[(r + 1) * B + c]));
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

function _engTilePasses(tile, ctx, ts, skipRetrigger) {
  var sqIdx = tile.idx;
  var sid = ctx.boardStickers[sqIdx];
  var def = sid ? sqd(sid) : null;
  var sqActive = !ctx.cooldowns.has(sqIdx);

  // 1. Base letter score
  var baseSc = tile.isBlank ? (tile.sc || 0) : (LS[tile.letter] || 0);
  var _letterUsed = !tile.isBlank && tile.letter && ctx.state.constraint === 'c_letters'
    && ctx.state.usedLetters && ctx.state.usedLetters.has(tile.letter);
  if (_letterUsed) baseSc = 0;
  ts += baseSc;
  ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,
    label:tile.letter+(tile.isBlank?' (blank)':'')+(_letterUsed?' (used-0)':'')});

  // 2. Additive — board sticker on this square (cooldown-gated)
  if (sqActive && def && def.onTileAdd && !ctx.stickerLocked) {
    ctx._stickerActed = false;
    var _prevEvLen = ctx.events.length;
    ts = def.onTileAdd(tile, ctx, ts, baseSc, sqIdx);
    if (!ctx.preview && (ctx.events.length > _prevEvLen || ctx._stickerActed)) ctx.activatedSqs.add(sqIdx);
  }
  // 2. Additive — aura hooks (board stickers acting at range)
  for (var aai = 0; aai < ctx.auras.length; aai++) {
    var aau = ctx.auras[aai];
    if (aau.onTileAdd && _engAuraHits(aau, sqIdx)) ts = aau.onTileAdd(tile, ctx, ts, sqIdx);
  }
  // 2. Additive — gold tile variant
  if (tile.variant === 'gold') {
    ctx.tgold++;
    ctx.events.push({type:'gold',delta:1,sqIdx:sqIdx,label:'Gold tile +$1'});
  }
  // 2. Additive — hotbar stickers, left → right
  if (!ctx.stickerLocked) {
    for (var hi = 0; hi < ctx.hotbar.length; hi++) {
      var hd = sqd(ctx.hotbar[hi].id);
      if (hd && hd.onPerTile) ts = hd.onPerTile(tile, ctx, ts, ctx.hotbar[hi]);
    }
  }

  // 3. Multiplicative — board sticker on this square (DL/TL/DW/TW)
  if (sqActive && def && def.onTileMult && !ctx.stickerLocked) {
    ts = def.onTileMult(tile, ctx, ts, sqIdx);
    if (!ctx.preview) ctx.activatedSqs.add(sqIdx);
  }
  // 3. Multiplicative — aura hooks (board stickers acting at range)
  for (var ami = 0; ami < ctx.auras.length; ami++) {
    var amu = ctx.auras[ami];
    if (amu.onTileMult && _engAuraHits(amu, sqIdx)) ts = amu.onTileMult(tile, ctx, ts, sqIdx);
  }

  // 4. Retrigger — continues from current ts, does NOT reset to 0
  if (!skipRetrigger) {
    if (sqActive && def && def.retrigger && !ctx.stickerLocked) {
      if (!ctx.preview) ctx.activatedSqs.add(sqIdx);
      ctx.events.push({type:'retrigger',sqIdx:sqIdx,label:def.name,floatSqIdx:sqIdx});
      ts = _engTilePasses(tile, ctx, ts, true);
    }
    if (tile.variant === 'red') {
      ctx.events.push({type:'retrigger',sqIdx:sqIdx,label:'Red'});
      ts = _engTilePasses(tile, ctx, ts, true);
    }
  }
  return ts;
}

// Runs all passes for one tile, then adds the completed tile score to
// ctx.letters once. Also handles the animation-sync event bookkeeping.
function _engScoreTile(tile, ctx) {
  ctx.scoredTiles.push(tile);
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
}

// ---- Main entry point ----
// Returns {total, tgold, events, mainWord, bingo, letters, plusMults,
// xmults, mult, allWords, crossWordCount, springTraps, activatedSqs}
// or null if no legal word can be derived from the new tiles.

function runScoreEngine(input) {
  var tiles = input.tiles;
  var jengaTops = input.jengaTops || null;
  var cache = {};

  var ntIdxs = input.newIdxs;
  if (!ntIdxs) {
    ntIdxs = [];
    for (var si = 0; si < B * B; si++) if (tiles[si] && tiles[si].isNew) ntIdxs.push(si);
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

  // Cross words (Jenga tops sit on existing words — no new cross-word)
  var cx = dir === 'h' ? 'v' : 'h', crossWords = [], seenCw = {};
  for (var ci = 0; ci < nt.length; ci++) {
    var k = nt[ci].row + ',' + nt[ci].col;
    if (seenCw[k]) continue;
    seenCw[k] = 1;
    if (nt[ci].jengaTop) continue;
    var cw = _engExtract(tiles, cache, jengaTops, nt[ci].row, nt[ci].col, cx);
    if (cw && cw.tiles.length >= 2) crossWords.push(cw);
  }

  var state = input.state || {};
  var ctx = {
    letters: 0, plusMults: [], xmults: [], tgold: 0, events: [],
    activatedSqs: new Set(), scoredTiles: [],
    mainWord: main.word, newTileCount: nt.length, crossWordCount: crossWords.length,
    state: state,
    hotbar: input.hotbar || [], placed: input.placed || [],
    boardStickers: input.boardStickers || [], cooldowns: input.cooldowns || new Set(),
    bounties: input.bounties || [],
    preview: !!input.preview,
    auras: [], finalTransforms: [],
    _freeHandCount: state.freeHandCount || 0,
    stickerLocked: state.constraint === 'c_stickers' && !state.stickersSold
  };

  // onBuildCtx — board stickers register auras/flags, then hotbar stickers
  if (!ctx.stickerLocked) {
    for (var bci = 0; bci < ctx.placed.length; bci++) {
      var bcd = sqd(ctx.placed[bci].id);
      if (bcd && bcd.onBuildCtx) bcd.onBuildCtx(ctx, ctx.placed[bci]);
    }
    for (var hci = 0; hci < ctx.hotbar.length; hci++) {
      var hcd = sqd(ctx.hotbar[hci].id);
      if (hcd && hcd.onBuildCtx) hcd.onBuildCtx(ctx, ctx.hotbar[hci]);
    }
  }

  // ---- PRE ----
  // 1. Tile-count bonus — always first
  if (ctx.newTileCount >= 4) {
    var _tcb = ctx.newTileCount - 3;
    ctx.plusMults.push(_tcb);
    ctx.events.push({type:'plus-mult',delta:_tcb,label:ctx.newTileCount+' tiles +'+_tcb+' mult',silent:true});
  }
  // 2. Board-sticker pre hooks on played squares (e.g. Gilded)
  if (!ctx.stickerLocked) {
    for (var pri = 0; pri < nt.length; pri++) {
      var pIdx = nt[pri].idx, pSid = ctx.boardStickers[pIdx];
      if (!pSid) continue;
      var pDef = sqd(pSid);
      if (!pDef || !pDef.onPreScore) continue;
      if (ctx.cooldowns.has(pIdx)) continue;
      ctx._stickerActed = false;
      var _preEv = ctx.events.length;
      pDef.onPreScore(nt[pri], ctx, pIdx);
      if (!ctx.preview && (ctx.events.length > _preEv || ctx._stickerActed)) ctx.activatedSqs.add(pIdx);
    }
  }

  var bingo = nt.length > 0 && ctx._freeHandCount === 0;

  // ---- PER TILE — cross words first, then the main word ----
  for (var cwi = 0; cwi < crossWords.length; cwi++) {
    if (!ctx.stickerLocked) {
      for (var cbi = 0; cbi < ctx.hotbar.length; cbi++) {
        var cbd = sqd(ctx.hotbar[cbi].id);
        if (cbd && cbd.onCrossword) cbd.onCrossword(ctx, ctx.hotbar[cbi]);
      }
    }
    var cwt = crossWords[cwi].tiles;
    for (var cti = 0; cti < cwt.length; cti++) _engScoreTile(cwt[cti], ctx);
  }
  for (var mti = 0; mti < main.tiles.length; mti++) _engScoreTile(main.tiles[mti], ctx);

  // ---- POST ----
  // 1. Bingo (game mechanic, not a sticker)
  if (bingo) {
    ctx.letters += 50;
    ctx.events.push({type:'letter',lettersAfter:ctx.letters,label:'Bingo +50'});
  }
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
    // 4. Hotbar stickers — left → right, each fires all its effects in turn
    for (var hwi = 0; hwi < ctx.hotbar.length; hwi++) {
      var hwd = sqd(ctx.hotbar[hwi].id);
      if (hwd && hwd.onPostWord) {
        var _evStart = ctx.events.length;
        hwd.onPostWord(main.word, main.tiles, ctx, ctx.hotbar[hwi]);
        for (var evi = _evStart; evi < ctx.events.length; evi++) {
          var tev = ctx.events[evi];
          if ((tev.type==='letter'||tev.type==='plus-mult'||tev.type==='x-mult')
            && tev.floatSqIdx == null && tev.floatTsId == null) tev.floatTsId = ctx.hotbar[hwi].id;
        }
      }
    }
  }
  // 5. Bounty reward — applied last so it multiplies everything
  if (state.pendingBountyReward && !ctx.preview) applyBountyReward(ctx);

  // ---- FINAL ----
  var plusSum = 0; for (var psi = 0; psi < ctx.plusMults.length; psi++) plusSum += ctx.plusMults[psi];
  var xprod = 1; for (var xpi = 0; xpi < ctx.xmults.length; xpi++) xprod *= ctx.xmults[xpi];
  var mult = (1 + plusSum) * xprod;
  var total = Math.round(ctx.letters * mult);
  var displayMult = mult;
  for (var fti = 0; fti < ctx.finalTransforms.length; fti++) {
    var tr = ctx.finalTransforms[fti];
    total = Math.round(total * tr.factor);
    displayMult *= tr.factor;
    ctx.events.push({type:'final-transform',label:tr.label,total:total,palMult:tr.factor,floatTsId:tr.tsId});
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
    activatedSqs: ctx.activatedSqs
  };
}
