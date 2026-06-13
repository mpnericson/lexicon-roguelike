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
  var _bn=document.getElementById('round-name');if(_bn)_bn.textContent=b[0];
  var _bs=document.getElementById('round-sub');if(_bs)_bs.textContent=b[1];
  var _rp=document.getElementById('run-progress');if(_rp)_rp.textContent=S.score.toLocaleString()+' / '+tgt().toLocaleString();
  var pct=Math.min(100,S.score/tgt()*100);
  document.getElementById('score-bar').style.height=pct+'%';
  document.getElementById('score-txt').textContent=S.score.toLocaleString()+' / '+tgt().toLocaleString();
  var dots=document.getElementById('stage-dots');if(dots){dots.innerHTML='';
  if(S.endless){var ed=document.createElement('div');ed.style.cssText='font-size:11px;color:#f0c060;letter-spacing:1px;padding:2px 4px';ed.textContent='∞ ENDLESS '+S.endlessRound;dots.appendChild(ed);}
  else{for(var a=0;a<STAGES.length;a++)for(var b2=0;b2<3;b2++){
    var d=document.createElement('div');var g=a*3+b2,cg=S.ai*3+S.bi;
    d.className='stage-dot'+(g<cg?' done':g===cg?' cur':'');
    if(b2===2)d.style.marginRight='8px';dots.appendChild(d);
  }}}
  var brow=document.getElementById('bounty-row');if(brow){brow.innerHTML='';var blist=S.bounties||[];for(var bi=0;bi<blist.length;bi++){var bv=blist[bi].variant;var bvfg=bv==='gold'?'#f0c060':bv==='red'?'#ff8080':bv==='blue'?'#60b8ff':'';var bc=document.createElement('div');bc.className='bounty-chip';bc.innerHTML=wordAsTilesHTML(blist[bi].word,24,blist[bi].variant)+'<span class="bounty-chip-reward">+$'+blist[bi].reward+'</span>';brow.appendChild(bc);}}
  var _sp=document.getElementById('hud-stage-prog'),_bl=document.getElementById('hud-boards-left');
  if(_sp){if(S.endless){_sp.textContent='∞';}else{_sp.textContent=(S.bi+1)+'/3'+(S.bi===2?' ★':'');}}
  if(_bl){if(S.endless){_bl.textContent='∞';}else{_bl.textContent=STAGES.length-S.ai;}}
  var _cb=document.getElementById('constraint-banner');
  if(_cb){var boss=cb()[3];if(boss){_cb.textContent='Constraint: '+cb()[1];_cb.style.display='';}else{_cb.style.display='none';}}
}

function sqStyle(id){
  if(!id)return{bg:'#1a3a12',fg:'#2d6020',lbl:''};
  var d=sqd(id);if(!d)return{bg:'#1a3a12',fg:'#2d6020',lbl:''};
  return{bg:d.bg,fg:d.fg,lbl:d.icon};
}

function renderBoard(){
  if(typeof _clearStickerFloats==='function')_clearStickerFloats();
  var wrap=document.getElementById('board-wrap');
  var sz=Math.max(30,Math.min(64,Math.floor(Math.min(window.innerWidth*0.52-80,window.innerHeight-160)/B)));
  wrap.style.gridTemplateColumns='repeat('+B+','+sz+'px)';wrap.innerHTML='';
  var center=Math.floor(B/2)*B+Math.floor(B/2);
  for(var i=0;i<B*B;i++){
    var sq=document.createElement('div');sq.className='sq';sq.dataset.sqIdx=i;
    sq.style.width=sz+'px';sq.style.height=sz+'px';
    var sid=S.board[i];var ss=sqStyle(sid);
    if(!sid){
      sq.style.backgroundImage='url(Assets/sprites/board-tile.png)';
      sq.style.backgroundSize=sz+'px '+sz+'px';
      sq.style.imageRendering='pixelated';
      sq.style.border='none';sq.style.borderRadius='0';
      sq.style.color='#6a9060';
    } else {
      sq.style.background=ss.bg;sq.style.color=ss.fg;
    }
    var bt=S.bt[i];var showTile=bt&&!bt.flying&&!viewingBoard;
    if(showTile){
      var bbadge=bt.variant==='gold'?'<span class="vbadge vbadge-gold" style="font-size:'+Math.max(5,Math.round(sz*.14))+'px">$</span>':bt.variant==='blue'?'<span class="vbadge vbadge-blue" style="font-size:'+Math.max(5,Math.round(sz*.14))+'px">+'+(LS[bt.letter]||0)+'</span>':bt.variant==='red'?'<span class="vbadge vbadge-red" style="font-size:'+Math.max(5,Math.round(sz*.14))+'px">×2</span>':'';
      var spr=(bt.isBlank&&bt.letter&&bt.letter>='A'&&bt.letter<='Z')?blankTileSpr(bt.letter,bt.variant||null,sz):tileSpr(bt.isBlank?null:bt.letter,bt.isBlank,bt.variant||null,sz);
      var _stkCls=(!bt.isNew&&bt._stackLevel>0)?(bt._stackLevel>=2?' jenga-stacked-2':' jenga-stacked'):'';
      var face=document.createElement('div');face.className='tile board-tile'+(bt.isNew?' is-new':'')+_stkCls+(bt.variant?' var-'+bt.variant:'')+' tile-spr';
      face.style.cssText='position:absolute;left:0;top:0;width:'+sz+'px;height:'+sz+'px;'+spr;
      face.dataset.spr=spr;face.dataset.tsz=sz;
      var inner='';
      face.innerHTML=inner+bbadge;
      if(bt.isNew)attachBoardTileDrag(face,i,sz);
      // Jenga: click on committed tile to stack a selected hand tile
      if(!bt.isNew&&!(S.btTop&&S.btTop[i])&&S.phase==='play'&&typeof hasJenga==='function'&&hasJenga()){
        (function(sqI){sq.addEventListener('click',function(ev){
          if(Date.now()-_dragEndTime<300)return;
          var sel=[];for(var _si=0;_si<S.hand.length;_si++){if(S.hand[_si]&&S.hand[_si].sel&&!S.hand[_si].onBoard)sel.push(_si);}
          if(!sel.length)return;
          if(sel.length===1){var oi=sel[0];var t=S.hand[oi];t.sel=false;
            if(t.isBlank&&!t.blankAs){openBlankChooser(oi,function(){placeTile(oi,sqI);renderBoard();renderHand();});}
            else{placeTile(oi,sqI);renderBoard();renderHand();}
          }
          ev.stopPropagation();
        });})(i);
      }
      sq.appendChild(face);
    } else {
      var _sqd=sqd(sid);
      var lbl=ss.lbl;if(i===center&&!sid)lbl='*';
      if(_sqd&&_sqd.iconPng){
        sq.style.border='none';sq.style.borderRadius='0';
        var img=document.createElement('img');img.src=_sqd.iconPng;img.style.cssText='position:absolute;left:0;top:0;width:'+sz+'px;height:'+sz+'px;image-rendering:pixelated;pointer-events:none';sq.appendChild(img);
      } else if(lbl){var s=document.createElement('div');s.className='sq-lbl';s.textContent=lbl;sq.appendChild(s);}
      if(bt&&viewingBoard)sq.style.opacity='0.4';
      if(S.phase==='play'&&!bt){
        (function(sqI){
          sq.addEventListener('click',function(ev){
            if(Date.now()-_dragEndTime<300)return;
            var sel=[];for(var _si=0;_si<S.hand.length;_si++){if(S.hand[_si]&&S.hand[_si].sel&&!S.hand[_si].onBoard)sel.push(_si);}
            if(sel.length===0)return;
            if(sel.length===1){
              var oi=sel[0];var t=S.hand[oi];t.sel=false;
              if(t.isBlank&&!t.blankAs){openBlankChooser(oi,function(){placeTile(oi,sqI);renderBoard();renderHand();});}
              else{placeTile(oi,sqI);renderBoard();renderHand();}
            } else {
              multiPlaceSelected(sel,sqI,'h');
            }
            ev.stopPropagation();
          });
          sq.addEventListener('contextmenu',function(ev){
            ev.preventDefault();ev.stopPropagation();
            if(Date.now()-_dragEndTime<300)return;
            var sel=[];for(var _si=0;_si<S.hand.length;_si++){if(S.hand[_si]&&S.hand[_si].sel&&!S.hand[_si].onBoard)sel.push(_si);}
            if(sel.length>1)multiPlaceSelected(sel,sqI,'v');
          });
        })(i);
      }
      var classic=(sid==='dl'||sid==='tl'||sid==='dw'||sid==='tw');
      // Tooltip hover for all placed stickers, including classic bonus squares
      if(sid&&!bt&&S.phase!=='placing'){(function(idx,did){sq.addEventListener('mouseenter',function(){_sqTooltipShow(idx,did);});sq.addEventListener('mouseleave',_sqTooltipHide);})(i,sid);}
      if(sid&&!classic&&!bt&&S.phase!=='placing'){sq.style.cursor='pointer';(function(idx,did){if(did.indexOf('chess_')===0){sq.addEventListener('mouseenter',function(){_chessHoverOn(idx,did);});sq.addEventListener('mouseleave',_chessHoverOff);}else if(did==='easy_mode'){sq.addEventListener('mouseenter',_easyHintShow);sq.addEventListener('mouseleave',_easyHintHide);}sq.addEventListener('click',function(){_sqTooltipFreeze(idx,did);});})(i,sid);}
      if(S.phase==='placing'&&isSqStaged(i)){
        var si2=S.sqStaged[i];var sq2item=S.sqHand[si2];var d2=sqd(sq2item.id);
        if(d2){var ss2=sqStyle(sq2item.id);sq.style.background=ss2.bg;sq.style.color=ss2.fg;
          sq.classList.add('sq-staged-cell');
          if(d2.iconPng){sq.style.border='none';sq.style.borderRadius='0';var img2=document.createElement('img');img2.src=d2.iconPng;img2.style.cssText='position:absolute;left:0;top:0;width:'+sz+'px;height:'+sz+'px;image-rendering:pixelated;pointer-events:none';sq.appendChild(img2);}
          else{var lbl2=document.createElement('div');lbl2.className='sq-lbl';lbl2.textContent=d2.icon;sq.appendChild(lbl2);}
          (function(bidx,si2l){sq.addEventListener('click',function(){S.sqHand[si2l].placed=false;delete S.sqStaged[bidx];renderSqHand();renderBoard();});})(i,si2);
        }
      }
    }
    // Jenga: render stacked top tile with elevation
    if(S.btTop&&S.btTop[i]&&!S.btTop[i].flying&&!viewingBoard){
      var btt=S.btTop[i];
      var bbadgeT=btt.variant==='gold'?'<span class="vbadge vbadge-gold" style="font-size:'+Math.max(5,Math.round(sz*.14))+'px">$</span>':btt.variant==='blue'?'<span class="vbadge vbadge-blue" style="font-size:'+Math.max(5,Math.round(sz*.14))+'px">+'+(LS[btt.letter]||0)+'</span>':btt.variant==='red'?'<span class="vbadge vbadge-red" style="font-size:'+Math.max(5,Math.round(sz*.14))+'px">×2</span>':'';
      var sprT=(btt.isBlank&&btt.letter&&btt.letter>='A'&&btt.letter<='Z')?blankTileSpr(btt.letter,btt.variant||null,sz):tileSpr(btt.isBlank?null:btt.letter,btt.isBlank,btt.variant||null,sz);
      var _btopLvl=(S.bt[i]&&S.bt[i]._stackLevel?S.bt[i]._stackLevel:0)+1;
      var topFace=document.createElement('div');
      topFace.className='tile board-tile is-new'+(btt.variant?' var-'+btt.variant:'')+' tile-spr '+(_btopLvl>=2?'jenga-stacked-2':'jenga-stacked');
      topFace.style.cssText='position:absolute;left:0;top:0;width:'+sz+'px;height:'+sz+'px;'+sprT;
      topFace.dataset.spr=sprT;topFace.dataset.tsz=sz;
      topFace.innerHTML=bbadgeT;
      if(btt.isNew)attachBoardTileDrag(topFace,i,sz,true);
      sq.appendChild(topFace);
    }
    wrap.appendChild(sq);
  }
  if(S.phase==='play'){var _row=document.getElementById('live-score-row');if(_row&&!_row.classList.contains('scoring')){var _lsC=document.getElementById('ls-letters'),_lsM=document.getElementById('ls-mult'),_lsS=document.getElementById('ls-score');if(_lsC)_lsC.textContent='0';if(_lsM)_lsM.textContent='1';if(_lsS)_lsS.textContent='0';}}
}

function _sqDescHTML(id,p){
  var d=sqd(id);if(!d)return '';
  if(d.liveDesc)return d.liveDesc(p);
  var s=d.desc.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  function sp(col,txt){return '<span style="color:'+col+'">'+txt+'</span>';}
  // ×N letter score / ×N letters → jade
  s=s.replace(/(×\d+(?:\.\d+)?)\s*(letter\s*scores?|letters?)/gi,function(_,n,t){return sp('#40c090',n+'\xa0'+t);});
  // Letter(s) score(s) ×N → jade
  s=s.replace(/(letters?\s*scores?\s*)(×\d+(?:\.\d+)?)/gi,function(_,pre,n){return sp('#40c090',pre+n);});
  // ×N mult → orange
  s=s.replace(/(×\d+(?:\.\d+)?)\s*(mult)/gi,function(_,n,t){return sp('#f0a040',n+'\xa0'+t);});
  // Word ×N → orange
  s=s.replace(/(word)\s*(×\d+(?:\.\d+)?)/gi,function(_,w,n){return sp('#f0a040',w+'\xa0'+n);});
  // +N letter score / +N letters → blue
  s=s.replace(/(\+\d+(?:\.\d+)?)\s*(letter\s*scores?|letters?)/gi,function(_,n,t){return sp('#60b8ff',n+'\xa0'+t);});
  // +N mult → red
  s=s.replace(/(\+\d+(?:\.\d+)?)\s*(mult)/gi,function(_,n,t){return sp('#ff6060',n+'\xa0'+t);});
  // $N / +$N → gold
  s=s.replace(/(\+?\$\d+)/g,function(m){return sp('#f0d060',m);});
  return s;
}
var _sqTooltipTimer=null;
var _sqTooltipFrozen=false;
var _sqTooltipFrozenIdx=-1;
var _sqTooltipFrozenId=null;

function _sqTooltipRender(sqIdx,id){
  var d=sqd(id);if(!d)return;
  var el=document.getElementById('sq-hover-tooltip');if(!el)return;
  var p=null;for(var i=0;i<S.placed.length;i++)if(S.placed[i].sqIdx===sqIdx){p=S.placed[i];break;}
  document.getElementById('sqht-name').textContent=d.name;
  document.getElementById('sqht-name').style.color=d.fg;
  var _descEl=document.getElementById('sqht-desc');
  _descEl.innerHTML=_sqDescHTML(id,p);
  var _spans=_descEl.querySelectorAll('span');
  for(var _wi=0;_wi<_spans.length;_wi++){
    if((_spans[_wi].getAttribute('style')||'').indexOf('f0e040')>=0){
      _spans[_wi].classList.add('sq-scale-wobble');
      _spans[_wi].style.animationDelay=(_wi*0.35)+'s';
    }
  }
  var cb=document.getElementById('constraint-banner');
  if(cb){el._cbWas=cb.style.display;cb.style.display='none';}
  el.style.display='block';
  el.style.opacity='0';
  requestAnimationFrame(function(){el.style.opacity='1';});
}

function _sqTooltipShow(sqIdx,id){
  var d=sqd(id);if(!d)return;
  var el=document.getElementById('sq-hover-tooltip');if(!el)return;
  clearTimeout(_sqTooltipTimer);
  _sqTooltipTimer=setTimeout(function(){
    _sqTooltipFrozen=false;_sqTooltipFrozenIdx=-1;_sqTooltipFrozenId=null;
    var act=document.getElementById('sqht-actions');if(act)act.style.display='none';
    _sqTooltipRender(sqIdx,id);
  },250);
}

function _sqTooltipFreeze(sqIdx,id){
  var d=sqd(id);if(!d)return;
  clearTimeout(_sqTooltipTimer);_sqTooltipTimer=null;
  _sqTooltipFrozen=true;_sqTooltipFrozenIdx=sqIdx;_sqTooltipFrozenId=id;
  var act=document.getElementById('sqht-actions');if(act)act.style.display='none';
  _sqTooltipRender(sqIdx,id);
  var sell=Math.floor(d.cost/2);
  var sellBtn=document.getElementById('sqht-sell-btn');
  if(sellBtn){
    sellBtn.textContent='Sell $'+sell;
    sellBtn.onclick=(function(si,di,sv,dn){return function(){
      S.gold+=sv;S.board[si]=null;S.placed=S.placed.filter(function(p){return p.sqIdx!==si;});
      _sqTooltipUnfreeze();renderBoard();renderHUD();toast(dn+' sold for $'+sv);
    };})(sqIdx,id,sell,d.name);
  }
  if(act)act.style.display='flex';
}

function _sqTooltipUnfreeze(){
  _sqTooltipFrozen=false;_sqTooltipFrozenIdx=-1;_sqTooltipFrozenId=null;
  clearTimeout(_sqTooltipTimer);_sqTooltipTimer=null;
  var el=document.getElementById('sq-hover-tooltip');if(!el)return;
  el.style.opacity='0';el.style.display='none';
  var act=document.getElementById('sqht-actions');if(act)act.style.display='none';
  var cb=document.getElementById('constraint-banner');
  if(cb&&el._cbWas!==undefined){cb.style.display=el._cbWas;el._cbWas=undefined;}
}

function _sqTooltipHide(){
  if(_sqTooltipFrozen)return;
  clearTimeout(_sqTooltipTimer);_sqTooltipTimer=null;
  var el=document.getElementById('sq-hover-tooltip');if(!el||el.style.display==='none')return;
  el.style.opacity='0';
  el.style.display='none';
  var cb=document.getElementById('constraint-banner');
  if(cb&&el._cbWas!==undefined){cb.style.display=el._cbWas;el._cbWas=undefined;}
}

function _easyHintShow(){
  _easyHintHide();
  if(!window._easyHint)return;
  var hint=window._easyHint;
  for(var i=0;i<hint.wt.length;i++){
    var el=document.querySelector('[data-sq-idx="'+hint.wt[i].idx+'"]');
    if(el)el.classList.add('sq-easy-hover');
  }
}

function _easyHintHide(){
  var els=document.querySelectorAll('.sq-easy-hover');
  for(var i=0;i<els.length;i++)els[i].classList.remove('sq-easy-hover');
}

function renderHand(){
  hpBounds();
  var area=document.getElementById('hand-area');area.innerHTML='';
  var vis=[];
  for(var i=0;i<S.hand.length;i++)if(S.hand[i]&&!S.hand[i].onBoard&&!S.hand[i].inFlight)vis.push({t:S.hand[i],oi:i});
  hpRebuild(vis);
  for(var vi=0;vi<vis.length;vi++){
    var t=vis[vi].t,oi=vis[vi].oi;
    var badge=t.variant==='gold'?'<span class="vbadge vbadge-gold">$</span>':t.variant==='blue'?'<span class="vbadge vbadge-blue">+'+(LS[t.letter]||0)+'</span>':t.variant==='red'?'<span class="vbadge vbadge-red">×2</span>':'';
    var spr=(t.isBlank&&t.blankAs)?blankTileSpr(t.blankAs,t.variant||null,68):tileSpr(t.isBlank?null:t.letter,t.isBlank,t.variant||null,68);
    var face=document.createElement('div');
    face.className='tile hand-tile'+(t.isBlank?' blank-t':'')+(t.sel?' selected':'')+(t.variant?' var-'+t.variant:'')+' tile-spr';
    face.style.cssText='width:68px;height:68px;left:'+(HP.x[vi]-34-HP.left)+'px;top:0;'+spr;
    face.dataset.spr=spr;
    var inner='';
    face.innerHTML=inner+badge;
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
    if(d.iconPng){
      face.className='hand-tile';
      face.style.cssText='left:'+(HP.x[vi]-34-HP.left)+'px;top:0;width:68px;height:68px;overflow:hidden;box-shadow:none;cursor:grab;position:absolute;image-rendering:pixelated;';
      face.innerHTML='<img src="'+d.iconPng+'" style="width:68px;height:68px;image-rendering:pixelated;display:block;pointer-events:none">'
        +'<span style="position:absolute;bottom:0;left:0;right:0;font-size:30px;text-align:center;background:rgba(0,0,0,0.6);padding:2px 0;color:#fff;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+d.name+'</span>';
    } else {
      face.className='hand-tile sq-hand-item';
      face.style.cssText='left:'+(HP.x[vi]-34-HP.left)+'px;top:0;border-color:'+d.fg+';color:'+d.fg+';background:#12122a;';
      face.innerHTML=sqIconHTML(d,28)+'<span class="sqh-name">'+d.name+'</span>';
    }
    area.appendChild(face);
    attachSqDrag(face,vi,item);
  }
  var unplaced=vis.length;
  document.getElementById('placing-info').textContent=unplaced>0?'Drag stickers onto the board':'All placed — confirm!';
}
