// =====================================================================
// GAME STATE — global state, lifecycle, modals, utilities
// =====================================================================
var _BOUNTY_BASE_REWARDS={3:4,4:5,5:8,6:12,7:15,8:18};
function _bountyWordReward(word){
  var base=_BOUNTY_BASE_REWARDS[word.length]||(word.length>=9?20:4);
  var ls=0;for(var i=0;i<word.length;i++)ls+=(LS[word[i].toUpperCase()]||0);
  return Math.round((base+ls)/2);
}
// Returns count scroll objects, each with theme + 6 {word,reward} entries.
// Uses themed sets from BOUNTY_THEMES (bounties.txt) when available.
function _generateBounties(count,exclude){
  if(BOUNTY_THEMES&&BOUNTY_THEMES.length){
    // Build valid themes, filtering words against DICT if loaded
    var available=[];
    for(var ti=0;ti<BOUNTY_THEMES.length;ti++){
      var t=BOUNTY_THEMES[ti];
      var valid=DICT?t.words.filter(function(w){return DICT.has(w.toUpperCase());}):t.words.slice();
      if(valid.length>=3)available.push({theme:t.theme,words:valid.slice(0,6)});
    }
    // Shuffle using seeded rng
    for(var ai=available.length-1;ai>0;ai--){
      var aj=Math.floor(_rng()*(ai+1));
      var tmp=available[ai];available[ai]=available[aj];available[aj]=tmp;
    }
    var result=[];
    for(var ri=0;ri<available.length&&result.length<count;ri++){
      var th=available[ri];
      var words=th.words.map(function(w){return{word:w,reward:_bountyWordReward(w)};});
      result.push({theme:th.theme,words:words});
    }
    if(result.length>0)return result;
  }
  // Fallback: random words from dictionary by length tier
  return _generateBountiesRandom(count,exclude);
}
var _bountyWordBuckets=null;
var _BOUNTY_TIERS=[
  {len:3,w:0.15,reward:4},{len:4,w:0.20,reward:5},{len:5,w:0.25,reward:8},
  {len:6,w:0.20,reward:12},{len:7,w:0.12,reward:15},{len:8,w:0.08,reward:18}
];
function _generateBountiesRandom(count,exclude){
  if(!_bountyWordBuckets){
    _bountyWordBuckets={3:[],4:[],5:[],6:[],7:[],8:[]};
    if(DICT)DICT.forEach(function(w){var l=w.length;if(l>=3&&l<=8)_bountyWordBuckets[l].push(w);});
    for(var k in _bountyWordBuckets)_bountyWordBuckets[k].sort();
  }
  var excSet={};for(var _i=0;_i<(exclude||[]).length;_i++)excSet[exclude[_i]]=true;
  var filtered={};for(var k in _bountyWordBuckets)filtered[k]=_bountyWordBuckets[k].filter(function(w){return!excSet[w];});
  var result=[];var WORDS_PER=6;
  for(var s=0;s<count;s++){
    var scrollWords=[];
    for(var att=0;att<WORDS_PER*30&&scrollWords.length<WORDS_PER;att++){
      var r=_rng(),cum=0,tier=_BOUNTY_TIERS[_BOUNTY_TIERS.length-1];
      for(var wi=0;wi<_BOUNTY_TIERS.length;wi++){cum+=_BOUNTY_TIERS[wi].w;if(r<cum){tier=_BOUNTY_TIERS[wi];break;}}
      var pool=filtered[tier.len];if(!pool||!pool.length)continue;
      var idx=Math.floor(_rng()*pool.length);var word=pool.splice(idx,1)[0];
      excSet[word]=true;
      scrollWords.push({word:word,reward:_bountyWordReward(word)});
    }
    if(scrollWords.length>0)result.push({words:scrollWords});
  }
  return result;
}
var S={};
var DICT=null;
var activeDrag=null;
var _dragEndTime=0;
var _hl=-1;
var shopPool={sq:[],packs:[],bounties:[]};

function buildBag(){
  var bag=[];var ks=Object.keys(DIST);
  for(var i=0;i<ks.length;i++)for(var j=0;j<DIST[ks[i]];j++)bag.push({letter:ks[i],isBlank:false,id:uid(),variant:null,state:'stored',storedIn:'bag'});
  bag.push({letter:'_',isBlank:true,id:uid(),variant:null,state:'stored',storedIn:'bag'});
  bag.push({letter:'_',isBlank:true,id:uid(),variant:null,state:'stored',storedIn:'bag'});
  return shuffle(bag);
}

function startGame(seed){
  clearSave();
  closeAllModals();
  var s=(seed!==undefined&&seed!==null)?((parseInt(seed)>>>0)||1):Math.floor(Math.random()*900000)+100000;
  _rngSeed(s);
  var _bag=buildBag();
  var _cids=['c_long','c_pal','c_longer','c_letters','c_hand','c_draw3','c_nodisc','c_oneplay','c_stickers'];
  var _co=_cids.slice();
  for(var _ci=_co.length-1;_ci>0;_ci--){var _cj=Math.floor(_rng()*(_ci+1));var _ct=_co[_ci];_co[_ci]=_co[_cj];_co[_cj]=_ct;}
  S={bag:_bag,hand:[],board:Array(B*B).fill(null),bt:Array(B*B).fill(null),btTop:Array(B*B).fill(null),
     ai:0,bi:0,score:0,gold:4,plays:4,disc:3,wtr:0,ts:0,placed:[],discPressure:0,discardsThisRound:0,palUnlocked:false,devMode:false,
     phase:'play',stickerInventory:[],sqHand:[],sqStaged:{},seed:s,bhMult:1,palMult:1,playerMult:1,cartographerMult:1,palWords:[],
     lastWordLen:0,endless:false,endlessRound:0,roundsCompleted:0,drunkStreak:0,magicStreak:0,
     constraintOrder:_co.slice(0,BOARDS.length),usedLetters:new Set(),stickersSoldThisBoard:0,crossroadsCount:0,ouroborosBonus:0,gamblerSpins:0,
     stamps:[],bagBlueAnchors:{},pool:_bag.slice(),
     consumables:[],lastTicket:null,
     bounties:_generateBounties(3,[])};
  window._easyHint=null;
  shopPool={sq:[],packs:[],bounties:[]};activeDrag=null;
  document.getElementById('shop-screen').style.display='none';
  document.getElementById('play-controls').style.display='flex';
  document.getElementById('placing-controls').style.display='none';
  HP.x=[];HP.vx=[];HP.tiles=[];
  if(typeof _resetArcQueue==='function')_resetArcQueue();
  if(typeof _resetZoom==='function')_resetZoom();
  drawFull();renderAll();
}

function handMax(){return(S.bi===2&&currentConstraint()==='c_hand')?6:7;}

// Anchor mechanic (draw priority) — lives on VARNISHED tiles now, formerly
// blue. S.bagBlueAnchors keeps its name for save compatibility.
function _autoRegisterBlueAnchors(){
  if(!S.bag||!S.bag.length)return;
  if(!S.bagBlueAnchors)S.bagBlueAnchors={};
  var lc={};
  for(var i=0;i<S.bag.length;i++){var k=S.bag[i].isBlank?'_':(S.bag[i].letter||'_');lc[k]=(lc[k]||0)+1;}
  for(var i=0;i<S.bag.length;i++){
    var t=S.bag[i];if(t.material!=='varnished')continue;
    var k=t.isBlank?'_':(t.letter||'_');
    if(lc[k]===1&&!S.bagBlueAnchors[k])S.bagBlueAnchors[k]=t.id;
  }
}

// ---- Tile mutation ----
// transformTile: mutate or destroy a tile wherever it lives (pool, bag, hand, board).
// opts: { variant:'gold'|'red'|'blue'|'jade'|'purple'|null, material:'metallic'|'glass'|'varnished'|null, isBlank:true, destroy:true }
function transformTile(tileId,opts){
  if(!tileId)return null;
  opts=opts||{};
  if(opts.destroy){
    if(S.pool)S.pool=S.pool.filter(function(pt){return pt.id!==tileId;});
    for(var _i=S.bag.length-1;_i>=0;_i--){if(S.bag[_i]&&S.bag[_i].id===tileId){S.bag.splice(_i,1);break;}}
    for(var _i=S.hand.length-1;_i>=0;_i--){if(S.hand[_i]&&S.hand[_i].id===tileId){S.hand.splice(_i,1);break;}}
    for(var _i=0;_i<B*B;_i++){
      if(S.bt[_i]&&S.bt[_i].id===tileId)S.bt[_i]=null;
      if(S.btTop&&S.btTop[_i]&&S.btTop[_i].id===tileId)S.btTop[_i]=null;
    }
    _rankObserve();
    return null;
  }
  var _pe=null;
  if(S.pool){for(var _i=0;_i<S.pool.length;_i++){if(S.pool[_i].id===tileId){_pe=S.pool[_i];break;}}}
  var _ap=function(o){if(!o)return;if('variant' in opts)o.variant=opts.variant;if('material' in opts)o.material=opts.material;if(opts.isBlank){o.isBlank=true;o.letter='_';if('blankAs' in o)o.blankAs=null;}};
  _ap(_pe);
  for(var _i=0;_i<S.bag.length;_i++){if(S.bag[_i]&&S.bag[_i].id===tileId&&S.bag[_i]!==_pe){_ap(S.bag[_i]);break;}}
  for(var _i=0;_i<S.hand.length;_i++){if(S.hand[_i]&&S.hand[_i].id===tileId){_ap(S.hand[_i]);break;}}
  for(var _i=0;_i<B*B;_i++){
    if(S.bt[_i]&&S.bt[_i].id===tileId)_ap(S.bt[_i]);
    if(S.btTop&&S.btTop[_i]&&S.btTop[_i].id===tileId)_ap(S.btTop[_i]);
  }
  if(opts.material==='varnished')_autoRegisterBlueAnchors();
  _rankObserve();
  return _pe;
}

// addTileToBag: create a new tile and add it to both the bag and pool.
function addTileToBag(opts){
  var t={letter:opts.letter||'_',isBlank:!!opts.isBlank,id:uid(),variant:opts.variant||null,material:opts.material||null,state:'stored',storedIn:'bag'};
  S.bag.push(t);(S.pool=S.pool||[]).push(t);
  return t;
}

function _tickBagCount(from,to,ms){
  var el=document.getElementById('bag-count');if(!el)return;
  if(from<=to){el.textContent=to;return;}
  var cur=from;
  (function step(){cur--;el.textContent=cur;if(cur>to)setTimeout(step,ms);})();
}

function drawFull(maxDraw){
  var hm=handMax();
  var _c=currentConstraint();
  var cap=(_c==='c_draw3')?3:(hm-S.hand.length);
  var n=Math.min(hm-S.hand.length,cap);
  if(maxDraw!==undefined)n=Math.min(n,maxDraw);
  // No early return on n<=0: the rack may have changed even when nothing is
  // drawn (empty bag after a play) — the observer below must still run.
  for(var i=0;i<n&&S.bag.length>0;i++){
    var _dt=null;
    try{
      var _anch=S.bagBlueAnchors;
      if(_anch){
        var _ai=[];
        for(var j=0;j<S.bag.length;j++){
          var _bt=S.bag[j];if(!_bt||_bt.material!=='varnished')continue;
          var _bk=_bt.isBlank?'_':(_bt.letter||'_');
          if(_anch[_bk]===_bt.id)_ai.push(j);
        }
        if(_ai.length){
          var _ri=Math.floor(_rng()*_ai.length);
          _dt=S.bag.splice(_ai[_ri],1)[0];
          delete _anch[_dt.isBlank?'_':(_dt.letter||'_')];
        }
      }
    }catch(e){}
    if(!_dt)_dt=S.bag.pop();
    setTileState(_dt,'hand');
    S.hand.push(_dt);
  }
  _rankObserve();
}

function cb(){
  if(S.endless){
    var eb=endlessBoard(),er=S.bi;
    return['Endless '+(eb+1)+'-'+(er+1),'How far can you go?',endlessTgt(eb,er),null];
  }
  return BOARDS[S.ai][S.bi];
}
// 0-based endless board index (clamped for pre-8-board saves resumed mid-endless).
function endlessBoard(){return Math.max(0,S.ai-BOARDS.length);}
// Endless mirrors the main run: 3-round boards on the looping progress
// tracker. The first endless board opens at 500k×2.5=1.25M, continuing the
// late-game cadence; each later board's opening jump grows ×1.2 (×3, ×3.6, …)
// so targets eventually outrun any build. Rounds step ×1 / ×1.4 / ×2.
function endlessTgt(eb,er){
  var open=1250000*Math.pow(2.5,eb)*Math.pow(1.2,eb*(eb+1)/2);
  var t=open*[1,1.4,2][er];
  if(!isFinite(t))return t;
  var mag=Math.pow(10,Math.max(0,Math.floor(Math.log(t)/Math.LN10)-2));
  return Math.round(t/mag)*mag;
}
function tgt(){var base=cb()[2];if(S.bi===2&&currentConstraint()==='c_oneplay')return Math.ceil(base/3/10)*10;return base;}

function roundComplete(){
  var reward=2+S.bi*2+(S.ai*2);
  var playsBonus=S.plays>0?S.plays:0;
  S.gold+=reward+playsBonus;
  var hasSheriff=hasStamp('sheriffs_office');
  var sheriffWord='';
  if(hasSheriff){
    var _activeWords=[];(S.bounties||[]).forEach(function(sc){(sc.words||[]).forEach(function(w){_activeWords.push(w.word);});});
    var _newB=_generateBounties(1,_activeWords);if(_newB.length){S.bounties=S.bounties||[];S.bounties.push(_newB[0]);sheriffWord=_newB[0].words[0].word;}
  }
  // End-of-round sticker/stamp effects (Delayed Gratification, Egg) — fired
  // while S.disc still holds this round's leftovers (reset in _doBoardAnimation).
  _fireAllHooks('onEndRound',[]);
  var msg='You scored '+S.score.toLocaleString()+', beating '+tgt().toLocaleString()+'.';
  if(playsBonus>0)msg+=' +$'+playsBonus+' efficiency bonus!';
  if(sheriffWord)msg+=' Sheriff: free bounty "'+sheriffWord+'"!';
  S.roundsCompleted=(S.roundsCompleted||0)+1;
  try{var _pb=parseInt(localStorage.getItem('lexicon_best_rounds')||'0');if(S.roundsCompleted>_pb)localStorage.setItem('lexicon_best_rounds',S.roundsCompleted);}catch(e){}
  var won=!S.endless&&S.ai===BOARDS.length-1&&S.bi===2;
  if(won){
    document.getElementById('win-msg').textContent='All '+BOARDS.length+' boards cleared! '+msg;
    document.getElementById('win-reward').textContent='+$'+(reward+playsBonus)+' gold';
    document.getElementById('win-modal').style.display='flex';
    // Tracker frame 25 = every board window filled.
    var _wSpr=document.getElementById('progress-tracker-sprite');
    if(_wSpr)_wSpr.src='Assets/animations/progress tracker/progress_tracker25.png';
    achvCheck('win');
  }else{
    document.getElementById('round-title').textContent=(cb()[0]?cb()[0]+' cleared!':'Round complete!');
    document.getElementById('round-msg').textContent=msg;
    document.getElementById('round-reward').textContent='+$'+(reward+playsBonus)+' gold';
    document.getElementById('round-modal').style.display='flex';
  }
  saveGame();
  achvCheck('round_complete');
  if(window.TUT&&TUT.active)tutEvent('round-complete');
}

function winContinueEndless(){
  document.getElementById('win-modal').style.display='none';
  advanceRound();
}
function winNewRun(){
  document.getElementById('win-modal').style.display='none';
  startGame();
}

function advanceRound(){
  document.getElementById('round-modal').style.display='none';
  S.bi++;
  var newBoard=S.bi>=3;
  if(newBoard){S.ai++;S.bi=0;if(S.ai>=BOARDS.length)S.endless=true;}
  if(S.endless)S.endlessRound=(S.endlessRound||0)+1;

  var _pbBlanks=0;
  if(newBoard){
    // Paint bucket: blank the tile that was committed on its square (transforms pool entry in place)
    for(var _pbi=0;_pbi<S.placed.length;_pbi++){var _pb=S.placed[_pbi];if(_pb.id==='paint_bucket'&&_pb.sqIdx!=null&&S.bt[_pb.sqIdx]&&S.bt[_pb.sqIdx].id){_pbBlanks++;transformTile(S.bt[_pb.sqIdx].id,{isBlank:true});}}
    // End-of-board sticker/stamp effects (Bourgeois, etc.)
    _fireAllHooks('onEndBoard',[]);
  }

  if(typeof _resetZoom==='function')_resetZoom();
  var _bgo=document.getElementById('bag-ui-overlay');
  if(_bgo&&_bgo.style.display!=='none'){_bgo.style.display='none';delete _bgo.dataset.opening;delete _bgo.dataset.closing;}
  var _bgs=document.getElementById('bag-sprite');if(_bgs)_bgs.style.visibility='';

  _doBoardAnimation(newBoard,_pbBlanks);
}

function _doBoardAnimation(newBoard,pbBlanks){
  animBoardToShop(function(){
    if(newBoard){
      clearBoardLetters();
      var _handIds=new Set((S.hand||[]).map(function(t){return t&&t.id;}).filter(Boolean));
      var _reBag=(S.pool||[]).filter(function(pt){return !_handIds.has(pt.id);});
      _reBag.forEach(function(pt){setTileState(pt,'stored',{storedIn:'bag'});});
      S.bag=shuffle(_reBag);
      var _pbMsg=pbBlanks?' Paint Bucket: '+pbBlanks+' tile'+(pbBlanks!==1?'s':'')+' blanked.':'';
      toast(S.endless?'Endless mode! Targets keep rising.':'New board — tiles cleared!'+_pbMsg);
    }
    S.score=0;S.plays=4;S.disc=3;S.wtr=0;S.ts=0;S.discPressure=0;S.discardsThisRound=0;S.palUnlocked=false;S.lastWordLen=0;S.magicStreak=0;
    S.usedLetters=new Set();S.stickersSoldThisBoard=0;
    var _rc=currentConstraint();if(_rc==='c_oneplay')S.plays=1;if(_rc==='c_nodisc')S.disc=0;
    var _insatN=countStamp('insatiable');
    if(_insatN)S.disc+=_insatN;
    S.sqHand=[];S.sqStaged={};
    recallAll();HP.x=[];HP.vx=[];drawFull();renderAll();shopPool={sq:[],packs:[],bounties:[]};enterShopPhase();
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

function closeAllModals(){
  ['pack-modal','sq-modal','bag-ui-overlay','shop-bag-overlay','blank-modal','round-modal','win-modal','gameover-modal','board-preview-modal','collection-modal','achv-modal','wordbook-modal','seed-modal','tk-overlay'].forEach(function(id){var el=document.getElementById(id);if(el){el.style.display='none';delete el.dataset.closing;}});
  if(typeof _tkCloseOverlay==='function'&&window._tkOv){_tkOv=null;_tkBusy=false;}
  document.getElementById('shop-screen').style.display='none';
}

function toast(msg){var el=document.getElementById('toast');el.textContent=msg;el.style.display='block';clearTimeout(toast._t);toast._t=setTimeout(function(){el.style.display='none';},2500);}

// Hover animation for a bag button: rolls the highlight frames 0→4 on
// mouseenter and back down on mouseleave. Shared by the play bag (init.js)
// and the shop bag. onFrame (optional) is called with the frame each tick.
// Returns {reset} to snap the sprite back to the idle frame.
function attachBagHover(btn,spr,onFrame){
  var frame=0,dir=0,timer=null,MAX=4,MS=70;
  function tick(){
    timer=null;
    frame=Math.max(0,Math.min(MAX,frame+dir));
    if(onFrame)onFrame(frame);
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
  return {reset:function(){
    if(timer){clearTimeout(timer);timer=null;}
    frame=0;dir=0;
    if(onFrame)onFrame(0);
    spr.src='Assets/animations/bag/bag-frame0.png';
  }};
}

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
  // Group by letter only — variants of the same letter share one slot
  var groups={},order=[];
  for(var i=0;i<tiles.length;i++){
    var t=tiles[i],key=t.isBlank?'_':(t.letter||'_');
    if(!groups[key]){groups[key]={letter:t.isBlank?'':t.letter,isBlank:!!t.isBlank,count:0,variants:{},materials:{}};order.push(key);}
    groups[key].count++;
    if(t.variant)groups[key].variants[t.variant]=(groups[key].variants[t.variant]||0)+1;
    if(t.material)groups[key].materials[t.material]=(groups[key].materials[t.material]||0)+1;
  }
  order.sort(function(a,b){
    var ga=groups[a],gb=groups[b];
    if(ga.isBlank!==gb.isBlank)return ga.isBlank?1:-1;
    return ga.letter<gb.letter?-1:1;
  });
  var _vdotColors={red:'#b83030',blue:'#3870a8',gold:'#c8a020',jade:'#2a9a5a',purple:'#8a30c0'};
  for(var oi=0;oi<order.length;oi++){
    var g=groups[order[oi]],f=fc[oi%fc.length];
    var _gkey=order[oi];
    // Determine if a varnished tile is the anchor for this group:
    // (a) explicitly promoted, or (b) the only tile of this letter and it's varnished
    var _isBlueAnchor=false;
    var _pref=S.bagBlueAnchors&&S.bagBlueAnchors[_gkey];
    if(_pref){for(var _ai=0;_ai<tiles.length;_ai++){if(tiles[_ai].id===_pref&&tiles[_ai].material==='varnished'){_isBlueAnchor=true;break;}}}
    if(!_isBlueAnchor&&g.count===1&&g.materials.varnished===1)_isBlueAnchor=true;
    var item=document.createElement('div');
    item.className='bag-float-item';
    item.dataset.letter=g.isBlank?'_':(g.letter||'_');
    item.style.cssText='cursor:pointer;position:relative';
    var inner=document.createElement('div');
    inner.style.cssText='display:flex;flex-direction:column;align-items:center;animation:'+f.a+' '+f.d+' ease-in-out '+f.dl+' infinite';
    var spr=tileSpr(g.isBlank?null:g.letter,g.isBlank,null,sz);
    var te=document.createElement('div');
    te.className='tile tile-spr'+(g.isBlank?' blank-t':'');
    te.style.cssText='width:'+sz+'px;height:'+sz+'px;position:relative;flex-shrink:0;'+spr;
    if(_isBlueAnchor)applyTileLayers(te,{letter:g.isBlank?null:g.letter,isBlank:g.isBlank,material:'varnished',variant:null},sz,spr);
    inner.appendChild(te);
    var ct=document.createElement('div');
    ct.style.cssText='color:#7ac07a;font-family:\'Jersey 10\',Georgia;font-size:'+Math.round(sz*0.38)+'px;margin-top:4px;line-height:1;text-align:center';
    ct.textContent='×'+g.count;inner.appendChild(ct);
    item.appendChild(inner);
    // Variant dots float independently ABOVE the tile
    var vkeys=(['red','blue','gold','jade','purple']).filter(function(v){return g.variants[v];});
    if(vkeys.length){
      var dotAnims=[{a:'bfloat0',d:'1.9s',dl:'0s'},{a:'bfloat2',d:'2.2s',dl:'0.35s'},{a:'bfloat4',d:'1.7s',dl:'0.7s'}];
      var dotsRow=document.createElement('div');
      dotsRow.className='variant-dots';
      dotsRow.style.cssText='position:absolute;bottom:calc(100% + 10px);left:0;right:0;display:flex;justify-content:center;gap:5px;pointer-events:none;';
      vkeys.forEach(function(v,vi){
        var da=dotAnims[vi%dotAnims.length];
        var dotWrap=document.createElement('div');
        dotWrap.dataset.vdot=v;
        dotWrap.style.cssText='animation:'+da.a+' '+da.d+' ease-in-out '+da.dl+' infinite;';
        var dot=document.createElement('div');
        dot.style.cssText='width:9px;height:9px;border-radius:50%;background:'+_vdotColors[v]+';border:1px solid rgba(255,255,255,0.35);box-shadow:0 0 4px '+_vdotColors[v]+'88;';
        dotWrap.appendChild(dot);
        dotsRow.appendChild(dotWrap);
      });
      item.appendChild(dotsRow);
    }
    (function(letter_,oi_){
      item.addEventListener('click',function(e){
        e.stopPropagation();
        _bagToggleExpand(letter_,oi_,cont,tiles);
      });
    })(g.isBlank?'_':(g.letter||'_'),oi);
    cont.appendChild(item);
  }
}

var _bagExpandGen=0,_bagPendingExpand=null;

function _bagToggleExpand(letter,clickedIdx,container,allTiles){
  if(_bagPendingExpand){clearTimeout(_bagPendingExpand);_bagPendingExpand=null;}
  // Pick mode: single tile of this letter → pick it directly without expanding
  if(window._bagPickMode){
    var _picks=allTiles.filter(function(t){return(t.isBlank?'_':(t.letter||'_'))===letter;});
    if(_picks.length===1){window._bagPickMode(_picks[0]);return;}
  }
  var cur=container.dataset.expandedLetter;
  if(cur===letter){_bagCollapseLetter(container);return;}
  if(cur){
    // Match collapse timing: arch tiles rise first (_riseMs), then all sweep laterally (323ms).
    var _cItems=Array.from(container.querySelectorAll('.bag-float-item'));
    var _priseMs=0;
    _cItems.forEach(function(item){if(!_priseMs&&item._archAnim&&item._archAnim.playState==='finished'&&item._archParams)_priseMs=item._archParams.dropMs;});
    _bagCollapseLetter(container,0.7);
    var g=_bagExpandGen;
    _bagPendingExpand=setTimeout(function(){
      _bagPendingExpand=null;
      if(_bagExpandGen!==g)return;
      _bagExpandLetter(letter,clickedIdx,container,allTiles,0.7);
    },Math.round(AT(_priseMs*0.7+273)));
  }else{
    // Nothing expanded — go straight to expand (no collapse, no animation pause)
    _bagExpandLetter(letter,clickedIdx,container,allTiles);
  }
}

function _bagExpandLetter(letter,clickedIdx,container,allTiles,speedMult){
  speedMult=(speedMult||1)/ASPD(); // global animation-speed setting compounds with caller's multiplier
  var gen=++_bagExpandGen;
  container.dataset.expandedLetter=letter;
  var items=Array.from(container.querySelectorAll('.bag-float-item'));
  if(clickedIdx<0||clickedIdx>=items.length){delete container.dataset.expandedLetter;return;}

  // Remove any stale expand overlay and snap all item transforms to rest before reading rects,
  // so rapid clicks don't measure mid-animation positions.
  var _staleStack=document.getElementById('_bag-expand-stack');
  if(_staleStack&&_staleStack.parentNode)_staleStack.parentNode.removeChild(_staleStack);
  items.forEach(function(item){
    if(item._archAnim){item._archAnim.cancel();delete item._archAnim;}
    delete item._archParams;
    item.style.transition='none';item.style.transform='';item.style.opacity='';
  });
  void container.offsetHeight;

  var clickedRect=items[clickedIdx].getBoundingClientRect();
  var clickedCX=clickedRect.left+clickedRect.width/2;

  var sz=73,colGap=22,slot=sz+colGap;

  // Discover actual Y positions of the bag grid rows from the DOM (up to 3 rows)
  var yMap={};
  items.forEach(function(item){
    var cy=Math.round(item.getBoundingClientRect().top/3)*3;
    yMap[cy]=true;
  });
  var gridRowYs=Object.keys(yMap).map(Number).sort(function(a,b){return a-b;}).slice(0,3);
  var numGridRows=gridRowYs.length||1;

  // Which bag grid row is the anchor in? (0=top, 1=middle, 2=bottom)
  var anchorY=Math.round(clickedRect.top/3)*3;
  var anchorRow=0;
  var minDist=Infinity;
  for(var ri=0;ri<gridRowYs.length;ri++){var d=Math.abs(gridRowYs[ri]-anchorY);if(d<minDist){minDist=d;anchorRow=ri;}}
  anchorRow=Math.max(0,Math.min(numGridRows-1,anchorRow));

  var matchTiles=allTiles.filter(function(t){return(t.isBlank?'_':t.letter)===letter;});
  var vord={'':0,'red':1,'blue':2,'gold':3,'jade':4,'purple':5};
  matchTiles.sort(function(a,b){
    var pref=S.bagBlueAnchors&&S.bagBlueAnchors[letter];
    if(pref){if(a.id===pref)return -1;if(b.id===pref)return 1;}
    // Unpromoted varnished tiles go to the stack (not the anchor slot) —
    // the promotion click handler only exists on stack tiles.
    var av=a.material==='varnished'?1:0,bv=b.material==='varnished'?1:0;
    if(av!==bv)return av-bv;
    return(vord[a.variant||'']||0)-(vord[b.variant||'']||0);
  });
  var fc=[{a:'bfloat0',d:'2.5s',dl:'0s'},{a:'bfloat1',d:'2.8s',dl:'0.5s'},{a:'bfloat2',d:'3.1s',dl:'1.0s'},{a:'bfloat3',d:'2.6s',dl:'0.3s'},{a:'bfloat4',d:'3.0s',dl:'0.8s'},{a:'bfloat5',d:'2.7s',dl:'1.4s'}];
  var N=matchTiles.length;
  if(N<1){delete container.dataset.expandedLetter;return;}
  var stackCount=N-1;

  // Layout: anchor fixed at (anchorRow, col=0). Stack fans rightward using 3 grid rows.
  // Col 0 has (numGridRows-1) available slots; each extra col has numGridRows slots.
  // Grow numCols until there's enough capacity.
  var numCols=1;
  while((numGridRows-1)+(numCols-1)*numGridRows<stackCount)numCols++;

  // For 3+ columns, anchor sits in the middle (left-centre for even count).
  var anchorCol=numCols>=3?Math.floor((numCols-1)/2):0;
  var stackLeftX=clickedRect.left-anchorCol*slot;

  // Left group: at or left of anchor column. Right group: strictly right of anchor column.
  var leftItems=[],rightItems=[];
  items.forEach(function(item,i){
    if(i===clickedIdx)return;
    var cx=item.getBoundingClientRect().left+item.getBoundingClientRect().width/2;
    if(cx>clickedCX+clickedRect.width/2)rightItems.push(item);
    else leftItems.push(item);
  });
  // For odd numCols the anchor column sits in the middle, so tiles directly above/below
  // (same cx) would all fall into leftItems. Move one to rightItems so both sides
  // end up the same distance from the expanded cluster and from the screen edge.
  var _anchorColRightItem=null;
  if(numCols%2===1){
    var _aci=-1;
    for(var _aii=0;_aii<leftItems.length;_aii++){
      var _acx=leftItems[_aii].getBoundingClientRect().left+leftItems[_aii].getBoundingClientRect().width/2;
      if(Math.abs(_acx-clickedCX)<sz*0.6){_aci=_aii;break;}
    }
    if(_aci>=0){_anchorColRightItem=leftItems[_aci];rightItems.push(leftItems[_aci]);leftItems.splice(_aci,1);}
  }
  // Both gaps always equal sz=73px: left gap = baseLeftShift-sz-anchorCol*slot = sz.
  var baseLeftShift=2*sz+anchorCol*slot;
  var baseRightShift=(numCols-anchorCol)*slot-2*colGap;
  // The anchor-col tile moved to the right starts at anchor-X (not anchor-X+slot), so it
  // needs one extra slot of shift. baseRightShift+slot = baseLeftShift for all odd numCols,
  // giving perfect mirror symmetry around the expanded cluster.
  var _acolRightShift=baseRightShift+slot;
  // Gravity stack: every column in each displaced group sinks to its lowest available rows.
  // Left and right groups are processed separately so a column split across both directions
  // (e.g. odd numCols moving one anchor-col tile right) is treated as two independent columns.
  var _anchorColDy=[];
  if(numGridRows>1){
    [leftItems,rightItems].forEach(function(group){
      var _cg={};
      group.forEach(function(item){
        var _iax=item.getBoundingClientRect().left+item.getBoundingClientRect().width/2;
        var _itemTop=item.getBoundingClientRect().top;
        var _br=0,_bd=Infinity;
        for(var _ri=0;_ri<gridRowYs.length;_ri++){var _rd=Math.abs(gridRowYs[_ri]-_itemTop);if(_rd<_bd){_bd=_rd;_br=_ri;}}
        var _ckey=Math.round(_iax/5)*5;
        if(!_cg[_ckey])_cg[_ckey]=[];
        _cg[_ckey].push({el:item,itemTop:_itemTop,row:_br});
      });
      Object.keys(_cg).forEach(function(ckey){
        var _col=_cg[ckey];
        _col.sort(function(a,b){return a.row-b.row;});
        var _nac=_col.length;
        for(var _ati=0;_ati<_nac;_ati++){
          var _tgtRow=gridRowYs.length-_nac+_ati;
          if(_tgtRow>=0&&_tgtRow<gridRowYs.length){
            var _dy=gridRowYs[_tgtRow]-_col[_ati].itemTop;
            if(_dy>1)_anchorColDy.push({el:_col[_ati].el,dy:_dy,fast:true});
          }
        }
      });
    });
  }

  // Fill anchor-col non-anchor rows first, then fan outward left/right.
  var anchorColRows=[];
  for(var r=0;r<numGridRows;r++){if(r!==anchorRow)anchorColRows.push(r);}
  anchorColRows.sort(function(a,b){return Math.abs(a-anchorRow)-Math.abs(b-anchorRow);});
  var slots=[];
  anchorColRows.forEach(function(r){slots.push({row:r,col:anchorCol});});
  var maxDist=Math.max(anchorCol,numCols-1-anchorCol);
  for(var d=1;d<=maxDist;d++){
    var rc=anchorCol+d,lc=anchorCol-d;
    if(rc<numCols){for(var r=0;r<numGridRows;r++)slots.push({row:r,col:rc});}
    if(lc>=0){for(var r=0;r<numGridRows;r++)slots.push({row:r,col:lc});}
  }

  // Build placements: use actual grid row Y positions so tiles snap to bag grid rows.
  var placements=[];
  for(var i=0;i<stackCount&&i<slots.length;i++){
    var s=slots[i];
    var rowY=s.row<gridRowYs.length?gridRowYs[s.row]:gridRowYs[gridRowYs.length-1];
    placements.push({
      t:matchTiles[i+1],
      fL:stackLeftX+s.col*slot,
      fT:rowY
    });
  }

  var stackEl=null;
  if(stackCount>0){
    // Pause float animations on all non-anchor tiles
    items.forEach(function(item,i){
      if(i===clickedIdx)return;
      var inner=item.children[0];if(inner)inner.style.animationPlayState='paused';
    });
    stackEl=document.createElement('div');
    stackEl.id='_bag-expand-stack';
    stackEl.style.cssText='position:fixed;left:0;top:0;z-index:10000;pointer-events:none;';
    document.body.appendChild(stackEl);
    placements.forEach(function(p,pi){
      var f=fc[pi%fc.length];
      var spr=tileSpr(p.t.isBlank?null:p.t.letter,p.t.isBlank,p.t.variant||null,sz);
      var outer=document.createElement('div');
      outer.style.cssText='position:absolute;left:'+p.fL+'px;top:'+p.fT+'px;width:'+sz+'px;height:'+sz+'px;';
      var inner=document.createElement('div');
      inner.style.cssText='width:'+sz+'px;height:'+sz+'px;animation:'+f.a+' '+f.d+' ease-in-out '+f.dl+' infinite';
      var te=document.createElement('div');
      te.className='tile tile-spr'+(p.t.isBlank?' blank-t':'')+(p.t.variant?' var-'+p.t.variant:'')+(p.t.material?' mat-'+p.t.material:'');
      te.style.cssText='width:'+sz+'px;height:'+sz+'px;position:relative;flex-shrink:0;'+spr;
      applyTileLayers(te,p.t,sz,spr);
      inner.appendChild(te);outer.appendChild(inner);stackEl.appendChild(outer);
      var initDX=clickedRect.left+(clickedRect.width-sz)/2-p.fL;
      var initDY=clickedRect.top+(clickedRect.height-sz)/2-p.fT;
      outer.style.transform='translateX('+initDX+'px) translateY('+initDY+'px)';
      outer.style.opacity='0';
      if(window._bagPickMode){
        (function(pt){
          outer.style.pointerEvents='auto';outer.style.cursor='pointer';
          outer.addEventListener('click',function(e){e.stopPropagation();if(window._bagPickMode)window._bagPickMode(pt);});
        })(p.t);
      }
    });
  }

  requestAnimationFrame(function(){requestAnimationFrame(function(){
    if(_bagExpandGen!==gen)return;
    var TRANS='transform '+Math.round(323*speedMult)+'ms ease-in-out';
    var _effectiveRightShift=_anchorColRightItem?_acolRightShift:baseRightShift;
    function _applyItemAnim(item,dx){
      var _idy=0,_ifast=false;
      for(var _di=0;_di<_anchorColDy.length;_di++){if(_anchorColDy[_di].el===item){_idy=_anchorColDy[_di].dy;_ifast=!!_anchorColDy[_di].fast;break;}}
      if(_idy>1){
        // Phase 1: lateral (ease-in-out, 323ms). Phase 2: drop (ease-in). All lateral movement is simultaneous.
        // Lateral phase is always 323ms so speed stays constant.
        // fast=true (one-row drop): drop phase shortened to 140ms; normal: 197ms.
        var _latMs=323,_dropMs=_ifast?140:197,_dur=Math.round((_latMs+_dropMs)*speedMult),_split=_latMs/(_latMs+_dropMs);
        item._archParams={dx:dx,dy:_idy,latMs:_latMs,dropMs:_dropMs};
        item._archAnim=item.animate([
          {offset:0,      transform:'translateX(0px) translateY(0px)',      easing:'ease-in-out'},
          {offset:_split, transform:'translateX('+dx+'px) translateY(0px)', easing:'ease-in'},
          {offset:1,      transform:'translateX('+dx+'px) translateY('+_idy+'px)'}
        ],{duration:_dur,easing:'linear',fill:'forwards'});
      } else {
        item.style.transition=TRANS;item.style.transform='translateX('+dx+'px)'+(_idy?' translateY('+_idy+'px)':'');
      }
    }
    leftItems.forEach(function(item){_applyItemAnim(item,-baseLeftShift);});
    rightItems.forEach(function(item){_applyItemAnim(item,_effectiveRightShift);});
    items[clickedIdx].style.pointerEvents=window._bagPickMode?'auto':'none';
    items[clickedIdx].style.transition='transform '+Math.round(520*speedMult)+'ms cubic-bezier(0.4,0,0.2,1)';
    items[clickedIdx].style.transform='scale(1.1)';
    var clickedDots=items[clickedIdx].querySelector('.variant-dots');
    if(clickedDots)clickedDots.style.opacity='0';
    if(window._bagPickMode){
      var _anchorTile=matchTiles[0];
      items[clickedIdx]._onPickClick=function(e){e.stopPropagation();if(window._bagPickMode)window._bagPickMode(_anchorTile);};
      items[clickedIdx].addEventListener('click',items[clickedIdx]._onPickClick);
    }
    var _blueOuters=[];
    if(stackEl){Array.from(stackEl.children).forEach(function(outer,pi){
      var delay=Math.round(pi*30*speedMult);
      outer.style.transition='transform '+Math.round(450*speedMult)+'ms cubic-bezier(0.4,0,0.2,1) '+delay+'ms, opacity '+Math.round(200*speedMult)+'ms ease '+delay+'ms';
      outer.style.transform='translateX(0) translateY(0) scale(1.1)';
      outer.style.opacity='1';
      if(!window._bagPickMode&&placements[pi].t.material==='varnished'){
        _blueOuters.push(outer);
        (function(bOuter,bTile){
          bOuter.addEventListener('mouseenter',function(){bOuter.style.filter='drop-shadow(0 0 8px #f0e080) drop-shadow(0 0 18px rgba(240,224,128,0.5))';});
          bOuter.addEventListener('mouseleave',function(){bOuter.style.filter='';});
          bOuter.addEventListener('click',function(e){
            e.stopPropagation();
            if(_bagExpandGen!==gen)return;
            if(!S.bagBlueAnchors)S.bagBlueAnchors={};
            S.bagBlueAnchors[letter]=bTile.id;
            var stEl=document.getElementById('_bag-expand-stack');
            // Fade out all other stack elements
            if(stEl){Array.from(stEl.children).forEach(function(ch){if(ch!==bOuter){ch.style.transition='opacity 0.18s ease';ch.style.opacity='0';}});}
            // Fade out anchor item
            var anchR=items[clickedIdx].getBoundingClientRect();
            items[clickedIdx].style.transition='opacity 0.18s ease,transform 0.18s ease';
            items[clickedIdx].style.opacity='0';items[clickedIdx].style.transform='scale(1)';
            // Compute movement delta from blue tile position to anchor position
            var bL=parseFloat(bOuter.style.left),bT=parseFloat(bOuter.style.top);
            var mvdx=anchR.left-bL,mvdy=anchR.top-bT;
            bOuter.style.filter='';
            setTimeout(function(){
              if(_bagExpandGen!==gen)return;
              // Phase 1: lateral
              bOuter.style.transition='transform 250ms ease-in-out';
              bOuter.style.transform='translateX('+mvdx+'px) translateY(0px) scale(1.05)';
              setTimeout(function(){
                if(_bagExpandGen!==gen)return;
                // Phase 2: vertical
                bOuter.style.transition='transform 200ms ease-in';
                bOuter.style.transform='translateX('+mvdx+'px) translateY('+mvdy+'px) scale(1)';
                setTimeout(function(){
                  if(_bagExpandGen!==gen)return;
                  // Varnished tile arrived — restyle the anchor item as varnished
                  var ai=items[clickedIdx];
                  var aDiv=ai.querySelector('div');
                  if(aDiv){var aTe=aDiv.querySelector('.tile.tile-spr');if(aTe){var bSpr=tileSpr(bTile.isBlank?null:bTile.letter,!!bTile.isBlank,null,sz);aTe.style.cssText='width:'+sz+'px;height:'+sz+'px;position:relative;flex-shrink:0;'+bSpr;aTe.className='tile tile-spr';applyTileLayers(aTe,{letter:bTile.isBlank?null:bTile.letter,isBlank:!!bTile.isBlank,material:'varnished',variant:null},sz,bSpr);}}
                  ai.style.transition='opacity 0.12s ease';ai.style.opacity='1';ai.style.transform='';ai.style.pointerEvents='';
                  if(bOuter.parentNode)bOuter.parentNode.removeChild(bOuter);
                  // Capture arch rise time before collapsing
                  var _colRiseMs=0;
                  items.forEach(function(_ci){if(!_colRiseMs&&_ci._archAnim&&_ci._archAnim.playState==='finished'&&_ci._archParams)_colRiseMs=_ci._archParams.dropMs;});
                  // Collapse side groups — wait for anchor fade-in (120ms) to finish first
                  var colGen=++_bagExpandGen;
                  delete container.dataset.expandedLetter;
                  if(stEl&&stEl.parentNode)stEl.parentNode.removeChild(stEl);
                  items.forEach(function(item){var inn=item.children[0];if(inn)inn.style.animationPlayState='paused';});
                  setTimeout(function(){
                    if(_bagExpandGen!==colGen)return;
                    var CLAT='transform 323ms ease-in-out '+_colRiseMs+'ms';
                    items.forEach(function(item,ii){
                      if(ii===clickedIdx){item.style.transition='';return;}
                      if(item._archAnim&&item._archAnim.playState==='finished'&&item._archParams){
                        item._archAnim.cancel();delete item._archAnim;
                        var _p=item._archParams;delete item._archParams;
                        var _cd=_p.dropMs+_p.latMs,_ro=_p.dropMs/_cd;
                        item.style.transition='none';
                        item._archAnim=item.animate([
                          {offset:0,transform:'translateX('+_p.dx+'px) translateY('+_p.dy+'px)',easing:'ease-out'},
                          {offset:_ro,transform:'translateX('+_p.dx+'px) translateY(0px)',easing:'ease-in-out'},
                          {offset:1,transform:'translateX(0px) translateY(0px)'}
                        ],{duration:_cd,easing:'linear',fill:'forwards'});
                        item.style.opacity='';item.style.pointerEvents='';
                      }else{
                        item.style.transition=CLAT;item.style.transform='';item.style.opacity='';item.style.pointerEvents='';
                      }
                    });
                    setTimeout(function(){
                      if(_bagExpandGen!==colGen)return;
                      items.forEach(function(item){
                        if(item._archAnim){item._archAnim.cancel();delete item._archAnim;}
                        item.style.transition='';
                        var inn=item.children[0];if(inn)inn.style.animationPlayState='';
                        var dots=item.querySelector('.variant-dots');if(dots)dots.style.opacity='';
                      });
                    },_colRiseMs+323+50);
                  },130);
                },210);
              },260);
            },190);
          });
        })(outer,placements[pi].t);
      }
    });}
    setTimeout(function(){
      if(_bagExpandGen!==gen)return;
      items.forEach(function(item,i){if(i!==clickedIdx){var inner=item.children[0];if(inner)inner.style.animationPlayState='';}});
      _blueOuters.forEach(function(bo){bo.style.pointerEvents='auto';});
    },Math.round(460*speedMult));
  });});
}

function _bagCollapseLetter(container,speedMult){
  speedMult=(speedMult||1)/ASPD(); // global animation-speed setting compounds with caller's multiplier
  var gen=++_bagExpandGen;
  // Clear state immediately so rapid clicks see consistent state
  delete container.dataset.expandedLetter;
  var items=Array.from(container.querySelectorAll('.bag-float-item'));
  // Find rise duration before anything else so the stack overlay can wait for it.
  var _riseMs=0;
  items.forEach(function(item){if(!_riseMs&&item._archAnim&&item._archAnim.playState==='finished'&&item._archParams)_riseMs=item._archParams.dropMs;});
  var _riseEffMs=Math.round(_riseMs*speedMult);
  var stackEl=document.getElementById('_bag-expand-stack');
  if(stackEl){setTimeout(function(){stackEl.style.opacity='0';setTimeout(function(){if(stackEl.parentNode)stackEl.parentNode.removeChild(stackEl);},Math.round(300*speedMult));},_riseEffMs);}
  items.forEach(function(item){
    if(item._archAnim&&item._archAnim.playState==='running'){
      // In-flight: bake current position so CSS transition returns from mid-point.
      try{item._archAnim.commitStyles();}catch(e){}item._archAnim.cancel();delete item._archAnim;delete item._archParams;
    }
    // Finished arch animations are left for the rAF to reverse.
    if(item._onPickClick){item.removeEventListener('click',item._onPickClick);delete item._onPickClick;}
    var inner=item.children[0];if(inner)inner.style.animationPlayState='paused';
  });
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    if(_bagExpandGen!==gen)return;
    // Phase 1: column tiles rise. Phase 2: ALL tiles sweep laterally together.
    // _riseMs already computed above; reused here via closure.
    // Regular tiles wait _riseMs before their lateral transition so all movement is simultaneous.
    var CLAT='transform '+Math.round(323*speedMult)+'ms ease-in-out '+_riseEffMs+'ms';
    items.forEach(function(item){
      if(item._archAnim&&item._archAnim.playState==='finished'&&item._archParams){
        // Phase 1: rise (ease-out). Phase 2: lateral back (ease-in-out), same timing as all other tiles.
        item._archAnim.cancel();delete item._archAnim;
        var _p=item._archParams;delete item._archParams;
        var _cd=_p.dropMs+_p.latMs,_ro=_p.dropMs/_cd;
        item.style.transition='none';
        item._archAnim=item.animate([
          {offset:0,   transform:'translateX('+_p.dx+'px) translateY('+_p.dy+'px)',easing:'ease-out'},
          {offset:_ro, transform:'translateX('+_p.dx+'px) translateY(0px)',         easing:'ease-in-out'},
          {offset:1,   transform:'translateX(0px) translateY(0px)'}
        ],{duration:Math.round(_cd*speedMult),easing:'linear',fill:'forwards'});
        item.style.opacity='';item.style.pointerEvents='';
      } else {
        item.style.transition=CLAT;item.style.transform='';item.style.opacity='';item.style.pointerEvents='';
      }
    });
    setTimeout(function(){
      if(_bagExpandGen!==gen)return;
      items.forEach(function(item){
        if(item._archAnim){item._archAnim.cancel();delete item._archAnim;}
        item.style.transition='';
        var inner=item.children[0];if(inner)inner.style.animationPlayState='';
        var dots=item.querySelector('.variant-dots');if(dots)dots.style.opacity='';
      });
    },Math.round((_riseMs+323)*speedMult)+50);
  });});
}

// Full-screen colour overlay that fades out over ms — masks the seam when a
// bag transition swaps what's underneath. Appended immediately (covering the
// swap), fade starts on the next frame, removed when done.
function _fadeBridge(color,ms){
  ms=AT(ms);
  var bridge=document.createElement('div');
  bridge.style.cssText='position:fixed;inset:0;background:'+color+';z-index:9990;pointer-events:none;transition:opacity '+(ms/1000)+'s ease;';
  document.body.appendChild(bridge);
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    bridge.style.opacity='0';
    setTimeout(function(){if(bridge.parentNode)bridge.parentNode.removeChild(bridge);},ms);
  });});
  return bridge;
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
      _fadeBridge('#323c39',500);
      if(s.el.parentNode)s.el.parentNode.removeChild(s.el);
      if(s.spr)s.spr.style.visibility='';
      if(onDone)onDone();
    }
  },AT(64));
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
  },AT(64));
}

function openBagModal(){
  if(window._scoring)return;
  var ovr=document.getElementById('bag-ui-overlay');if(!ovr||ovr.dataset.opening||ovr.dataset.closing)return;
  ovr.dataset.opening='1';
  if(!ovr._bagExpandBound){
    ovr._bagExpandBound=true;
    ovr.addEventListener('click',function(e){
      if(e.target.closest('.bag-float-item'))return;
      var t=document.getElementById('bag-ui-tiles');
      if(t&&t.dataset.expandedLetter)_bagCollapseLetter(t);
    });
  }
  _bagTransitionOpen('bag-sprite',function(){
    // animation done — reveal the overlay (tiles are already mid-zoom)
    delete ovr.dataset.opening;
    ovr.style.visibility='';ovr.style.pointerEvents='';
  },function(){
    // 2 frames before animation ends — start zoom early while bag is still animating
    ovr.style.display='flex';ovr.style.visibility='hidden';ovr.style.pointerEvents='none';
    document.getElementById('bag-ui-count').textContent=S.bag.length+' tiles remaining';
    _autoRegisterBlueAnchors();
    var tilesDiv=document.getElementById('bag-ui-tiles');
    _renderBagFloatTiles(tilesDiv,S.bag,73);
    tilesDiv.style.animation='none';void tilesDiv.offsetHeight;
    tilesDiv.style.animation='bagTunnelZoom '+(AT(520)/1000)+'s ease-out both';
  });
}

function closeBagUI(){
  var ovr=document.getElementById('bag-ui-overlay');if(!ovr||ovr.dataset.closing)return;
  delete ovr.dataset.opening;ovr.dataset.closing='1';
  window._bagPickMode=null;
  ovr.style.visibility='';ovr.style.pointerEvents='';
  var _bst=document.getElementById('_bag-expand-stack');if(_bst&&_bst.parentNode)_bst.parentNode.removeChild(_bst);
  var _btd=document.getElementById('bag-ui-tiles');if(_btd)delete _btd.dataset.expandedLetter;
  _fadeBridge('#0f2018',350);
  ovr.style.display='none';
  _bagTransitionClose('bag-sprite',function(){delete ovr.dataset.closing;});
}

// ─── Tile Audio ───────────────────────────────────────────────────────────────
var _audioCtx=null,_scoreDingN=0,_masterGain=null;
function _getAudioCtx(){
  if(!_audioCtx){
    _audioCtx=new(window.AudioContext||window['webkitAudioContext'])();
    _masterGain=_audioCtx.createGain();
    _masterGain.gain.value=SETTINGS.volume;
    _masterGain.connect(_audioCtx.destination);
  }
  if(_audioCtx.state==='suspended')_audioCtx.resume();
  return _audioCtx;
}
function setVolume(v){
  SETTINGS.volume=Math.max(0,Math.min(1,v));
  saveSettings();
  if(_masterGain)_masterGain.gain.value=SETTINGS.volume;
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
    comp.connect(_masterGain);
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
// Coin clink for gold ticking up/down during the score animation.
// down=true → duller, lower "cha-ching out" for losing gold.
function _playCoinClink(down){
  try{
    var ctx=_getAudioCtx();
    var now=ctx.currentTime+0.005;
    var pv=1+(Math.random()-0.5)*0.14;
    var base=(down?720:1250)*pv;
    // Inharmonic metallic partials → bell-like coin ring.
    var partials=[1,2.71,5.18];
    for(var p=0;p<partials.length;p++){
      var osc=ctx.createOscillator();osc.type='triangle';
      osc.frequency.value=base*partials[p];
      var g=ctx.createGain();
      var amp=(down?0.11:0.14)/(p+1);
      g.gain.setValueAtTime(0,now);
      g.gain.linearRampToValueAtTime(amp,now+0.004);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.15);
      osc.connect(g);g.connect(_masterGain);
      osc.start(now);osc.stop(now+0.17);
    }
    // Short noise transient for the "clink" attack.
    var len=Math.ceil(ctx.sampleRate*0.02);
    var buf=ctx.createBuffer(1,len,ctx.sampleRate);
    var d=buf.getChannelData(0);
    for(var i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
    var src=ctx.createBufferSource();src.buffer=buf;
    var filt=ctx.createBiquadFilter();filt.type='bandpass';
    filt.frequency.value=(down?2600:4600)*pv;filt.Q.value=5;
    var ng=ctx.createGain();ng.gain.setValueAtTime(0.08,now);ng.gain.exponentialRampToValueAtTime(0.001,now+0.02);
    src.connect(filt);filt.connect(ng);ng.connect(_masterGain);src.start(now);
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
    src.connect(filt);filt.connect(g);g.connect(_masterGain);src.start(now);
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
    src.connect(filt);filt.connect(gain);gain.connect(_masterGain);
    src.start(now);
  }catch(e){}
}

function _playSpringBoing(){
  try{
    var ctx=_getAudioCtx(),now=ctx.currentTime;
    // Spring click: short percussive noise burst
    var ckLen=Math.ceil(ctx.sampleRate*0.038);
    var ckBuf=ctx.createBuffer(1,ckLen,ctx.sampleRate);
    var ckd=ckBuf.getChannelData(0);
    for(var ci=0;ci<ckLen;ci++)ckd[ci]=(Math.random()*2-1)*(1-ci/ckLen);
    var ckSrc=ctx.createBufferSource();ckSrc.buffer=ckBuf;
    var ckF=ctx.createBiquadFilter();ckF.type='bandpass';ckF.frequency.value=1600;ckF.Q.value=2.2;
    var ckG=ctx.createGain();ckG.gain.setValueAtTime(0.32,now);ckG.gain.exponentialRampToValueAtTime(0.001,now+0.038);
    ckSrc.connect(ckF);ckF.connect(ckG);ckG.connect(_masterGain);ckSrc.start(now);
    // Descending boing: fundamental sine 500→65 Hz
    var osc=ctx.createOscillator();osc.type='sine';
    var env=ctx.createGain();
    osc.connect(env);env.connect(_masterGain);
    osc.frequency.setValueAtTime(500,now);
    osc.frequency.exponentialRampToValueAtTime(65,now+0.58);
    env.gain.setValueAtTime(0,now);
    env.gain.linearRampToValueAtTime(0.52,now+0.018);
    env.gain.exponentialRampToValueAtTime(0.001,now+0.76);
    // Bright harmonic twang: triangle, drops faster
    var osc2=ctx.createOscillator();osc2.type='triangle';
    var env2=ctx.createGain();
    osc2.connect(env2);env2.connect(_masterGain);
    osc2.frequency.setValueAtTime(1000,now);
    osc2.frequency.exponentialRampToValueAtTime(130,now+0.26);
    env2.gain.setValueAtTime(0,now);
    env2.gain.linearRampToValueAtTime(0.14,now+0.014);
    env2.gain.exponentialRampToValueAtTime(0.001,now+0.3);
    osc.start(now);osc.stop(now+0.78);
    osc2.start(now);osc2.stop(now+0.33);
  }catch(e){}
}

// ── Stamp lookup helpers ──
function countStamp(id){
  var n=0,ts=S.stamps||[];
  for(var i=0;i<ts.length;i++)if(ts[i].id===id)n++;
  return n;
}
function hasStamp(id){return countStamp(id)>0;}

// ── Luck multiplier ──
// Two Face doubles the odds of every luck-based sticker/stamp effect (stacks
// multiplicatively: two copies = ×4). Wrap any probability with _luckOdds() so
// a boosted chance is clamped to a certain 1.0. Call sites: Proletariat spread,
// Slot Machine rolls.
function _luckMult(){return Math.pow(2,countStamp('two_face'));}
function _luckOdds(p){var q=p*_luckMult();return q>1?1:q;}

// ── Shared gold-spend helper ──
// Returns true and deducts gold on success; toasts and returns false if insufficient.
function spendGold(cost){
  if(!S.devMode&&S.gold<cost){toast('Not enough gold!');return false;}
  if(!S.devMode)S.gold-=cost;
  return true;
}

// ── Fire a hook across all placed board stickers and stamps ──
// Snapshots both arrays before iterating so hooks that modify S.placed/S.stamps
// (e.g. Bourgeois destroying itself on onEndBoard) don't corrupt the walk.
function _fireAllHooks(hookName,args){
  args=args||[];
  var _sp=S.placed.slice();
  for(var _fi=0;_fi<_sp.length;_fi++){
    var _fp=_sp[_fi],_fd=sqd(_fp.id);
    if(_fd&&_fd[hookName])_fd[hookName].apply(_fd,args.concat([_fp]));
  }
  var _st=S.stamps.slice();
  for(var _fj=0;_fj<_st.length;_fj++){
    var _fts=_st[_fj],_ftsd=sqd(_fts.id);
    if(_ftsd&&_ftsd[hookName])_ftsd[hookName].apply(_ftsd,args.concat([_fts]));
  }
}

function openBlankChooser(tileOrHi,cb2){
  var t=(typeof tileOrHi==='number')?S.hand[tileOrHi]:tileOrHi;
  var grid=document.getElementById('blank-grid');grid.innerHTML='';
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(function(l){
    var btn=document.createElement('button');btn.className='blank-btn';btn.textContent=l;
    btn.onclick=function(){
      t.blankAs=l;
      if(t._devBlank)t._alchSc=LS[l]||0;
      document.getElementById('blank-modal').style.display='none';if(cb2)cb2();renderHand();
    };
    grid.appendChild(btn);
  });
  document.getElementById('blank-modal').style.display='flex';
}
