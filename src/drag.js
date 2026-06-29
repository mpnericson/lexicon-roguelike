// =====================================================================
// DRAG — tile and sticker drag-and-drop engine
// =====================================================================
function makeDragClone(innerHTML,css,extraClass){
  var el=document.createElement('div');el.className='tile'+(extraClass?' '+extraClass:'');
  el.style.cssText='position:fixed;z-index:9999;pointer-events:none;'+css;
  el.innerHTML=innerHTML;document.body.appendChild(el);return el;
}

function clearHL(){if(_hl>=0){var e=document.querySelector('[data-sq-idx="'+_hl+'"]');if(e)e.classList.remove('drop-target');}_hl=-1;}
function hasJenga(){for(var _ji=0;_ji<S.tileStickers.length;_ji++)if(S.tileStickers[_ji].id==='jenga')return true;return false;}
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

function inHand(x,y){var r=document.getElementById('hand-area').getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top-20&&y<=r.bottom+20;}

function attachHandTileDrag(face,oi,vi,tile,vis){
  face.dataset.handOi=String(oi);
  face.addEventListener('pointerdown',function(ev){
    ev.preventDefault();ev.stopPropagation();
    if(activeDrag)return;
    if(document.getElementById('live-score-row').classList.contains('scoring'))return;
    _playTileClick('pick');
    var sx=ev.clientX,sy=ev.clientY;var sr=face.getBoundingClientRect();
    var moved=false,clone=null;HP.held=vi;
    if(HP.settleDur>=9999){HP.settleAt=0;HP.settleCallback=null;HP.settleDur=150;}
    function move(me){
      var dx=me.clientX-sx,dy=me.clientY-sy;
      if(!moved&&Math.sqrt(dx*dx+dy*dy)>8){
        moved=true;HP.held=-1;
        var sprCss=face.dataset.spr||'';
        clone=makeDragClone(face.innerHTML,'width:68px;height:68px;left:'+sr.left+'px;top:'+sr.top+'px;box-shadow:0 12px 28px rgba(0,0,0,.7);transform:scale(1.12);'+(sprCss||'background:#f0e080;border-color:#a89000;')+'transition:transform 0.1s ease,box-shadow 0.1s ease;',sprCss?'tile-spr':'');
        activeDrag={src:'hand',oi:oi,vi:vi,clone:clone,sx:sx,sy:sy,sr:sr,cx:sr.left+34};renderHand();
      }
      if(moved&&clone){
        var dx2=me.clientX-sx,dy2=me.clientY-sy;
        clone.style.left=(sr.left+dx2)+'px';clone.style.top=(sr.top+dy2)+'px';
        activeDrag.cx=sr.left+34+dx2;activeDrag.cy=sr.top+34+dy2;
        var sq=sqAt(me.clientX,me.clientY);
        if(sq>=0&&(!S.bt[sq]||_jengaCanStack(sq))){setHL(sq);clone.style.transform='scale(0.75)';clone.style.boxShadow='0 4px 12px rgba(0,0,0,.5)';}
        else{clearHL();clone.style.transform='scale(1.08)';clone.style.boxShadow='0 12px 28px rgba(0,0,0,.7)';}
      }
    }
    function up(me){
      document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);
      HP.held=-1;
      if(!moved){
        if(vi>0)HP.vx[vi-1]-=3;
        if(vi<HP.tiles.length-1)HP.vx[vi+1]+=3;
        toggleSel(oi);
        return;
      }
      _dragEndTime=Date.now();
      if(!clone)return;clearHL();
      var sq=sqAt(me.clientX,me.clientY);var ih=inHand(me.clientX,me.clientY);
      if(sq>=0&&(!S.bt[sq]||_jengaCanStack(sq))){
        activeDrag.cx=-9999;
        var sqEl=document.querySelector('[data-sq-idx="'+sq+'"]');var tr=sqEl?sqEl.getBoundingClientRect():null;
        if(tr){clone.style.transition='left .13s,top .13s,transform .13s';clone.style.left=(tr.left+tr.width/2-28)+'px';clone.style.top=(tr.top+tr.height/2-32)+'px';clone.style.transform='scale(0.85)';}
        if(tile.isBlank&&!tile.blankAs){
          setTimeout(function(){if(clone.parentNode)clone.parentNode.removeChild(clone);activeDrag=null;
            openBlankChooser(oi,function(){placeTile(oi,sq);renderBoard();renderHand();});
          },140);
        } else {
          setTimeout(function(){if(clone.parentNode)clone.parentNode.removeChild(clone);placeTile(oi,sq);activeDrag=null;renderBoard();renderHand();},140);
        }
      } else if(ih){
        var ins=computeInsert(me.clientX,vi);var dropX=me.clientX;
        setTimeout(function(){if(clone.parentNode)clone.parentNode.removeChild(clone);reorderHand(oi,ins,vis,dropX);activeDrag=null;renderHand();},120);
      } else {
        activeDrag.cx=-9999;
        clone.style.transition='left .14s,top .14s,transform .14s';clone.style.left=sr.left+'px';clone.style.top=sr.top+'px';clone.style.transform='scale(1)';
        setTimeout(function(){if(clone.parentNode)clone.parentNode.removeChild(clone);activeDrag=null;renderHand();},140);
      }
    }
    document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);
  });
}

function computeInsert(mouseX,dragVi){
  var n=HP.tiles.length;
  for(var i=0;i<n;i++){if(i===dragVi)continue;if(mouseX<HP.x[i])return i;}return n;
}

function reorderHand(fromOi,insertAt,vis,dropX){
  hpBounds();
  var oldX={};
  for(var k=0;k<vis.length;k++)oldX[vis[k].t.id]=HP.x[k]||0;
  var fv=-1;for(var k=0;k<vis.length;k++)if(vis[k].oi===fromOi){fv=k;break;}
  if(fv<0)return;
  oldX[vis[fv].t.id]=dropX!==undefined?dropX:((HP.aL+HP.aR)/2);
  var rem=vis.splice(fv,1)[0];
  var adj=insertAt>fv?insertAt-1:insertAt;adj=Math.max(0,Math.min(vis.length,adj));vis.splice(adj,0,rem);
  var ob=[];for(var k=0;k<S.hand.length;k++)if(S.hand[k]&&S.hand[k].onBoard)ob.push(S.hand[k]);
  var nh=vis.map(function(e){return e.t;});for(var k=0;k<ob.length;k++)nh.push(ob[k]);
  for(var bi=0;bi<B*B;bi++){if(S.bt[bi]&&S.bt[bi].handIdx!==undefined){for(var k=0;k<nh.length;k++){if(nh[k]&&nh[k].onBoard&&nh[k]._boardSq===bi){S.bt[bi].handIdx=k;break;}}}}
  if(S.btTop){for(var bi=0;bi<B*B;bi++){if(S.btTop[bi]&&S.btTop[bi].handIdx!==undefined){for(var k=0;k<nh.length;k++){if(nh[k]&&nh[k].onBoard&&nh[k]._boardSq===bi){S.btTop[bi].handIdx=k;break;}}}}}
  HP.fromX=vis.map(function(e){return oldX[e.t.id]!==undefined?oldX[e.t.id]:((HP.aL+HP.aR)/2);});
  HP.toX=hpRest(vis.length);
  HP.settleDur=150;HP.settleAt=performance.now();
  HP.x=HP.fromX.slice();HP.vx=Array(vis.length).fill(0);S.hand=nh;
}

function attachBoardTileDrag(face,sqIdx,sz,isTop){
  face.addEventListener('pointerdown',function(ev){
    ev.preventDefault();ev.stopPropagation();if(activeDrag)return;
    if(document.getElementById('live-score-row').classList.contains('scoring'))return;
    var sr=face.getBoundingClientRect();var sx=ev.clientX,sy=ev.clientY;var moved=false,clone=null;
    function _getBtRef(){return isTop?(S.btTop&&S.btTop[sqIdx]):S.bt[sqIdx];}
    function move(me){
      var dx=me.clientX-sx,dy=me.clientY-sy;
      if(!moved&&Math.sqrt(dx*dx+dy*dy)>5){
        moved=true;_playTileClick('pick');
        var sprCss=face.dataset.spr||'';var tsz=parseInt(face.dataset.tsz)||sz;
        clone=makeDragClone(face.innerHTML,'width:'+tsz+'px;height:'+tsz+'px;left:'+sr.left+'px;top:'+sr.top+'px;box-shadow:0 8px 20px rgba(0,0,0,.6);transform:scale(1.2);'+(sprCss||'background:#f0e080;border-color:#a89000;'),sprCss?'tile-spr':'');
        var btRef=_getBtRef();if(btRef)btRef.flying=true;
        activeDrag={src:'board',sqIdx:sqIdx,isTop:!!isTop,clone:clone,sr:sr};renderBoard();
      }
      if(moved&&clone){
        clone.style.left=(sr.left+(me.clientX-sx))+'px';clone.style.top=(sr.top+(me.clientY-sy))+'px';
        var over=sqAt(me.clientX,me.clientY);if(over>=0&&over!==sqIdx&&!S.bt[over])setHL(over);else clearHL();
      }
    }
    function up(me){
      document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);
      if(!moved){recallTile(sqIdx);return;}
      _dragEndTime=Date.now();
      if(!clone)return;clearHL();
      var btRef=_getBtRef();if(btRef)btRef.flying=false;
      var over=sqAt(me.clientX,me.clientY);var ih=inHand(me.clientX,me.clientY);
      if(ih){
        var _nBf=S.hand.filter(function(t){return t&&!t.onBoard;}).length;
        var _dBt=_getBtRef();var _dT=_dBt?_btFindTile(_dBt):null;
        if(_dT){_dT.onBoard=false;_dT._boardSq=undefined;if(_dT.isBlank)_dT.blankAs=null;_moveToEndOfHand(_dT);}
        if(isTop){if(S.btTop)S.btTop[sqIdx]=null;}else{S.bt[sqIdx]=null;}
        activeDrag=null;renderBoard();
        if(_nBf>0&&HP.x.length===_nBf){HP.fromX=HP.x.slice();HP.toX=hpRest(_nBf+1).slice(0,_nBf);HP.settleDur=280;HP.settleAt=performance.now();}
        var _lp=_handLandingParams(_nBf,_nBf+1,0);
        var _cR=clone.getBoundingClientRect();var _cSz=parseInt(clone.style.width)||sz;
        var _cCx=_cR.left+_cSz/2,_cCy=_cR.top+_cSz/2,_cEs=68/_cSz,_cFS=performance.now();
        clone.style.transition='';clone.style.transformOrigin='center center';
        (function(_c,_cs,_cx,_cy,_es){
          function _ft(now){
            var t=Math.min(1,(now-_cFS)/320);var e=1-Math.pow(1-t,3),u=1-e;
            var cx=u*u*_cx+2*u*e*_lp.cpX+e*e*_lp.destX;
            var cy=u*u*_cy+2*u*e*_lp.cpY+e*e*_lp.destY;
            _c.style.left=(cx-_cs/2)+'px';_c.style.top=(cy-_cs/2)+'px';
            _c.style.transform='scale('+(1+(_es-1)*e)+')';
            if(t<1){requestAnimationFrame(_ft);return;}
            if(_c.parentNode)_c.parentNode.removeChild(_c);_playTileClick('land');renderHand();
          }
          requestAnimationFrame(_ft);
        })(clone,_cSz,_cCx,_cCy,_cEs);
      } else if(over>=0&&over!==sqIdx&&!S.bt[over]){
        var sqEl=document.querySelector('[data-sq-idx="'+over+'"]');var tr=sqEl?sqEl.getBoundingClientRect():null;
        if(tr){clone.style.transition='left .13s,top .13s,transform .13s';clone.style.left=(tr.left+tr.width/2-(sz/2))+'px';clone.style.top=(tr.top+tr.height/2-(sz/2))+'px';clone.style.transform='scale(0.9)';}
        setTimeout(function(){
          if(clone.parentNode)clone.parentNode.removeChild(clone);
          var src=_getBtRef();
          if(src){
            S.bt[over]={letter:src.letter,isNew:src.isNew,isBlank:src.isBlank,handIdx:src.handIdx,tileId:src.tileId,variant:src.variant||null,blueBonus:src.blueBonus||0};
            if(src.handIdx!==undefined&&S.hand[src.handIdx])S.hand[src.handIdx]._boardSq=over;
            if(isTop){if(S.btTop)S.btTop[sqIdx]=null;}else{S.bt[sqIdx]=null;}
          }
          activeDrag=null;renderBoard();renderHand();
        },140);
      } else {
        clone.style.transition='left .14s,top .14s,transform .14s';clone.style.left=sr.left+'px';clone.style.top=sr.top+'px';clone.style.transform='scale(1)';
        setTimeout(function(){if(clone.parentNode)clone.parentNode.removeChild(clone);activeDrag=null;renderBoard();},140);
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

function placeTile(handIdx,sqIdx){
  var t=S.hand[handIdx];t.onBoard=true;t._boardSq=sqIdx;
  var td={letter:t.isBlank?(t.blankAs||'?'):t.letter,isNew:true,isBlank:t.isBlank,handIdx:handIdx,tileId:t.id,variant:t.variant||null,blueBonus:t.blueBonus||0,alchSc:t._alchSc||0};
  if(S.bt[sqIdx]&&!S.bt[sqIdx].isNew&&!(S.btTop&&S.btTop[sqIdx])){
    if(!S.btTop)S.btTop=Array(B*B).fill(null);
    S.btTop[sqIdx]=td;
  } else {
    S.bt[sqIdx]=td;
  }
  _playTileClick('place');
}

function _btFindTile(bt){
  var t=S.hand[bt.handIdx];
  if(!t&&bt.tileId){for(var _i=0;_i<S.hand.length;_i++){if(S.hand[_i]&&S.hand[_i].id===bt.tileId){t=S.hand[_i];break;}}}
  return t||null;
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

// Advancing timestamp for sequential one-by-one slotting during sweep recall.
var _nextSweepPhase3At=0;

// Two-phase wind animation:
// Phase 1 — Float (650ms): tile drifts in push/swipe direction with ease-out deceleration
//   and a gentle sinusoidal wobble (idle floating feel). The ice momentum carries it.
// Phase 2 — Arc (800ms): pure exponential ease-in (bezT near-zero at start → intense rush).
//   The wind starts imperceptibly and builds, whipping the tile around a wide arc that swings
//   off-screen right then fires horizontally left into the hotbar.
// holdUntil: minimum timestamp for arc phase start (used for sequential stagger).
// pauseX/Y: push direction indicator only (swipe direction or 50px lift for taps).
var _FLY_FLOAT_DUR=650;
function _flyTileIce(tEl,holdUntil,pauseX,pauseY,destX,destY,onDone,preCapRect,elevPx,sqRect){
  if(!tEl){if(onDone)onDone();return;}
  var sr=preCapRect||tEl.getBoundingClientRect();
  if(tEl.parentNode)tEl.parentNode.removeChild(tEl);
  var boardSz=sr.width,endScale=68/boardSz;
  var sprCss=tEl.dataset.spr||'';
  tEl.className='tile tile-spr';
  var _elev=elevPx||0;
  tEl.style.cssText='position:fixed;z-index:9999;pointer-events:none;width:'+boardSz+'px;height:'+boardSz+'px;left:'+sr.left+'px;top:'+(sr.top-_elev)+'px;transform:scale(1);transform-origin:center center;'+(sprCss||'background:#f0e080;border-color:#a89000;');
  document.body.appendChild(tEl);
  var scx=sr.left+boardSz/2,scy=sr.top+boardSz/2;
  var inDx=pauseX-scx,inDy=pauseY-scy;
  var inLen=Math.sqrt(inDx*inDx+inDy*inDy)||1;
  var fDx=inDx/inLen,fDy=inDy/inLen;
  var perpX=-fDy,perpY=fDx; // perpendicular for sideways wobble
  var floatDist=Math.max(35,Math.min(70,inLen*0.55));
  var wobbleAmp=6,rotAmp=5;
  // Elevation fall state — tracked in top offset, cleared once tile leaves sqRect
  var curElev=_elev,fallDone=(_elev===0),fallTrig=false,fallStart=0,fallFrom=_elev;
  var _ELEV_FALL_DUR=80;
  var floatStart=performance.now();
  // Phase 1: float — ease-out drift with sinusoidal wobble and gentle rocking
  function floatTick(now){
    var t=Math.min(1,(now-floatStart)/_FLY_FLOAT_DUR);
    var e=1-Math.pow(1-t,2); // ease-out quad
    var osc=Math.sin(t*Math.PI*2.5)*(1-t); // oscillation that fades to 0 at t=1
    var fx=scx+fDx*floatDist*e+perpX*wobbleAmp*osc;
    var fy=scy+fDy*floatDist*e+perpY*wobbleAmp*osc;
    // Detect when tile fully leaves the source square, then drop elevation
    if(!fallDone){
      if(!fallTrig&&sqRect){
        var tl=fx-boardSz/2,tt=fy-boardSz/2;
        var off=(tl+boardSz<=sqRect.left)||(tl>=sqRect.right)||(tt+boardSz<=sqRect.top)||(tt>=sqRect.bottom);
        if(off||t>=0.85){fallTrig=true;fallStart=now;fallFrom=curElev;}
      }
      if(fallTrig){
        var ft=Math.min(1,(now-fallStart)/_ELEV_FALL_DUR);
        curElev=fallFrom*(1-ft*ft*(3-2*ft));
        if(ft>=1)fallDone=true;
      }
    }
    tEl.style.left=(fx-boardSz/2)+'px';
    tEl.style.top=(fy-boardSz/2-curElev)+'px';
    tEl.style.transform='rotate('+(rotAmp*osc)+'deg)';
    if(t<1){requestAnimationFrame(floatTick);return;}
    // Float done — hold at endpoint until holdUntil, then launch arc
    var fex=scx+fDx*floatDist,fey=scy+fDy*floatDist;
    tEl.style.left=(fex-boardSz/2)+'px';tEl.style.top=(fey-boardSz/2)+'px';
    tEl.style.transform='rotate(0deg)';
    function waitTick(now2){
      if(now2<holdUntil){requestAnimationFrame(waitTick);return;}
      // Phase 2: arc — CP1 continues float direction, CP2 off-screen right at hotbar height
      var tangentLen=Math.max(120,Math.min(300,inLen*1.2));
      var cp1X=fex+fDx*tangentLen,cp1Y=fey+fDy*tangentLen;
      var cp2X=window.innerWidth*1.1,cp2Y=destY;
      var arcDur=800;var expK=5;var expDenom=Math.exp(expK)-1;
      var arcStart=performance.now();
      function arcTick(now3){
        var rawT=Math.min(1,(now3-arcStart)/arcDur);
        // Pure exponential: near-zero start (barely felt) → intense rush (wind fully in control)
        var bezT=(Math.exp(expK*rawT)-1)/expDenom;
        var u=1-bezT;
        tEl.style.left=(u*u*u*fex+3*u*u*bezT*cp1X+3*u*bezT*bezT*cp2X+bezT*bezT*bezT*destX-boardSz/2)+'px';
        tEl.style.top=(u*u*u*fey+3*u*u*bezT*cp1Y+3*u*bezT*bezT*cp2Y+bezT*bezT*bezT*destY-boardSz/2)+'px';
        var scaleT=Math.max(0,Math.min(1,(bezT-0.6)/0.4));
        tEl.style.transform='scale('+(1+(endScale-1)*scaleT*scaleT)+')';
        if(rawT<1){requestAnimationFrame(arcTick);return;}
        if(tEl.parentNode)tEl.parentNode.removeChild(tEl);
        if(onDone)onDone();
      }
      requestAnimationFrame(arcTick);
    }
    requestAnimationFrame(waitTick);
  }
  requestAnimationFrame(floatTick);
}

function recallTile(sqIdx){
  _playTileClick('pick');
  // Jenga: recall top stacked tile first
  if(S.btTop&&S.btTop[sqIdx]&&S.btTop[sqIdx].isNew){
    var btt=S.btTop[sqIdx];
    var sqEl0=document.querySelector('[data-sq-idx="'+sqIdx+'"]');
    var tEl0=sqEl0?sqEl0.querySelector('.board-tile.is-new'):null;
    var savedSr0=tEl0?tEl0.getBoundingClientRect():null;
    if(tEl0&&tEl0.parentNode)tEl0.parentNode.removeChild(tEl0);
    var nBefore0=S.hand.filter(function(t){return t&&!t.onBoard;}).length;
    var t0=_btFindTile(btt);if(t0){t0.onBoard=false;t0._boardSq=undefined;if(t0.isBlank)t0.blankAs=null;_moveToEndOfHand(t0);}
    if(t0)t0.inFlight=true;
    S.btTop[sqIdx]=null;
    renderBoard();
    if(!tEl0||!savedSr0||savedSr0.width===0){if(t0)t0.inFlight=false;renderHand();return;}
    var p0=_handLandingParams(nBefore0,nBefore0+1,0);
    if(nBefore0>0&&HP.x.length===nBefore0){HP.fromX=HP.x.slice();HP.toX=hpRest(nBefore0+1).slice(0,nBefore0);HP.settleDur=380;HP.settleAt=performance.now();HP.settleCallback=function(){HP.fromX=HP.x.slice();HP.toX=HP.x.slice();HP.settleDur=9999;HP.settleAt=performance.now();HP.settleCallback=null;};}
    var _c0x=savedSr0.left+savedSr0.width/2,_c0y=savedSr0.top+savedSr0.height/2;
    _flyTileIce(tEl0,performance.now()+_FLY_FLOAT_DUR,_c0x,_c0y-50,p0.destX,p0.destY,function(){if(t0)t0.inFlight=false;_playTileClick('land');renderHand();},savedSr0);
    return;
  }
  var bt=S.bt[sqIdx];if(!bt||!bt.isNew)return;
  var sqEl=document.querySelector('[data-sq-idx="'+sqIdx+'"]');
  var tEl=sqEl?sqEl.querySelector('.board-tile'):null;
  // Capture rect and detach BEFORE renderBoard destroys the element.
  var savedSr=tEl?tEl.getBoundingClientRect():null;
  if(tEl&&tEl.parentNode)tEl.parentNode.removeChild(tEl);
  var nBefore=S.hand.filter(function(t){return t&&!t.onBoard;}).length;
  var t=_btFindTile(bt);if(t){t.onBoard=false;t._boardSq=undefined;if(t.isBlank)t.blankAs=null;_moveToEndOfHand(t);}
  if(t)t.inFlight=true;
  S.bt[sqIdx]=null;
  renderBoard();
  if(!tEl||!savedSr||savedSr.width===0){if(t)t.inFlight=false;renderHand();return;}
  var p=_handLandingParams(nBefore,nBefore+1,0);
  if(nBefore>0&&HP.x.length===nBefore){
    HP.fromX=HP.x.slice();HP.toX=hpRest(nBefore+1).slice(0,nBefore);
    HP.settleDur=380;HP.settleAt=performance.now();
    // Hold existing tiles at settled positions until the flying tile lands (prevents spring snap-back).
    HP.settleCallback=function(){
      HP.fromX=HP.x.slice();HP.toX=HP.x.slice();
      HP.settleDur=9999;HP.settleAt=performance.now();
      HP.settleCallback=null;
    };
  }
  var _pCx=savedSr.left+savedSr.width/2,_pCy=savedSr.top+savedSr.height/2;
  _flyTileIce(tEl,performance.now()+_FLY_FLOAT_DUR,_pCx,_pCy-50,p.destX,p.destY,function(){if(t)t.inFlight=false;_playTileClick('land');renderHand();},savedSr);
}

// Counts tiles currently flying from a shift-drag sweep; _onUp defers renderHand until this hits 0.
var _sweepFlyCount=0;

function _recallTileSweep(sqIdx,swipeVx,swipeVy){
  _playTileClick('pick');
  var _JENGA_ELEV=6; // elevation per stack level, matches CSS jenga-stacked translateY
  var useTop=!!(S.btTop&&S.btTop[sqIdx]&&S.btTop[sqIdx].isNew);
  // Elevation of this btTop: one level above the committed tile below
  var _btopElev=useTop?((S.bt[sqIdx]&&S.bt[sqIdx]._stackLevel||0)+1)*_JENGA_ELEV:0;
  var bt=useTop?S.btTop[sqIdx]:S.bt[sqIdx];if(!bt||!bt.isNew)return;
  var t=_btFindTile(bt);if(t){t.onBoard=false;t._boardSq=undefined;if(t.isBlank)t.blankAs=null;_moveToEndOfHand(t);}
  if(t)t.inFlight=true;
  if(useTop){S.btTop[sqIdx]=null;}else{S.bt[sqIdx]=null;}
  var sqEl=document.querySelector('[data-sq-idx="'+sqIdx+'"]');
  if(!sqEl)return;
  // Capture square rect for fall detection before DOM changes
  var _sqRectFall=useTop?sqEl.getBoundingClientRect():null;
  var tEl=sqEl.querySelector('.board-tile.is-new');
  if(!tEl)return;
  // Capture rect before tEl is detached by _flyTileIce
  var savedSr=tEl.getBoundingClientRect();
  // effectiveSr: base-level position (strip elevation offset)
  var effectiveSr=_btopElev>0?{left:savedSr.left,top:savedSr.top+_btopElev,width:savedSr.width,height:savedSr.height}:savedSr;
  var nCur=S.hand.filter(function(t2){return t2&&!t2.onBoard;}).length;
  var p=_handLandingParams(nCur-1,nCur,0);
  // Slide existing hand tiles LEFT immediately to make room, re-targeting on each additional sweep.
  var nHand=HP.x.length;
  if(nHand>0){
    HP.fromX=HP.x.slice();
    HP.toX=hpRest(nCur).slice(0,nHand);
    HP.settleDur=380;HP.settleAt=performance.now();
    // Hold until all swept tiles land — prevents spring pulling tiles back between sweep events.
    HP.settleCallback=function(){
      HP.fromX=HP.x.slice();HP.toX=HP.x.slice();
      HP.settleDur=9999;HP.settleAt=performance.now();
      HP.settleCallback=null;
    };
  }
  // Pause point from base position
  var tileCx=effectiveSr.left+effectiveSr.width/2,tileCy=effectiveSr.top+effectiveSr.height/2;
  var speed=Math.sqrt((swipeVx||0)*(swipeVx||0)+(swipeVy||0)*(swipeVy||0));
  var dist=Math.max(50,Math.min(180,speed*8));
  var dlen=speed>0.1?speed:1;
  var pauseX=tileCx+(swipeVx||0)/dlen*dist;
  var pauseY=tileCy+(swipeVy||0)/dlen*dist;
  // Queue phase 3 starts sequentially so tiles slot in one-by-one.
  var earliest=performance.now()+_FLY_FLOAT_DUR;
  if(_nextSweepPhase3At===0)_nextSweepPhase3At=earliest;
  var holdUntil=Math.max(earliest,_nextSweepPhase3At);
  _nextSweepPhase3At=holdUntil+300;
  _sweepFlyCount++;
  _flyTileIce(tEl,holdUntil,pauseX,pauseY,p.destX,p.destY,function(){
    _sweepFlyCount--;
    if(t)t.inFlight=false;
    _playTileClick('land');renderHand();
    if(_sweepFlyCount===0)_nextSweepPhase3At=0;
    else{HP.fromX=HP.x.slice();HP.toX=HP.x.slice();HP.settleDur=9999;HP.settleAt=performance.now();}
  },effectiveSr,_btopElev,_sqRectFall);
}

function recallAll(){
  if(S.btTop){for(var i=0;i<B*B;i++){if(S.btTop[i]&&S.btTop[i].isNew){var t2=_btFindTile(S.btTop[i]);if(t2){t2.onBoard=false;t2._boardSq=undefined;}S.btTop[i]=null;}}}
  for(var i=0;i<B*B;i++){var bt=S.bt[i];if(bt&&bt.isNew){var t=_btFindTile(bt);if(t){t.onBoard=false;t._boardSq=undefined;}S.bt[i]=null;}}
  // Safety: clear any hand tile whose board square is no longer occupied by a new tile
  for(var _hi=0;_hi<S.hand.length;_hi++){var _ht=S.hand[_hi];if(_ht&&_ht.onBoard){var _sq=_ht._boardSq;var _hasNew=_sq!==undefined&&((S.bt[_sq]&&S.bt[_sq].isNew)||(S.btTop&&S.btTop[_sq]&&S.btTop[_sq].isNew));if(!_hasNew){_ht.onBoard=false;_ht._boardSq=undefined;}}}
}

// Animated recallAll: existing tiles slide left, recalled tiles arc in from the right in staggered order.
function _recallAllAnimated(){
  var nBefore=S.hand.filter(function(t){return t&&!t.onBoard;}).length;
  var tEls=[],tRects=[],tRefs=[];
  // Handle Jenga btTop tiles first
  if(S.btTop){
    for(var i=0;i<B*B;i++){
      if(S.btTop[i]&&S.btTop[i].isNew){
        var sqEl2=document.querySelector('[data-sq-idx="'+i+'"]');
        var tEl2=sqEl2?sqEl2.querySelector('.board-tile.is-new'):null;
        var t2=_btFindTile(S.btTop[i]);if(t2){t2.onBoard=false;t2._boardSq=undefined;_moveToEndOfHand(t2);}
        if(tEl2){tRects.push(tEl2.getBoundingClientRect());if(tEl2.parentNode)tEl2.parentNode.removeChild(tEl2);tEls.push(tEl2);if(t2)t2.inFlight=true;tRefs.push(t2||null);}
        S.btTop[i]=null;
      }
    }
  }
  for(var i=0;i<B*B;i++){
    var bt=S.bt[i];
    if(bt&&bt.isNew){
      var sqEl=document.querySelector('[data-sq-idx="'+i+'"]');
      var tEl=sqEl?sqEl.querySelector('.board-tile'):null;
      var t=_btFindTile(bt);if(t){t.onBoard=false;t._boardSq=undefined;_moveToEndOfHand(t);}
      if(tEl){
        // Capture rect and detach BEFORE renderBoard destroys elements.
        tRects.push(tEl.getBoundingClientRect());
        if(tEl.parentNode)tEl.parentNode.removeChild(tEl);
        tEls.push(tEl);
        if(t)t.inFlight=true;
        tRefs.push(t||null);
      }
      S.bt[i]=null;
    }
  }
  renderBoard();
  var nNew=tEls.length;
  if(nNew===0){renderHand();return;}
  var nAfter=nBefore+nNew;
  // Slide existing tiles left; hold position via settleCallback until last tile arrives
  if(nBefore>0&&HP.x.length===nBefore){
    HP.fromX=HP.x.slice();HP.toX=hpRest(nAfter).slice(0,nBefore);
    HP.settleDur=380;HP.settleAt=performance.now();
    // Hold existing tiles in place until all recalled tiles have landed.
    HP.settleCallback=function(){
      HP.fromX=HP.x.slice();HP.toX=HP.x.slice();
      HP.settleDur=9999;HP.settleAt=performance.now();
      HP.settleCallback=null;
    };
  }
  // All tiles decelerate to the same pause point simultaneously, then slot in one-by-one.
  // Pre-set HP.x to nAfter positions so renderHand after each landing doesn't snap positions.
  var _now=performance.now();
  var phase3Base=_now+_FLY_FLOAT_DUR; // tile 0 arc starts after its float
  var p3Stagger=300;                  // 300ms between consecutive arc starts
  var doneCount=0;
  for(var j=0;j<nNew;j++){
    (function(el,sr,idx,tRef){
      var p=_handLandingParams(nBefore,nAfter,idx);
      var _kx=sr.left+sr.width/2,_ky=sr.top+sr.height/2-50;
      _flyTileIce(el,phase3Base+idx*p3Stagger,_kx,_ky,p.destX,p.destY,function(){
        doneCount++;
        if(tRef)tRef.inFlight=false;
        hpBounds();
        var tr=hpRest(nAfter);
        HP.x=tr.slice(0,nBefore+doneCount);
        HP.vx=Array(nBefore+doneCount).fill(0);
        HP.fromX=[];HP.toX=[];HP.settleAt=0;HP.settleCallback=null;
        renderHand();
        if(doneCount<nNew){HP.fromX=HP.x.slice();HP.toX=HP.x.slice();HP.settleDur=9999;HP.settleAt=performance.now();}
      },sr);
    })(tEls[j],tRects[j],j,tRefs[j]);
  }
}

// Creates full-size hand tiles at the bag position and flies them to their slots.
// No hidden originals — the flying element IS the tile while in transit.
// nKept: tiles already in hand. nTotal: expected hand size after draw. bagEl: the bag button element.
// onDone: called after last tile lands and renderHand() has run.
function _burstNewTilesFromBag(nKept,nTotal,bagEl,onDone){
  var afterVis=[];
  for(var _k=0;_k<S.hand.length;_k++)if(S.hand[_k]&&!S.hand[_k].onBoard)afterVis.push(S.hand[_k]);
  var nNew=afterVis.length-nKept;
  // Extend HP to nTotal so spring physics uses correct rest positions during flight.
  HP.tiles=afterVis.slice();
  hpBounds();var fullRest=hpRest(nTotal);
  while(HP.x.length<nTotal){HP.x.push(fullRest[HP.x.length]);HP.vx.push(0);}
  if(nNew<=0){renderHand();if(onDone)onDone();return;}
  var bagR=bagEl.getBoundingClientRect();
  var bx=bagR.left+bagR.width/2,by=bagR.top+bagR.height/2;
  bagEl.classList.add('bag-vacuuming');
  var done=0;var allFlyEls=[];
  for(var _j=0;_j<nNew;_j++){
    (function(tData,idx){
      var p=_handLandingParams(nKept,nTotal,idx);
      var spr=(tData.isBlank&&tData.blankAs)?blankTileSpr(tData.blankAs,tData.variant||null,68):tileSpr(tData.isBlank?null:tData.letter,tData.isBlank,tData.variant||null,68);
      var badge=tData.variant==='gold'?'<span class="vbadge vbadge-gold">$</span>':tData.variant==='blue'?'<span class="vbadge vbadge-blue">+'+(LS[tData.letter]||0)+'</span>':tData.variant==='red'?'<span class="vbadge vbadge-red">×2</span>':'';
      var flyEl=document.createElement('div');
      flyEl.className='tile hand-tile tile-spr';
      flyEl.style.cssText='position:fixed;z-index:9999;pointer-events:none;width:68px;height:68px;left:'+(bx-34)+'px;top:'+(by-34)+'px;'+spr;
      flyEl.innerHTML=badge;
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

// Moves tile t to the rightmost slot of S.hand so renderHand places it on the right.
// Updates handIdx on any remaining board tiles displaced by the move.
function _moveToEndOfHand(t){
  var oldIdx=S.hand.indexOf(t);
  if(oldIdx<0||oldIdx===S.hand.length-1)return;
  S.hand.splice(oldIdx,1);S.hand.push(t);
  for(var _bi=0;_bi<B*B;_bi++){
    if(S.bt[_bi]&&S.bt[_bi].handIdx!==undefined&&S.bt[_bi].handIdx>oldIdx)
      S.bt[_bi].handIdx--;
    if(S.btTop&&S.btTop[_bi]&&S.btTop[_bi].handIdx!==undefined&&S.btTop[_bi].handIdx>oldIdx)
      S.btTop[_bi].handIdx--;
  }
}

function clearBoardLetters(){
  S.bt=Array(B*B).fill(null);
  if(S.btTop)S.btTop=Array(B*B).fill(null);
  for(var i=0;i<S.hand.length;i++){if(S.hand[i]&&S.hand[i].onBoard){S.hand[i].onBoard=false;S.hand[i]._boardSq=undefined;}}
  if(S.localCooldowns)S.localCooldowns.clear();
}

function toggleSel(idx){if(Date.now()-_dragEndTime<300)return;if(S.hand[idx]&&!S.hand[idx].onBoard){S.hand[idx].sel=!S.hand[idx].sel;_playTileClick('select');renderHand();}}

// Global shift-drag: capture phase intercepts before any tile handler fires.
// Shift+drag over hand tiles toggles selection; shift+drag over board recalls new tiles.
// Works even when cursor starts on empty space.
document.addEventListener('pointerdown',function(ev){
  if(!ev.shiftKey||ev.button!==0)return;
  if(typeof S==='undefined'||S.phase!=='play')return;
  if(activeDrag)return;
  if(document.getElementById('live-score-row').classList.contains('scoring'))return;
  var _t=ev.target;while(_t&&_t!==document){var _tn=_t.tagName;if(_tn==='BUTTON'||_tn==='INPUT'||_tn==='SELECT'||_tn==='A'||_tn==='TEXTAREA'){return;}_t=_t.parentElement;}
  ev.preventDefault();ev.stopPropagation();
  var _sx=ev.clientX,_sy=ev.clientY;
  var _swept=false,_selMode=null,_prevX=_sx,_prevY=_sy;
  var _toggled=new Set(),_lastHandTile=-1;
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
        if(!isNaN(_hoi)&&S.hand[_hoi]&&!S.hand[_hoi].onBoard&&_hoi!==_lastHandTile){
          _lastHandTile=_hoi;
          if(_toggled.has(_hoi)){
            S.hand[_hoi].sel=!S.hand[_hoi].sel;
            if(S.hand[_hoi].sel)els[_i].classList.add('selected');else els[_i].classList.remove('selected');
            _playTileClick('select');_toggled.delete(_hoi);
          }else{
            if(_selMode===null)_selMode=S.hand[_hoi].sel?'deselect':'select';
            if(_selMode==='select'&&!S.hand[_hoi].sel){S.hand[_hoi].sel=true;els[_i].classList.add('selected');_playTileClick('select');_toggled.add(_hoi);}
            else if(_selMode==='deselect'&&S.hand[_hoi].sel){S.hand[_hoi].sel=false;els[_i].classList.remove('selected');_playTileClick('select');_toggled.add(_hoi);}
          }
        }
        break;
      }
    }
    if(!_foundTile)_lastHandTile=-1;
  }
  _sweepAt(_sx,_sy,0,0);
  function _onMove(me){
    var cx=me.clientX,cy=me.clientY;
    var vx=cx-_prevX,vy=cy-_prevY;
    var dx=cx-_sx,dy=cy-_sy;
    if(!_swept&&Math.sqrt(dx*dx+dy*dy)>5){_swept=true;activeDrag={src:'shift-sweep'};}
    if(_swept){
      // Sample intermediate points so a fast swipe never skips over a tile
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
      // Only rebuild hand immediately if no swept tiles are still flying;
      // the last flying tile's onDone will call renderHand() when they land.
      if(_sweepFlyCount===0)renderHand();
    } else {
      var sq=sqAt(_sx,_sy);
      if(sq>=0&&S.bt[sq]&&S.bt[sq].isNew){_recallAllAnimated();}
      else if(inHand(_sx,_sy)){
        var _allSel=S.hand.every(function(t){return!t||t.onBoard||t.sel;});
        for(var _si=0;_si<S.hand.length;_si++){if(S.hand[_si]&&!S.hand[_si].onBoard)S.hand[_si].sel=!_allSel;}
        _playTileClick('select');renderHand();
      }
    }
  }
  document.addEventListener('pointermove',_onMove);
  document.addEventListener('pointerup',_onUp);
},true);

function multiPlaceSelected(selOis,startSq,dir){
  var r=Math.floor(startSq/B),c=startSq%B;
  var free=[];
  if(dir==='h'){for(var cc=c;cc<B;cc++){var idx2=r*B+cc;if(!S.bt[idx2])free.push(idx2);}}
  else{for(var rr=r;rr<B;rr++){var idx2=rr*B+c;if(!S.bt[idx2])free.push(idx2);}}
  if(free.length<selOis.length)return;
  var i=0;
  function placeNext(){
    if(i>=selOis.length){renderBoard();renderHand();return;}
    var oi=selOis[i];var sqIdx=free[i];i++;
    var t=S.hand[oi];t.sel=false;
    if(t.isBlank&&!t.blankAs){renderBoard();renderHand();openBlankChooser(oi,function(){placeTile(oi,sqIdx);placeNext();});}
    else{placeTile(oi,sqIdx);placeNext();}
  }
  placeNext();
}
