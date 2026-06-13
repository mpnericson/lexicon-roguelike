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
var STAGES=[
  [['','',40],['','',80],['Constraint','Use 5+ tiles.',130,'boss_long']],
  [['','',200],['','',350],['Constraint','Words score 0 until a palindrome is played.',550,'boss_pal']],
  [['','',800],['','',1300],['Constraint','Every word must contain a 5+ point tile.',2000,'boss_hv']],
  [['','',3000],['','',5500],['Constraint','Each word must be longer than your previous word this round.',9000,'boss_longer']],
];

var SQ=[
  {id:'dl',name:'Double Letter',desc:'Letter scores ×2.',rarity:'common',cost:3,qty:6,bg:'#14305a',fg:'#6aaaff',icon:'DL',type:'board',bm:'dl'},
  {id:'tl',name:'Triple Letter',desc:'Letter scores ×3.',rarity:'common',cost:3,qty:4,bg:'#0d2050',fg:'#4488ff',icon:'TL',type:'board',bm:'tl'},
  {id:'dw',name:'Double Word',desc:'Word ×2 when new tile lands here.',rarity:'common',cost:3,qty:3,bg:'#6a1818',fg:'#ff8080',icon:'DW',type:'board',bm:'dw'},
  {id:'tw',name:'Triple Word',desc:'Word ×3 when new tile lands here.',rarity:'common',cost:3,qty:2,bg:'#500808',fg:'#ff6060',icon:'TW',type:'board',bm:'tw'},
  {id:'echo',name:'Red Sticker',desc:'Letter here scores twice.',rarity:'common',cost:4,qty:3,bg:'#1a3a5a',fg:'#80c0ff',icon:'EC',type:'local',apply:function(tc,t,w,st){return{cb:tc,mb:0};}},
  {id:'gilded',name:'Gilded',desc:'Letter here earns +$1.',rarity:'common',cost:4,qty:3,bg:'#3a2a00',fg:'#f0c060',icon:'GL',type:'local',apply:function(tc,t,w,st){st.gold=(st.gold||0)+1;return{cb:0,mb:0};}},
  {id:'void',name:'Void',desc:'Letter scores 0 letter score but +2 mult.',rarity:'uncommon',cost:5,qty:2,bg:'#1a0a2a',fg:'#c080ff',icon:'VO',type:'local',apply:function(tc,t,w,st){return{cb:-tc,mb:2};}},
  {id:'prism',name:'Prism',desc:'All letters count as both vowels and consonants.',rarity:'uncommon',cost:5,bg:'#0a2a2a',fg:'#60e0e0',icon:'PR',
    onBuildCtx:function(ctx){ctx.prism=true;}},
  {id:'anchor',name:'Anchor',desc:'Word 5+ letters through here: +3 mult.',rarity:'uncommon',cost:5,qty:2,bg:'#1a2a0a',fg:'#80c040',icon:'AN',type:'local',apply:function(tc,t,w,st){if(w.length>=5)st.am=(st.am||0)+3;return{cb:0,mb:0};}},
  {id:'inkwell',name:'Inkwell',desc:'+$1 every word played.',rarity:'common',cost:4,bg:'#0a1a0a',fg:'#60d060',icon:'IK',
    onPostWord:function(w,wt,ctx){ctx.tgold++;ctx.events.push({type:'gold',delta:1,label:'Inkwell +$1'});}},
  {id:'babel',name:'Babel',desc:'6+ letter words: +2 mult.',rarity:'uncommon',cost:5,bg:'#2a1a00',fg:'#e0a040',icon:'BA',
    onPostWord:function(w,wt,ctx){if(w.length>=6){ctx.plusMults.push(2);ctx.events.push({type:'plus-mult',delta:2,label:'Babel +2 mult'});}}},
  {id:'quill',name:'Quill',desc:'First word each round: ×2 mult.',rarity:'rare',cost:7,bg:'#1a1a0a',fg:'#e0e060',icon:'QU',
    onPostWord:function(w,wt,ctx){if(S.wtr===0){ctx.xmults.push(2);ctx.events.push({type:'x-mult',factor:2,label:'Quill ×2 (first word)'});}}},
  {id:'tome',name:'Tome',desc:'Every 3 words this round: +1 permanent mult.',rarity:'rare',cost:8,bg:'#1a0a0a',fg:'#e08060',icon:'TO',
    liveDesc:function(p){var ts=S.ts||0;return 'Every 3 words this round: +1 permanent mult. Currently applying <span style="color:#f0e040">×'+(1+ts).toFixed(0)+' mult</span> ('+ts+' stack'+(ts!==1?'s':'')+').';},},
  {id:'magnet',name:'Magnet',desc:'All tiles adjacent to this sticker score double letter score.',rarity:'uncommon',cost:6,bg:'#2a0a3a',fg:'#c080ff',icon:'MG',type:'local',
    onBuildCtx:function(ctx,p){ctx.magnetIdxs.push(p.sqIdx);}},
  {id:'palindrome_engine',name:'Palindrome Engine',desc:'Each unique palindrome played grants permanent ×0.25 mult.',rarity:'rare',cost:8,bg:'#0a2a2a',fg:'#60ffff',icon:'PE',
    liveDesc:function(p){var pm=parseFloat((S.palMult||1).toFixed(2));return 'Each unique palindrome: permanent +×0.25 mult. Currently applying <span style="color:#f0e040">×'+pm+' mult</span>.';},
    onBuildCtx:function(ctx){ctx.palMult=S.palMult||1;}},
  {id:'vowel_shrine',name:'Vowel Shrine',desc:'Vowels placed here score ×4 letter score.',rarity:'uncommon',cost:5,qty:2,bg:'#2a2800',fg:'#f0f060',icon:'VS',type:'local',apply:function(tc,t,w,st){if('AEIOU'.indexOf(t.letter)>=0)return{cb:tc*3,mb:0};return{cb:0,mb:0};}},
  {id:'consonant_shrine',name:'Consonant Shrine',desc:'Consonants placed here score ×4 letter score.',rarity:'uncommon',cost:5,qty:2,bg:'#0a1a2a',fg:'#60a0e0',icon:'CS',type:'local',apply:function(tc,t,w,st){if(t.letter&&'AEIOU?'.indexOf(t.letter)<0)return{cb:tc*3,mb:0};return{cb:0,mb:0};}},
  {id:'crossroads',name:'Crossroads',desc:'Each cross-word formed this turn also triggers Double Word.',rarity:'rare',cost:8,bg:'#2a1800',fg:'#f0c040',icon:'CR',type:'local',apply:function(tc,t,w,st){st.crossroads=true;return{cb:0,mb:0};}},
  {id:'gilded_inkwell',name:'Gilded Inkwell',desc:'+$2 per word; only +$1 for words under 4 letters.',rarity:'rare',cost:8,bg:'#1a2a0a',fg:'#80e060',icon:'GI',
    onPostWord:function(w,wt,ctx){var g=w.length<4?1:2;ctx.tgold+=g;ctx.events.push({type:'gold',delta:g,label:'Gilded Inkwell +$'+g});}},
  {id:'lexicon_s_eye',name:"Lexicon's Eye",desc:'Q, X, Z, J score double letter score this turn.',rarity:'rare',cost:7,bg:'#0a2a1a',fg:'#60e0a0',icon:'LE',priority:2,
    onBuildCtx:function(ctx){ctx.lexEye=true;}},
  {id:'midas_touch',name:'Midas Touch',desc:'The highest-value tile earns triple letter score.',rarity:'rare',cost:9,bg:'#3a2a00',fg:'#f0d040',icon:'MD',
    onPostWord:function(w,wt,ctx){if(ctx.maxSc>0){var mb=ctx.maxSc*2;ctx.letters+=mb;ctx.events.push({type:'letter',lettersAfter:ctx.letters,label:'Midas Touch +'+(mb)});}}},
  {id:'bounty',name:'Bounty',desc:'+10 letter score per letter beyond 5.',rarity:'common',cost:4,bg:'#0a2a0a',fg:'#60c060',icon:'BN',
    onPostWord:function(w,wt,ctx){if(w.length>5){var bc=(w.length-5)*10;ctx.letters+=bc;ctx.events.push({type:'letter',lettersAfter:ctx.letters,label:'Bounty +'+bc});}}},
  {id:'lucky_blank',name:'Lucky Blank',desc:'Each blank tile in the word grants +3 multiplier.',rarity:'uncommon',cost:5,bg:'#1a1a2a',fg:'#a0a0f0',icon:'LB',
    onPostWord:function(w,wt,ctx){if(ctx.blankCt>0){var d=ctx.blankCt*3;ctx.plusMults.push(d);ctx.events.push({type:'plus-mult',delta:d,label:'Lucky Blank +'+d+' mult'});}}},
  {id:'scholar',name:'Scholar',desc:'Words made only of 1-point tiles gain +6 multiplier.',rarity:'uncommon',cost:5,bg:'#0a1a2a',fg:'#80c0ff',icon:'SH',
    onPostWord:function(w,wt,ctx){if(ctx.allSc1){ctx.plusMults.push(6);ctx.events.push({type:'plus-mult',delta:6,label:'Scholar +6 mult'});}}},
  {id:'aristocrat',name:'Aristocrat',desc:'Words with an 8+ point tile gain +5 multiplier.',rarity:'uncommon',cost:5,bg:'#2a0a1a',fg:'#f080c0',icon:'AC',
    onPostWord:function(w,wt,ctx){if(ctx.anyHigh){ctx.plusMults.push(5);ctx.events.push({type:'plus-mult',delta:5,label:'Aristocrat +5 mult'});}}},
  {id:'the_commons',name:'The Commons',desc:'Each 1-point tile in the word scores +3 bonus letter score.',rarity:'common',cost:4,bg:'#181818',fg:'#c0c0c0',icon:'TC',priority:1,
    onBuildCtx:function(ctx){ctx.commonsCount++;}},
  {id:'pressure_cooker',name:'Pressure Cooker',desc:'Each discard this round adds +1 mult to the next word.',rarity:'uncommon',cost:6,bg:'#2a0a0a',fg:'#f08060',icon:'PC',
    liveDesc:function(p){var dp=S.discPressure||0;return 'Each discard adds +1 mult to the next word. Stored: <span style="color:#f0e040">+'+dp+' mult</span>.';},
    onPostWord:function(w,wt,ctx){var dp=S.discPressure||0;if(dp>0){ctx.plusMults.push(dp);ctx.events.push({type:'plus-mult',delta:dp,label:'Pressure Cooker +'+dp+' mult'});}}},
  {id:'tectonic',name:'Tectonic',desc:'7-tile bingo earns +$3 gold in addition to the +50 letter score bonus.',rarity:'uncommon',cost:5,bg:'#1a1a0a',fg:'#d0c060',icon:'TN',
    onPostWord:function(w,wt,ctx){if(ctx.newTileCount===7){ctx.tgold+=3;ctx.events.push({type:'gold',delta:3,label:'Tectonic +$3'});}}},
  {id:'censor',name:'Censor',desc:'First discard each round: if only 1 tile, it is destroyed and you gain $3.',rarity:'uncommon',cost:6,bg:'#1a0a0a',fg:'#e06060',icon:'CN'},
  {id:'alchemist',name:'Alchemist',desc:'Once per round: convert a hand tile into a blank that retains its letter score.',rarity:'rare',cost:10,bg:'#0a1a0a',fg:'#80f080',icon:'AL'},
];

// NATO Phonetic Alphabet stickers — one per letter, bonus scales with Scrabble value
(function(){
  var _defs=[
    {l:'A',n:'Alpha',v:1},{l:'E',n:'Echo',v:1},{l:'I',n:'India',v:1},
    {l:'L',n:'Lima',v:1},{l:'N',n:'November',v:1},{l:'O',n:'Oscar',v:1},
    {l:'R',n:'Romeo',v:1},{l:'S',n:'Sierra',v:1},{l:'T',n:'Tango',v:1},
    {l:'U',n:'Uniform',v:1},
    {l:'D',n:'Delta',v:2},{l:'G',n:'Golf',v:2},
    {l:'B',n:'Bravo',v:3},{l:'C',n:'Charlie',v:3},{l:'M',n:'Mike',v:3},{l:'P',n:'Papa',v:3},
    {l:'F',n:'Foxtrot',v:4},{l:'H',n:'Hotel',v:4},{l:'V',n:'Victor',v:4},
    {l:'W',n:'Whiskey',v:4},{l:'Y',n:'Yankee',v:4},
    {l:'K',n:'Kilo',v:5},
    {l:'J',n:'Juliett',v:8},{l:'X',n:'Xray',v:8},
    {l:'Q',n:'Quebec',v:10},{l:'Z',n:'Zulu',v:10}
  ];
  function _col(v){
    if(v<=1)return{rarity:'common',bg:'#1a1a2a',fg:'#9090d0'};
    if(v<=3)return{rarity:'common',bg:'#1a2a0a',fg:'#80c050'};
    if(v<=8)return{rarity:'common',bg:'#2a1a0a',fg:'#f0a040'};
    return{rarity:'common',bg:'#1a1500',fg:'#f0d020'};
  }
  for(var _i=0;_i<_defs.length;_i++){
    (function(d){
      var c=_col(d.v),ls=d.v*3,lm=d.v;
      SQ.push({
        id:'nato_'+d.l.toLowerCase(),name:d.n,
        desc:'Each '+d.l+' in the word: +'+ls+' letter score, +'+lm+' mult.',
        rarity:c.rarity,cost:3+d.v,bg:c.bg,fg:c.fg,icon:d.l,
        onBuildCtx:function(ctx,p){if(!ctx.natoMap)ctx.natoMap={};if(ctx.natoMap[d.l]){ctx.natoMap[d.l].count++;ctx.natoMap[d.l].sqIdxs.push(p.sqIdx);}else ctx.natoMap[d.l]={ls:ls,lm:lm,name:d.n,count:1,sqIdxs:[p.sqIdx]};}
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
  var aura;
  if (pieceId === 'chess_king') {
    aura = [];
    var seen = {};
    for (var i = 0; i < S.placed.length; i++) {
      var p = S.placed[i];
      if (p.id === 'chess_king' || p.id.indexOf('chess_') !== 0) continue;
      var squares = chessGetAura(p.sqIdx, p.id);
      for (var j = 0; j < squares.length; j++) {
        if (!seen[squares[j]]) { seen[squares[j]] = 1; aura.push(squares[j]); }
      }
    }
  } else {
    aura = chessGetAura(sqIdx, pieceId);
  }
  for (var i = 0; i < aura.length; i++) {
    var el = document.querySelector('[data-sq-idx="' + aura[i] + '"]');
    if (el) el.classList.add('sq-chess-hover');
  }
}

function _chessHoverOff() {
  var els = document.querySelectorAll('.sq-chess-hover');
  for (var i = 0; i < els.length; i++) els[i].classList.remove('sq-chess-hover');
}

SQ.push(
  {id:'chess_knight', name:'Knight',
   desc:'×3 letter score to any word tile on an L-shape square from here. Comes as a pair.',
   rarity:'rare', cost:10, qty:2, bg:'#1a1a2a', fg:'#d0d0f0', icon:'♞',
   onBuildCtx:function(ctx,p){ctx.chessPieces.push({sqIdx:p.sqIdx,id:p.id,aura:chessGetAura(p.sqIdx,p.id)});}},

  {id:'chess_bishop', name:'Bishop',
   desc:'×3 letter score to any word tile on a diagonal from here. Blocked by occupied squares. Comes as a pair.',
   rarity:'rare', cost:10, qty:2, bg:'#2a1a08', fg:'#f0d080', icon:'♝',
   onBuildCtx:function(ctx,p){ctx.chessPieces.push({sqIdx:p.sqIdx,id:p.id,aura:chessGetAura(p.sqIdx,p.id)});}},

  {id:'chess_rook', name:'Rook',
   desc:'×3 letter score to any word tile on the same row or column. Blocked by occupied squares. Comes as a pair.',
   rarity:'rare', cost:10, qty:2, bg:'#0a2a0a', fg:'#80f080', icon:'♜',
   onBuildCtx:function(ctx,p){ctx.chessPieces.push({sqIdx:p.sqIdx,id:p.id,aura:chessGetAura(p.sqIdx,p.id)});}},

  {id:'chess_queen', name:'Queen',
   desc:'×3 letter score to any word tile in all 8 directions. Not blocked by tiles.',
   rarity:'rare', cost:14, qty:1, bg:'#2a0a2a', fg:'#f080f0', icon:'♛',
   onBuildCtx:function(ctx,p){ctx.chessPieces.push({sqIdx:p.sqIdx,id:p.id,aura:chessGetAura(p.sqIdx,p.id)});}},

  {id:'chess_king', name:'King',
   desc:'Every square in any chess piece aura becomes a Triple Word square.',
   rarity:'legendary', cost:20, qty:1, bg:'#1a1500', fg:'#ffd700', icon:'♚',
   onBuildCtx:function(ctx){ctx.chessKingActive=true;}}
);

SQ.push(
  {id:'drunk_text', name:'Drunk Text',
   desc:'Play any word, even misspelled. Invalid words: letter score ÷2, mult ÷2. Each correct word in a row: +×0.1 bonus (starts ×1, resets on miss).',
   rarity:'rare', cost:9, bg:'#1a0a28', fg:'#d090ff', icon:'DT',
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
  {id:'jenga', name:'Jenga',
   desc:'Stack new tiles on top of committed tiles (max 1 deep). Only the top tile scores.',
   rarity:'uncommon', cost:7, bg:'#1a1000', fg:'#f0c840', icon:'JG'}
);

SQ.push(
  {id:'bounty_hunter', name:'Bounty Hunter',
   desc:'Each completed bounty permanently adds ×0.25 to your score multiplier (starts at ×1, stacks forever).',
   rarity:'uncommon', cost:6, bg:'#1a2a0a', fg:'#c0e080', icon:'BH',
   liveDesc:function(p){var bh=parseFloat((S.bhMult||1).toFixed(2));return 'Each completed bounty: permanent +×0.25 mult. Currently applying <span style="color:#f0e040">×'+bh+' mult</span>.';},
   onPostWord:function(w,wt,ctx){var bh=S.bhMult||1;if(bh>1){ctx.xmults.push(bh);ctx.events.push({type:'x-mult',factor:parseFloat(bh.toFixed(2)),label:'Bounty Hunter ×'+bh.toFixed(2)});}}},

  {id:'sheriffs_office', name:"Sheriff's Office",
   desc:'Gain 1 free random bounty whenever you meet a score target.',
   rarity:'uncommon', cost:5, bg:'#2a1a00', fg:'#f0b060', icon:'SO'},

  {id:'the_purist', name:'The Purist',
   desc:'DL, TL, DW, and TW squares each trigger their bonus twice (DL→×4, TL→×9, DW→×4, TW→×9).',
   rarity:'rare', cost:8, bg:'#1a1a3a', fg:'#a0a0ff', icon:'PU',
   onBuildCtx:function(ctx){ctx.purist=true;}},

  {id:'easy_mode', name:'Easy Mode',
   desc:'Hover this sticker to reveal the squares of the best available play.',
   rarity:'common', cost:3, bg:'#0a2a0a', fg:'#60e060', icon:'EM'}
);

SQ.push(
  {id:'the_thing', name:'The Thing',
   desc:'Tile placed here copies the effect of every adjacent board sticker.',
   rarity:'rare', cost:12, qty:1, bg:'#0a1a0a', fg:'#50c050', icon:'◈',
   apply:function(tc,t,word,st){
     var cb=0,mb=0,r=Math.floor(t.idx/B),c=t.idx%B;
     var dirs=[[-1,0],[1,0],[0,-1],[0,1]];
     for(var di=0;di<dirs.length;di++){
       var nr=r+dirs[di][0],nc=c+dirs[di][1];
       if(nr<0||nr>=B||nc<0||nc>=B)continue;
       var adjId=S.board[nr*B+nc];if(!adjId)continue;
       var nd=sqd(adjId);if(!nd)continue;
       if(nd.bm){if(nd.bm==='dl')cb+=tc;else if(nd.bm==='tl')cb+=tc*2;else if(nd.bm==='dw')mb+=1;else if(nd.bm==='tw')mb+=2;}
       if(nd.apply&&nd.id!=='the_thing'){var res=nd.apply(tc,t,word,st);cb+=res.cb||0;mb+=res.mb||0;}
     }
     return{cb:cb,mb:mb};
   }},

  {id:'slot_machine', name:'Slot Machine',
   desc:'Word through here: 50% ×2 mult, 5% ×10 mult, 30% +$3, 5% +$10, 1% all tiles go gold/red/blue — all independent.',
   rarity:'rare', cost:25, qty:8, bg:'#2a0a30', fg:'#d060ff', icon:'$?',
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
       if(roll.parts.length){(function(p){setTimeout(function(){toast('🎰 Slot: '+p);},400);})(roll.parts.join(' | '));}
     }
     var r=S._slotMachineRoll;
     if(r.wm_mult>1)st.wm_mult=(st.wm_mult||1)*r.wm_mult;
     st.gold=(st.gold||0)+r.gold;
     if(r.variant)st.slotVariant=r.variant;
     return{cb:0,mb:0};
   }}
);

SQ.push(
  {id:'proletariat', name:'The Proletariat',
   desc:'+0.25 mult per Proletariat on board. While gold < $4: 50% chance after each word to spread to a random adjacent empty square.',
   rarity:'uncommon', cost:5, qty:2, bg:'#2a0808', fg:'#ff6040', icon:'PR',
   liveDesc:function(p){var n=0;for(var i=0;i<S.placed.length;i++)if(S.placed[i].id==='proletariat')n++;var v=parseFloat((0.25*n).toFixed(2));return n+' on board → <span style="color:#f0e040">+'+v+' mult</span> per word.'+(S.gold<4?' <span style="color:#f0d060">Gold < $4</span>: 50% chance to spread after each word.':'');},
   onPostWord:function(w,wt,ctx){
     if(ctx._proletariatDone)return;
     ctx._proletariatDone=true;
     var n=0;for(var i=0;i<S.placed.length;i++)if(S.placed[i].id==='proletariat')n++;
     if(n===0)return;
     var delta=parseFloat((0.25*n).toFixed(2));
     ctx.plusMults.push(delta);
     ctx.events.push({type:'plus-mult',delta:delta,label:'Proletariat ×'+n+' +'+delta+' mult'});
   }},

  {id:'bourgeois', name:'The Bourgeois',
   desc:'End of stage: earn $1 per other sticker on the board. Destroyed if there are 20+ Proletariats.',
   rarity:'rare', cost:9, qty:1, bg:'#2a2000', fg:'#f0d060', icon:'BG',
   onEndStage:function(placed){
     var count=0;
     for(var _bi=0;_bi<B*B;_bi++){if(S.board[_bi]&&S.board[_bi]!=='bourgeois')count++;}
     if(count>0){S.gold+=count;renderHUD();}
     var proCount=0;
     for(var _pi=0;_pi<S.placed.length;_pi++)if(S.placed[_pi].id==='proletariat')proCount++;
     if(proCount>=20){
       S.board[placed.sqIdx]=null;
       var _ri=S.placed.indexOf(placed);if(_ri>=0)S.placed.splice(_ri,1);
       renderBoard();
       toast('Bourgeois: +$'+count+'. Revolution! Overthrown by '+proCount+' Proletariats!');
     }else{
       if(count>0)toast('Bourgeois collects +$'+count+'!');
     }
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
