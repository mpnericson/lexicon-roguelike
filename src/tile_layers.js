// =====================================================================
// TILE LAYERS — material/color tile compositor
// A layered tile is built from stacked pieces inside its ONE face div:
//   base   — hand-drawn blank tile face for the color×material combo
//            (Assets/sprites/tiles/<color>_<material>.png, 32×32,
//            'plain' for an empty axis — e.g. jade_glass.png,
//            plain_metallic.png, purple_plain.png). Missing bases fall
//            back to the normal sprite-sheet face.
//   sheen  — cursor-as-light gloss driven every frame by _tlLightLoop;
//            material tiles only.
//   glyph  — letter + score re-stamped on top so text stays crisp. Assigned
//            blanks get the letter-only sheet (score digit stripped);
//            unassigned blanks show the empty face.
// The glyph sheets are extracted at startup by diffing each letter cell of
// tiles.png against its blank cell (col 10, row 1) — no separate letter art
// needed. All layers are children of the face, so
// physics, drag and scoring animations move them as one element.
// Plain/red/blue/gold tiles without a material keep the fully baked
// legacy path untouched.
// =====================================================================

var TL={glyphURL:null,letterURL:null};

// Per-material light response. grad = the highlight band (its width/edges are
// the "gloss": tight+hard = polished coat, wide+soft = brushed metal).
// floor/reach drive _tlLightLoop's proximity brightness: metal reflects a lot
// of light so it stays lit from far away; a varnish highlight dies off fast.
// Each sheen has two background layers:
//   grad  — resting specular band, positioned by the fixed overhead light.
//   sweep — the idle ripple: a band that travels top-left → bottom-right across
//           every material tile IN SYNC, once per TL_SWEEP_PERIOD. Material
//           character: varnished wobbles side-to-side as it travels (wob = %
//           amplitude, wobFreq = radians over one sweep), glass is a fat soft
//           wash, metallic is thin crisp parallel lines.
var TL_SWEEP_PERIOD=3;   // seconds between sweep starts
var TL_SWEEP_DUR=1.1;    // default crossing time
// Each material: grad = resting specular (fixed-light-positioned), sweeps =
// travelling layers that all launch together each period and cross at their
// own dur. make(u,t,ti) builds the layer's gradient EVERY FRAME while it
// travels (u = 0..1 progress, t = clock, ti = tile index) — so the shapes
// WARP as they move: varnished arcs breathe curvature/width, the glass wash
// tilts and swells, metallic's parallel lines lean slightly. wob/wobFreq
// wobble a layer perpendicular to its travel.
// Ellipse arc: rx/ry animate independently, so the band's curvature squashes
// and stretches like a reflection on moving water. r/w are in % of the
// ellipse (band hugs its edge).
function _tlArc(cx,cy,rx,ry,r,w,col,a){
  return 'radial-gradient(ellipse '+rx.toFixed(1)+'% '+ry.toFixed(1)+'% at '+cx.toFixed(1)+'% '+cy.toFixed(1)+'%,transparent '+(r-3).toFixed(1)+'%,rgba('+col+','+a.toFixed(2)+') '+r.toFixed(1)+'%,rgba('+col+','+a.toFixed(2)+') '+(r+w).toFixed(1)+'%,transparent '+(r+w+3).toFixed(1)+'%)';
}
var TL_MATERIALS={
  metallic:{ // brushed metal: thick band + thin line pair + stray thin line, different speeds
    grad:'linear-gradient(115deg,transparent 26%,rgba(235,240,255,0.1) 38%,rgba(235,240,255,0.25) 50%,rgba(235,240,255,0.1) 62%,transparent 74%)',
    sweeps:[
      {dur:1.0,make:function(u,t,ti){
        var ang=(135+Math.sin(u*Math.PI*2+t*0.4)*4).toFixed(1);
        var w=(4.5+Math.sin(u*Math.PI*2.6+1.1)*1.1).toFixed(1);
        return 'linear-gradient('+ang+'deg,transparent 44%,rgba(235,240,255,0.5) 45%,rgba(235,240,255,0.5) '+(45+ +w)+'%,transparent '+(46+ +w)+'%)';}},
      {dur:1.35,make:function(u,t,ti){
        var ang=(135+Math.sin(u*Math.PI*1.7+t*0.4+2.1)*5).toFixed(1);
        return 'linear-gradient('+ang+'deg,transparent 44%,rgba(235,240,255,0.85) 44.6%,transparent 45.2%,transparent 47%,rgba(235,240,255,0.85) 47.6%,transparent 48.2%)';}},
      {dur:0.85,make:function(u,t,ti){
        var ang=(135+Math.sin(u*Math.PI*2.3+t*0.4+4.4)*6).toFixed(1);
        return 'linear-gradient('+ang+'deg,transparent 52%,rgba(235,240,255,0.7) 52.6%,transparent 53.2%)';}}
    ]},
  glass:{ // fat blended wash that tilts and swells as it crosses
    grad:'linear-gradient(115deg,transparent 38%,rgba(255,255,255,0.3) 47%,rgba(255,255,255,0.3) 53%,transparent 62%)',
    sweeps:[
      {dur:1.1,make:function(u,t,ti){
        var ang=(135+Math.sin(u*Math.PI*2+t*0.5+ti*0.3)*10).toFixed(1);
        var h=8+Math.sin(u*Math.PI*2.5+0.8)*3;
        return 'linear-gradient('+ang+'deg,transparent '+(50-2.2*h).toFixed(1)+'%,rgba(255,255,255,0.25) '+(50-h).toFixed(1)+'%,rgba(255,255,255,0.6) 50%,rgba(255,255,255,0.25) '+(50+h).toFixed(1)+'%,transparent '+(50+2.2*h).toFixed(1)+'%)';}}
    ]},
  varnished:{ // glossy coat: water-reflection arcs — extreme squash/stretch,
    // splitting and merging like caustics as they cross
    grad:'linear-gradient(115deg,transparent 45.5%,rgba(255,242,214,0.18) 48%,rgba(255,242,214,0.18) 52%,transparent 54.5%)',
    sweeps:[
      {dur:1.15,wob:9,wobFreq:21,make:function(u,t,ti){
        var cx=32+Math.sin(t*1.7+ti*0.4)*8+Math.sin(u*Math.PI*3.1)*7;
        var cy=70+Math.cos(t*1.3+ti*0.4)*8-Math.sin(u*Math.PI*2.2+1)*7;
        var rx=40+Math.sin(u*Math.PI*4+t*2.3)*16;
        var ry=32+Math.cos(u*Math.PI*3.3+t*1.9+2.4)*14;
        var w=Math.max(1.2,4+Math.sin(u*Math.PI*5+t*2.8)*2.6);
        var a=0.55+Math.sin(u*Math.PI*3.6+t*2.1)*0.15;
        return _tlArc(cx,cy,rx,ry,82,w,'255,238,200',a);}},
      {dur:1.32,wob:7,wobFreq:17,make:function(u,t,ti){
        var cx=24+Math.cos(t*2.1+ti*0.4)*9;
        var cy=76+Math.sin(t*1.6+ti*0.4)*9;
        var rx=30+Math.sin(u*Math.PI*3.7+t*2.6+1.2)*13;
        var ry=42+Math.cos(u*Math.PI*2.9+t*2.2+3.6)*15;
        var w=Math.max(1,2.5+Math.sin(u*Math.PI*4.4+t*3.1)*1.6);
        return _tlArc(cx,cy,rx,ry,85,w,'255,238,200',0.3);}},
      {dur:0.9,wob:11,wobFreq:26,make:function(u,t,ti){
        // quick thin sparkle arc — crosses fast, splits off the main band
        var cx=38+Math.sin(t*2.8+ti*0.5)*10;
        var cy=64+Math.cos(t*2.3+ti*0.5)*10;
        var rx=22+Math.sin(u*Math.PI*4.6+t*3.4)*9;
        var ry=28+Math.cos(u*Math.PI*3.9+t*2.9+1.7)*11;
        var a=Math.max(0.1,0.4+Math.sin(u*Math.PI*2+t*3.7)*0.3);
        return _tlArc(cx,cy,rx,ry,88,1.6,'255,244,215',a);}}
    ]}
};

var TL_COLORS=['plain','red','blue','gold','jade','purple'];
var TL_MATS=['plain','metallic','glass','varnished'];
var TL_SHEET='Assets/sprites/tiles.png';
// The base grid inside tiles.png: rows 2-7 = colour, cols 0-3 = material.
var TL_SHEET_ROWS=['red','blue','gold','jade','purple','plain'];
var TL_SHEET_COLS=['metallic','glass','varnished','plain'];
var TL_BASES={};       // individual override files: Assets/sprites/tiles/{key}.png
var TL_SHEET_BASES={}; // sliced from the tiles.png base grid

// Per-combo letter colour: '{color}_{material}' → CSS colour for the stamped
// glyphs, for bases too dark for the default letters. Unlisted combos keep the
// original letter colour.
var TL_GLYPH_COLORS={
  red_metallic:'#f2e6cf',
  blue_metallic:'#f2e6cf',
  gold_metallic:'#f2e6cf',
  jade_metallic:'#f2e6cf',
  purple_metallic:'#f2e6cf',
  purple_varnished:'#f2e6cf',
  purple_plain:'#f2e6cf',
  plain_glass:'#ffffff',
  red_glass:'#ffffff',
  blue_glass:'#ffffff',
  gold_glass:'#ffffff',
  jade_glass:'#ffffff',
  purple_glass:'#ffffff'
};

function _tlBase(key){
  var f=TL_BASES[key];if(f&&f.ok)return f;
  var s=TL_SHEET_BASES[key];if(s&&s.ok)return s;
  return null;
}

function tlInit(){
  _tlLoadGlyphs(TL_SHEET,function(r){TL.glyphURL=r.glyphs;TL.letterURL=r.letters;_tlMaybeRender();});
  _tlLoadBases();
  // Fixed light source: overhead-centre, slightly above the viewport.
  var _tlPlaceLight=function(){TL.lx=window.innerWidth/2;TL.ly=-120;};
  _tlPlaceLight();
  window.addEventListener('resize',_tlPlaceLight);
  requestAnimationFrame(_tlLightLoop);
}

function _tlMaybeRender(){
  try{if(typeof S!=='undefined'&&S&&S.hand){renderHand();renderBoard();}}catch(e){}
}

function _tlLoadBases(){
  // Slice the base grid out of the sheet (canvas-taint guarded like the glyphs).
  var img=new Image();
  img.onload=function(){
    try{
      var cell=Math.floor(img.naturalWidth/16);
      for(var r=0;r<TL_SHEET_ROWS.length;r++)for(var c=0;c<TL_SHEET_COLS.length;c++){
        var color=TL_SHEET_ROWS[r],mat=TL_SHEET_COLS[c];
        if(color==='plain'&&mat==='plain')continue; // legacy plain face stays fully baked
        var cv=document.createElement('canvas');cv.width=cell;cv.height=cell;
        cv.getContext('2d').drawImage(img,c*cell,(r+2)*cell,cell,cell,0,0,cell,cell);
        var im2=new Image();im2.src=cv.toDataURL();
        TL_SHEET_BASES[color+'_'+mat]={img:im2,ok:true};
      }
      _tlMaybeRender();
    }catch(e){}
  };
  img.src=TL_SHEET;
  // Individual per-combo files (Assets/sprites/tiles/{key}.png) override sheet cells.
  for(var ci=0;ci<TL_COLORS.length;ci++)for(var mi=0;mi<TL_MATS.length;mi++){
    if(TL_COLORS[ci]==='plain'&&TL_MATS[mi]==='plain')continue;
    (function(key){
      var fimg=new Image();
      var entry={img:fimg,ok:false};
      TL_BASES[key]=entry;
      fimg.onload=function(){entry.ok=true;_tlMaybeRender();};
      fimg.src='Assets/sprites/tiles/'+key+'.png';
    })(TL_COLORS[ci]+'_'+TL_MATS[mi]);
  }
}

// Every frame: layer 1 (resting band) is placed from the tile's position
// relative to the fixed overhead light — tiles still glint as they move.
// The sweep layers run off a single global clock so every material tile
// shimmers top-left → bottom-right together, once per TL_SWEEP_PERIOD; while
// a sweep is crossing, each layer's gradient is REBUILT per frame (s.make) so
// the shapes warp as they travel. Background-position runs 100→0 because
// higher % slides the oversized gradient's window toward its bottom-right,
// moving the band UP-LEFT on screen. Cheap: only material tiles have sheens.
function _tlLightLoop(){
  var sheens=document.getElementsByClassName('tile-sheen');
  if(sheens.length&&TL.lx!==undefined){
    var now=performance.now()/1000;
    var cyc=now%TL_SWEEP_PERIOD;
    for(var i=0;i<sheens.length;i++){
      var el=sheens[i];var r=el.getBoundingClientRect();
      if(!r.width)continue;
      var dx=TL.lx-(r.left+r.width/2),dy=TL.ly-(r.top+r.height/2);
      var p=50-Math.max(-50,Math.min(50,dx/250*50));
      var q=50-Math.max(-50,Math.min(50,dy/250*50));
      var m=TL_MATERIALS[el.dataset.material]||{};
      var pos=p+'% '+q+'%';
      var sweeps=m.sweeps||[];
      var anyActive=false;
      var imgs=[m.grad];
      for(var si=0;si<sweeps.length;si++){
        var s=sweeps[si];
        var su=cyc/(s.dur||TL_SWEEP_DUR);
        var sx=100,sy=100; // parked: band off-window
        if(su<=1){
          anyActive=true;
          var w=s.wob?Math.sin(su*(s.wobFreq||12))*s.wob:0;
          sx=(1-su)*100+w;sy=(1-su)*100-w; // +w/-w = perpendicular to the travel diagonal
          imgs.push(s.make(su,now,i));
        } else {
          imgs.push(s.make(1,now,i));
        }
        pos+=','+sx+'% '+sy+'%';
      }
      // Only churn background-image while a sweep is actually crossing.
      if(anyActive||el.dataset.sweepActive==='1'){
        el.style.backgroundImage=imgs.join(',');
        el.dataset.sweepActive=anyActive?'1':'0';
      }
      el.style.backgroundPosition=pos;
    }
  }
  requestAnimationFrame(_tlLightLoop);
}

function _tlLoadGlyphs(src,cb){
  var img=new Image();
  img.onload=function(){
    // getImageData throws under file:// canvas-taint rules in some browsers;
    // degrade to no glyph re-stamp rather than breaking startup.
    try{cb(_tlExtractGlyphs(img));}catch(e){}
  };
  img.src=src;
}

// Diff the plain rows (0-1) against the blank face cell (col 10, row 1):
// pixels that differ are the letter + score digits. Returns two 16x2-cell
// transparent sheets as data URLs: {glyphs} = letter + score, {letters} =
// letter only (for assigned blanks). The score digit lives right of a fixed
// column — 24/32 of the cell, 21/32 for the wider "10" of Q/Z — and no
// letter shape crosses that line, so a per-cell column cut separates them.
function _tlExtractGlyphs(img){
  var cell=Math.floor(img.naturalWidth/16);
  var w=16*cell,h=2*cell;
  var src=document.createElement('canvas');src.width=w;src.height=h;
  var g=src.getContext('2d');
  g.drawImage(img,0,0,w,h,0,0,w,h);
  var id=g.getImageData(0,0,w,h);
  var out=g.createImageData(w,h);
  var outL=g.createImageData(w,h);
  var bx=10*cell,by=1*cell;
  var d=id.data;
  for(var row=0;row<2;row++)for(var col=0;col<16;col++){
    var li=row*16+col;
    var digitX=cell; // non-letter cells: nothing to strip
    if(li<26){var sc=LS[String.fromCharCode(65+li)]||0;digitX=Math.floor(cell*(sc>=10?21:24)/32);}
    for(var y=0;y<cell;y++)for(var x=0;x<cell;x++){
      var pi=((row*cell+y)*w+(col*cell+x))*4;
      var bi=((by+y)*w+(bx+x))*4;
      if(d[pi+3]<8)continue; // don't stamp invisible pixels
      // Perceptual (premultiplied) distance: exported sheets carry ±1-channel
      // dithering noise on face pixels that exact compare would stamp as junk.
      var pa=d[pi+3]/255,ba=d[bi+3]/255;
      var diff=Math.abs(d[pi]*pa-d[bi]*ba)+Math.abs(d[pi+1]*pa-d[bi+1]*ba)+Math.abs(d[pi+2]*pa-d[bi+2]*ba)+Math.abs(d[pi+3]-d[bi+3]);
      if(diff>48){
        out.data[pi]=d[pi];out.data[pi+1]=d[pi+1];out.data[pi+2]=d[pi+2];out.data[pi+3]=d[pi+3];
        if(x<digitX){
          outL.data[pi]=d[pi];outL.data[pi+1]=d[pi+1];outL.data[pi+2]=d[pi+2];outL.data[pi+3]=d[pi+3];
        }
      }
    }
  }
  var oc=document.createElement('canvas');oc.width=w;oc.height=h;
  oc.getContext('2d').putImageData(out,0,0);
  var lc=document.createElement('canvas');lc.width=w;lc.height=h;
  lc.getContext('2d').putImageData(outL,0,0);
  return {glyphs:oc.toDataURL(),letters:lc.toDataURL()};
}

// Recolour a glyph sheet to a flat tint (alpha preserved). Generated lazily
// per colour and cached; returns null until ready, then re-renders.
TL._tintCache={};
function _tlTintedGlyphs(srcUrl,color,cacheKey){
  var e=TL._tintCache[cacheKey];
  if(e)return e.url;
  e=TL._tintCache[cacheKey]={url:null};
  var img=new Image();
  img.onload=function(){
    var c=document.createElement('canvas');c.width=img.width;c.height=img.height;
    var g=c.getContext('2d');
    g.drawImage(img,0,0);
    g.globalCompositeOperation='source-in';
    g.fillStyle=color;g.fillRect(0,0,c.width,c.height);
    e.url=c.toDataURL();
    _tlMaybeRender();
  };
  img.src=srcUrl;
  return null;
}

// Same cell math as tileSpr, but on the 16x2 glyph sheet (plain rows only).
function _tlGlyphCss(letter,sz,url){
  var col,row;
  if(!letter){col=10;row=1;}
  else{
    var li=letter.charCodeAt(0)-65;
    if(li<0||li>25){col=10;row=1;}
    else{col=li<16?li:li-16;row=li>=16?1:0;}
  }
  return 'background-image:url('+url+');background-size:'+(16*sz)+'px '+(2*sz)+'px;background-position:-'+(col*sz)+'px -'+(row*sz)+'px;background-repeat:no-repeat;image-rendering:pixelated;';
}

// Compose the layered face for a material/colored tile. sprCss is the face's
// tileSpr string (used as the sheen mask when no base image exists yet).
// Call after the face's cssText/dataset are set; no-op for legacy tiles.
function applyTileLayers(face,t,sz,sprCss){
  if(!t)return;
  var key=(t.variant||'plain')+'_'+(t.material||'plain');
  var base=_tlBase(key);
  if(!base&&!t.material)return; // legacy baked tile, nothing to do
  var box='position:absolute;left:0;top:0;width:'+sz+'px;height:'+sz+'px;pointer-events:none;image-rendering:pixelated;';
  if(base){
    // Swap the face background to the hand-drawn base. Glass bases have
    // transparent middles — whatever is behind the tile shows through, so kill
    // the var-* background-color classes too.
    face.classList.remove('var-red','var-blue','var-gold');
    var baseCss='background-image:url('+base.img.src+');background-size:'+sz+'px '+sz+'px;background-position:0 0;background-repeat:no-repeat;image-rendering:pixelated;';
    face.style.cssText+=baseCss;
    face.dataset.spr=baseCss; // drag proxies rebuild their look from this
  }
  // Sheen goes on BEFORE the glyph so light passes behind the letters.
  if(t.material&&TL_MATERIALS[t.material]){
    var m=TL_MATERIALS[t.material];
    // Mask the sheen with the full tile SILHOUETTE (plain blank face), not the
    // base's own alpha — glass middles are transparent but must still catch light.
    var silCss=tileSpr(null,true,null,sz);
    var mask=silCss.replace(/background-/g,'-webkit-mask-')+silCss.replace(/background-/g,'mask-');
    face.style.isolation='isolate'; // keep the sheen blend from sampling the board behind the tile
    var sh=document.createElement('div');
    sh.className='tile-sheen';
    sh.dataset.material=t.material;
    // Oversized layers: resting band (fixed-light) + the material's sweep
    // layers. _tlLightLoop drives all via comma-separated background-position.
    var imgs=[m.grad],sizes=['260% 260%'],poss=['50% 50%'],reps=['no-repeat'];
    for(var si=0;si<(m.sweeps||[]).length;si++){
      imgs.push(m.sweeps[si].make(1,0,0));sizes.push('300% 300%');poss.push('100% 100%');reps.push('no-repeat');
    }
    sh.style.cssText=box+'background-image:'+imgs.join(',')+';background-size:'+sizes.join(',')+';background-position:'+poss.join(',')+';background-repeat:'+reps.join(',')+';mix-blend-mode:screen;'+mask;
    face.appendChild(sh);
  }
  if(base){
    // Assigned blanks get the letter-only sheet (no score digit); unassigned
    // blanks keep the empty base face.
    var glyphLetter=t.isBlank?(t.blankAs||null):t.letter;
    var glyphURL=t.isBlank?(t.blankAs?TL.letterURL:null):TL.glyphURL;
    var tint=TL_GLYPH_COLORS[key];
    if(glyphURL&&tint)glyphURL=_tlTintedGlyphs(glyphURL,tint,(t.isBlank?'l|':'t|')+tint)||glyphURL;
    if(glyphURL){
      var gl=document.createElement('div');
      gl.className='tile-glyph';
      gl.style.cssText=box+_tlGlyphCss(glyphLetter,sz,glyphURL);
      face.appendChild(gl);
    }
  }
}

// ---------------------------------------------------------------------
// Dev helpers (console): devMaterial('glass') — first hand tile;
// devMaterial('metallic',3) — 4th tile; devMaterial(null,0) — clear.
// devMaterialHand('varnished') — whole rack.
// ---------------------------------------------------------------------
function devMaterial(mat,idx){
  var t=S.hand[idx||0];if(!t){toast('No tile at '+(idx||0));return;}
  t.material=mat||null;renderHand();
}
function devMaterialHand(mat){
  for(var i=0;i<S.hand.length;i++)if(S.hand[i])S.hand[i].material=mat||null;
  renderHand();
}
