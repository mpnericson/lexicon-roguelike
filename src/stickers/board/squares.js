// ── DOUBLE LETTER ────────────────────────────────────────────────────────────
// type: board · rarity: common · cost: $3
// Bracket 4: bm='dl' → scoring engine multiplies letter score ×2 (×4 with Purist).
SQ.push({id:'dl',name:'Double Letter',desc:'Letter scores ×2.',
  rarity:'common',cost:3,qty:6,bg:'#14305a',fg:'#6aaaff',icon:'DL',type:'board',bm:'dl',perishable:true});

// ── TRIPLE LETTER ─────────────────────────────────────────────────────────────
// type: board · rarity: common · cost: $3
// Bracket 4: bm='tl' → scoring engine multiplies letter score ×3 (×9 with Purist).
SQ.push({id:'tl',name:'Triple Letter',desc:'Letter scores ×3.',
  rarity:'common',cost:3,qty:4,bg:'#0d2050',fg:'#4488ff',icon:'TL',type:'board',bm:'tl',perishable:true});

// ── DOUBLE WORD ───────────────────────────────────────────────────────────────
// type: board · rarity: common · cost: $3
// Bracket 4: bm='dw' → scoring engine pushes ×2 x-mult (×4 with Purist).
SQ.push({id:'dw',name:'Double Word',desc:'Word ×2 when new tile lands here.',
  rarity:'common',cost:3,qty:2,bg:'#6a1818',fg:'#ff8080',icon:'DW',type:'board',bm:'dw',perishable:true});

// ── TRIPLE WORD ───────────────────────────────────────────────────────────────
// type: board · rarity: common · cost: $3
// Bracket 4: bm='tw' → scoring engine pushes ×3 x-mult (×9 with Purist).
SQ.push({id:'tw',name:'Triple Word',desc:'Word ×3 when new tile lands here.',
  rarity:'common',cost:3,qty:1,bg:'#500808',fg:'#ff6060',icon:'TW',type:'board',bm:'tw',perishable:true});

// ── RED STICKER (ECHO) ────────────────────────────────────────────────────────
// type: local · rarity: common · cost: $3
// Bracket 6: retrigger:true → scoring engine re-runs brackets 1-5 on the same tile,
// continuing from the current tile score (does not reset to 0).
SQ.push({id:'echo',name:'Red Sticker',desc:'Letter here scores twice.',
  rarity:'common',cost:3,qty:3,bg:'#1a3a5a',fg:'#80c0ff',icon:'EC',type:'local',perishable:true,
  retrigger:true});

// ── GILDED ────────────────────────────────────────────────────────────────────
// type: local · rarity: common · cost: $3
// Bracket 2 (onSquareLand): awards +$1 gold when a tile lands on this square.
SQ.push({id:'gilded',name:'Gilded',desc:'Letter here earns +$1.',
  rarity:'common',cost:3,qty:3,bg:'#3a2a00',fg:'#f0c060',icon:'GL',type:'local',perishable:true,
  onSquareLand:function(tile,ctx,ts,baseSc,sqIdx){
    ctx.tgold++;
    ctx.events.push({type:'gold',delta:1,sqIdx:sqIdx,label:'Gilded +$1',floatSqIdx:sqIdx});
    return ts;
  }});

// ── VOID ──────────────────────────────────────────────────────────────────────
// type: local · rarity: uncommon · cost: $5
// Bracket 2 (onSquareLand): zeroes the tile's base letter score and instead
// pushes +2 mult, effectively trading letter points for a flat multiplier.
SQ.push({id:'void',name:'Void',desc:'Letter scores 0 letter score but +2 mult.',
  rarity:'uncommon',cost:5,qty:3,bg:'#1a0a2a',fg:'#c080ff',icon:'VO',type:'local',perishable:true,
  onSquareLand:function(tile,ctx,ts,baseSc,sqIdx){
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
// No scoring hook. Effect is checked in scoring.js when consuming perishable
// board stickers: adjacent super glue prevents their removal after scoring.
SQ.push({id:'super_glue',name:'Super Glue',
  desc:'Adjacent board stickers are not consumed when tiles land on them.',
  rarity:'uncommon',cost:5,qty:3,bg:'#2a1a00',fg:'#f0c860',icon:'SG',type:'board',perishable:true});
