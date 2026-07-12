// =====================================================================
// SOLVER — finds the highest-scoring move from current hand + board
//
// Three-phase pipeline, all behind the single _solverCore(opts) function so
// scoring rules (constraint legality, bounty inflation) can never drift
// between callers:
//   1. GENERATE  _solverGenMoves() — GADDAG anchor traversal (gaddag.js)
//                emits every legal placement spellable with the rack.
//                Synchronous and fast (ms).
//   2. SCORE     _solverScoreMove() per candidate through the real
//                scoring engine (runScoreEngine, preview mode), chunked
//                via setTimeout so the UI stays responsive.
//   3. RANK      top-K insertion sort while scoring.
//
// Entry points differ only in options they pass to _solverCore:
//   runSolver              dev panel, top 20, live position, progress UI
//   _rankRunRankSolve      background top 10 for the rank-reward system
//   findBestMoveBackground game-over winning-plays reveal, top 5, snapshot
//                          position (pre-play constraint state)
// =====================================================================
var _solverRunning = false;
var _solverResults = [];
var _solverHighlightMove = null;

// Precompute cross-word fragments for each empty cell.
// Avoids re-scanning neighbors on every placement attempt.
function _solverPrecompute() {
  var cvAbove = new Array(B * B).fill(''); // for H placement: letters above cell, top-to-bottom
  var cvBelow = new Array(B * B).fill(''); // for H placement: letters below cell
  var chLeft = new Array(B * B).fill(''); // for V placement: letters left of cell, left-to-right
  var chRight = new Array(B * B).fill(''); // for V placement: letters right of cell
  for (var i = 0; i < B * B; i++) {
    if (S.bt[i]) continue; // only precompute for empty cells
    var r = Math.floor(i / B), c = i % B, rr, cc, s;
    rr = r - 1; s = '';
    while (rr >= 0 && S.bt[rr * B + c]) { s = S.bt[rr * B + c].letter + s; rr--; }
    cvAbove[i] = s;
    rr = r + 1; s = '';
    while (rr < B && S.bt[rr * B + c]) { s += S.bt[rr * B + c].letter; rr++; }
    cvBelow[i] = s;
    cc = c - 1; s = '';
    while (cc >= 0 && S.bt[r * B + cc]) { s = S.bt[r * B + cc].letter + s; cc--; }
    chLeft[i] = s;
    cc = c + 1; s = '';
    while (cc < B && S.bt[r * B + cc]) { s += S.bt[r * B + cc].letter; cc++; }
    chRight[i] = s;
  }
  return { cvAbove: cvAbove, cvBelow: cvBelow, chLeft: chLeft, chRight: chRight };
}

// Per-square bitmask of letters (bit L-65) whose perpendicular cross-word is
// in DICT. Squares with no perpendicular neighbours allow every letter.
// h = masks for horizontal placements (vertical cross-words), v = vice versa.
var GD_ALLMASK = (1 << 26) - 1;
function _solverCrossMasks(pre) {
  var mh = new Array(B * B), mv = new Array(B * B);
  for (var i = 0; i < B * B; i++) {
    if (S.bt[i]) { mh[i] = 0; mv[i] = 0; continue; }
    var ab = pre.cvAbove[i], be = pre.cvBelow[i], lf = pre.chLeft[i], rt = pre.chRight[i];
    if (!ab && !be) mh[i] = GD_ALLMASK;
    else { var m = 0; for (var c = 0; c < 26; c++) { if (DICT.has(ab + String.fromCharCode(65 + c) + be)) m |= 1 << c; } mh[i] = m; }
    if (!lf && !rt) mv[i] = GD_ALLMASK;
    else { var m2 = 0; for (var c2 = 0; c2 < 26; c2++) { if (DICT.has(lf + String.fromCharCode(65 + c2) + rt)) m2 |= 1 << c2; } mv[i] = m2; }
  }
  return { h: mh, v: mv };
}

// Anchor squares: empty squares 4-adjacent to a tile (centre square when the
// board is empty). Every legal move covers at least one anchor.
function _solverAnchors() {
  var list = [], is = new Uint8Array(B * B), hasTiles = false;
  for (var i = 0; i < B * B; i++) {
    if (!S.bt[i]) continue;
    hasTiles = true;
    var r = Math.floor(i / B), c = i % B;
    var nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
    for (var k = 0; k < 4; k++) {
      var nr = nb[k][0], nc = nb[k][1];
      if (nr < 0 || nr >= B || nc < 0 || nc >= B) continue;
      var ni = nr * B + nc;
      if (!S.bt[ni] && !is[ni]) { is[ni] = 1; list.push(ni); }
    }
  }
  if (!hasTiles) { var mid = Math.floor(B / 2) * B + Math.floor(B / 2); is[mid] = 1; list.push(mid); }
  return { list: list, is: is };
}

// ---- GADDAG move generation (Gordon's algorithm) ----
// Returns every legal placement as {word, r, c, isH, placements} where
// placements = [{idx, letter, isBlank}] covers only the NEW tiles.
// Each move is generated exactly once — from its leftmost/topmost covered
// anchor: the leftward walk never places a tile on another anchor square
// (moves doing so are found from that anchor instead). Blanks are used
// greedily only when the rack letter is unavailable, like the old solver.
function _solverGenMoves(handCounts, blankCount) {
  var pre = _solverPrecompute();
  var masks = _solverCrossMasks(pre);
  var an = _solverAnchors();
  var moves = [];
  var rack = {}; for (var rl in handCounts) rack[rl] = handCounts[rl];
  var blanks = blankCount;
  var pend = {}, pendN = 0; // idx -> {letter, isBlank} placed along the current path

  function record(loIdx, hiIdx, stride, isH) {
    var word = '';
    for (var i = loIdx; i <= hiIdx; i += stride) {
      var t = S.bt[i];
      word += t ? tileDisplayLetter(t) : pend[i].letter;
    }
    var pl = [];
    for (var k in pend) pl.push({ idx: +k, letter: pend[k].letter, isBlank: pend[k].isBlank });
    moves.push({ word: word, r: Math.floor(loIdx / B), c: loIdx % B, isH: isH, placements: pl });
  }

  // Walk leftwards from the anchor consuming board tiles / placing rack tiles.
  function genLeft(aIdx, aCo, off, node, isH, stride, mask) {
    var co = aCo + off;
    if (co < 0) return;
    var cur = aIdx + off * stride, bt = S.bt[cur];
    if (bt) {
      var nx = gdChild(node, tileDisplayLetter(bt).charCodeAt(0));
      if (nx) afterLeft(aIdx, aCo, off, nx, isH, stride, mask);
      return;
    }
    if (off < 0 && an.is[cur]) return; // dedupe: another anchor owns those moves
    var arr = GADDAG.arr, k = arr[node * 3 + 1], m = mask[cur];
    while (k) {
      var c = arr[k * 3] & 255;
      if (c >= 65 && c <= 90 && (m >> (c - 65) & 1)) {
        var L = String.fromCharCode(c);
        var useBlank = !(rack[L] > 0);
        if (!useBlank || blanks > 0) {
          if (useBlank) blanks--; else rack[L]--;
          pend[cur] = { letter: L, isBlank: useBlank }; pendN++;
          afterLeft(aIdx, aCo, off, k, isH, stride, mask);
          delete pend[cur]; pendN--;
          if (useBlank) blanks++; else rack[L]++;
        }
      }
      k = arr[k * 3 + 2];
    }
  }

  function afterLeft(aIdx, aCo, off, node, isH, stride, mask) {
    var co = aCo + off, cur = aIdx + off * stride;
    var leftOpen = co === 0 || !S.bt[cur - stride];
    var aRightOpen = aCo === B - 1 || !S.bt[aIdx + stride];
    // Word ends at the anchor (no rightward part)
    if (leftOpen && aRightOpen && pendN > 0 && gdEnd(node)) record(cur, aIdx, stride, isH);
    if (co > 0) genLeft(aIdx, aCo, off - 1, node, isH, stride, mask);
    // '>' switches to rightward extension — only when the prefix is maximal
    var sw = gdChild(node, GD_SW);
    if (sw && leftOpen && aCo < B - 1) genRight(aIdx, aCo, 1, sw, cur, isH, stride, mask);
  }

  function genRight(aIdx, aCo, off, node, loIdx, isH, stride, mask) {
    var co = aCo + off;
    if (co >= B) return;
    var cur = aIdx + off * stride, bt = S.bt[cur];
    if (bt) {
      var nx = gdChild(node, tileDisplayLetter(bt).charCodeAt(0));
      if (nx) afterRight(aIdx, aCo, off, nx, loIdx, isH, stride, mask);
      return;
    }
    var arr = GADDAG.arr, k = arr[node * 3 + 1], m = mask[cur];
    while (k) {
      var c = arr[k * 3] & 255;
      if (c >= 65 && c <= 90 && (m >> (c - 65) & 1)) {
        var L = String.fromCharCode(c);
        var useBlank = !(rack[L] > 0);
        if (!useBlank || blanks > 0) {
          if (useBlank) blanks--; else rack[L]--;
          pend[cur] = { letter: L, isBlank: useBlank }; pendN++;
          afterRight(aIdx, aCo, off, k, loIdx, isH, stride, mask);
          delete pend[cur]; pendN--;
          if (useBlank) blanks++; else rack[L]++;
        }
      }
      k = arr[k * 3 + 2];
    }
  }

  function afterRight(aIdx, aCo, off, node, loIdx, isH, stride, mask) {
    var co = aCo + off, cur = aIdx + off * stride;
    var rightOpen = co === B - 1 || !S.bt[cur + stride];
    if (rightOpen && pendN > 0 && gdEnd(node)) record(loIdx, cur, stride, isH);
    if (co < B - 1) genRight(aIdx, aCo, off + 1, node, loIdx, isH, stride, mask);
  }

  for (var d = 0; d < 2; d++) {
    var isH = d === 0, stride = isH ? 1 : B, mask = isH ? masks.h : masks.v;
    for (var ai = 0; ai < an.list.length; ai++) {
      var aIdx = an.list[ai];
      var aCo = isH ? aIdx % B : Math.floor(aIdx / B);
      genLeft(aIdx, aCo, 0, 0, isH, stride, mask);
    }
  }
  return moves;
}

// Rack maps from a hand tile array (nulls allowed).
function _solverHandMaps(tiles) {
  var handCounts = {}, handBestVariant = {}, blankPool = [], n = 0;
  for (var i = 0; i < tiles.length; i++) {
    var t = tiles[i];
    if (!t) continue;
    n++;
    if (t.isBlank) blankPool.push({ devBlank: !!t._devBlank, alchSc: t._alchSc || 0 });
    else {
      var l = t.letter;
      handCounts[l] = (handCounts[l] || 0) + 1;
      if (!(l in handBestVariant)) handBestVariant[l] = t.variant || null;
    }
  }
  return { handCounts: handCounts, handBestVariant: handBestVariant, blankPool: blankPool, handTileCount: n };
}

// Score one generated move through the real engine (preview mode).
// Returns {score, letters, mult, gold, word, r, c, isH, wt} or null.
function _solverScoreMove(mv, hm) {
  var overlay = S.bt.slice(), newIdxs = [], blankUsed = 0, firstUse = {};
  for (var i = 0; i < mv.placements.length; i++) {
    var p = mv.placements[i], variant = null, alch = 0;
    if (p.isBlank) {
      var bp = hm.blankPool[blankUsed++] || {};
      alch = bp.devBlank ? (LS[p.letter] || 0) : (bp.alchSc || 0);
    } else if (!firstUse[p.letter]) {
      firstUse[p.letter] = 1;
      variant = hm.handBestVariant[p.letter] || null;
    }
    overlay[p.idx] = {
      letter: p.letter, isNew: true, isBlank: p.isBlank,
      blankAs: p.isBlank ? p.letter : null, _alchSc: alch, variant: variant
    };
    newIdxs.push(p.idx);
  }
  var newCount = newIdxs.length;
  // Bingo: whole hand used. When handTileCount is unknown, fall back to the
  // classic 7-tile rule (freeHandCount 0 ⇒ engine awards the bingo).
  var _bingoHit = (hm.handTileCount > 0) ? (newCount >= hm.handTileCount) : (newCount === 7);
  var res = runScoreEngine({
    tiles: overlay, newIdxs: newIdxs, dir: mv.isH ? 'h' : 'v',
    boardStickers: S.board, placed: S.placed, hotbar: S.tileStickers,
    cooldowns: S.localCooldowns || new Set(), bounties: S.bounties || [],
    preview: true,
    state: buildEngineState(_bingoHit ? 0 : Math.max(1, (hm.handTileCount || 7) - newCount))
  });
  if (!res) return null;
  // wt spans the full main word — used by highlight and auto-play
  var startIdx = mv.r * B + mv.c, stride = mv.isH ? 1 : B, wt = [];
  for (var k = 0; k < mv.word.length; k++) {
    var idx = startIdx + k * stride, ov = overlay[idx], ex = S.bt[idx];
    wt.push(ex
      ? { idx: idx, letter: mv.word[k], isNew: false, isBlank: !!ex.isBlank, variant: ex.variant || null }
      : { idx: idx, letter: mv.word[k], isNew: true, isBlank: ov.isBlank, variant: ov.variant });
  }
  return { score: res.total, letters: res.letters, mult: res.mult, gold: res.tgold, word: mv.word, r: mv.r, c: mv.c, isH: mv.isH, wt: wt };
}

// Bounty inflation — a word matching an active bounty scroll actually earns
// the BOUNTY_REWARD bonus (default ×2), which the engine skips in preview mode.
// Mirror it here so solver scores match what the word would really score.
// Returns res unchanged if the word isn't an active bounty target.
function _solverInflateBounty(res, bounties) {
  if (!bounties || !bounties.length) return res;
  var isBounty = false;
  for (var i = 0; i < bounties.length && !isBounty; i++) {
    var ws = bounties[i].words || [];
    for (var j = 0; j < ws.length; j++) { if (ws[j].word.toUpperCase() === res.word) { isBounty = true; break; } }
  }
  if (!isBounty) return res;
  var br = BOUNTY_REWARD, adj = res.score;
  if (br.type === 'x-mult')        adj = Math.round(res.score * br.value);
  else if (br.type === 'letters')  adj = Math.round((res.letters + br.value) * res.mult);
  else if (br.type === 'plus-mult')adj = Math.round(res.score + res.letters * br.value);
  // 'gold': no score change
  if (adj === res.score) return res;
  return { score:adj, letters:res.letters, mult:res.mult, gold:res.gold, word:res.word, r:res.r, c:res.c, isH:res.isH, wt:res.wt };
}

// ---- Shared solver core ----
// The single generate → score → filter → rank pipeline behind every entry
// point, so constraint legality and bounty inflation stay identical across
// the dev panel, the rank-reward solve, and the game-over reveal. Reads
// whatever S.hand/S.bt/S.board currently are (callers swap in a snapshot if
// they solve a past position). Chunked via setTimeout to keep the UI live.
//   handTiles       tile array for the rack (nulls ignored)
//   topK            number of results to keep, ranked by score
//   constraintState {palUnlocked, lastWordLen} — the position the moves are
//                   judged from (live S for dev/rank, snapshot for game-over)
//   chunk           moves scored per frame (default 200)
//   shouldAbort()   optional — checked each chunk; true → onDone(null)
//   onProgress(frac, best, total) optional — per-chunk UI hook
//   onDone(best|null) — ranked results, or null if aborted
function _solverCore(opts) {
  var hm = _solverHandMaps(opts.handTiles);
  var moves = _solverGenMoves(hm.handCounts, hm.blankPool.length);
  var cs = opts.constraintState || {};
  var _con = currentConstraint();
  var _palUnlocked = cs.palUnlocked != null ? cs.palUnlocked : S.palUnlocked;
  var _lastLen = cs.lastWordLen != null ? cs.lastWordLen : (S.lastWordLen || 0);
  var _palLock = _con === 'c_pal' && !_palUnlocked;
  var _minLen = _con === 'c_long' ? 5 : (_con === 'c_longer' ? _lastLen + 1 : 2);
  var bounties = S.bounties || [];
  var mi = 0, chunk = opts.chunk || 200, topK = opts.topK, best = [];
  function step() {
    if (opts.shouldAbort && opts.shouldAbort()) { opts.onDone(null); return; }
    var end = Math.min(mi + chunk, moves.length);
    for (; mi < end; mi++) {
      var mv = moves[mi];
      if (mv.word.length < _minLen) continue;
      if (_palLock && !isExtendedPalindrome(mv.word)) continue;
      var res = _solverScoreMove(mv, hm);
      if (!res) continue;
      res = _solverInflateBounty(res, bounties);
      var ins = false;
      for (var bi = 0; bi < best.length; bi++) { if (res.score > best[bi].score) { best.splice(bi, 0, res); ins = true; break; } }
      if (!ins) best.push(res);
      if (best.length > topK) best.pop();
    }
    if (opts.onProgress) opts.onProgress(moves.length ? mi / moves.length : 1, best, moves.length);
    if (mi < moves.length) setTimeout(step, 0);
    else opts.onDone(best);
  }
  setTimeout(step, 0);
}

// ---- Rank solver — silent background solve, keeps top 10 for reward system ----

var _rankTop10 = null;   // null = stale/computing; array = ready
var _rankRunId = 0;      // increment to cancel any in-progress solve
var _rankSolving = false;
var _rankTimer = null;

// Called after every drawFull(). Debounced 600ms.
function _scheduleRankSolve() {
  if (_rankTimer) clearTimeout(_rankTimer);
  _rankTop10 = null;
  _rankTimer = setTimeout(function() {
    _rankTimer = null;
    if (!DICT || !GADDAG || S.phase !== 'play' || _solverRunning || _rankSolving) return;
    var snap = {
      hand:  S.hand.map(function(t){ return t ? Object.assign({},t,{onBoard:false,_boardSq:undefined}) : null; }),
      bt:    S.bt.map(function(bt){ return (bt && !bt.isNew) ? Object.assign({},bt) : null; }),
      board: S.board.slice()
    };
    _rankRunRankSolve(snap);
  }, 600);
}

function _rankRunRankSolve(snap) {
  if (!DICT || !GADDAG || _solverRunning || _rankSolving) return;
  _rankSolving = true;
  var myId = ++_rankRunId;
  var origHand = S.hand, origBt = S.bt, origBoard = S.board;
  S.hand = snap.hand; S.bt = snap.bt; S.board = snap.board;
  function restore() { S.hand = origHand; S.bt = origBt; S.board = origBoard; _rankSolving = false; }

  _solverCore({
    handTiles: S.hand,
    topK: 10,
    constraintState: { palUnlocked: S.palUnlocked, lastWordLen: S.lastWordLen },
    chunk: 200,
    shouldAbort: function () { return _rankRunId !== myId; },
    onDone: function (best) {
      restore();
      if (best && _rankRunId === myId) { _rankTop10 = best; window._easyHint = best.length ? best[0] : null; }
    }
  });
}

// Compare played score to pre-play top-10. Call after score animation.
function _checkRankReward(score, top10) {
  if (!top10 || !top10.length) return;
  var rank = top10.length + 1;
  for (var i = 0; i < top10.length; i++) {
    if (score >= top10[i].score) { rank = i + 1; break; }
  }
  if (rank <= 10) _showRankReward(rank);
  if (rank === 1 && hasTileSticker('the_player')) {
    S.playerMult=parseFloat(((S.playerMult||1)+0.5).toFixed(2));toast('The Player: ×'+S.playerMult.toFixed(1)+' mult!');
  }
}

function _showRankReward(rank) {
  var text, color, size;
  if      (rank === 1) { text = '★ BEST PLAY!';   color = '#f0e080'; size = '26px'; }
  else if (rank === 2) { text = '2nd Best Play';   color = '#d4b84a'; size = '21px'; }
  else if (rank === 3) { text = '3rd Best Play';   color = '#b09840'; size = '19px'; }
  else if (rank <= 5)  { text = 'Top 5 Play';      color = '#9090b8'; size = '17px'; }
  else                 { text = 'Top 10 Play';      color = '#6a6a90'; size = '15px'; }

  var el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:50%;top:35%;transform:translate(-50%,-50%);'
    + 'background:#12122a;border:2px solid '+color+';border-radius:10px;'
    + 'padding:10px 26px;color:'+color+';font-size:'+size+';font-weight:normal;'
    + "font-family:'Jersey 10',Georgia,serif;z-index:8000;pointer-events:none;text-align:center;"
    + 'animation:rank-pop 2.6s ease-out forwards';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 2700);
  if (rank === 1) _confetti();
}

function _confetti() {
  var colors = ['#f0e080','#ff8080','#80ff80','#80c0ff','#ff80c0','#c080ff','#ffa060'];
  var wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:7999;overflow:hidden';
  document.body.appendChild(wrap);
  for (var i = 0; i < 90; i++) {
    var el = document.createElement('div');
    var color = colors[Math.floor(Math.random()*colors.length)];
    var x     = Math.random()*100;
    var size  = 5 + Math.random()*9;
    var delay = Math.random()*900;
    var dur   = 1600 + Math.random()*1200;
    var drift = Math.round((Math.random()-0.5)*160);
    var spin  = Math.round((Math.random()>0.5?1:-1)*(360+Math.random()*360));
    el.style.cssText = 'position:absolute;left:'+x+'%;top:-14px;width:'+size+'px;height:'+size+'px;'
      + 'background:'+color+';border-radius:'+(Math.random()>0.5?'50%':'3px')+';'
      + 'animation:confetti-fall '+dur+'ms '+delay+'ms ease-in forwards;'
      + '--d:'+drift+'px;--s:'+spin+'deg';
    wrap.appendChild(el);
  }
  setTimeout(function(){ if(wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 4000);
}

function runSolver() {
  if (!DICT) { toast('Dictionary still loading...'); return; }
  if (!GADDAG) { toast('Word index still building...'); return; }

  // Toggle off
  if (_solverRunning) {
    _solverRunning = false;
    document.getElementById('solver-panel').innerHTML = '<div style="color:#a0a0c0;font-size:30px">Cancelled.</div>';
    return;
  }
  if (document.getElementById('solver-panel').style.display !== 'none') {
    clearSolverPanel(); return;
  }

  _solverRunning = true;
  _solverResults = [];
  clearSolverHighlight();

  var panel = document.getElementById('solver-panel');
  panel.style.display = 'block';
  panel.innerHTML = '<div style="color:#a0a0c0;font-size:30px">Solving... 0%</div>';

  _solverCore({
    handTiles: S.hand.filter(function (t) { return t && !t.onBoard; }),
    topK: 20,
    constraintState: { palUnlocked: S.palUnlocked, lastWordLen: S.lastWordLen },
    chunk: 150,
    shouldAbort: function () { return !_solverRunning; },
    onProgress: function (frac, best) {
      var pct = Math.round(frac * 100);
      var bestTxt = best.length ? 'Best: ' + best[0].word + ' (' + best[0].score + 'pts)' : '';
      panel.innerHTML = '<div style="color:#a0a0c0;font-size:30px">Solving... ' + pct + '%'
        + (bestTxt ? '<br><span style="color:#80ff80">' + bestTxt + '</span>' : '') + '</div>';
    },
    onDone: function (best) {
      if (!best) return; // aborted (toggled off)
      _solverRunning = false;
      _solverResults = best;
      showSolverResults(best);
    }
  });
}

// Game-over reveal: solves the pre-final-word snapshot and returns the top 5
// moves (descending score) via onDone. Constraint filters use the snapshot's
// pre-play state (palUnlocked/lastWordLen) so every listed word would
// genuinely have scored from that position.
function findBestMoveBackground(snap, onDone) {
  if (!DICT || !GADDAG || _solverRunning || _rankSolving) { onDone(null); return; }
  _solverRunning = true;
  var origHand = S.hand, origBt = S.bt, origBoard = S.board;
  S.hand = snap.hand; S.bt = snap.bt; S.board = snap.board;
  function restore() { var live = document.getElementById('gameover-modal'); if (live && live.style.display !== 'none') { S.hand = origHand; S.bt = origBt; S.board = origBoard; } }

  _solverCore({
    handTiles: S.hand,
    topK: 5,
    constraintState: { palUnlocked: snap.palUnlocked, lastWordLen: snap.lastWordLen },
    chunk: 250,
    shouldAbort: function () { return !_solverRunning; },
    onDone: function (best) { _solverRunning = false; restore(); onDone(best); }
  });
}

function showSolverResults(results) {
  var panel = document.getElementById('solver-panel');
  if (!results.length) {
    panel.innerHTML = '<div style="color:#a0a0c0;font-size:30px">No valid moves found.</div>'
      + '<div style="font-size:32px;color:#504860;margin-top:6px;cursor:pointer" onclick="clearSolverPanel()">Dismiss</div>';
    return;
  }
  var html = '<div style="color:#00e5ff;font-size:30px;font-weight:normal;margin-bottom:2px">Top Moves</div>'
    + '<div style="font-size:32px;color:#404860;margin-bottom:5px">Click to auto-play</div>';
  for (var i = 0; i < results.length; i++) {
    var res = results[i];
    var pos = rcl(res.r * B + res.c) + (res.isH ? '→' : '↓');
    html += '<div class="solver-row" onmouseenter="highlightSolverMove(' + i + ')" onmouseleave="clearSolverHighlight()" onclick="applySolverMove(' + i + ')">'
      + '<span style="font-size:30px;color:#fff;font-weight:normal">' + res.word + '</span>'
      + '<span style="font-size:32px;color:#7070a0;margin-left:4px">' + pos + '</span>'
      + '<span style="font-size:28px;color:#80ff80;margin-left:auto">' + res.score + 'pt' + (res.score === 1 ? '' : 's') + '</span>'
      + '</div>';
  }
  html += '<div style="font-size:32px;color:#504860;margin-top:6px;cursor:pointer" onclick="clearSolverPanel()">Dismiss</div>';
  panel.innerHTML = html;
}

function highlightSolverMove(idx) {
  clearSolverHighlight();
  if (idx >= _solverResults.length) return;
  _solverHighlightMove = _solverResults[idx];
  var sqs = document.getElementById('board-wrap').querySelectorAll('.sq');
  var move = _solverHighlightMove;
  for (var i = 0; i < move.wt.length; i++) {
    var tile = move.wt[i];
    var sq = sqs[tile.idx];
    if (!sq) continue;
    if (tile.isNew) {
      sq.classList.add('sq-solver-new');
      var lbl = document.createElement('div');
      lbl.className = 'sq-solver-lbl';
      lbl.textContent = tile.letter;
      sq.appendChild(lbl);
    } else {
      sq.classList.add('sq-solver-existing');
    }
  }
}

function clearSolverHighlight() {
  _solverHighlightMove = null;
  var newSqs = document.querySelectorAll('.sq-solver-new, .sq-solver-existing');
  for (var i = 0; i < newSqs.length; i++) {
    newSqs[i].classList.remove('sq-solver-new', 'sq-solver-existing');
    var lbls = newSqs[i].querySelectorAll('.sq-solver-lbl');
    for (var j = 0; j < lbls.length; j++) newSqs[i].removeChild(lbls[j]);
  }
}

function applySolverMove(moveIdx) {
  if (moveIdx >= _solverResults.length) return;
  var move = _solverResults[moveIdx];

  // Recall any tiles the player had placed this turn
  recallAll();

  // Build blank pool from hand as tile objects (not indices — placeTile removes tiles from S.hand)
  var blankHand = [];
  for (var i = 0; i < S.hand.length; i++) {
    if (S.hand[i] && S.hand[i].isBlank) blankHand.push(S.hand[i]);
  }
  var blankUsed = 0;

  for (var i = 0; i < move.wt.length; i++) {
    var tile = move.wt[i];
    if (!tile.isNew) continue;

    var tileToPl = null;
    if (tile.isBlank) {
      if (blankUsed < blankHand.length) {
        var bt = blankHand[blankUsed++];
        bt.blankAs = tile.letter;
        if (bt._devBlank) bt._alchSc = LS[tile.letter] || 0;
        tileToPl = bt;
      }
    } else {
      // Find matching hand tile, prefer variant match
      var bestMatch = null;
      for (var j = 0; j < S.hand.length; j++) {
        var ht = S.hand[j];
        if (!ht || ht.isBlank || ht.letter !== tile.letter) continue;
        if (!bestMatch) { bestMatch = ht; continue; }
        if (tile.variant && ht.variant === tile.variant && bestMatch.variant !== tile.variant) bestMatch = ht;
      }
      tileToPl = bestMatch;
    }

    if (tileToPl) placeTile(tileToPl, tile.idx);
  }

  clearSolverPanel();
  renderBoard();
  renderHand();
  playWord();
}

function clearSolverPanel() {
  clearSolverHighlight();
  _solverRunning = false;
  document.getElementById('solver-panel').style.display = 'none';
}
