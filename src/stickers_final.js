// =====================================================================
// STICKERS FINAL — final sticker set for release
// Loaded after data.js; pushes definitions into SQ.
// =====================================================================

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

// ---- Chess piece sticker definitions ----

SQ.push(
  {id:'chess_knight', name:'Knight',
   desc:'×3 chips to any word tile on an L-shape square from here. Comes as a pair.',
   rarity:'rare', cost:10, qty:2, bg:'#1a1a2a', fg:'#d0d0f0', icon:'♞',
   apply:function(tc,t,w,st){return{cb:0,mb:0};}},

  {id:'chess_bishop', name:'Bishop',
   desc:'×3 chips to any word tile on a diagonal from here. Blocked by occupied squares. Comes as a pair.',
   rarity:'rare', cost:10, qty:2, bg:'#2a1a08', fg:'#f0d080', icon:'♝',
   apply:function(tc,t,w,st){return{cb:0,mb:0};}},

  {id:'chess_rook', name:'Rook',
   desc:'×3 chips to any word tile on the same row or column. Blocked by occupied squares. Comes as a pair.',
   rarity:'rare', cost:10, qty:2, bg:'#0a2a0a', fg:'#80f080', icon:'♜',
   apply:function(tc,t,w,st){return{cb:0,mb:0};}},

  {id:'chess_queen', name:'Queen',
   desc:'×3 chips to any word tile in all 8 directions. Not blocked by tiles.',
   rarity:'rare', cost:14, qty:1, bg:'#2a0a2a', fg:'#f080f0', icon:'♛',
   apply:function(tc,t,w,st){return{cb:0,mb:0};}},

  {id:'chess_king', name:'King',
   desc:'Every square in any chess piece aura becomes a Triple Word square.',
   rarity:'legendary', cost:20, qty:1, bg:'#1a1500', fg:'#ffd700', icon:'♚',
   onPre:function(w,st){st.chessKingActive=true;}}
);

SQ.push(
  {id:'bounty_hunter', name:'Bounty Hunter',
   desc:'Each completed bounty permanently adds ×0.25 to your score multiplier (starts at ×1, stacks forever).',
   rarity:'uncommon', cost:6, bg:'#1a2a0a', fg:'#c0e080', icon:'BH',
   onPre:function(w,st){st.bhXm=S.bhMult||1;}},

  {id:'sheriffs_office', name:"Sheriff's Office",
   desc:'Gain 1 free random bounty whenever you meet a score target.',
   rarity:'uncommon', cost:5, bg:'#2a1a00', fg:'#f0b060', icon:'SO'},

  {id:'the_purist', name:'The Purist',
   desc:'DL, TL, DW, and TW squares each trigger their bonus twice (DL→×4, TL→×9, DW→×4, TW→×9).',
   rarity:'rare', cost:8, bg:'#1a1a3a', fg:'#a0a0ff', icon:'PU',
   onPre:function(w,st){st.purist=true;}},

  {id:'easy_mode', name:'Easy Mode',
   desc:'The highest-scoring available play is highlighted on the board.',
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
   desc:'Word through here: 50% \xd72 mult, 5% \xd710 mult, 30% +$3, 5% +$10, 1% all tiles go gold/red/blue — all independent.',
   rarity:'rare', cost:25, qty:8, bg:'#2a0a30', fg:'#d060ff', icon:'$?',
   applyAlways:true,
   apply:function(tc,t,word,st){
     if(st._slotUsed)return{cb:0,mb:0};
     if(typeof _solverRunning!=='undefined'&&_solverRunning)return{cb:0,mb:0};
     st._slotUsed=true;
     if(!S._slotMachineRoll){
       var roll={wm_mult:1,gold:0,variant:null,parts:[]};
       if(Math.random()<0.50){roll.wm_mult*=2;roll.parts.push('\xd72 mult');}
       if(Math.random()<0.05){roll.wm_mult*=10;roll.parts.push('\xd710 mult');}
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
