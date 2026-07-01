// ── THE COMMONS ───────────────────────────────────────────────────────────────
// type: tile · rarity: common · cost: $3
// Bracket 3 (onPerTile): each instance fires per tile and adds +3 letter score
// when the tile is a 1-point tile. Stacks additively — two Commons = +6 per
// 1-pt tile (each instance fires independently).
SQ.push({id:'the_commons',name:'The Commons',
  desc:'Each 1-point tile in the word scores +3 bonus letter score.',
  rarity:'common',cost:3,bg:'#181818',fg:'#c0c0c0',icon:'TC',type:'tile',priority:1,
  onPerTile:function(tile,ctx,ts){
    if(!tile.isBlank&&(LS[tile.letter]||0)===1){
      ts+=3;
      ctx.events.push({type:'letter',sqIdx:tile.idx,lettersAfter:ts,isTileLocal:true,label:'Commons +3',floatTsId:'the_commons'});
    }
    return ts;
  }});

// ── SCHOLAR ───────────────────────────────────────────────────────────────────
// type: tile · rarity: common · cost: $3
// onPostWord: fires if all new tiles in the word were 1-point tiles (ctx.allSc1).
SQ.push({id:'scholar',name:'Scholar',desc:'Words made only of 1-point tiles gain +6 multiplier.',
  rarity:'common',cost:3,bg:'#0a1a2a',fg:'#80c0ff',icon:'SH',type:'tile',
  onPostWord:function(w,wt,ctx){if(ctx.allSc1){ctx.plusMults.push(6);ctx.events.push({type:'plus-mult',delta:6,label:'Scholar +6 mult'});}}});

// ── ARISTOCRAT ────────────────────────────────────────────────────────────────
// type: tile · rarity: common · cost: $3
// onPostWord: fires if the word contained any 8+ point tile (ctx.anyHigh).
SQ.push({id:'aristocrat',name:'Aristocrat',desc:'Words with an 8+ point tile gain +5 multiplier.',
  rarity:'common',cost:3,bg:'#2a0a1a',fg:'#f080c0',icon:'AC',type:'tile',
  onPostWord:function(w,wt,ctx){if(ctx.anyHigh){ctx.plusMults.push(5);ctx.events.push({type:'plus-mult',delta:5,label:'Aristocrat +5 mult'});}}});

// ── THE MARSHALL ──────────────────────────────────────────────────────────────
// type: tile · rarity: common · cost: $3
// onPostWord: fires if the word completed a bounty (S._pendingBountyReward set by
// play.js). Adds +5 letter score per tile in the word.
SQ.push({id:'the_marshall',name:'The Marshall',desc:'Each tile in a bounty word scores +5 letter score.',
  rarity:'common',cost:3,bg:'#1a1200',fg:'#f0c840',icon:'MR',type:'tile',
  onPostWord:function(w,wt,ctx){
    if(!S._pendingBountyReward)return;
    var bonus=wt.length*5;ctx.letters+=bonus;
    ctx.events.push({type:'letter',lettersAfter:ctx.letters,label:'Marshall +'+bonus});
  }});

// ── THE HANGMAN ───────────────────────────────────────────────────────────────
// type: tile · rarity: common · cost: $3
// onPostWord: fires if the word completed a bounty. Adds +15 flat mult.
SQ.push({id:'the_hangman',name:'The Hangman',desc:'+15 mult for a bounty word.',
  rarity:'common',cost:3,bg:'#1a0a00',fg:'#f08040',icon:'HG',type:'tile',
  onPostWord:function(w,wt,ctx){
    if(!S._pendingBountyReward)return;
    ctx.plusMults.push(15);ctx.events.push({type:'plus-mult',delta:15,label:'Hangman +15 mult'});
  }});

// ── MAGIC NUMBER ──────────────────────────────────────────────────────────────
// type: tile · rarity: common · cost: $3
// onPostWord: counts consecutive 3-letter words (S.magicStreak) and applies +n
// flat mult. Any non-3-letter word resets the streak.
SQ.push({id:'magic_number',name:'Magic Number',
  desc:'Each consecutive 3-letter word adds +1 mult to this sticker. Resets to zero on any other word length.',
  rarity:'common',cost:3,bg:'#001a20',fg:'#40d0b0',icon:'MN',type:'tile',
  liveDesc:function(p){var n=S.magicStreak||0;return 'Consecutive 3-letter streak: <span style="color:#f0e040">+'+n+' mult</span>. Play a non-3-letter word to reset.';},
  onPostWord:function(w,wt,ctx){
    if(w.length===3){
      S.magicStreak=(S.magicStreak||0)+1;
      var n=S.magicStreak;
      ctx.plusMults.push(n);
      ctx.events.push({type:'plus-mult',delta:n,label:'Magic Number +'+n+' mult'});
    }else{
      S.magicStreak=0;
    }
  }});

// ── THE PURIST ────────────────────────────────────────────────────────────────
// type: tile · rarity: uncommon · cost: $5
// onBuildCtx: sets ctx.purist = true. Bracket 4 of _scoreTilePasses reads this
// flag and doubles DL/TL/DW/TW multipliers (DL→×4, TL→×9, DW→×4, TW→×9).
SQ.push({id:'the_purist',name:'The Purist',
  desc:'DL, TL, DW, and TW squares each trigger their bonus twice (DL→×4, TL→×9, DW→×4, TW→×9).',
  rarity:'uncommon',cost:5,bg:'#1a1a3a',fg:'#a0a0ff',icon:'PU',type:'tile',
  onBuildCtx:function(ctx){ctx.purist=true;}});

// ── CROSSROADS ────────────────────────────────────────────────────────────────
// type: tile · rarity: uncommon · cost: $5
// onPostWord: reads ctx.crossWordCount (set by scoring engine when the play forms
// additional crossing words). Adds +2 mult per total crossword formed (stacking
// permanently via S.crossroadsCount).
SQ.push({id:'crossroads',name:'Crossroads',desc:'Every crossword you form permanently adds +2 mult to this sticker.',
  rarity:'uncommon',cost:5,bg:'#2a1800',fg:'#f0c040',icon:'CR',type:'tile',
  liveDesc:function(p){var n=(S._crossroadsLiveCount!=null)?S._crossroadsLiveCount:(S.crossroadsCount||0);return 'Each crossword adds +2 permanent mult. Currently: <span style="color:#f0e040">+'+(n*2)+' mult</span> ('+n+' crossword'+(n!==1?'s':'')+').';},
  onPostWord:function(w,wt,ctx){
    var n=(S.crossroadsCount||0)+(ctx.crossWordCount||0);
    if(n>0){ctx.plusMults.push(n*2);ctx.events.push({type:'plus-mult',delta:n*2,label:'Crossroads +'+(n*2)+' mult'});}
  }});

// ── PALINDROME ENGINE ─────────────────────────────────────────────────────────
// type: tile · rarity: rare · cost: $8
// onBuildCtx: loads S.palMult into ctx.palMult. The final-transform step in
// scoring.js applies ctx.palMult as a whole-word multiplier after all other
// scoring. S.palMult is incremented by +0.25 in play.js on each new palindrome.
SQ.push({id:'palindrome_engine',name:'Palindrome Engine',
  desc:'Each unique palindrome played grants permanent ×0.25 mult.',
  rarity:'rare',cost:8,bg:'#0a2a2a',fg:'#60ffff',icon:'PE',type:'tile',
  liveDesc:function(p){var pm=parseFloat((S.palMult||1).toFixed(2));return 'Each unique palindrome: permanent +×0.25 mult. Currently applying <span style="color:#f0e040">×'+pm+' mult</span>.';},
  onBuildCtx:function(ctx){ctx.palMult=S.palMult||1;}});

// ── DRUNK TEXT ────────────────────────────────────────────────────────────────
// type: tile · rarity: rare · cost: $8
// onPostWord: reads S._drunkValid (set by play.js based on dictionary check).
// Invalid words: ÷2 letters and ÷2 mult, streak resets. Valid words: ×(1 + n×0.1)
// mult where n is the current streak, then streak increments.
SQ.push({id:'drunk_text',name:'Drunk Text',
  desc:'Play any word, even misspelled. Invalid words: letter score ÷2, mult ÷2. Each correct word in a row: +×0.1 bonus.',
  rarity:'rare',cost:8,bg:'#1a0a28',fg:'#d090ff',icon:'DT',type:'tile',
  liveDesc:function(p){var streak=S.drunkStreak||0;var dm=parseFloat((Math.round((1+streak*0.1)*10)/10).toFixed(1));return 'Valid words: <span style="color:#f0e040">×'+dm+' mult</span> (streak: '+streak+'). Invalid words: ÷2 letters &amp; mult, streak resets.';},
  onPostWord:function(w,wt,ctx){
    var streak=S.drunkStreak||0;
    if(S._drunkValid===false){
      ctx.letters=Math.floor(ctx.letters/2);
      ctx.events.push({type:'letter',lettersAfter:ctx.letters,label:'Drunk Text ÷2 letters'});
      ctx.xmults.push(0.5);
      ctx.events.push({type:'x-mult',factor:0.5,label:'Drunk Text ÷2 mult'});
      S.drunkStreak=0;
    }else{
      var dm=Math.round((1+streak*0.1)*10)/10;
      ctx.xmults.push(dm);
      ctx.events.push({type:'x-mult',factor:dm,label:'Drunk Text ×'+dm.toFixed(1)});
      S.drunkStreak=streak+1;
    }
  }});

// ── THE PLAYER ────────────────────────────────────────────────────────────────
// type: tile · rarity: rare · cost: $8 · qty: 1
// onPostWord: applies S.playerMult (accumulated by play.js when a best-play word
// is detected). S.playerMult starts at 1 and grows by +0.5 per best play.
SQ.push({id:'the_player',name:'The Player',desc:'Each best play permanently adds ×0.5 mult. Starts at ×1.',
  rarity:'rare',cost:8,qty:1,bg:'#0a1a2a',fg:'#80d0ff',icon:'PL',type:'tile',
  liveDesc:function(p){var pm=parseFloat((S.playerMult||1).toFixed(2));var n=Math.round((pm-1)*2);return n>0?n+' best play'+(n!==1?'s':'')+' → <span style="color:#f0e040">×'+pm.toFixed(1)+' mult</span>.':'Play the best available word to start stacking.';},
  onPostWord:function(w,wt,ctx){var pm=S.playerMult||1;if(pm>1){ctx.xmults.push(pm);ctx.events.push({type:'x-mult',factor:parseFloat(pm.toFixed(2)),label:'The Player ×'+pm.toFixed(1)});}}});

// ── THE KING ──────────────────────────────────────────────────────────────────
// type: tile · rarity: rare · cost: $8 · qty: 1
// onBuildCtx: sets ctx.chessKingActive = true. _applyChessAura (indirect.js,
// called from bracket 5) checks this flag and adds ×3 word mult for every
// new tile that falls in any chess piece's aura.
SQ.push({id:'chess_king',name:'The King',
  desc:'Every square in any chess piece aura becomes a Triple Word square.',
  rarity:'rare',cost:8,qty:1,bg:'#1a1500',fg:'#ffd700',icon:'♚',type:'tile',
  onBuildCtx:function(ctx){ctx.chessKingActive=true;}});

// ── NATO PHONETIC ALPHABET ────────────────────────────────────────────────────
// 12 tile stickers, one per letter. Each fires its onPerTile hook independently
// for every matching letter scored. Stacks: 2× Alpha = +6 pts and +2 mult per A.
// The IIFE captures d (letter data), ls (bonus pts), lm (bonus mult) per sticker.
(function(){
  var _defs=[
    {l:'A',n:'Alpha',v:1},{l:'R',n:'Romeo',v:1},
    {l:'T',n:'Tango',v:1},{l:'U',n:'Uniform',v:1},
    {l:'G',n:'Golf',v:2},
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
      var c=_col(d.v),ls=d.v*3,lm=d.v;
      var id='nato_'+d.l.toLowerCase();

      // ── NATO: [name] ──────────────────────────────────────────────────────
      // Bracket 3 (onPerTile): fires once per sticker instance per matching tile.
      // With 2 copies: each matching tile gets ls*2 bonus points and lm*2 mult.
      SQ.push({
        id:id,name:d.n,
        desc:'Each '+d.l+' in the word: +'+ls+' letter score, +'+lm+' mult.',
        rarity:'common',cost:3,bg:c.bg,fg:c.fg,icon:d.l,type:'tile',
        onPerTile:function(tile,ctx,ts){
          if(!tile.isBlank&&tile.letter===d.l){
            ts+=ls;
            ctx.events.push({type:'letter',sqIdx:tile.idx,lettersAfter:ts,isTileLocal:true,label:d.n+' +'+ls,floatTsId:id});
            ctx.plusMults.push(lm);
            ctx.events.push({type:'plus-mult',delta:lm,label:d.n+' +'+lm+' mult',floatTsId:id});
          }
          return ts;
        }
      });
    })(_defs[_i]);
  }
})();
