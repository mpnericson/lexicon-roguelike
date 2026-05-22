// =====================================================================
// PLAY — word validation, playing, discarding, shuffling
// =====================================================================
async function playWord() {
  if (S.plays <= 0) { toast('No plays remaining!'); return; }
  var nt = newTiles(); if (!nt.length) { toast('Place tiles on the board first!'); return; }
  window._lastPlaySnap = {
    hand: S.hand.map(function (t) { return t ? Object.assign({}, t, { onBoard: false, _boardSq: undefined }) : null; }),
    bt: S.bt.map(function (bt) { return (bt && !bt.isNew) ? Object.assign({}, bt) : null; }),
    board: S.board.slice()
  };
  var dir = wordDir(nt); if (!dir) { toast('Tiles must be in a straight line!'); return; }
  var a = nt[0]; var main = extractAt(a.row, a.col, dir);
  if (!main) { toast('Word has a gap!'); return; } if (main.word.length < 2) { toast('Word must be at least 2 letters!'); return; }
  var comm = []; for (var i = 0; i < B * B; i++)if (S.bt[i] && !S.bt[i].isNew) comm.push(i);
  if (comm.length > 0) {
    var conn = false;
    outer: for (var ni = 0; ni < nt.length; ni++) {
      var r = nt[ni].row, c = nt[ni].col; var nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
      for (var nb2 = 0; nb2 < nb.length; nb2++) { var nr = nb[nb2][0], nc = nb[nb2][1]; if (nr < 0 || nr >= B || nc < 0 || nc >= B) continue; var nbt = S.bt[nr * B + nc]; if (nbt && !nbt.isNew) { conn = true; break outer; } }
    }
    if (!conn) { toast('Word must connect to an existing word!'); return; }
  }
  var boss = cb()[3];
  if (boss === 'boss_long' && main.word.length < 5) { toast('Constraint: use 5+ tiles!'); return; }
  if (boss === 'boss_hv') { var hv = false; for (var i = 0; i < main.tiles.length; i++)if (!main.tiles[i].isBlank && (LS[main.tiles[i].letter] || 0) >= 5) { hv = true; break; } if (!hv) { toast('Constraint: word must include a 5+ point tile!'); return; } }
  var palLocked = boss === 'boss_pal' && !S.palUnlocked;
  var justUnlocked = false;
  if (palLocked && isExtendedPalindrome(main.word)) { S.palUnlocked = true; palLocked = false; justUnlocked = true; }
  S._slotMachineRoll = null;
  var res = calcAll(nt, dir);
  var _eggWords = {}; for (var i = 0; i < EASTER_EGGS.length; i++)_eggWords[EASTER_EGGS[i].word] = true;
  for (var i = 0; i < res.words.length; i++) { if (_eggWords[res.words[i].word]) continue; var v = await validWord(res.words[i].word); if (!v) { flashTiles(nt); if (!S.devMode) { S.gold = Math.max(0, S.gold - 2); renderHUD(); toast('"' + res.words[i].word + '" is not a word — fined $2!'); } else { toast('"' + res.words[i].word + '" is not a word.'); } return; } }
  // Easter egg effects (before scoring — can mutate tile variants)
  var _eggApplied = applyEasterEgg(main.word, nt); if (_eggApplied) await new Promise(function (r) { setTimeout(r, 420); });
  // Bounty check (before scoring)
  var _bountyGold = 0, _bountyMsg = '';
  if (S.bounties && S.bounties.length) {
    for (var _bi = S.bounties.length - 1; _bi >= 0; _bi--) {
      if (S.bounties[_bi].word === main.word) {
        var _bitem = S.bounties[_bi]; var _br = _bitem.reward; _bountyGold += _br; S.bounties.splice(_bi, 1);
        var _hasBH = false; for (var _bhi = 0; _bhi < S.placed.length; _bhi++) { if (S.placed[_bhi].id === 'bounty_hunter') { _hasBH = true; break; } } if (_hasBH) S.bhMult = (S.bhMult || 1) + 0.25;
        // Variant bounty: convert all tiles in the played word
        if (_bitem.variant) {
          var _converted = 0;
          for (var _vti = 0; _vti < main.tiles.length; _vti++) { var _vt = main.tiles[_vti]; if (_vt) { _vt.variant = _bitem.variant; _converted++; } }
          if (_converted) _bountyMsg = ' (+' + _converted + ' ' + _bitem.variant + (_converted > 1 ? ' tiles' : ' tile') + ')';
        }
        _bountyMsg = '+$' + _br + _bountyMsg; break;
      }
    }
  }
  if (_bountyGold) { S.gold += _bountyGold; setTimeout(function (m) { return function () { toast('Bounty complete! ' + m); }; }(_bountyMsg), 900); }
  if (!palLocked) {
    if (justUnlocked) toast('Palindrome! Scoring is now live.');
    // Recalculate after any pre-scoring mutations (easter eggs, bounty tile upgrades)
    res = calcAll(nt, dir);
    var detailed = scoreWordDetailed(main.tiles, main.word, true, res.bingo ? 50 : 0);
    var crossLetters = Math.max(0, res.grand - detailed.total);
    await runScoreAnim(detailed.events, crossLetters, res.grand);
    S.score += res.grand; S.gold += res.tgold;
  } else { toast('Scoring locked — play a palindrome first!'); }
  S.wtb = (S.wtb || 0) + 1; S.discPressure = 0;
  if (S.wtb % 3 === 0) for (var i = 0; i < S.placed.length; i++)if (S.placed[i].id === 'tome') { S.ts = (S.ts || 0) + 1; break; }
  var blueTiles = [];
  for (var i = 0; i < B * B; i++) { if (S.bt[i] && S.bt[i].isNew) { S.bt[i].isNew = false; S.bt[i].flying = false; var t = S.hand[S.bt[i].handIdx]; if (t) { if (t.variant === 'blue') { var nb = (t.blueBonus || 0) + (t.isBlank ? 0 : (LS[t.letter] || 0)); blueTiles.push({ letter: t.letter, isBlank: t.isBlank, id: t.id, variant: 'blue', blueBonus: nb }); } t._done = true; } } }
  S.hand = S.hand.filter(function (t) { return !t._done; });
  for (var i = 0; i < blueTiles.length; i++)S.bag.push(blueTiles[i]);
  if (blueTiles.length) { S.bag = shuffle(S.bag); toast('Blue tile' + (blueTiles.length > 1 ? 's' : '') + ' returned to bag!'); }
  HP.x = []; HP.vx = []; window._easyHint = null;
  S.plays--; drawFull(); renderAll();
  if (S.score >= tgt()) setTimeout(blindComplete, 700);
  else if (S.plays === 0) setTimeout(function () {
    showGO('Scored ' + S.score.toLocaleString() + ' / ' + tgt().toLocaleString() + '.');
    var needed = tgt() - S.score;
    if (window._lastPlaySnap && DICT) {
      findBestMoveBackground(window._lastPlaySnap, function (best) {
        if (best && best.score >= needed) {
          var el = document.getElementById('gameover-best-play'); if (!el) return;
          el.innerHTML = '<div style="font-size:10px;color:#8880a8;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">You had this play:</div>'
            + '<div style="font-size:28px;font-weight:bold;color:#f0e080;letter-spacing:4px;margin:4px 0">' + best.word + '</div>'
            + '<div style="font-size:13px;color:#ff9090">for ' + best.score.toLocaleString() + ' pts — that would\'ve won.</div>';
          el.style.display = 'block';
        }
      });
    }
  }, 700);
}

function flashTiles(nt) {
  for (var i = 0; i < nt.length; i++) { var el = document.querySelector('[data-sq-idx="' + nt[i].idx + '"] .board-tile'); if (!el) continue; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); setTimeout((function (e) { return function () { e.classList.remove('flash'); }; })(el), 580); }
}

function shuffleHand() {
  if (S.phase !== 'play') return;
  var freeIdxs = [], freeTiles = [];
  for (var i = 0; i < S.hand.length; i++) { if (S.hand[i] && !S.hand[i].onBoard) { freeIdxs.push(i); freeTiles.push(S.hand[i]); } }
  if (freeTiles.length < 2) return;
  for (var i = freeTiles.length - 1; i > 0; i--) { var j = Math.floor(_rng() * (i + 1)); var tmp = freeTiles[i]; freeTiles[i] = freeTiles[j]; freeTiles[j] = tmp; }
  for (var i = 0; i < freeIdxs.length; i++)S.hand[freeIdxs[i]] = freeTiles[i];
  renderHand();
  for (var i = 0; i < HP.vx.length; i++)HP.vx[i] += (Math.random() - 0.5) * 22;
}

function discardTiles() {
  if (S.disc <= 0) { toast('No discards remaining!'); return; }
  var sel = []; for (var i = 0; i < S.hand.length; i++)if (S.hand[i] && S.hand[i].sel && !S.hand[i].onBoard) sel.push(i);
  if (!sel.length) { toast('Click tiles to select them first.'); return; }
  var selEls = Array.prototype.slice.call(document.getElementById('hand-area').querySelectorAll('.hand-tile.selected'));
  var N = selEls.length, done = 0;
  var dur = 180;
  function afterSnap() {
    var keptOldPos = {}; var _vi = 0;
    for (var _ki = 0; _ki < S.hand.length; _ki++) { var _t = S.hand[_ki]; if (_t && !_t.onBoard) { if (!_t.sel && HP.x[_vi] !== undefined) keptOldPos[_t.id] = HP.x[_vi]; _vi++; } }
    S.hand = S.hand.filter(function (t) { return !t || !t.sel || t.onBoard; }); HP.x = []; HP.vx = []; window._easyHint = null; S.disc--;
    for (var bi = 0; bi < B * B; bi++) { if (S.bt[bi] && S.bt[bi].isNew) { for (var k = 0; k < S.hand.length; k++) { if (S.hand[k] && S.hand[k].onBoard && S.hand[k]._boardSq === bi) { S.bt[bi].handIdx = k; break; } } } }
    var hasCooker = false; for (var i = 0; i < S.placed.length; i++)if (S.placed[i].id === 'pressure_cooker') { hasCooker = true; break; }
    if (hasCooker) S.discPressure = (S.discPressure || 0) + 1;
    var keptCount = S.hand.filter(function (t) { return t && !t.onBoard; }).length;
    drawFull(); renderAll(); _scheduleEasyHint();
    var _vi2 = 0; for (var _ki2 = 0; _ki2 < S.hand.length; _ki2++) { var _t2 = S.hand[_ki2]; if (_t2 && !_t2.onBoard) { if (keptOldPos[_t2.id] !== undefined) { HP.x[_vi2] = keptOldPos[_t2.id]; HP.vx[_vi2] = 0; } _vi2++; } }
    var allEls = Array.prototype.slice.call(document.getElementById('hand-area').querySelectorAll('.hand-tile'));
    var newEls = allEls.slice(keptCount);
    if (newEls.length) {
      var bagEl = document.getElementById('bag-btn'); var bagR = bagEl.getBoundingClientRect();
      bagEl.classList.add('bag-vacuuming');
      _burstTilesFromBag(newEls, bagR.left + bagR.width / 2, bagR.top + bagR.height / 2, 180, function () { bagEl.classList.remove('bag-vacuuming'); });
    }
  }
  if (!N) { afterSnap(); return; }
  for (var si = 0; si < N; si++) {
    (function (el) {
      var t0 = performance.now();
      function tick(now) {
        var t = Math.min(1, (now - t0) / dur), sc, op;
        if (t < 0.2) { sc = 1 + t / 0.2 * 0.3; op = 1; }
        else { var s = (t - 0.2) / 0.8; sc = 1.3 * (1 - s); op = Math.max(0, 1 - s * 1.5); }
        el.style.transform = 'scale(' + sc + ')'; el.style.opacity = op + '';
        if (t < 1) { requestAnimationFrame(tick); return; }
        el.style.visibility = 'hidden'; done++; if (done === N) afterSnap();
      }
      requestAnimationFrame(tick);
    })(selEls[si]);
  }
}
