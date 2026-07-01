// ── INKWELL ───────────────────────────────────────────────────────────────────
// type: tile · rarity: common · cost: $3
// onPostWord: simple +$1 per word played.
SQ.push({id:'inkwell',name:'Inkwell',desc:'+$1 every word played.',
  rarity:'common',cost:3,bg:'#0a1a0a',fg:'#60d060',icon:'IK',type:'tile',
  onPostWord:function(w,wt,ctx){ctx.tgold++;ctx.events.push({type:'gold',delta:1,label:'Inkwell +$1'});}});

// ── PRESSURE COOKER ───────────────────────────────────────────────────────────
// type: tile · rarity: common · cost: $3
// onPostWord: reads S.discPressure (incremented by play.js on each discard) and
// dumps it as a flat mult, then zeroes it for the next word.
SQ.push({id:'pressure_cooker',name:'Pressure Cooker',
  desc:'Each discard this round adds +1 mult to the next word.',
  rarity:'common',cost:3,bg:'#2a0a0a',fg:'#f08060',icon:'PC',type:'tile',
  liveDesc:function(p){var dp=S.discPressure||0;return 'Each discard adds +1 mult to the next word. Stored: <span style="color:#f0e040">+'+dp+' mult</span>.';},
  onPostWord:function(w,wt,ctx){var dp=S.discPressure||0;if(dp>0){ctx.plusMults.push(dp);ctx.events.push({type:'plus-mult',delta:dp,label:'Pressure Cooker +'+dp+' mult'});}}});

// ── THE MISER ─────────────────────────────────────────────────────────────────
// type: tile · rarity: uncommon · cost: $5
// onPostWord: counts coloured tiles in the bag and applies ×(1 + n×0.1) mult.
SQ.push({id:'the_miser',name:'The Miser',desc:'+×0.1 mult for each coloured tile in your bag.',
  rarity:'uncommon',cost:5,bg:'#1a1a0a',fg:'#d4af37',icon:'MS',
  liveDesc:function(p){var n=S.bag.filter(function(t){return t.variant;}).length;var f=parseFloat((1+n*0.1).toFixed(2));return n+' coloured tile'+(n!==1?'s':'')+' in bag → <span style="color:#f0e040">×'+f.toFixed(2)+' mult</span>';},
  onPostWord:function(w,wt,ctx){var n=S.bag.filter(function(t){return t.variant;}).length;if(n>0){var f=parseFloat((1+n*0.1).toFixed(2));ctx.xmults.push(f);ctx.events.push({type:'x-mult',factor:f,label:'The Miser ×'+f.toFixed(2)});}}});

// ── BOUNTY HUNTER ─────────────────────────────────────────────────────────────
// type: tile · rarity: uncommon · cost: $5
// onPostWord: applies the permanent ×mult accumulated from completed bounties
// (S.bhMult is incremented by +0.25 in play.js each time a bounty resolves).
SQ.push({id:'bounty_hunter',name:'Bounty Hunter',
  desc:'Each completed bounty permanently adds ×0.25 to your score multiplier.',
  rarity:'uncommon',cost:5,bg:'#1a2a0a',fg:'#c0e080',icon:'BH',type:'tile',
  liveDesc:function(p){var bh=parseFloat((S.bhMult||1).toFixed(2));return 'Each completed bounty: permanent +×0.25 mult. Currently applying <span style="color:#f0e040">×'+bh+' mult</span>.';},
  onPostWord:function(w,wt,ctx){var bh=S.bhMult||1;if(bh>1){ctx.xmults.push(bh);ctx.events.push({type:'x-mult',factor:parseFloat(bh.toFixed(2)),label:'Bounty Hunter ×'+bh.toFixed(2)});}}});

// ── SHERIFF'S OFFICE ──────────────────────────────────────────────────────────
// type: tile · rarity: uncommon · cost: $5
// No scoring hook. Effect is purely in play.js: fires _awardFreeBounty() whenever
// the player hits a score milestone within a stage.
SQ.push({id:'sheriffs_office',name:"Sheriff's Office",
  desc:'Gain 1 free random bounty whenever you meet a score target.',
  rarity:'uncommon',cost:5,bg:'#2a1a00',fg:'#f0b060',icon:'SO',type:'tile'});

// ── THE BOURGEOIS ─────────────────────────────────────────────────────────────
// type: tile · rarity: uncommon · cost: $5
// onEndStage: pays $1 per board sticker, then self-destructs if 20+ Proletariats
// are on the board (the revolution).
SQ.push({id:'bourgeois',name:'The Bourgeois',
  desc:'End of stage: earn $1 per board sticker. Destroyed if there are 20+ Proletariats.',
  rarity:'uncommon',cost:5,qty:1,bg:'#2a2000',fg:'#f0d060',icon:'BG',type:'tile',
  liveDesc:function(p){var count=0;for(var _bi2=0;_bi2<B*B;_bi2++){if(S.board[_bi2])count++;}return 'End of stage: earn <span style="color:#f0e040">$'+count+'</span> ('+count+' board sticker'+(count!==1?'s':'')+').';},
  onEndStage:function(placed){
    var count=0;
    for(var _bi2=0;_bi2<B*B;_bi2++){if(S.board[_bi2])count++;}
    if(count>0){S.gold+=count;renderHUD();}
    var proCount=0;
    for(var _pi=0;_pi<S.placed.length;_pi++)if(S.placed[_pi].id==='proletariat')proCount++;
    if(proCount>=20){
      var _ri=S.placed.indexOf(placed);
      if(_ri>=0){S.board[placed.sqIdx]=null;S.placed.splice(_ri,1);renderBoard();}
      else{var _ti=S.tileStickers.indexOf(placed);if(_ti>=0)S.tileStickers.splice(_ti,1);}
      toast('Bourgeois: +$'+count+'. Revolution! Overthrown by '+proCount+' Proletariats!');
    }else{
      if(count>0)toast('Bourgeois collects +$'+count+'!');
    }
  }});

// ── INSATIABLE ────────────────────────────────────────────────────────────────
// type: tile · rarity: uncommon · cost: $5
// No scoring hook. Effect is in game.js advanceBlind: +1 discard is added when
// this sticker is present.
SQ.push({id:'insatiable',name:'Insatiable',desc:'+1 discard at the start of every round.',
  rarity:'uncommon',cost:5,bg:'#1a0a30',fg:'#d060ff',icon:'IN',type:'tile'});

// ── EMERGENCY RATIONS ─────────────────────────────────────────────────────────
// type: tile · rarity: uncommon · cost: $5
// onSell: opens the bag in pick mode so the player can pull one chosen tile into
// their hand. Bag pick mode is set via window._bagPickMode in game.js.
SQ.push({id:'emergency_rations',name:'Emergency Rations',
  desc:'Sell this sticker to open your bag and pull one tile of your choice into your hand.',
  rarity:'uncommon',cost:5,bg:'#2a1400',fg:'#f0a040',icon:'RS',type:'tile',
  onSell:function(){
    if(!S.bag.length){toast('Bag is empty!');return;}
    window._bagPickMode=function(tile){
      var idx=-1;for(var i=0;i<S.bag.length;i++){if(S.bag[i].id===tile.id){idx=i;break;}}
      if(idx<0)return;
      S.bag.splice(idx,1);
      S.hand.push({letter:tile.isBlank?'_':tile.letter,isBlank:!!tile.isBlank,id:uid(),variant:tile.variant||null,blueBonus:tile.blueBonus||0});
      window._bagPickMode=null;
      closeBagUI();
      HP.x=[];HP.vx=[];
      renderAll();
      toast('Emergency Rations: '+(tile.isBlank?'Blank':tile.letter)+' drawn from bag!');
    };
    openBagModal();
  }});

// ── THE TARGET ────────────────────────────────────────────────────────────────
// type: tile · rarity: uncommon · cost: $5
// onPostWord: fires if the player used all tiles from their free hand (ctx.newTileCount
// >= ctx._freeHandCount). Rewards ×2 mult and +$5.
SQ.push({id:'the_target',name:'The Target',
  desc:'Playing all tiles from your hand: ×2 mult and +$5.',
  rarity:'uncommon',cost:5,bg:'#2a0a00',fg:'#ff6030',icon:'TG',type:'tile',
  onPostWord:function(w,wt,ctx){
    if(ctx.newTileCount>0&&ctx.newTileCount>=ctx._freeHandCount){
      ctx.xmults.push(2);ctx.tgold+=5;
      ctx.events.push({type:'x-mult',factor:2,label:'The Target ×2'});
      ctx.events.push({type:'gold',delta:5,label:'The Target +$5'});
    }
  }});

// ── PIÑATA ────────────────────────────────────────────────────────────────────
// type: tile · rarity: uncommon · cost: $5
// onSell: scatters 4–8 random board stickers onto random free squares.
SQ.push({id:'pinata',name:'Piñata',
  desc:'Sell to break it open — scatters 4-8 random board stickers onto free squares.',
  rarity:'uncommon',cost:5,bg:'#2a0a28',fg:'#f8c060',icon:'🎊',type:'tile',
  onSell:function(){
    var _pnPool=[];
    for(var _pni=0;_pni<SQ.length;_pni++){if(SQ[_pni].type!=='tile')_pnPool.push(SQ[_pni].id);}
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
// type: tile · rarity: uncommon · cost: $5
// No scoring hook. Checked in game.js showGO: if the player scored ≥25% of the
// target, advances to the shop instead of game over. Removed on use.
SQ.push({id:'safety_net',name:'Safety Net',
  desc:'If you fail a stage but scored at least 25% of the target, advance to the shop anyway. Destroyed on use.',
  rarity:'uncommon',cost:5,qty:1,bg:'#001a2a',fg:'#60c8ff',icon:'SN',type:'tile'});
