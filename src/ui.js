// =====================================================================
// UI — board preview, collection, inspectors, dev tools
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
    html += '<div style="font-size:32px;color:#606080;margin:8px 0 4px">Material &mdash; selected tiles</div>'
      + '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px">'
      + '<button class="btn btn-gray" onclick="devSetMaterial(\'metallic\')" style="padding:4px;font-size:26px">Metallic</button>'
      + '<button class="btn btn-gray" onclick="devSetMaterial(\'glass\')" style="padding:4px;font-size:26px">Glass</button>'
      + '<button class="btn btn-gray" onclick="devSetMaterial(\'varnished\')" style="padding:4px;font-size:26px">Varnished</button>'
      + '<button class="btn btn-gray" onclick="devSetMaterial(null)" style="padding:4px;font-size:26px">Clear</button>'
      + '</div>';
    html += '<div style="font-size:32px;color:#606080;margin:8px 0 4px">Colour &mdash; selected tiles</div>'
      + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">'
      + '<button class="btn btn-gray" onclick="devSetColor(\'red\')" style="padding:4px;font-size:26px">Red</button>'
      + '<button class="btn btn-gray" onclick="devSetColor(\'blue\')" style="padding:4px;font-size:26px">Blue</button>'
      + '<button class="btn btn-gray" onclick="devSetColor(\'gold\')" style="padding:4px;font-size:26px">Gold</button>'
      + '<button class="btn btn-gray" onclick="devSetColor(\'jade\')" style="padding:4px;font-size:26px">Jade</button>'
      + '<button class="btn btn-gray" onclick="devSetColor(\'purple\')" style="padding:4px;font-size:26px">Purple</button>'
      + '<button class="btn btn-gray" onclick="devSetColor(null)" style="padding:4px;font-size:26px">Clear</button>'
      + '</div>';
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

function devSetColor(col) {
  if (!S.devMode) return;
  var n = 0;
  for (var i = 0; i < S.hand.length; i++) {
    var t = S.hand[i];
    if (t && t.sel) { t.variant = col || null; n++; }
  }
  if (!n) { toast('Select tiles in your hand first'); return; }
  if (col === 'blue' && typeof _autoRegisterBlueAnchors === 'function') _autoRegisterBlueAnchors();
  renderHand();
  toast(n + ' tile' + (n === 1 ? '' : 's') + (col ? ' → ' + col : ' colour cleared'));
}

function devSetMaterial(mat) {
  if (!S.devMode) return;
  var n = 0;
  for (var i = 0; i < S.hand.length; i++) {
    var t = S.hand[i];
    if (t && t.sel) { t.material = mat || null; n++; }
  }
  if (!n) { toast('Select tiles in your hand first'); return; }
  renderHand();
  toast(n + ' tile' + (n === 1 ? '' : 's') + (mat ? ' → ' + mat : ' cleared'));
}

function devAddTile(letter) {
  if (!S.devMode) return;
  S.hand.push({letter:letter,isBlank:false,id:uid(),blankAs:null,sel:false,onBoard:false,variant:null});
  renderHand();
}

function devAddBlank() {
  if (!S.devMode) return;
  S.hand.push({letter:'_',isBlank:true,id:uid(),blankAs:null,sel:false,onBoard:false,variant:null,_devBlank:true});
  renderHand();
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
  var pb=document.getElementById('preview-stamp-bar');
  if(pb&&typeof _renderPreviewStampBar==='function')_renderPreviewStampBar(pb);
  document.getElementById('board-preview-modal').style.display='flex';
}

function renderBoardPreview(){
  var wrap=document.getElementById('board-preview-wrap');
  var sz=Math.max(18,Math.min(32,Math.floor(Math.min((window.innerWidth-120)/B,(window.innerHeight-160)/BH))));
  wrap.style.gridTemplateColumns='repeat('+B+','+sz+'px)';wrap.innerHTML='';
  var center=Math.floor(BH/2)*B+Math.floor(B/2);
  for(var i=0;i<BN;i++){
    var sq=document.createElement('div');sq.className='sq';sq.style.width=sz+'px';sq.style.height=sz+'px';
    var sid=S.board[i];var ss=sqStyle(sid);sq.style.background=ss.bg;sq.style.color=ss.fg;
    var bt=S.bt[i];
    if(bt){
      var spr=tileSpr(bt.isBlank?null:bt.letter,bt.isBlank,bt.variant||null,sz);
      var face=document.createElement('div');face.className='tile board-tile tile-spr'+(bt.variant?' var-'+bt.variant:'');face.style.cssText='position:absolute;inset:1px;'+spr;
      applyTileLayers(face,bt,sz,spr);
      sq.style.position='relative';sq.appendChild(face);
    } else {var lbl=ss.lbl;if(i===center&&!sid)lbl='*';if(lbl){var s2=document.createElement('div');s2.className='sq-lbl';s2.textContent=lbl;sq.appendChild(s2);}}
    wrap.appendChild(sq);
  }
}


// ── Collection hub ───────────────────────────────────────────────────────────
// A landing hub of rectangular section buttons; each opens a grid of that
// section's entries. Unlocked entries show their icon + hover description
// (floated to the left via the shared positioner); locked entries show a "?"
// placeholder. Everything is unlocked in dev mode. All visual chrome here is a
// functional placeholder — swap in PNG backgrounds/sprites later.
//
// The Dictionary is reached from this hub too, launching the existing wordbook
// modal (words you have not played are intentionally not shown as placeholders).

// Lazily built so it reads the live SQ/TK/CONSTRAINTS/BOUNTY_THEMES arrays.
function _collSections(){
  return [
    {key:'stamps',      label:'Stamps',        cat:'stamps',
      items:function(){return SQ.filter(_isStampDef);}, id:function(d){return d.id;},
      icon:function(d,sz){return _collSqIcon(d,sz);}},
    {key:'stickers',    label:'Stickers',      cat:'stickers',
      items:function(){return SQ.filter(_isStickerDef);}, id:function(d){return d.id;},
      icon:function(d,sz){return _collSqIcon(d,sz);}},
    {key:'tickets',     label:'Tickets',       cat:'tickets',
      items:function(){return (typeof TK!=='undefined'?TK:[]).filter(function(d){return d.kind==='ticket';});},
      id:function(d){return d.id;}, icon:function(d,sz){return _collTkIcon(d,sz);}},
    {key:'materials',   label:'Materials',     cat:'materials',
      items:function(){return COLL_MATERIALS;}, id:function(d){return d.id;},
      icon:function(d,sz){return _collSwatchIcon(d,sz);}},
    {key:'colors',      label:'Coloured Tiles',cat:'colors',
      items:function(){return COLL_COLORS;}, id:function(d){return d.id;},
      icon:function(d,sz){return _collSwatchIcon(d,sz);}},
    {key:'keys',        label:'Keys',          cat:'keys',
      items:function(){return (typeof TK!=='undefined'?TK:[]).filter(function(d){return d.kind==='key';});},
      id:function(d){return d.id;}, icon:function(d,sz){return _collTkIcon(d,sz);}},
    {key:'constraints', label:'Constraints',   cat:'constraints',
      items:function(){return typeof CONSTRAINTS!=='undefined'?CONSTRAINTS:[];}, id:function(d){return d.id;},
      icon:function(d,sz){return _collConstraintIcon(d,sz);}},
    {key:'bounties',    label:'Bounties',      cat:'bounties',
      items:function(){return (typeof BOUNTY_THEMES!=='undefined'&&BOUNTY_THEMES?BOUNTY_THEMES:[]).map(_collBountyItem);},
      id:function(d){return d.id;}, icon:function(d,sz){return _collBountyIcon(d,sz);}},
    {key:'dictionary',  label:'Dictionary',    special:'dictionary'}
  ];
}

// A bounty theme → a collection item (id = theme name, desc = its word list).
function _collBountyItem(t){
  var words=(t.words||[]).join(', ');
  return {id:t.theme, name:t.theme, desc:'Words: '+words, fg:'#e0c070'};
}

// ── Icon renderers (all return an HTML string for the cell's icon area) ──
function _collSqIcon(d,sz){
  if(d.iconPng)return '<img src="'+d.iconPng+'" style="width:'+sz+'px;height:'+sz+'px;image-rendering:pixelated">';
  return '<span style="font-size:'+Math.round(sz*0.7)+'px;line-height:1;color:'+(d.fg||'#c8c8d8')+'">'+(d.icon||'?')+'</span>';
}
function _collTkIcon(d,sz){
  if(d.iconPng)return '<img src="'+d.iconPng+'" style="width:'+sz+'px;height:'+sz+'px;image-rendering:pixelated">';
  return '<span style="font-size:'+Math.round(sz*0.7)+'px;line-height:1">'+(d.icon||'?')+'</span>';
}
function _collSwatchIcon(d,sz){
  if(d.iconPng)return '<img src="'+d.iconPng+'" style="width:'+sz+'px;height:'+sz+'px;image-rendering:pixelated">';
  // Placeholder swatch: a rounded tile filled with the entry's representative colour.
  return '<div style="width:'+sz+'px;height:'+sz+'px;border-radius:8px;background:'+(d.color||'#888')
    +';box-shadow:inset 0 0 0 2px rgba(255,255,255,0.25),inset 0 -6px 10px rgba(0,0,0,0.25)"></div>';
}
function _collConstraintIcon(d,sz){
  if(d.iconPng)return '<img src="'+d.iconPng+'" style="width:'+sz+'px;height:'+sz+'px;image-rendering:pixelated">';
  var em=(COLL_CONSTRAINT_ICONS&&COLL_CONSTRAINT_ICONS[d.id])||'📜';
  return '<span style="font-size:'+Math.round(sz*0.66)+'px;line-height:1">'+em+'</span>';
}
function _collBountyIcon(d,sz){
  return '<span style="font-size:'+Math.round(sz*0.66)+'px;line-height:1">📜</span>';
}

// ── Hub / navigation ──
var _collCurSection=null;

function openCollection(){
  var dd=document.getElementById('menu-dropdown');if(dd)dd.style.display='none';
  if(typeof discoveryScan==='function')discoveryScan();
  collShowHub();
  document.getElementById('collection-modal').style.display='flex';
}

function collShowHub(){
  _collCurSection=null;
  document.getElementById('coll-title').textContent='Collection';
  document.getElementById('coll-back-btn').style.display='none';
  document.getElementById('coll-section').style.display='none';
  var hub=document.getElementById('coll-hub');
  hub.style.display='grid';
  hub.innerHTML='';
  var devAll=!!(S&&S.devMode);
  var secs=_collSections();
  for(var i=0;i<secs.length;i++){(function(sec){
    var btn=document.createElement('button');
    btn.className='coll-hub-btn';
    btn.setAttribute('data-coll-section',sec.key);
    var count='';
    if(sec.special==='dictionary'){
      count=(typeof _wordbook!=='undefined')?(Object.keys(_wordbook).length+' words'):'';
    }else{
      var c=_collSectionCount(sec,devAll);
      count=c.have+' / '+c.total;
    }
    btn.innerHTML='<span class="coll-hub-label">'+sec.label+'</span>'
      +'<span class="coll-hub-count">'+count+'</span>';
    btn.onclick=function(){
      if(sec.special==='dictionary'){openWordbookModal();return;}
      collShowSection(sec.key);
    };
    hub.appendChild(btn);
  })(secs[i]);}
}

function _collSectionCount(sec,devAll){
  var items=sec.items();var have=0;
  for(var i=0;i<items.length;i++)if(devAll||discHas(sec.cat,sec.id(items[i])))have++;
  return {have:have,total:items.length};
}

function collShowSection(key){
  var secs=_collSections(),sec=null;
  for(var i=0;i<secs.length;i++)if(secs[i].key===key){sec=secs[i];break;}
  if(!sec)return;
  _collCurSection=key;
  document.getElementById('coll-hub').style.display='none';
  document.getElementById('coll-title').textContent=sec.label;
  document.getElementById('coll-back-btn').style.display='';
  var devAll=!!(S&&S.devMode);
  var c=_collSectionCount(sec,devAll);
  document.getElementById('coll-section-sub').textContent=
    (devAll?'Dev mode — all unlocked · ':'')+c.have+' / '+c.total+' unlocked. Hover an entry for its description.';
  var grid=document.getElementById('coll-grid');
  grid.innerHTML='';
  var items=sec.items();
  for(var j=0;j<items.length;j++){(function(d){
    var unlocked=devAll||discHas(sec.cat,sec.id(d));
    var cell=document.createElement('div');
    cell.className='coll-cell'+(unlocked?'':' locked');
    if(unlocked){
      // Colour stamp/sticker names by rarity (other sections carry no rarity).
      var rcol=_collRarityColor(d.rarity);
      var nameStyle=rcol?' style="color:'+rcol+(d.rarity==='legendary'?';text-shadow:0 0 8px rgba(255,180,0,0.7)':'')+'"':'';
      cell.innerHTML='<div class="coll-cell-icon">'+sec.icon(d,64)+'</div>'
        +'<div class="coll-cell-name"'+nameStyle+'>'+d.name+'</div>';
      var fg=d.fg||'#e8e0d0',nm=d.name,desc=d.desc||'';
      cell.onmouseenter=function(){_collTipShow(cell,nm,desc,fg);};
      cell.onmouseleave=_collTipHide;
    }else{
      cell.innerHTML='<div class="coll-cell-icon coll-cell-locked">?</div>'
        +'<div class="coll-cell-name">???</div>';
    }
    grid.appendChild(cell);
  })(items[j]);}
  document.getElementById('coll-section').style.display='block';
  grid.scrollTop=0;
}

// Rarity → name colour (matches the shop's .rc/.ru/.rr/.rl scheme). null = no rarity.
function _collRarityColor(r){
  return r==='legendary'?'#ffd700':r==='rare'?'#c060ff':r==='uncommon'?'#60c060':r==='common'?'#a0a0a0':null;
}

// ── Collection hover tooltip (shared left-of-element positioner) ──
function _collTipShow(el,name,descHtml,fg){
  var tt=document.getElementById('shop-sticker-tooltip');if(!tt)return;
  tt._tkOwner=el;
  var nm=document.getElementById('shoptt-name');nm.textContent=name;nm.style.color=fg||'#f0e080';
  document.getElementById('shoptt-desc').innerHTML=descHtml;
  tt.style.display='block';tt.style.opacity='0';
  requestAnimationFrame(function(){positionDescTip(tt,el);tt.style.opacity='1';});
}
function _collTipHide(){
  var tt=document.getElementById('shop-sticker-tooltip');
  if(tt){tt.style.opacity='0';tt.style.display='none';tt._tkOwner=null;}
}

// ── Settings modal ──
// Animation speed is a discrete slider over these stops; slider value = index.
var _ANIM_SPEEDS=[0.5,1,2,4];
function openSettingsModal(){
  document.getElementById('menu-dropdown').style.display='none';
  var vol=Math.round(SETTINGS.volume*100);
  document.getElementById('set-vol').value=vol;
  document.getElementById('set-vol-val').textContent=vol+'%';
  var ai=_ANIM_SPEEDS.indexOf(SETTINGS.animSpeed);if(ai<0)ai=1;
  document.getElementById('set-anim').value=ai;
  document.getElementById('set-anim-val').textContent=_ANIM_SPEEDS[ai]+'×';
  document.getElementById('settings-modal').style.display='flex';
}
function setVolumeFromSlider(val){
  var v=Math.max(0,Math.min(100,parseInt(val,10)||0));
  document.getElementById('set-vol-val').textContent=v+'%';
  setVolume(v/100);
  _playTileClick('select'); // audible sample of the new level
}
function setAnimSpeedFromSlider(idx){
  var i=Math.max(0,Math.min(_ANIM_SPEEDS.length-1,parseInt(idx,10)||0));
  SETTINGS.animSpeed=_ANIM_SPEEDS[i];
  saveSettings();
  document.getElementById('set-anim-val').textContent=_ANIM_SPEEDS[i]+'×';
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
    var vd=document.getElementById('version-display');
    if(vd)vd.textContent='v'+(typeof GAME_VERSION!=='undefined'?GAME_VERSION:'?');
    var r=document.getElementById('menu-wrap').getBoundingClientRect();
    dd.style.top=(r.bottom+4)+'px';
    dd.style.right=(window.innerWidth-r.right)+'px';
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
