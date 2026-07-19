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
// Per-tile additive bracket (onTileAdd): applies +5 mult and +$5 gold
// when a tile lands here. After scoring, play.js teleports this sticker to a
// random empty square within Manhattan distance 5. One-time-fire per play
// (perishable square).
SQ.push({id:'whack_a_mole',name:'Whack-a-Mole',
  desc:'+5 mult, +$5. Moves to a random empty square within 5 of here after scoring.',
  rarity:'uncommon',cost:5,qty:1,bg:'#1a1000',fg:'#c08040',icon:'WM',type:'board',perishable:true,
  onTileAdd:function(tile,ctx,ts,baseSc,sqIdx){
    ctx.plusMults.push(5);
    ctx.events.push({type:'plus-mult',delta:5,sqIdx:sqIdx,label:'Whack-a-Mole +5 mult',floatSqIdx:sqIdx});
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
// Per-tile additive bracket (onTileAdd): one roll per square per play
// (ctx._slotFired — a cross-word/main-word double pass or retrigger re-pass
// never re-rolls). Five independent effects, any combination can hit at once;
// each hit pushes its OWN event carrying sqIdx so the tile bounces once per
// hit in the score animation. Only the first event carries floatSqIdx (the
// sticker peel) — same-float events would merge into a single bounce. Odds
// scale with Two Face (_luckOdds; falls back to raw odds under the pure-engine
// test harness, where game.js isn't loaded). The 1% jackpot records every
// tile of the word through this square in ctx.slotTransforms (each gets an
// independent random colour); play.js applies the transforms after scoring.
// Never rolls in preview, so the solver can't see random payouts.
SQ.push({id:'slot_machine',name:'Slot Machine',
  desc:'Word through here: 30% +20 mult, 15% +$3, 2% ×4 mult, 2% +$10, 1% every tile in the word turns a random colour — all independent.',
  rarity:'rare',cost:8,qty:8,bg:'#2a0a30',fg:'#d060ff',icon:'$?',type:'board',perishable:true,
  onTileAdd:function(tile,ctx,ts,baseSc,sqIdx){
    if(ctx.preview)return ts;
    if(!ctx._slotFired)ctx._slotFired={};
    if(ctx._slotFired[sqIdx])return ts;
    ctx._slotFired[sqIdx]=true;
    ctx._stickerActed=true;
    var lo=typeof _luckOdds==='function'?_luckOdds:function(p){return p;};
    var first=true;
    var ev=function(e){if(first){e.floatSqIdx=sqIdx;first=false;}ctx.events.push(e);};
    if(Math.random()<lo(0.30)){ctx.plusMults.push(20);ev({type:'plus-mult',delta:20,sqIdx:sqIdx,label:'Slot +20 mult'});}
    if(Math.random()<lo(0.15)){ctx.tgold+=3;ev({type:'gold',delta:3,sqIdx:sqIdx,label:'Slot +$3'});}
    if(Math.random()<lo(0.02)){ctx.xmults.push(4);ev({type:'x-mult',factor:4,sqIdx:sqIdx,label:'Slot ×4'});}
    if(Math.random()<lo(0.02)){ctx.tgold+=10;ev({type:'gold',delta:10,sqIdx:sqIdx,label:'Slot +$10'});}
    if(Math.random()<lo(0.01)){
      if(!ctx.slotTransforms)ctx.slotTransforms=[];
      var wt=ctx.curWordTiles||[tile];
      for(var i=0;i<wt.length;i++){
        var v=Math.random();
        ctx.slotTransforms.push({idx:wt[i].idx,variant:v<0.2?'red':v<0.4?'blue':v<0.6?'gold':v<0.8?'jade':'purple'});
      }
      ev({type:'letter',sqIdx:sqIdx,lettersAfter:ts,isTileLocal:true,label:'Slot: Jackpot!'});
    }
    return ts;
  }});
