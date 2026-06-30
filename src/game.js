// =====================================================================
// GAME STATE — global state, lifecycle, modals, utilities
// =====================================================================
var _bountyWordBuckets=null;
var _BOUNTY_TIERS=[
  {len:3,w:0.20,reward:4},
  {len:4,w:0.20,reward:5},
  {len:5,w:0.30,reward:8},
  {len:6,w:0.20,reward:12},
  {len:7,w:0.10,reward:15}  // 7+ letters
];
function _getBountyBuckets(){
  if(_bountyWordBuckets)return _bountyWordBuckets;
  _bountyWordBuckets={3:[],4:[],5:[],6:[],7:[]};
  if(DICT)DICT.forEach(function(w){
    var l=w.length;
    if(l>=3&&l<=6)_bountyWordBuckets[l].push(w);
    else if(l>=7)_bountyWordBuckets[7].push(w);
  });
  for(var k in _bountyWordBuckets)_bountyWordBuckets[k].sort();
  return _bountyWordBuckets;
}
function _generateBounties(count,exclude){
  var buckets=_getBountyBuckets();
  var excSet={};for(var _i=0;_i<(exclude||[]).length;_i++)excSet[exclude[_i]]=true;
  // Pre-filter each bucket (copy so we can splice safely)
  var filtered={};for(var k in buckets)filtered[k]=buckets[k].filter(function(w){return!excSet[w];});
  var result=[];
  for(var att=0;att<count*30&&result.length<count;att++){
    // Pick length tier by weight
    var r=_rng(),cum=0,tier=_BOUNTY_TIERS[_BOUNTY_TIERS.length-1];
    for(var wi=0;wi<_BOUNTY_TIERS.length;wi++){cum+=_BOUNTY_TIERS[wi].w;if(r<cum){tier=_BOUNTY_TIERS[wi];break;}}
    var pool=filtered[tier.len];
    if(!pool||!pool.length)continue;
    var idx=Math.floor(_rng()*pool.length);
    var word=pool.splice(idx,1)[0];
    excSet[word]=true;
    var _wls=0;for(var _wli=0;_wli<word.length;_wli++)_wls+=(LS[word[_wli].toUpperCase()]||0);
    var _wr=Math.round((tier.reward+_wls)/2);
    result.push({word:word,reward:_wr});
  }
  return result;
}
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
  var _bag=buildBag();
  var _cids=['c_long','c_pal','c_longer','c_letters','c_hand','c_draw3','c_nodisc','c_oneplay','c_stickers'];
  var _co=_cids.slice();
  for(var _ci=_co.length-1;_ci>0;_ci--){var _cj=Math.floor(_rng()*(_ci+1));var _ct=_co[_ci];_co[_ci]=_co[_cj];_co[_cj]=_ct;}
  S={bag:_bag,hand:[],board:Array(B*B).fill(null),bt:Array(B*B).fill(null),btTop:Array(B*B).fill(null),
     ai:0,bi:0,score:0,gold:4,plays:4,disc:3,wtr:0,ts:0,placed:[],discPressure:0,palUnlocked:false,devMode:false,
     phase:'play',stickerInventory:[],sqHand:[],sqStaged:{},seed:s,_slotMachineRoll:null,bhMult:1,palMult:1,playerMult:1,palWords:[],localCooldowns:new Set(),
     lastWordLen:0,endless:false,endlessRound:0,roundsCompleted:0,drunkStreak:0,
     constraintOrder:_co.slice(0,STAGES.length),usedLetters:new Set(),stickersSoldThisStage:0,crossroadsCount:0,
     tileStickers:[],
     bounties:_generateBounties(3,[])};
  window._easyHint=null;
  shopPool={sq:[],tileCards:[],tilePack:null,bounties:[]};activeDrag=null;
  document.getElementById('shop-screen').style.display='none';
  document.getElementById('play-controls').style.display='flex';
  document.getElementById('placing-controls').style.display='none';
  HP.x=[];HP.vx=[];HP.tiles=[];
  if(typeof _resetZoom==='function')_resetZoom();
  drawFull();renderAll();
}

function handMax(){return(S.bi===2&&currentConstraint()==='c_hand')?6:7;}

function drawFull(){
  var hm=handMax();
  var _c=currentConstraint();
  var cap=(_c==='c_draw3')?3:(hm-S.hand.length);
  var n=Math.min(hm-S.hand.length,cap);
  if(n<=0)return;
  if(S.devMode){
    var _dp='AAEEEIIOOUUTTRRSSNNLLDDGG'.split('');
    for(var i=0;i<n;i++){var _dl=_dp[Math.floor(Math.random()*_dp.length)];S.hand.push({letter:_dl,isBlank:false,id:uid(),blankAs:null,sel:false,onBoard:false,variant:null,blueBonus:0});}
  } else {
    for(var i=0;i<n&&S.bag.length>0;i++){var t=S.bag.pop();S.hand.push({letter:t.letter,isBlank:t.isBlank,id:t.id,blankAs:null,sel:false,onBoard:false,variant:t.variant||null,blueBonus:t.blueBonus||0});}
  }
  if(S.phase==='play')_scheduleRankSolve();
}

function cb(){
  if(S.endless)return['Endless '+S.endlessRound,'How far can you go?',Math.round(10000*Math.pow(1.4,S.endlessRound-1)),null];
  return STAGES[S.ai][S.bi];
}
function tgt(){var base=cb()[2];if(S.bi===2&&currentConstraint()==='c_oneplay')return Math.ceil(base/3/10)*10;return base;}

function roundComplete(){
  var reward=2+S.bi*2+(S.ai*2);
  var playsBonus=S.plays>0?S.plays:0;
  S.gold+=reward+playsBonus;
  var hasSheriff=false;for(var _si=0;_si<S.tileStickers.length;_si++)if(S.tileStickers[_si].id==='sheriffs_office'){hasSheriff=true;break;}
  var sheriffWord='';
  if(hasSheriff){
    var _activeWords=(S.bounties||[]).map(function(b){return b.word;});
    var _newB=_generateBounties(1,_activeWords);if(_newB.length){S.bounties=S.bounties||[];S.bounties.push(_newB[0]);sheriffWord=_newB[0].word;}
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
  document.getElementById('round-modal').style.display='none';
  S.bi++;
  var newStage=S.bi>=3;
  if(newStage){S.ai++;S.bi=0;if(S.ai>=STAGES.length){S.endless=true;S.endlessRound=(S.endlessRound||0)+1;}}

  var _pbBlanks=0;
  if(newStage){
    // Count paint buckets while S.placed still has them
    for(var _pbi=0;_pbi<S.placed.length;_pbi++){var _pb=S.placed[_pbi];if(_pb.id==='paint_bucket'&&_pb.sqIdx!=null&&S.bt[_pb.sqIdx])_pbBlanks++;}
    // End-of-stage sticker effects (Bourgeois, etc.)
    var _esSnap=S.placed.slice();
    for(var _esi=0;_esi<_esSnap.length;_esi++){var _esd=sqd(_esSnap[_esi].id);if(_esd&&_esd.onEndStage)_esd.onEndStage(_esSnap[_esi]);}
    var _esTsSnap=S.tileStickers.slice();
    for(var _esi2=0;_esi2<_esTsSnap.length;_esi2++){var _esd2=sqd(_esTsSnap[_esi2].id);if(_esd2&&_esd2.onEndStage)_esd2.onEndStage(_esTsSnap[_esi2]);}
  }

  if(typeof _resetZoom==='function')_resetZoom();
  var _bgo=document.getElementById('bag-ui-overlay');
  if(_bgo&&_bgo.style.display!=='none'){_bgo.style.display='none';delete _bgo.dataset.opening;delete _bgo.dataset.closing;}
  var _bgs=document.getElementById('bag-sprite');if(_bgs)_bgs.style.visibility='';

  _doStageAnimation(newStage,_pbBlanks);
}

function _clearBoardStickers(){
  for(var i=0;i<B*B;i++)S.board[i]=null;
  S.placed=[];
}

function _doStageAnimation(newStage,pbBlanks){
  animBoardToShop(function(){
    if(newStage){
      clearBoardLetters();S.bag=buildBag();
      for(var k=0;k<(pbBlanks||0);k++)S.bag.push({letter:'_',isBlank:true,id:uid()});
      if(pbBlanks)S.bag=shuffle(S.bag);
      var _pbMsg=pbBlanks?' Paint Bucket: +'+pbBlanks+' blank'+(pbBlanks!==1?'s':'')+'.':'';
      toast(S.endless?'Endless mode! Targets keep rising.':'New stage — board cleared!'+_pbMsg);
    }
    S.score=0;S.plays=4;S.disc=3;S.wtr=0;S.ts=0;S.discPressure=0;S.palUnlocked=false;S.lastWordLen=0;
    S.usedLetters=new Set();S.stickersSoldThisStage=0;
    var _rc=currentConstraint();if(_rc==='c_oneplay')S.plays=1;if(_rc==='c_nodisc')S.disc=0;
    var _insatN=0;for(var _ii=0;_ii<(S.tileStickers||[]).length;_ii++)if(S.tileStickers[_ii].id==='insatiable')_insatN++;
    if(_insatN)S.disc+=_insatN;
    S.sqHand=[];S.sqStaged={};
    recallAll();HP.x=[];HP.vx=[];drawFull();renderAll();shopPool={sq:[],tileCards:[],tilePack:null,bounties:[]};enterShopPhase();
  });
}

var _saveStickerItems=[];
var _saveStickerCallback=null;

function _showSaveStickersModal(boardStickers,onDone){
  _saveStickerCallback=onDone;
  _saveStickerItems=boardStickers.map(function(p){return{id:p.id,chosen:false};});
  var list=document.getElementById('save-stickers-list');if(!list)return onDone([]);
  list.innerHTML='';
  for(var i=0;i<_saveStickerItems.length;i++){
    var item=_saveStickerItems[i];var d=sqd(item.id);if(!d)continue;
    var card=document.createElement('div');card.className='prc';
    card.style.cssText='min-width:90px;max-width:120px;cursor:pointer';
    var iconHtml=d.iconPng?'<img src="'+d.iconPng+'" style="max-width:48px;max-height:48px;image-rendering:pixelated;display:block;margin:0 auto">':sqIconHTML(d,36);
    var hint=document.createElement('div');hint.style.cssText='font-size:30px;color:#8880a8;margin-top:4px';hint.textContent='Click to save';
    card.innerHTML='<div style="margin-bottom:4px">'+iconHtml+'</div>'+'<div style="font-size:28px;color:'+d.fg+'">'+d.name+'</div>';
    card.appendChild(hint);
    (function(it,hintEl,cardEl){cardEl.addEventListener('click',function(){
      it.chosen=!it.chosen;
      cardEl.style.borderColor=it.chosen?'#5aaa5a':'';
      cardEl.style.background=it.chosen?'#1a3a1a':'';
      hintEl.style.color=it.chosen?'#5aaa5a':'#8880a8';
      hintEl.textContent=it.chosen?'✓ Saving':'Click to save';
    });})(item,hint,card);
    list.appendChild(card);
  }
  document.getElementById('save-stickers-modal').style.display='flex';
}

function _saveStickerModalConfirm(){
  document.getElementById('save-stickers-modal').style.display='none';
  var savedIds=_saveStickerItems.filter(function(x){return x.chosen;}).map(function(x){return x.id;});
  _saveStickerItems=[];
  var cb=_saveStickerCallback;_saveStickerCallback=null;
  if(cb)cb(savedIds);
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
  ['pack-modal','sq-modal','bag-ui-overlay','shop-bag-overlay','blank-modal','round-modal','gameover-modal','win-modal','hammer-modal','forge-modal','board-preview-modal','collection-modal','achv-modal','seed-modal','save-stickers-modal'].forEach(function(id){var el=document.getElementById(id);if(el){el.style.display='none';delete el.dataset.closing;}});
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
  // Group by letter only — variants of the same letter share one slot
  var groups={},order=[];
  for(var i=0;i<tiles.length;i++){
    var t=tiles[i],key=t.isBlank?'_':(t.letter||'_');
    if(!groups[key]){groups[key]={letter:t.isBlank?'':t.letter,isBlank:!!t.isBlank,count:0,variants:{}};order.push(key);}
    groups[key].count++;
    if(t.variant)groups[key].variants[t.variant]=(groups[key].variants[t.variant]||0)+1;
  }
  order.sort(function(a,b){
    var ga=groups[a],gb=groups[b];
    if(ga.isBlank!==gb.isBlank)return ga.isBlank?1:-1;
    return ga.letter<gb.letter?-1:1;
  });
  var _vdotColors={red:'#b83030',blue:'#3870a8',gold:'#c8a020'};
  for(var oi=0;oi<order.length;oi++){
    var g=groups[order[oi]],f=fc[oi%fc.length];
    var item=document.createElement('div');
    item.className='bag-float-item';
    item.dataset.letter=g.isBlank?'_':(g.letter||'_');
    item.style.cssText='cursor:pointer;position:relative';
    var inner=document.createElement('div');
    inner.style.cssText='display:flex;flex-direction:column;align-items:center;animation:'+f.a+' '+f.d+' ease-in-out '+f.dl+' infinite';
    var spr=tileSpr(g.isBlank?null:g.letter,g.isBlank,null,sz); // always base tile in grid
    var te=document.createElement('div');
    te.className='tile tile-spr'+(g.isBlank?' blank-t':'');
    te.style.cssText='width:'+sz+'px;height:'+sz+'px;position:relative;flex-shrink:0;'+spr;
    inner.appendChild(te);
    var ct=document.createElement('div');
    ct.style.cssText='color:#7ac07a;font-family:\'Jersey 10\',Georgia;font-size:'+Math.round(sz*0.38)+'px;margin-top:4px;line-height:1;text-align:center';
    ct.textContent='×'+g.count;inner.appendChild(ct);
    item.appendChild(inner);
    // Variant dots float independently ABOVE the tile with their own animations
    var vkeys=(['red','blue','gold']).filter(function(v){return g.variants[v];});
    if(vkeys.length){
      var dotAnims=[{a:'bfloat0',d:'1.9s',dl:'0s'},{a:'bfloat2',d:'2.2s',dl:'0.35s'},{a:'bfloat4',d:'1.7s',dl:'0.7s'}];
      var dotsRow=document.createElement('div');
      dotsRow.className='variant-dots';
      dotsRow.style.cssText='position:absolute;bottom:calc(100% + 10px);left:0;right:0;display:flex;justify-content:center;gap:5px;pointer-events:none;';
      vkeys.forEach(function(v,vi){
        var da=dotAnims[vi%dotAnims.length];
        var dotWrap=document.createElement('div');
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
        _bagToggleExpand(letter_,oi_,document.getElementById('bag-ui-tiles'),S.bag);
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
    // Collapse current then expand new after animation clears
    _bagCollapseLetter(container);
    var g=_bagExpandGen;
    _bagPendingExpand=setTimeout(function(){
      _bagPendingExpand=null;
      if(_bagExpandGen!==g)return;
      _bagExpandLetter(letter,clickedIdx,container,allTiles);
    },430);
  }else{
    // Nothing expanded — go straight to expand (no collapse, no animation pause)
    _bagExpandLetter(letter,clickedIdx,container,allTiles);
  }
}

function _bagExpandLetter(letter,clickedIdx,container,allTiles){
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
  var vord={'':0,'red':1,'blue':2,'gold':3};
  matchTiles.sort(function(a,b){return(vord[a.variant||'']||0)-(vord[b.variant||'']||0);});
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
  // Anchor-column tiles that move laterally also slide vertically:
  //   odd numCols  → all anchor-col tiles drop to bottom row.
  //   even numCols + middle anchor → tiles above the anchor drop one row down to anchor's row;
  //                                  tiles at/below anchor shift laterally only.
  var _anchorColDy=[];
  if(numGridRows>1){
    var _doOddCols=numCols%2===1;
    var _doEvenMid=numCols%2===0&&anchorRow>0&&anchorRow<numGridRows-1;
    if(_doOddCols||_doEvenMid){
      var _anchorRowY=gridRowYs[anchorRow];
      var _botRowY=gridRowYs[numGridRows-1];
      leftItems.concat(rightItems).forEach(function(item){
        var _iax=item.getBoundingClientRect().left+item.getBoundingClientRect().width/2;
        if(Math.abs(_iax-clickedCX)<sz*0.6){
          var _itemTop=item.getBoundingClientRect().top;
          var _targetY=_doOddCols?_botRowY:(_itemTop<_anchorRowY-10?_anchorRowY:null);
          if(_targetY!==null)_anchorColDy.push({el:item,dy:_targetY-_itemTop,fast:_doEvenMid});
        }
      });
    }
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
      te.className='tile tile-spr'+(p.t.isBlank?' blank-t':'')+(p.t.variant?' var-'+p.t.variant:'');
      te.style.cssText='width:'+sz+'px;height:'+sz+'px;position:relative;flex-shrink:0;'+spr;
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
    // 323ms ease-in-out matches the lateral phase of the two-phase column-tile animation.
    var TRANS='transform 323ms ease-in-out';
    var _effectiveRightShift=_anchorColRightItem?_acolRightShift:baseRightShift;
    function _applyItemAnim(item,dx){
      var _idy=0,_ifast=false;
      for(var _di=0;_di<_anchorColDy.length;_di++){if(_anchorColDy[_di].el===item){_idy=_anchorColDy[_di].dy;_ifast=!!_anchorColDy[_di].fast;break;}}
      if(_idy>1){
        // Phase 1: lateral (ease-in-out, 323ms). Phase 2: drop (ease-in). All lateral movement is simultaneous.
        // Lateral phase is always 323ms so speed stays constant.
        // fast=true (one-row drop): drop phase shortened to 140ms; normal: 197ms.
        var _latMs=323,_dropMs=_ifast?140:197,_dur=_latMs+_dropMs,_split=_latMs/_dur;
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
    items[clickedIdx].style.transition='transform 0.52s cubic-bezier(0.4,0,0.2,1)';
    items[clickedIdx].style.transform='scale(1.1)';
    var clickedDots=items[clickedIdx].querySelector('.variant-dots');
    if(clickedDots)clickedDots.style.opacity='0';
    if(window._bagPickMode){
      var _anchorTile=matchTiles[0];
      items[clickedIdx]._onPickClick=function(e){e.stopPropagation();if(window._bagPickMode)window._bagPickMode(_anchorTile);};
      items[clickedIdx].addEventListener('click',items[clickedIdx]._onPickClick);
    }
    if(stackEl){Array.from(stackEl.children).forEach(function(outer,pi){
      var delay=pi*30;
      outer.style.transition='transform 0.45s cubic-bezier(0.4,0,0.2,1) '+delay+'ms, opacity 0.2s ease '+delay+'ms';
      outer.style.transform='translateX(0) translateY(0) scale(1.1)';
      outer.style.opacity='1';
    });}
    setTimeout(function(){
      if(_bagExpandGen!==gen)return;
      items.forEach(function(item,i){if(i!==clickedIdx){var inner=item.children[0];if(inner)inner.style.animationPlayState='';}});
    },460);
  });});
}

function _bagCollapseLetter(container){
  var gen=++_bagExpandGen;
  // Clear state immediately so rapid clicks see consistent state
  delete container.dataset.expandedLetter;
  var items=Array.from(container.querySelectorAll('.bag-float-item'));
  // Find rise duration before anything else so the stack overlay can wait for it.
  var _riseMs=0;
  items.forEach(function(item){if(!_riseMs&&item._archAnim&&item._archAnim.playState==='finished'&&item._archParams)_riseMs=item._archParams.dropMs;});
  var stackEl=document.getElementById('_bag-expand-stack');
  if(stackEl){setTimeout(function(){stackEl.style.opacity='0';setTimeout(function(){if(stackEl.parentNode)stackEl.parentNode.removeChild(stackEl);},300);},_riseMs);}
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
    var CLAT='transform 323ms ease-in-out '+_riseMs+'ms';
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
        ],{duration:_cd,easing:'linear',fill:'forwards'});
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
    },_riseMs+323+50);
  });});
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
    var tilesDiv=document.getElementById('bag-ui-tiles');
    _renderBagFloatTiles(tilesDiv,S.bag,73);
    tilesDiv.style.animation='none';void tilesDiv.offsetHeight;
    tilesDiv.style.animation='bagTunnelZoom 0.52s ease-out both';
  });
}

function closeBagUI(){
  var ovr=document.getElementById('bag-ui-overlay');if(!ovr||ovr.dataset.closing)return;
  delete ovr.dataset.opening;ovr.dataset.closing='1';
  window._bagPickMode=null;
  ovr.style.visibility='';ovr.style.pointerEvents='';
  var _bst=document.getElementById('_bag-expand-stack');if(_bst&&_bst.parentNode)_bst.parentNode.removeChild(_bst);
  var _btd=document.getElementById('bag-ui-tiles');if(_btd)delete _btd.dataset.expandedLetter;
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
    ckSrc.connect(ckF);ckF.connect(ckG);ckG.connect(ctx.destination);ckSrc.start(now);
    // Descending boing: fundamental sine 500→65 Hz
    var osc=ctx.createOscillator();osc.type='sine';
    var env=ctx.createGain();
    osc.connect(env);env.connect(ctx.destination);
    osc.frequency.setValueAtTime(500,now);
    osc.frequency.exponentialRampToValueAtTime(65,now+0.58);
    env.gain.setValueAtTime(0,now);
    env.gain.linearRampToValueAtTime(0.52,now+0.018);
    env.gain.exponentialRampToValueAtTime(0.001,now+0.76);
    // Bright harmonic twang: triangle, drops faster
    var osc2=ctx.createOscillator();osc2.type='triangle';
    var env2=ctx.createGain();
    osc2.connect(env2);env2.connect(ctx.destination);
    osc2.frequency.setValueAtTime(1000,now);
    osc2.frequency.exponentialRampToValueAtTime(130,now+0.26);
    env2.gain.setValueAtTime(0,now);
    env2.gain.linearRampToValueAtTime(0.14,now+0.014);
    env2.gain.exponentialRampToValueAtTime(0.001,now+0.3);
    osc.start(now);osc.stop(now+0.78);
    osc2.start(now);osc2.stop(now+0.33);
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
