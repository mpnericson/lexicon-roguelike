// =====================================================================
// INIT — event listeners and app startup
// =====================================================================
window.addEventListener('resize',function(){hpBounds();renderBoard();});

(function(){
  var btn=document.getElementById('bag-btn');
  var spr=document.getElementById('bag-sprite');
  var frame=0,dir=0,timer=null;
  var MAX=4,MS=70;
  window._bagHoverFrame=0;
  function tick(){
    timer=null;
    frame=Math.max(0,Math.min(MAX,frame+dir));
    window._bagHoverFrame=frame;
    spr.src='Assets/animations/bag/bag-hl-frame'+frame+'.png';
    if(dir===1&&frame<MAX)timer=setTimeout(tick,MS);
    else if(dir===-1&&frame>0)timer=setTimeout(tick,MS);
    else if(dir===-1&&frame===0)spr.src='Assets/animations/bag/bag-frame0.png';
  }
  btn.addEventListener('mouseenter',function(){
    if(timer){clearTimeout(timer);timer=null;}
    dir=1;
    spr.src='Assets/animations/bag/bag-hl-frame'+frame+'.png';
    if(frame<MAX)timer=setTimeout(tick,MS);
  });
  btn.addEventListener('mouseleave',function(){
    if(timer){clearTimeout(timer);timer=null;}
    dir=-1;
    if(frame>0)timer=setTimeout(tick,MS);
    else spr.src='Assets/animations/bag/bag-frame0.png';
  });
  window._bagSpriteReset=function(){frame=0;dir=0;window._bagHoverFrame=0;spr.src='Assets/animations/bag/bag-frame0.png';};
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

// Menu/Hide-tiles sprite hover and click
(function(){
  var eyeHit=document.getElementById('mh-eye-hit');
  var menuWrap=document.getElementById('menu-wrap');
  if(!eyeHit||!menuWrap)return;
  function idleF(){return _mhTilesVisible?1:13;}
  eyeHit.addEventListener('mouseenter',function(){if(!_mhTransitioning)_mhSetFrame(_mhTilesVisible?2:9);});
  eyeHit.addEventListener('mouseleave',function(){if(!_mhTransitioning)_mhSetFrame(idleF());});
  eyeHit.addEventListener('click',function(){toggleBoardTiles();});
  menuWrap.addEventListener('mouseenter',function(){if(!_mhTransitioning)_mhSetFrame(_mhTilesVisible?4:11);});
  menuWrap.addEventListener('mouseleave',function(){if(!_mhTransitioning)_mhSetFrame(idleF());});
  menuWrap.addEventListener('mousedown',function(e){if(!e.target.closest('#menu-dropdown')&&!_mhTransitioning)_mhSetFrame(_mhTilesVisible?5:12);});
  menuWrap.addEventListener('mouseup',function(e){if(!e.target.closest('#menu-dropdown')&&!_mhTransitioning)_mhSetFrame(_mhTilesVisible?4:11);});
  menuWrap.addEventListener('click',function(e){if(!e.target.closest('#menu-dropdown'))toggleMenu();});
})();

document.addEventListener('keydown',function(e){
  if(e.key==='Enter'&&S.phase==='play'&&!e.target.closest('.modal-overlay')){if(window._pdFlash)_pdFlash(3);playWord();}
  if((e.key==='Delete'||e.key==='Backspace')&&S.phase==='play'&&!e.target.closest('input,textarea')){if(window._pdFlash)_pdFlash(5);discardTiles();}
  if(e.key==='Escape'){var _bt=document.getElementById('bag-ui-tiles');if(_bt&&_bt.dataset.expandedLetter)_bagCollapseLetter(_bt);}
});
document.addEventListener('pointerdown',function(e){
  var btn=e.target.closest('button');
  if(btn&&!btn.disabled)_playTileClick('select');
},true);
document.addEventListener('click',function(e){
  var m=document.getElementById('menu-wrap');
  var dd=document.getElementById('menu-dropdown');
  if(dd&&m&&!m.contains(e.target))dd.style.display='none';
});
// Auto-detect sticker sprite PNGs. For each sticker without an iconPng, try
// loading Assets/stickers/{id}/{id}.png — if the file exists it loads and the
// property is set; if not, the image silently fails and the text icon is kept.
// To add a sprite: drop a 32×32 PNG at Assets/stickers/{sticker_id}/{sticker_id}.png.
// Adding a new sticker to the code? Create a matching folder — no other changes needed.
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
  await loadDict();
  buildSQMap();
  achvInit();
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
