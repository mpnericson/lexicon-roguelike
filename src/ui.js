// =====================================================================
// UI — board preview, sticker collection, inspectors, dev tools
// =====================================================================
function toggleBoardTiles(){
  var wrap=document.getElementById('board-wrap');
  var btn=document.getElementById('board-tile-toggle-btn');
  var hidden=wrap.classList.toggle('tiles-hidden');
  btn.textContent=hidden?'Show Tiles':'Hide Tiles';
}

function togglePreviewTiles(){
  var wrap=document.getElementById('board-preview-wrap');
  var btn=document.getElementById('preview-tile-toggle-btn');
  var hidden=wrap.classList.toggle('tiles-hidden');
  btn.textContent=hidden?'Show Tiles':'Hide Tiles';
}

function openBoardPreview(){
  var wrap=document.getElementById('board-preview-wrap');
  wrap.classList.remove('tiles-hidden');
  var btn=document.getElementById('preview-tile-toggle-btn');
  if(btn)btn.textContent='Hide Tiles';
  renderBoardPreview();
  document.getElementById('board-preview-modal').style.display='flex';
}

function renderBoardPreview(){
  var wrap=document.getElementById('board-preview-wrap');
  var sz=Math.max(18,Math.min(32,Math.floor(Math.min(window.innerWidth-120,window.innerHeight-160)/B)));
  wrap.style.gridTemplateColumns='repeat('+B+','+sz+'px)';wrap.innerHTML='';
  var center=Math.floor(B/2)*B+Math.floor(B/2);
  for(var i=0;i<B*B;i++){
    var sq=document.createElement('div');sq.className='sq';sq.style.width=sz+'px';sq.style.height=sz+'px';
    var sid=S.board[i];var ss=sqStyle(sid);sq.style.background=ss.bg;sq.style.color=ss.fg;
    var bt=S.bt[i];
    if(bt){
      var face=document.createElement('div');face.className='tile board-tile'+(bt.variant?' var-'+bt.variant:'');face.style.cssText='position:absolute;inset:1px;';
      face.innerHTML='<span class="tl" style="font-size:'+Math.round(sz*.48)+'px">'+bt.letter+'</span>';sq.style.position='relative';sq.appendChild(face);
    } else {var lbl=ss.lbl;if(i===center&&!sid)lbl='*';if(lbl){var s2=document.createElement('div');s2.className='sq-lbl';s2.textContent=lbl;sq.appendChild(s2);}}
    wrap.appendChild(sq);
  }
}

function openAlchemistModal(){
  var hasAl=false;for(var i=0;i<S.placed.length;i++)if(S.placed[i].id==='alchemist'){hasAl=true;break;}
  if(!hasAl||S.alchemistUsed){toast(S.alchemistUsed?'Alchemist already used this blind!':'Alchemist not placed.');return;}
  var cont=document.getElementById('alchemist-tiles');cont.innerHTML='';
  var freeTiles=S.hand.filter(function(t){return!t.onBoard&&!t.isBlank;});
  if(!freeTiles.length){toast('No eligible tiles in hand!');document.getElementById('alchemist-modal').style.display='none';return;}
  for(var i=0;i<freeTiles.length;i++){(function(tile){
    var el=document.createElement('div');el.className='h-tile';
    var sc=LS[tile.letter]||0;
    el.innerHTML='<span class="tl">'+tile.letter+'</span><span class="ts">'+sc+'</span>';
    el.title='Convert to blank (retains '+sc+' letter score)';
    el.onclick=function(){
      tile.isBlank=true;tile.blankAs=null;tile.letter=tile.letter;tile._alchSc=sc;
      S.alchemistUsed=true;document.getElementById('alchemist-modal').style.display='none';
      renderHand();renderShop();toast(tile.letter+' converted to a scored blank!');
    };
    cont.appendChild(el);
  })(freeTiles[i]);}
  document.getElementById('alchemist-modal').style.display='flex';
}

function openCollection(){
  document.getElementById('menu-dropdown').style.display='none';
  var g=document.getElementById('collection-content');g.innerHTML='';
  var types=[
    {key:'board',label:'Board Multipliers',test:function(d){return !!d.bm;}},
    {key:'local',label:'Local Stickers',test:function(d){return !!d.apply;}},
    {key:'global',label:'Global Stickers',test:function(d){return !!d.onPre||!!d.onPost||!!d.onFinal;}}
  ];
  for(var ti=0;ti<types.length;ti++){
    var tf=types[ti].test;var items=SQ.filter(function(d){return tf(d);});if(!items.length)continue;
    var sec=document.createElement('div');sec.style.marginBottom='16px';
    var title=document.createElement('div');title.className='shop-sec-title';title.textContent=types[ti].label;sec.appendChild(title);
    var row=document.createElement('div');row.className='shop-row';
    for(var j=0;j<items.length;j++){(function(d){
      var isPlaced=false;for(var k=0;k<S.placed.length;k++)if(S.placed[k].id===d.id){isPlaced=true;break;}
      var rc=d.rarity==='rare'?'rr':d.rarity==='uncommon'?'ru':'rc';
      var card=document.createElement('div');card.className='shop-card';
      if(isPlaced)card.style.cssText='border-color:#5aaa5a;background:#0a2a0a';
      card.innerHTML='<div class="scr '+rc+'">'+d.rarity+'</div>'
        +'<div class="scn"><span style="background:'+d.bg+';color:'+d.fg+';padding:1px 5px;border-radius:3px;font-size:11px">'+d.icon+'</span> '+d.name+'</div>'
        +'<div class="scd">'+d.desc+'</div>'
        +(isPlaced?'<div style="font-size:9px;color:#5aaa5a;margin-top:2px">✓ On your board</div>':'');
      if(S.devMode){var btn=document.createElement('button');btn.className='btn btn-gold';btn.style.cssText='padding:3px;font-size:10px;margin-top:4px';btn.textContent='Give';btn.onclick=(function(dd){return function(){devGiveSquare(dd.id);document.getElementById('collection-modal').style.display='none';};})(d);card.appendChild(btn);}
      row.appendChild(card);
    })(items[j]);}
    sec.appendChild(row);g.appendChild(sec);
  }
  document.getElementById('collection-modal').style.display='flex';
}

function openSqInspect(sqIdx,defId){
  var d=sqd(defId);if(!d)return;var sell=Math.floor(d.cost/2);
  document.getElementById('sq-icon').textContent=d.icon;document.getElementById('sq-name').textContent=d.name;document.getElementById('sq-name').style.color=d.fg;
  document.getElementById('sq-rarity').textContent=d.rarity;document.getElementById('sq-rarity').style.color=d.fg;
  document.getElementById('sq-desc').textContent=d.desc;document.getElementById('sq-pos').textContent='Position: '+rcl(sqIdx);
  var btn=document.getElementById('sq-sell-btn');btn.textContent='Sell for $'+sell;
  btn.onclick=function(){S.gold+=sell;S.board[sqIdx]=null;S.placed=S.placed.filter(function(p){return p.sqIdx!==sqIdx;});document.getElementById('sq-modal').style.display='none';renderBoard();renderHUD();toast(d.name+' sold for $'+sell);};
  document.getElementById('sq-modal').style.display='flex';
}

function devGiveSquare(sqId){
  if(!S.devMode)return;
  var d=sqd(sqId);
  if(S.phase==='shop'||S.phase==='placing'){
    S.pendingSquares.push({id:sqId});
    if(S.phase==='shop')renderShop();
    toast((d?d.name:sqId)+' sticker queued for placement!');
  } else {
    var pos=freeSquare();if(pos<0){toast('No empty board cells!');return;}
    S.board[pos]=sqId;S.placed.push({id:sqId,sqIdx:pos});
    renderBoard();renderHUD();toast((d?d.name:sqId)+' placed at '+rcl(pos)+'!');
  }
}

function toggleDevMode(){
  S.devMode=!S.devMode;
  document.getElementById('devmode-item').textContent='Dev Mode: '+(S.devMode?'ON':'Off');
  document.getElementById('devmode-item').style.color=S.devMode?'#80f080':'';
  document.getElementById('menu-dropdown').style.display='none';
  toast(S.devMode?'Dev Mode ON — all purchases free!':'Dev Mode OFF');
  renderHUD();if(S.phase==='shop')renderShop();
}

function toggleMenu(){
  var dd=document.getElementById('menu-dropdown');
  if(dd.style.display==='none'){
    var sd=document.getElementById('seed-display');
    if(sd)sd.textContent='Seed: '+(S.seed||'—');
    dd.style.display='block';
  } else {
    dd.style.display='none';
  }
}
function giveUpRun(){document.getElementById('menu-dropdown').style.display='none';showGO('You gave up the run.');}
function seedRun(){
  document.getElementById('menu-dropdown').style.display='none';
  var input=prompt('Enter a seed number to start a new run:','');
  if(input===null)return;
  var n=parseInt(input);
  if(isNaN(n)||n<=0){toast('Invalid seed — must be a positive number.');return;}
  startGame(n);
}

async function checkWordCost(){
  if(!S.devMode&&S.gold<1){toast('Need $1 to check a word!');return;}
  var nt=newTiles();if(!nt.length){toast('Place tiles on the board first!');return;}
  var dir=wordDir(nt);if(!dir){toast('Tiles must be in a straight line!');return;}
  var a=nt[0];var main=extractAt(a.row,a.col,dir);
  if(!main||main.word.length<2){toast('Word too short to check!');return;}
  if(!S.devMode)S.gold-=1;renderHUD();
  var v=await validWord(main.word);
  toast(v?'"'+main.word+'" ✓ is a valid word!':'"'+main.word+'" ✗ not in dictionary!');
}
