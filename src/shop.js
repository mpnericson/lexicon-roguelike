// =====================================================================
// SHOP — sticker shop, packs, tile upgrades, forge, hammer
// =====================================================================
function freeSquare(){var c=[];for(var i=0;i<B*B;i++)if(!S.board[i])c.push(i);return c.length?c[Math.floor(_rng()*c.length)]:-1;}


function wrandN(pool,w,n){
  var used={},out=[];
  for(var k=0;k<n;k++){
    var arr=[];
    for(var i=0;i<SQ.length;i++){
      var d=SQ[i];if(pool.indexOf(d.id)<0||used[d.id])continue;
      var wt=Math.round((w[d.rarity]||0)*10);
      for(var j=0;j<wt;j++)arr.push(d.id);
    }
    if(!arr.length)break;
    var id=arr[Math.floor(_rng()*arr.length)];
    used[id]=1;out.push(id);
  }
  return out;
}

var ALL_PACK_TYPES=[
  {type:'sticker',label:'Sticker Pack',desc:'3 random stickers — choose one to keep.',cost:3},
  {type:'tile',label:'Tile Pack',desc:'5 tiles — mix of basic and enchanted.',cost:3},
  {type:'sq',sqId:'dl',label:'6× Double Letter',desc:'6 DL squares — letter scores ×2.',cost:3},
  {type:'sq',sqId:'tl',label:'4× Triple Letter',desc:'4 TL squares — letter scores ×3.',cost:3},
  {type:'sq',sqId:'dw',label:'3× Double Word',desc:'3 DW squares — word scores ×2.',cost:3},
  {type:'sq',sqId:'tw',label:'2× Triple Word',desc:'2 TW squares — word scores ×3.',cost:3},
];

function refreshShop(){
  shopPool.sq=[];
  var sqIds=wrandN(SQ.map(function(d){return d.id;}),{common:5,uncommon:2,rare:0.8,legendary:0.1},3);
  for(var i=0;i<sqIds.length;i++)shopPool.sq.push({id:sqIds[i],sold:false});
  var shuffledPacks=shuffle(ALL_PACK_TYPES.slice());
  shopPool.packs=shuffledPacks.slice(0,2).map(function(p){return{type:p.type,sqId:p.sqId||null,label:p.label,desc:p.desc,cost:p.cost,sold:false};});
  var bwCopy=BOUNTY_WORDS.slice();
  for(var i=bwCopy.length-1;i>0;i--){var j=Math.floor(_rng()*(i+1));var tmp=bwCopy[i];bwCopy[i]=bwCopy[j];bwCopy[j]=tmp;}
  var activeWords=(S.bounties||[]).map(function(b){return b.word;});
  var BVARIANTS=['gold','red','blue'];
  shopPool.bounties=bwCopy.filter(function(b){return activeWords.indexOf(b.word)<0;}).slice(0,3).map(function(b){
    var variant=_rng()<0.05?BVARIANTS[Math.floor(_rng()*BVARIANTS.length)]:null;
    return{word:b.word,cost:2,reward:b.reward+(variant?2:0),accepted:false,variant:variant||null};
  });
  shopPool.slotSpinCost=4;
  shopPool.slotSpinsThisVisit=0;
  shopPool.slotResult=null;
  shopPool.bagEnchantUsed=false;
  shopPool.bagDestroyUsed=false;
  shopPool.bagDupUsed=false;
  shopPool.tileCards=[];
}

function enterShopPhase(){
  S.phase='shop';
  if(!shopPool.sq.length)refreshShop();
  var rp=document.getElementById('slot-result-panel');if(rp)rp.style.display='none';
  var bu=document.getElementById('shop-bag-ui');if(bu)bu.style.display='none';
  renderShop();
  document.getElementById('shop-screen').style.display='flex';
  initShopUI();
}

function leaveShop(){
  _stopSignAnim();
  _stopReels();
  achvCheck('shop_exit');
  saveGame();
  if(S.pendingSquares.length>0){
    animShopToBoard(function(){ enterPlacingPhase(); });
  } else {
    S.phase='play';
    animShopToBoard(function(){ _burstHandTiles(); });
  }
}

function enterPlacingPhase(){
  S.phase='placing';
  S.sqHand=S.pendingSquares.map(function(p){return{id:p.id,placed:false};});
  S.pendingSquares=[];S.sqStaged={};
  HP.x=[];HP.vx=[];HP.tiles=[];
  document.getElementById('play-controls').style.display='none';
  document.getElementById('placing-controls').style.display='flex';
  document.getElementById('shuffle-btn').style.display='none';
  renderSqHand();renderBoard();
}

function confirmPlacement(){
  for(var idx in S.sqStaged){
    var si=S.sqStaged[idx];var sq=S.sqHand[si];
    S.board[parseInt(idx)]=sq.id;S.placed.push({id:sq.id,sqIdx:parseInt(idx)});
  }
  var unplaced=S.sqHand.filter(function(sq){return !sq.placed;}).length;
  var fromPlay=!!S._devPlacingFromPlay;
  S.sqHand=[];S.sqStaged={};S.phase='play';S._devPlacingFromPlay=false;
  document.getElementById('play-controls').style.display='flex';
  document.getElementById('placing-controls').style.display='none';
  document.getElementById('dev-cancel-placing-btn').style.display='none';
  document.getElementById('shuffle-btn').style.display='';
  HP.x=[];HP.vx=[];HP.tiles=[];
  renderHand();renderBoard();renderHUD();
  if(unplaced>0)toast(unplaced+' unplaced sticker'+(unplaced>1?'s':'')+' forfeited.');
  if(!fromPlay)_burstHandTiles();
}

function enterPlacingFromDev(){
  if(!S.devMode||!S.pendingSquares.length){toast('No stickers in inventory.');return;}
  S._devPlacingFromPlay=true;
  var dp=document.getElementById('dev-palette');if(dp)dp.style.display='none';
  if(typeof _updateDevTabs==='function')_updateDevTabs();
  enterPlacingPhase();
  document.getElementById('dev-cancel-placing-btn').style.display='';
}

function cancelDevPlacing(){
  var unplaced=S.sqHand.filter(function(sq){return!sq.placed;});
  S.pendingSquares=unplaced.map(function(sq){return{id:sq.id};});
  S.sqHand=[];S.sqStaged={};S.phase='play';S._devPlacingFromPlay=false;
  document.getElementById('play-controls').style.display='flex';
  document.getElementById('placing-controls').style.display='none';
  document.getElementById('dev-cancel-placing-btn').style.display='none';
  document.getElementById('shuffle-btn').style.display='';
  HP.x=[];HP.vx=[];HP.tiles=[];
  renderHand();renderBoard();renderHUD();
}

function openShop(){enterShopPhase();}

function renderShop(){
  var sub=document.getElementById('shop-sub');if(sub)sub.textContent='Gold: $'+S.gold;
  var goldEl=document.getElementById('shop-gold-display');if(goldEl)goldEl.textContent='$'+S.gold;
  var n=S.pendingSquares.length;
  var qbar=document.getElementById('shop-queue-bar');
  if(qbar){qbar.style.display=n>0?'block':'none';qbar.textContent=n+' sticker'+(n!==1?'s':'')+' queued — leave to place '+(n===1?'it':'them')+'.';}
  var priceEl=document.getElementById('shop-slot-price');
  if(priceEl)priceEl.textContent='$'+(shopPool.slotSpinCost||4);
  var sqItems=shopPool.sq||[];
  for(var pi=0;pi<2;pi++){
    var box=document.getElementById('shop-pack-'+pi);if(!box)continue;
    var item=sqItems[pi];
    if(!item){box.innerHTML='';box.className='shop-pack-box';box.onclick=null;continue;}
    var d=sqd(item.id);if(!d){box.innerHTML='';continue;}
    var iconHtml=d.iconPng
      ?'<img src="'+d.iconPng+'" style="max-width:80%;max-height:80%;image-rendering:pixelated;display:block">'
      :'<span style="font-size:clamp(18px,8vw,130px);line-height:1">'+d.icon+'</span>';
    box.innerHTML='<div class="shop-pack-icon">'+iconHtml+'</div><div class="shop-pack-cost" style="color:'+d.fg+'">'+'$'+d.cost+'</div>';
    box.className='shop-pack-box'+(item.sold?' sold':'');
    if(!item.sold){(function(idx){box.onclick=function(){buySq(idx);};})(pi);}else box.onclick=null;
  }
  var blist=document.getElementById('shop-bounty-list');
  if(blist){
    blist.innerHTML='';
    var bpool=shopPool.bounties||[];
    if(!bpool.length){var nem=document.createElement('div');nem.style.cssText='font-size:clamp(6px,0.9vw,14px);color:#6060a0';nem.textContent='No bounties';blist.appendChild(nem);}
    var bCanvasW=Math.min(window.innerWidth,window.innerHeight*16/9);
    var bListInnerW=bCanvasW*0.25*0.94;
    // chip has padding:4% 3% (another 0.94×), worst case 6-letter word + reward = 7 items with 13px gaps
    var bTileSz=Math.max(12,Math.floor((bListInnerW*0.94-21)/7));
    for(var bi=0;bi<bpool.length;bi++){
      var b=bpool[bi];
      var item=document.createElement('div');item.className='shop-bounty-item';
      var chip=document.createElement('div');chip.className='shop-bounty-chip';
      chip.innerHTML=wordAsTilesHTML(b.word,bTileSz,b.variant||null);
      if(!b.accepted){
        var bbtn=document.createElement('button');bbtn.className='shop-bounty-accept-btn';
        bbtn.textContent='$'+b.reward;
        bbtn.style.height=bTileSz+'px';bbtn.style.fontSize=Math.round(bTileSz*0.48)+'px';
        (function(j){bbtn.onclick=function(){acceptBounty(j);};})(bi);
        chip.appendChild(bbtn);
      } else {
        var adiv=document.createElement('div');adiv.className='shop-bounty-done';adiv.textContent='✓';
        adiv.style.height=bTileSz+'px';adiv.style.fontSize=Math.round(bTileSz*0.48)+'px';
        chip.appendChild(adiv);
      }
      item.appendChild(chip);
      blist.appendChild(item);
    }
  }
  var alBtn=document.getElementById('alchemist-btn');
  if(alBtn){var hasAl=false;for(var _ai=0;_ai<S.placed.length;_ai++)if(S.placed[_ai].id==='alchemist'){hasAl=true;break;}alBtn.style.display=hasAl?'':'none';alBtn.style.opacity=S.alchemistUsed?'0.4':'';}
}

function _sqBigIcon(d){
  if(!d)return'';
  if(d.iconPng)return'<img src="'+d.iconPng+'" style="max-width:80%;max-height:70%;image-rendering:pixelated;display:block;margin:0 auto">';
  return'<span>'+d.icon+'</span>';
}

// ── SHOP UI INIT ──
function initShopUI(){
  _initSlotHandle();
  _initSignAnim();
  _initShopBag();
  _initReels();
}

function _initSignAnim(){
  _stopSignAnim();
  var bg=document.getElementById('shop-bg');if(!bg)return;
  var frame=0;
  window._shopSignTimer=setInterval(function(){
    frame=1-frame;
    bg.src='Assets/shop-bg-frame'+frame+'.png';
  },900);
}

function _stopSignAnim(){
  if(window._shopSignTimer){clearInterval(window._shopSignTimer);window._shopSignTimer=null;}
  var bg=document.getElementById('shop-bg');
  if(bg)bg.src='Assets/shop-bg-frame0.png';
}

function _initSlotHandle(){
  var hit=document.getElementById('shop-handle-hit');
  var img=document.getElementById('shop-handle-img');
  if(!hit||!img)return;
  var fresh=hit.cloneNode(true);hit.parentNode.replaceChild(fresh,hit);hit=fresh;

  var dragging=false,startY=0;
  function canvasH(){var c=document.getElementById('shop-canvas');return c?c.getBoundingClientRect().height:400;}
  function frameFromDy(dy){return Math.min(7,Math.max(0,Math.round(dy/(canvasH()*0.208)*7)));}
  function setFrame(f,hl){img.src='Assets/slot-handle-'+(hl?'hl-':'')+'frame'+f+'.png';}

  hit.addEventListener('pointerdown',function(e){
    dragging=true;startY=e.clientY;setFrame(0,true);
    hit.setPointerCapture(e.pointerId);e.preventDefault();
  });
  hit.addEventListener('pointermove',function(e){
    if(!dragging)return;
    setFrame(frameFromDy(Math.max(0,e.clientY-startY)),true);
  });
  function onRelease(e){
    if(!dragging)return;dragging=false;
    var finalFrame=frameFromDy(Math.max(0,(e.clientY||startY)-startY));
    var didSpin=finalFrame>=5;
    var f=finalFrame;
    var t=setInterval(function(){f--;if(f<=0){clearInterval(t);setFrame(0,false);if(didSpin)spinSlots();}else setFrame(f,false);},55);
  }
  hit.addEventListener('pointerup',onRelease);
  hit.addEventListener('pointercancel',onRelease);
}

function _initShopBag(){
  var btn=document.getElementById('shop-bag-btn');
  var spr=document.getElementById('shop-bag-sprite');
  if(!btn||!spr)return;
  var fresh=btn.cloneNode(true);btn.parentNode.replaceChild(fresh,btn);
  btn=fresh;spr=fresh.querySelector('img');
  var frame=0,dir=0,timer=null,MAX=4,MS=70;
  function tick(){timer=null;frame=Math.max(0,Math.min(MAX,frame+dir));spr.src='Assets/bag-hl-frame'+frame+'.png';
    if(dir===1&&frame<MAX)timer=setTimeout(tick,MS);
    else if(dir===-1&&frame>0)timer=setTimeout(tick,MS);
    else if(dir===-1&&frame===0)spr.src='Assets/bag-frame0.png';}
  btn.addEventListener('mouseenter',function(){if(timer){clearTimeout(timer);timer=null;}dir=1;spr.src='Assets/bag-hl-frame'+frame+'.png';if(frame<MAX)timer=setTimeout(tick,MS);});
  btn.addEventListener('mouseleave',function(){if(timer){clearTimeout(timer);timer=null;}dir=-1;if(frame>0)timer=setTimeout(tick,MS);else spr.src='Assets/bag-frame0.png';});
}

// ── REEL SYSTEM ──
var _reels=null,_reelAF=null,_reelLastTime=0,_reelResultShown=false;
var REEL_IDLE_SPEED=30,REEL_FAST_SPEED=3000,REEL_DECEL_DIST=250;

function _initReels(){
  _stopReels();
  _reelResultShown=false;
  var allIds=SQ.map(function(d){return d.id;});
  function cosmShuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
  _reels=[];
  for(var ri=0;ri<3;ri++){
    var el=document.getElementById('shop-reel-'+(ri+1));
    if(!el){_reels.push(null);continue;}
    el.innerHTML='';
    var rect=el.getBoundingClientRect();
    var itemH=rect.height||40;
    var items=cosmShuffle(allIds);
    var N=items.length;
    var loopLen=N*itemH;
    var strip=document.createElement('div');
    strip.className='reel-strip';
    strip.style.height=(3*N*itemH)+'px';
    for(var pass=0;pass<3;pass++){
      for(var ii=0;ii<N;ii++){
        var d=sqd(items[ii]);if(!d)continue;
        var item=document.createElement('div');
        item.className='reel-item';
        item.style.height=itemH+'px';
        item.dataset.sqid=items[ii];
        var iconHtml=d.iconPng?'<img src="'+d.iconPng+'" alt="">':d.icon;
        item.innerHTML='<div class="reel-icon">'+iconHtml+'</div>'
          +'<div class="reel-name" style="color:'+d.fg+'">'+d.name+'</div>';
        strip.appendChild(item);
      }
    }
    el.appendChild(strip);
    var startOff=Math.random()*loopLen;
    strip.style.transform='translateY(-'+startOff+'px)';
    _reels.push({el:el,strip:strip,items:items,itemH:itemH,N:N,
      offset:startOff,speed:REEL_IDLE_SPEED,stopping:false,
      targetOffset:0,stopped:false,resultId:null});
  }
  _reelLastTime=performance.now();
  _reelAF=requestAnimationFrame(_reelLoop);
}

function _reelLoop(ts){
  if(!_reels)return;
  var dt=Math.min((ts-_reelLastTime)/1000,0.05);
  _reelLastTime=ts;
  for(var ri=0;ri<_reels.length;ri++){
    var r=_reels[ri];
    if(!r||r.stopped)continue;
    if(!r.stopping){
      r.offset+=r.speed*dt;
      if(r.offset>=r.N*r.itemH)r.offset-=r.N*r.itemH;
    } else {
      var gap=r.targetOffset-r.offset;
      if(gap<=0.5){r.offset=r.targetOffset;r.stopped=true;r.strip.style.transform='translateY(-'+r.offset+'px)';continue;}
      var spd=(gap>REEL_DECEL_DIST)?r.speed:Math.max((gap/REEL_DECEL_DIST)*REEL_FAST_SPEED,REEL_IDLE_SPEED+5);
      r.offset+=Math.min(spd*dt,gap);
    }
    r.strip.style.transform='translateY(-'+r.offset+'px)';
  }
  var nowAll=_reels.every(function(r){return!r||r.stopped;});
  if(nowAll&&!_reelResultShown&&shopPool.slotResult){_reelResultShown=true;_onReelStopped();}
  _reelAF=requestAnimationFrame(_reelLoop);
}

function _stopReelAt(ri,resultId){
  if(!_reels||!_reels[ri])return;
  var r=_reels[ri];
  if(r.stopping||r.stopped)return;
  r.resultId=resultId;
  var resultIdx=r.items.indexOf(resultId);
  if(resultIdx<0)resultIdx=0;
  var loopLen=r.N*r.itemH;
  r.offset=r.offset%loopLen; // normalize before computing target
  // target in second copy of strip: always ahead of current offset
  r.targetOffset=loopLen+resultIdx*r.itemH;
  r.stopping=true;
}

function _onReelStopped(){
  if(!_reels)return;
  for(var ri=0;ri<_reels.length;ri++){
    var r=_reels[ri];
    if(!r||!r.resultId)continue;
    var resultIdx=r.items.indexOf(r.resultId);
    if(resultIdx<0)continue;
    // Strip has 3 passes; stopped item is in second pass (indices N..2N-1)
    var allItems=r.strip.querySelectorAll('.reel-item');
    var visItem=allItems[r.N+resultIdx]||allItems[resultIdx];
    if(visItem){
      visItem.classList.add('reel-sel');
      (function(id,itemEl){itemEl.onclick=function(){_pickReelResult(id);};})(r.resultId,visItem);
    }
  }
}

function _pickReelResult(id){
  var d=sqd(id);if(!d)return;
  var qty=d.qty||1;
  for(var k=0;k<qty;k++)S.pendingSquares.push({id:id});
  document.querySelectorAll('.reel-item.reel-sel').forEach(function(el){el.classList.remove('reel-sel');el.onclick=null;});
  if(_reels){
    for(var ri=0;ri<_reels.length;ri++){
      var r=_reels[ri];if(!r)continue;
      r.stopped=false;r.stopping=false;r.resultId=null;r.speed=REEL_IDLE_SPEED;
      r.offset=r.offset%(r.N*r.itemH);
    }
    _reelResultShown=false;
  }
  shopPool.slotResult=null;
  renderShop();renderHUD();
  toast((qty>1?qty+'× ':'')+d.name+' queued!');
}

function _stopReels(){
  if(_reelAF){cancelAnimationFrame(_reelAF);_reelAF=null;}
  _reels=null;_reelResultShown=false;
}

// ── SLOT MACHINE ──
function spinSlots(){
  if(document.querySelector('.reel-item.reel-sel')){toast('Pick a sticker from the reels first!');return;}
  var cost=shopPool.slotSpinCost||4;
  if(!S.devMode&&S.gold<cost){toast('Not enough gold!');return;}
  if(!S.devMode)S.gold-=cost;
  shopPool.slotSpinsThisVisit=(shopPool.slotSpinsThisVisit||0)+1;
  shopPool.slotSpinCost=4+shopPool.slotSpinsThisVisit;
  renderHUD();renderShop();
  var results=wrandN(SQ.map(function(d){return d.id;}),{common:5,uncommon:2,rare:0.8,legendary:0.1},3);
  shopPool.slotResult=results;
  _reelResultShown=false;
  if(_reels){for(var ri=0;ri<_reels.length;ri++){var r=_reels[ri];if(!r)continue;r.speed=REEL_FAST_SPEED;r.stopping=false;r.stopped=false;r.resultId=null;}}
  setTimeout(function(){_stopReelAt(0,results[0]);},1200);
  setTimeout(function(){_stopReelAt(1,results[1]);},1800);
  setTimeout(function(){_stopReelAt(2,results[2]);},2400);
}

// ── SHOP BAG MINI-UI ──
function openShopBagUI(){
  var panel=document.getElementById('shop-bag-ui');if(!panel)return;
  var bagCopy=S.bag.slice();
  for(var i=bagCopy.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var tmp=bagCopy[i];bagCopy[i]=bagCopy[j];bagCopy[j]=tmp;}
  var display=bagCopy.slice(0,8);
  var tilesDiv=document.getElementById('shop-bag-tiles');
  var actDiv=document.getElementById('shop-bag-actions');
  if(!tilesDiv||!actDiv)return;
  tilesDiv.innerHTML='';
  var selected={tile:null};
  if(!display.length){tilesDiv.innerHTML='<div style="font-size:clamp(5px,0.85vw,13px);color:#8880a8">Bag is empty!</div>';}
  display.forEach(function(t){
    var el=document.createElement('div');
    el.className='shop-bag-tile'+(t.variant?' var-'+t.variant:'');
    el.innerHTML='<span class="tl">'+(t.isBlank?'?':t.letter)+'</span><span class="ts">'+(t.isBlank?0:(LS[t.letter]||0))+'</span>';
    el.onclick=function(){
      document.querySelectorAll('.shop-bag-tile').forEach(function(e){e.classList.remove('sbag-sel');});
      if(selected.tile===t){selected.tile=null;}else{selected.tile=t;el.classList.add('sbag-sel');}
      _renderBagActions(selected,actDiv);
    };
    tilesDiv.appendChild(el);
  });
  actDiv.innerHTML='<div style="font-size:clamp(4px,0.7vw,11px);color:#8880a8">Select a tile above</div>';
  panel.style.display='flex';
}

function _renderBagActions(sel,actDiv){
  actDiv.innerHTML='';
  if(!sel.tile){actDiv.innerHTML='<div style="font-size:clamp(4px,0.7vw,11px);color:#8880a8">Select a tile above</div>';return;}
  var t=sel.tile;
  function mkBtn(label,used,fn){
    var b=document.createElement('button');
    b.style.cssText='background:'+(used?'#1a1a3a':'#2a4a2a')+';border:1px solid '+(used?'#3a3a5a':'#4a8a4a')+';color:'+(used?'#5a5a8a':'#80c080')+';font-family:\'Jersey 10\',Georgia;font-size:clamp(4px,0.78vw,12px);cursor:'+(used?'default':'pointer')+';padding:2% 4%;border-radius:3px';
    b.textContent=label+(used?' (used)':'');if(!used)b.onclick=fn;return b;
  }
  actDiv.appendChild(mkBtn('Enchant $2',shopPool.bagEnchantUsed,function(){_bagEnchantFlow(t,sel,actDiv);}));
  actDiv.appendChild(mkBtn('Destroy $2',shopPool.bagDestroyUsed,function(){
    if(!S.devMode&&S.gold<2){toast('Not enough gold!');return;}
    var idx=-1;for(var i=0;i<S.bag.length;i++)if(S.bag[i].id===t.id){idx=i;break;}
    if(idx<0){toast('Tile not found.');return;}
    if(!S.devMode)S.gold-=2;S.bag.splice(idx,1);shopPool.bagDestroyUsed=true;
    renderHUD();document.getElementById('bag-count').textContent=S.bag.length;
    toast((t.isBlank?'Blank':t.letter)+' destroyed!');closeShopBagUI();renderShop();
  }));
  actDiv.appendChild(mkBtn('Duplicate $2',shopPool.bagDupUsed,function(){
    if(!S.devMode&&S.gold<2){toast('Not enough gold!');return;}
    if(!S.devMode)S.gold-=2;
    S.bag.push(Object.assign({},t,{id:uid()}));S.bag=shuffle(S.bag);shopPool.bagDupUsed=true;
    renderHUD();document.getElementById('bag-count').textContent=S.bag.length;
    toast((t.isBlank?'Blank':t.letter)+' duplicated!');closeShopBagUI();renderShop();
  }));
}

function _bagEnchantFlow(t,sel,actDiv){
  if(!S.devMode&&S.gold<2){toast('Not enough gold!');return;}
  actDiv.innerHTML='';
  var variants=[{v:'gold',label:'Gold',desc:'+$1 when scored',col:'#f0c060'},{v:'blue',label:'Blue',desc:'Score grows each play',col:'#60b8ff'},{v:'red',label:'Red',desc:'Triggers twice',col:'#ff8080'}];
  variants.forEach(function(vt){
    if(t.variant===vt.v)return;
    var b=document.createElement('button');
    b.style.cssText='background:#1a1a3a;border:1px solid '+vt.col+';color:'+vt.col+';font-family:\'Jersey 10\',Georgia;font-size:clamp(4px,0.75vw,12px);cursor:pointer;padding:2% 4%;border-radius:3px';
    b.textContent=vt.label+' $2';
    b.onclick=function(){
      if(!S.devMode&&S.gold<2){toast('Not enough gold!');return;}
      var found=false;for(var i=0;i<S.bag.length;i++){if(S.bag[i].id===t.id){S.bag[i].variant=vt.v;if(vt.v==='blue')S.bag[i].blueBonus=0;found=true;break;}}
      if(!found){toast('Tile not found.');return;}
      if(!S.devMode)S.gold-=2;shopPool.bagEnchantUsed=true;
      renderHUD();toast(vt.label+' '+t.letter+' enchanted!');closeShopBagUI();renderShop();
    };
    actDiv.appendChild(b);
  });
  var cancel=document.createElement('button');
  cancel.style.cssText='background:#2a2a4a;border:1px solid #5a5a8a;color:#a0a0c0;font-family:\'Jersey 10\',Georgia;font-size:clamp(4px,0.75vw,12px);cursor:pointer;padding:2% 4%;border-radius:3px';
  cancel.textContent='Cancel';cancel.onclick=function(){_renderBagActions(sel,actDiv);};
  actDiv.appendChild(cancel);
}

function closeShopBagUI(){
  var p=document.getElementById('shop-bag-ui');if(p)p.style.display='none';
}

function buyTileCard(i){
  var tc=shopPool.tileCards[i];if(!tc||tc.bought)return;
  if(!S.devMode&&S.gold<tc.cost){toast('Not enough gold!');return;}
  if(!S.devMode)S.gold-=tc.cost;tc.bought=true;
  S.bag.push({letter:tc.letter,isBlank:false,id:uid(),variant:tc.variant,blueBonus:0});
  S.bag=shuffle(S.bag);renderShop();renderHUD();document.getElementById('bag-count').textContent=S.bag.length;
  toast(tc.variant.charAt(0).toUpperCase()+tc.variant.slice(1)+' '+tc.letter+' added to bag!');
}

function buyPack(i){
  var pack=(shopPool.packs||[])[i];if(!pack||pack.sold)return;
  if(!S.devMode&&S.gold<pack.cost){toast('Not enough gold!');return;}
  if(!S.devMode)S.gold-=pack.cost;
  pack.sold=true;
  if(pack.type==='sticker'){
    renderHUD();
    var contents=wrandN(SQ.map(function(d){return d.id;}),{common:4,uncommon:2,rare:1},3);
    openPackReveal('Sticker Pack',contents);
  } else if(pack.type==='tile'){
    var packLetters=Object.keys(DIST);var varTypes=['gold','blue','red'];var added=[];
    for(var ti=0;ti<5;ti++){
      var l=packLetters[Math.floor(_rng()*packLetters.length)];
      var v=_rng()<0.25?varTypes[Math.floor(_rng()*varTypes.length)]:null;
      S.bag.push({letter:l,isBlank:false,id:uid(),variant:v,blueBonus:0});
      added.push((v?v[0].toUpperCase()+v.slice(1)+' ':'')+l);
    }
    S.bag=shuffle(S.bag);renderShop();renderHUD();document.getElementById('bag-count').textContent=S.bag.length;
    toast('Tile Pack: '+added.join(', ')+' added!');
  } else if(pack.type==='sq'){
    var d=sqd(pack.sqId);var qty=(d&&d.qty)||1;
    for(var k=0;k<qty;k++)S.pendingSquares.push({id:pack.sqId});
    renderShop();renderHUD();
    toast(qty+'× '+d.name+' queued — place them after leaving shop!');
  }
}

function openHammerModal(){renderHammerModal();document.getElementById('hammer-modal').style.display='flex';}

function renderHammerModal(){
  var grid=document.getElementById('hammer-grid');grid.innerHTML='';
  var sorted=S.bag.slice().sort(function(a,b){return(a.letter||'_').localeCompare(b.letter||'_');});
  if(!sorted.length){grid.innerHTML='<div style="color:#8880a8;font-size:32px">Bag is empty!</div>';return;}
  for(var i=0;i<sorted.length;i++){
    var tl=sorted[i];var s=document.createElement('div');s.className='h-tile'+(tl.variant?' var-'+tl.variant:'');
    s.style.cursor='pointer';s.style.position='relative';
    s.innerHTML='<span class="tl">'+(tl.isBlank?'?':tl.letter)+'</span><span class="ts">'+(tl.isBlank?0:(LS[tl.letter]||0))+'</span>';
    if(tl.variant){var vb=document.createElement('span');vb.className='vbadge vbadge-'+tl.variant;vb.textContent=tl.variant==='gold'?'$':tl.variant==='blue'?'↑':'×2';s.appendChild(vb);}
    (function(tile){s.onclick=function(){hammerTile(tile);renderHammerModal();};})(tl);grid.appendChild(s);
  }
}

var forgeSelectedTile=null;

function openForgeModal(){forgeSelectedTile=null;renderForgeModal();document.getElementById('forge-modal').style.display='flex';}

function renderForgeModal(){
  var grid=document.getElementById('forge-grid-inner');grid.innerHTML='';
  var opts=document.getElementById('forge-options');
  var sub=document.getElementById('forge-sub');
  var backBtn=document.getElementById('forge-back-btn');
  if(forgeSelectedTile){
    grid.style.display='none';opts.style.display='block';
    sub.textContent='Choose an enchantment for '+forgeSelectedTile.letter+' ('+(LS[forgeSelectedTile.letter]||0)+' pts)';
    backBtn.textContent='← Change tile';
    opts.innerHTML='';
    var FORGE=[{v:'gold',label:'Gold',desc:'+$1 each time scored',cost:1,bg:'#6a4800'},{v:'blue',label:'Blue',desc:'Score grows by base pts each play',cost:1,bg:'#0a2a60'},{v:'red',label:'Red',desc:'Triggers twice (DW/TW doubles too)',cost:1,bg:'#601010'}];
    FORGE.forEach(function(f){
      var btn=document.createElement('button');btn.className='btn';
      btn.style.cssText='width:100%;padding:12px 16px;margin-bottom:6px;background:'+f.bg+';color:#e8e0d0;text-align:left;border:1px solid rgba(255,255,255,.15)';
      btn.innerHTML='<strong style="color:#f0e080">'+f.label+'</strong> — '+f.desc+' <span style="color:#f0c060;float:right">$'+f.cost+'</span>';
      btn.onclick=function(){forgeUpgrade(forgeSelectedTile.id,f.v,f.cost);forgeSelectedTile=null;renderForgeModal();};
      opts.appendChild(btn);
    });
  } else {
    grid.style.display='flex';opts.style.display='none';
    sub.textContent='Select a plain tile to enchant.';backBtn.textContent='← Back';
    var avail=S.bag.filter(function(t){return!t.variant;}).sort(function(a,b){return(a.letter||'_').localeCompare(b.letter||'_');});
    if(!avail.length){grid.innerHTML='<div style="color:#8880a8;font-size:32px">No plain tiles to enchant!</div>';return;}
    avail.forEach(function(tl){
      var s=document.createElement('div');s.className='h-tile';s.style.cursor='pointer';
      s.innerHTML='<span class="tl">'+(tl.isBlank?'?':tl.letter)+'</span><span class="ts">'+(tl.isBlank?0:(LS[tl.letter]||0))+'</span>';
      s.onclick=function(){forgeSelectedTile=tl;renderForgeModal();};grid.appendChild(s);
    });
  }
}

function closeForgeStep(){if(forgeSelectedTile){forgeSelectedTile=null;renderForgeModal();}else document.getElementById('forge-modal').style.display='none';}

function forgeUpgrade(tileId,variant,cost){
  if(!S.devMode&&S.gold<cost){toast('Not enough gold!');return;}
  var found=false;
  for(var i=0;i<S.bag.length;i++){if(S.bag[i].id===tileId&&!S.bag[i].variant){S.bag[i].variant=variant;if(variant==='blue')S.bag[i].blueBonus=0;found=true;break;}}
  if(!found){toast('Tile not found.');return;}
  if(!S.devMode)S.gold-=cost;renderShop();renderHUD();
  var n={gold:'Gold',blue:'Blue',red:'Red'};toast(n[variant]+' tile forged!');
}

function buySq(i){
  var item=shopPool.sq[i];var d=sqd(item.id);if(!item||item.sold||!d)return;
  if(!S.devMode&&S.gold<d.cost){toast('Not enough gold!');return;}
  if(!S.devMode)S.gold-=d.cost;item.sold=true;
  var qty=d.qty||1;
  for(var k=0;k<qty;k++)S.pendingSquares.push({id:item.id});
  renderShop();renderHUD();
  toast((qty>1?qty+'× ':'')+d.name+' queued — place '+(qty>1?'them':'it')+' after leaving shop!');
}

function openPackReveal(name,contents){
  document.getElementById('pack-title').textContent=name;
  document.getElementById('shop-screen').style.display='none';
  var grid=document.getElementById('pack-reveal');grid.innerHTML='';
  for(var i=0;i<contents.length;i++){
    var d=sqd(contents[i]);if(!d)continue;
    var rc=d.rarity==='legendary'?'rl':d.rarity==='rare'?'rr':d.rarity==='uncommon'?'ru':'rc';
    var qty=d.qty||1;
    var card=document.createElement('div');card.className='prc';
    var qtyLine=qty>1?'<div style="font-size:30px;color:#f0e080;font-weight:normal;margin-bottom:2px">'+qty+'× bundle</div>':'';
    card.innerHTML='<div style="font-size:20px;font-weight:normal;color:'+d.fg+'">'+sqIconHTML(d,28)+'</div><div style="font-size:32px;font-weight:normal;color:'+d.fg+'">'+d.name+'</div>'+qtyLine+'<div style="font-size:30px;color:#9090b0;margin:4px 0">'+d.desc+'</div><div class="scr '+rc+'" style="margin-top:4px">'+d.rarity+'</div>';
    (function(did,c){c.onclick=function(){var dq=sqd(did);var qty=(dq&&dq.qty)||1;for(var k=0;k<qty;k++)S.pendingSquares.push({id:did});c.classList.add('chosen');c.textContent=qty>1?qty+'× Queued!':'Queued!';var cs=grid.getElementsByClassName('prc');for(var k=0;k<cs.length;k++){cs[k].style.pointerEvents='none';cs[k].style.opacity='0.4';}c.style.opacity='1';setTimeout(function(){document.getElementById('pack-modal').style.display='none';enterShopPhase();},600);};})(contents[i],card);
    grid.appendChild(card);
  }
  document.getElementById('pack-modal').style.display='flex';
}

function skipPack(){document.getElementById('pack-modal').style.display='none';enterShopPhase();}

function hammerTile(tile){
  if(!S.devMode&&S.gold<3){toast('Not enough gold!');return;}
  var idx=-1;for(var i=0;i<S.bag.length;i++)if(S.bag[i].id===tile.id){idx=i;break;}
  if(idx<0){toast('Tile not found.');return;}
  if(!S.devMode)S.gold-=3;S.bag.splice(idx,1);
  renderShop();renderHUD();document.getElementById('bag-count').textContent=S.bag.length;
  toast((tile.isBlank?'Blank':tile.letter)+' destroyed!');
}

function acceptBounty(i){
  var b=shopPool.bounties[i];if(!b||b.accepted)return;
  if(!S.devMode&&S.gold<b.cost){toast('Not enough gold!');return;}
  if(!S.devMode)S.gold-=b.cost;
  b.accepted=true;
  S.bounties=S.bounties||[];S.bounties.push({word:b.word,reward:b.reward,variant:b.variant||null});
  renderShop();renderHUD();
  toast('Bounty accepted! Play "'+b.word+'" to earn $'+b.reward+'!');
}

function closeShop(){document.getElementById('shop-screen').style.display='none';S.phase='play';}
