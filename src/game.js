// =====================================================================
// GAME STATE — global state, lifecycle, modals, utilities
// =====================================================================
var BOUNTY_WORDS = [
  // 3-4 letters — cost $2, reward $5
  { word: 'CAT', cost: 2, reward: 5 }, { word: 'DOG', cost: 2, reward: 5 }, { word: 'BAT', cost: 2, reward: 5 },
  { word: 'HAT', cost: 2, reward: 5 }, { word: 'RUN', cost: 2, reward: 5 }, { word: 'JAM', cost: 2, reward: 5 },
  { word: 'BOX', cost: 2, reward: 5 }, { word: 'GEM', cost: 2, reward: 5 }, { word: 'OAK', cost: 2, reward: 5 },
  { word: 'AXE', cost: 2, reward: 5 }, { word: 'JOY', cost: 2, reward: 5 }, { word: 'MUG', cost: 2, reward: 5 },
  { word: 'WEB', cost: 2, reward: 5 }, { word: 'ICE', cost: 2, reward: 5 }, { word: 'PIE', cost: 2, reward: 5 },
  { word: 'FOX', cost: 2, reward: 5 }, { word: 'LOG', cost: 2, reward: 5 }, { word: 'HOP', cost: 2, reward: 5 },
  { word: 'MAP', cost: 2, reward: 5 }, { word: 'CUP', cost: 2, reward: 5 }, { word: 'DIM', cost: 2, reward: 5 },
  { word: 'WAX', cost: 2, reward: 6 }, { word: 'RUG', cost: 2, reward: 5 }, { word: 'ZAP', cost: 2, reward: 6 },
  { word: 'VEX', cost: 2, reward: 6 }, { word: 'TAX', cost: 2, reward: 6 }, { word: 'SKY', cost: 2, reward: 5 },
  { word: 'FLY', cost: 2, reward: 5 }, { word: 'BIG', cost: 2, reward: 5 }, { word: 'SIT', cost: 2, reward: 5 },
  // 5 letters — cost $3, reward $8
  { word: 'STONE', cost: 3, reward: 8 }, { word: 'BREAD', cost: 3, reward: 8 }, { word: 'FLAME', cost: 3, reward: 8 },
  { word: 'BRAVE', cost: 3, reward: 8 }, { word: 'CLEAN', cost: 3, reward: 8 }, { word: 'FROST', cost: 3, reward: 8 },
  { word: 'GLASS', cost: 3, reward: 8 }, { word: 'PLANT', cost: 3, reward: 8 }, { word: 'DREAM', cost: 3, reward: 8 },
  { word: 'STEAM', cost: 3, reward: 8 }, { word: 'CRANE', cost: 3, reward: 8 }, { word: 'BLAZE', cost: 3, reward: 8 },
  { word: 'CHESS', cost: 3, reward: 9 }, { word: 'CRISP', cost: 3, reward: 9 }, { word: 'BRISK', cost: 3, reward: 9 },
  { word: 'QUIRK', cost: 3, reward: 10 }, { word: 'FJORD', cost: 3, reward: 11 }, { word: 'LYMPH', cost: 3, reward: 11 },
  { word: 'PLUMB', cost: 3, reward: 9 }, { word: 'SNOWY', cost: 3, reward: 8 },
  // 6-7 letters — cost $4, reward $13
  { word: 'CASTLE', cost: 4, reward: 13 }, { word: 'FROZEN', cost: 4, reward: 13 }, { word: 'GRAVEL', cost: 4, reward: 13 },
  { word: 'JIGSAW', cost: 4, reward: 14 }, { word: 'FRENZY', cost: 4, reward: 13 }, { word: 'HUMBLE', cost: 4, reward: 13 },
  { word: 'SWORDS', cost: 4, reward: 13 }, { word: 'PLAGUE', cost: 4, reward: 13 }, { word: 'BREEZE', cost: 4, reward: 13 },
  { word: 'JUNGLE', cost: 4, reward: 13 }, { word: 'MUSCLE', cost: 4, reward: 13 }, { word: 'GAZEBO', cost: 4, reward: 14 },
];
var S = {};
var DICT = null;
var activeDrag = null;
var _hl = -1;
var viewingBoard = false;
var shopPool = { sq: [], tileCards: [], tilePack: null, bounties: [] };

function buildBag() {
  var bag = []; var ks = Object.keys(DIST);
  for (var i = 0; i < ks.length; i++)for (var j = 0; j < DIST[ks[i]]; j++)bag.push({ letter: ks[i], isBlank: false, id: uid() });
  bag.push({ letter: '_', isBlank: true, id: uid() }); bag.push({ letter: '_', isBlank: true, id: uid() });
  return shuffle(bag);
}

function startGame(seed) {
  closeAllModals();
  var s = (seed !== undefined && seed !== null) ? ((parseInt(seed) >>> 0) || 1) : Math.floor(Math.random() * 900000) + 100000;
  _rngSeed(s);
  S = {
    bag: buildBag(), hand: [], board: Array(B * B).fill(null), bt: Array(B * B).fill(null),
    ai: 0, bi: 0, score: 0, gold: 4, plays: 4, disc: 3, wtb: 0, ts: 0, placed: [], discPressure: 0, censorApplied: false, alchemistUsed: false, palUnlocked: false, devMode: false,
    phase: 'play', pendingSquares: [], sqHand: [], sqStaged: {}, seed: s, _slotMachineRoll: null, bounties: [], bhMult: 1
  };
  window._easyHint = null;
  shopPool = { sq: [], tileCards: [], tilePack: null, bounties: [] }; activeDrag = null;
  document.getElementById('shop-screen').style.display = 'none';
  document.getElementById('play-controls').style.display = 'flex';
  document.getElementById('placing-controls').style.display = 'none';
  HP.x = []; HP.vx = []; HP.tiles = [];
  if (typeof _resetZoom === 'function') _resetZoom();
  drawFull(); renderAll();
}

function drawFull() {
  var n = 7 - S.hand.length;
  if (S.devMode) {
    var _dp = 'AAEEEIIOOUUTTRRSSNNLLDDGG'.split('');
    for (var i = 0; i < n; i++) { var _dl = _dp[Math.floor(Math.random() * _dp.length)]; S.hand.push({ letter: _dl, isBlank: false, id: uid(), blankAs: null, sel: false, onBoard: false, variant: null, blueBonus: 0 }); }
  } else {
    for (var i = 0; i < n && S.bag.length > 0; i++) { var t = S.bag.pop(); S.hand.push({ letter: t.letter, isBlank: t.isBlank, id: t.id, blankAs: null, sel: false, onBoard: false, variant: t.variant || null, blueBonus: t.blueBonus || 0 }); }
  }
  if (!S.censorApplied) {
    var hasCensor = false; for (var i = 0; i < S.placed.length; i++)if (S.placed[i].id === 'censor') { hasCensor = true; break; }
    if (hasCensor && S.hand.length > 1) {
      S.censorApplied = true;
      var freeHand = S.hand.filter(function (t) { return !t.onBoard; });
      if (freeHand.length > 0) {
        var minSc = Infinity, minTile = null;
        for (var i = 0; i < freeHand.length; i++) { var sc = freeHand[i].isBlank ? 0 : (LS[freeHand[i].letter] || 0); if (sc < minSc) { minSc = sc; minTile = freeHand[i]; } }
        if (minTile) { S.hand = S.hand.filter(function (t) { return t !== minTile; }); toast('Censor discards your lowest tile!'); }
      }
    }
  }
  _scheduleEasyHint();
}

var _easyHintTimer = null;
function _scheduleEasyHint() {
  if (_easyHintTimer) clearTimeout(_easyHintTimer); _easyHintTimer = null;
  var hasEM = false; for (var i = 0; i < S.placed.length; i++)if (S.placed[i].id === 'easy_mode') { hasEM = true; break; }
  if (!hasEM || !DICT) return;
  _easyHintTimer = setTimeout(function () {
    _easyHintTimer = null;
    var snap = {
      hand: S.hand.map(function (t) { return t ? Object.assign({}, t, { onBoard: false, _boardSq: undefined }) : null; }),
      bt: S.bt.map(function (bt) { return (bt && !bt.isNew) ? Object.assign({}, bt) : null; }),
      board: S.board.slice()
    };
    findBestMoveBackground(snap, function (best) { window._easyHint = best; renderBoard(); });
  }, 600);
}

function cb() { return ANTES[S.ai][S.bi]; }
function tgt() { return cb()[2]; }

function blindComplete() {
  var reward = 2 + S.bi * 2 + (S.ai * 2);
  var playsBonus = S.plays > 0 ? S.plays : 0;
  S.gold += reward + playsBonus;
  var hasSheriff = false; for (var _si = 0; _si < S.placed.length; _si++)if (S.placed[_si].id === 'sheriffs_office') { hasSheriff = true; break; }
  var sheriffWord = '';
  if (hasSheriff) {
    var _activeWords = (S.bounties || []).map(function (b) { return b.word; });
    var _avail = BOUNTY_WORDS.filter(function (b) { return _activeWords.indexOf(b.word) < 0; });
    if (_avail.length) { var _pick = _avail[Math.floor(_rng() * _avail.length)]; S.bounties = S.bounties || []; S.bounties.push({ word: _pick.word, reward: _pick.reward }); sheriffWord = _pick.word; }
  }
  document.getElementById('round-title').textContent = (cb()[0] ? cb()[0] + ' cleared!' : 'Round complete!');
  var msg = 'You scored ' + S.score.toLocaleString() + ', beating ' + tgt().toLocaleString() + '.';
  if (playsBonus > 0) msg += ' +$' + playsBonus + ' efficiency bonus!';
  if (sheriffWord) msg += ' Sheriff: free bounty "' + sheriffWord + '"!';
  document.getElementById('round-msg').textContent = msg;
  document.getElementById('round-reward').textContent = '+$' + (reward + playsBonus) + ' gold';
  document.getElementById('round-modal').style.display = 'flex';
}

function advanceBlind() {
  document.getElementById('round-modal').style.display = 'none'; S.bi++;
  var newAnte = S.bi >= 3;
  if (newAnte) { S.ai++; S.bi = 0; if (S.ai >= ANTES.length) { showWin(); return; } }
  if (typeof _resetZoom === 'function') _resetZoom();
  animBoardToShop(function () {
    if (newAnte) { clearBoardLetters(); S.bag = buildBag(); toast('New ante — letters cleared, stickers kept!'); }
    S.score = 0; S.plays = 4; S.disc = 3; S.wtb = 0; S.ts = 0; S.discPressure = 0; S.censorApplied = false; S.alchemistUsed = false; S.palUnlocked = false;
    S.pendingSquares = []; S.sqHand = []; S.sqStaged = {};
    recallAll(); HP.x = []; HP.vx = []; drawFull(); renderAll(); shopPool = { sq: [], tileCards: [], tilePack: null, bounties: [] }; enterShopPhase();
  });
}

function showGO(msg) {
  document.getElementById('gameover-msg').textContent = msg;
  var gbp = document.getElementById('gameover-best-play'); if (gbp) gbp.style.display = 'none';
  document.getElementById('gameover-modal').style.display = 'flex';
}
function showWin() { document.getElementById('win-modal').style.display = 'flex'; }

function closeAllModals() {
  ['pack-modal', 'sq-modal', 'bag-modal', 'blank-modal', 'round-modal', 'gameover-modal', 'win-modal', 'hammer-modal', 'forge-modal', 'board-preview-modal', 'alchemist-modal', 'collection-modal'].forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; });
  document.getElementById('shop-screen').style.display = 'none';
}

function toast(msg) { var el = document.getElementById('toast'); el.textContent = msg; el.style.display = 'block'; clearTimeout(toast._t); toast._t = setTimeout(function () { el.style.display = 'none'; }, 2500); }

function openBagModal() {
  document.getElementById('bag-mc').textContent = S.bag.length + ' tiles remaining.';
  var cont = document.getElementById('bag-counts'); cont.innerHTML = '';
  cont.style.cssText = 'display:flex;flex-direction:column;gap:12px';

  var variants = S.bag.filter(function (t) { return t.variant; });
  var plains = S.bag.filter(function (t) { return !t.variant; });

  function secLabel(text) {
    var l = document.createElement('div');
    l.style.cssText = 'font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#8880a8;margin-bottom:4px';
    l.textContent = text; return l;
  }
  function tileEl(letter, isBlank, sc, variant) {
    var badge = variant === 'gold' ? '<span class="vbadge vbadge-gold">$</span>' :
      variant === 'blue' ? '<span class="vbadge vbadge-blue">+' + (LS[letter] || 0) + '</span>' :
        variant === 'red' ? '<span class="vbadge vbadge-red">×2</span>' : '';
    var el = document.createElement('div');
    el.className = 'tile' + (isBlank ? ' blank-t' : '') + (variant ? ' var-' + variant : '');
    el.style.cssText = 'width:44px;height:52px;position:relative;flex-shrink:0;cursor:default';
    el.innerHTML = '<span class="tl" style="font-size:18px">' + letter + '</span><span class="ts" style="font-size:7px">' + sc + '</span>' + badge;
    return el;
  }

  if (variants.length > 0) {
    var vsec = document.createElement('div');
    vsec.appendChild(secLabel('Special Tiles'));
    var vrow = document.createElement('div'); vrow.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px';
    for (var i = 0; i < variants.length; i++) {
      var t = variants[i];
      vrow.appendChild(tileEl(t.isBlank ? '' : t.letter, t.isBlank, t.isBlank ? 0 : (LS[t.letter] || 0), t.variant));
    }
    vsec.appendChild(vrow); cont.appendChild(vsec);
  }

  if (plains.length > 0) {
    var psec = document.createElement('div');
    psec.appendChild(secLabel('Tiles'));
    var counts = {};
    for (var i = 0; i < plains.length; i++) { var l = plains[i].isBlank ? '_' : plains[i].letter; counts[l] = (counts[l] || 0) + 1; }
    var prow = document.createElement('div'); prow.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px';
    var ks = Object.keys(counts).sort();
    for (var i = 0; i < ks.length; i++) {
      var l = ks[i], cnt = counts[l], isBlank = (l === '_');
      var el = tileEl(isBlank ? '' : l, isBlank, isBlank ? 0 : (LS[l] || 0), null);
      if (cnt > 1) {
        var ct = document.createElement('span');
        ct.style.cssText = 'position:absolute;top:1px;left:3px;font-size:8px;font-weight:bold;color:#2a1f0e;line-height:1';
        ct.textContent = '×' + cnt; el.appendChild(ct);
      }
      prow.appendChild(el);
    }
    psec.appendChild(prow); cont.appendChild(psec);
  }

  document.getElementById('bag-modal').style.display = 'flex';
}

function openBlankChooser(hi, cb2) {
  var grid = document.getElementById('blank-grid'); grid.innerHTML = '';
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(function (l) {
    var btn = document.createElement('button'); btn.className = 'blank-btn'; btn.textContent = l;
    btn.onclick = function () {
      var t = S.hand[hi]; t.blankAs = l;
      if (t._devBlank) t._alchSc = LS[l] || 0;
      document.getElementById('blank-modal').style.display = 'none'; if (cb2) cb2(); renderHand();
    };
    grid.appendChild(btn);
  });
  document.getElementById('blank-modal').style.display = 'flex';
}
