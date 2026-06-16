// =====================================================================
// DATA — sticker definitions, tile distribution, game constants
// =====================================================================
function isPalindrome(w){return w.length>1&&w===w.split('').reverse().join('');}
function isExtendedPalindrome(w){
  if(isPalindrome(w))return true;
  var sfxs=['ers','ings','es','ed','er','ing','s'];
  for(var i=0;i<sfxs.length;i++){var s=sfxs[i];if(w.length>s.length+1&&w.slice(-s.length)===s&&isPalindrome(w.slice(0,-s.length)))return true;}
  return false;
}
function adjSq(a,b){var ar=Math.floor(a/B),ac=a%B,br=Math.floor(b/B),bc=b%B;return Math.abs(ar-br)<=1&&Math.abs(ac-bc)<=1&&a!==b;}
function uid(){return Math.random().toString(36).slice(2,8);}
// Seeded PRNG — Mulberry32. _rngSeed initialises; _rng() returns [0,1).
var _rngState=0;
function _rngSeed(s){_rngState=s>>>0;}
function _rng(){_rngState=(_rngState+0x6D2B79F5)|0;var t=Math.imul(_rngState^_rngState>>>15,1|_rngState);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}
function shuffle(a){var b=a.slice();for(var i=b.length-1;i>0;i--){var j=Math.floor(_rng()*(i+1));var t=b[i];b[i]=b[j];b[j]=t;}return b;}
// SQ_MAP is built by buildSQMap() in init.js after all sticker files load.
var SQ_MAP = {};
function buildSQMap(){SQ_MAP={};for(var i=0;i<SQ.length;i++)SQ_MAP[SQ[i].id]=SQ[i];}
function sqd(id){return SQ_MAP[id]||null;}
function sqIconHTML(d,sz){sz=sz||24;if(d&&d.iconPng)return '<img src="'+d.iconPng+'" width="'+sz+'" height="'+sz+'" style="image-rendering:pixelated;vertical-align:middle">';return d?d.icon:'';}
function blankTileSpr(letter,variant,sz){var vr=variant==='blue'?2:variant==='red'?4:variant==='gold'?6:0;var li=letter?letter.charCodeAt(0)-65:-1;var col,row;if(li<0||li>25){col=10;row=vr+1;}else{col=li<16?li:li-16;row=vr+(li>=16?1:0);}return 'background-image:url(Assets/sprites/blank-tiles.png);background-size:'+(16*sz)+'px '+(8*sz)+'px;background-position:-'+(col*sz)+'px -'+(row*sz)+'px;background-repeat:no-repeat;image-rendering:pixelated;';}
function tileSpr(letter,isBlank,variant,sz){var vr=variant==='blue'?2:variant==='red'?4:variant==='gold'?6:0;var col,row;if(isBlank||!letter){col=10;row=vr+1;}else{var li=letter.charCodeAt(0)-65;if(li<0||li>25){col=10;row=vr+1;}else{col=li<16?li:li-16;row=vr+(li>=16?1:0);}}return 'background-image:url(Assets/sprites/tile.png);background-size:'+(16*sz)+'px '+(8*sz)+'px;background-position:-'+(col*sz)+'px -'+(row*sz)+'px;background-repeat:no-repeat;image-rendering:pixelated;';}
function wordAsTilesHTML(word,sz,variant){sz=sz||24;var h='<span style="display:flex;gap:2px;flex-wrap:nowrap;flex-shrink:1;min-width:0;align-items:center">';for(var i=0;i<word.length;i++){var spr=tileSpr(word[i],false,variant||null,sz);h+='<span style="display:inline-block;width:'+sz+'px;height:'+sz+'px;flex-shrink:0;'+spr+'"></span>';}return h+'</span>';}
function rcl(i){return String.fromCharCode(65+i%B)+(Math.floor(i/B)+1);}

var B=15;
var LS={A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,Q:10,R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10};
var DIST={A:9,B:2,C:2,D:4,E:12,F:2,G:3,H:2,I:9,J:1,K:1,L:4,M:2,N:6,O:8,P:2,Q:1,R:6,S:4,T:6,U:4,V:2,W:2,X:1,Y:2,Z:1};
// Bounty reward config — change type/value here to rebalance
// type: 'x-mult' | 'plus-mult' | 'letters' | 'gold'
var BOUNTY_REWARD={type:'x-mult',value:3};
function bountyRewardLabel(){var r=BOUNTY_REWARD;if(r.type==='x-mult')return '×'+r.value;if(r.type==='plus-mult')return '+'+r.value+' mult';if(r.type==='letters')return '+'+r.value+' pts';if(r.type==='gold')return '+$'+r.value;return '?';}
function applyBountyReward(ctx){
  var r=BOUNTY_REWARD;
  if(r.type==='x-mult'){ctx.xmults.push(r.value);ctx.events.push({type:'x-mult',factor:r.value,label:'Bounty '+bountyRewardLabel()});}
  else if(r.type==='plus-mult'){ctx.plusMults.push(r.value);ctx.events.push({type:'plus-mult',delta:r.value,label:'Bounty '+bountyRewardLabel()});}
  else if(r.type==='letters'){ctx.letters+=r.value;ctx.events.push({type:'letter',lettersAfter:ctx.letters,label:'Bounty '+bountyRewardLabel()});}
  else if(r.type==='gold'){ctx.tgold+=r.value;ctx.events.push({type:'gold',delta:r.value,label:'Bounty '+bountyRewardLabel()});}
}

var STAGES=[
  [['','',40],['','',80],['Constraint','',130,true]],
  [['','',200],['','',350],['Constraint','',550,true]],
  [['','',800],['','',1300],['Constraint','',2000,true]],
  [['','',3000],['','',5500],['Constraint','',9000,true]],
];
var CONSTRAINTS=[
  {id:'c_long',name:'Long Words Only',desc:'Only words with 5+ letters score this round.'},
  {id:'c_pal',name:'Palindrome Lock',desc:'Scoring locked until a palindrome is played.'},
  {id:'c_longer',name:'Escalation',desc:'Each word must be longer than your previous word to score.'},
  {id:'c_letters',name:'No Repeats',desc:'Each letter can only score once this stage.'},
  {id:'c_hand',name:'Short Hand',desc:'Hand size reduced to 6 tiles this round.'},
  {id:'c_draw3',name:'Slow Draw',desc:'Draw at most 3 tiles after each word or discard.'},
  {id:'c_nodisc',name:'No Discards',desc:'Discards are disabled this round.'},
  {id:'c_oneplay',name:'One Shot',desc:'Only one play this round. Target reduced to 1/3.'},
  {id:'c_stickers',name:'Sticker Strike',desc:'All stickers disabled until you sell one.'},
];
function currentConstraint(){
  if(!S||!S.constraintOrder)return null;
  if(S.endless)return null;
  if(S.bi!==2)return null;
  return S.constraintOrder[S.ai]||null;
}
function constraintDef(){
  var cid=currentConstraint();if(!cid)return null;
  for(var i=0;i<CONSTRAINTS.length;i++)if(CONSTRAINTS[i].id===cid)return CONSTRAINTS[i];
  return null;
}

var SQ=[
  // ── Board stickers: letter/word multipliers ──
  {id:'dl',name:'Double Letter',desc:'Letter scores ×2.',rarity:'common',cost:3,qty:6,bg:'#14305a',fg:'#6aaaff',icon:'DL',type:'board',bm:'dl'},
  {id:'tl',name:'Triple Letter',desc:'Letter scores ×3.',rarity:'common',cost:3,qty:4,bg:'#0d2050',fg:'#4488ff',icon:'TL',type:'board',bm:'tl'},
  {id:'dw',name:'Double Word',desc:'Word ×2 when new tile lands here.',rarity:'common',cost:3,qty:2,bg:'#6a1818',fg:'#ff8080',icon:'DW',type:'board',bm:'dw'},
  {id:'tw',name:'Triple Word',desc:'Word ×3 when new tile lands here.',rarity:'common',cost:3,qty:1,bg:'#500808',fg:'#ff6060',icon:'TW',type:'board',bm:'tw'},
  // ── Board stickers: local effects ──
  {id:'echo',name:'Red Sticker',desc:'Letter here scores twice.',rarity:'common',cost:3,qty:3,bg:'#1a3a5a',fg:'#80c0ff',icon:'EC',type:'local',apply:function(tc,t,w,st){return{cb:tc,mb:0};}},
  {id:'gilded',name:'Gilded',desc:'Letter here earns +$1.',rarity:'common',cost:3,qty:3,bg:'#3a2a00',fg:'#f0c060',icon:'GL',type:'local',apply:function(tc,t,w,st){st.gold=(st.gold||0)+1;return{cb:0,mb:0};}},
  {id:'void',name:'Void',desc:'Letter scores 0 letter score but +2 mult.',rarity:'uncommon',cost:5,qty:3,bg:'#1a0a2a',fg:'#c080ff',icon:'VO',type:'local',apply:function(tc,t,w,st){return{cb:-tc,mb:2};}},
  {id:'paint_bucket',name:'Paint Bucket',desc:'Tile placed here becomes a blank when the board clears at end of stage.',rarity:'uncommon',cost:5,qty:2,bg:'#0a2a2a',fg:'#60d0d0',icon:'PB',type:'local',apply:function(tc,t,w,st){return{cb:0,mb:0};}},
  // ── Tile stickers: common ──
  {id:'inkwell',name:'Inkwell',desc:'+$1 every word played.',rarity:'common',cost:3,bg:'#0a1a0a',fg:'#60d060',icon:'IK',type:'tile',
    onPostWord:function(w,wt,ctx){ctx.tgold++;ctx.events.push({type:'gold',delta:1,label:'Inkwell +$1'});}},
  {id:'the_commons',name:'The Commons',desc:'Each 1-point tile in the word scores +3 bonus letter score.',rarity:'common',cost:3,bg:'#181818',fg:'#c0c0c0',icon:'TC',type:'tile',priority:1,
    onBuildCtx:function(ctx){ctx.commonsCount++;}},
  {id:'scholar',name:'Scholar',desc:'Words made only of 1-point tiles gain +6 multiplier.',rarity:'common',cost:3,bg:'#0a1a2a',fg:'#80c0ff',icon:'SH',type:'tile',
    onPostWord:function(w,wt,ctx){if(ctx.allSc1){ctx.plusMults.push(6);ctx.events.push({type:'plus-mult',delta:6,label:'Scholar +6 mult'});}}},
  {id:'aristocrat',name:'Aristocrat',desc:'Words with an 8+ point tile gain +5 multiplier.',rarity:'common',cost:3,bg:'#2a0a1a',fg:'#f080c0',icon:'AC',type:'tile',
    onPostWord:function(w,wt,ctx){if(ctx.anyHigh){ctx.plusMults.push(5);ctx.events.push({type:'plus-mult',delta:5,label:'Aristocrat +5 mult'});}}},
  {id:'pressure_cooker',name:'Pressure Cooker',desc:'Each discard this round adds +1 mult to the next word.',rarity:'common',cost:3,bg:'#2a0a0a',fg:'#f08060',icon:'PC',type:'tile',
    liveDesc:function(p){var dp=S.discPressure||0;return 'Each discard adds +1 mult to the next word. Stored: <span style="color:#f0e040">+'+dp+' mult</span>.';},
    onPostWord:function(w,wt,ctx){var dp=S.discPressure||0;if(dp>0){ctx.plusMults.push(dp);ctx.events.push({type:'plus-mult',delta:dp,label:'Pressure Cooker +'+dp+' mult'});}}},
  // ── Tile stickers: uncommon ──
  {id:'bounty_hunter',name:'Bounty Hunter',desc:'Each completed bounty permanently adds ×0.25 to your score multiplier.',rarity:'uncommon',cost:5,bg:'#1a2a0a',fg:'#c0e080',icon:'BH',type:'tile',
    liveDesc:function(p){var bh=parseFloat((S.bhMult||1).toFixed(2));return 'Each completed bounty: permanent +×0.25 mult. Currently applying <span style="color:#f0e040">×'+bh+' mult</span>.';},
    onPostWord:function(w,wt,ctx){var bh=S.bhMult||1;if(bh>1){ctx.xmults.push(bh);ctx.events.push({type:'x-mult',factor:parseFloat(bh.toFixed(2)),label:'Bounty Hunter ×'+bh.toFixed(2)});}}},
  {id:'sheriffs_office',name:"Sheriff's Office",desc:'Gain 1 free random bounty whenever you meet a score target.',rarity:'uncommon',cost:5,bg:'#2a1a00',fg:'#f0b060',icon:'SO',type:'tile'},
  {id:'the_purist',name:'The Purist',desc:'DL, TL, DW, and TW squares each trigger their bonus twice (DL→×4, TL→×9, DW→×4, TW→×9).',rarity:'uncommon',cost:5,bg:'#1a1a3a',fg:'#a0a0ff',icon:'PU',type:'tile',
    onBuildCtx:function(ctx){ctx.purist=true;}},
  {id:'easy_mode',name:'Easy Mode',desc:'Hover this sticker to reveal the squares of the best available play.',rarity:'uncommon',cost:5,bg:'#0a2a0a',fg:'#60e060',icon:'EM',type:'tile'},
  {id:'crossroads',name:'Crossroads',desc:'Every crossword you form permanently adds +2 mult to this sticker.',rarity:'uncommon',cost:5,bg:'#2a1800',fg:'#f0c040',icon:'CR',type:'tile',
    // S._crossroadsLiveCount is a display-only counter that ticks up during the scoring
    // animation as each crossword is scored (see scorePlay's 'crossword-tick' events), so a
    // hovered tooltip steps up live even though the real mult is still applied once, at the
    // end, in the post-word global-additive bracket below.
    liveDesc:function(p){var n=(S._crossroadsLiveCount!=null)?S._crossroadsLiveCount:(S.crossroadsCount||0);return 'Each crossword adds +2 permanent mult. Currently: <span style="color:#f0e040">+'+(n*2)+' mult</span> ('+n+' crossword'+(n!==1?'s':'')+').';},
    onPostWord:function(w,wt,ctx){
      var n=(S.crossroadsCount||0)+(ctx.crossWordCount||0);
      if(n>0){ctx.plusMults.push(n*2);ctx.events.push({type:'plus-mult',delta:n*2,label:'Crossroads +'+(n*2)+' mult'});}
    }},
  {id:'midas_touch',name:'Midas Touch',desc:'5+ letter words: gild all tiles in the word after scoring.',rarity:'uncommon',cost:5,bg:'#3a2a00',fg:'#f0d040',icon:'MD',type:'tile'},
  {id:'jenga',name:'Jenga',desc:'Stack new tiles on top of committed tiles (max 1 deep). Only the top tile scores.',rarity:'uncommon',cost:5,bg:'#1a1000',fg:'#f0c840',icon:'JG',type:'tile'},
  {id:'bourgeois',name:'The Bourgeois',desc:'End of stage: earn $1 per board sticker. Destroyed if there are 20+ Proletariats.',rarity:'uncommon',cost:5,qty:1,bg:'#2a2000',fg:'#f0d060',icon:'BG',type:'tile',
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
    }},
  // ── Tile stickers: rare ──
  {id:'drunk_text',name:'Drunk Text',
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
     } else {
       var dm=Math.round((1+streak*0.1)*10)/10;
       ctx.xmults.push(dm);
       ctx.events.push({type:'x-mult',factor:dm,label:'Drunk Text ×'+dm.toFixed(1)});
       S.drunkStreak=streak+1;
     }
   }},
  {id:'palindrome_engine',name:'Palindrome Engine',desc:'Each unique palindrome played grants permanent ×0.25 mult.',rarity:'rare',cost:8,bg:'#0a2a2a',fg:'#60ffff',icon:'PE',type:'tile',
    liveDesc:function(p){var pm=parseFloat((S.palMult||1).toFixed(2));return 'Each unique palindrome: permanent +×0.25 mult. Currently applying <span style="color:#f0e040">×'+pm+' mult</span>.';},
    onBuildCtx:function(ctx){ctx.palMult=S.palMult||1;}},
  {id:'chess_king',name:'The King',desc:'Every square in any chess piece aura becomes a Triple Word square.',rarity:'rare',cost:8,qty:1,bg:'#1a1500',fg:'#ffd700',icon:'♚',type:'tile',
    onBuildCtx:function(ctx){ctx.chessKingActive=true;}},
  {id:'the_thing',name:'The Thing',desc:'Copies the effect of the sticker to its right in the sticker bar.',rarity:'rare',cost:8,qty:1,bg:'#0a1a0a',fg:'#50c050',icon:'◈',type:'tile'},
];

// ── NATO Phonetic Alphabet stickers ──
// Kept: A, O, R, T, U, G, H, V, W, Y, K, J, X — all tile stickers, common, $3
(function(){
  var _defs=[
    {l:'A',n:'Alpha',v:1},{l:'O',n:'Oscar',v:1},{l:'R',n:'Romeo',v:1},
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
      SQ.push({
        id:'nato_'+d.l.toLowerCase(),name:d.n,
        desc:'Each '+d.l+' in the word: +'+ls+' letter score, +'+lm+' mult.',
        rarity:'common',cost:3,bg:c.bg,fg:c.fg,icon:d.l,type:'tile',
        onBuildCtx:function(ctx,p){if(!ctx.natoMap)ctx.natoMap={};if(ctx.natoMap[d.l]){ctx.natoMap[d.l].count++;ctx.natoMap[d.l].sqIdxs.push(p.sqIdx);}else ctx.natoMap[d.l]={ls:ls,lm:lm,name:d.n,id:'nato_'+d.l.toLowerCase(),count:1,sqIdxs:[p.sqIdx]};}
      });
    })(_defs[_i]);
  }
})();

var EASTER_EGGS=[
  {word:'REDRUM',effect:'red_tiles',msg:'REDRUM! Your tiles hunger for blood.'},
];

function applyEasterEgg(word,nt){
  for(var i=0;i<EASTER_EGGS.length;i++){
    if(EASTER_EGGS[i].word!==word)continue;
    var egg=EASTER_EGGS[i];
    if(egg.effect==='red_tiles'){
      for(var j=0;j<nt.length;j++){
        var bt=S.bt[nt[j].idx];if(!bt||!bt.isNew)continue;
        bt.variant='red';
        var hi=bt.handIdx;if(hi>=0&&S.hand[hi])S.hand[hi].variant='red';
      }
      renderBoard();renderHand();
      toast(egg.msg);
    }
    return true;
  }
  return false;
}

// ---- Chess piece aura helpers ----

function chessGetAura(sqIdx, pieceId) {
  var r = Math.floor(sqIdx / B), c = sqIdx % B;
  var result = [], seen = {};
  function addSq(i) { if (i !== sqIdx && !seen[i]) { seen[i] = 1; result.push(i); } }

  if (pieceId === 'chess_knight') {
    var moves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (var i = 0; i < moves.length; i++) {
      var nr = r + moves[i][0], nc = c + moves[i][1];
      if (nr >= 0 && nr < B && nc >= 0 && nc < B) addSq(nr * B + nc);
    }
    return result;
  }

  var dirs = [];
  var blocked = false;
  if (pieceId === 'chess_bishop') { dirs = [[-1,-1],[-1,1],[1,-1],[1,1]]; blocked = true; }
  else if (pieceId === 'chess_rook') { dirs = [[-1,0],[1,0],[0,-1],[0,1]]; blocked = true; }
  else if (pieceId === 'chess_queen') { dirs = [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]; }

  for (var d = 0; d < dirs.length; d++) {
    var nr = r + dirs[d][0], nc = c + dirs[d][1];
    while (nr >= 0 && nr < B && nc >= 0 && nc < B) {
      var idx = nr * B + nc;
      addSq(idx);
      if (blocked && S.bt[idx]) break;
      nr += dirs[d][0]; nc += dirs[d][1];
    }
  }
  return result;
}

function _chessHoverOn(sqIdx, pieceId) {
  var aura = chessGetAura(sqIdx, pieceId);
  for (var i = 0; i < aura.length; i++) {
    var el = document.querySelector('[data-sq-idx="' + aura[i] + '"]');
    if (el) el.classList.add('sq-chess-hover');
  }
}

function _chessHoverOff() {
  var els = document.querySelectorAll('.sq-chess-hover');
  for (var i = 0; i < els.length; i++) els[i].classList.remove('sq-chess-hover');
}

// ── Board chess pieces ──
SQ.push(
  {id:'chess_knight', name:'Knight',
   desc:'×3 letter score to any word tile on an L-shape square from here. Comes as a pair.',
   rarity:'rare', cost:8, qty:2, bg:'#1a1a2a', fg:'#d0d0f0', icon:'♞', type:'board',
   onBuildCtx:function(ctx,p){ctx.chessPieces.push({sqIdx:p.sqIdx,id:p.id,aura:chessGetAura(p.sqIdx,p.id)});}},

  {id:'chess_bishop', name:'Bishop',
   desc:'×3 letter score to any word tile on a diagonal from here. Blocked by occupied squares. Comes as a pair.',
   rarity:'rare', cost:8, qty:2, bg:'#2a1a08', fg:'#f0d080', icon:'♝', type:'board',
   onBuildCtx:function(ctx,p){ctx.chessPieces.push({sqIdx:p.sqIdx,id:p.id,aura:chessGetAura(p.sqIdx,p.id)});}},

  {id:'chess_rook', name:'Rook',
   desc:'×3 letter score to any word tile on the same row or column. Blocked by occupied squares. Comes as a pair.',
   rarity:'rare', cost:8, qty:2, bg:'#0a2a0a', fg:'#80f080', icon:'♜', type:'board',
   onBuildCtx:function(ctx,p){ctx.chessPieces.push({sqIdx:p.sqIdx,id:p.id,aura:chessGetAura(p.sqIdx,p.id)});}},

  {id:'chess_queen', name:'Queen',
   desc:'×3 letter score to any word tile in all 8 directions. Not blocked by tiles.',
   rarity:'rare', cost:8, qty:1, bg:'#2a0a2a', fg:'#f080f0', icon:'♛', type:'board',
   onBuildCtx:function(ctx,p){ctx.chessPieces.push({sqIdx:p.sqIdx,id:p.id,aura:chessGetAura(p.sqIdx,p.id)});}}
);

// ── Slot machine (board) ──
SQ.push(
  {id:'slot_machine', name:'Slot Machine',
   desc:'Word through here: 50% ×2 mult, 5% ×10 mult, 30% +$3, 5% +$10, 1% all tiles go gold/red/blue — all independent.',
   rarity:'rare', cost:8, qty:8, bg:'#2a0a30', fg:'#d060ff', icon:'$?',
   applyAlways:true,
   apply:function(tc,t,word,st){
     if(st._slotUsed)return{cb:0,mb:0};
     if(typeof _solverRunning!=='undefined'&&_solverRunning)return{cb:0,mb:0};
     st._slotUsed=true;
     if(!S._slotMachineRoll){
       var roll={wm_mult:1,gold:0,variant:null,parts:[]};
       if(Math.random()<0.50){roll.wm_mult*=2;roll.parts.push('×2 mult');}
       if(Math.random()<0.05){roll.wm_mult*=10;roll.parts.push('×10 mult');}
       if(Math.random()<0.30){roll.gold+=3;roll.parts.push('+$3');}
       if(Math.random()<0.05){roll.gold+=10;roll.parts.push('+$10');}
       if(Math.random()<0.01){var v=Math.random();roll.variant=v<1/3?'red':v<2/3?'blue':'gold';roll.parts.push('All '+roll.variant+'!');}
       S._slotMachineRoll=roll;
       if(roll.parts.length){(function(p){setTimeout(function(){toast('Slot: '+p);},400);})(roll.parts.join(' | '));}
     }
     var r=S._slotMachineRoll;
     if(r.wm_mult>1)st.wm_mult=(st.wm_mult||1)*r.wm_mult;
     st.gold=(st.gold||0)+r.gold;
     if(r.variant)st.slotVariant=r.variant;
     return{cb:0,mb:0};
   }}
);

// ── Proletariat + spread logic (board) ──
SQ.push(
  {id:'proletariat', name:'The Proletariat',
   desc:'+0.25 mult per Proletariat on board. While gold < $4: 50% chance after each word to spread to a random adjacent empty square.',
   rarity:'uncommon', cost:5, qty:1, bg:'#2a0808', fg:'#ff6040', icon:'PR',
   liveDesc:function(p){var n=0;for(var i=0;i<S.placed.length;i++)if(S.placed[i].id==='proletariat')n++;var v=parseFloat((0.25*n).toFixed(2));return n+' on board → <span style="color:#f0e040">+'+v+' mult</span> per word.'+(S.gold<4?' <span style="color:#f0d060">Gold < $4</span>: 50% chance to spread after each word.':'');},
   onPostWord:function(w,wt,ctx){
     if(ctx._proletariatDone)return;
     ctx._proletariatDone=true;
     var n=0;for(var i=0;i<S.placed.length;i++)if(S.placed[i].id==='proletariat')n++;
     if(n===0)return;
     var delta=parseFloat((0.25*n).toFixed(2));
     ctx.plusMults.push(delta);
     ctx.events.push({type:'plus-mult',delta:delta,label:'Proletariat ×'+n+' +'+delta+' mult'});
   }}
);

function _proletariatSpread(){
  var pros=[];
  for(var i=0;i<S.placed.length;i++)if(S.placed[i].id==='proletariat')pros.push(S.placed[i]);
  if(pros.length===0||S.gold>=4)return;
  if(_rng()>0.5)return;
  var candidates=[],seen={};
  for(var i=0;i<pros.length;i++){
    var sq=pros[i].sqIdx;if(sq==null)continue;
    var r=Math.floor(sq/B),c=sq%B;
    var dirs=[[-1,0],[1,0],[0,-1],[0,1]];
    for(var d=0;d<dirs.length;d++){
      var nr=r+dirs[d][0],nc=c+dirs[d][1];
      if(nr<0||nr>=B||nc<0||nc>=B)continue;
      var ni=nr*B+nc;
      if(!seen[ni]&&!S.board[ni]){seen[ni]=1;candidates.push(ni);}
    }
  }
  if(candidates.length===0)return;
  var newIdx=candidates[Math.floor(_rng()*candidates.length)];
  S.board[newIdx]='proletariat';
  S.placed.push({id:'proletariat',sqIdx:newIdx});
  renderBoard();
  toast('Proletariat spreads! ('+(pros.length+1)+' on board)');
}
