// =====================================================================
// SCORING v2 — bracket-based cumulative letter/mult tracking
//
// Letter score (L) and mult score (M) are separate tracks:
//   Final: total = round(L × (1 + sum(plusMults)) × product(xmults))
//
// Per tile (brackets 1-6, run for every tile in every word):
//   1. Base letter score added to L
//   2. Local +letter  (sticker on same sq, cooldown-gated)
//   3. Global +letter (Commons, Censor, Blue bonus)
//   4. Local ×letter + local xmult (DL/TL → ×L; DW/TW → push xmult)
//   5. Global ×letter (Knight ×3, Magnet ×2, Lex Eye ×2, Rune)
//   6. Retrigger      (Echo: loops 1-5; Red: loops 1-5; both respect cooldown gate)
//
// Post-word (run once after all tiles across all words):
//   Global +letter : Midas, Bounty flat chips, Bingo +50
//   Local  +mult   : Anchor (on activated square only)
//   Global +mult   : Scholar, Aristocrat, Lucky Blank, Babel, Pressure Cooker, tile-count
//   Global  xmult  : Quill, Tome, Bounty Hunter, Slot Machine
//   Final transform: Palindrome Engine ×2
//
// Word order: cross words scored before main word (per-tile only).
// Both contribute to the same L / plusMults / xmults accumulators.
//
// Cooldowns: local effects are gated by S.localCooldowns (a Set of sqIdx).
// Within one play no flags are set — a square can fire multiple times
// (e.g. Red on DW in two words → DW fires 4×). After scorePlay() commits,
// every activated square is added to S.localCooldowns, which persists
// until clearBoardLetters() resets it (between stages).
// =====================================================================

function newTiles(){
  var r=[];
  for(var i=0;i<B*B;i++){
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
    var si=dir==='h'?ar*B+p:p*B+ac,bt=S.bt[si];
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
    anchorActivations:0,
    slotUsed:false, preview:false,
    // sticker flags/counts populated below
    commonsCount:0,censorCount:0,scholarCount:0,aristocratCount:0,luckyBlankCount:0,
    magnetIdxs:[],chessPieces:[],chessKingActive:false,
    lexEye:false,purist:false,rune:false,
    quill:false,
    midas:false,inkwells:0,gildedInkwells:0,babel:false,
    pressureCooker:S.discPressure||0,
    bh:S.bhMult||1,
  };
  for(var i=0;i<S.placed.length;i++){
    var p=S.placed[i];
    switch(p.id){
      case'the_commons':ctx.commonsCount++;break;
      case'censor':ctx.censorCount++;break;
      case'scholar':ctx.scholarCount++;break;
      case'aristocrat':ctx.aristocratCount++;break;
      case'lucky_blank':ctx.luckyBlankCount++;break;
      case'magnet':ctx.magnetIdxs.push(p.sqIdx);break;
      case'chess_king':ctx.chessKingActive=true;break;
      case'chess_knight':case'chess_bishop':case'chess_rook':case'chess_queen':
        ctx.chessPieces.push({sqIdx:p.sqIdx,id:p.id,aura:chessGetAura(p.sqIdx,p.id)});break;
      case'lexicon_s_eye':ctx.lexEye=true;break;
      case'the_purist':ctx.purist=true;break;
      case'rune':ctx.rune=true;break;
      case'midas_touch':ctx.midas=true;break;
      case'inkwell':ctx.inkwells++;break;
      case'gilded_inkwell':ctx.gildedInkwells++;break;
      case'babel':ctx.babel=true;break;
      case'quill':ctx.quill=(S.wtr===0);break;
    }
  }
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
  if(tile.variant==='blue'&&!tile.isBlank)baseSc+=(tile.blueBonus||0);
  ts+=baseSc;
  ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,
    label:tile.letter+(tile.isBlank?' (blank)':'')});

  // --- Bracket 2: local additive (cooldown-gated) ---
  if(sqActive&&sqDef){
    var acted=false;
    if(sqDef.id==='vowel_shrine'&&'AEIOU'.indexOf(tile.letter)>=0){
      ts*=4;
      ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'Vowel Shrine ×4'});
      acted=true;
    }else if(sqDef.id==='consonant_shrine'&&tile.letter&&'AEIOU?_'.indexOf(tile.letter)<0){
      ts*=4;
      ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'Consonant Shrine ×4'});
      acted=true;
    }else if(sqDef.id==='void'){
      ts-=baseSc;
      ctx.plusMults.push(2);
      ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'Void (0 pts)'});
      ctx.events.push({type:'plus-mult',delta:2,label:'Void +2 mult'});
      acted=true;
    }else if(sqDef.id==='jackpot'){
      if(!ctx.preview&&_rng()<0.05){
        ts*=10;
        ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'Jackpot! ×10'});
      }
      acted=true;
    }else if(sqDef.id==='fossil'&&!tile.isNew){
      ts+=baseSc*2;
      ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'Fossil ×3'});
    }else if(sqDef.id==='gilded'){
      ctx.tgold++;
      ctx.events.push({type:'gold',delta:1,sqIdx:sqIdx,label:'Gilded +$1'});
      acted=true;
    }else if(sqDef.id==='anchor'&&ctx.mainWord.length>=5){
      ctx.anchorActivations++;
      acted=true;
    }
    if(acted&&!ctx.preview)ctx.activatedSqs.add(sqIdx);
  }

  // --- Bracket 3: global additive ---
  if(ctx.commonsCount>0&&!tile.isBlank&&tileSc===1){
    var cb3=ctx.commonsCount*3;
    ts+=cb3;
    ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'Commons +'+cb3});
  }
  if(ctx.censorCount>0){
    var cb3b=ctx.censorCount*2;
    ts+=cb3b;
    ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'Censor +'+cb3b});
  }
  if(tile.variant==='gold'){
    ctx.tgold++;
    ctx.events.push({type:'gold',delta:1,sqIdx:sqIdx,label:'Gold tile +$1'});
  }

  // --- Bracket 4: local ×letter (DL/TL) + local xmult (DW/TW) ---
  if(sqActive&&sqDef&&sqDef.bm){
    var bm=sqDef.bm;
    if(bm==='dl'||bm==='tl'){
      var f4=bm==='dl'?(ctx.purist?4:2):(ctx.purist?9:3);
      ts*=f4;
      ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:sqDef.name+' ×'+f4});
      if(!ctx.preview)ctx.activatedSqs.add(sqIdx);
    }
    if(bm==='dw'||bm==='tw'){
      var f4b=bm==='dw'?(ctx.purist?4:2):(ctx.purist?9:3);
      ctx.xmults.push(f4b);
      ctx.events.push({type:'x-mult',factor:f4b,sqIdx:sqIdx,label:sqDef.name+' ×'+f4b});
      if(!ctx.preview)ctx.activatedSqs.add(sqIdx);
    }
  }

  // --- Bracket 5: global ×letter (Magnet, Chess, Lex Eye, Rune) ---
  for(var mi=0;mi<ctx.magnetIdxs.length;mi++){
    if(adjSq(sqIdx,ctx.magnetIdxs[mi])){
      ts*=2;
      ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'Magnet ×2'});
      break;
    }
  }
  for(var ci=0;ci<ctx.chessPieces.length;ci++){
    var aura=ctx.chessPieces[ci].aura;
    var inAura=false;
    for(var cj=0;cj<aura.length;cj++)if(sqIdx===aura[cj]){inAura=true;break;}
    if(inAura){
      ts*=3;
      ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'♟ ×3'});
      if(ctx.chessKingActive&&tile.isNew){
        ctx.xmults.push(3);
        ctx.events.push({type:'x-mult',factor:3,sqIdx:sqIdx,label:'♚ King ×3'});
      }
      break;
    }
  }
  if(ctx.lexEye&&!tile.isBlank&&'QXZJ'.indexOf(tile.letter)>=0){
    ts*=2;
    ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'Lex Eye ×2'});
  }
  if(ctx.rune&&tile.isBlank){
    ts+=10;
    ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'Rune +10'});
  }

  // Slot Machine (fires once per play)
  if(sqActive&&sqDef&&sqDef.id==='slot_machine'&&!ctx.slotUsed){
    ctx.slotUsed=true;
    if(!ctx.preview&&!S._slotMachineRoll){
      var roll={wm_mult:1,gold:0,variant:null,parts:[]};
      if(Math.random()<0.50){roll.wm_mult*=2;roll.parts.push('×2 mult');}
      if(Math.random()<0.05){roll.wm_mult*=10;roll.parts.push('×10 mult');}
      if(Math.random()<0.30){roll.gold+=3;roll.parts.push('+$3');}
      if(Math.random()<0.05){roll.gold+=10;roll.parts.push('+$10');}
      if(Math.random()<0.01){var v=Math.random();roll.variant=v<1/3?'red':v<2/3?'blue':'gold';roll.parts.push('All '+roll.variant+'!');}
      S._slotMachineRoll=roll;
      if(roll.parts.length)(function(p){setTimeout(function(){toast('🎰 Slot: '+p);},400);})(roll.parts.join(' | '));
    }
    if(!ctx.preview)ctx.activatedSqs.add(sqIdx);
  }

  // --- Bracket 6: retrigger (Echo, Red) ---
  // Continues from current ts — does NOT reset to 0.
  if(!skipRetrigger){
    if(sqActive&&sqDef&&sqDef.id==='echo'){
      if(!ctx.preview)ctx.activatedSqs.add(sqIdx);
      ctx.events.push({type:'retrigger',sqIdx:sqIdx,label:'Echo'});
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
  var ts=_scoreTilePasses(tile,ctx,0,skipRetrigger);
  ctx.letters+=ts;
  ctx.events.push({type:'letter',lettersAfter:ctx.letters});
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
  if(!preview)S._slotMachineRoll=null;

  // Tile-count base +mult — established before any per-tile scoring
  if(ctx.newTileCount>=4){
    var _tcb=ctx.newTileCount-3;
    ctx.plusMults.push(_tcb);
    ctx.events.push({type:'plus-mult',delta:_tcb,label:ctx.newTileCount+' tiles +'+_tcb+' mult'});
  }

  var bingo=nt.length>=7;

  // Extract cross words
  var cx=dir==='h'?'v':'h';
  var crossWords=[];
  var seen={};
  for(var i=0;i<nt.length;i++){
    var k=nt[i].row+','+nt[i].col;if(seen[k])continue;seen[k]=1;
    var cxw=extractAt(nt[i].row,nt[i].col,cx);
    if(cxw&&cxw.tiles.length>=2)crossWords.push(cxw);
  }

  // Score cross words first (per-tile brackets 1-6)
  for(var ci=0;ci<crossWords.length;ci++){
    var cwtiles=crossWords[ci].tiles;
    for(var ti=0;ti<cwtiles.length;ti++)_scoreTile(cwtiles[ti],ctx,false);
  }
  // Score main word (per-tile brackets 1-6)
  for(var ti=0;ti<main.tiles.length;ti++)_scoreTile(main.tiles[ti],ctx,false);

  // ---- POST-WORD PHASE ----

  // Global +letter
  if(ctx.midas&&ctx.maxSc>0){
    var mb=ctx.maxSc*2;
    ctx.letters+=mb;
    ctx.events.push({type:'letter',lettersAfter:ctx.letters,label:'Midas Touch +'+(ctx.maxSc*2)});
  }
  if(bingo){
    ctx.letters+=50;
    ctx.events.push({type:'letter',lettersAfter:ctx.letters,label:'Bingo +50'});
  }
  for(var i=0;i<S.placed.length;i++){
    if(S.placed[i].id==='bounty'&&main.word.length>5){
      var bc=(main.word.length-5)*10;
      ctx.letters+=bc;
      ctx.events.push({type:'letter',lettersAfter:ctx.letters,label:'Bounty +'+bc});
      break;
    }
  }

  // Local +mult (Anchor — fires once per activation on its square)
  if(ctx.anchorActivations>0){
    var ad=ctx.anchorActivations*3;
    ctx.plusMults.push(ad);
    ctx.events.push({type:'plus-mult',delta:ad,label:'Anchor +'+ad+' mult'});
  }

  // Global +mult
  if(ctx.scholarCount>0&&ctx.allSc1){
    var sd=ctx.scholarCount*6;
    ctx.plusMults.push(sd);
    ctx.events.push({type:'plus-mult',delta:sd,label:'Scholar +'+sd+' mult'});
  }
  if(ctx.aristocratCount>0&&ctx.anyHigh){
    var ard=ctx.aristocratCount*5;
    ctx.plusMults.push(ard);
    ctx.events.push({type:'plus-mult',delta:ard,label:'Aristocrat +'+ard+' mult'});
  }
  if(ctx.luckyBlankCount>0&&ctx.blankCt>0){
    var lbd=ctx.luckyBlankCount*ctx.blankCt*3;
    ctx.plusMults.push(lbd);
    ctx.events.push({type:'plus-mult',delta:lbd,label:'Lucky Blank +'+lbd+' mult'});
  }
  if(ctx.babel&&main.word.length>=6){
    ctx.plusMults.push(2);
    ctx.events.push({type:'plus-mult',delta:2,label:'Babel +2 mult'});
  }
  if(ctx.pressureCooker>0){
    ctx.plusMults.push(ctx.pressureCooker);
    ctx.events.push({type:'plus-mult',delta:ctx.pressureCooker,label:'Pressure Cooker +'+ctx.pressureCooker+' mult'});
  }
  // Gold from inkwells
  if(ctx.inkwells>0){
    ctx.tgold+=ctx.inkwells;
    ctx.events.push({type:'gold',delta:ctx.inkwells,label:'Inkwell +$'+ctx.inkwells});
  }
  if(ctx.gildedInkwells>0){
    var giGold=ctx.gildedInkwells*(main.word.length<4?1:2);
    ctx.tgold+=giGold;
    ctx.events.push({type:'gold',delta:giGold,label:'Gilded Inkwell +$'+giGold});
  }
  if(bingo){for(var i=0;i<S.placed.length;i++)if(S.placed[i].id==='tectonic'){ctx.tgold+=3;break;}}

  // Global xmult
  if(ctx.quill){
    ctx.xmults.push(2);
    ctx.events.push({type:'x-mult',factor:2,label:'Quill ×2 (first word)'});
  }
  if((S.ts||0)>0){
    var tf=1+S.ts;
    ctx.xmults.push(tf);
    ctx.events.push({type:'x-mult',factor:tf,label:'Tome ×'+tf});
  }
  if(ctx.bh>1){
    ctx.xmults.push(ctx.bh);
    ctx.events.push({type:'x-mult',factor:parseFloat(ctx.bh.toFixed(2)),label:'Bounty Hunter ×'+ctx.bh.toFixed(2)});
  }
  if(!preview&&ctx.slotUsed&&S._slotMachineRoll){
    var smr=S._slotMachineRoll;
    if(smr.wm_mult>1){
      ctx.xmults.push(smr.wm_mult);
      ctx.events.push({type:'x-mult',factor:smr.wm_mult,label:'Slot ×'+smr.wm_mult});
    }
    if(smr.gold>0){ctx.tgold+=smr.gold;ctx.events.push({type:'gold',delta:smr.gold,label:'Slot +$'+smr.gold});}
  }

  // Final calculation
  var plusSum=0;for(var i=0;i<ctx.plusMults.length;i++)plusSum+=ctx.plusMults[i];
  var xprod=1;for(var i=0;i<ctx.xmults.length;i++)xprod*=ctx.xmults[i];
  var mult=(1+plusSum)*xprod;
  var total=Math.round(ctx.letters*mult);

  // Palindrome Engine ×2
  if(isExtendedPalindrome(main.word)){
    for(var i=0;i<S.placed.length;i++){
      if(S.placed[i].id==='palindrome_engine'){
        total*=2;
        ctx.events.push({type:'final-transform',label:'Palindrome! ×2',total:total});
        break;
      }
    }
  }

  ctx.events.push({type:'final',letters:ctx.letters,plusSum:plusSum,xprod:xprod,mult:mult,total:total});

  // Commit cooldowns (non-preview only)
  if(!preview)ctx.activatedSqs.forEach(function(sq){S.localCooldowns.add(sq);});

  return{
    total:total,tgold:ctx.tgold,events:ctx.events,
    mainWord:main.word,bingo:bingo,
    letters:ctx.letters,plusMults:ctx.plusMults,xmults:ctx.xmults,mult:mult,
    allWords:getAllWords(nt,dir),
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
  if(isMain){
    if(ctx.midas&&ctx.maxSc>0)ctx.letters+=ctx.maxSc*2;
    if(ctx.scholarCount>0&&ctx.allSc1)ctx.plusMults.push(ctx.scholarCount*6);
    if(ctx.aristocratCount>0&&ctx.anyHigh)ctx.plusMults.push(ctx.aristocratCount*5);
    if(ctx.luckyBlankCount>0&&ctx.blankCt>0)ctx.plusMults.push(ctx.luckyBlankCount*ctx.blankCt*3);
    if(ctx.babel&&word.length>=6)ctx.plusMults.push(2);
    if(ctx.pressureCooker>0)ctx.plusMults.push(ctx.pressureCooker);
    if(ctx.quill)ctx.xmults.push(2);
    if((S.ts||0)>0)ctx.xmults.push(1+S.ts);
    if(ctx.bh>1)ctx.xmults.push(ctx.bh);
    if(ctx.anchorActivations>0)ctx.plusMults.push(ctx.anchorActivations*3);
  }
  var plusSum=0;for(var i=0;i<ctx.plusMults.length;i++)plusSum+=ctx.plusMults[i];
  var xprod=1;for(var i=0;i<ctx.xmults.length;i++)xprod*=ctx.xmults[i];
  var mult=(1+plusSum)*xprod;
  var total=Math.round(ctx.letters*mult);
  if(isMain&&isExtendedPalindrome(word)){
    for(var i=0;i<S.placed.length;i++)if(S.placed[i].id==='palindrome_engine'){total*=2;break;}
  }
  return{letters:ctx.letters,mult:mult,total:total,gold:ctx.tgold};
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

async function runScoreAnim(events,total){
  var row=document.getElementById('live-score-row');
  var saL=document.getElementById('ls-letters');
  var saM=document.getElementById('ls-mult');
  var saS=document.getElementById('ls-score');
  row.classList.add('scoring');
  saL.textContent='0';saM.textContent='1';saS.textContent='0';

  var delay=500,minDelay=50;
  var animPlusSum=0,animXprod=1;

  function refreshMult(){
    var m=(1+animPlusSum)*animXprod;
    saM.textContent=fmtMult(m);
    bumpSA('ls-mult');
  }

  for(var i=0;i<events.length;i++){
    var ev=events[i];
    var curDelay=Math.max(minDelay,delay);
    delay*=(ev.type==='letter'?0.93:0.72);

    if(ev.type==='letter'){
      var tileEl=ev.sqIdx!=null?document.querySelector('[data-sq-idx="'+ev.sqIdx+'"] .board-tile'):null;
      var r=tileEl?tileEl.getBoundingClientRect():null;
      if(tileEl){tileEl.classList.remove('binking');void tileEl.offsetWidth;tileEl.classList.add('binking');}
      if(ev.isTileLocal){
        // Tile-local bracket step: show pop at tile, hold off on saL
        if(r)showScorePop(ev.lettersAfter,r.left+r.width/2-20,r.top-4,'#0d2a50','#80c8ff');
      }else{
        // Tile complete: advance saL to running word total
        saL.textContent=ev.lettersAfter;bumpSA('ls-letters');
      }
      await scoreDelay(curDelay);

    }else if(ev.type==='plus-mult'){
      var br=row.getBoundingClientRect();
      showScorePop('+'+ev.delta+' mult',br.left+100,br.top-32,'#500808','#ff8080');
      animPlusSum+=ev.delta;
      refreshMult();
      await scoreDelay(curDelay);

    }else if(ev.type==='x-mult'){
      var tileEl2=ev.sqIdx!=null?document.querySelector('[data-sq-idx="'+ev.sqIdx+'"] .board-tile'):null;
      var r2=tileEl2?tileEl2.getBoundingClientRect():null;
      if(r2)showScorePop(ev.factor,r2.left+r2.width/2-20,r2.top-4,'#500808','#ff6060');
      else{var br2=row.getBoundingClientRect();showScorePop(ev.factor+' mult',br2.left+100,br2.top-32,'#500808','#ff6060');}
      if(tileEl2){tileEl2.classList.remove('binking');void tileEl2.offsetWidth;tileEl2.classList.add('binking');}
      animXprod*=ev.factor;
      refreshMult();
      await scoreDelay(curDelay);

    }else if(ev.type==='gold'){
      var br3=row.getBoundingClientRect();
      showScorePop('+$'+ev.delta,br3.left+24,br3.top-32,'#3a2800','#f0c060');
      await scoreDelay(curDelay);

    }else if(ev.type==='retrigger'){
      var tileEl3=ev.sqIdx!=null?document.querySelector('[data-sq-idx="'+ev.sqIdx+'"] .board-tile'):null;
      if(tileEl3){tileEl3.classList.remove('binking');void tileEl3.offsetWidth;tileEl3.classList.add('binking');}
      var br5=row.getBoundingClientRect();
      showScorePop(ev.label+'!',br5.left+60,br5.top-32,'#1a0a2a','#c080ff');
      await scoreDelay(Math.max(minDelay,curDelay*0.6));

    }else if(ev.type==='final-transform'){
      var br4=row.getBoundingClientRect();
      showScorePop(ev.label,br4.left+60,br4.top-48,'#0a2a2a','#60ffff');
      await scoreDelay(Math.max(200,curDelay));

    }else if(ev.type==='final'){
      saL.textContent=ev.letters;
      saM.textContent=fmtMult(ev.mult);
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
