// =====================================================================
// PLAY — word validation, playing, discarding, shuffling
// =====================================================================
async function playWord(){
  if(window._scoring){return;}
  if(S.plays<=0){toast('No plays remaining!');return;}
  _rankRunId++;
  var _capturedRankTop10=_rankTop10; _rankTop10=null;
  var nt=newTiles();if(!nt.length){toast('Place tiles on the board first!');return;}
  // The tiles the player placed this turn have left S.hand (they sit on the
  // board with isNew:true). Add them back so the snapshot hand is the FULL
  // rack available before this play — otherwise the game-over reveal scores
  // alternatives with too few tiles (e.g. 5-letter words falsely bingo).
  var _snapBack=[];
  for(var _sbi=0;_sbi<B*B;_sbi++){
    var _sbt=(S.btTop&&S.btTop[_sbi]&&S.btTop[_sbi].isNew)?S.btTop[_sbi]:(S.bt[_sbi]&&S.bt[_sbi].isNew?S.bt[_sbi]:null);
    if(_sbt)_snapBack.push(Object.assign({},_sbt,{onBoard:false,_boardSq:undefined,boardSq:undefined,blankAs:null}));
  }
  window._lastPlaySnap={
    hand:S.hand.map(function(t){return t?Object.assign({},t,{onBoard:false,_boardSq:undefined}):null;}).concat(_snapBack),
    bt:S.bt.map(function(bt){return(bt&&!bt.isNew)?Object.assign({},bt):null;}),
    board:S.board.slice(),
    // Pre-play values — the game-over reveal judges alternative words from
    // this position, so the score/constraint state must predate this word.
    score:S.score,
    lastWordLen:S.lastWordLen||0,
    palUnlocked:!!S.palUnlocked
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
  var _words=getAllWords(nt,dir);
  // Palindromes in ANY formed word (main or cross) count for the pal-lock
  // unlock and the Palindrome Engine.
  var _palWordsPlayed=[];for(var _pwi=0;_pwi<_words.length;_pwi++){if(isExtendedPalindrome(_words[_pwi].word))_palWordsPlayed.push(_words[_pwi].word);}
  var _con=currentConstraint();
  var palLocked=_con==='c_pal'&&!S.palUnlocked;
  var justUnlocked=false;
  if(palLocked&&_palWordsPlayed.length){S.palUnlocked=true;palLocked=false;justUnlocked=true;}
  var scoreLocked=false,scoreLockMsg='';
  if(_con==='c_long'&&main.word.length<5){scoreLocked=true;scoreLockMsg='Word scores 0 — only 5+ letter words score this round!';}
  if(_con==='c_longer'&&(S.lastWordLen||0)>0&&main.word.length<=(S.lastWordLen||0)){scoreLocked=true;scoreLockMsg='Word scores 0 — must be longer than your last ('+S.lastWordLen+' letters)!';}
  if(palLocked){scoreLocked=true;scoreLockMsg='Scoring locked — play a palindrome first!';}
  window._scoring=true;
  var _playBtn=document.querySelector('#play-controls .btn-icon-green');
  if(_playBtn)_playBtn.disabled=true;
  var _hasDT=hasStamp('drunk_text');
  var _eggWords={};for(var i=0;i<EASTER_EGGS.length;i++)_eggWords[EASTER_EGGS[i].word]=true;
  var _bountyWords={};if(S.bounties&&S.bounties.length){for(var _bwi2=0;_bwi2<S.bounties.length;_bwi2++){var _bws=S.bounties[_bwi2].words||[];for(var _bwj=0;_bwj<_bws.length;_bwj++)_bountyWords[_bws[_bwj].word.toUpperCase()]=true;}}
  var _dtInvalid=false;
  // Easter-egg and bounty words bypass the dictionary in ANY position (main or
  // cross) — they may not be real dictionary words but are legal to play.
  for(var i=0;i<_words.length;i++){var _vw=_words[i].word;if(_eggWords[_vw])continue;if(_bountyWords[_vw])continue;var v=await validWord(_vw);if(!v){if(_hasDT){_dtInvalid=true;}else{flashTiles(nt);window._scoring=false;if(_playBtn)_playBtn.disabled=false;if(!S.devMode){S.gold=Math.max(0,S.gold-1);renderHUD();toast('"'+_vw+'" is not a word — fined $1!');}else{toast('"'+_vw+'" is not a word.');}return;}}}
  if(_hasDT){S._drunkValid=!_dtInvalid;if(_dtInvalid)flashTiles(nt);}
  // Easter egg effects (before scoring — can mutate tile variants). Any formed
  // word (main or cross) can trigger an egg; each distinct egg fires once.
  var _eggApplied=false,_eggSeen={};
  for(var _egi=0;_egi<_words.length;_egi++){var _egw=_words[_egi].word;if(_eggSeen[_egw])continue;_eggSeen[_egw]=1;if(applyEasterEgg(_egw,nt))_eggApplied=true;}
  if(_eggApplied)await new Promise(function(r){setTimeout(r,AT(420));});
  // Bounty check — any formed word (main or cross) can complete a bounty scroll.
  // Glow starts NOW, reward applied inside scoring, slide-out after scoring.
  // _matchedBounties: one entry per completed scroll {scrollIdx, reward, idxs}.
  var _matchedBounties=[];
  if(S.bounties&&S.bounties.length){
    var _bScrollSeen={};
    for(var _wmi=0;_wmi<_words.length;_wmi++){
      var _wmUp=_words[_wmi].word.toUpperCase();
      for(var _bi=S.bounties.length-1;_bi>=0;_bi--){
        if(_bScrollSeen[_bi])continue;
        var _bscws=S.bounties[_bi].words||[];
        for(var _bwi=0;_bwi<_bscws.length;_bwi++){
          if(_bscws[_bwi].word.toUpperCase()===_wmUp){
            _bScrollSeen[_bi]=1;
            _matchedBounties.push({scrollIdx:_bi,reward:_bscws[_bwi].reward||0,idxs:_words[_wmi].idxs});
            break;
          }
        }
      }
    }
  }
  var _hasBH=hasStamp('bounty_hunter');
  if(_matchedBounties.length){
    var _totBReward=0;
    for(var _mbi=0;_mbi<_matchedBounties.length;_mbi++){_applyBountyGlow(_matchedBounties[_mbi].idxs,_matchedBounties[_mbi].scrollIdx);_totBReward+=_matchedBounties[_mbi].reward;}
    var _bN=_matchedBounties.length;
    toast(_bN>1?(_bN+' bounties complete! +$'+_totBReward+' + '+_bN+'× '+bountyRewardLabel()):('Bounty complete! +$'+_totBReward+' + '+bountyRewardLabel()));
    S._pendingBountyReward=_bN;
  }
  if(!scoreLocked){
    if(justUnlocked)toast('Palindrome! Scoring is now live.');
    var res=scorePlay(nt,dir,false);
    _fireAllHooks('onWordPlayed',[main.word,main.tiles]);
    if(_hasDT)delete S._drunkValid;
    // Photocopier: reserve hand space NOW, before the animation starts — the
    // hand slides over to leave room for every copy this play will print
    // (phantom slots on the right). Each copy's score-anim beat launches the
    // actual tile (_spawnPhotocopy); landing releases its slot.
    if(res.photocopies&&res.photocopies.length){HP.movingCount+=res.photocopies.length;hpBounds();}
    await runScoreAnim(res.events,res.total);
    // Don't rebuild the hand layout while a copy is still mid-flight.
    if(res.photocopies&&res.photocopies.length){
      await _photocopiesSettled();
      var _pcN=res.photocopies.length;
      toast('Photocopier: '+(_pcN>1?_pcN+' copies':'a copy')+' added to your hand!');
    }
    S.score+=res.total;S.gold+=res.tgold;
    // Record every formed word (main + crosswords) with this play's score.
    for(var _wbi=0;_wbi<_words.length;_wbi++)wordbookRecord(_words[_wbi].word,res.total);
    var _hasMT=hasStamp('midas');
    // Gild the single tile played this turn. Only fires when exactly one tile
    // was played from the hand (nt.length===1). Runs before the Jenga commit
    // below, so a fresh stacked tile is still in S.btTop (the visible played
    // tile); S.bt holds the buried committed tile — gild the top.
    if(_hasMT&&nt.length===1){var _mIdx=nt[0].idx;var _mGt=(S.btTop&&S.btTop[_mIdx]&&S.btTop[_mIdx].isNew)?S.btTop[_mIdx]:S.bt[_mIdx];if(_mGt)transformTile(_mGt.id,{variant:'gold'});}
    S.crossroadsCount=(S.crossroadsCount||0)+(res.crossWordCount||0);
    S._crossroadsLiveCount=null; // animation's display-only counter is now caught up — defer to the real one
    // Ouroboros & Cartographer grow LIVE during the score animation (their
    // per-tile events carry a scaleField, applied in scoring.js on the tile's
    // bink) so their counters climb the instant an O / corner tile scores — no
    // post-scoring lump commit needed here.
    _proletariatSpread();
    _checkRankReward(res.total,_capturedRankTop10);
    achvCheck('word_played',{bingo:res.bingo,isPalin:isExtendedPalindrome(main.word)});
    var _hasPE=hasStamp('palindrome_engine');
    if(_hasPE&&_palWordsPlayed.length){
      if(!S.palWords)S.palWords=[];
      var _peSeen={};
      for(var _pei=0;_pei<_palWordsPlayed.length;_pei++){
        var _pw=_palWordsPlayed[_pei];
        if(_peSeen[_pw]||S.palWords.indexOf(_pw)>=0)continue;
        _peSeen[_pw]=1;S.palWords.push(_pw);S.palMult=(S.palMult||1)+0.25;
      }
      if(Object.keys(_peSeen).length){stampScaleBounce('palindrome_engine');toast('Palindrome Engine: ×'+fmtMult(S.palMult)+'!');}
    }
  }else{toast(scoreLockMsg);}
  // Slot machine jackpot: every tile of the word through the machine takes
  // its rolled colour variant (res.slotTransforms, one entry per tile)
  if(res&&res.slotTransforms&&res.slotTransforms.length){
    for(var _sli=0;_sli<res.slotTransforms.length;_sli++){
      var _sl=res.slotTransforms[_sli];
      var _slT=(S.btTop&&S.btTop[_sl.idx]&&S.btTop[_sl.idx].isNew)?S.btTop[_sl.idx]:S.bt[_sl.idx];
      if(_slT&&_slT.id)transformTile(_slT.id,{variant:_sl.variant});
    }
    toast('🎰 Jackpot! Every tile in the word changed colour!');
  }
  // Super glue coverage — collected before the spring-trap block so glue can
  // protect traps too (glue keeps adjacent perishable stickers on the board;
  // their effects still fire).
  var _glueSquares=[];
  for(var _sgi=0;_sgi<S.placed.length;_sgi++){if(S.placed[_sgi].id==='super_glue'&&S.placed[_sgi].sqIdx!=null)_glueSquares.push(S.placed[_sgi].sqIdx);}
  function _gluedSq(idx){for(var _g=0;_g<_glueSquares.length;_g++){if(adjSq(idx,_glueSquares[_g]))return true;}return false;}
  // Spring trap: eject tile(s) into bag before commit
  if(res&&res.springTraps&&res.springTraps.length){
    for(var _sti=0;_sti<res.springTraps.length;_sti++){
      var _stIdx=res.springTraps[_sti];
      if(!S.bt[_stIdx]||S.board[_stIdx]!=='spring_trap')continue;
      var _stTile=S.bt[_stIdx];
      var _stRoll=_rng();var _stVariant=_stRoll<0.15?'gold':_stRoll<0.3?'blue':_stRoll<0.45?'red':_stRoll<0.6?'jade':_stRoll<0.75?'purple':(_stTile.variant||null);
      var _stOrigId=_stTile.id||null;
      if(_stOrigId)transformTile(_stOrigId,{destroy:true});
      var _stBagTile=addTileToBag({letter:_stTile.isBlank?'_':_stTile.letter,isBlank:!!_stTile.isBlank,variant:_stVariant});
      var _stCell=document.querySelector('[data-sq-idx="'+_stIdx+'"]');
      var _stRect=_stCell?_stCell.getBoundingClientRect():null;
      S.bt[_stIdx]=null;
      // Adjacent super glue keeps the trap on the board (the tile still ejects,
      // so a glued trap simply catches the next tile placed here).
      if(!_gluedSq(_stIdx)){
        S.board[_stIdx]=null;
        for(var _spi=S.placed.length-1;_spi>=0;_spi--){if(S.placed[_spi].id==='spring_trap'&&S.placed[_spi].sqIdx===_stIdx){S.placed.splice(_spi,1);break;}}
      }

      var _stVLabel=_stVariant?(' as '+_stVariant):'';
      toast('Spring Trap! '+(_stBagTile.isBlank?'?':_stBagTile.letter)+' returned to bag'+_stVLabel+'.');
      renderBoard();
      await new Promise(function(r){animSpringTrap(_stRect,_stBagTile,r);});
    }
    S.bag=shuffle(S.bag);
  }
  // Consume perishable board stickers where new tiles landed
  var _perishableChanged=false;
  var _wamConsumed=[];
  var _virusConsumed=[];
  for(var _pi=0;_pi<nt.length;_pi++){
    var _pIdx=nt[_pi].idx;var _pSid=S.board[_pIdx];if(!_pSid)continue;
    var _pDef=sqd(_pSid);if(!_pDef||!_pDef.perishable)continue;
    if(_pSid!=='super_glue'&&_gluedSq(_pIdx))continue;
    if(_pSid==='whack_a_mole')_wamConsumed.push(_pIdx);
    if(_pSid==='virus')_virusConsumed.push(_pIdx);
    S.board[_pIdx]=null;
    for(var _pri=S.placed.length-1;_pri>=0;_pri--){if(S.placed[_pri].sqIdx===_pIdx){S.placed.splice(_pri,1);break;}}
    _perishableChanged=true;
  }
  if(_perishableChanged)renderBoard();
  // Whack-a-Mole: spawn replacement in a random empty square within Manhattan-5 of origin
  for(var _wami=0;_wami<_wamConsumed.length;_wami++){
    var _wamOr=Math.floor(_wamConsumed[_wami]/B),_wamOc=_wamConsumed[_wami]%B;
    var _wamC=[];
    for(var _wamI=0;_wamI<B*B;_wamI++){
      var _wr=Math.floor(_wamI/B),_wc=_wamI%B;
      if(Math.abs(_wr-_wamOr)+Math.abs(_wc-_wamOc)<=5&&_wamI!==_wamConsumed[_wami]&&!S.board[_wamI]&&!S.bt[_wamI])_wamC.push(_wamI);
    }
    if(!_wamC.length)continue;
    var _wamNew=_wamC[Math.floor(_rng()*_wamC.length)];
    S.board[_wamNew]='whack_a_mole';
    S.placed.push({id:'whack_a_mole',sqIdx:_wamNew});
    renderBoard();
    toast('Whack-a-Mole! It moved.');
  }
  // Virus: after being consumed, spread to the 2 closest free squares (no tile,
  // no sticker). S.board is re-read each iteration so cascading spreads don't
  // collide.
  for(var _vi=0;_vi<_virusConsumed.length;_vi++){
    var _vOr=_virusConsumed[_vi],_vor=Math.floor(_vOr/B),_voc=_vOr%B,_vCand=[];
    for(var _vI=0;_vI<B*B;_vI++){
      if(_vI===_vOr||S.board[_vI]||S.bt[_vI])continue;
      _vCand.push({idx:_vI,d:Math.abs(Math.floor(_vI/B)-_vor)+Math.abs((_vI%B)-_voc)});
    }
    _vCand.sort(function(a,b){return a.d-b.d;});
    var _vSpawn=0;
    for(var _vk=0;_vk<_vCand.length&&_vSpawn<2;_vk++){
      S.board[_vCand[_vk].idx]='virus';
      S.placed.push({id:'virus',sqIdx:_vCand[_vk].idx});
      _vSpawn++;
    }
    if(_vSpawn>0){renderBoard();toast('Virus spread!');}
  }
  // Bounty slide-out: fires after scoring animation completes. Multiple scrolls
  // can complete at once — splice highest index first so lower ones stay valid.
  if(_matchedBounties.length){
    S._pendingBountyReward=null;
    var _bGold=0;for(var _mbg=0;_mbg<_matchedBounties.length;_mbg++)_bGold+=_matchedBounties[_mbg].reward;
    S.gold+=_bGold;
    var _bDesc=_matchedBounties.slice().sort(function(a,b){return b.scrollIdx-a.scrollIdx;});
    for(var _mbo=0;_mbo<_bDesc.length;_mbo++){
      await animBountySlideOut(_bDesc[_mbo].scrollIdx);
      S.bounties.splice(_bDesc[_mbo].scrollIdx,1);
      if(_hasBH){S.bhMult=(S.bhMult||1)+0.25;stampScaleBounce('bounty_hunter');}
    }
    if(_bGold)await animGoldTick(_bGold);
    renderHUD();
  }
  S.wtr=(S.wtr||0)+1;S.discPressure=0;
  if(_con==='c_letters'){var _mts=main.tiles;for(var _li2=0;_li2<_mts.length;_li2++){if(!_mts[_li2].isBlank&&_mts[_li2].letter)(S.usedLetters=S.usedLetters||new Set()).add(_mts[_li2].letter);}}
  S.lastWordLen=main.word.length;
  // Purple tiles: the ×2 already scored; every scored purple now rolls its
  // 1-in-4 vanish (rolled here at commit with _rng, never in preview/solver).
  if(res&&res.purpleScored&&res.purpleScored.length){
    var _ppN=0;
    for(var _ppi=0;_ppi<res.purpleScored.length;_ppi++){
      var _ppIdx=res.purpleScored[_ppi];
      var _ppT=(S.btTop&&S.btTop[_ppIdx])?S.btTop[_ppIdx]:S.bt[_ppIdx];
      if(!_ppT||_ppT.variant!=='purple')continue;
      if(_rng()<0.25){
        _ppN++;
        transformTile(_ppT.id,{destroy:true});
      }
    }
    if(_ppN){renderBoard();toast(_ppN>1?(_ppN+' purple tiles vanished!'):'A purple tile vanished!');}
  }
  // Worm Hole: teleport the tile played on the wormhole square to a random
  // empty, sticker-free square (rolled here at commit with _rng, never in the
  // engine/preview). Runs after the purple vanish so a vanished tile can't
  // teleport, and before the commit loop so the tile commits at its new home.
  // The sticker stays on the board; the freed square simply catches the next
  // tile played on it (per-square hooks are new-tile-gated).
  if(res&&res.wormholes&&res.wormholes.length){
    for(var _whi=0;_whi<res.wormholes.length;_whi++){
      var _whIdx=res.wormholes[_whi];
      if(S.board[_whIdx]!=='wormhole')continue;
      var _whTop=!!(S.btTop&&S.btTop[_whIdx]&&S.btTop[_whIdx].isNew);
      var _whT=_whTop?S.btTop[_whIdx]:S.bt[_whIdx];
      if(!_whT||!_whT.isNew)continue;
      var _whC=[];
      for(var _wc=0;_wc<B*B;_wc++){
        if(_wc===_whIdx||S.bt[_wc]||(S.btTop&&S.btTop[_wc])||S.board[_wc])continue;
        _whC.push(_wc);
      }
      if(!_whC.length)continue;
      var _whDest=_whC[Math.floor(_rng()*_whC.length)];
      var _whCell=document.querySelector('[data-sq-idx="'+_whIdx+'"]');
      var _whFrom=_whCell?_whCell.getBoundingClientRect():null;
      var _whDestCell=document.querySelector('[data-sq-idx="'+_whDest+'"]');
      var _whTo=_whDestCell?_whDestCell.getBoundingClientRect():null;
      if(_whTop)S.btTop[_whIdx]=null;else S.bt[_whIdx]=null;
      renderBoard();
      if(_whFrom&&_whTo)await new Promise(function(r){animWormhole(_whFrom,_whTo,_whT,r);});
      S.bt[_whDest]=_whT; // still isNew — the commit loop below finalises it here
      renderBoard();
      toast('Worm hole! '+tileDisplayLetter(_whT)+' teleported to '+rcl(_whDest)+'.');
    }
  }
  for(var i=0;i<B*B;i++){if(S.bt[i]&&S.bt[i].isNew){setTileState(S.bt[i],'board',{boardSq:i,isNew:false});}}
  // Commit Jenga stacked tiles: btTop replaces bt at that square, but the buried
  // tile's scoring/render info is preserved on _buried so it keeps scoring in
  // future words that pass through this square (and can still be revealed).
  if(S.btTop){for(var i=0;i<B*B;i++){if(S.btTop[i]&&S.btTop[i].isNew){var _btt=S.btTop[i];var _bur=S.bt[i];setTileState(_btt,'board',{boardSq:i,isNew:false});_btt._stackLevel=(_bur&&_bur._stackLevel?_bur._stackLevel:0)+1;if(_bur)_btt._buried={letter:_bur.letter,isBlank:!!_bur.isBlank,blankAs:_bur.blankAs||null,variant:_bur.variant||null,material:_bur.material||null,_alchSc:_bur._alchSc||0};S.bt[i]=_btt;S.btTop[i]=null;}}}
  // Save positions of kept tiles before filtering
  var pwKept={};var _pwvi=0;for(var _pwki=0;_pwki<S.hand.length;_pwki++){var _pwt=S.hand[_pwki];if(_pwt){if(HP.x[_pwvi]!==undefined)pwKept[_pwt.id]=HP.x[_pwvi];_pwvi++;}}
  S.hand=S.hand.filter(function(t){return!t._done;});
  HP.x=[];HP.vx=[];window._easyHint=null;
  S.plays--;
  var pwKeptN=S.hand.filter(Boolean).length;
  // Predict final hand size so Phase 1 slides tiles to their true final positions.
  var _hm=handMax();var _drawCap=(_con==='c_draw3')?3:_hm;var _pwDrawN=S.devMode?Math.min(_hm-S.hand.length,_drawCap):Math.min(Math.min(_hm-S.hand.length,_drawCap),S.bag.length);
  var _pwTotalN=pwKeptN+Math.max(0,_pwDrawN);
  await _animateDrawPhase(pwKept,pwKeptN,_pwTotalN);
  window._scoring=false;
  if(_playBtn)_playBtn.disabled=false;
  saveGame();
  if(window.TUT&&TUT.active)tutEvent('word-played',{word:main.word});
  if(S.score>=tgt())setTimeout(roundComplete,AT(700));
  else if(S.plays===0)setTimeout(function(){
    // Safety Net: if score >= 25% of target, advance to shop and destroy the stamp
    var _snIdx=-1;for(var _si=0;_si<(S.stamps||[]).length;_si++){if(S.stamps[_si].id==='safety_net'){_snIdx=_si;break;}}
    if(_snIdx>=0&&S.score>=Math.floor(tgt()*0.25)){
      S.stamps.splice(_snIdx,1);
      renderStampBar();renderHUD();
      toast('Safety Net! Advancing to shop...');
      setTimeout(advanceRound,1200);
      return;
    }
    showGO('Scored '+S.score.toLocaleString()+' / '+tgt().toLocaleString()+'.');
    if(window._lastPlaySnap&&DICT){
      // Judge alternatives from the position BEFORE the final word: the
      // points it needed are measured against the pre-play score.
      var needed=tgt()-window._lastPlaySnap.score;
      var _showWins=function(top){
        var wins=[];
        for(var _wi=0;_wi<(top||[]).length&&wins.length<5;_wi++){if(top[_wi].score>=needed)wins.push(top[_wi]);}
        if(!wins.length)return;
        var el=document.getElementById('gameover-best-play');if(!el)return;
        var html='<div style="font-size:28px;color:#8880a8;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">'
          +(wins.length>1?'These plays would\'ve won:':'This play would\'ve won:')+'</div>';
        for(var _hi=0;_hi<wins.length;_hi++){
          var _w=wins[_hi],_pos=rcl(_w.r*B+_w.c)+(_w.isH?'→':'↓');
          html+='<div style="display:flex;align-items:baseline;gap:10px;margin:3px 0">'
            +'<span style="font-size:28px;color:#f0e080;letter-spacing:4px">'+_w.word+'</span>'
            +'<span style="font-size:24px;color:#7070a0">'+_pos+'</span>'
            +'<span style="font-size:26px;color:#80ff80;margin-left:auto">'+_w.score.toLocaleString()+' pts</span>'
            +'</div>';
        }
        el.innerHTML=html;
        el.style.display='block';
      };
      // The background rank solver already evaluated this exact position (full
      // pre-play hand, committed board) — reuse its top 10 rather than re-solve.
      // Fall back to a fresh solve only if it hadn't finished before this play.
      if(_capturedRankTop10&&_capturedRankTop10.length)_showWins(_capturedRankTop10);
      else findBestMoveBackground(window._lastPlaySnap,_showWins);
    }
  },700);
}

// Two-phase draw animation shared by playWord and discardTiles.
// Phase 1: restore kept-tile positions, slide to final layout.
// Phase 2: burst new tiles from the bag in when phase 1 settles.
// Returns a Promise that resolves when _burstNewTilesFromBag completes.
// Callers that need to await (playWord) do so; callers that don't (discardTiles) ignore the Promise.
function _animateDrawPhase(keptOldPos,keptCount,totalN,maxDraw){
  renderAll();
  var vi=0;
  for(var ki=0;ki<S.hand.length;ki++){
    var t=S.hand[ki];
    if(t){
      if(keptOldPos[t.id]!==undefined){HP.x[vi]=keptOldPos[t.id];HP.vx[vi]=0;}
      vi++;
    }
  }
  hpDraw();
  hpBounds();HP.fromX=HP.x.slice();HP.toX=hpRest(totalN).slice(0,keptCount);
  HP.settleDur=200;HP.settleAt=performance.now();
  return new Promise(function(resolve){
    HP.settleCallback=function(){
      HP.settleDur=150;
      var _bagBefore=S.bag.length;
      drawFull(maxDraw);renderHUD();renderBoard();
      _tickBagCount(_bagBefore,S.bag.length,130);
      _burstNewTilesFromBag(keptCount,totalN,document.getElementById('bag-btn'),resolve);
    };
  });
}

function flashTiles(nt){
  for(var i=0;i<nt.length;i++){var el=document.querySelector('[data-sq-idx="'+nt[i].idx+'"] .board-tile');if(!el)continue;el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');setTimeout((function(e){return function(){e.classList.remove('flash');};})(el),580);}
}

// ── Animated shuffle ──────────────────────────────────────────────────
// shuffleHand rolls a new hand order, then flies the MINIMUM set of tiles
// into place one at a time — tiles forming the longest increasing
// subsequence w.r.t. the new order never lift, they just slide on the
// springs. Movers travel in axis-aligned legs only (straight up, across,
// straight down), each leg accelerating from rest. Whole sequence budgeted
// at ~3.5s. Clicking mid-animation rerolls the order: the airborne tile
// changes course toward its new slot (climbing back to travel height
// first) and a fresh minimal plan continues after it lands.
var _shuf=null; // {S, pos, settled, queue, per, flight}
// Travel height must exceed the 68px tile + 4px shadow so a flier fully
// clears the seated tiles before its lateral leg starts.
var SHUF_LIFT=84;

function _shufFreeTiles(){
  var out=[];
  for(var i=0;i<S.hand.length;i++){var t=S.hand[i];if(t&&t.state==='hand')out.push(t);}
  return out;
}

// Minimal move plan: tiles in the longest increasing subsequence (by slot in
// the new order) are 'settled' and never fly; everything else queues up.
function _shufPlan(rack,order){
  var pos={};for(var i=0;i<order.length;i++)pos[order[i].id]=i;
  var n=rack.length,P=[],len=[],par=[],best=0,bi=-1;
  for(var i=0;i<n;i++)P.push(pos[rack[i].id]);
  for(var i=0;i<n;i++){
    len[i]=1;par[i]=-1;
    for(var j=0;j<i;j++)if(P[j]<P[i]&&len[j]+1>len[i]){len[i]=len[j]+1;par[i]=j;}
    if(len[i]>best){best=len[i];bi=i;}
  }
  var keep={};for(var k=bi;k>=0;k=par[k])keep[rack[k].id]=true;
  var settled={},queue=[];
  for(var i=0;i<n;i++){if(keep[rack[i].id])settled[rack[i].id]=true;else queue.push(rack[i]);}
  return{pos:pos,settled:settled,queue:queue};
}

// Vis-order landing slot for t: right after the last settled tile that comes
// before it in the new order. Settled tiles are always in correct relative
// order, so this is unambiguous; unsettled tiles in between fly out later.
function _shufInsertIdx(t){
  var vis=_shufFreeTiles(),p=_shuf.pos[t.id],lastSmall=-1,firstLarge=-1;
  for(var i=0;i<vis.length;i++){
    var q=_shuf.pos[vis[i].id];
    if(q===undefined||!_shuf.settled[vis[i].id])continue;
    if(q<p)lastSmall=i;
    else if(firstLarge<0)firstLarge=i;
  }
  if(lastSmall>=0)return lastSmall+1;
  if(firstLarge>=0)return firstLarge;
  return vis.length;
}

// Rest-slot centre x for landing at vis index idx, in the post-landing layout
// (current rack + the lander + any phantom slots reserved by recall arcs).
function _shufDestX(idx){
  hpBounds();
  var n=_shufFreeTiles().length+1+(HP.movingCount>0?HP.movingCount:0);
  return HP.rest(n)[idx];
}

function _shufAbort(){
  if(_shuf&&_shuf.flight&&_shuf.flight.el.parentNode)_shuf.flight.el.parentNode.removeChild(_shuf.flight.el);
  _shuf=null;HP.shufHoleIdx=null;
}

// Axis-aligned flight legs from (x0,y0) to (x1,0): up to travel height,
// across, drop in. Leg durations share one acceleration (time ∝ √distance);
// each leg eases in from rest, so every direction change starts at 0 speed.
function _shufLegs(x0,y0,x1,total){
  var H=-SHUF_LIFT,legs=[];
  if(y0-H>0.5)legs.push({axis:'y',from:y0,to:H});
  var yTop=legs.length?H:y0;
  if(Math.abs(x1-x0)>0.5)legs.push({axis:'x',from:x0,to:x1});
  legs.push({axis:'y',from:yTop,to:0});
  var sum=0;
  for(var i=0;i<legs.length;i++){legs[i].d=Math.abs(legs[i].to-legs[i].from);sum+=Math.sqrt(legs[i].d);}
  for(var i=0;i<legs.length;i++)legs[i].dur=sum>0?total*Math.sqrt(legs[i].d)/sum:total/legs.length;
  return legs;
}

function _shufStartNext(){
  var t=null;
  while(_shuf.queue.length){var c=_shuf.queue.shift();if(c&&c.state==='hand'){t=c;break;}}
  if(!t){_shuf=null;HP.shufHoleIdx=null;return;}
  var area=document.getElementById('hand-area');
  var el=area?area.querySelector('[data-tile-id="'+t.id+'"]'):null;
  if(!el){_shufStartNext();return;} // no element (mid-burst etc.) — leave it be
  var r=el.getBoundingClientRect(),hr=area.getBoundingClientRect();
  var clone=el.cloneNode(true);
  clone.classList.remove('selected');
  clone.style.cssText+=';position:fixed;left:'+r.left+'px;top:'+r.top+'px;z-index:9999;margin:0;pointer-events:none;transition:none;transform:scale(1.06)';
  document.body.appendChild(clone);
  setTileState(t,'moving',{movingFrom:'hand',movingTo:'hand'});
  renderHand();
  // Reserve the landing slot as a hole immediately: the rack keeps its full
  // width (no re-centering), and only the tiles between the flier's old and
  // new slot slide over to make room.
  var idx=_shufInsertIdx(t);
  HP.shufHoleIdx=idx;
  var x0=r.left+34,y0=r.top-hr.top,destX=_shufDestX(idx);
  _shuf.flight={t:t,el:clone,cx:x0,cy:y0,x1:destX,baseTop:hr.top,
    legs:_shufLegs(x0,y0,destX,_shuf.per),li:0,segStart:performance.now()};
  requestAnimationFrame(_shufTick);
}

function _shufTick(){
  if(!_shuf||!_shuf.flight)return;
  if(S!==_shuf.S){_shufAbort();return;}
  var f=_shuf.flight,now=performance.now();
  while(f.li<f.legs.length){
    var L=f.legs[f.li],p=(now-f.segStart)/L.dur;
    if(p>=1){ // leg done — snap to its end, carry leftover time into the next
      if(L.axis==='x')f.cx=L.to;else f.cy=L.to;
      f.segStart+=L.dur;f.li++;continue;
    }
    var v=L.from+(L.to-L.from)*p*p; // ease-in: accelerate from rest
    if(L.axis==='x')f.cx=v;else f.cy=v;
    break;
  }
  f.el.style.left=(f.cx-34)+'px';
  f.el.style.top=(f.baseTop+f.cy)+'px';
  if(f.li<f.legs.length){requestAnimationFrame(_shufTick);return;}
  _shufLand();
}

function _shufLand(){
  var f=_shuf.flight;_shuf.flight=null;
  if(f.el.parentNode)f.el.parentNode.removeChild(f.el);
  var t=f.t,idx=_shufInsertIdx(t); // recompute — rack may have changed mid-flight
  HP.shufHoleIdx=null; // the lander fills the hole this frame — no one else moves
  // Reposition within S.hand: in front of the tile currently at vis index idx.
  S.hand=S.hand.filter(function(x){return x!==t;});
  var c=0,hi=S.hand.length;
  for(var i=0;i<S.hand.length;i++){var h=S.hand[i];if(h&&h.state==='hand'){if(c===idx){hi=i;break;}c++;}}
  S.hand.splice(hi,0,t);
  setTileState(t,'hand');
  _shuf.settled[t.id]=true;
  // Splice physics arrays at the same vis index so hpRebuild keeps positions.
  HP.x.splice(idx,0,f.x1);HP.vx.splice(idx,0,0);
  renderHand();
  _playTileClick('land');
  if(_shuf.queue.length)_shufStartNext();else _shuf=null;
}

function shuffleHand(){
  if(S.phase!=='play')return;
  if(_shuf&&S!==_shuf.S)_shufAbort();
  var flight=_shuf?_shuf.flight:null;
  var rack=_shufFreeTiles();
  if(rack.length+(flight?1:0)<2)return;
  _playTileClick('pick');
  // Roll a new order over every free tile (flier included). With nothing
  // airborne, insist on an order that differs so the click always moves something.
  var all=flight?rack.concat([flight.t]):rack.slice(),order;
  for(var tries=0;tries<24;tries++){
    order=all.slice();
    for(var i=order.length-1;i>0;i--){var j=Math.floor(_rng()*(i+1));var tmp=order[i];order[i]=order[j];order[j]=tmp;}
    if(flight)break;
    var same=true;
    for(var i=0;i<rack.length;i++)if(order[i]!==rack[i]){same=false;break;}
    if(!same)break;
  }
  var plan=_shufPlan(rack,order);
  var k=plan.queue.length+(flight?1:0);
  if(!k){_shuf=null;return;}
  var per=Math.max(AT(400),Math.min(AT(3500)/k,AT(1000)));
  _shuf={S:S,pos:plan.pos,settled:plan.settled,queue:plan.queue,per:per,flight:flight};
  if(flight){
    // Redirect the airborne tile toward its slot in the rerolled order —
    // fresh legs from where it is now, hole moved to the new landing slot;
    // the rest of the plan runs after it lands.
    var fIdx=_shufInsertIdx(flight.t);
    HP.shufHoleIdx=fIdx;
    flight.x1=_shufDestX(fIdx);
    flight.legs=_shufLegs(flight.cx,flight.cy,flight.x1,per);
    flight.li=0;flight.segStart=performance.now();
  } else {
    _shufStartNext();
  }
}

function discardTiles(){
  if(currentConstraint()==='c_nodisc'){toast('Constraint: no discards this round!');return;}
  if(S.disc<=0){toast('No discards remaining!');return;}
  var sel=[];for(var i=0;i<S.hand.length;i++)if(S.hand[i]&&S.hand[i].sel)sel.push(i);
  if(!sel.length){toast('Click tiles to select them first.');return;}
  if(window.TUT&&TUT.active&&!_tutDiscardOK(sel))return;
  var selEls=Array.prototype.slice.call(document.getElementById('hand-area').querySelectorAll('.hand-tile.selected'));
  var N=selEls.length,done=0;
  var dur=180;
  function afterSnap(){
    var keptOldPos={};var _vi=0;
    for(var _ki=0;_ki<S.hand.length;_ki++){var _t=S.hand[_ki];if(_t){if(!_t.sel&&HP.x[_vi]!==undefined)keptOldPos[_t.id]=HP.x[_vi];_vi++;}}
    // Capture discard IDs before setTileState clears t.sel, then filter by ID.
    var _discardIds={},_discTiles=[];
    for(var _di=0;_di<S.hand.length;_di++){if(S.hand[_di]&&S.hand[_di].sel){_discardIds[S.hand[_di].id]=true;_discTiles.push(S.hand[_di]);setTileState(S.hand[_di],'stored',{storedIn:'discard'});}}
    S.hand=S.hand.filter(function(t){return!t||!_discardIds[t.id];});HP.x=[];HP.vx=[];window._easyHint=null;S.disc--;
    var _firstDisc=!(S.discardsThisRound||0);S.discardsThisRound=(S.discardsThisRound||0)+1;
    // The Hammer: first discard of the round, exactly one tile → destroy it
    // (purged from S.pool — gone for the run) and pay $3 per copy. A
    // replacement is still drawn below like any discard.
    var _hamN=countStamp('the_hammer');
    if(_firstDisc&&_discTiles.length===1&&_hamN){
      var _hamT=_discTiles[0];
      transformTile(_hamT.id,{destroy:true});
      S.gold+=3*_hamN;
      stampScaleBounce('the_hammer');renderHUD();
      toast('The Hammer: '+(_hamT.isBlank?'blank':_hamT.letter)+' destroyed, +$'+(3*_hamN)+'!');
    }
    if(hasStamp('pressure_cooker')){S.discPressure=(S.discPressure||0)+1;stampScaleBounce('pressure_cooker');}
    saveGame();
    if(window.TUT&&TUT.active)tutEvent('discard');
    var keptCount=S.hand.filter(Boolean).length;
    var _hm2=handMax();var _drawCap2=(currentConstraint()==='c_draw3')?3:_hm2;var _dcDrawN=S.devMode?Math.min(sel.length,_drawCap2):Math.min(Math.min(sel.length,_drawCap2),S.bag.length);
    var _dcTotalN=keptCount+Math.max(0,_dcDrawN);
    _animateDrawPhase(keptOldPos,keptCount,_dcTotalN,_dcDrawN);
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
