// =====================================================================
// SCORING — live-state adapters + score animation
//
// The scoring algorithm itself lives in src/score_engine.js
// (runScoreEngine) and is a pure function of its input. This file:
//   1. Extracts play data from live game state (newTiles, wordDir,
//      extractAt, getAllWords).
//   2. Builds the engine input from S (scorePlay, buildEngineState) and
//      commits results back (cooldowns).
//   3. Plays back the engine's event log (runScoreAnim + sticker floats).
//
// Cooldowns: local effects are gated by S.localCooldowns (a Set of sqIdx).
// Within one play no flags are set — a square can fire multiple times.
// After scorePlay() commits, every activated square is added to
// S.localCooldowns, which persists until clearBoardLetters() (between boards).
// =====================================================================

function newTiles(){
  var r=[];
  for(var i=0;i<B*B;i++){
    // Jenga: btTop tile overrides the committed tile below for this position
    var tt=S.btTop&&S.btTop[i];
    if(tt&&tt.isNew){r.push({idx:i,row:Math.floor(i/B),col:i%B,letter:tileDisplayLetter(tt),isBlank:!!tt.isBlank,sc:tt.isBlank?(tt._alchSc||0):(LS[tt.letter]||0),variant:tt.variant||null,isNew:true});continue;}
    var t=S.bt[i];
    if(t&&t.isNew)r.push({idx:i,row:Math.floor(i/B),col:i%B,
      letter:tileDisplayLetter(t),isBlank:!!t.isBlank,
      sc:t.isBlank?(t._alchSc||0):(LS[t.letter]||0),
      variant:t.variant||null,isNew:true});
  }
  return r;
}

// Direction / word extraction delegate to the pure engine helpers
// (_engWordDir/_engExtract in score_engine.js) over the merged live board,
// so the logic exists in exactly one place.

function wordDir(nt){
  return _engWordDir(_liveTiles().tiles,nt);
}

function extractAt(ar,ac,dir){
  var lv=_liveTiles();
  return _engExtract(lv.tiles,{},lv.jengaTops,ar,ac,dir);
}

// Returns every formed word (main + cross) as {word, idxs, main} — used for
// validation, easter-egg / bounty matching, and wordbook recording. idxs are
// the board indices of the word's tiles (for bounty glow).
function getAllWords(nt,dir){
  var lv=_liveTiles(),cache={};
  var main=_engExtract(lv.tiles,cache,lv.jengaTops,nt[0].row,nt[0].col,dir);
  if(!main)return[];
  var words=[{word:main.word,idxs:main.tiles.map(function(t){return t.idx;}),main:true}];
  var cx=dir==='h'?'v':'h';
  var seen={};
  for(var i=0;i<nt.length;i++){
    var k=nt[i].row+','+nt[i].col;if(seen[k])continue;seen[k]=1;
    // Jenga stacked tiles don't form cross-words
    if(lv.jengaTops.has(nt[i].idx))continue;
    var cxw=_engExtract(lv.tiles,cache,lv.jengaTops,nt[i].row,nt[i].col,cx);
    if(cxw&&cxw.tiles.length>=2)words.push({word:cxw.word,idxs:cxw.tiles.map(function(t){return t.idx;}),main:false});
  }
  return words;
}

// ---- Engine adapters — build runScoreEngine input from live game state ----

// Full-board tile view with Jenga tops merged over the tiles they cover.
function _liveTiles(){
  var tiles=new Array(B*B),jengaTops=new Set(),jengaUnder=null;
  function addUnder(idx,src){
    if(!jengaUnder)jengaUnder={};
    jengaUnder[idx]={letter:tileDisplayLetter(src),isBlank:!!src.isBlank,
      sc:src.isBlank?(src._alchSc||0):(LS[src.letter]||0),variant:src.variant||null};
  }
  for(var i=0;i<B*B;i++){
    var tt=S.btTop&&S.btTop[i];
    if(tt&&tt.isNew){
      // Fresh stack this turn: the committed tile beneath is the buried tile.
      tiles[i]=tt;jengaTops.add(i);
      if(S.bt[i])addUnder(i,S.bt[i]);
    }else{
      tiles[i]=S.bt[i]||null;
      // Committed stack from a previous play retains its buried tile (_buried),
      // which keeps scoring in any word that passes through this square.
      if(S.bt[i]&&S.bt[i]._buried)addUnder(i,S.bt[i]._buried);
    }
  }
  return{tiles:tiles,jengaTops:jengaTops,jengaUnder:jengaUnder};
}

// Snapshot of every S field that influences scoring. Sticker/stamp hooks read
// these through ctx.state instead of touching S directly.
function buildEngineState(freeHandCount){
  return{
    freeHandCount:freeHandCount,
    constraint:currentConstraint(),
    usedLetters:S.usedLetters,
    stickersSold:(S.stickersSoldThisBoard||0)>0,
    pendingBountyReward:S._pendingBountyReward||0,
    drunkValid:S._drunkValid,
    magicStreak:S.magicStreak||0,
    drunkStreak:S.drunkStreak||0,
    palMult:S.palMult||1,
    playerMult:S.playerMult||1,
    cartographerMult:S.cartographerMult||1,
    bhMult:S.bhMult||1,
    crossroadsCount:S.crossroadsCount||0,
    ouroborosBonus:S.ouroborosBonus||0,
    gamblerSpins:S.gamblerSpins||0,
    discardsLeft:S.disc||0,
    discPressure:S.discPressure||0,
    bagColouredCount:S.bag?S.bag.filter(function(t){return t.variant;}).length:0
  };
}

// Synchronous dictionary check (validWord is async only for its API fallback;
// with the local dict loaded it's a plain Set lookup).
function _dictHas(word){return !!(typeof DICT!=='undefined'&&DICT&&DICT.size>0&&DICT.has(word.toUpperCase()));}

// For each Jenga stack, the buried tile forms a cross word (its letter + the
// committed neighbours perpendicular to the main word). Returns the stack-square
// indices whose buried cross word is a valid dictionary word — these are the
// only ones the engine will score. Shared logic lives in _engJengaCrossIdxs
// (score_engine.js) so the solver judges validity identically.
function _jengaCrossIdxs(lv,dir){
  return _engJengaCrossIdxs(lv.tiles,lv.jengaTops,dir,_dictHas);
}

// Mirror: the set of played words that read as valid words backwards too, so
// the engine scores them twice. Only computed when the stamp is owned. Shared
// helper (_engMirrorWords) keeps validity identical to the solver's valuation.
function _mirrorWords(lv,nt,dir){
  if(!hasStamp('mirror'))return null;
  return _engMirrorWords(lv.tiles,nt.map(function(t){return t.idx;}),dir,lv.jengaTops,_dictHas);
}

// ---- Main scoring entry point ----
// preview=true → no cooldown commits, sticker/stamp hooks skip side effects.
// Returns the runScoreEngine result (see score_engine.js) or null.

function scorePlay(nt,dir,preview){
  if(!S.localCooldowns)S.localCooldowns=new Set();
  var lv=_liveTiles();
  var res=runScoreEngine({
    tiles:lv.tiles,jengaTops:lv.jengaTops,jengaUnder:lv.jengaUnder,
    jengaCrossIdxs:_jengaCrossIdxs(lv,dir),
    mirrorWords:_mirrorWords(lv,nt,dir),
    newIdxs:nt.map(function(t){return t.idx;}),
    dir:dir,
    boardStickers:S.board,placed:S.placed,stamps:S.stamps,
    cooldowns:S.localCooldowns,bounties:S.bounties||[],
    preview:!!preview,
    state:buildEngineState(S.hand.filter(function(t){return t!==null;}).length)
  });
  if(!res)return null;
  // Commit cooldowns (non-preview only)
  if(!preview)res.activatedSqs.forEach(function(sq){S.localCooldowns.add(sq);});
  return res;
}

// ---- Sticker float animation ----
// Full 3D sticker peel: rAF-driven diagonal peel along a 45° axis (top-left lifts first,
// bottom-right is the anchor), then decaying jiggle, then snap-flat on ding, then leaf drift.
// Float elements attached to document.body (position:fixed) — bypasses overflow:hidden on
// #board-area. Container starts opacity:0 so the board is always visible at rest.

var _stickerFloats={};

function _ensureStickerCSS(){
  if(document.getElementById('_sf-css'))return;
  var s=document.createElement('style');s.id='_sf-css';
  s.textContent=[
    // Float back down: f.el drifts from -10px to board level and fades.
    '@keyframes _sf-drift{',
    '0%{transform:translateY(-12px) rotateZ(-0.6deg);opacity:1}',
    '30%{transform:translateY(-5px) rotateZ(0.4deg);opacity:1}',
    '60%{transform:translateY(-1.5px) rotateZ(-0.1deg);opacity:1}',
    '80%{transform:translateY(0px) rotateZ(0deg);opacity:1}',
    '90%{transform:translateY(0px) rotateZ(0deg);opacity:0.5}',
    '100%{transform:translateY(0px) rotateZ(0deg);opacity:0}',
    '}',
    '@keyframes _sf-shrink{0%{transform:scale(1.4)}100%{transform:scale(1)}}',
  ].join('');
  document.head.appendChild(s);
}

function _clearStickerFloats(){
  for(var k in _stickerFloats){
    var f=_stickerFloats[k];
    if(f.t1)clearTimeout(f.t1);
    if(f.t2)clearTimeout(f.t2);
    if(f._raf)cancelAnimationFrame(f._raf);
    if(f.el&&f.el.parentNode)f.el.parentNode.removeChild(f.el);
    if(f.glowEl&&f.glowEl.parentNode)f.glowEl.parentNode.removeChild(f.glowEl);
  }
  _stickerFloats={};
}

function _buildStickerFloatEl(sqIdx){
  var sqEl=document.querySelector('.sq[data-sq-idx="'+sqIdx+'"]');
  if(!sqEl)return null;
  var sid=S.board[sqIdx];if(!sid)return null;
  var ss=sqStyle(sid);
  var sd=sqd(sid);
  if(!ss.lbl&&!(sd&&sd.iconPng))return null;
  _ensureStickerCSS();

  var rect=sqEl.getBoundingClientRect();
  var w=rect.width,h=rect.height;

  // Hide the board cell sticker — flatEl takes its place visually from the start.
  sqEl.style.background='';
  sqEl.style.backgroundImage='url(Assets/sprites/board-tile.png)';
  sqEl.style.backgroundSize=w+'px '+h+'px';
  sqEl.style.imageRendering='pixelated';
  sqEl.style.border='none';sqEl.style.borderRadius='0';
  sqEl.style.color='#6a9060';
  var _sqKids=Array.prototype.slice.call(sqEl.children);
  for(var _ski=0;_ski<_sqKids.length;_ski++){
    if(!_sqKids[_ski].classList.contains('tile'))sqEl.removeChild(_sqKids[_ski]);
  }

  // Glow — fixed at cell bottom
  var glowEl=document.createElement('div');
  var glowColor=sd?sd.fg:'#ffffff';
  glowEl.style.cssText='position:fixed;pointer-events:none;z-index:9998;opacity:0;'
    +'left:'+(rect.left+w*0.08)+'px;top:'+(rect.top+h-4)+'px;'
    +'width:'+(w*0.84)+'px;height:8px;border-radius:50%;'
    +'background:'+glowColor+';box-shadow:0 0 18px 7px '+glowColor+';';
  document.body.appendChild(glowEl);

  // Container — immediately visible (replaces the hidden board sticker seamlessly)
  var floatEl=document.createElement('div');
  floatEl.style.cssText='position:fixed;pointer-events:none;z-index:9999;'
    +'left:'+rect.left+'px;top:'+rect.top+'px;width:'+w+'px;height:'+h+'px;opacity:1;';

  var fs=Math.max(10,Math.floor(h*0.55));
  var faceBase='position:absolute;inset:0;border-radius:3px;'
    +'background:'+ss.bg+';color:'+ss.fg+';'
    +'display:flex;align-items:center;justify-content:center;'
    +'font-size:'+fs+'px;line-height:1;border:1px solid rgba(255,255,255,0.18);';

  function _makeFace(extra){
    var el=document.createElement('div');el.style.cssText=faceBase+extra;
    if(sd&&sd.iconPng){
      var im=document.createElement('img');im.src=sd.iconPng;
      im.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;image-rendering:pixelated;border-radius:3px;';
      el.appendChild(im);
    }else{el.textContent=ss.lbl;}
    return el;
  }

  // flatEl: the still-stuck portion of the sticker. Full square at start, shrinks as peel progresses.
  var flatEl=_makeFace('');

  // peeledEl: the lifted portion. Zero-area at start, grows with peel. Gets 3D transform + shadow.
  var peeledEl=_makeFace('will-change:transform,box-shadow;');
  peeledEl.style.clipPath='polygon(0% 0%, 0% 0%, 0% 0%)';

  floatEl.appendChild(flatEl);
  floatEl.appendChild(peeledEl);
  document.body.appendChild(floatEl);

  return{el:floatEl,peeledEl:peeledEl,flatEl:flatEl,glowEl:glowEl,t1:null,t2:null,_raf:null,phase:'idle',sqEl:sqEl,_w:w,_h:h};
}

function _sfEaseOut(t){var m=1-t;return 1-m*m*m;}

function _hideBoardCell(f){
  var sqEl=f.sqEl;if(!sqEl||!sqEl.isConnected)return;
  var w=f._w,h=f._h;
  sqEl.style.background='';
  sqEl.style.backgroundImage='url(Assets/sprites/board-tile.png)';
  sqEl.style.backgroundSize=w+'px '+h+'px';
  sqEl.style.imageRendering='pixelated';
  sqEl.style.border='none';sqEl.style.borderRadius='0';
  sqEl.style.color='#6a9060';
  var kids=Array.prototype.slice.call(sqEl.children);
  for(var ki=0;ki<kids.length;ki++){if(!kids[ki].classList.contains('tile'))sqEl.removeChild(kids[ki]);}
}

// Restores the board cell sticker at ding-time so the float can drift back onto it.
function _restoreBoardCell(f,sqIdx){
  var sqEl=f.sqEl;if(!sqEl||!sqEl.isConnected)return;
  var sid=S.board[sqIdx];if(!sid)return;
  var ss=sqStyle(sid),sd=sqd(sid),w=f._w,h=f._h;
  sqEl.style.backgroundImage='';sqEl.style.backgroundSize='';sqEl.style.imageRendering='';
  sqEl.style.background=ss.bg;sqEl.style.color=ss.fg;
  if(sd&&sd.iconPng){
    sqEl.style.border='none';sqEl.style.borderRadius='0';
    var rImg=document.createElement('img');rImg.src=sd.iconPng;
    rImg.style.cssText='position:absolute;left:0;top:0;width:'+Math.round(w)+'px;height:'+Math.round(h)+'px;image-rendering:pixelated;pointer-events:none';
    sqEl.appendChild(rImg);
  }else{
    sqEl.style.border='';sqEl.style.borderRadius='';
    if(ss.lbl){var lbl=document.createElement('div');lbl.className='sq-lbl';lbl.textContent=ss.lbl;sqEl.appendChild(lbl);}
  }
}

// Progressive sticker peel using two clipped half-elements:
//   flatEl  = the still-stuck portion (no 3D, clip shrinks toward bottom-right)
//   peeledEl = the lifted portion (3D rotated around fold line, clip grows from top-left)
//
// Phase 1 (p: 0→1/8): fold line moves from top-left, angle rises 0°→45°. Corner lifts.
// Phase 2 (p: 1/8→1): corner height is fixed; fold line continues toward bottom-right,
//   angle decreases via θ = arcsin(1/(8·p·√2)). Peeled segment grows, angle flattens.
// Jiggle: full sticker lifted at ~5°, decaying oscillation before snap.
function _runPeel(f){
  var PEEL_MS=600,FLATTEN_MS=180;
  var t0=null,flatT0=null;

  // Clip-path for the top-left (peeled) region given fold-line parameter p ∈ [0,1].
  // Fold line: y = -x + 2p in [0,1]² — passes through (p,p) at 45°.
  function _pc(pp){
    if(pp<=0)return 'polygon(0% 0%, 0% 0%, 0% 0%)';
    var a,b;
    if(pp<0.5){a=(pp*200).toFixed(2);return 'polygon(0% 0%, '+a+'% 0%, 0% '+a+'%)';}
    if(pp>=1)return 'none';
    b=((pp*2-1)*100).toFixed(2);
    return 'polygon(0% 0%, 100% 0%, 100% '+b+'%, '+b+'% 100%, 0% 100%)';
  }
  // Peel angle: phase 1 rises to 70° at pp=1/8, phase 2 corner stays at fixed height.
  // Larger angle = more dramatic lift on small elements with perspective(30px).
  var _SIN70=Math.sin(70*Math.PI/180); // fixed corner height ratio
  function _theta(pp){
    if(pp<=0)return 0;
    if(pp<=1/8)return pp*8*70;
    return Math.asin(Math.min(1,_SIN70/(8*pp)))*180/Math.PI;
  }

  function frame(now){
    if(f.phase!=='peel')return;
    if(!t0)t0=now;
    var elapsed=now-t0;
    if(elapsed<PEEL_MS){
      var pp=_sfEaseOut(elapsed/PEEL_MS);
      var theta=_theta(pp);
      var ox=(pp*100).toFixed(2);
      f.peeledEl.style.clipPath=_pc(pp);
      f.peeledEl.style.transformOrigin=ox+'% '+ox+'%';
      // perspective(30px) on a ~50px cell: corner at 35px from fold midpoint lifts ~12px
      // in screen space at theta=14°, giving clearly visible 3D tilt without needing translateY.
      f.peeledEl.style.transform='perspective(30px) rotate3d(1,-1,0,'+(-theta).toFixed(2)+'deg) scale('+(1+0.25*pp).toFixed(3)+')';
      // filter:drop-shadow renders AFTER clip-path — shadow falls along fold line diagonal.
      var blur=(pp*14).toFixed(1);
      f.peeledEl.style.filter=pp>0.04?'drop-shadow(2px 2px '+blur+'px rgba(0,0,0,0.7))':'';
      f.peeledEl.style.boxShadow='none';
    }else{
      // Flatten phase: sticker drifts down-right to centred position as it rises and expands.
      // translate(-12.5%,-12.5%) scale(1.25) at origin=50%,50% = scale(1.25) at origin=100%,100%
      // so the transition from peel end to flatten start is seamless.
      if(!flatT0){
        flatT0=now;
        f.peeledEl.style.clipPath='none';f.flatEl.style.display='none';
        f.peeledEl.style.transformOrigin='50% 50%';
      }
      var fp=_sfEaseOut(Math.min(1,(now-flatT0)/FLATTEN_MS));
      var tx=(-12.5*(1-fp)).toFixed(2);
      var fS=(1.25+fp*0.15).toFixed(3);
      f.el.style.transform='translateY(-'+(fp*12).toFixed(1)+'px)';
      f.peeledEl.style.transform='translate('+tx+'%,'+tx+'%) scale('+fS+')';
      f.peeledEl.style.filter='drop-shadow(2px 2px 8px rgba(0,0,0,0.5))';
      if(fp>=1){
        f.peeledEl.style.transform='scale(1.4)';
        f._raf=null;if(f.phase==='peel')f.phase='hold';
        if(f._onHold){var _h=f._onHold;f._onHold=null;_h();}
        return;
      }
    }
    f._raf=requestAnimationFrame(frame);
  }
  f._raf=requestAnimationFrame(frame);
}

function _preStickerPeel(sqIdx){
  if(sqIdx==null)return;
  var f=_stickerFloats[sqIdx];
  if(f){
    if(f.phase==='peel'||f.phase==='hold')return;
    // Interrupt descent — re-hide board cell and restart peel from p=0
    if(f._raf){cancelAnimationFrame(f._raf);f._raf=null;}
    if(f.t1){clearTimeout(f.t1);f.t1=null;}
    if(f.t2){clearTimeout(f.t2);f.t2=null;}
    _hideBoardCell(f);
    f.peeledEl.style.animation='none';f.peeledEl.style.clipPath='polygon(0% 0%, 0% 0%, 0% 0%)';
    f.peeledEl.style.transform='';f.peeledEl.style.filter='';f.peeledEl.style.boxShadow='none';
    f.flatEl.style.display=''; // restore full flat sticker for new peel
    f.el.style.animation='none';f.el.style.opacity='1';f.el.style.transform='';
    f.phase='peel';
    requestAnimationFrame(function(){_runPeel(f);});
    return;
  }
  f=_buildStickerFloatEl(sqIdx);
  if(!f)return;
  f.phase='peel';
  _stickerFloats[sqIdx]=f;
  // Two rAFs: let browser commit initial DOM state before starting
  requestAnimationFrame(function(){requestAnimationFrame(function(){_runPeel(f);});});
}

function _activateStickerFloat(sqIdx){
  if(sqIdx==null)return;
  var f=_stickerFloats[sqIdx];
  if(!f){
    f=_buildStickerFloatEl(sqIdx);
    if(!f)return;
    _stickerFloats[sqIdx]=f;
  }
  // Cancel peel/jiggle — ding interrupts whatever state the peel was in
  if(f._raf){cancelAnimationFrame(f._raf);f._raf=null;}
  if(f.t1){clearTimeout(f.t1);f.t1=null;}
  if(f.t2){clearTimeout(f.t2);f.t2=null;}

  // Restore board sticker now so the float has a visible destination to drift back onto.
  _restoreBoardCell(f,sqIdx);

  // At ding: snap directly to centred, elevated, scaled state.
  // origin=50%,50% on an inset:0 element = centred on the board cell.
  f.peeledEl.style.clipPath='none';
  f.flatEl.style.display='none';
  f.el.style.opacity='1';
  f.el.style.animation='none';
  f.el.style.transition='none';
  f.el.style.transform='translateY(-12px)';
  f.peeledEl.style.transition='none';
  f.peeledEl.style.transformOrigin='50% 50%';
  f.peeledEl.style.transform='scale(1.4)';
  f.peeledEl.style.filter='drop-shadow(2px 2px 10px rgba(0,0,0,0.55))';
  f.peeledEl.style.boxShadow='none';
  if(f._onHold){var _h=f._onHold;f._onHold=null;_h();}
  f.phase='hold';

  // Flash glow in sync with ding
  f.glowEl.style.transition='none';
  f.glowEl.style.opacity='1';
  void f.glowEl.offsetWidth;
  f.glowEl.style.transition='opacity 0.32s ease-out';
  f.glowEl.style.opacity='0.15';

  // Hold frozen before drifting down — gives the flash a moment to breathe.
  f.t1=setTimeout(function(){
    if(!_stickerFloats[sqIdx]||_stickerFloats[sqIdx]!==f)return;
    f.phase='descend';
    f.peeledEl.style.transition='none';
    f.peeledEl.style.transform='';
    f.peeledEl.style.animation='_sf-shrink 0.75s ease-out forwards';
    f.peeledEl.style.filter='none';
    f.glowEl.style.transition='opacity 0.2s ease-out';
    f.glowEl.style.opacity='0';
    f.el.style.transition='none';
    f.el.style.animation='_sf-drift 0.85s ease-out forwards';
    f.t2=setTimeout(function(){
      if(!_stickerFloats[sqIdx]||_stickerFloats[sqIdx]!==f)return;
      if(f.el.parentNode)f.el.parentNode.removeChild(f.el);
      if(f.glowEl.parentNode)f.glowEl.parentNode.removeChild(f.glowEl);
      delete _stickerFloats[sqIdx];
    },900);
  },500);
}

// ---- Animation ----

function showScorePop(text,x,y,bg,fg){
  var el=document.createElement('div');el.className='score-pop';
  el.style.cssText='left:'+Math.round(x)+'px;top:'+Math.round(y)+'px;background:'+bg+';color:'+fg;
  el.textContent=text;document.body.appendChild(el);
  setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},700);
}
function bumpSA(id){var el=document.getElementById(id);if(!el)return;el.classList.remove('ls-bump');void el.offsetWidth;el.classList.add('ls-bump');}
function scoreDelay(ms){return new Promise(function(r){setTimeout(r,ms);});}
// Ease-in shared by every score/gold/target count-up: the number creeps up
// slowly at first and accelerates toward the finish (feels like it's "rushing"
// to land). Higher _SCORE_EASE_POW = slower start, faster finish.
var _SCORE_EASE_POW=4.5;
function _easeInScore(t){return t<=0?0:(t>=1?1:Math.pow(t,_SCORE_EASE_POW));}
// Inverse of _easeInScore: maps a value-fraction to the time-fraction it should
// land at, so a step-based counter (gold coins) accelerates the same way as the
// interpolated ones.
function _easeInScoreTime(f){return f<=0?0:(f>=1?1:Math.pow(f,1/_SCORE_EASE_POW));}
// Per-tile letter tick-up: the running letter total starts climbing at a fixed
// base rate (points/sec) and the rate grows in proportion to the current value
// (dv/dt = base + growth·v), so the value climbs exponentially and higher totals
// tick up ever faster. Tune base for the low-number feel, growth for how hard
// the acceleration kicks in as the numbers get big.
var _TICK_BASE_RATE=5;  // points/sec while the total is still small
var _TICK_GROWTH=3.0;    // per-sec exponential growth of the tick rate
// Ticks the HUD gold display by `delta`, one $1 at a time. On each step the
// increment, coin clink, HUD bump, and `bounceFn()` (bouncing the source tile
// or stamp) all fire in the SAME frame so the money is visibly tied
// to the thing paying it out. Reads the current value from the element so it
// composes across multiple deltas. No-op in dev mode (∞ gold).
async function animGoldTick(delta,bounceFn){
  var el=document.getElementById('hud-gold');
  if(S.devMode||!el||!delta)return;
  var cur=parseInt(el.textContent.replace(/[^0-9-]/g,''),10);if(isNaN(cur))cur=0;
  var dir=delta<0?-1:1,steps=Math.abs(delta);
  // Total payout duration (larger swings stay capped so big payouts don't drag);
  // coins land on an ease-in curve so the count starts slow and accelerates.
  var DUR=steps<=6?steps*90:Math.max(540,45*steps);
  var prevT=0;
  for(var i=0;i<steps;i++){
    cur+=dir;el.textContent='$'+cur;bumpSA('hud-gold');
    if(bounceFn)bounceFn();
    _playCoinClink(dir<0);
    var nextT=DUR*_easeInScoreTime((i+1)/steps);
    await scoreDelay(Math.max(12,nextT-prevT));
    prevT=nextT;
  }
}
// Resolves the element that should bounce with each $1 tick of a gold event:
// a stamp (floatStampId), a board sticker's tile (floatSqIdx), or the
// scoring tile itself (sqIdx). Returns null when there's nothing to bounce.
function _goldBounceFn(ev){
  if(ev.floatStampId){var id=ev.floatStampId;return function(){_bounceStamp(id);};}
  if(ev.floatSqIdx!=null){var bel=document.querySelector('[data-sq-idx="'+ev.floatSqIdx+'"] .board-tile');return function(){_binkEl(bel);};}
  if(ev.sqIdx!=null){var tel=_evTileEl(ev);return function(){_binkEl(tel);};}
  return null;
}
function fmtMult(m){var r=Math.round(m);if(m>=10||Math.abs(m-r)<0.001)return r.toString();return parseFloat(m.toFixed(2)).toString();}

// The stacked Jenga top face for a square, or null.
function _jengaTopEl(sqIdx){
  return document.querySelector('[data-sq-idx="'+sqIdx+'"] .board-tile.jenga-top');
}
// The buried (bottom) tile for a stacked square: the first board tile that
// isn't the jenga top face.
function _jengaBottomEl(sqIdx){
  var els=document.querySelectorAll('[data-sq-idx="'+sqIdx+'"] .board-tile');
  for(var i=0;i<els.length;i++)if(!els[i].classList.contains('jenga-top'))return els[i];
  return null;
}
// Board tile element for an event's square, or null. Jenga buried-tile events
// point at the bottom tile; everything else prefers the stacked top face.
function _evTileEl(ev){
  if(ev.sqIdx==null)return null;
  if(ev.jengaUnder)return _jengaBottomEl(ev.sqIdx)||document.querySelector('[data-sq-idx="'+ev.sqIdx+'"] .board-tile');
  return _jengaTopEl(ev.sqIdx)
    ||document.querySelector('[data-sq-idx="'+ev.sqIdx+'"] .board-tile.jenga-stacked')
    ||document.querySelector('[data-sq-idx="'+ev.sqIdx+'"] .board-tile');
}
// Flip a board tile to its gold face mid-animation (Gilded), so it visibly
// becomes a gold tile the moment it's gilded rather than only after the play
// commits and re-renders. S.bt/S.btTop already carry variant:'gold' (set in
// the PRE bracket), so this just repaints the existing DOM face to match:
// regenerates the sprite with the gold variant and swaps the var-* class.
function _goldifyTileEl(sqIdx){
  var el=_jengaTopEl(sqIdx)||document.querySelector('[data-sq-idx="'+sqIdx+'"] .board-tile');
  if(!el||el.classList.contains('var-gold'))return;
  var bt=(S.btTop&&S.btTop[sqIdx]&&S.btTop[sqIdx].isNew)?S.btTop[sqIdx]:S.bt[sqIdx];
  if(!bt)return;
  var sz=parseInt(el.dataset.tsz,10)||el.offsetWidth||64;
  var spr=(bt.isBlank&&bt.blankAs)?blankTileSpr(bt.blankAs,'gold',sz):tileSpr(bt.isBlank?null:bt.letter,bt.isBlank,'gold',sz);
  el.classList.remove('var-blue','var-red');el.classList.add('var-gold');
  el.dataset.spr=spr;
  el.style.cssText='position:absolute;left:0;top:0;width:'+sz+'px;height:'+sz+'px;'+spr;
}
// Axis-aligned translate (one tile over). sign +1 = right/down, -1 = left/up.
function _jengaAxisXform(axis,sign){return axis==='h'?'translateX('+(sign*100)+'%)':'translateY('+(sign*100)+'%)';}
// Which way to slide along `axis`. Prefer sliding TOWARD an adjacent stacked
// tile so it visibly slides too ("if there is another stacked tile adjacent,
// both slide"); otherwise toward any occupied square, else positive.
function _jengaSlideSign(sqIdx,axis){
  var r=Math.floor(sqIdx/B),c=sqIdx%B;
  var pos=axis==='h'?(c<B-1?sqIdx+1:-1):(r<B-1?sqIdx+B:-1);
  var neg=axis==='h'?(c>0?sqIdx-1:-1):(r>0?sqIdx-B:-1);
  if(pos>=0&&_jengaTopEl(pos))return 1;
  if(neg>=0&&_jengaTopEl(neg))return -1;
  if(pos>=0&&document.querySelector('[data-sq-idx="'+pos+'"] .board-tile'))return 1;
  if(neg>=0&&document.querySelector('[data-sq-idx="'+neg+'"] .board-tile'))return -1;
  return 1;
}
// Quickly slide the Jenga top face(s) aside along `axis` so the buried tile
// shows. Chains through adjacent stacked tops in the slide direction so they
// move together ("if there is another stacked tile adjacent, both slide").
// Returns the list of slid elements for _jengaSlideBack.
function _jengaSlideOut(sqIdx,axis){
  axis=axis||'h';
  var sign=_jengaSlideSign(sqIdx,axis),slid=[],idx=sqIdx;
  while(true){
    var top=_jengaTopEl(idx);if(!top)break;
    top.style.transition='transform 0.11s ease-out';
    top.style.setProperty('transform',_jengaAxisXform(axis,sign),'important');
    top.style.zIndex='6';
    slid.push(top);
    var r=Math.floor(idx/B),c=idx%B;
    var next=axis==='h'?(sign>0?(c<B-1?idx+1:-1):(c>0?idx-1:-1)):(sign>0?(r<B-1?idx+B:-1):(r>0?idx-B:-1));
    if(next<0||!_jengaTopEl(next))break;
    idx=next;
  }
  return slid;
}
// Ease the top face(s) back onto the stack — relaxed slide-back (CSS class
// governs the rest position once the inline transform is cleared).
function _jengaSlideBack(slid){
  if(!slid)return;
  for(var i=0;i<slid.length;i++){(function(top){
    top.style.transition='transform 0.32s cubic-bezier(.3,.85,.35,1)';
    top.style.removeProperty('transform');
    top.style.zIndex='';
    setTimeout(function(){if(top)top.style.removeProperty('transition');},340);
  })(slid[i]);}
}

// Restart the bink (pop) animation on a tile element.
function _binkEl(el){
  if(!el)return;
  el.classList.remove('binking');void el.offsetWidth;el.classList.add('binking');
}

// Bounces the matching stamp face(s) when its effect contributes to scoring.
function _bounceStamp(id){
  var els=document.querySelectorAll('#stamp-bar .stamp-tile[data-stamp-id="'+id+'"]');
  for(var i=0;i<els.length;i++){
    var el=els[i];
    el.classList.remove('sq-binking');
    void el.offsetWidth;
    el.classList.add('sq-binking');
  }
}

// ── Shared "scale bounce" hook ────────────────────────────────────────────────
// Scaling stamps (Crossroads, Bounty Hunter, Ouroboros, …) permanently grow a
// counter in S each time some condition fires. This bounces the stamp's bar face
// at the moment it scales, so the growth reads visually. Two ways to trigger it:
//   • During scoring — put scaleBounce:'<stampId>' on the event that marks the
//     scale. runScoreAnim fires the bounce on that event's beat (works on silent
//     display ticks too, e.g. Crossroads' crossword-tick).
//   • Outside scoring — call stampScaleBounce('<stampId>') directly (e.g. play.js
//     when a bounty resolves for Bounty Hunter).
function stampScaleBounce(id){if(id)_bounceStamp(id);}

// Waits for the sticker peel+flatten to reach 'hold' before the ding fires.
// Starts the peel now if it hasn't been started yet (handles events[0] edge case).
async function _awaitPeelHold(sqIdx){
  if(sqIdx==null)return;
  var f=_stickerFloats[sqIdx];
  if(!f){_preStickerPeel(sqIdx);f=_stickerFloats[sqIdx];}
  if(!f||f.phase!=='peel')return;
  await new Promise(function(r){f._onHold=r;});
}

async function runScoreAnim(events,total){
  var row=document.getElementById('live-score-row');
  var saL=document.getElementById('ls-letters');
  var saM=document.getElementById('ls-mult');
  var saS=document.getElementById('ls-score');
  var lsTileDelta=document.getElementById('ls-tile-delta');
  row.classList.add('scoring');
  saL.textContent='0';saM.textContent='1';saS.textContent='0';
  saL.style.color='';
  if(lsTileDelta){lsTileDelta.textContent='';lsTileDelta.style.transition='';lsTileDelta.style.opacity='';lsTileDelta.classList.remove('delta-active','delta-enter');}

  var delay=1000,minDelay=100,delayStep=50;
  var animPlusSum=0,animXprod=1;_scoreDingN=0;
  var _saLSynced=0; // tracks last value written to saL, to skip redundant isSilent updates
  var _deltaActive=false,_deltaTileBase=0;
  var _pendingTick=null; // {fV,tV} — last tile's score waiting to be ticked up
  var _tickVer=0; // incremented to cancel in-flight tick animations
  var _jengaSlid=null,_jengaSlidSq=-1; // Jenga: top face(s) currently slid aside
  S._crossroadsLiveCount=S.crossroadsCount||0; // baseline for live tooltip ticks this play

  // Slide the revealed Jenga top(s) back onto the stack once the buried tile is done.
  function _jengaRestore(){if(_jengaSlid){_jengaSlideBack(_jengaSlid);_jengaSlid=null;_jengaSlidSq=-1;}}

  // Fire the pending per-tile tick-up.
  // animated=true: rate-based rAF climb of saL (fixed base rate that accelerates
  //   exponentially as the value grows); runs parallel with next tile's delta.
  // animated=false: instant snap + fade delta (used for post-word events and final).
  function _firePendingTick(animated){
    if(!_pendingTick)return;
    var p=_pendingTick;_pendingTick=null;
    ++_tickVer;
    if(!animated){
      saL.textContent=p.tV;_saLSynced=p.tV;
      if(lsTileDelta){lsTileDelta.style.transition='';lsTileDelta.style.opacity='';lsTileDelta.classList.remove('delta-active','delta-enter');setTimeout(function(){lsTileDelta.textContent='';},200);}
      return;
    }
    var myV=_tickVer;
    (function(fV,tV,ver){
      if(tV<=fV){saL.textContent=tV;return;}
      var _last=null,v=fV;
      function _tk(now){
        if(_tickVer!==ver)return;
        if(_last===null)_last=now;
        var dt=(now-_last)/1000;_last=now;
        // Rate grows with how much THIS tile has added so far (resets each tile):
        // every tile starts at the base rate, then ramps up exponentially.
        v+=(_TICK_BASE_RATE+(v-fV)*_TICK_GROWTH)*dt;
        if(v>=tV){saL.textContent=tV;}
        else{saL.textContent=Math.round(v);requestAnimationFrame(_tk);}
      }
      requestAnimationFrame(_tk);
    })(p.fV,p.tV,myV);
  }

  function refreshMult(){
    var m=(1+animPlusSum)*animXprod;
    saM.textContent=fmtMult(m);
    bumpSA('ls-mult');
  }

  // Apply one merged sibling effect (see grouping below) into the SAME frame as
  // its head event's bounce — used when a sticker/stamp adds independent score types
  // (e.g. Alpha: +letter score AND +mult) that can all land at once. Handles the
  // accumulator update + score pop; the bounce/ding belong to the head event.
  function _applyCoEffect(co){
    if(co.type==='plus-mult'){
      var brp=row.getBoundingClientRect();
      showScorePop('+'+co.delta+' mult',brp.left+100,brp.top-32,'#500808','#ff8080');
      animPlusSum+=co.delta;refreshMult();
    }else if(co.type==='x-mult'){
      var telx=_evTileEl(co),rx=telx?telx.getBoundingClientRect():null;
      if(rx)showScorePop(co.factor,rx.left+rx.width/2-20,rx.top-4,'#500808','#ff6060');
      else{var brx=row.getBoundingClientRect();showScorePop(co.factor+' mult',brx.left+100,brx.top-32,'#500808','#ff6060');}
      animXprod*=co.factor;refreshMult();
    }else if(co.type==='letter'){
      saL.textContent=co.lettersAfter;bumpSA('ls-letters');_saLSynced=co.lettersAfter;
    }
  }
  function _applyCoApply(ev){
    if(!ev._coApply)return;
    for(var _ci=0;_ci<ev._coApply.length;_ci++)_applyCoEffect(ev._coApply[_ci]);
  }

  // Shared opening beat for every non-tile-local event: snap the pending tile
  // tick, consume one delay step, wait for the sticker peel, then fire the
  // ding + sticker float + stamp-bar bounce (all suppressed for _skip events).
  // Returns the delay to await after the branch's own visuals, or null for
  // _skip events (which fire their state changes with no beat of their own).
  async function _evBeatStart(ev){
    _firePendingTick(false);
    _jengaRestore();
    var curDelay=null;
    if(!ev._skip){curDelay=delay;delay=Math.max(minDelay,delay-delayStep);}
    if(ev.floatSqIdx!=null&&!ev._skip)await _awaitPeelHold(ev.floatSqIdx);
    if(!ev._skip&&!ev.silent)_playScoreDing();
    if(ev.floatSqIdx!=null&&!ev._skip)_activateStickerFloat(ev.floatSqIdx);
    if(ev.floatStampId&&!ev._skip)_bounceStamp(ev.floatStampId);
    if(ev.scaleBounce&&!ev._skip)stampScaleBounce(ev.scaleBounce);
    return curDelay;
  }

  // Consecutive events from one sticker trigger — same floatStampId (stamp) or
  // same floatSqIdx (board) — share a single bounce. Independent score-type
  // effects (a +mult, a ×mult, a non-running letter bonus) are MERGED onto the
  // head event's beat via _coApply and consumed (_consumed → no beat of their
  // own), so a sticker/stamp adding e.g. letter score AND mult applies both at once.
  // Gold keeps its own $-tick animation but shares the beat (_skip → no extra
  // ding/delay/re-activation). A tile-local letter ends the group: its running
  // "+X" delta drives the letter display and must own its beat.
  function _floatKey(e){return e.floatStampId?('ts:'+e.floatStampId):(e.floatSqIdx!=null?('sq:'+e.floatSqIdx):null);}
  for(var _gi=0;_gi<events.length;_gi++){
    var _he=events[_gi];
    if(_he._consumed)continue;
    var _hkey=_floatKey(_he);
    if(_hkey==null)continue;
    var _co=null;
    for(var _gj=_gi+1;_gj<events.length;_gj++){
      var _fe=events[_gj];
      if(_floatKey(_fe)!==_hkey)break;
      if(_fe.type==='letter'&&_fe.isTileLocal)break;
      if(_fe.type==='plus-mult'||_fe.type==='x-mult'||_fe.type==='letter'){
        _fe._consumed=true;(_co||(_co=[])).push(_fe);
      }else{
        _fe._skip=true; // gold / retrigger / etc: same bounce, own animation
      }
    }
    if(_co)_he._coApply=_co;
  }

  // A gold/Gilded tile earns +$1 during its own per-tile scoring — a gold event
  // carrying only sqIdx (no float ref). Ride it on the SAME bounce as that
  // tile's letter score: attach it to that tile-pass's visible letter head (the
  // isTileLocal event tagged with _globalLetters for this square). The tile-pass
  // block is bounded by its trailing silent letter, so the search can't leak
  // into a neighbouring tile. Golds tied to a sticker (float ref) or with no
  // square (bounty) are left alone — they keep their own beat.
  for(var _gk=0;_gk<events.length;_gk++){
    var _ge=events[_gk];
    if(_ge.type!=='gold'||_ge._consumed||_ge.floatStampId||_ge.floatSqIdx!=null||_ge.sqIdx==null)continue;
    var _th=null;
    for(var _fj=_gk+1;_fj<events.length;_fj++){var _fev=events[_fj];if(_fev.type==='letter'&&_fev.isSilent)break;if(_fev.type==='letter'&&_fev.isTileLocal&&_fev._globalLetters!=null&&_fev.sqIdx===_ge.sqIdx){_th=_fev;break;}}
    if(!_th)for(var _bj=_gk-1;_bj>=0;_bj--){var _bev=events[_bj];if(_bev.type==='letter'&&_bev.isSilent)break;if(_bev.type==='letter'&&_bev.isTileLocal&&_bev._globalLetters!=null&&_bev.sqIdx===_ge.sqIdx){_th=_bev;break;}}
    if(_th){(_th._goldCo||(_th._goldCo=[])).push(_ge);_ge._consumed=true;}
  }

  // Pre-schedule every sticker peel 1 second before its own ding, regardless of word length.
  // Simulates cumulative event timing (ding fires before its own delay, after all prior delays).
  var _PEEL_LEAD=1000,_simD=delay,_simT=0;
  for(var _si=0;_si<events.length;_si++){
    var _sev=events[_si];
    if(_sev._consumed)continue; // merged onto a head event's beat — no beat of its own
    if(_sev.floatSqIdx!=null&&!_sev._skip){
      (function(sqIdx,t){setTimeout(function(){_preStickerPeel(sqIdx);},Math.max(0,t-_PEEL_LEAD));})(
        _sev.floatSqIdx,_simT);
    }
    if(!_sev._skip&&_sev.type!=='final'&&!_sev.isSilent&&!_sev.suppressVisual){
      var _sd=_simD;_simD=Math.max(minDelay,_simD-delayStep);
      _simT+=(_sev.type==='retrigger')?Math.max(minDelay,_sd*0.6):
             (_sev.type==='final-transform')?Math.max(200,_sd):_sd;
    }
  }

  for(var i=0;i<events.length;i++){
    var ev=events[i];
    if(ev._consumed)continue; // merged into its head event's bounce (applied via _applyCoApply)

    if(ev.type==='letter'){
      if(ev.isSilent){
        if(ev.lettersAfter!==_saLSynced){saL.textContent=ev.lettersAfter;bumpSA('ls-letters');_saLSynced=ev.lettersAfter;}
      }else if(ev.isTileLocal){
        // Per-tile bracket event: show running tile score as "+X" delta beside the letter total.
        // The total only ticks up when the NEXT tile starts (it "pushes" the previous score in).
        // Post-word events snap the last tile's pending tick instantly.
        if(!ev._skip){
          if(!_deltaActive){
            // New tile starting — fade out old delta, then fire tick + bounce in new delta
            if(lsTileDelta&&lsTileDelta.classList.contains('delta-active')){
              lsTileDelta.style.transition='opacity 0.15s ease';
              void lsTileDelta.offsetWidth;
              lsTileDelta.style.opacity='0';
              await scoreDelay(150);
            }
            _firePendingTick(true);
            _deltaActive=true;
            _deltaTileBase=_saLSynced;
            if(lsTileDelta){
              lsTileDelta.textContent='+'+ev.lettersAfter;
              lsTileDelta.style.transition='';
              lsTileDelta.style.opacity='';
              lsTileDelta.classList.remove('delta-enter');
              void lsTileDelta.offsetWidth;
              lsTileDelta.classList.add('delta-active','delta-enter');
            }
          }else{
            if(lsTileDelta)lsTileDelta.textContent='+'+ev.lettersAfter;
          }
          if(!ev.suppressVisual){
            var curDelay=delay;delay=Math.max(minDelay,delay-delayStep);
            // Jenga: reveal the buried tile as it scores by sliding the top
            // aside — along the main-word axis while a cross word scores, along
            // the cross axis while the main word scores. Restore on any other tile.
            if(ev.jengaUnder){if(_jengaSlidSq!==ev.sqIdx){_jengaRestore();_jengaSlid=_jengaSlideOut(ev.sqIdx,ev.jengaSlideAxis);_jengaSlidSq=ev.sqIdx;}}
            else _jengaRestore();
            var tileEl=_evTileEl(ev);
            if(ev.floatSqIdx!=null)await _awaitPeelHold(ev.floatSqIdx);
            _playScoreDing();
            if(ev.floatSqIdx!=null)_activateStickerFloat(ev.floatSqIdx);
            if(ev.floatStampId)_bounceStamp(ev.floatStampId);
            // Scaling stamps riding this tile's beat (Ouroboros per O, Cartographer
            // per corner): bump the persistent counter LIVE, in sync with the bounce
            // above and the tile's bink below. Score is already locked in res.total,
            // so this only advances the stored value + tooltip.
            if(ev.scaleField){S[ev.scaleField]=(S[ev.scaleField]||0)+(ev.scaleDelta||0);_tooltipRefreshIfOpen();}
            _binkEl(tileEl);
            _applyCoApply(ev); // merged +mult / bonus land on this same bounce
            // Gold this tile earned (gold/Gilded +$1) ticks on the same bounce.
            if(ev._goldCo){
              var _tileBounce=function(){_binkEl(tileEl);};
              for(var _gci=0;_gci<ev._goldCo.length;_gci++){
                var _gce=ev._goldCo[_gci],_brg=row.getBoundingClientRect();
                showScorePop(_gce.delta<0?'-$'+(-_gce.delta):'+$'+_gce.delta,_brg.left+24,_brg.top-32,'#3a2800','#f0c060');
                await animGoldTick(_gce.delta,_tileBounce);
              }
            }
          }
          if(ev._globalLetters!=null){
            // All brackets done for this tile — store tick, wait for next tile to pull the trigger
            _saLSynced=ev._globalLetters;
            _deltaActive=false;
            _pendingTick={fV:_deltaTileBase,tV:ev._globalLetters};
          }
          if(!ev.suppressVisual)await scoreDelay(curDelay);
          else await scoreDelay(1);
        }
      }else{
        // Non-tile-local letter event (bingo +50, sticker/stamp bonus, etc.)
        var curDelay=await _evBeatStart(ev);
        // Gilded: flip the tile to its gold face on this beat, so it visibly
        // becomes gold the instant it's gilded (PRE bracket, before it scores).
        if(ev.goldifySq!=null)_goldifyTileEl(ev.goldifySq);
        if(!ev._skip)_binkEl(_evTileEl(ev));
        if(ev.bingo)saL.style.color='#2e9d72'; // jade — bingo bonus landed
        saL.textContent=ev.lettersAfter;bumpSA('ls-letters');_saLSynced=ev.lettersAfter;
        _applyCoApply(ev);
        if(curDelay!=null)await scoreDelay(curDelay);
      }

    }else if(ev.type==='plus-mult'){
      var tileElP=_evTileEl(ev);
      var curDelay=await _evBeatStart(ev);
      var br=row.getBoundingClientRect();
      showScorePop('+'+ev.delta+' mult',br.left+100,br.top-32,'#500808','#ff8080');
      if(!ev._skip)_binkEl(tileElP);
      animPlusSum+=ev.delta;
      refreshMult();
      _applyCoApply(ev);
      if(curDelay!=null)await scoreDelay(curDelay);

    }else if(ev.type==='crossword-tick'){
      // Display-only: bumps Crossroads' live preview counter so a hovered tooltip steps up
      // as each crossword finishes scoring, even though the real mult applies later as one
      // event in the post-word phase (see crossroads' onPostWord in data.js).
      // Bounce Crossroads' bar face as each crossword scales it (scaleBounce hook).
      S._crossroadsLiveCount=(S._crossroadsLiveCount||0)+1;
      if(ev.scaleBounce)stampScaleBounce(ev.scaleBounce);
      _tooltipRefreshIfOpen();

    }else if(ev.type==='x-mult'){
      // Tile rect captured before the peel-hold await so the pop lands where
      // the tile was when the event began.
      var tileEl2=_evTileEl(ev);
      var r2=tileEl2?tileEl2.getBoundingClientRect():null;
      var curDelay=await _evBeatStart(ev);
      if(r2)showScorePop(ev.factor,r2.left+r2.width/2-20,r2.top-4,'#500808','#ff6060');
      else{var br2=row.getBoundingClientRect();showScorePop(ev.factor+' mult',br2.left+100,br2.top-32,'#500808','#ff6060');}
      if(!ev._skip)_binkEl(tileEl2);
      animXprod*=ev.factor;
      refreshMult();
      _applyCoApply(ev);
      if(curDelay!=null)await scoreDelay(curDelay);

    }else if(ev.type==='gold'){
      // Gold's audio/increment is driven by animGoldTick's per-$1 bounce (below),
      // not the shared _evBeatStart ding — so open the beat by hand: flush the
      // pending tile tick, consume a delay step, and peel the board sticker if
      // this gold comes from one, then let the ticks fire the coin clinks.
      _firePendingTick(false);
      _jengaRestore();
      var curDelay=null;
      if(!ev._skip){
        curDelay=delay;delay=Math.max(minDelay,delay-delayStep);
        if(ev.floatSqIdx!=null){await _awaitPeelHold(ev.floatSqIdx);_activateStickerFloat(ev.floatSqIdx);}
      }
      var br3=row.getBoundingClientRect();
      var _goldTxt=ev.delta<0?'-$'+(-ev.delta):'+$'+ev.delta;
      showScorePop(_goldTxt,br3.left+24,br3.top-32,'#3a2800','#f0c060');
      _applyCoApply(ev); // merged +mult (e.g. Gold Rush) lands with the first coin
      await animGoldTick(ev.delta,_goldBounceFn(ev));
      if(curDelay!=null)await scoreDelay(curDelay);

    }else if(ev.type==='retrigger'){
      var tileEl3=_evTileEl(ev);
      var curDelay=await _evBeatStart(ev);
      if(!ev._skip)_binkEl(tileEl3);
      var br5=row.getBoundingClientRect();
      showScorePop(ev.label+'!',br5.left+60,br5.top-32,'#1a0a2a','#c080ff');
      if(curDelay!=null)await scoreDelay(Math.max(minDelay,curDelay*0.6));

    }else if(ev.type==='final-transform'){
      var curDelay=await _evBeatStart(ev);
      if(ev.palMult&&ev.palMult>1&&!ev._skip){animXprod*=ev.palMult;refreshMult();}
      var br4=row.getBoundingClientRect();
      showScorePop(ev.label,br4.left+60,br4.top-48,'#0a2a2a','#60ffff');
      if(curDelay!=null)await scoreDelay(Math.max(200,curDelay));

    }else if(ev.type==='final'){
      _firePendingTick(false);
      _jengaRestore();
      saL.textContent=ev.letters;
      saM.textContent=fmtMult(ev.displayMult||ev.mult);
      saS.textContent=total.toLocaleString();bumpSA('ls-score');
    }
  }

  await scoreDelay(600);

  // Animate score into progress bar
  var _oldScore=S.score,_tgt=tgt();
  var _bar=document.getElementById('score-bar');
  var _runP=document.getElementById('run-progress');
  var _startPct=Math.min(100,_oldScore/_tgt*100);
  if(_bar){_bar.style.transition='none';_bar.style.height=_startPct+'%';}
  // Fill the score toward the target starting at a base rate of 10% of the
  // target per second, then accelerating exponentially as more is added
  // (d(added)/dt = base + growth·added). Base rate is proportional to the target
  // so every board starts filling at the same relative pace. The bar is derived
  // from the SAME running score each frame, so it fills at the exact same rate
  // as the score ticks up — it just clamps at 100% if the score overshoots.
  // growth chosen so a full-bar fill (empty→target) takes ~4.3s:
  // ln(1+10·growth)/growth ≈ 4.3 at growth=0.35.
  var _FILL_BASE=_tgt*0.10,_FILL_GROWTH=0.35;
  await new Promise(function(res2){
    var _last=null,_added=0;
    function _tick(now){
      if(_last===null)_last=now;
      var dt=(now-_last)/1000;_last=now;
      _added+=(_FILL_BASE+_added*_FILL_GROWTH)*dt;
      var done=_added>=total;if(done)_added=total;
      saS.textContent=Math.round(total-_added).toLocaleString();
      if(_bar)_bar.style.height=Math.min(100,(_oldScore+_added)/_tgt*100)+'%';
      if(_runP)_runP.textContent=Math.round(_oldScore+_added).toLocaleString()+' / '+_tgt.toLocaleString();
      if(!done){requestAnimationFrame(_tick);}else{saS.textContent='0';res2();}
    }
    requestAnimationFrame(_tick);
  });
  if(_bar)_bar.style.transition='height .6s cubic-bezier(.22,1,.36,1)';
  saL.textContent='0';saM.textContent='1';saL.style.color='';
  if(lsTileDelta){lsTileDelta.textContent='';lsTileDelta.style.transition='';lsTileDelta.style.opacity='';lsTileDelta.classList.remove('delta-active','delta-enter');}
  row.classList.remove('scoring');
}
