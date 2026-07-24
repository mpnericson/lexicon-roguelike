// =====================================================================
// INIT — event listeners and app startup
// =====================================================================
window.addEventListener('resize',function(){hpBounds();renderBoard();});

(function(){
  var btn=document.getElementById('bag-btn');
  var spr=document.getElementById('bag-sprite');
  window._bagHoverFrame=0;
  var hover=attachBagHover(btn,spr,function(f){window._bagHoverFrame=f;});
  window._bagSpriteReset=hover.reset;
})();
// Play button sprite interactions (frames: 1 idle / 2 hover / 3 press)
(function(){
  var wrap=document.getElementById('play-btn-wrap');
  var spr=document.getElementById('play-btn-sprite');
  if(!wrap||!spr)return;
  var hov=false;
  function pf(n){spr.src='Assets/main_ui/buttons/play/play'+n+'.png';}
  window._playFlash=function(){pf(3);setTimeout(function(){pf(hov?2:1);},180);};
  wrap.addEventListener('mouseenter',function(){hov=true;pf(2);});
  wrap.addEventListener('mouseleave',function(){hov=false;pf(1);});
  wrap.addEventListener('mousedown',function(){pf(3);});
  wrap.addEventListener('mouseup',function(){pf(2);});
  wrap.addEventListener('click',function(){playWord();});
})();
// Discard button sprite interactions (frames: 1 idle / 2 hover / 3 press)
(function(){
  var wrap=document.getElementById('disc-btn-wrap');
  var spr=document.getElementById('disc-btn-sprite');
  if(!wrap||!spr)return;
  var hov=false;
  function df(n){spr.src='Assets/main_ui/buttons/discard/discard'+n+'.png';}
  window._discFlash=function(){df(3);setTimeout(function(){df(hov?2:1);},180);};
  wrap.addEventListener('mouseenter',function(){hov=true;df(2);});
  wrap.addEventListener('mouseleave',function(){hov=false;df(1);});
  wrap.addEventListener('mousedown',function(){df(3);});
  wrap.addEventListener('mouseup',function(){df(2);});
  wrap.addEventListener('click',function(){discardTiles();});
})();
// Shuffle button sprite interactions (frames: 1 idle / 2 hover / 3 press)
(function(){
  var wrap=document.getElementById('shuffle-btn-wrap');
  var spr=document.getElementById('shuffle-btn-sprite');
  if(!wrap||!spr)return;
  function sf(n){spr.src='Assets/main_ui/buttons/shuffle/shuffle'+n+'.png';}
  wrap.addEventListener('mouseenter',function(){sf(2);});
  wrap.addEventListener('mouseleave',function(){sf(1);});
  wrap.addEventListener('mousedown',function(){sf(3);});
  wrap.addEventListener('mouseup',function(){sf(2);});
  wrap.addEventListener('click',function(){shuffleHand();});
})();

// Focus-mode (eye) + menu button hover and click
(function(){
  var fb=document.getElementById('focus-btn-wrap');
  var menuWrap=document.getElementById('menu-wrap');
  if(fb){
    fb.addEventListener('mouseenter',function(){if(!_fbAnimating)_fbFrame(FOCUS.active?FOCUS.BTN.HOVER_CLOSED:FOCUS.BTN.HOVER_OPEN);});
    fb.addEventListener('mouseleave',function(){if(!_fbAnimating)_fbFrame(FOCUS.active?FOCUS.BTN.IDLE_CLOSED:FOCUS.BTN.IDLE_OPEN);});
    fb.addEventListener('mousedown',function(){if(!_fbAnimating)_fbFrame(FOCUS.active?FOCUS.BTN.PRESS_CLOSED:FOCUS.BTN.PRESS_OPEN);});
    fb.addEventListener('click',function(){toggleFocusMode();});
  }
  if(menuWrap){
    // Menu button frame swaps (menu_button1..3.png: idle/hover/press). Click now
    // opens the rising Menu popup instead of the old dropdown.
    function mf(n){var el=document.getElementById('menu-btn-sprite');if(el)el.src='Assets/main_ui/buttons/menu button/menu_button'+n+'.png';}
    menuWrap.addEventListener('mouseenter',function(){mf(2);});
    menuWrap.addEventListener('mouseleave',function(){mf(1);});
    menuWrap.addEventListener('mousedown',function(){mf(3);});
    menuWrap.addEventListener('mouseup',function(){mf(2);});
    menuWrap.addEventListener('click',function(){mf(1);openMenuPanel();});
  }
  // Run Info button: run_info1 = idle, run_info2 = pressed-in (a physically
  // smaller frame). It must only swap to the pressed frame while actually held
  // down — swapping on hover would make the button look shrunk before a click.
  // The "RUN INFO" label lightens on hover and shrinks on press (CSS).
  var riWrap=document.getElementById('run-info-wrap');
  if(riWrap){
    function rif(n){var el=document.getElementById('run-info-sprite');if(el)el.src='Assets/main_ui/buttons/run_info/run_info'+n+'.png';}
    riWrap.addEventListener('mousedown',function(){rif(2);});
    riWrap.addEventListener('mouseup',function(){rif(1);});
    riWrap.addEventListener('mouseleave',function(){rif(1);});
    riWrap.addEventListener('click',function(){rif(1);openRunInfo();});
  }
})();

document.addEventListener('keydown',function(e){
  if(window.TUT&&TUT.active)return; // tutorial: shortcuts stay locked out
  if(window._glassRet){_glassRetCancel();return;} // glass retrieve is modal — any key cancels
  if(window._focusMode){if(e.key==='Escape')exitFocus();return;}
  if(e.key==='Enter'&&S.phase==='play'&&!e.target.closest('.modal-overlay')){if(window._playFlash)_playFlash();playWord();}
  if((e.key==='Delete'||e.key==='Backspace')&&S.phase==='play'&&!e.target.closest('input,textarea')){if(window._discFlash)_discFlash();discardTiles();}
  if(e.key==='Escape'){var _bt=document.getElementById('bag-ui-tiles');if(_bt&&_bt.dataset.expandedLetter)_bagCollapseLetter(_bt);var _sbt=document.getElementById('sbovr-tiles');if(_sbt&&_sbt.dataset.expandedLetter)_bagCollapseLetter(_sbt);}
});
// Main UI background — the scoreboard is a 10-frame animation on #app's
// background-image (idle constraint motion comes from the drift background
// behind #app, drift_backgrounds.js). Frames:
//   1      = compressed (no tiles placed) — never shows a bare "0 × 0"
//   1 → 6  = expand the Letter × Mult boxes as tiles go onto the board
//   7 → 10 = drop the "= score" result strip open when scoring starts
// Driven by window.setMainuiState('compressed'|'expanded'|'scoring'), called
// from scoring.js (updateLivePreview on placement, runScoreAnim on scoring).
(function(){
  var app=document.getElementById('app');
  var MU_FRAMES=10;
  // Exponential ease-in for the expand / collapse: a long first gap that shrinks
  // geometrically each frame (×MU_DECAY per step, floored at MU_MIN), so the
  // animation starts slow and snaps shut over the last couple of frames.
  var MU_MAX=120,MU_MIN=22,MU_DECAY=0.66;
  // Little pause before the boxes start moving, so the expand / collapse doesn't
  // begin the instant a tile lands / lifts (kicked once from idle in muKick).
  var MU_START_DELAY=140;
  // Held + decoded so the fast frame swaps never flash a re-decode (an unheld
  // Image can be GC'd and its bitmap evicted; decode() forces it ready).
  var muImgs=[];
  for(var i=1;i<=MU_FRAMES;i++){var mi=new Image();mi.src='Assets/main_ui/mainui/mainui'+i+'.png';if(mi.decode)mi.decode().catch(function(){});muImgs.push(mi);}
  // The gold / plays / disc row is pushed down as the boxes above it expand and
  // the result strip drops in — so its top% is keyed off the frame (measured from
  // the art) and updated in lockstep with the background swap, keeping the numbers
  // glued to their boxes. Frames 1..10 → box top%. (Letters/mult/score-strip boxes
  // keep a fixed top and only grow, so their numbers stay put — see index.html.)
  var MU_ROW_TOP=[23.75,23.75,27.5,30.63,34.38,35.0,35.0,37.5,38.75,40.0];
  var _muRow=['stat-gold-box','stat-plays-box','stat-disc-box'];
  var muFrame=1,muTarget=1,muStep=0,muTimer=null;
  // The Letter / Mult / Score numbers fade via mu-open/mu-score (see index.html).
  // We drive the fade in lockstep with the box motion so a number never shows over
  // a half-open box: opening the boxes runs first, then the numbers fade IN once
  // the frames land; closing fades the numbers fully OUT first, then collapses.
  var muState='compressed',muOpening=false,muFadeTimer=null;
  var MU_FADE_MS=220; // keep >= the opacity transition in index.html
  function muClasses(state){
    var sp=document.getElementById('stat-panel');
    if(!sp)return;
    sp.classList.toggle('mu-open',state==='expanded'||state==='scoring');
    sp.classList.toggle('mu-score',state==='scoring');
  }
  function muApply(){
    app.style.backgroundImage='url('+muImgs[muFrame-1].src+')';
    var t=MU_ROW_TOP[muFrame-1]+'%';
    for(var i=0;i<_muRow.length;i++){var el=document.getElementById(_muRow[i]);if(el)el.style.top=t;}
  }
  // Gap before the next frame swap: exponential decay by step index so the early
  // frames linger and the tail snaps.
  function muNextGap(){return Math.max(MU_MIN,MU_MAX*Math.pow(MU_DECAY,muStep));}
  function muTick(){
    if(muFrame===muTarget){
      muTimer=null;
      // Boxes have finished opening — now fade the numbers in.
      if(muOpening){muOpening=false;muClasses(muState);}
      return;
    }
    muTimer=setTimeout(function(){
      muFrame+=muFrame<muTarget?1:-1; // step one frame toward the target
      muStep++;
      muApply();
      muTick();
    },muNextGap());
  }
  window.setMainuiState=function(state){
    if(state===muState)return;
    var tgt=state==='scoring'?MU_FRAMES:(state==='expanded'?6:1);
    var opening=tgt>muTarget; // states nest compressed<expanded<scoring, so frame dir = fade dir
    muState=state;
    muTarget=tgt;
    muStep=0;                                     // restart the ease from the current frame
    if(muFadeTimer){clearTimeout(muFadeTimer);muFadeTimer=null;}
    if(opening){
      // Keep the numbers hidden while the boxes open; muTick fades them in at the end.
      muOpening=true;
      // Kick from idle after a short lead-in; mid-animation retargets fall through.
      if(!muTimer)muTimer=setTimeout(function(){muTimer=null;muTick();},MU_START_DELAY);
    }else{
      // Fade the numbers out first, then collapse the boxes once they're gone.
      muOpening=false;
      muClasses(state);
      if(muTimer){clearTimeout(muTimer);muTimer=null;}
      muFadeTimer=setTimeout(function(){muFadeTimer=null;muTick();},MU_FADE_MS);
    }
  };
  muApply(); // paint the compressed frame immediately

  // Preload the other frame-swap sprite animations so they play without flicker
  // (same held+decoded reasoning as the mainui frames above).
  window._rdFrames=[];
  for(var i=1;i<=(typeof _RD_FRAMES!=='undefined'?_RD_FRAMES:18);i++){var _rdi=new Image();_rdi.src='Assets/sprites/endRoundDisplay/end_round_display'+i+'.png';if(_rdi.decode)_rdi.decode().catch(function(){});window._rdFrames.push(_rdi);}
  // Bag animation frames (0-13) — the board→shop shake/intro/outro swaps these on
  // an <img> fast; hold them warm so they don't flicker when animations are sped up.
  window._bagFrames=[];
  for(var i=0;i<=13;i++){var _bgi=new Image();_bgi.src='Assets/animations/bag/bag-frame'+i+'.png';if(_bgi.decode)_bgi.decode().catch(function(){});window._bagFrames.push(_bgi);}
})();

document.addEventListener('pointerdown',function(e){
  var btn=e.target.closest('button');
  if(btn&&!btn.disabled)_playTileClick('select');
},true);
document.addEventListener('click',function(e){
  var m=document.getElementById('menu-wrap');
  var dd=document.getElementById('menu-dropdown');
  if(dd&&m&&!m.contains(e.target))dd.style.display='none';
});
// Auto-detect sticker/stamp sprite PNGs. Board stickers live in Assets/stickers/{id}/{id}.png;
// stamps live in Assets/stamps/{id}/{id}.png. If the file exists it loads and iconPng is set;
// otherwise the image silently fails and the text icon is kept.
(function(){
  if(!window.SQ)return;
  for(var _i=0;_i<SQ.length;_i++){
    if(SQ[_i].iconPng)continue;
    (function(def){
      var dir=def.type==='stamp'?'Assets/stamps/':'Assets/stickers/';
      var img=new Image();
      img.onload=function(){def.iconPng=dir+def.id+'/'+def.id+'.png';};
      img.src=dir+def.id+'/'+def.id+'.png';
    })(SQ[_i]);
  }
})();

(async function(){
  await Promise.all([loadDict(),loadBountyThemes()]);
  // Word index for the solver — chunked, ~0.5s. Solver features are inert
  // until it finishes; the rank solve is kicked once it's ready.
  tlInit();
  buildGaddag(DICT,function(){
    if(typeof S!=='undefined'&&S&&S.phase==='play')_rankObserve();
  });
  buildSQMap();
  achvInit();
  wordbookInit();
  if(typeof discoveryInit==='function')discoveryInit();
  // Always open on the title screen; the player picks New Run / Continue there.
  showTitleScreen();
  requestAnimationFrame(hpStep);
  requestAnimationFrame(function(){SP.step();});
  requestAnimationFrame(function(){SSP.step();});
})();
