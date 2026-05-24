// =====================================================================
// SCORING — word extraction, scoring phases, animation
// "letters" = the raw letter-score accumulator (was "chips")
// Three phases: PRE (flags) → tile loop → POST (accumulate) → FINAL (transform)
// =====================================================================
function newTiles(){var r=[];for(var i=0;i<B*B;i++){var t=S.bt[i];if(t&&t.isNew)r.push({idx:i,row:Math.floor(i/B),col:i%B,letter:t.letter,isBlank:t.isBlank,sc:t.isBlank?(t.alchSc||0):(LS[t.letter]||0)});}return r;}

function wordDir(nt){
  if(!nt.length)return null;
  if(nt.length===1){
    var r=nt[0].row,c=nt[0].col;
    var hasV=!!(S.bt[(r-1)*B+c]||S.bt[(r+1)*B+c]);
    var hasH=!!(S.bt[r*B+(c-1)]||S.bt[r*B+(c+1)]);
    if(hasV&&!hasH)return'v';
    return'h';
  }
  var rows={},cols={};for(var i=0;i<nt.length;i++){rows[nt[i].row]=1;cols[nt[i].col]=1;}
  if(Object.keys(rows).length===1)return'h';if(Object.keys(cols).length===1)return'v';return null;
}

function extractAt(ar,ac,dir){
  var pos=dir==='h'?ac:ar;
  while(pos>0){var p=dir==='h'?ar*B+(pos-1):(pos-1)*B+ac;if(S.bt[p])pos--;else break;}
  var start=pos;pos=dir==='h'?ac:ar;
  while(pos<B-1){var p=dir==='h'?ar*B+(pos+1):(pos+1)*B+ac;if(S.bt[p])pos++;else break;}
  var end=pos;if(start===end)return null;
  var wt=[];
  for(var p=start;p<=end;p++){
    var si=dir==='h'?ar*B+p:p*B+ac,bt=S.bt[si];if(!bt)return null;
    wt.push({idx:si,letter:bt.letter,isNew:!!bt.isNew,isBlank:!!bt.isBlank,sc:bt.isBlank?(bt.alchSc||0):(LS[bt.letter]||0),sid:S.board[si],variant:bt.variant||null,blueBonus:bt.blueBonus||0});
  }
  return{word:wt.map(function(t){return t.letter;}).join(''),tiles:wt};
}

function sortedPlaced(){return S.placed.slice().sort(function(a,b){var pa=(sqd(a.id)||{}).priority||0,pb=(sqd(b.id)||{}).priority||0;return pb-pa;});}

function scoreWord(wt,word,isMain,extraChips){
  var st={gold:0,gm:0,am:0,gc:0,wtr:S.wtr,ts:S.ts};var letters=0,wm=1,em=0;
  var placed=isMain?sortedPlaced():[];
  // PRE phase: set flags the tile loop reads
  if(isMain)for(var i=0;i<placed.length;i++){var d=sqd(placed[i].id);if(d&&d.onPre)d.onPre(word,st);}
  if(S.ts>0)em+=S.ts;
  var maxLS=Math.max.apply(null,Object.keys(LS).map(function(k){return LS[k];}));
  var magnetIdxs=[];for(var i=0;i<S.placed.length;i++){if(S.placed[i].id==='magnet')magnetIdxs.push(S.placed[i].sqIdx);}
  var chessKingActive=false;for(var i=0;i<S.placed.length;i++){if(S.placed[i].id==='chess_king'){chessKingActive=true;break;}}
  var chessPieces=[];for(var i=0;i<S.placed.length;i++){var _pid=S.placed[i].id;if(_pid==='chess_knight'||_pid==='chess_bishop'||_pid==='chess_rook'||_pid==='chess_queen'){chessPieces.push({sqIdx:S.placed[i].sqIdx,id:_pid,aura:chessGetAura(S.placed[i].sqIdx,_pid)});}}
  var commonsCount=0,censorCount=0,scholarCount=0,aristocratCount=0,luckyBlankCount=0;
  for(var _sci=0;_sci<S.placed.length;_sci++){var _scId=S.placed[_sci].id;if(_scId==='the_commons')commonsCount++;else if(_scId==='censor')censorCount++;else if(_scId==='scholar')scholarCount++;else if(_scId==='aristocrat')aristocratCount++;else if(_scId==='lucky_blank')luckyBlankCount++;}
  var midasMax=0;
  for(var i=0;i<wt.length;i++){
    var t=wt[i],tc=t.sc,d=t.sid?sqd(t.sid):null;
    if(t.variant==='blue'&&!t.isBlank)tc+=(t.blueBonus||0);
    if(t.variant==='gold')st.gold=(st.gold||0)+1;
    if(st.lxeye&&'QXZJ'.indexOf(t.letter)>=0)tc*=2;
    if(commonsCount>0&&t.sc===1)tc+=commonsCount*3;
    if(censorCount>0)tc+=censorCount*2;
    if(t.isNew&&d&&d.bm){
      if(d.bm==='dl'){tc*=2;if(st.purist)tc*=2;}
      else if(d.bm==='tl'){tc*=3;if(st.purist)tc*=3;}
      else if(d.bm==='dw'){wm*=2;if(st.purist)wm*=2;}
      else if(d.bm==='tw'){wm*=3;if(st.purist)wm*=3;}
    }
    if(d&&d.apply&&(t.isNew||d.applyAlways)){var res=d.apply(tc,t,word,st);tc+=res.cb||0;em+=res.mb||0;}
    if(t.isBlank&&st.rune)tc+=maxLS;
    for(var mi=0;mi<magnetIdxs.length;mi++){if(adjSq(t.idx,magnetIdxs[mi])){tc*=2;break;}}
    for(var ci=0;ci<chessPieces.length;ci++){var _cau=chessPieces[ci].aura;for(var _cj=0;_cj<_cau.length;_cj++){if(t.idx===_cau[_cj]){tc*=3;break;}}}
    if(chessKingActive&&t.isNew){for(var ci=0;ci<chessPieces.length;ci++){var _cau2=chessPieces[ci].aura;for(var _cj2=0;_cj2<_cau2.length;_cj2++){if(t.idx===_cau2[_cj2]){wm*=3;break;}}}}
    if(st.midas&&tc>midasMax)midasMax=tc;
    letters+=tc;
    if(t.variant==='red'){
      letters+=tc;
      if(t.isNew&&d&&d.bm){if(d.bm==='dw')wm*=2;else if(d.bm==='tw')wm*=3;}
    }
  }
  // POST phase: accumulate gold, gm, gc after seeing all tile scores
  if(isMain)for(var i=0;i<placed.length;i++){var d=sqd(placed[i].id);if(d&&d.onPost)d.onPost(word,st);}
  if(st.am>0)em+=st.am;
  letters+=st.gc||0;
  if(st.midas&&midasMax>0)letters+=midasMax*2;
  var allOne=true;for(var j=0;j<wt.length;j++){if(wt[j].sc>1){allOne=false;break;}}
  var hasHigh=false;for(var j=0;j<wt.length;j++){if(wt[j].sc>=8){hasHigh=true;break;}}
  var blankCt=0;for(var j=0;j<wt.length;j++)if(wt[j].isBlank)blankCt++;
  if(scholarCount>0&&allOne)em+=scholarCount*6;
  if(aristocratCount>0&&hasHigh)em+=aristocratCount*5;
  if(luckyBlankCount>0&&blankCt>0)em+=luckyBlankCount*blankCt*3;
  if(isMain){
    var newTileCount=0;for(var j=0;j<wt.length;j++)if(wt[j].isNew)newTileCount++;if(newTileCount>=4)em+=(newTileCount-3);
    if(st.gm>0)em+=st.gm;if(st.quill)wm*=2;
  }
  var xm=(st.wm_mult&&st.wm_mult>1?st.wm_mult:1)*(st.bhXm&&st.bhXm>1?st.bhXm:1);
  if(st.slotVariant){
    if(st.slotVariant==='gold')st.gold=(st.gold||0)+wt.length;
    else if(st.slotVariant==='red'){letters*=2;for(var _vi=0;_vi<wt.length;_vi++){var _vt=wt[_vi],_vd=_vt.sid?sqd(_vt.sid):null;if(_vt.isNew&&_vd&&_vd.bm){if(_vd.bm==='dw')wm*=2;else if(_vd.bm==='tw')wm*=3;}}}
    else if(st.slotVariant==='blue'){for(var _vi=0;_vi<wt.length;_vi++){if(!wt[_vi].isBlank)letters+=(LS[wt[_vi].letter]||0);}}
  }
  letters+=(extraChips||0);
  var fm=(1+em)*xm*wm;var total=Math.round(letters*fm);
  // FINAL phase: transform the computed total (e.g. palindrome double)
  if(isMain)for(var i=0;i<placed.length;i++){var d=sqd(placed[i].id);if(d&&d.onFinal){var r=d.onFinal(word,st,{letters:letters,mult:fm,total:total});if(r&&r.total!=null)total=r.total;}}
  return{letters:Math.round(letters),mult:fm,total:total,gold:st.gold||0};
}

function calcAll(nt,dir){
  var cx=dir==='h'?'v':'h',words=[],a=nt[0];
  var hasCrossroads=false;
  for(var i=0;i<nt.length;i++){if(S.board[nt[i].row*B+nt[i].col]==='crossroads')hasCrossroads=true;}
  var bingo=nt.length>=7;
  var main=extractAt(a.row,a.col,dir);
  if(main&&main.tiles.length>=2){var ms=scoreWord(main.tiles,main.word,true,bingo?50:0);words.push({word:main.word,total:ms.total,gold:ms.gold,isMain:true});}
  var seen={};
  for(var i=0;i<nt.length;i++){var k=nt[i].row+','+nt[i].col;if(seen[k])continue;seen[k]=1;var cx2=extractAt(nt[i].row,nt[i].col,cx);if(!cx2||cx2.tiles.length<2)continue;var cs=scoreWord(cx2.tiles,cx2.word,false);if(hasCrossroads)cs.total*=2;words.push({word:cx2.word,total:cs.total,gold:0,isMain:false});}
  var grand=0;for(var i=0;i<words.length;i++)grand+=words[i].total;
  var tgold=0;for(var i=0;i<words.length;i++)tgold+=words[i].gold||0;
  if(bingo){for(var i=0;i<S.placed.length;i++)if(S.placed[i].id==='tectonic'){tgold+=3;break;}}
  return{words:words,grand:grand,tgold:tgold,bingo:bingo,mainWord:main?main.word:''};
}

// ---- Detailed scoring (produces event stream for animation) ----
function scoreWordDetailed(wt,word,isMain,extraChips){
  var st={gold:0,gm:0,am:0,gc:0,wtr:S.wtr,ts:S.ts};
  var letters=0,wm=1,em=0,events=[];
  var maxLS=Math.max.apply(null,Object.keys(LS).map(function(k){return LS[k];}));
  var magnetIdxs=[];for(var i=0;i<S.placed.length;i++){if(S.placed[i].id==='magnet')magnetIdxs.push(S.placed[i].sqIdx);}
  var chessKingActive2=false;for(var i=0;i<S.placed.length;i++){if(S.placed[i].id==='chess_king'){chessKingActive2=true;break;}}
  var chessPieces2=[];for(var i=0;i<S.placed.length;i++){var _pid2=S.placed[i].id;if(_pid2==='chess_knight'||_pid2==='chess_bishop'||_pid2==='chess_rook'||_pid2==='chess_queen'){chessPieces2.push({sqIdx:S.placed[i].sqIdx,id:_pid2,aura:chessGetAura(S.placed[i].sqIdx,_pid2)});}}
  var commonsCount2=0,censorCount2=0,scholarCount2=0,aristocratCount2=0,luckyBlankCount2=0;
  for(var _sci2=0;_sci2<S.placed.length;_sci2++){var _scId2=S.placed[_sci2].id;if(_scId2==='the_commons')commonsCount2++;else if(_scId2==='censor')censorCount2++;else if(_scId2==='scholar')scholarCount2++;else if(_scId2==='aristocrat')aristocratCount2++;else if(_scId2==='lucky_blank')luckyBlankCount2++;}
  var midasMax=0;
  var placed=isMain?sortedPlaced():[];
  // PRE phase
  if(isMain){for(var i=0;i<placed.length;i++){var d=sqd(placed[i].id);if(d&&d.onPre)d.onPre(word,st);}}
  if(S.ts>0)em+=S.ts;
  for(var i=0;i<wt.length;i++){
    var t=wt[i],tc=t.sc,d=t.sid?sqd(t.sid):null;
    var ev={type:'tile',sqIdx:t.idx,letter:t.letter,sqEff:null,localEff:null,isGold:false,blueBonus:0,triggers:1,sqRetrigger:false};
    if(t.variant==='blue'&&!t.isBlank){tc+=(t.blueBonus||0);ev.blueBonus=t.blueBonus||0;}
    if(t.variant==='gold'){st.gold=(st.gold||0)+1;ev.isGold=true;}
    if(st.lxeye&&'QXZJ'.indexOf(t.letter)>=0)tc*=2;
    if(commonsCount2>0&&t.sc===1)tc+=commonsCount2*3;
    if(censorCount2>0)tc+=censorCount2*2;
    if(t.isNew&&d&&d.bm){
      if(d.bm==='dl'){tc*=2;if(st.purist){tc*=2;ev.sqEff={icon:'DL',fg:d.fg,kind:'letter',label:'×4 letter (Purist!)'};}else ev.sqEff={icon:'DL',fg:d.fg,kind:'letter',label:'×2 letter score'};}
      else if(d.bm==='tl'){tc*=3;if(st.purist){tc*=3;ev.sqEff={icon:'TL',fg:d.fg,kind:'letter',label:'×9 letter (Purist!)'};}else ev.sqEff={icon:'TL',fg:d.fg,kind:'letter',label:'×3 letter score'};}
      else if(d.bm==='dw'){wm*=2;if(st.purist){wm*=2;ev.sqEff={icon:'DW',fg:d.fg,kind:'mult',label:'×'+wm+' Mult (Purist!)'};}else ev.sqEff={icon:'DW',fg:d.fg,kind:'mult',label:'×'+wm+' Mult'};}
      else if(d.bm==='tw'){wm*=3;if(st.purist){wm*=3;ev.sqEff={icon:'TW',fg:d.fg,kind:'mult',label:'×'+wm+' Mult (Purist!)'};}else ev.sqEff={icon:'TW',fg:d.fg,kind:'mult',label:'×'+wm+' Mult'};}
    }
    if(d&&d.apply&&(t.isNew||d.applyAlways)){
      var res=d.apply(tc,t,word,st);tc+=res.cb||0;em+=res.mb||0;
      if(res.cb||res.mb)ev.localEff={icon:d.icon,fg:d.fg,cb:res.cb||0,mb:res.mb||0};
    }
    if(t.isBlank&&st.rune)tc+=maxLS;
    var tcPreProcs=tc;
    var magnetProc=false;
    for(var mi=0;mi<magnetIdxs.length;mi++){if(adjSq(t.idx,magnetIdxs[mi])){tc*=2;magnetProc=true;break;}}
    var tcAfterMagnet=tc;
    var chessAuraProc=false;
    for(var ci=0;ci<chessPieces2.length;ci++){var _cau3=chessPieces2[ci].aura;for(var _cj3=0;_cj3<_cau3.length;_cj3++){if(t.idx===_cau3[_cj3]){tc*=3;chessAuraProc=true;if(!ev.sqEff)ev.sqEff={icon:'♟',fg:'#d0d0f0',kind:'letter',label:'×3 chess aura'};else ev.sqEff.label+=' ×3';break;}}}
    if(chessKingActive2&&t.isNew){for(var ci=0;ci<chessPieces2.length;ci++){var _cau4=chessPieces2[ci].aura;for(var _cj4=0;_cj4<_cau4.length;_cj4++){if(t.idx===_cau4[_cj4]){wm*=3;ev.sqEff={icon:'♚',fg:'#f0e040',kind:'mult',label:'♚ King ×'+wm};break;}}}}
    if(st.midas&&tc>midasMax)midasMax=tc;
    var hasProcs=(magnetProc||chessAuraProc)&&t.variant!=='red';
    var tileLettersDelta=hasProcs?tcPreProcs:tc;
    letters+=tileLettersDelta;
    if(t.variant==='red'){
      letters+=tc;ev.triggers=2;
      if(t.isNew&&d&&d.bm&&(d.bm==='dw'||d.bm==='tw')){
        if(d.bm==='dw')wm*=2;else wm*=3;ev.sqRetrigger=true;
      }
    }
    ev.lettersDelta=tileLettersDelta;ev.lettersAfter=letters;ev.wm=wm;ev.em=em;
    events.push(ev);
    if(hasProcs){
      if(magnetProc){var magnetDelta=tcPreProcs;letters+=magnetDelta;events.push({type:'tile-proc',sqIdx:t.idx,icon:'🧲',fg:'#a0d0ff',label:'Magnet ×2',lettersDelta:magnetDelta,lettersAfter:letters,wm:wm,em:em});}
      if(chessAuraProc){var chessDelta=tcAfterMagnet*2;letters+=chessDelta;events.push({type:'tile-proc',sqIdx:t.idx,icon:'♟',fg:'#d0d0f0',label:'♟ ×3 Aura',lettersDelta:chessDelta,lettersAfter:letters,wm:wm,em:em});}
    }
  }
  // POST phase
  if(isMain){for(var i=0;i<placed.length;i++){var d=sqd(placed[i].id);if(d&&d.onPost)d.onPost(word,st);}}
  if(st.am>0)em+=st.am;
  var midasBonus=st.midas&&midasMax>0?midasMax*2:0;
  if(midasBonus>0)letters+=midasBonus;
  if(st.gc>0)letters+=st.gc;
  var allOne=true;for(var j=0;j<wt.length;j++){if(wt[j].sc>1){allOne=false;break;}}
  var hasHigh=false;for(var j=0;j<wt.length;j++){if(wt[j].sc>=8){hasHigh=true;break;}}
  var blankCt=0;for(var j=0;j<wt.length;j++)if(wt[j].isBlank)blankCt++;
  if(scholarCount2>0&&allOne)em+=scholarCount2*6;
  if(aristocratCount2>0&&hasHigh)em+=aristocratCount2*5;
  if(luckyBlankCount2>0&&blankCt>0)em+=luckyBlankCount2*blankCt*3;
  var newTileCount=0;for(var j=0;j<wt.length;j++)if(wt[j].isNew)newTileCount++;
  var tcBonus=isMain&&newTileCount>=4?(newTileCount-3):0;
  if(tcBonus>0)em+=tcBonus;
  if(st.gm>0)em+=st.gm;
  var preQuillWm=wm;
  if(st.quill)wm*=2;
  var fmBase=(1+em)*wm;
  var xm=(st.wm_mult&&st.wm_mult>1?st.wm_mult:1)*(st.bhXm&&st.bhXm>1?st.bhXm:1);
  if(st.slotVariant){
    if(st.slotVariant==='gold')st.gold=(st.gold||0)+wt.length;
    else if(st.slotVariant==='red'){letters*=2;for(var _vi=0;_vi<wt.length;_vi++){var _vt=wt[_vi],_vd=_vt.sid?sqd(_vt.sid):null;if(_vt.isNew&&_vd&&_vd.bm){if(_vd.bm==='dw')wm*=2;else if(_vd.bm==='tw')wm*=3;}}}
    else if(st.slotVariant==='blue'){for(var _vi=0;_vi<wt.length;_vi++){if(!wt[_vi].isBlank)letters+=(LS[wt[_vi].letter]||0);}}
  }
  letters+=(extraChips||0);
  var fm=fmBase*xm;
  var total=Math.round(letters*fm);
  // FINAL phase
  if(isMain){for(var i=0;i<placed.length;i++){var d=sqd(placed[i].id);if(d&&d.onFinal){var r=d.onFinal(word,st,{letters:letters,mult:fm,total:total});if(r&&r.total!=null)total=r.total;}}}
  if(isMain){
    // Build global events: letter score bonuses → mult → gold → special
    var gevLetters=[],gevMult=[],gevGold=[],gevSpecial=[];
    for(var i=0;i<placed.length;i++){
      var d=sqd(placed[i].id);if(!d||(!d.onPre&&!d.onPost&&!d.onFinal))continue;
      var gev={type:'global',icon:d.icon,fg:d.fg,name:d.name,sqIdx:placed[i].sqIdx};
      if(d.id==='midas_touch'&&midasBonus>0){gev.lettersDelta=midasBonus;gev.lettersLabel='Midas ×3 best tile (+'+midasBonus+')';gevLetters.push(gev);continue;}
      if(d.id==='bounty'&&st.gc>0){gev.lettersDelta=st.gc;gev.lettersLabel='Bounty +'+st.gc+' letter score';gevLetters.push(gev);continue;}
      if(d.id==='anchor'&&st.am>0){gev.multDelta=st.am;gevMult.push(gev);continue;}
      if(d.id==='scholar'&&scholarCount2>0&&allOne){gev.multDelta=6;gevMult.push(gev);continue;}
      if(d.id==='aristocrat'&&aristocratCount2>0&&hasHigh){gev.multDelta=5;gevMult.push(gev);continue;}
      if(d.id==='lucky_blank'&&luckyBlankCount2>0&&blankCt>0){gev.multDelta=blankCt*3;gevMult.push(gev);continue;}
      if(d.id==='babel'&&word.length>=6){gev.multDelta=2;gevMult.push(gev);continue;}
      if(d.id==='pressure_cooker'&&(S.discPressure||0)>0){gev.multDelta=S.discPressure;gev.multLabel='Pressure +'+S.discPressure+' mult';gevMult.push(gev);continue;}
      if(d.id==='quill'&&st.quill){gev.multDelta=preQuillWm;gev.multLabel='Quill ×2 Mult! (first word)';gevMult.push(gev);continue;}
      if((d.id==='inkwell'||d.id==='gilded_inkwell')&&(st.gold||0)>0){gev.gold=st.gold;gevGold.push(gev);continue;}
      if(d.id==='tome'&&((S.wtr||0)+1)%3===0){gev.permMult=true;gevSpecial.push(gev);continue;}
      if(d.id==='rune'&&st.rune){gev.lettersLabel='Blanks → '+maxLS+' pts';gevSpecial.push(gev);continue;}
      if(d.id==='palindrome_engine'&&st.palindrome){gev.scoreDouble=true;gev.multLabel='Palindrome! ×2 final score';gevSpecial.push(gev);continue;}
    }
    if(S._slotMachineRoll&&S._slotMachineRoll.parts.length>0){
      var smr=S._slotMachineRoll;
      var smEv={type:'global',icon:'$?',fg:'#d060ff',name:'Slot Machine'};
      var smLabel='Slot! '+smr.parts.join(' | ');
      if(smr.wm_mult>1){smEv.multDelta=fmBase*(smr.wm_mult-1);smEv.multLabel=smLabel;}
      else{smEv.lettersLabel=smLabel;}
      gevSpecial.push(smEv);
    }
    if(st.bhXm&&st.bhXm>1){
      gevSpecial.push({type:'global',icon:'BH',fg:'#c0e080',name:'Bounty Hunter',
        multLabel:'Bounty Hunter ×'+st.bhXm.toFixed(2)+' score mult'});
    }
    if(extraChips&&extraChips>0){
      var bingoEv={type:'global',icon:'★',fg:'#f0e080',name:'Bingo'};
      bingoEv.lettersDelta=extraChips;bingoEv.lettersLabel='BINGO +'+extraChips;
      gevLetters.push(bingoEv);
    }
    if(tcBonus>0){gevMult.push({type:'global',icon:newTileCount+'✦',fg:'#80d0ff',multDelta:tcBonus,multLabel:newTileCount+' tiles +'+tcBonus+' mult'});}
    var allGev=gevLetters.concat(gevMult).concat(gevGold).concat(gevSpecial);
    for(var i=0;i<allGev.length;i++){allGev[i].lettersAfter=letters;allGev[i].multAfter=fm;events.push(allGev[i]);}
  }
  return{events:events,letters:letters,mult:fm,total:total,gold:st.gold||0};
}

// ---- Score animation ----
function showScorePop(text,x,y,bg,fg){
  var el=document.createElement('div');el.className='score-pop';
  el.style.cssText='left:'+Math.round(x)+'px;top:'+Math.round(y)+'px;background:'+bg+';color:'+fg;
  el.textContent=text;document.body.appendChild(el);
  setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},700);
}

function bumpSA(id){var el=document.getElementById(id);if(!el)return;el.classList.remove('ls-bump');void el.offsetWidth;el.classList.add('ls-bump');}
function scoreDelay(ms){return new Promise(function(r){setTimeout(r,ms);});}
function fmtMult(m){var r=Math.round(m);if(m>=10||Math.abs(m-r)<0.001)return r.toString();return parseFloat(m.toFixed(2)).toString();}

async function runScoreAnim(events,crossLetters,grandTotal){
  var row=document.getElementById('live-score-row');
  var saL=document.getElementById('ls-letters'),saM=document.getElementById('ls-mult'),saS=document.getElementById('ls-score');
  row.classList.add('scoring');
  saL.textContent='0';saM.textContent='1';saS.textContent='0';
  var letters=0,mult=1;
  // Delay starts slow and accelerates: 500ms → decays by ×0.78 each event → floors at 45ms
  var delay=500,minDelay=50,tileDecay=0.95,stickerDecay=0.72;
  for(var i=0;i<events.length;i++){
    var ev=events[i];
    var curDelay=Math.max(minDelay,delay);
    delay*=ev.type==='tile'?tileDecay:stickerDecay;
    if(ev.type==='tile'){
      var tileEl=document.querySelector('[data-sq-idx="'+ev.sqIdx+'"] .board-tile');
      var r=tileEl?tileEl.getBoundingClientRect():null;
      if(ev.localEff){var glowSq=document.querySelector('[data-sq-idx="'+ev.sqIdx+'"]');if(glowSq){glowSq.classList.remove('sq-glowing');void glowSq.offsetWidth;glowSq.classList.add('sq-glowing');}}
      for(var trig=0;trig<ev.triggers;trig++){
        if(tileEl){tileEl.classList.remove('binking');void tileEl.offsetWidth;tileEl.classList.add('binking');r=tileEl.getBoundingClientRect();}
        if(r&&ev.lettersDelta)showScorePop('+'+ev.lettersDelta,r.left+r.width/2-20,r.top-4,'#0d2a50','#80c8ff');
        letters+=ev.lettersDelta;
        saL.textContent=letters;bumpSA('ls-letters');
        if(trig===0){
          if(r&&ev.isGold)showScorePop('+$1',r.left+r.width/2-8,r.top-28,'#3a2800','#f0c060');
          if(r&&ev.blueBonus)showScorePop('+'+ev.blueBonus+' bonus',r.left-18,r.top+6,'#0a2050','#80c8ff');
          if(r&&ev.sqEff&&ev.sqEff.kind==='mult'){showScorePop(ev.sqEff.label,r.left+r.width/2-28,r.top-30,'#500808','#ff8080');}
          if(r&&ev.localEff&&ev.localEff.mb){showScorePop('+'+ev.localEff.mb+' mult',r.left+r.width/2-28,r.top-30,'#2a1a00','#f0c060');}
          mult=ev.wm+ev.em;saM.textContent=fmtMult(mult);
          if(ev.sqEff&&ev.sqEff.kind==='mult')bumpSA('ls-mult');
          if(ev.localEff&&ev.localEff.mb)bumpSA('ls-mult');
        }
        if(trig===1&&ev.sqRetrigger&&r){showScorePop(ev.sqEff.label+'!',r.left+r.width/2-28,r.top-30,'#500808','#ff8080');mult=ev.wm+ev.em;saM.textContent=fmtMult(mult);bumpSA('ls-mult');}
        if(trig<ev.triggers-1)await scoreDelay(Math.max(minDelay,curDelay*0.6));
      }
      await scoreDelay(curDelay);
    } else if(ev.type==='tile-proc'){
      var tpEl=document.querySelector('[data-sq-idx="'+ev.sqIdx+'"] .board-tile');
      var tpR=tpEl?tpEl.getBoundingClientRect():null;
      if(tpEl){tpEl.classList.remove('binking');void tpEl.offsetWidth;tpEl.classList.add('binking');}
      if(tpR)showScorePop(ev.label+' +'+ev.lettersDelta,tpR.left+tpR.width/2-20,tpR.top-4,'#0d1a30','#a0d8ff');
      letters+=ev.lettersDelta;
      saL.textContent=letters;bumpSA('ls-letters');
      await scoreDelay(curDelay);
    } else if(ev.type==='global'){
      if(ev.sqIdx!==undefined){var glowSq2=document.querySelector('[data-sq-idx="'+ev.sqIdx+'"]');if(glowSq2){glowSq2.classList.remove('sq-glowing');void glowSq2.offsetWidth;glowSq2.classList.add('sq-glowing');}}
      var br=row.getBoundingClientRect();
      if(ev.gold)showScorePop('+$'+ev.gold,br.left+24,br.top-32,'#3a2a00','#f0c060');
      if(ev.lettersDelta){letters+=ev.lettersDelta;showScorePop(ev.lettersLabel||'+'+ev.lettersDelta,br.left+24,br.top-32,'#0d2a50','#80c8ff');saL.textContent=letters;bumpSA('ls-letters');}
      else if(ev.lettersLabel)showScorePop(ev.lettersLabel,br.left+24,br.top-32,'#2a0a2a','#e060e0');
      if(ev.multDelta){mult+=ev.multDelta;showScorePop(ev.multLabel||'+'+ev.multDelta+' mult',br.left+100,br.top-32,'#500808','#ff8080');}
      else if(ev.multLabel)showScorePop(ev.multLabel,br.left+100,br.top-32,'#3a3a00','#f0e060');
      if(ev.permMult)showScorePop('Tome +1 perm mult!',br.left+100,br.top-32,'#3a1a0a','#e08060');
      if(ev.scoreDouble){showScorePop('Palindrome! Score ×2',br.left+60,br.top-48,'#0a2a2a','#60ffff');}
      saM.textContent=fmtMult(mult);
      if(ev.multDelta||ev.multLabel||ev.permMult)bumpSA('ls-mult');
      await scoreDelay(curDelay);
    }
  }
  if(crossLetters>0){
    var br2=row.getBoundingClientRect();
    showScorePop('+'+crossLetters+' cross',br2.left+24,br2.top-32,'#0a2a0a','#60d060');
    bumpSA('ls-letters');await scoreDelay(Math.max(120,Math.max(minDelay,delay)*1.5));
  }
  saS.textContent=grandTotal.toLocaleString();bumpSA('ls-score');
  await scoreDelay(600);
  var _oldScore=S.score,_tgt=tgt();
  var _bar=document.getElementById('score-bar');
  var _runP=document.getElementById('run-progress');
  var _startPct=Math.min(100,_oldScore/_tgt*100);
  var _endPct=Math.min(100,(_oldScore+grandTotal)/_tgt*100);
  if(_bar){_bar.style.transition='none';_bar.style.height=_startPct+'%';}
  await new Promise(function(res2){
    var _start=performance.now();
    var DUR=2000;
    function _tick(now){
      var t=Math.min(1,(now-_start)/DUR);
      var _cur=Math.round(grandTotal*(1-t));
      saS.textContent=_cur.toLocaleString();
      if(_bar)_bar.style.height=(_startPct+(_endPct-_startPct)*t)+'%';
      if(_runP)_runP.textContent=Math.round(_oldScore+grandTotal*t).toLocaleString()+' / '+_tgt.toLocaleString();
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
  var prevRoll=S._slotMachineRoll;
  S._slotMachineRoll={wm_mult:1,gold:0,variant:null,parts:[]};
  var bingo=nt.length>=7;
  var res=scoreWord(main.tiles,main.word,true,bingo?50:0);
  S._slotMachineRoll=prevRoll;
  lsC.textContent=res.letters;
  lsM.textContent=fmtMult(res.mult);
  lsS.textContent=res.total.toLocaleString();
}
