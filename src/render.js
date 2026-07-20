// =====================================================================
// RENDER — board, HUD, hand, sticker hand, stamp bar
// =====================================================================
function _makeBountyScroll(bounty){
  // Background-image approach: padding-top sets height via aspect-ratio trick.
  // Furled = 30% of width tall (shows only the roll area of the 60×60 sprite).
  // Open   = 100% of width tall (square, full sprite visible).
  var scrollW=Math.round(window.innerWidth*0.25*0.95);
  var titleSz=Math.max(11,Math.min(16,Math.round(scrollW*0.046)));

  var div=document.createElement('div');
  div.className='bounty-scroll';
  div.style.cssText='position:relative;width:95%;margin:0 auto;overflow:hidden;'
    +'background-image:url(\'Assets/animations/bounty scroll/bounty_scroll1.png\');'
    +'background-size:100% auto;background-repeat:no-repeat;background-position:top center;'
    +'image-rendering:pixelated;padding-top:30%';

  if(bounty.theme){
    var titleEl=document.createElement('div');
    titleEl.style.cssText='position:absolute;top:5px;left:0;right:0;'
      +'display:flex;justify-content:center;align-items:center;'
      +'pointer-events:none;z-index:3';
    var titleTag=document.createElement('span');
    titleTag.style.cssText='font-family:\'Jersey 10\',Georgia,serif;font-size:'+titleSz+'px;color:#2e1800;'
      +'background:rgba(238,210,155,0.92);border:1px solid rgba(110,65,10,0.6);'
      +'border-radius:3px;padding:2px 7px;line-height:1;white-space:nowrap;'
      +'max-width:88%;overflow:hidden;text-overflow:ellipsis';
    titleTag.textContent=bounty.theme;
    titleEl.appendChild(titleTag);
    div.appendChild(titleEl);
  }

  var content=document.createElement('div');
  content.style.cssText='position:absolute;top:0;left:0;right:0;bottom:0;'
    +'padding:8% 9% 15% 6%;display:flex;flex-direction:column;justify-content:space-evenly;'
    +'opacity:0;overflow:hidden;box-sizing:border-box;pointer-events:none;z-index:2';

  var contentW=Math.round(scrollW*0.78);
  var sz=Math.max(14,Math.min(32,Math.floor(contentW/9))); // fixed at 7-letter word scale
  var words=bounty.words||(bounty.word?[{word:bounty.word,reward:bounty.reward}]:[]);
  for(var i=0;i<words.length;i++){
    var row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:2px;flex-shrink:0;min-width:0';
    row.innerHTML=wordAsTilesHTML(words[i].word.toUpperCase(),sz,null)
      +'<span style="color:#3a2510;font-family:\'Jersey 10\',Georgia,serif;flex-shrink:0;margin-left:auto;line-height:1;font-size:'+Math.max(12,Math.round(sz*0.85))+'px">$'+words[i].reward+'</span>';
    content.appendChild(row);
  }
  div.appendChild(content);

  function _bImg(f){div.style.backgroundImage='url(\'Assets/animations/bounty scroll/bounty_scroll'+f+'.png\')';}

  function _getSiblings(){
    var brow=document.getElementById('bounty-row');if(!brow)return [];
    var all=brow.querySelectorAll('.bounty-scroll'),r=[];
    for(var k=0;k<all.length;k++)if(all[k]!==div)r.push(all[k]);
    return r;
  }

  div.addEventListener('mouseenter',function(){if(!div._unfurled&&!div._anim)_bImg(2);});
  div.addEventListener('mouseleave',function(){if(!div._unfurled&&!div._anim)_bImg(1);});

  div.addEventListener('click',function(){
    if(div._anim)return;

    if(div._unfurled){
      // CLOSE (reverse at 60% faster):
      // 1. Hide content; 2. Play frames 10→1 (24ms each); 3. Slide back + shrink; 4. Siblings fade in
      content.style.opacity='0';
      div._unfurled=false;
      div._anim=true;
      var f=10;
      (function nf(){
        _bImg(f);
        if(f>1){f--;setTimeout(nf,AT(24));}
        else{
          // Slide back to original DOM position and shrink simultaneously
          div.style.transition='transform '+(AT(120)/1000)+'s ease,padding-top '+(AT(120)/1000)+'s ease';
          div.style.paddingTop='30%';
          div.style.transform='';
          setTimeout(function(){
            div.style.transition='';
            div._anim=false;
            var sibs=_getSiblings();
            for(var j=0;j<sibs.length;j++){
              void sibs[j].offsetHeight;
              sibs[j].style.transition='opacity '+(AT(200)/1000)+'s';
              sibs[j].style.opacity='';
              sibs[j].style.pointerEvents='';
            }
          },AT(130));
        }
      })();

    }else{
      // OPEN:
      // 1. Siblings disappear instantly; 2. Scroll slides up to bounty-row top + expands; 3. Play frames 3→11
      var sibs=_getSiblings();
      for(var j=0;j<sibs.length;j++){
        sibs[j].style.transition='none';
        sibs[j].style.opacity='0';
        sibs[j].style.pointerEvents='none';
      }
      var brow=document.getElementById('bounty-row');
      var browTop=brow?brow.getBoundingClientRect().top:0;
      var divTop=div.getBoundingClientRect().top;
      div._slideUp=divTop-browTop; // pixels to translate up
      void div.offsetHeight;
      div.style.transition='transform '+(AT(300)/1000)+'s ease,padding-top '+(AT(300)/1000)+'s ease';
      div.style.paddingTop='100%';
      div.style.transform='translateY(-'+div._slideUp+'px)';
      div._anim=true;
      setTimeout(function(){
        div.style.transition='';
        var f=3;
        (function nf(){
          _bImg(f);
          if(f<11){f++;setTimeout(nf,AT(60));}
          else{content.style.opacity='1';div._unfurled=true;div._anim=false;}
        })();
      },AT(300));
    }
  });

  return div;
}

function renderAll(){renderHUD();renderBoard();renderHand();renderStampBar();if(typeof renderConsumables==='function')renderConsumables();document.getElementById('bag-count').textContent=S.bag.length;_tooltipRefreshIfOpen();}

function renderHUD(){
  var dhb=document.getElementById('dev-hotbar');if(dhb)dhb.style.display=S.devMode?'flex':'none';
  var dp=document.getElementById('dev-palette');
  if(!S.devMode&&dp)dp.style.display='none';
  var stickerTab=document.getElementById('dev-tab-stickers');
  var _invN=(S.stickerInventory||[]).length;
  if(stickerTab){stickerTab.textContent='Stickers'+(_invN>0?' ('+_invN+')':'');}
  var psb=document.getElementById('place-stickers-btn');
  if(psb){psb.style.display=(S.phase==='play'&&_invN>0)?'block':'none';if(_invN>0)psb.textContent='Place Stickers ('+_invN+')';}

  if(S.devMode&&typeof _devTab!=='undefined'&&_devTab==='stickers'&&dp&&dp.style.display!=='none')devRenderPalette();
  var solb=document.getElementById('solver-btn');if(solb)solb.style.display=S.devMode?'':'none';
  document.getElementById('hud-gold').textContent=S.devMode?'∞ DEV':'$'+S.gold;
  // During shop phase the visible gold counter is the shop's, not the left panel's —
  // keep both in sync so mid-shop gold changes (stamp sells, slot payouts) show immediately.
  var _shg=document.getElementById('shop-gold-display');if(_shg)_shg.textContent='$'+S.gold;
  var _shs=document.getElementById('shop-sub');if(_shs)_shs.textContent='Gold: $'+S.gold;
  document.getElementById('hud-plays').textContent=S.plays;
  document.getElementById('hud-disc').textContent=S.disc;
  var b=cb();
  var _bn=document.getElementById('round-name');if(_bn)_bn.textContent=b[0];
  var _bs=document.getElementById('round-sub');if(_bs)_bs.textContent=b[1];
  var _rp=document.getElementById('run-progress');if(_rp)_rp.textContent=S.score.toLocaleString()+' / '+tgt().toLocaleString();
  var pct=Math.min(100,S.score/tgt()*100);
  document.getElementById('score-bar').style.height=pct+'%';
  document.getElementById('score-txt').textContent=S.score.toLocaleString()+' / '+tgt().toLocaleString();
  var brow=document.getElementById('bounty-row');if(brow){brow.innerHTML='';var blist=S.bounties||[];for(var bi=0;bi<blist.length;bi++)brow.appendChild(_makeBountyScroll(blist[bi]));}
  // Tracker frames 1-24 = the 24 rounds; frame 25 = all boards complete.
  // Endless loops back through the tracker from board 1 (frame 1), one
  // window per endless board.
  var _ptSpr=document.getElementById('progress-tracker-sprite');
  if(_ptSpr){var _ptF=S.endless?(endlessBoard()%BOARDS.length)*3+S.bi+1:Math.min(BOARDS.length*3,S.ai*3+S.bi+1);_ptSpr.src='Assets/animations/progress tracker/progress_tracker'+_ptF+'.png';}
  var _scrb=document.getElementById('stat-rounds-box'),_scru=document.getElementById('stat-constraint-upcoming');
  if(_scrb&&_scru){
    var _ucdef=null;
    if(!S.endless&&S.constraintOrder){var _ucid=S.constraintOrder[S.ai];if(_ucid){for(var _ui=0;_ui<CONSTRAINTS.length;_ui++){if(CONSTRAINTS[_ui].id===_ucid){_ucdef=CONSTRAINTS[_ui];break;}}}}
    if(_ucdef){_scru.textContent=((S.bi===2)?'Constraint':'Upcoming Constraint')+': '+_ucdef.name+' — '+_ucdef.desc;_scrb.style.display='';}
    else{_scrb.style.display='none';}
  }
}

function sqStyle(id){
  if(!id)return{bg:'#1a3a12',fg:'#2d6020',lbl:''};
  var d=sqd(id);if(!d)return{bg:'#1a3a12',fg:'#2d6020',lbl:''};
  return{bg:d.bg,fg:d.fg,lbl:d.icon};
}

function renderBoard(){
  if(typeof _clearStickerFloats==='function')_clearStickerFloats();
  var wrap=document.getElementById('board-wrap');
  var sz=Math.max(30,Math.min(64,Math.floor(Math.min(window.innerWidth*0.52-80,window.innerHeight-250)/B)))+2;
  wrap.style.gridTemplateColumns='repeat('+B+','+sz+'px)';wrap.innerHTML='';
  var center=Math.floor(B/2)*B+Math.floor(B/2);
  var _bcon=currentConstraint();
  var _stickerLocked=_bcon==='c_stickers'&&!(S.stickersSoldThisBoard>0);
  var _lettersUsed=_bcon==='c_letters'&&S.usedLetters&&S.usedLetters.size>0;
  for(var i=0;i<B*B;i++){
    var sq=document.createElement('div');sq.className='sq';sq.dataset.sqIdx=i;
    sq.style.width=sz+'px';sq.style.height=sz+'px';
    // Focus mode: strip all sticker art — bare board grid + tiles only.
    var _fm=window._focusMode;
    var sid=_fm?null:S.board[i];var ss=sqStyle(sid);
    if(!sid){
      sq.style.backgroundImage='url(Assets/sprites/board-tile.png)';
      sq.style.backgroundSize=sz+'px '+sz+'px';
      sq.style.imageRendering='pixelated';
      sq.style.border='none';sq.style.borderRadius='0';
      sq.style.color='#6a9060';
    } else {
      sq.style.background=ss.bg;sq.style.color=ss.fg;
    }
    var bt=S.bt[i];var showTile=bt&&bt.state!=='dragging';
    if(showTile){
        var spr=(bt.isBlank&&bt.blankAs)?blankTileSpr(bt.blankAs,bt.variant||null,sz):tileSpr(bt.isBlank?null:bt.letter,bt.isBlank,bt.variant||null,sz);
      // Committed Jenga stack: render the preserved buried tile at base so the
      // top can slide aside to reveal (and score) it, like a fresh stack.
      if(!bt.isNew&&bt._buried){
        var _bu=bt._buried;
        var _buSpr=(_bu.isBlank&&_bu.blankAs)?blankTileSpr(_bu.blankAs,_bu.variant||null,sz):tileSpr(_bu.isBlank?null:_bu.letter,_bu.isBlank,_bu.variant||null,sz);
        var _buFace=document.createElement('div');
        _buFace.className='tile board-tile'+(_bu.variant?' var-'+_bu.variant:'')+' tile-spr';
        _buFace.style.cssText='position:absolute;left:0;top:0;width:'+sz+'px;height:'+sz+'px;'+_buSpr;
        applyTileLayers(_buFace,_bu,sz,_buSpr);
        sq.appendChild(_buFace);
      }
      var _stkCls=(!bt.isNew&&bt._stackLevel>0)?(bt._stackLevel>=2?' jenga-stacked-2':' jenga-stacked'):'';
      var _topCls=(!bt.isNew&&bt._buried)?' jenga-top':'';
      var face=document.createElement('div');face.className='tile board-tile'+(bt.isNew?' is-new':'')+_stkCls+_topCls+(bt.variant?' var-'+bt.variant:'')+' tile-spr';
      face.style.cssText='position:absolute;left:0;top:0;width:'+sz+'px;height:'+sz+'px;'+spr;
      face.dataset.spr=spr;face.dataset.tsz=sz;
      applyTileLayers(face,bt,sz,spr);
      if(bt.isNew){if(_fm)attachFocusBoardDrag(face,i,false);else attachBoardTileDrag(face,i,sz);}
      else if(!_fm&&S.phase==='play'&&bt.material==='glass'&&!bt._buried&&!bt._stackLevel)attachGlassRetrieve(face,i);
      // Jenga: click on committed tile to stack a selected hand tile
      if(!bt.isNew&&!bt._stackLevel&&!(S.btTop&&S.btTop[i])&&S.phase==='play'&&typeof hasJenga==='function'&&hasJenga()){
        (function(sqI){sq.addEventListener('click',function(ev){
          if(Date.now()-_dragEndTime<300)return;
          var sel=[];for(var _si=0;_si<S.hand.length;_si++){if(S.hand[_si]&&S.hand[_si].sel)sel.push(_si);}
          if(!sel.length)return;
          if(sel.length===1){var oi=sel[0];var t=S.hand[oi];t.sel=false;
            if(t.isBlank&&!t.blankAs){openBlankChooser(t,function(){placeTile(t,sqI);renderBoard();renderHand();});}
            else{placeTile(t,sqI);renderBoard();renderHand();}
          }
          ev.stopPropagation();
        });})(i);
      }
      sq.appendChild(face);
      if(_lettersUsed&&!bt.isBlank&&bt.letter&&S.usedLetters.has(bt.letter)){var _lov=document.createElement('div');_lov.style.cssText='position:absolute;left:0;top:0;width:'+sz+'px;height:'+sz+'px;background:rgba(180,0,0,0.5);display:flex;align-items:center;justify-content:center;font-size:'+Math.round(sz*0.65)+'px;font-weight:bold;color:#ff3333;pointer-events:none;z-index:5;font-family:monospace;';_lov.textContent='×';sq.appendChild(_lov);}
    } else {
      var _sqd=sqd(sid);
      var lbl=ss.lbl;if(i===center&&!sid&&!_fm)lbl='*';
      if(_sqd&&_sqd.iconPng){
        sq.style.border='none';sq.style.borderRadius='0';
        var img=document.createElement('img');img.src=_sqd.iconPng;img.style.cssText='position:absolute;left:0;top:0;width:'+sz+'px;height:'+sz+'px;image-rendering:pixelated;pointer-events:none';sq.appendChild(img);
      } else if(lbl){var s=document.createElement('div');s.className='sq-lbl';s.textContent=lbl;sq.appendChild(s);}
      if(_stickerLocked&&sid&&!bt){var _sov=document.createElement('div');_sov.style.cssText='position:absolute;left:0;top:0;width:'+sz+'px;height:'+sz+'px;background:rgba(180,0,0,0.5);display:flex;align-items:center;justify-content:center;font-size:'+Math.round(sz*0.65)+'px;font-weight:bold;color:#ff3333;pointer-events:none;z-index:5;font-family:monospace;';_sov.textContent='×';sq.appendChild(_sov);}
      if(S.phase==='play'&&!bt){
        (function(sqI){
          sq.addEventListener('click',function(ev){
            if(Date.now()-_dragEndTime<300)return;
            var sel=[];for(var _si=0;_si<S.hand.length;_si++){if(S.hand[_si]&&S.hand[_si].sel)sel.push(_si);}
            if(sel.length===0)return;
            if(window.TUT&&TUT.active&&!_tutClickPlaceOK(sel.length,'h'))return;
            if(sel.length===1){
              var oi=sel[0];var t=S.hand[oi];t.sel=false;
              if(t.isBlank&&!t.blankAs){openBlankChooser(t,function(){placeTile(t,sqI);renderBoard();renderHand();});}
              else{placeTile(t,sqI);renderBoard();renderHand();}
            } else {
              multiPlaceSelected(sel,sqI,'h');
            }
            ev.stopPropagation();
          });
          sq.addEventListener('contextmenu',function(ev){
            ev.preventDefault();ev.stopPropagation();
            if(Date.now()-_dragEndTime<300)return;
            var sel=[];for(var _si=0;_si<S.hand.length;_si++){if(S.hand[_si]&&S.hand[_si].sel)sel.push(_si);}
            if(window.TUT&&TUT.active&&sel.length&&!_tutClickPlaceOK(sel.length,'v'))return;
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
    if(S.btTop&&S.btTop[i]&&S.btTop[i].state!=='dragging'){
      var btt=S.btTop[i];
      var sprT=(btt.isBlank&&btt.blankAs)?blankTileSpr(btt.blankAs,btt.variant||null,sz):tileSpr(btt.isBlank?null:btt.letter,btt.isBlank,btt.variant||null,sz);
      var _btopLvl=(S.bt[i]&&S.bt[i]._stackLevel?S.bt[i]._stackLevel:0)+1;
      var topFace=document.createElement('div');
      topFace.className='tile board-tile is-new jenga-top'+(btt.variant?' var-'+btt.variant:'')+' tile-spr '+(_btopLvl>=2?'jenga-stacked-2':'jenga-stacked');
      topFace.style.cssText='position:absolute;left:0;top:0;width:'+sz+'px;height:'+sz+'px;'+sprT;
      topFace.dataset.spr=sprT;topFace.dataset.tsz=sz;
      applyTileLayers(topFace,btt,sz,sprT);
      if(btt.isNew){if(_fm)attachFocusBoardDrag(topFace,i,true);else attachBoardTileDrag(topFace,i,sz,true);}
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
// Tracks whatever tooltip is currently visible (hover or frozen) so it can be live-refreshed
// when game state changes (e.g. a scaling sticker/stamp counter ticks up) without re-triggering the fade-in.
var _sqTooltipOpenSqIdx=-1;
var _sqTooltipOpenId=null;
var _stampTooltipOpenTs=null;

function _sqTooltipFillContent(id,p){
  var d=sqd(id);if(!d)return;
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
}

function _sqTooltipRender(sqIdx,id){
  var d=sqd(id);if(!d)return;
  var el=document.getElementById('sq-hover-tooltip');if(!el)return;
  var p=null;for(var i=0;i<S.placed.length;i++)if(S.placed[i].sqIdx===sqIdx){p=S.placed[i];break;}
  _sqTooltipFillContent(id,p);
  _sqTooltipOpenSqIdx=sqIdx;_sqTooltipOpenId=id;_stampTooltipOpenTs=null;
  var cb=document.getElementById('constraint-banner');
  if(cb){el._cbWas=cb.style.display;cb.style.display='none';}
  el.style.display='block';
  el.style.opacity='0';
  requestAnimationFrame(function(){el.style.opacity='1';});
}

// Re-fills the currently-open tooltip's content in place (no fade/animation restart) so
// scaling stamp descriptions (crossroads, bounty_hunter, etc.) update live while hovered.
function _tooltipRefreshIfOpen(){
  var el=document.getElementById('sq-hover-tooltip');if(!el||el.style.display==='none')return;
  if(_stampTooltipOpenTs){
    var ts=_stampTooltipOpenTs;
    if(S.stamps.indexOf(ts)<0){_stampTooltipHide();return;}
    _sqTooltipFillContent(ts.id,ts);
  }else if(_sqTooltipOpenSqIdx>=0&&_sqTooltipOpenId){
    var p=null;for(var i=0;i<S.placed.length;i++)if(S.placed[i].sqIdx===_sqTooltipOpenSqIdx){p=S.placed[i];break;}
    if(!p){if(_sqTooltipFrozen)_sqTooltipUnfreeze();else _sqTooltipHide();return;}
    _sqTooltipFillContent(_sqTooltipOpenId,p);
  }
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
    sellBtn.onclick=(function(si,_di,sv,dn){return function(){
      S.gold+=sv;S.board[si]=null;S.placed=S.placed.filter(function(p){return p.sqIdx!==si;});
      if(currentConstraint()==='c_stickers')S.stickersSoldThisBoard=(S.stickersSoldThisBoard||0)+1;
      _sqTooltipUnfreeze();renderBoard();renderHUD();toast(dn+' sold for $'+sv);
      _rankObserve(true); // board scoring changed under the same rack
    };})(sqIdx,id,sell,d.name);
  }
  if(act)act.style.display='flex';
}

function _sqTooltipUnfreeze(){
  _sqTooltipFrozen=false;_sqTooltipFrozenIdx=-1;_sqTooltipFrozenId=null;
  _sqTooltipOpenSqIdx=-1;_sqTooltipOpenId=null;
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
  _sqTooltipOpenSqIdx=-1;_sqTooltipOpenId=null;
  var el=document.getElementById('sq-hover-tooltip');if(!el||el.style.display==='none')return;
  el.style.opacity='0';
  el.style.display='none';
  var cb=document.getElementById('constraint-banner');
  if(cb&&el._cbWas!==undefined){cb.style.display=el._cbWas;el._cbWas=undefined;}
}

// ---- Stamp bar hover tooltip (mirrors board sticker tooltip, no freeze/sell) ----

function _stampTooltipRender(ts){
  var d=sqd(ts.id);if(!d)return;
  var el=document.getElementById('sq-hover-tooltip');if(!el)return;
  _sqTooltipFillContent(ts.id,ts);
  _stampTooltipOpenTs=ts;_sqTooltipOpenSqIdx=-1;_sqTooltipOpenId=null;
  var act=document.getElementById('sqht-actions');if(act)act.style.display='none';
  var cb=document.getElementById('constraint-banner');
  if(cb&&el._cbWas===undefined){el._cbWas=cb.style.display;cb.style.display='none';}
  el.style.display='block';
  el.style.opacity='0';
  requestAnimationFrame(function(){el.style.opacity='1';});
}

function _stampTooltipShow(ts){
  var d=sqd(ts.id);if(!d)return;
  clearTimeout(_sqTooltipTimer);
  _sqTooltipFrozen=false;_sqTooltipFrozenIdx=-1;_sqTooltipFrozenId=null;
  _sqTooltipTimer=setTimeout(function(){_stampTooltipRender(ts);},250);
}

function _stampTooltipHide(){
  clearTimeout(_sqTooltipTimer);_sqTooltipTimer=null;
  _stampTooltipOpenTs=null;
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
  for(var i=0;i<S.hand.length;i++)if(S.hand[i]&&S.hand[i].state==='hand')vis.push({t:S.hand[i],oi:i});
  hpRebuild(vis);
  for(var vi=0;vi<vis.length;vi++){
    var t=vis[vi].t,oi=vis[vi].oi;
    // Tiles mid-flight from the bag are drawn by their burst clone — creating the real
    // element too would show the tile twice until the burst lands.
    if(_burstTileIds&&_burstTileIds[t.id])continue;
    var spr=(t.isBlank&&t.blankAs)?blankTileSpr(t.blankAs,t.variant||null,68):tileSpr(t.isBlank?null:t.letter,t.isBlank,t.variant||null,68);
    var face=document.createElement('div');
    face.className='tile hand-tile'+(t.isBlank?' blank-t':'')+(t.sel?' selected':'')+(t.variant?' var-'+t.variant:'')+' tile-spr';
    face.style.cssText='width:68px;height:68px;left:'+(HP.x[vi]-34-HP.left)+'px;top:0;'+spr;
    face.dataset.spr=spr;
    face.dataset.tileId=t.id;
    applyTileLayers(face,t,68,spr);
    area.appendChild(face);
    attachHandTileDrag(face,oi,vi,t,vis);
  }
}

function isSqStaged(idx){return S.sqStaged&&S.sqStaged.hasOwnProperty(idx);}

function renderSqHand(){
  hpBounds();
  var area=document.getElementById('hand-area');area.innerHTML='';
  // A stale _dragging flag with no active drag (e.g. restored from a save) must not
  // hide the item forever, hence the activeDrag guard.
  var vis=S.sqHand.filter(function(sq){return !sq.placed&&!(sq._dragging&&activeDrag);});
  hpRebuild(vis);
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

function _renderStampBarInto(bar,ph,src){
  bar.innerHTML='';
  // A dragging stamp lives on document.body (detached drag) — exclude it from the
  // bar. Stale _dragging with no active drag (e.g. from a save) must not hide it.
  var stamps=(S.stamps||[]).filter(function(t){return !(t._dragging&&activeDrag);});
  ph.rebuild(stamps);
  for(var vi=0;vi<stamps.length;vi++){
    var ts=stamps[vi];var d=sqd(ts.id);if(!d)continue;
    var face=document.createElement('div');
    face.className='stamp-tile'+(ts.sel?' selected':'');
    face.setAttribute('data-stamp-id',ts.id);
    face.setAttribute('data-stamp-vi',S.stamps.indexOf(ts)); // index into S.stamps — lets _bounceStamp target one copy
    var tw=ph.TILE_W;
    var topPx=src==='shop-stamp'?2:8;
    var baseCss='position:absolute;width:'+tw+'px;height:'+tw+'px;top:'+topPx+'px;left:'+(ph.x[vi]-tw/2-ph.left)+'px;';
    if(d.iconPng){
      // Rounded clip on an inner wrap, not the face — the face must be free to host
      // the sell button above itself when selected.
      face.style.cssText=baseCss;
      face.innerHTML='<div style="width:'+tw+'px;height:'+tw+'px;border-radius:8px;overflow:hidden"><img src="'+d.iconPng+'" style="width:'+tw+'px;height:'+tw+'px;image-rendering:pixelated;display:block;pointer-events:none"></div>';
    } else {
      face.style.cssText=baseCss+'background:#12122a;border:2px solid '+d.fg+';border-radius:8px;color:'+d.fg+';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;';
      face.innerHTML=sqIconHTML(d,Math.round(tw*28/68))+'<span style="font-size:'+Math.round(tw*10/68)+'px;text-align:center;pointer-events:none;overflow:hidden;width:'+Math.round(tw*64/68)+'px;white-space:nowrap;text-overflow:ellipsis">'+d.name+'</span>';
    }
    if(ts.sel){
      var sb=document.createElement('div');
      sb.className='stamp-sell-btn';
      sb.textContent='Sell $'+(Math.floor(d.cost/2)+(ts.sellBonus||0));
      sb.addEventListener('pointerdown',function(e){e.stopPropagation();e.preventDefault();});
      sb.addEventListener('click',function(tsRef){return function(e){e.stopPropagation();sellStamp(S.stamps.indexOf(tsRef));};}(ts));
      face.appendChild(sb);
    }
    if(ts.id==='easy_mode'){face.addEventListener('mouseenter',_easyHintShow);face.addEventListener('mouseleave',_easyHintHide);}
    face.addEventListener('mouseenter',function(tsRef){return function(){_stampTooltipShow(tsRef);};}(ts));
    face.addEventListener('mouseleave',_stampTooltipHide);
    bar.appendChild(face);
    attachStampDrag(face,vi,ts,ph,src);
  }
}

function renderStampBar(){
  SP.bounds();
  var bar=document.getElementById('stamp-bar');if(!bar)return;
  _renderStampBarInto(bar,SP,'stamp');
  // n/5 counter on right side of box
  var stamps=S.stamps||[];
  var ctr=document.createElement('div');
  ctr.style.cssText='position:absolute;right:16px;bottom:-15px;font-size:28px;color:#8880a8;pointer-events:none;line-height:1';
  ctr.textContent=stamps.length+"/5";
  bar.appendChild(ctr);
  // Update shop stamp bar
  var shopBar=document.getElementById('shop-stamp-bar');
  if(shopBar){SSP.bounds();_renderShopPhysicsStampBar(shopBar);}
  // Update board preview stamp bar if visible
  var previewBar=document.getElementById('preview-stamp-bar');
  if(previewBar&&document.getElementById('board-preview-modal').style.display!=='none'){
    _renderPreviewStampBar(previewBar);
  }
}

function _renderShopPhysicsStampBar(bar){
  _renderStampBarInto(bar,SSP,'shop-stamp');
  // n/5 counter to the right of the last tile (only when there are stamps)
  var stamps=S.stamps||[];
  if(stamps.length>0){
    var ctr=document.createElement('div');
    ctr.style.cssText='position:absolute;font-size:clamp(7px,1.2vw,17px);color:#8880a8;pointer-events:none;line-height:1;top:50%;transform:translateY(-50%)';
    // position it just right of the last tile
    SSP.bounds();
    var lastX=SSP.x.length>0?SSP.x[stamps.length-1]+SSP.TILE_W/2-SSP.left:0;
    ctr.style.left=(lastX+6)+'px';
    ctr.textContent=stamps.length+"/5";
    bar.appendChild(ctr);
  }
}

function _renderPreviewStampBar(container){
  container.innerHTML='';
  var stamps=S.stamps||[];
  if(!stamps.length)return;
  var label=document.createElement('div');label.style.cssText='color:#8880a8;font-size:28px;align-self:center;flex-shrink:0';label.textContent='Stamps:';
  container.appendChild(label);
  for(var i=0;i<stamps.length;i++){
    var d=sqd(stamps[i].id);if(!d)continue;
    var slot=document.createElement('div');
    slot.style.cssText='width:40px;height:40px;border:1px solid #5a5a9a;border-radius:6px;background:#0d0d1e;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;position:relative';
    slot.title=d.name+' — '+d.desc;
    if(d.iconPng){
      var img=document.createElement('img');img.src=d.iconPng;img.style.cssText='width:36px;height:36px;image-rendering:pixelated;display:block;pointer-events:none';
      slot.appendChild(img);
    } else {
      slot.innerHTML=sqIconHTML(d,22);
    }
    container.appendChild(slot);
  }
}

function sellStamp(idx){
  var ts=S.stamps[idx];if(!ts)return;
  var d=sqd(ts.id);if(!d)return;
  var sv=Math.floor(d.cost/2)+(ts.sellBonus||0); // Egg grows sellBonus each round
  S.stamps.splice(idx,1);
  S.gold+=sv;
  if(currentConstraint()==='c_stickers')S.stickersSoldThisBoard=(S.stickersSoldThisBoard||0)+1;
  renderStampBar();renderHUD();
  toast(d.name+' sold for $'+sv+'!');
  if(d.onSell)d.onSell();
  _rankObserve(true); // stamp scoring changed under the same rack
}
