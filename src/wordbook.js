// =====================================================================
// WORDBOOK — the player's personal dictionary of words they've played.
// Persists across runs in localStorage. Each entry stores the word's
// best (high) score and how many times it's been played.
// =====================================================================
var WORDBOOK_KEY = 'lexicon_wordbook';
var _wordbook = {};          // { WORD: { score:<best>, count:<times played> } }
var _wbSort = 'alpha';       // 'alpha' | 'length' | 'score'

function wordbookInit() {
  try {
    _wordbook = JSON.parse(localStorage.getItem(WORDBOOK_KEY) || '{}') || {};
  } catch (e) { _wordbook = {}; }
}

function _wordbookSave() {
  try { localStorage.setItem(WORDBOOK_KEY, JSON.stringify(_wordbook)); } catch (e) {}
}

// Called after a word scores. Adds new words; bumps the stored score only
// when this play beat the word's previous best.
function wordbookRecord(word, score) {
  if (!word) return;
  word = String(word).toUpperCase();
  if (!/^[A-Z]+$/.test(word)) return;
  score = Math.round(score || 0);
  var e = _wordbook[word];
  if (!e) {
    _wordbook[word] = { score: score, count: 1 };
  } else {
    e.count = (e.count || 0) + 1;
    if (score > (e.score || 0)) e.score = score;
  }
  _wordbookSave();
}

function _wordbookEntries() {
  var arr = [];
  for (var w in _wordbook) {
    if (!_wordbook.hasOwnProperty(w)) continue;
    arr.push({ word: w, score: _wordbook[w].score || 0, count: _wordbook[w].count || 0 });
  }
  if (_wbSort === 'score') {
    arr.sort(function (a, b) { return b.score - a.score || a.word.localeCompare(b.word); });
  } else if (_wbSort === 'length') {
    arr.sort(function (a, b) { return a.word.length - b.word.length || a.word.localeCompare(b.word); });
  } else { // alpha
    arr.sort(function (a, b) { return a.word.localeCompare(b.word); });
  }
  return arr;
}

function setWordbookSort(mode) {
  _wbSort = mode;
  renderWordbook();
}

// Distribution of all distinct playable words = dictionary, plus any easter-egg
// or bounty-theme words that aren't in the dictionary. Returns totals broken down
// by first letter and by word length (for per-section progress bars). Built once
// over the ~279k-word dictionary and cached.
var _wbDistCache = null;
function _wordbookDist() {
  if (_wbDistCache) return _wbDistCache;
  if (!(typeof DICT !== 'undefined' && DICT && DICT.size)) return { total: 0, byLetter: {}, byLen: {} };
  var byLetter = {}, byLen = {}, total = 0;
  function bump(w) {
    var c = w.charAt(0); byLetter[c] = (byLetter[c] || 0) + 1;
    var l = w.length; byLen[l] = (byLen[l] || 0) + 1;
    total++;
  }
  DICT.forEach(bump);
  var seen = {};
  function addExtra(raw) {
    var w = String(raw).toUpperCase();
    if (DICT.has(w) || seen[w]) return;
    seen[w] = 1; bump(w);
  }
  if (typeof EASTER_EGGS !== 'undefined' && EASTER_EGGS)
    for (var i = 0; i < EASTER_EGGS.length; i++) addExtra(EASTER_EGGS[i].word);
  var themesReady = (typeof BOUNTY_THEMES !== 'undefined' && BOUNTY_THEMES);
  if (themesReady)
    for (var t = 0; t < BOUNTY_THEMES.length; t++) {
      var ws = BOUNTY_THEMES[t].words || [];
      for (var j = 0; j < ws.length; j++) addExtra(ws[j]);
    }
  var dist = { total: total, byLetter: byLetter, byLen: byLen };
  // Only cache once both async sources (dict + themes) have loaded.
  if (themesReady) _wbDistCache = dist;
  return dist;
}
function _wordbookTotalPlayable() { return _wordbookDist().total; }

// Tiny values (≤0.0099%) show 2 significant figures so they never read as 0
// (e.g. 0.00036, 0.0099). Above 0.0099% it normalises to 2 decimals, then 1
// decimal from 10% up (e.g. 0.01 → 1.35 → 10.2 → 96.1).
function _wbFmtPct(pct) {
  if (pct <= 0) return '0.00%';
  if (pct <= 0.0099) return pct.toPrecision(2) + '%';
  if (pct < 10) return pct.toFixed(2) + '%';
  return pct.toFixed(1) + '%';
}

function _wbRowHtml(e) {
  // fmtNum: commas below 1e9, scientific notation (e.g. 1.23e9) above — matches
  // the score display everywhere else in the game.
  return '<div class="wb-row"><span class="wb-word">' + e.word + '</span>'
    + '<span class="wb-score">' + fmtNum(e.score) + '</span></div>';
}

// Section heading with its own progress bar: played / total playable words that
// share this first letter (or length).
function _wbHeadHtml(head, played, total) {
  var pct = total > 0 ? Math.min(100, (played / total) * 100) : 0;
  var right = total > 0 ? (played.toLocaleString() + ' / ' + total.toLocaleString() + ' · ' + _wbFmtPct(pct)) : '';
  return '<div class="wb-head">'
    + '<div class="wb-head-top"><span class="wb-head-name">' + head + '</span>'
    + '<span class="wb-head-pct">' + right + '</span></div>'
    + '<div class="wb-mini-track"><div class="wb-mini-fill" style="width:' + pct + '%"></div></div>'
    + '</div>';
}

function renderWordbook() {
  var cont = document.getElementById('wordbook-content');
  if (!cont) return;
  // Sort button states
  var btns = { alpha: 'wb-sort-alpha', length: 'wb-sort-length', score: 'wb-sort-score' };
  for (var k in btns) {
    var b = document.getElementById(btns[k]);
    if (b) b.className = 'btn ' + (_wbSort === k ? 'btn-green' : 'btn-gray');
  }
  var entries = _wordbookEntries();
  var header = document.getElementById('wordbook-header');
  if (header) header.textContent = 'Dictionary (' + entries.length + ' word' + (entries.length === 1 ? '' : 's') + ')';

  // Progress bar — % of all playable words discovered.
  var total = _wordbookTotalPlayable();
  var pct = total > 0 ? Math.min(100, (entries.length / total) * 100) : 0;
  var lbl = document.getElementById('wb-pct-label');
  if (lbl) lbl.textContent = total > 0 ? _wbFmtPct(pct) : '—';
  var sub = document.getElementById('wb-pct-count');
  if (sub) sub.textContent = total > 0 ? (entries.length.toLocaleString() + ' / ' + total.toLocaleString()) : '';
  var fill = document.getElementById('wb-bar-fill');
  if (fill) fill.style.width = pct + '%';

  cont.innerHTML = _wordbookListHtml();
}

// The word-list body HTML (empty message, flat high-score list, or letter/length
// sections with per-section bars) — shared by the modal and the embedded panel
// Dictionary so their rendering never drifts. Honours the current _wbSort.
function _wordbookListHtml() {
  var entries = _wordbookEntries();
  if (!entries.length)
    return '<p class="msub" style="text-align:center;padding:24px 0">No words yet — play a word to start your dictionary!</p>';
  var dist = _wordbookDist();
  // High-score sort is a flat list; alpha/length break into sections, each with
  // its own progress bar (played / total playable words in that section).
  if (_wbSort === 'score') {
    var flat = '';
    for (var i = 0; i < entries.length; i++) flat += _wbRowHtml(entries[i]);
    return flat;
  }
  // Group consecutive entries into sections by first letter / word length.
  var sections = [], cur = null;
  for (var j = 0; j < entries.length; j++) {
    var e = entries[j];
    var head = _wbSort === 'alpha' ? e.word.charAt(0) : (e.word.length + ' Letter');
    if (!cur || cur.head !== head) {
      var secTotal = _wbSort === 'alpha' ? (dist.byLetter[e.word.charAt(0)] || 0) : (dist.byLen[e.word.length] || 0);
      cur = { head: head, total: secTotal, rows: '', played: 0 };
      sections.push(cur);
    }
    cur.played++;
    cur.rows += _wbRowHtml(e);
  }
  var html = '';
  for (var s = 0; s < sections.length; s++)
    html += _wbHeadHtml(sections[s].head, sections[s].played, sections[s].total) + sections[s].rows;
  return html;
}

function openWordbookModal() {
  var dd = document.getElementById('menu-dropdown');
  if (dd) dd.style.display = 'none';
  renderWordbook();
  document.getElementById('wordbook-modal').style.display = 'flex';
}
