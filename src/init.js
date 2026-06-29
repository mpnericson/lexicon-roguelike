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
document.addEventListener('keydown',function(e){
  if(e.key==='Enter'&&S.phase==='play'&&!e.target.closest('.modal-overlay'))playWord();
  if(e.key==='Delete'&&S.phase==='play')discardTiles();
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
