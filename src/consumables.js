// =====================================================================
// CONSUMABLES — Tickets & Keys (this game's tarots/spectrals)
// Bought as shop packs (small: 3 choose 1 · regular: 5 choose 1 · large:
// 5 choose 2). Opening a pack shows 7 random bag tiles fanned on top and
// the rolled tickets/keys as cards beneath — tile-targeted effects apply
// to the shown tiles. Created tickets go to S.consumables (max TK_MAX).
// Using one from the inventory during play acts on the hand directly (no
// overlay): click-selected tiles are the targets. In the shop the same
// overlay is reused since the hand isn't visible there.
// Placeholder art: CSS cards + emoji icons; real sprites auto-detected at
// Assets/consumables/{id}/{id}.png (same pattern as stickers/stamps).
// =====================================================================

var TK_MAX=2;      // consumable inventory slots
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
  for(var i=0;i<BN;i++){w(S.bt[i]);if(S.btTop)w(S.btTop[i]);}
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
      (S.stamps||[]).forEach(function(ts){var d=sqd(ts.id);g+=Math.floor(((d&&d.cost)||4)/2)+(ts.sellBonus||0);});
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
// Tile packs reveal more tiles per size but keep the same $3/$5/$7 costs.
var TK_TILE_PACK_SIZES={
  small:  {label:'Small',  show:5,pick:1,cost:3},
  regular:{label:'Regular',show:8,pick:1,cost:5},
  large:  {label:'Large',  show:8,pick:2,cost:7}
};
// Sticker packs keep the ticket show/pick counts but cost $1 more per size.
var TK_STICKER_PACK_SIZES={
  small:  {label:'Small',  show:3,pick:1,cost:4},
  regular:{label:'Regular',show:5,pick:1,cost:6},
  large:  {label:'Large',  show:5,pick:2,cost:8}
};
// Each shop slot rolls independently: kind first (ticket 50% / tile 27% /
// sticker 20% / key 3%), then size (50% small / 30% regular / 20% large).
var TK_KEY_CHANCE=0.03;
var TK_TILE_CHANCE=0.27;
var TK_STICKER_CHANCE=0.20;
var TK_SIZE_ODDS=[{size:'small',p:0.5},{size:'regular',p:0.3},{size:'large',p:0.2}];
// A pack tile rolls a uniform letter, then independently 15% a random colour
// and 1% a random material (the two axes stack).
var TK_TILE_COLORS=['red','blue','gold','jade','purple'];
var TK_TILE_MATERIALS=['metallic','glass','varnished'];
var TK_TILE_COLOR_CHANCE=0.15;
var TK_TILE_MATERIAL_CHANCE=0.01;

function _tkRollShopPacks(n){
  var out=[];
  for(var k=0;k<n;k++){
    var kr=_rng(),kind;
    if(kr<TK_KEY_CHANCE)kind='key';
    else if(kr<TK_KEY_CHANCE+TK_TILE_CHANCE)kind='tile';
    else if(kr<TK_KEY_CHANCE+TK_TILE_CHANCE+TK_STICKER_CHANCE)kind='sticker';
    else kind='ticket';
    var r=_rng(),acc=0,size=TK_SIZE_ODDS[TK_SIZE_ODDS.length-1].size;
    for(var i=0;i<TK_SIZE_ODDS.length;i++){acc+=TK_SIZE_ODDS[i].p;if(r<acc){size=TK_SIZE_ODDS[i].size;break;}}
    var sz=(kind==='tile'?TK_TILE_PACK_SIZES:kind==='sticker'?TK_STICKER_PACK_SIZES:TK_PACK_SIZES)[size];
    var kindLabel=kind==='key'?'Key':kind==='tile'?'Tile':kind==='sticker'?'Sticker':'Ticket';
    out.push({kind:kind,size:size,
      label:sz.label+' '+kindLabel+' Pack',
      cost:sz.cost,show:sz.show,pick:sz.pick,sold:false});
  }
  return out;
}

// Wraps a board-sticker def in the tk-card shape so sticker packs reuse the
// ticket/key overlay; USE routes the pick through addPrizeFromShop.
function _tkStickerCardDef(id){
  var d=sqd(id);if(!d)return null;
  return{id:id,kind:'sticker',name:d.name,desc:d.desc,icon:d.icon,iconPng:d.iconPng,
    use:function(){
      addPrizeFromShop(id);
      var qty=d.qty||1;
      toast((qty>1?qty+'× ':'')+d.name+' queued — place '+(qty>1?'them':'it')+' after leaving shop!');
      return 600;
    }};
}

function buyTkPack(i){
  var p=(shopPool.tkPacks||[])[i];if(!p||p.sold)return;
  if(typeof _trayIsOpen!=='undefined'&&_trayIsOpen){toast('Close the tray first!');return;}
  if(!spendGold(p.cost))return;
  p.sold=true;
  renderShop();renderHUD();
  if(p.kind==='tile'){_tkOpenTileOverlay(p);return;}
  if(p.kind==='sticker'){
    // Stickers only (no stamps), shop-shelf rarity weights.
    var stickers=wrandN(_stickersByRarity(['common','uncommon','rare','legendary']),
      {common:5,uncommon:2,rare:0.8,legendary:0.1},p.show);
    _tkOpenOverlay({cards:stickers,picks:p.pick,source:'pack',title:p.label,sq:true});
    return;
  }
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
    var emoji=p.kind==='key'?'🗝️':p.kind==='tile'?'🔤':p.kind==='sticker'?'🏷️':'🎟️';
    var color=p.kind==='key'?'#9ab8ff':p.kind==='tile'?'#8fe0a0':p.kind==='sticker'?'#a8e048':'#f0c060';
    box.innerHTML='<div class="tk-pack-art '+p.kind+'">'
      +'<span class="tk-pack-emoji">'+emoji+'</span>'
      +'<span class="tk-pack-size">'+TK_PACK_SIZES[p.size].label+'</span></div>'
      +'<div class="shop-pack-cost" style="color:'+color+'">$'+p.cost+'</div>';
    box.className='shop-pack-box'+(p.sold?' sold':'');
    var tip=p.kind==='tile'
      ?'Reveals '+p.show+' tiles — choose '+(p.pick>1?'up to '+p.pick:'1')+' to add to your bag.'
      :p.kind==='sticker'
      ?'Opens '+p.show+' stickers — choose '+p.pick+' to place on your board.'
      :'Opens '+p.show+' '+(p.kind==='key'?'keys':'tickets')+' — choose '+p.pick+'.';
    _tkHoverTip(box,p.label,tip,color);
    if(!p.sold){(function(idx){box.onclick=function(){buyTkPack(idx);};})(i);}else box.onclick=null;
  }
}

// ── Inventory ────────────────────────────────────────────────────────────────
// Click a mini to arm it (USE button appears), click again to disarm.
// _tkInvSel is the armed inventory index (-1 = none); it survives a blocked
// use (e.g. no hand tiles selected yet) so the player can fix it and retry.
var _tkInvSel=-1;

function renderConsumables(){
  var inv=S.consumables||[];
  if(_tkInvSel>=inv.length)_tkInvSel=-1;
  var targets=[
    {el:document.getElementById('consumable-row'),mini:'tk-mini',play:true},
    {el:document.getElementById('shop-consumables'),mini:'tk-mini'}
  ];
  targets.forEach(function(tg){
    var row=tg.el;if(!row)return;
    row.innerHTML='';
    row.style.display=inv.length?'flex':'none';
    inv.forEach(function(c,i){
      var d=tkd(c.id);if(!d)return;
      var m=document.createElement('div');
      m.className=tg.mini+' '+(d.kind==='key'?'key':'ticket')+(i===_tkInvSel?' tk-sel':'');
      m.innerHTML=d.iconPng
        ?'<img src="'+d.iconPng+'" style="width:80%;image-rendering:pixelated;pointer-events:none">'
        :'<span style="pointer-events:none">'+d.icon+'</span>';
      if(i===_tkInvSel){
        var b=document.createElement('button');
        b.className='tk-use-btn mini';b.textContent='USE';
        b.onclick=function(e){e.stopPropagation();useConsumable(i);};
        m.appendChild(b);
      }
      _tkHoverTip(m,d.name,d.desc+(d.sel&&S.phase==='play'?' (select hand tiles, then click + USE)':' (click, then USE)'),d.fg);
      m.onclick=function(){
        if(window._scoring||_tkOv||_tkBusy)return;
        _tkInvSel=(_tkInvSel===i)?-1:i;
        if(typeof _playTileClick==='function')_playTileClick('select');
        renderConsumables();
      };
      row.appendChild(m);
    });
    // Shop view keeps its inline counter (only when there are consumables). The
    // play-view counter is handled separately below so it can show at 0.
    if(inv.length&&!tg.play){
      var ctr=document.createElement('span');
      ctr.className='tk-mini-count';
      ctr.textContent=inv.length+'/'+TK_MAX;
      row.appendChild(ctr);
    }
  });
  // Play-view "n/2" counter: anchored to the consumable tray's bottom-right corner
  // (fill ends at x=190/256=74.22% / y=22/160=13.75% of the 256×160 mainui art,
  // stretched to 100vw×100vh) and ALWAYS shown — even at 0, mirroring the stamp
  // "0/5". It lives on #hotbar-row rather than #consumable-row, which is display:none
  // when empty (a display:none parent would hide even a fixed child). The opaque
  // #shop-screen overlay (z-index 200) covers it in the shop, and focus mode fades
  // it out — exactly like the stamp counter.
  var hb=document.getElementById('hotbar-row');
  if(hb){
    var pctr=document.getElementById('consumable-count');
    if(!pctr){pctr=document.createElement('div');pctr.id='consumable-count';hb.appendChild(pctr);}
    pctr.style.cssText='position:fixed;left:calc(74.22vw - 8px);top:calc(13.75vh - 4px);transform:translate(-100%,-100%);font-size:clamp(13px,3vh,28px);color:#8880a8;pointer-events:none;line-height:1;z-index:6';
    pctr.textContent=inv.length+'/'+TK_MAX;
  }
  _tkTipHideStale();
}

function useConsumable(i){
  if(window._scoring)return;
  if(_tkOv||_tkBusy)return;
  var c=(S.consumables||[])[i];if(!c)return;
  var def=tkd(c.id);if(!def)return;
  // Play phase: no overlay — the consumable acts on the hand directly
  // (click-selected tiles are the targets). The overlay is kept for the
  // shop, where the hand isn't visible.
  if(S.phase==='play'){_tkUseFromHand(i,def);return;}
  _tkInvSel=-1;renderConsumables();
  _tkOpenOverlay({cards:[c.id],picks:1,source:'inv',invIndex:i,title:def.name,autoSelect:true});
}

// ── Inventory use during play (no overlay) ───────────────────────────────────
// Targets are the real hand tiles: tile-targeted consumables act on the
// tiles the player has click-selected (same selection as discard, resolved
// left→right for the Alchemist), random-destroy ones roll over the whole
// hand. Reuses the defs' use(sel,st) interface — entries carry handMode so
// _tkBurnSwap animates the live .hand-tile element instead of overlay cards.
function _tkUseFromHand(invIndex,def){
  var entries=[];
  for(var hi=0;hi<S.hand.length;hi++){
    var t=S.hand[hi];
    if(!t||t.state!=='hand')continue;
    var el=document.querySelector('#hand-area [data-tile-id="'+t.id+'"]');
    entries.push({t:t,el:el||document.createElement('div'),dead:false,baseTf:'',handMode:true,wasSel:!!t.sel});
  }
  var st={source:'inv',tiles:entries,handMode:true};
  var sel=entries.filter(function(e){return e.wasSel;});
  var reason=def.canUse?def.canUse(st):null;
  if(!reason&&def.sel){
    var min=def.sel.min||def.sel.n;
    if(!entries.length)reason='No tiles in your hand!';
    else if(sel.length<min)reason='Select '+min+' tile'+(min>1?'s':'')+' in your hand first!';
    else if(sel.length>def.sel.n)reason='Select at most '+def.sel.n+' tile'+(def.sel.n>1?'s':'')+'!';
  }
  if(!reason&&!def.sel&&(def.id==='tk_shredder'||def.id==='ky_rust')&&!entries.length)
    reason='No tiles to destroy!';
  if(reason){toast(reason);return;}
  if(!def.sel)sel=[];
  sel.forEach(function(e){e.t.sel=false;});
  _tkInvSel=-1;
  // Consumed up front so slot-room checks inside use() (Lucky Draw, Encore)
  // see the freed slot — same order as the overlay path.
  S.consumables.splice(invIndex,1);
  renderConsumables();
  _tkBusy=true;
  if(typeof discMarkTk==='function')discMarkTk(def);
  var dur=def.use(sel,st)||600;
  if(def.kind==='ticket'&&def.id!=='tk_encore')S.lastTicket=def.id;
  setTimeout(function(){
    _tkBusy=false;
    renderHand();renderHUD();renderStampBar();renderConsumables();
    var bc=document.getElementById('bag-count');if(bc)bc.textContent=S.bag.length;
    sel.forEach(function(e){
      if(e.dead)return;
      var el=document.querySelector('#hand-area [data-tile-id="'+e.t.id+'"]');
      if(el)el.style.animation='tkNewIn 0.5s cubic-bezier(0.34,1.56,0.64,1)';
    });
    if(S.phase==='play'&&typeof saveGame==='function')saveGame();
  },dur);
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
  // Sticker packs (opts.sq) have no tile targets, so the row stays hidden.
  var row=document.getElementById('tk-tiles-row');row.innerHTML='';row.style.display=opts.sq?'none':'';
  var samp=opts.sq?[]:S.bag.slice();
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
  if(!samp.length&&!opts.sq)row.innerHTML='<div style="color:#8880a8;font-size:26px">Your bag is empty</div>';

  var crow=document.getElementById('tk-cards-row');crow.innerHTML='';crow.classList.remove('tk-tile-mode');
  for(var ci=0;ci<opts.cards.length;ci++){
    var def=opts.sq?_tkStickerCardDef(opts.cards[ci]):tkd(opts.cards[ci]);if(!def)continue;
    var card=document.createElement('div');
    card.className='tk-card '+(def.kind==='key'?'key':def.kind==='sticker'?'sticker':'ticket');
    var art=def.iconPng
      ?'<img src="'+def.iconPng+'" style="width:60%;image-rendering:pixelated;margin:6px 0 2px">'
      :'<div class="tk-icon">'+def.icon+'</div>';
    card.innerHTML='<div class="tk-kind">'+(def.kind==='key'?'KEY':def.kind==='sticker'?'STICKER':'TICKET')+'</div>'
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
  if(typeof discMarkTk==='function')discMarkTk(def);
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
  var take=document.getElementById('tk-take-btn');if(take&&take.parentNode)take.parentNode.removeChild(take);
  _tkOv=null;_tkBusy=false;
  if(typeof S!=='undefined'&&S.phase==='shop'){renderShop();renderHUD();}
  renderConsumables();
}

// ── Tile pack overlay ─────────────────────────────────────────────────────────
// A tile pack reveals `show` freshly rolled tiles; the player picks `pick` of
// them to add permanently to the bag. Reuses the #tk-overlay shell — the bag-
// tile row is hidden since the pack tiles are the choices themselves.
function _tkRollPackTile(){
  var letters=Object.keys(DIST);
  var letter=letters[Math.floor(_rng()*letters.length)];
  var variant=_rng()<TK_TILE_COLOR_CHANCE?TK_TILE_COLORS[Math.floor(_rng()*TK_TILE_COLORS.length)]:null;
  var material=_rng()<TK_TILE_MATERIAL_CHANCE?TK_TILE_MATERIALS[Math.floor(_rng()*TK_TILE_MATERIALS.length)]:null;
  return{letter:letter,isBlank:false,variant:variant,material:material};
}

function _tkTileName(t){
  var n=t.isBlank?'Blank':t.letter;
  if(t.variant)n=t.variant.charAt(0).toUpperCase()+t.variant.slice(1)+' '+n;
  if(t.material)n=t.material.charAt(0).toUpperCase()+t.material.slice(1)+' '+n;
  return n;
}

function _tkOpenTileOverlay(p){
  var ov=document.getElementById('tk-overlay');if(!ov||_tkOv)return;
  _tkOv={mode:'tile',pick:p.pick,entries:[],selTiles:[],source:'pack'};
  document.getElementById('tk-ov-name').textContent=p.label;
  document.getElementById('tk-ov-picks').textContent=p.pick>1?('Choose up to '+p.pick):'Choose 1';
  document.getElementById('tk-skip-btn').textContent='Skip';

  var trow=document.getElementById('tk-tiles-row');trow.innerHTML='';trow.style.display='none';

  var crow=document.getElementById('tk-cards-row');crow.innerHTML='';crow.classList.add('tk-tile-mode');
  for(var ci=0;ci<p.show;ci++){
    var t=_tkRollPackTile();
    var wrap=document.createElement('div');
    wrap.className='tk-tilepack-card';
    wrap.appendChild(_tkTileFace(t,84));
    var lbl=document.createElement('div');
    lbl.className='tk-tilepack-label';
    lbl.textContent=(t.variant||t.material)?_tkTileName(t):'';
    wrap.appendChild(lbl);
    crow.appendChild(wrap);
    var entry={t:t,el:wrap};
    (function(e){wrap.addEventListener('click',function(){_tkTilePackClick(e);});})(entry);
    _tkOv.entries.push(entry);
  }

  var footer=document.getElementById('tk-ov-footer');
  var take=document.createElement('button');
  take.id='tk-take-btn';take.className='btn btn-green';
  take.style.cssText='width:auto;padding:8px 24px;margin:0';
  take.textContent='TAKE';take.disabled=true;
  take.onclick=function(){_tkTilePackTake();};
  footer.insertBefore(take,document.getElementById('tk-skip-btn'));

  ov.style.display='flex';
  _tkTilePackHint();
}

function _tkTilePackClick(entry){
  if(_tkBusy||!_tkOv||_tkOv.mode!=='tile')return;
  _playTileClick('select');
  var ix=_tkOv.selTiles.indexOf(entry);
  if(ix>=0){entry.el.classList.remove('tk-sel');_tkOv.selTiles.splice(ix,1);}
  else{
    // At the cap: swap out the oldest selection instead of blocking.
    if(_tkOv.selTiles.length>=_tkOv.pick){var old=_tkOv.selTiles.shift();old.el.classList.remove('tk-sel');}
    _tkOv.selTiles.push(entry);entry.el.classList.add('tk-sel');
  }
  _tkTilePackHint();
}

function _tkTilePackHint(){
  if(!_tkOv||_tkOv.mode!=='tile')return;
  var h=document.getElementById('tk-hint');
  var max=_tkOv.pick,have=_tkOv.selTiles.length,ready=have>=1;
  if(h)h.textContent=ready
    ?'Press TAKE to add '+(have>1?'these tiles':'this tile')+' to your bag'
    :(max>1?'Select up to '+max+' tiles above':'Select a tile above');
  var btn=document.getElementById('tk-take-btn');if(btn)btn.disabled=!ready;
}

function _tkTilePackTake(){
  if(_tkBusy||!_tkOv||_tkOv.mode!=='tile')return;
  if(!_tkOv.selTiles.length){toast('Select a tile first!');return;}
  var sel=_tkOv.selTiles.slice(),added=[];
  sel.forEach(function(e){
    addTileToBag({letter:e.t.letter,isBlank:e.t.isBlank,variant:e.t.variant,material:e.t.material});
    added.push(_tkTileName(e.t));
    var f=e.el.querySelector('.tile');if(f)f.style.animation='tkNewIn 0.5s cubic-bezier(0.34,1.56,0.64,1)';
  });
  S.bag=shuffle(S.bag);
  var bc=document.getElementById('bag-count');if(bc)bc.textContent=S.bag.length;
  if(typeof _rankObserve==='function')_rankObserve();
  if(typeof saveGame==='function')saveGame();
  toast('Added to bag: '+added.join(', ')+'!');
  _tkBusy=true;
  setTimeout(function(){_tkBusy=false;_tkCloseOverlay();},560);
}

// ── Burn-off conversion animation ────────────────────────────────────────────
// The old face burns away (brighten → orange → gone, with embers) while the
// new face grows out of the middle. destroy=true burns to nothing and
// collapses the slot.
function _tkBurnSwap(entry,destroy,done){
  if(entry.handMode)return _tkHandBurn(entry,destroy,done);
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

// Hand-mode burn: entry.el is the live .hand-tile itself (or a detached
// dummy if the tile was mid-flight). It only plays the burn-away — the
// post-use renderHand in _tkUseFromHand redraws the new face and pops it in.
function _tkHandBurn(entry,destroy,done){
  if(destroy)entry.dead=true;
  var el=entry.el;
  if(el&&el.parentNode){
    _tkEmbers(el);
    el.style.animation='tkBurnOut 0.55s ease-in forwards';
  }
  if(done)setTimeout(done,800);
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
// tt._tkOwner tracks which element opened the tooltip: if that element is
// removed mid-hover (inventory re-render after a use), mouseleave never
// fires, so _tkTipHideStale() hides the orphaned tooltip instead.
function _tkHoverTip(el,name,desc,fg){
  el.onmouseenter=function(){
    var tt=document.getElementById('shop-sticker-tooltip');if(!tt)return;
    tt._tkOwner=el;
    document.getElementById('shoptt-name').textContent=name;
    document.getElementById('shoptt-name').style.color=fg||'#f0e080';
    document.getElementById('shoptt-desc').textContent=desc;
    tt.style.display='block';tt.style.opacity='0';
    requestAnimationFrame(function(){
      positionDescTip(tt,el); // float to the LEFT of the item, vertically centred
      tt.style.opacity='1';
    });
  };
  el.onmouseleave=function(){
    var tt=document.getElementById('shop-sticker-tooltip');
    if(tt){tt.style.opacity='0';tt.style.display='none';tt._tkOwner=null;}
  };
}

function _tkTipHideStale(){
  var tt=document.getElementById('shop-sticker-tooltip');
  if(tt&&tt._tkOwner&&!document.contains(tt._tkOwner)){
    tt.style.opacity='0';tt.style.display='none';tt._tkOwner=null;
  }
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
