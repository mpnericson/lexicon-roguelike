// =====================================================================
// GAME STATE — global state, lifecycle, modals, utilities
// =====================================================================
var BOUNTY_WORDS=[
  // 3-4 letters — cost $2, reward $5
  {word:'CAT',cost:2,reward:5},{word:'DOG',cost:2,reward:5},{word:'BAT',cost:2,reward:5},
  {word:'HAT',cost:2,reward:5},{word:'RUN',cost:2,reward:5},{word:'JAM',cost:2,reward:5},
  {word:'BOX',cost:2,reward:5},{word:'GEM',cost:2,reward:5},{word:'OAK',cost:2,reward:5},
  {word:'AXE',cost:2,reward:5},{word:'JOY',cost:2,reward:5},{word:'MUG',cost:2,reward:5},
  {word:'WEB',cost:2,reward:5},{word:'ICE',cost:2,reward:5},{word:'PIE',cost:2,reward:5},
  {word:'FOX',cost:2,reward:5},{word:'LOG',cost:2,reward:5},{word:'HOP',cost:2,reward:5},
  {word:'MAP',cost:2,reward:5},{word:'CUP',cost:2,reward:5},{word:'DIM',cost:2,reward:5},
  {word:'WAX',cost:2,reward:6},{word:'RUG',cost:2,reward:5},{word:'ZAP',cost:2,reward:6},
  {word:'VEX',cost:2,reward:6},{word:'TAX',cost:2,reward:6},{word:'SKY',cost:2,reward:5},
  {word:'FLY',cost:2,reward:5},{word:'BIG',cost:2,reward:5},{word:'SIT',cost:2,reward:5},
  // 5 letters — cost $3, reward $8
  {word:'STONE',cost:3,reward:8},{word:'BREAD',cost:3,reward:8},{word:'FLAME',cost:3,reward:8},
  {word:'BRAVE',cost:3,reward:8},{word:'CLEAN',cost:3,reward:8},{word:'FROST',cost:3,reward:8},
  {word:'GLASS',cost:3,reward:8},{word:'PLANT',cost:3,reward:8},{word:'DREAM',cost:3,reward:8},
  {word:'STEAM',cost:3,reward:8},{word:'CRANE',cost:3,reward:8},{word:'BLAZE',cost:3,reward:8},
  {word:'CHESS',cost:3,reward:9},{word:'CRISP',cost:3,reward:9},{word:'BRISK',cost:3,reward:9},
  {word:'QUIRK',cost:3,reward:10},{word:'FJORD',cost:3,reward:11},{word:'LYMPH',cost:3,reward:11},
  {word:'PLUMB',cost:3,reward:9},{word:'SNOWY',cost:3,reward:8},
  // 6-7 letters — cost $4, reward $13
  {word:'CASTLE',cost:4,reward:13},{word:'FROZEN',cost:4,reward:13},{word:'GRAVEL',cost:4,reward:13},
  {word:'JIGSAW',cost:4,reward:14},{word:'FRENZY',cost:4,reward:13},{word:'HUMBLE',cost:4,reward:13},
  {word:'SWORDS',cost:4,reward:13},{word:'PLAGUE',cost:4,reward:13},{word:'BREEZE',cost:4,reward:13},
  {word:'JUNGLE',cost:4,reward:13},{word:'MUSCLE',cost:4,reward:13},{word:'GAZEBO',cost:4,reward:14},
];
var S={};
var DICT=null;
var activeDrag=null;
var _dragEndTime=0;
var _hl=-1;
var viewingBoard=false;
var shopPool={sq:[],tileCards:[],packs:[],bounties:[]};

function buildBag(){
  var bag=[];var ks=Object.keys(DIST);
  for(var i=0;i<ks.length;i++)for(var j=0;j<DIST[ks[i]];j++)bag.push({letter:ks[i],isBlank:false,id:uid()});
  bag.push({letter:'_',isBlank:true,id:uid()});bag.push({letter:'_',isBlank:true,id:uid()});
  return shuffle(bag);
}

function startGame(seed){
  clearSave();
  closeAllModals();
  var s=(seed!==undefined&&seed!==null)?((parseInt(seed)>>>0)||1):Math.floor(Math.random()*900000)+100000;
  _rngSeed(s);
  S={bag:buildBag(),hand:[],board:Array(B*B).fill(null),bt:Array(B*B).fill(null),btTop:Array(B*B).fill(null),
     ai:0,bi:0,score:0,gold:4,plays:4,disc:3,wtr:0,ts:0,placed:[],discPressure:0,censorApplied:false,alchemistUsed:false,palUnlocked:false,devMode:false,
     phase:'play',pendingSquares:[],sqHand:[],sqStaged:{},seed:s,_slotMachineRoll:null,bounties:[],bhMult:1,palMult:1,palWords:[],localCooldowns:new Set(),
     lastWordLen:0,endless:false,endlessRound:0,roundsCompleted:0,drunkStreak:0};
  window._easyHint=null;
  shopPool={sq:[],tileCards:[],tilePack:null,bounties:[]};activeDrag=null;
  document.getElementById('shop-screen').style.display='none';
  document.getElementById('play-controls').style.display='flex';
  document.getElementById('placing-controls').style.display='none';
  HP.x=[];HP.vx=[];HP.tiles=[];
  if(typeof _resetZoom==='function')_resetZoom();
  drawFull();renderAll();
}

function drawFull(){
  var n=7-S.hand.length;
  if(S.devMode){
    var _dp='AAEEEIIOOUUTTRRSSNNLLDDGG'.split('');
    for(var i=0;i<n;i++){var _dl=_dp[Math.floor(Math.random()*_dp.length)];S.hand.push({letter:_dl,isBlank:false,id:uid(),blankAs:null,sel:false,onBoard:false,variant:null,blueBonus:0});}
  } else {
    for(var i=0;i<n&&S.bag.length>0;i++){var t=S.bag.pop();S.hand.push({letter:t.letter,isBlank:t.isBlank,id:t.id,blankAs:null,sel:false,onBoard:false,variant:t.variant||null,blueBonus:t.blueBonus||0});}
  }
  if (S.phase === 'play') _scheduleRankSolve();
}

function cb(){
  if(S.endless)return['Endless '+S.endlessRound,'How far can you go?',Math.round(10000*Math.pow(1.4,S.endlessRound-1)),null];
  return STAGES[S.ai][S.bi];
}
function tgt(){return cb()[2];}

function roundComplete(){
  var reward=2+S.bi*2+(S.ai*2);
  var playsBonus=S.plays>0?S.plays:0;
  S.gold+=reward+playsBonus;
  var hasSheriff=false;for(var _si=0;_si<S.placed.length;_si++)if(S.placed[_si].id==='sheriffs_office'){hasSheriff=true;break;}
  var sheriffWord='';
  if(hasSheriff){
    var _activeWords=(S.bounties||[]).map(function(b){return b.word;});
    var _avail=BOUNTY_WORDS.filter(function(b){return _activeWords.indexOf(b.word)<0;});
    if(_avail.length){var _pick=_avail[Math.floor(_rng()*_avail.length)];S.bounties=S.bounties||[];S.bounties.push({word:_pick.word,reward:_pick.reward});sheriffWord=_pick.word;}
  }
  document.getElementById('round-title').textContent=(cb()[0]?cb()[0]+' cleared!':'Round complete!');
  var msg='You scored '+S.score.toLocaleString()+', beating '+tgt().toLocaleString()+'.';
  if(playsBonus>0)msg+=' +$'+playsBonus+' efficiency bonus!';
  if(sheriffWord)msg+=' Sheriff: free bounty "'+sheriffWord+'"!';
  document.getElementById('round-msg').textContent=msg;
  document.getElementById('round-reward').textContent='+$'+(reward+playsBonus)+' gold';
  S.roundsCompleted=(S.roundsCompleted||0)+1;
  try{var _pb=parseInt(localStorage.getItem('lexicon_best_rounds')||'0');if(S.roundsCompleted>_pb)localStorage.setItem('lexicon_best_rounds',S.roundsCompleted);}catch(e){}
  document.getElementById('round-modal').style.display='flex';
  saveGame();
  achvCheck('round_complete');
}

function advanceRound(){
  document.getElementById('round-modal').style.display='none';S.bi++;
  var newStage=S.bi>=3;
  if(newStage){S.ai++;S.bi=0;if(S.ai>=STAGES.length){S.endless=true;S.endlessRound=(S.endlessRound||0)+1;}}
  // End-of-stage sticker effects (e.g. Bourgeois collects gold)
  if(newStage){
    var _esSnap=S.placed.slice();
    for(var _esi=0;_esi<_esSnap.length;_esi++){
      var _esd=sqd(_esSnap[_esi].id);
      if(_esd&&_esd.onEndStage)_esd.onEndStage(_esSnap[_esi]);
    }
  }
  if(typeof _resetZoom==='function')_resetZoom();
  // Force-close bag modal if open — prevents its tile elements from showing during animBoardToShop
  var _bgo=document.getElementById('bag-ui-overlay');
  if(_bgo&&_bgo.style.display!=='none'){_bgo.style.display='none';delete _bgo.dataset.opening;delete _bgo.dataset.closing;}
  var _bgs=document.getElementById('bag-sprite');if(_bgs)_bgs.style.visibility='';
  animBoardToShop(function(){
    if(newStage){clearBoardLetters();S.bag=buildBag();toast(S.endless?'Endless mode! Targets keep rising.':'New stage — letters cleared, stickers kept!');}
    S.score=0;S.plays=4;S.disc=3;S.wtr=0;S.ts=0;S.discPressure=0;S.censorApplied=false;S.alchemistUsed=false;S.palUnlocked=false;S.lastWordLen=0;
    S.pendingSquares=[];S.sqHand=[];S.sqStaged={};
    recallAll();HP.x=[];HP.vx=[];drawFull();renderAll();shopPool={sq:[],tileCards:[],tilePack:null,bounties:[]};enterShopPhase();
  });
}

function showGO(msg){
  document.getElementById('gameover-msg').textContent=msg;
  var gbp=document.getElementById('gameover-best-play');if(gbp)gbp.style.display='none';
  var ghs=document.getElementById('gameover-highscore');
  if(ghs){
    var _rc=S.roundsCompleted||0;
    var _pb=0;try{_pb=parseInt(localStorage.getItem('lexicon_best_rounds')||'0');}catch(e){}
    var _hsText='This run: '+_rc+' round'+(  _rc!==1?'s':'')+ ' completed';
    if(_pb>0)_hsText+=' · Personal best: '+_pb+' round'+(_pb!==1?'s':'');
    ghs.textContent=_hsText;
  }
  document.getElementById('gameover-modal').style.display='flex';
}
function showWin(){clearSave();achvCheck('win');document.getElementById('win-modal').style.display='flex';}

function closeAllModals(){
  ['pack-modal','sq-modal','bag-ui-overlay','shop-bag-overlay','blank-modal','round-modal','gameover-modal','win-modal','hammer-modal','forge-modal','board-preview-modal','alchemist-modal','collection-modal','achv-modal','seed-modal'].forEach(function(id){var el=document.getElementById(id);if(el){el.style.display='none';delete el.dataset.closing;}});
  document.getElementById('shop-screen').style.display='none';
}

function toast(msg){var el=document.getElementById('toast');el.textContent=msg;el.style.display='block';clearTimeout(toast._t);toast._t=setTimeout(function(){el.style.display='none';},2500);}

function _animBagFrames(imgEl,fromFrame,toFrame,ms,onDone,prefix){
  var pre=prefix||'Assets/animations/bag/bag-frame';
  imgEl.src=pre+fromFrame+'.png';
  var step=fromFrame<toFrame?1:-1,cur=fromFrame;
  var timer=setInterval(function(){
    cur+=step;imgEl.src=pre+cur+'.png';
    if(cur===toFrame){clearInterval(timer);if(onDone)onDone();}
  },ms);
}

function _renderBagFloatTiles(cont,tiles,sz){
  cont.innerHTML='';
  var fc=[
    {a:'bfloat0',d:'2.5s',dl:'0s'},{a:'bfloat1',d:'2.8s',dl:'0.5s'},
    {a:'bfloat2',d:'3.1s',dl:'1.0s'},{a:'bfloat3',d:'2.6s',dl:'0.3s'},
    {a:'bfloat4',d:'3.0s',dl:'0.8s'},{a:'bfloat5',d:'2.7s',dl:'1.4s'}
  ];
  var groups={},order=[];
  for(var i=0;i<tiles.length;i++){
    var t=tiles[i],key=(t.isBlank?'_':t.letter)+'|'+(t.variant||'');
    if(!groups[key]){groups[key]={letter:t.isBlank?'':t.letter,isBlank:!!t.isBlank,variant:t.variant||null,count:0};order.push(key);}
    groups[key].count++;
  }
  var vord={'':0,'red':1,'blue':2,'gold':3};
  order.sort(function(a,b){
    var ga=groups[a],gb=groups[b];
    if(ga.isBlank!==gb.isBlank)return ga.isBlank?1:-1;
    if(ga.letter!==gb.letter)return ga.letter<gb.letter?-1:1;
    return (vord[ga.variant||'']||0)-(vord[gb.variant||'']||0);
  });
  for(var oi=0;oi<order.length;oi++){
    var g=groups[order[oi]],f=fc[oi%fc.length];
    var item=document.createElement('div');
    item.className='bag-float-item';
    var inner=document.createElement('div');
    inner.style.cssText='display:flex;flex-direction:column;align-items:center;animation:'+f.a+' '+f.d+' ease-in-out '+f.dl+' infinite';
    var spr=tileSpr(g.isBlank?null:g.letter,g.isBlank,g.variant,sz);
    var te=document.createElement('div');
    te.className='tile tile-spr'+(g.isBlank?' blank-t':'')+(g.variant?' var-'+g.variant:'');
    te.style.cssText='width:'+sz+'px;height:'+sz+'px;position:relative;flex-shrink:0;'+spr;
    if(g.variant){
      var bdg=document.createElement('span');
      bdg.className='vbadge vbadge-'+g.variant;
      bdg.textContent=g.variant==='gold'?'$':g.variant==='blue'?'+'+(LS[g.letter]||0):'×2';
      te.appendChild(bdg);
    }
    inner.appendChild(te);
    var ct=document.createElement('div');
    ct.style.cssText='color:#7ac07a;font-family:\'Jersey 10\',Georgia;font-size:'+Math.round(sz*0.38)+'px;margin-top:4px;line-height:1;text-align:center';
    ct.textContent='×'+g.count;inner.appendChild(ct);
    item.appendChild(inner);
    cont.appendChild(item);
  }
}

// Frame 5 measurements: bag is 30px tall, center at (238.5, 96.5) within 288×160 frame.
// Scale is set so the bag in frame 5 matches the rendered bag sprite size on screen.
var _BAG_FW=288,_BAG_FFH=160,_BAG_F5X=238.5,_BAG_F5Y=96.5,_BAG_F5H=30;

function _bagMakeEl(srcSprId){
  var spr=srcSprId?document.getElementById(srcSprId):null;
  var r=spr?spr.getBoundingClientRect():null;
  var bagCX=r?r.left+r.width/2:window.innerWidth/2;
  var bagCY=r?r.top+r.height/2:window.innerHeight/2;
  var scale=r?r.height/_BAG_F5H:1;
  var w=Math.round(_BAG_FW*scale),h=Math.round(_BAG_FFH*scale);
  var el=document.createElement('img');
  el.style.cssText='position:fixed;z-index:9999;image-rendering:pixelated;pointer-events:none;'
    +'width:'+w+'px;height:'+h+'px;'
    +'left:'+Math.round(bagCX-_BAG_F5X*scale)+'px;'
    +'top:'+Math.round(bagCY-_BAG_F5Y*scale)+'px;';
  if(spr)spr.style.visibility='hidden';
  document.body.appendChild(el);
  return {el:el,spr:spr};
}

function _bagTransitionOpen(srcSprId,onDone,onNearDone){
  var s=_bagMakeEl(srcSprId);
  var hf=srcSprId==='bag-sprite'?(window._bagHoverFrame||0):0;
  var cur=hf+1;
  var nearFired=false;
  s.el.src='Assets/animations/transition/transition-frame'+cur+'.png';
  var timer=setInterval(function(){
    cur++;
    s.el.src='Assets/animations/transition/transition-frame'+cur+'.png';
    if(!nearFired&&cur>=17&&onNearDone){nearFired=true;onNearDone();}
    if(cur===19){
      clearInterval(timer);
      var bridge=document.createElement('div');
      bridge.style.cssText='position:fixed;inset:0;background:#323c39;z-index:9990;pointer-events:none;transition:opacity 0.5s ease;';
      document.body.appendChild(bridge);
      if(s.el.parentNode)s.el.parentNode.removeChild(s.el);
      if(s.spr)s.spr.style.visibility='';
      if(onDone)onDone();
      requestAnimationFrame(function(){requestAnimationFrame(function(){
        bridge.style.opacity='0';
        setTimeout(function(){if(bridge.parentNode)bridge.parentNode.removeChild(bridge);},500);
      });});
    }
  },64);
}

function _bagTransitionClose(srcSprId,onDone){
  var s=_bagMakeEl(srcSprId);
  var cur=19;
  s.el.src='Assets/animations/transition/transition-frame19.png';
  var timer=setInterval(function(){
    cur--;
    s.el.src='Assets/animations/transition/transition-frame'+cur+'.png';
    if(cur===1){
      clearInterval(timer);
      if(s.el.parentNode)s.el.parentNode.removeChild(s.el);
      if(s.spr)s.spr.style.visibility='';
      if(onDone)onDone();
    }
  },64);
}

function openBagModal(){
  if(window._scoring)return;
  var ovr=document.getElementById('bag-ui-overlay');if(!ovr||ovr.dataset.opening||ovr.dataset.closing)return;
  ovr.dataset.opening='1';
  _bagTransitionOpen('bag-sprite',function(){
    // animation done — reveal the overlay (tiles are already mid-zoom)
    delete ovr.dataset.opening;
    ovr.style.visibility='';ovr.style.pointerEvents='';
  },function(){
    // 2 frames before animation ends — start zoom early while bag is still animating
    ovr.style.display='flex';ovr.style.visibility='hidden';ovr.style.pointerEvents='none';
    document.getElementById('bag-ui-count').textContent=S.bag.length+' tiles remaining';
    var tilesDiv=document.getElementById('bag-ui-tiles');
    _renderBagFloatTiles(tilesDiv,S.bag,73);
    tilesDiv.style.animation='none';void tilesDiv.offsetHeight;
    tilesDiv.style.animation='bagTunnelZoom 0.52s ease-out both';
  });
}

function closeBagUI(){
  var ovr=document.getElementById('bag-ui-overlay');if(!ovr||ovr.dataset.closing)return;
  delete ovr.dataset.opening;ovr.dataset.closing='1';
  ovr.style.visibility='';ovr.style.pointerEvents='';
  var bridge=document.createElement('div');
  bridge.style.cssText='position:fixed;inset:0;background:#0f2018;z-index:9990;pointer-events:none;transition:opacity 0.35s ease;';
  document.body.appendChild(bridge);
  ovr.style.display='none';
  _bagTransitionClose('bag-sprite',function(){delete ovr.dataset.closing;});
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    bridge.style.opacity='0';
    setTimeout(function(){if(bridge.parentNode)bridge.parentNode.removeChild(bridge);},350);
  });});
}

// ─── Tile Audio ───────────────────────────────────────────────────────────────
var _audioCtx=null,_scoreDingN=0;
function _getAudioCtx(){
  if(!_audioCtx)_audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  if(_audioCtx.state==='suspended')_audioCtx.resume();
  return _audioCtx;
}
function _playScoreDing(){
  try{
    var ctx=_getAudioCtx();
    var now=ctx.currentTime+0.016;
    var n=_scoreDingN++;
    // Shepard tone stab: 6 octave-spaced sine waves (A1=110Hz through A6=3520Hz).
    // A tight Gaussian bell (sigma=0.8) keeps only ~3 waves audible at once —
    // exactly the "two ascending, one wrapping in at the bottom" mechanism.
    // Within each stab the oscillators sweep UP by one semitone, so the rise
    // is audible inside the note, not just between notes.
    // Bell center advances 7 semitones per event (coprime with 12 = every chord different).
    var NUM_OCTS=4, BASE=220, SIGMA=0.7, MAX_AMP=0.2;
    var SWEEP=Math.pow(2,1/12); // one semitone of pitch rise during the note
    var DUR=0.19;
    var center=((n*5/12)+1.5)%NUM_OCTS;
    var comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-14;comp.knee.value=8;comp.ratio.value=4;
    comp.attack.value=0.002;comp.release.value=0.1;
    comp.connect(ctx.destination);
    var lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3400;lp.Q.value=0.6;
    lp.connect(comp);
    for(var o=0;o<NUM_OCTS;o++){
      var freq=BASE*Math.pow(2,o);
      var dist=o-center;
      if(dist>NUM_OCTS/2)dist-=NUM_OCTS;
      if(dist<-NUM_OCTS/2)dist+=NUM_OCTS;
      var amp=Math.exp(-(dist*dist)/(2*SIGMA*SIGMA))*MAX_AMP;
      if(amp<0.012)continue;
      var osc=ctx.createOscillator();osc.type='sine';
      // Sweep: glide upward one semitone over the note duration
      osc.frequency.setValueAtTime(freq,now);
      osc.frequency.exponentialRampToValueAtTime(freq*SWEEP,now+DUR);
      var g=ctx.createGain();
      g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(amp,now+0.007);
      g.gain.exponentialRampToValueAtTime(0.001,now+DUR);
      osc.connect(g);g.connect(lp);osc.start(now);osc.stop(now+DUR+0.01);
      // Detuned twin for warmth
      var osc2=ctx.createOscillator();osc2.type='sine';
      osc2.frequency.setValueAtTime(freq*1.003,now);
      osc2.frequency.exponentialRampToValueAtTime(freq*SWEEP*1.003,now+DUR);
      var g2=ctx.createGain();
      g2.gain.setValueAtTime(0,now);g2.gain.linearRampToValueAtTime(amp*0.45,now+0.007);
      g2.gain.exponentialRampToValueAtTime(0.001,now+DUR);
      osc2.connect(g2);g2.connect(lp);osc2.start(now);osc2.stop(now+DUR+0.01);
    }
  }catch(e){}
}
function _playReelTick(){
  try{
    var ctx=_getAudioCtx(),now=ctx.currentTime;
    var len=Math.ceil(ctx.sampleRate*0.025);
    var buf=ctx.createBuffer(1,len,ctx.sampleRate);
    var d=buf.getChannelData(0);
    for(var i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
    var src=ctx.createBufferSource();src.buffer=buf;
    var filt=ctx.createBiquadFilter();filt.type='bandpass';filt.frequency.value=2800;filt.Q.value=6;
    var g=ctx.createGain();g.gain.setValueAtTime(0.07,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.018);
    src.connect(filt);filt.connect(g);g.connect(ctx.destination);src.start(now);
  }catch(e){}
}
function _playTileClick(type){
  try{
    var ctx=_getAudioCtx(),now=ctx.currentTime;
    var len=Math.ceil(ctx.sampleRate*0.06);
    var buf=ctx.createBuffer(1,len,ctx.sampleRate);
    var d=buf.getChannelData(0);
    for(var i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
    var src=ctx.createBufferSource();src.buffer=buf;
    var filt=ctx.createBiquadFilter();filt.type='bandpass';
    var gain=ctx.createGain();
    var pv=1+(Math.random()-0.5)*0.25;
    if(type==='place'){
      filt.frequency.value=700*pv;filt.Q.value=1.8;
      gain.gain.setValueAtTime(0.32,now);
      gain.gain.exponentialRampToValueAtTime(0.001,now+0.05);
    }else if(type==='select'){
      filt.frequency.value=2000*pv;filt.Q.value=4;
      gain.gain.setValueAtTime(0.1,now);
      gain.gain.exponentialRampToValueAtTime(0.001,now+0.022);
    }else if(type==='land'){
      filt.frequency.value=3000*pv;filt.Q.value=5;
      gain.gain.setValueAtTime(0.14,now);
      gain.gain.exponentialRampToValueAtTime(0.001,now+0.022);
    }else{
      filt.frequency.value=1200*pv;filt.Q.value=2.5;
      gain.gain.setValueAtTime(0.2,now);
      gain.gain.exponentialRampToValueAtTime(0.001,now+0.035);
    }
    src.connect(filt);filt.connect(gain);gain.connect(ctx.destination);
    src.start(now);
  }catch(e){}
}

function openBlankChooser(hi,cb2){
  var grid=document.getElementById('blank-grid');grid.innerHTML='';
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(function(l){
    var btn=document.createElement('button');btn.className='blank-btn';btn.textContent=l;
    btn.onclick=function(){
      var t=S.hand[hi];t.blankAs=l;
      if(t._devBlank)t._alchSc=LS[l]||0;
      document.getElementById('blank-modal').style.display='none';if(cb2)cb2();renderHand();
    };
    grid.appendChild(btn);
  });
  document.getElementById('blank-modal').style.display='flex';
}
