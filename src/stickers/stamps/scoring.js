// ── THE COMMONS ───────────────────────────────────────────────────────────────
// type: stamp · rarity: common · cost: $3
// Bracket 3 (onPerTile): each instance fires per tile and adds +3 letter score
// when the tile is a 1-point tile. Stacks additively — two Commons = +6 per
// 1-pt tile (each instance fires independently).
SQ.push({id:'the_commons',name:'The Commons',
  desc:'Each 1-point tile in the word scores +3 bonus letter score.',
  rarity:'common',cost:3,bg:'#181818',fg:'#c0c0c0',icon:'TC',type:'stamp',priority:1,
  onPerTile:function(tile,ctx,ts){
    if(!tile.isBlank&&(LS[tile.letter]||0)===1){
      ts+=3;
      ctx.events.push({type:'letter',sqIdx:tile.idx,lettersAfter:ts,isTileLocal:true,label:'Commons +3',floatStampId:'the_commons'});
    }
    return ts;
  }});

// ── SCHOLAR ───────────────────────────────────────────────────────────────────
// type: stamp · rarity: common · cost: $3
// onPostWord: fires if every scored tile was a 1-point tile — the stamp
// computes its own condition from ctx.scoredTiles.
SQ.push({id:'scholar',name:'Scholar',desc:'Words made only of 1-point tiles gain +6 multiplier.',
  rarity:'common',cost:3,bg:'#0a1a2a',fg:'#80c0ff',icon:'SH',type:'stamp',
  onPostWord:function(w,wt,ctx){
    var st=ctx.scoredTiles;
    if(!st.length)return;
    for(var i=0;i<st.length;i++){
      var sc=st[i].isBlank?(st[i].sc||0):(LS[st[i].letter]||0);
      if(sc>1)return;
    }
    ctx.plusMults.push(6);ctx.events.push({type:'plus-mult',delta:6,label:'Scholar +6 mult'});
  }});

// ── ARISTOCRAT ────────────────────────────────────────────────────────────────
// type: stamp · rarity: common · cost: $3
// onPostWord: fires if any scored tile was worth 8+ points — the stamp
// computes its own condition from ctx.scoredTiles.
SQ.push({id:'aristocrat',name:'Aristocrat',desc:'Words with an 8+ point tile gain +5 multiplier.',
  rarity:'common',cost:3,bg:'#2a0a1a',fg:'#f080c0',icon:'AC',type:'stamp',
  onPostWord:function(w,wt,ctx){
    var st=ctx.scoredTiles;
    for(var i=0;i<st.length;i++){
      var sc=st[i].isBlank?(st[i].sc||0):(LS[st[i].letter]||0);
      if(sc>=8){
        ctx.plusMults.push(5);ctx.events.push({type:'plus-mult',delta:5,label:'Aristocrat +5 mult'});
        return;
      }
    }
  }});

// ── THE MARSHALL ──────────────────────────────────────────────────────────────
// type: stamp · rarity: common · cost: $3
// onPostWord: fires if the word completed a bounty
// (ctx.state.pendingBountyReward). Adds +5 letter score per tile in the word.
SQ.push({id:'the_marshall',name:'The Marshall',desc:'Each tile in a bounty word scores +5 letter score.',
  rarity:'common',cost:3,bg:'#1a1200',fg:'#f0c840',icon:'MR',type:'stamp',
  onPostWord:function(w,wt,ctx){
    if(!ctx.state.pendingBountyReward)return;
    var bonus=wt.length*5;ctx.letters+=bonus;
    ctx.events.push({type:'letter',lettersAfter:ctx.letters,label:'Marshall +'+bonus});
  }});

// ── THE HANGMAN ───────────────────────────────────────────────────────────────
// type: stamp · rarity: common · cost: $3
// onPostWord: fires if the word completed a bounty. Adds +15 flat mult.
SQ.push({id:'the_hangman',name:'The Hangman',desc:'+15 mult for a bounty word.',
  rarity:'common',cost:3,bg:'#1a0a00',fg:'#f08040',icon:'HG',type:'stamp',
  onPostWord:function(w,wt,ctx){
    if(!ctx.state.pendingBountyReward)return;
    ctx.plusMults.push(15);ctx.events.push({type:'plus-mult',delta:15,label:'Hangman +15 mult'});
  }});

// ── MAGIC NUMBER ──────────────────────────────────────────────────────────────
// type: stamp · rarity: common · cost: $3
// onPostWord: counts consecutive 3-letter words (ctx.state.magicStreak) and
// applies +n flat mult. Any non-3-letter word resets the streak
// (onWordPlayed, fired outside the engine, owns the persistent counter).
SQ.push({id:'magic_number',name:'Magic Number',
  desc:'Each consecutive 3-letter word adds +1 mult to this stamp. Resets to zero on any other word length.',
  rarity:'common',cost:3,bg:'#001a20',fg:'#40d0b0',icon:'MN',type:'stamp',
  liveDesc:function(p){var n=S.magicStreak||0;return 'Consecutive 3-letter streak: <span style="color:#f0e040">+'+n+' mult</span>. Play a non-3-letter word to reset.';},
  onPostWord:function(w,wt,ctx){
    if(w.length===3){
      var n=(ctx.state.magicStreak||0)+1;
      ctx.plusMults.push(n);
      ctx.events.push({type:'plus-mult',delta:n,label:'Magic Number +'+n+' mult',scaleBounce:'magic_number'});
    }
  },
  onWordPlayed:function(w,wt){
    if(w.length===3){S.magicStreak=(S.magicStreak||0)+1;}
    else{S.magicStreak=0;}
  }});

// ── YUAN ──────────────────────────────────────────────────────────────────────
// type: stamp · rarity: rare · cost: $8
// onPostWord: board sweep (boardSweep, score_engine.js) — ×1.5 mult for every
// Y on the board, committed or just played, blanks-as-Y included. Red Y tiles
// fire twice. One x-mult event per Y (sqIdx) so each Y binks in reading
// order; the stamp loop's auto-tag adds floatStampId so the bar face bounces
// too, in stamp-bar order.
SQ.push({id:'yuan',name:'Yuan',desc:'×1.5 mult for every Y on the board.',
  rarity:'rare',cost:8,bg:'#2a0a0a',fg:'#f0c040',icon:'¥',type:'stamp',
  onPostWord:function(w,wt,ctx){
    boardSweep(ctx,function(t){return t.letter==='Y';},function(t,i){
      ctx.xmults.push(1.5);
      ctx.events.push({type:'x-mult',factor:1.5,sqIdx:i,label:'Yuan ×1.5'});
    });
  }});

// ── THE EAGLE ─────────────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5
// onBuildCtx: bumps ctx.boardRetriggers, which boardSweep (score_engine.js)
// reads — every on-board effect triggering (gold tile payout, Yuan, …)
// repeats once more per Eagle. Touches ONLY boardSweep-driven effects:
// retrigger:true squares and board stickers are unaffected. Eagles stack
// linearly with each other, but red tiles double EVERY triggering including
// Eagle repeats ((1 + eagles) × 2 firings on a red tile).
SQ.push({id:'the_eagle',name:'The Eagle',desc:'Retriggers all on-board effects (gold tile payouts, Yuan, …).',
  rarity:'uncommon',cost:5,bg:'#0a1420',fg:'#d0e0f0',icon:'EA',type:'stamp',
  onBuildCtx:function(ctx){ctx.boardRetriggers=(ctx.boardRetriggers||0)+1;}});

// ── CROSSROADS ────────────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5
// onCrossword: pushes a display-only tick event per crossword so a hovered
// tooltip can track the count live during the score animation.
// onPostWord: reads ctx.crossWordCount (set by the scoring engine when the
// play forms additional crossing words). Adds +2 mult per total crossword
// formed (stacking permanently via ctx.state.crossroadsCount).
SQ.push({id:'crossroads',name:'Crossroads',desc:'Every crossword you form permanently adds +2 mult to this stamp.',
  rarity:'uncommon',cost:5,bg:'#2a1800',fg:'#f0c040',icon:'CR',type:'stamp',
  liveDesc:function(p){var n=(S._crossroadsLiveCount!=null)?S._crossroadsLiveCount:(S.crossroadsCount||0);return 'Each crossword adds +2 permanent mult. Currently: <span style="color:#f0e040">+'+(n*2)+' mult</span> ('+n+' crossword'+(n!==1?'s':'')+').';},
  onCrossword:function(ctx){ctx.events.push({type:'crossword-tick',isSilent:true,scaleBounce:'crossroads'});},
  onPostWord:function(w,wt,ctx){
    var n=(ctx.state.crossroadsCount||0)+(ctx.crossWordCount||0);
    if(n>0){ctx.plusMults.push(n*2);ctx.events.push({type:'plus-mult',delta:n*2,label:'Crossroads +'+(n*2)+' mult'});}
  }});

// ── SKILLED GAMBLER ───────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5
// Every slot machine spin made while this stamp is owned permanently adds +1
// mult. The counter (S.gamblerSpins) is bumped in _chargeSlotSpin (shop.js) —
// the shared gate both machines spin through — so every paid spin counts,
// stamp reels and symbol reels alike.
SQ.push({id:'skilled_gambler',name:'Skilled Gambler',
  desc:'Every slot machine spin permanently adds +1 mult to this stamp.',
  rarity:'uncommon',cost:5,bg:'#1a0014',fg:'#f060c0',icon:'SG',type:'stamp',
  liveDesc:function(p){var n=S.gamblerSpins||0;return 'Each slot machine spin adds +1 permanent mult. Currently: <span style="color:#f0e040">+'+n+' mult</span> ('+n+' spin'+(n!==1?'s':'')+').';},
  onPostWord:function(w,wt,ctx){
    var n=ctx.state.gamblerSpins||0;
    if(n>0){ctx.plusMults.push(n);ctx.events.push({type:'plus-mult',delta:n,label:'Skilled Gambler +'+n+' mult',floatStampId:'skilled_gambler'});}
  }});

// ── OUROBOROS ─────────────────────────────────────────────────────────────────
// type: stamp · rarity: rare · cost: $8
// A snowball: it stores a permanent letter-score bonus (S.ouroborosBonus) that
// grows +5 for every O that scores — committed board O's and newly-played O's
// alike, once per word the O scores in; blanks assigned O count too (the engine
// tile carries the display letter). The growth commits LIVE as each O scores
// (its tile event's scaleField → scoring.js applies it on the O's bink), so the
// bonus visibly climbs during the animation. onPostWord adds the CURRENT stored bonus as flat letter
// score once per play — the engine reads the pre-play value, so the O you score
// this turn feeds the next play, not this one.
SQ.push({id:'ouroboros',name:'Ouroboros',
  desc:'Each O you score permanently adds +5 letter score to Ouroboros, applied to every word. Board O\'s count too.',
  rarity:'rare',cost:8,bg:'#0a1a0a',fg:'#80e080',icon:'OU',type:'stamp',
  onAcquire:function(){if(!S.ouroborosBonus)S.ouroborosBonus=0;},
  liveDesc:function(p){var n=S.ouroborosBonus||0;return 'Each O scored: permanent +5 letter score. Currently at <span style="color:#f0e040">+'+n+' letter score</span> per word.';},
  onPostWord:function(w,wt,ctx){
    var bonus=ctx.state.ouroborosBonus||0;
    if(bonus>0){ctx.letters+=bonus;ctx.events.push({type:'letter',lettersAfter:ctx.letters,label:'Ouroboros +'+bonus,floatStampId:'ouroboros'});}
  },
  // Each O that scores rides that tile's OWN scoring beat: push a tile-local
  // letter event (adds 0 score) that becomes the tile's binking event, carrying
  // floatStampId (bounce) + scaleField (bump S.ouroborosBonus +5). scoring.js
  // fires both exactly when the O binks — every pass, so a retrigger or a second
  // O stays in sync. No dedup ("any time an O scores"); the engine stays pure and
  // onPostWord still applied the pre-play value this turn.
  onPerTile:function(tile,ctx,ts){
    if(tile.letter==='O')ctx.events.push({type:'letter',sqIdx:tile.idx,lettersAfter:ts,isTileLocal:true,floatStampId:'ouroboros',scaleField:'ouroborosBonus',scaleDelta:5});
    return ts;
  }});

// ── MIRROR ────────────────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5
// Any word (main or cross) that is also a valid word read backwards scores a
// SECOND time, right after its first pass (e.g. cross word ON → scores ON, then
// NO). Palindromes qualify automatically. The doubling itself lives in the score
// engine, driven by input.mirrorWords, which the caller (scoring.js) fills only
// when this stamp is owned — the dictionary can't live in the pure engine.
// This def carries no scoring hook: the engine bounces it via floatStampId:'mirror'.
SQ.push({id:'mirror',name:'Mirror',
  desc:'Any word that is also valid spelled backwards scores a second time (e.g. ON then NO). Palindromes always qualify.',
  rarity:'uncommon',cost:5,bg:'#0a1a1a',fg:'#80e0e0',icon:'MI',type:'stamp'});

// ── SESQUIPEDALIAN ────────────────────────────────────────────────────────────
// type: stamp · rarity: common · cost: $3
// onPostWord: words 5+ letters long earn +1 mult for every letter they contain
// (a 5-letter word = +5, a 7-letter word = +7). Shorter words get nothing.
SQ.push({id:'sesquipedalian',name:'Sesquipedalian',
  desc:'Words 5 letters or longer gain +1 mult for each of their letters.',
  rarity:'common',cost:3,bg:'#12081a',fg:'#c090f0',icon:'SQ',type:'stamp',
  onPostWord:function(w,wt,ctx){
    if(w.length>=5){
      ctx.plusMults.push(w.length);
      ctx.events.push({type:'plus-mult',delta:w.length,label:'Sesquipedalian +'+w.length+' mult',floatStampId:'sesquipedalian'});
    }
  }});

// ── PANTRY SOUP ───────────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5
// onPostWord: ×n mult where n is the discards you have LEFT (ctx.state.discardsLeft).
// It shrinks each time you discard and refills when the discard counter resets —
// and at 0 discards it multiplies by ×0, wiping the score, so spend carefully.
SQ.push({id:'pantry_soup',name:'Pantry Soup',
  desc:'×N mult, where N is your remaining discards. Decreases as you discard and refills when discards reset. At 0 discards this is ×0!',
  rarity:'uncommon',cost:5,bg:'#1a1200',fg:'#e0a850',icon:'PS',type:'stamp',
  liveDesc:function(p){var n=S.disc||0;return 'Currently <span style="color:'+(n===0?'#ff6060':'#f0e040')+'">×'+n+' mult</span> ('+n+' discard'+(n!==1?'s':'')+' remaining)'+(n===0?' — careful, ×0 wipes the score!':'')+'.';},
  onPostWord:function(w,wt,ctx){
    var n=ctx.state.discardsLeft||0;
    ctx.xmults.push(n);
    ctx.events.push({type:'x-mult',factor:n,label:'Pantry Soup ×'+n,floatStampId:'pantry_soup'});
  }});

// ── PALINDROME ENGINE ─────────────────────────────────────────────────────────
// type: stamp · rarity: rare · cost: $8
// onBuildCtx: registers a final transform — the engine applies it as a
// whole-word multiplier after the letters × mult total is computed.
// S.palMult is incremented by +0.25 in play.js on each new palindrome.
SQ.push({id:'palindrome_engine',name:'Palindrome Engine',
  desc:'Each unique palindrome played grants permanent ×0.25 mult.',
  rarity:'rare',cost:8,bg:'#0a2a2a',fg:'#60ffff',icon:'PE',type:'stamp',
  liveDesc:function(p){var pm=parseFloat((S.palMult||1).toFixed(2));return 'Each unique palindrome: permanent +×0.25 mult. Currently applying <span style="color:#f0e040">×'+pm+' mult</span>.';},
  onBuildCtx:function(ctx){
    var pm=ctx.state.palMult||1;
    if(pm>1)ctx.finalTransforms.push({factor:pm,label:'Palindrome Engine ×'+fmtMult(pm),tsId:'palindrome_engine'});
  }});

// ── DRUNK TEXT ────────────────────────────────────────────────────────────────
// type: stamp · rarity: rare · cost: $8
// onPostWord: reads ctx.state.drunkValid (set by play.js based on dictionary
// check). Invalid words: ÷2 letters and ÷2 mult, streak resets. Valid words:
// ×(1 + n×0.1) mult where n is the current streak, then streak increments.
SQ.push({id:'drunk_text',name:'Drunk Text',
  desc:'Play any word, even misspelled. Invalid words: letter score ÷2, mult ÷2. Each correct word in a row: +×0.1 bonus.',
  rarity:'rare',cost:8,bg:'#1a0a28',fg:'#d090ff',icon:'DT',type:'stamp',
  onAcquire:function(){S.drunkStreak=0;},
  liveDesc:function(p){var streak=S.drunkStreak||0;var dm=parseFloat((Math.round((1+streak*0.1)*10)/10).toFixed(1));return 'Valid words: <span style="color:#f0e040">×'+dm+' mult</span> (streak: '+streak+'). Invalid words: ÷2 letters &amp; mult, streak resets.';},
  onPostWord:function(w,wt,ctx){
    var streak=ctx.state.drunkStreak||0;
    if(ctx.state.drunkValid===false){
      ctx.letters=Math.floor(ctx.letters/2);
      ctx.events.push({type:'letter',lettersAfter:ctx.letters,label:'Drunk Text ÷2 letters'});
      ctx.xmults.push(0.5);
      ctx.events.push({type:'x-mult',factor:0.5,label:'Drunk Text ÷2 mult'});
    }else{
      var dm=Math.round((1+streak*0.1)*10)/10;
      ctx.xmults.push(dm);
      ctx.events.push({type:'x-mult',factor:dm,label:'Drunk Text ×'+dm.toFixed(1),scaleBounce:'drunk_text'});
    }
  },
  onWordPlayed:function(w,wt){
    if(S._drunkValid===false){S.drunkStreak=0;}
    else{S.drunkStreak=(S.drunkStreak||0)+1;}
  }});

// ── THE PLAYER ────────────────────────────────────────────────────────────────
// type: stamp · rarity: legendary · cost: $8 · qty: 1
// The game's first legendary — also the 3-legendary jackpot prize of the
// symbol slot machine (shop.js SYMBOL_PAYOUTS).
// onPostWord: applies ctx.state.playerMult (accumulated by play.js when a
// best-play word is detected). Starts at 1 and grows by +0.5 per best play.
SQ.push({id:'the_player',name:'The Player',desc:'Each best play permanently adds ×0.5 mult. Starts at ×1.',
  rarity:'legendary',cost:8,qty:1,bg:'#0a1a2a',fg:'#80d0ff',icon:'PL',type:'stamp',
  liveDesc:function(p){var pm=parseFloat((S.playerMult||1).toFixed(2));var n=Math.round((pm-1)*2);return n>0?n+' best play'+(n!==1?'s':'')+' → <span style="color:#f0e040">×'+pm.toFixed(1)+' mult</span>.':'Play the best available word to start stacking.';},
  onPostWord:function(w,wt,ctx){var pm=ctx.state.playerMult||1;if(pm>1){ctx.xmults.push(pm);ctx.events.push({type:'x-mult',factor:parseFloat(pm.toFixed(2)),label:'The Player ×'+pm.toFixed(1)});}}});

// ── CARTOGRAPHER ──────────────────────────────────────────────────────────────
// type: stamp · rarity: rare · cost: $8
// onPerTile: each newly-played corner tile pushes a tile-local letter event
// (adds 0 score) carrying floatStampId + scaleField, deduped per stamp copy and
// square (ctx._stampIdx, set by the engine's per-tile stamp loop) so a corner
// tile in two words / on retrigger grows once per copy — two Cartographers each
// register the corner. scoring.js bumps S.cartographerMult +0.5 and bounces the
// stamp in sync with that tile's bink. onPostWord applies the CURRENT (pre-play)
// mult, so this play's corners feed the next play.
SQ.push({id:'cartographer',name:'Cartographer',
  desc:'Each tile you play in a corner of the board permanently adds ×0.5 mult. Starts at ×1.',
  rarity:'rare',cost:8,bg:'#0a1a14',fg:'#60e0a0',icon:'CG',type:'stamp',
  onAcquire:function(){if(!S.cartographerMult)S.cartographerMult=1;},
  liveDesc:function(p){var cm=parseFloat((S.cartographerMult||1).toFixed(2));var n=Math.round((cm-1)*2);return n>0?n+' corner tile'+(n!==1?'s':'')+' played → <span style="color:#f0e040">×'+cm.toFixed(1)+' mult</span>.':'Play a tile on any board corner to start stacking ×0.5 mult.';},
  onPerTile:function(tile,ctx,ts){
    if(tile.isNew&&(tile.idx===0||tile.idx===B-1||tile.idx===(B-1)*B||tile.idx===B*B-1)){
      if(!ctx._cartoScored)ctx._cartoScored={};
      var _ck=(ctx._stampIdx!=null?ctx._stampIdx:'')+':'+tile.idx;
      if(!ctx._cartoScored[_ck]){ctx._cartoScored[_ck]=1;ctx.events.push({type:'letter',sqIdx:tile.idx,lettersAfter:ts,isTileLocal:true,floatStampId:'cartographer',scaleField:'cartographerMult',scaleDelta:0.5});}
    }
    return ts;
  },
  onPostWord:function(w,wt,ctx){var cm=ctx.state.cartographerMult||1;if(cm>1){ctx.xmults.push(cm);ctx.events.push({type:'x-mult',factor:parseFloat(cm.toFixed(2)),label:'Cartographer ×'+fmtMult(cm),floatStampId:'cartographer'});}}});

// ── THE KING ──────────────────────────────────────────────────────────────────
// type: stamp · rarity: rare · cost: $8 · qty: 1
// onBuildCtx: sets ctx.chessKingActive = true. The chess aura hooks
// (indirect.js _chessRegister) check this flag and add ×3 word mult for
// every new tile that falls in a chess piece's aura (stacks per piece).
SQ.push({id:'chess_king',name:'The King',
  desc:'Every square in any chess piece aura becomes a Triple Word square.',
  rarity:'legendary',cost:8,qty:1,bg:'#1a1500',fg:'#ffd700',icon:'♚',type:'stamp',
  onBuildCtx:function(ctx){ctx.chessKingActive=true;}});

// ── KHOOMIICH ─────────────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5
// Bracket 4 (onRetrigger): returns 1 for every played vowel (A/E/I/O/U,
// including blanks assigned a vowel), so the engine re-runs that tile's whole
// per-tile pass one extra time — re-scoring its letter value, per-tile stamp
// bonuses, and any DL/TL/chess mults on its square.
SQ.push({id:'khoomiich',name:'Khoomiich',
  desc:'Retriggers every vowel (A, E, I, O, U) played in scoring.',
  rarity:'uncommon',cost:5,bg:'#0a1a1a',fg:'#60e0d0',icon:'᚛',type:'stamp',
  onRetrigger:function(tile){
    var L=(tile.letter||'').toUpperCase();
    return (L==='A'||L==='E'||L==='I'||L==='O'||L==='U')?1:0;
  }});

// ── NATO PHONETIC ALPHABET ────────────────────────────────────────────────────
// 12 stamps, one per letter. Each fires its onPerTile hook independently
// for every matching letter scored. Stacks: 2× Alpha = +8 pts and +2 mult per A.
// The IIFE captures d (letter data), ls (bonus pts), lm (bonus mult) per stamp.
(function(){
  var _defs=[
    {l:'A',n:'Alpha',v:1},{l:'R',n:'Romeo',v:1},
    {l:'T',n:'Tango',v:1},{l:'U',n:'Uniform',v:1},
    {l:'G',n:'Golf',v:3},
    {l:'H',n:'Hotel',v:4},{l:'V',n:'Victor',v:4},
    {l:'W',n:'Whiskey',v:4},{l:'Y',n:'Yankee',v:4},
    {l:'K',n:'Kilo',v:5},
    {l:'J',n:'Juliett',v:8},{l:'X',n:'Xray',v:8}
  ];
  function _col(v){
    if(v<=1)return{bg:'#1a1a2a',fg:'#9090d0'};
    if(v<=3)return{bg:'#1a2a0a',fg:'#80c050'};
    if(v<=8)return{bg:'#2a1a0a',fg:'#f0a040'};
    return{bg:'#1a1500',fg:'#f0d020'};
  }
  for(var _i=0;_i<_defs.length;_i++){
    (function(d){
      var c=_col(d.v),ls=4,lm=d.v;
      var id=d.n.toLowerCase();

      // ── NATO: [name] ──────────────────────────────────────────────────────
      // Bracket 3 (onPerTile): fires once per stamp instance per matching tile.
      // With 2 copies: each matching tile gets ls*2 bonus points and lm*2 mult.
      // tile.letter is the DISPLAY letter, so a blank assigned this letter counts.
      SQ.push({
        id:id,name:d.n,
        desc:'Each '+d.l+' in the word: +'+ls+' letter score, +'+lm+' mult.',
        rarity:'common',cost:3,bg:c.bg,fg:c.fg,icon:d.l,type:'stamp',
        onPerTile:function(tile,ctx,ts){
          if(tile.letter===d.l){
            ts+=ls;
            ctx.events.push({type:'letter',sqIdx:tile.idx,lettersAfter:ts,isTileLocal:true,label:d.n+' +'+ls,floatStampId:id});
            ctx.plusMults.push(lm);
            ctx.events.push({type:'plus-mult',delta:lm,label:d.n+' +'+lm+' mult',floatStampId:id});
          }
          return ts;
        }
      });
    })(_defs[_i]);
  }
})();
