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

function scoreWord(wt,word,isMain){
  var st={gold:0,gm:0,am:0,gc:0,wtb:S.wtb,ts:S.ts};var letters=0,wm=1,em=0;
  var placed=isMain?sortedPlaced():[];
  // PRE phase: set flags the tile loop reads
  if(isMain)for(var i=0;i<placed.length;i++){var d=sqd(placed[i].id);if(d&&d.onPre)d.onPre(word,st);}
  if(S.ts>0)em+=S.ts;
  var maxLS=Math.max.apply(null,Object.keys(LS).map(function(k){return LS[k];}));
  var magnetIdxs=[];for(var i=0;i<S.placed.length;i++){if(S.placed[i].id==='magnet')magnetIdxs.push(S.placed[i].sqIdx);}
  var midasMax=0;
  for(var i=0;i<wt.length;i++){
    var t=wt[i],tc=t.sc,d=t.sid?sqd(t.sid):null;
    if(t.variant==='blue'&&!t.isBlank)tc+=(t.blueBonus||0);
    if(t.variant==='gold')st.gold=(st.gold||0)+1;
    if(st.lxeye&&'QXZJ'.indexOf(t.letter)>=0)tc*=2;
    if(st.the_commons&&t.sc===1)tc+=3;
    if(st.censor)tc+=2;
    if(t.isNew&&d&&d.bm){if(d.bm==='dl')tc*=2;else if(d.bm==='tl')tc*=3;else if(d.bm==='dw')wm*=2;else if(d.bm==='tw')wm*=3;}
    if(d&&d.apply&&(t.isNew||d.applyAlways)){var res=d.apply(tc,t,word,st);tc+=res.cb||0;em+=res.mb||0;}
    if(t.isBlank&&st.rune)tc+=maxLS;
    for(var mi=0;mi<magnetIdxs.length;mi++){if(adjSq(t.idx,magnetIdxs[mi])){tc*=2;break;}}
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
  if(isMain){
    var allOne=true;for(var j=0;j<wt.length;j++){if(wt[j].sc>1){allOne=false;break;}}if(st.scholar&&allOne)em+=6;
    var hasHigh=false;for(var j=0;j<wt.length;j++){if(wt[j].sc>=8){hasHigh=true;break;}}if(st.aristocrat&&hasHigh)em+=5;
    var blankCt=0;for(var j=0;j<wt.length;j++)if(wt[j].isBlank)blankCt++;if(st.lucky_blank&&blankCt>0)em+=blankCt*3;
    if(st.gm>0)em+=st.gm;if(st.quill)wm*=2;
  }
  var fm=wm+em;var total=Math.round(letters*fm);
  // FINAL phase: transform the computed total (e.g. palindrome double)
  if(isMain)for(var i=0;i<placed.length;i++){var d=sqd(placed[i].id);if(d&&d.onFinal){var r=d.onFinal(word,st,{letters:letters,mult:fm,total:total});if(r&&r.total!=null)total=r.total;}}
  return{letters:Math.round(letters),mult:Math.round(fm*10)/10,total:total,gold:st.gold||0};
}

function calcAll(nt,dir){
  var cx=dir==='h'?'v':'h',words=[],a=nt[0];
  var hasCrossroads=false;
  for(var i=0;i<nt.length;i++){if(S.board[nt[i].row*B+nt[i].col]==='crossroads')hasCrossroads=true;}
  var main=extractAt(a.row,a.col,dir);
  if(main&&main.tiles.length>=2){var ms=scoreWord(main.tiles,main.word,true);words.push({word:main.word,total:ms.total,gold:ms.gold,isMain:true});}
  var seen={};
  for(var i=0;i<nt.length;i++){var k=nt[i].row+','+nt[i].col;if(seen[k])continue;seen[k]=1;var cx2=extractAt(nt[i].row,nt[i].col,cx);if(!cx2||cx2.tiles.length<2)continue;var cs=scoreWord(cx2.tiles,cx2.word,false);if(hasCrossroads)cs.total*=2;words.push({word:cx2.word,total:cs.total,gold:0,isMain:false});}
  var bingo=nt.length>=7;var grand=0;for(var i=0;i<words.length;i++)grand+=words[i].total;if(bingo)grand+=50;
  var tgold=0;for(var i=0;i<words.length;i++)tgold+=words[i].gold||0;
  if(bingo){for(var i=0;i<S.placed.length;i++)if(S.placed[i].id==='tectonic'){tgold+=3;break;}}
  return{words:words,grand:grand,tgold:tgold,bingo:bingo,mainWord:main?main.word:''};
}

// ---- Detailed scoring (produces event stream for animation) ----
function scoreWordDetailed(wt,word,isMain){
  var st={gold:0,gm:0,am:0,gc:0,wtb:S.wtb,ts:S.ts};
  var letters=0,wm=1,em=0,events=[];
  var maxLS=Math.max.apply(null,Object.keys(LS).map(function(k){return LS[k];}));
  var magnetIdxs=[];for(var i=0;i<S.placed.length;i++){if(S.placed[i].id==='magnet')magnetIdxs.push(S.placed[i].sqIdx);}
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
    if(st.the_commons&&t.sc===1)tc+=3;
    if(st.censor)tc+=2;
    if(t.isNew&&d&&d.bm){
      if(d.bm==='dl'){tc*=2;ev.sqEff={icon:'DL',fg:d.fg,kind:'letter',label:'×2 letter score'};}
      else if(d.bm==='tl'){tc*=3;ev.sqEff={icon:'TL',fg:d.fg,kind:'letter',label:'×3 letter score'};}
      else if(d.bm==='dw'){wm*=2;ev.sqEff={icon:'DW',fg:d.fg,kind:'mult',label:'×'+wm+' Mult'};}
      else if(d.bm==='tw'){wm*=3;ev.sqEff={icon:'TW',fg:d.fg,kind:'mult',label:'×'+wm+' Mult'};}
    }
    if(d&&d.apply&&(t.isNew||d.applyAlways)){
      var res=d.apply(tc,t,word,st);tc+=res.cb||0;em+=res.mb||0;
      if(res.cb||res.mb)ev.localEff={icon:d.icon,fg:d.fg,cb:res.cb||0,mb:res.mb||0};
    }
    if(t.isBlank&&st.rune)tc+=maxLS;
    for(var mi=0;mi<magnetIdxs.length;mi++){if(adjSq(t.idx,magnetIdxs[mi])){tc*=2;break;}}
    if(st.midas&&tc>midasMax)midasMax=tc;
    letters+=tc;
    if(t.variant==='red'){
      letters+=tc;ev.triggers=2;
      if(t.isNew&&d&&d.bm&&(d.bm==='dw'||d.bm==='tw')){
        if(d.bm==='dw')wm*=2;else wm*=3;ev.sqRetrigger=true;
      }
    }
    ev.lettersDelta=tc;ev.lettersAfter=letters;ev.wm=wm;ev.em=em;
    events.push(ev);
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
  if(isMain&&st.scholar&&allOne)em+=6;
  if(isMain&&st.aristocrat&&hasHigh)em+=5;
  if(st.lucky_blank&&blankCt>0)em+=blankCt*3;
  if(st.gm>0)em+=st.gm;
  var preQuillWm=wm;
  if(st.quill)wm*=2;
  var fm=wm+em;
  var total=Math.round(letters*fm);
  // FINAL phase
  if(isMain){for(var i=0;i<placed.length;i++){var d=sqd(placed[i].id);if(d&&d.onFinal){var r=d.onFinal(word,st,{letters:letters,mult:fm,total:total});if(r&&r.total!=null)total=r.total;}}}
  if(isMain){
    // Build global events: letter score bonuses → mult → gold → special
    var gevLetters=[],gevMult=[],gevGold=[],gevSpecial=[];
    for(var i=0;i<placed.length;i++){
      var d=sqd(placed[i].id);if(!d||(!d.onPre&&!d.onPost&&!d.onFinal))continue;
      var gev={type:'global',icon:d.icon,fg:d.fg,name:d.name};
      if(d.id==='midas_touch'&&midasBonus>0){gev.lettersDelta=midasBonus;gev.lettersLabel='Midas ×3 best tile (+'+midasBonus+')';gevLetters.push(gev);continue;}
      if(d.id==='bounty'&&st.gc>0){gev.lettersDelta=st.gc;gev.lettersLabel='Bounty +'+st.gc+' letter score';gevLetters.push(gev);continue;}
      if(d.id==='anchor'&&st.am>0){gev.multDelta=st.am;gevMult.push(gev);continue;}
      if(d.id==='scholar'&&st.scholar&&allOne){gev.multDelta=6;gevMult.push(gev);continue;}
      if(d.id==='aristocrat'&&st.aristocrat&&hasHigh){gev.multDelta=5;gevMult.push(gev);continue;}
      if(d.id==='lucky_blank'&&st.lucky_blank&&blankCt>0){gev.multDelta=blankCt*3;gevMult.push(gev);continue;}
      if(d.id==='babel'&&word.length>=6){gev.multDelta=2;gevMult.push(gev);continue;}
      if(d.id==='pressure_cooker'&&(S.discPressure||0)>0){gev.multDelta=S.discPressure;gev.multLabel='Pressure +'+S.discPressure+' mult';gevMult.push(gev);continue;}
      if(d.id==='quill'&&st.quill){gev.multDelta=preQuillWm;gev.multLabel='Quill ×2 Mult! (first word)';gevMult.push(gev);continue;}
      if((d.id==='inkwell'||d.id==='gilded_inkwell')&&(st.gold||0)>0){gev.gold=st.gold;gevGold.push(gev);continue;}
      if(d.id==='tome'&&((S.wtb||0)+1)%3===0){gev.permMult=true;gevSpecial.push(gev);continue;}
      if(d.id==='rune'&&st.rune){gev.lettersLabel='Blanks → '+maxLS+' pts';gevSpecial.push(gev);continue;}
      if(d.id==='palindrome_engine'&&st.palindrome){gev.scoreDouble=true;gev.multLabel='Palindrome! ×2 final score';gevSpecial.push(gev);continue;}
    }
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

function bumpSA(id){var el=document.getElementById(id);el.classList.remove('sa-bump');void el.offsetWidth;el.classList.add('sa-bump');}
function scoreDelay(ms){return new Promise(function(r){setTimeout(r,ms);});}

async function runScoreAnim(events,crossLetters,bingo,grandTotal){
  var bar=document.getElementById('score-anim-bar');
  var saL=document.getElementById('sa-chips'),saM=document.getElementById('sa-mult'),saS=document.getElementById('sa-score');
  bar.style.display='flex';saL.textContent='0';saM.textContent='1';saS.textContent='0';
  var letters=0,mult=1;
  for(var i=0;i<events.length;i++){
    var ev=events[i];
    if(ev.type==='tile'){
      var tileEl=document.querySelector('[data-sq-idx="'+ev.sqIdx+'"] .board-tile');
      var r=tileEl?tileEl.getBoundingClientRect():null;
      for(var trig=0;trig<ev.triggers;trig++){
        if(tileEl){tileEl.classList.remove('binking');void tileEl.offsetWidth;tileEl.classList.add('binking');r=tileEl.getBoundingClientRect();}
        if(r&&ev.lettersDelta)showScorePop('+'+ev.lettersDelta,r.left+r.width/2-20,r.top-4,'#0d2a50','#80c8ff');
        letters+=ev.lettersDelta;
        saL.textContent=letters;saS.textContent=Math.round(letters*mult).toLocaleString();bumpSA('sa-chips');
        if(trig===0){
          if(r&&ev.isGold)showScorePop('+$1',r.left+r.width/2-8,r.top-28,'#3a2800','#f0c060');
          if(r&&ev.blueBonus)showScorePop('+'+ev.blueBonus+' bonus',r.left-18,r.top+6,'#0a2050','#80c8ff');
          if(r&&ev.sqEff&&ev.sqEff.kind==='mult'){showScorePop(ev.sqEff.label,r.left+r.width/2-28,r.top-30,'#500808','#ff8080');}
          if(r&&ev.localEff&&ev.localEff.mb){showScorePop('+'+ev.localEff.mb+' mult',r.left+r.width/2-28,r.top-30,'#2a1a00','#f0c060');}
          mult=ev.wm+ev.em;saM.textContent=Math.round(mult*10)/10;
          if(ev.sqEff&&ev.sqEff.kind==='mult')bumpSA('sa-mult');
          if(ev.localEff&&ev.localEff.mb)bumpSA('sa-mult');
        }
        if(trig===1&&ev.sqRetrigger&&r){showScorePop(ev.sqEff.label+'!',r.left+r.width/2-28,r.top-30,'#500808','#ff8080');mult=ev.wm+ev.em;saM.textContent=Math.round(mult*10)/10;bumpSA('sa-mult');}
        if(trig<ev.triggers-1)await scoreDelay(230);
      }
      saS.textContent=Math.round(letters*mult).toLocaleString();
      await scoreDelay(200);
    } else if(ev.type==='global'){
      var br=bar.getBoundingClientRect();
      if(ev.gold)showScorePop('+$'+ev.gold,br.left+24,br.top-32,'#3a2a00','#f0c060');
      if(ev.lettersDelta){letters+=ev.lettersDelta;showScorePop(ev.lettersLabel||'+'+ev.lettersDelta,br.left+24,br.top-32,'#0d2a50','#80c8ff');saL.textContent=letters;bumpSA('sa-chips');}
      else if(ev.lettersLabel)showScorePop(ev.lettersLabel,br.left+24,br.top-32,'#2a0a2a','#e060e0');
      if(ev.multDelta){mult+=ev.multDelta;showScorePop(ev.multLabel||'+'+ev.multDelta+' mult',br.left+100,br.top-32,'#500808','#ff8080');}
      else if(ev.multLabel)showScorePop(ev.multLabel,br.left+100,br.top-32,'#3a3a00','#f0e060');
      if(ev.permMult)showScorePop('Tome +1 perm mult!',br.left+100,br.top-32,'#3a1a0a','#e08060');
      if(ev.scoreDouble){showScorePop('Palindrome! Score ×2',br.left+60,br.top-48,'#0a2a2a','#60ffff');}
      saM.textContent=Math.round(mult*10)/10;saS.textContent=Math.round(letters*mult).toLocaleString();
      if(ev.multDelta||ev.multLabel||ev.permMult)bumpSA('sa-mult');
      await scoreDelay(320);
    }
  }
  if(crossLetters>0){
    letters+=crossLetters;
    var br=document.getElementById('score-anim-bar').getBoundingClientRect();
    showScorePop('+'+crossLetters+' cross',br.left+24,br.top-32,'#0a2a0a','#60d060');
    saL.textContent=letters;saS.textContent=Math.round(letters*mult).toLocaleString();
    bumpSA('sa-chips');await scoreDelay(350);
  }
  if(bingo){
    letters+=50;
    var br=document.getElementById('score-anim-bar').getBoundingClientRect();
    showScorePop('BINGO +50',br.left+80,br.top-32,'#3a3a00','#f0e080');
    saL.textContent=letters;saS.textContent=Math.round(letters*mult).toLocaleString();
    bumpSA('sa-chips');await scoreDelay(400);
  }
  saS.textContent=grandTotal.toLocaleString();bumpSA('sa-score');
  await scoreDelay(600);
  bar.style.display='none';
}
