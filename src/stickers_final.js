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
