// =====================================================================
// DATA — tile distribution, game constants, shared utilities
// Sticker and stamp definitions live in src/stickers/ (loaded after this file).
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
var BOUNTY_REWARD={type:'x-mult',value:2};
function bountyRewardLabel(){var r=BOUNTY_REWARD;if(r.type==='x-mult')return '×'+r.value;if(r.type==='plus-mult')return '+'+r.value+' mult';if(r.type==='letters')return '+'+r.value+' pts';if(r.type==='gold')return '+$'+r.value;return '?';}
function applyBountyReward(ctx){
  var r=BOUNTY_REWARD;
  if(r.type==='x-mult'){ctx.xmults.push(r.value);ctx.events.push({type:'x-mult',factor:r.value,label:'Bounty '+bountyRewardLabel()});}
  else if(r.type==='plus-mult'){ctx.plusMults.push(r.value);ctx.events.push({type:'plus-mult',delta:r.value,label:'Bounty '+bountyRewardLabel()});}
  else if(r.type==='letters'){ctx.letters+=r.value;ctx.events.push({type:'letter',lettersAfter:ctx.letters,label:'Bounty '+bountyRewardLabel()});}
  else if(r.type==='gold'){ctx.tgold+=r.value;ctx.events.push({type:'gold',delta:r.value,label:'Bounty '+bountyRewardLabel()});}
}

// 8 boards × 3 rounds. Hand-tuned targets.
var BOARDS=[
  [['','',50],['','',75],['Constraint','',125,true]],
  [['','',200],['','',300],['Constraint','',450,true]],
  [['','',800],['','',1300],['Constraint','',2000,true]],
  [['','',3200],['','',5600],['Constraint','',9600,true]],
  [['','',12000],['','',16000],['Constraint','',20000,true]],
  [['','',30000],['','',40000],['Constraint','',60000,true]],
  [['','',80000],['','',100000],['Constraint','',150000,true]],
  [['','',200000],['','',300000],['Constraint','',500000,true]],
];
var CONSTRAINTS=[
  {id:'c_long',name:'Long Words Only',desc:'Only words with 5+ letters score this round.'},
  {id:'c_pal',name:'Palindrome Lock',desc:'Scoring locked until a palindrome is played.'},
  {id:'c_longer',name:'Escalation',desc:'Each word must be longer than your previous word to score.'},
  {id:'c_letters',name:'No Repeats',desc:'Each letter can only score once this board.'},
  {id:'c_hand',name:'Short Hand',desc:'Hand size reduced to 6 tiles this round.'},
  {id:'c_draw3',name:'Slow Draw',desc:'Draw at most 3 tiles after each word or discard.'},
  {id:'c_nodisc',name:'No Discards',desc:'Discards are disabled this round.'},
  {id:'c_oneplay',name:'One Shot',desc:'Only one play this round. Target reduced to 1/3.'},
  {id:'c_stickers',name:'Sticker Strike',desc:'All stickers and stamps disabled until you sell one.'},
];
function currentConstraint(){
  if(!S||!S.constraintOrder)return null;
  if(S.endless)return null;
  if(S.bi!==2)return null;
  return S.constraintOrder[S.ai]||null;
}

// Stamps The Thing cannot copy (utility / non-scoring mechanics).
// Add copyable:false to a stamp definition to block it without editing this list.
var _THING_BLOCKED={the_thing:true,easy_mode:true,jenga:true,midas:true,insatiable:true,emergency_rations:true,safety_net:true,sheriffs_office:true};

// Sticker/stamp definitions are split across src/stickers/:
//   board/squares.js   — dl, tl, dw, tw, echo, gilded, void, paint_bucket, super_glue
//   board/effects.js   — spring_trap, whack_a_mole, slot_machine
//   board/indirect.js  — chess pieces (knight/bishop/rook/queen), proletariat
//   stamps/economy.js  — inkwell, pressure_cooker, the_miser, bounty_hunter, sheriffs_office,
//                        bourgeois, insatiable, emergency_rations, the_target, pinata, safety_net
//   stamps/scoring.js  — the_commons, scholar, aristocrat, the_marshall, the_hangman,
//                        magic_number, crossroads, palindrome_engine, drunk_text,
//                        the_player, chess_king, NATO tiles
//   stamps/utility.js  — jenga, midas, easy_mode, the_thing
var SQ=[];

// ── Tile State Machine ────────────────────────────────────────────────────────
// Every tile exists in exactly one state at all times. Never write t.state
// directly — always go through setTileState() so sub-props stay consistent.
var TILE_STATE={
  HAND:     'hand',      // in the hand, selectable
  DRAGGING: 'dragging',  // held by the pointer
  MOVING:   'moving',    // in-flight animation between locations
  STORED:   'stored',    // off-screen: in the bag or discard pile
  BOARD:    'board'      // placed on the board (isNew = can recall)
};

// Sub-props by state:
//   hand     — sel:bool
//   moving   — movingTo:string, movingFrom:string (auto-captured from prev state)
//   stored   — storedIn:'bag'|'discard'  (open to future substates)
//   board    — boardSq:int, isNew:bool, blankAs:string
//   dragging — (no sub-props)
function setTileState(t,newState,opts){
  var prev=t.state;
  t.state=newState;
  opts=opts||{};
  // Clear all sub-props — this is what enforces mutual exclusivity
  t.sel=false;
  t.storedIn=null;
  t.movingTo=null;
  t.movingFrom=null;
  t.isNew=false;
  t.boardSq=undefined;
  // blankAs only clears when tile leaves active play (hand or storage)
  // so a blank being dragged off the board still shows its assigned letter
  if(newState==='hand'||newState==='stored')t.blankAs=null;
  // Legacy compat: keep old flags in sync until Stage 4 removes them
  t.onBoard=(newState==='board');
  t.inFlight=(newState==='moving');
  // Apply sub-props for the new state
  switch(newState){
    case 'hand':
      t.sel=opts.sel||false;
      break;
    case 'moving':
      t.movingTo=opts.movingTo||null;
      t.movingFrom=opts.movingFrom!==undefined?opts.movingFrom:prev;
      break;
    case 'stored':
      t.storedIn=opts.storedIn||'bag';
      break;
    case 'board':
      t.boardSq=opts.boardSq!==undefined?opts.boardSq:undefined;
      t.isNew=opts.isNew!==false; // default true — newly placed, can be recalled
      if(opts.blankAs!==undefined)t.blankAs=opts.blankAs;
      break;
    // 'dragging': no sub-props
  }
  return t; // chainable
}

function tileDisplayLetter(t){return t.isBlank?(t.blankAs||'?'):t.letter;}

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
        if(bt.id)transformTile(bt.id,{variant:'red'});
      }
      renderBoard();renderHand();
      toast(egg.msg);
    }
    return true;
  }
  return false;
}

