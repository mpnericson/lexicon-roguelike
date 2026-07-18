// ── JENGA ─────────────────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5
// No scoring hook of its own. Enables stacking in drag.js: when placing a tile,
// if the target square already has a committed tile, the new tile is placed in
// S.btTop instead of S.bt. Each square stacks only ONCE — a committed tile that
// was itself stacked (_stackLevel >= 1) can't take another (gated in
// _jengaCanStack, placeTile, the render click handler, and the solver's
// stackable map). The stacked (top) tile forms the words like any new tile —
// the main word AND a cross word (the cross word only scores when it spells a
// valid word; an invalid one doesn't reject the play). The tile buried beneath
// adds its letter value inside EVERY word its square is part of (main word +
// each cross word). Handled in the engine via input.jengaUnder / jengaCrossIdxs
// (see scoring.js _liveTiles / _jengaCrossIdxs, engine _engScoreBuried).
SQ.push({id:'jenga',name:'Jenga',
  desc:'Stack new tiles on top of committed tiles. Each square can only be stacked once. The top tile forms the words; the buried tile adds its letter value to every word it sits under (crosswords included).',
  rarity:'uncommon',cost:5,bg:'#1a1000',fg:'#f0c840',icon:'JG',type:'stamp'});

// ── MIDAS TOUCH ───────────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5
// No scoring hook. Effect fires in play.js after committing a 5+ letter word:
// every tile in the word is gilded (variant set to 'gold') in both S.bt and S.bag.
SQ.push({id:'midas',name:'Midas',
  desc:'5+ letter words: gild all tiles in the word after scoring.',
  rarity:'uncommon',cost:5,bg:'#3a2a00',fg:'#f0d040',icon:'MD',type:'stamp'});

// ── EASY MODE ─────────────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5
// No scoring hook. Hover logic lives in render.js / ui.js: when this stamp is
// in the stamp bar, hovering it highlights the squares of the best available
// play found by the background solver.
SQ.push({id:'easy_mode',name:'Easy Mode',
  desc:'Hover this stamp to reveal the squares of the best available play.',
  rarity:'uncommon',cost:5,bg:'#0a2a0a',fg:'#60e060',icon:'EM',type:'stamp'});

// ── TWO FACE ──────────────────────────────────────────────────────────────────
// type: stamp · rarity: uncommon · cost: $5 · qty: 1
// No scoring hook. Its effect is ambient: the _luckMult()/_luckOdds() helpers
// (game.js) read countStamp('two_face') and double the odds of every luck-based
// sticker/stamp effect. Stacks multiplicatively (two copies = ×4). Wired at:
// Proletariat spread (indirect.js) and Slot Machine rolls (effects.js).
SQ.push({id:'two_face',name:'Two Face',
  desc:'Twice as lucky. Every luck-based sticker and stamp is twice as likely to trigger — Proletariat always spreads, Slot Machine odds double, and so on.',
  rarity:'uncommon',cost:5,qty:1,bg:'#1a0a2a',fg:'#c060ff',icon:'🎭',type:'stamp',
  liveDesc:function(p){
    return 'All luck-based effects are <span style="color:#f0e040">×'+_luckMult()+'</span> as likely to happen.';
  }});

// ── THE THING ─────────────────────────────────────────────────────────────────
// type: stamp · rarity: rare · cost: $8 · qty: 1
// Copies the stamp immediately to its right in the stamp bar.
// onBuildCtx: delegates to the right stamp's onBuildCtx (if any).
// onPostWord: delegates to the right stamp's onPostWord (if any).
// onEndBoard: delegates to the right stamp's onEndBoard (if any).
// _THING_BLOCKED (data.js) lists stamp IDs that cannot be copied. Stamp
// definitions can also set copyable:false to opt out.
SQ.push({id:'the_thing',name:'The Thing',
  desc:'Copies the effect of the stamp immediately to its right in the stamp bar. Some utility stamps cannot be copied.',
  rarity:'rare',cost:8,qty:1,bg:'#0a1a0a',fg:'#50c050',icon:'◈',type:'stamp',
  liveDesc:function(p){
    var myIdx=-1;for(var _i=0;_i<S.stamps.length;_i++){if(S.stamps[_i]===p){myIdx=_i;break;}}
    if(myIdx<0||myIdx>=S.stamps.length-1)return 'No stamp to the right — move The Thing left of a stamp to copy it.';
    var rTs=S.stamps[myIdx+1];var rDef=sqd(rTs.id);
    if(!rDef||_THING_BLOCKED[rTs.id]||(rDef.copyable===false))return 'Copying: <span style="color:#ff6060">'+(rDef?rDef.name:rTs.id)+' — not copyable</span>';
    var base='Copying: <span style="color:#f0e040">'+rDef.name+'</span>';
    if(rDef.liveDesc)base+='<br>'+rDef.liveDesc(rTs);
    return base;
  },
  onBuildCtx:function(ctx,ts){
    var myIdx=ctx.stamps.indexOf(ts);
    if(myIdx<0||myIdx>=ctx.stamps.length-1)return;
    var rTs=ctx.stamps[myIdx+1];var rDef=sqd(rTs.id);
    if(!rDef||_THING_BLOCKED[rTs.id]||(rDef.copyable===false))return;
    if(rDef.onBuildCtx)rDef.onBuildCtx(ctx,rTs);
  },
  onPerTile:function(tile,ctx,ts,ts_inst){
    var myIdx=ctx.stamps.indexOf(ts_inst);
    if(myIdx<0||myIdx>=ctx.stamps.length-1)return ts;
    var rTs=ctx.stamps[myIdx+1];var rDef=sqd(rTs.id);
    if(!rDef||_THING_BLOCKED[rTs.id]||(rDef.copyable===false))return ts;
    if(rDef.onPerTile)ts=rDef.onPerTile(tile,ctx,ts,rTs);
    return ts;
  },
  onPostWord:function(w,wt,ctx,ts){
    var myIdx=ctx.stamps.indexOf(ts);
    if(myIdx<0||myIdx>=ctx.stamps.length-1)return;
    var rTs=ctx.stamps[myIdx+1];var rDef=sqd(rTs.id);
    if(!rDef||_THING_BLOCKED[rTs.id]||(rDef.copyable===false))return;
    if(rDef.onPostWord)rDef.onPostWord(w,wt,ctx,rTs);
  },
  onEndBoard:function(ts){
    var myIdx=-1;for(var _i=0;_i<S.stamps.length;_i++){if(S.stamps[_i]===ts){myIdx=_i;break;}}
    if(myIdx<0||myIdx>=S.stamps.length-1)return;
    var rTs=S.stamps[myIdx+1];var rDef=sqd(rTs.id);
    if(!rDef||_THING_BLOCKED[rTs.id]||(rDef.copyable===false))return;
    if(rDef.onEndBoard)rDef.onEndBoard(rTs);
  }});
