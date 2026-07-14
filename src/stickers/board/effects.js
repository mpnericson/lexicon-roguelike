// ── SPRING TRAP ───────────────────────────────────────────────────────────────
// type: board · rarity: uncommon · cost: $5
// Per-tile additive bracket (onTileAdd): adds +9 letter score to the landing
// tile and records this square in ctx.springTraps. play.js reads
// res.springTraps after scoring to launch the tile back into the bag with a
// random colour variant. One-time use.
SQ.push({id:'spring_trap',name:'Spring Trap',
  desc:'Tile here gets +9 letter score. After scoring, it launches back into your bag with a 25% chance of becoming each colour variant. One-time use.',
  rarity:'uncommon',cost:5,qty:3,bg:'#0a2a08',fg:'#80f040',icon:'ST',type:'board',perishable:true,
  onTileAdd:function(tile,ctx,ts,baseSc,sqIdx){
    ts+=9;
    ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'Spring Trap +9',floatSqIdx:sqIdx});
    if(!ctx.preview){
      if(!ctx.springTraps)ctx.springTraps=[];
      if(ctx.springTraps.indexOf(sqIdx)<0)ctx.springTraps.push(sqIdx);
    }
    return ts;
  }});

// ── WHACK-A-MOLE ─────────────────────────────────────────────────────────────
// type: board · rarity: uncommon · cost: $5
// Per-tile additive bracket (onTileAdd): applies ×3 word mult and +$5 gold
// when a tile lands here. After scoring, play.js teleports this sticker to a
// random empty square within Manhattan distance 5. One-time-fire per play
// (perishable square).
SQ.push({id:'whack_a_mole',name:'Whack-a-Mole',
  desc:'×3 mult, +$5. Moves to a random empty square within 5 of here after scoring.',
  rarity:'uncommon',cost:5,qty:3,bg:'#1a1000',fg:'#c08040',icon:'WM',type:'board',perishable:true,
  onTileAdd:function(tile,ctx,ts,baseSc,sqIdx){
    ctx.xmults.push(3);
    ctx.events.push({type:'x-mult',factor:3,sqIdx:sqIdx,label:'Whack-a-Mole ×3',floatSqIdx:sqIdx});
    ctx.tgold+=5;
    ctx.events.push({type:'gold',delta:5,sqIdx:sqIdx,label:'Whack-a-Mole +$5',floatSqIdx:sqIdx});
    return ts;
  }});

// ── VIRUS ────────────────────────────────────────────────────────────────────
// type: board · rarity: rare · cost: $8
// Per-tile additive bracket (onTileAdd): a tile landing here gains +10 letter
// score and +2 mult but costs $1. After scoring, play.js consumes the square
// (perishable) and spawns two fresh Virus stickers on the nearest free squares,
// so the infection spreads.
SQ.push({id:'virus',name:'Virus',
  desc:'Tile here: +10 letter score, +2 mult, −$1. After scoring it spreads to the 2 closest free squares.',
  rarity:'rare',cost:8,qty:3,bg:'#0a1a0a',fg:'#60ff40',icon:'☣',type:'board',perishable:true,
  onTileAdd:function(tile,ctx,ts,baseSc,sqIdx){
    ts+=10;
    ctx.events.push({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'Virus +10',floatSqIdx:sqIdx});
    ctx.plusMults.push(2);
    ctx.events.push({type:'plus-mult',delta:2,sqIdx:sqIdx,label:'Virus +2 mult',floatSqIdx:sqIdx});
    ctx.tgold-=1;
    ctx.events.push({type:'gold',delta:-1,sqIdx:sqIdx,label:'Virus −$1',floatSqIdx:sqIdx});
    return ts;
  }});

// ── SLOT MACHINE ─────────────────────────────────────────────────────────────
// type: board · rarity: rare · cost: $8
// Per-tile additive bracket (onTileAdd): rolls all random effects once per
// play when a tile lands on this square and stores the result in ctx.slotRoll.
// Post-word mult bracket (onPostWordMult): reads ctx.slotRoll and applies the
// mult/gold payouts. Uses ctx._stickerActed to ensure activatedSqs is marked
// even when no events are pushed during the setup phase.
SQ.push({id:'slot_machine',name:'Slot Machine',
  desc:'Word through here: 50% ×2 mult, 5% ×10 mult, 30% +$3, 5% +$10, 1% all tiles go gold/red/blue — all independent.',
  rarity:'rare',cost:8,qty:8,bg:'#2a0a30',fg:'#d060ff',icon:'$?',perishable:true,
  onTileAdd:function(tile,ctx,ts,baseSc,sqIdx){
    if(ctx.slotUsed)return ts;
    ctx.slotUsed=true;
    ctx._stickerActed=true;
    if(!ctx.preview&&!ctx.slotRoll){
      var roll={wm_mult:1,gold:0,variant:null,parts:[]};
      if(Math.random()<0.50){roll.wm_mult*=2;roll.parts.push('×2 mult');}
      if(Math.random()<0.05){roll.wm_mult*=10;roll.parts.push('×10 mult');}
      if(Math.random()<0.30){roll.gold+=3;roll.parts.push('+$3');}
      if(Math.random()<0.05){roll.gold+=10;roll.parts.push('+$10');}
      if(Math.random()<0.01){var v=Math.random();roll.variant=v<1/3?'red':v<2/3?'blue':'gold';roll.parts.push('All '+roll.variant+'!');}
      ctx.slotRoll=roll;
      if(roll.parts.length)(function(p){setTimeout(function(){toast('🎰 Slot: '+p);},400);})(roll.parts.join(' | '));
    }
    return ts;
  },
  onPostWordMult:function(w,wt,ctx,inst){
    if(ctx._slotApplied||!ctx.slotRoll)return;
    ctx._slotApplied=true;
    var smr=ctx.slotRoll;
    var _slotSq=inst?inst.sqIdx:null;
    if(smr.wm_mult>1){ctx.xmults.push(smr.wm_mult);ctx.events.push({type:'x-mult',factor:smr.wm_mult,label:'Slot ×'+smr.wm_mult,floatSqIdx:_slotSq});}
    if(smr.gold>0){ctx.tgold+=smr.gold;ctx.events.push({type:'gold',delta:smr.gold,label:'Slot +$'+smr.gold,floatSqIdx:_slotSq});}
    if(smr.variant){if(!ctx.preview){for(var _si=0;_si<wt.length;_si++){var _sIdx=wt[_si].idx;var _sGt=(S.btTop&&S.btTop[_sIdx]&&S.btTop[_sIdx].isNew)?S.btTop[_sIdx]:S.bt[_sIdx];if(_sGt&&_sGt.id)transformTile(_sGt.id,{variant:smr.variant});}}ctx.events.push({type:'letter',lettersAfter:ctx.letters,isTileLocal:true,label:'Slot: All '+smr.variant+'!'});}
  }});
