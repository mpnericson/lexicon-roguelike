// =====================================================================
// ACHIEVEMENTS — definitions, unlock tracking, display
// =====================================================================
var ACHIEVEMENTS = [
  {id:'first_word',     name:'First Word',      desc:'Play your first word.',                       icon:'📝'},
  {id:'first_bingo',   name:'Bingo!',           desc:'Use all 7 tiles in a single word.',           icon:'⭐'},
  {id:'palindrome',    name:'Reflective',       desc:'Play a palindrome.',                          icon:'🔄'},
  {id:'word_10',       name:'Wordsmith',        desc:'Play 10 words in a single run.',              icon:'📖'},
  {id:'score_500',     name:'High Scorer',      desc:'Score 500+ points in a single round.',        icon:'🎯'},
  {id:'score_2000',    name:'Grand Master',     desc:'Score 2000+ points in a single round.',       icon:'💥'},
  {id:'stage_1',       name:'Getting Started',  desc:'Complete Stage 1.',                           icon:'1️⃣'},
  {id:'stage_2',       name:'Halfway There',    desc:'Complete Stage 2.',                           icon:'2️⃣'},
  {id:'win',           name:'Champion',         desc:'Beat all 9 rounds.',                          icon:'🏆'},
  {id:'collect_5',     name:'Collector',        desc:'Own 5 or more stickers and stamps at once.',             icon:'🔵'},
  {id:'collect_10',    name:'Hoarder',          desc:'Own 10 or more stickers and stamps at once.',            icon:'🟣'},
  {id:'gold_50',       name:'Golden Touch',     desc:'Hold $50 gold at once.',                      icon:'💰'},
  {id:'bounty_5',      name:'Bounty Hunter',    desc:'Complete 5 bounties across all runs.',        icon:'🎯'},
  {id:'seeded_win',    name:'Seed of Destiny',  desc:'Win a seeded run.',                           icon:'🌱'},
];

var ACHV_KEY = 'lexicon_achv';
var _achvStore = {};
var _achvTotalBounties = 0;
var _achvTotalWords = 0;

function achvInit() {
  try {
    var raw = JSON.parse(localStorage.getItem(ACHV_KEY) || '{}');
    _achvStore = raw.unlocked || {};
    _achvTotalBounties = raw.totalBounties || 0;
    _achvTotalWords    = raw.totalWords    || 0;
  } catch(e) { _achvStore = {}; }
}

function _achvSave() {
  try {
    localStorage.setItem(ACHV_KEY, JSON.stringify({
      unlocked: _achvStore,
      totalBounties: _achvTotalBounties,
      totalWords:    _achvTotalWords
    }));
  } catch(e) {}
}

function achvUnlock(id) {
  if (_achvStore[id]) return;
  _achvStore[id] = Date.now();
  _achvSave();
  var def = null;
  for (var i = 0; i < ACHIEVEMENTS.length; i++) if (ACHIEVEMENTS[i].id === id) { def = ACHIEVEMENTS[i]; break; }
  if (def) setTimeout(function() { toast('Achievement: ' + def.name + '!'); }, 500);
}

// Call this at key game events. event is a string, data is optional context.
function achvCheck(event, data) {
  data = data || {};
  switch (event) {
    case 'word_played':
      _achvTotalWords++;
      achvUnlock('first_word');
      if (data.bingo)   achvUnlock('first_bingo');
      if (data.isPalin) achvUnlock('palindrome');
      if (_achvTotalWords >= 10)  achvUnlock('word_10');
      if (S.score >= 500)  achvUnlock('score_500');
      if (S.score >= 2000) achvUnlock('grand_master');
      _achvSave();
      break;
    case 'bounty_complete':
      _achvTotalBounties++;
      if (_achvTotalBounties >= 5) achvUnlock('bounty_5');
      _achvSave();
      break;
    case 'round_complete':
      if (S.ai >= 1) achvUnlock('stage_1');
      if (S.ai >= 2) achvUnlock('stage_2');
      break;
    case 'win':
      achvUnlock('win');
      if (S.seed) achvUnlock('seeded_win');
      break;
    case 'shop_exit':
      var _stickerCount=(S.placed||[]).length+(S.stamps||[]).length;
      if (_stickerCount >= 5)  achvUnlock('collect_5');
      if (_stickerCount >= 10) achvUnlock('collect_10');
      if (S.gold >= 50) achvUnlock('gold_50');
      break;
  }
}

function openAchievementsModal() {
  var cont = document.getElementById('achv-content');
  if (!cont) return;
  cont.innerHTML = '';
  var unlocked = 0;
  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    var a = ACHIEVEMENTS[i];
    var done = !!_achvStore[a.id];
    if (done) unlocked++;
    var el = document.createElement('div');
    el.className = 'achv-item' + (done ? ' achv-done' : '');
    el.innerHTML = '<span class="achv-icon">' + (done ? a.icon : '🔒') + '</span>'
      + '<div><div class="achv-name">' + a.name + '</div>'
      + '<div class="achv-desc">' + (done ? a.desc : '???') + '</div></div>';
    cont.appendChild(el);
  }
  var header = document.getElementById('achv-header');
  if (header) header.textContent = 'Achievements (' + unlocked + ' / ' + ACHIEVEMENTS.length + ')';
  document.getElementById('achv-modal').style.display = 'flex';
}
