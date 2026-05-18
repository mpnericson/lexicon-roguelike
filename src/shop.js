// =====================================================================
// SHOP — sticker shop, packs, tile upgrades, forge, hammer
// =====================================================================
function freeSquare(){var c=[];for(var i=0;i<B*B;i++)if(!S.board[i])c.push(i);return c.length?c[Math.floor(Math.random()*c.length)]:-1;}

function wrand(pool,w){var arr=[];for(var i=0;i<SQ.length;i++){var d=SQ[i];if(pool.indexOf(d.id)<0)continue;var wt=Math.round((w[d.rarity]||0)*10);for(var j=0;j<wt;j++)arr.push(d.id);}return arr.length?arr[Math.floor(Math.random()*arr.length)]:null;}

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
    var id=arr[Math.floor(Math.random()*arr.length)];
    used[id]=1;out.push(id);
  }
  return out;
}

function refreshShop(){
  shopPool.sq=[];
  var sqIds=wrandN(SQ.map(function(d){return d.id;}),{common:5,uncommon:2,rare:0.8},3);
  for(var i=0;i<sqIds.length;i++)shopPool.sq.push({id:sqIds[i],sold:false});
  var offered=shuffle(['gold','blue','red']).slice(0,2);
  var vcosts={gold:4,blue:5,red:6};
  var tileLetters=shuffle(Object.keys(LS));
  shopPool.tileCards=offered.map(function(v,i){return{letter:tileLetters[i],variant:v,cost:vcosts[v],bought:false,id:uid()};});
  shopPool.tilePack={sold:false};
}

function enterShopPhase(){
  S.phase='shop';
  if(!shopPool.sq.length)refreshShop();
  renderShop();
  document.getElementById('shop-screen').style.display='flex';
}

function leaveShop(){
  document.getElementById('shop-screen').style.display='none';
  if(S.pendingSquares.length>0){enterPlacingPhase();}
  else{S.phase='play';}
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
  S.sqHand=[];S.sqStaged={};S.phase='play';
  document.getElementById('play-controls').style.display='flex';
  document.getElementById('placing-controls').style.display='none';
  document.getElementById('shuffle-btn').style.display='';
  HP.x=[];HP.vx=[];HP.tiles=[];
  renderHand();renderBoard();renderHUD();
  if(unplaced>0)toast(unplaced+' unplaced sticker'+(unplaced>1?'s':'')+' forfeited.');
}

function openShop(){enterShopPhase();}

function renderShop(){
  document.getElementById('shop-sub').textContent='Gold: $'+S.gold;
  var n=S.pendingSquares.length;
  var qbar=document.getElementById('shop-queue-bar');
  qbar.style.display=n>0?'block':'none';
  qbar.textContent=n+' sticker'+(n!==1?'s':'')+' queued — leave shop to place '+(n===1?'it':'them')+'.';
  var sc=document.getElementById('shop-cards');sc.innerHTML='';
  for(var i=0;i<shopPool.sq.length;i++){
    var item=shopPool.sq[i];var d=sqd(item.id);if(!d)continue;
    var rc=d.rarity==='rare'?'rr':d.rarity==='uncommon'?'ru':'rc';
    var card=document.createElement('div');card.className='shop-card';if(item.sold)card.style.opacity='0.4';
    card.innerHTML='<div class="scr '+rc+'">'+d.rarity+'</div><div class="scn" style="color:'+d.fg+'">'+d.icon+' '+d.name+'</div><div class="scd">'+d.desc+'</div><div class="scc">$'+d.cost+'</div>';
    if(!item.sold){var btn=document.createElement('button');btn.className='btn btn-gold';btn.style.cssText='padding:5px;font-size:11px;margin-top:0';btn.textContent='Buy';(function(j){btn.onclick=function(){buySq(j);};})(i);card.appendChild(btn);}
    sc.appendChild(card);
  }
  var varNames={gold:'Gold Tile',blue:'Blue Tile',red:'Red Tile'};
  var varDescs={gold:'+$1 when scored',blue:'Score grows each play',red:'Triggers twice'};
  var varFgs={gold:'#f0c060',blue:'#60b8ff',red:'#ff8080'};
  for(var i=0;i<shopPool.tileCards.length;i++){
    var tc=shopPool.tileCards[i];
    var card=document.createElement('div');card.className='shop-card';if(tc.bought)card.style.opacity='0.4';
    card.style.borderColor=tc.variant==='gold'?'#7a5800':tc.variant==='blue'?'#1a4080':'#7a1818';
    card.innerHTML='<div class="scr" style="color:'+varFgs[tc.variant]+'">'+varNames[tc.variant]+'</div>'
      +'<div class="scn" style="font-size:26px;color:'+varFgs[tc.variant]+'">'+tc.letter+'</div>'
      +'<div class="scd">'+varDescs[tc.variant]+'</div>'
      +'<div class="scp">Base: '+(LS[tc.letter]||0)+' pts</div>'
      +'<div class="scc">$'+tc.cost+'</div>';
    if(!tc.bought){var btn=document.createElement('button');btn.className='btn btn-gold';btn.style.cssText='padding:5px;font-size:11px;margin-top:0';btn.textContent='Buy';(function(j){btn.onclick=function(){buyTileCard(j);};})(i);card.appendChild(btn);}
    sc.appendChild(card);
  }
  var pr=document.getElementById('shop-packs-row');pr.innerHTML='';
  var ap=document.createElement('div');ap.className='pack-card';
  ap.innerHTML='<div class="pn">Sticker Pack</div><div class="pd">3 random stickers — choose one to keep.</div><div class="pc">$3</div>';
  ap.onclick=function(){buyArcanePack();};pr.appendChild(ap);
  var tp=document.createElement('div');tp.className='pack-card';if(shopPool.tilePack&&shopPool.tilePack.sold)tp.style.opacity='0.4';
  tp.innerHTML='<div class="pn">Tile Pack</div><div class="pd">5 tiles — mix of basic and enchanted.</div><div class="pc">$3</div>';
  if(!shopPool.tilePack||!shopPool.tilePack.sold)tp.onclick=function(){buyTilePack();};
  pr.appendChild(tp);
  var alBtn=document.getElementById('alchemist-btn');
  if(alBtn){var hasAl=false;for(var i=0;i<S.placed.length;i++)if(S.placed[i].id==='alchemist'){hasAl=true;break;}alBtn.style.display=hasAl?'block':'none';if(S.alchemistUsed)alBtn.style.opacity='0.4';}
}

function buyTileCard(i){
  var tc=shopPool.tileCards[i];if(!tc||tc.bought)return;
  if(!S.devMode&&S.gold<tc.cost){toast('Not enough gold!');return;}
  if(!S.devMode)S.gold-=tc.cost;tc.bought=true;
  S.bag.push({letter:tc.letter,isBlank:false,id:uid(),variant:tc.variant,blueBonus:0});
  S.bag=shuffle(S.bag);renderShop();renderHUD();document.getElementById('bag-count').textContent=S.bag.length;
  toast(tc.variant.charAt(0).toUpperCase()+tc.variant.slice(1)+' '+tc.letter+' added to bag!');
}

function buyArcanePack(){
  if(!S.devMode&&S.gold<3){toast('Not enough gold!');return;}
  if(!S.devMode)S.gold-=3;renderHUD();
  var contents=wrandN(SQ.map(function(d){return d.id;}),{common:4,uncommon:2,rare:1},3);
  openPackReveal('Sticker Pack',contents);
}

function buyTilePack(){
  if(!shopPool.tilePack||shopPool.tilePack.sold)return;
  if(!S.devMode&&S.gold<3){toast('Not enough gold!');return;}
  if(!S.devMode)S.gold-=3;shopPool.tilePack.sold=true;
  var packLetters=Object.keys(DIST);var varTypes=['gold','blue','red'];var added=[];
  for(var i=0;i<5;i++){
    var l=packLetters[Math.floor(Math.random()*packLetters.length)];
    var v=Math.random()<0.25?varTypes[Math.floor(Math.random()*varTypes.length)]:null;
    S.bag.push({letter:l,isBlank:false,id:uid(),variant:v,blueBonus:0});
    added.push((v?v[0].toUpperCase()+v.slice(1)+' ':'')+l);
  }
  S.bag=shuffle(S.bag);renderShop();renderHUD();document.getElementById('bag-count').textContent=S.bag.length;
  toast('Tile Pack: '+added.join(', ')+' added!');
}

function openHammerModal(){renderHammerModal();document.getElementById('hammer-modal').style.display='flex';}

function renderHammerModal(){
  var grid=document.getElementById('hammer-grid');grid.innerHTML='';
  var sorted=S.bag.slice().sort(function(a,b){return(a.letter||'_').localeCompare(b.letter||'_');});
  if(!sorted.length){grid.innerHTML='<div style="color:#8880a8;font-size:13px">Bag is empty!</div>';return;}
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
    var FORGE=[{v:'gold',label:'Gold',desc:'+$1 each time scored',cost:3,bg:'#6a4800'},{v:'blue',label:'Blue',desc:'Score grows by base pts each play',cost:4,bg:'#0a2a60'},{v:'red',label:'Red',desc:'Triggers twice (DW/TW doubles too)',cost:5,bg:'#601010'}];
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
    if(!avail.length){grid.innerHTML='<div style="color:#8880a8;font-size:13px">No plain tiles to enchant!</div>';return;}
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
  S.pendingSquares.push({id:item.id});renderShop();renderHUD();
  toast(d.name+' sticker queued — place it after leaving shop!');
}

function openPackReveal(name,contents){
  document.getElementById('pack-title').textContent=name;
  document.getElementById('shop-screen').style.display='none';
  var grid=document.getElementById('pack-reveal');grid.innerHTML='';
  for(var i=0;i<contents.length;i++){
    var d=sqd(contents[i]);if(!d)continue;
    var rc=d.rarity==='rare'?'rr':d.rarity==='uncommon'?'ru':'rc';
    var card=document.createElement('div');card.className='prc';
    card.innerHTML='<div style="font-size:20px;font-weight:bold;color:'+d.fg+'">'+d.icon+'</div><div style="font-size:13px;font-weight:bold;color:'+d.fg+'">'+d.name+'</div><div style="font-size:11px;color:#9090b0;margin:4px 0">'+d.desc+'</div><div class="scr '+rc+'" style="margin-top:4px">'+d.rarity+'</div>';
    (function(did,c){c.onclick=function(){S.pendingSquares.push({id:did});c.classList.add('chosen');c.textContent='Queued!';var cs=grid.getElementsByClassName('prc');for(var k=0;k<cs.length;k++){cs[k].style.pointerEvents='none';cs[k].style.opacity='0.4';}c.style.opacity='1';setTimeout(function(){document.getElementById('pack-modal').style.display='none';enterShopPhase();},600);};})(contents[i],card);
    grid.appendChild(card);
  }
  document.getElementById('pack-modal').style.display='flex';
}

function skipPack(){document.getElementById('pack-modal').style.display='none';enterShopPhase();}

function buyTile(i){
  var tl=shopPool.tiles[i];if(!tl||tl.bought)return;
  if(S.gold<3){toast('Not enough gold!');return;}
  S.gold-=3;tl.bought=true;S.bag.push({letter:tl.letter,isBlank:false,id:uid()});
  S.bag=shuffle(S.bag);renderShop();renderHUD();document.getElementById('bag-count').textContent=S.bag.length;
  toast(tl.letter+' added to bag!');
}

function refreshTileOffer(){
  if(S.gold<1){toast('Not enough gold!');return;}
  S.gold-=1;shopPool.tiles=shuffle(Object.keys(DIST)).slice(0,5).map(function(l){return{letter:l,bought:false};});
  renderShop();renderHUD();
}

function hammerTile(tile){
  if(!S.devMode&&S.gold<3){toast('Not enough gold!');return;}
  var idx=-1;for(var i=0;i<S.bag.length;i++)if(S.bag[i].id===tile.id){idx=i;break;}
  if(idx<0){toast('Tile not found.');return;}
  if(!S.devMode)S.gold-=3;S.bag.splice(idx,1);
  renderShop();renderHUD();document.getElementById('bag-count').textContent=S.bag.length;
  toast((tile.isBlank?'Blank':tile.letter)+' destroyed!');
}

function closeShop(){document.getElementById('shop-screen').style.display='none';S.phase='play';}
