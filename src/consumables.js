// =====================================================================
// CONSUMABLES — Tickets & Keys (this game's tarots/spectrals)
// Bought as shop packs (small: 3 choose 1 · regular: 5 choose 1 · large:
// 5 choose 2). Opening a pack shows 7 random bag tiles fanned on top and
// the rolled tickets/keys as cards beneath — tile-targeted effects apply
// to the shown tiles. Created tickets go to S.consumables (max TK_MAX),
// usable from the inventory strip any time via the same overlay.
// Placeholder art: CSS cards + emoji icons; real sprites auto-detected at
// Assets/consumables/{id}/{id}.png (same pattern as stickers/stamps).
// =====================================================================

var TK_MAX=4;      // consumable inventory slots
var TK_TILE_SZ=64; // shown-tile size in the pack overlay

function tkd(id){for(var i=0;i<TK.length;i++)if(TK[i].id===id)return TK[i];return null;}

// Room left in the inventory. Using a consumable FROM the inventory frees
// its own slot, so canUse checks get +1 when the overlay source is 'inv'.
function _tkRoom(st){return TK_MAX-(S.consumables||[]).length+((st&&st.source==='inv')?1:0);}

// ── Shared effect helpers ────────────────────────────────────────────────────

// Mutate a tile everywhere it lives (pool, bag, hand, board) — like
// transformTile but with an arbitrary mutator, for letter-copy effects.
function _tkMutateTile(tileId,fn){
  function w(t){if(t&&t.id===tileId)fn(t);}
  (S.pool||[]).forEach(w);(S.bag||[]).forEach(w);(S.hand||[]).forEach(w);
  for(var i=0;i<B*B;i++){w(S.bt[i]);if(S.btTop)w(S.btTop[i]);}
  if(typeof _rankObserve==='function')_rankObserve();
}

// Convert every selected overlay tile with transformTile opts + burn anim.
function _tkConvertSel(sel,opts){
  for(var i=0;i<sel.length;i++){
    transformTile(sel[i].t.id,opts);
    _tkBurnSwap(sel[i],false);
  }
  return 900;
}

// Destroy n random still-alive shown tiles (burn-away, no replacement).
function _tkDestroyRandom(st,n){
  var alive=st.tiles.filter(function(e){return !e.dead;});
  for(var i=alive.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=alive[i];alive[i]=alive[j];alive[j]=t;}
  var k=Math.min(n,alive.length);
  for(var d=0;d<k;d++){
    transformTile(alive[d].t.id,{destroy:true});
    _tkBurnSwap(alive[d],true);
  }
  return k;
}

// ── Definitions ──────────────────────────────────────────────────────────────
// {id, kind:'ticket'|'key', name, desc, icon, fg,
//  sel:{n,min} — tile-target spec (max n, need min) — omitted = no targets,
//  canUse(st) — return a reason string to block, falsy to allow,
//  use(sel,st) — apply the effect; sel = selected tile entries in display
//  order; returns the animation duration (ms) before the pick resolves}
var TK=[
  // ── TICKETS ──
  {id:'tk_red',kind:'ticket',name:'Red Ticket',icon:'🔴',fg:'#ff8080',
    desc:'Convert up to 2 tiles to red.',sel:{n:2,min:1},
    use:function(sel){return _tkConvertSel(sel,{variant:'red'});}},
  {id:'tk_blue',kind:'ticket',name:'Blue Ticket',icon:'🔵',fg:'#60b8ff',
    desc:'Convert up to 2 tiles to blue.',sel:{n:2,min:1},
    use:function(sel){return _tkConvertSel(sel,{variant:'blue'});}},
  {id:'tk_gold',kind:'ticket',name:'Golden Ticket',icon:'🟡',fg:'#f0c060',
    desc:'Convert 1 tile to gold.',sel:{n:1,min:1},
    use:function(sel){return _tkConvertSel(sel,{variant:'gold'});}},
  {id:'tk_jade',kind:'ticket',name:'Jade Ticket',icon:'🟢',fg:'#2a9a5a',
    desc:'Convert 1 tile to jade.',sel:{n:1,min:1},
    use:function(sel){return _tkConvertSel(sel,{variant:'jade'});}},
  {id:'tk_purple',kind:'ticket',name:'Purple Ticket',icon:'🟣',fg:'#c060ff',
    desc:'Convert 1 tile to purple.',sel:{n:1,min:1},
    use:function(sel){return _tkConvertSel(sel,{variant:'purple'});}},
  {id:'tk_blank',kind:'ticket',name:'Eraser',icon:'⬜',fg:'#e8e0d0',
    desc:'Convert 1 tile to a blank.',sel:{n:1,min:1},
    use:function(sel){return _tkConvertSel(sel,{isBlank:true});}},
  {id:'tk_double',kind:'ticket',name:'Payday',icon:'💰',fg:'#f0c060',
    desc:'Double your money (up to +$20).',
    canUse:function(){if(S.gold<=0)return 'No money to double!';},
    use:function(){var g=Math.min(S.gold,20);S.gold+=g;renderHUD();toast('Payday: +$'+g+'!');return 500;}},
  {id:'tk_appraiser',kind:'ticket',name:'Appraiser',icon:'💸',fg:'#c0e080',
    desc:'Gain money equal to the sell value of your stamps.',
    canUse:function(){if(!(S.stamps||[]).length)return 'You own no stamps!';},
    use:function(){
      var g=0;
      (S.stamps||[]).forEach(function(ts){var d=sqd(ts.id);g+=Math.floor(((d&&d.cost)||4)/2);});
      S.gold+=g;renderHUD();toast('Stamps appraised: +$'+g+'!');return 500;
    }},
  {id:'tk_encore',kind:'ticket',name:'Encore',icon:'🎭',fg:'#f0a0d0',
    desc:'Add a copy of the last ticket you used to your inventory.',
    canUse:function(st){
      if(!S.lastTicket)return 'No ticket used yet!';
      if(_tkRoom(st)<1)return 'Consumable slots are full!';
    },
    use:function(){
      S.consumables.push({id:S.lastTicket});
      var d=tkd(S.lastTicket);
      toast((d?d.name:'Ticket')+' copied to your inventory!');
      return 500;
    }},
  {id:'tk_alchemist',kind:'ticket',name:'Alchemist',icon:'⚗️',fg:'#a0e0e0',
    desc:'Select 2 tiles: the left tile becomes a copy of the right tile.',sel:{n:2,min:2},
    use:function(sel){
      var src=sel[1].t;
      var snap={letter:src.letter,isBlank:!!src.isBlank,variant:src.variant||null,material:src.material||null};
      _tkMutateTile(sel[0].t.id,function(o){o.letter=snap.letter;o.isBlank=snap.isBlank;o.variant=snap.variant;o.material=snap.material;o.blankAs=null;});
      _tkBurnSwap(sel[0],false);
      return 900;
    }},
  {id:'tk_lucky',kind:'ticket',name:'Lucky Draw',icon:'🎟️',fg:'#f0e080',
    desc:'Creates 2 random tickets.',
    canUse:function(st){if(_tkRoom(st)<1)return 'Consumable slots are full!';},
    use:function(){
      var pool=TK.filter(function(d){return d.kind==='ticket'&&d.id!=='tk_lucky';}).map(function(d){return d.id;});
      var n=Math.min(2,TK_MAX-(S.consumables||[]).length),names=[];
      for(var i=0;i<n;i++){
        var id=pool[Math.floor(_rng()*pool.length)];
        S.consumables.push({id:id});names.push(tkd(id).name);
      }
      toast('Created: '+names.join(' & ')+'!');
      return 550;
    }},
  {id:'tk_press',kind:'ticket',name:'Stamp Press',icon:'📮',fg:'#f08060',
    desc:'Creates a random stamp.',
    canUse:function(){if((S.stamps||[]).length>=5)return 'Stamp bar is full!';},
    use:function(){
      var ids=wrandN(SQ.filter(function(d){return d.type==='stamp';}).map(function(d){return d.id;}),{common:5,uncommon:2,rare:0.8},1);
      if(!ids.length){toast('The press jammed!');return 400;}
      addPrizeFromShop(ids[0]);
      toast(sqd(ids[0]).name+' added to stamp bar!');
      return 550;
    }},
  {id:'tk_shredder',kind:'ticket',name:'Shredder',icon:'🔥',fg:'#ff6030',
    desc:'Destroys up to 2 random tiles.',
    use:function(sel,st){
      var k=_tkDestroyRandom(st,2);
      toast(k+' tile'+(k!==1?'s':'')+' destroyed!');
      return 950;
    }},

  // ── KEYS ──
  {id:'ky_royal',kind:'key',name:'Royal Key',icon:'👑',fg:'#f0d040',
    desc:'Create a rare stamp. Sets your money to $0.',
    canUse:function(){if((S.stamps||[]).length>=5)return 'Stamp bar is full!';},
    use:function(){
      var ids=_stampsByRarity(['rare']);
      if(!ids.length){toast('No rare stamps exist!');return 400;}
      var id=ids[Math.floor(_rng()*ids.length)];
      addPrizeFromShop(id);
      S.gold=0;renderHUD();
      toast(sqd(id).name+' created — your money is gone!');
      return 600;
    }},
  {id:'ky_forge',kind:'key',name:'Forge Key',icon:'⚒️',fg:'#f0a040',
    desc:'Destroy 1 tile; add 3 random enchanted tiles to your bag.',sel:{n:1,min:1},
    use:function(sel){
      transformTile(sel[0].t.id,{destroy:true});
      _tkBurnSwap(sel[0],true);
      var vs=['red','blue','gold','jade','purple'],ls=Object.keys(DIST),added=[];
      for(var i=0;i<3;i++){
        var l=ls[Math.floor(_rng()*ls.length)],v=vs[Math.floor(_rng()*vs.length)];
        addTileToBag({letter:l,variant:v});
        added.push(v[0].toUpperCase()+v.slice(1)+' '+l);
      }
      S.bag=shuffle(S.bag);
      toast('Forged: '+added.join(', ')+' added to bag!');
      return 950;
    }},
  {id:'ky_glass',kind:'key',name:'Glass Key',icon:'🧊',fg:'#c0e8ff',
    desc:'Make one of your tiles glassy.',sel:{n:1,min:1},
    use:function(sel){return _tkConvertSel(sel,{material:'glass'});}},
  {id:'ky_iron',kind:'key',name:'Iron Key',icon:'⚙️',fg:'#c0c8d8',
    desc:'Make one of your tiles metallic.',sel:{n:1,min:1},
    use:function(sel){return _tkConvertSel(sel,{material:'metallic'});}},
  {id:'ky_amber',kind:'key',name:'Amber Key',icon:'✨',fg:'#f0d0a0',
    desc:'Make one of your tiles varnished.',sel:{n:1,min:1},
    use:function(sel){return _tkConvertSel(sel,{material:'varnished'});}},
  {id:'ky_twin',kind:'key',name:'Twin Key',icon:'👯',fg:'#d0a0f0',
    desc:'Create two copies of one of your tiles.',sel:{n:1,min:1},
    use:function(sel){
      var t=sel[0].t;
      addTileToBag({letter:t.letter,isBlank:t.isBlank,variant:t.variant,material:t.material});
      addTileToBag({letter:t.letter,isBlank:t.isBlank,variant:t.variant,material:t.material});
      S.bag=shuffle(S.bag);
      var f=sel[0].el.querySelector('.tile');
      if(f)f.style.animation='tkNewIn 0.5s cubic-bezier(0.34,1.56,0.64,1)';
      toast('Two copies of '+(t.isBlank?'Blank':t.letter)+' added to bag!');
      return 600;
    }},
  {id:'ky_skeleton',kind:'key',name:'Skeleton Key',icon:'🗝️',fg:'#e8e0d0',
    desc:'Create a copy of one random stamp. Destroys all other stamps.',
    canUse:function(){if(!(S.stamps||[]).length)return 'You own no stamps!';},
    use:function(){
      var pick=S.stamps[Math.floor(_rng()*S.stamps.length)];
      var d=sqd(pick.id);
      S.stamps=[{id:pick.id},{id:pick.id}];
      renderStampBar();
      toast('Skeleton Key: two '+(d?d.name:'?')+'s remain!');
      return 600;
    }},
  {id:'ky_rust',kind:'key',name:'Rust Key',icon:'💀',fg:'#c07050',
    desc:'Destroy 5 random tiles. Gain $20.',
    use:function(sel,st){
      var k=_tkDestroyRandom(st,5);
      S.gold+=20;renderHUD();
      toast(k+' tile'+(k!==1?'s':'')+' destroyed — +$20!');
      return 1000;
    }}
];

// ── Shop packs ───────────────────────────────────────────────────────────────
var TK_PACK_SIZES={
  small:  {label:'Small',  show:3,pick:1,cost:3},
  regular:{label:'Regular',show:5,pick:1,cost:5},
  large:  {label:'Large',  show:5,pick:2,cost:7}
};
// Weighted rotation for the two shop pack slots (keys rarer than tickets).
var TK_PACK_TYPES=[
  {kind:'ticket',size:'small',w:3},{kind:'ticket',size:'regular',w:2},{kind:'ticket',size:'large',w:1},
  {kind:'key',size:'small',w:1.5},{kind:'key',size:'regular',w:1},{kind:'key',size:'large',w:0.5}
];

function _tkRollShopPacks(n){
  var pool=TK_PACK_TYPES.slice(),out=[];
  for(var k=0;k<n&&pool.length;k++){
    var tot=0;for(var i=0;i<pool.length;i++)tot+=pool[i].w;
    var r=_rng()*tot,acc=0,pi=pool.length-1;
    for(var i=0;i<pool.length;i++){acc+=pool[i].w;if(r<acc){pi=i;break;}}
    var pt=pool.splice(pi,1)[0];
    var sz=TK_PACK_SIZES[pt.size];
    out.push({kind:pt.kind,size:pt.size,
      label:sz.label+' '+(pt.kind==='key'?'Key':'Ticket')+' Pack',
      cost:sz.cost,show:sz.show,pick:sz.pick,sold:false});
  }
  return out;
}

function buyTkPack(i){
  var p=(shopPool.tkPacks||[])[i];if(!p||p.sold)return;
  if(typeof _trayIsOpen!=='undefined'&&_trayIsOpen){toast('Close the tray first!');return;}
  if(!spendGold(p.cost))return;
  p.sold=true;
  renderShop();renderHUD();
  var pool=TK.filter(function(d){return d.kind===p.kind;}).map(function(d){return d.id;});
  var contents=_pickDistinct(pool,p.show);
  _tkOpenOverlay({cards:contents,picks:p.pick,source:'pack',title:p.label});
}

// Shop render: the two pack boxes on the counter + the shop inventory strip.
function renderTkShop(){
  for(var i=0;i<2;i++){
    var box=document.getElementById('shop-tkpack-'+i);if(!box)continue;
    var p=(shopPool.tkPacks||[])[i];
    if(!p){box.innerHTML='';box.className='shop-pack-box';box.onclick=null;box.onmouseenter=null;box.onmouseleave=null;continue;}
    var isKey=p.kind==='key';
    box.innerHTML='<div class="tk-pack-art '+(isKey?'key':'ticket')+'">'
      +'<span class="tk-pack-emoji">'+(isKey?'🗝️':'🎟️')+'</span>'
      +'<span class="tk-pack-size">'+TK_PACK_SIZES[p.size].label+'</span></div>'
      +'<div class="shop-pack-cost" style="color:'+(isKey?'#9ab8ff':'#f0c060')+'">$'+p.cost+'</div>';
    box.className='shop-pack-box'+(p.sold?' sold':'');
    _tkHoverTip(box,p.label,'Opens '+p.show+' '+(isKey?'keys':'tickets')+' — choose '+p.pick+'.',isKey?'#9ab8ff':'#f0c060');
    if(!p.sold){(function(idx){box.onclick=function(){buyTkPack(idx);};})(i);}else box.onclick=null;
  }
}

// ── Inventory ────────────────────────────────────────────────────────────────
function renderConsumables(){
  var inv=S.consumables||[];
  var targets=[
    {el:document.getElementById('consumable-row'),mini:'tk-mini'},
    {el:document.getElementById('shop-consumables'),mini:'tk-mini'}
  ];
  targets.forEach(function(tg){
    var row=tg.el;if(!row)return;
    row.innerHTML='';
    row.style.display=inv.length?'flex':'none';
    inv.forEach(function(c,i){
      var d=tkd(c.id);if(!d)return;
      var m=document.createElement('div');
      m.className=tg.mini+' '+(d.kind==='key'?'key':'ticket');
      m.innerHTML=d.iconPng
        ?'<img src="'+d.iconPng+'" style="width:80%;image-rendering:pixelated;pointer-events:none">'
        :'<span style="pointer-events:none">'+d.icon+'</span>';
      _tkHoverTip(m,d.name,d.desc+' (click to use)',d.fg);
      m.onclick=function(){useConsumable(i);};
      row.appendChild(m);
    });
    if(inv.length){
      var ctr=document.createElement('span');
      ctr.className='tk-mini-count';
      ctr.textContent=inv.length+'/'+TK_MAX;
      row.appendChild(ctr);
    }
  });
}

function useConsumable(i){
  if(window._scoring)return;
  if(_tkOv)return;
  var c=(S.consumables||[])[i];if(!c)return;
  var def=tkd(c.id);if(!def)return;
  _tkOpenOverlay({cards:[c.id],picks:1,source:'inv',invIndex:i,title:def.name,autoSelect:true});
}

// ── Pack / use overlay ───────────────────────────────────────────────────────
var _tkOv=null,_tkBusy=false;

function _tkTileFace(t,sz){
  var spr=tileSpr(t.isBlank?null:t.letter,t.isBlank,t.variant||null,sz);
  var te=document.createElement('div');
  te.className='tile tile-spr'+(t.isBlank?' blank-t':'')+(t.variant?' var-'+t.variant:'');
  te.style.cssText='width:'+sz+'px;height:'+sz+'px;position:relative;flex-shrink:0;'+spr;
  applyTileLayers(te,t,sz,spr);
  return te;
}

function _tkOpenOverlay(opts){
  var ov=document.getElementById('tk-overlay');if(!ov||_tkOv)return;
  _tkOv={cards:[],picks:opts.picks,source:opts.source,invIndex:opts.invIndex,
         invConsumed:false,tiles:[],selCard:null,selTiles:[]};
  document.getElementById('tk-ov-name').textContent=opts.title||'';
  document.getElementById('tk-ov-picks').textContent=opts.source==='inv'?'':'Choose '+opts.picks;
  document.getElementById('tk-skip-btn').textContent=opts.source==='inv'?'Cancel':'Skip';

  // 7 random bag tiles — the targets tile-specific consumables act on.
  var row=document.getElementById('tk-tiles-row');row.innerHTML='';
  var samp=S.bag.slice();
  for(var i=samp.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=samp[i];samp[i]=samp[j];samp[j]=t;}
  samp=samp.slice(0,7);
  for(var si=0;si<samp.length;si++){
    var wrap=document.createElement('div');
    wrap.className='tk-tile-wrap';
    var mid=(samp.length-1)/2;
    var baseTf='rotate('+((si-mid)*2.2).toFixed(1)+'deg) translateY('+Math.round(Math.abs(si-mid)*4)+'px)';
    wrap.style.transform=baseTf;
    wrap.appendChild(_tkTileFace(samp[si],TK_TILE_SZ));
    row.appendChild(wrap);
    var entry={t:samp[si],el:wrap,dead:false,baseTf:baseTf};
    (function(e){wrap.addEventListener('click',function(){_tkTileClick(e);});})(entry);
    _tkOv.tiles.push(entry);
  }
  if(!samp.length)row.innerHTML='<div style="color:#8880a8;font-size:26px">Your bag is empty</div>';

  var crow=document.getElementById('tk-cards-row');crow.innerHTML='';
  for(var ci=0;ci<opts.cards.length;ci++){
    var def=tkd(opts.cards[ci]);if(!def)continue;
    var card=document.createElement('div');
    card.className='tk-card '+(def.kind==='key'?'key':'ticket');
    var art=def.iconPng
      ?'<img src="'+def.iconPng+'" style="width:60%;image-rendering:pixelated;margin:6px 0 2px">'
      :'<div class="tk-icon">'+def.icon+'</div>';
    card.innerHTML='<div class="tk-kind">'+(def.kind==='key'?'KEY':'TICKET')+'</div>'
      +art+'<div class="tk-cname">'+def.name+'</div><div class="tk-cdesc">'+def.desc+'</div>';
    crow.appendChild(card);
    var ce={def:def,el:card,used:false};
    (function(c){card.addEventListener('click',function(){_tkSelectCard(c);});})(ce);
    _tkOv.cards.push(ce);
  }

  ov.style.display='flex';
  if(opts.autoSelect&&_tkOv.cards.length)_tkSelectCard(_tkOv.cards[0]);
  else _tkUpdateHint();
}

function _tkSelectCard(ce){
  if(_tkBusy||!_tkOv||ce.used)return;
  _playTileClick('select');
  if(_tkOv.selCard===ce){_tkClearCardSel();_tkUpdateHint();return;}
  _tkClearCardSel();
  _tkOv.selCard=ce;
  ce.el.classList.add('tk-sel');
  var b=document.createElement('button');
  b.className='tk-use-btn';b.textContent='USE';
  b.onclick=function(e){e.stopPropagation();_tkTryUse();};
  ce.el.appendChild(b);
  document.getElementById('tk-tiles-row').classList.toggle('tk-targeting',!!ce.def.sel);
  if(!ce.def.sel)_tkClearTileSel();
  _tkUpdateHint();
}

function _tkClearCardSel(){
  if(!_tkOv)return;
  if(_tkOv.selCard){
    _tkOv.selCard.el.classList.remove('tk-sel');
    var b=_tkOv.selCard.el.querySelector('.tk-use-btn');
    if(b)b.parentNode.removeChild(b);
  }
  _tkOv.selCard=null;
  document.getElementById('tk-tiles-row').classList.remove('tk-targeting');
}

function _tkClearTileSel(){
  if(!_tkOv)return;
  _tkOv.selTiles.forEach(function(e){_tkSetTileSel(e,false);});
  _tkOv.selTiles=[];
}

function _tkSetTileSel(entry,on){
  entry.el.classList.toggle('tk-tile-sel',on);
  entry.el.style.transform=entry.baseTf+(on?' translateY(-12px) scale(1.06)':'');
}

function _tkTileClick(entry){
  if(_tkBusy||!_tkOv||entry.dead)return;
  var ce=_tkOv.selCard;
  if(!ce||!ce.def.sel)return;
  _playTileClick('select');
  var ix=_tkOv.selTiles.indexOf(entry);
  if(ix>=0){_tkSetTileSel(entry,false);_tkOv.selTiles.splice(ix,1);}
  else{
    // At the cap: swap out the oldest selection instead of blocking.
    if(_tkOv.selTiles.length>=ce.def.sel.n){
      var old=_tkOv.selTiles.shift();
      _tkSetTileSel(old,false);
    }
    _tkOv.selTiles.push(entry);
    _tkSetTileSel(entry,true);
  }
  _tkUpdateHint();
}

function _tkUpdateHint(){
  var h=document.getElementById('tk-hint');if(!h||!_tkOv)return;
  var ce=_tkOv.selCard;
  if(!ce){h.textContent=_tkOv.picks>0?'Pick a card':'';return;}
  if(ce.def.sel){
    var min=ce.def.sel.min||ce.def.sel.n,max=ce.def.sel.n;
    var want=min===max?min:(min+'-'+max);
    h.textContent='Select '+want+' tile'+(max>1?'s':'')+' above ('+_tkOv.selTiles.length+' selected), then press USE';
  }else h.textContent='Press USE to redeem';
}

function _tkTryUse(){
  if(_tkBusy||!_tkOv)return;
  var ce=_tkOv.selCard;if(!ce)return;
  var def=ce.def;
  var reason=def.canUse?def.canUse(_tkOv):null;
  if(!reason&&def.sel){
    var alive=_tkOv.tiles.filter(function(e){return !e.dead;});
    var min=def.sel.min||def.sel.n;
    if(!alive.length)reason='No tiles to target!';
    else if(_tkOv.selTiles.length<min)reason='Select '+min+' tile'+(min>1?'s':'')+' first!';
  }
  if(!reason&&!def.sel&&(def.id==='tk_shredder'||def.id==='ky_rust')&&!_tkOv.tiles.some(function(e){return !e.dead;}))
    reason='No tiles to destroy!';
  if(reason){toast(reason);return;}

  // Selected tiles resolve in DISPLAY order (left→right) — the Alchemist's
  // left/right rule depends on this.
  var sel=_tkOv.selTiles.slice().sort(function(a,b){
    return _tkOv.tiles.indexOf(a)-_tkOv.tiles.indexOf(b);
  });
  _tkOv.selTiles=[];
  sel.forEach(function(e){e.el.classList.remove('tk-tile-sel');e.el.style.transform=e.baseTf;});

  // Inventory item is consumed up front so slot-room checks inside use()
  // (Lucky Draw, Encore) see the freed slot.
  if(_tkOv.source==='inv'&&!_tkOv.invConsumed){
    S.consumables.splice(_tkOv.invIndex,1);
    _tkOv.invConsumed=true;
  }
  _tkBusy=true;
  var dur=def.use(sel,_tkOv)||600;
  if(def.kind==='ticket'&&def.id!=='tk_encore')S.lastTicket=def.id;
  setTimeout(function(){_tkAfterUse(ce);},dur);
}

function _tkAfterUse(ce){
  _tkBusy=false;
  if(!_tkOv)return;
  ce.used=true;
  _tkClearCardSel();
  ce.el.classList.add('tk-used');
  _tkOv.picks--;
  renderHUD();renderStampBar();renderConsumables();
  var bc=document.getElementById('bag-count');if(bc)bc.textContent=S.bag.length;
  if(typeof saveGame==='function'&&S.phase==='play')saveGame();
  if(_tkOv.picks<=0)setTimeout(_tkCloseOverlay,400);
  else _tkUpdateHint();
}

function _tkSkipOverlay(){
  if(_tkBusy)return;
  _tkCloseOverlay();
}

function _tkCloseOverlay(){
  var ov=document.getElementById('tk-overlay');
  if(ov)ov.style.display='none';
  _tkOv=null;_tkBusy=false;
  if(typeof S!=='undefined'&&S.phase==='shop'){renderShop();renderHUD();}
  renderConsumables();
}

// ── Burn-off conversion animation ────────────────────────────────────────────
// The old face burns away (brighten → orange → gone, with embers) while the
// new face grows out of the middle. destroy=true burns to nothing and
// collapses the slot.
function _tkBurnSwap(entry,destroy,done){
  var el=entry.el;
  var old=el.querySelector('.tile');
  if(old){
    old.style.position='absolute';old.style.left='0';old.style.top='0';old.style.zIndex='2';
    old.style.animation='tkBurnOut 0.55s ease-in forwards';
  }
  _tkEmbers(el);
  if(destroy){
    entry.dead=true;
    setTimeout(function(){
      el.style.transition='opacity 0.2s ease,width 0.25s ease';
      el.style.opacity='0';el.style.width='0px';
      setTimeout(function(){
        if(el.parentNode)el.parentNode.removeChild(el);
        if(done)done();
      },280);
    },520);
  }else{
    var nf=_tkTileFace(entry.t,TK_TILE_SZ);
    nf.style.animation='tkNewIn 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.2s both';
    el.appendChild(nf);
    setTimeout(function(){
      if(old&&old.parentNode)old.parentNode.removeChild(old);
      if(done)done();
    },800);
  }
}

function _tkEmbers(el){
  for(var i=0;i<7;i++){
    var e=document.createElement('div');
    var ang=Math.random()*Math.PI*2,d=14+Math.random()*24;
    e.style.cssText='position:absolute;left:'+(20+Math.random()*60)+'%;top:'+(20+Math.random()*60)+'%;'
      +'width:4px;height:4px;border-radius:50%;background:'+(Math.random()<0.5?'#ffb050':'#ff6030')+';'
      +'pointer-events:none;z-index:3;'
      +'--ex:'+Math.round(Math.cos(ang)*d)+'px;--ey:'+Math.round(-Math.abs(Math.sin(ang))*d-16)+'px;'
      +'animation:tkEmber '+(0.5+Math.random()*0.4).toFixed(2)+'s ease-out forwards';
    el.appendChild(e);
    setTimeout((function(p){return function(){if(p.parentNode)p.parentNode.removeChild(p);};})(e),1000);
  }
}

// ── Hover tooltip (reuses the fixed shop tooltip element) ────────────────────
function _tkHoverTip(el,name,desc,fg){
  el.onmouseenter=function(){
    var tt=document.getElementById('shop-sticker-tooltip');if(!tt)return;
    document.getElementById('shoptt-name').textContent=name;
    document.getElementById('shoptt-name').style.color=fg||'#f0e080';
    document.getElementById('shoptt-desc').textContent=desc;
    tt.style.display='block';tt.style.opacity='0';
    requestAnimationFrame(function(){
      var w=tt.offsetWidth,h=tt.offsetHeight;
      var tr=el.getBoundingClientRect();
      var left=(tr.left+tr.right)/2-w/2;
      left=Math.max(8,Math.min(left,window.innerWidth-w-8));
      var top=tr.top-h-8;
      if(top<8)top=tr.bottom+8;
      tt.style.left=left+'px';tt.style.top=top+'px';
      tt.style.opacity='1';
    });
  };
  el.onmouseleave=function(){
    var tt=document.getElementById('shop-sticker-tooltip');
    if(tt){tt.style.opacity='0';tt.style.display='none';}
  };
}

// ── Dev helper (console): devGiveTk('tk_red') / devGiveTk() for a random one ──
function devGiveTk(id){
  if(!S.consumables)S.consumables=[];
  if(S.consumables.length>=TK_MAX){toast('Consumable slots full!');return;}
  var def=id?tkd(id):TK[Math.floor(Math.random()*TK.length)];
  if(!def){toast('Unknown consumable: '+id);return;}
  S.consumables.push({id:def.id});
  renderConsumables();
  toast(def.name+' added!');
}

// Auto-detect real sprite PNGs (same pattern as stickers/stamps in init.js).
(function(){
  for(var i=0;i<TK.length;i++){
    (function(def){
      var img=new Image();
      img.onload=function(){def.iconPng='Assets/consumables/'+def.id+'/'+def.id+'.png';};
      img.src='Assets/consumables/'+def.id+'/'+def.id+'.png';
    })(TK[i]);
  }
})();
