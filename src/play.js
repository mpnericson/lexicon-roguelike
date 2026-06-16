// =====================================================================
// PLAY — word validation, playing, discarding, shuffling
// =====================================================================
async function playWord(){
  if(window._scoring){return;}
  if(S.plays<=0){toast('No plays remaining!');return;}
  _rankRunId++;
  var _capturedRankTop10=_rankTop10; _rankTop10=null;
  var nt=newTiles();if(!nt.length){toast('Place tiles on the board first!');return;}
  window._lastPlaySnap={
    hand:S.hand.map(function(t){return t?Object.assign({},t,{onBoard:false,_boardSq:undefined}):null;}),
    bt:S.bt.map(function(bt){return(bt&&!bt.isNew)?Object.assign({},bt):null;}),
    board:S.board.slice()
  };
  var dir=wordDir(nt);if(!dir){toast('Tiles must be in a straight line!');return;}
  var a=nt[0];var main=extractAt(a.row,a.col,dir);
  if(!main){toast('Word has a gap!');return;}if(main.word.length<2){toast('Word must be at least 2 letters!');return;}
  var comm=[];for(var i=0;i<B*B;i++)if(S.bt[i]&&!S.bt[i].isNew)comm.push(i);
  if(comm.length>0){
    var conn=false;
    outer:for(var ni=0;ni<nt.length;ni++){
      // Jenga: tile stacked directly on a committed tile is automatically connected
      if(S.bt[nt[ni].idx]&&!S.bt[nt[ni].idx].isNew){conn=true;break outer;}
      var r=nt[ni].row,c=nt[ni].col;var nb=[[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
      for(var nb2=0;nb2<nb.length;nb2++){var nr=nb[nb2][0],nc=nb[nb2][1];if(nr<0||nr>=B||nc<0||nc>=B)continue;var nbt=S.bt[nr*B+nc];if(nbt&&!nbt.isNew){conn=true;break outer;}}
    }
    if(!conn){toast('Word must connect to an existing word!');return;}
  }
  var _con=currentConstraint();
  var palLocked=_con==='c_pal'&&!S.palUnlocked;
  var justUnlocked=false;
  if(palLocked&&isExtendedPalindrome(main.word)){S.palUnlocked=true;palLocked=false;justUnlocked=true;}
  var scoreLocked=false,scoreLockMsg='';
  if(_con==='c_long'&&main.word.length<5){scoreLocked=true;scoreLockMsg='Word scores 0 — only 5+ letter words score this round!';}
  if(_con==='c_longer'&&(S.lastWordLen||0)>0&&main.word.length<=(S.lastWordLen||0)){scoreLocked=true;scoreLockMsg='Word scores 0 — must be longer than your last ('+S.lastWordLen+' letters)!';}
  if(palLocked){scoreLocked=true;scoreLockMsg='Scoring locked — play a palindrome first!';}
  S._slotMachineRoll=null;
  window._scoring=true;
  var _playBtn=document.querySelector('#play-controls .btn-icon-green');
  if(_playBtn)_playBtn.disabled=true;
  var _hasDT=false;for(var _dti=0;_dti<S.tileStickers.length;_dti++)if(S.tileStickers[_dti].id==='drunk_text'){_hasDT=true;break;}
  var _words=getAllWords(nt,dir);
  var _eggWords={};for(var i=0;i<EASTER_EGGS.length;i++)_eggWords[EASTER_EGGS[i].word]=true;
  var _dtInvalid=false;
  for(var i=0;i<_words.length;i++){if(_eggWords[_words[i]])continue;var v=await validWord(_words[i]);if(!v){if(_hasDT){_dtInvalid=true;}else{flashTiles(nt);window._scoring=false;if(_playBtn)_playBtn.disabled=false;if(!S.devMode){S.gold=Math.max(0,S.gold-2);renderHUD();toast('"'+_words[i]+'" is not a word — fined $2!');}else{toast('"'+_words[i]+'" is not a word.');}return;}}}
  if(_hasDT){S._drunkValid=!_dtInvalid;if(_dtInvalid)flashTiles(nt);}
  // Easter egg effects (before scoring — can mutate tile variants)
  var _eggApplied=applyEasterEgg(main.word,nt);if(_eggApplied)await new Promise(function(r){setTimeout(r,420);});
  // Bounty check — glow starts NOW, reward applied inside scoring, slide-out happens after scoring
  var _bountyIdx=-1;
  if(S.bounties&&S.bounties.length){for(var _bi=S.bounties.length-1;_bi>=0;_bi--){if(S.bounties[_bi].word===main.word){_bountyIdx=_bi;break;}}}
  var _hasBH=false;for(var _bhi=0;_bhi<S.tileStickers.length;_bhi++){if(S.tileStickers[_bhi].id==='bounty_hunter'){_hasBH=true;break;}}
  var _wordBoardIdxs=main.tiles.map(function(t){return t.idx;});
  var _bountyReward=_bountyIdx>=0?(S.bounties[_bountyIdx].reward||0):0;
  if(_bountyIdx>=0){
    _applyBountyGlow(_wordBoardIdxs,_bountyIdx);
    toast('Bounty complete! +$'+_bountyReward+' + '+bountyRewardLabel());
    S._pendingBountyReward=true;
  }
  if(!scoreLocked){
    if(justUnlocked)toast('Palindrome! Scoring is now live.');
    var res=scorePlay(nt,dir,false);
    if(_hasDT)delete S._drunkValid;
    await runScoreAnim(res.events,res.total);
    S.score+=res.total;S.gold+=res.tgold;
    var _hasMT=false;for(var _mti=0;_mti<S.tileStickers.length;_mti++)if(S.tileStickers[_mti].id==='midas_touch'){_hasMT=true;break;}
    if(_hasMT&&main.word.length>=5){for(var _mj=0;_mj<main.tiles.length;_mj++){if(S.bt[main.tiles[_mj].idx])S.bt[main.tiles[_mj].idx].variant='gold';}}
    S.crossroadsCount=(S.crossroadsCount||0)+(res.crossWordCount||0);
    S._crossroadsLiveCount=null; // animation's display-only counter is now caught up — defer to the real one
    _proletariatSpread();
    _checkRankReward(res.total,_capturedRankTop10);
    achvCheck('word_played',{bingo:res.bingo,isPalin:isExtendedPalindrome(main.word)});
    var _hasPE=false;for(var _pei=0;_pei<S.tileStickers.length;_pei++)if(S.tileStickers[_pei].id==='palindrome_engine'){_hasPE=true;break;}
    if(_hasPE&&isExtendedPalindrome(main.word)){
      if(!S.palWords)S.palWords=[];
      if(S.palWords.indexOf(main.word)<0){S.palWords.push(main.word);S.palMult=(S.palMult||1)+0.25;toast('Palindrome Engine: ×'+fmtMult(S.palMult)+'!');}
    }
  }else{toast(scoreLockMsg);}
  // Bounty slide-out: fires after scoring animation completes
  if(_bountyIdx>=0){
    S._pendingBountyReward=null;
    S.gold+=_bountyReward;
    await animBountySlideOut(_bountyIdx);
    S.bounties.splice(_bountyIdx,1);
    if(_hasBH)S.bhMult=(S.bhMult||1)+0.25;
    renderHUD();
  }
  S.wtr=(S.wtr||0)+1;S.discPressure=0;
  if(_con==='c_letters'){var _mts=main.tiles;for(var _li2=0;_li2<_mts.length;_li2++){if(!_mts[_li2].isBlank&&_mts[_li2].letter)(S.usedLetters=S.usedLetters||new Set()).add(_mts[_li2].letter);}}
  S.lastWordLen=main.word.length;
  var blueTiles=[];
  for(var i=0;i<B*B;i++){if(S.bt[i]&&S.bt[i].isNew){S.bt[i].isNew=false;S.bt[i].flying=false;var t=S.hand[S.bt[i].handIdx];if(!t&&S.bt[i].tileId){for(var _fi=0;_fi<S.hand.length;_fi++){if(S.hand[_fi]&&S.hand[_fi].id===S.bt[i].tileId){t=S.hand[_fi];break;}}}if(t){if(t.variant==='blue'){var nb=(t.blueBonus||0)+(t.isBlank?0:(LS[t.letter]||0));blueTiles.push({letter:t.letter,isBlank:t.isBlank,id:t.id,variant:'blue',blueBonus:nb});}t._done=true;}}}
  // Commit Jenga stacked tiles: btTop replaces bt at that square
  if(S.btTop){for(var i=0;i<B*B;i++){if(S.btTop[i]&&S.btTop[i].isNew){var tTop=S.hand[S.btTop[i].handIdx];if(!tTop&&S.btTop[i].tileId){for(var _fi2=0;_fi2<S.hand.length;_fi2++){if(S.hand[_fi2]&&S.hand[_fi2].id===S.btTop[i].tileId){tTop=S.hand[_fi2];break;}}}S.btTop[i].isNew=false;S.btTop[i].flying=false;S.btTop[i]._stackLevel=(S.bt[i]&&S.bt[i]._stackLevel?S.bt[i]._stackLevel:0)+1;S.bt[i]=S.btTop[i];S.btTop[i]=null;if(tTop){if(tTop.variant==='blue'){var nb2=(tTop.blueBonus||0)+(tTop.isBlank?0:(LS[tTop.letter]||0));blueTiles.push({letter:tTop.letter,isBlank:tTop.isBlank,id:tTop.id,variant:'blue',blueBonus:nb2});}tTop._done=true;}}}}
  // Safety: after all commit loops any hand tile still onBoard is a ghost (lookup failed) — mark done
  for(var _gi=0;_gi<S.hand.length;_gi++){if(S.hand[_gi]&&S.hand[_gi].onBoard&&!S.hand[_gi]._done)S.hand[_gi]._done=true;}
  // Save positions of kept (un-played) tiles before filtering
  var pwKept={};var _pwvi=0;for(var _pwki=0;_pwki<S.hand.length;_pwki++){var _pwt=S.hand[_pwki];if(_pwt&&!_pwt.onBoard){if(!_pwt._done&&HP.x[_pwvi]!==undefined)pwKept[_pwt.id]=HP.x[_pwvi];_pwvi++;}}
  S.hand=S.hand.filter(function(t){return!t._done;});
  for(var i=0;i<blueTiles.length;i++)S.bag.push(blueTiles[i]);
  if(blueTiles.length){S.bag=shuffle(S.bag);toast('Blue tile'+(blueTiles.length>1?'s':'')+' returned to bag!');}
  HP.x=[];HP.vx=[];window._easyHint=null;
  S.plays--;
  var pwKeptN=S.hand.filter(function(t){return t&&!t.onBoard;}).length;
  // Predict final hand size so Phase 1 slides tiles to their true final positions.
  var _hm=handMax();var _drawCap=(_con==='c_draw3')?3:_hm;var _pwDrawN=S.devMode?Math.min(_hm-S.hand.length,_drawCap):Math.min(Math.min(_hm-S.hand.length,_drawCap),S.bag.length);
  var _pwTotalN=pwKeptN+Math.max(0,_pwDrawN);
  // Phase 1: render kept tiles, restore old positions, then slide left to make room.
  renderAll();
  var _pwvi2=0;for(var _pwki2=0;_pwki2<S.hand.length;_pwki2++){var _pwt2=S.hand[_pwki2];if(_pwt2&&!_pwt2.onBoard){if(pwKept[_pwt2.id]!==undefined){HP.x[_pwvi2]=pwKept[_pwt2.id];HP.vx[_pwvi2]=0;}_pwvi2++;}}
  hpBounds();HP.fromX=HP.x.slice();HP.toX=hpRest(_pwTotalN).slice(0,pwKeptN);
  HP.settleDur=200;HP.settleAt=performance.now();
  // Phase 2: fires the instant the slide animation ends — no spring physics overlap.
  await new Promise(function(r){
    HP.settleCallback=function(){
      HP.settleDur=150;
      drawFull();renderHUD();renderBoard();document.getElementById('bag-count').textContent=S.bag.length;
      _burstNewTilesFromBag(pwKeptN,_pwTotalN,document.getElementById('bag-btn'),r);
    };
  });
  window._scoring=false;
  if(_playBtn)_playBtn.disabled=false;
  saveGame();
  if(S.score>=tgt())setTimeout(roundComplete,700);
  else if(S.plays===0)setTimeout(function(){
    showGO('Scored '+S.score.toLocaleString()+' / '+tgt().toLocaleString()+'.');
    var needed=tgt()-S.score;
    if(window._lastPlaySnap&&DICT){
      findBestMoveBackground(window._lastPlaySnap,function(best){
        if(best&&best.score>=needed){
          var el=document.getElementById('gameover-best-play');if(!el)return;
          el.innerHTML='<div style="font-size:28px;color:#8880a8;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">You had this play:</div>'
            +'<div style="font-size:28px;font-weight:normal;color:#f0e080;letter-spacing:4px;margin:4px 0">'+best.word+'</div>'
            +'<div style="font-size:32px;color:#ff9090">for '+best.score.toLocaleString()+' pts — that would\'ve won.</div>';
          el.style.display='block';
        }
      });
    }
  },700);
}

function flashTiles(nt){
  for(var i=0;i<nt.length;i++){var el=document.querySelector('[data-sq-idx="'+nt[i].idx+'"] .board-tile');if(!el)continue;el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');setTimeout((function(e){return function(){e.classList.remove('flash');};})(el),580);}
}

function shuffleHand(){
  if(S.phase!=='play')return;
  _playTileClick('pick');
  var freeIdxs=[],freeTiles=[];
  for(var i=0;i<S.hand.length;i++){if(S.hand[i]&&!S.hand[i].onBoard){freeIdxs.push(i);freeTiles.push(S.hand[i]);}}
  if(freeTiles.length<2)return;
  for(var i=freeTiles.length-1;i>0;i--){var j=Math.floor(_rng()*(i+1));var tmp=freeTiles[i];freeTiles[i]=freeTiles[j];freeTiles[j]=tmp;}
  for(var i=0;i<freeIdxs.length;i++)S.hand[freeIdxs[i]]=freeTiles[i];
  renderHand();
  for(var i=0;i<HP.vx.length;i++)HP.vx[i]+=(Math.random()-0.5)*22;
}

function discardTiles(){
  if(currentConstraint()==='c_nodisc'){toast('Constraint: no discards this round!');return;}
  if(S.disc<=0){toast('No discards remaining!');return;}
  var sel=[];for(var i=0;i<S.hand.length;i++)if(S.hand[i]&&S.hand[i].sel&&!S.hand[i].onBoard)sel.push(i);
  if(!sel.length){toast('Click tiles to select them first.');return;}
  var selEls=Array.prototype.slice.call(document.getElementById('hand-area').querySelectorAll('.hand-tile.selected'));
  var N=selEls.length,done=0;
  var dur=180;
  function afterSnap(){
    var keptOldPos={};var _vi=0;
    for(var _ki=0;_ki<S.hand.length;_ki++){var _t=S.hand[_ki];if(_t&&!_t.onBoard){if(!_t.sel&&HP.x[_vi]!==undefined)keptOldPos[_t.id]=HP.x[_vi];_vi++;}}
    S.hand=S.hand.filter(function(t){return!t||!t.sel||t.onBoard;});HP.x=[];HP.vx=[];window._easyHint=null;S.disc--;
    for(var bi=0;bi<B*B;bi++){if(S.bt[bi]&&S.bt[bi].isNew){for(var k=0;k<S.hand.length;k++){if(S.hand[k]&&S.hand[k].onBoard&&S.hand[k]._boardSq===bi){S.bt[bi].handIdx=k;break;}}}}
    if(S.btTop){for(var bi=0;bi<B*B;bi++){if(S.btTop[bi]&&S.btTop[bi].isNew){for(var k=0;k<S.hand.length;k++){if(S.hand[k]&&S.hand[k].onBoard&&S.hand[k]._boardSq===bi){S.btTop[bi].handIdx=k;break;}}}}}
    var hasCooker=false;for(var i=0;i<S.tileStickers.length;i++)if(S.tileStickers[i].id==='pressure_cooker'){hasCooker=true;break;}
    if(hasCooker)S.discPressure=(S.discPressure||0)+1;
    saveGame();
    var keptCount=S.hand.filter(function(t){return t&&!t.onBoard;}).length;
    var _hm2=handMax();var _drawCap2=(currentConstraint()==='c_draw3')?3:_hm2;var _dcDrawN=S.devMode?Math.min(_hm2-S.hand.length,_drawCap2):Math.min(Math.min(_hm2-S.hand.length,_drawCap2),S.bag.length);
    var _dcTotalN=keptCount+Math.max(0,_dcDrawN);
    // Phase 1: render kept tiles, restore old positions, then slide left to make room.
    renderAll();
    var _vi2=0;for(var _ki2=0;_ki2<S.hand.length;_ki2++){var _t2=S.hand[_ki2];if(_t2&&!_t2.onBoard){if(keptOldPos[_t2.id]!==undefined){HP.x[_vi2]=keptOldPos[_t2.id];HP.vx[_vi2]=0;}_vi2++;}}
    hpBounds();HP.fromX=HP.x.slice();HP.toX=hpRest(_dcTotalN).slice(0,keptCount);
    HP.settleDur=200;HP.settleAt=performance.now();
    // Phase 2: fires the instant the slide animation ends — no spring physics overlap.
    HP.settleCallback=function(){
      HP.settleDur=150;
      drawFull();renderHUD();renderBoard();document.getElementById('bag-count').textContent=S.bag.length;
      _burstNewTilesFromBag(keptCount,_dcTotalN,document.getElementById('bag-btn'),null);
    };
  }
  if(!N){afterSnap();return;}
  for(var si=0;si<N;si++){
    (function(el){
      var t0=performance.now();
      function tick(now){
        var t=Math.min(1,(now-t0)/dur),sc,op;
        if(t<0.2){sc=1+t/0.2*0.3;op=1;}
        else{var s=(t-0.2)/0.8;sc=1.3*(1-s);op=Math.max(0,1-s*1.5);}
        el.style.transform='scale('+sc+')';el.style.opacity=op+'';
        if(t<1){requestAnimationFrame(tick);return;}
        el.style.visibility='hidden';done++;if(done===N)afterSnap();
      }
      requestAnimationFrame(tick);
    })(selEls[si]);
  }
}
