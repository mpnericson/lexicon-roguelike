// =====================================================================
// PLAY — word validation, playing, discarding, shuffling
// =====================================================================
async function playWord(){
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
      var r=nt[ni].row,c=nt[ni].col;var nb=[[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
      for(var nb2=0;nb2<nb.length;nb2++){var nr=nb[nb2][0],nc=nb[nb2][1];if(nr<0||nr>=B||nc<0||nc>=B)continue;var nbt=S.bt[nr*B+nc];if(nbt&&!nbt.isNew){conn=true;break outer;}}
    }
    if(!conn){toast('Word must connect to an existing word!');return;}
  }
  var boss=cb()[3];
  if(boss==='boss_long'&&main.word.length<5){toast('Constraint: use 5+ tiles!');return;}
  if(boss==='boss_hv'){var hv=false;for(var i=0;i<main.tiles.length;i++)if(!main.tiles[i].isBlank&&(LS[main.tiles[i].letter]||0)>=5){hv=true;break;}if(!hv){toast('Constraint: word must include a 5+ point tile!');return;}}
  if(boss==='boss_longer'&&(S.lastWordLen||0)>0&&main.word.length<=(S.lastWordLen||0)){toast('Constraint: word must be longer than your last ('+S.lastWordLen+' letters)!');return;}
  var palLocked=boss==='boss_pal'&&!S.palUnlocked;
  var justUnlocked=false;
  if(palLocked&&isExtendedPalindrome(main.word)){S.palUnlocked=true;palLocked=false;justUnlocked=true;}
  S._slotMachineRoll=null;
  var res=calcAll(nt,dir);
  var _eggWords={};for(var i=0;i<EASTER_EGGS.length;i++)_eggWords[EASTER_EGGS[i].word]=true;
  for(var i=0;i<res.words.length;i++){if(_eggWords[res.words[i].word])continue;var v=await validWord(res.words[i].word);if(!v){flashTiles(nt);if(!S.devMode){S.gold=Math.max(0,S.gold-2);renderHUD();toast('"'+res.words[i].word+'" is not a word — fined $2!');}else{toast('"'+res.words[i].word+'" is not a word.');}return;}}
  // Easter egg effects (before scoring — can mutate tile variants)
  var _eggApplied=applyEasterEgg(main.word,nt);if(_eggApplied)await new Promise(function(r){setTimeout(r,420);});
  // Bounty check (before scoring) — animate out before splicing
  var _bountyIdx=-1,_bountyItem=null;
  if(S.bounties&&S.bounties.length){for(var _bi=S.bounties.length-1;_bi>=0;_bi--){if(S.bounties[_bi].word===main.word){_bountyIdx=_bi;_bountyItem=S.bounties[_bi];break;}}}
  if(_bountyIdx>=0){
    var _bitem=_bountyItem,_br=_bitem.reward,_bountyMsg='';
    var _hasBH=false;for(var _bhi=0;_bhi<S.placed.length;_bhi++){if(S.placed[_bhi].id==='bounty_hunter'){_hasBH=true;break;}}
    if(_bitem.variant){
      var _converted=0;
      for(var _vti=0;_vti<main.tiles.length;_vti++){var _vt=main.tiles[_vti];if(_vt){_vt.variant=_bitem.variant;_converted++;}}
      if(_converted){_bountyMsg=' (+'+_converted+' '+_bitem.variant+(_converted>1?' tiles':' tile')+')';renderBoard();}
    }
    _bountyMsg='+$'+_br+_bountyMsg;
    var _wordBoardIdxs=main.tiles.map(function(t){return t.idx;});
    toast('Bounty complete! '+_bountyMsg);
    await animBountyComplete(_bountyIdx,_wordBoardIdxs);
    S.bounties.splice(_bountyIdx,1);
    if(_hasBH)S.bhMult=(S.bhMult||1)+0.25;
    S.gold+=_br;renderHUD();
  }
  if(!palLocked){
    if(justUnlocked)toast('Palindrome! Scoring is now live.');
    // Recalculate after any pre-scoring mutations (easter eggs, bounty tile upgrades)
    res=calcAll(nt,dir);
    var detailed=scoreWordDetailed(main.tiles,main.word,true,res.bingo?50:0);
    var _cxDir=dir==='h'?'v':'h';var _cxSeen={};var _allEvs=detailed.events.slice();var _cxAnimTotal=0;
    for(var _cxi=0;_cxi<nt.length;_cxi++){var _cxk=nt[_cxi].row+','+nt[_cxi].col;if(_cxSeen[_cxk])continue;_cxSeen[_cxk]=1;var _cxw=extractAt(nt[_cxi].row,nt[_cxi].col,_cxDir);if(!_cxw||_cxw.tiles.length<2)continue;var _cxd=scoreWordDetailed(_cxw.tiles,_cxw.word,false);_allEvs=_allEvs.concat(_cxd.events);_cxAnimTotal+=_cxd.total;}
    var crossLetters=Math.max(0,res.grand-detailed.total-_cxAnimTotal);
    await runScoreAnim(_allEvs,crossLetters,res.grand);
    S.score+=res.grand;S.gold+=res.tgold;
    _checkRankReward(res.grand,_capturedRankTop10);
  }else{toast('Scoring locked — play a palindrome first!');}
  achvCheck('word_played',{bingo:res.bingo,isPalin:isExtendedPalindrome(main.word)});
  S.wtr=(S.wtr||0)+1;S.discPressure=0;S.lastWordLen=main.word.length;
  if(S.wtr%3===0)for(var i=0;i<S.placed.length;i++)if(S.placed[i].id==='tome'){S.ts=(S.ts||0)+1;break;}
  var blueTiles=[];
  for(var i=0;i<B*B;i++){if(S.bt[i]&&S.bt[i].isNew){S.bt[i].isNew=false;S.bt[i].flying=false;var t=S.hand[S.bt[i].handIdx];if(t){if(t.variant==='blue'){var nb=(t.blueBonus||0)+(t.isBlank?0:(LS[t.letter]||0));blueTiles.push({letter:t.letter,isBlank:t.isBlank,id:t.id,variant:'blue',blueBonus:nb});}t._done=true;}}}
  // Save positions of kept (un-played) tiles before filtering
  var pwKept={};var _pwvi=0;for(var _pwki=0;_pwki<S.hand.length;_pwki++){var _pwt=S.hand[_pwki];if(_pwt&&!_pwt.onBoard){if(!_pwt._done&&HP.x[_pwvi]!==undefined)pwKept[_pwt.id]=HP.x[_pwvi];_pwvi++;}}
  S.hand=S.hand.filter(function(t){return!t._done;});
  for(var i=0;i<blueTiles.length;i++)S.bag.push(blueTiles[i]);
  if(blueTiles.length){S.bag=shuffle(S.bag);toast('Blue tile'+(blueTiles.length>1?'s':'')+' returned to bag!');}
  HP.x=[];HP.vx=[];window._easyHint=null;
  S.plays--;
  var pwKeptN=S.hand.filter(function(t){return t&&!t.onBoard;}).length;
  // Phase 1: render kept tiles only, restore old positions so they slide to new rest
  renderAll();
  var _pwvi2=0;for(var _pwki2=0;_pwki2<S.hand.length;_pwki2++){var _pwt2=S.hand[_pwki2];if(_pwt2&&!_pwt2.onBoard){if(pwKept[_pwt2.id]!==undefined){HP.x[_pwvi2]=pwKept[_pwt2.id];HP.vx[_pwvi2]=0;}_pwvi2++;}}
  // Phase 2: after slide, draw and burst new tiles
  await new Promise(function(r){setTimeout(function(){
    var pwKept2={};var _pwvi3=0;for(var _pwki3=0;_pwki3<S.hand.length;_pwki3++){var _pwt3=S.hand[_pwki3];if(_pwt3&&!_pwt3.onBoard){pwKept2[_pwt3.id]=HP.x[_pwvi3];_pwvi3++;}}
    drawFull();renderAll();
    var _pwvi4=0;for(var _pwki4=0;_pwki4<S.hand.length;_pwki4++){var _pwt4=S.hand[_pwki4];if(_pwt4&&!_pwt4.onBoard){if(_pwvi4<pwKeptN&&pwKept2[_pwt4.id]!==undefined){HP.x[_pwvi4]=pwKept2[_pwt4.id];HP.vx[_pwvi4]=0;}_pwvi4++;}}
    var pwAllEls=Array.prototype.slice.call(document.getElementById('hand-area').querySelectorAll('.hand-tile'));
    var pwNewEls=pwAllEls.slice(pwKeptN);
    if(pwNewEls.length){var pwBag=document.getElementById('bag-btn');var pwBagR=pwBag.getBoundingClientRect();pwBag.classList.add('bag-vacuuming');_burstTilesFromBag(pwNewEls,pwBagR.left+pwBagR.width/2,pwBagR.top+pwBagR.height/2,180,function(){pwBag.classList.remove('bag-vacuuming');});}
    r();
  },280);});
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
  var freeIdxs=[],freeTiles=[];
  for(var i=0;i<S.hand.length;i++){if(S.hand[i]&&!S.hand[i].onBoard){freeIdxs.push(i);freeTiles.push(S.hand[i]);}}
  if(freeTiles.length<2)return;
  for(var i=freeTiles.length-1;i>0;i--){var j=Math.floor(_rng()*(i+1));var tmp=freeTiles[i];freeTiles[i]=freeTiles[j];freeTiles[j]=tmp;}
  for(var i=0;i<freeIdxs.length;i++)S.hand[freeIdxs[i]]=freeTiles[i];
  renderHand();
  for(var i=0;i<HP.vx.length;i++)HP.vx[i]+=(Math.random()-0.5)*22;
}

function discardTiles(){
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
    var hasCooker=false;for(var i=0;i<S.placed.length;i++)if(S.placed[i].id==='pressure_cooker'){hasCooker=true;break;}
    if(hasCooker)S.discPressure=(S.discPressure||0)+1;
    saveGame();
    var keptCount=S.hand.filter(function(t){return t&&!t.onBoard;}).length;
    // Phase 1: render kept tiles only, restore old positions so they slide to new rest
    renderAll();
    var _vi2=0;for(var _ki2=0;_ki2<S.hand.length;_ki2++){var _t2=S.hand[_ki2];if(_t2&&!_t2.onBoard){if(keptOldPos[_t2.id]!==undefined){HP.x[_vi2]=keptOldPos[_t2.id];HP.vx[_vi2]=0;}_vi2++;}}
    // Phase 2: after slide, draw and burst new tiles
    setTimeout(function(){
      var keptPos2={};var _vi3=0;for(var _ki3=0;_ki3<S.hand.length;_ki3++){var _t3=S.hand[_ki3];if(_t3&&!_t3.onBoard){keptPos2[_t3.id]=HP.x[_vi3];_vi3++;}}
      drawFull();renderAll();
      var _vi4=0;for(var _ki4=0;_ki4<S.hand.length;_ki4++){var _t4=S.hand[_ki4];if(_t4&&!_t4.onBoard){if(_vi4<keptCount&&keptPos2[_t4.id]!==undefined){HP.x[_vi4]=keptPos2[_t4.id];HP.vx[_vi4]=0;}_vi4++;}}
      var allEls=Array.prototype.slice.call(document.getElementById('hand-area').querySelectorAll('.hand-tile'));
      var newEls=allEls.slice(keptCount);
      if(newEls.length){
        var bagEl=document.getElementById('bag-btn');var bagR=bagEl.getBoundingClientRect();
        bagEl.classList.add('bag-vacuuming');
        _burstTilesFromBag(newEls,bagR.left+bagR.width/2,bagR.top+bagR.height/2,180,function(){bagEl.classList.remove('bag-vacuuming');});
      }
    },280);
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
