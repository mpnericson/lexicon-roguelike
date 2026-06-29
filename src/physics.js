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
    settleCallback: null
  };

  ph.bounds = function() {
    var el = document.getElementById(_areaId); if (!el) return;
    var r = el.getBoundingClientRect();
    var n = ph.tiles.length || 7;
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
    ph.tiles = vis.slice();
    if (ph.x.length !== n) { ph.x = ph.rest(n); ph.vx = Array(n).fill(0); ph.fromX = []; ph.toX = []; ph.settleAt = 0; }
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
    var dragVi = activeDrag && activeDrag.src === _dragSrc ? activeDrag.vi : -1;
    var dragOverArea = dragVi >= 0 && activeDrag && ph.inArea(activeDrag.cx, activeDrag.cy || 0);
    var prevX = ph.x.slice();
    var active = [];
    for (var i = 0; i < n; i++) if (i !== dragVi) active.push(i);
    var restX = {};
    var midX = (ph.aL + ph.aR) / 2;
    if (dragOverArea && dragVi >= 0 && activeDrag) {
      var insertIdx = 0;
      for (var j = 0; j < active.length; j++) { if (activeDrag.cx > ph.x[active[j]]) insertIdx = j + 1; }
      var totalW = (active.length + 1) * ph.TILE_W + active.length * ph.GAP;
      var startX = midX - totalW / 2; var col = 0;
      for (var j = 0; j < active.length; j++) {
        if (j === insertIdx) col++;
        restX[active[j]] = startX + col * (ph.TILE_W + ph.GAP) + ph.TILE_W / 2; col++;
      }
    } else {
      var totalW = active.length * ph.TILE_W + (active.length > 1 ? (active.length - 1) * ph.GAP : 0);
      var startX = midX - totalW / 2;
      for (var j = 0; j < active.length; j++) restX[active[j]] = startX + j * (ph.TILE_W + ph.GAP) + ph.TILE_W / 2;
    }
    for (var i = 0; i < n; i++) {
      if (i === dragVi) continue;
      var f = (restX[i] - ph.x[i]) * ph.SPRING;
      if (ph.held >= 0 && ph.held !== i) {
        var hx = ph.x[ph.held], d = ph.x[i] - hx, dist = Math.abs(d);
        if (dist < ph.TILE_W * 1.5) f += (d > 0 ? 1 : -1) * (1 - dist / (ph.TILE_W * 1.5)) * 5;
      }
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
      if (i === dragVi) continue;
      ph.vx[i] = ph.x[i] - prevX[i];
      if (Math.abs(ph.vx[i]) > 0.02) changed = true;
    }
    if (changed || dragVi >= 0 || ph.held >= 0) ph.draw();
    ph.RAF = requestAnimationFrame(function() { ph.step(); });
  };

  ph.draw = function() {
    var area = document.getElementById(_areaId); if (!area) return;
    var els = area.querySelectorAll('.' + _tileClass);
    for (var i = 0; i < ph.tiles.length; i++) {
      var el = els[i]; if (!el) continue;
      var isDrag = activeDrag && activeDrag.src === _dragSrc && activeDrag.vi === i;
      if (isDrag) { el.style.opacity = '0'; continue; }
      el.style.opacity = '1';
      el.style.left = (ph.x[i] - ph.TILE_W / 2 - ph.left) + 'px';
    }
  };

  return ph;
}

var HP = makePhysics({ areaId: 'hand-area', tileClass: 'hand-tile', dragSrc: 'hand' });
var SP = makePhysics({ areaId: 'tile-sticker-bar', tileClass: 'sticker-tile', dragSrc: 'sticker' });
var SSP = makePhysics({ areaId: 'shop-sticker-bar', tileClass: 'sticker-tile', dragSrc: 'shop-sticker', tileW: 111 });

// Backward-compat wrappers so existing callers in drag.js / render.js / init.js keep working.
function hpBounds() { HP.bounds(); }
function hpRest(n) { return HP.rest(n); }
function hpRebuild(vis) { HP.rebuild(vis); }
function hpStep() { HP.step(); }
function hpDraw() { HP.draw(); }
