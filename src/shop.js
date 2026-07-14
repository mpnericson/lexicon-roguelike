// =====================================================================
// SHOP — sticker & stamp shop, packs, tile upgrades, forge, hammer
// =====================================================================
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

// ── SYMBOL SLOT MACHINE (DEV-ONLY for now) ───────────────────────────────────
// The grey button arms symbol mode (yellow/pink re-arm the default machine);
// the handle then spins the reels with SYMBOLS instead of sticker/stamp icons.
// One seeded categorical roll (SYMBOL_PAYOUTS, probabilities sum to 100) picks
// the outcome first; the reels are then dressed to match. Placeholder emoji
// icons until real assets exist — swap in iconPng on SLOT_SYMBOLS when ready.
var SLOT_SYMBOLS=[
  {id:'sym_legendary',name:'Legendary',icon:'👑',fg:'#ffd700'},
  {id:'sym_rare',     name:'Rare',     icon:'💎',fg:'#c060ff'},
  {id:'sym_uncommon', name:'Uncommon', icon:'🔷',fg:'#60c060'},
  {id:'sym_common',   name:'Common',   icon:'⚪',fg:'#a0a0a0'},
  {id:'sym_gold',     name:'Gold',     icon:'🪙',fg:'#f0e040'},
  {id:'sym_sticker',  name:'Sticker',  icon:'🏷️',fg:'#80f040'}
];
function _symDef(id){for(var i=0;i<SLOT_SYMBOLS.length;i++)if(SLOT_SYMBOLS[i].id===id)return SLOT_SYMBOLS[i];return null;}

// Payout table. kind: 'stamp_fixed' (exact ids) | 'stamp_pick' (choose 1 of 3)
// | 'stamp_one' (1 random, no choice) | 'sticker_pick' (choose 1 of 3)
// | 'gold' | 'nothing'. n = matching symbols shown on the reels.
var SYMBOL_PAYOUTS=[
  {p:0.5, sym:'sym_legendary',n:3,kind:'stamp_fixed', ids:['the_player']},
  {p:1,   sym:'sym_rare',     n:3,kind:'stamp_pick',  rarity:['rare']},
  {p:3.5, sym:'sym_rare',     n:2,kind:'stamp_one',   rarity:['rare']},
  {p:5,   sym:'sym_uncommon', n:3,kind:'stamp_pick',  rarity:['uncommon']},
  {p:10,  sym:'sym_uncommon', n:2,kind:'stamp_one',   rarity:['uncommon']},
  {p:8,   sym:'sym_common',   n:3,kind:'stamp_pick',  rarity:['common']},
  {p:16,  sym:'sym_common',   n:2,kind:'stamp_one',   rarity:['common']},
  {p:2,   sym:'sym_gold',     n:3,kind:'gold',amount:15},
  {p:5,   sym:'sym_gold',     n:2,kind:'gold',amount:5},
  {p:8,   sym:'sym_sticker',  n:3,kind:'sticker_pick',rarity:['rare','uncommon']},
  {p:16,  sym:'sym_sticker',  n:2,kind:'sticker_pick',rarity:['uncommon','common']},
  {p:25,  sym:null,           n:0,kind:'nothing'}
];

function _rollSymbolPayout(){
  var roll=_rng()*100,acc=0;
  for(var i=0;i<SYMBOL_PAYOUTS.length;i++){acc+=SYMBOL_PAYOUTS[i].p;if(roll<acc)return SYMBOL_PAYOUTS[i];}
  return SYMBOL_PAYOUTS[SYMBOL_PAYOUTS.length-1];
}

// Reel dressing for a rolled outcome. Every pair pays, so a 'nothing' spin
// must show three DISTINCT symbols, and a legendary pair (which has no payout)
// can never appear. Pairs land on reels 1+2 so reel 3 carries the anticipation.
function _dressSymbolReels(o){
  var all=SLOT_SYMBOLS.map(function(s){return s.id;});
  if(o.n===3)return[o.sym,o.sym,o.sym];
  if(o.n===2){
    var rest=all.filter(function(id){return id!==o.sym;});
    return[o.sym,o.sym,rest[Math.floor(_rng()*rest.length)]];
  }
  var pool=all.slice(),out=[];
  for(var k=0;k<3;k++)out.push(pool.splice(Math.floor(_rng()*pool.length),1)[0]);
  return out;
}

function _stampsByRarity(rs){return SQ.filter(function(d){return d.type==='stamp'&&rs.indexOf(d.rarity)>=0;}).map(function(d){return d.id;});}
function _stickersByRarity(rs){return SQ.filter(function(d){return d.type!=='stamp'&&rs.indexOf(d.rarity)>=0;}).map(function(d){return d.id;});}
function _pickDistinct(arr,n){
  arr=arr.slice();var out=[];
  while(arr.length&&out.length<n)out.push(arr.splice(Math.floor(_rng()*arr.length),1)[0]);
  return out;
}

var ALL_PACK_TYPES=[
  {type:'sticker',label:'Prize Pack',desc:'3 random stickers or stamps — choose one to keep.',cost:3},
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
  var _bActiveWords=[];(S.bounties||[]).forEach(function(sc){(sc.words||[]).forEach(function(w){_bActiveWords.push(w.word);});});
  shopPool.bounties=_generateBounties(3,_bActiveWords).map(function(sc){
    return{theme:sc.theme,words:sc.words,cost:2,accepted:false};
  });
  shopPool.slotSpinCost=5;
  shopPool.slotSpinsThisVisit=0;
  shopPool.slotResult=null;
  shopPool.slotMode=null;
  shopPool.slotArmed='stamps';
  shopPool.bagEnchantUsed=false;
  shopPool.bagDestroyUsed=false;
  shopPool.bagDupUsed=false;
}

function enterShopPhase(){
  S.phase='shop';
  if(!shopPool.sq.length)refreshShop();
  var rp=document.getElementById('slot-result-panel');if(rp)rp.style.display='none';
  var bu=document.getElementById('shop-bag-overlay');if(bu){bu.style.display='none';delete bu.dataset.closing;}
  document.getElementById('shop-screen').style.display='flex';
  renderShop();
  renderStampBar();
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
  renderHand();renderBoard();renderHUD();renderStampBar();
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
    var canvasW=Math.min(window.innerWidth,window.innerHeight*1.6);
    var itemW=Math.round(canvasW*0.25*0.94);
    var btSz=Math.max(9,Math.min(13,Math.round(itemW*0.046)));
    for(var bi=0;bi<bpool.length;bi++){
      var b=bpool[bi];
      var item=document.createElement('div');
      item.className='shop-bounty-item';

      var scrollWrap=document.createElement('div');
      scrollWrap.style.cssText='position:relative;width:90%;margin:0 auto;overflow:hidden;'
        +'background-image:url(\'Assets/animations/bounty scroll/bounty_scroll'+(b.accepted?'3':'1')+'.png\');'
        +'background-size:100% auto;background-repeat:no-repeat;background-position:top center;'
        +'image-rendering:pixelated;padding-top:30%;'
        +(b.accepted?'opacity:0.55;cursor:default':'cursor:pointer');

      if(!b.accepted){
        (function(wrap,idx){
          wrap.addEventListener('mouseenter',function(){wrap.style.backgroundImage='url(\'Assets/animations/bounty scroll/bounty_scroll2.png\')';});
          wrap.addEventListener('mouseleave',function(){wrap.style.backgroundImage='url(\'Assets/animations/bounty scroll/bounty_scroll1.png\')';});
          wrap.addEventListener('click',function(){acceptBounty(idx);});
        })(scrollWrap,bi);
      }

      if(b.theme){
        var tov=document.createElement('div');
        tov.style.cssText='position:absolute;top:5px;left:0;right:0;'
          +'display:flex;justify-content:center;align-items:center;pointer-events:none;z-index:3';
        var ttag=document.createElement('span');
        ttag.style.cssText='font-family:\'Jersey 10\',Georgia,serif;font-size:'+btSz+'px;color:#2e1800;'
          +'background:rgba(238,210,155,0.92);border:1px solid rgba(110,65,10,0.6);'
          +'border-radius:3px;padding:2px 6px;line-height:1;white-space:nowrap;'
          +'max-width:88%;overflow:hidden;text-overflow:ellipsis';
        ttag.textContent=b.theme;
        tov.appendChild(ttag);
        scrollWrap.appendChild(tov);
      }

      item.appendChild(scrollWrap);
      blist.appendChild(item);
    }
  }
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
    // Buttons arm the machine mode; the handle pulls the actual spin. The
    // reel tint (set at flick peak by _flickReels) doubles as the mode light.
    // Symbol mode is DEV-ONLY for now — without dev mode grey is just a flick.
    var armMap={grey:'symbols',yellow:'stamps',pink:'stamps'};
    var newMode=armMap[wasPressed.name];
    if(newMode==='symbols'&&!S.devMode)newMode=null;
    if(newMode&&newMode!==shopPool.slotArmed){
      shopPool.slotArmed=newMode;
      toast(newMode==='symbols'?'Symbol machine armed — pull the handle!':'Prize machine armed — pull the handle!');
    }
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
    var t=setInterval(function(){f--;if(f<=0){clearInterval(t);setFrame(0,false);if(didSpin)spinArmedSlots();}else setFrame(f,false);},55);
  }
  hit.addEventListener('pointerup',onRelease);
  hit.addEventListener('pointercancel',onRelease);
}

function _initShopBag(){
  var btn=document.getElementById('shop-bag-btn');
  var spr=document.getElementById('shop-bag-sprite');
  if(!btn||!spr)return;
  var fresh=btn.cloneNode(true);btn.parentNode.replaceChild(fresh,btn);
  attachBagHover(fresh,fresh.querySelector('img'));
}

// ── REEL SYSTEM ──
// Two-strip architecture: cosmetic strip (Math.random, idle only) + result strip (_rng seeded at shop open).
// On spin, the result strip is spliced in at equivalent scroll position. Decel stops between items,
// then an elastic snap settles on the predetermined result.
var _reels=null,_reelAF=null,_reelLastTime=0,_reelResultShown=false;
var _trayAnimTimer=null,_trayIsOpen=false,_pillowEls=[];
var _flickColorTimer=null;
var REEL_IDLE_SPEED=30,REEL_FAST_SPEED=8000,REEL_ACCEL_MS=1000;
// Slot_reel.png is a 40×112 native sprite: a repeating unit of a 4px border + 32px square
// window (40 wide × 36 tall per unit). One reel-item == one unit, so adjacent items' borders
// butt together into a seamless tiled reel strip. These ratios derive the on-screen window size
// (and the matching prize icon size elsewhere) purely from a reel's own rendered width.
var REEL_UNIT_W=40,REEL_UNIT_H=36,REEL_WINDOW=32;
// Single hyperbolic decel: v(t)=v₀·t₀/(t+t₀) — steep initial drop, long crawl tail (shape like 1/x).
// Snaps to nearest item when v < REEL_SNAP_THRESH * itemH px/s.
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
      var d=_symDef(items[ii])||sqd(items[ii]);if(!d)continue;
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

function _initReels(){
  _stopReels();
  _reelResultShown=false;
  for(var _ri=0;_ri<3;_ri++){var _rel=document.getElementById('shop-reel-'+(_ri+1));if(_rel){_rel.classList.remove('reel-common','reel-rare');if(S.devMode&&shopPool.slotArmed==='symbols')_rel.classList.add('reel-common');}}
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
    // Symbol strip (grey-button spin): 6 symbols per loop, so it needs far
    // more copies to cover the same decel distance.
    var symItems=seedShuffle(SLOT_SYMBOLS.map(function(s){return s.id;}));
    var symLoopLen=symItems.length*itemH;
    var symNumCopies=Math.max(3,Math.ceil((symLoopLen+totalDistEst)/symLoopLen)+1);
    var symStrip=_buildReelStrip(symItems,itemH,symNumCopies);
    symStrip.style.display='none';
    el.appendChild(symStrip);
    var startOff=Math.random()*(N*itemH);
    cosStrip.style.transform='translateY('+(centerPad-startOff)+'px)';
    _reels.push({el:el,cosStrip:cosStrip,resStrip:resStrip,
      cosmItems:cosmItems,resItems:resItems,itemH:itemH,N:N,numCopies:numCopies,centerPad:centerPad,
      symStrip:symStrip,symItems:symItems,symN:symItems.length,symNumCopies:symNumCopies,symMode:false,
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
    var strip=r.symMode?r.symStrip:(r.useResultStrip?r.resStrip:r.cosStrip);
    var loopLen=(r.symMode?r.symN:r.N)*r.itemH;
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
      // flickDecelT0 is set at release; if released during accel, stamp it at the first decel frame
      if(ts-r.flickT0>=REEL_FLICK_ACCEL_MS&&!r.flickHeld&&!r.flickDecelT0)r.flickDecelT0=ts;
      var speed=_flickSpeedNow(r,ts);
      if(!r.flickHeld&&ts-r.flickT0>=REEL_FLICK_ACCEL_MS&&speed-REEL_IDLE_SPEED<=20){
        r.state='idle';speed=REEL_IDLE_SPEED;
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
  // Symbol mode spins the symbol strip; otherwise the seeded result strip.
  var N=r.symMode?r.symN:r.N;
  var items=r.symMode?r.symItems:r.resItems;
  var stripEl=r.symMode?r.symStrip:r.resStrip;
  var copies=r.symMode?r.symNumCopies:r.numCopies;
  var loopLen=N*r.itemH;
  r.offset=r.offset%loopLen;
  var vThresh=REEL_SNAP_THRESH*r.itemH;
  // Analytic: pos where v(t)=v₀·exp(-t/τ) hits vThresh = v₀·τ·(1-vThresh/v₀)
  var decelDist=REEL_FAST_SPEED*REEL_FLICK_DECEL_TAU*(1-vThresh/REEL_FAST_SPEED);
  var endPos=r.offset+decelDist;
  // Nearest item slot to snap target
  var snapAbsIdx=Math.round(endPos/r.itemH);
  var snapInLoop=((snapAbsIdx%N)+N)%N;
  r.snapTarget=snapAbsIdx*r.itemH; // snap ≤ itemH/2 from endPos
  // Swap result item into the snapInLoop slot while reel is fast (invisible swap)
  var curResultIdx=items.indexOf(resultId);
  if(curResultIdx<0)curResultIdx=0;
  if(curResultIdx!==snapInLoop){
    var displaced=items[snapInLoop];
    items[snapInLoop]=resultId;
    items[curResultIdx]=displaced;
    var allItems=stripEl.querySelectorAll('.reel-item');
    for(var copy=0;copy<copies;copy++){
      var elA=allItems[copy*N+snapInLoop];
      var elB=allItems[copy*N+curResultIdx];
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
  var N=r.symMode?r.symN:r.N;
  var loopLen=N*r.itemH;
  var passNum=Math.floor(r.snapTarget/loopLen);
  var allItems=(r.symMode?r.symStrip:r.resStrip).querySelectorAll('.reel-item');
  var visItem=allItems[passNum*N+r.resultIdx];
  if(visItem){
    visItem.classList.remove('reel-pop-anim');
    void visItem.offsetWidth;
    visItem.classList.add('reel-pop-anim');
    visItem.addEventListener('animationend',function(){visItem.classList.remove('reel-pop-anim');},{once:true});
  }
}

function _onReelStopped(){
  if(!_reels)return;
  if(shopPool.slotMode==='symbols'){_resolveSymbolPayout();return;}
  _animateSlotResult();
}

// Pillow centers in canvas native pixels (canvas=256×160, tray is 1:1 pixel mapping).
// Tray top = 62.5%×160 = 100. Pillow y-center at tray y=14.5 → canvas y=114.5.
var _PILLOWS=[{cx:37.5,cy:114.5},{cx:85,cy:114.5},{cx:133,cy:114.5}];

function _animateSlotResult(){
  var canvas=document.getElementById('shop-canvas');
  var reelLayer=document.getElementById('shop-reel-layer');
  if(!canvas||!reelLayer||!_reels)return;

  // Gather won prize elements and their reel containers
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

    // Phase 1: Fade reel layer — borders, frame, other items above/below
    // Won prize icons remain visible via the canvas-level clipper copies
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
          _showPillowPrizes(wins.map(function(w){return w.id;}),canvas);
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

function _showPillowPrizes(ids,canvas){
  _pillowEls=[];

  // Invisible dismiss zone over the tray body (y=28-47 in tray image → canvas y=80%+)
  var dismissEl=document.createElement('div');
  dismissEl.style.cssText='position:absolute;left:0;top:80%;width:67.1875%;height:12.5%;z-index:14;cursor:pointer;';
  dismissEl.onclick=function(){_dismissPillowPrizes();};
  canvas.appendChild(dismissEl);
  _pillowEls.push(dismissEl);

  // Prize icons on each pillow (a single prize sits on the centre pillow)
  var pOff=ids.length===1?1:0;
  ids.forEach(function(id,i){
    if(i+pOff>=_PILLOWS.length)return;
    var d=sqd(id);if(!d)return;
    var p=_PILLOWS[i+pOff];
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

function _dismissPillowPrizes(){
  _pillowEls.forEach(function(e){if(e&&e.parentNode)e.parentNode.removeChild(e);});
  _pillowEls=[];
  _closeSlotTray(function(){
    var rl=document.getElementById('shop-reel-layer');
    if(rl){rl.style.transition='none';rl.style.opacity='1';}
    shopPool.slotResult=null;shopPool.slotMode=null;_reelResultShown=false;
    if(_reels){for(var ri=0;ri<_reels.length;ri++){
      var r=_reels[ri];if(!r)continue;
      r.state='idle';r.resultId=null;r.resultIdx=-1;r.useResultStrip=false;r.symMode=false;
      var ll=r.N*r.itemH;r.offset=((r.offset%ll)+ll)%ll;
      r.resStrip.style.display='none';r.symStrip.style.display='none';r.cosStrip.style.display='';
      r.cosStrip.style.transform='translateY('+(r.centerPad-r.offset)+'px)';
    }}
  });
}

function _pickReelResult(id){
  var rl=document.getElementById('shop-reel-layer');
  if(rl){rl.style.transition='none';rl.style.opacity='1';}
  var d=sqd(id);if(!d)return;
  if(!addPrizeFromShop(id))return;
  document.querySelectorAll('.reel-item.reel-sel').forEach(function(el){el.classList.remove('reel-sel');el.onclick=null;});
  if(_reels){
    for(var ri=0;ri<_reels.length;ri++){
      var r=_reels[ri];if(!r)continue;
      r.state='idle';r.resultId=null;r.resultIdx=-1;r.useResultStrip=false;r.symMode=false;
      var loopLen=r.N*r.itemH;
      r.offset=((r.offset%loopLen)+loopLen)%loopLen;
      r.resStrip.style.display='none';
      r.symStrip.style.display='none';
      r.cosStrip.style.display='';
      r.cosStrip.style.transform='translateY('+(r.centerPad-r.offset)+'px)';
    }
    _reelResultShown=false;
  }
  shopPool.slotResult=null;shopPool.slotMode=null;
  renderShop();renderHUD();
  var isStamp=d.type==='stamp',qty=d.qty||1;
  if(isStamp)toast(d.name+' added to stamp bar!');
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

// Current speed (px/s) of a reel in the flick state at time `now`:
// logarithmic accel toward peak, cruise while held, exponential decay after
// release. Reels in any other state move at idle speed.
function _flickSpeedNow(r,now){
  if(!r||r.state!=='flick')return REEL_IDLE_SPEED;
  var fe=now-r.flickT0;
  if(fe<REEL_FLICK_ACCEL_MS){
    var fa=fe/REEL_FLICK_ACCEL_MS;
    return r.flickStartSpeed+(REEL_FLICK_PEAK-r.flickStartSpeed)*Math.log(1+fa*(Math.E-1));
  }
  if(r.flickHeld)return REEL_FLICK_PEAK;
  var fd=r.flickDecelT0?(now-r.flickDecelT0)/1000:0;
  return REEL_IDLE_SPEED+(REEL_FLICK_PEAK-REEL_IDLE_SPEED)*Math.exp(-fd/REEL_FLICK_DECEL_TAU);
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
    r.flickStartSpeed=_flickSpeedNow(r,now);
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

// Shared spin gate + cost: both machines draw from the same escalating pot.
function _chargeSlotSpin(){
  if(_trayIsOpen){toast('Close the tray first!');return false;}
  if(document.querySelector('.reel-item.reel-sel')){toast('Pick a prize from the reels first!');return false;}
  // Reels already committed to a spin — a second spin would double-charge and
  // leave the first spin's stop timers pointing at the wrong results.
  if(_reels&&_reels.some(function(r){return r&&r.state!=='idle'&&r.state!=='flick';}))return false;
  var cost=shopPool.slotSpinCost||4;
  if(!spendGold(cost))return false;
  shopPool.slotSpinsThisVisit=(shopPool.slotSpinsThisVisit||0)+1;
  shopPool.slotSpinCost=5+shopPool.slotSpinsThisVisit*3;
  renderHUD();renderShop();
  return true;
}

function spinSlots(){
  if(!_chargeSlotSpin())return;
  var results=wrandN(SQ.map(function(d){return d.id;}),{common:5,uncommon:2,rare:0.8,legendary:0.1},3);
  shopPool.slotMode='stamps';
  shopPool.slotResult=results;
  _reelResultShown=false;
  // Cancel any pending flick color switch — spin takes over from here
  if(_flickColorTimer){clearTimeout(_flickColorTimer);_flickColorTimer=null;}
  if(_reels){
    var _now=performance.now();
    for(var ri=0;ri<_reels.length;ri++){
      var r=_reels[ri];if(!r)continue;
      // Snapshot current speed so spin accel lifts off smoothly from a mid-flick reel
      var startSpeed=_flickSpeedNow(r,_now);
      // Reset any flick color class — spin uses default reel strip
      var reelEl=document.getElementById('shop-reel-'+(ri+1));
      if(reelEl)reelEl.classList.remove('reel-common','reel-rare');
      // Splice: swap to result strip at the same fractional scroll position
      var loopLen=r.N*r.itemH;
      r.offset=r.offset%loopLen;
      r.cosStrip.style.display='none';
      r.symStrip.style.display='none';r.symMode=false;
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

// The handle spins whichever machine the buttons have armed.
// Symbol mode is dev-only for now — the devMode check also disarms it safely
// if dev mode is toggled off while symbols are armed.
function spinArmedSlots(){
  if(S.devMode&&shopPool.slotArmed==='symbols')spinSymbolSlots();
  else spinSlots();
}

// ── SYMBOL SPIN (armed by the grey button, fired by the handle) ──
// Same reel choreography as spinSlots, but on the symbol strip. The outcome
// is rolled up front (SYMBOL_PAYOUTS) and the reels dressed to match; when a
// pair lands on reels 1+2, reel 3's stop is delayed for anticipation.
function spinSymbolSlots(){
  if(!_chargeSlotSpin())return;
  var outcome=_rollSymbolPayout();
  var dress=_dressSymbolReels(outcome);
  shopPool.slotMode='symbols';
  shopPool.slotResult={outcome:outcome,symbols:dress};
  _reelResultShown=false;
  if(_flickColorTimer){clearTimeout(_flickColorTimer);_flickColorTimer=null;}
  if(_reels){
    var _now=performance.now();
    for(var ri=0;ri<_reels.length;ri++){
      var r=_reels[ri];if(!r)continue;
      var startSpeed=_flickSpeedNow(r,_now);
      // Keep the grey tint through the spin — it's the symbol-mode light
      var reelEl=document.getElementById('shop-reel-'+(ri+1));
      if(reelEl){reelEl.classList.remove('reel-rare');reelEl.classList.add('reel-common');}
      // Splice: swap to symbol strip at the same fractional scroll position
      r.offset=r.offset%(r.symN*r.itemH);
      r.cosStrip.style.display='none';
      r.resStrip.style.display='none';r.useResultStrip=false;
      r.symStrip.style.display='';
      r.symStrip.style.transform='translateY('+(r.centerPad-r.offset)+'px)';
      r.symMode=true;
      r.accelStartSpeed=startSpeed;
      r.accelT0=_now;
      r.flickHeld=false;
      r.state='accelerating';
      r.resultId=null;r.resultIdx=-1;
    }
  }
  var thirdDelay=(dress[0]===dress[1])?3400:2200; // near-miss stretch on a pair
  setTimeout(function(){_stopReelAt(0,dress[0]);},1400);
  setTimeout(function(){_stopReelAt(1,dress[1]);},1800);
  setTimeout(function(){_stopReelAt(2,dress[2]);},thirdDelay);
}

// Fired by _onReelStopped once all three symbol reels have snapped.
function _resolveSymbolPayout(){
  var res=shopPool.slotResult;
  if(!res||!res.outcome)return;
  var o=res.outcome;
  // Let the pop/ding land before paying out (mirrors _animateSlotResult's pause)
  setTimeout(function(){
    if(o.kind==='nothing'){toast('🎰 No match!');_resetSymbolReels();return;}
    if(o.kind==='gold'){
      S.gold+=o.amount;renderHUD();
      toast('🎰 '+(o.n===3?'Triple':'Double')+' gold! +$'+o.amount);
      _resetSymbolReels();return;
    }
    var ids;
    if(o.kind==='stamp_fixed')ids=o.ids.slice();
    else if(o.kind==='stamp_pick')ids=_pickDistinct(_stampsByRarity(o.rarity),3);
    else if(o.kind==='stamp_one')ids=_pickDistinct(_stampsByRarity(o.rarity),1);
    else ids=_pickDistinct(_stickersByRarity(o.rarity),3); // sticker_pick
    if(!ids.length){toast('🎰 No match!');_resetSymbolReels();return;}
    // Stamp prize with a full bar → gold consolation at sell value
    if(o.kind.indexOf('stamp')===0&&(S.stamps||[]).length>=5){
      var d=sqd(ids[0]);var g=Math.max(1,Math.floor(((d&&d.cost)||4)/2));
      S.gold+=g;renderHUD();
      toast('Stamp bar full! +$'+g+' instead');
      _resetSymbolReels();return;
    }
    var canvas=document.getElementById('shop-canvas');
    if(!canvas){_resetSymbolReels();return;}
    _openSlotTray(function(){_showPillowPrizes(ids,canvas);});
  },850);
}

// Return the reels to the idle cosmetic strip after a no-prize symbol payout.
// (Prize payouts reset through _pickReelResult/_dismissPillowPrizes instead.)
function _resetSymbolReels(){
  shopPool.slotResult=null;shopPool.slotMode=null;_reelResultShown=false;
  if(!_reels)return;
  for(var ri=0;ri<_reels.length;ri++){
    var r=_reels[ri];if(!r)continue;
    r.state='idle';r.resultId=null;r.resultIdx=-1;r.useResultStrip=false;r.symMode=false;
    r.symStrip.style.display='none';
    r.resStrip.style.display='none';
    r.cosStrip.style.display='';
    var ll=r.N*r.itemH;r.offset=((r.offset%ll)+ll)%ll;
    r.cosStrip.style.transform='translateY('+(r.centerPad-r.offset)+'px)';
  }
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
  var variants=[{v:'gold',label:'Gold',desc:'+$1 when scored',col:'#f0c060'},{v:'blue',label:'Blue',desc:'Drawn from the bag first',col:'#60b8ff'},{v:'red',label:'Red',desc:'Triggers twice',col:'#ff8080'}];
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
  _fadeBridge('#0f2018',350);
  ovr.style.display='none';
  _bagTransitionClose('shop-bag-sprite',function(){delete ovr.dataset.closing;});
}

function buyPack(i){
  var pack=(shopPool.packs||[])[i];if(!pack||pack.sold)return;
  if(!spendGold(pack.cost))return;
  pack.sold=true;
  if(pack.type==='sticker'){
    renderHUD();
    var contents=wrandN(SQ.map(function(d){return d.id;}),{common:4,uncommon:2,rare:1},3);
    openPackReveal('Prize Pack',contents);
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

// Routes a freshly acquired prize: stamps go to the stamp bar, stickers to stickerInventory.
// Returns false (with a toast) if the stamp bar is full; true otherwise.
function addPrizeFromShop(id){
  var d=sqd(id);if(!d)return false;
  if(d.type==='stamp'){
    if(!S.stamps)S.stamps=[];
    if(S.stamps.length>=5){toast('Stamp bar is full! (max 5)');return false;}
    S.stamps.push({id:id});
    if(d.onAcquire)d.onAcquire();
    if(typeof renderStampBar==='function')renderStampBar();
    return true;
  }
  var qty=d.qty||1;
  for(var k=0;k<qty;k++)S.stickerInventory.push({id:id});
  return true;
}

function buySq(i){
  var item=shopPool.sq[i];var d=sqd(item.id);if(!item||item.sold||!d)return;
  var isStamp=d.type==='stamp';
  if(isStamp&&(S.stamps||[]).length>=5){toast('Stamp bar is full! (max 5)');return;}
  if(!spendGold(d.cost))return;
  item.sold=true;
  addPrizeFromShop(item.id);
  renderShop();renderHUD();
  if(isStamp)toast(d.name+' added to stamp bar!');
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
      if(!addPrizeFromShop(did))return;
      var isStamp=dq.type==='stamp',qty=dq.qty||1;
      c.classList.add('chosen');c.textContent=isStamp?'Added to bar!':(qty>1?qty+'× Queued!':'Queued!');
      var cs=grid.getElementsByClassName('prc');for(var k=0;k<cs.length;k++){cs[k].style.pointerEvents='none';cs[k].style.opacity='0.4';}c.style.opacity='1';setTimeout(function(){document.getElementById('pack-modal').style.display='none';_shopTipHideImmediate();enterShopPhase();},600);};c.onmouseenter=function(){_shopTipShow(did,c);};c.onmouseleave=function(){_shopTipHide();};})(contents[i],card);
    grid.appendChild(card);
  }
  document.getElementById('pack-modal').style.display='flex';
}

function skipPack(){document.getElementById('pack-modal').style.display='none';enterShopPhase();}

function acceptBounty(i){
  var b=shopPool.bounties[i];if(!b||b.accepted)return;
  if(!spendGold(b.cost))return;
  b.accepted=true;
  S.bounties=S.bounties||[];S.bounties.push({theme:b.theme,words:b.words});
  renderShop();renderHUD();
  toast('Bounty scroll accepted! Play any listed word for its reward + '+bountyRewardLabel()+'!');
}

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
