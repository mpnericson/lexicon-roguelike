// =====================================================================
// PHYSICS — spring physics hand / sticker placement system
// Box is (n + 4/3) * TILE_W wide, centred. Tiles spring to rest
// positions within the box. Repulsion opens gap when dragging.
// =====================================================================
var HP = {
  tiles: [], x: [], vx: [], held: -1,
  TILE_W: 68, GAP: 0,
  DAMP: 0.55, SPRING: 0.14,
  RAF: null, aL: 0, aR: 0, left: 0,
  fromX: [], toX: [], settleAt: 0, settleDur: 150
};

function hpBounds() {
  var r = document.getElementById('hand-area').getBoundingClientRect();
  var n = HP.tiles.length || 7;
  var boxW = (n + 2.5) * HP.TILE_W;
  var cx = (r.left + r.right) / 2;
  HP.left = r.left;
  HP.aL = cx - boxW / 2;
  HP.aR = cx + boxW / 2;
}

function hpRest(n) {
  var tw = n * HP.TILE_W + (n - 1) * HP.GAP;
  var cx = (HP.aL + HP.aR) / 2;
  var r = [];
  for (var i = 0; i < n; i++)r.push(cx - tw / 2 + i * (HP.TILE_W + HP.GAP) + HP.TILE_W / 2);
  return r;
}

function hpRebuild(vis) {
  hpBounds();
  var n = vis.length;
  HP.tiles = vis.slice();
  if (HP.x.length !== n) { HP.x = hpRest(n); HP.vx = Array(n).fill(0); HP.fromX = []; HP.toX = []; HP.settleAt = 0; }
}

function hpStep() {
  var now = performance.now();
  if (HP.settleAt > 0) {
    var t = Math.min(1, (now - HP.settleAt) / HP.settleDur);
    var ease = 1 - Math.pow(1 - t, 3);
    for (var i = 0; i < HP.tiles.length; i++)
      if (HP.fromX[i] !== undefined && HP.toX[i] !== undefined)
        HP.x[i] = HP.fromX[i] + (HP.toX[i] - HP.fromX[i]) * ease;
    if (t >= 1) HP.settleAt = 0;
    hpDraw(); HP.RAF = requestAnimationFrame(hpStep); return;
  }
  var n = HP.tiles.length;
  hpBounds();
  var dragVi = activeDrag && activeDrag.src === 'hand' ? activeDrag.vi : -1;
  var dragOverHand = dragVi >= 0 && activeDrag && inHand(activeDrag.cx, activeDrag.cy || 0);
  var prevX = HP.x.slice();
  var active = [];
  for (var i = 0; i < n; i++)if (i !== dragVi) active.push(i);
  var restX = {};
  var midX = (HP.aL + HP.aR) / 2;
  if (dragOverHand && dragVi >= 0 && activeDrag) {
    var insertIdx = 0;
    for (var j = 0; j < active.length; j++) { if (activeDrag.cx > HP.x[active[j]]) insertIdx = j + 1; }
    var totalW = (active.length + 1) * HP.TILE_W + active.length * HP.GAP;
    var startX = midX - totalW / 2; var col = 0;
    for (var j = 0; j < active.length; j++) {
      if (j === insertIdx) col++;
      restX[active[j]] = startX + col * (HP.TILE_W + HP.GAP) + HP.TILE_W / 2; col++;
    }
  } else {
    var totalW = active.length * HP.TILE_W + (active.length > 1 ? (active.length - 1) * HP.GAP : 0);
    var startX = midX - totalW / 2;
    for (var j = 0; j < active.length; j++)restX[active[j]] = startX + j * (HP.TILE_W + HP.GAP) + HP.TILE_W / 2;
  }
  for (var i = 0; i < n; i++) {
    if (i === dragVi) continue;
    var f = (restX[i] - HP.x[i]) * HP.SPRING;
    if (HP.held >= 0 && HP.held !== i) {
      var hx = HP.x[HP.held], d = HP.x[i] - hx, dist = Math.abs(d);
      if (dist < HP.TILE_W * 1.5) f += (d > 0 ? 1 : -1) * (1 - dist / (HP.TILE_W * 1.5)) * 5;
    }
    HP.vx[i] = (HP.vx[i] + f) * HP.DAMP;
    HP.x[i] += HP.vx[i];
  }
  var minSep = HP.TILE_W + HP.GAP;
  var leftWall = HP.aL + HP.TILE_W / 2;
  var rightWall = HP.aR - HP.TILE_W / 2;
  var sorted = active.slice().sort(function (a, b) { return HP.x[a] - HP.x[b]; });
  for (var iter = 0; iter < 3; iter++) {
    for (var k = 1; k < sorted.length; k++) {
      var ov = minSep - (HP.x[sorted[k]] - HP.x[sorted[k - 1]]);
      if (ov > 0) { HP.x[sorted[k - 1]] -= ov / 2; HP.x[sorted[k]] += ov / 2; }
    }
  }
  if (sorted.length && HP.x[sorted[sorted.length - 1]] > rightWall) {
    HP.x[sorted[sorted.length - 1]] = rightWall;
    for (var k = sorted.length - 2; k >= 0; k--)
      if (HP.x[sorted[k + 1]] - HP.x[sorted[k]] < minSep)
        HP.x[sorted[k]] = HP.x[sorted[k + 1]] - minSep;
  }
  if (sorted.length && HP.x[sorted[0]] < leftWall) {
    HP.x[sorted[0]] = leftWall;
    for (var k = 1; k < sorted.length; k++)
      if (HP.x[sorted[k]] - HP.x[sorted[k - 1]] < minSep)
        HP.x[sorted[k]] = HP.x[sorted[k - 1]] + minSep;
  }
  var changed = false;
  for (var i = 0; i < n; i++) {
    if (i === dragVi) continue;
    HP.vx[i] = HP.x[i] - prevX[i];
    if (Math.abs(HP.vx[i]) > 0.02) changed = true;
  }
  if (changed || dragVi >= 0 || HP.held >= 0) hpDraw();
  HP.RAF = requestAnimationFrame(hpStep);
}

function hpDraw() {
  var area = document.getElementById('hand-area');
  var els = area.querySelectorAll('.hand-tile');
  for (var i = 0; i < HP.tiles.length; i++) {
    var el = els[i]; if (!el) continue;
    var isDrag = activeDrag && activeDrag.src === 'hand' && activeDrag.vi === i;
    if (isDrag) { el.style.opacity = '0'; continue; }
    el.style.opacity = '1';
    el.style.left = (HP.x[i] - HP.TILE_W / 2 - HP.left) + 'px';
  }
}
