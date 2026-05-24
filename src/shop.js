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

function refreshShop(){
  shopPool.sq=[];
  var sqIds=wrandN(SQ.map(function(d){return d.id;}),{common:5,uncommon:2,rare:0.8,legendary:0.1},3);
  for(var i=0;i<sqIds.length;i++)shopPool.sq.push({id:sqIds[i],sold:false});
  var offered=shuffle(['gold','blue','red']).slice(0,2);
  var vcosts={gold:4,blue:5,red:6};
  var tileLetters=shuffle(Object.keys(LS));
  shopPool.tileCards=offered.map(function(v,i){return{letter:tileLetters[i],variant:v,cost:vcosts[v],bought:false,id:uid()};});
  shopPool.tilePack={sold:false};
  shopPool.sqPacks={dl:{sold:false},tl:{sold:false},dw:{sold:false},tw:{sold:false}};
  var bwCopy=BOUNTY_WORDS.slice();
  for(var i=bwCopy.length-1;i>0;i--){var j=Math.floor(_rng()*(i+1));var tmp=bwCopy[i];bwCopy[i]=bwCopy[j];bwCopy[j]=tmp;}
  var activeWords=(S.bounties||[]).map(function(b){return b.word;});
  var BVARIANTS=['gold','red','blue'];
  shopPool.bounties=bwCopy.filter(function(b){return activeWords.indexOf(b.word)<0;}).slice(0,3).map(function(b){
    var variant=_rng()<0.05?BVARIANTS[Math.floor(_rng()*BVARIANTS.length)]:null;
    return{word:b.word,cost:b.cost+(variant?1:0),reward:b.reward+(variant?2:0),accepted:false,variant:variant||null};
  });
}

function enterShopPhase(){
  S.phase='shop';
  if(!shopPool.sq.length)refreshShop();
  renderShop();
  document.getElementById('shop-screen').style.display='flex';
}

function leaveShop(){
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
  document.getElementById('shop-sub').textContent='Gold: $'+S.gold;
  var n=S.pendingSquares.length;
  var qbar=document.getElementById('shop-queue-bar');
  qbar.style.display=n>0?'block':'none';
  qbar.textContent=n+' sticker'+(n!==1?'s':'')+' queued — leave shop to place '+(n===1?'it':'them')+'.';
  var sc=document.getElementById('shop-cards');sc.innerHTML='';
  for(var i=0;i<shopPool.sq.length;i++){
    var item=shopPool.sq[i];var d=sqd(item.id);if(!d)continue;
    var rc=d.rarity==='legendary'?'rl':d.rarity==='rare'?'rr':d.rarity==='uncommon'?'ru':'rc';
    var qty=d.qty||1;
    var card=document.createElement('div');card.className='shop-card';if(item.sold)card.style.opacity='0.4';
    var qtyBadge=qty>1?'<span style="color:#f0e080;font-weight:normal">'+qty+'×</span> ':'';
    card.innerHTML='<div class="scr '+rc+'">'+d.rarity+'</div><div class="scn" style="color:'+d.fg+'">'+sqIconHTML(d,20)+' '+qtyBadge+d.name+'</div><div class="scd">'+d.desc+'</div><div class="scc">$'+d.cost+'</div>';
    if(!item.sold){var btn=document.createElement('button');btn.className='btn btn-gold';btn.style.cssText='padding:5px;font-size:30px;margin-top:0';btn.textContent='Buy';(function(j){btn.onclick=function(){buySq(j);};})(i);card.appendChild(btn);}
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
    if(!tc.bought){var btn=document.createElement('button');btn.className='btn btn-gold';btn.style.cssText='padding:5px;font-size:30px;margin-top:0';btn.textContent='Buy';(function(j){btn.onclick=function(){buyTileCard(j);};})(i);card.appendChild(btn);}
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
  var bsqPacks=[
    {id:'dl',label:'6× Double Letter',desc:'6 DL squares — letter scores ×2.'},
    {id:'tl',label:'4× Triple Letter',desc:'4 TL squares — letter scores ×3.'},
    {id:'dw',label:'3× Double Word',desc:'3 DW squares — word scores ×2.'},
    {id:'tw',label:'2× Triple Word',desc:'2 TW squares — word scores ×3.'},
  ];
  for(var bpi=0;bpi<bsqPacks.length;bpi++){(function(bp){
    var d=sqd(bp.id);if(!d)return;
    var sold=shopPool.sqPacks&&shopPool.sqPacks[bp.id]&&shopPool.sqPacks[bp.id].sold;
    var pc=document.createElement('div');pc.className='pack-card';if(sold)pc.style.opacity='0.4';
    pc.innerHTML='<div class="pn" style="color:'+d.fg+'">'+bp.label+'</div><div class="pd">'+bp.desc+'</div><div class="pc">$3</div>';
    if(!sold)pc.onclick=function(){buyBonusSqPack(bp.id);};
    pr.appendChild(pc);
  })(bsqPacks[bpi]);}
  var br=document.getElementById('shop-bounties-row');br.innerHTML='';
  var bpool=shopPool.bounties||[];
  if(!bpool.length){br.innerHTML='<div style="color:#6060a0;font-size:30px;padding:6px">No bounties available this visit.</div>';}
  for(var bi=0;bi<bpool.length;bi++){
    var bitem=bpool[bi];
    var bcard=document.createElement('div');bcard.className='bounty-card';if(bitem.accepted)bcard.style.opacity='0.5';
    var _bvfg=bitem.variant==='gold'?'#f0c060':bitem.variant==='red'?'#ff8080':bitem.variant==='blue'?'#60b8ff':null;
    var _bvLabel=bitem.variant?'<div style="font-size:32px;color:'+_bvfg+';font-weight:normal;margin-bottom:2px">'+bitem.variant.toUpperCase()+' BOUNTY — converts a tile on completion</div>':'';
    bcard.innerHTML='<div style="font-size:28px;color:#9060b0;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">Bounty</div>'
      +_bvLabel
      +'<div style="margin:6px 0">'+wordAsTilesHTML(bitem.word,20)+'</div>'
      +'<div class="bounty-card-reward">Reward: +$'+bitem.reward+'</div>'
      +'<div class="bounty-card-cost">Cost: $'+bitem.cost+' to accept</div>';
    if(!bitem.accepted){var bbtn=document.createElement('button');bbtn.className='btn btn-gold';bbtn.style.cssText='padding:5px;font-size:30px;margin-top:0';bbtn.textContent='Accept';(function(j){bbtn.onclick=function(){acceptBounty(j);};})(bi);bcard.appendChild(bbtn);}
    else{bcard.innerHTML+='<div style="color:#60c060;font-size:28px;margin-top:4px">✓ Accepted</div>';}
    br.appendChild(bcard);
  }
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
    var l=packLetters[Math.floor(_rng()*packLetters.length)];
    var v=_rng()<0.25?varTypes[Math.floor(_rng()*varTypes.length)]:null;
    S.bag.push({letter:l,isBlank:false,id:uid(),variant:v,blueBonus:0});
    added.push((v?v[0].toUpperCase()+v.slice(1)+' ':'')+l);
  }
  S.bag=shuffle(S.bag);renderShop();renderHUD();document.getElementById('bag-count').textContent=S.bag.length;
  toast('Tile Pack: '+added.join(', ')+' added!');
}

function buyBonusSqPack(id){
  if(!shopPool.sqPacks||shopPool.sqPacks[id].sold)return;
  if(!S.devMode&&S.gold<3){toast('Not enough gold!');return;}
  if(!S.devMode)S.gold-=3;shopPool.sqPacks[id].sold=true;
  var d=sqd(id);var qty=(d&&d.qty)||1;
  for(var k=0;k<qty;k++)S.pendingSquares.push({id:id});
  renderShop();renderHUD();
  toast(qty+'× '+d.name+' queued — place them after leaving shop!');
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
