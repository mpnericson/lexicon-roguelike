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
  var rp = document.getElementById('right-panel');
  if (rp) { rp.style.position = ''; rp.style.zIndex = ''; }
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
    var html = '<div style="font-size:32px;color:#606080;margin-bottom:6px">Click to add to hand</div>'
      + '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px">';
    var alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (var i = 0; i < alpha.length; i++) {
      var l = alpha[i], sc = LS[l] || 0;
      html += '<div class="tile dev-tile-pick" onclick="devAddTile(\''+l+'\')" style="width:30px;height:36px;position:relative;flex-shrink:0">'
        + '<span class="tl" style="font-size:32px">'+l+'</span>'
        + '<span class="ts" style="font-size:28px">'+sc+'</span></div>';
    }
    html += '<div class="tile blank-t dev-tile-pick" onclick="devAddBlank()" title="Blank" style="width:30px;height:36px;position:relative;flex-shrink:0">'
      + '<span class="tl" style="font-size:32px">&nbsp;</span>'
      + '<span class="ts" style="font-size:28px">0</span></div>';
    html += '</div>';
    p.innerHTML = html;
  } else if (_devTab === 'blanks') {
    var bn = S.hand.filter(function(t){return t&&t.isBlank&&!t.onBoard;}).length;
    p.innerHTML = '<div style="text-align:center;padding:4px 0">'
      + '<div class="tile blank-t dev-tile-pick" onclick="devAddBlank()" style="width:52px;height:60px;position:relative;margin:0 auto 8px">'
      + '<span class="tl" style="font-size:22px">&nbsp;</span>'
      + '<span class="ts" style="font-size:30px">0</span></div>'
      + '<div style="font-size:30px;color:#a0a0c0;margin-bottom:3px">'+bn+' blank'+(bn===1?'':'s')+' in hand</div>'
      + '<div style="font-size:32px;color:#504860">Blanks score the letter\'s value</div></div>';
  } else if (_devTab === 'stickers') {
    var n = (S.stickerInventory||[]).length;
    p.innerHTML = '<div style="font-size:30px;color:#a0a0c0;margin-bottom:6px">'+n+' sticker'+(n===1?'':'s')+' in inventory</div>'
      + (n > 0 ? '<button class="btn btn-gold" onclick="enterPlacingFromDev()" style="padding:5px;font-size:30px;margin-bottom:6px">Place on Board</button>' : '')
      + '<button class="btn btn-gray" onclick="openCollection()" style="padding:5px;font-size:28px">Browse Collection</button>';
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
  var pb=document.getElementById('preview-sticker-bar');
  if(pb&&typeof _renderPreviewStickerBar==='function')_renderPreviewStickerBar(pb);
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
      var spr=tileSpr(bt.isBlank?null:bt.letter,bt.isBlank,bt.variant||null,sz);
      var face=document.createElement('div');face.className='tile board-tile tile-spr'+(bt.variant?' var-'+bt.variant:'');face.style.cssText='position:absolute;inset:1px;'+spr;
      sq.style.position='relative';sq.appendChild(face);
    } else {var lbl=ss.lbl;if(i===center&&!sid)lbl='*';if(lbl){var s2=document.createElement('div');s2.className='sq-lbl';s2.textContent=lbl;sq.appendChild(s2);}}
    wrap.appendChild(sq);
  }
}


function _refreshCollectionContent(){
  var g=document.getElementById('collection-content');
  var prevScroll=g.scrollTop;
  g.innerHTML='';
  var types=[
    {key:'board',label:'Board Stickers',test:function(d){return !!d.bm||!!d.apply||d.type==='board';}},
    {key:'global',label:'Global Stickers',test:function(d){return !d.bm&&!d.apply&&d.type!=='board';}}
  ];
  for(var ti=0;ti<types.length;ti++){
    var tf=types[ti].test;var items=SQ.filter(function(d){return tf(d);});if(!items.length)continue;
    var sec=document.createElement('div');sec.style.marginBottom='16px';
    var title=document.createElement('div');title.className='shop-sec-title';title.textContent=types[ti].label;sec.appendChild(title);
    var row=document.createElement('div');row.className='shop-row';
    for(var j=0;j<items.length;j++){(function(d){
      var isPlaced=false;for(var k=0;k<S.placed.length;k++)if(S.placed[k].id===d.id){isPlaced=true;break;}
      var isTileType=d.type==='tile';
      var invCount=0;
      if(isTileType){for(var k=0;k<S.tileStickers.length;k++)if(S.tileStickers[k].id===d.id)invCount++;}
      else{for(var k=0;k<S.stickerInventory.length;k++)if(S.stickerInventory[k].id===d.id)invCount++;}
      var card=document.createElement('div');card.className='coll-card';
      card.innerHTML='<div class="coll-icon-wrap r-'+(d.rarity||'common')+(isPlaced?' coll-placed':'')+'"><span style="font-size:52px;line-height:1;color:'+d.fg+'">'+sqIconHTML(d,72)+'</span></div>'
        +'<div class="coll-name">'+d.name+'</div>'
        +(isPlaced?'<div class="coll-sub">✓ On your board</div>':'');
      var descEl=document.createElement('div');descEl.className='coll-desc';descEl.innerHTML=d.desc;
      card.appendChild(descEl);
      card.onclick=function(){descEl.style.display=descEl.style.display==='none'||!descEl.style.display?'block':'none';};
      if(S.devMode){
        var ctrl=document.createElement('div');ctrl.style.cssText='display:flex;align-items:center;gap:5px;margin-top:5px';
        var minusBtn=document.createElement('button');minusBtn.className='btn btn-gray';minusBtn.style.cssText='padding:1px 8px;font-size:30px;min-width:28px;line-height:1';minusBtn.textContent='−';
        if(invCount===0)minusBtn.disabled=true;
        minusBtn.onclick=(function(dd,isTile){return function(e){
          e.stopPropagation();
          if(isTile){for(var _i=0;_i<S.tileStickers.length;_i++){if(S.tileStickers[_i].id===dd.id){S.tileStickers.splice(_i,1);break;}}renderTileStickerBar();}
          else{for(var _i=0;_i<S.stickerInventory.length;_i++){if(S.stickerInventory[_i].id===dd.id){S.stickerInventory.splice(_i,1);break;}}}
          renderHUD();_refreshCollectionContent();
        };})(d,isTileType);
        var countEl=document.createElement('span');countEl.style.cssText='font-size:30px;color:#d0d0f0;min-width:18px;text-align:center;font-weight:normal';countEl.textContent=invCount;
        var plusBtn=document.createElement('button');plusBtn.className='btn btn-gold';plusBtn.style.cssText='padding:1px 8px;font-size:30px;min-width:28px;line-height:1';plusBtn.textContent='+';
        plusBtn.onclick=(function(dd,isTile){return function(e){
          e.stopPropagation();
          if(isTile){S.tileStickers.push({id:dd.id});renderTileStickerBar();}
          else{S.stickerInventory.push({id:dd.id});}
          renderHUD();_refreshCollectionContent();
        };})(d,isTileType);
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
  document.getElementById('sq-icon').innerHTML=sqIconHTML(d,32);document.getElementById('sq-name').textContent=d.name;document.getElementById('sq-name').style.color=d.fg;
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
    S.stickerInventory.push({id:sqId});
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
  var inp=document.getElementById('seed-input');inp.value='';
  document.getElementById('seed-modal').style.display='flex';
  setTimeout(function(){inp.focus();},60);
}
function confirmSeedRun(){
  var n=parseInt(document.getElementById('seed-input').value);
  if(isNaN(n)||n<=0){toast('Must be a positive number.');return;}
  document.getElementById('seed-modal').style.display='none';
  startGame(n);
}
// Returns an <img> tag pointing to Assets/ui/{name}.svg. Use for SVG UI icons.
function uiSvg(name,size){size=size||24;return '<img src="Assets/ui/'+name+'.svg" width="'+size+'" height="'+size+'" class="ui-icon" draggable="false">';}


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
