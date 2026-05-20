// =====================================================================
// UI — board preview, sticker collection, inspectors, dev tools
// =====================================================================
var _devTab = 'tiles';
var _zoomState = null;

function _zoomRestoreUI() {
  var rp = document.getElementById('right-panel');
  if (rp) { rp.style.position = ''; rp.style.zIndex = ''; }
  var bsec = document.getElementById('bounty-section');
  if (bsec) bsec.style.visibility = '';
  var zti = document.getElementById('zoom-top-btn');
  var zbi = document.getElementById('zoom-bot-btn');
  var zoi = document.getElementById('zoom-out-btn');
  if (zti) zti.style.display = '';
  if (zbi) zbi.style.display = '';
  if (zoi) zoi.style.display = 'none';
}

function zoomBoard(half) {
  if (_zoomState) return;
  // Elevate right panel above the z-index:800 clip overlay so its buttons stay clickable
  var rp = document.getElementById('right-panel');
  if (rp) { rp.style.position = 'relative'; rp.style.zIndex = '850'; }
  var bsec = document.getElementById('bounty-section');
  if (bsec) bsec.style.visibility = 'hidden';
  var zti = document.getElementById('zoom-top-btn');
  var zbi = document.getElementById('zoom-bot-btn');
  var zoi = document.getElementById('zoom-out-btn');
  if (zti) zti.style.display = 'none';
  if (zbi) zbi.style.display = 'none';
  if (zoi) zoi.style.display = '';
  animBoardZoomIn(half, function(state) { _zoomState = state; });
}

function zoomOut() {
  if (!_zoomState) return;
  var state = _zoomState;
  _zoomState = null;
  _zoomRestoreUI();
  animBoardZoomOut(state, function() {});
}

function _resetZoom() {
  if (!_zoomState) return;
  _zoomState.cleanup();
  _zoomState = null;
  _zoomRestoreUI();
}

function devSetTab(tab) {
  var p = document.getElementById('dev-palette');
  if (_devTab === tab && p.style.display !== 'none') { p.style.display = 'none'; _updateDevTabs(); return; }
  _devTab = tab;
  p.style.display = 'block';
  devRenderPalette();
  _updateDevTabs();
}

function _updateDevTabs() {
  var open = document.getElementById('dev-palette').style.display !== 'none';
  ['tiles','blanks','stickers'].forEach(function(t) {
    var b = document.getElementById('dev-tab-' + t);
    if (b) b.className = 'dev-tab' + (open && _devTab === t ? ' active' : '');
  });
}

function devRenderPalette() {
  var p = document.getElementById('dev-palette');
  if (!p) return;
  if (_devTab === 'tiles') {
    var html = '<div style="font-size:9px;color:#606080;margin-bottom:6px">Click to add to hand</div>'
      + '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px">';
    var alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (var i = 0; i < alpha.length; i++) {
      var l = alpha[i], sc = LS[l] || 0;
      html += '<div class="tile dev-tile-pick" onclick="devAddTile(\''+l+'\')" style="width:30px;height:36px;position:relative;flex-shrink:0">'
        + '<span class="tl" style="font-size:13px">'+l+'</span>'
        + '<span class="ts" style="font-size:6px">'+sc+'</span></div>';
    }
    html += '<div class="tile blank-t dev-tile-pick" onclick="devAddBlank()" title="Blank" style="width:30px;height:36px;position:relative;flex-shrink:0">'
      + '<span class="tl" style="font-size:13px">&nbsp;</span>'
      + '<span class="ts" style="font-size:6px">0</span></div>';
    html += '</div>';
    p.innerHTML = html;
  } else if (_devTab === 'blanks') {
    var bn = S.hand.filter(function(t){return t&&t.isBlank&&!t.onBoard;}).length;
    p.innerHTML = '<div style="text-align:center;padding:4px 0">'
      + '<div class="tile blank-t dev-tile-pick" onclick="devAddBlank()" style="width:52px;height:60px;position:relative;margin:0 auto 8px">'
      + '<span class="tl" style="font-size:22px">&nbsp;</span>'
      + '<span class="ts" style="font-size:8px">0</span></div>'
      + '<div style="font-size:11px;color:#a0a0c0;margin-bottom:3px">'+bn+' blank'+(bn===1?'':'s')+' in hand</div>'
      + '<div style="font-size:9px;color:#504860">Blanks score the letter\'s value</div></div>';
  } else if (_devTab === 'stickers') {
    var n = (S.pendingSquares||[]).length;
    p.innerHTML = '<div style="font-size:11px;color:#a0a0c0;margin-bottom:6px">'+n+' sticker'+(n===1?'':'s')+' in inventory</div>'
      + (n > 0 ? '<button class="btn btn-gold" onclick="enterPlacingFromDev()" style="padding:5px;font-size:11px;margin-bottom:6px">Place on Board</button>' : '')
      + '<button class="btn btn-gray" onclick="openCollection()" style="padding:5px;font-size:10px">Browse Collection</button>';
  }
}

function devAddTile(letter) {
  if (!S.devMode) return;
  S.hand.push({letter:letter,isBlank:false,id:uid(),blankAs:null,sel:false,onBoard:false,variant:null,blueBonus:0});
  renderHand();
}

function devAddBlank() {
  if (!S.devMode) return;
  S.hand.push({letter:'_',isBlank:true,id:uid(),blankAs:null,sel:false,onBoard:false,variant:null,blueBonus:0,_devBlank:true});
  renderHand();
}

function toggleBoardTiles(){
  var wrap=document.getElementById('board-wrap');
  var btn=document.getElementById('board-tile-toggle-btn');
  var hidden=wrap.classList.toggle('tiles-hidden');
  btn.textContent=hidden?'◎':'◉';
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

function _refreshCollectionContent(){
  var g=document.getElementById('collection-content');
  var prevScroll=g.scrollTop;
  g.innerHTML='';
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
      var invCount=0;for(var k=0;k<S.pendingSquares.length;k++)if(S.pendingSquares[k].id===d.id)invCount++;
      var rc=d.rarity==='legendary'?'rl':d.rarity==='rare'?'rr':d.rarity==='uncommon'?'ru':'rc';
      var card=document.createElement('div');card.className='shop-card';
      if(isPlaced)card.style.cssText='border-color:#5aaa5a;background:#0a2a0a';
      card.innerHTML='<div class="scr '+rc+'">'+d.rarity+'</div>'
        +'<div class="scn"><span style="background:'+d.bg+';color:'+d.fg+';padding:1px 5px;border-radius:3px;font-size:11px">'+d.icon+'</span> '+d.name+'</div>'
        +'<div class="scd">'+d.desc+'</div>'
        +(isPlaced?'<div style="font-size:9px;color:#5aaa5a;margin-top:2px">✓ On your board</div>':'');
      if(S.devMode){
        var ctrl=document.createElement('div');ctrl.style.cssText='display:flex;align-items:center;gap:5px;margin-top:5px';
        var minusBtn=document.createElement('button');minusBtn.className='btn btn-gray';minusBtn.style.cssText='padding:1px 8px;font-size:15px;min-width:28px;line-height:1';minusBtn.textContent='−';
        if(invCount===0)minusBtn.disabled=true;
        minusBtn.onclick=(function(dd){return function(){
          for(var _i=0;_i<S.pendingSquares.length;_i++){if(S.pendingSquares[_i].id===dd.id){S.pendingSquares.splice(_i,1);break;}}
          renderHUD();_refreshCollectionContent();
        };})(d);
        var countEl=document.createElement('span');countEl.style.cssText='font-size:12px;color:#d0d0f0;min-width:18px;text-align:center;font-weight:bold';countEl.textContent=invCount;
        var plusBtn=document.createElement('button');plusBtn.className='btn btn-gold';plusBtn.style.cssText='padding:1px 8px;font-size:15px;min-width:28px;line-height:1';plusBtn.textContent='+';
        plusBtn.onclick=(function(dd){return function(){
          S.pendingSquares.push({id:dd.id});
          renderHUD();_refreshCollectionContent();
        };})(d);
        ctrl.appendChild(minusBtn);ctrl.appendChild(countEl);ctrl.appendChild(plusBtn);
        card.appendChild(ctrl);
      }
      row.appendChild(card);
    })(items[j]);}
    sec.appendChild(row);g.appendChild(sec);
  }
  g.scrollTop=prevScroll;
}

function openCollection(){
  document.getElementById('menu-dropdown').style.display='none';
  _refreshCollectionContent();
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
  if(S.phase==='placing'){
    S.sqHand.push({id:sqId,placed:false});
    renderSqHand();
  } else {
    S.pendingSquares.push({id:sqId});
    if(S.phase==='shop')renderShop();
  }
  renderHUD();
  var dp=document.getElementById('dev-palette');
  if(_devTab==='stickers'&&dp&&dp.style.display!=='none')devRenderPalette();
  toast((d?d.name:sqId)+' added to sticker inventory!');
}

function toggleDevMode(){
  S.devMode=!S.devMode;
  document.getElementById('devmode-item').textContent='Dev Mode: '+(S.devMode?'ON':'Off');
  document.getElementById('devmode-item').style.color=S.devMode?'#80f080':'';
  var devItems=document.querySelectorAll('.dev-only');
  for(var i=0;i<devItems.length;i++)devItems[i].style.display=S.devMode?'block':'none';
  document.getElementById('menu-dropdown').style.display='none';
  toast(S.devMode?'Dev Mode ON — all purchases free!':'Dev Mode OFF');
  renderHUD();if(S.phase==='shop')renderShop();
}

function devTestClose(){
  document.getElementById('menu-dropdown').style.display='none';
  animBoardToShop(function(){ renderBoard();renderHand(); });
}
function devTestOpen(){
  document.getElementById('menu-dropdown').style.display='none';
  animShopToBoard(function(){ _burstHandTiles(); });
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
