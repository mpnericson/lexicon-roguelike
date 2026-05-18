// =====================================================================
// PLAY — word validation, playing, discarding, shuffling
// =====================================================================
async function playWord(){
  if(S.plays<=0){toast('No plays remaining!');return;}
  var nt=newTiles();if(!nt.length){toast('Place tiles on the board first!');return;}
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
  var palLocked=boss==='boss_pal'&&!S.palUnlocked;
  var justUnlocked=false;
  if(palLocked&&isExtendedPalindrome(main.word)){S.palUnlocked=true;palLocked=false;justUnlocked=true;}
  var res=calcAll(nt,dir);
  for(var i=0;i<res.words.length;i++){var v=await validWord(res.words[i].word);if(!v){flashTiles(nt);if(!S.devMode){S.gold=Math.max(0,S.gold-2);renderHUD();toast('"'+res.words[i].word+'" is not a word — fined $2!');}else{toast('"'+res.words[i].word+'" is not a word.');}return;}}
  if(!palLocked){
    if(justUnlocked)toast('Palindrome! Scoring is now live.');
    var detailed=scoreWordDetailed(main.tiles,main.word,true);
    var crossLetters=Math.max(0,res.grand-detailed.total-(res.bingo?50:0));
    await runScoreAnim(detailed.events,crossLetters,res.bingo,res.grand);
    S.score+=res.grand;S.gold+=res.tgold;
  }else{toast('Scoring locked — play a palindrome first!');}
  S.wtb=(S.wtb||0)+1;S.discPressure=0;
  if(S.wtb%3===0)for(var i=0;i<S.placed.length;i++)if(S.placed[i].id==='tome'){S.ts=(S.ts||0)+1;break;}
  var blueTiles=[];
  for(var i=0;i<B*B;i++){if(S.bt[i]&&S.bt[i].isNew){S.bt[i].isNew=false;S.bt[i].flying=false;var t=S.hand[S.bt[i].handIdx];if(t){if(t.variant==='blue'){var nb=(t.blueBonus||0)+(t.isBlank?0:(LS[t.letter]||0));blueTiles.push({letter:t.letter,isBlank:t.isBlank,id:t.id,variant:'blue',blueBonus:nb});}t._done=true;}}}
  S.hand=S.hand.filter(function(t){return!t._done;});
  for(var i=0;i<blueTiles.length;i++)S.bag.push(blueTiles[i]);
  if(blueTiles.length){S.bag=shuffle(S.bag);toast('Blue tile'+(blueTiles.length>1?'s':'')+' returned to bag!');}
  HP.x=[];HP.vx=[];
  S.plays--;drawFull();renderAll();
  if(S.score>=tgt())setTimeout(blindComplete,700);
  else if(S.plays===0)setTimeout(function(){showGO('Scored '+S.score.toLocaleString()+' / '+tgt().toLocaleString()+'.');},700);
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
  S.hand=S.hand.filter(function(t){return!t||!t.sel||t.onBoard;});HP.x=[];HP.vx=[];S.disc--;
  for(var bi=0;bi<B*B;bi++){if(S.bt[bi]&&S.bt[bi].isNew){for(var k=0;k<S.hand.length;k++){if(S.hand[k]&&S.hand[k].onBoard&&S.hand[k]._boardSq===bi){S.bt[bi].handIdx=k;break;}}}}
  var hasCooker=false;for(var i=0;i<S.placed.length;i++)if(S.placed[i].id==='pressure_cooker'){hasCooker=true;break;}
  if(hasCooker)S.discPressure=(S.discPressure||0)+1;
  drawFull();renderAll();
}
