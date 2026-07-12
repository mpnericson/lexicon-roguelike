// ── JENGA ─────────────────────────────────────────────────────────────────────
// type: tile · rarity: uncommon · cost: $5
// No scoring hook. Enables stacking in drag.js: when placing a tile, if the
// target square already has a committed tile, the new tile is placed in S.btTop
// instead of S.bt. Only the top tile is scored each play.
SQ.push({id:'jenga',name:'Jenga',
  desc:'Stack new tiles on top of committed tiles (max 1 deep). Only the top tile scores.',
  rarity:'uncommon',cost:5,bg:'#1a1000',fg:'#f0c840',icon:'JG',type:'tile'});

// ── MIDAS TOUCH ───────────────────────────────────────────────────────────────
// type: tile · rarity: uncommon · cost: $5
// No scoring hook. Effect fires in play.js after committing a 5+ letter word:
// every tile in the word is gilded (variant set to 'gold') in both S.bt and S.bag.
SQ.push({id:'midas_touch',name:'Midas Touch',
  desc:'5+ letter words: gild all tiles in the word after scoring.',
  rarity:'uncommon',cost:5,bg:'#3a2a00',fg:'#f0d040',icon:'MD',type:'tile'});

// ── EASY MODE ─────────────────────────────────────────────────────────────────
// type: tile · rarity: uncommon · cost: $5
// No scoring hook. Hover logic lives in render.js / ui.js: when this sticker is
// in the sticker bar, hovering it highlights the squares of the best available
// play found by the background solver.
SQ.push({id:'easy_mode',name:'Easy Mode',
  desc:'Hover this sticker to reveal the squares of the best available play.',
  rarity:'uncommon',cost:5,bg:'#0a2a0a',fg:'#60e060',icon:'EM',type:'tile'});

// ── THE THING ─────────────────────────────────────────────────────────────────
// type: tile · rarity: rare · cost: $8 · qty: 1
// Copies the sticker immediately to its right in the tile sticker bar.
// onBuildCtx: delegates to the right sticker's onBuildCtx (if any).
// onPostWord: delegates to the right sticker's onPostWord (if any).
// onEndStage: delegates to the right sticker's onEndStage (if any).
// _THING_BLOCKED (data.js) lists sticker IDs that cannot be copied. Sticker
// definitions can also set copyable:false to opt out.
SQ.push({id:'the_thing',name:'The Thing',
  desc:'Copies the effect of the sticker immediately to its right in the sticker bar. Some utility stickers cannot be copied.',
  rarity:'rare',cost:8,qty:1,bg:'#0a1a0a',fg:'#50c050',icon:'◈',type:'tile',
  liveDesc:function(p){
    var myIdx=-1;for(var _i=0;_i<S.tileStickers.length;_i++){if(S.tileStickers[_i]===p){myIdx=_i;break;}}
    if(myIdx<0||myIdx>=S.tileStickers.length-1)return 'No sticker to the right — move The Thing left of a sticker to copy it.';
    var rTs=S.tileStickers[myIdx+1];var rDef=sqd(rTs.id);
    if(!rDef||_THING_BLOCKED[rTs.id]||(rDef.copyable===false))return 'Copying: <span style="color:#ff6060">'+(rDef?rDef.name:rTs.id)+' — not copyable</span>';
    var base='Copying: <span style="color:#f0e040">'+rDef.name+'</span>';
    if(rDef.liveDesc)base+='<br>'+rDef.liveDesc(rTs);
    return base;
  },
  onBuildCtx:function(ctx,ts){
    var myIdx=ctx.hotbar.indexOf(ts);
    if(myIdx<0||myIdx>=ctx.hotbar.length-1)return;
    var rTs=ctx.hotbar[myIdx+1];var rDef=sqd(rTs.id);
    if(!rDef||_THING_BLOCKED[rTs.id]||(rDef.copyable===false))return;
    if(rDef.onBuildCtx)rDef.onBuildCtx(ctx,rTs);
  },
  onPerTile:function(tile,ctx,ts,ts_inst){
    var myIdx=ctx.hotbar.indexOf(ts_inst);
    if(myIdx<0||myIdx>=ctx.hotbar.length-1)return ts;
    var rTs=ctx.hotbar[myIdx+1];var rDef=sqd(rTs.id);
    if(!rDef||_THING_BLOCKED[rTs.id]||(rDef.copyable===false))return ts;
    if(rDef.onPerTile)ts=rDef.onPerTile(tile,ctx,ts,rTs);
    return ts;
  },
  onPostWord:function(w,wt,ctx,ts){
    var myIdx=ctx.hotbar.indexOf(ts);
    if(myIdx<0||myIdx>=ctx.hotbar.length-1)return;
    var rTs=ctx.hotbar[myIdx+1];var rDef=sqd(rTs.id);
    if(!rDef||_THING_BLOCKED[rTs.id]||(rDef.copyable===false))return;
    if(rDef.onPostWord)rDef.onPostWord(w,wt,ctx,rTs);
  },
  onEndStage:function(ts){
    var myIdx=-1;for(var _i=0;_i<S.tileStickers.length;_i++){if(S.tileStickers[_i]===ts){myIdx=_i;break;}}
    if(myIdx<0||myIdx>=S.tileStickers.length-1)return;
    var rTs=S.tileStickers[myIdx+1];var rDef=sqd(rTs.id);
    if(!rDef||_THING_BLOCKED[rTs.id]||(rDef.copyable===false))return;
    if(rDef.onEndStage)rDef.onEndStage(rTs);
  }});
