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
  {type:'sq',sqId:'dw',label:'2× Double Word',desc:'2 DW squares — word scores ×2.',cost:3},
  {type:'sq',sqId:'tw',label:'1× Triple Word',desc:'1 TW square — word scores ×3.',cost:3},
];

function refreshShop(){
  shopPool.sq=[];
  var _boardSqIds=SQ.map(function(d){return d.id;});
  var sqIds=wrandN(_boardSqIds,{common:5,uncommon:2,rare:0.8,legendary:0.1},3);
  for(var i=0;i<sqIds.length;i++)shopPool.sq.push({id:sqIds[i],sold:false});
  var shuffledPacks=shuffle(ALL_PACK_TYPES.slice());
  shopPool.packs=shuffledPacks.slice(0,2).map(function(p){return{type:p.type,sqId:p.sqId||null,label:p.label,desc:p.desc,cost:p.cost,sold:false};});
  var _bActiveWords=(S.bounties||[]).map(function(b){return b.word;});
  shopPool.bounties=_generateBounties(3,_bActiveWords).map(function(b){
    return{word:b.word,cost:2,reward:b.reward,accepted:false};
  });
  shopPool.slotSpinCost=5;
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
  var bu=document.getElementById('shop-bag-overlay');if(bu){bu.style.display='none';delete bu.dataset.closing;}
  document.getElementById('shop-screen').style.display='flex';
  renderShop();
  renderTileStickerBar();
  initShopUI();
}

function leaveShop(){
  _shopTipHideImmediate();
  _stopSignAnim();
  _stopReels();
  achvCheck('shop_exit');
  saveGame();
  S.phase='play';
  animShopToBoard(function(){
    if((S.stickerInventory||[]).length>0)enterPlacingPhase();
    else _burstHandTiles();
  });
}

function enterPlacingPhase(){
  S.phase='placing';
  S.sqHand=(S.stickerInventory||[]).map(function(p){return{id:p.id,placed:false};});
  S.stickerInventory=[];S.sqStaged={};
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
  var unplacedSqs=S.sqHand.filter(function(sq){return !sq.placed;});
  if(!S.stickerInventory)S.stickerInventory=[];
  for(var _ui=0;_ui<unplacedSqs.length;_ui++)S.stickerInventory.push({id:unplacedSqs[_ui].id});
  var fromPlay=!!S._devPlacingFromPlay;
  S.sqHand=[];S.sqStaged={};S.phase='play';S._devPlacingFromPlay=false;
  document.getElementById('play-controls').style.display='flex';
  document.getElementById('placing-controls').style.display='none';
  document.getElementById('dev-cancel-placing-btn').style.display='none';
  document.getElementById('shuffle-btn').style.display='';
  HP.x=[];HP.vx=[];HP.tiles=[];
  renderHand();renderBoard();renderHUD();renderTileStickerBar();
  if(unplacedSqs.length>0)toast(unplacedSqs.length+' unplaced sticker'+(unplacedSqs.length>1?'s':'')+' returned to inventory.');
  if(!fromPlay)_burstHandTiles();
}

function enterPlacingFromDev(){
  if(!S.devMode||!S.stickerInventory.length){toast('No stickers in inventory.');return;}
  S._devPlacingFromPlay=true;
  var dp=document.getElementById('dev-palette');if(dp)dp.style.display='none';
  if(typeof _updateDevTabs==='function')_updateDevTabs();
  enterPlacingPhase();
  document.getElementById('dev-cancel-placing-btn').style.display='';
}

function cancelDevPlacing(){
  var unplaced=S.sqHand.filter(function(sq){return!sq.placed;});
  if(!S.stickerInventory)S.stickerInventory=[];
  for(var _ci=0;_ci<unplaced.length;_ci++)S.stickerInventory.push({id:unplaced[_ci].id});
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
  var n=(S.stickerInventory||[]).length;
  var qbar=document.getElementById('shop-queue-bar');
  if(qbar){qbar.style.display=n>0?'block':'none';qbar.textContent=n+' sticker'+(n!==1?'s':'')+' in inventory — place during play.';}
  var priceEl=document.getElementById('shop-slot-price');
  if(priceEl)priceEl.textContent='$'+(shopPool.slotSpinCost||4);
  var sqItems=shopPool.sq||[];
  for(var pi=0;pi<2;pi++){
    var box=document.getElementById('shop-pack-'+pi);if(!box)continue;
    var item=sqItems[pi];
    if(!item){box.innerHTML='';box.className='shop-pack-box';box.onclick=null;box.onmouseenter=null;box.onmouseleave=null;continue;}
    var d=sqd(item.id);if(!d){box.innerHTML='';box.onmouseenter=null;box.onmouseleave=null;continue;}
    var iconHtml=d.iconPng
      ?'<img src="'+d.iconPng+'">'
      :'<span>'+d.icon+'</span>';
    box.innerHTML='<div class="shop-pack-icon">'+iconHtml+'</div><div class="shop-pack-cost" style="color:'+d.fg+'">'+'$'+d.cost+'</div>';
    box.className='shop-pack-box'+(item.sold?' sold':'');
    (function(sid,el){el.onmouseenter=function(){_shopTipShow(sid,el);};el.onmouseleave=function(){_shopTipHide();};})(item.id,box);
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
  _initSlotButtons();
  _initSlotTray();
  // STICKER REEL REMOVED — add back _initStickerReel() here when ready
}

// ── STICKER REEL (removed, pending design) ────────────────────────────────
// To restore:
//   1. index.html CSS: add back —
//        #shop-sticker-reel{position:absolute;left:1.5625%;bottom:0.5%;width:130%;image-rendering:pixelated;z-index:3;pointer-events:none}
//   2. index.html HTML: add back inside #shop-canvas —
//        <img id="shop-sticker-reel" src="Assets/animations/slot-reel/sticker_reel1.png">
//   3. Call _initStickerReel() inside initShopUI() above.
//   4. Paste back _initStickerReel() — the function is in git history (commit 3d544dd).
// ─────────────────────────────────────────────────────────────────────────

function _initSignAnim(){
  _stopSignAnim();
}

function _stopSignAnim(){
  if(window._shopSignTimer){clearInterval(window._shopSignTimer);window._shopSignTimer=null;}
  var bg=document.getElementById('shop-bg');
  if(bg)bg.src='Assets/sprites/shop_ui.png';
}

function _initSlotButtons(){
  var el=document.getElementById('shop-slot-buttons');if(!el)return;
  var fresh=el.cloneNode(true);el.parentNode.replaceChild(fresh,el);
  fresh.style.pointerEvents='auto';

  // Native image width = 144px.
  // Only the highlighted frames (even within each group) are used.
  var BTNS=[
    {name:'grey',  x0:13,  x1:34,  ticks:[2,4,6]},
    {name:'yellow',x0:61,  x1:82,  ticks:[8,10,12]},
    {name:'pink',  x0:109, x1:130, ticks:[13,15,17]}
  ];
  var TICK_DOWN_MS=160; // deliberate, weighted press
  var TICK_UP_MS=110;   // snappier release — energy goes into the reel
  var NATIVE_W=144;
  var hovered=null,pressed=null,animTimer=null,hoverTimer=null;
  var pendingRelease=null; // {btn,wasPressed} queued while down anim still plays

  function getBtn(e){
    var r=fresh.getBoundingClientRect();
    var nx=(e.clientX-r.left)/r.width*NATIVE_W;
    for(var i=0;i<BTNS.length;i++){if(nx>=BTNS[i].x0&&nx<=BTNS[i].x1)return BTNS[i];}
    return null;
  }

  function setFrame(f){fresh.src='Assets/animations/slot-buttons/Slot_buttons'+f+'.png';}

  function cancelAnim(){if(animTimer){clearTimeout(animTimer);animTimer=null;}}

  // onFirst fires synchronously on the very first frame
  function playFrames(frames,ms,onDone,onFirst){
    var i=0;
    function step(){
      setFrame(frames[i]);
      if(i===0&&onFirst)onFirst();
      i++;
      if(i<frames.length)animTimer=setTimeout(step,ms);
      else{animTimer=null;if(onDone)onDone();}
    }
    step();
  }

  function startUp(wasPressed){
    var up=wasPressed.ticks.slice().reverse();
    playFrames(up,TICK_UP_MS,function(){update();});
  }

  function update(){
    setFrame(hovered?hovered.ticks[0]:1);
    fresh.style.cursor=(hovered||pressed)?'pointer':'default';
  }

  fresh.addEventListener('pointermove',function(e){
    if(hoverTimer){clearTimeout(hoverTimer);hoverTimer=null;}
    hovered=getBtn(e);
    if(!pressed)update();
    fresh.style.cursor=(hovered||pressed)?'pointer':'default';
  });

  fresh.addEventListener('pointerleave',function(){
    if(hoverTimer)clearTimeout(hoverTimer);
    hoverTimer=setTimeout(function(){
      hoverTimer=null;
      hovered=null;
      if(!pressed)update();
    },250);
  });

  fresh.addEventListener('pointerdown',function(e){
    var btn=getBtn(e);
    if(!btn)return;
    // Allow hover during spin but block actual presses
    if(_reels&&_reels.some(function(r){return r&&r.state!=='idle'&&r.state!=='flick';}))return;
    cancelAnim();
    pendingRelease=null;
    pressed=btn;
    fresh.setPointerCapture(e.pointerId);
    e.preventDefault();
    // Reel starts accelerating immediately on press
    var reelType={grey:'common',yellow:'default',pink:'rare'};
    _flickReels(reelType[btn.name]);
    playFrames(btn.ticks,TICK_DOWN_MS,function(){
      if(pendingRelease){
        var pr=pendingRelease;pendingRelease=null;
        startUp(pr.wasPressed);
      }
    });
  });

  fresh.addEventListener('pointerup',function(e){
    if(!pressed)return;
    var wasPressed=pressed;
    pressed=null;
    hovered=getBtn(e);
    // Reel starts decelerating the moment the button is released
    _releaseFlick();
    if(animTimer){
      pendingRelease={wasPressed:wasPressed};
    } else {
      startUp(wasPressed);
    }
  });

  fresh.addEventListener('pointercancel',function(){
    cancelAnim();
    pendingRelease=null;
    _releaseFlick();
    if(hoverTimer){clearTimeout(hoverTimer);hoverTimer=null;}
    pressed=null;hovered=null;update();
  });
}

function _initSlotTray(){
  var el=document.getElementById('shop-slot-tray');if(!el)return;
  var fresh=el.cloneNode(true);el.parentNode.replaceChild(fresh,el);
  fresh.src='Assets/animations/slot-tray/slot_tray1.png';
  if(_trayAnimTimer){clearTimeout(_trayAnimTimer);_trayAnimTimer=null;}
  _trayIsOpen=false;
}


function _initSlotHandle(){
  var hit=document.getElementById('shop-handle-hit');
  var img=document.getElementById('shop-handle-img');
  if(!hit||!img)return;
  var fresh=hit.cloneNode(true);hit.parentNode.replaceChild(fresh,hit);hit=fresh;

  var dragging=false,startY=0;
  function canvasH(){var c=document.getElementById('shop-canvas');return c?c.getBoundingClientRect().height:400;}
  function frameFromDy(dy){return Math.min(7,Math.max(0,Math.round(dy/(canvasH()*0.208)*7)));}
  function setFrame(f,hl){img.src='Assets/animations/slot-handle/slot-handle-'+(hl?'hl-':'')+'frame'+f+'.png';}

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
  function tick(){timer=null;frame=Math.max(0,Math.min(MAX,frame+dir));spr.src='Assets/animations/bag/bag-hl-frame'+frame+'.png';
    if(dir===1&&frame<MAX)timer=setTimeout(tick,MS);
    else if(dir===-1&&frame>0)timer=setTimeout(tick,MS);
    else if(dir===-1&&frame===0)spr.src='Assets/animations/bag/bag-frame0.png';}
  btn.addEventListener('mouseenter',function(){if(timer){clearTimeout(timer);timer=null;}dir=1;spr.src='Assets/animations/bag/bag-hl-frame'+frame+'.png';if(frame<MAX)timer=setTimeout(tick,MS);});
  btn.addEventListener('mouseleave',function(){if(timer){clearTimeout(timer);timer=null;}dir=-1;if(frame>0)timer=setTimeout(tick,MS);else spr.src='Assets/animations/bag/bag-frame0.png';});
}

// ── REEL SYSTEM ──
// Two-strip architecture: cosmetic strip (Math.random, idle only) + result strip (_rng seeded at shop open).
// On spin, the result strip is spliced in at equivalent scroll position. Decel stops between stickers,
// then an elastic snap settles on the predetermined result.
var _reels=null,_reelAF=null,_reelLastTime=0,_reelResultShown=false;
var _trayAnimTimer=null,_trayIsOpen=false,_pillowEls=[];
var _flickColorTimer=null;
var REEL_IDLE_SPEED=30,REEL_FAST_SPEED=8000,REEL_ACCEL_MS=1000;
// Slot_reel.png is a 40×112 native sprite: a repeating unit of a 4px border + 32px square
// window (40 wide × 36 tall per unit). One reel-item == one unit, so adjacent items' borders
// butt together into a seamless tiled reel strip. These ratios derive the on-screen window size
// (and the matching sticker icon size elsewhere) purely from a reel's own rendered width.
var REEL_UNIT_W=40,REEL_UNIT_H=36,REEL_WINDOW=32;
// Single hyperbolic decel: v(t)=v₀·t₀/(t+t₀) — steep initial drop, long crawl tail (shape like 1/x).
// Snaps to nearest sticker when v < REEL_SNAP_THRESH * itemH px/s.
var REEL_DECEL_T0=0.015,REEL_SNAP_THRESH=0.33,REEL_EJECT_SPEED=180;
var REEL_FLICK_PEAK=4000,REEL_FLICK_ACCEL_MS=1000;
var REEL_FLICK_DECEL_TAU=2.0; // exponential time constant (seconds): reel stays near peak for ~1.4s, full tail ~11s

function _buildReelStrip(items,itemH,numCopies){
  numCopies=numCopies||3;
  var N=items.length;
  var strip=document.createElement('div');
  strip.className='reel-strip';
  strip.style.height=(numCopies*N*itemH)+'px';
  for(var pass=0;pass<numCopies;pass++){
    for(var ii=0;ii<N;ii++){
      var d=sqd(items[ii]);if(!d)continue;
      var item=document.createElement('div');
      item.className='reel-item';
      item.style.height=itemH+'px';
      item.dataset.sqid=items[ii];
      var iconHtml=d.iconPng?'<img src="'+d.iconPng+'" alt="">':d.icon;
      item.innerHTML='<div class="reel-icon">'+iconHtml+'</div>';
      strip.appendChild(item);
    }
  }
  return strip;
}

// Pixel size (in rendered CSS px) of one slot-reel window's sticker icon, derived from a live
// reel's rendered width. Used to make the shop pack-box icons match the reel icons exactly.
function _reelIconSizePx(){
  var el=document.getElementById('shop-reel-1');
  if(!el)return 68;
  var w=el.getBoundingClientRect().width;
  if(!w)return 68;
  return w*(REEL_WINDOW/REEL_UNIT_W);
}

function _initReels(){
  _stopReels();
  _reelResultShown=false;
  for(var _ri=0;_ri<3;_ri++){var _rel=document.getElementById('shop-reel-'+(_ri+1));if(_rel)_rel.classList.remove('reel-common','reel-rare');}
  var allIds=SQ.map(function(d){return d.id;});
  function cosmShuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
  function seedShuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(_rng()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
  _reels=[];
  for(var ri=0;ri<3;ri++){
    var el=document.getElementById('shop-reel-'+(ri+1));
    if(!el){_reels.push(null);continue;}
    el.innerHTML='';
    var rect=el.getBoundingClientRect();
    var itemH=(rect.width||40)*(REEL_UNIT_H/REEL_UNIT_W);
    // The painted window in the shop art is taller than one reel unit; center the landed
    // item within that extra height instead of leaving it flush against the top edge.
    var centerPad=Math.max(0,(rect.height-itemH)/2);
    var cosmItems=cosmShuffle(allIds);
    var resItems=seedShuffle(allIds);
    var N=cosmItems.length;
    var loopLen=N*itemH;
    var vThreshEst=REEL_SNAP_THRESH*itemH;
    var totalDistEst=REEL_FAST_SPEED*REEL_FLICK_DECEL_TAU*(1-vThreshEst/REEL_FAST_SPEED);
    var numCopies=Math.max(3,Math.ceil((loopLen+totalDistEst)/loopLen)+1);
    var cosStrip=_buildReelStrip(cosmItems,itemH,numCopies);
    var resStrip=_buildReelStrip(resItems,itemH,numCopies);
    resStrip.style.display='none';
    el.appendChild(cosStrip);
    el.appendChild(resStrip);
    var startOff=Math.random()*(N*itemH);
    cosStrip.style.transform='translateY('+(centerPad-startOff)+'px)';
    _reels.push({el:el,cosStrip:cosStrip,resStrip:resStrip,
      cosmItems:cosmItems,resItems:resItems,itemH:itemH,N:N,numCopies:numCopies,centerPad:centerPad,
      offset:startOff,state:'idle',accelT0:0,
      resultId:null,resultIdx:-1,snapTarget:0,
      stopT0:0,stopFrom:0,
      snapFrom:0,snapT0:0,snapPopped:false,useResultStrip:false,
      flickT0:0,flickStartSpeed:REEL_IDLE_SPEED,flickHeld:false,flickDecelT0:0,
      accelStartSpeed:REEL_IDLE_SPEED});
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
    if(!r||r.state==='stopped')continue;
    var strip=r.useResultStrip?r.resStrip:r.cosStrip;
    var loopLen=r.N*r.itemH;
    if(r.state==='idle'){
      r.offset+=REEL_IDLE_SPEED*dt;
      if(r.offset>=loopLen)r.offset-=loopLen;
      strip.style.transform='translateY('+(r.centerPad-r.offset)+'px)';
    } else if(r.state==='accelerating'){
      // Logarithmic accel — same shape as flick, steep pickup tapering to peak
      var accelTau=Math.min((ts-r.accelT0)/REEL_ACCEL_MS,1.0);
      var speed=r.accelStartSpeed+(REEL_FAST_SPEED-r.accelStartSpeed)*Math.log(1+accelTau*(Math.E-1));
      r.offset+=speed*dt;
      strip.style.transform='translateY('+(r.centerPad-(r.offset%loopLen))+'px)';
      if(accelTau>=1.0)r.state='spinning';
    } else if(r.state==='spinning'){
      r.offset+=REEL_FAST_SPEED*dt;
      // modulo for rendering so strip never scrolls out of its 3-copy bounds
      strip.style.transform='translateY('+(r.centerPad-(r.offset%loopLen))+'px)';
    } else if(r.state==='decel'){
      // Exponential: v(t)=v₀·exp(-t/τ) — same formula as flick decel; pos(t)=v₀·τ·(1-exp(-t/τ))
      var elapsed=(ts-r.stopT0)/1000;
      var vNow=REEL_FAST_SPEED*Math.exp(-elapsed/REEL_FLICK_DECEL_TAU);
      r.offset=r.stopFrom+REEL_FAST_SPEED*REEL_FLICK_DECEL_TAU*(1-Math.exp(-elapsed/REEL_FLICK_DECEL_TAU));
      strip.style.transform='translateY('+(r.centerPad-r.offset)+'px)';
      if(vNow<=REEL_SNAP_THRESH*r.itemH){r.snapFrom=r.offset;r.snapT0=ts;r.state='snap';}
    } else if(r.state==='snap'){
      // Underdamped spring: ζ=0.4, ωn=30 — one elastic bounce before settling
      var elapsed=(ts-r.snapT0)/1000;
      var d0=r.snapFrom-r.snapTarget;
      var v0snap=REEL_SNAP_THRESH*r.itemH;
      var zeta=0.4,wn=30,wd=wn*Math.sqrt(1-zeta*zeta);
      var B=(v0snap+zeta*wn*d0)/wd;
      r.offset=r.snapTarget+Math.exp(-zeta*wn*elapsed)*(d0*Math.cos(wd*elapsed)+B*Math.sin(wd*elapsed));
      strip.style.transform='translateY('+(r.centerPad-r.offset)+'px)';
      if(!r.snapPopped&&elapsed>=0.08){r.snapPopped=true;_reelPop(ri);}
      if(elapsed>0.5){r.offset=r.snapTarget;r.state='stopped';strip.style.transform='translateY('+(r.centerPad-r.offset)+'px)';}
    } else if(r.state==='eject'){
      // All reels scroll downward in sync (offset decreasing = strip moves down)
      r.offset-=REEL_EJECT_SPEED*dt;
      strip.style.transform='translateY('+(r.centerPad-r.offset)+'px)';
    } else if(r.state==='flick'){
      var felapsed=ts-r.flickT0;
      var speed;
      if(felapsed<REEL_FLICK_ACCEL_MS){
        // Logarithmic acceleration from current speed up to peak
        var fa=felapsed/REEL_FLICK_ACCEL_MS;
        speed=r.flickStartSpeed+(REEL_FLICK_PEAK-r.flickStartSpeed)*Math.log(1+fa*(Math.E-1));
      } else if(r.flickHeld){
        // Button held — cruise at peak until released
        speed=REEL_FLICK_PEAK;
      } else {
        // Decel — flickDecelT0 is set at release; if released during accel, set it now at first decel frame
        if(!r.flickDecelT0)r.flickDecelT0=ts;
        var fd_s=(ts-r.flickDecelT0)/1000;
        var excess=(REEL_FLICK_PEAK-REEL_IDLE_SPEED)*Math.exp(-fd_s/REEL_FLICK_DECEL_TAU);
        if(excess<=20){r.state='idle';speed=REEL_IDLE_SPEED;}
        else{speed=REEL_IDLE_SPEED+excess;}
      }
      r.offset+=speed*dt;
      if(r.offset>=loopLen)r.offset-=loopLen;
      strip.style.transform='translateY('+(r.centerPad-r.offset)+'px)';
    }
    // Reel tick: fire on each item boundary crossing during motion (throttled to 20/s)
    if(r.state==='accelerating'||r.state==='spinning'||r.state==='decel'||r.state==='flick'){
      var _cf=Math.floor(r.offset/r.itemH);
      if(r._tickFloor===undefined)r._tickFloor=_cf;
      if(_cf!==r._tickFloor){
        r._tickFloor=_cf;
        var _now2=performance.now();
        if(!r._lastTickMs||_now2-r._lastTickMs>=50){r._lastTickMs=_now2;_playReelTick();}
      }
    }
  }
  var allStopped=_reels.every(function(r){return!r||r.state==='stopped';});
  if(allStopped&&!_reelResultShown&&shopPool.slotResult){_reelResultShown=true;_onReelStopped();}
  _reelAF=requestAnimationFrame(_reelLoop);
}

function _stopReelAt(ri,resultId){
  if(!_reels||!_reels[ri])return;
  var r=_reels[ri];
  if(r.state!=='spinning')return;
  r.resultId=resultId;
  var loopLen=r.N*r.itemH;
  r.offset=r.offset%loopLen;
  var vThresh=REEL_SNAP_THRESH*r.itemH;
  // Analytic: pos where v(t)=v₀·exp(-t/τ) hits vThresh = v₀·τ·(1-vThresh/v₀)
  var decelDist=REEL_FAST_SPEED*REEL_FLICK_DECEL_TAU*(1-vThresh/REEL_FAST_SPEED);
  var endPos=r.offset+decelDist;
  // Nearest sticker slot to snap target
  var snapAbsIdx=Math.round(endPos/r.itemH);
  var snapInLoop=((snapAbsIdx%r.N)+r.N)%r.N;
  r.snapTarget=snapAbsIdx*r.itemH; // snap ≤ itemH/2 from endPos
  // Swap result sticker into the snapInLoop slot while reel is fast (invisible swap)
  var curResultIdx=r.resItems.indexOf(resultId);
  if(curResultIdx<0)curResultIdx=0;
  if(curResultIdx!==snapInLoop){
    var displaced=r.resItems[snapInLoop];
    r.resItems[snapInLoop]=resultId;
    r.resItems[curResultIdx]=displaced;
    var allItems=r.resStrip.querySelectorAll('.reel-item');
    for(var copy=0;copy<r.numCopies;copy++){
      var elA=allItems[copy*r.N+snapInLoop];
      var elB=allItems[copy*r.N+curResultIdx];
      if(elA&&elB){var tmp=elA.innerHTML;elA.innerHTML=elB.innerHTML;elB.innerHTML=tmp;var tmpSqid=elA.dataset.sqid;elA.dataset.sqid=elB.dataset.sqid;elB.dataset.sqid=tmpSqid;}
    }
  }
  r.resultIdx=snapInLoop;
  r.stopFrom=r.offset;
  r.stopT0=performance.now();
  r.state='decel';
}

function _reelPop(ri){
  var r=_reels[ri];if(!r||r.resultIdx<0)return;
  _playScoreDing(ri*3);
  var loopLen=r.N*r.itemH;
  var passNum=Math.floor(r.snapTarget/loopLen);
  var allItems=r.resStrip.querySelectorAll('.reel-item');
  var visItem=allItems[passNum*r.N+r.resultIdx];
  if(visItem){
    visItem.classList.remove('reel-pop-anim');
    void visItem.offsetWidth;
    visItem.classList.add('reel-pop-anim');
    visItem.addEventListener('animationend',function(){visItem.classList.remove('reel-pop-anim');},{once:true});
  }
}

function _onReelStopped(){
  if(!_reels)return;
  _animateSlotResult();
}

// Pillow centers in canvas native pixels (canvas=256×160, tray is 1:1 pixel mapping).
// Tray top = 62.5%×160 = 100. Pillow y-center at tray y=14.5 → canvas y=114.5.
var _PILLOWS=[{cx:37.5,cy:114.5},{cx:85,cy:114.5},{cx:133,cy:114.5}];

function _animateSlotResult(){
  var canvas=document.getElementById('shop-canvas');
  var reelLayer=document.getElementById('shop-reel-layer');
  if(!canvas||!reelLayer||!_reels)return;

  // Gather won sticker elements and their reel containers
  var wins=[];
  for(var ri=0;ri<_reels.length;ri++){
    var r=_reels[ri];
    if(!r||!r.resultId)continue;
    var idx=r.resultIdx>=0?r.resultIdx:r.resItems.indexOf(r.resultId);
    if(idx<0)continue;
    var passNum=Math.floor(r.snapTarget/(r.N*r.itemH));
    var allItems=r.resStrip.querySelectorAll('.reel-item');
    var visItem=allItems[passNum*r.N+idx];
    if(visItem)wins.push({id:r.resultId,el:visItem,reelEl:r.el});
  }
  if(!wins.length)return;

  // Pause: pop animation has just played — let the result sit for a moment
  setTimeout(function(){
    var cr=canvas.getBoundingClientRect();

    // Create icon copies inside reel-shaped clippers so they stay visible while
    // the reel layer fades, and so overflow:hidden clips the downward roll naturally
    var copies=wins.map(function(w){
      var rr=w.reelEl.getBoundingClientRect();
      var iconEl=w.el.querySelector('.reel-icon');
      var ir=iconEl?iconEl.getBoundingClientRect():rr;

      var clipper=document.createElement('div');
      clipper.style.cssText='position:absolute;left:'+((rr.left-cr.left)/cr.width*100)+'%;top:'+((rr.top-cr.top)/cr.height*100)+'%;width:'+(rr.width/cr.width*100)+'%;height:'+(rr.height/cr.height*100)+'%;overflow:hidden;z-index:13;pointer-events:none;';

      var icon=document.createElement('div');
      icon.className='reel-icon';
      icon.innerHTML=iconEl?iconEl.innerHTML:'';
      // Override reel-icon's fixed position to match the actual centered position in this reel
      var topPct=(ir.top-rr.top)/rr.height*100;
      var hPct=ir.height/rr.height*100;
      icon.style.cssText='top:'+topPct+'%;height:'+hPct+'%;will-change:top;';
      clipper.appendChild(icon);
      canvas.appendChild(clipper);
      return{clipper:clipper,icon:icon,id:w.id};
    });

    // Phase 1: Fade reel layer — borders, frame, other stickers above/below
    // Won sticker icons remain visible via the canvas-level clipper copies
    reelLayer.style.transition='opacity 0.5s ease';
    reelLayer.style.opacity='0';

    // Phase 2: After fade, roll won icons down within their clippers
    setTimeout(function(){
      copies.forEach(function(c){
        c.icon.style.transition='top 0.52s cubic-bezier(0.55,0,1,1)';
        c.icon.style.top='110%';
      });

      // Phase 3: Clean up clippers, open tray
      setTimeout(function(){
        copies.forEach(function(c){if(c.clipper&&c.clipper.parentNode)c.clipper.parentNode.removeChild(c.clipper);});
        _openSlotTray(function(){
          _showPillowStickers(wins.map(function(w){return w.id;}),canvas);
        });
      },560);
    },500);
  },350);
}

function _openSlotTray(onDone){
  var el=document.getElementById('shop-slot-tray');if(!el){if(onDone)onDone();return;}
  if(_trayAnimTimer){clearTimeout(_trayAnimTimer);_trayAnimTimer=null;}
  _trayIsOpen=true;
  var frames=[1,2,3,4,5,6,7,8,9];
  // Spring timing: fast burst, slow settle
  var delays=[50,55,62,72,84,98,114,132];
  var fi=0;
  function step(){
    el.src='Assets/animations/slot-tray/slot_tray'+frames[fi]+'.png';
    fi++;
    if(fi<frames.length){_trayAnimTimer=setTimeout(step,delays[fi-1]);}
    else{_trayAnimTimer=null;if(onDone)onDone();}
  }
  step();
}

function _closeSlotTray(onDone){
  var el=document.getElementById('shop-slot-tray');if(!el){if(onDone)onDone();return;}
  if(_trayAnimTimer){clearTimeout(_trayAnimTimer);_trayAnimTimer=null;}
  _trayIsOpen=false;
  var frames=[9,8,7,6,5,4,3,2,1];
  var fi=0;
  function step(){
    el.src='Assets/animations/slot-tray/slot_tray'+frames[fi]+'.png';
    fi++;
    if(fi<frames.length){_trayAnimTimer=setTimeout(step,62);}
    else{_trayAnimTimer=null;if(onDone)onDone();}
  }
  step();
}

function _showPillowStickers(ids,canvas){
  _pillowEls=[];

  // Invisible dismiss zone over the tray body (y=28-47 in tray image → canvas y=80%+)
  var dismissEl=document.createElement('div');
  dismissEl.style.cssText='position:absolute;left:0;top:80%;width:67.1875%;height:12.5%;z-index:14;cursor:pointer;';
  dismissEl.onclick=function(){_dismissPillowStickers();};
  canvas.appendChild(dismissEl);
  _pillowEls.push(dismissEl);

  // Sticker icons on each pillow
  ids.forEach(function(id,i){
    if(i>=_PILLOWS.length)return;
    var d=sqd(id);if(!d)return;
    var p=_PILLOWS[i];
    // Icon size in canvas %: pillows are ~35×25 native; fill most of each
    var wPct=12.5, hPct=16.25;
    var leftPct=p.cx/256*100-wPct/2;
    var topPct=p.cy/160*100-hPct/2;
    var el=document.createElement('div');
    el.style.cssText='position:absolute;left:'+leftPct+'%;top:'+topPct+'%;width:'+wPct+'%;height:'+hPct+'%;z-index:15;cursor:pointer;display:flex;align-items:center;justify-content:center;transform:scale(0);transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1);will-change:transform;';
    var iconHtml=d.iconPng
      ?'<img src="'+d.iconPng+'" style="width:100%;height:100%;object-fit:contain;image-rendering:pixelated;display:block">'
      :'<span style="font-size:clamp(8px,2.5vw,40px);line-height:1">'+d.icon+'</span>';
    el.innerHTML=iconHtml;
    el.onclick=(function(sid){return function(){
      _pillowEls.forEach(function(e){if(e&&e.parentNode)e.parentNode.removeChild(e);});
      _pillowEls=[];
      _shopTipHideImmediate();
      _closeSlotTray(function(){_pickReelResult(sid);});
    };})(id);
    el.onmouseenter=(function(sid,e){return function(){_shopTipShow(sid,e);};})(id,el);
    el.onmouseleave=function(){_shopTipHide();};
    canvas.appendChild(el);
    _pillowEls.push(el);
    setTimeout(function(){el.style.transform='scale(1)';},i*100+60);
  });
}

function _dismissPillowStickers(){
  _pillowEls.forEach(function(e){if(e&&e.parentNode)e.parentNode.removeChild(e);});
  _pillowEls=[];
  _closeSlotTray(function(){
    var rl=document.getElementById('shop-reel-layer');
    if(rl){rl.style.transition='none';rl.style.opacity='1';}
    shopPool.slotResult=null;_reelResultShown=false;
    if(_reels){for(var ri=0;ri<_reels.length;ri++){
      var r=_reels[ri];if(!r)continue;
      r.state='idle';r.resultId=null;r.resultIdx=-1;r.useResultStrip=false;
      var ll=r.N*r.itemH;r.offset=((r.offset%ll)+ll)%ll;
      r.resStrip.style.display='none';r.cosStrip.style.display='';
      r.cosStrip.style.transform='translateY('+(r.centerPad-r.offset)+'px)';
    }}
  });
}

function _pickReelResult(id){
  var rl=document.getElementById('shop-reel-layer');
  if(rl){rl.style.transition='none';rl.style.opacity='1';}
  var d=sqd(id);if(!d)return;
  if(!addStickerFromShop(id))return;
  document.querySelectorAll('.reel-item.reel-sel').forEach(function(el){el.classList.remove('reel-sel');el.onclick=null;});
  if(_reels){
    for(var ri=0;ri<_reels.length;ri++){
      var r=_reels[ri];if(!r)continue;
      r.state='idle';r.resultId=null;r.resultIdx=-1;r.useResultStrip=false;
      var loopLen=r.N*r.itemH;
      r.offset=((r.offset%loopLen)+loopLen)%loopLen;
      r.resStrip.style.display='none';
      r.cosStrip.style.display='';
      r.cosStrip.style.transform='translateY('+(r.centerPad-r.offset)+'px)';
    }
    _reelResultShown=false;
  }
  shopPool.slotResult=null;
  renderShop();renderHUD();
  var isTile=d.type==='tile',qty=d.qty||1;
  if(isTile)toast(d.name+' added to sticker bar!');
  else toast((qty>1?qty+'× ':'')+d.name+' queued!');
}

function _stopReels(){
  if(_reelAF){cancelAnimationFrame(_reelAF);_reelAF=null;}
  _reels=null;_reelResultShown=false;
  _pillowEls.forEach(function(e){if(e&&e.parentNode)e.parentNode.removeChild(e);});
  _pillowEls=[];
  if(_trayAnimTimer){clearTimeout(_trayAnimTimer);_trayAnimTimer=null;}
  _trayIsOpen=false;
  var trayEl=document.getElementById('shop-slot-tray');
  if(trayEl)trayEl.src='Assets/animations/slot-tray/slot_tray1.png';
  var rl=document.getElementById('shop-reel-layer');
  if(rl){rl.style.transition='none';rl.style.opacity='1';}
}

// ── SLOT MACHINE ──
// Swap reel sprite variant and fire a brief speed burst on idle reels.
// type: 'common' | 'default' | 'rare'
function _flickReels(type){
  if(!_reels)return;
  // Buttons inactive during wheel spin
  for(var _ri=0;_ri<_reels.length;_ri++){
    var _r=_reels[_ri];
    if(_r&&_r.state!=='idle'&&_r.state!=='flick')return;
  }
  // Cancel any pending color-switch from a previous flick
  if(_flickColorTimer){clearTimeout(_flickColorTimer);_flickColorTimer=null;}
  var now=performance.now();
  var any=false;
  for(var ri=0;ri<3;ri++){
    var r=_reels[ri];
    if(!r)continue;
    // Restart if idle OR already flickering (cancel → re-flick)
    if(r.state!=='idle'&&r.state!=='flick')continue;
    // Snapshot current speed so accel lifts off from here, not from idle
    var curSpeed=REEL_IDLE_SPEED;
    if(r.state==='flick'){
      var _fe=now-r.flickT0;
      if(_fe<REEL_FLICK_ACCEL_MS){
        var _fa=_fe/REEL_FLICK_ACCEL_MS;
        curSpeed=r.flickStartSpeed+(REEL_FLICK_PEAK-r.flickStartSpeed)*Math.log(1+_fa*(Math.E-1));
      } else if(r.flickHeld){
        curSpeed=REEL_FLICK_PEAK;
      } else {
        var _fd_s=r.flickDecelT0?(now-r.flickDecelT0)/1000:0;
        var _exc=(REEL_FLICK_PEAK-REEL_IDLE_SPEED)*Math.exp(-_fd_s/REEL_FLICK_DECEL_TAU);
        curSpeed=REEL_IDLE_SPEED+(_exc>20?_exc:20);
      }
    }
    r.flickStartSpeed=curSpeed;
    r.flickHeld=true;
    r.flickDecelT0=0;
    r.flickT0=now;r.state='flick';any=true;
  }
  if(!any)return;
  // Color switches exactly at peak — the moment acceleration ends and decel begins
  var cls={common:'reel-common',rare:'reel-rare'};
  _flickColorTimer=setTimeout(function(){
    _flickColorTimer=null;
    for(var ri=0;ri<3;ri++){
      var el=document.getElementById('shop-reel-'+(ri+1));
      if(!el)continue;
      el.classList.remove('reel-common','reel-rare');
      if(cls[type])el.classList.add(cls[type]);
    }
  },REEL_FLICK_ACCEL_MS);
}

// Release the hold — decel begins from the moment this is called.
// If still in accel phase, flickDecelT0 stays 0 and the reel loop sets it on the first decel frame.
function _releaseFlick(){
  if(!_reels)return;
  var now=performance.now();
  for(var ri=0;ri<_reels.length;ri++){
    var r=_reels[ri];
    if(!r||r.state!=='flick'||!r.flickHeld)continue;
    r.flickHeld=false;
    // Only stamp decelT0 now if we're past the accel phase; otherwise the loop stamps it at peak
    if(now-r.flickT0>=REEL_FLICK_ACCEL_MS)r.flickDecelT0=now;
  }
}

function spinSlots(){
  if(_trayIsOpen){toast('Close the tray first!');return;}
  if(document.querySelector('.reel-item.reel-sel')){toast('Pick a sticker from the reels first!');return;}
  var cost=shopPool.slotSpinCost||4;
  if(!spendGold(cost))return;
  shopPool.slotSpinsThisVisit=(shopPool.slotSpinsThisVisit||0)+1;
  shopPool.slotSpinCost=5+shopPool.slotSpinsThisVisit*3;
  renderHUD();renderShop();
  var results=wrandN(SQ.map(function(d){return d.id;}),{common:5,uncommon:2,rare:0.8,legendary:0.1},3);
  shopPool.slotResult=results;
  _reelResultShown=false;
  // Cancel any pending flick color switch — spin takes over from here
  if(_flickColorTimer){clearTimeout(_flickColorTimer);_flickColorTimer=null;}
  if(_reels){
    var _now=performance.now();
    for(var ri=0;ri<_reels.length;ri++){
      var r=_reels[ri];if(!r)continue;
      // Snapshot current speed so spin accel lifts off smoothly from a mid-flick reel
      var startSpeed=REEL_IDLE_SPEED;
      if(r.state==='flick'){
        var _fe=_now-r.flickT0;
        if(_fe<REEL_FLICK_ACCEL_MS){
          var _fa=_fe/REEL_FLICK_ACCEL_MS;
          startSpeed=r.flickStartSpeed+(REEL_FLICK_PEAK-r.flickStartSpeed)*Math.log(1+_fa*(Math.E-1));
        } else if(r.flickHeld){
          startSpeed=REEL_FLICK_PEAK;
        } else {
          var _fd_s=r.flickDecelT0?(_now-r.flickDecelT0)/1000:0;
          var _exc=(REEL_FLICK_PEAK-REEL_IDLE_SPEED)*Math.exp(-_fd_s/REEL_FLICK_DECEL_TAU);
          startSpeed=REEL_IDLE_SPEED+(_exc>20?_exc:0);
        }
      }
      // Reset any flick color class — spin uses default reel strip
      var reelEl=document.getElementById('shop-reel-'+(ri+1));
      if(reelEl)reelEl.classList.remove('reel-common','reel-rare');
      // Splice: swap to result strip at the same fractional scroll position
      var loopLen=r.N*r.itemH;
      r.offset=r.offset%loopLen;
      r.cosStrip.style.display='none';
      r.resStrip.style.display='';
      r.resStrip.style.transform='translateY('+(r.centerPad-r.offset)+'px)';
      r.useResultStrip=true;
      r.accelStartSpeed=startSpeed;
      r.accelT0=_now;
      r.flickHeld=false;
      r.state='accelerating';
      r.resultId=null;r.resultIdx=-1;
    }
  }
  // Stagger: 400ms apart. Decel (800ms) + crawl (2000ms) are identical for all reels,
  // so stop times are exactly 400ms apart — guaranteed L→M→R order.
  setTimeout(function(){_stopReelAt(0,results[0]);},1400);
  setTimeout(function(){_stopReelAt(1,results[1]);},1800);
  setTimeout(function(){_stopReelAt(2,results[2]);},2200);
}

// ── SHOP BAG MINI-UI ──
function openShopBagUI(){
  var ovr=document.getElementById('shop-bag-overlay');if(!ovr||ovr.dataset.opening||ovr.dataset.closing)return;
  ovr.dataset.opening='1';
  if(!shopPool.bagDisplay){
    var bagCopy=S.bag.slice();
    for(var i=bagCopy.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var tmp=bagCopy[i];bagCopy[i]=bagCopy[j];bagCopy[j]=tmp;}
    shopPool.bagDisplay=bagCopy.slice(0,8);
  }
  var display=shopPool.bagDisplay;
  var selected={tile:null};
  _bagTransitionOpen('shop-bag-sprite',function(){
    delete ovr.dataset.opening;
    ovr.style.display='flex';
    document.getElementById('sbovr-count').textContent=S.bag.length+' tiles in bag';
    var tilesDiv=document.getElementById('sbovr-tiles');
    var actDiv=document.getElementById('sbovr-actions');
    tilesDiv.innerHTML='';actDiv.innerHTML='';
    tilesDiv.style.animation='none';void tilesDiv.offsetHeight;
    tilesDiv.style.animation='bagTunnelZoom 0.65s ease-out both';
    var sz=60;
    var fc=[
      {a:'bfloat0',d:'2.5s',dl:'0s'},{a:'bfloat1',d:'2.8s',dl:'0.5s'},
      {a:'bfloat2',d:'3.1s',dl:'1.0s'},{a:'bfloat3',d:'2.6s',dl:'0.3s'},
      {a:'bfloat4',d:'3.0s',dl:'0.8s'},{a:'bfloat5',d:'2.7s',dl:'1.4s'}
    ];
    if(!display.length){tilesDiv.innerHTML='<div style="color:#8880a8;font-size:24px">Bag is empty!</div>';}
    display.forEach(function(t,idx){
      var f=fc[idx%fc.length];
      var item=document.createElement('div');
      item.className='sbag-float-item';
      var inner=document.createElement('div');
      inner.style.cssText='display:flex;flex-direction:column;align-items:center;animation:'+f.a+' '+f.d+' ease-in-out '+f.dl+' infinite';
      var spr=tileSpr(t.isBlank?null:t.letter,t.isBlank,t.variant||null,sz);
      var te=document.createElement('div');
      te.className='tile tile-spr'+(t.isBlank?' blank-t':'')+(t.variant?' var-'+t.variant:'');
      te.style.cssText='width:'+sz+'px;height:'+sz+'px;position:relative;flex-shrink:0;'+spr;
      inner.appendChild(te);
      item.appendChild(inner);
      item.onclick=(function(tile,el){
        return function(){
          tilesDiv.querySelectorAll('.sbag-float-item').forEach(function(e){e.classList.remove('sbag-sel');});
          if(selected.tile===tile){selected.tile=null;}
          else{selected.tile=tile;el.classList.add('sbag-sel');}
          _renderBagActions(selected,actDiv);
        };
      })(t,item);
      tilesDiv.appendChild(item);
    });
    actDiv.innerHTML='<div style="color:#8880a8;font-size:24px">Select a tile above</div>';
  });
}

function _renderBagActions(sel,actDiv){
  actDiv.innerHTML='';
  if(!sel.tile){actDiv.innerHTML='<div style="color:#8880a8;font-size:24px">Select a tile above</div>';return;}
  var t=sel.tile;
  function mkBtn(label,used,fn){
    var b=document.createElement('button');
    b.style.cssText='background:'+(used?'#1a1a3a':'#2a4a2a')+';border:1px solid '+(used?'#3a3a5a':'#4a8a4a')+';color:'+(used?'#5a5a8a':'#80c080')+';font-family:\'Jersey 10\',Georgia;font-size:28px;cursor:'+(used?'default':'pointer')+';padding:8px 16px;border-radius:4px';
    b.textContent=label+(used?' (used)':'');if(!used)b.onclick=fn;return b;
  }
  actDiv.appendChild(mkBtn('Enchant $2',shopPool.bagEnchantUsed,function(){_bagEnchantFlow(t,sel,actDiv);}));
  actDiv.appendChild(mkBtn('Destroy $2',shopPool.bagDestroyUsed,function(){
    if(!spendGold(2))return;
    transformTile(t.id,{destroy:true});shopPool.bagDestroyUsed=true;shopPool.bagDisplay=null;
    renderHUD();document.getElementById('bag-count').textContent=S.bag.length;
    toast((t.isBlank?'Blank':t.letter)+' destroyed!');closeShopBagUI();renderShop();
  }));
  actDiv.appendChild(mkBtn('Duplicate $2',shopPool.bagDupUsed,function(){
    if(!spendGold(2))return;
    addTileToBag({letter:t.letter,isBlank:t.isBlank,variant:t.variant});S.bag=shuffle(S.bag);shopPool.bagDupUsed=true;shopPool.bagDisplay=null;
    renderHUD();document.getElementById('bag-count').textContent=S.bag.length;
    toast((t.isBlank?'Blank':t.letter)+' duplicated!');closeShopBagUI();renderShop();
  }));
}

function _bagEnchantFlow(t,sel,actDiv){
  actDiv.innerHTML='';
  var variants=[{v:'gold',label:'Gold',desc:'+$1 when scored',col:'#f0c060'},{v:'blue',label:'Blue',desc:'Score grows each play',col:'#60b8ff'},{v:'red',label:'Red',desc:'Triggers twice',col:'#ff8080'}];
  variants.forEach(function(vt){
    if(t.variant===vt.v)return;
    var b=document.createElement('button');
    b.style.cssText='background:#1a1a3a;border:1px solid '+vt.col+';color:'+vt.col+';font-family:\'Jersey 10\',Georgia;font-size:28px;cursor:pointer;padding:8px 16px;border-radius:4px';
    b.textContent=vt.label+' $2';
    b.onclick=function(){
      if(!spendGold(2))return;
      transformTile(t.id,{variant:vt.v});
      shopPool.bagEnchantUsed=true;shopPool.bagDisplay=null;
      renderHUD();toast(vt.label+' '+t.letter+' enchanted!');closeShopBagUI();renderShop();
    };
    actDiv.appendChild(b);
  });
  var cancel=document.createElement('button');
  cancel.style.cssText='background:#2a2a4a;border:1px solid #5a5a8a;color:#a0a0c0;font-family:\'Jersey 10\',Georgia;font-size:28px;cursor:pointer;padding:8px 16px;border-radius:4px';
  cancel.textContent='Cancel';cancel.onclick=function(){_renderBagActions(sel,actDiv);};
  actDiv.appendChild(cancel);
}

function closeShopBagUI(){
  var ovr=document.getElementById('shop-bag-overlay');if(!ovr||ovr.dataset.closing)return;
  delete ovr.dataset.opening;ovr.dataset.closing='1';
  var bridge=document.createElement('div');
  bridge.style.cssText='position:fixed;inset:0;background:#0f2018;z-index:9990;pointer-events:none;transition:opacity 0.35s ease;';
  document.body.appendChild(bridge);
  ovr.style.display='none';
  _bagTransitionClose('shop-bag-sprite',function(){delete ovr.dataset.closing;});
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    bridge.style.opacity='0';
    setTimeout(function(){if(bridge.parentNode)bridge.parentNode.removeChild(bridge);},350);
  });});
}

function buyTileCard(i){
  var tc=shopPool.tileCards[i];if(!tc||tc.bought)return;
  if(!spendGold(tc.cost))return;
  tc.bought=true;
  addTileToBag({letter:tc.letter,isBlank:false,variant:tc.variant});
  S.bag=shuffle(S.bag);renderShop();renderHUD();document.getElementById('bag-count').textContent=S.bag.length;
  toast(tc.variant.charAt(0).toUpperCase()+tc.variant.slice(1)+' '+tc.letter+' added to bag!');
}

function buyPack(i){
  var pack=(shopPool.packs||[])[i];if(!pack||pack.sold)return;
  if(!spendGold(pack.cost))return;
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
      addTileToBag({letter:l,isBlank:false,variant:v});
      added.push((v?v[0].toUpperCase()+v.slice(1)+' ':'')+l);
    }
    S.bag=shuffle(S.bag);renderShop();renderHUD();document.getElementById('bag-count').textContent=S.bag.length;
    toast('Tile Pack: '+added.join(', ')+' added!');
  } else if(pack.type==='sq'){
    var d=sqd(pack.sqId);var qty=(d&&d.qty)||1;
    for(var k=0;k<qty;k++)S.stickerInventory.push({id:pack.sqId});
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
  var found=false;
  for(var i=0;i<S.bag.length;i++){if(S.bag[i].id===tileId&&!S.bag[i].variant){transformTile(tileId,{variant:variant});found=true;break;}}
  if(!found){toast('Tile not found.');return;}
  if(!spendGold(cost))return;
  renderShop();renderHUD();
  var n={gold:'Gold',blue:'Blue',red:'Red'};toast(n[variant]+' tile forged!');
}

// Routes a freshly acquired sticker into tileStickers or stickerInventory.
// Returns false (with a toast) if the tile sticker bar is full; true otherwise.
function addStickerFromShop(id){
  var d=sqd(id);if(!d)return false;
  if(d.type==='tile'){
    if(!S.tileStickers)S.tileStickers=[];
    if(S.tileStickers.length>=5){toast('Sticker bar is full! (max 5)');return false;}
    S.tileStickers.push({id:id});
    if(d.onAcquire)d.onAcquire();
    if(typeof renderTileStickerBar==='function')renderTileStickerBar();
    return true;
  }
  var qty=d.qty||1;
  for(var k=0;k<qty;k++)S.stickerInventory.push({id:id});
  return true;
}

function buySq(i){
  var item=shopPool.sq[i];var d=sqd(item.id);if(!item||item.sold||!d)return;
  var isTile=d.type==='tile';
  if(isTile&&(S.tileStickers||[]).length>=5){toast('Sticker bar is full! (max 5)');return;}
  if(!spendGold(d.cost))return;
  item.sold=true;
  addStickerFromShop(item.id);
  renderShop();renderHUD();
  if(isTile)toast(d.name+' added to sticker bar!');
  else{var qty=d.qty||1;toast((qty>1?qty+'× ':'')+d.name+' queued — place '+(qty>1?'them':'it')+' after leaving shop!');}
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
    (function(did,c){c.onclick=function(){var dq=sqd(did);if(!dq)return;
      if(!addStickerFromShop(did))return;
      var isTile=dq.type==='tile',qty=dq.qty||1;
      c.classList.add('chosen');c.textContent=isTile?'Added to bar!':(qty>1?qty+'× Queued!':'Queued!');
      var cs=grid.getElementsByClassName('prc');for(var k=0;k<cs.length;k++){cs[k].style.pointerEvents='none';cs[k].style.opacity='0.4';}c.style.opacity='1';setTimeout(function(){document.getElementById('pack-modal').style.display='none';_shopTipHideImmediate();enterShopPhase();},600);};c.onmouseenter=function(){_shopTipShow(did,c);};c.onmouseleave=function(){_shopTipHide();};})(contents[i],card);
    grid.appendChild(card);
  }
  document.getElementById('pack-modal').style.display='flex';
}

function skipPack(){document.getElementById('pack-modal').style.display='none';enterShopPhase();}

function hammerTile(tile){
  var idx=-1;for(var i=0;i<S.bag.length;i++)if(S.bag[i].id===tile.id){idx=i;break;}
  if(idx<0){toast('Tile not found.');return;}
  if(!spendGold(3))return;
  transformTile(tile.id,{destroy:true});
  renderShop();renderHUD();document.getElementById('bag-count').textContent=S.bag.length;
  toast((tile.isBlank?'Blank':tile.letter)+' destroyed!');
}

function acceptBounty(i){
  var b=shopPool.bounties[i];if(!b||b.accepted)return;
  if(!spendGold(b.cost))return;
  b.accepted=true;
  S.bounties=S.bounties||[];S.bounties.push({word:b.word,reward:b.reward});
  renderShop();renderHUD();
  toast('Bounty accepted! Play "'+b.word+'" for +$'+b.reward+' + '+bountyRewardLabel()+'!');
}

function closeShop(){document.getElementById('shop-screen').style.display='none';S.phase='play';}

// ── SHOP STICKER TOOLTIP ──
var _shopTipShowTimer=null,_shopTipHideTimer=null;

function _shopTipShow(id,triggerEl){
  clearTimeout(_shopTipHideTimer);_shopTipHideTimer=null;
  clearTimeout(_shopTipShowTimer);
  _shopTipShowTimer=setTimeout(function(){_shopTipShowTimer=null;_shopTipRender(id,triggerEl);},250);
}

function _shopTipHide(){
  clearTimeout(_shopTipShowTimer);_shopTipShowTimer=null;
  clearTimeout(_shopTipHideTimer);
  _shopTipHideTimer=setTimeout(function(){
    _shopTipHideTimer=null;
    var el=document.getElementById('shop-sticker-tooltip');
    if(el){el.style.opacity='0';el.style.display='none';}
  },250);
}

function _shopTipHideImmediate(){
  clearTimeout(_shopTipShowTimer);_shopTipShowTimer=null;
  clearTimeout(_shopTipHideTimer);_shopTipHideTimer=null;
  var el=document.getElementById('shop-sticker-tooltip');
  if(el){el.style.opacity='0';el.style.display='none';}
}

function _shopTipRender(id,triggerEl){
  var d=sqd(id);if(!d)return;
  var el=document.getElementById('shop-sticker-tooltip');if(!el)return;
  document.getElementById('shoptt-name').textContent=d.name;
  document.getElementById('shoptt-name').style.color=d.fg;
  document.getElementById('shoptt-desc').innerHTML=_sqDescHTML(id,null);
  el.style.display='block';el.style.opacity='0';
  requestAnimationFrame(function(){
    var w=el.offsetWidth,h=el.offsetHeight;
    var tr=triggerEl.getBoundingClientRect();
    var left=(tr.left+tr.right)/2-w/2;
    left=Math.max(8,Math.min(left,window.innerWidth-w-8));
    var top=tr.top-h-8;
    if(top<8)top=tr.bottom+8;
    el.style.left=left+'px';el.style.top=top+'px';
    el.style.opacity='1';
  });
}
