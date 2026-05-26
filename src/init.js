// =====================================================================
// INIT — event listeners and app startup
// =====================================================================
window.addEventListener('resize',function(){hpBounds();renderBoard();});

(function(){
  var btn=document.getElementById('bag-btn');
  var spr=document.getElementById('bag-sprite');
  var frame=0,dir=0,timer=null;
  var MAX=4,MS=70;
  function tick(){
    timer=null;
    frame=Math.max(0,Math.min(MAX,frame+dir));
    spr.src='Assets/bag-hl-frame'+frame+'.png';
    if(dir===1&&frame<MAX)timer=setTimeout(tick,MS);
    else if(dir===-1&&frame>0)timer=setTimeout(tick,MS);
    else if(dir===-1&&frame===0)spr.src='Assets/bag-frame0.png';
  }
  btn.addEventListener('mouseenter',function(){
    if(timer){clearTimeout(timer);timer=null;}
    dir=1;
    spr.src='Assets/bag-hl-frame'+frame+'.png';
    if(frame<MAX)timer=setTimeout(tick,MS);
  });
  btn.addEventListener('mouseleave',function(){
    if(timer){clearTimeout(timer);timer=null;}
    dir=-1;
    if(frame>0)timer=setTimeout(tick,MS);
    else spr.src='Assets/bag-frame0.png';
  });
  window._bagSpriteReset=function(){frame=0;dir=0;spr.src='Assets/bag-frame0.png';};
})();
document.addEventListener('keydown',function(e){
  if(e.key==='Enter'&&S.phase==='play'&&!e.target.closest('.modal-overlay'))playWord();
  if(e.key==='Delete'&&S.phase==='play')discardTiles();
});
document.addEventListener('click',function(e){
  var m=document.getElementById('menu-wrap');
  var dd=document.getElementById('menu-dropdown');
  if(dd&&m&&!m.contains(e.target))dd.style.display='none';
});
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
})();
