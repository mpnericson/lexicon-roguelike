// =====================================================================
// SOLVER — finds the highest-scoring move from current hand + board
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

// Rows and columns that contain tiles or are adjacent to tiles.
// Limits search to ~20-40 lines instead of all 30.
function _solverActiveLines() {
  var rowSet = {}, colSet = {}, hasTiles = false;
  for (var i = 0; i < B * B; i++) {
    if (!S.bt[i]) continue;
    hasTiles = true;
    var r = Math.floor(i / B), c = i % B;
    for (var dr = -1; dr <= 1; dr++) { var rr = r + dr; if (rr >= 0 && rr < B) rowSet[rr] = 1; }
    for (var dc = -1; dc <= 1; dc++) { var cc = c + dc; if (cc >= 0 && cc < B) colSet[cc] = 1; }
  }
  if (!hasTiles) { var mid = Math.floor(B / 2); rowSet[mid] = 1; colSet[mid] = 1; }
  var lines = [];
  for (var r in rowSet) lines.push({ isH: true, coord: parseInt(r) });
  for (var c in colSet) lines.push({ isH: false, coord: parseInt(c) });
  return lines;
}

// Pre-filter: can this word be spelled using combined hand+board letters (with blanks)?
// Optimistic — false positives OK, no false negatives.
function _solverCanSpell(word, available, blanks) {
  var freq = {};
  for (var i = 0; i < word.length; i++) freq[word[i]] = (freq[word[i]] || 0) + 1;
  var blanksNeeded = 0;
  for (var l in freq) {
    var shortage = freq[l] - (available[l] || 0);
    if (shortage > 0) blanksNeeded += shortage;
  }
  return blanksNeeded <= blanks;
}

// Try placing `word` at (r, c) in direction isH.
// Returns {score, gold, word, r, c, isH, wt} or null.
function _solverTryPlace(word, r, c, isH, handCounts, handBestVariant, handBestBlueBonus, blankPool, pre) {
  var len = word.length;

  // Bounds
  if (isH ? c + len > B : r + len > B) return null;

  // Word must not extend an existing run in its own direction
  if (isH) {
    if (c > 0 && S.bt[r * B + (c - 1)]) return null;
    if (c + len < B && S.bt[r * B + (c + len)]) return null;
  } else {
    if (r > 0 && S.bt[(r - 1) * B + c]) return null;
    if (r + len < B && S.bt[(r + len) * B + c]) return null;
  }

  // Pass 1: detect conflicts and count letters needed from hand
  var needed = {}, newCount = 0, touchesExisting = false;
  for (var i = 0; i < len; i++) {
    var ri = isH ? r : r + i, ci = isH ? c + i : c;
    var idx = ri * B + ci, letter = word[i], existing = S.bt[idx];
    if (existing) {
      if (existing.letter !== letter) return null;
      touchesExisting = true;
    } else {
      newCount++;
      needed[letter] = (needed[letter] || 0) + 1;
    }
  }
  if (newCount === 0) return null;

  // Check hand covers needed letters (with blanks)
  var blanksNeeded = 0;
  for (var l in needed) {
    var shortage = needed[l] - (handCounts[l] || 0);
    if (shortage > 0) blanksNeeded += shortage;
  }
  if (blanksNeeded > blankPool.length) return null;

  // Connectivity: must touch existing tiles or cover centre
  if (!touchesExisting) {
    var centerIdx = Math.floor(B / 2) * B + Math.floor(B / 2);
    var connected = false;
    for (var i = 0; i < len && !connected; i++) {
      var ri = isH ? r : r + i, ci = isH ? c + i : c, idx = ri * B + ci;
      if (idx === centerIdx) { connected = true; break; }
      var nbrs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (var ni = 0; ni < nbrs.length && !connected; ni++) {
        var nr = ri + nbrs[ni][0], nc = ci + nbrs[ni][1];
        if (nr >= 0 && nr < B && nc >= 0 && nc < B && S.bt[nr * B + nc]) connected = true;
      }
    }
    if (!connected) return null;
  }

  // Pass 2: build wt array, verify cross-words
  var hUse = {}, blankUsed = 0, wt = [];
  for (var i = 0; i < len; i++) {
    var ri = isH ? r : r + i, ci = isH ? c + i : c;
    var idx = ri * B + ci, letter = word[i], existing = S.bt[idx];
    if (existing) {
      wt.push({
        idx: idx, letter: letter, isNew: false, isBlank: existing.isBlank,
        sc: existing.isBlank ? (existing.alchSc || 0) : (LS[letter] || 0),
        sid: S.board[idx], variant: existing.variant || null, blueBonus: existing.blueBonus || 0
      });
    } else {
      var isBlankTile = false, tileSc = LS[letter] || 0, tileVariant = null, tileBlueBonus = 0;
      var hUsed = hUse[letter] || 0, hAvail = (handCounts[letter] || 0) - hUsed;
      if (hAvail > 0) {
        hUse[letter] = hUsed + 1;
        if (hUsed === 0) { tileVariant = handBestVariant[letter] || null; tileBlueBonus = handBestBlueBonus[letter] || 0; }
      } else {
        isBlankTile = true;
        var bp = blankPool[blankUsed++];
        tileSc = bp.devBlank ? (LS[letter] || 0) : (bp.alchSc || 0);
      }

      // Cross-word validation
      var cwStr = null;
      if (isH) {
        var ab = pre.cvAbove[idx], be = pre.cvBelow[idx];
        if (ab || be) cwStr = ab + letter + be;
      } else {
        var lf = pre.chLeft[idx], rt = pre.chRight[idx];
        if (lf || rt) cwStr = lf + letter + rt;
      }
      if (cwStr !== null && !DICT.has(cwStr.toLowerCase())) return null;

      wt.push({
        idx: idx, letter: letter, isNew: true, isBlank: isBlankTile,
        sc: isBlankTile ? tileSc : (LS[letter] || 0),
        sid: S.board[idx], variant: isBlankTile ? null : tileVariant, blueBonus: isBlankTile ? 0 : tileBlueBonus
      });
    }
  }

  var res = scoreWord(wt, word, true, newCount === 7 ? 50 : 0);
  return { score: res.total, gold: res.gold, word: word, r: r, c: c, isH: isH, wt: wt };
}

function runSolver() {
  if (!DICT) { toast('Dictionary still loading...'); return; }

  // Toggle off
  if (_solverRunning) {
    _solverRunning = false;
    document.getElementById('solver-panel').innerHTML = '<div style="color:#a0a0c0;font-size:12px">Cancelled.</div>';
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
  panel.innerHTML = '<div style="color:#a0a0c0;font-size:12px">Solving... 0%</div>';

  // Build hand maps
  var handCounts = {}, handBestVariant = {}, handBestBlueBonus = {}, blankPool = [];
  for (var i = 0; i < S.hand.length; i++) {
    var t = S.hand[i];
    if (!t || t.onBoard) continue;
    if (t.isBlank) {
      blankPool.push({ devBlank: !!t._devBlank, alchSc: t._alchSc || 0 });
    } else {
      var l = t.letter;
      handCounts[l] = (handCounts[l] || 0) + 1;
      var esc = (LS[l] || 0) + (t.variant === 'blue' ? (t.blueBonus || 0) : 0);
      var prevBest = (LS[l] || 0) + (handBestVariant[l] === 'blue' ? (handBestBlueBonus[l] || 0) : 0);
      if (!(l in handBestVariant) || esc > prevBest) {
        handBestVariant[l] = t.variant || null;
        handBestBlueBonus[l] = t.blueBonus || 0;
      }
    }
  }

  // Combined letter pool for pre-filter
  var available = {};
  for (var l in handCounts) available[l] = handCounts[l];
  for (var i = 0; i < B * B; i++) {
    var bt = S.bt[i];
    if (bt) available[bt.letter] = (available[bt.letter] || 0) + 1;
  }
  var totalBlanks = blankPool.length;

  var pre = _solverPrecompute();
  var lines = _solverActiveLines();

  var words = [];
  DICT.forEach(function (w) { if (w.length >= 2 && w.length <= B) words.push(w.toUpperCase()); });

  var wi = 0, CHUNK = 1500, best = [];

  function processChunk() {
    if (!_solverRunning) return;
    var end = Math.min(wi + CHUNK, words.length);
    for (var w = wi; w < end; w++) {
      var word = words[w];
      if (!_solverCanSpell(word, available, totalBlanks)) continue;
      for (var li = 0; li < lines.length; li++) {
        var line = lines[li];
        var maxStart = B - word.length;
        for (var startPos = 0; startPos <= maxStart; startPos++) {
          var r = line.isH ? line.coord : startPos;
          var c = line.isH ? startPos : line.coord;
          var result = _solverTryPlace(word, r, c, line.isH, handCounts, handBestVariant, handBestBlueBonus, blankPool, pre);
          if (!result) continue;
          var inserted = false;
          for (var bi = 0; bi < best.length; bi++) {
            if (result.score > best[bi].score) { best.splice(bi, 0, result); inserted = true; break; }
          }
          if (!inserted) best.push(result);
          if (best.length > 20) best.pop();
        }
      }
    }
    wi = end;

    var pct = Math.round(wi / words.length * 100);
    var bestTxt = best.length ? 'Best: ' + best[0].word + ' (' + best[0].score + 'pts)' : '';
    panel.innerHTML = '<div style="color:#a0a0c0;font-size:12px">Solving... ' + pct + '%'
      + (bestTxt ? '<br><span style="color:#80ff80">' + bestTxt + '</span>' : '') + '</div>';

    if (wi < words.length) {
      setTimeout(processChunk, 0);
    } else {
      _solverRunning = false;
      _solverResults = best;
      showSolverResults(best);
    }
  }

  setTimeout(processChunk, 0);
}

function findBestMoveBackground(snap, onDone) {
  if (!DICT || _solverRunning) { onDone(null); return; }
  _solverRunning = true;
  var origHand = S.hand, origBt = S.bt, origBoard = S.board;
  S.hand = snap.hand; S.bt = snap.bt; S.board = snap.board;
  var handCounts = {}, handBestVariant = {}, handBestBlueBonus = {}, blankPool = [];
  for (var i = 0; i < S.hand.length; i++) {
    var t = S.hand[i]; if (!t) continue;
    if (t.isBlank) { blankPool.push({ devBlank: false, alchSc: t._alchSc || 0 }); }
    else {
      var l = t.letter; handCounts[l] = (handCounts[l] || 0) + 1;
      var esc = (LS[l] || 0) + (t.variant === 'blue' ? (t.blueBonus || 0) : 0);
      var prevBest = (LS[l] || 0) + (handBestVariant[l] === 'blue' ? (handBestBlueBonus[l] || 0) : 0);
      if (!(l in handBestVariant) || esc > prevBest) { handBestVariant[l] = t.variant || null; handBestBlueBonus[l] = t.blueBonus || 0; }
    }
  }
  var available = {};
  for (var l in handCounts) available[l] = handCounts[l];
  for (var i = 0; i < B * B; i++) { var bt = S.bt[i]; if (bt) available[bt.letter] = (available[bt.letter] || 0) + 1; }
  var totalBlanks = blankPool.length, pre = _solverPrecompute(), lines = _solverActiveLines();
  var words = []; DICT.forEach(function (w) { if (w.length >= 2 && w.length <= B) words.push(w.toUpperCase()); });
  var wi = 0, CHUNK = 2000, best = [];
  function restore() { var live = document.getElementById('gameover-modal'); if (live && live.style.display !== 'none') { S.hand = origHand; S.bt = origBt; S.board = origBoard; } }
  function processChunk() {
    if (!_solverRunning) { restore(); onDone(null); return; }
    var end = Math.min(wi + CHUNK, words.length);
    for (var w = wi; w < end; w++) {
      var word = words[w]; if (!_solverCanSpell(word, available, totalBlanks)) continue;
      for (var li = 0; li < lines.length; li++) {
        var line = lines[li], maxStart = B - word.length;
        for (var sp = 0; sp <= maxStart; sp++) {
          var r = line.isH ? line.coord : sp, c = line.isH ? sp : line.coord;
          var res = _solverTryPlace(word, r, c, line.isH, handCounts, handBestVariant, handBestBlueBonus, blankPool, pre);
          if (!res) continue;
          var ins = false; for (var bi = 0; bi < best.length; bi++) { if (res.score > best[bi].score) { best.splice(bi, 0, res); ins = true; break; } } if (!ins) best.push(res);
          if (best.length > 5) best.pop();
        }
      }
    }
    wi = end;
    if (wi < words.length) { setTimeout(processChunk, 0); }
    else { _solverRunning = false; restore(); onDone(best.length ? best[0] : null); }
  }
  setTimeout(processChunk, 0);
}

function showSolverResults(results) {
  var panel = document.getElementById('solver-panel');
  if (!results.length) {
    panel.innerHTML = '<div style="color:#a0a0c0;font-size:12px">No valid moves found.</div>'
      + '<div style="font-size:9px;color:#504860;margin-top:6px;cursor:pointer" onclick="clearSolverPanel()">Dismiss</div>';
    return;
  }
  var html = '<div style="color:#00e5ff;font-size:11px;font-weight:bold;margin-bottom:2px">Top Moves</div>'
    + '<div style="font-size:9px;color:#404860;margin-bottom:5px">Click to auto-play</div>';
  for (var i = 0; i < results.length; i++) {
    var res = results[i];
    var pos = rcl(res.r * B + res.c) + (res.isH ? '→' : '↓');
    html += '<div class="solver-row" onmouseenter="highlightSolverMove(' + i + ')" onmouseleave="clearSolverHighlight()" onclick="applySolverMove(' + i + ')">'
      + '<span style="font-size:11px;color:#fff;font-weight:bold">' + res.word + '</span>'
      + '<span style="font-size:9px;color:#7070a0;margin-left:4px">' + pos + '</span>'
      + '<span style="font-size:10px;color:#80ff80;margin-left:auto">' + res.score + 'pt' + (res.score === 1 ? '' : 's') + '</span>'
      + '</div>';
  }
  html += '<div style="font-size:9px;color:#504860;margin-top:6px;cursor:pointer" onclick="clearSolverPanel()">Dismiss</div>';
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

  // Build blank pool from hand (in order)
  var blankHand = [];
  for (var i = 0; i < S.hand.length; i++) {
    if (S.hand[i] && S.hand[i].isBlank && !S.hand[i].onBoard) blankHand.push(i);
  }
  var blankUsed = 0;

  for (var i = 0; i < move.wt.length; i++) {
    var tile = move.wt[i];
    if (!tile.isNew) continue;

    var hi = -1;
    if (tile.isBlank) {
      if (blankUsed < blankHand.length) {
        hi = blankHand[blankUsed++];
        S.hand[hi].blankAs = tile.letter;
        if (S.hand[hi]._devBlank) S.hand[hi]._alchSc = LS[tile.letter] || 0;
      }
    } else {
      // Find matching hand tile, prefer variant match
      var bestHi = -1;
      for (var j = 0; j < S.hand.length; j++) {
        var ht = S.hand[j];
        if (!ht || ht.onBoard || ht.isBlank || ht.letter !== tile.letter) continue;
        if (bestHi < 0) { bestHi = j; continue; }
        if (tile.variant && ht.variant === tile.variant && S.hand[bestHi].variant !== tile.variant) bestHi = j;
      }
      hi = bestHi;
    }

    if (hi >= 0) placeTile(hi, tile.idx);
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
