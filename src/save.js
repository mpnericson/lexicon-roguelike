// =====================================================================
// SAVE — localStorage persistence for run state
// =====================================================================
var SAVE_VERSION = 1;
var SAVE_KEY = 'lexicon_save';

function saveGame() {
  if (!S || !S.seed || S.devMode) return;
  if (S.tutorial) return; // mid-tutorial state is never persisted
  try {
    var data = {
      v: SAVE_VERSION,
      ts: Date.now(),
      seed: S.seed,
      ai: S.ai, bi: S.bi,
      score: S.score, gold: S.gold, plays: S.plays, disc: S.disc,
      discardsThisRound: S.discardsThisRound||0,
      wtr: S.wtr, permTs: S.ts,
      bag: S.bag,
      hand: (S.hand || []).map(function(t) {
        if (!t) return null;
        return {letter:t.letter,isBlank:t.isBlank,id:t.id,blankAs:t.blankAs||null,
                sel:false,onBoard:false,variant:t.variant||null,material:t.material||null,_alchSc:t._alchSc||0};
      }),
      board: S.board,
      bt: (S.bt || []).map(function(bt) {
        // Only save committed (non-new) tiles; new tiles return to hand on load
        return (bt && !bt.isNew) ? bt : null;
      }),
      placed: (S.placed || []).map(function(p) { return {id:p.id, sqIdx:p.sqIdx}; }),
      discPressure: S.discPressure || 0,
      palUnlocked: !!S.palUnlocked,
      phase: (S.phase === 'shop' || S.phase === 'placing') ? 'play' : S.phase,
      bounties: S.bounties || [],
      bhMult: S.bhMult || 1,
      palMult: S.palMult || 1,
      playerMult: S.playerMult || 1,
      cartographerMult: S.cartographerMult || 1,
      palWords: S.palWords || [],
      lastWordLen: S.lastWordLen || 0,
      endless: !!S.endless,
      endlessRound: S.endlessRound || 0,
      roundsCompleted: S.roundsCompleted || 0,
      drunkStreak: S.drunkStreak || 0,
      constraintOrder: S.constraintOrder||[],
      usedLetters: Array.from(S.usedLetters||[]),
      stickersSoldThisBoard: S.stickersSoldThisBoard||0,
      crossroadsCount: S.crossroadsCount||0,
      ouroborosBonus: S.ouroborosBonus||0,
      gamblerSpins: S.gamblerSpins||0,
      stamps: (S.stamps||[]).map(function(ts){return{id:ts.id,sellBonus:ts.sellBonus||0};}),
      stickerInventory: (S.stickerInventory||[]).map(function(p){return{id:p.id};}),
      consumables: (S.consumables||[]).map(function(c){return{id:c.id};}),
      lastTicket: S.lastTicket||null,
      pool: (S.pool||[]).map(function(t){return{letter:t.letter,isBlank:!!t.isBlank,id:t.id,variant:t.variant||null,material:t.material||null};})
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch(e) {}
}

function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch(e) { return false; }
}

function loadGame() {
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    var d = JSON.parse(raw);
    if (!d || d.v !== SAVE_VERSION) { clearSave(); return false; }
    _rngSeed(d.seed);
    S = {
      bag:   d.bag || [],
      hand:  (d.hand || []).map(function(t) {
        if (!t) return null;
        return Object.assign({sel:false,onBoard:false,_boardSq:undefined,state:'hand'}, t);
      }),
      board: d.board || Array(B * B).fill(null),
      bt:    d.bt    || Array(B * B).fill(null),
      btTop: Array(B * B).fill(null),
      ai: d.ai || 0, bi: d.bi || 0,
      score: d.score || 0, gold: d.gold || 0,
      plays: d.plays || 4,  disc: d.disc || 3,
      discardsThisRound: d.discardsThisRound || 0,
      wtr: d.wtr || 0, ts: d.permTs || 0,
      placed: (d.placed || []).map(function(p) {
        var def = sqd(p.id);
        return def ? Object.assign({}, def, {sqIdx: p.sqIdx}) : null;
      }).filter(Boolean),
      discPressure: d.discPressure || 0,
      palUnlocked:    !!d.palUnlocked,
      phase: d.phase || 'play',
      stickerInventory: (d.stickerInventory||[]).map(function(p){return(p&&p.id)?{id:p.id}:null;}).filter(Boolean),
      sqHand: [], sqStaged: {},
      seed: d.seed,
      bounties: (d.bounties||[]).map(function(b){
        if (!b) return null;
        // Current scroll format: {theme?, words:[{word,reward}]}
        if (b.words) return {theme: b.theme, words: b.words};
        // Legacy single-word saves
        if (b.word) return {words: [{word: b.word, reward: b.reward||5}]};
        return null;
      }).filter(Boolean),
      bhMult: d.bhMult || 1,
      palMult: d.palMult || 1,
      playerMult: d.playerMult || 1,
      cartographerMult: d.cartographerMult || 1,
      palWords: d.palWords || [],
      lastWordLen: d.lastWordLen || 0,
      endless: !!d.endless,
      endlessRound: d.endlessRound || 0,
      roundsCompleted: d.roundsCompleted || 0,
      drunkStreak: d.drunkStreak || 0,
      constraintOrder: d.constraintOrder||[],
      usedLetters: new Set(d.usedLetters||[]),
      stickersSoldThisBoard: d.stickersSoldThisBoard||d.stickersSoldThisStage||0, // d.stickersSoldThisStage: pre-rename saves
      crossroadsCount: d.crossroadsCount||0,
      ouroborosBonus: d.ouroborosBonus||0,
      gamblerSpins: d.gamblerSpins||0,
      stamps: ((d.stamps||d.tileStickers)||[]).map(function(ts){return(ts&&ts.id&&sqd(ts.id))?{id:ts.id,sellBonus:ts.sellBonus||0}:null;}).filter(Boolean), // d.tileStickers: pre-rename saves; sqd check drops stamps removed from the game (the_purist)
      consumables: (d.consumables||[]).map(function(c){return(c&&c.id&&tkd(c.id))?{id:c.id}:null;}).filter(Boolean),
      lastTicket: (d.lastTicket&&tkd(d.lastTicket))?d.lastTicket:null,
      devMode: false,
      pool: d.pool || (function(){
        var pm={};
        (d.bag||[]).forEach(function(t){if(t&&t.id)pm[t.id]={letter:t.letter,isBlank:!!t.isBlank,id:t.id,variant:t.variant||null};});
        (d.hand||[]).forEach(function(t){if(t&&t.id)pm[t.id]={letter:t.letter,isBlank:!!t.isBlank,id:t.id,variant:t.variant||null};});
        (d.bt||[]).forEach(function(bt){if(bt&&bt.tileId&&!bt.isNew)pm[bt.tileId]={letter:bt.letter,isBlank:!!bt.isBlank,id:bt.tileId,variant:bt.variant||null};});
        return Object.keys(pm).map(function(k){return pm[k];});
      })()
    };
    // Heal saves from when a stamp def lacked type:'stamp' and leaked into the
    // sticker pools (The Miser): move stamp-typed entries out of the sticker
    // locations into the stamp bar (refund cost if the bar is full).
    (function(){
      var moved = [];
      S.placed = S.placed.filter(function(p) {
        if (p.type !== 'stamp') return true;
        if (S.board[p.sqIdx] === p.id) S.board[p.sqIdx] = null;
        moved.push(p.id); return false;
      });
      S.stickerInventory = S.stickerInventory.filter(function(p) {
        var def = sqd(p.id);
        if (!def || def.type !== 'stamp') return true;
        moved.push(p.id); return false;
      });
      moved.forEach(function(id) {
        if (S.stamps.length < 5) S.stamps.push({id:id});
        else S.gold += (sqd(id) || {}).cost || 0;
      });
    })();
    return true;
  } catch(e) { clearSave(); return false; }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch(e) {}
}

// Restore UI state after loadGame() has set up S.
function resumeGame() {
  window._easyHint = null;
  shopPool = {sq:[], packs:[], bounties:[]};
  activeDrag = null;
  document.getElementById('shop-screen').style.display = 'none';
  document.getElementById('play-controls').style.display = 'flex';
  document.getElementById('placing-controls').style.display = 'none';
  HP.x = []; HP.vx = []; HP.tiles = [];
  if (typeof _resetArcQueue === 'function') _resetArcQueue();
  if (typeof _resetZoom === 'function') _resetZoom();
  drawFull();
  renderAll();
  if (S.phase === 'play') _rankObserve();
}
