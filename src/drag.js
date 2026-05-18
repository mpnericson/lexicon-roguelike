// =====================================================================
// DRAG — tile and sticker drag-and-drop engine
// =====================================================================
function makeDragClone(innerHTML,css){
  var el=document.createElement('div');el.className='tile';
  el.style.cssText='position:fixed;z-index:9999;pointer-events:none;'+css;
  el.innerHTML=innerHTML;document.body.appendChild(el);return el;
}

function clearHL(){if(_hl>=0){var e=document.querySelector('[data-sq-idx="'+_hl+'"]');if(e)e.classList.remove('drop-target');}_hl=-1;}
function setHL(idx){
  if(idx===_hl)return;clearHL();_hl=idx;
  if(idx>=0&&!S.bt[idx]){var e=document.querySelector('[data-sq-idx="'+idx+'"]');if(e)e.classList.add('drop-target');}
}

function sqAt(x,y){
  var els=document.elementsFromPoint(x,y);
  for(var i=0;i<els.length;i++)if(els[i].dataset&&els[i].dataset.sqIdx!==undefined)return parseInt(els[i].dataset.sqIdx);
  return -1;
}

function inHand(x,y){var r=document.getElementById('hand-area').getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top-20&&y<=r.bottom+20;}

function attachHandTileDrag(face,oi,vi,tile,disp,sc,vis){
  face.addEventListener('pointerdown',function(ev){
    ev.preventDefault();ev.stopPropagation();
    if(activeDrag)return;
    if(tile.isBlank&&!tile.blankAs){openBlankChooser(oi,null);return;}
    var sx=ev.clientX,sy=ev.clientY;var sr=face.getBoundingClientRect();
    var moved=false,clone=null;HP.held=vi;
    function move(me){
      var dx=me.clientX-sx,dy=me.clientY-sy;
      if(!moved&&Math.sqrt(dx*dx+dy*dy)>8){
        moved=true;HP.held=-1;
        clone=makeDragClone(face.innerHTML,'width:56px;height:64px;left:'+sr.left+'px;top:'+sr.top+'px;box-shadow:0 12px 28px rgba(0,0,0,.7);transform:scale(1.12);background:#f0e080;border-color:#a89000;');
        activeDrag={src:'hand',oi:oi,vi:vi,clone:clone,sx:sx,sy:sy,sr:sr,cx:sr.left+28};renderHand();
      }
      if(moved&&clone){
        var dx2=me.clientX-sx,dy2=me.clientY-sy;
        clone.style.left=(sr.left+dx2)+'px';clone.style.top=(sr.top+dy2)+'px';
        activeDrag.cx=sr.left+28+dx2;activeDrag.cy=sr.top+32+dy2;
        var sq=sqAt(me.clientX,me.clientY);
        if(sq>=0&&!S.bt[sq])setHL(sq);else clearHL();
      }
    }
    function up(me){
      document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);
      HP.held=-1;
      if(!moved){
        if(vi>0)HP.vx[vi-1]-=3;
        if(vi<HP.tiles.length-1)HP.vx[vi+1]+=3;
        toggleSel(oi);return;
      }
      if(!clone)return;clearHL();activeDrag.cx=-9999;
      var sq=sqAt(me.clientX,me.clientY);var ih=inHand(me.clientX,me.clientY);
      if(sq>=0&&!S.bt[sq]){
        var sqEl=document.querySelector('[data-sq-idx="'+sq+'"]');var tr=sqEl?sqEl.getBoundingClientRect():null;
        if(tr){clone.style.transition='left .13s,top .13s,transform .13s';clone.style.left=(tr.left+tr.width/2-28)+'px';clone.style.top=(tr.top+tr.height/2-32)+'px';clone.style.transform='scale(0.85)';}
        setTimeout(function(){if(clone.parentNode)clone.parentNode.removeChild(clone);placeTile(oi,sq);activeDrag=null;renderBoard();renderHand();},140);
      } else if(ih){
        var ins=computeInsert(me.clientX,vi);
        setTimeout(function(){if(clone.parentNode)clone.parentNode.removeChild(clone);reorderHand(oi,ins,vis);activeDrag=null;renderHand();},60);
      } else {
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

function reorderHand(fromOi,insertAt,vis){
  var fv=-1;for(var k=0;k<vis.length;k++)if(vis[k].oi===fromOi){fv=k;break;}
  if(fv<0)return;var rem=vis.splice(fv,1)[0];
  var adj=insertAt>fv?insertAt-1:insertAt;adj=Math.max(0,Math.min(vis.length,adj));vis.splice(adj,0,rem);
  var ob=[];for(var k=0;k<S.hand.length;k++)if(S.hand[k]&&S.hand[k].onBoard)ob.push(S.hand[k]);
  var nh=vis.map(function(e){return e.t;});for(var k=0;k<ob.length;k++)nh.push(ob[k]);
  for(var bi=0;bi<B*B;bi++){if(S.bt[bi]&&S.bt[bi].handIdx!==undefined){for(var k=0;k<nh.length;k++){if(nh[k]&&nh[k].onBoard&&nh[k]._boardSq===bi){S.bt[bi].handIdx=k;break;}}}}
  HP.x=[];HP.vx=[];S.hand=nh;
}

function attachBoardTileDrag(face,sqIdx,sz){
  face.addEventListener('pointerdown',function(ev){
    ev.preventDefault();ev.stopPropagation();if(activeDrag)return;
    if(S.board[sqIdx]==='fossil'&&S.bt[sqIdx]&&S.bt[sqIdx].isNew){toast('Fossil: tile is locked in place!');return;}
    var sr=face.getBoundingClientRect();var sx=ev.clientX,sy=ev.clientY;var moved=false,clone=null;
    function move(me){
      var dx=me.clientX-sx,dy=me.clientY-sy;
      if(!moved&&Math.sqrt(dx*dx+dy*dy)>5){
        moved=true;
        clone=makeDragClone(face.innerHTML,'width:'+(sz-2)+'px;height:'+(sz-2)+'px;left:'+sr.left+'px;top:'+sr.top+'px;box-shadow:0 8px 20px rgba(0,0,0,.6);transform:scale(1.2);background:#f0e080;border-color:#a89000;');
        S.bt[sqIdx].flying=true;activeDrag={src:'board',sqIdx:sqIdx,clone:clone,sr:sr};renderBoard();
      }
      if(moved&&clone){
        clone.style.left=(sr.left+(me.clientX-sx))+'px';clone.style.top=(sr.top+(me.clientY-sy))+'px';
        var over=sqAt(me.clientX,me.clientY);if(over>=0&&over!==sqIdx&&!S.bt[over])setHL(over);else clearHL();
      }
    }
    function up(me){
      document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);
      if(!moved){recallTile(sqIdx);return;}if(!clone)return;clearHL();
      if(S.bt[sqIdx])S.bt[sqIdx].flying=false;
      var over=sqAt(me.clientX,me.clientY);var ih=inHand(me.clientX,me.clientY);
      if(ih){
        clone.style.transition='left .14s,top .14s';clone.style.left=sr.left+'px';clone.style.top=sr.top+'px';
        setTimeout(function(){if(clone.parentNode)clone.parentNode.removeChild(clone);recallTile(sqIdx);activeDrag=null;},140);
      } else if(over>=0&&over!==sqIdx&&!S.bt[over]){
        var sqEl=document.querySelector('[data-sq-idx="'+over+'"]');var tr=sqEl?sqEl.getBoundingClientRect():null;
        if(tr){clone.style.transition='left .13s,top .13s,transform .13s';clone.style.left=(tr.left+tr.width/2-(sz/2))+'px';clone.style.top=(tr.top+tr.height/2-(sz/2))+'px';clone.style.transform='scale(0.9)';}
        setTimeout(function(){
          if(clone.parentNode)clone.parentNode.removeChild(clone);
          var old=S.bt[sqIdx];S.bt[over]={letter:old.letter,isNew:old.isNew,isBlank:old.isBlank,handIdx:old.handIdx};
          if(old.handIdx!==undefined&&S.hand[old.handIdx])S.hand[old.handIdx]._boardSq=over;
          S.bt[sqIdx]=null;activeDrag=null;renderBoard();renderHand();
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
        clone=makeDragClone('<span style="font-size:20px">'+d.icon+'</span><span style="font-size:8px;display:block;text-align:center">'+d.name+'</span>',
          'width:56px;height:64px;background:#12122a;border:2px solid '+d.fg+';border-radius:8px;color:'+d.fg+';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;');
        face.style.opacity='0';
        activeDrag={src:'hand',vi:vi,cx:me.clientX,cy:me.clientY};
      }
      if(!moved)return;
      var si=sqAt(me.clientX,me.clientY);
      if(si>=0&&!S.board[si]&&!isSqStaged(si)){setHL(si);}else{clearHL();}
      clone.style.left=(me.clientX-28)+'px';clone.style.top=(me.clientY-32)+'px';
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

function placeTile(handIdx,sqIdx){
  var t=S.hand[handIdx];t.onBoard=true;t._boardSq=sqIdx;
  S.bt[sqIdx]={letter:t.isBlank?(t.blankAs||'?'):t.letter,isNew:true,isBlank:t.isBlank,handIdx:handIdx,variant:t.variant||null,blueBonus:t.blueBonus||0,alchSc:t._alchSc||0};
}

function recallTile(sqIdx){
  var bt=S.bt[sqIdx];if(!bt||!bt.isNew)return;
  if(S.board[sqIdx]==='fossil'){toast('Fossil: tile is locked in place!');return;}
  var t=S.hand[bt.handIdx];if(t){t.onBoard=false;t._boardSq=undefined;}
  S.bt[sqIdx]=null;renderBoard();renderHand();
}

function recallAll(){
  for(var i=0;i<B*B;i++){var bt=S.bt[i];if(bt&&bt.isNew){if(S.board[i]==='fossil')continue;var t=S.hand[bt.handIdx];if(t){t.onBoard=false;t._boardSq=undefined;}S.bt[i]=null;}}
}

function clearBoardLetters(){
  S.bt=Array(B*B).fill(null);
  for(var i=0;i<S.hand.length;i++){if(S.hand[i]&&S.hand[i].onBoard){S.hand[i].onBoard=false;S.hand[i]._boardSq=undefined;}}
}

function toggleSel(idx){if(S.hand[idx]&&!S.hand[idx].onBoard){S.hand[idx].sel=!S.hand[idx].sel;renderHand();}}
