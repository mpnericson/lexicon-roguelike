// =====================================================================
// SCORING — bracket-based cumulative letter/mult tracking
//
// Letter score (L) and mult score (M) are separate tracks:
//   Final: total = round(L × (1 + sum(plusMults)) × product(xmults))
//
// Per tile (brackets 1-6, run for every tile in every word):
//   1. Base letter score added to L
//   2. Local additive — sqDef.onSquareLand(tile,ctx,ts,baseSc,sqIdx) if defined (cooldown-gated)
//   3. Global +letter — tile sticker onPerTile hooks (Commons, NATO); gold tile
//   4. Local ×letter + local xmult (DL/TL → ×L; DW/TW → push xmult; Purist doubles these)
//   5. Global ×letter — _applyChessAura() (chess pieces ×3; King TW on aura squares)
//   6. Retrigger      — sqDef.retrigger:true (Red Sticker); red tile variant
//
// Post-word (run once after all tiles across all words):
//   Bingo +50
//   Sticker onPostWord hooks (Scholar, Aristocrat, Pressure Cooker,
//     Bounty Hunter, Crossroads, Palindrome Engine, Inkwell, Slot Machine, etc.)
//   Bounty reward
//   Final transform: Palindrome Engine ×palMult
//
// Word order: cross words scored before main word (per-tile only).
// Both contribute to the same L / plusMults / xmults accumulators.
//
// Cooldowns: local effects are gated by S.localCooldowns (a Set of sqIdx).
// Within one play no flags are set — a square can fire multiple times.
// After scorePlay() commits, every activated square is added to
// S.localCooldowns, which persists until clearBoardLetters() (between stages).
// =====================================================================

function newTiles(){
  var r=[];
  for(var i=0;i<B*B;i++){
    // Jenga: btTop tile overrides the committed tile below for this position
    var tt=S.btTop&&S.btTop[i];
    if(tt&&tt.isNew){r.push({idx:i,row:Math.floor(i/B),col:i%B,letter:tt.letter,isBlank:!!tt.isBlank,sc:tt.isBlank?(tt._alchSc||0):(LS[tt.letter]||0),variant:tt.variant||null,blueBonus:tt.blueBonus||0,handIdx:tt.handIdx,isNew:true});continue;}
    var t=S.bt[i];
    if(t&&t.isNew)r.push({idx:i,row:Math.floor(i/B),col:i%B,
      letter:t.letter,isBlank:!!t.isBlank,
      sc:t.isBlank?(t._alchSc||0):(LS[t.letter]||0),
      variant:t.variant||null,blueBonus:t.blueBonus||0,
      handIdx:t.handIdx,isNew:true});
  }
  return r;
}

function wordDir(nt){
  if(!nt.length)return null;
  if(nt.length===1){
    var r=nt[0].row,c=nt[0].col;
    var hasV=!!(S.bt[(r-1)*B+c]||S.bt[(r+1)*B+c]);
    var hasH=!!(S.bt[r*B+(c-1)]||S.bt[r*B+(c+1)]);
    if(hasV&&!hasH)return'v';
    return'h';
  }
  var rows={},cols={};
  for(var i=0;i<nt.length;i++){rows[nt[i].row]=1;cols[nt[i].col]=1;}
  if(Object.keys(rows).length===1)return'h';
  if(Object.keys(cols).length===1)return'v';
  return null;
}

function extractAt(ar,ac,dir){
  var pos=dir==='h'?ac:ar;
  while(pos>0){var p=dir==='h'?ar*B+(pos-1):(pos-1)*B+ac;if(S.bt[p])pos--;else break;}
  var start=pos;
  pos=dir==='h'?ac:ar;
  while(pos<B-1){var p=dir==='h'?ar*B+(pos+1):(pos+1)*B+ac;if(S.bt[p])pos++;else break;}
  var end=pos;
  if(start===end)return null;
  var wt=[];
  for(var p=start;p<=end;p++){
    var si=dir==='h'?ar*B+p:p*B+ac;
    // Jenga: use top stacked tile if present (it's the one that scores)
    var topT=S.btTop&&S.btTop[si]&&S.btTop[si].isNew?S.btTop[si]:null;
    var bt=topT||S.bt[si];
    if(!bt)return null;
    wt.push({idx:si,row:Math.floor(si/B),col:si%B,
      letter:bt.letter,isNew:!!bt.isNew,isBlank:!!bt.isBlank,
      sc:bt.isBlank?(bt._alchSc||0):(LS[bt.letter]||0),
      variant:bt.variant||null,blueBonus:bt.blueBonus||0,
      handIdx:bt.handIdx});
  }
  return{word:wt.map(function(t){return t.letter;}).join(''),tiles:wt};
}

// Returns all formed word strings (main + cross) — used for validation.
function getAllWords(nt,dir){
  var a=nt[0];
  var main=extractAt(a.row,a.col,dir);
  if(!main)return[];
  var words=[main.word];
  var cx=dir==='h'?'v':'h';
  var seen={};
  for(var i=0;i<nt.length;i++){
    var k=nt[i].row+','+nt[i].col;if(seen[k])continue;seen[k]=1;
    // Jenga stacked tiles don't form cross-words
    if(S.btTop&&S.btTop[nt[i].idx]&&S.btTop[nt[i].idx].isNew)continue;
    var cxw=extractAt(nt[i].row,nt[i].col,cx);
    if(cxw&&cxw.tiles.length>=2)words.push(cxw.word);
  }
  return words;
}

// ---- Scoring context ----

function _buildCtx(mainWord){
  var ctx={
    letters:0, plusMults:[], xmults:[], tgold:0, events:[],
    activatedSqs:new Set(),
    allSc1:true, anyHigh:false, blankCt:0, newTileCount:0, maxSc:0,
    mainWord:mainWord||'',
    crossWordCount:0,
    slotUsed:false, preview:false,
    // sticker flags populated below via onBuildCtx hooks
    chessPieces:[],chessKingActive:false,
    purist:false,palMult:1,
    stickerLocked:(currentConstraint()==='c_stickers')&&!(S.stickersSoldThisStage>0),
  };
  if(!ctx.stickerLocked)_fireAllStickers('onBuildCtx',[ctx]);
  return ctx;
}

// ---- Per-tile pass engine (brackets 1-6) ----
// ts = tile's running score coming in (0 for first pass, current value for retrigger).
// Returns updated tile score. Does NOT touch ctx.letters.
// Letter events carry isTileLocal:true so the animation shows pops without advancing saL.

function _scoreTilePasses(tile,ctx,ts,skipRetrigger){
  var sqIdx=tile.idx;
  var sqId=S.board[sqIdx];
  var sqDef=sqId?sqd(sqId):null;
  var sqActive=!S.localCooldowns.has(sqIdx);
  var tileSc=tile.isBlank?(tile.sc||0):(LS[tile.letter]||0);

  // --- Bracket 1: base ---
  var baseSc=tile.isBlank?(tile.sc||0):tileSc;
  var _letterUsed=!tile.isBlank&&tile.letter&&currentConstraint()==='c_letters'&&S.usedLetters&&S.usedLetters.has(tile.letter);
  if(_letterUsed)baseSc=0;
  ts+=baseSc;
  ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,
    label:tile.letter+(tile.isBlank?' (blank)':'')+ (_letterUsed?' (used-0)':'')});

  // --- Bracket 2: local additive (cooldown-gated) — sqDef.onSquareLand hook ---
  if(sqActive&&sqDef&&sqDef.onSquareLand&&!ctx.stickerLocked){
    ctx._stickerActed=false;
    var _prevEvLen=ctx.events.length;
    ts=sqDef.onSquareLand(tile,ctx,ts,baseSc,sqIdx);
    if(!ctx.preview&&(ctx.events.length>_prevEvLen||ctx._stickerActed))ctx.activatedSqs.add(sqIdx);
  }

  // --- Bracket 3: global additive — tile sticker onPerTile hooks + gold tile ---
  if(tile.variant==='gold'){
    ctx.tgold++;
    ctx.events.push({type:'gold',delta:1,sqIdx:sqIdx,label:'Gold tile +$1'});
  }
  if(!ctx.stickerLocked){
    for(var _pti=0;_pti<S.tileStickers.length;_pti++){
      var _ptd=sqd(S.tileStickers[_pti].id);
      if(_ptd&&_ptd.onPerTile)ts=_ptd.onPerTile(tile,ctx,ts,S.tileStickers[_pti]);
    }
  }

  // --- Bracket 4: local ×letter (DL/TL) + local xmult (DW/TW) ---
  if(sqActive&&sqDef&&sqDef.bm&&!ctx.stickerLocked){
    var bm=sqDef.bm;
    if(bm==='dl'||bm==='tl'){
      var f4=bm==='dl'?(ctx.purist?4:2):(ctx.purist?9:3);
      ts*=f4;
      ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:sqDef.name+' ×'+f4,floatSqIdx:sqIdx});
      if(!ctx.preview)ctx.activatedSqs.add(sqIdx);
    }
    if(bm==='dw'||bm==='tw'){
      var f4b=bm==='dw'?(ctx.purist?4:2):(ctx.purist?9:3);
      ctx.xmults.push(f4b);
      ctx.events.push({type:'x-mult',factor:f4b,sqIdx:sqIdx,label:sqDef.name+' ×'+f4b,floatSqIdx:sqIdx});
      if(!ctx.preview)ctx.activatedSqs.add(sqIdx);
    }
  }

  // --- Bracket 5: global ×letter — chess aura (_applyChessAura defined in indirect.js) ---
  if(ctx.chessPieces.length)ts=_applyChessAura(tile,ctx,ts,sqIdx);

  // --- Bracket 6: retrigger — sqDef.retrigger:true flag or red tile variant ---
  // Continues from current ts — does NOT reset to 0.
  if(!skipRetrigger){
    if(sqActive&&sqDef&&sqDef.retrigger&&!ctx.stickerLocked){
      if(!ctx.preview)ctx.activatedSqs.add(sqIdx);
      ctx.events.push({type:'retrigger',sqIdx:sqIdx,label:sqDef.name,floatSqIdx:sqIdx});
      ts=_scoreTilePasses(tile,ctx,ts,true);
    }
    if(tile.variant==='red'){
      ctx.events.push({type:'retrigger',sqIdx:sqIdx,label:'Red'});
      ts=_scoreTilePasses(tile,ctx,ts,true);
    }
  }
  return ts;
}

// ---- Per-tile entry point ----
// Runs all passes, then adds the completed tile score to ctx.letters once.

function _scoreTile(tile,ctx,skipRetrigger){
  var tileSc=tile.isBlank?(tile.sc||0):(LS[tile.letter]||0);
  if(tileSc>1)ctx.allSc1=false;
  if(tileSc>=8)ctx.anyHigh=true;
  if(tile.isBlank&&tile.isNew)ctx.blankCt++;
  if(tileSc>ctx.maxSc)ctx.maxSc=tileSc;
  var _startEvt=ctx.events.length;
  var ts=_scoreTilePasses(tile,ctx,0,skipRetrigger);
  // If bracket1 has subsequent tile-local sticker effects, suppress its pop/bounce/ding
  var _hasLater=false;
  for(var _ei=_startEvt+1;_ei<ctx.events.length;_ei++){if(ctx.events[_ei].isTileLocal){_hasLater=true;break;}}
  if(_hasLater)ctx.events[_startEvt].suppressVisual=true;
  ctx.letters+=ts;
  // Tag the last isTileLocal event with the global running total so the
  // animation can sync saL at the same frame as the tile bink.
  for(var _li=ctx.events.length-1;_li>=_startEvt;_li--){
    if(ctx.events[_li].isTileLocal){ctx.events[_li]._globalLetters=ctx.letters;break;}
  }
  ctx.events.push({type:'letter',lettersAfter:ctx.letters,isSilent:true});
}

// ---- Main scoring entry point ----
// preview=true → no cooldown commits, no S._slotMachineRoll writes.
// Returns {total, tgold, events, mainWord, bingo, letters, plusMults, xmults, mult, allWords}

function scorePlay(nt,dir,preview){
  if(!S.localCooldowns)S.localCooldowns=new Set();
  var a=nt[0];
  var main=extractAt(a.row,a.col,dir);
  if(!main)return null;

  var ctx=_buildCtx(main.word);
  ctx.preview=!!preview;
  ctx.newTileCount=nt.length;
  ctx._freeHandCount=S.hand.filter(function(t){return t!==null;}).length;
  if(!preview)S._slotMachineRoll=null;

  // Tile-count base +mult — established before any per-tile scoring
  if(ctx.newTileCount>=4){
    var _tcb=ctx.newTileCount-3;
    ctx.plusMults.push(_tcb);
    ctx.events.push({type:'plus-mult',delta:_tcb,label:ctx.newTileCount+' tiles +'+_tcb+' mult',silent:true});
  }

  var bingo=ctx._freeHandCount>0&&nt.length>=ctx._freeHandCount;

  // Extract cross words
  var cx=dir==='h'?'v':'h';
  var crossWords=[];
  var seen={};
  for(var i=0;i<nt.length;i++){
    var k=nt[i].row+','+nt[i].col;if(seen[k])continue;seen[k]=1;
    // Jenga stacked tiles sit on existing words — no new cross-word is formed
    if(S.btTop&&S.btTop[nt[i].idx]&&S.btTop[nt[i].idx].isNew)continue;
    var cxw=extractAt(nt[i].row,nt[i].col,cx);
    if(cxw&&cxw.tiles.length>=2)crossWords.push(cxw);
  }

  // Score cross words first (per-tile brackets 1-6)
  // Crossroads: display-only tick per crossword, purely so a hovered tooltip can track the
  // count live — the real mult is applied once at the end via onPostWord (see below).
  var _hasCrossroads=false;for(var _cri=0;_cri<S.tileStickers.length;_cri++)if(S.tileStickers[_cri].id==='crossroads'){_hasCrossroads=true;break;}
  for(var ci=0;ci<crossWords.length;ci++){
    var cwtiles=crossWords[ci].tiles;
    if(_hasCrossroads&&!ctx.stickerLocked)ctx.events.push({type:'crossword-tick',isSilent:true});
    for(var ti=0;ti<cwtiles.length;ti++)_scoreTile(cwtiles[ti],ctx,false);
  }
  // Score main word (per-tile brackets 1-6)
  for(var ti=0;ti<main.tiles.length;ti++)_scoreTile(main.tiles[ti],ctx,false);

  // ---- POST-WORD PHASE ----

  // Bingo +50 (game mechanic, not a sticker)
  if(bingo){
    ctx.letters+=50;
    ctx.events.push({type:'letter',lettersAfter:ctx.letters,label:'Bingo +50'});
  }

  // Sticker onPostWord hooks — each sticker pushes directly to ctx
  ctx.crossWordCount=crossWords.length;
  if(!ctx.stickerLocked){
    for(var pwi=0;pwi<S.placed.length;pwi++){
      var _pDef=sqd(S.placed[pwi].id);
      if(_pDef&&_pDef.onPostWord)_pDef.onPostWord(main.word,main.tiles,ctx,S.placed[pwi]);
    }
    for(var twi=0;twi<S.tileStickers.length;twi++){
      var _tDef=sqd(S.tileStickers[twi].id);
      if(_tDef&&_tDef.onPostWord){
        var _evStart=ctx.events.length;
        _tDef.onPostWord(main.word,main.tiles,ctx,S.tileStickers[twi]);
        for(var _evi=_evStart;_evi<ctx.events.length;_evi++){
          var _tev=ctx.events[_evi];
          if((_tev.type==='letter'||_tev.type==='plus-mult'||_tev.type==='x-mult')&&_tev.floatSqIdx==null&&_tev.floatTsId==null)_tev.floatTsId=S.tileStickers[twi].id;
        }
      }
    }
  }
  // Bounty reward — applied last so it multiplies everything
  if(S._pendingBountyReward&&!preview)applyBountyReward(ctx);

  // Final calculation
  var plusSum=0;for(var i=0;i<ctx.plusMults.length;i++)plusSum+=ctx.plusMults[i];
  var xprod=1;for(var i=0;i<ctx.xmults.length;i++)xprod*=ctx.xmults[i];
  var mult=(1+plusSum)*xprod;
  var total=Math.round(ctx.letters*mult);

  // Palindrome Engine scaling mult
  if(ctx.palMult>1){
    total=Math.round(total*ctx.palMult);
    ctx.events.push({type:'final-transform',label:'Palindrome Engine ×'+fmtMult(ctx.palMult),total:total,palMult:ctx.palMult,floatTsId:'palindrome_engine'});
  }

  var _displayMult=ctx.palMult>1?mult*ctx.palMult:mult;
  ctx.events.push({type:'final',letters:ctx.letters,plusSum:plusSum,xprod:xprod,mult:mult,displayMult:_displayMult,total:total});

  // Commit cooldowns (non-preview only)
  if(!preview)ctx.activatedSqs.forEach(function(sq){S.localCooldowns.add(sq);});

  return{
    total:total,tgold:ctx.tgold,events:ctx.events,
    mainWord:main.word,bingo:bingo,
    letters:ctx.letters,plusMults:ctx.plusMults,xmults:ctx.xmults,mult:mult,
    allWords:getAllWords(nt,dir),
    crossWordCount:crossWords.length,
    springTraps:ctx.springTraps||[],
  };
}

// ---- Backward-compat wrapper for solver (always preview) ----
// solver.js calls scoreWord(wt, word, isMain, extraChips)
// wt is a manually-built tile array with {idx,letter,isNew,isBlank,sc,sid,variant,blueBonus}

function scoreWord(wt,word,isMain,extraChips,cwWts){
  if(!S.localCooldowns)S.localCooldowns=new Set();
  var ctx=_buildCtx(word);
  ctx.preview=true;
  var _nc=0;for(var i=0;i<wt.length;i++)if(wt[i]&&wt[i].isNew)_nc++;
  ctx.newTileCount=_nc;
  if(ctx.newTileCount>=4)ctx.plusMults.push(ctx.newTileCount-3);
  // Score cross words first — same ctx, mirrors scorePlay ordering
  if(cwWts){for(var ci=0;ci<cwWts.length;ci++){for(var ti=0;ti<cwWts[ci].length;ti++){_scoreTile(cwWts[ci][ti],ctx,false);}}}
  for(var i=0;i<wt.length;i++){
    var t=wt[i];
    _scoreTile(t,ctx,false);
  }
  if(extraChips&&extraChips>0){ctx.letters+=extraChips;}
  if(isMain)_fireAllStickers('onPostWord',[word,wt,ctx]);
  var plusSum=0;for(var i=0;i<ctx.plusMults.length;i++)plusSum+=ctx.plusMults[i];
  var xprod=1;for(var i=0;i<ctx.xmults.length;i++)xprod*=ctx.xmults[i];
  var mult=(1+plusSum)*xprod;
  var total=Math.round(ctx.letters*mult);
  if(ctx.palMult>1)total=Math.round(total*ctx.palMult);
  return{letters:ctx.letters,mult:mult,total:total,gold:ctx.tgold};
}

// ---- Sticker float animation ----
// Full 3D sticker peel: rAF-driven diagonal peel along a 45° axis (top-left lifts first,
// bottom-right is the anchor), then decaying jiggle, then snap-flat on ding, then leaf drift.
// Float elements attached to document.body (position:fixed) — bypasses overflow:hidden on
// #board-area. Container starts opacity:0 so the board is always visible at rest.

var _stickerFloats={};

function _ensureStickerCSS(){
  if(document.getElementById('_sf-css'))return;
  var s=document.createElement('style');s.id='_sf-css';
  s.textContent=[
    // Float back down: f.el drifts from -10px to board level and fades.
    '@keyframes _sf-drift{',
    '0%{transform:translateY(-12px) rotateZ(-0.6deg);opacity:1}',
    '30%{transform:translateY(-5px) rotateZ(0.4deg);opacity:1}',
    '60%{transform:translateY(-1.5px) rotateZ(-0.1deg);opacity:1}',
    '80%{transform:translateY(0px) rotateZ(0deg);opacity:1}',
    '90%{transform:translateY(0px) rotateZ(0deg);opacity:0.5}',
    '100%{transform:translateY(0px) rotateZ(0deg);opacity:0}',
    '}',
    '@keyframes _sf-shrink{0%{transform:scale(1.4)}100%{transform:scale(1)}}',
  ].join('');
  document.head.appendChild(s);
}

function _clearStickerFloats(){
  for(var k in _stickerFloats){
    var f=_stickerFloats[k];
    if(f.t1)clearTimeout(f.t1);
    if(f.t2)clearTimeout(f.t2);
    if(f._raf)cancelAnimationFrame(f._raf);
    if(f.el&&f.el.parentNode)f.el.parentNode.removeChild(f.el);
    if(f.glowEl&&f.glowEl.parentNode)f.glowEl.parentNode.removeChild(f.glowEl);
  }
  _stickerFloats={};
}

function _buildStickerFloatEl(sqIdx){
  var sqEl=document.querySelector('.sq[data-sq-idx="'+sqIdx+'"]');
  if(!sqEl)return null;
  var sid=S.board[sqIdx];if(!sid)return null;
  var ss=sqStyle(sid);
  var sd=sqd(sid);
  if(!ss.lbl&&!(sd&&sd.iconPng))return null;
  _ensureStickerCSS();

  var rect=sqEl.getBoundingClientRect();
  var w=rect.width,h=rect.height;

  // Hide the board cell sticker — flatEl takes its place visually from the start.
  sqEl.style.background='';
  sqEl.style.backgroundImage='url(Assets/sprites/board-tile.png)';
  sqEl.style.backgroundSize=w+'px '+h+'px';
  sqEl.style.imageRendering='pixelated';
  sqEl.style.border='none';sqEl.style.borderRadius='0';
  sqEl.style.color='#6a9060';
  var _sqKids=Array.prototype.slice.call(sqEl.children);
  for(var _ski=0;_ski<_sqKids.length;_ski++){
    if(!_sqKids[_ski].classList.contains('tile'))sqEl.removeChild(_sqKids[_ski]);
  }

  // Glow — fixed at cell bottom
  var glowEl=document.createElement('div');
  var glowColor=sd?sd.fg:'#ffffff';
  glowEl.style.cssText='position:fixed;pointer-events:none;z-index:9998;opacity:0;'
    +'left:'+(rect.left+w*0.08)+'px;top:'+(rect.top+h-4)+'px;'
    +'width:'+(w*0.84)+'px;height:8px;border-radius:50%;'
    +'background:'+glowColor+';box-shadow:0 0 18px 7px '+glowColor+';';
  document.body.appendChild(glowEl);

  // Container — immediately visible (replaces the hidden board sticker seamlessly)
  var floatEl=document.createElement('div');
  floatEl.style.cssText='position:fixed;pointer-events:none;z-index:9999;'
    +'left:'+rect.left+'px;top:'+rect.top+'px;width:'+w+'px;height:'+h+'px;opacity:1;';

  var fs=Math.max(10,Math.floor(h*0.55));
  var faceBase='position:absolute;inset:0;border-radius:3px;'
    +'background:'+ss.bg+';color:'+ss.fg+';'
    +'display:flex;align-items:center;justify-content:center;'
    +'font-size:'+fs+'px;line-height:1;border:1px solid rgba(255,255,255,0.18);';

  function _makeFace(extra){
    var el=document.createElement('div');el.style.cssText=faceBase+extra;
    if(sd&&sd.iconPng){
      var im=document.createElement('img');im.src=sd.iconPng;
      im.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;image-rendering:pixelated;border-radius:3px;';
      el.appendChild(im);
    }else{el.textContent=ss.lbl;}
    return el;
  }

  // flatEl: the still-stuck portion of the sticker. Full square at start, shrinks as peel progresses.
  var flatEl=_makeFace('');

  // peeledEl: the lifted portion. Zero-area at start, grows with peel. Gets 3D transform + shadow.
  var peeledEl=_makeFace('will-change:transform,box-shadow;');
  peeledEl.style.clipPath='polygon(0% 0%, 0% 0%, 0% 0%)';

  floatEl.appendChild(flatEl);
  floatEl.appendChild(peeledEl);
  document.body.appendChild(floatEl);

  return{el:floatEl,peeledEl:peeledEl,flatEl:flatEl,glowEl:glowEl,t1:null,t2:null,_raf:null,phase:'idle',sqEl:sqEl,_w:w,_h:h};
}

function _sfEaseOut(t){var m=1-t;return 1-m*m*m;}

function _hideBoardCell(f){
  var sqEl=f.sqEl;if(!sqEl||!sqEl.isConnected)return;
  var w=f._w,h=f._h;
  sqEl.style.background='';
  sqEl.style.backgroundImage='url(Assets/sprites/board-tile.png)';
  sqEl.style.backgroundSize=w+'px '+h+'px';
  sqEl.style.imageRendering='pixelated';
  sqEl.style.border='none';sqEl.style.borderRadius='0';
  sqEl.style.color='#6a9060';
  var kids=Array.prototype.slice.call(sqEl.children);
  for(var ki=0;ki<kids.length;ki++){if(!kids[ki].classList.contains('tile'))sqEl.removeChild(kids[ki]);}
}

// Restores the board cell sticker at ding-time so the float can drift back onto it.
function _restoreBoardCell(f,sqIdx){
  var sqEl=f.sqEl;if(!sqEl||!sqEl.isConnected)return;
  var sid=S.board[sqIdx];if(!sid)return;
  var ss=sqStyle(sid),sd=sqd(sid),w=f._w,h=f._h;
  sqEl.style.backgroundImage='';sqEl.style.backgroundSize='';sqEl.style.imageRendering='';
  sqEl.style.background=ss.bg;sqEl.style.color=ss.fg;
  if(sd&&sd.iconPng){
    sqEl.style.border='none';sqEl.style.borderRadius='0';
    var rImg=document.createElement('img');rImg.src=sd.iconPng;
    rImg.style.cssText='position:absolute;left:0;top:0;width:'+Math.round(w)+'px;height:'+Math.round(h)+'px;image-rendering:pixelated;pointer-events:none';
    sqEl.appendChild(rImg);
  }else{
    sqEl.style.border='';sqEl.style.borderRadius='';
    if(ss.lbl){var lbl=document.createElement('div');lbl.className='sq-lbl';lbl.textContent=ss.lbl;sqEl.appendChild(lbl);}
  }
}

// Progressive sticker peel using two clipped half-elements:
//   flatEl  = the still-stuck portion (no 3D, clip shrinks toward bottom-right)
//   peeledEl = the lifted portion (3D rotated around fold line, clip grows from top-left)
//
// Phase 1 (p: 0→1/8): fold line moves from top-left, angle rises 0°→45°. Corner lifts.
// Phase 2 (p: 1/8→1): corner height is fixed; fold line continues toward bottom-right,
//   angle decreases via θ = arcsin(1/(8·p·√2)). Peeled segment grows, angle flattens.
// Jiggle: full sticker lifted at ~5°, decaying oscillation before snap.
function _runPeel(f){
  var PEEL_MS=600,FLATTEN_MS=180;
  var t0=null,flatT0=null;

  // Clip-path for the top-left (peeled) region given fold-line parameter p ∈ [0,1].
  // Fold line: y = -x + 2p in [0,1]² — passes through (p,p) at 45°.
  function _pc(pp){
    if(pp<=0)return 'polygon(0% 0%, 0% 0%, 0% 0%)';
    var a,b;
    if(pp<0.5){a=(pp*200).toFixed(2);return 'polygon(0% 0%, '+a+'% 0%, 0% '+a+'%)';}
    if(pp>=1)return 'none';
    b=((pp*2-1)*100).toFixed(2);
    return 'polygon(0% 0%, 100% 0%, 100% '+b+'%, '+b+'% 100%, 0% 100%)';
  }
  // Clip-path for the bottom-right (flat) region.
  function _fc(pp){
    if(pp<=0)return 'none';
    var a,b;
    if(pp<0.5){a=(pp*200).toFixed(2);return 'polygon('+a+'% 0%, 100% 0%, 100% 100%, 0% 100%, 0% '+a+'%)';}
    if(pp>=1)return 'polygon(0% 0%, 0% 0%, 0% 0%)';
    b=((pp*2-1)*100).toFixed(2);
    return 'polygon(100% '+b+'%, 100% 100%, '+b+'% 100%)';
  }
  // Peel angle: phase 1 rises to 70° at pp=1/8, phase 2 corner stays at fixed height.
  // Larger angle = more dramatic lift on small elements with perspective(30px).
  var _SIN70=Math.sin(70*Math.PI/180); // fixed corner height ratio
  function _theta(pp){
    if(pp<=0)return 0;
    if(pp<=1/8)return pp*8*70;
    return Math.asin(Math.min(1,_SIN70/(8*pp)))*180/Math.PI;
  }

  function frame(now){
    if(f.phase!=='peel')return;
    if(!t0)t0=now;
    var elapsed=now-t0;
    if(elapsed<PEEL_MS){
      var pp=_sfEaseOut(elapsed/PEEL_MS);
      var theta=_theta(pp);
      var ox=(pp*100).toFixed(2);
      f.peeledEl.style.clipPath=_pc(pp);
      f.peeledEl.style.transformOrigin=ox+'% '+ox+'%';
      // perspective(30px) on a ~50px cell: corner at 35px from fold midpoint lifts ~12px
      // in screen space at theta=14°, giving clearly visible 3D tilt without needing translateY.
      f.peeledEl.style.transform='perspective(30px) rotate3d(1,-1,0,'+(-theta).toFixed(2)+'deg) scale('+(1+0.25*pp).toFixed(3)+')';
      // filter:drop-shadow renders AFTER clip-path — shadow falls along fold line diagonal.
      var blur=(pp*14).toFixed(1);
      f.peeledEl.style.filter=pp>0.04?'drop-shadow(2px 2px '+blur+'px rgba(0,0,0,0.7))':'';
      f.peeledEl.style.boxShadow='none';
    }else{
      // Flatten phase: sticker drifts down-right to centred position as it rises and expands.
      // translate(-12.5%,-12.5%) scale(1.25) at origin=50%,50% = scale(1.25) at origin=100%,100%
      // so the transition from peel end to flatten start is seamless.
      if(!flatT0){
        flatT0=now;
        f.peeledEl.style.clipPath='none';f.flatEl.style.display='none';
        f.peeledEl.style.transformOrigin='50% 50%';
      }
      var fp=_sfEaseOut(Math.min(1,(now-flatT0)/FLATTEN_MS));
      var tx=(-12.5*(1-fp)).toFixed(2);
      var fS=(1.25+fp*0.15).toFixed(3);
      f.el.style.transform='translateY(-'+(fp*12).toFixed(1)+'px)';
      f.peeledEl.style.transform='translate('+tx+'%,'+tx+'%) scale('+fS+')';
      f.peeledEl.style.filter='drop-shadow(2px 2px 8px rgba(0,0,0,0.5))';
      if(fp>=1){
        f.peeledEl.style.transform='scale(1.4)';
        f._raf=null;if(f.phase==='peel')f.phase='hold';
        if(f._onHold){var _h=f._onHold;f._onHold=null;_h();}
        return;
      }
    }
    f._raf=requestAnimationFrame(frame);
  }
  f._raf=requestAnimationFrame(frame);
}

function _preStickerPeel(sqIdx){
  if(sqIdx==null)return;
  var f=_stickerFloats[sqIdx];
  if(f){
    if(f.phase==='peel'||f.phase==='hold')return;
    // Interrupt descent — re-hide board cell and restart peel from p=0
    if(f._raf){cancelAnimationFrame(f._raf);f._raf=null;}
    if(f.t1){clearTimeout(f.t1);f.t1=null;}
    if(f.t2){clearTimeout(f.t2);f.t2=null;}
    _hideBoardCell(f);
    f.peeledEl.style.animation='none';f.peeledEl.style.clipPath='polygon(0% 0%, 0% 0%, 0% 0%)';
    f.peeledEl.style.transform='';f.peeledEl.style.filter='';f.peeledEl.style.boxShadow='none';
    f.flatEl.style.display=''; // restore full flat sticker for new peel
    f.el.style.animation='none';f.el.style.opacity='1';f.el.style.transform='';
    f.phase='peel';
    requestAnimationFrame(function(){_runPeel(f);});
    return;
  }
  f=_buildStickerFloatEl(sqIdx);
  if(!f)return;
  f.phase='peel';
  _stickerFloats[sqIdx]=f;
  // Two rAFs: let browser commit initial DOM state before starting
  requestAnimationFrame(function(){requestAnimationFrame(function(){_runPeel(f);});});
}

function _activateStickerFloat(sqIdx){
  if(sqIdx==null)return;
  var f=_stickerFloats[sqIdx];
  if(!f){
    f=_buildStickerFloatEl(sqIdx);
    if(!f)return;
    _stickerFloats[sqIdx]=f;
  }
  // Cancel peel/jiggle — ding interrupts whatever state the peel was in
  if(f._raf){cancelAnimationFrame(f._raf);f._raf=null;}
  if(f.t1){clearTimeout(f.t1);f.t1=null;}
  if(f.t2){clearTimeout(f.t2);f.t2=null;}

  // Restore board sticker now so the float has a visible destination to drift back onto.
  _restoreBoardCell(f,sqIdx);

  // At ding: snap directly to centred, elevated, scaled state.
  // origin=50%,50% on an inset:0 element = centred on the board cell.
  f.peeledEl.style.clipPath='none';
  f.flatEl.style.display='none';
  f.el.style.opacity='1';
  f.el.style.animation='none';
  f.el.style.transition='none';
  f.el.style.transform='translateY(-12px)';
  f.peeledEl.style.transition='none';
  f.peeledEl.style.transformOrigin='50% 50%';
  f.peeledEl.style.transform='scale(1.4)';
  f.peeledEl.style.filter='drop-shadow(2px 2px 10px rgba(0,0,0,0.55))';
  f.peeledEl.style.boxShadow='none';
  if(f._onHold){var _h=f._onHold;f._onHold=null;_h();}
  f.phase='hold';

  // Flash glow in sync with ding
  f.glowEl.style.transition='none';
  f.glowEl.style.opacity='1';
  void f.glowEl.offsetWidth;
  f.glowEl.style.transition='opacity 0.32s ease-out';
  f.glowEl.style.opacity='0.15';

  // Hold frozen before drifting down — gives the flash a moment to breathe.
  f.t1=setTimeout(function(){
    if(!_stickerFloats[sqIdx]||_stickerFloats[sqIdx]!==f)return;
    f.phase='descend';
    f.peeledEl.style.transition='none';
    f.peeledEl.style.transform='';
    f.peeledEl.style.animation='_sf-shrink 0.75s ease-out forwards';
    f.peeledEl.style.filter='none';
    f.glowEl.style.transition='opacity 0.2s ease-out';
    f.glowEl.style.opacity='0';
    f.el.style.transition='none';
    f.el.style.animation='_sf-drift 0.85s ease-out forwards';
    f.t2=setTimeout(function(){
      if(!_stickerFloats[sqIdx]||_stickerFloats[sqIdx]!==f)return;
      if(f.el.parentNode)f.el.parentNode.removeChild(f.el);
      if(f.glowEl.parentNode)f.glowEl.parentNode.removeChild(f.glowEl);
      delete _stickerFloats[sqIdx];
    },900);
  },500);
}

// ---- Animation ----

function showScorePop(text,x,y,bg,fg){
  var el=document.createElement('div');el.className='score-pop';
  el.style.cssText='left:'+Math.round(x)+'px;top:'+Math.round(y)+'px;background:'+bg+';color:'+fg;
  el.textContent=text;document.body.appendChild(el);
  setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},700);
}
function bumpSA(id){var el=document.getElementById(id);if(!el)return;el.classList.remove('ls-bump');void el.offsetWidth;el.classList.add('ls-bump');}
function scoreDelay(ms){return new Promise(function(r){setTimeout(r,ms);});}
function fmtMult(m){var r=Math.round(m);if(m>=10||Math.abs(m-r)<0.001)return r.toString();return parseFloat(m.toFixed(2)).toString();}

// Bounces the matching hotbar sticker face(s) when its effect contributes to scoring.
function _bounceTsSticker(id){
  var els=document.querySelectorAll('#tile-sticker-bar .sticker-tile[data-ts-id="'+id+'"]');
  for(var i=0;i<els.length;i++){
    var el=els[i];
    el.classList.remove('sq-binking');
    void el.offsetWidth;
    el.classList.add('sq-binking');
  }
}

// Waits for the sticker peel+flatten to reach 'hold' before the ding fires.
// Starts the peel now if it hasn't been started yet (handles events[0] edge case).
async function _awaitPeelHold(sqIdx){
  if(sqIdx==null)return;
  var f=_stickerFloats[sqIdx];
  if(!f){_preStickerPeel(sqIdx);f=_stickerFloats[sqIdx];}
  if(!f||f.phase!=='peel')return;
  await new Promise(function(r){f._onHold=r;});
}

async function runScoreAnim(events,total){
  var row=document.getElementById('live-score-row');
  var saL=document.getElementById('ls-letters');
  var saM=document.getElementById('ls-mult');
  var saS=document.getElementById('ls-score');
  row.classList.add('scoring');
  saL.textContent='0';saM.textContent='1';saS.textContent='0';

  var delay=1000,minDelay=100,delayStep=50;
  var animPlusSum=0,animXprod=1;_scoreDingN=0;
  var _saLSynced=0; // tracks last value written to saL, to skip redundant isSilent updates
  S._crossroadsLiveCount=S.crossroadsCount||0; // baseline for live tooltip ticks this play

  function refreshMult(){
    var m=(1+animPlusSum)*animXprod;
    saM.textContent=fmtMult(m);
    bumpSA('ls-mult');
  }

  // Consecutive events sharing a floatSqIdx come from the same sticker trigger.
  // Mark all but the first in each run as _skip so they fire their effects in the
  // same beat as the primary event (no extra ding, no extra delay, no re-activation).
  for(var _gi=0;_gi<events.length-1;_gi++){
    if(events[_gi].floatSqIdx!=null&&events[_gi+1].floatSqIdx===events[_gi].floatSqIdx){
      events[_gi+1]._skip=true;
    }
  }

  // Pre-schedule every sticker peel 1 second before its own ding, regardless of word length.
  // Simulates cumulative event timing (ding fires before its own delay, after all prior delays).
  var _PEEL_LEAD=1000,_simD=delay,_simT=0;
  for(var _si=0;_si<events.length;_si++){
    var _sev=events[_si];
    if(_sev.floatSqIdx!=null&&!_sev._skip){
      (function(sqIdx,t){setTimeout(function(){_preStickerPeel(sqIdx);},Math.max(0,t-_PEEL_LEAD));})(
        _sev.floatSqIdx,_simT);
    }
    if(!_sev._skip&&_sev.type!=='final'&&!_sev.isSilent&&!_sev.suppressVisual){
      var _sd=_simD;_simD=Math.max(minDelay,_simD-delayStep);
      _simT+=(_sev.type==='retrigger')?Math.max(minDelay,_sd*0.6):
             (_sev.type==='final-transform')?Math.max(200,_sd):_sd;
    }
  }

  for(var i=0;i<events.length;i++){
    var ev=events[i];

    if(ev.type==='letter'){
      if(ev.isSilent){
        if(ev.lettersAfter!==_saLSynced){saL.textContent=ev.lettersAfter;bumpSA('ls-letters');_saLSynced=ev.lettersAfter;}
      }else if(ev.suppressVisual){
        await scoreDelay(1);
      }else{
        if(!ev._skip){var curDelay=delay;delay=Math.max(minDelay,delay-delayStep);}
        var tileEl=ev.sqIdx!=null?(document.querySelector('[data-sq-idx="'+ev.sqIdx+'"] .board-tile.jenga-stacked')||document.querySelector('[data-sq-idx="'+ev.sqIdx+'"] .board-tile')):null;
        var r=tileEl?tileEl.getBoundingClientRect():null;
        if(ev.floatSqIdx!=null&&!ev._skip)await _awaitPeelHold(ev.floatSqIdx);
        if(!ev._skip)_playScoreDing();
        if(ev.floatSqIdx!=null&&!ev._skip)_activateStickerFloat(ev.floatSqIdx);
        if(ev.floatTsId&&!ev._skip)_bounceTsSticker(ev.floatTsId);
        if(tileEl&&!ev._skip){tileEl.classList.remove('binking');void tileEl.offsetWidth;tileEl.classList.add('binking');}
        if(ev.isTileLocal){
          if(r)showScorePop(ev.lettersAfter,r.left+r.width/2-20,r.top-4,'#0d2a50','#80c8ff');
          if(ev._globalLetters!=null&&!ev._skip){saL.textContent=ev._globalLetters;bumpSA('ls-letters');_saLSynced=ev._globalLetters;}
        }else{
          saL.textContent=ev.lettersAfter;bumpSA('ls-letters');_saLSynced=ev.lettersAfter;
        }
        if(!ev._skip){await scoreDelay(curDelay);}
      }

    }else if(ev.type==='plus-mult'){
      if(!ev._skip){var curDelay=delay;delay=Math.max(minDelay,delay-delayStep);}
      if(ev.floatSqIdx!=null&&!ev._skip)await _awaitPeelHold(ev.floatSqIdx);
      if(!ev._skip&&!ev.silent)_playScoreDing();
      if(ev.floatSqIdx!=null&&!ev._skip)_activateStickerFloat(ev.floatSqIdx);
      if(ev.floatTsId&&!ev._skip)_bounceTsSticker(ev.floatTsId);
      var br=row.getBoundingClientRect();
      showScorePop('+'+ev.delta+' mult',br.left+100,br.top-32,'#500808','#ff8080');
      animPlusSum+=ev.delta;
      refreshMult();
      if(!ev._skip){await scoreDelay(curDelay);}

    }else if(ev.type==='crossword-tick'){
      // Display-only: bumps Crossroads' live preview counter so a hovered tooltip steps up
      // as each crossword finishes scoring, even though the real mult applies later as one
      // event in the post-word phase (see crossroads' onPostWord in data.js).
      S._crossroadsLiveCount=(S._crossroadsLiveCount||0)+1;
      _tooltipRefreshIfOpen();

    }else if(ev.type==='x-mult'){
      if(!ev._skip){var curDelay=delay;delay=Math.max(minDelay,delay-delayStep);}
      var tileEl2=ev.sqIdx!=null?(document.querySelector('[data-sq-idx="'+ev.sqIdx+'"] .board-tile.jenga-stacked')||document.querySelector('[data-sq-idx="'+ev.sqIdx+'"] .board-tile')):null;
      var r2=tileEl2?tileEl2.getBoundingClientRect():null;
      if(ev.floatSqIdx!=null&&!ev._skip)await _awaitPeelHold(ev.floatSqIdx);
      if(!ev._skip)_playScoreDing();
      if(ev.floatSqIdx!=null&&!ev._skip)_activateStickerFloat(ev.floatSqIdx);
      if(ev.floatTsId&&!ev._skip)_bounceTsSticker(ev.floatTsId);
      if(r2)showScorePop(ev.factor,r2.left+r2.width/2-20,r2.top-4,'#500808','#ff6060');
      else{var br2=row.getBoundingClientRect();showScorePop(ev.factor+' mult',br2.left+100,br2.top-32,'#500808','#ff6060');}
      if(tileEl2&&!ev._skip){tileEl2.classList.remove('binking');void tileEl2.offsetWidth;tileEl2.classList.add('binking');}
      animXprod*=ev.factor;
      refreshMult();
      if(!ev._skip){await scoreDelay(curDelay);}

    }else if(ev.type==='gold'){
      if(!ev._skip){var curDelay=delay;delay=Math.max(minDelay,delay-delayStep);}
      if(ev.floatSqIdx!=null&&!ev._skip)await _awaitPeelHold(ev.floatSqIdx);
      if(!ev._skip)_playScoreDing();
      if(ev.floatSqIdx!=null&&!ev._skip)_activateStickerFloat(ev.floatSqIdx);
      var br3=row.getBoundingClientRect();
      showScorePop('+$'+ev.delta,br3.left+24,br3.top-32,'#3a2800','#f0c060');
      if(!ev._skip){await scoreDelay(curDelay);}

    }else if(ev.type==='retrigger'){
      if(!ev._skip){var curDelay=delay;delay=Math.max(minDelay,delay-delayStep);}
      var tileEl3=ev.sqIdx!=null?(document.querySelector('[data-sq-idx="'+ev.sqIdx+'"] .board-tile.jenga-stacked')||document.querySelector('[data-sq-idx="'+ev.sqIdx+'"] .board-tile')):null;
      if(ev.floatSqIdx!=null&&!ev._skip)await _awaitPeelHold(ev.floatSqIdx);
      if(!ev._skip)_playScoreDing();
      if(ev.floatSqIdx!=null&&!ev._skip)_activateStickerFloat(ev.floatSqIdx);
      if(tileEl3&&!ev._skip){tileEl3.classList.remove('binking');void tileEl3.offsetWidth;tileEl3.classList.add('binking');}
      var br5=row.getBoundingClientRect();
      showScorePop(ev.label+'!',br5.left+60,br5.top-32,'#1a0a2a','#c080ff');
      if(!ev._skip){await scoreDelay(Math.max(minDelay,curDelay*0.6));}

    }else if(ev.type==='final-transform'){
      if(!ev._skip){var curDelay=delay;delay=Math.max(minDelay,delay-delayStep);}
      if(!ev._skip)_playScoreDing();
      if(ev.floatTsId&&!ev._skip)_bounceTsSticker(ev.floatTsId);
      if(ev.palMult&&ev.palMult>1&&!ev._skip){animXprod*=ev.palMult;refreshMult();}
      var br4=row.getBoundingClientRect();
      showScorePop(ev.label,br4.left+60,br4.top-48,'#0a2a2a','#60ffff');
      if(!ev._skip){await scoreDelay(Math.max(200,curDelay));}

    }else if(ev.type==='final'){
      saL.textContent=ev.letters;
      saM.textContent=fmtMult(ev.displayMult||ev.mult);
      saS.textContent=total.toLocaleString();bumpSA('ls-score');
    }
  }

  await scoreDelay(600);

  // Animate score into progress bar
  var _oldScore=S.score,_tgt=tgt();
  var _bar=document.getElementById('score-bar');
  var _runP=document.getElementById('run-progress');
  var _startPct=Math.min(100,_oldScore/_tgt*100);
  var _endPct=Math.min(100,(_oldScore+total)/_tgt*100);
  if(_bar){_bar.style.transition='none';_bar.style.height=_startPct+'%';}
  await new Promise(function(res2){
    var _start=performance.now(),DUR=2000;
    function _tick(now){
      var t=Math.min(1,(now-_start)/DUR);
      var _cur=Math.round(total*(1-t));
      saS.textContent=_cur.toLocaleString();
      if(_bar)_bar.style.height=(_startPct+(_endPct-_startPct)*t)+'%';
      if(_runP)_runP.textContent=Math.round(_oldScore+total*t).toLocaleString()+' / '+_tgt.toLocaleString();
      if(t<1){requestAnimationFrame(_tick);}else{saS.textContent='0';res2();}
    }
    requestAnimationFrame(_tick);
  });
  if(_bar)_bar.style.transition='height .6s cubic-bezier(.22,1,.36,1)';
  saL.textContent='0';saM.textContent='1';
  row.classList.remove('scoring');
}

function updateLiveScore(){
  var lsC=document.getElementById('ls-letters'),lsM=document.getElementById('ls-mult'),lsS=document.getElementById('ls-score');
  if(!lsC||!lsM||!lsS)return;
  var nt=newTiles();
  if(!nt.length){lsC.textContent='0';lsM.textContent='1';lsS.textContent='0';return;}
  var dir=wordDir(nt);
  if(!dir){lsC.textContent='0';lsM.textContent='1';lsS.textContent='0';return;}
  var a=nt[0];var main=extractAt(a.row,a.col,dir);
  if(!main||main.word.length<2){lsC.textContent='0';lsM.textContent='1';lsS.textContent='0';return;}
  var res=scorePlay(nt,dir,true);
  if(!res){lsC.textContent='0';lsM.textContent='1';lsS.textContent='0';return;}
  lsC.textContent=res.letters;
  lsM.textContent=fmtMult(res.mult);
  lsS.textContent=res.total.toLocaleString();
}
