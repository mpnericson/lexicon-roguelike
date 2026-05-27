// =====================================================================
// SAVE — localStorage persistence for run state
// =====================================================================
var SAVE_VERSION = 1;
var SAVE_KEY = 'lexicon_save';

function saveGame() {
  if (!S || !S.seed || S.devMode) return;
  try {
    var data = {
      v: SAVE_VERSION,
      ts: Date.now(),
      seed: S.seed,
      ai: S.ai, bi: S.bi,
      score: S.score, gold: S.gold, plays: S.plays, disc: S.disc,
      wtr: S.wtr, permTs: S.ts,
      bag: S.bag,
      hand: (S.hand || []).map(function(t) {
        if (!t) return null;
        return {letter:t.letter,isBlank:t.isBlank,id:t.id,blankAs:t.blankAs||null,
                sel:false,onBoard:false,variant:t.variant||null,blueBonus:t.blueBonus||0,_alchSc:t._alchSc||0};
      }),
      board: S.board,
      bt: (S.bt || []).map(function(bt) {
        // Only save committed (non-new) tiles; new tiles return to hand on load
        return (bt && !bt.isNew) ? bt : null;
      }),
      placed: (S.placed || []).map(function(p) { return {id:p.id, sqIdx:p.sqIdx}; }),
      discPressure: S.discPressure || 0,
      censorApplied: !!S.censorApplied,
      alchemistUsed: !!S.alchemistUsed,
      palUnlocked: !!S.palUnlocked,
      phase: (S.phase === 'shop' || S.phase === 'placing') ? 'play' : S.phase,
      bounties: S.bounties || [],
      bhMult: S.bhMult || 1,
      lastWordLen: S.lastWordLen || 0,
      endless: !!S.endless,
      endlessRound: S.endlessRound || 0,
      roundsCompleted: S.roundsCompleted || 0,
      localCooldowns: Array.from(S.localCooldowns||[])
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
        return Object.assign({sel:false,onBoard:false,_boardSq:undefined}, t);
      }),
      board: d.board || Array(B * B).fill(null),
      bt:    d.bt    || Array(B * B).fill(null),
      ai: d.ai || 0, bi: d.bi || 0,
      score: d.score || 0, gold: d.gold || 0,
      plays: d.plays || 4,  disc: d.disc || 3,
      wtr: d.wtr || 0, ts: d.permTs || 0,
      placed: (d.placed || []).map(function(p) {
        var def = sqd(p.id);
        return def ? Object.assign({}, def, {sqIdx: p.sqIdx}) : null;
      }).filter(Boolean),
      discPressure: d.discPressure || 0,
      censorApplied:  !!d.censorApplied,
      alchemistUsed:  !!d.alchemistUsed,
      palUnlocked:    !!d.palUnlocked,
      phase: d.phase || 'play',
      pendingSquares: [], sqHand: [], sqStaged: {},
      seed: d.seed, _slotMachineRoll: null,
      bounties: d.bounties || [],
      bhMult: d.bhMult || 1,
      lastWordLen: d.lastWordLen || 0,
      endless: !!d.endless,
      endlessRound: d.endlessRound || 0,
      roundsCompleted: d.roundsCompleted || 0,
      localCooldowns: new Set(d.localCooldowns||[]),
      devMode: false
    };
    return true;
  } catch(e) { clearSave(); return false; }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch(e) {}
}

// Restore UI state after loadGame() has set up S.
function resumeGame() {
  window._easyHint = null;
  shopPool = {sq:[], tileCards:[], packs:[], bounties:[]};
  activeDrag = null;
  document.getElementById('shop-screen').style.display = 'none';
  document.getElementById('play-controls').style.display = 'flex';
  document.getElementById('placing-controls').style.display = 'none';
  HP.x = []; HP.vx = []; HP.tiles = [];
  if (typeof _resetZoom === 'function') _resetZoom();
  renderAll();
  if (S.phase === 'play') _scheduleRankSolve();
}
