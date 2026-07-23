// =====================================================================
// DRIFT BACKGROUNDS — ambient liquid-drift art behind the main game UI.
//
// Classic (non-module) script. Uses the global `window.DriftBackground`
// (src/render/DriftBackground.js, loaded just before this file) to build a
// fixed layer BEHIND #app:
//
//   #app is a 3-column flex row — left-panel 25vw | center-col 50vw | right-panel 25vw.
//   • wood.png   — split in half: LEFT half behind the left panel (0–25vw),
//                  RIGHT half behind the right panel (75–100vw).
//   • trees.png — behind the centre column (25–75vw): board + stamp bar + hand.
//
// The layer sits at z-index:-1 so it shows through the now-semi-transparent
// mainui.png (which is #app's own background-image) WITHOUT giving #app a
// stacking context. Giving #app a z-index would trap focus-mode (#focus-bg
// z-index 890), the shop, and modals — all of which rely on high z-indexes
// declared on descendants of #app. z-index:-1 paints above the body's
// background but below #app, which is exactly where we want it.
//
// Settings are shared across all three regions (see PARAMS). This file is
// self-contained: it injects its own layer + inline styles, so index.html only
// needs the two <script> tags. Not part of the scoring/game logic.
// =====================================================================
(function () {
  'use strict';

  var IMG_DIR = 'Assets/images_fluid_background/';
  var PARAMS = {
    driftSpeed: 0.11,
    warp: 0.04,
    detail: 1.5,
    pixelSize: 5,
    palette: null,        // off — show the raw image colours
    autoLevels: false,
    crt: { enabled: true, amount: 0.25 },
  };

  // Wood side panels: same base settings, but with the brown ramp palette ON and
  // more dithering. (Ramp is ordered dark → light — required by the engine.)
  var WOOD_RAMP = ['#452620', '#583028', '#663931', '#76473f', '#8f563b', '#c99263'];
  var WOOD_PARAMS = {};
  for (var _k in PARAMS) WOOD_PARAMS[_k] = PARAMS[_k];
  WOOD_PARAMS.palette = WOOD_RAMP;
  WOOD_PARAMS.dither = 1.4;

  // Constraint (boss) rounds: the wood side panels churn harder — this REPLACES
  // the old mainui volatile swell (disabled in init.js). Only the fields that
  // differ from the calm state are toggled live (palette/dither stay put).
  var WOOD_CONSTRAINT = { driftSpeed: 0.25, detail: 4.0, warp: 0.35, tone: 0.05, contrast: 1.5 };
  var WOOD_CALM = { driftSpeed: PARAMS.driftSpeed, detail: PARAMS.detail, warp: PARAMS.warp, tone: 0, contrast: 1.0 };

  // Six complementary greens (ordered dark → light, as the engine requires) —
  // olive/forest-toned with a warm cast so they sit naturally beside the warm
  // WOOD_RAMP browns (bark-and-moss pairing).
  var GREEN_RAMP = ['#1e2915', '#2d3c1f', '#415829', '#567036', '#7b9a4c', '#adc079'];

  // Centre column (blurry_trees): a slower, broader, gentler drift than the base,
  // quantized to the green ramp with dithering (like the wood panels).
  var CENTER_PARAMS = {};
  for (var _c in PARAMS) CENTER_PARAMS[_c] = PARAMS[_c];
  CENTER_PARAMS.driftSpeed = 0.04;
  CENTER_PARAMS.warp = 0.03;
  CENTER_PARAMS.detail = 0.06;
  CENTER_PARAMS.palette = GREEN_RAMP;
  CENTER_PARAMS.dither = 1.4;

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('drift bg: failed to load ' + src)); };
      img.src = src;
    });
  }

  // One half (left|right) of an image, as a canvas — for the two side panels.
  function halfCanvas(img, side) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var half = Math.max(1, Math.floor(w / 2));
    var c = document.createElement('canvas');
    c.width = half; c.height = h;
    c.getContext('2d').drawImage(img, side === 'left' ? 0 : (w - half), 0, half, h, 0, 0, half, h);
    return c;
  }

  function makeCanvas(cssLeft, cssWidth) {
    var c = document.createElement('canvas');
    c.className = 'drift-bg-canvas';
    c.style.cssText = 'position:absolute;top:0;height:100vh;display:block;image-rendering:pixelated;'
      + 'left:' + cssLeft + ';width:' + cssWidth + ';';
    return c;
  }

  function build() {
    if (!window.DriftBackground) { console.error('drift bg: DriftBackground global missing'); return; }
    if (document.getElementById('drift-bg')) return; // already built

    var layer = document.createElement('div');
    layer.id = 'drift-bg';
    layer.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;background:#0f0f1e';

    var cLeft = makeCanvas('0', '25vw');
    var cCenter = makeCanvas('25vw', '50vw');
    var cRight = makeCanvas('75vw', '25vw');
    layer.appendChild(cLeft);
    layer.appendChild(cCenter);
    layer.appendChild(cRight);
    document.body.insertBefore(layer, document.body.firstChild);

    var onErr = function (e) { console.error('drift bg:', (e && e.message) ? e.message : e); };
    var opts = function (p) { var o = { onError: onErr }; for (var k in p) o[k] = p[k]; return o; };

    var left = new window.DriftBackground(cLeft, opts(WOOD_PARAMS));
    var center = new window.DriftBackground(cCenter, opts(CENTER_PARAMS));
    var right = new window.DriftBackground(cRight, opts(WOOD_PARAMS));
    window._driftBackgrounds = { left: left, center: center, right: right, layer: layer };

    // wood.png → split behind the two side panels.
    loadImage(IMG_DIR + 'wood.png').then(function (wood) {
      return Promise.all([
        left.setImage(halfCanvas(wood, 'left')).then(function () { left.start(); }),
        right.setImage(halfCanvas(wood, 'right')).then(function () { right.start(); }),
      ]);
    }).catch(onErr);

    // blurry_trees.png → behind the centre column (i.e. behind the board).
    loadImage(IMG_DIR + 'blurry_trees.png').then(function (bg) {
      return center.setImage(bg).then(function () { center.start(); });
    }).catch(onErr);

    // Watch for constraint (boss) rounds and swap the wood drift between calm and
    // churned. Cheap poll — currentConstraint() only flips at round boundaries.
    var constraintOn = null;
    function syncConstraint() {
      var on = (typeof currentConstraint === 'function') && !!currentConstraint();
      if (on === constraintOn) return;
      constraintOn = on;
      var o = on ? WOOD_CONSTRAINT : WOOD_CALM;
      left.setParams(o);
      right.setParams(o);
    }
    syncConstraint();
    setInterval(syncConstraint, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
