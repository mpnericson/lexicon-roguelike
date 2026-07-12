// =====================================================================
// DRAG — tile and sticker drag-and-drop engine
// =====================================================================
function makeDragClone(innerHTML,css,extraClass){
  var el=document.createElement('div');el.className='tile'+(extraClass?' '+extraClass:'');
  el.style.cssText='position:fixed;z-index:9999;pointer-events:none;'+css;
  el.innerHTML=innerHTML;document.body.appendChild(el);return el;
}

function clearHL(){if(_hl>=0){var e=document.querySelector('[data-sq-idx="'+_hl+'"]');if(e)e.classList.remove('drop-target');}_hl=-1;}
function hasJenga(){return hasTileSticker('jenga');}
function _jengaCanStack(idx){return hasJenga()&&S.bt[idx]&&!S.bt[idx].isNew&&!(S.btTop&&S.btTop[idx]);}
function setHL(idx){
  if(idx===_hl)return;clearHL();_hl=idx;
  if(idx>=0&&(!S.bt[idx]||_jengaCanStack(idx))){var e=document.querySelector('[data-sq-idx="'+idx+'"]');if(e)e.classList.add('drop-target');}
}

function sqAt(x,y){
  var els=document.elementsFromPoint(x,y);
  for(var i=0;i<els.length;i++)if(els[i].dataset&&els[i].dataset.sqIdx!==undefined)return parseInt(els[i].dataset.sqIdx);
  return -1;
}

function inHand(x,y){var r=document.getElementById('hand-area').getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top-40&&y<=r.bottom+20;}
function inBoardBounds(x,y){var bw=document.getElementById('board-wrap');if(!bw)return false;var r=bw.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;}

function attachHandTileDrag(face,oi,vi,tile){
  face.dataset.handOi=String(oi);
  face.addEventListener('pointerdown',function(ev){
    // Left button only — up() ignores non-left releases (right-click pivots mid-drag),
    // so a right/middle press here would leak the move/up listeners permanently.
    if(ev.button!==0)return;
    ev.preventDefault();ev.stopPropagation();
    if(activeDrag)return;
    if(document.getElementById('live-score-row').classList.contains('scoring'))return;
    var _selGroup=[];
    if(tile.sel){for(var _msi=0;_msi<S.hand.length;_msi++){if(S.hand[_msi]&&S.hand[_msi].sel&&S.hand[_msi].state==='hand')_selGroup.push({t:S.hand[_msi],oi:_msi});}}
    if(_selGroup.length<=1)_selGroup=[{t:tile,oi:oi}];
    _startMultiDrag(ev,oi,vi,_selGroup);
  });
}

function computeInsert(mouseX,dragVi){
  var n=HP.tiles.length;
  for(var i=0;i<n;i++){if(i===dragVi)continue;if(mouseX<HP.x[i])return i;}return n;
}

function reorderHand(fromOi,insertAt,vis,dropX){
  hpBounds();
  // Map positions by tile ID from HP.tiles (n-1 elements, dragging tile excluded) not vis (n elements).
  // Using vis[k]->HP.x[k] would misalign after the dragging tile's slot, making the last tile snap to x=0.
  var oldX={};
  for(var k=0;k<HP.tiles.length;k++){var _rtid=(HP.tiles[k].t&&HP.tiles[k].t.id)||null;if(_rtid)oldX[_rtid]=HP.x[k]||0;}
  var fv=-1;for(var k=0;k<vis.length;k++)if(vis[k].oi===fromOi){fv=k;break;}
  if(fv<0)return;
  oldX[vis[fv].t.id]=dropX!==undefined?dropX:((HP.aL+HP.aR)/2);
  var rem=vis.splice(fv,1)[0];
  var adj=insertAt>fv?insertAt-1:insertAt;adj=Math.max(0,Math.min(vis.length,adj));vis.splice(adj,0,rem);
  var nh=vis.map(function(e){return e.t;});
  HP.fromX=vis.map(function(e){return oldX[e.t.id]!==undefined?oldX[e.t.id]:((HP.aL+HP.aR)/2);});
  HP.toX=hpRest(vis.length);
  HP.settleDur=150;HP.settleAt=performance.now();
  HP.x=HP.fromX.slice();HP.vx=Array(vis.length).fill(0);S.hand=nh;
}

function attachBoardTileDrag(face,sqIdx,sz,isTop){
  face.addEventListener('pointerdown',function(ev){
    ev.preventDefault();ev.stopPropagation();if(activeDrag)return;
    if(document.getElementById('live-score-row').classList.contains('scoring'))return;
    var sr=face.getBoundingClientRect();var sx=ev.clientX,sy=ev.clientY;var moved=false;
    var _tsz=sz;
    function _getBtRef(){return isTop?(S.btTop&&S.btTop[sqIdx]):S.bt[sqIdx];}
    function move(me){
      var dx=me.clientX-sx,dy=me.clientY-sy;
      if(!moved&&Math.sqrt(dx*dx+dy*dy)>5){
        moved=true;_playTileClick('pick');
        var sprCss=face.dataset.spr||'';_tsz=parseInt(face.dataset.tsz)||sz;
        if(face.parentNode)face.parentNode.removeChild(face);
        face.style.cssText='position:fixed;z-index:9999;pointer-events:none;width:'+_tsz+'px;height:'+_tsz+'px;left:'+(me.clientX-_tsz/2)+'px;top:'+(me.clientY-_tsz/2)+'px;transform:scale(1);transform-origin:center center;box-shadow:0 4px 12px rgba(0,0,0,.5);transition:transform 0.1s ease,box-shadow 0.1s ease;'+(sprCss||'background:#f0e080;border-color:#a89000;');
        document.body.appendChild(face);
        var btRef=_getBtRef();if(btRef)setTileState(btRef,'dragging');
        activeDrag={src:'board',sqIdx:sqIdx,isTop:!!isTop,cx:me.clientX,cy:me.clientY,multiCount:1,gapLeft:me.clientX,gapRight:me.clientX};
        renderBoard();
      }
      if(moved){
        face.style.left=(me.clientX-_tsz/2)+'px';face.style.top=(me.clientY-_tsz/2)+'px';
        var _ob=sqAt(me.clientX,me.clientY)>=0||inBoardBounds(me.clientX,me.clientY);
        face.style.transform='scale('+(_ob?'1':(68/_tsz).toFixed(3))+')';
        face.style.boxShadow=_ob?'0 4px 12px rgba(0,0,0,.5)':'0 12px 28px rgba(0,0,0,.7)';
        activeDrag.cx=me.clientX;activeDrag.cy=me.clientY;activeDrag.gapLeft=me.clientX;activeDrag.gapRight=me.clientX;
        var over=sqAt(me.clientX,me.clientY);if(over>=0&&over!==sqIdx&&!S.bt[over])setHL(over);else clearHL();
      }
    }
    function up(me){
      document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);
      if(!moved){recallTile(sqIdx);return;}
      _dragEndTime=Date.now();clearHL();
      var btRef=_getBtRef();if(btRef)setTileState(btRef,'board',{boardSq:sqIdx,isNew:true});
      var over=sqAt(me.clientX,me.clientY);var ih=inHand(me.clientX,me.clientY);
      if(ih){
        var _dBt=_getBtRef();
        var _faceX=parseFloat(face.style.left)+_tsz/2;
        if(face.parentNode)face.parentNode.removeChild(face);
        if(_dBt){
          if(isTop){if(S.btTop)S.btTop[sqIdx]=null;}else{S.bt[sqIdx]=null;}
          var _ins=Math.max(0,Math.min(computeInsert(me.clientX,-1),S.hand.length));
          setTileState(_dBt,'hand');S.hand.splice(_ins,0,_dBt);
        }
        activeDrag=null;renderBoard();renderHand();
        if(_dBt){
          HP.fromX=HP.x.slice();
          for(var k=0;k<S.hand.length;k++){if(S.hand[k]===_dBt){HP.fromX[k]=_faceX;break;}}
          HP.toX=hpRest(S.hand.length);
          HP.settleDur=180;HP.settleAt=performance.now();
          HP.x=HP.fromX.slice();HP.vx=Array(S.hand.length).fill(0);
          hpDraw();
        }
        _playTileClick('land');
      } else if(over>=0&&over!==sqIdx&&!S.bt[over]){
        var sqEl=document.querySelector('[data-sq-idx="'+over+'"]');var tr=sqEl?sqEl.getBoundingClientRect():null;
        if(tr){face.style.transition='left .13s,top .13s,transform .13s';face.style.left=(tr.left+tr.width/2-_tsz/2)+'px';face.style.top=(tr.top+tr.height/2-_tsz/2)+'px';face.style.transform='scale(1)';}
        setTimeout(function(){
          if(face.parentNode)face.parentNode.removeChild(face);
          var src=_getBtRef();
          if(src){
            if(isTop){if(S.btTop)S.btTop[sqIdx]=null;}else{S.bt[sqIdx]=null;}
            setTileState(src,'board',{boardSq:over,isNew:true});
            S.bt[over]=src;
          }
          activeDrag=null;renderBoard();renderHand();
        },140);
      } else {
        face.style.transition='left .14s,top .14s,transform .14s';face.style.left=sr.left+'px';face.style.top=sr.top+'px';face.style.transform='scale(1)';
        setTimeout(function(){if(face.parentNode)face.parentNode.removeChild(face);activeDrag=null;renderBoard();},140);
      }
    }
    document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);
  });
}

function attachSqDrag(face,vi,item){
  face.addEventListener('pointerdown',function(ev){
    ev.preventDefault();ev.stopPropagation();
    if(activeDrag)return;
    var sx=ev.clientX,sy=ev.clientY;var moved=false,clone=null;HP.held=vi;
    var d=sqd(item.id);
    function move(me){
      var dx=me.clientX-sx,dy=me.clientY-sy;
      if(!moved&&(Math.abs(dx)>4||Math.abs(dy)>4)){
        moved=true;
        var _cloneInner=d.iconPng
          ?'<img src="'+d.iconPng+'" style="width:68px;height:68px;image-rendering:pixelated;display:block;pointer-events:none"><span style="position:absolute;bottom:0;left:0;right:0;font-size:30px;text-align:center;background:rgba(0,0,0,0.6);padding:2px 0;color:#fff;pointer-events:none">'+d.name+'</span>'
          :sqIconHTML(d,28)+'<span style="font-size:30px;display:block;text-align:center">'+d.name+'</span>';
        var _cloneCss=d.iconPng
          ?'width:68px;height:68px;position:relative;overflow:hidden;image-rendering:pixelated;cursor:grabbing;'
          :'width:68px;height:68px;background:#12122a;border:2px solid '+d.fg+';border-radius:8px;color:'+d.fg+';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;';
        clone=makeDragClone(_cloneInner,_cloneCss);
        face.style.opacity='0';
        activeDrag={src:'hand',vi:vi,cx:me.clientX,cy:me.clientY};
      }
      if(!moved)return;
      var si=sqAt(me.clientX,me.clientY);
      if(si>=0&&!S.board[si]&&!isSqStaged(si)){setHL(si);}else{clearHL();}
      clone.style.left=(me.clientX-34)+'px';clone.style.top=(me.clientY-39)+'px';
      activeDrag.cx=me.clientX;activeDrag.cy=me.clientY;
    }
    function up(me){
      document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);
      HP.held=-1;if(clone){clone.remove();clone=null;}face.style.opacity='1';clearHL();
      if(moved){
        var si=sqAt(me.clientX,me.clientY);
        if(si>=0&&!S.board[si]&&!isSqStaged(si)){
          var globalIdx=S.sqHand.indexOf(item);
          S.sqStaged[si]=globalIdx;item.placed=true;
          renderSqHand();renderBoard();
        }
      }
      activeDrag=null;
    }
    document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);
  });
}

function computeStickerInsert(mouseX,dragVi,ph){
  var n=ph.tiles.length;
  for(var i=0;i<n;i++){if(i===dragVi)continue;if(mouseX<ph.x[i])return i;}return n;
}

function reorderStickers(fromVi,insertAt,ph){
  var stickers=S.tileStickers;
  var rem=stickers.splice(fromVi,1)[0];
  var adj=insertAt>fromVi?insertAt-1:insertAt;adj=Math.max(0,Math.min(stickers.length,adj));
  stickers.splice(adj,0,rem);
  ph.x=[];SP.x=[];SSP.x=[];// reset both bars so they spring to rest
}

// ph = physics instance (SP for game bar, SSP for shop bar), dragSrc = 'sticker'|'shop-sticker'
function attachStickerDrag(face,vi,ts,ph,dragSrc){
  face.addEventListener('pointerdown',function(ev){
    ev.preventDefault();ev.stopPropagation();
    if(activeDrag)return;
    var sx=ev.clientX,sy=ev.clientY;var sr=face.getBoundingClientRect();
    var moved=false,clone=null;ph.held=vi;
    if(ph.settleDur>=9999){ph.settleAt=0;ph.settleCallback=null;ph.settleDur=150;}
    function move(me){
      var dx=me.clientX-sx,dy=me.clientY-sy;
      if(!moved&&Math.sqrt(dx*dx+dy*dy)>8){
        moved=true;ph.held=-1;
        var d=sqd(ts.id);
        var tw=ph.TILE_W;
        var cloneInner=d&&d.iconPng
          ?'<img src="'+d.iconPng+'" style="width:'+tw+'px;height:'+tw+'px;image-rendering:pixelated;display:block;pointer-events:none">'
          :(d?sqIconHTML(d,Math.round(tw*28/68)):'');
        var cloneCss=d&&d.iconPng
          ?'width:'+tw+'px;height:'+tw+'px;overflow:hidden;border-radius:8px;'
          :'width:'+tw+'px;height:'+tw+'px;background:#12122a;border:2px solid '+(d?d.fg:'#5a5a9a')+';border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;';
        clone=makeDragClone(cloneInner,cloneCss+'box-shadow:0 12px 28px rgba(0,0,0,.7);transform:scale(1.12);transition:transform 0.1s ease,box-shadow 0.1s ease;');
        activeDrag={src:dragSrc,vi:vi,clone:clone,sx:sx,sy:sy,sr:sr,cx:sr.left+tw/2};
        renderTileStickerBar();
      }
      if(moved&&clone){
        var dx2=me.clientX-sx,dy2=me.clientY-sy;
        clone.style.left=(sr.left+dx2)+'px';clone.style.top=(sr.top+dy2)+'px';
        activeDrag.cx=sr.left+ph.TILE_W/2+dx2;activeDrag.cy=sr.top+ph.TILE_W/2+dy2;
      }
    }
    function up(me){
      document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);
      ph.held=-1;
      if(!moved){
        if(vi>0)ph.vx[vi-1]-=3;
        if(vi<ph.tiles.length-1)ph.vx[vi+1]+=3;
        _openTileStickerModal(vi,ts.id);
        return;
      }
      _dragEndTime=Date.now();
      if(!clone)return;
      if(ph.inArea(me.clientX,me.clientY)){
        var ins=computeStickerInsert(me.clientX,vi,ph);
        setTimeout(function(){if(clone.parentNode)clone.parentNode.removeChild(clone);reorderStickers(vi,ins,ph);activeDrag=null;renderTileStickerBar();},120);
      } else {
        clone.style.transition='left .14s,top .14s,transform .14s';clone.style.left=sr.left+'px';clone.style.top=sr.top+'px';clone.style.transform='scale(1)';
        setTimeout(function(){if(clone.parentNode)clone.parentNode.removeChild(clone);activeDrag=null;renderTileStickerBar();},140);
      }
    }
    document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);
  });
}

// Multi-tile drag: all selected tiles physically leave the hotbar together.
//
// Phase 1 (position-based):
//   All tiles rise together at cursor speed (y = cursor y). Anchor x tracks cursor; other
//   tiles hold their original hotbar x positions. Hotbar opens a gap of (group+2) tile-widths
//   at the anchor's old position and holds it frozen.
//
// Phase 2 (triggers when tile bottoms clear hand-area top, same threshold as ph.inArea):
//   Hotbar gap closes to rest positions. Dragging tiles sweep laterally to form a cluster
//   around the anchor. Both animate simultaneously.
//
// After _animUntil (~300ms post-Phase-2): all tiles follow cursor instantly as one group.
//
// Shift or right-click: pivot h↔v around the anchor at any time.
// Space: disperse all tiles back into the hand via arcing animations.
function _startMultiDrag(ev,dragOi,dragVi,selTiles){
  var sx=ev.clientX,sy=ev.clientY;
  var moved=false,dragEls=[],initRects=[];
  var dir='h';
  var _mHL=[];
  var _overBoard=false;
  var _animUntil=0;
  var _phase2Fired=false;
  var _lastCx=sx,_lastCy=sy,_lastSq=-1;
  var _committedSlotX=null; // locked slot centre when cursor crosses funnel threshold
  var dragIdx=0;
  // Lateral slide mode (single-tile only): tile rises above hotbar and slides along the top.
  var _latMode=false,_latExitTimer=null,_latPhantomEl=null;
  var _latFloatY=0,_latGapInsert=-1,_latOriginInsert=-1,_latDescending=false,_latDescentTimer=null,_latRiseTimer=null;
  // Surface-mode dwell: gap only opens after cursor stays in a slot zone for 800ms.
  // Exception: arriving from above (free mode) opens gap immediately.
  var _surfaceDwellTimer=null,_surfaceDwellSlotIdx=-1,_surfaceGapOpen=false;
  var _wasAtSurface=false; // true when cursor was at surface level last frame
  var _cameFromAbove=false; // true when gap opened via above-arrival (no dwell); suppresses lateral dwell on descent
  // Entry animation when gap opens: lerp tile from surface → slot and slow HP spring briefly.
  var _gapWasOpen=false,_gapOpenAt=-1,_gapOpenFromY=0,_springSlowed=false;
  for(var _di=0;_di<selTiles.length;_di++){if(selTiles[_di].oi===dragOi){dragIdx=_di;break;}}

  HP.held=dragVi;
  if(HP.settleDur>=9999){HP.settleAt=0;HP.settleCallback=null;HP.settleDur=150;}


  function _clearMHL(){
    for(var i=0;i<_mHL.length;i++){var e=document.querySelector('[data-sq-idx="'+_mHL[i]+'"]');if(e)e.classList.remove('drop-target');}
    _mHL=[];
  }
  // Convert anchor square (square under cursor) to the start square for the group.
  // Anchor tile is at dragIdx in the group, so leftmost/topmost tile is dragIdx steps back.
  function _startSq(anchorSq){
    var r=Math.floor(anchorSq/B),c=anchorSq%B;
    if(dir==='h')return r*B+Math.max(0,c-dragIdx);
    else return Math.max(0,r-dragIdx)*B+c;
  }
  function _computeFree(startSq){
    var r=Math.floor(startSq/B),c=startSq%B,free=[],n=selTiles.length;
    if(dir==='h'){for(var cc=c;cc<B&&free.length<n;cc++){var idx=r*B+cc;if(!S.bt[idx])free.push(idx);}}
    else{for(var rr=r;rr<B&&free.length<n;rr++){var idx=rr*B+c;if(!S.bt[idx])free.push(idx);}}
    return free.length>=n?free:null;
  }
  function _updateHL(anchorSq){
    _clearMHL();var targets=_computeFree(_startSq(anchorSq));if(!targets)return;
    for(var i=0;i<targets.length;i++){_mHL.push(targets[i]);var e=document.querySelector('[data-sq-idx="'+targets[i]+'"]');if(e)e.classList.add('drop-target');}
  }

  // Positions, scales, and shadows all dragging tiles as a single cluster around cursor.
  // Over board: step shrinks so tiles stay visually tight when scaled to 0.75.
  // posTr: CSS duration for left/top (e.g. '0.14s ease'); omit for instant.
  function _updateAll(cx,cy,overBoard,posTr){
    var sc=overBoard?0.75:1.08;
    var step=overBoard?Math.ceil(68*0.75)+2:72;
    var sh=overBoard?'0 4px 12px rgba(0,0,0,.5)':'0 12px 28px rgba(0,0,0,.7)';
    var tr=posTr?('left '+posTr+',transform 0.1s ease,box-shadow 0.1s ease'):'transform 0.1s ease,box-shadow 0.1s ease';
    for(var i=0;i<dragEls.length;i++){
      if(!dragEls[i])continue;
      var off=i-dragIdx;
      dragEls[i].style.transition=tr;
      dragEls[i].style.left=(dir==='h'?cx-34+off*step:cx-34)+'px';
      dragEls[i].style.top=(dir==='h'?cy-39:cy-39+off*step)+'px';
      dragEls[i].style.transform='scale('+sc+')';
      dragEls[i].style.boxShadow=sh;
    }
  }

  // Phase 2: hotbar closes gap + dragging tiles sweep to cluster. Guarded by _phase2Fired.
  function _firePhase2(){
    if(_phase2Fired)return;
    if(_latExitTimer){clearTimeout(_latExitTimer);_latExitTimer=null;}
    _phase2Fired=true;
    _animUntil=0;
    hpBounds();
    HP.fromX=HP.x.slice();HP.toX=hpRest(HP.tiles.length);
    HP.settleDur=220;HP.settleAt=performance.now();HP.settleCallback=null;
    _updateAll(_lastCx,_lastCy,_overBoard,'0.18s ease');
  }

  // Toggle h↔v direction; fires Phase 2 if it hasn't started yet.
  function _toggleDir(){
    dir=dir==='h'?'v':'h';
    _firePhase2();
    _animUntil=0;
    if(dragEls.length)_updateAll(_lastCx,_lastCy,_overBoard,'0.12s ease');
    if(_lastSq>=0)_updateHL(_lastSq);
  }

  // Space: arc all tiles back to the hand from their current positions.
  function _disperse(){
    document.removeEventListener('pointermove',move);
    document.removeEventListener('pointerup',up);
    document.removeEventListener('pointerdown',_onRightPD);
    document.removeEventListener('contextmenu',_preventCM);
    document.removeEventListener('keydown',_onMultiDragKey);
    HP.held=-1;_clearMHL();activeDrag=null;_dragEndTime=Date.now();
    var nSel=selTiles.length;
    HP.movingCount+=nSel;
    for(var i=0;i<selTiles.length;i++)setTileState(selTiles[i].t,'moving',{movingFrom:'hand',movingTo:'hand'});
    renderHand();
    hpBounds();
    var nHand=HP.x.length;
    var allSlots=hpRest(nHand+nSel);
    var ha=document.getElementById('hand-area');var hr=ha?ha.getBoundingClientRect():null;
    var destY=hr?(hr.top+34):(window.innerHeight-60);
    for(var i=0;i<selTiles.length;i++){
      (function(el,t,idx){
        if(!el){_landTile(t);return;}
        var spread=((idx-dragIdx)/(Math.max(1,nSel-1))-0.5)*160;
        var cpX=_lastCx+spread,cpY=_lastCy-200;
        var r=el.getBoundingClientRect();
        var preRect={left:r.left+(r.width-68)/2,top:r.top+(r.height-68)/2,width:68,height:68};
        var destX=allSlots[nHand+idx];
        setTimeout(function(){
          _flyTileToHand(el,320,destX,destY,cpX,cpY,function(){
            _landTile(t);_playTileClick('land');
          },preRect);
        },idx*80);
      })(dragEls[i],selTiles[i].t,i);
    }
    if(nSel===0)renderHand();
  }

  // ---- Lateral slide helpers ----
  // Activates after cursor has been outside tile X bounds for 200ms in Phase 1.
  function _activateLatMode(){
    if(_latMode||_phase2Fired||selTiles.length>1)return;
    _latMode=true;_latExitTimer=null;
    _latGapInsert=-1;
    var haEl=document.getElementById('hand-area');
    var haR=haEl?haEl.getBoundingClientRect():null;
    _latFloatY=haR?haR.top-42:0;
    _latOriginInsert=dragVi;
    HP.settleDur=0;HP.settleAt=0;
    // Snap tiles to origin-gap positions immediately and lock gap — prevents spring drift during rise.
    if(activeDrag){
      hpBounds();
      var _n0=HP.tiles.length,_rest0=hpRest(_n0+1);
      for(var _i0=0;_i0<_n0;_i0++){HP.x[_i0]=_rest0[_i0<_latOriginInsert?_i0:_i0+1];HP.vx[_i0]=0;}
      var _cx0=_rest0[_latOriginInsert];
      activeDrag.cx=_cx0;activeDrag.cy=haR?haR.top:0;
      activeDrag.funnelInsertIdx=_latOriginInsert;activeDrag._prevGapRef=undefined;
      activeDrag.gapLeft=_cx0;activeDrag.gapRight=_cx0;
      activeDrag.multiCount=0.5;
    }
    if(dragEls[0]){
      var _upDist=initRects[0]?Math.abs(initRects[0].top-(_latFloatY-34)):100;
      var _upMs=Math.max(80,_upDist/450*1000)+30;
      dragEls[0].style.transition='top '+Math.max(0.08,_upDist/450).toFixed(3)+'s ease-in,box-shadow 0.1s ease';
      dragEls[0].style.top=(_latFloatY-34)+'px';
      dragEls[0].style.boxShadow='0 14px 32px rgba(0,0,0,.78)';
      // Phase 2 fires automatically when rise completes — no pointermove needed.
      _latRiseTimer=setTimeout(_triggerLatPhase2,_upMs);
    }
  }

  // Called when rise animation completes.
  // Sequence: lateral slide (tiles stationary) → tiles shift to open destination gap → descent.
  function _triggerLatPhase2(){
    _latRiseTimer=null;
    if(!_latMode||_latDescending)return;
    _latDescending=true;
    document.removeEventListener('pointermove',move);
    document.removeEventListener('pointerup',up);
    document.removeEventListener('pointerdown',_onRightPD);
    document.removeEventListener('contextmenu',_preventCM);
    document.removeEventListener('keydown',_onMultiDragKey);
    hpBounds();
    var _haEl2=document.getElementById('hand-area');
    var _haR2=_haEl2?_haEl2.getBoundingClientRect():null;
    var _haTop2=_haR2?_haR2.top:0;
    // After renderHand() at drag start, HP.tiles has n-1 tiles (dragT removed).
    // All HP.tiles indices are active — no exclusion needed.
    // Use hpRest(_n2+1): n-1 active + 1 gap = n slots, matching HP spring layout with gapCount=1.
    var _n2=HP.tiles.length;
    var _act2=[];
    for(var _ai2=0;_ai2<_n2;_ai2++){_act2.push(_ai2);}
    var _slots2=hpRest(_n2+1);
    var _newGap2=_act2.length;
    for(var _j2=0;_j2<_act2.length;_j2++){if(_lastCx<_slots2[_j2]+34){_newGap2=_j2;break;}}
    _latGapInsert=_newGap2;
    var _origGapCx2=_slots2[_latOriginInsert];
    var _dropGapCx2=_slots2[_latGapInsert];
    // Lock origin gap open during lateral — tiles don't move until tile is above destination.
    if(activeDrag){
      activeDrag.cx=_origGapCx2;activeDrag.cy=_haTop2;
      activeDrag.funnelInsertIdx=_latOriginInsert;activeDrag._prevGapRef=undefined;
      activeDrag.gapLeft=_origGapCx2;activeDrag.gapRight=_origGapCx2;
      activeDrag.multiCount=0.5;
    }
    if(_latGapInsert===_latOriginInsert){
      // Cursor at origin: drop straight back down with no lateral movement.
      if(dragEls[0]&&_haR2){dragEls[0].style.transition='top 0.13s ease-in';dragEls[0].style.top=(_haTop2-34)+'px';}
      _latDescentTimer=setTimeout(_doLatDrop,140);
      return;
    }
    // Phases 2+3 (simultaneous): tile slides laterally AND the tiles between origin/dest
    // shift together. Opening the destination gap at slide-start prevents the dragging
    // tile from overlapping destination tiles — which looked like a duplication glitch
    // when a same-letter tile was at the destination. Settle (170ms) finishes before the
    // lateral slide (220ms) completes, so the gap is open when the tile arrives.
    var _goingRight3=_latGapInsert>_latOriginInsert;
    var _minIdx3=Math.min(_latOriginInsert,_latGapInsert);
    var _maxIdx3=Math.max(_latOriginInsert,_latGapInsert);
    HP.fromX=HP.x.slice();
    HP.toX=HP.x.slice();
    for(var _k3=0;_k3<_act2.length;_k3++){
      if(_k3>=_minIdx3&&_k3<_maxIdx3){
        HP.toX[_act2[_k3]]=_slots2[_goingRight3?_k3:_k3+1];
      }
    }
    HP.settleDur=170;HP.settleAt=performance.now();
    if(activeDrag){
      activeDrag.cx=_dropGapCx2;activeDrag.cy=_haTop2;
      activeDrag.funnelInsertIdx=_latGapInsert;activeDrag._prevGapRef=undefined;
      activeDrag.gapLeft=_dropGapCx2;activeDrag.gapRight=_dropGapCx2;
      activeDrag.multiCount=0.5;
    }
    if(dragEls[0]){
      dragEls[0].style.transition='left 0.20s ease-in-out';
      dragEls[0].style.left=(_dropGapCx2-34)+'px';
    }
    // Phase 4: descend after lateral slide ends (tile shift already finished by then).
    _latDescentTimer=setTimeout(function(){
      hpBounds();
      var _haR4=_haEl2?_haEl2.getBoundingClientRect():null;
      var _haTop4=_haR4?_haR4.top:_haTop2;
      var _slots4=hpRest(_n2+1);
      var _dropGapCx4=_slots4[_latGapInsert];
      // Reposition drag clone if bounds drifted since phase 2.
      if(dragEls[0]&&Math.abs(_dropGapCx4-_dropGapCx2)>0.5){
        dragEls[0].style.transition='none';
        dragEls[0].style.left=(_dropGapCx4-34)+'px';
      }
      if(activeDrag){
        activeDrag.cx=_dropGapCx4;activeDrag.cy=_haTop4;
        activeDrag.funnelInsertIdx=_latGapInsert;activeDrag._prevGapRef=undefined;
        activeDrag.gapLeft=_dropGapCx4;activeDrag.gapRight=_dropGapCx4;
        activeDrag.multiCount=0.5;
      }
      if(dragEls[0]){
        dragEls[0].style.transition='top 0.13s ease-in';
        dragEls[0].style.top=(_haTop4-34)+'px';
      }
      _latDescentTimer=setTimeout(_doLatDrop,140);
    },220);
  }

  // Called every pointermove while _latMode is active. Only handles escape to free flight.
  // Gap detection and descent are handled by _triggerLatPhase2 (timeout-driven).
  function _updateLatMove(me){
    if(_latDescending)return;
    var haEl=document.getElementById('hand-area');
    var haR=haEl?haEl.getBoundingClientRect():null;
    if(haR&&me.clientY<haR.top-80){
      if(_latRiseTimer){clearTimeout(_latRiseTimer);_latRiseTimer=null;}
      if(_latPhantomEl&&_latPhantomEl.parentNode)_latPhantomEl.parentNode.removeChild(_latPhantomEl);
      _latPhantomEl=null;_latMode=false;_firePhase2();
    }
  }

  // Called from up() when _latMode is active.
  function _doLatDrop(){
    // Capture float X before removing elements
    var _floatLeft=dragEls[0]?parseFloat(dragEls[0].style.left||'0')+34:_lastCx;
    for(var _di=0;_di<dragEls.length;_di++){if(dragEls[_di]&&dragEls[_di].parentNode)dragEls[_di].parentNode.removeChild(dragEls[_di]);}
    if(_latPhantomEl&&_latPhantomEl.parentNode)_latPhantomEl.parentNode.removeChild(_latPhantomEl);
    _latPhantomEl=null;
    activeDrag=null;
    var dragTile=selTiles[0].t;

    // Use origin slot as fallback when cursor wasn't over a gap zone.
    var _insertIdx=_latGapInsert>=0?_latGapInsert:_latOriginInsert;
    setTileState(dragTile,'hand');
    var _keep=[];for(var k=0;k<S.hand.length;k++){if(S.hand[k]!==dragTile)_keep.push(S.hand[k]);}
    var _ins=Math.max(0,Math.min(_insertIdx,_keep.length));
    S.hand=_keep.slice(0,_ins).concat([dragTile]).concat(_keep.slice(_ins));
    HP.settleDur=0;HP.settleAt=0;
    renderHand();
    // Spring dragged tile from its visual X to its new rest slot.
    for(var _vi=0;_vi<HP.tiles.length;_vi++){
      if(HP.tiles[_vi].t===dragTile){HP.x[_vi]=_floatLeft;HP.vx[_vi]=0;break;}
    }
    HP.fromX=HP.x.slice();HP.toX=hpRest(HP.tiles.length);
    HP.settleDur=160;HP.settleAt=performance.now();
    hpDraw();
    _playTileClick('land');
  }

  function _onRightPD(e){if(e.button!==2)return;e.preventDefault();_toggleDir();}
  function _preventCM(e){e.preventDefault();}
  function _onMultiDragKey(e){
    if(e.key==='Shift'){e.preventDefault();_toggleDir();}
    else if(e.key===' '){e.preventDefault();_disperse();}
    else if(e.key==='Escape'||e.key==='Backspace'){
      document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);
      document.removeEventListener('pointerdown',_onRightPD);document.removeEventListener('contextmenu',_preventCM);
      document.removeEventListener('keydown',_onMultiDragKey);
      HP.held=-1;_clearMHL();
      if(_latExitTimer){clearTimeout(_latExitTimer);_latExitTimer=null;}
      if(_latRiseTimer){clearTimeout(_latRiseTimer);_latRiseTimer=null;}
      if(_latDescentTimer){clearTimeout(_latDescentTimer);_latDescentTimer=null;}
      _latDescending=false;
      if(_surfaceDwellTimer){clearTimeout(_surfaceDwellTimer);_surfaceDwellTimer=null;}
      _surfaceDwellSlotIdx=-1;_surfaceGapOpen=false;_wasAtSurface=false;
      if(_springSlowed){HP.SPRING=0.14;HP.DAMP=0.55;_springSlowed=false;}
      _gapOpenAt=-1;_gapWasOpen=false;
      if(_latPhantomEl&&_latPhantomEl.parentNode)_latPhantomEl.parentNode.removeChild(_latPhantomEl);_latPhantomEl=null;
      for(var i=0;i<dragEls.length;i++){if(dragEls[i]&&dragEls[i].parentNode)dragEls[i].parentNode.removeChild(dragEls[i]);}
      for(var i=0;i<selTiles.length;i++){setTileState(selTiles[i].t,'hand');}
      activeDrag=null;HP.settleDur=0;HP.settleAt=0;renderHand();
    }
  }

  function move(me){
    var dx=me.clientX-sx,dy=me.clientY-sy;
    if(!moved&&Math.sqrt(dx*dx+dy*dy)>8){
      moved=true;HP.held=-1;
      // Tiles can leave the hand between pointerdown and the drag threshold (a discard
      // or landing arc re-renders mid-gesture). Dragging one would resurrect it into
      // S.hand on drop, so keep only tiles still in state 'hand'; abort if none remain.
      var _live=[];
      for(var i=0;i<selTiles.length;i++)if(selTiles[i].t.state==='hand')_live.push(selTiles[i]);
      if(!_live.length){
        document.removeEventListener('pointermove',move);
        document.removeEventListener('pointerup',up);
        return;
      }
      selTiles=_live;
      dragIdx=0;
      for(var i=0;i<selTiles.length;i++){if(selTiles[i].oi===dragOi){dragIdx=i;break;}}
      _playTileClick('pick');

      // Capture hotbar rects, detach selected tiles, parent them to body.
      // Look up elements by tile id, not data-hand-oi: hand indices go stale if S.hand
      // was re-rendered mid-gesture, and a stale index match steals another tile's
      // element — that tile then shows twice (drag proxy + its fresh hand element).
      for(var i=0;i<selTiles.length;i++){
        var face=document.querySelector('.hand-tile[data-tile-id="'+selTiles[i].t.id+'"]');
        initRects.push(face?face.getBoundingClientRect():null);
        dragEls.push(face||null);
      }
      for(var i=0;i<dragEls.length;i++){
        var el=dragEls[i];var ir=initRects[i];if(!el)continue;
        if(el.parentNode)el.parentNode.removeChild(el);
        el.style.cssText='position:fixed;z-index:9999;pointer-events:none;width:68px;height:68px;transform:scale(1.08);box-shadow:0 12px 28px rgba(0,0,0,.7);transition:none;'+(el.dataset.spr||'background:#f0e080;border-color:#a89000;');
        if(ir){el.style.left=ir.left+'px';el.style.top=ir.top+'px';}
        document.body.appendChild(el);
        setTileState(selTiles[i].t,'dragging');
      }
      activeDrag={src:'multi-hand',selTiles:selTiles,cx:me.clientX,cy:me.clientY,multiCount:selTiles.length,dragIdx:dragIdx};
      document.addEventListener('pointerdown',_onRightPD);
      document.addEventListener('contextmenu',_preventCM);
      document.addEventListener('keydown',_onMultiDragKey);

      // Rebuild HP without dragging tiles.
      renderHand();

      // Freeze hotbar tiles — solid objects until dragged tiles clear vertically (Phase 2).
      HP.fromX=HP.x.slice();HP.toX=HP.x.slice();HP.settleDur=9999;HP.settleAt=performance.now();HP.settleCallback=null;
      var _meCy=me.clientY;
      requestAnimationFrame(function(){
        for(var i=0;i<dragEls.length;i++){
          if(!dragEls[i])continue;
          dragEls[i].style.transition='transform 0.1s ease,box-shadow 0.1s ease';
          if(initRects[i])dragEls[i].style.left=initRects[i].left+'px';
          dragEls[i].style.top=(_meCy-39)+'px';
        }
      });
    }

    if(moved&&dragEls.length){
      _lastCx=me.clientX;_lastCy=me.clientY;
      var sq=sqAt(me.clientX,me.clientY);
      _overBoard=sq>=0||inBoardBounds(me.clientX,me.clientY);
      var _haElF=document.getElementById('hand-area');
      var _haRF=_haElF?_haElF.getBoundingClientRect():null;
      // Unified surface-mode funnelling for single and multi-tile drags.
      // Above hotbar: free movement, gap follows cursor.
      // At hotbar surface (cy >= haR.top-29): tile slides along top; gap only opens after
      // cursor dwells in a slot zone (within 1/3 tile-width of boundary) for 800ms.
      var _ecx,_ecy,_gapCx,_gapCy;
      if(_phase2Fired&&!_overBoard&&_haRF){
        var _surfaceY=_haRF.top-29; // tile bottom flush with top of hotbar tiles
        if(me.clientY>=_surfaceY){
          // SURFACE MODE — tile(s) slide along hotbar top.
          hpBounds();
          // Quarter-based detection using rest positions, not HP.x.
          // Rest positions are stable — using animated HP.x causes jitter because the
          // detection zone moves as tiles spring apart, toggling the gap every frame.
          var _n=HP.tiles.length,_Q2=HP.TILE_W/4,_cxS=me.clientX;
          var _restP=hpRest(_n);
          var _nearInsertIdx=-1,_nearAnchorX=0;
          if(_n>0){
            if(_cxS<_restP[0]-34){
              _nearInsertIdx=0; // left of all tiles
            }else if(_cxS>=_restP[_n-1]+34){
              _nearInsertIdx=_n; // right of all tiles
            }else{
              for(var _nsi=0;_nsi<_n;_nsi++){
                if(_cxS>=_restP[_nsi]-34&&_cxS<_restP[_nsi]+34){
                  if(_cxS<_restP[_nsi]-_Q2){_nearInsertIdx=_nsi;}       // left quarter
                  else if(_cxS>=_restP[_nsi]+_Q2){_nearInsertIdx=_nsi+1;} // right quarter
                  break; // middle half leaves _nearInsertIdx=-1
                }
              }
            }
          }
          // When tile descended from above, lock the slot — lateral cursor movement has no effect.
          if(_cameFromAbove&&_surfaceDwellSlotIdx>=0){_nearInsertIdx=_surfaceDwellSlotIdx;}
          // Anchor slot X: rest position of anchor tile after insertion.
          if(_nearInsertIdx>=0){
            var _nTotalS=_n+selTiles.length;
            _nearAnchorX=hpRest(_nTotalS)[Math.min(_nearInsertIdx+dragIdx,_nTotalS-1)];
          }
          // 800ms dwell when sliding laterally; immediate gap when arriving from above.
          if(_nearInsertIdx>=0){
            if(!_wasAtSurface){
              // Arrived from free mode above — open gap immediately, no dwell.
              if(_surfaceDwellTimer!==null){clearTimeout(_surfaceDwellTimer);_surfaceDwellTimer=null;}
              _surfaceDwellSlotIdx=_nearInsertIdx;_surfaceGapOpen=true;_cameFromAbove=true;
            }else if(_surfaceDwellSlotIdx!==_nearInsertIdx){
              // Sliding to a new slot — restart 800ms dwell timer.
              if(_surfaceDwellTimer!==null){clearTimeout(_surfaceDwellTimer);_surfaceDwellTimer=null;}
              _surfaceDwellSlotIdx=_nearInsertIdx;_surfaceGapOpen=false;
              (function(_capturedIdx){
                _surfaceDwellTimer=setTimeout(function(){
                  if(_surfaceDwellSlotIdx===_capturedIdx){_surfaceGapOpen=true;}
                  _surfaceDwellTimer=null;
                },800);
              })(_nearInsertIdx);
            }
            // else: same slot already, let timer run (or gap already open)
          }else{
            // Not in any slot zone — cancel dwell and close gap.
            if(_surfaceDwellTimer!==null){clearTimeout(_surfaceDwellTimer);_surfaceDwellTimer=null;}
            _surfaceDwellSlotIdx=-1;_surfaceGapOpen=false;
          }
          _wasAtSurface=true;
          if(_nearInsertIdx>=0&&_surfaceGapOpen){
            // First frame gap is open: record entry Y and slow HP spring for a soft opening.
            if(!_gapWasOpen){
              _gapOpenAt=Date.now();_gapOpenFromY=_surfaceY;
              HP.SPRING=0.07;HP.DAMP=0.60;_springSlowed=true;
            }
            // Restore normal spring once tiles have finished spreading (~480ms).
            if(_springSlowed&&Date.now()-_gapOpenAt>480){HP.SPRING=0.14;HP.DAMP=0.55;_springSlowed=false;}
            // Y: ease tile down from surface to cursor over 300ms (no snap on gap open).
            var _tgtY=Math.min(me.clientY,_haRF.top+39);
            var _gapE=Date.now()-_gapOpenAt,_Y_DUR=300;
            if(_gapE<_Y_DUR){
              var _yt=1-Math.pow(1-_gapE/_Y_DUR,2); // ease-out quad
              _ecy=_gapOpenFromY+(_tgtY-_gapOpenFromY)*_yt;
            }else{_ecy=_tgtY;}
            // X: funnel based on tile's animated depth — zero pull at surface, centred at bottom.
            var _descent=_ecy-_surfaceY; // follows animated Y, not raw cursor
            var _funnelT=Math.max(0,Math.min(1,_descent/68));
            _ecx=me.clientX+(_nearAnchorX-me.clientX)*(_funnelT*_funnelT);
            _gapCx=_nearAnchorX;_gapCy=_haRF.top;
            if(activeDrag){activeDrag.funnelInsertIdx=_nearInsertIdx;activeDrag._prevGapRef=undefined;}
          }else{
            // Waiting for dwell / no slot near — slide freely at surface, suppress gap.
            if(_springSlowed){HP.SPRING=0.14;HP.DAMP=0.55;_springSlowed=false;}
            _gapOpenAt=-1;_gapWasOpen=false;
            _ecx=me.clientX;_ecy=_surfaceY;
            _gapCx=me.clientX;_gapCy=_haRF.top-100; // outside ph.inArea → no gap
            if(activeDrag){activeDrag.funnelInsertIdx=undefined;activeDrag._prevGapRef=undefined;}
          }
          _gapWasOpen=_nearInsertIdx>=0&&_surfaceGapOpen;
          if(_committedSlotX!==null){_committedSlotX=null;}
        }else{
          // FREE MODE above surface: tile and gap both follow cursor directly.
          if(_surfaceDwellTimer!==null){clearTimeout(_surfaceDwellTimer);_surfaceDwellTimer=null;}
          _surfaceDwellSlotIdx=-1;_surfaceGapOpen=false;_wasAtSurface=false;_cameFromAbove=false;
          if(_springSlowed){HP.SPRING=0.14;HP.DAMP=0.55;_springSlowed=false;}
          _gapOpenAt=-1;_gapWasOpen=false;
          if(_committedSlotX!==null){_committedSlotX=null;if(activeDrag){activeDrag.funnelInsertIdx=undefined;activeDrag._prevGapRef=undefined;}}
          // Anchor _gapCy to hotbar top so ph.inArea() returns true and HP opens a gap.
          // Using me.clientY here made gaps impossible (free-mode y < r.top-29, but
          // ph.inArea requires y >= r.top-20 — ranges never overlap).
          _ecx=me.clientX;_ecy=me.clientY;_gapCx=me.clientX;_gapCy=_haRF.top;
        }
      }else{
        // BOARD drag or phase 1: pass through cursor position unchanged.
        _wasAtSurface=false;
        if(_springSlowed){HP.SPRING=0.14;HP.DAMP=0.55;_springSlowed=false;}
        _gapOpenAt=-1;_gapWasOpen=false;
        _ecx=me.clientX;_ecy=me.clientY;_gapCx=me.clientX;_gapCy=me.clientY;
      }
      activeDrag.cx=_gapCx;activeDrag.cy=_gapCy;
      // Track full group extent for the hotbar spring gap (both edges push hotbar tiles).
      var _gapStep=_overBoard?(Math.ceil(68*0.75)+2):72;
      if(dir==='h'){
        activeDrag.gapLeft=_gapCx-dragIdx*_gapStep;
        activeDrag.gapRight=_gapCx+(selTiles.length-1-dragIdx)*_gapStep;
      } else {
        activeDrag.gapLeft=_gapCx;
        activeDrag.gapRight=_gapCx;
      }
      if(!_phase2Fired){
        if(_latMode){
          // Lateral slide mode: tile floats above hotbar following cursor X.
          _updateLatMove(me);
          // During rise, keep the origin gap open so the old spot stays clear.
          // After rise, _triggerLatPhase2 updates activeDrag directly; move() no longer fires.
          var _lhEl=document.getElementById('hand-area');
          var _lhR=_lhEl?_lhEl.getBoundingClientRect():null;
          if(_lhR){
            hpBounds();
            var _origGapCx=hpRest(HP.tiles.length+1)[_latOriginInsert];
            activeDrag.cx=_origGapCx;activeDrag.cy=_lhR.top;
            activeDrag.funnelInsertIdx=_latOriginInsert;activeDrag._prevGapRef=undefined;
            activeDrag.gapLeft=_origGapCx;activeDrag.gapRight=_origGapCx;
            activeDrag.multiCount=0.5;
          }
        } else {
          // Phase 1: all tiles locked to original hotbar x; only y follows cursor.
          var _p1cy=_haRF?Math.min(me.clientY,_haRF.top+39):me.clientY;
          var _ty=(_p1cy-39)+'px';
          for(var i=0;i<dragEls.length;i++){
            if(!dragEls[i])continue;
            dragEls[i].style.top=_ty;
            if(initRects[i])dragEls[i].style.left=initRects[i].left+'px';
          }
          // Phase 2 fires when dragged tiles clear the hotbar vertically.
          var _haEl=document.getElementById('hand-area');
          var _haR=_haEl?_haEl.getBoundingClientRect():null;
          if(_haR&&me.clientY<_haR.top-34){_firePhase2();}
          // Lateral-exit detection: single tile only. Start 200ms timer when cursor
          // leaves the tile's X bounds. Cancel if cursor returns inside.
          if(!_phase2Fired&&selTiles.length===1&&initRects[0]){
            var _outside=me.clientX<initRects[0].left||me.clientX>initRects[0].left+68;
            if(_outside&&_latExitTimer===null){
              _latExitTimer=setTimeout(_activateLatMode,200);
            }else if(!_outside&&_latExitTimer!==null){
              clearTimeout(_latExitTimer);_latExitTimer=null;
            }
          }
        }
      } else if(Date.now()<_animUntil){
        // Phase 2: y follows cursor for all tiles; non-anchor x eases to cluster (CSS transition
        // for left is undisturbed since we only set top here). Y clamped same as Phase 1.
        var _p2cy=_haRF?Math.min(me.clientY,_haRF.top+39):me.clientY;
        var _ty=(_p2cy-39)+'px';
        for(var i=0;i<dragEls.length;i++){if(dragEls[i])dragEls[i].style.top=_ty;}
        if(dragEls[dragIdx])dragEls[dragIdx].style.left=(me.clientX-34)+'px';
      } else {
        _updateAll(_ecx,_ecy,_overBoard);
      }
      if(_overBoard){_lastSq=sq;_updateHL(sq);}
      else{_clearMHL();_lastSq=-1;}
    }
  }

  function up(me){
    if(me.button!==0)return;
    document.removeEventListener('pointermove',move);
    document.removeEventListener('pointerup',up);
    document.removeEventListener('pointerdown',_onRightPD);
    document.removeEventListener('contextmenu',_preventCM);
    document.removeEventListener('keydown',_onMultiDragKey);
    HP.held=-1;_clearMHL();
    if(_latExitTimer){clearTimeout(_latExitTimer);_latExitTimer=null;}
    if(_surfaceDwellTimer){clearTimeout(_surfaceDwellTimer);_surfaceDwellTimer=null;}
    var _dropLockedSlot=(_cameFromAbove&&_surfaceDwellSlotIdx>=0)?_surfaceDwellSlotIdx:-1;
    // Phase-1 multi-tile: cursor never cleared the hotbar so _cameFromAbove is never set.
    // Use the group's original insert index so lateral cursor movement doesn't affect the drop.
    var _p1MultiIns=(!_phase2Fired&&selTiles.length>1)?Math.max(0,dragVi-dragIdx):-1;
    _surfaceDwellSlotIdx=-1;_surfaceGapOpen=false;_cameFromAbove=false;
    if(!moved){
      if(_latPhantomEl&&_latPhantomEl.parentNode)_latPhantomEl.parentNode.removeChild(_latPhantomEl);_latPhantomEl=null;
      activeDrag=null;
      // Re-resolve indices by tile identity — dragOi/dragVi go stale if the hand
      // re-rendered between pointerdown and release, toggling the wrong tile.
      var _ct=selTiles[dragIdx].t;
      var _cvi=-1;for(var i=0;i<HP.tiles.length;i++){if(HP.tiles[i].t===_ct){_cvi=i;break;}}
      if(_cvi>0)HP.vx[_cvi-1]-=3;
      if(_cvi>=0&&_cvi<HP.tiles.length-1)HP.vx[_cvi+1]+=3;
      var _coi=S.hand.indexOf(_ct);
      if(_coi>=0)toggleSel(_coi);
      return;
    }
    _dragEndTime=Date.now();
    if(_latMode){
      if(_latRiseTimer){clearTimeout(_latRiseTimer);_latRiseTimer=null;}
      if(!_latDescending){
        // Released during rise — drop back to origin with a brief descent animation.
        _latDescending=true;
        _latGapInsert=_latOriginInsert;
        var _uhEl=document.getElementById('hand-area');
        var _uhR=_uhEl?_uhEl.getBoundingClientRect():null;
        if(dragEls[0]&&_uhR){
          dragEls[0].style.transition='top 0.11s ease-in';
          dragEls[0].style.top=(_uhR.top-34)+'px';
          _latDescentTimer=setTimeout(_doLatDrop,120);
        } else {
          _doLatDrop();
        }
      }
      return;
    }
    for(var i=0;i<dragEls.length;i++){if(dragEls[i]&&dragEls[i].parentNode)dragEls[i].parentNode.removeChild(dragEls[i]);}
    activeDrag=null;
    var sq=sqAt(me.clientX,me.clientY);
    if(sq>=0&&_computeFree(_startSq(sq))){
      for(var i=0;i<selTiles.length;i++){setTileState(selTiles[i].t,'hand');}
      // Recompute indices from current S.hand position to avoid stale-index bug
      // (S.hand may have shifted if a recall arc landed between drag start and drop).
      var selOis=selTiles.map(function(s){var fi=S.hand.indexOf(s.t);return fi>=0?fi:s.oi;});
      multiPlaceSelected(selOis,_startSq(sq),dir);
    } else if(inHand(me.clientX,me.clientY)){
      // Dropped in hotbar — reorder tiles at cursor position.
      // Compute insert position in HP.tiles (dragging tiles already excluded).
      var _ins=Math.max(0,Math.min(_dropLockedSlot>=0?_dropLockedSlot:_p1MultiIns>=0?_p1MultiIns:computeInsert(me.clientX,-1),S.hand.length));
      // Restore tile states so renderHand includes them in vis.
      for(var i=0;i<selTiles.length;i++) setTileState(selTiles[i].t,'hand');
      // Build new S.hand order: existing (non-dragged) tiles with dragged group inserted at _ins.
      var _keep=[];
      for(var k=0;k<S.hand.length;k++){
        var _fnd=false;for(var i=0;i<selTiles.length;i++){if(selTiles[i].t===S.hand[k]){_fnd=true;break;}}
        if(!_fnd)_keep.push(S.hand[k]);
      }
      var _safeIns=Math.max(0,Math.min(_ins,_keep.length));
      S.hand=_keep.slice(0,_safeIns).concat(selTiles.map(function(s){return s.t;})).concat(_keep.slice(_safeIns));
      // renderHand rebuilds HP.x by tile-id remapping; returning tiles get rest positions.
      renderHand();
      // Override returning tiles to spring from their actual visual positions at release.
      HP.fromX=HP.x.slice();
      for(var k=0;k<S.hand.length;k++){
        for(var i=0;i<selTiles.length;i++){
          if(S.hand[k]===selTiles[i].t){
            var _rel=dragEls[i];
            HP.fromX[k]=(_rel&&_rel.style.left)?parseFloat(_rel.style.left)+34:me.clientX;
            break;
          }
        }
      }
      HP.toX=hpRest(S.hand.length);
      HP.settleDur=180;HP.settleAt=performance.now();
      HP.x=HP.fromX.slice();HP.vx=Array(S.hand.length).fill(0);
      hpDraw();
    } else {
      for(var i=0;i<selTiles.length;i++){setTileState(selTiles[i].t,'hand');}
      renderHand();
    }
  }

  document.addEventListener('pointermove',move);
  document.addEventListener('pointerup',up);
}

function placeTile(t,sqIdx){
  if(t)S.hand=S.hand.filter(function(x){return x!==t;});
  setTileState(t,'board',{boardSq:sqIdx,isNew:true});
  if(S.bt[sqIdx]&&!S.bt[sqIdx].isNew&&!(S.btTop&&S.btTop[sqIdx])){
    if(!S.btTop)S.btTop=Array(B*B).fill(null);
    S.btTop[sqIdx]=t;
  } else {
    S.bt[sqIdx]=t;
  }
  _playTileClick('place');
}

// Computes the destination screen coords and bezier control point for a tile
// that will land at slot (nBefore+idx) in a hand of nTotal tiles.
// The control point is right of the hand area so every tile arcs in from the right.
function _handLandingParams(nBefore,nTotal,idx){
  hpBounds();
  var finals=hpRest(nTotal);
  var destX=finals[nBefore+idx]; // absolute screen centre-X of the target slot
  var ha=document.getElementById('hand-area');
  var hr=ha?ha.getBoundingClientRect():null;
  var destY=hr?(hr.top+34):(window.innerHeight-60);
  var cpX=hr?(hr.right+60):(destX+120);  // right of hand — arc sweeps in from right
  var cpY=hr?(hr.top-30):(destY-80);
  return{destX:destX,destY:destY,cpX:cpX,cpY:cpY};
}

// Flies a board tile element to the hand using a quadratic bezier arc.
// Uses the actual tEl element (not a clone) with transform:scale to grow from board size to hand size.
// destX/destY are the CENTER screen coords of the target hand slot.
// preCapRect: optional pre-captured DOMRect for when tEl has already been detached.
function _flyTileToHand(tEl,dur,destX,destY,cpX,cpY,onDone,preCapRect){
  if(!tEl){if(onDone)onDone();return;}
  var sr=preCapRect||tEl.getBoundingClientRect();
  if(tEl.parentNode)tEl.parentNode.removeChild(tEl);
  var boardSz=sr.width,handSz=68,endScale=handSz/boardSz;
  var sprCss=tEl.dataset.spr||'';
  tEl.className='tile tile-spr';
  tEl.style.cssText='position:fixed;z-index:9999;pointer-events:none;width:'+boardSz+'px;height:'+boardSz+'px;left:'+sr.left+'px;top:'+sr.top+'px;transform:scale(1);transform-origin:center center;'+(sprCss||'background:#f0e080;border-color:#a89000;');
  document.body.appendChild(tEl);
  var scx=sr.left+boardSz/2,scy=sr.top+boardSz/2;
  var flyStart=performance.now();
  function flyTick(now){
    var t=Math.min(1,(now-flyStart)/dur);
    var e=1-Math.pow(1-t,3),u=1-e;
    var cx=u*u*scx+2*u*e*cpX+e*e*destX;
    var cy=u*u*scy+2*u*e*cpY+e*e*destY;
    tEl.style.left=(cx-boardSz/2)+'px';
    tEl.style.top=(cy-boardSz/2)+'px';
    tEl.style.transform='scale('+(1+(endScale-1)*e)+')';
    if(t<1){requestAnimationFrame(flyTick);return;}
    if(tEl.parentNode)tEl.parentNode.removeChild(tEl);
    if(onDone)onDone();
  }
  requestAnimationFrame(flyTick);
}

// Arc-start queue: tiles enter the hand one at a time, 350ms apart.
// Rightmost source tile goes first within a simultaneous batch.
var _nextArcAt=0;
var _ARC_STAGGER=350;
var _SPIRAL_ARC_DUR=1100;

// Returns a holdUntil timestamp for the next arc slot.
// Returns a holdUntil timestamp for the next arc slot (stagger landing times across a batch).
function _allocArcSlot(){
  var now=performance.now();
  var slot=Math.max(now+650,_nextArcAt);
  _nextArcAt=slot+_ARC_STAGGER;
  return slot;
}

// Golden-ratio spiral arc back to the hotbar.
// Phase 1 — drift: tile moves in driftDx/driftDy direction (ease-out, 450ms) while waiting for its arc slot.
// Phase 2 — spiral: quintic Bezier sweeps UP-RIGHT past the board, loops off-screen right,
//   swoops down past the tile bag, and enters the hand from the right.
// Arc height scales with horizontal distance from right edge — left-side tiles fly higher.
// destX: fixed x coordinate for the arc's landing target (pre-computed phantom slot position).
// driftDx/driftDy: directional momentum offset for phase 1 (default: straight up 60px).
// physicsV0: if provided, replaces ease-out with initial-velocity + constant-decel physics (px/ms).
function _flyTileSpiral(tEl,holdUntil,srcX,srcY,destX,destY,onDone,preCapRect,driftDx,driftDy,physicsV0){
  if(!tEl){if(onDone)onDone();return;}
  var sr=preCapRect||tEl.getBoundingClientRect();
  if(tEl.parentNode)tEl.parentNode.removeChild(tEl);
  var boardSz=sr.width,endScale=68/boardSz;
  var sprCss=tEl.dataset.spr||'';
  tEl.className='tile tile-spr';
  tEl.style.cssText='position:fixed;z-index:9999;pointer-events:none;width:'+boardSz+'px;height:'+boardSz+'px;left:'+(srcX-boardSz/2)+'px;top:'+(srcY-boardSz/2)+'px;transform:scale(1);transform-origin:center center;'+(sprCss||'background:#f0e080;border-color:#a89000;');
  document.body.appendChild(tEl);
  // Phase 1: drift — ease-out (default) or initial-velocity + constant-decel (physicsV0 provided)
  var _dDx=driftDx||0,_dDy=driftDy||-60;
  var _dStart=performance.now(),_dDur=450;
  var _GRAV=0.00070; // px/ms²  (constant deceleration during launch phase)
  function _driftPos(now){
    var dt=now-_dStart;
    if(physicsV0!==undefined){
      // clamp dt at peak (when vy = 0) so tile holds position instead of falling back
      var dtC=Math.min(dt,physicsV0/_GRAV);
      return{x:srcX+_dDx*Math.min(1,dt/_dDur),y:srcY-physicsV0*dtC+0.5*_GRAV*dtC*dtC};
    }
    var e=1-Math.pow(1-Math.min(1,dt/_dDur),2);
    return{x:srcX+_dDx*e,y:srcY+_dDy*e};
  }
  // Launch-phase visual state shared between hover and arc
  var _currentScale=1.0,_wobblePhase=0,_hoverWF=0,_lastHoverT=null;
  var _boardRect=(function(){var e=document.getElementById('board-wrap');return e?e.getBoundingClientRect():null;})();
  function hoverTick(now){
    var p=_driftPos(now);
    tEl.style.left=(p.x-boardSz/2)+'px';tEl.style.top=(p.y-boardSz/2)+'px';
    var dt=now-_dStart;
    var fDt=_lastHoverT!==null?now-_lastHoverT:0; _lastHoverT=now;
    var wobbleFrac;
    if(physicsV0!==undefined){
      var curSpd=Math.max(0,physicsV0-_GRAV*Math.min(dt,physicsV0/_GRAV));
      var normSpd=Math.min(1,curSpd/physicsV0); // 1 at launch, 0 at peak
      wobbleFrac=1-normSpd;
      // Smooth scale: lerp toward board size (0.75) when over board, full (1.0) otherwise
      var overBoard=_boardRect&&p.y>=_boardRect.top&&p.y<=_boardRect.bottom;
      _currentScale+=((overBoard?0.75:1.0)-_currentScale)*Math.min(1,fDt*0.007);
    } else {
      // Ease-out drift: wobble ramps in over the last 100ms of drift, holds at 1 during hold phase.
      wobbleFrac=Math.max(0,Math.min(1,(dt-(_dDur-100))/100));
    }
    _hoverWF=wobbleFrac;
    if(wobbleFrac>0){
      _wobblePhase+=fDt/2700*Math.PI*2*wobbleFrac;
      var floatY=-Math.sin(_wobblePhase)*6*wobbleFrac;
      var floatRot=Math.sin(_wobblePhase+0.4)*1.2*wobbleFrac;
      tEl.style.transform='scale('+_currentScale.toFixed(3)+') translateY('+floatY.toFixed(2)+'px) rotate('+floatRot.toFixed(2)+'deg)';
    }
    if(now<holdUntil){requestAnimationFrame(hoverTick);}else{var q=_driftPos(now);launchArc(now,q.x,q.y);}
  }
  requestAnimationFrame(hoverTick);
  function launchArc(arcStart,curSrcX,curSrcY){
    var _arcStartScale=_currentScale,_arcStartWF=_hoverWF,_lastArcT=arcStart;
    var W=window.innerWidth,H=window.innerHeight;
    // arcFrac: 0 = source near right edge (flat arc), 1 = source at far left (tall arc)
    var arcFrac=Math.max(0,Math.min(1,(W*0.72-srcX)/(W*0.72)));
    // Quintic Bezier (6 control points). P0 = drift endpoint; P5 = hand slot (mutable each frame).
    // P1-P4: rise to upper-right → off-screen right → loop around bag → hand entry from right.
    var P0x=curSrcX, P0y=curSrcY;
    var P1x=W*(0.70+arcFrac*0.06), P1y=H*(0.06-arcFrac*0.28);
    var P2x=W*0.94,                P2y=H*(-0.04-arcFrac*0.14);
    var P3x=W*1.14,                P3y=H*0.34;
    var P4x=W*1.04,                P4y=H*0.82;
    var expK=5,expDenom=Math.exp(expK)-1;
    function arcTick(now){
      var rawT=Math.min(1,(now-arcStart)/_SPIRAL_ARC_DUR);
      var t=(Math.exp(expK*rawT)-1)/expDenom;
      var u=1-t;
      var dx=(destX&&typeof destX==='object'&&'x' in destX)?destX.x:destX;
      var b0=u*u*u*u*u,b1=5*u*u*u*u*t,b2=10*u*u*u*t*t,b3=10*u*u*t*t*t,b4=5*u*t*t*t*t,b5=t*t*t*t*t;
      tEl.style.left=(b0*P0x+b1*P1x+b2*P2x+b3*P3x+b4*P4x+b5*dx-boardSz/2)+'px';
      tEl.style.top =(b0*P0y+b1*P1y+b2*P2y+b3*P3y+b4*P4y+b5*destY-boardSz/2)+'px';
      // Float continues from hover, fading over the first half of the arc
      var arcWF=Math.max(0,_arcStartWF*(1-rawT*2));
      var fDt=now-_lastArcT; _lastArcT=now;
      _wobblePhase+=fDt/2700*Math.PI*2*arcWF;
      var arcFloatY=-Math.sin(_wobblePhase)*6*arcWF;
      var arcFloatRot=Math.sin(_wobblePhase+0.4)*1.2*arcWF;
      // Scale: smooth from arc-start scale to endScale over the last 40%
      var st=Math.max(0,Math.min(1,(rawT-0.6)/0.4));
      var arcSc=_arcStartScale+(endScale-_arcStartScale)*(st*st);
      tEl.style.transform='scale('+arcSc.toFixed(3)+') translateY('+arcFloatY.toFixed(2)+'px) rotate('+arcFloatRot.toFixed(2)+'deg)';
      if(rawT<1){requestAnimationFrame(arcTick);return;}
      if(tEl.parentNode)tEl.parentNode.removeChild(tEl);
      if(onDone)onDone();
    }
    requestAnimationFrame(arcTick);
  }
}

// Universal landing handler for tiles in 'moving' state returning to the hotbar.
// Places the tile at the next phantom slot (first slot to the right of current hand tiles).
// As each tile lands, movingCount decreases and HP.x grows by one — total stays constant,
// so existing hotbar tiles never move.
function _landTile(tile){
  if(!tile||tile.state!=='moving')return;
  hpBounds();
  var landX=HP.nextLandX();
  // Ensure tile appears exactly once at the end of S.hand so HP.x.push aligns with vis order.
  // Using filter+push (not indexOf+splice+push) guards against duplicates: if the tile
  // somehow appears at more than one position, all occurrences are removed before the single
  // re-insert, preventing the old splice+push from creating a third copy when the tile was
  // already at the last position AND somewhere else simultaneously.
  var idx=S.hand.indexOf(tile);
  if(idx>=0){S.hand=S.hand.filter(function(x){return x!==tile;});S.hand.push(tile);}
  HP.movingCount=Math.max(0,HP.movingCount-1);
  if(HP.movingCount===0)_nextArcAt=0;
  setTileState(tile,'hand');
  HP.x.push(landX);HP.vx.push(0);
  renderHand();
}

// Shared recall core: lifts the isNew tile at sqIdx (jenga top first) off the
// board and spiral-arcs it back to the hand. driftDx/driftDy set the phase-1
// launch direction. render=true re-renders the board immediately (single
// recalls); sweeps skip it so other in-flight tiles keep their DOM elements.
function _recallTileCore(sqIdx,driftDx,driftDy,render){
  var _JENGA_ELEV=6;
  var useTop=!!(S.btTop&&S.btTop[sqIdx]&&S.btTop[sqIdx].isNew);
  var bt=useTop?S.btTop[sqIdx]:S.bt[sqIdx];
  if(!bt||!bt.isNew)return;
  var elev=useTop?((S.bt[sqIdx]&&S.bt[sqIdx]._stackLevel||0)+1)*_JENGA_ELEV:0;
  var sqEl=document.querySelector('[data-sq-idx="'+sqIdx+'"]');
  var tEl=sqEl?sqEl.querySelector('.board-tile.is-new'):null;
  var savedSr=tEl?tEl.getBoundingClientRect():null;
  if(useTop){S.btTop[sqIdx]=null;}else{S.bt[sqIdx]=null;}
  if(S.hand.indexOf(bt)<0)S.hand.push(bt);
  setTileState(bt,'moving',{movingFrom:'board',movingTo:'hand'});
  HP.movingCount++;
  if(render){
    if(tEl&&tEl.parentNode)tEl.parentNode.removeChild(tEl);
    renderBoard();
  }
  if(!tEl||!savedSr||savedSr.width===0){_landTile(bt);return;}
  var sr=elev>0?{left:savedSr.left,top:savedSr.top+elev,width:savedSr.width,height:savedSr.height}:savedSr;
  var cx=sr.left+sr.width/2,cy=sr.top+sr.height/2;
  var holdUntil=_allocArcSlot();
  var ha=document.getElementById('hand-area');var hr=ha?ha.getBoundingClientRect():null;
  var destY=hr?(hr.top+34):(window.innerHeight-60);
  var destX=HP.nextLandX();
  var _recallS=S;
  _flyTileSpiral(tEl,holdUntil,cx,cy,destX,destY,function(){
    if(S!==_recallS){HP.movingCount=Math.max(0,HP.movingCount-1);if(!HP.movingCount)_nextArcAt=0;return;}
    _landTile(bt);_playTileClick('land');
  },sr,driftDx,driftDy);
}

function recallTile(sqIdx){
  _playTileClick('pick');
  _recallTileCore(sqIdx,0,-50,true);
}

function _recallTileSweep(sqIdx,swipeVx,swipeVy){
  _playTileClick('pick');
  var speed=Math.sqrt((swipeVx||0)*(swipeVx||0)+(swipeVy||0)*(swipeVy||0));
  var dx,dy;
  if(speed<0.3){dx=0;dy=-60;}
  else{var d=Math.max(60,Math.min(180,speed*30));dx=((swipeVx||0)/speed)*d;dy=((swipeVy||0)/speed)*d;}
  _recallTileCore(sqIdx,dx,dy,false);
}

function recallAll(){
  if(S.btTop){for(var i=0;i<B*B;i++){if(S.btTop[i]&&S.btTop[i].isNew){setTileState(S.btTop[i],'hand');if(S.hand.indexOf(S.btTop[i])<0)S.hand.push(S.btTop[i]);S.btTop[i]=null;}}}
  for(var i=0;i<B*B;i++){var bt=S.bt[i];if(bt&&bt.isNew){setTileState(bt,'hand');if(S.hand.indexOf(bt)<0)S.hand.push(bt);S.bt[i]=null;}}
}

// Animated recallAll: recalled tiles arc in staggered from left to right.
// Phantom slots keep remaining hand tiles stationary throughout.
function _recallAllAnimated(){
  var _recallAllS=S;
  var tEls=[],tRects=[],tTiles=[];
  if(S.btTop){
    for(var i=0;i<B*B;i++){
      if(S.btTop[i]&&S.btTop[i].isNew){
        var sqEl2=document.querySelector('[data-sq-idx="'+i+'"]');
        var tEl2=sqEl2?sqEl2.querySelector('.board-tile.is-new'):null;
        var t2=S.btTop[i];S.btTop[i]=null;
        if(S.hand.indexOf(t2)<0)S.hand.push(t2);
        if(tEl2){tRects.push(tEl2.getBoundingClientRect());if(tEl2.parentNode)tEl2.parentNode.removeChild(tEl2);tEls.push(tEl2);setTileState(t2,'moving',{movingFrom:'board',movingTo:'hand'});tTiles.push(t2);}
        else{setTileState(t2,'hand');}
      }
    }
  }
  for(var i=0;i<B*B;i++){
    var bt=S.bt[i];
    if(bt&&bt.isNew){
      var sqEl=document.querySelector('[data-sq-idx="'+i+'"]');
      var tEl=sqEl?sqEl.querySelector('.board-tile'):null;
      S.bt[i]=null;if(S.hand.indexOf(bt)<0)S.hand.push(bt);
      if(tEl){
        tRects.push(tEl.getBoundingClientRect());
        if(tEl.parentNode)tEl.parentNode.removeChild(tEl);
        tEls.push(tEl);setTileState(bt,'moving',{movingFrom:'board',movingTo:'hand'});tTiles.push(bt);
      }else{setTileState(bt,'hand');}
    }
  }
  renderBoard();
  var nNew=tEls.length;
  if(nNew===0){renderHand();return;}

  HP.movingCount+=nNew;
  hpBounds();
  var nHand=HP.x.length;
  var allSlots=hpRest(nHand+nNew); // fixed slot positions for entire batch

  var ha=document.getElementById('hand-area');var hr=ha?ha.getBoundingClientRect():null;
  var destY=hr?(hr.top+34):(window.innerHeight-60);

  // Sort by source x so leftmost tile arrives first and lands in leftmost phantom slot.
  var _sortRA=[];
  for(var j=0;j<nNew;j++){
    var _srj=tRects[j];
    _sortRA.push({el:tEls[j],sr:_srj,t:tTiles[j],srcX:_srj?(_srj.left+_srj.width/2):0});
  }
  _sortRA.sort(function(a,b){return a.srcX-b.srcX;});
  for(var j=0;j<nNew;j++){
    _sortRA[j].holdUntil=_allocArcSlot();
    _sortRA[j].destX=allSlots[nHand+j];
  }

  for(var j=0;j<nNew;j++){
    (function(entry){
      if(!entry.el||!entry.sr){
        _landTile(entry.t);return;
      }
      var _kx=entry.sr.left+entry.sr.width/2,_ky=entry.sr.top+entry.sr.height/2;
      _flyTileSpiral(entry.el,entry.holdUntil,_kx,_ky,entry.destX,destY,function(){
        if(S!==_recallAllS){HP.movingCount=Math.max(0,HP.movingCount-1);if(!HP.movingCount)_nextArcAt=0;return;}
        _landTile(entry.t);_playTileClick('land');
      },entry.sr,0,-50);
    })(_sortRA[j]);
  }
}

// Tile ids currently represented by an in-flight bag-burst clone. Drawn tiles are
// state 'hand' in S.hand during the burst, so any renderHand that fires mid-flight
// (e.g. clicking a tile to select it right after a discard) would create their real
// elements while the clones are still visible — each incoming tile shown twice.
// renderHand skips these ids until the burst completes.
var _burstTileIds=null;

// Creates full-size hand tiles at the bag position and flies them to their slots.
// No hidden originals — the flying element IS the tile while in transit.
// nKept: tiles already in hand. nTotal: expected hand size after draw. bagEl: the bag button element.
// onDone: called after last tile lands and renderHand() has run.
function _burstNewTilesFromBag(nKept,nTotal,bagEl,onDone){
  var afterVis=[];
  for(var _k=0;_k<S.hand.length;_k++)if(S.hand[_k])afterVis.push(S.hand[_k]);
  var nNew=afterVis.length-nKept;
  // Extend HP to nTotal so spring physics uses correct rest positions during flight.
  HP.tiles=afterVis.slice();
  hpBounds();var fullRest=hpRest(nTotal);
  while(HP.x.length<nTotal){HP.x.push(fullRest[HP.x.length]);HP.vx.push(0);}
  if(nNew<=0){renderHand();if(onDone)onDone();return;}
  _burstTileIds={};
  for(var _bm=0;_bm<nNew;_bm++)_burstTileIds[afterVis[nKept+_bm].id]=true;
  var bagR=bagEl.getBoundingClientRect();
  var bx=bagR.left+bagR.width/2,by=bagR.top+bagR.height/2;
  bagEl.classList.add('bag-vacuuming');
  var done=0;var allFlyEls=[];
  for(var _j=0;_j<nNew;_j++){
    (function(tData,idx){
      var p=_handLandingParams(nKept,nTotal,idx);
      var spr=(tData.isBlank&&tData.blankAs)?blankTileSpr(tData.blankAs,tData.variant||null,68):tileSpr(tData.isBlank?null:tData.letter,tData.isBlank,tData.variant||null,68);
      var flyEl=document.createElement('div');
      flyEl.className='tile hand-tile tile-spr';
      flyEl.style.cssText='position:fixed;z-index:9999;pointer-events:none;width:68px;height:68px;left:'+(bx-34)+'px;top:'+(by-34)+'px;'+spr;
      document.body.appendChild(flyEl);
      allFlyEls.push(flyEl);
      setTimeout(function(){
        var scx=bx,scy=by,fStart=performance.now(),fDur=320;
        function tick(now){
          var t=Math.min(1,(now-fStart)/fDur);
          var e=1-Math.pow(1-t,3),u=1-e;
          var cx=u*u*scx+2*u*e*p.cpX+e*e*p.destX;
          var cy=u*u*scy+2*u*e*p.cpY+e*e*p.destY;
          flyEl.style.left=(cx-34)+'px';flyEl.style.top=(cy-34)+'px';
          if(t<1){requestAnimationFrame(tick);return;}
          // Park at destination — stay visible until last tile lands and renderHand fires.
          flyEl.style.left=(p.destX-34)+'px';flyEl.style.top=(p.destY-34)+'px';
          done++;
          if(done===nNew){
            _burstTileIds=null;
            bagEl.classList.remove('bag-vacuuming');
            renderHand();
            for(var _fi=0;_fi<allFlyEls.length;_fi++){if(allFlyEls[_fi].parentNode)allFlyEls[_fi].parentNode.removeChild(allFlyEls[_fi]);}
            if(onDone)onDone();
          }
        }
        requestAnimationFrame(tick);
      },idx*130);
    })(afterVis[nKept+_j],_j);
  }
}

function clearBoardLetters(){
  for(var i=0;i<B*B;i++){
    if(S.bt[i])setTileState(S.bt[i],'stored',{storedIn:'bag'});
    if(S.btTop&&S.btTop[i])setTileState(S.btTop[i],'stored',{storedIn:'bag'});
  }
  S.bt=Array(B*B).fill(null);
  if(S.btTop)S.btTop=Array(B*B).fill(null);
  if(S.localCooldowns)S.localCooldowns.clear();
}

function toggleSel(idx){if(Date.now()-_dragEndTime<300)return;if(S.hand[idx]){S.hand[idx].sel=!S.hand[idx].sel;_playTileClick('select');renderHand();}}

// Global shift-drag: capture phase intercepts before any tile handler fires.
// Selection rules:
//   shift-click unselected tile → select all tiles
//   shift-click selected tile   → deselect all tiles
//   shift-drag right            → select tiles as cursor passes through them
//   shift-drag left             → deselect tiles as cursor passes through them
document.addEventListener('pointerdown',function(ev){
  if(!ev.shiftKey||ev.button!==0)return;
  if(typeof S==='undefined'||S.phase!=='play')return;
  if(activeDrag)return;
  if(document.getElementById('live-score-row').classList.contains('scoring'))return;
  var _t=ev.target;while(_t&&_t!==document){var _tn=_t.tagName;if(_tn==='BUTTON'||_tn==='INPUT'||_tn==='SELECT'||_tn==='A'||_tn==='TEXTAREA'){return;}_t=_t.parentElement;}
  ev.preventDefault();ev.stopPropagation();
  var _sx=ev.clientX,_sy=ev.clientY;
  var _swept=false,_selMode=null,_prevX=_sx,_prevY=_sy,_lastHandTile=-1;
  // Capture the tile under the initial click and its current sel state for shift-click handling.
  var _clickTile=-1,_clickTileSel=false;
  (function(){var _els=document.elementsFromPoint(_sx,_sy);for(var _ei=0;_ei<_els.length;_ei++){if(_els[_ei].classList.contains('hand-tile')){var _hoi=parseInt(_els[_ei].dataset.handOi);if(!isNaN(_hoi)&&S.hand[_hoi]){_clickTile=_hoi;_clickTileSel=!!S.hand[_hoi].sel;}break;}}})();
  function _sweepAt(x,y,vx,vy){
    var sq=sqAt(x,y);
    var _hasTopNew=sq>=0&&S.btTop&&S.btTop[sq]&&S.btTop[sq].isNew;
    if(sq>=0&&(_hasTopNew||(S.bt[sq]&&S.bt[sq].isNew)))_recallTileSweep(sq,vx||0,vy||0);
    var els=document.elementsFromPoint(x,y);
    var _foundTile=false;
    for(var _i=0;_i<els.length;_i++){
      if(els[_i].classList.contains('hand-tile')){
        _foundTile=true;
        var _hoi=parseInt(els[_i].dataset.handOi);
        if(!isNaN(_hoi)&&S.hand[_hoi]&&_hoi!==_lastHandTile){
          _lastHandTile=_hoi;
          if(vx>0)_selMode='select';
          else if(vx<0)_selMode='deselect';
          if(_selMode==='select'&&!S.hand[_hoi].sel){S.hand[_hoi].sel=true;els[_i].classList.add('selected');_playTileClick('select');}
          else if(_selMode==='deselect'&&S.hand[_hoi].sel){S.hand[_hoi].sel=false;els[_i].classList.remove('selected');_playTileClick('select');}
        }
        break;
      }
    }
    if(!_foundTile)_lastHandTile=-1;
  }
  function _onMove(me){
    var cx=me.clientX,cy=me.clientY;
    var vx=cx-_prevX,vy=cy-_prevY;
    var dx=cx-_sx,dy=cy-_sy;
    if(!_swept&&Math.sqrt(dx*dx+dy*dy)>5){
      _swept=true;activeDrag={src:'shift-sweep'};
      _sweepAt(_sx,_sy,vx,vy);  // process initial tile now that direction is known
    }
    if(_swept){
      var dist=Math.sqrt(vx*vx+vy*vy);
      var steps=Math.max(1,Math.ceil(dist/30));
      for(var _s=1;_s<=steps;_s++){
        _sweepAt(_prevX+vx*_s/steps,_prevY+vy*_s/steps,vx,vy);
      }
    }
    _prevX=cx;_prevY=cy;
  }
  function _onUp(){
    document.removeEventListener('pointermove',_onMove);
    document.removeEventListener('pointerup',_onUp);
    if(_swept){
      activeDrag=null;renderBoard();
      if(HP.movingCount===0)renderHand();
    } else {
      var sq=sqAt(_sx,_sy);
      if(sq>=0&&S.bt[sq]&&S.bt[sq].isNew){_recallAllAnimated();}
      else if(_clickTile>=0){
        // shift-click unselected → select all; shift-click selected → deselect all
        var _target=!_clickTileSel;
        for(var _si=0;_si<S.hand.length;_si++){if(S.hand[_si])S.hand[_si].sel=_target;}
        _playTileClick('select');renderHand();
      } else if(inHand(_sx,_sy)){
        var _allSel=S.hand.every(function(t){return!t||t.sel;});
        for(var _si=0;_si<S.hand.length;_si++){if(S.hand[_si])S.hand[_si].sel=!_allSel;}
        _playTileClick('select');renderHand();
      }
    }
  }
  document.addEventListener('pointermove',_onMove);
  document.addEventListener('pointerup',_onUp);
},true);

function _resetArcQueue(){ _nextArcAt=0; HP.movingCount=0; }

function _launchSelectedTiles(singleOnly){
  if(typeof S==='undefined'||S.phase!=='play')return;
  if(activeDrag)return;
  if(document.getElementById('live-score-row').classList.contains('scoring'))return;
  var _S=S;

  var vis=[];
  for(var i=0;i<S.hand.length;i++){
    var t=S.hand[i];if(!t||t.state!=='hand')continue;
    if(t.sel)vis.push({t:t,oi:i});
  }
  if(vis.length===0)return;
  if(singleOnly)vis=[vis[0]];
  var nSel=vis.length;

  // Detach tile elements and capture rects before renderHand destroys them.
  for(var j=0;j<nSel;j++){
    var face=document.querySelector('.hand-tile[data-hand-oi="'+vis[j].oi+'"]');
    if(face&&face.parentNode){
      vis[j].sr=face.getBoundingClientRect();
      face.parentNode.removeChild(face);
      vis[j].el=face;
    } else {
      vis[j].sr=null;vis[j].el=null;
    }
    setTileState(vis[j].t,'moving',{movingFrom:'hand',movingTo:'hand'});
  }
  HP.movingCount+=nSel;

  // Rebuild hand without launched tiles. Phantom slots let remaining tiles spring
  // smoothly left without freezing.
  renderHand();

  // Pre-compute slot destinations so arcs have accurate visual targets.
  hpBounds();
  var nHand=HP.x.length;
  var allSlots=hpRest(nHand+nSel);

  var ha=document.getElementById('hand-area');var hr=ha?ha.getBoundingClientRect():null;
  var destY=hr?(hr.top+34):(window.innerHeight-60);

  var _G=0.00070,_D=160;
  var _vm=Math.sqrt(2*_G*_D),_sv=(_D*0.25/3)*_G/_vm;
  var _vlo=Math.sqrt(2*_G*_D*0.75),_vhi=Math.sqrt(2*_G*_D*1.25);
  function _rn(){var u=1-Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*Math.random());}

  for(var j=0;j<nSel;j++){
    var _v0=Math.max(_vlo,Math.min(_vhi,_vm+_rn()*_sv));
    (function(entry,v0,slotX){
      var holdUntil=_allocArcSlot();
      function _onLand(){
        if(S!==_S){HP.movingCount=Math.max(0,HP.movingCount-1);if(!HP.movingCount)_nextArcAt=0;return;}
        _landTile(entry.t);_playTileClick('land');
      }
      if(!entry.el||!entry.sr){_onLand();return;}
      var cx=entry.sr.left+34,cy=entry.sr.top+34;
      _flyTileSpiral(entry.el,holdUntil,cx,cy,slotX,destY,_onLand,entry.sr,0,undefined,v0);
    })(vis[j],_v0,allSlots[nHand+j]);
  }
}

document.addEventListener('keydown',function(ev){
  if(ev.code!=='Space')return;
  if(activeDrag)return;
  if(typeof S==='undefined'||S.phase!=='play')return;
  var _tgt=ev.target;
  if(_tgt&&(_tgt.tagName==='INPUT'||_tgt.tagName==='TEXTAREA'||_tgt.isContentEditable))return;
  var _hasSel=false;
  for(var _i=0;_i<S.hand.length;_i++){if(S.hand[_i]&&S.hand[_i].sel){_hasSel=true;break;}}
  if(!_hasSel)return;
  ev.preventDefault();
  _launchSelectedTiles(!ev.shiftKey);
});

function multiPlaceSelected(selOis,startSq,dir){
  var r=Math.floor(startSq/B),c=startSq%B;
  var free=[];
  if(dir==='h'){for(var cc=c;cc<B;cc++){var idx2=r*B+cc;if(!S.bt[idx2])free.push(idx2);}}
  else{for(var rr=r;rr<B;rr++){var idx2=rr*B+c;if(!S.bt[idx2])free.push(idx2);}}
  // Resolve tile refs before any splice — placement removes tiles from S.hand, shifting indices
  var tiles=selOis.map(function(oi){return S.hand[oi];});
  if(free.length<tiles.length)return;
  var i=0;
  function placeNext(){
    if(i>=tiles.length){renderBoard();renderHand();return;}
    var t=tiles[i];var sqIdx=free[i];i++;
    t.sel=false;
    if(t.isBlank&&!t.blankAs){renderBoard();renderHand();openBlankChooser(t,function(){placeTile(t,sqIdx);placeNext();});}
    else{placeTile(t,sqIdx);placeNext();}
  }
  placeNext();
}
