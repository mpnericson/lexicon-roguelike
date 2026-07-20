// =====================================================================
// DRAG — tile, sticker and stamp drag-and-drop engine
// =====================================================================
// Detach an element mid-drag: reparent the real face to document.body as a
// fixed-position element that follows the cursor. No clones — the same DOM node
// travels for the whole gesture (see the tile state invariant in CLAUDE.md).
function detachFace(face,sr){
  if(face.parentNode)face.parentNode.removeChild(face);
  face.style.position='fixed';face.style.zIndex='9999';face.style.pointerEvents='none';
  face.style.left=sr.left+'px';face.style.top=sr.top+'px';
  face.style.transition='transform 0.1s ease,box-shadow 0.1s ease';
  face.style.transform='scale(1.08)';face.style.boxShadow='0 12px 28px rgba(0,0,0,.7)';
  document.body.appendChild(face);
}

function clearHL(){if(_hl>=0){var e=document.querySelector('[data-sq-idx="'+_hl+'"]');if(e)e.classList.remove('drop-target');}_hl=-1;}
function hasJenga(){return hasStamp('jenga');}
// A square can be stacked only once: committed tiles that were themselves
// stacked (_stackLevel >= 1) can't take another tile.
function _jengaCanStack(idx){return hasJenga()&&S.bt[idx]&&!S.bt[idx].isNew&&!S.bt[idx]._stackLevel&&!(S.btTop&&S.btTop[idx]);}
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
        var over=sqAt(me.clientX,me.clientY);if(over>=0&&over!==sqIdx&&(!S.bt[over]||_jengaCanStack(over)))setHL(over);else clearHL();
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
      } else if(over>=0&&over!==sqIdx&&(!S.bt[over]||_jengaCanStack(over))&&(!window.TUT||!TUT.active||_tutPlaceOK(btRef,over))){
        var sqEl=document.querySelector('[data-sq-idx="'+over+'"]');var tr=sqEl?sqEl.getBoundingClientRect():null;
        if(tr){face.style.transition='left .13s,top .13s,transform .13s';face.style.left=(tr.left+tr.width/2-_tsz/2)+'px';face.style.top=(tr.top+tr.height/2-_tsz/2)+'px';face.style.transform='scale(1)';}
        setTimeout(function(){
          if(face.parentNode)face.parentNode.removeChild(face);
          var src=_getBtRef();
          if(src){
            if(isTop){if(S.btTop)S.btTop[sqIdx]=null;}else{S.bt[sqIdx]=null;}
            setTileState(src,'board',{boardSq:over,isNew:true});
            if(_jengaCanStack(over)){
              if(!S.btTop)S.btTop=Array(B*B).fill(null);
              S.btTop[over]=src;
            } else {
              S.bt[over]=src;
            }
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
    if(ev.button!==0)return;
    ev.preventDefault();ev.stopPropagation();
    if(activeDrag)return;
    var sx=ev.clientX,sy=ev.clientY;var sr=face.getBoundingClientRect();var moved=false;
    HP.held=vi;
    function move(me){
      var dx=me.clientX-sx,dy=me.clientY-sy;
      if(!moved&&Math.sqrt(dx*dx+dy*dy)>8){
        moved=true;HP.held=-1;_playTileClick('pick');
        item._dragging=true;
        detachFace(face,sr);
        activeDrag={src:'hand',barSrc:'hand',vi:-1,multiCount:1,cx:me.clientX,cy:me.clientY,gapLeft:me.clientX,gapRight:me.clientX};
        renderSqHand();
      }
      if(!moved)return;
      face.style.left=(me.clientX-34)+'px';face.style.top=(me.clientY-39)+'px';
      var si=sqAt(me.clientX,me.clientY);
      if(si>=0&&!S.board[si]&&!isSqStaged(si)){setHL(si);}else{clearHL();}
      var ob=si>=0||inBoardBounds(me.clientX,me.clientY);
      face.style.transform='scale('+(ob?'0.75':'1.08')+')';
      face.style.boxShadow=ob?'0 4px 12px rgba(0,0,0,.5)':'0 12px 28px rgba(0,0,0,.7)';
      activeDrag.cx=me.clientX;activeDrag.cy=me.clientY;activeDrag.gapLeft=me.clientX;activeDrag.gapRight=me.clientX;
    }
    function up(me){
      document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);
      HP.held=-1;clearHL();
      if(!moved)return;
      _dragEndTime=Date.now();
      item._dragging=false;
      var si=sqAt(me.clientX,me.clientY);
      if(si>=0&&!S.board[si]&&!isSqStaged(si)&&(!window.TUT||!TUT.active||_tutStickerOK(si))){
        if(face.parentNode)face.parentNode.removeChild(face);
        var globalIdx=S.sqHand.indexOf(item);
        S.sqStaged[si]=globalIdx;item.placed=true;
        activeDrag=null;
        renderSqHand();renderBoard();
      } else {
        face.style.transition='left .14s,top .14s,transform .14s';
        face.style.left=sr.left+'px';face.style.top=sr.top+'px';face.style.transform='scale(1)';
        setTimeout(function(){if(face.parentNode)face.parentNode.removeChild(face);activeDrag=null;renderSqHand();},140);
      }
    }
    document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);
  });
}

function computeStampInsert(mouseX,dragVi,ph){
  var n=ph.tiles.length;
  for(var i=0;i<n;i++){if(i===dragVi)continue;if(mouseX<ph.x[i])return i;}return n;
}

// ph = physics instance (SP for game bar, SSP for shop bar), dragSrc = 'stamp'|'shop-stamp'
// Collision model — no phases, no scripted exit, nothing latches. The face
// always tracks the cursor 1:1; every move event just applies solid clamps:
//   floor — the seat: the tile can rise freely but never sinks below it;
//   contacts — while the tile's bottom overlaps the seated tiles, its x stops
//   dead against any RESTING neighbour (and the bar's end walls). A yielding
//   neighbour — one mid-spring because the gap-follow told it to step aside
//   (same leading-edge-halfway trigger the hand uses, physics.js) — exerts no
//   contact, so the face slides into the space exactly as fast as it opens.
// So "it can only leave vertically" is emergent: at rest both sides are solid
// and the floor is below — up is the only open direction. Push sideways and
// the neighbour gives way, which IS the lateral reorder. The instant the
// tile's bottom clears the neighbours' tops it's free; descending re-seats it
// — the hole tracks the cursor whenever it's within a tile of the seat, so a
// gap is open by the time the tile lands. Drop commits wherever the tile
// visibly is: seated or over the bar → insert at the hole; anywhere else →
// fly home, no reorder. Tap = exclusive select — selecting one stamp deselects
// any other; the selected stamp shows a floating Sell button.
function attachStampDrag(face,vi,ts,ph,dragSrc){
  face.addEventListener('pointerdown',function(ev){
    if(ev.button!==0)return;
    ev.preventDefault();ev.stopPropagation();
    if(activeDrag)return;
    if(document.getElementById('live-score-row').classList.contains('scoring'))return;
    var sx=ev.clientX,sy=ev.clientY;var sr=face.getBoundingClientRect();
    var moved=false;var tw=ph.TILE_W;
    var origX=sr.left+tw/2;var wasSeated=true;var lastX=origX;
    var barEl=document.getElementById(dragSrc==='shop-stamp'?'shop-stamp-bar':'stamp-bar');
    ph.held=vi;
    if(ph.settleDur>=9999){ph.settleAt=0;ph.settleCallback=null;ph.settleDur=150;}
    function move(me){
      var dx=me.clientX-sx,dy=me.clientY-sy;
      if(!moved&&Math.sqrt(dx*dx+dy*dy)>8){
        moved=true;ph.held=-1;_playTileClick('pick');
        ts._dragging=true;
        face.classList.remove('selected');
        detachFace(face,sr);
        // Seed the hole at the stamp's own slot so the first seated frame has a
        // valid target before the next physics step recomputes it.
        ph.gapHoleIdx=vi;ph.gapHoleX=origX;
        activeDrag={src:dragSrc,barSrc:dragSrc,vi:-1,multiCount:0.5,cx:origX,cy:sr.top+tw/2,gapLeft:origX,gapRight:origX};
        renderStampBar();
      }
      if(!moved)return;
      // Pure geometry, no phases. near = hole-alive zone: within a tile of the
      // seat the physics hole tracks the cursor, so a neighbour yields ahead of
      // a push and a gap is open before a descending tile lands. seated = the
      // tile still vertically overlaps the seated tiles: the face is
      // cursor-centred but floored, and tiles are tw tall, so contact ends
      // once the cursor is half a tile above the seat.
      var near=me.clientY>=sr.top-tw;
      var seated=me.clientY>=sr.top-tw/2;
      var br=barEl?barEl.getBoundingClientRect():sr;
      var fx=Math.max(br.left,Math.min(br.right,me.clientX));
      if(seated){
        // Hard collision: x tracks the cursor 1:1 until it contacts a RESTING
        // neighbour or the bar's end walls. A yielding neighbour (mid-spring,
        // stepping aside per the gap-follow) exerts no contact, so the face
        // rides into the space exactly as it opens. If contacts momentarily
        // leave no room (the row is still parting), hold the last valid spot
        // instead of teleporting.
        var lo=br.left+tw/2,hi=br.right-tw/2;
        for(var j=0;j<ph.tiles.length;j++){
          if(Math.abs(ph.vx[j]||0)>0.5)continue;
          if(ph.x[j]<=me.clientX)lo=Math.max(lo,ph.x[j]+tw);else hi=Math.min(hi,ph.x[j]-tw);
        }
        if(lo<=hi)lastX=Math.max(lo,Math.min(hi,me.clientX));
        face.style.transition='transform 0.1s ease,box-shadow 0.1s ease';
        face.style.left=(lastX-tw/2)+'px';
        // Floor: rise freely, never sink below the seat.
        face.style.top=Math.min(me.clientY-tw/2,sr.top)+'px';
      } else {
        // Clear of the rack — free tracking. Ease the catch-up from the last
        // seated x onto the cursor, then unhook back to direct tracking.
        if(wasSeated){
          face.style.transition='left .12s ease,transform 0.1s ease,box-shadow 0.1s ease';
          setTimeout(function(){if(ts._dragging)face.style.transition='transform 0.1s ease,box-shadow 0.1s ease';},130);
        }
        lastX=me.clientX;
        face.style.left=(me.clientX-tw/2)+'px';face.style.top=(me.clientY-tw/2)+'px';
      }
      // Feed the physics the bar-clamped cursor: while near, cy is pinned to
      // the seat so the hole stays alive (and pushable to the end slots) even
      // if the cursor drifts past the bar's edge or below it.
      activeDrag.cx=fx;activeDrag.cy=near?sr.top+tw/2:me.clientY;
      activeDrag.gapLeft=fx;activeDrag.gapRight=fx;
      wasSeated=seated;
      face.style.transform='scale('+(seated?'1':'1.08')+')';
      face.style.boxShadow=seated?'0 4px 12px rgba(0,0,0,.5)':'0 12px 28px rgba(0,0,0,.7)';
    }
    function up(me){
      document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);
      ph.held=-1;
      if(!moved){
        if(Date.now()-_dragEndTime<300)return;
        var was=!!ts.sel;
        for(var i=0;i<S.stamps.length;i++)S.stamps[i].sel=false;
        ts.sel=!was;
        _playTileClick('select');
        renderStampBar();
        return;
      }
      _dragEndTime=Date.now();
      ts._dragging=false;
      // Commit wherever the tile visibly is: seated (or over the bar) → the
      // hole the face is riding; anywhere else → the cancel branch below.
      if(me.clientY>=sr.top-tw/2||ph.inArea(me.clientX,me.clientY)){
        var ins=ph.gapHoleIdx!=null?ph.gapHoleIdx:computeStampInsert(me.clientX,-1,ph);
        var gi=S.stamps.indexOf(ts);
        if(gi>=0){S.stamps.splice(gi,1);ins=Math.max(0,Math.min(ins,S.stamps.length));S.stamps.splice(ins,0,ts);}
        ph.bounds();
        var destX=ph.rest(S.stamps.length)[ins];
        var bar=document.getElementById(dragSrc==='shop-stamp'?'shop-stamp-bar':'stamp-bar');
        var br=bar?bar.getBoundingClientRect():null;
        var destTop=br?br.top+(dragSrc==='shop-stamp'?2:8):sr.top;
        face.style.transition='left .14s,top .14s,transform .14s,box-shadow .14s';
        face.style.left=(destX-tw/2)+'px';face.style.top=destTop+'px';face.style.transform='scale(1)';
        setTimeout(function(){
          if(face.parentNode)face.parentNode.removeChild(face);
          activeDrag=null;renderStampBar();
          _rankObserve(true); // stamp bar order is a scoring mechanic
        },140);
      } else {
        face.style.transition='left .14s,top .14s,transform .14s';
        face.style.left=sr.left+'px';face.style.top=sr.top+'px';face.style.transform='scale(1)';
        setTimeout(function(){if(face.parentNode)face.parentNode.removeChild(face);activeDrag=null;renderStampBar();},140);
      }
    }
    document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);
  });
}

// Multi-tile drag: all selected tiles physically leave the hand together.
//
// Phase 1 (seated):
//   All tiles rise with the cursor's y, each locked to its grabbed x. The hand
//   is frozen (settle hold), so the holes stay where the tiles were and no
//   other tile moves until the group leaves the row. Exits:
//   up — tile bottoms clear the hand-area top (same threshold as ph.inArea)
//   → Phase 2.
//   sideways (single tile) — the cursor crosses the centre of the adjacent
//   seated tile (over halfway through it) → seated PATH REORDER, not Phase 2:
//   the tile flies focus-mode style (cardinal legs, each accelerating from
//   standstill — see FOCUS.CHASE/CHASE_ACCEL) up out of its slot, across the
//   surface to the slot nearest the cursor (retargeting while airborne), then
//   down into it. The hand stays frozen — nothing recentres; only the tiles
//   between the old hole and the landing slot slide one slot over to fill the
//   hole, starting the moment the descent starts. Repeatable while seated;
//   pulling up mid-anything still exits to Phase 2, and a Phase-1 drop inserts
//   at the current hole.
//   sideways (multi-tile group) — same trigger relative to the anchor's slot,
//   but groups hand off to Phase 2 as a surface SLIDE (_wasAtSurface pre-set,
//   dwell rules apply; "nearest slot" is ill-defined for a group).
//
// Phase 2 (triggers on a Phase-1 exit):
//   Hand gap closes to rest positions. Dragging tiles slide laterally to form a
//   cluster around the anchor (_clOff offsets ease to the tight formation over
//   ~300ms via _clStep — JS-driven so it works while the pointer is idle too).
//
// Shift or right-click: pivot h↔v around the anchor at any time.
// Space: disperse all tiles back into the hand via arcing animations.
function _startMultiDrag(ev,dragOi,dragVi,selTiles){
  var sx=ev.clientX,sy=ev.clientY;
  var moved=false,dragEls=[],initRects=[];
  var dir='h';
  var _mHL=[];
  var _overBoard=false;
  var _phase2Fired=false;
  var _lastCx=sx,_lastCy=sy,_lastSq=-1;
  var _committedSlotX=null; // locked slot centre when cursor crosses funnel threshold
  var _latBreakAt=-1; // when a multi-tile group exited Phase 1 sideways — brief top/left ease onto the surface
  // Seated path-reorder state (single-tile drags only; _seatSlots null for groups).
  var _seatSlots=null;   // frozen slot centres (n slots: remaining tiles + the hole), ascending
  var _holeSlot=-1;      // which slot is currently vacant (the dragged tile's seat)
  var _slotOf=null;      // HP tile index -> slot index occupancy map
  var _seatTopY=0,_surfTopY=0; // face top at the seat / riding the surface (bottom flush with tile tops)
  var _pathFlying=false,_pathDescending=false,_pathTarget=-1;
  var _pathRAF=null,_pathSpd=0,_pathHx=0,_pathHy=0;
  var _shifts=[];        // displaced-tile slides {j,from,to,t0}
  var _PATH_SPEED=30,_PATH_ACCEL=1.4; // px/frame — mirrors FOCUS.CHASE/CHASE_ACCEL leg motion
  var dragIdx=0;
  var _clOff=[],_clT=1,_clRAF=null; // Phase-2 cluster formation: x-offsets from anchor easing → tight row
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
    _clearMHL();
    // Single tile over a Jenga-stackable committed tile: highlight the stack target.
    if(selTiles.length===1&&_jengaCanStack(anchorSq)){_mHL.push(anchorSq);var se=document.querySelector('[data-sq-idx="'+anchorSq+'"]');if(se)se.classList.add('drop-target');return;}
    var targets=_computeFree(_startSq(anchorSq));if(!targets)return;
    for(var i=0;i<targets.length;i++){_mHL.push(targets[i]);var e=document.querySelector('[data-sq-idx="'+targets[i]+'"]');if(e)e.classList.add('drop-target');}
  }

  // Positions, scales, and shadows all dragging tiles as a single cluster around cursor.
  // Over board: step shrinks so tiles stay visually tight when scaled to 0.75.
  // posTr: CSS duration for left/top (e.g. '0.14s ease'); omit for instant.
  function _updateAll(cx,cy,overBoard,posTr){
    var sc=overBoard?0.75:1.08;
    var step=overBoard?Math.ceil(68*0.75)+2:72;
    var sh=overBoard?'0 4px 12px rgba(0,0,0,.5)':'0 12px 28px rgba(0,0,0,.7)';
    var tr=posTr?('left '+posTr+',top '+posTr+',transform 0.1s ease,box-shadow 0.1s ease'):'transform 0.1s ease,box-shadow 0.1s ease';
    var _e=1-Math.pow(1-_clT,3); // cluster formation ease: 0 = grab spread, 1 = tight row
    for(var i=0;i<dragEls.length;i++){
      if(!dragEls[i])continue;
      var off=(i-dragIdx)*step;
      if(dir==='h'&&_clT<1&&_clOff[i]!==undefined)off=_clOff[i]+(off-_clOff[i])*_e;
      dragEls[i].style.transition=tr;
      dragEls[i].style.left=(dir==='h'?cx-34+off:cx-34)+'px';
      dragEls[i].style.top=(dir==='h'?cy-39:cy-39+off)+'px';
      dragEls[i].style.transform='scale('+sc+')';
      dragEls[i].style.boxShadow=sh;
    }
  }

  // Advances the cluster formation ease (~300ms at 60fps) even when the pointer is idle.
  function _clStep(){
    _clT=Math.min(1,_clT+1/18);
    if(_phase2Fired)_updateAll(_lastCx,_lastCy,_overBoard);
    _clRAF=_clT<1?requestAnimationFrame(_clStep):null;
  }

  // Phase 2: hand closes gap + dragging tiles sweep to cluster. Guarded by _phase2Fired.
  function _firePhase2(){
    if(_phase2Fired)return;
    if(activeDrag){activeDrag.multiCount=selTiles.length;activeDrag.funnelInsertIdx=undefined;activeDrag._prevGapRef=undefined;}
    _phase2Fired=true;
    hpBounds();
    HP.fromX=HP.x.slice();HP.toX=hpRest(HP.tiles.length);
    HP.settleDur=220;HP.settleAt=performance.now();HP.settleCallback=null;
    // Capture each tile's current x-offset from the anchor so the group SLIDES
    // into formation from wherever it was lifted, instead of snapping.
    var _aEl=dragEls[dragIdx];
    var _ax=_aEl?parseFloat(_aEl.style.left):_lastCx-34;
    _clOff=[];
    for(var i=0;i<dragEls.length;i++)_clOff.push(dragEls[i]?parseFloat(dragEls[i].style.left)-_ax:0);
    _clT=selTiles.length>1?0:1;
    if(!_clRAF&&_clT<1)_clRAF=requestAnimationFrame(_clStep);
    _updateAll(_lastCx,_lastCy,_overBoard);
  }

  // ---- Seated path reorder (single tile) — focus-mode cardinal-leg flight ----
  // Build the seated slot grid from the CANONICAL rest layout (hpRest with the
  // dragged tile's slot included) — never from measured rects or live HP.x:
  // the grabbed tile's rect is skewed by the .hand-tile:hover transform, the
  // hand may be grabbed mid-spring, and any delta between the shift targets
  // and the true rests shows up as a visible nudge of the displaced tiles at
  // release, when everything settles to hpRest.
  function _buildSeatGrid(holeSlot){
    hpBounds();
    _seatSlots=hpRest(HP.x.length+1);
    _holeSlot=Math.max(0,Math.min(holeSlot,HP.x.length));
    _slotOf=[];
    for(var j=0;j<HP.x.length;j++)_slotOf[j]=j<_holeSlot?j:j+1; // HP order = S.hand order = layout order
    var _ha=document.getElementById('hand-area');
    _seatTopY=_ha?_ha.getBoundingClientRect().top:(initRects[0]?initRects[0].top:0); // .hand-tile sits at top:0 of #hand-area
    _surfTopY=_seatTopY-78; // one tile height up — bottom rides flush with seated tile tops
  }
  // Re-enter Phase 1 from Phase 2: a single tile that fully descended into an
  // open slot becomes seated again — frozen hand, solid neighbours, path-flight
  // reorder — so it can't be dragged sideways THROUGH the row.
  function _reseat(ins){
    _phase2Fired=false;
    _pathStop();
    if(_surfaceDwellTimer){clearTimeout(_surfaceDwellTimer);_surfaceDwellTimer=null;}
    _surfaceDwellSlotIdx=-1;_surfaceGapOpen=false;_wasAtSurface=false;_cameFromAbove=false;
    if(_springSlowed){HP.SPRING=0.14;HP.DAMP=0.55;_springSlowed=false;}
    _gapOpenAt=-1;_gapWasOpen=false;
    if(_clRAF){cancelAnimationFrame(_clRAF);_clRAF=null;}_clT=1;
    if(activeDrag){activeDrag.funnelInsertIdx=undefined;activeDrag._prevGapRef=undefined;}
    _buildSeatGrid(ins);
    // Ease the row from its Phase-2 gap layout onto the seated grid, then freeze.
    HP.fromX=HP.x.slice();
    HP.toX=[];
    for(var j=0;j<HP.x.length;j++)HP.toX.push(_seatSlots[_slotOf[j]]);
    HP.settleDur=150;HP.settleAt=performance.now();
    HP.settleCallback=function(){HP.fromX=HP.x.slice();HP.toX=HP.x.slice();HP.settleDur=9999;HP.settleAt=performance.now();};
  }
  function _nearestSlot(cx){
    var best=0,bd=Infinity;
    for(var s=0;s<_seatSlots.length;s++){var d=Math.abs(_seatSlots[s]-cx);if(d<bd){bd=d;best=s;}}
    return best;
  }
  function _tileAtSlot(s){for(var j=0;j<_slotOf.length;j++)if(_slotOf[j]===s)return j;return -1;}
  // Displaced tiles: everything between the old hole and the landing slot moves
  // ONE slot toward the hole, filling it. Fired at descent start so the slide
  // happens while the dragged tile drops in. The hand is frozen (settle hold),
  // so writing fromX/toX/x directly is what moves a tile.
  function _commitShift(target){
    var now=performance.now();
    if(target>_holeSlot){
      for(var s=_holeSlot+1;s<=target;s++){var j=_tileAtSlot(s);if(j<0)continue;_slotOf[j]=s-1;_shifts.push({j:j,from:HP.x[j],to:_seatSlots[s-1],t0:now});}
    }else{
      for(var s=_holeSlot-1;s>=target;s--){var j=_tileAtSlot(s);if(j<0)continue;_slotOf[j]=s+1;_shifts.push({j:j,from:HP.x[j],to:_seatSlots[s+1],t0:now});}
    }
    _holeSlot=target;
  }
  function _stepShifts(){
    var now=performance.now(),keep=[];
    for(var i=0;i<_shifts.length;i++){
      var sh=_shifts[i],t=Math.min(1,(now-sh.t0)/180),e=1-Math.pow(1-t,2);
      HP.x[sh.j]=HP.fromX[sh.j]=HP.toX[sh.j]=sh.from+(sh.to-sh.from)*e;
      if(t<1)keep.push(sh);
    }
    _shifts=keep;
  }
  function _pathStop(){
    if(_pathRAF){cancelAnimationFrame(_pathRAF);_pathRAF=null;}
    for(var i=0;i<_shifts.length;i++){var sh=_shifts[i];HP.x[sh.j]=HP.fromX[sh.j]=HP.toX[sh.j]=sh.to;}
    _shifts=[];_pathFlying=false;_pathDescending=false;_pathSpd=0;_pathHx=0;_pathHy=0;
  }
  function _startFlight(){
    if(_pathFlying)return;
    _pathFlying=true;_pathDescending=false;_pathSpd=0;_pathHx=0;_pathHy=0;
    _pathTarget=_nearestSlot(_lastCx);
    if(dragEls[0])dragEls[0].style.transition='transform 0.1s ease,box-shadow 0.1s ease';
    if(!_pathRAF)_pathRAF=requestAnimationFrame(_pathTick);
  }
  function _pathTick(){
    _pathRAF=null;
    if(_phase2Fired)return;
    _stepShifts();
    if(_pathFlying){
      var el=dragEls[0];
      if(!el){_pathStop();return;}
      if(!_pathDescending)_pathTarget=_nearestSlot(_lastCx); // slide toward wherever the cursor is
      var x=parseFloat(el.style.left)+34,y=parseFloat(el.style.top);
      var tx=_seatSlots[_pathTarget];
      // Descent commit: once above the target, lock it and start the neighbour shift.
      if(Math.abs(x-tx)<=0.5&&!_pathDescending){_pathDescending=true;_commitShift(_pathTarget);}
      // Cardinal waypoints: rise to the surface (or cross at current height if
      // already above it), across to the target, straight down into the seat.
      var wp;
      if(Math.abs(x-tx)>0.5)wp=(y>_surfTopY+0.5)?{x:x,y:_surfTopY}:{x:tx,y:y};
      else wp={x:tx,y:_seatTopY};
      var dx=wp.x-x,dy=wp.y-y,dd=Math.hypot(dx,dy);
      if(_pathDescending&&dd<=0.5){
        el.style.left=(tx-34)+'px';el.style.top=_seatTopY+'px';
        _pathFlying=false;_pathDescending=false;_pathSpd=0;
      }else if(dd>0.5){
        var ux=dx/dd,uy=dy/dd;
        if(ux*_pathHx+uy*_pathHy<0.9)_pathSpd=0; // new leg — accelerate from standstill
        _pathHx=ux;_pathHy=uy;
        _pathSpd=Math.min(_PATH_SPEED,_pathSpd+_PATH_ACCEL);
        var mv=Math.min(_pathSpd,dd);
        el.style.left=(x+ux*mv-34)+'px';el.style.top=(y+uy*mv)+'px';
      }
    }
    if(_pathFlying||_shifts.length)_pathRAF=requestAnimationFrame(_pathTick);
  }

  // Toggle h↔v direction; fires Phase 2 if it hasn't started yet.
  function _toggleDir(){
    dir=dir==='h'?'v':'h';
    _firePhase2();
    _clT=1; // pivoting rebuilds the formation outright — skip the slide-in ease
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
    if(HP.settleDur>=9999){HP.settleAt=0;HP.settleCallback=null;HP.settleDur=150;} // release the phase-1 freeze
    if(_clRAF){cancelAnimationFrame(_clRAF);_clRAF=null;}_clT=1;
    _pathStop();
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
      if(_clRAF){cancelAnimationFrame(_clRAF);_clRAF=null;}_clT=1;
      _pathStop();
      if(_surfaceDwellTimer){clearTimeout(_surfaceDwellTimer);_surfaceDwellTimer=null;}
      _surfaceDwellSlotIdx=-1;_surfaceGapOpen=false;_wasAtSurface=false;
      if(_springSlowed){HP.SPRING=0.14;HP.DAMP=0.55;_springSlowed=false;}
      _gapOpenAt=-1;_gapWasOpen=false;
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

      // Capture hand rects, detach selected tiles, parent them to body.
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

      // Freeze hand tiles — solid objects until dragged tiles clear vertically (Phase 2).
      HP.fromX=HP.x.slice();HP.toX=HP.x.slice();HP.settleDur=9999;HP.settleAt=performance.now();HP.settleCallback=null;
      // Seated path-reorder slot grid (single tile). The hole slot = the
      // grabbed tile's rank among the remaining tiles (centre from the rect —
      // the x-centre survives the hover transform, and slots are 68px apart
      // so a couple px of skew can't flip the rank).
      if(selTiles.length===1&&initRects[0]){
        var _gx0=initRects[0].left+initRects[0].width/2;
        var _rk0=0;for(var _sj=0;_sj<HP.x.length;_sj++)if(HP.x[_sj]<_gx0)_rk0++;
        _buildSeatGrid(_rk0);
      }
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
      // Above hand: free movement, gap follows cursor.
      // At hand surface (cy >= haR.top-29): tile slides along top; gap only opens after
      // cursor dwells in a slot zone (within 1/3 tile-width of boundary) for 800ms.
      var _ecx,_ecy,_gapCx,_gapCy;
      if(_phase2Fired&&!_overBoard&&_haRF){
        var _surfaceY=_haRF.top-29; // tile bottom flush with top of hand tiles
        if(me.clientY>=_surfaceY){
          // SURFACE MODE — tile(s) slide along hand top.
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
            // A single tile that has fully descended into the slot RE-SEATS:
            // back to Phase 1 (frozen hand, solid neighbours, path-flight
            // reorder), so it can't be dragged sideways THROUGH the row — the
            // only lateral move from a seat is flying over the top. (Without
            // this, a y-wiggle at the surface reset the came-from-above lock
            // and let the tile break through to any slot.)
            if(selTiles.length===1&&_gapE>=_Y_DUR&&me.clientY>=_haRF.top+39){
              _reseat(_nearInsertIdx);
              _updateAll(_seatSlots[_holeSlot],_seatTopY+39,false,'0.1s ease');
              return;
            }
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
          // Anchor _gapCy to hand top so ph.inArea() returns true and HP opens a gap.
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
      // Track full group extent for the hand spring gap (both edges push hand tiles).
      var _gapStep=_overBoard?(Math.ceil(68*0.75)+2):72;
      if(dir==='h'){
        activeDrag.gapLeft=_gapCx-dragIdx*_gapStep;
        activeDrag.gapRight=_gapCx+(selTiles.length-1-dragIdx)*_gapStep;
      } else {
        activeDrag.gapLeft=_gapCx;
        activeDrag.gapRight=_gapCx;
      }
      if(!_phase2Fired){
        if(_seatSlots){
          // Phase 1, single tile: seated at the current hole — x locked to its
          // centre, y rises with the cursor but never sinks below the seat.
          // While a flight is running the path RAF owns the face.
          if(!_pathFlying){
            if(dragEls[0]){
              dragEls[0].style.left=(_seatSlots[_holeSlot]-34)+'px';
              var _p1t=me.clientY-39;if(_p1t>_seatTopY)_p1t=_seatTopY;
              dragEls[0].style.top=_p1t+'px';
            }
            // Lateral trigger: cursor over halfway through the adjacent seated
            // tile → fly (up, across to the slot nearest the cursor, down).
            var _tl=_holeSlot>0?_seatSlots[_holeSlot-1]:-Infinity;
            var _tr=_holeSlot<_seatSlots.length-1?_seatSlots[_holeSlot+1]:Infinity;
            if(me.clientX<_tl||me.clientX>_tr)_startFlight();
          }
          // Vertical exit still works at any time, mid-flight included.
          if(_haRF&&me.clientY<_haRF.top-34){_pathStop();_firePhase2();}
        } else {
          // Phase 1, group: every dragged tile rises with the cursor's y,
          // locked to its grabbed x. The hand stays frozen (settle hold from
          // drag start), so the holes stay where the tiles were.
          for(var i=0;i<dragEls.length;i++){
            if(!dragEls[i])continue;
            if(initRects[i])dragEls[i].style.left=initRects[i].left+'px';
            // Clamp to the seat: the tile can only rise out of its slot, never sink below it.
            var _p1Top=me.clientY-39;
            if(initRects[i]&&_p1Top>initRects[i].top)_p1Top=initRects[i].top;
            dragEls[i].style.top=_p1Top+'px';
          }
          // Phase 2 fires when the cursor clears the hand vertically…
          if(_haRF&&me.clientY<_haRF.top-34){_firePhase2();}
          else{
            // …or sideways: crossing the centre of the nearest remaining hand
            // tile beside the anchor's slot hands the GROUP off to the
            // surface-mode lateral system ("nearest slot" is ill-defined for a
            // group, so no path flight here). _wasAtSurface is pre-set so the
            // handoff counts as a lateral slide (dwell rules), not a descent
            // from above (which locks the slot).
            var _ax0=initRects[dragIdx]?initRects[dragIdx].left+34:me.clientX;
            var _nnL=-Infinity,_nnR=Infinity;
            for(var _lb=0;_lb<HP.x.length;_lb++){
              if(HP.x[_lb]<_ax0){if(HP.x[_lb]>_nnL)_nnL=HP.x[_lb];}
              else if(HP.x[_lb]>_ax0&&HP.x[_lb]<_nnR)_nnR=HP.x[_lb];
            }
            if(me.clientX<_nnL||me.clientX>_nnR){
              _wasAtSurface=true;_latBreakAt=Date.now();
              _firePhase2();
            }
          }
        }
      } else {
        // Brief top/left ease right after a lateral Phase-1 exit so the tile
        // rises from its seat onto the surface instead of snapping.
        _updateAll(_ecx,_ecy,_overBoard,(_latBreakAt>0&&Date.now()-_latBreakAt<180)?'0.15s ease':undefined);
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
    if(_surfaceDwellTimer){clearTimeout(_surfaceDwellTimer);_surfaceDwellTimer=null;}
    var _dropLockedSlot=(_cameFromAbove&&_surfaceDwellSlotIdx>=0)?_surfaceDwellSlotIdx:-1;
    _surfaceDwellSlotIdx=-1;_surfaceGapOpen=false;_cameFromAbove=false;
    if(!moved){
      activeDrag=null;
      // Re-resolve indices by tile identity — dragOi/dragVi go stale if the hand
      // re-rendered between pointerdown and release, toggling the wrong tile.
      var _ct=selTiles[dragIdx].t;
      var _coi=S.hand.indexOf(_ct);
      if(_coi>=0)toggleSel(_coi);
      return;
    }
    _dragEndTime=Date.now();
    if(HP.settleDur>=9999){HP.settleAt=0;HP.settleCallback=null;HP.settleDur=150;} // release the phase-1 freeze
    if(_clRAF){cancelAnimationFrame(_clRAF);_clRAF=null;}_clT=1;
    // Releasing mid-flight commits the move the tile was heading for; _pathStop
    // fast-forwards any neighbour shifts to their final slots.
    if(_pathFlying&&!_pathDescending)_commitShift(_pathTarget);
    _pathStop();
    // Phase-1 drop: seated tiles commit at the current hole (single) or return
    // to their original slots (group), regardless of where the cursor wandered.
    var _p1Ins=!_phase2Fired?(_seatSlots?_holeSlot:Math.max(0,dragVi-dragIdx)):-1;
    for(var i=0;i<dragEls.length;i++){if(dragEls[i]&&dragEls[i].parentNode)dragEls[i].parentNode.removeChild(dragEls[i]);}
    activeDrag=null;
    var sq=sqAt(me.clientX,me.clientY);
    if(sq>=0&&selTiles.length===1&&_jengaCanStack(sq)){
      // Drag-to-stack (Jenga): drop a single tile onto an eligible committed
      // tile. placeTile routes it to S.btTop.
      var _jt=selTiles[0].t;setTileState(_jt,'hand');_jt.sel=false;
      if(_jt.isBlank&&!_jt.blankAs){renderBoard();renderHand();openBlankChooser(_jt,function(){placeTile(_jt,sq);renderBoard();renderHand();});}
      else{placeTile(_jt,sq);renderBoard();renderHand();}
    } else if(sq>=0&&_computeFree(_startSq(sq))&&(!window.TUT||!TUT.active||_tutDragDropOK(selTiles.length))){
      for(var i=0;i<selTiles.length;i++){setTileState(selTiles[i].t,'hand');}
      // Recompute indices from current S.hand position to avoid stale-index bug
      // (S.hand may have shifted if a recall arc landed between drag start and drop).
      var selOis=selTiles.map(function(s){var fi=S.hand.indexOf(s.t);return fi>=0?fi:s.oi;});
      multiPlaceSelected(selOis,_startSq(sq),dir);
    } else if(inHand(me.clientX,me.clientY)||_p1Ins>=0){
      // Dropped in hand — reorder tiles at cursor position. Phase-1 drops
      // (_p1Ins>=0) commit even if the cursor strayed outside the hand: the
      // tiles are visibly seated in the row.
      // Compute insert position in HP.tiles (dragging tiles already excluded).
      var _ins=Math.max(0,Math.min(_dropLockedSlot>=0?_dropLockedSlot:_p1Ins>=0?_p1Ins:computeInsert(me.clientX,-1),S.hand.length));
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
  if(window.TUT&&TUT.active&&!_tutPlaceOK(t,sqIdx))return;
  if(t)S.hand=S.hand.filter(function(x){return x!==t;});
  setTileState(t,'board',{boardSq:sqIdx,isNew:true});
  if(S.bt[sqIdx]&&!S.bt[sqIdx].isNew&&!S.bt[sqIdx]._stackLevel&&!(S.btTop&&S.btTop[sqIdx])){
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

// Golden-ratio spiral arc back to the hand.
// Phase 1 — drift: tile moves in driftDx/driftDy direction (ease-out, 450ms) while waiting for its arc slot.
// Phase 2 — spiral: quintic Bezier sweeps UP-RIGHT past the board, loops off-screen right,
//   swoops down past the tile bag, and enters the hand from the right.
// Arc height scales with horizontal distance from right edge — left-side tiles fly higher.
// destX: fixed x coordinate for the arc's landing target (pre-computed phantom slot position).
// driftDx/driftDy: directional momentum offset for phase 1 (default: straight up 60px).
// physicsV0: if provided, replaces ease-out with initial-velocity + constant-decel physics (px/ms).
function _flyTileSpiral(tEl,holdUntil,srcX,srcY,destX,destY,onDone,preCapRect,driftDx,driftDy,physicsV0,arcDur){
  var _spiralDur=arcDur||_SPIRAL_ARC_DUR; // caller can shorten the sweep
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
      var rawT=Math.min(1,(now-arcStart)/_spiralDur);
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

// Universal landing handler for tiles in 'moving' state returning to the hand.
// Places the tile at the next phantom slot (first slot to the right of current hand tiles).
// As each tile lands, movingCount decreases and HP.x grows by one — total stays constant,
// so existing hand tiles never move.
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

// =====================================================================
// PHOTOCOPIER — copies made during scoring arc from the sticker's square
// into the hand. Hand space is reserved up front in playWord
// (HP.movingCount += copy count, so the hand slides over the moment
// scoring starts); each copy's score-animation beat calls _spawnPhotocopy,
// which creates the new pool tile and flies it into a reserved slot.
// playWord awaits _photocopiesSettled() after the score animation so no
// copy is still mid-flight when the hand layout is rebuilt for the draw.
// =====================================================================
var _pcopyInFlight=0,_pcopyWaiters=[];

function _photocopiesSettled(){
  if(_pcopyInFlight<=0)return Promise.resolve();
  return new Promise(function(r){_pcopyWaiters.push(r);});
}

function _pcopyLanded(){
  _pcopyInFlight=Math.max(0,_pcopyInFlight-1);
  if(_pcopyInFlight===0){var w=_pcopyWaiters;_pcopyWaiters=[];for(var i=0;i<w.length;i++)w[i]();}
}

// copy: {sqIdx, letter, isBlank, variant, material} — pushed by the
// photocopier's onTileAdd hook onto its score event (ev.photocopy).
// The copy is a brand-new tile that joins the run (S.pool) permanently.
function _spawnPhotocopy(copy){
  var t={letter:copy.letter,isBlank:!!copy.isBlank,id:uid(),variant:copy.variant||null,material:copy.material||null,state:'stored'};
  setTileState(t,'moving',{movingFrom:'board',movingTo:'hand'});
  (S.pool=S.pool||[]).push(t);
  if(S.hand.indexOf(t)<0)S.hand.push(t);
  // HP.movingCount was already reserved for this copy in playWord — don't
  // increment again; _landTile releases the slot on landing.
  _pcopyInFlight++;
  var sqEl=document.querySelector('[data-sq-idx="'+copy.sqIdx+'"]');
  var sr=sqEl?sqEl.getBoundingClientRect():null;
  if(!sr||!sr.width){_landTile(t);_pcopyLanded();return;}
  var sz=Math.round(sr.width);
  var spr=tileSpr(t.isBlank?null:t.letter,t.isBlank,t.variant||null,sz);
  var el=document.createElement('div');
  el.className='tile tile-spr';
  el.style.cssText='position:fixed;z-index:9999;pointer-events:none;width:'+sz+'px;height:'+sz+'px;left:'+sr.left+'px;top:'+sr.top+'px;transform-origin:center center;'+spr;
  el.dataset.spr=spr;
  applyTileLayers(el,t,sz,spr);
  document.body.appendChild(el);
  hpBounds();
  var ha=document.getElementById('hand-area');var hr=ha?ha.getBoundingClientRect():null;
  var destY=hr?(hr.top+34):(window.innerHeight-60);
  var destX=HP.nextLandX();
  var _pcS=S;
  _flyTileSpiral(el,performance.now()+180,sr.left+sz/2,sr.top+sz/2,destX,destY,function(){
    if(S!==_pcS){HP.movingCount=Math.max(0,HP.movingCount-1);if(!HP.movingCount)_nextArcAt=0;_pcopyLanded();return;}
    _landTile(t);_playTileClick('land');
    _pcopyLanded();
  },sr,0,-40);
}

// =====================================================================
// GLASS RETRIEVE — committed glass tiles stay on the board, but can be
// traded back: click one and it floats up off its square while the hand
// shakes. Click a shaking hand tile to discard it (no discard charge) —
// the glass tile arcs into the hand in its place. Click anywhere else
// (or press a key) to cancel: the hand settles and the glass tile sinks
// back onto its square.
// =====================================================================
var _glassRet=null;        // {tile,sqIdx,el,sz,home:{x,y},x,y,rot,wob,t0,lastT,resolved}
var _glassSwallowUntil=0;  // swallow trailing click events after the mode resolves

function attachGlassRetrieve(face,sqIdx){
  face.style.cursor='pointer';
  face.addEventListener('click',function(ev){
    if(Date.now()-_dragEndTime<300)return;
    if(activeDrag||_glassRet||window._scoring)return;
    if(document.getElementById('live-score-row').classList.contains('scoring'))return;
    if(S.phase!=='play')return;
    var bt=S.bt[sqIdx];
    if(!bt||bt.material!=='glass'||bt.isNew)return;
    if(S.btTop&&S.btTop[sqIdx])return;
    // Jenga click-to-stack owns clicks on committed tiles while a hand tile is selected
    if(hasJenga()){for(var _si=0;_si<S.hand.length;_si++){if(S.hand[_si]&&S.hand[_si].sel)return;}}
    var anyHand=false;for(var i=0;i<S.hand.length;i++){if(S.hand[i]&&S.hand[i].state==='hand'){anyHand=true;break;}}
    if(!anyHand){toast('No hand tiles to trade for it!');return;}
    ev.stopPropagation();
    _glassRetStart(face,sqIdx,bt);
  });
}

function _glassRetStart(face,sqIdx,bt){
  _playTileClick('pick');
  var sr=face.getBoundingClientRect();
  var tsz=parseInt(face.dataset.tsz)||sr.width;
  var sprCss=face.dataset.spr||'';
  if(face.parentNode)face.parentNode.removeChild(face);
  face.className='tile tile-spr';
  face.style.cssText='position:fixed;z-index:9999;pointer-events:none;width:'+tsz+'px;height:'+tsz+'px;left:'+sr.left+'px;top:'+sr.top+'px;transform-origin:center center;'+(sprCss||'background:#f0e080;border-color:#a89000;');
  document.body.appendChild(face);
  setTileState(bt,'dragging'); // stays in S.bt[sqIdx] but renders skip it until resolved
  _glassRet={tile:bt,sqIdx:sqIdx,el:face,sz:tsz,
    home:{x:sr.left+tsz/2,y:sr.top+tsz/2},
    x:sr.left+tsz/2,y:sr.top+tsz/2,rot:0,wob:0,
    t0:performance.now(),lastT:null,resolved:false};
  var ha=document.getElementById('hand-area');if(ha)ha.classList.add('glass-sac');
  document.addEventListener('pointerdown',_glassRetPointer,true);
  document.addEventListener('click',_glassRetClickSwallow,true);
  requestAnimationFrame(_glassRetHover);
}

// Hover: lift ~46px (ease-out, 450ms) then wobble in place — same float feel
// as the recall hover in _flyTileSpiral. Tracks x/y/rot for the arc handoff.
function _glassRetHover(){
  var g=_glassRet;if(!g||g.resolved)return;
  var now=performance.now();
  var fDt=g.lastT!==null?now-g.lastT:0;g.lastT=now;
  var dt=now-g.t0;
  var e=1-Math.pow(1-Math.min(1,dt/450),2);
  var wf=Math.max(0,Math.min(1,(dt-350)/100));
  g.wob+=fDt/2700*Math.PI*2*wf;
  g.x=g.home.x;
  g.y=g.home.y-46*e-Math.sin(g.wob)*6*wf;
  g.rot=Math.sin(g.wob+0.4)*1.2*wf;
  g.el.style.left=(g.x-g.sz/2)+'px';
  g.el.style.top=(g.y-g.sz/2)+'px';
  g.el.style.transform='rotate('+g.rot.toFixed(2)+'deg)';
  requestAnimationFrame(_glassRetHover);
}

// Modal capture: hand-tile press = sacrifice, anything else = cancel.
// Swallows the gesture either way so drags/selection/board clicks can't start.
function _glassRetPointer(ev){
  var g=_glassRet;if(!g||g.resolved)return;
  ev.preventDefault();ev.stopPropagation();
  var el=ev.target,handEl=null;
  while(el&&el.classList){if(el.classList.contains('hand-tile')){handEl=el;break;}el=el.parentNode;}
  var t=null;
  if(handEl&&handEl.dataset.tileId){
    for(var i=0;i<S.hand.length;i++){var h=S.hand[i];if(h&&h.state==='hand'&&String(h.id)===handEl.dataset.tileId){t=h;break;}}
  }
  if(t)_glassRetSacrifice(t,handEl);else _glassRetCancel();
}

function _glassRetResolve(){
  _glassRet.resolved=true;
  _dragEndTime=Date.now();_glassSwallowUntil=Date.now()+400;
  document.removeEventListener('pointerdown',_glassRetPointer,true);
  var ha=document.getElementById('hand-area');if(ha)ha.classList.remove('glass-sac');
}

function _glassRetClickSwallow(ev){
  if(_glassRet||Date.now()<_glassSwallowUntil){ev.preventDefault();ev.stopPropagation();return;}
  document.removeEventListener('click',_glassRetClickSwallow,true);
}

// Discard the chosen hand tile (pop-and-fade, costs no discard charge) and
// arc the glass tile into the vacated hand.
function _glassRetSacrifice(t,handEl){
  var g=_glassRet;_glassRetResolve();
  // Hand tile: detach so renderHand closes the gap under it, then pop-fade out
  var r=handEl.getBoundingClientRect();
  if(handEl.parentNode)handEl.parentNode.removeChild(handEl);
  handEl.className='tile tile-spr';
  handEl.style.cssText='position:fixed;z-index:9998;pointer-events:none;width:'+r.width+'px;height:'+r.height+'px;left:'+r.left+'px;top:'+r.top+'px;transform-origin:center center;'+(handEl.dataset.spr||'');
  document.body.appendChild(handEl);
  setTileState(t,'stored',{storedIn:'discard'});
  S.hand=S.hand.filter(function(x){return x!==t;});
  renderHand();
  // Let the shake die down before the hand slides to make room: hold every
  // tile at its current x (fromX == toX) for a beat, then the settle expires
  // and the spring closes the gap. Must come after renderHand — hpRebuild
  // resets settle state when the tile count changes.
  HP.fromX=HP.x.slice();HP.toX=HP.x.slice();
  HP.settleAt=performance.now();HP.settleDur=350;
  (function(el){
    var t0=performance.now(),dur=200;
    function tick(now){
      var k=Math.min(1,(now-t0)/dur),sc,op;
      if(k<0.2){sc=1+k/0.2*0.3;op=1;}
      else{var s2=(k-0.2)/0.8;sc=1.3*(1-s2);op=Math.max(0,1-s2*1.5);}
      el.style.transform='scale('+sc.toFixed(3)+')';el.style.opacity=op+'';
      if(k<1){requestAnimationFrame(tick);return;}
      if(el.parentNode)el.parentNode.removeChild(el);
    }
    requestAnimationFrame(tick);
  })(handEl);
  // Glass tile: off the board, into the hand via the spiral arc
  var bt=g.tile,sqIdx=g.sqIdx;
  S.bt[sqIdx]=null;
  if(S.hand.indexOf(bt)<0)S.hand.push(bt);
  setTileState(bt,'moving',{movingFrom:'board',movingTo:'hand'});
  HP.movingCount++;
  renderBoard();
  saveGame();
  if(typeof _rankObserve==='function')_rankObserve(true);
  var ha=document.getElementById('hand-area');var hr=ha?ha.getBoundingClientRect():null;
  var destY=hr?(hr.top+34):(window.innerHeight-60);
  var destX=HP.nextLandX();
  var _retS=S;
  _flyTileSpiral(g.el,performance.now(),g.x,g.y,destX,destY,function(){
    if(S!==_retS){HP.movingCount=Math.max(0,HP.movingCount-1);if(!HP.movingCount)_nextArcAt=0;return;}
    _landTile(bt);_playTileClick('land');saveGame();
  },{left:g.x-g.sz/2,top:g.y-g.sz/2,width:g.sz,height:g.sz},0,0);
  _glassRet=null;
}

// Settle the hovering glass tile back onto its square. Safe to call anytime.
function _glassRetCancel(){
  var g=_glassRet;if(!g||g.resolved)return;
  _glassRetResolve();
  var sx=g.x,sy=g.y,srot=g.rot,t0=performance.now(),dur=220;
  function tick(now){
    var k=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-k,3);
    var x=sx+(g.home.x-sx)*e,y=sy+(g.home.y-sy)*e;
    g.el.style.left=(x-g.sz/2)+'px';
    g.el.style.top=(y-g.sz/2)+'px';
    g.el.style.transform='rotate('+(srot*(1-e)).toFixed(2)+'deg)';
    if(k<1){requestAnimationFrame(tick);return;}
    if(g.el.parentNode)g.el.parentNode.removeChild(g.el);
    setTileState(g.tile,'board',{boardSq:g.sqIdx,isNew:false});
    _glassRet=null;
    renderBoard();
    _playTileClick('land');
  }
  requestAnimationFrame(tick);
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
      applyTileLayers(flyEl,tData,68,spr);
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
}

function toggleSel(idx){if(Date.now()-_dragEndTime<300)return;if(S.hand[idx]){if(!S.hand[idx].sel&&window.TUT&&TUT.active&&!_tutSelTileOK())return;S.hand[idx].sel=!S.hand[idx].sel;_playTileClick('select');renderHand();}}

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
