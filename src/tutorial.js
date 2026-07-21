// =====================================================================
// TUTORIAL — fully fabricated teaching run + step engine
//
// The tutorial never touches _rng(): the bag order, bounty scrolls, shop
// stock, slot results and constraint order are authored by hand, and the
// player is locked to the scripted action at every step, so every beat
// is guaranteed by construction.
//
// Engine pieces:
//  - TUT           global state ({active, step, sqLock, sqTarget, …})
//  - shade         full-screen dim layer; the pointed-at area is cut out
//                  with a blurred SVG mask (pointer-events:none — never
//                  blocks input). Hidden while scoring, and on steps with
//                  no target: dim only exists to point at a specific area.
//  - interception  document-level capture listeners block pointerdown /
//                  click etc. everywhere EXCEPT inside the current holes
//                  (and only when the step sets passthrough:true)
//  - sqLock        {sqIdx:'LETTER'} tile-placement lock (placeTile);
//    sqTarget      single allowed square for sticker placement (attachSqDrag);
//    discardSet    exact letters a discard must consist of (discardTiles)
//  - forceSlot     next spinSlots result override (authored slot outcome)
//  - tutEvent      fired from small hooks in play/game/shop code;
//    advanceWhen   polled each tick — either advances action steps
// =====================================================================
var TUT={active:false,step:-1,script:[],sqLock:null,sqTarget:null,discardSet:null,
  forceSlot:null,playMethod:null,methodDir:null,passthrough:false,_holes:[],
  _timer:null,_els:null,_popXY:null,_bypass:false,_blueId:null};

// ── Rect helpers ─────────────────────────────────────────────────────────────
function _tutRectEl(el,pad){
  if(!el)return null;
  var r=el.getBoundingClientRect();
  if(!r.width&&!r.height)return null;
  pad=pad==null?6:pad;
  return{l:r.left-pad,t:r.top-pad,w:r.width+pad*2,h:r.height+pad*2};
}
function _tutRect(sel,pad){return _tutRectEl(document.querySelector(sel),pad);}
function _tutSqRect(idx){return _tutRect('[data-sq-idx="'+idx+'"]',2);}
function _tutUnion(rs){
  rs=(rs||[]).filter(Boolean);
  if(!rs.length)return null;
  var l=1e9,t=1e9,r=-1e9,b=-1e9;
  for(var i=0;i<rs.length;i++){var x=rs[i];l=Math.min(l,x.l);t=Math.min(t,x.t);r=Math.max(r,x.l+x.w);b=Math.max(b,x.t+x.h);}
  return{l:l,t:t,w:r-l,h:b-t};
}
// Holes for a guided-word step: the locked squares, the whole hand, and the
// Play button once every square is filled.
function _tutWordHoles(lock){
  var holes=[],need=0;
  for(var k in lock){
    holes.push(_tutSqRect(+k));
    var _bt=S.bt[+k];
    if(!_bt||_bt.state==='dragging')need++;
  }
  holes.push(_tutRect('#hand-area',8));
  if(!need)holes.push(_tutRect('#pd-play-hit',4));
  return holes.filter(Boolean);
}
// Slot-tray pillow holding a specific prize id (post-spin claim step).
function _tutPillowHoles(id){
  var canvas=document.getElementById('shop-canvas');if(!canvas)return[];
  var d=sqd(id),out=[];
  for(var i=0;i<canvas.children.length;i++){
    var k=canvas.children[i];
    if(!k.style||k.style.zIndex!=='15')continue;
    var img=k.querySelector('img');
    var hit=img?img.src.indexOf(id)>=0:(d&&k.textContent.trim()===d.icon);
    if(hit)out.push(_tutRectEl(k,6));
  }
  return out.filter(Boolean);
}
// First button inside `sel` whose label starts with `prefix`.
function _tutBtnHole(sel,prefix){
  var btns=document.querySelectorAll(sel+' button');
  for(var i=0;i<btns.length;i++)if(btns[i].textContent.indexOf(prefix)===0)return _tutRectEl(btns[i],5);
  return null;
}

// ── Placement / action locks ─────────────────────────────────────────────────
function _tutPlaceOK(t,sqIdx){
  if(!TUT.active||!TUT.sqLock)return true;
  var want=TUT.sqLock[sqIdx];
  if(!want)return false;
  var l=t?(t.isBlank?(t.blankAs||'_'):t.letter):null;
  return l===want;
}
function _tutStickerOK(sqIdx){
  if(!TUT.active||TUT.sqTarget==null)return true;
  return sqIdx===TUT.sqTarget;
}
// ── Placement-method locks ────────────────────────────────────────────────────
// Each guided word teaches one way of playing tiles; the other paths are
// blocked with a corrective toast.
//   drag-single — drag tiles one at a time (selection disabled)
//   click-place — click a tile, then click a square (one selection max)
//   drag-group  — select several tiles and drag them together
//   click-group — select several tiles and left/right-click a square
// Selecting a tile (toggleSel, turning ON only).
function _tutSelTileOK(){
  if(!TUT.active||!TUT.playMethod)return true;
  var m=TUT.playMethod;
  if(m==='drag-single'){toast('Drag the tile onto the board for this word.');return false;}
  if(m==='click-place'){
    var n=0;for(var i=0;i<S.hand.length;i++)if(S.hand[i]&&S.hand[i].sel)n++;
    if(n>=1){toast('One tile at a time — click it, then click its square.');return false;}
  }
  return true;
}
// Dropping dragged tiles onto the board (n = tiles in the drag).
function _tutDragDropOK(n){
  if(!TUT.active||!TUT.playMethod)return true;
  var m=TUT.playMethod;
  if(m==='click-place'){toast('Click the tile, then click its square.');return false;}
  if(m==='click-group'){toast('Select the tiles, then click a square to place them.');return false;}
  if(m==='drag-group'&&n<2){toast('Select all the tiles first, then drag them together.');return false;}
  return true;
}
// Click-placing selected tiles on a square (dir: 'h' left-click, 'v' right-click).
function _tutClickPlaceOK(n,dir){
  if(!TUT.active||!TUT.playMethod)return true;
  var m=TUT.playMethod;
  if(m==='drag-single'||m==='drag-group'){toast('Drag the tiles onto the board for this word.');return false;}
  if(m==='click-group'){
    if(n<2){toast('Select all the tiles first.');return false;}
    if(TUT.methodDir&&dir!==TUT.methodDir){toast(TUT.methodDir==='v'?'Right-click the square to place the word downward.':'Left-click the square to place the word across.');return false;}
  }
  return true;
}
// Discard must consist of exactly the scripted letters.
function _tutDiscardOK(selIdxs){
  if(!TUT.active||!TUT.discardSet)return true;
  var want=TUT.discardSet.slice();
  for(var i=0;i<selIdxs.length;i++){
    var t=S.hand[selIdxs[i]];var l=t?(t.isBlank?'_':t.letter):null;
    var k=want.indexOf(l);
    if(k<0){toast('Discard exactly: '+TUT.discardSet.join(', '));return false;}
    want.splice(k,1);
  }
  if(want.length){toast('Discard exactly: '+TUT.discardSet.join(', '));return false;}
  return true;
}

// ── Input interception ───────────────────────────────────────────────────────
function _tutPtInHoles(x,y){
  if(x==null||y==null)return false;
  function hit(hs){for(var i=0;i<hs.length;i++){var r=hs[i];if(x>=r.l&&x<=r.l+r.w&&y>=r.t&&y<=r.t+r.h)return true;}return false;}
  if(hit(TUT._holes))return true;
  _tutTick(); // rects may be stale (game just re-rendered) — refresh and retry
  return hit(TUT._holes);
}
(function(){
  ['pointerdown','mousedown','click','dblclick','contextmenu'].forEach(function(evt){
    document.addEventListener(evt,function(e){
      if(!TUT.active||TUT._bypass)return;
      if(e.target&&e.target.closest&&e.target.closest('#tut-layer'))return;
      if(TUT.passthrough&&_tutPtInHoles(e.clientX,e.clientY))return;
      e.stopPropagation();e.preventDefault();
    },true);
  });
})();

// ── Overlay DOM ──────────────────────────────────────────────────────────────
function _tutBuildLayer(){
  var old=document.getElementById('tut-layer');
  if(old&&old.parentNode)old.parentNode.removeChild(old);
  var layer=document.createElement('div');layer.id='tut-layer';
  layer.innerHTML=
    '<div id="tut-shade"></div>'+
    '<div id="tut-arrow"></div>'+
    '<div id="tut-pop">'+
      '<div id="tut-pop-title"></div>'+
      '<div id="tut-pop-text"></div>'+
      '<div id="tut-pop-btns"><button id="tut-next-btn">Next →</button></div>'+
      '<div id="tut-pop-step"></div>'+
    '</div>'+
    '<button id="tut-exit">✕ Exit Tutorial</button>';
  document.body.appendChild(layer);
  TUT._els={
    layer:layer,
    shade:document.getElementById('tut-shade'),
    arrow:document.getElementById('tut-arrow'),
    pop:document.getElementById('tut-pop'),
    title:document.getElementById('tut-pop-title'),
    text:document.getElementById('tut-pop-text'),
    btns:document.getElementById('tut-pop-btns'),
    nextBtn:document.getElementById('tut-next-btn'),
    stepLbl:document.getElementById('tut-pop-step')
  };
  TUT._els.nextBtn.addEventListener('click',function(){
    var st=TUT.script[TUT.step];
    if(st&&st.onNext)st.onNext();else TUT.next();
  });
  document.getElementById('tut-exit').addEventListener('click',function(){
    if(confirm('Exit the tutorial? A new run will start.')){
      _tutTeardown();
      if(S)delete S.tutorial;
      startGame();
    }
  });
}

// Dim mask: white = shaded, holes = clear. feGaussianBlur softens the hole
// edges; the outer rect extends past the viewport so the blur never thins
// the shade at the screen border.
function _tutMask(holes){
  var sh=TUT._els.shade;if(!sh)return;
  var W=window.innerWidth,H=window.innerHeight,M=80;
  var d='M'+(-M)+' '+(-M)+'H'+(W+M)+'V'+(H+M)+'H'+(-M)+'Z';
  for(var i=0;i<holes.length;i++){
    var r=holes[i];
    d+=' M'+Math.round(r.l)+' '+Math.round(r.t)+'h'+Math.round(r.w)+'v'+Math.round(r.h)+'h-'+Math.round(r.w)+'Z';
  }
  var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'">'
    +'<defs><filter id="f" x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation="9"/></filter></defs>'
    +'<path filter="url(#f)" fill-rule="evenodd" fill="#fff" d="'+d+'"/></svg>';
  var url='url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';
  sh.style.webkitMaskImage=url;sh.style.maskImage=url;
  sh.style.webkitMaskSize='100% 100%';sh.style.maskSize='100% 100%';
}

function _tutPlacePopup(st,holes){
  var pop=TUT._els.pop,arrow=TUT._els.arrow;
  var W=window.innerWidth,H=window.innerHeight;
  var pw=pop.offsetWidth,ph=pop.offsetHeight;
  // Look-around steps: small popup parked at the bottom edge, no arrow.
  if(st.pos==='bottom'){
    arrow.style.display='none';
    pop.style.left=((W-pw)/2)+'px';pop.style.top=(H-ph-20)+'px';
    TUT._popXY=null;
    return;
  }
  var u=null;
  if(st.side!=='center'){
    if(st.popHole!=null)u=holes[st.popHole]||_tutUnion(holes);
    else u=_tutUnion(holes);
  }
  var x,y,side=null;
  if(!u){
    x=(W-pw)/2;y=(H-ph)/2;
  }else{
    side=st.popSide||'auto';
    if(side==='auto'){
      var sp={right:W-(u.l+u.w),left:u.l,bottom:H-(u.t+u.h),top:u.t};
      var best=-1;for(var k in sp){if(sp[k]>best){best=sp[k];side=k;}}
    }
    var G=24;
    if(side==='right'){x=u.l+u.w+G;y=u.t+u.h/2-ph/2;}
    else if(side==='left'){x=u.l-pw-G;y=u.t+u.h/2-ph/2;}
    else if(side==='bottom'){x=u.l+u.w/2-pw/2;y=u.t+u.h+G;}
    else{x=u.l+u.w/2-pw/2;y=u.t-ph-G;}
    x=Math.max(10,Math.min(W-pw-10,x));
    y=Math.max(10,Math.min(H-ph-10,y));
  }
  // Damp jitter from spring-physics targets
  if(TUT._popXY&&Math.abs(TUT._popXY.x-x)+Math.abs(TUT._popXY.y-y)<7){x=TUT._popXY.x;y=TUT._popXY.y;}
  TUT._popXY={x:x,y:y};
  pop.style.left=x+'px';pop.style.top=y+'px';
  if(!u||!side){arrow.style.display='none';return;}
  arrow.style.display='block';
  var C='#6a6aa0',s=11;
  var ay=Math.max(y+8,Math.min(y+ph-8-2*s,u.t+u.h/2-s));
  var ax=Math.max(x+8,Math.min(x+pw-8-2*s,u.l+u.w/2-s));
  if(side==='right'){arrow.style.borderWidth=s+'px '+s+'px '+s+'px 0';arrow.style.borderColor='transparent '+C+' transparent transparent';arrow.style.left=(x-s)+'px';arrow.style.top=ay+'px';}
  else if(side==='left'){arrow.style.borderWidth=s+'px 0 '+s+'px '+s+'px';arrow.style.borderColor='transparent transparent transparent '+C;arrow.style.left=(x+pw)+'px';arrow.style.top=ay+'px';}
  else if(side==='bottom'){arrow.style.borderWidth='0 '+s+'px '+s+'px '+s+'px';arrow.style.borderColor='transparent transparent '+C+' transparent';arrow.style.left=ax+'px';arrow.style.top=(y-s)+'px';}
  else{arrow.style.borderWidth=s+'px '+s+'px 0 '+s+'px';arrow.style.borderColor=C+' transparent transparent transparent';arrow.style.left=ax+'px';arrow.style.top=(y+ph)+'px';}
}

function _tutTick(){
  if(!TUT.active||!TUT._els)return;
  var st=TUT.script[TUT.step];if(!st)return;
  if(st.advanceWhen&&st.advanceWhen()){TUT.next();return;}
  var holes=(st.holes?st.holes():[]).filter(Boolean);
  TUT._holes=holes;
  var e=TUT._els;
  // revealOnHoles: keep the popup hidden until the step's target exists
  // (e.g. slot-tray prizes have popped out), then wait revealDelay ms more
  // so the player sees the result before the instruction appears.
  var reveal=true;
  if(st.revealOnHoles){
    if(!holes.length){TUT._revealT=0;reveal=false;}
    else{
      if(!TUT._revealT)TUT._revealT=Date.now();
      if(Date.now()-TUT._revealT<(st.revealDelay||1000))reveal=false;
    }
  }
  // While a word is scoring, get the tutorial chrome out of the way entirely.
  if(window._scoring||!reveal){
    e.shade.style.display='none';e.pop.style.display='none';e.arrow.style.display='none';
    return;
  }
  e.pop.style.display='';
  // Dim only exists to point at a specific area — no target, no dim.
  e.shade.style.display=holes.length?'':'none';
  if(holes.length)_tutMask(holes);
  _tutPlacePopup(st,holes);
}

// ── Step control ─────────────────────────────────────────────────────────────
TUT.go=function(i){
  TUT.step=i;
  var st=TUT.script[i];
  if(!st){_tutTeardown();return;}
  TUT.sqLock=st.sqLock||null;
  TUT.sqTarget=(st.sqTarget!=null)?st.sqTarget:null;
  TUT.discardSet=st.discardSet||null;
  TUT.playMethod=st.method||null;
  TUT.methodDir=st.methodDir||null;
  TUT.passthrough=!!st.passthrough;
  TUT._popXY=null;
  if(S&&S.tutorial)S.tutorial.step=i;
  TUT._revealT=0;
  if(st.onEnter)st.onEnter();
  var e=TUT._els;
  e.title.textContent=st.title||'';
  e.title.style.display=st.title?'block':'none';
  e.text.innerHTML=st.text||'';
  Array.prototype.forEach.call(e.btns.querySelectorAll('.tut-custom-btn'),function(b){b.remove();});
  if(st.buttons){
    e.nextBtn.style.display='none';
    st.buttons.forEach(function(bd){
      var b=document.createElement('button');
      b.className='tut-custom-btn';
      b.textContent=bd.label;b.onclick=bd.fn;
      e.btns.appendChild(b);
    });
  }else{
    e.nextBtn.style.display=(st.next||st.onNext)?'inline-block':'none';
    e.nextBtn.textContent=st.nextLabel||'Next →';
  }
  e.stepLbl.textContent=(i+1)+' / '+TUT.script.length;
  _tutTick();
};
TUT.next=function(){TUT.go(TUT.step+1);};

// Fired from small hooks in play.js / game.js / shop.js.
function tutEvent(name,data){
  if(!TUT.active)return;
  var st=TUT.script[TUT.step];
  if(!st||st.advanceOn!==name)return;
  if(st.check&&!st.check(data))return;
  TUT.next();
}

function _tutTeardown(){
  TUT.active=false;TUT.sqLock=null;TUT.sqTarget=null;TUT.discardSet=null;
  TUT.forceSlot=null;TUT.playMethod=null;TUT.methodDir=null;
  TUT.passthrough=false;TUT._holes=[];TUT._blueId=null;
  if(TUT._timer){clearInterval(TUT._timer);TUT._timer=null;}
  var l=document.getElementById('tut-layer');
  if(l&&l.parentNode)l.parentNode.removeChild(l);
}

// Tutorial complete / released early: the fabricated run becomes a normal run.
function _tutFinish(){
  if(S)delete S.tutorial;
  _tutTeardown();
  saveGame();
}

// ── Fabricated game state ────────────────────────────────────────────────────
// drawFull pops from the END of S.bag, so bags are authored in draw order and
// reversed. Round 1 draws: C R A N E P L | A E T S O | N I L E R
//  - hand 1 (7): spells CRANE, keeps P L
//  - after CRANE (draw 5): P L A E T S O — spells PLANET through the board N
//  - after PLANET (draw 5): S O N I L E R — round 2's TONES + spares
// The bag is re-authored at shop 1 for rounds 2–3 (see _tutBuildScript).
function _tutTile(l){return{letter:l,isBlank:false,id:uid(),variant:null,state:'stored',storedIn:'bag'};}
// Authored draws sit on TOP of the bag (end of the array — drawFull pops from
// there); the remainder of a standard tile set fills the space beneath so the
// bag looks full. The filler is never drawn during the script: every draw is
// scripted and consumes the authored top exactly.
function _tutAuthorBag(draws){
  var used={};
  function use(l){used[l]=(used[l]||0)+1;}
  draws.split('').forEach(use);
  (S.hand||[]).forEach(function(t){if(t&&!t.isBlank)use(t.letter);});
  for(var i=0;i<BN;i++){
    if(S.bt[i]&&!S.bt[i].isBlank)use(S.bt[i].letter);
    if(S.btTop&&S.btTop[i]&&!S.btTop[i].isBlank)use(S.btTop[i].letter);
  }
  var filler=[];
  Object.keys(DIST).forEach(function(l){
    var n=DIST[l]-(used[l]||0);
    for(var k=0;k<n;k++)filler.push(_tutTile(l));
  });
  filler.push({letter:'_',isBlank:true,id:uid(),variant:null,state:'stored',storedIn:'bag'});
  filler.push({letter:'_',isBlank:true,id:uid(),variant:null,state:'stored',storedIn:'bag'});
  S.bag=filler.concat(draws.split('').map(_tutTile).reverse());
  var pool=S.bag.slice();
  (S.hand||[]).forEach(function(t){if(t)pool.push(t);});
  for(var i=0;i<BN;i++){
    if(S.bt[i])pool.push(S.bt[i]);
    if(S.btTop&&S.btTop[i])pool.push(S.btTop[i]);
  }
  S.pool=pool;
}
function _tutScroll(theme,ws){return{theme:theme,words:ws.map(function(w){return{word:w,reward:_bountyWordReward(w)};})};}

// Authored board geometry (B=15 wide, BH=12 tall — centre row is 6):
//  CRANE  across row 6, cols 5–9 (A on the centre star at 97)
//  PLANET down col 8, rows 3–8 — reuses CRANE's committed N at 98
//  TONES  across row 8, cols 8–12 — reuses PLANET's T at 128
//  AMAZON down col 7, rows 6–11 — reuses CRANE's A at 97; forms crosswords
//         ME (112+113) and ATONES (127+row 8)
//  PYLON  across row 3, cols 8–12 — reuses PLANET's P at 53; the Y lands on
//         the player's TL at 54
var _TUT_CRANE={95:'C',96:'R',97:'A',98:'N',99:'E'};
var _TUT_PLANET={53:'P',68:'L',83:'A',113:'E',128:'T'};
var _TUT_TONES={129:'O',130:'N',131:'E',132:'S'};
var _TUT_AMAZON={112:'M',127:'A',142:'Z',157:'O',172:'N'};
var _TUT_PYLON={54:'Y',55:'L',56:'O',57:'N'};
var _TUT_TL_SQ=54;

function startTutorial(){
  var dd=document.getElementById('menu-dropdown');if(dd)dd.style.display='none';
  if(typeof hasSave==='function'&&hasSave()&&!confirm('Starting the tutorial ends your current run. Continue?'))return;
  startGame(1);
  S.tutorial={step:0};
  S.hand=[];HP.x=[];HP.vx=[];
  // Draw order is authored so group-placed words later sit in the hand in
  // word order (group placement follows hand order, not click order):
  // round 2's TONES needs O<N<E<S in hand → O,I kept from CRANE's draws.
  _tutAuthorBag('CRANEPL'+'AETOI'+'NELSR');
  S.bounties=[
    _tutScroll('Rivers',['nile','amazon','seine','thames','ganges','yangtze']),
    _tutScroll('Ocean',['wave','kelp','coral','lagoon','trench','horizon']),
    _tutScroll('Blacksmith',['weld','forge','anvil','smith','temper','furnace'])
  ];
  S.constraintOrder=['c_long','c_pal','c_longer','c_letters'];
  drawFull();renderAll();
  TUT.script=_tutBuildScript();
  _tutBuildLayer();
  TUT.active=true;
  if(TUT._timer)clearInterval(TUT._timer);
  TUT._timer=setInterval(_tutTick,110);
  TUT.go(0);
}

// ── The script ───────────────────────────────────────────────────────────────
function _tutBuildScript(){
  var firstScroll=function(){return document.querySelector('#bounty-row .bounty-scroll');};
  return[
    // ═══ ROUND 1 — UI tour + first words ═══
    {title:'Welcome',next:true,
     holes:function(){return[_tutRect('#hand-area',8)];},
     text:'This is your hand of 7 tiles. Drag a tile onto the board, or click it and then click a square.<br><br>You can leave the tutorial at any time with <b>Exit Tutorial</b> in the bottom-left corner.'},

    {title:'Letters × Mult',next:true,
     holes:function(){return[_tutUnion([_tutRect('#stat-word-score-box',4),_tutRect('#stat-progress-box',4)])];},
     text:'Words score their letter values × a multiplier. Playing more than 3 tiles adds +1 mult per extra tile. Stickers and stamps raise both numbers.'},

    {title:'Score & Target',next:true,
     holes:function(){return[_tutRect('#live-score-row',6)];},
     text:'Your current score and the round\'s target. Beat the target to win the round.'},

    {title:'Gold',next:true,
     holes:function(){return[_tutRect('#stat-gold-box',4)];},
     text:'Earned from winning rounds, unused plays, and bounties. Spent in the shop between rounds.'},

    {title:'Plays',next:true,popHole:0,
     holes:function(){return[_tutRect('#stat-plays-box',4),_tutRect('#pd-play-hit',4)];},
     text:'Playing a word costs <b>1 Play</b> — the green button, bottom-right. If you run out of plays before reaching the target, the run ends.'},

    {title:'Discards',next:true,popHole:0,
     holes:function(){return[_tutRect('#stat-disc-box',4),_tutRect('#pd-disc-hit',4)];},
     text:'A discard — the red button, bottom-right — swaps your selected tiles for new ones. You get 3 per round.'},

    {title:'Progress',next:true,
     holes:function(){return[_tutRect('#score-bar-wrap',8)];},
     text:'This bar fills as you score. Reach the top to clear the round.'},

    {title:'Board Tracker',next:true,
     holes:function(){return[_tutRect('#progress-tracker-sprite',6)];},
     text:'The run is 4 boards of 3 rounds each. This tracker shows where you are. The third round of every board has a constraint.'},

    {title:'Bounty Scrolls',next:true,
     holes:function(){return[_tutRect('#bounty-row',6)];},
     text:'Each scroll lists six themed words. Playing any of them pays gold and boosts that word\'s score.'},

    {title:'Stamps',next:true,
     holes:function(){return[_tutRect('#stamp-bar',6)];},
     text:'Stamps bought in the shop sit here and apply to every word you play. They trigger left to right.'},

    {title:'The Tile Bag',next:true,
     holes:function(){return[_tutUnion([_tutRect('#bag-btn',4),_tutRect('#bag-count',4)])];},
     text:'The bag holds your undrawn tiles. Click it during a round to see what\'s left.'},

    {title:'The Menu',next:true,
     holes:function(){return[_tutRect('#menu-wrap',4)];},
     text:'The collection, dictionary, achievements, and new runs are here.'},

    {title:'First Word',passthrough:true,sqLock:_TUT_CRANE,advanceOn:'word-played',method:'drag-single',
     holes:function(){return _tutWordHoles(_TUT_CRANE);},
     text:'Spell <b>CRANE</b> left to right through the centre star: <b>drag</b> each tile from your hand onto its square, one at a time. Then press <b>Play</b>.'},

    {title:'36 Points',next:true,
     holes:function(){return[_tutRect('#live-score-row',6)];},
     text:'CRANE scored 12 letter points × 3 mult (1 base, +2 for playing five tiles). The target is 50.'},

    {title:'Connect Words',passthrough:true,sqLock:_TUT_PLANET,advanceOn:'round-complete',method:'click-place',
     holes:function(){return _tutWordHoles(_TUT_PLANET);},
     text:'New words must connect to tiles already on the board — and there\'s a second way to place them: <b>click</b> a tile, then <b>click its square</b>. Spell <b>PLANET</b> downward through CRANE\'s N, one tile at a time, then press <b>Play</b>.'},

    {title:'Round Complete',passthrough:true,advanceOn:'shop-entered',
     holes:function(){return[_tutRect('#round-modal .modal',8)];},
     text:'Unused plays convert to bonus gold. Press <b>Continue</b>.'},

    // ═══ SHOP 1 — TL sticker + Pressure Cooker ═══
    {title:'The Shop',pos:'bottom',next:true,nextLabel:'Continue →',
     onEnter:function(){
       shopPool.sq=[{id:'tl',sold:false},{id:'echo',sold:false}];
       shopPool.bounties=[_tutScroll('Wild West',['spur','posse','lasso','cowboy','saloon','showdown']),
                          _tutScroll('Carpentry',['saw','plane','chisel','lathe','sawdust','dovetail']),
                          _tutScroll('Buddhism',['zen','monk','karma','mantra','pagoda','nirvana'])]
         .map(function(sc){return{theme:sc.theme,words:sc.words,cost:2,accepted:false};});
       // Rounds 2–3 draw order: post-TONES M,U,D,G | dig discards A,Z,T,E,W,I /
       // O,S,U,G / N,I,L | post-AMAZON E,U,G,D,S | round-3 discard draws
       // T,N,O (after the blue X).
       _tutAuthorBag('MUDG'+'AZTEWI'+'OSUG'+'NIL'+'EUGDS');
       renderShop();
     },
     text:'Between rounds, gold buys stickers, stamps, bounty scrolls and slot spins. Take a look around.'},

    {title:'Bounties For Sale',next:true,
     holes:function(){return[_tutUnion([_tutRect('#shop-bounty-label',4),_tutRect('#shop-bounty-list',4)])];},
     text:'Extra bounty scrolls cost $2 each. You already have three active, so skip these.'},

    {title:'Buy a Sticker',passthrough:true,
     holes:function(){return[_tutRect('#shop-pack-0',6)];},
     advanceWhen:function(){return shopPool.sq&&shopPool.sq[0]&&shopPool.sq[0].sold;},
     text:'Stickers modify board squares. Buy the <b>Quadruple Letter</b> for $3 — it quadruples any letter played on it.'},

    {title:'The Slot Machine',passthrough:true,
     onEnter:function(){
       S.stickerInventory=[{id:'tl'}]; // one TL is enough for the lesson
       TUT.forceSlot=['pressure_cooker','inkwell','the_miser'];
       renderShop();
     },
     holes:function(){return[_tutRect('#shop-handle-hit',6)];},
     advanceWhen:function(){return !!(shopPool.slotResult&&shopPool.slotResult.length);},
     text:'A spin costs $2 and shows three prizes — you keep one. Drag the handle down and release.'},

    {title:'Claim a Prize',passthrough:true,revealOnHoles:true,revealDelay:1200,
     holes:function(){return _tutPillowHoles('pressure_cooker');},
     advanceWhen:function(){return hasStamp('pressure_cooker');},
     text:'Click the <b>Pressure Cooker</b> to claim it.'},

    {title:'Pressure Cooker',next:true,
     holes:function(){return[_tutRect('#shop-stamp-bar',6)];},
     text:'Each discard stores <b>+1 mult</b> for your next word, then resets after you play.'},

    {title:'Leave the Shop',passthrough:true,
     holes:function(){return[_tutRect('.shop-top-btn.green',6)];},
     advanceWhen:function(){return S.phase==='placing';},
     text:'Press <b>Leave</b> to go place the sticker.'},

    {title:'Place the Sticker',passthrough:true,sqTarget:_TUT_TL_SQ,
     holes:function(){
       var hs=[_tutSqRect(_TUT_TL_SQ)];
       var staged=S.sqStaged&&Object.keys(S.sqStaged).length>0;
       if(staged)hs.push(_tutRect('#placing-controls .btn-green',6));
       else hs.push(_tutRect('#hand-area',8));
       return hs;
     },
     advanceWhen:function(){return S.phase==='play'&&S.board[_TUT_TL_SQ]==='tl';},
     text:'Drag the <b>Quadruple Letter</b> onto the marked square, then press <b>Confirm</b>.'},

    // ═══ ROUND 2 — bounty hunting with discards ═══
    {title:'Round 2',next:true,
     holes:function(){return[_tutRect('#live-score-row',6)];},
     text:'The target is 75. The board and your sticker carry over between rounds.'},

    {title:'Group Drag',passthrough:true,sqLock:_TUT_TONES,advanceOn:'word-played',method:'drag-group',
     holes:function(){return _tutWordHoles(_TUT_TONES);},
     text:'Tiles can move as a group: click <b>O, N, E</b> and <b>S</b> to select them, then <b>drag one</b> — the rest follow. Drop them after PLANET\'s T. (<b>Shift</b> or <b>right-click</b> flips the group between across and down.) Then press <b>Play</b>.'},

    {title:'Not Enough',next:true,
     holes:function(){return[_tutRect('#live-score-row',6)];},
     text:'20 points. At this rate the target is out of reach — check the bounty list.'},

    {title:'The Rivers Scroll',passthrough:true,
     holes:function(){var sc=firstScroll();return sc?[_tutRectEl(sc,6)]:[];},
     advanceWhen:function(){var sc=firstScroll();return!!(sc&&sc._unfurled);},
     text:'Click the <b>Rivers</b> scroll to open it.'},

    {title:'Bounty Words',popSide:'left',
     onNext:function(){
       var sc=firstScroll();
       if(sc&&sc._unfurled){TUT._bypass=true;try{sc.click();}catch(e){}TUT._bypass=false;}
       TUT.next();
     },next:true,
     holes:function(){var sc=firstScroll();return sc?[_tutRectEl(sc,6)]:[];},
     text:'Playing a listed word pays its gold and <b>doubles the word\'s multiplier</b>. AMAZON is worth the most here. You\'re missing its letters — use discards to find them while the Pressure Cooker builds mult.'},

    {title:'Discard 1 of 3',passthrough:true,sqLock:{},discardSet:['I','L','R','U','D','G'],advanceOn:'discard',popHole:0,
     holes:function(){return[_tutRect('#hand-area',8),_tutRect('#pd-disc-hit',4)];},
     text:'Only the <b>M</b> is an AMAZON letter — keep it and discard the other six, then press <b>Discard</b>. (+1 mult stored.)'},

    {title:'Discard 2 of 3',passthrough:true,sqLock:{},discardSet:['T','E','W','I'],advanceOn:'discard',popHole:0,
     holes:function(){return[_tutRect('#hand-area',8),_tutRect('#pd-disc-hit',4)];},
     text:'The <b>A</b> and <b>Z</b> arrived. Keep them and discard the <b>T, E, W</b> and <b>I</b>. (+2 stored.)'},

    {title:'Discard 3 of 3',passthrough:true,sqLock:{},discardSet:['S','U','G'],advanceOn:'discard',popHole:0,
     holes:function(){return[_tutRect('#hand-area',8),_tutRect('#pd-disc-hit',4)];},
     text:'There\'s the <b>O</b>. Discard the <b>S, U</b> and <b>G</b> to dig for the N. (+3 stored.)'},

    {title:'Play the Bounty',passthrough:true,sqLock:_TUT_AMAZON,advanceOn:'round-complete',method:'click-group',methodDir:'v',
     holes:function(){return _tutWordHoles(_TUT_AMAZON);},
     text:'A selected group can also be placed with one click: <b>left-click</b> a square to place across, <b>right-click</b> to place down. Select <b>M, A, Z, O</b> and <b>N</b>, then <b>right-click</b> the marked square under CRANE\'s A. It also forms ME and ATONES — crosswords score too. Press <b>Play</b>.'},

    {title:'Round Complete',passthrough:true,advanceOn:'shop-entered',
     holes:function(){return[_tutRect('#round-modal .modal',8)];},
     text:'The bounty paid gold and the stored mult multiplied everything. Press <b>Continue</b>.'},

    // ═══ SHOP 2 — Yankee + blue Y ═══
    {title:'One Round Left',side:'center',next:true,
     onEnter:function(){
       shopPool.sq=[{id:'dl',sold:false},{id:'dw',sold:false}];
       shopPool.bounties=[_tutScroll('New Zealand Birds',['tui','kiwi','weka','kakapo','pukeko','morepork']),
                          _tutScroll('Australian Animals',['roo','koala','dingo','quokka','wombat','platypus']),
                          _tutScroll('Wild West',['spur','posse','lasso','cowboy','saloon','showdown'])]
         .map(function(sc){return{theme:sc.theme,words:sc.words,cost:2,accepted:false};});
       // Round-3 draws (after the promoted blue Y): O,N + spares. The standard
       // set's two Y tiles land in the filler — buried below the authored
       // draws, so the only way a Y arrives in round 3 is the blue-anchor
       // promotion the player performs. The shop bag is view-only, so the
       // tutorial pre-varnishes the Y the promotion lesson targets.
       _tutAuthorBag('ONTEA'+'RSD');
       var ys=S.bag.filter(function(t){return t.letter==='Y';});
       TUT._blueId=ys.length?ys[0].id:null;
       if(ys.length)ys[0].material='varnished';
       renderShop();
     },
     text:'The last round of the board is next, and it has a constraint. Set up for it here.'},

    {title:'Spin Again',passthrough:true,
     onEnter:function(){TUT.forceSlot=['yankee','hotel','kilo'];},
     holes:function(){return[_tutRect('#shop-handle-hit',6)];},
     advanceWhen:function(){return !!(shopPool.slotResult&&shopPool.slotResult.length);},
     text:'Pull the handle again ($2).'},

    {title:'Claim the Yankee',passthrough:true,revealOnHoles:true,revealDelay:1200,
     holes:function(){return _tutPillowHoles('yankee');},
     advanceWhen:function(){return hasStamp('yankee');},
     text:'Click the <b>Yankee</b> stamp to claim it.'},

    {title:'Yankee',next:true,
     holes:function(){return[_tutRect('#shop-stamp-bar',6)];},
     text:'Each Y in a word now gives <b>+12 letter score and +4 mult</b>. You just need a Y.'},

    {title:'The Tile Bag',passthrough:true,
     holes:function(){return[_tutRect('#shop-bag-btn',6)];},
     advanceWhen:function(){var o=document.getElementById('shop-bag-overlay');return!!(o&&o.style.display==='flex'&&o.style.visibility!=='hidden');},
     text:'You can check on your tiles from the shop too. Click the bag.'},

    {title:'The Bag',pos:'bottom',next:true,nextLabel:'Continue →',
     text:'Every tile you haven\'t drawn yet, grouped by letter. A <b>varnished Y</b> is buried in here — it\'ll matter next round.'},

    {title:'Close the Bag',passthrough:true,
     holes:function(){return[_tutRect('#shop-bag-overlay button',6)];},
     advanceWhen:function(){var o=document.getElementById('shop-bag-overlay');return!!(o&&o.style.display==='none');},
     text:'Press <b>Close</b>.'},

    {title:'Leave the Shop',passthrough:true,
     holes:function(){return[_tutRect('.shop-top-btn.green',6)];},
     advanceWhen:function(){return S.phase==='play';},
     text:'Everything is set. Press <b>Leave</b>.'},

    // ═══ ROUND 3 — constraint + the PYLON payoff ═══
    {title:'The Constraint',next:true,
     holes:function(){return[_tutRect('#stat-rounds-box',6)];},
     text:'This round, only words of <b>5 or more letters</b> score. The target is 125.'},

    {title:'Open the Bag',passthrough:true,
     holes:function(){return[_tutRect('#bag-btn',6)];},
     advanceWhen:function(){var o=document.getElementById('bag-ui-overlay');return!!(o&&o.style.display==='flex'&&o.style.visibility!=='hidden');},
     text:'That varnished Y is still deep in the bag. Click the bag.'},

    {title:'The Bag',pos:'bottom',next:true,nextLabel:'Continue →',
     text:'Everything you haven\'t drawn yet.'},

    {title:'Find the Y',passthrough:true,
     holes:function(){return[_tutRect('#bag-ui-tiles .bag-float-item[data-letter="Y"]',6)];},
     advanceWhen:function(){var c=document.getElementById('bag-ui-tiles');return!!(c&&c.dataset.expandedLetter==='Y');},
     text:'Click the <b>Y</b> to expand it.'},

    {title:'Pick the Varnished Y',passthrough:true,
     holes:function(){
       var b=_tutRect('#_bag-expand-stack .mat-varnished',6);
       if(b)return[b];
       return[_tutRect('#bag-ui-tiles .bag-float-item[data-letter="Y"]',6)].filter(Boolean);
     },
     advanceWhen:function(){return!!(S.bagBlueAnchors&&S.bagBlueAnchors['Y']===TUT._blueId);},
     text:'Click the <b>varnished Y</b> to set it as your next draw.'},

    {title:'Close the Bag',passthrough:true,revealOnHoles:true,revealDelay:1800,
     holes:function(){return[_tutRect('#bag-ui-overlay button',6)];},
     advanceWhen:function(){var o=document.getElementById('bag-ui-overlay');return!!(o&&o.style.display==='none');},
     text:'The varnished Y is queued up. Press <b>Close</b>.'},

    {title:'Dig It Out',passthrough:true,sqLock:{},discardSet:['I','E','U','G','D','S'],advanceOn:'discard',popHole:0,
     holes:function(){return[_tutRect('#hand-area',8),_tutRect('#pd-disc-hit',4)];},
     text:'Keep the <b>L</b> and discard the other six. The varnished Y is drawn first.'},

    {title:'The Payoff',passthrough:true,sqLock:_TUT_PYLON,advanceOn:'round-complete',
     holes:function(){return _tutWordHoles(_TUT_PYLON);},
     text:'Spell <b>PYLON</b> from PLANET\'s P, placing tiles any way you like — the Y lands on your Quadruple Letter, and the Yankee stamp triggers. Press <b>Play</b>.'},

    {title:'Board Cleared',
     holes:function(){return[_tutRect('#round-modal .modal',8)];},
     buttons:[
       {label:'Continue this run →',fn:function(){
         _tutFinish();
         var b=document.querySelector('#round-modal .btn');
         if(b)b.click();
         toast('Tutorial complete — the run is yours!');
       }},
       {label:'New run',fn:function(){
         _tutTeardown();
         if(S)delete S.tutorial;
         startGame();
       }}
     ],
     text:'That\'s the tutorial: stickers, stamps, bounties and discards, working together. Keep this run going without guidance, or start fresh.'}
  ];
}
