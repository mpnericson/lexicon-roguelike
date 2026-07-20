// =====================================================================
// FOCUS MODE — "billiards in space" physics playground for the rack.
// Toggled by the eye button. Fades all peripheral UI + board stickers,
// leaving just the bare board grid, floating tiles, and the eye.
//
// The hand tiles are "released" as free bodies: they drift, collide with
// each other and the screen edges like billiard balls, and a gentle
// updraft in a center band (over the board) shoves them off toward the
// sides. Drag a tile to fling it — it keeps its velocity on release
// (cue-ball). Floating tiles stay in S.hand (state 'hand'); dropping one
// on the board goes through placeTile (incl. Jenga stacking), and is-new
// board tiles can be picked back up into the sim (attachFocusBoardDrag).
//
// >>> ALL FEEL KNOBS ARE THE CAPITALIZED CONSTANTS BELOW <<<
// =====================================================================
var FOCUS = {
  active: false,
  bodies: [],
  ov: null,
  raf: null,
  drag: null,
  W: 0, H: 0, cx: 0,
  bandL: 0, bandR: 0,
  // Exit choreography: the sim keeps running in slow-mo (tiles "hang") while
  // the board shrinks and the eye slides home; `timeScale` scales the idle
  // clock so bob/wander crawl, `exiting` swaps in heavy velocity damping.
  exiting: false, timeScale: 1, clock: 0, _lastNow: 0,

  // ---- FEEL KNOBS ------------------------------------------------------
  HALF: 34,        // collider half-extent (tile is 68px square)
  CORNER: 14,      // corner radius of the rounded-square collider
  DAMP: 0.985,     // per-frame velocity retention. lower = settles sooner,
                   //   higher = floatier. ~0.98–0.99 = "spacy, not perpetual".
  UPDRAFT: 0.045,  // sideways push (px/frame^2) while over the board band.
                   //   gentle: a tile oozes clear but can't coast to the wall.
  WALL_REST: 0.8,  // energy kept on a screen-edge bounce (hard bounce ~0.8).
  TILE_REST: 0.9,  // energy kept on a tile↔tile bounce.
  BAND_PAD: 44,    // how far past the board edges the updraft reaches.
  MAX_SPEED: 46,   // clamp so a hard fling can't teleport a tile.
  KICK: 1.6,       // random launch speed when tiles are first released.
  ZOOM_PAD: 12,    // vertical margin above/below the zoomed board.
  WANDER: 0.002,   // tiny perpetual drift force — keeps tiles milling so
                   //   they never dead-stop and cluster in the corners.
  UPRIGHT: 0.004,  // per-frame pull of rotation back to 0 when idle (slow).
  GRAB_UPRIGHT: 0.16, // roll-to-upright rate while held (fast, ~0.3s).
  BOB_AMP: 7,      // idle float bob, px (mirrors the bag-modal bfloat).
  CLICK_DIST: 6,   // pointer travel under this = click (toggles pin), over = drag.
  CHASE: 30,       // top speed (px/frame) of a held tile chasing the pointer.
  CHASE_ACCEL: 1.4,// px/frame^2 — the chase accelerates from 0, and resets to 0
                   //   whenever its route changes direction (each leg of a path
                   //   around pins is a straight line driven from standstill).
  EXIT_SLOWMO: 0.12,// idle-clock time scale during the exit "hang" — bob and
                    //   wander crawl to a near-freeze while the board shrinks.
  EXIT_DAMP: 0.82, // per-frame velocity damping while exiting, so free-drifting
                   //   tiles bleed off speed and hang in place before arcing home.
  EXIT_SHRINK_MS: 200, // brief hang before the UI snaps back + tiles arc home —
                       //   short on purpose ("rude awakening", not a graceful fade).
  EXIT_ARC_MS: 760,    // per-tile spiral-arc sweep duration (shortened from the
                       //   1100ms default) — still loops round, just quicker.
  EXIT_ARC_HOLD: 110,  // short pre-launch hold before the first tile takes off
                       //   (vs the ~650ms recall default), so the snap comes fast.
  EXIT_ARC_STAGGER: 55,// ms between successive tiles launching, left→right.

  // Focus-button (eye) sprite frames — open: 1 idle / 2 hover / 3 pressed;
  // 4-6 closing animation; closed: 7 hover / 8 pressed / 9 idle.
  BTN: {
    CLOSE: [4, 5, 6, 9], OPEN: [6, 5, 4, 1],
    IDLE_OPEN: 1, HOVER_OPEN: 2, PRESS_OPEN: 3,
    IDLE_CLOSED: 9, HOVER_CLOSED: 7, PRESS_CLOSED: 8,
    FRAME_MS: 70
  }
  // ---------------------------------------------------------------------
};

var _fbAnimating = false;
function _fbFrame(n) {
  var el = document.getElementById('focus-btn-sprite');
  if (el) el.src = 'Assets/animations/focus mode button/focus_mode_button' + n + '.png';
}
function _fbPlay(frames) {
  _fbAnimating = true;
  var i = 0;
  (function step() {
    if (i >= frames.length) { _fbAnimating = false; return; }
    _fbFrame(frames[i++]);
    setTimeout(step, FOCUS.BTN.FRAME_MS);
  })();
}

// Zoom the board to fill the screen vertically, centered. Uses a transform
// (transitioned via #board-wrap CSS) so layout never reflows; passing false
// clears it and the board glides back to its layout position.
function _focusZoom(on) {
  var bw = document.getElementById('board-wrap');
  if (!bw) return;
  if (!on) { bw.style.transform = ''; return; }
  // Rect is untransformed here (transform only ever set while zoomed).
  var r = bw.getBoundingClientRect();
  var s = (window.innerHeight - FOCUS.ZOOM_PAD * 2) / r.height;
  var tx = window.innerWidth / 2 - (r.left + r.width / 2);
  var ty = window.innerHeight / 2 - (r.top + r.height / 2);
  bw.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
  // Aim the updraft band at the board's final zoomed footprint right away —
  // don't wait out the transition reading mid-animation rects.
  var half = r.width * s / 2;
  FOCUS.bandL = window.innerWidth / 2 - half - FOCUS.BAND_PAD;
  FOCUS.bandR = window.innerWidth / 2 + half + FOCUS.BAND_PAD;
}

function _focusBounds() {
  FOCUS.W = window.innerWidth;
  FOCUS.H = window.innerHeight;
  FOCUS.cx = FOCUS.W / 2;
  var bw = document.getElementById('board-wrap');
  if (bw) {
    var r = bw.getBoundingClientRect();
    FOCUS.bandL = r.left - FOCUS.BAND_PAD;
    FOCUS.bandR = r.right + FOCUS.BAND_PAD;
  } else {
    FOCUS.bandL = FOCUS.W * 0.32;
    FOCUS.bandR = FOCUS.W * 0.68;
  }
}

function _focusDraw(b) {
  // Idle float: visual-only bob + wobble on top of the physics position,
  // like the bag modal's bfloat keyframes. Suppressed while held.
  var by = 0, br = 0;
  if (!(FOCUS.drag && FOCUS.drag.body === b) && !b.pinned) {
    // Slow-scaled clock (see FOCUS.timeScale) so the bob crawls during exit.
    var now = FOCUS.clock;
    by = Math.sin(now * b.bw + b.bp) * FOCUS.BOB_AMP * b.bamp;
    br = Math.sin(now * b.bw * 0.7 + b.bp * 1.3) * 1.2;
  }
  b.el.style.transform = 'translate(' + (b.x - 34) + 'px,' + (b.y - 34 + by) + 'px) rotate(' + (b.rot + br) + 'deg)';
}

// Rounded-square overlap test (a → c). Minkowski trick: shrink each square
// to its "core" (HALF - CORNER); tiles collide when the core gap is under
// 2×CORNER. Flat sides meet flush; corners contact like circle arcs.
// Returns {nx, ny, ov} (normal pointing a→c, penetration depth) or null.
function _focusHit(a, c) {
  var K = FOCUS, CORE = K.HALF - K.CORNER, RR = K.CORNER * 2;
  var ddx = c.x - a.x, ddy = c.y - a.y;
  var adx = Math.abs(ddx), ady = Math.abs(ddy);
  if (adx >= K.HALF * 2 || ady >= K.HALF * 2) return null;
  var gx = adx - CORE * 2, gy = ady - CORE * 2; // gaps between cores
  if (gx > 0 && gy > 0) {
    // corner-corner: behaves like two circles of radius CORNER
    var d = Math.sqrt(gx * gx + gy * gy);
    if (d >= RR) return null;
    return { nx: (ddx < 0 ? -gx : gx) / d, ny: (ddy < 0 ? -gy : gy) / d, ov: RR - d };
  }
  // face contact (cores overlap on an axis): resolve along least penetration
  var px = K.HALF * 2 - adx, py = K.HALF * 2 - ady;
  if (px < py) return { nx: ddx < 0 ? -1 : 1, ny: 0, ov: px };
  return { nx: 0, ny: ddy < 0 ? -1 : 1, ov: py };
}

// Collide-and-slide: walk the dragged body toward (tx,ty) in fine sub-steps,
// pushing out of pinned tiles and cancelling motion into their surfaces.
// Routing AROUND pins is handled by _focusRoute — this is only the local
// contact solver. Speed is capped at CHASE px per call unless `uncapped`
// (glued 1:1 drag), so autonomous catch-up is a glide, never a teleport.
function _focusSlideTo(b, tx, ty, uncapped) {
  var K = FOCUS;
  var sx = tx - b.x, sy = ty - b.y;
  var dist = Math.hypot(sx, sy);
  if (dist < 0.01) return;
  var move = uncapped ? dist : Math.min(dist, K.CHASE);
  var steps = Math.max(1, Math.ceil(move / K.CORNER));
  sx *= move / dist / steps; sy *= move / dist / steps;
  for (var s = 0; s < steps; s++) {
    b.x += sx; b.y += sy;
    for (var q = 0; q < K.bodies.length; q++) {
      var p = K.bodies[q];
      if (!p.pinned || p === b) continue;
      var h = _focusHit(b, p);
      if (!h) continue;
      b.x -= h.nx * h.ov; b.y -= h.ny * h.ov;
      var into = sx * h.nx + sy * h.ny;
      if (into > 0) { sx -= h.nx * into; sy -= h.ny * into; }
    }
  }
}

// Segment vs axis-aligned box (centre cx,cy, half-extent E) — slab test.
function _focusSegBox(x1, y1, x2, y2, cx, cy, E) {
  var tmin = 0, tmax = 1, d, t1, t2, tt;
  d = x2 - x1;
  if (Math.abs(d) < 1e-9) { if (Math.abs(x1 - cx) >= E) return false; }
  else {
    t1 = (cx - E - x1) / d; t2 = (cx + E - x1) / d;
    if (t1 > t2) { tt = t1; t1 = t2; t2 = tt; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  d = y2 - y1;
  if (Math.abs(d) < 1e-9) { if (Math.abs(y1 - cy) >= E) return false; }
  else {
    t1 = (cy - E - y1) / d; t2 = (cy + E - y1) / d;
    if (t1 > t2) { tt = t1; t1 = t2; t2 = tt; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

// Route planner — cardinal-only travel. Returns the next point to head for,
// ALWAYS straight up/down/left/right of the tile. Paths are built from
// L-shaped elbows (horizontal-then-vertical or vice versa) between the tile,
// the target, and corner waypoints around each pin; Dijkstra picks the
// shortest, with a fat penalty per turn so few-turn routes win (each turn
// costs an accelerate-from-0 in the movement code).
var _FOCUS_TURN_COST = 150; // px-equivalent path cost per corner
function _focusRoute(b, tx, ty) {
  var K = FOCUS, E = K.HALF * 2;
  var pins = [];
  for (var q = 0; q < K.bodies.length; q++) {
    var p = K.bodies[q];
    if (p.pinned && p !== b) pins.push(p);
  }

  // Pointer inside a pin's no-go zone → aim for the nearest reachable point.
  var t = { x: tx, y: ty };
  for (var it = 0; it < 2; it++) for (var q = 0; q < pins.length; q++) {
    var ax = Math.abs(t.x - pins[q].x), ay = Math.abs(t.y - pins[q].y);
    if (ax < E && ay < E) {
      if (E - ax < E - ay) t.x = pins[q].x + (t.x < pins[q].x ? -E : E);
      else t.y = pins[q].y + (t.y < pins[q].y ? -E : E);
    }
  }

  function blocked(x1, y1, x2, y2) {
    for (var q = 0; q < pins.length; q++)
      if (_focusSegBox(x1, y1, x2, y2, pins[q].x, pins[q].y, E - 1)) return true;
    return false;
  }

  // First cardinal step of an L-path u→v, or null if both elbows blocked.
  // When both elbows work, prefer the one whose first leg continues the
  // current heading (no speed reset), else lead with the longer axis.
  function firstStep(u, v) {
    var adx = Math.abs(v.x - u.x), ady = Math.abs(v.y - u.y);
    if (adx < 0.5 && ady < 0.5) return null;
    if (adx < 0.5) return blocked(u.x, u.y, u.x, v.y) ? null : { x: u.x, y: v.y };
    if (ady < 0.5) return blocked(u.x, u.y, v.x, u.y) ? null : { x: v.x, y: u.y };
    var hF = { x: v.x, y: u.y }, vF = { x: u.x, y: v.y };
    var hOk = !blocked(u.x, u.y, hF.x, hF.y) && !blocked(hF.x, hF.y, v.x, v.y);
    var vOk = !blocked(u.x, u.y, vF.x, vF.y) && !blocked(vF.x, vF.y, v.x, v.y);
    if (hOk && vOk) {
      var chx = K.drag ? (K.drag.hx || 0) : 0, chy = K.drag ? (K.drag.hy || 0) : 0;
      if (chx && (v.x - u.x) * chx > 0) return hF;
      if (chy && (v.y - u.y) * chy > 0) return vF;
      return adx >= ady ? hF : vF;
    }
    return hOk ? hF : (vOk ? vF : null);
  }

  // Direct L-path to the target?
  var step = firstStep({ x: b.x, y: b.y }, t);
  if (step) return step;

  // Nodes: 0 = tile, 1 = target, then 4 corner waypoints per pin.
  var M = E + 8;
  var nodes = [{ x: b.x, y: b.y }, t];
  for (var q = 0; q < pins.length; q++) {
    nodes.push({ x: pins[q].x - M, y: pins[q].y - M }, { x: pins[q].x + M, y: pins[q].y - M },
               { x: pins[q].x - M, y: pins[q].y + M }, { x: pins[q].x + M, y: pins[q].y + M });
  }
  var N = nodes.length, dist = [], prev = [], done = [];
  for (var i = 0; i < N; i++) { dist.push(Infinity); prev.push(-1); done.push(false); }
  dist[0] = 0;
  for (var it = 0; it < N; it++) {
    var u = -1, best = Infinity;
    for (var i = 0; i < N; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0 || u === 1) break;
    done[u] = true;
    for (var v = 0; v < N; v++) {
      if (done[v] || v === u) continue;
      var a = nodes[u], c = nodes[v];
      var adx = Math.abs(c.x - a.x), ady = Math.abs(c.y - a.y);
      var turns;
      if (adx < 0.5 || ady < 0.5) { // straight edge
        if (blocked(a.x, a.y, c.x, c.y)) continue;
        turns = 0;
      } else {                       // elbow edge (1 turn)
        var hOk = !blocked(a.x, a.y, c.x, a.y) && !blocked(c.x, a.y, c.x, c.y);
        var vOk = !blocked(a.x, a.y, a.x, c.y) && !blocked(a.x, c.y, c.x, c.y);
        if (!hOk && !vOk) continue;
        turns = 1;
      }
      var w = dist[u] + adx + ady + turns * _FOCUS_TURN_COST + _FOCUS_TURN_COST; // + node-join turn
      if (w < dist[v]) { dist[v] = w; prev[v] = u; }
    }
  }
  if (dist[1] === Infinity) {
    // enclosed — press toward the target along the longer axis; the slide
    // solver will park the tile against the wall nearest the pointer
    return Math.abs(t.x - b.x) >= Math.abs(t.y - b.y) ? { x: t.x, y: b.y } : { x: b.x, y: t.y };
  }
  var v = 1;
  while (prev[v] !== 0) v = prev[v];
  return firstStep({ x: b.x, y: b.y }, nodes[v]) || nodes[v];
}

function _focusStep() {
  if (!FOCUS.active) return;
  var K = FOCUS, bs = K.bodies, n = bs.length, i, j, b;
  // Advance an idle clock scaled by timeScale (1 normally, EXIT_SLOWMO while
  // exiting) so bob + wander crawl to a near-freeze during the exit hang.
  var real = performance.now();
  if (!K._lastNow) K._lastNow = real;
  K.clock += (real - K._lastNow) * K.timeScale;
  K._lastNow = real;
  var now = K.clock;

  // --- integrate free bodies (skip the one under the pointer) ---
  for (i = 0; i < n; i++) {
    b = bs[i];
    if ((K.drag && K.drag.body === b) || b.pinned) {
      // Held: two modes.
      // Glued — the tile moves 1:1 with the pointer (uncapped; pins still
      // solid via the slide solver). If a pin strands it well behind the
      // pointer, it switches to catch-up: the fewest-turn cardinal route,
      // accelerating from 0 on every direction change, until it's back
      // under the pointer — then it glues again.
      if (K.drag && K.drag.body === b) {
        var dg = K.drag;
        if (!dg.chasing) {
          _focusSlideTo(b, dg.tx, dg.ty, true);
          if (Math.hypot(dg.tx - b.x, dg.ty - b.y) > K.HALF * 1.5) { dg.chasing = true; dg.spd = 0; dg.hx = undefined; dg.hy = undefined; }
          b.vx = dg.vx; b.vy = dg.vy; // pointer velocity while glued
        } else {
          if (Math.hypot(dg.tx - b.x, dg.ty - b.y) < 8) { dg.chasing = false; dg.spd = 0; }
          else {
            var wp = _focusRoute(b, dg.tx, dg.ty);
            var dx = wp.x - b.x, dy = wp.y - b.y;
            var dd = Math.hypot(dx, dy);
            if (dd > 0.5) {
              var ux = dx / dd, uy = dy / dd;
              if (dg.hx === undefined || ux * dg.hx + uy * dg.hy < 0.9) dg.spd = 0; // new leg
              dg.hx = ux; dg.hy = uy;
              dg.spd = Math.min(K.CHASE, (dg.spd || 0) + K.CHASE_ACCEL);
              _focusSlideTo(b, b.x + ux * Math.min(dg.spd, dd), b.y + uy * Math.min(dg.spd, dd));
            } else { dg.spd = 0; }
          }
          b.vx = (dg.hx || 0) * (dg.spd || 0); b.vy = (dg.hy || 0) * (dg.spd || 0); // shoves others mid-drag
        }
      }
      b.rot += (0 - b.rot) * K.GRAB_UPRIGHT; b.vrot = 0;
      _focusDraw(b); continue;
    }

    if (K.exiting) {
      // Exit hang: no forcing, just bleed off momentum so tiles settle and
      // hang in place (slow-mo bob only) until the arc-home sweep grabs them.
      b.vx *= K.EXIT_DAMP; b.vy *= K.EXIT_DAMP;
    } else {
      // gentle updraft while inside the center band → pushes away from center,
      // strongest dead-center and fading to nothing at the band edges
      if (b.x > K.bandL && b.x < K.bandR) {
        var fall = 1 - Math.abs(b.x - K.cx) / (K.bandR - K.cx);
        b.vx += (b.x < K.cx ? -1 : 1) * K.UPDRAFT * fall;
      }

      // perpetual wander: slow per-tile Lissajous drift, never lets a tile
      // dead-stop, so corner piles gradually loosen and disperse
      b.vx += Math.sin(now * b.w1 + b.ph1) * K.WANDER;
      b.vy += Math.cos(now * b.w2 + b.ph2) * K.WANDER;

      b.vx *= K.DAMP; b.vy *= K.DAMP;
    }
    // clamp speed
    var sp = Math.hypot(b.vx, b.vy);
    if (sp > K.MAX_SPEED) { var s = K.MAX_SPEED / sp; b.vx *= s; b.vy *= s; }

    b.x += b.vx; b.y += b.vy;
    b.rot += b.vrot; b.vrot *= 0.985;
    b.rot += (0 - b.rot) * K.UPRIGHT; // slow drift back to upright

    // hard bounce off screen edges
    if (b.x < K.HALF) { b.x = K.HALF; b.vx = -b.vx * K.WALL_REST; b.vrot += b.vy * 0.02; }
    else if (b.x > K.W - K.HALF) { b.x = K.W - K.HALF; b.vx = -b.vx * K.WALL_REST; b.vrot -= b.vy * 0.02; }
    if (b.y < K.HALF) { b.y = K.HALF; b.vy = -b.vy * K.WALL_REST; b.vrot -= b.vx * 0.02; }
    else if (b.y > K.H - K.HALF) { b.y = K.H - K.HALF; b.vy = -b.vy * K.WALL_REST; b.vrot += b.vx * 0.02; }
  }

  // --- tile↔tile collisions: axis-aligned rounded squares (O(n^2)) ---
  var e = K.TILE_REST;
  for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
    var a = bs[i], c = bs[j];
    var h = _focusHit(a, c);
    if (!h) continue;
    var nx = h.nx, ny = h.ny, overlap = h.ov;

    var aHeld = (K.drag && K.drag.body === a) || a.pinned, cHeld = (K.drag && K.drag.body === c) || c.pinned;
    var invA = aHeld ? 0 : 1, invC = cHeld ? 0 : 1;
    if (invA + invC === 0) {
      // dragged tile vs pinned tile: the pin wins — shove the dragged one out
      if (K.drag && K.drag.body === a && c.pinned) { a.x -= nx * overlap; a.y -= ny * overlap; _focusDraw(a); }
      else if (K.drag && K.drag.body === c && a.pinned) { c.x += nx * overlap; c.y += ny * overlap; _focusDraw(c); }
      continue;
    }

    // positional de-overlap (held body acts as an immovable wall)
    var wa = invA / (invA + invC), wc = invC / (invA + invC);
    a.x -= nx * overlap * wa; a.y -= ny * overlap * wa;
    c.x += nx * overlap * wc; c.y += ny * overlap * wc;

    // velocity impulse along the normal
    var rvx = c.vx - a.vx, rvy = c.vy - a.vy, vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      var jimp = -(1 + e) * vn / (invA + invC);
      a.vx -= jimp * nx * invA; a.vy -= jimp * ny * invA;
      c.vx += jimp * nx * invC; c.vy += jimp * ny * invC;
      // a little English on contact
      var tang = -rvx * ny + rvy * nx;
      a.vrot -= tang * 0.03 * invA; c.vrot += tang * 0.03 * invC;
    }
  }

  for (i = 0; i < n; i++) if (!(K.drag && K.drag.body === bs[i])) _focusDraw(bs[i]);
  K.raf = requestAnimationFrame(_focusStep);
}

// Creates a floating body for tile t at (x,y) and registers it in the sim.
function _focusSpawnBody(t, x, y, vx, vy) {
  var spr = (t.isBlank && t.blankAs) ? blankTileSpr(t.blankAs, t.variant || null, 68)
    : tileSpr(t.isBlank ? null : t.letter, t.isBlank, t.variant || null, 68);
  var el = document.createElement('div');
  el.className = 'tile tile-spr focus-tile' + (t.isBlank ? ' blank-t' : '') + (t.variant ? ' var-' + t.variant : '');
  el.style.cssText = 'position:absolute;left:0;top:0;width:68px;height:68px;pointer-events:auto;' + spr;
  el.dataset.spr = spr; // reused by _flyTileSpiral when arcing home on exit
  applyTileLayers(el, t, 68, spr);
  var b = {
    t: t, el: el, x: x, y: y, vx: vx || 0, vy: vy || 0,
    rot: (Math.random() - 0.5) * 18,
    vrot: (Math.random() - 0.5) * 1.4,
    // wander: per-tile drift frequencies (rad/ms, ~10-30s periods) + phases
    w1: 0.0002 + Math.random() * 0.0005, ph1: Math.random() * Math.PI * 2,
    w2: 0.0002 + Math.random() * 0.0005, ph2: Math.random() * Math.PI * 2,
    // bob: idle float speed/phase/amplitude (~4-8s, 4-8px like the bag)
    bw: 0.0008 + Math.random() * 0.0007, bp: Math.random() * Math.PI * 2,
    bamp: 0.6 + Math.random() * 0.5
  };
  _focusDraw(b);
  FOCUS.ov.appendChild(el);
  _focusAttachDrag(b);
  FOCUS.bodies.push(b);
  return b;
}

// Puts body b under pointer control (shared by floating-tile pointerdown and
// board-tile pickup, where the originating element is about to be re-rendered).
function _focusBeginDrag(b, e) {
  b.vx = 0; b.vy = 0;
  FOCUS.drag = { body: b, dx: b.x - e.clientX, dy: b.y - e.clientY, vx: 0, vy: 0, t: e.timeStamp, sx: e.clientX, sy: e.clientY, moved: false, tx: b.x, ty: b.y };
  try { b.el.setPointerCapture(e.pointerId); } catch (err) {}
  b.el.style.zIndex = '2';
  b.el.style.cursor = 'grabbing';
}

// Commits a floating body onto board square sq through the normal placement
// path (placeTile handles hand removal, tile state, and Jenga stacking).
function _focusPlaceBody(b, sq) {
  // The square may have changed while the blank chooser was open.
  if (S.bt[sq] && !_jengaCanStack(sq)) { b.vx = 0; b.vy = 0; return; }
  var i = FOCUS.bodies.indexOf(b);
  if (i >= 0) FOCUS.bodies.splice(i, 1);
  b.el.remove();
  placeTile(b.t, sq);
  renderBoard();
}

function _focusAttachDrag(b) {
  var el = b.el;
  el.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || FOCUS.drag) return;
    e.preventDefault();
    _focusBeginDrag(b, e);
  });
  el.addEventListener('pointermove', function (e) {
    if (!FOCUS.drag || FOCUS.drag.body !== b) return;
    var d = FOCUS.drag;
    // Dead zone: don't move the tile until the pointer commits to a drag —
    // releasing inside it is a click (pin toggle, see release()).
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < FOCUS.CLICK_DIST) { d.t = e.timeStamp; return; }
      d.moved = true;
      b.pinned = false; el.classList.remove('focus-pinned'); // dragging releases a pin
    }
    var nx = e.clientX + d.dx, ny = e.clientY + d.dy;
    // Time-based pointer velocity (px/frame at 60fps), exponentially
    // smoothed over recent moves — a single jumpy event can't launch the
    // tile; the throw carries the actual drag speed. Measured against the
    // previous target (not the body, which may be lagging behind a pin).
    var dt = Math.max(1, e.timeStamp - d.t); d.t = e.timeStamp;
    var sm = 0.3;
    d.vx += ((nx - d.tx) / dt * 16.7 - d.vx) * sm;
    d.vy += ((ny - d.ty) / dt * 16.7 - d.vy) * sm;
    // Only record the target here — the step loop does all movement, so the
    // chase speed cap is uniform regardless of pointer event rate.
    d.tx = nx; d.ty = ny;
    // Drop-target highlight (empty squares + Jenga-stackable committed tiles).
    if (S.phase === 'play') {
      var hsq = sqAt(e.clientX, e.clientY);
      if (hsq >= 0) setHL(hsq); else clearHL();
    }
  });
  function release(e) {
    if (!FOCUS.drag || FOCUS.drag.body !== b) return;
    clearHL();
    if (!FOCUS.drag.moved) {
      if (FOCUS.drag.pickup) {
        // Click on a placed board tile: it was lifted on pointerdown —
        // just let it float free from where it sits (updraft clears it).
        b.vx = 0; b.vy = -0.4;
      } else {
        // Click without dragging: toggle pin — pinned tiles sit upright,
        // immovable, and other tiles bounce off them.
        b.pinned = !b.pinned;
        if (b.pinned) { b.vx = 0; b.vy = 0; b.vrot = 0; }
        el.classList.toggle('focus-pinned', b.pinned);
      }
    } else {
      // Dropped on the board: place the real tile (empty square, or Jenga-
      // stack onto an eligible committed tile).
      var sq = S.phase === 'play' ? sqAt(e.clientX, e.clientY) : -1;
      if (sq >= 0 && (!S.bt[sq] || _jengaCanStack(sq))) {
        FOCUS.drag = null;
        el.style.zIndex = '';
        el.style.cursor = 'grab';
        if (b.t.isBlank && !b.t.blankAs) {
          b.vx = 0; b.vy = 0; b.pinned = true; // hold still under the chooser modal
          openBlankChooser(b.t, function () { b.pinned = false; _focusPlaceBody(b, sq); });
        } else {
          _focusPlaceBody(b, sq);
        }
        return;
      }
      // Fling with the drag velocity — but if the pointer sat still before
      // release (no recent moves), the throw fades to a plain drop.
      var idle = e.timeStamp - FOCUS.drag.t;
      var f = Math.max(0, 1 - idle / 90);
      b.vx = FOCUS.drag.vx * f; b.vy = FOCUS.drag.vy * f;
    }
    FOCUS.drag = null;
    el.style.zIndex = '';
    el.style.cursor = 'grab';
  }
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
}

// Focus-mode board tile pickup: grabbing an is-new board tile lifts it off
// the board straight into the sim as a floating body already under drag —
// no drag.js clone engine. Attached by renderBoard in place of
// attachBoardTileDrag while focus mode is active.
function attachFocusBoardDrag(face, sqIdx, isTop) {
  face.addEventListener('pointerdown', function (ev) {
    if (!FOCUS.active || FOCUS.drag || ev.button !== 0) return;
    if (activeDrag) return;
    ev.preventDefault(); ev.stopPropagation();
    var t = isTop ? (S.btTop && S.btTop[sqIdx]) : S.bt[sqIdx];
    if (!t || !t.isNew) return;
    var r = face.getBoundingClientRect();
    if (isTop) S.btTop[sqIdx] = null; else S.bt[sqIdx] = null;
    setTileState(t, 'hand');
    if (S.hand.indexOf(t) < 0) S.hand.push(t);
    renderBoard();
    var b = _focusSpawnBody(t, r.left + r.width / 2, r.top + r.height / 2, 0, 0);
    _focusBeginDrag(b, ev);
    // Mark as a pickup: releasing without moving frees the tile to float
    // (release() would otherwise pin-toggle, or re-place it on the very
    // square it just vacated).
    FOCUS.drag.pickup = true;
  });
}

function enterFocus() {
  if (FOCUS.active || FOCUS.exiting || activeDrag) return;
  if (S.phase !== 'play') { toast('Focus mode is only available during play'); return; }
  FOCUS.active = true;
  FOCUS.exiting = false;
  FOCUS.timeScale = 1;
  FOCUS.clock = 0;
  FOCUS._lastNow = 0;
  window._focusMode = true;
  _fbPlay(FOCUS.BTN.CLOSE);
  document.body.classList.add('focus-mode');
  renderBoard(); // re-render with stickers stripped (see renderBoard focus check)

  var ov = document.createElement('div');
  ov.id = 'focus-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:900;pointer-events:none;overflow:hidden';
  document.body.appendChild(ov);
  FOCUS.ov = ov;

  var ha = document.getElementById('hand-area');
  if (ha) ha.style.visibility = 'hidden';

  _focusBounds();
  _focusZoom(true); // overrides band with the zoomed board's footprint

  FOCUS.bodies = [];
  var tiles = S.hand.filter(function (t) { return t && t.state === 'hand'; });
  for (var k = 0; k < tiles.length; k++) {
    var t = tiles[k];
    var src = document.querySelector('#hand-area .hand-tile[data-tile-id="' + t.id + '"]');
    var x, y;
    if (src) { var r = src.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
    else { x = FOCUS.cx + (Math.random() - 0.5) * 240; y = FOCUS.H - 120; }
    var side = x < FOCUS.cx ? -1 : 1;
    _focusSpawnBody(t, x, y, side * (0.3 + Math.random() * FOCUS.KICK), -(Math.random() * FOCUS.KICK));
  }

  FOCUS.raf = requestAnimationFrame(_focusStep);
}

// Exit is a three-beat choreography:
//   1. Tiles hang in place (sim keeps running in slow-mo) while the board
//      shrinks back to its slot and the eye button slides home. The rest of
//      the UI stays hidden (focus-mode class kept; focus-exiting only lets the
//      board/button/backdrop return — see CSS).
//   2. Once the board + button land, drop focus-mode so the peripheral UI
//      fades back in, and re-render the board with its stickers.
//   3. The hanging tiles arc back into the hand via the shared spiral-arc.
function exitFocus() {
  if (!FOCUS.active || FOCUS.exiting) return;
  FOCUS.exiting = true;
  FOCUS.drag = null;
  FOCUS.timeScale = FOCUS.EXIT_SLOWMO; // idle motion crawls; tiles hang
  _fbPlay(FOCUS.BTN.OPEN);
  clearHL();

  // Beat 1 — board glides home + eye slides back; peripheral UI stays hidden.
  document.body.classList.add('focus-exiting');
  _focusZoom(false);

  setTimeout(function () {
    if (!FOCUS.exiting) return; // guard against a race (shouldn't re-enter)
    // Beat 2 — board/button have arrived: fade the UI in + restore the board.
    document.body.classList.remove('focus-mode');
    window._focusMode = false;
    renderBoard();
    // Beat 3 — arc the hanging tiles home.
    _focusArcTilesHome();
  }, FOCUS.EXIT_SHRINK_MS);
}

// Beat 3: stop the sim and hand every floating tile off to the shared
// spiral-arc (the same path board recalls use). All floating tiles are still
// 'hand' tiles, so the hand rebuilds from empty as they land, left→right.
function _focusArcTilesHome() {
  var K = FOCUS;
  K.active = false;
  if (K.raf) cancelAnimationFrame(K.raf);
  K.raf = null;

  var bodies = K.bodies.slice();
  K.bodies = [];

  var ha = document.getElementById('hand-area');
  if (ha) ha.style.visibility = ''; // landed tiles need a visible hand

  var nNew = bodies.length;
  if (!nNew) { _focusFinishExit(); return; }

  for (var i = 0; i < nNew; i++) setTileState(bodies[i].t, 'moving', { movingFrom: 'hand', movingTo: 'hand' });
  HP.movingCount += nNew;
  renderHand();        // all tiles 'moving' → HP rebuilds empty
  hpBounds();
  var nHand = HP.x.length; // 0 (no resting tiles)
  var slots = hpRest(nHand + nNew);
  var hr = ha ? ha.getBoundingClientRect() : null;
  var destY = hr ? (hr.top + 34) : (window.innerHeight - 60);

  // Leftmost hanging tile arcs first into the leftmost slot.
  bodies.sort(function (a, b) { return a.x - b.x; });

  // Each tile still takes the round spiral sweep home (loops off-screen right
  // and swoops into the hand), just on a short hold + shortened sweep so it
  // snaps rather than drifts. _flyTileSpiral reparents each element to <body>
  // synchronously, so the overlay can be torn down right after.
  var now = performance.now();
  var landed = 0;
  for (var j = 0; j < nNew; j++) {
    (function (b, idx) {
      var sr = { left: b.x - 34, top: b.y - 34, width: 68, height: 68 };
      var holdUntil = now + AT(K.EXIT_ARC_HOLD + idx * K.EXIT_ARC_STAGGER);
      var destX = slots[nHand + idx];
      _flyTileSpiral(b.el, holdUntil, b.x, b.y, destX, destY, function () {
        _landTile(b.t); _playTileClick('land');
        if (++landed >= nNew) _focusFinishExit();
      }, sr, 0, -50, undefined, K.EXIT_ARC_MS);
    })(bodies[j], j);
  }

  // Elements are now owned by _flyTileSpiral (reparented to <body>) — drop the
  // empty overlay.
  if (K.ov) { K.ov.remove(); K.ov = null; }
}

// Final teardown once the last tile has landed.
function _focusFinishExit() {
  document.body.classList.remove('focus-mode');
  document.body.classList.remove('focus-exiting');
  window._focusMode = false;
  FOCUS.exiting = false;
  FOCUS.timeScale = 1;
  var ha = document.getElementById('hand-area');
  if (ha) ha.style.visibility = '';
  renderHand();
}

function toggleFocusMode() {
  if (FOCUS.exiting) return;          // ignore taps mid-exit
  if (FOCUS.active) exitFocus(); else enterFocus();
}

window.addEventListener('resize', function () {
  if (!FOCUS.active || FOCUS.exiting) return;
  _focusBounds();
  // Re-fit the zoom: measure untransformed (no transition for the snap).
  var bw = document.getElementById('board-wrap');
  if (bw) {
    bw.style.transition = 'none';
    bw.style.transform = '';
    void bw.offsetWidth; // flush so the re-applied transform doesn't animate
    _focusZoom(true);
    void bw.offsetWidth;
    bw.style.transition = '';
  }
});
