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
// Play/Discard sprite interactions
(function(){
  var spr=document.getElementById('play-disc-sprite');
  var ph=document.getElementById('pd-play-hit');
  var dh=document.getElementById('pd-disc-hit');
  if(!spr||!ph||!dh)return;
  var hov=null;
  function sf(n){spr.src='Assets/animations/play and discard buttons/play_discard_buttons'+n+'.png';}
  window._pdFlash=function(n){sf(n);setTimeout(function(){sf(hov==='play'?2:hov==='disc'?4:1);},180);};
  ph.addEventListener('mouseenter',function(){hov='play';sf(2);});
  ph.addEventListener('mouseleave',function(){hov=null;sf(1);});
  ph.addEventListener('mousedown',function(){sf(3);});
  ph.addEventListener('mouseup',function(){sf(2);});
  ph.addEventListener('click',function(){playWord();});
  dh.addEventListener('mouseenter',function(){hov='disc';sf(4);});
  dh.addEventListener('mouseleave',function(){hov=null;sf(1);});
  dh.addEventListener('mousedown',function(){sf(5);});
  dh.addEventListener('mouseup',function(){sf(4);});
  dh.addEventListener('click',function(){discardTiles();});
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
    // Frame swaps no-op until the menu button frames are exported
    // (Assets/animations/menu button/menu_button1..3.png: idle/hover/press).
    var mfOk=false;var probe=new Image();
    probe.onload=function(){mfOk=true;};
    probe.src='Assets/animations/menu button/menu_button2.png';
    function mf(n){if(!mfOk)return;var el=document.getElementById('menu-btn-sprite');if(el)el.src='Assets/animations/menu button/menu_button'+n+'.png';}
    menuWrap.addEventListener('mouseenter',function(){mf(2);});
    menuWrap.addEventListener('mouseleave',function(){mf(1);});
    menuWrap.addEventListener('mousedown',function(e){if(!e.target.closest('#menu-dropdown'))mf(3);});
    menuWrap.addEventListener('mouseup',function(e){if(!e.target.closest('#menu-dropdown'))mf(2);});
    menuWrap.addEventListener('click',function(e){if(!e.target.closest('#menu-dropdown'))toggleMenu();});
  }
})();

document.addEventListener('keydown',function(e){
  if(window.TUT&&TUT.active)return; // tutorial: shortcuts stay locked out
  if(window._focusMode){if(e.key==='Escape')exitFocus();return;}
  if(e.key==='Enter'&&S.phase==='play'&&!e.target.closest('.modal-overlay')){if(window._pdFlash)_pdFlash(3);playWord();}
  if((e.key==='Delete'||e.key==='Backspace')&&S.phase==='play'&&!e.target.closest('input,textarea')){if(window._pdFlash)_pdFlash(5);discardTiles();}
  if(e.key==='Escape'){var _bt=document.getElementById('bag-ui-tiles');if(_bt&&_bt.dataset.expandedLetter)_bagCollapseLetter(_bt);}
});
// Main UI background animation — normal swell (24 frames) or volatile/constraint (18 frames)
(function(){
  var FRAMES=24,FRAMES_V=18,frame=0,SWELL=12000,SWELL_V=3500;
  var imgs=[],imgsV=[];
  for(var i=1;i<=FRAMES;i++){var img=new Image();img.src='Assets/sprites/mainui/mainui'+i+'.png';imgs.push(img);}
  for(var i=1;i<=FRAMES_V;i++){var img=new Image();img.src='Assets/sprites/mainui_volatile/mainui_volatile'+i+'.png';imgsV.push(img);}
  var app=document.getElementById('app');
  var lastVolatile=false;
  function tick(){
    var isVolatile=typeof currentConstraint==='function'&&!!currentConstraint();
    if(isVolatile!==lastVolatile){frame=0;lastVolatile=isVolatile;}
    var set=isVolatile?imgsV:imgs;
    var count=isVolatile?FRAMES_V:FRAMES;
    frame=(frame+1)%count;
    app.style.backgroundImage='url('+set[frame].src+')';
    var delay=isVolatile
      ?300+200*Math.abs(Math.sin(Date.now()/SWELL_V*2*Math.PI))
      :600+400*Math.sin(Date.now()/SWELL*2*Math.PI);
    setTimeout(tick,delay);
  }
  setTimeout(tick,1100);
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
// Auto-detect sticker/stamp sprite PNGs. For each def without an iconPng, try
// loading Assets/stickers/{id}/{id}.png — if the file exists it loads and the
// property is set; if not, the image silently fails and the text icon is kept.
// To add a sprite: drop a 32×32 PNG at Assets/stickers/{sticker_id}/{sticker_id}.png.
// Adding a new sticker or stamp to the code? Create a matching folder — no other changes needed.
(function(){
  if(!window.SQ)return;
  for(var _i=0;_i<SQ.length;_i++){
    if(SQ[_i].iconPng)continue;
    (function(def){
      var img=new Image();
      img.onload=function(){def.iconPng='Assets/stickers/'+def.id+'/'+def.id+'.png';};
      img.src='Assets/stickers/'+def.id+'/'+def.id+'.png';
    })(SQ[_i]);
  }
})();

(async function(){
  await Promise.all([loadDict(),loadBountyThemes()]);
  // Word index for the solver — chunked, ~0.5s. Solver features are inert
  // until it finishes; the rank solve is kicked once it's ready.
  buildGaddag(DICT,function(){
    if(typeof S!=='undefined'&&S&&S.phase==='play')_rankObserve();
  });
  buildSQMap();
  achvInit();
  wordbookInit();
  if(hasSave()&&loadGame()){
    resumeGame();
    toast('Welcome back!');
  } else {
    startGame();
  }
  requestAnimationFrame(hpStep);
  requestAnimationFrame(function(){SP.step();});
  requestAnimationFrame(function(){SSP.step();});
})();
