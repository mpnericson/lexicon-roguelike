// =====================================================================
// INIT — event listeners and app startup
// =====================================================================
window.addEventListener('resize',function(){hpBounds();renderBoard();});
document.addEventListener('keydown',function(e){
  if(e.key==='Delete'&&S.phase==='play')discardTiles();
});
document.addEventListener('click',function(e){
  var m=document.getElementById('menu-wrap');
  var dd=document.getElementById('menu-dropdown');
  if(dd&&m&&!m.contains(e.target))dd.style.display='none';
});
(async function(){await loadDict();startGame();requestAnimationFrame(hpStep);})();
