// =====================================================================
// RENDER — board, HUD, hand, sticker hand
// =====================================================================
function renderAll(){renderHUD();renderBoard();renderHand();document.getElementById('bag-count').textContent=S.bag.length;}

function renderHUD(){
  var dhb=document.getElementById('dev-hotbar');if(dhb)dhb.style.display=S.devMode?'flex':'none';
  var dp=document.getElementById('dev-palette');
  if(!S.devMode&&dp)dp.style.display='none';
  var stickerTab=document.getElementById('dev-tab-stickers');
  if(stickerTab){var n=(S.pendingSquares||[]).length;stickerTab.textContent='Stickers'+(n>0?' ('+n+')':'');}
  if(S.devMode&&typeof _devTab!=='undefined'&&_devTab==='stickers'&&dp&&dp.style.display!=='none')devRenderPalette();
  var solb=document.getElementById('solver-btn');if(solb)solb.style.display=S.devMode?'':'none';
  document.getElementById('hud-gold').textContent=S.devMode?'∞ DEV':'$'+S.gold;
  document.getElementById('hud-plays').textContent=S.plays;
  document.getElementById('hud-disc').textContent=S.disc;
  var b=cb();
  document.getElementById('blind-name').textContent=b[0];
  document.getElementById('blind-sub').textContent=b[1];
  document.getElementById('blind-target').textContent=tgt().toLocaleString();
  var pct=Math.min(100,S.score/tgt()*100);
  document.getElementById('blind-bar').style.height=pct+'%';
  document.getElementById('score-txt').textContent=S.score.toLocaleString()+' / '+tgt().toLocaleString();
  var dots=document.getElementById('ante-dots');dots.innerHTML='';
  for(var a=0;a<ANTES.length;a++)for(var b2=0;b2<3;b2++){
    var d=document.createElement('div');var g=a*3+b2,cg=S.ai*3+S.bi;
    d.className='ante-dot'+(g<cg?' done':g===cg?' cur':'');
    if(b2===2)d.style.marginRight='8px';dots.appendChild(d);
  }
  var brow=document.getElementById('bounty-row');if(brow){brow.innerHTML='';var blist=S.bounties||[];for(var bi=0;bi<blist.length;bi++){var bv=blist[bi].variant;var bvfg=bv==='gold'?'#f0c060':bv==='red'?'#ff8080':bv==='blue'?'#60b8ff':'';var bc=document.createElement('div');bc.className='bounty-chip';if(bvfg)bc.style.borderColor=bvfg;bc.style.flexDirection='column';bc.style.gap='4px';bc.innerHTML=wordAsTilesHTML(blist[bi].word,18)+'<span class="bounty-chip-reward">+$'+blist[bi].reward+'</span>';brow.appendChild(bc);}}
}

function sqStyle(id){
  if(!id)return{bg:'#1a3a12',fg:'#2d6020',lbl:''};
  var d=sqd(id);if(!d)return{bg:'#1a3a12',fg:'#2d6020',lbl:''};
  return{bg:d.bg,fg:d.fg,lbl:d.icon};
}

function renderBoard(){
  var wrap=document.getElementById('board-wrap');
  var sz=Math.max(30,Math.min(64,Math.floor(Math.min(window.innerWidth*0.52-80,window.innerHeight-160)/B)));
  wrap.style.gridTemplateColumns='repeat('+B+','+sz+'px)';wrap.innerHTML='';
  var center=Math.floor(B/2)*B+Math.floor(B/2);
  for(var i=0;i<B*B;i++){
    var sq=document.createElement('div');sq.className='sq';sq.dataset.sqIdx=i;
    sq.style.width=sz+'px';sq.style.height=sz+'px';
    var sid=S.board[i];var ss=sqStyle(sid);sq.style.background=ss.bg;sq.style.color=ss.fg;
    var bt=S.bt[i];var showTile=bt&&!bt.flying&&!viewingBoard;
    if(showTile){
      var bsc=bt.isBlank?0:((LS[bt.letter]||0)+(bt.variant==='blue'?(bt.blueBonus||0):0));
      var bbadge=bt.variant==='gold'?'<span class="vbadge vbadge-gold" style="font-size:'+Math.max(5,Math.round(sz*.14))+'px">$</span>':bt.variant==='blue'?'<span class="vbadge vbadge-blue" style="font-size:'+Math.max(5,Math.round(sz*.14))+'px">+'+(LS[bt.letter]||0)+'</span>':bt.variant==='red'?'<span class="vbadge vbadge-red" style="font-size:'+Math.max(5,Math.round(sz*.14))+'px">×2</span>':'';
      var face=document.createElement('div');face.className='tile board-tile'+(bt.isNew?' is-new':'')+(bt.variant?' var-'+bt.variant:'');
      face.style.cssText='position:absolute;inset:1px;';
      face.innerHTML='<span class="tl" style="font-size:'+Math.round(sz*.5)+'px">'+bt.letter+'</span><span class="ts" style="font-size:'+Math.max(6,Math.round(sz*.2))+'px">'+bsc+'</span>'+bbadge;
      if(bt.isNew)attachBoardTileDrag(face,i,sz);
      sq.appendChild(face);
    } else {
      var lbl=ss.lbl;if(i===center&&!sid)lbl='*';
      if(lbl){var s=document.createElement('div');s.className='sq-lbl';s.textContent=lbl;sq.appendChild(s);}
      if(bt&&viewingBoard)sq.style.opacity='0.4';
      var classic=(sid==='dl'||sid==='tl'||sid==='dw'||sid==='tw');
      if(sid&&!classic&&!bt&&S.phase!=='placing'){sq.style.cursor='pointer';(function(idx,did){if(did.indexOf('chess_')===0){sq.addEventListener('mouseenter',function(){_chessHoverOn(idx,did);});sq.addEventListener('mouseleave',_chessHoverOff);}sq.addEventListener('click',function(){openSqInspect(idx,did);});})(i,sid);}
      if(S.phase==='placing'&&isSqStaged(i)){
        var si2=S.sqStaged[i];var sq2item=S.sqHand[si2];var d2=sqd(sq2item.id);
        if(d2){var ss2=sqStyle(sq2item.id);sq.style.background=ss2.bg;sq.style.color=ss2.fg;
          sq.classList.add('sq-staged-cell');
          var lbl2=document.createElement('div');lbl2.className='sq-lbl';lbl2.textContent=d2.icon;sq.appendChild(lbl2);
          (function(bidx,si2l){sq.addEventListener('click',function(){S.sqHand[si2l].placed=false;delete S.sqStaged[bidx];renderSqHand();renderBoard();});})(i,si2);
        }
      }
    }
    wrap.appendChild(sq);
  }
  if(S.phase==='play')updateLiveScore();
  if(S.phase==='play'&&!viewingBoard){
    var _hasEM=false;for(var _ei=0;_ei<S.placed.length;_ei++){if(S.placed[_ei].id==='easy_mode'){_hasEM=true;break;}}
    if(_hasEM){
      var _bw=document.getElementById('board-wrap');
      _bw.addEventListener('mouseenter',_easyHintShow,{once:false});
      _bw.addEventListener('mouseleave',_easyHintHide,{once:false});
    }
  }
}

function _easyHintShow(){
  _easyHintHide();
  if(!window._easyHint)return;
  var hint=window._easyHint;
  for(var i=0;i<hint.wt.length;i++){
    var ht=hint.wt[i];
    var el=document.querySelector('[data-sq-idx="'+ht.idx+'"]');if(!el)continue;
    if(ht.isNew){el.classList.add('sq-easy-new');var lbl=document.createElement('div');lbl.className='sq-solver-lbl sq-easy-lbl';lbl.textContent=ht.letter;el.appendChild(lbl);}
    else el.classList.add('sq-easy-existing');
  }
}

function _easyHintHide(){
  var els=document.querySelectorAll('.sq-easy-new,.sq-easy-existing');
  for(var i=0;i<els.length;i++){els[i].classList.remove('sq-easy-new','sq-easy-existing');var lbls=els[i].querySelectorAll('.sq-easy-lbl');for(var j=0;j<lbls.length;j++)els[i].removeChild(lbls[j]);}
}

function renderHand(){
  hpBounds();
  var area=document.getElementById('hand-area');area.innerHTML='';
  var vis=[];
  for(var i=0;i<S.hand.length;i++)if(S.hand[i]&&!S.hand[i].onBoard)vis.push({t:S.hand[i],oi:i});
  hpRebuild(vis);
  for(var vi=0;vi<vis.length;vi++){
    var t=vis[vi].t,oi=vis[vi].oi;
    var disp=t.isBlank?(t.blankAs||''):t.letter;
    var sc=t.isBlank?(t._alchSc||0):((LS[t.letter]||0)+(t.variant==='blue'?(t.blueBonus||0):0));
    var badge=t.variant==='gold'?'<span class="vbadge vbadge-gold">$</span>':t.variant==='blue'?'<span class="vbadge vbadge-blue">+'+(LS[t.letter]||0)+'</span>':t.variant==='red'?'<span class="vbadge vbadge-red">×2</span>':'';
    var face=document.createElement('div');
    face.className='tile hand-tile'+(t.isBlank?' blank-t':'')+(t.sel?' selected':'')+(t.variant?' var-'+t.variant:'');
    face.style.cssText='width:68px;height:68px;left:'+(HP.x[vi]-34-HP.left)+'px;top:0;';
    face.innerHTML='<span class="tl" style="font-size:28px">'+disp+'</span><span class="ts" style="font-size:11px">'+sc+'</span>'+badge;
    var isDragging=activeDrag&&activeDrag.src==='hand'&&activeDrag.vi===vi;
    if(isDragging)face.style.opacity='0';
    area.appendChild(face);
    attachHandTileDrag(face,oi,vi,t,vis);
  }
}

function isSqStaged(idx){return S.sqStaged&&S.sqStaged.hasOwnProperty(idx);}

function renderSqHand(){
  hpBounds();
  var area=document.getElementById('hand-area');area.innerHTML='';
  var vis=S.sqHand.filter(function(sq){return !sq.placed;});
  var n=vis.length;
  HP.tiles=vis.slice();
  if(HP.x.length!==n){HP.x=hpRest(n);HP.vx=Array(n).fill(0);}
  for(var vi=0;vi<vis.length;vi++){
    var item=vis[vi];var d=sqd(item.id);if(!d)continue;
    var face=document.createElement('div');
    face.className='hand-tile sq-hand-item';
    face.style.cssText='left:'+(HP.x[vi]-34-HP.left)+'px;top:0;border-color:'+d.fg+';color:'+d.fg+';background:#12122a;';
    face.innerHTML='<span style="font-size:20px">'+d.icon+'</span><span class="sqh-name">'+d.name+'</span>';
    area.appendChild(face);
    attachSqDrag(face,vi,item);
  }
  var unplaced=vis.length;
  document.getElementById('placing-info').textContent=unplaced>0?'Drag stickers onto the board':'All placed — confirm!';
}
