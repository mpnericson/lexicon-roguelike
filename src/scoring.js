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
// S.localCooldowns, which persists until clearBoardLetters() (between stages).
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
  var tiles=new Array(B*B),jengaTops=new Set();
  for(var i=0;i<B*B;i++){
    var tt=S.btTop&&S.btTop[i];
    if(tt&&tt.isNew){tiles[i]=tt;jengaTops.add(i);}
    else tiles[i]=S.bt[i]||null;
  }
  return{tiles:tiles,jengaTops:jengaTops};
}

// Snapshot of every S field that influences scoring. Sticker hooks read
// these through ctx.state instead of touching S directly.
function buildEngineState(freeHandCount){
  return{
    freeHandCount:freeHandCount,
    constraint:currentConstraint(),
    usedLetters:S.usedLetters,
    stickersSold:(S.stickersSoldThisStage||0)>0,
    pendingBountyReward:S._pendingBountyReward||0,
    drunkValid:S._drunkValid,
    magicStreak:S.magicStreak||0,
    drunkStreak:S.drunkStreak||0,
    palMult:S.palMult||1,
    playerMult:S.playerMult||1,
    bhMult:S.bhMult||1,
    crossroadsCount:S.crossroadsCount||0,
    discPressure:S.discPressure||0,
    bagColouredCount:S.bag?S.bag.filter(function(t){return t.variant;}).length:0
  };
}

// ---- Main scoring entry point ----
// preview=true → no cooldown commits, sticker hooks skip side effects.
// Returns the runScoreEngine result (see score_engine.js) or null.

function scorePlay(nt,dir,preview){
  if(!S.localCooldowns)S.localCooldowns=new Set();
  var lv=_liveTiles();
  var res=runScoreEngine({
    tiles:lv.tiles,jengaTops:lv.jengaTops,
    newIdxs:nt.map(function(t){return t.idx;}),
    dir:dir,
    boardStickers:S.board,placed:S.placed,hotbar:S.tileStickers,
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
function fmtMult(m){var r=Math.round(m);if(m>=10||Math.abs(m-r)<0.001)return r.toString();return parseFloat(m.toFixed(2)).toString();}

// Board tile element for an event's square (jenga top face wins), or null.
function _evTileEl(ev){
  if(ev.sqIdx==null)return null;
  return document.querySelector('[data-sq-idx="'+ev.sqIdx+'"] .board-tile.jenga-stacked')
    ||document.querySelector('[data-sq-idx="'+ev.sqIdx+'"] .board-tile');
}

// Restart the bink (pop) animation on a tile element.
function _binkEl(el){
  if(!el)return;
  el.classList.remove('binking');void el.offsetWidth;el.classList.add('binking');
}

// Bounces the matching hotbar sticker face(s) when its effect contributes to scoring.
function _bounceTsSticker(id){
  var els=document.querySelectorAll('#tile-sticker-bar .sticker-tile[data-ts-id="'+id+'"]');
  for(var i=0;i<els.length;i++){
    var el=els[i];
    el.classList.remove('sq-binking');
    void el.offsetWidth;
    el.classList.add('sq-binking');
  }
}

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
  if(lsTileDelta){lsTileDelta.textContent='';lsTileDelta.style.transition='';lsTileDelta.style.opacity='';lsTileDelta.classList.remove('delta-active','delta-enter');}

  var delay=1000,minDelay=100,delayStep=50;
  var animPlusSum=0,animXprod=1;_scoreDingN=0;
  var _saLSynced=0; // tracks last value written to saL, to skip redundant isSilent updates
  var _deltaActive=false,_deltaTileBase=0;
  var _pendingTick=null; // {fV,tV} — last tile's score waiting to be ticked up
  var _tickVer=0; // incremented to cancel in-flight tick animations
  S._crossroadsLiveCount=S.crossroadsCount||0; // baseline for live tooltip ticks this play

  // Fire the pending per-tile tick-up.
  // animated=true: 500ms rAF animation of saL (parallel with next tile's delta).
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
      var _t0=null,_DUR=500;
      function _tk(now){
        if(_tickVer!==ver)return;
        if(!_t0)_t0=now;
        var t=Math.min(1,(now-_t0)/_DUR);
        saL.textContent=Math.round(fV+(tV-fV)*t);
        if(t<1)requestAnimationFrame(_tk);
        else saL.textContent=tV;
      }
      requestAnimationFrame(_tk);
    })(p.fV,p.tV,myV);
  }

  function refreshMult(){
    var m=(1+animPlusSum)*animXprod;
    saM.textContent=fmtMult(m);
    bumpSA('ls-mult');
  }

  // Shared opening beat for every non-tile-local event: snap the pending tile
  // tick, consume one delay step, wait for the sticker peel, then fire the
  // ding + sticker float + hotbar bounce (all suppressed for _skip events).
  // Returns the delay to await after the branch's own visuals, or null for
  // _skip events (which fire their state changes with no beat of their own).
  async function _evBeatStart(ev){
    _firePendingTick(false);
    var curDelay=null;
    if(!ev._skip){curDelay=delay;delay=Math.max(minDelay,delay-delayStep);}
    if(ev.floatSqIdx!=null&&!ev._skip)await _awaitPeelHold(ev.floatSqIdx);
    if(!ev._skip&&!ev.silent)_playScoreDing();
    if(ev.floatSqIdx!=null&&!ev._skip)_activateStickerFloat(ev.floatSqIdx);
    if(ev.floatTsId&&!ev._skip)_bounceTsSticker(ev.floatTsId);
    return curDelay;
  }

  // Consecutive events sharing a floatSqIdx come from the same sticker trigger.
  // Mark all but the first in each run as _skip so they fire their effects in the
  // same beat as the primary event (no extra ding, no extra delay, no re-activation).
  for(var _gi=0;_gi<events.length-1;_gi++){
    if(events[_gi].floatSqIdx!=null&&events[_gi+1].floatSqIdx===events[_gi].floatSqIdx){
      events[_gi+1]._skip=true;
    }
  }

  // Pre-schedule every sticker peel 1 second before its own ding, regardless of word length.
  // Simulates cumulative event timing (ding fires before its own delay, after all prior delays).
  var _PEEL_LEAD=1000,_simD=delay,_simT=0;
  for(var _si=0;_si<events.length;_si++){
    var _sev=events[_si];
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
            var tileEl=_evTileEl(ev);
            if(ev.floatSqIdx!=null)await _awaitPeelHold(ev.floatSqIdx);
            _playScoreDing();
            if(ev.floatSqIdx!=null)_activateStickerFloat(ev.floatSqIdx);
            if(ev.floatTsId)_bounceTsSticker(ev.floatTsId);
            _binkEl(tileEl);
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
        // Non-tile-local letter event (bingo +50, sticker bonus, etc.)
        var curDelay=await _evBeatStart(ev);
        if(!ev._skip)_binkEl(_evTileEl(ev));
        saL.textContent=ev.lettersAfter;bumpSA('ls-letters');_saLSynced=ev.lettersAfter;
        if(curDelay!=null)await scoreDelay(curDelay);
      }

    }else if(ev.type==='plus-mult'){
      var curDelay=await _evBeatStart(ev);
      var br=row.getBoundingClientRect();
      showScorePop('+'+ev.delta+' mult',br.left+100,br.top-32,'#500808','#ff8080');
      animPlusSum+=ev.delta;
      refreshMult();
      if(curDelay!=null)await scoreDelay(curDelay);

    }else if(ev.type==='crossword-tick'){
      // Display-only: bumps Crossroads' live preview counter so a hovered tooltip steps up
      // as each crossword finishes scoring, even though the real mult applies later as one
      // event in the post-word phase (see crossroads' onPostWord in data.js).
      S._crossroadsLiveCount=(S._crossroadsLiveCount||0)+1;
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
      if(curDelay!=null)await scoreDelay(curDelay);

    }else if(ev.type==='gold'){
      var curDelay=await _evBeatStart(ev);
      var br3=row.getBoundingClientRect();
      showScorePop('+$'+ev.delta,br3.left+24,br3.top-32,'#3a2800','#f0c060');
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
  var _endPct=Math.min(100,(_oldScore+total)/_tgt*100);
  if(_bar){_bar.style.transition='none';_bar.style.height=_startPct+'%';}
  await new Promise(function(res2){
    var _start=performance.now(),DUR=2000;
    function _tick(now){
      var t=Math.min(1,(now-_start)/DUR);
      var _cur=Math.round(total*(1-t));
      saS.textContent=_cur.toLocaleString();
      if(_bar)_bar.style.height=(_startPct+(_endPct-_startPct)*t)+'%';
      if(_runP)_runP.textContent=Math.round(_oldScore+total*t).toLocaleString()+' / '+_tgt.toLocaleString();
      if(t<1){requestAnimationFrame(_tick);}else{saS.textContent='0';res2();}
    }
    requestAnimationFrame(_tick);
  });
  if(_bar)_bar.style.transition='height .6s cubic-bezier(.22,1,.36,1)';
  saL.textContent='0';saM.textContent='1';
  if(lsTileDelta){lsTileDelta.textContent='';lsTileDelta.style.transition='';lsTileDelta.style.opacity='';lsTileDelta.classList.remove('delta-active','delta-enter');}
  row.classList.remove('scoring');
}
