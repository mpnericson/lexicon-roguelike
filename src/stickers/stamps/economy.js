// ── INKWELL ───────────────────────────────────────────────────────────────────
// type: stamp · rarity: common · cost: $3
// onPostWord: simple +$1 per word played.
SQ.push({id:'inkwell',name:'Inkwell',desc:'+$1 every word played.',
  rarity:'common',cost:3,bg:'#0a1a0a',fg:'#60d060',icon:'IK',type:'stamp',
  onPostWord:function(w,wt,ctx){ctx.tgold++;ctx.events.push({type:'gold',delta:1,label:'Inkwell +$1'});}});

// ── GOLD RUSH ─────────────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5
// onPerTile: every gold tile scored in a word earns +$2 and +2 mult. Fires
// once per instance per gold tile. (Gold tiles' own $1 pays for every gold
// tile on the board in the POST board sweep, not per-tile.)
SQ.push({id:'gold_rush',name:'Gold Rush',desc:'Gold tiles gain +$2 when scored, and +2 mult.',
  rarity:'uncommon',cost:5,bg:'#2a1f00',fg:'#f0d040',icon:'GR',type:'stamp',
  onPerTile:function(tile,ctx,ts){
    if(tile.variant==='gold'){
      ctx.tgold+=2;
      ctx.events.push({type:'gold',delta:2,sqIdx:tile.idx,label:'Gold Rush +$2',floatStampId:'gold_rush'});
      ctx.plusMults.push(2);
      ctx.events.push({type:'plus-mult',delta:2,label:'Gold Rush +2 mult',floatStampId:'gold_rush'});
    }
    return ts;
  }});

// ── PRESSURE COOKER ───────────────────────────────────────────────────────────
// type: stamp · rarity: common · cost: $3
// onPostWord: reads ctx.state.discPressure (incremented by play.js on each
// discard, zeroed after each word) and dumps it as a flat mult.
SQ.push({id:'pressure_cooker',name:'Pressure Cooker',
  desc:'Each discard this round adds +1 mult to the next word.',
  rarity:'common',cost:3,bg:'#2a0a0a',fg:'#f08060',icon:'PC',type:'stamp',
  liveDesc:function(p){var dp=S.discPressure||0;return 'Each discard adds +1 mult to the next word. Stored: <span style="color:#f0e040">+'+dp+' mult</span>.';},
  onPostWord:function(w,wt,ctx){var dp=ctx.state.discPressure||0;if(dp>0){ctx.plusMults.push(dp);ctx.events.push({type:'plus-mult',delta:dp,label:'Pressure Cooker +'+dp+' mult'});}}});

// ── THE MISER ─────────────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5
// onPostWord: reads ctx.state.bagColouredCount and applies ×(1 + n×0.1) mult.
SQ.push({id:'the_miser',name:'The Miser',desc:'+×0.1 mult for each coloured tile in your bag.',
  rarity:'uncommon',cost:5,bg:'#1a1a0a',fg:'#d4af37',icon:'MS',type:'stamp',
  liveDesc:function(p){var n=S.bag.filter(function(t){return t.variant;}).length;var f=parseFloat((1+n*0.1).toFixed(2));return n+' coloured tile'+(n!==1?'s':'')+' in bag → <span style="color:#f0e040">×'+f.toFixed(2)+' mult</span>';},
  onPostWord:function(w,wt,ctx){var n=ctx.state.bagColouredCount||0;if(n>0){var f=parseFloat((1+n*0.1).toFixed(2));ctx.xmults.push(f);ctx.events.push({type:'x-mult',factor:f,label:'The Miser ×'+f.toFixed(2)});}}});

// ── BOUNTY HUNTER ─────────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5
// onPostWord: applies the permanent ×mult accumulated from completed bounties
// (ctx.state.bhMult — incremented by +0.25 in play.js each time a bounty resolves).
SQ.push({id:'bounty_hunter',name:'Bounty Hunter',
  desc:'Each completed bounty permanently adds ×0.25 to your score multiplier.',
  rarity:'uncommon',cost:5,bg:'#1a2a0a',fg:'#c0e080',icon:'BH',type:'stamp',
  liveDesc:function(p){var bh=parseFloat((S.bhMult||1).toFixed(2));return 'Each completed bounty: permanent +×0.25 mult. Currently applying <span style="color:#f0e040">×'+bh+' mult</span>.';},
  onPostWord:function(w,wt,ctx){var bh=ctx.state.bhMult||1;if(bh>1){ctx.xmults.push(bh);ctx.events.push({type:'x-mult',factor:parseFloat(bh.toFixed(2)),label:'Bounty Hunter ×'+bh.toFixed(2)});}}});

// ── SHERIFF'S OFFICE ──────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5
// No scoring hook. Effect is purely in play.js: fires _awardFreeBounty() whenever
// the player hits a score milestone within a board.
SQ.push({id:'sheriffs_office',name:"Sheriff's Office",
  desc:'Gain 1 free random bounty whenever you meet a score target.',
  rarity:'uncommon',cost:5,bg:'#2a1a00',fg:'#f0b060',icon:'SO',type:'stamp'});

// ── THE BOURGEOIS ─────────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5
// onEndBoard: pays $1 per placed sticker, then self-destructs if 20+ Proletariats
// are on the board (the revolution).
SQ.push({id:'bourgeois',name:'The Bourgeois',
  desc:'End of board: earn $1 per sticker. Destroyed if there are 20+ Proletariats.',
  rarity:'uncommon',cost:5,qty:1,bg:'#2a2000',fg:'#f0d060',icon:'BG',type:'stamp',
  liveDesc:function(p){var count=0;for(var _bi2=0;_bi2<B*B;_bi2++){if(S.board[_bi2])count++;}return 'End of board: earn <span style="color:#f0e040">$'+count+'</span> ('+count+' sticker'+(count!==1?'s':'')+').';},
  onEndBoard:function(placed){
    var count=0;
    for(var _bi2=0;_bi2<B*B;_bi2++){if(S.board[_bi2])count++;}
    goldGain('The Bourgeois',count);
    var proCount=0;
    for(var _pi=0;_pi<S.placed.length;_pi++)if(S.placed[_pi].id==='proletariat')proCount++;
    if(proCount>=20){
      var _ri=S.placed.indexOf(placed);
      if(_ri>=0){S.board[placed.sqIdx]=null;S.placed.splice(_ri,1);renderBoard();}
      else{var _ti=S.stamps.indexOf(placed);if(_ti>=0)S.stamps.splice(_ti,1);}
      toast('Bourgeois: Revolution! Overthrown by '+proCount+' Proletariats!');
    }
  }});

// ── INSATIABLE ────────────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5
// No scoring hook. Effect is in game.js advanceBlind: +1 discard is added when
// this stamp is present.
SQ.push({id:'insatiable',name:'Insatiable',desc:'+1 discard at the start of every round.',
  rarity:'uncommon',cost:5,bg:'#1a0a30',fg:'#d060ff',icon:'IN',type:'stamp'});

// ── EMERGENCY RATIONS ─────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5
// onSell: opens the bag in pick mode so the player can pull one chosen tile into
// their hand. Bag pick mode is set via window._bagPickMode in game.js.
SQ.push({id:'emergency_rations',name:'Emergency Rations',
  desc:'Sell this stamp to open your bag and pull one tile of your choice into your hand.',
  rarity:'uncommon',cost:5,bg:'#2a1400',fg:'#f0a040',icon:'RS',type:'stamp',
  onSell:function(){
    if(!S.bag.length){toast('Bag is empty!');return;}
    window._bagPickMode=function(tile){
      var idx=-1;for(var i=0;i<S.bag.length;i++){if(S.bag[i].id===tile.id){idx=i;break;}}
      if(idx<0)return;
      S.bag.splice(idx,1);
      setTileState(tile,'hand');S.hand.push(tile);
      window._bagPickMode=null;
      closeBagUI();
      HP.x=[];HP.vx=[];
      renderAll();
      toast('Emergency Rations: '+(tile.isBlank?'Blank':tile.letter)+' drawn from bag!');
    };
    openBagModal();
  }});

// ── THE TARGET ────────────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5
// onPostWord: fires if the player used all tiles from their free hand (ctx.newTileCount
// >= ctx._freeHandCount). Rewards ×2 mult and +$5.
SQ.push({id:'the_target',name:'The Target',
  desc:'Playing all tiles from your hand: ×2 mult and +$5.',
  rarity:'uncommon',cost:5,bg:'#2a0a00',fg:'#ff6030',icon:'TG',type:'stamp',
  onPostWord:function(w,wt,ctx){
    if(ctx.newTileCount>0&&ctx.newTileCount>=ctx._freeHandCount){
      ctx.xmults.push(2);ctx.tgold+=5;
      ctx.events.push({type:'x-mult',factor:2,label:'The Target ×2'});
      ctx.events.push({type:'gold',delta:5,label:'The Target +$5'});
    }
  }});

// ── PIÑATA ────────────────────────────────────────────────────────────────────
// type: stamp · rarity: rare · cost: $5
// onSell: scatters 4–8 random stickers onto random free squares.
SQ.push({id:'pinata',name:'Piñata',
  desc:'Sell to break it open — scatters 4-8 random stickers onto free squares.',
  rarity:'rare',cost:5,bg:'#2a0a28',fg:'#f8c060',icon:'🎊',type:'stamp',
  onSell:function(){
    var _pnPool=[];
    for(var _pni=0;_pni<SQ.length;_pni++){if(SQ[_pni].type==='board'||SQ[_pni].type==='local')_pnPool.push(SQ[_pni].id);}
    var _pnFree=[];
    for(var _pnf=0;_pnf<B*B;_pnf++){if(!S.board[_pnf]&&!S.bt[_pnf])_pnFree.push(_pnf);}
    if(!_pnFree.length){toast('Pi\xf1ata: no free squares!');return;}
    var _pnN=4+Math.floor(_rng()*5);
    _pnN=Math.min(_pnN,_pnFree.length);
    for(var _pns=_pnFree.length-1;_pns>0;_pns--){var _pnj=Math.floor(_rng()*(_pns+1));var _pnt=_pnFree[_pns];_pnFree[_pns]=_pnFree[_pnj];_pnFree[_pnj]=_pnt;}
    for(var _pnc=0;_pnc<_pnN;_pnc++){
      var _pnId=_pnPool[Math.floor(_rng()*_pnPool.length)];
      S.board[_pnFree[_pnc]]=_pnId;
      S.placed.push({id:_pnId,sqIdx:_pnFree[_pnc]});
    }
    renderBoard();
    toast('Pi\xf1ata! '+_pnN+' stickers scattered on the board!');
  }});

// ── SAFETY NET ────────────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5
// No scoring hook. Checked in game.js showGO: if the player scored ≥25% of the
// target, advances to the shop instead of game over. Removed on use.
SQ.push({id:'safety_net',name:'Safety Net',
  desc:'If you fail a round but scored at least 25% of the target, advance to the shop anyway. Destroyed on use.',
  rarity:'uncommon',cost:5,qty:1,bg:'#001a2a',fg:'#60c8ff',icon:'SN',type:'stamp'});

// ── THE HAMMER ────────────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5
// No scoring hook. Effect fires in play.js discardTiles: if the FIRST discard
// of the round is exactly one tile, that tile is destroyed (removed from the
// pool for the rest of the run) and each copy pays $3. S.discardsThisRound
// (reset each round) tracks whether the hammer is still armed.
SQ.push({id:'the_hammer',name:'The Hammer',
  desc:'If your first discard of the round is a single tile, gain $3 and destroy that tile.',
  rarity:'uncommon',cost:5,bg:'#2a1408',fg:'#e0a060',icon:'🔨',type:'stamp',
  isArmed:function(){return !(S.discardsThisRound||0);},
  liveDesc:function(p){return (S.discardsThisRound||0)>0?'Already discarded this round — <span style="color:#ff6060">re-arms next round</span>.':'<span style="color:#f0e040">Armed</span> — discarding a single tile destroys it for $3.';}});

// ── DELAYED GRATIFICATION ─────────────────────────────────────────────────────
// type: stamp · rarity: common · cost: $3
// onEndRound (fired from roundComplete, before the discard counter resets in
// _doBoardAnimation): +$2 per unused discard.
SQ.push({id:'delayed_gratification',name:'Delayed Gratification',
  desc:'At the end of the round, gain $2 for each unused discard.',
  rarity:'common',cost:3,bg:'#0a1a20',fg:'#60b0e0',icon:'DG',type:'stamp',
  liveDesc:function(p){var n=S.disc||0;return n+' discard'+(n!==1?'s':'')+' left → <span style="color:#f0e040">$'+(n*2)+'</span> at end of round.';},
  onEndRound:function(){
    goldGain('Delayed Gratification',(S.disc||0)*2);
  }});

// ── EGG ───────────────────────────────────────────────────────────────────────
// type: stamp · rarity: common · cost: $3
// onEndRound: grows the instance's sell value by $4 (inst.sellBonus —
// persisted by save.js, honored by sellStamp / the sell button / Appraiser).
// copyable:false — The Thing delegating onEndRound would grow the Egg itself
// a second time, so the pair is blocked.
SQ.push({id:'egg',name:'Egg',
  desc:'Gains $4 of sell value at the end of each round.',
  rarity:'common',cost:3,bg:'#201c10',fg:'#f0e0b0',icon:'🥚',type:'stamp',copyable:false,
  liveDesc:function(p){var sv=Math.floor(sqd('egg').cost/2)+((p&&p.sellBonus)||0);return 'Current sell value: <span style="color:#f0e040">$'+sv+'</span>.';},
  onEndRound:function(inst){
    inst.sellBonus=(inst.sellBonus||0)+4;
    toast('Egg: +$4 sell value!');
  }});

// ── RHYTHM ────────────────────────────────────────────────────────────────────
// type: stamp · rarity: common · cost: $3
// onPostWord: every vowel still in hand when the word scores
// (ctx.state.handVowelCount) has a 1-in-2 chance (Two Face doubles it) to pay
// $1. Rolls only on the live commit — never in preview, like Slot Machine —
// so the solver can't see the payouts and the seeded RNG stays stable.
SQ.push({id:'rhythm',name:'Rhythm',
  desc:'Every vowel left in your hand when a word is played has a 1 in 2 chance to pay $1.',
  rarity:'common',cost:3,bg:'#1a0a20',fg:'#c080f0',icon:'♪',type:'stamp',
  onPostWord:function(w,wt,ctx){
    if(ctx.preview)return;
    var n=ctx.state.handVowelCount||0;
    if(!n)return;
    var lo=typeof _luckOdds==='function'?_luckOdds:function(p){return p;};
    var g=0;
    for(var i=0;i<n;i++)if(Math.random()<lo(0.5))g++;
    if(g>0){ctx.tgold+=g;ctx.events.push({type:'gold',delta:g,label:'Rhythm +$'+g});}
  }});

// ── INSURANCE ─────────────────────────────────────────────────────────────────
// type: stamp · rarity: common · cost: $3
// onEndBoard: pays $1 for every L tile the player owns — the whole pool
// (bag + hand + board + discards alike), blanks excluded.
SQ.push({id:'insurance',name:'Insurance',
  desc:'At the end of each board, gain $1 for every L in your tile collection.',
  rarity:'common',cost:3,bg:'#101a2a',fg:'#80a8e0',icon:'☂',type:'stamp',
  liveDesc:function(p){var n=(S.pool||[]).filter(function(t){return t&&!t.isBlank&&t.letter==='L';}).length;return n+' L tile'+(n!==1?'s':'')+' owned → <span style="color:#f0e040">$'+n+'</span> at end of board.';},
  onEndBoard:function(){
    var n=(S.pool||[]).filter(function(t){return t&&!t.isBlank&&t.letter==='L';}).length;
    goldGain('Insurance',n);
  }});
