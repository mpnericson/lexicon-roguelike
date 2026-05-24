// =====================================================================
// INIT — event listeners and app startup
// =====================================================================
window.addEventListener('resize',function(){hpBounds();renderBoard();});
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
