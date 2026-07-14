// ── DOUBLE LETTER ────────────────────────────────────────────────────────────
// type: board · rarity: common · cost: $3
// Per-tile mult bracket (onTileMult): letter score ×2 (×4 with Purist).
// bm is metadata only (dev-palette categorisation in ui.js).
SQ.push({id:'dl',name:'Double Letter',desc:'Letter scores ×2.',
  rarity:'common',cost:3,qty:6,bg:'#14305a',fg:'#6aaaff',icon:'DL',type:'board',bm:'dl',perishable:true,
  onTileMult:function(tile,ctx,ts,sqIdx){
    var f=ctx.purist?4:2;
    ts*=f;
    ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'Double Letter ×'+f,floatSqIdx:sqIdx});
    return ts;
  }});

// ── TRIPLE LETTER ─────────────────────────────────────────────────────────────
// type: board · rarity: common · cost: $3
// Per-tile mult bracket (onTileMult): letter score ×3 (×9 with Purist).
SQ.push({id:'tl',name:'Triple Letter',desc:'Letter scores ×3.',
  rarity:'common',cost:3,qty:4,bg:'#0d2050',fg:'#4488ff',icon:'TL',type:'board',bm:'tl',perishable:true,
  onTileMult:function(tile,ctx,ts,sqIdx){
    var f=ctx.purist?9:3;
    ts*=f;
    ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'Triple Letter ×'+f,floatSqIdx:sqIdx});
    return ts;
  }});

// ── DOUBLE WORD ───────────────────────────────────────────────────────────────
// type: board · rarity: common · cost: $3
// Per-tile mult bracket (onTileMult): pushes ×2 word mult (×4 with Purist).
SQ.push({id:'dw',name:'Double Word',desc:'Word ×2 when new tile lands here.',
  rarity:'common',cost:3,qty:2,bg:'#6a1818',fg:'#ff8080',icon:'DW',type:'board',bm:'dw',perishable:true,
  onTileMult:function(tile,ctx,ts,sqIdx){
    var f=ctx.purist?4:2;
    ctx.xmults.push(f);
    ctx.events.push({type:'x-mult',factor:f,sqIdx:sqIdx,label:'Double Word ×'+f,floatSqIdx:sqIdx});
    return ts;
  }});

// ── TRIPLE WORD ───────────────────────────────────────────────────────────────
// type: board · rarity: common · cost: $3
// Per-tile mult bracket (onTileMult): pushes ×3 word mult (×9 with Purist).
SQ.push({id:'tw',name:'Triple Word',desc:'Word ×3 when new tile lands here.',
  rarity:'common',cost:3,qty:1,bg:'#500808',fg:'#ff6060',icon:'TW',type:'board',bm:'tw',perishable:true,
  onTileMult:function(tile,ctx,ts,sqIdx){
    var f=ctx.purist?9:3;
    ctx.xmults.push(f);
    ctx.events.push({type:'x-mult',factor:f,sqIdx:sqIdx,label:'Triple Word ×'+f,floatSqIdx:sqIdx});
    return ts;
  }});

// ── RED STICKER (ECHO) ────────────────────────────────────────────────────────
// type: local · rarity: common · cost: $3
// Retrigger bracket: retrigger:true → engine re-runs the per-tile passes on
// the same tile, continuing from the current tile score (does not reset to 0).
SQ.push({id:'echo',name:'Red Sticker',desc:'Letter here scores twice.',
  rarity:'common',cost:3,qty:3,bg:'#1a3a5a',fg:'#80c0ff',icon:'EC',type:'local',perishable:true,
  retrigger:true});

// ── GILDED ────────────────────────────────────────────────────────────────────
// type: local · rarity: common · cost: $3
// PRE bracket (onPreScore): turns the tile on this square gold before any
// scoring happens, so the gold-tile +$1 fires during per-tile scoring.
SQ.push({id:'gilded',name:'Gilded',desc:'Transforms tile to gold before scoring (gold tiles earn +$1).',
  rarity:'common',cost:3,qty:3,bg:'#3a2a00',fg:'#f0c060',icon:'GL',type:'local',perishable:true,
  onPreScore:function(tile,ctx,sqIdx){
    if(tile.variant==='gold')return;
    tile.variant='gold';
    // Gild the tile actually played on this square. With a Jenga stack the
    // played tile is the fresh top (S.btTop), not the buried committed tile in
    // S.bt — gilding the buried one would leave the visible tile ungilded.
    if(!ctx.preview){
      var _gt=(S.btTop&&S.btTop[sqIdx]&&S.btTop[sqIdx].isNew)?S.btTop[sqIdx]:S.bt[sqIdx];
      if(_gt&&_gt.id)transformTile(_gt.id,{variant:'gold'});
    }
    ctx.events.push({type:'letter',lettersAfter:ctx.letters,label:'Gilded → Gold',floatSqIdx:sqIdx,goldifySq:sqIdx});
  }});

// ── VOID ──────────────────────────────────────────────────────────────────────
// type: local · rarity: uncommon · cost: $5
// Per-tile additive bracket (onTileAdd): zeroes the tile's base letter score
// and instead pushes +2 mult, trading letter points for a flat multiplier.
SQ.push({id:'void',name:'Void',desc:'Letter scores 0 letter score but +2 mult.',
  rarity:'uncommon',cost:5,qty:3,bg:'#1a0a2a',fg:'#c080ff',icon:'VO',type:'local',perishable:true,
  onTileAdd:function(tile,ctx,ts,baseSc,sqIdx){
    ts-=baseSc;
    ctx.plusMults.push(2);
    ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'Void (0 pts)',floatSqIdx:sqIdx});
    ctx.events.push({type:'plus-mult',delta:2,label:'Void +2 mult',floatSqIdx:sqIdx});
    return ts;
  }});

// ── PAINT BUCKET ──────────────────────────────────────────────────────────────
// type: local · rarity: uncommon · cost: $5
// No scoring hook. Effect fires in play.js at end of stage: any tile committed
// on this square becomes a blank when the board clears.
SQ.push({id:'paint_bucket',name:'Paint Bucket',
  desc:'Tile placed here becomes a blank when the board clears at end of stage.',
  rarity:'uncommon',cost:5,qty:2,bg:'#0a2a2a',fg:'#60d0d0',icon:'PB',type:'local',perishable:true});

// ── SUPER GLUE ────────────────────────────────────────────────────────────────
// type: board · rarity: uncommon · cost: $5
// No scoring hook. Effect is checked in play.js when consuming perishable
// board stickers: adjacent super glue prevents their removal after scoring.
SQ.push({id:'super_glue',name:'Super Glue',
  desc:'Adjacent board stickers are not consumed when tiles land on them.',
  rarity:'uncommon',cost:5,qty:3,bg:'#2a1a00',fg:'#f0c860',icon:'SG',type:'board',perishable:true});
