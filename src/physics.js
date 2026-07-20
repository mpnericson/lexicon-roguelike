// =====================================================================
// PHYSICS — spring-physics factory for tile bars
// makePhysics(opts) returns an independent physics instance.
// opts: { areaId, tileClass, dragSrc }
// =====================================================================
function makePhysics(opts) {
  var _areaId = opts.areaId;
  var _tileClass = opts.tileClass;
  var _dragSrc = opts.dragSrc;

  var ph = {
    tiles: [], x: [], vx: [], held: -1,
    TILE_W: opts.tileW || 68, GAP: 0,
    DAMP: 0.55, SPRING: 0.14,
    RAF: null, aL: 0, aR: 0, left: 0,
    fromX: [], toX: [], settleAt: 0, settleDur: 150,
    settleCallback: null,
    movingCount: 0,  // tiles in 'moving' state heading back to hand (phantom slots)
    gapHoleIdx: null, gapHoleX: null,  // open drag gap: insert index + hole centre x (null when closed)
    shufHoleIdx: null  // reserved empty slot for the in-flight shuffle tile (null when idle)
  };

  ph.bounds = function() {
    var el = document.getElementById(_areaId); if (!el) return;
    var r = el.getBoundingClientRect();
    // Include moving (in-flight) tiles so bounds stay wide enough for all phantom slots.
    var n = Math.max(ph.tiles.length + ph.movingCount, ph.tiles.length || 7);
    var boxW = (n + 2.5) * ph.TILE_W;
    var cx = (r.left + r.right) / 2;
    ph.left = r.left;
    ph.aL = cx - boxW / 2;
    ph.aR = cx + boxW / 2;
  };

  ph.rest = function(n) {
    var tw = n * ph.TILE_W + (n - 1) * ph.GAP;
    var cx = (ph.aL + ph.aR) / 2;
    var r = [];
    for (var i = 0; i < n; i++) r.push(cx - tw / 2 + i * (ph.TILE_W + ph.GAP) + ph.TILE_W / 2);
    return r;
  };

  ph.rebuild = function(vis) {
    ph.bounds();
    var n = vis.length;
    if (ph.x.length !== n) {
      // Remap positions by item ID so tiles don't snap when count changes.
      // Works for both hand-tile vis entries ({t,oi}) and raw stamp items ({id,...}).
      var old = {};
      for (var i = 0; i < ph.tiles.length; i++) {
        var it = ph.tiles[i]; var tid = (it.t && it.t.id) || it.id || null;
        if (tid) old[tid] = { x: ph.x[i] || 0, vx: ph.vx[i] || 0 };
      }
      var rest = ph.rest(n);
      ph.x = []; ph.vx = [];
      for (var i = 0; i < n; i++) {
        var it = vis[i]; var tid = (it.t && it.t.id) || it.id || null;
        var d = tid ? old[tid] : null;
        if (d) { ph.x.push(d.x); ph.vx.push(d.vx); }
        else { ph.x.push(rest[i]); ph.vx.push(0); }
      }
      ph.fromX = []; ph.toX = []; ph.settleAt = 0; ph.settleCallback = null;
    }
    ph.tiles = vis.slice();
  };

  ph.inArea = function(x, y) {
    var el = document.getElementById(_areaId); if (!el) return false;
    var r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top - 20 && y <= r.bottom + 20;
  };

  ph.step = function() {
    var now = performance.now();
    if (ph.settleAt > 0) {
      var t = Math.min(1, (now - ph.settleAt) / ph.settleDur);
      var ease = 1 - Math.pow(1 - t, 3);
      for (var i = 0; i < ph.tiles.length; i++)
        if (ph.fromX[i] !== undefined && ph.toX[i] !== undefined)
          ph.x[i] = ph.fromX[i] + (ph.toX[i] - ph.fromX[i]) * ease;
      if (t >= 1) { ph.settleAt = 0; var _scb = ph.settleCallback; ph.settleCallback = null; if (_scb) _scb(); }
      ph.draw(); ph.RAF = requestAnimationFrame(function() { ph.step(); }); return;
    }
    var n = ph.tiles.length;
    ph.bounds();
    // Detached drags: the dragged elements live on document.body, so this bar's
    // physics only sees the remaining tiles plus activeDrag.cx. Hand multi-drag and
    // board-tile drags target the hand bar; stamp/sticker drags tag the bar they
    // came from via activeDrag.barSrc.
    var isDetached = activeDrag && (((activeDrag.src === 'multi-hand' || activeDrag.src === 'board') && _dragSrc === 'hand') || activeDrag.barSrc === _dragSrc);
    var multiCount = isDetached ? (activeDrag.multiCount || 1) : 0;
    // Expand layout bounds so the drag gap doesn't get wall-clamped.
    if (isDetached && multiCount > 0) {
      var _gapExtra = (multiCount + 0.5) * (ph.TILE_W + ph.GAP) / 2;
      ph.aL -= _gapExtra; ph.aR += _gapExtra;
    }
    var dragOverArea = isDetached && ph.inArea(activeDrag.cx || 0, activeDrag.cy || 0);
    var prevX = ph.x.slice();
    var active = [];
    for (var i = 0; i < n; i++) active.push(i);
    var restX = {};
    var midX = (ph.aL + ph.aR) / 2;
    if (dragOverArea && activeDrag) {
      var insertIdx = 0;
      if (activeDrag.funnelInsertIdx !== undefined) {
        // Funnel mode: insertIdx locked at threshold crossing — skip direction-aware detection
        // so the gap always opens at exactly the committed slot regardless of _prevGapRef state.
        insertIdx = activeDrag.funnelInsertIdx;
      } else {
        // Unified gap trigger for single and multi drag.
        // The hand tile switches sides when the leading edge of the dragged group has gone
        // halfway through its hitbox (TILE_W/2 past its centre).
        // Moving right → leading edge is the right side of gapRight; moving left → left side of gapLeft.
        var _grL = activeDrag.gapLeft !== undefined ? activeDrag.gapLeft : (activeDrag.cx || 0);
        var _grR = activeDrag.gapRight !== undefined ? activeDrag.gapRight : (activeDrag.cx || 0);
        var _prevGR = activeDrag._prevGapRef;
        activeDrag._prevGapRef = _grR;
        var _movingRight = _prevGR === undefined || _grR >= _prevGR;
        var _ref = _movingRight ? _grR + ph.TILE_W / 2 : _grL - ph.TILE_W / 2;
        for (var j = 0; j < active.length; j++) { if (_ref > ph.x[active[j]]) insertIdx = j + 1; }
      }
      // Gap sizes: n+0.5 for all detached drags (single tile/stamp = multiCount 1 → 1.5).
      var gapCount = multiCount + 0.5;
      var totalW = (active.length + gapCount) * ph.TILE_W + (active.length + gapCount - 1) * ph.GAP;
      var startX = midX - totalW / 2; var col = 0;
      for (var j = 0; j < active.length; j++) {
        if (j === insertIdx) col += gapCount;
        restX[active[j]] = startX + col * (ph.TILE_W + ph.GAP) + ph.TILE_W / 2; col++;
      }
      // Expose the visual centre of the anchor tile's position inside the gap.
      // Gap is gapCount wide; tiles centred inside it means anchor is at column + 0.75, not +0.5.
      if (activeDrag.src === 'multi-hand') {
        var _anchorSlot = insertIdx + (activeDrag.dragIdx !== undefined ? activeDrag.dragIdx : 0);
        ph.gapCenterX = startX + (_anchorSlot + 0.75) * ph.TILE_W;
      }
      // Hole geometry: stamp drags commit to gapHoleIdx on drop
      // (drag.js attachStampDrag) so the insert always matches the open gap.
      ph.gapHoleIdx = insertIdx;
      ph.gapHoleX = startX + insertIdx * (ph.TILE_W + ph.GAP) + gapCount * (ph.TILE_W + ph.GAP) / 2;
    } else {
      ph.gapHoleIdx = null; ph.gapHoleX = null;
      // Phantom slots: reserve space on the right for tiles in 'moving' state.
      // Total slot count = real tiles + moving tiles; real tiles occupy leftmost slots.
      // Shuffle hole: one extra empty slot at shufHoleIdx (the in-flight shuffle
      // tile's landing spot) — tiles at/after it sit one slot to the right, so
      // lifting a tile out never re-centers the rack; only the tiles between its
      // old and new slot slide over to make room.
      var _hole = ph.shufHoleIdx != null ? ph.shufHoleIdx : -1;
      var _nSlots = active.length + (_hole >= 0 ? 1 : 0) + (ph.movingCount > 0 ? ph.movingCount : 0);
      var totalW = _nSlots > 0 ? _nSlots * ph.TILE_W + (_nSlots > 1 ? (_nSlots - 1) * ph.GAP : 0) : 0;
      var startX = midX - totalW / 2;
      for (var j = 0; j < active.length; j++) {
        var _col = (_hole >= 0 && j >= _hole) ? j + 1 : j;
        restX[active[j]] = startX + _col * (ph.TILE_W + ph.GAP) + ph.TILE_W / 2;
      }
    }
    for (var i = 0; i < n; i++) {
      var f = (restX[i] - ph.x[i]) * ph.SPRING;
      ph.vx[i] = (ph.vx[i] + f) * ph.DAMP;
      ph.x[i] += ph.vx[i];
    }
    var minSep = ph.TILE_W + ph.GAP;
    var leftWall = ph.aL + ph.TILE_W / 2;
    var rightWall = ph.aR - ph.TILE_W / 2;
    var sorted = active.slice().sort(function(a, b) { return ph.x[a] - ph.x[b]; });
    for (var iter = 0; iter < 3; iter++) {
      for (var k = 1; k < sorted.length; k++) {
        var ov = minSep - (ph.x[sorted[k]] - ph.x[sorted[k - 1]]);
        if (ov > 0) { ph.x[sorted[k - 1]] -= ov / 2; ph.x[sorted[k]] += ov / 2; }
      }
    }
    if (sorted.length && ph.x[sorted[sorted.length - 1]] > rightWall) {
      ph.x[sorted[sorted.length - 1]] = rightWall;
      for (var k = sorted.length - 2; k >= 0; k--)
        if (ph.x[sorted[k + 1]] - ph.x[sorted[k]] < minSep)
          ph.x[sorted[k]] = ph.x[sorted[k + 1]] - minSep;
    }
    if (sorted.length && ph.x[sorted[0]] < leftWall) {
      ph.x[sorted[0]] = leftWall;
      for (var k = 1; k < sorted.length; k++)
        if (ph.x[sorted[k]] - ph.x[sorted[k - 1]] < minSep)
          ph.x[sorted[k]] = ph.x[sorted[k - 1]] + minSep;
    }
    var changed = false;
    for (var i = 0; i < n; i++) {
      ph.vx[i] = ph.x[i] - prevX[i];
      if (Math.abs(ph.vx[i]) > 0.02) changed = true;
    }
    if (changed || isDetached || ph.held >= 0) ph.draw();
    ph.RAF = requestAnimationFrame(function() { ph.step(); });
  };

  ph.draw = function() {
    var area = document.getElementById(_areaId); if (!area) return;
    var els = area.querySelectorAll('.' + _tileClass);
    for (var i = 0; i < ph.tiles.length; i++) {
      var el = els[i]; if (!el) continue;
      el.style.left = (ph.x[i] - ph.TILE_W / 2 - ph.left) + 'px';
    }
  };

  // Returns the x-centre of the next available phantom slot — the first slot to the right
  // of all currently in-hand tiles, within the total (hand + moving) layout.
  // Call BEFORE setTileState('hand') and HP.x.push so counts are still accurate.
  ph.nextLandX = function() {
    ph.bounds();
    var n = ph.x.length;
    var m = ph.movingCount > 0 ? ph.movingCount : 0;
    var total = n + m;
    if (!total) return (ph.aL + ph.aR) / 2;
    var tw = total * ph.TILE_W + (total > 1 ? (total - 1) * ph.GAP : 0);
    return (ph.aL + ph.aR) / 2 - tw / 2 + n * (ph.TILE_W + ph.GAP) + ph.TILE_W / 2;
  };

  return ph;
}

var HP = makePhysics({ areaId: 'hand-area', tileClass: 'hand-tile', dragSrc: 'hand' });
var SP = makePhysics({ areaId: 'stamp-bar', tileClass: 'stamp-tile', dragSrc: 'stamp' });
var SSP = makePhysics({ areaId: 'shop-stamp-bar', tileClass: 'stamp-tile', dragSrc: 'shop-stamp', tileW: 111 });

// Backward-compat wrappers so existing callers in drag.js / render.js / init.js keep working.
function hpBounds() { HP.bounds(); }
function hpRest(n) { return HP.rest(n); }
function hpRebuild(vis) { HP.rebuild(vis); }
function hpStep() { HP.step(); }
function hpDraw() { HP.draw(); }
