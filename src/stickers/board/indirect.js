// ── CHESS HELPERS ─────────────────────────────────────────────────────────────
// Shared utilities used by chess piece onBuildCtx hooks and by render.js for
// hover preview. Scoring goes through the aura system (see _chessRegister).

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

// Shared onBuildCtx body: each piece registers its own multiplicative aura
// over its attack squares. Overlapping pieces STACK — a tile covered by two
// pieces scores ×3 twice (×9). The King (stamp) upgrades every aura
// square to Triple Word via ctx.chessKingActive.
function _chessRegister(ctx, p) {
  var pieceSq = p.sqIdx;
  ctx.auras.push({
    id: p.id,
    squares: chessGetAura(pieceSq, p.id),
    onTileMult: function (tile, ctx2, ts, sqIdx) {
      ts *= 3;
      ctx2.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'♟ ×3',floatSqIdx:pieceSq});
      if (ctx2.chessKingActive && tile.isNew) {
        ctx2.xmults.push(3);
        ctx2.events.push({type:'x-mult',factor:3,sqIdx:sqIdx,label:'♚ King ×3',floatStampId:'chess_king'});
      }
      return ts;
    }
  });
}

// ── KNIGHT ────────────────────────────────────────────────────────────────────
// type: board · rarity: rare · cost: $8
// onBuildCtx (_chessRegister): registers a ×3 mult aura over this piece's
// L-shape squares.
SQ.push({id:'chess_knight',name:'Knight',
  desc:'×3 letter score to any word tile on an L-shape square from here. Comes as a pair.',
  rarity:'rare',cost:8,qty:2,bg:'#1a1a2a',fg:'#d0d0f0',icon:'♞',type:'board',perishable:true,
  onBuildCtx:_chessRegister});

// ── BISHOP ────────────────────────────────────────────────────────────────────
// type: board · rarity: rare · cost: $8
// onBuildCtx: registers diagonal aura (blocked by occupied squares).
SQ.push({id:'chess_bishop',name:'Bishop',
  desc:'×3 letter score to any word tile on a diagonal from here. Blocked by occupied squares. Comes as a pair.',
  rarity:'rare',cost:8,qty:2,bg:'#2a1a08',fg:'#f0d080',icon:'♝',type:'board',perishable:true,
  onBuildCtx:_chessRegister});

// ── ROOK ──────────────────────────────────────────────────────────────────────
// type: board · rarity: rare · cost: $8
// onBuildCtx: registers row/column aura (blocked by occupied squares).
SQ.push({id:'chess_rook',name:'Rook',
  desc:'×3 letter score to any word tile on the same row or column. Blocked by occupied squares. Comes as a pair.',
  rarity:'rare',cost:8,qty:2,bg:'#0a2a0a',fg:'#80f080',icon:'♜',type:'board',perishable:true,
  onBuildCtx:_chessRegister});

// ── QUEEN ─────────────────────────────────────────────────────────────────────
// type: board · rarity: rare · cost: $8
// onBuildCtx: registers all-8-direction aura (not blocked by tiles).
SQ.push({id:'chess_queen',name:'Queen',
  desc:'×3 letter score to any word tile in all 8 directions. Not blocked by tiles.',
  rarity:'rare',cost:8,qty:1,bg:'#2a0a2a',fg:'#f080f0',icon:'♛',type:'board',perishable:true,
  onBuildCtx:_chessRegister});

// ── PROLETARIAT ───────────────────────────────────────────────────────────────
// type: board · rarity: uncommon · cost: $5
// Post-word additive bracket (onPostWordAdd): adds +0.25 mult per Proletariat
// on board (fires once, guarded by ctx._proletariatDone). Spread logic lives
// in _proletariatSpread() below, called from play.js after each word commits.
SQ.push({id:'proletariat',name:'The Proletariat',
  desc:'+0.25 mult per Proletariat on board. While gold < $4: 50% chance after each word to spread to a random adjacent empty square.',
  rarity:'uncommon',cost:5,qty:1,bg:'#2a0808',fg:'#ff6040',icon:'PR',type:'board',perishable:true,
  liveDesc:function(p){
    var n=0;for(var i=0;i<S.placed.length;i++)if(S.placed[i].id==='proletariat')n++;
    var v=parseFloat((0.25*n).toFixed(2));
    return n+' on board → <span style="color:#f0e040">+'+v+' mult</span> per word.'
      +(S.gold<4?' <span style="color:#f0d060">Gold < $4</span>: 50% chance to spread after each word.':'');
  },
  onPostWordAdd:function(w,wt,ctx){
    if(ctx._proletariatDone)return;
    ctx._proletariatDone=true;
    var n=0;for(var i=0;i<ctx.placed.length;i++)if(ctx.placed[i].id==='proletariat')n++;
    if(n===0)return;
    var delta=parseFloat((0.25*n).toFixed(2));
    ctx.plusMults.push(delta);
    ctx.events.push({type:'plus-mult',delta:delta,label:'Proletariat ×'+n+' +'+delta+' mult'});
  }});

// ── PROLETARIAT SPREAD ────────────────────────────────────────────────────────
// Called from play.js after each word. 50% chance to expand to an adjacent empty
// square when the player has less than $4 gold.
function _proletariatSpread() {
  var pros = [];
  for (var i = 0; i < S.placed.length; i++) if (S.placed[i].id === 'proletariat') pros.push(S.placed[i]);
  if (pros.length === 0 || S.gold >= 4) return;
  if (_rng() > 0.5) return;
  var candidates = [], seen = {};
  for (var i = 0; i < pros.length; i++) {
    var sq = pros[i].sqIdx; if (sq == null) continue;
    var r = Math.floor(sq / B), c = sq % B;
    var dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (var d = 0; d < dirs.length; d++) {
      var nr = r + dirs[d][0], nc = c + dirs[d][1];
      if (nr < 0 || nr >= B || nc < 0 || nc >= B) continue;
      var ni = nr * B + nc;
      if (!seen[ni] && !S.board[ni]) { seen[ni] = 1; candidates.push(ni); }
    }
  }
  if (candidates.length === 0) return;
  var newIdx = candidates[Math.floor(_rng() * candidates.length)];
  S.board[newIdx] = 'proletariat';
  S.placed.push({id:'proletariat', sqIdx:newIdx});
  renderBoard();
  toast('Proletariat spreads! (' + (pros.length + 1) + ' on board)');
}
