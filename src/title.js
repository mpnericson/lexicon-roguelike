// =====================================================================
// TITLE — main menu / title screen, shown on every app start.
// LEXICON is spelled out in floating tiles above Play / Options / Collection.
// Play swaps in New Run / Continue (Continue disabled when no save exists).
// =====================================================================

// Build the LEXICON logo out of real tile sprites (tileSpr, sized to viewport).
function buildTitleTiles(){
  var logo=document.getElementById('title-logo');if(!logo)return;
  var sz=Math.max(46,Math.min(92,Math.floor(window.innerWidth/16)));
  var word='LEXICON';
  logo.innerHTML='';
  for(var i=0;i<word.length;i++){
    var t=document.createElement('div');
    t.className='title-tile';
    // Ambient float: each tile gets its own duration/phase so they drift out of sync.
    t.style.cssText='width:'+sz+'px;height:'+sz+'px;'+tileSpr(word[i],false,null,sz)
      +'animation-duration:'+(3+Math.random()*1.8).toFixed(2)+'s;'
      +'animation-delay:'+(-Math.random()*3.6).toFixed(2)+'s;';
    logo.appendChild(t);
  }
}

function showTitleScreen(){
  var ts=document.getElementById('title-screen');if(!ts)return;
  buildTitleTiles();
  document.getElementById('title-page-main').classList.remove('title-page-hidden');
  var play=document.getElementById('title-page-play');
  play.classList.add('title-page-hidden');play.classList.remove('title-pop');
  ts.classList.remove('title-hide');
  ts.style.display='flex';
}

function hideTitleScreen(){
  var ts=document.getElementById('title-screen');if(!ts)return;
  ts.classList.add('title-hide');
  setTimeout(function(){ts.style.display='none';ts.classList.remove('title-hide');},420);
}

// Fade the current page out, then pop the next one in.
function _titleSwapPage(outEl,inEl){
  outEl.classList.add('title-page-hidden');
  setTimeout(function(){
    inEl.classList.remove('title-page-hidden');
    inEl.classList.remove('title-pop');void inEl.offsetWidth; // restart the pop animation
    inEl.classList.add('title-pop');
  },250);
}

function titlePlay(){
  var cont=document.getElementById('title-continue-btn');
  var hasRun=(typeof hasSave==='function'&&hasSave());
  cont.disabled=!hasRun;
  cont.classList.toggle('title-btn-disabled',!hasRun);
  _titleSwapPage(document.getElementById('title-page-main'),document.getElementById('title-page-play'));
}

function titleBack(){
  _titleSwapPage(document.getElementById('title-page-play'),document.getElementById('title-page-main'));
}

function titleNewRun(){
  hideTitleScreen();
  startGame();
}

function titleContinue(){
  if(!(typeof hasSave==='function'&&hasSave()))return;
  if(loadGame()){
    hideTitleScreen();
    resumeGame();
    toast('Welcome back!');
  } else {
    // Save was corrupt/cleared by loadGame — fall back to a fresh run.
    hideTitleScreen();
    startGame();
  }
}

function titleOptions(){openSettingsModal();}
function titleCollection(){openCollection();}

// Keep the logo tiles sized to the viewport while the title is up.
window.addEventListener('resize',function(){
  var ts=document.getElementById('title-screen');
  if(ts&&ts.style.display!=='none'&&!ts.classList.contains('title-hide'))buildTitleTiles();
});
