// =====================================================================
// ANIM — cinematic transitions between play and shop phases
// =====================================================================

// Apply gold glow immediately (called before scoring so glow persists through anim)
function _applyBountyGlow(boardIdxs, chipIndex) {
  for (var i = 0; i < boardIdxs.length; i++) {
    var sq = document.querySelector('[data-sq-idx="' + boardIdxs[i] + '"]');
    if (!sq) continue;
    var tileEl = sq.querySelector('.board-tile') || sq;
    tileEl.classList.add('bounty-gold-pulse');
  }
  var brow = document.getElementById('bounty-row');
  var chips = brow ? Array.prototype.slice.call(brow.children) : [];
  var chip = chipIndex < chips.length ? chips[chipIndex] : null;
  if (chip) chip.classList.add('bounty-scroll-pulse');
}

// Slide the bounty chip out (called after scoring animation; skips the pulse phase)
function animBountySlideOut(chipIndex) {
  return new Promise(function(resolve) {
    // Remove lingering glow classes
    var pulsed = document.querySelectorAll('.bounty-gold-pulse');
    for (var i = 0; i < pulsed.length; i++) pulsed[i].classList.remove('bounty-gold-pulse');
    var brow = document.getElementById('bounty-row');
    var chips = brow ? Array.prototype.slice.call(brow.children) : [];
    var chip = chipIndex < chips.length ? chips[chipIndex] : null;
    if (chip) chip.classList.remove('bounty-scroll-pulse');
    if (!chip) { resolve(); return; }
    var belowChips = chips.slice(chipIndex + 1);
    var chipR = chip.getBoundingClientRect();
    var slideUp = chipR.height + 4;
    var clone = chip.cloneNode(true);
    clone.style.cssText = 'position:fixed;left:' + chipR.left + 'px;top:' + chipR.top + 'px;'
      + 'width:' + chipR.width + 'px;height:' + chipR.height + 'px;z-index:9998;pointer-events:none;';
    document.body.appendChild(clone);
    chip.style.visibility = 'hidden';
    var slideOutDur = AT(600);
    var slideOutDist = chipR.left + chipR.width + 20;
    var slideStart = performance.now();
    function animateSlide(now) {
      var tOut = Math.min(1, (now - slideStart) / slideOutDur);
      var eOut = tOut * tOut * tOut;
      clone.style.transform = 'translateX(-' + (eOut * slideOutDist) + 'px)';
      clone.style.opacity = Math.max(0, 1 - tOut * 1.4) + '';
      if (tOut < 1) { requestAnimationFrame(animateSlide); return; }
      clone.remove();
      if (!belowChips.length) { resolve(); return; }
      var slideUpDur = AT(500);
      var upStart = performance.now();
      function animateUp(now2) {
        var tUp = Math.min(1, (now2 - upStart) / slideUpDur);
        var eUp = tUp * tUp * tUp;
        for (var j = 0; j < belowChips.length; j++)
          belowChips[j].style.transform = 'translateY(-' + (eUp * slideUp) + 'px)';
        if (tUp < 1) { requestAnimationFrame(animateUp); return; }
        for (var j = 0; j < belowChips.length; j++) belowChips[j].style.transform = '';
        resolve();
      }
      requestAnimationFrame(animateUp);
    }
    requestAnimationFrame(animateSlide);
  });
}

function _bagSpriteShow(bagEl) {
  // Match the animated overlay to the resting bag sprite's exact rect (size + position)
  // so it doesn't visibly scale or lift when the animation takes over.
  var sprEl = bagEl.querySelector('img') || bagEl;
  var sprR = sprEl.getBoundingClientRect();
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;z-index:820;pointer-events:none;'
    + 'left:' + sprR.left + 'px;'
    + 'top:' + sprR.top + 'px;'
    + 'width:' + sprR.width + 'px;height:' + sprR.height + 'px;';
  var img = document.createElement('img');
  img.style.cssText = 'width:100%;height:100%;image-rendering:pixelated;display:block;';
  // Match whatever pose the real bag is holding: mid-rattle (frame 6) if it's
  // already been vacuuming since scoring, otherwise the closed frame 0.
  img.src = window._bagVacuuming ? 'Assets/animations/bag/bag-frame6.png' : 'Assets/animations/bag/bag-frame0.png';
  overlay.appendChild(img);
  document.body.appendChild(overlay);
  bagEl.style.visibility = 'hidden';
  return {overlay: overlay, img: img, shakeInterval: null};
}

// The bag-sprite frame animations (open / rattle loop / close) always run at
// their natural speed. The anim-speed setting only speeds up the TILES being
// vacuumed (their flight timing in animHooverTiles), not the loop the bag runs
// through — so these use raw ms, not AT().
function _bagSpriteIntro(state, onDone) {
  var frames = [0,1,2,3,4,5];
  var fi = 0;
  function next() {
    state.img.src = 'Assets/animations/bag/bag-frame' + frames[fi] + '.png';
    fi++;
    if (fi < frames.length) setTimeout(next, 80);
    else onDone();
  }
  next();
}

function _bagSpriteShakeStart(state) {
  var frames = [6,7,8,9];
  var fi = 0;
  function step() {
    state.img.src = 'Assets/animations/bag/bag-frame' + frames[fi % frames.length] + '.png';
    fi++;
  }
  step(); // render the first rattle frame now so a hand-off from the real sprite doesn't hitch
  state.shakeInterval = setInterval(step, 100);
}

function _bagSpriteOutro(state, bagEl, onDone) {
  if (state.shakeInterval) { clearInterval(state.shakeInterval); state.shakeInterval = null; }
  var frames = [10,11,12,13];
  var fi = 0;
  function next() {
    state.img.src = 'Assets/animations/bag/bag-frame' + frames[fi] + '.png';
    fi++;
    if (fi < frames.length) setTimeout(next, 80);
    else { state.overlay.remove(); bagEl.style.visibility = ''; if(window._bagSpriteReset)window._bagSpriteReset(); onDone(); }
  }
  next();
}

// Vacuum every board tile — plus whatever's left in the hand — up into the bag,
// no board fold. Used on its own to clear the board before the end-of-round
// panel rises, and as the first half of animBoardToShop.
function animHooverTiles(onDone) {
  var layer = document.getElementById('anim-layer');
  layer.innerHTML = '';

  var wrap = document.getElementById('board-wrap');
  var els = wrap.querySelectorAll('.board-tile');
  var tiles = [];
  for (var i = 0; i < els.length; i++) {
    var r = els[i].getBoundingClientRect();
    if (r.width > 0 && r.height > 0) tiles.push({el: els[i], r: r});
  }
  // Suck the leftover hand tiles in too — they'd otherwise just blink out when
  // the board resets for the shop.
  var handEls = document.querySelectorAll('#hand-area .hand-tile');
  for (var hi = 0; hi < handEls.length; hi++) {
    var hr = handEls[hi].getBoundingClientRect();
    if (hr.width > 0 && hr.height > 0) tiles.push({el: handEls[hi], r: hr});
  }

  var bagEl = document.getElementById('bag-btn');
  var bagR = bagEl.getBoundingClientRect();
  var tx = bagR.left + bagR.width / 2;
  var ty = bagR.top + bagR.height / 2;

  var shuffled = shuffle(tiles.slice());
  var N = shuffled.length;

  if (N === 0) { if (onDone) onDone(); return; }

  var bagState = _bagSpriteShow(bagEl);
  // If the bag has been rattling since scoring crossed the round target, hand the
  // shake straight over from the (now hidden) real sprite to the overlay. Else
  // play the open intro (frames 0→5) first, then start the shake loop.
  if (window._bagVacuuming) {
    window._bagVacuuming = false;
    bagVacuumStopPlayShake();
    _bagSpriteShakeStart(bagState);
  } else {
    _bagSpriteIntro(bagState, function() { _bagSpriteShakeStart(bagState); });
  }

  var T = AT(1500);
  var done = 0;

  for (var i = 0; i < N; i++) {
    (function(tile, idx) {
      var delay = T * Math.sqrt(idx / N);
      var flightDur = AT(Math.max(200, 680 - 460 * (idx / N)));
      setTimeout(function() {
        _liftAndFly(tile, layer, tx, ty, flightDur, function() {
          done++;
          if (done === N) {
            _bagSpriteOutro(bagState, bagEl, function() {
              setTimeout(function() { if (onDone) onDone(); }, AT(80));
            });
          }
        });
      }, delay);
    })(shuffled[i], i);
  }
}
// Full board→shop transition: hoover the tiles into the bag, then fold the board
// away. (The end-of-round popup path splits these two halves apart.)
function animBoardToShop(onDone) {
  animHooverTiles(function() { _closeBoard(onDone); });
}

function _liftAndFly(tile, layer, tx, ty, flightDur, onDone) {
  var r = tile.r;
  var clone = document.createElement('div');
  clone.className = tile.el.className;
  clone.innerHTML = tile.el.innerHTML;
  var sprCss = tile.el.dataset.spr || '';
  clone.style.cssText = 'position:fixed;left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;height:'+r.height+'px;z-index:810;pointer-events:none;transform-origin:center center;box-shadow:0 2px 0 #6b5535;border-radius:5px;'+sprCss;
  layer.appendChild(clone);
  tile.el.style.visibility = 'hidden';

  var liftDur = AT(90);
  var liftAmt = 12 + Math.random() * 10;
  var liftRot = (Math.random() - 0.5) * 30;
  var liftStart = performance.now();
  var sx = r.left + r.width / 2;
  var sy = r.top + r.height / 2;

  function liftTick(now) {
    var t = Math.min(1, (now - liftStart) / liftDur);
    var e = 1 - (1 - t) * (1 - t);
    clone.style.transform = 'translateY('+(-e * liftAmt)+'px) rotate('+(e * liftRot)+'deg)';
    if (t < 1) { requestAnimationFrame(liftTick); return; }

    var startY = sy - liftAmt;
    var cpx = sx + (tx - sx) * 0.3 + (Math.random() - 0.5) * 200;
    var cpy = Math.min(startY, ty) - 60 - Math.random() * 100;
    var flyStart = performance.now();

    function flyTick(now) {
      var t = Math.min(1, (now - flyStart) / flightDur);
      var e = t * t * t; // ease-in cubic — accelerates as vacuum pulls harder
      var u = 1 - e;
      var cx = u*u*sx + 2*u*e*cpx + e*e*tx;
      var cy = u*u*startY + 2*u*e*cpy + e*e*ty;
      var sc = 1 - e * 0.9;
      var rot = liftRot + e * 210 * (liftRot >= 0 ? 1 : -1);
      clone.style.left = (cx - r.width / 2)+'px';
      clone.style.top = (cy - r.height / 2)+'px';
      clone.style.transform = 'scale('+sc+') rotate('+rot+'deg)';
      if (t < 1) { requestAnimationFrame(flyTick); return; }
      clone.remove();
      onDone();
    }
    requestAnimationFrame(flyTick);
  }
  requestAnimationFrame(liftTick);
}

// Creates two half-clones of the board, positioned in a container over the board.
// isStartFolded: if true, both halves begin edge-on (90°) so opening can unfold them.
// CLOSE_SCALE: how far the board zooms toward the viewer during fold
function _makeBoardFold(boardEl, isStartFolded) {
  var r = boardEl.getBoundingClientRect();
  var W = r.width, BH = r.height;
  var h = Math.floor(BH / 2);

  // Scale at which the board exactly fills the viewport — computed from actual geometry
  var cx = r.left + W/2, cy = r.top + BH/2;
  var fillScale = Math.max(
    Math.max(cx, window.innerWidth  - cx) / (W/2),
    Math.max(cy, window.innerHeight - cy) / (BH/2)
  ) * 1.2; // 20% overshoot ensures coverage arrives well before animation end


  // Perspective container — shared perspective so both halves share one vanishing point
  // perspective-origin at fold line (50% height = center of board)
  var perspCont = document.createElement('div');
  perspCont.style.cssText = [
    'position:fixed','left:'+r.left+'px','top:'+r.top+'px',
    'width:'+W+'px','height:'+BH+'px','z-index:810',
    'perspective:'+(BH*1.1)+'px',   // tight perspective = dramatic depth
    'perspective-origin:50% 50%',   // vanishing point at fold line
    'transform-origin:50% 50%',
    'transform:scale('+(isStartFolded?fillScale:1)+')'
  ].join(';');
  document.body.appendChild(perspCont);

  function makeHalf(isTop) {
    var wrap = document.createElement('div');
    // transform-origin at the fold line edge of each half
    wrap.style.cssText = [
      'position:absolute','left:0','top:'+(isTop?0:h)+'px',
      'width:'+W+'px','height:'+h+'px','overflow:hidden',
      'transform-origin:'+(isTop?'bottom':'top')+' center'
    ].join(';');
    var clone = boardEl.cloneNode(true);
    clone.removeAttribute('id');
    clone.style.cssText = [
      'position:absolute','left:0','top:'+(isTop?'0':'-'+h+'px'),
      'width:'+W+'px','display:inline-grid','gap:2px',
      'background:#0a0a18','padding:6px','border-radius:8px',
      'border:1px solid #2a2a4a',
      'grid-template-columns:'+boardEl.style.gridTemplateColumns,
      'box-sizing:border-box','margin:0'
    ].join(';');
    wrap.appendChild(clone);
    // backface hidden so overshoot past 90° shows void rather than mirrored content
    wrap.style.backfaceVisibility = 'hidden';
    if (isStartFolded) wrap.style.transform = 'rotateX('+(isTop?-90:90)+'deg)';
    return wrap;
  }

  var topWrap = makeHalf(true);
  var botWrap = makeHalf(false);
  perspCont.appendChild(topWrap);
  perspCont.appendChild(botWrap);
  boardEl.style.visibility = 'hidden';

  return {
    perspCont: perspCont, topWrap: topWrap, botWrap: botWrap,
    BH: BH, fillScale: fillScale,
    cleanup: function() { perspCont.remove(); boardEl.style.visibility = ''; }
  };
}

function animShopToBoard(onBoardReady) {
  var boardEl = document.getElementById('board-wrap');

  // Pre-hide board and hand tiles so neither flashes before bursting out of the bag
  var boardTileEls = boardEl.querySelectorAll('.board-tile');
  for (var i = 0; i < boardTileEls.length; i++) boardTileEls[i].style.opacity = '0';
  var handTileEls = document.querySelectorAll('#hand-area .hand-tile');
  for (var i = 0; i < handTileEls.length; i++) handTileEls[i].style.opacity = '0';

  document.getElementById('shop-screen').style.display = 'none';

  // Board starts fully open toward viewer (mouth wide), zoomed in — will fold flat and zoom out
  var fold = _makeBoardFold(boardEl, true);
  var perspCont = fold.perspCont, topWrap = fold.topWrap, botWrap = fold.botWrap;
  var fillScale = fold.fillScale;

  var dur = AT(700);
  var start = performance.now();

  function step(now) {
    var t = Math.min(1, (now - start) / dur);
    var e = 1 - Math.pow(1 - t, 3); // ease-out cubic — decelerates as board snaps flat

    var angle = (1 - e) * 90;
    topWrap.style.transform = 'rotateX('+(-angle)+'deg)';
    botWrap.style.transform = 'rotateX('+(angle)+'deg)';
    perspCont.style.transform = 'scale('+(1 + (1 - e) * (fillScale - 1))+')';

    if (t < 1) { requestAnimationFrame(step); return; }

    fold.cleanup();
    _burstBoardTiles(onBoardReady);
  }
  requestAnimationFrame(step);
}

function _burstTilesFromBag(els, bx, by, staggerT, onDone) {
  var layer = document.getElementById('anim-layer');
  var N = els.length;
  var done = 0;

  for (var i = 0; i < N; i++) {
    (function(el, idx) {
      var r = el.getBoundingClientRect();
      var tx = r.left + r.width / 2;
      var ty = r.top + r.height / 2;
      var tw = r.width || 56;
      var th = r.height || 64;

      var sprCss2 = el.dataset.spr || '';
      el.style.opacity = '0';
      var clone = document.createElement('div');
      clone.className = el.className;
      clone.innerHTML = el.innerHTML;
      clone.style.cssText = 'position:fixed;left:'+(bx-tw/2)+'px;top:'+(by-th/2)+'px;width:'+tw+'px;height:'+th+'px;z-index:810;pointer-events:none;'+sprCss2;
      layer.appendChild(clone);

      var cpx = (bx + tx) / 2 + (Math.random() - 0.5) * 130;
      var cpy = Math.min(by, ty) - 65 - Math.random() * 80;
      var dist = Math.sqrt((tx - bx) * (tx - bx) + (ty - by) * (ty - by));
      var flightDur = AT(300 + dist * 0.32);

      var delay = AT(staggerT * Math.sqrt(idx / N)); // sqrt stagger — fast burst, slows as bag empties
      setTimeout(function() {
        var flyStart = performance.now();
        function flyTick(now) {
          var t = Math.min(1, (now - flyStart) / flightDur);
          var e = 1 - Math.pow(1 - t, 3); // ease-out cubic — fast exit, soft landing
          var u = 1 - e;
          var cx = u*u*bx + 2*u*e*cpx + e*e*tx;
          var cy = u*u*by + 2*u*e*cpy + e*e*ty;
          clone.style.left = (cx - tw/2)+'px';
          clone.style.top = (cy - th/2)+'px';
          if (t < 1) { requestAnimationFrame(flyTick); return; }
          clone.remove();
          el.style.opacity = '1';
          done++;
          if (done === N && onDone) onDone();
        }
        requestAnimationFrame(flyTick);
      }, delay);
    })(els[i], i);
  }
}

function _burstBoardTiles(onDone) {
  var layer = document.getElementById('anim-layer');
  layer.innerHTML = '';

  var bagEl = document.getElementById('bag-btn');
  var bagR = bagEl.getBoundingClientRect();
  var bx = bagR.left + bagR.width / 2;
  var by = bagR.top + bagR.height / 2;

  var wrap = document.getElementById('board-wrap');
  var rawEls = wrap.querySelectorAll('.board-tile');
  var tiles = [];
  for (var i = 0; i < rawEls.length; i++) {
    var r = rawEls[i].getBoundingClientRect();
    if (r.width > 0 && r.height > 0) tiles.push(rawEls[i]);
  }

  var N = tiles.length;
  if (N === 0) { onDone(); return; }

  var shuffled = shuffle(tiles.slice());

  _burstTilesFromBag(shuffled, bx, by, 900, function() {
    setTimeout(onDone, AT(80));
  });
}

function animSpringTrap(fromRect, tileData, onDone) {
  var bagEl  = document.getElementById('bag-btn');
  var bagSpr = document.getElementById('bag-sprite');
  if (!bagEl || !fromRect) { if (onDone) onDone(); return; }

  _playSpringBoing();

  // Target: bag mouth — top-centre of the sprite (where the opening is)
  var bagSprEl = document.getElementById('bag-sprite');
  var bsr = bagSprEl ? bagSprEl.getBoundingClientRect() : bagEl.getBoundingClientRect();
  var sz = Math.round(fromRect.width) || 48;
  var startX = fromRect.left + fromRect.width  / 2;
  var startY = fromRect.top  + fromRect.height / 2;
  var endX   = bsr.left + bsr.width  * 0.46;
  var endY   = bsr.top  + bsr.height * 0.20;

  // Slight upward arc: push control point above the midpoint of the straight path
  var arcLift = Math.max(55, Math.abs(endX - startX) * 0.11);
  var cpX = (startX + endX) / 2;
  var cpY = (startY + endY) / 2 - arcLift;

  var MAX_SCALE  = 6.5;
  var ARC_DUR    = AT(760);  // spring launch to bag mouth (fast, then decelerates)
  var SWALLOW_DUR = AT(380); // tile shrinks into bag as bag closes

  var spr   = tileSpr(tileData.isBlank ? null : tileData.letter, tileData.isBlank, tileData.variant || null, sz);
  var layer = document.getElementById('anim-layer');
  var flyEl = document.createElement('div');
  flyEl.className = 'tile tile-spr';
  flyEl.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;'
    + 'width:' + sz + 'px;height:' + sz + 'px;transform-origin:center center;' + spr;
  applyTileLayers(flyEl, tileData, sz, spr);
  layer.appendChild(flyEl);

  // Bag opens immediately and holds at frame 5, waiting for the tile
  if (bagSpr) _animBagFrames(bagSpr, 0, 5, 48, null);

  var t0 = performance.now();
  var swallowStarted = false;

  function tick(now) {
    var elapsed = now - t0;

    if (elapsed < ARC_DUR) {
      var tLin  = Math.min(1, elapsed / ARC_DUR);
      // Cubic ease-out: explosive spring launch that decelerates toward bag
      var tEase = 1 - Math.pow(1 - tLin, 3);

      // Quadratic bezier along the slight upward arc
      var u  = 1 - tEase;
      var cx = u*u*startX + 2*u*tEase*cpX + tEase*tEase*endX;
      var cy = u*u*startY + 2*u*tEase*cpY + tEase*tEase*endY;

      // Scale: parabolic peak at temporal midpoint (sin curve)
      var scale = 1 + (MAX_SCALE - 1) * Math.sin(Math.PI * tLin);

      flyEl.style.left      = (cx - sz / 2) + 'px';
      flyEl.style.top       = (cy - sz / 2) + 'px';
      flyEl.style.transform = 'scale(' + scale.toFixed(3) + ')';
      requestAnimationFrame(tick);
    } else {
      // Swallow: tile shrinks to nothing at bag mouth; bag closes around it
      if (!swallowStarted) {
        swallowStarted = true;
        flyEl.style.left      = (endX - sz / 2) + 'px';
        flyEl.style.top       = (endY - sz / 2) + 'px';
        flyEl.style.transform = 'scale(1)';
        if (bagSpr) _animBagFrames(bagSpr, 5, 0, 76, null);
      }

      var sf = Math.min(1, (elapsed - ARC_DUR) / SWALLOW_DUR);
      // Ease-in shrink: brief linger then collapses fast
      var swallowScale = Math.max(0, 1 - sf * sf);

      flyEl.style.left      = (endX - sz / 2) + 'px';
      flyEl.style.top       = (endY - sz / 2) + 'px';
      flyEl.style.transform = 'scale(' + swallowScale.toFixed(3) + ')';

      if (sf < 1) {
        requestAnimationFrame(tick);
      } else {
        flyEl.remove();
        if (onDone) onDone();
      }
    }
  }

  requestAnimationFrame(tick);
}

// Worm Hole teleport: the tile spins and shrinks into its square (sucked in),
// then spins back out of the destination square, growing from nothing.
// Called from playWord after scoring, between removing the tile from the
// wormhole square and committing it at its destination.
function animWormhole(fromRect, toRect, tileData, onDone) {
  var layer = document.getElementById('anim-layer') || document.body;
  var sz = Math.round(fromRect.width) || 48;
  var spr = (tileData.isBlank && tileData.blankAs)
    ? blankTileSpr(tileData.blankAs, tileData.variant || null, sz)
    : tileSpr(tileData.isBlank ? null : tileData.letter, tileData.isBlank, tileData.variant || null, sz);
  var el = document.createElement('div');
  el.className = 'tile tile-spr';
  el.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;'
    + 'width:' + sz + 'px;height:' + sz + 'px;left:' + fromRect.left + 'px;top:' + fromRect.top + 'px;'
    + 'transform-origin:center center;' + spr;
  applyTileLayers(el, tileData, sz, spr);
  layer.appendChild(el);

  var IN_DUR = AT(380), GAP_DUR = AT(140), OUT_DUR = AT(380);
  var t0 = performance.now(), phase = 0;
  function tick(now) {
    var elapsed = now - t0;
    if (phase === 0) {
      // Suck in: accelerating spin + shrink into the wormhole
      var k = Math.min(1, elapsed / IN_DUR);
      var e = k * k;
      el.style.transform = 'rotate(' + (e * 540).toFixed(1) + 'deg) scale(' + (1 - e).toFixed(3) + ')';
      if (k >= 1) { phase = 1; t0 = now; el.style.transform = 'scale(0)'; }
    } else if (phase === 1) {
      // Beat of nothing while the tile is "in transit"
      if (elapsed >= GAP_DUR) {
        phase = 2; t0 = now;
        el.style.left = toRect.left + 'px';
        el.style.top = toRect.top + 'px';
      }
    } else {
      // Pop out: decelerating un-spin + grow at the destination
      var k2 = Math.min(1, elapsed / OUT_DUR);
      var e2 = 1 - Math.pow(1 - k2, 3);
      el.style.transform = 'rotate(' + (-540 + e2 * 540).toFixed(1) + 'deg) scale(' + e2.toFixed(3) + ')';
      if (k2 >= 1) {
        el.remove();
        if (onDone) onDone();
        return;
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function _burstHandTiles() {
  var layer = document.getElementById('anim-layer');
  layer.innerHTML = '';

  // Re-layout the hand from the CURRENT (post-shop) geometry before we read tile
  // rects — the elements may still hold stale/collapsed positions computed while
  // the shop overlay was up, which a fast (sped-up) transition doesn't give the
  // physics time to spread back out, so the burst would land them squished.
  // Clearing HP forces renderHand to snap fresh, evenly-spaced rest positions.
  // HP.tiles must be cleared too: hpRebuild remaps by tile ID, so if the same
  // tiles are still listed there it would reuse their (now-wiped) x as 0 and
  // launch every tile from screen-left, snapping back to rest. Emptying it makes
  // rebuild fall through to fresh rest positions. The new elements are set to
  // opacity 0 by _burstTilesFromBag in the same tick, so there's no flash.
  HP.movingCount = 0; HP.x = []; HP.vx = []; HP.tiles = [];
  renderHand();

  var bagEl = document.getElementById('bag-btn');
  var bagR = bagEl.getBoundingClientRect();
  var bx = bagR.left + bagR.width / 2;
  var by = bagR.top + bagR.height / 2;

  var area = document.getElementById('hand-area');
  var handEls = Array.prototype.slice.call(area.querySelectorAll('.hand-tile'));
  var N = handEls.length;
  if (N === 0) return;

  _burstTilesFromBag(handEls, bx, by, 180, null);
}

// Half-board clone used by the zoom in/out fold animations. The clone is a
// full copy of the board clipped to one side of foldLine, with its
// transform-origin on the fold line so it can rotate away in 3D.
function _makeZoomHalf(boardEl, isTop, foldLine, W, BH) {
  var wH = isTop ? foldLine : (BH - foldLine);
  var wrap = document.createElement('div');
  wrap.style.cssText = [
    'position:absolute', 'left:0', 'top:' + (isTop ? 0 : foldLine) + 'px',
    'width:' + W + 'px', 'height:' + wH + 'px',
    'overflow:hidden',
    'transform-origin:' + (isTop ? 'bottom' : 'top') + ' center',
    'backface-visibility:hidden'
  ].join(';');
  var clone = boardEl.cloneNode(true);
  clone.removeAttribute('id');
  clone.style.cssText = [
    'position:absolute', 'left:0', 'top:' + (isTop ? '0' : '-' + foldLine + 'px'),
    'width:' + W + 'px', 'display:inline-grid', 'gap:2px',
    'background:#0a0a18', 'padding:6px', 'border-radius:8px',
    'border:1px solid #2a2a4a',
    'grid-template-columns:' + boardEl.style.gridTemplateColumns,
    'box-sizing:border-box', 'margin:0'
  ].join(';');
  wrap.appendChild(clone);
  return wrap;
}

function animBoardZoomIn(half, onDone) {
  var boardEl = document.getElementById('board-wrap');
  var boardAreaEl = boardEl.parentNode;
  var r = boardEl.getBoundingClientRect();
  var W = r.width, BH = r.height;

  var sz = (BH - 42) / 15;
  var foldLine = Math.round(half === 'top' ? (21 + 8 * sz) : (19 + 7 * sz));

  var clipEl = document.createElement('div');
  clipEl.style.cssText = [
    'position:fixed', 'left:' + r.left + 'px', 'top:' + r.top + 'px',
    'width:' + (window.innerWidth - r.left) + 'px', 'height:' + BH + 'px',
    'overflow:hidden', 'z-index:860', 'pointer-events:none'
  ].join(';');
  document.body.appendChild(clipEl);

  var scaleEl = document.createElement('div');
  scaleEl.style.cssText = 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + BH + 'px;transform-origin:left top;pointer-events:auto;';
  clipEl.appendChild(scaleEl);

  var perspEl = document.createElement('div');
  perspEl.style.cssText = [
    'position:absolute', 'left:0', 'top:0',
    'width:' + W + 'px', 'height:' + BH + 'px',
    'perspective:' + (BH * 1.1) + 'px',
    'perspective-origin:50% ' + foldLine + 'px'
  ].join(';');
  scaleEl.appendChild(perspEl);

  var topWrap = _makeZoomHalf(boardEl, true, foldLine, W, BH);
  var botWrap = _makeZoomHalf(boardEl, false, foldLine, W, BH);
  perspEl.appendChild(topWrap);
  perspEl.appendChild(botWrap);
  boardEl.style.visibility = 'hidden';

  var halfCenter = half === 'top' ? foldLine / 2 : (foldLine + BH) / 2;
  var targetT = BH / 3 - halfCenter;

  var dur = 700, start = performance.now();
  function step(now) {
    var t = Math.min(1, (now - start) / dur);
    var e = 1 - Math.pow(1 - t, 3);
    var otherWrap = half === 'top' ? botWrap : topWrap;
    // backwards fold: other half rotates away from viewer
    otherWrap.style.transform = 'rotateX(' + (half === 'top' ? -e * 90 : e * 90) + 'deg)';
    var sc = 1 + e * 0.5;
    scaleEl.style.transform = 'scale(' + sc + ') translateY(' + (e * targetT) + 'px)';
    if (t < 1) { requestAnimationFrame(step); return; }

    // Swap clones for the real interactive board.
    // halfEl clips to exactly the selected half to prevent the other half bleeding through.
    perspEl.remove();
    var halfEl = document.createElement('div');
    if (half === 'top') {
      halfEl.style.cssText = 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + foldLine + 'px;overflow:hidden';
      boardEl.style.position = 'absolute';
      boardEl.style.left = '0';
      boardEl.style.top = '0';
    } else {
      halfEl.style.cssText = 'position:absolute;left:0;top:' + foldLine + 'px;width:' + W + 'px;height:' + (BH - foldLine) + 'px;overflow:hidden';
      boardEl.style.position = 'absolute';
      boardEl.style.left = '0';
      boardEl.style.top = '-' + foldLine + 'px';
    }
    boardEl.style.visibility = '';
    halfEl.appendChild(boardEl);
    scaleEl.appendChild(halfEl);

    onDone({
      clipEl: clipEl, scaleEl: scaleEl, halfEl: halfEl,
      boardEl: boardEl, boardAreaEl: boardAreaEl,
      half: half, targetT: targetT, foldLine: foldLine, W: W, BH: BH,
      cleanup: function() {
        boardAreaEl.appendChild(boardEl);
        boardEl.style.position = '';
        boardEl.style.left = '';
        boardEl.style.top = '';
        boardEl.style.visibility = '';
        clipEl.remove();
      }
    });
  }
  requestAnimationFrame(step);
}

function animBoardZoomOut(zoomState, onDone) {
  var scaleEl = zoomState.scaleEl;
  var clipEl = zoomState.clipEl;
  var halfEl = zoomState.halfEl;
  var boardEl = zoomState.boardEl;
  var boardAreaEl = zoomState.boardAreaEl;
  var half = zoomState.half, targetT = zoomState.targetT;
  var foldLine = zoomState.foldLine, W = zoomState.W, BH = zoomState.BH;

  // Build clone halves for the unfolding animation
  var perspEl = document.createElement('div');
  perspEl.style.cssText = [
    'position:absolute', 'left:0', 'top:0',
    'width:' + W + 'px', 'height:' + BH + 'px',
    'perspective:' + (BH * 1.1) + 'px',
    'perspective-origin:50% ' + foldLine + 'px'
  ].join(';');

  var topWrap = _makeZoomHalf(boardEl, true, foldLine, W, BH);
  var botWrap = _makeZoomHalf(boardEl, false, foldLine, W, BH);
  var otherWrap = half === 'top' ? botWrap : topWrap;
  // Start fully folded (backwards: -90 for top half, +90 for bot half)
  otherWrap.style.transform = 'rotateX(' + (half === 'top' ? -90 : 90) + 'deg)';
  perspEl.appendChild(topWrap);
  perspEl.appendChild(botWrap);

  // Move real board back to its original parent while clones animate
  boardAreaEl.appendChild(boardEl);
  boardEl.style.position = '';
  boardEl.style.left = '';
  boardEl.style.top = '';
  boardEl.style.visibility = 'hidden';
  halfEl.remove(); // clean up now-empty half-clip wrapper

  scaleEl.appendChild(perspEl);

  var dur = 600, start = performance.now();
  function step(now) {
    var t = Math.min(1, (now - start) / dur);
    var e = 1 - Math.pow(1 - t, 3);
    var progress = 1 - e;
    otherWrap.style.transform = 'rotateX(' + (half === 'top' ? -progress * 90 : progress * 90) + 'deg)';
    var sc = 1 + progress * 0.5;
    scaleEl.style.transform = 'scale(' + sc + ') translateY(' + (progress * targetT) + 'px)';
    if (t < 1) { requestAnimationFrame(step); return; }
    clipEl.remove();
    boardEl.style.visibility = '';
    onDone();
  }
  requestAnimationFrame(step);
}

function _closeBoard(onDone) {
  var boardEl = document.getElementById('board-wrap');
  var fold = _makeBoardFold(boardEl, false); // board starts flat
  var perspCont = fold.perspCont, topWrap = fold.topWrap, botWrap = fold.botWrap, BH = fold.BH;
  var bg = getComputedStyle(document.body).backgroundColor || '#0f0f1e';
  perspCont.style.background = bg; // fill area outside fold halves as perspCont scales past board edges

  var fillScale = fold.fillScale;
  var coverScale = fillScale / 1.2; // scale at which perspCont exactly covers viewport (no overshoot margin)
  var dur = AT(950);
  var start = performance.now();
  var onDoneScheduled = false;

  // Three-phase snap: slow linear creep → explosive snap (with overshoot) → elastic settle
  function snapEase(t) {
    if (t < 0.60) return (t / 0.60) * 0.25;                              // linear: 0° → 22.5° — visible from frame 1
    if (t < 0.79) { var s=(t-0.60)/0.19; return 0.25+Math.pow(s,0.35)*0.84; } // snap to ~98°
    var s=(t-0.79)/0.21; return 1.09-(1-Math.pow(1-s,2))*0.09;           // settle to 90°
  }

  function step(now) {
    var t = Math.min(1, (now - start) / dur);
    var e = snapEase(t);
    var eScale = Math.pow(t, 0.4); // aggressively front-loaded — full coverage before snap fires
    var currentScale = 1 + eScale * (fillScale - 1);

    topWrap.style.transform = 'rotateX('+(-e * 90)+'deg)';
    botWrap.style.transform = 'rotateX('+(e * 90)+'deg)';
    perspCont.style.transform = 'scale('+currentScale+')';

    // Fire onDone the first frame the overlay fully covers the viewport — shop loads behind it
    if (!onDoneScheduled && currentScale >= coverScale) {
      onDoneScheduled = true;
      onDone();
    }

    if (t < 1) { requestAnimationFrame(step); return; }

    var fo = performance.now();
    function fadeOverlay(n) {
      var ft = Math.min(1, (n - fo) / AT(120));
      perspCont.style.opacity = (1 - ft) + '';
      if (ft < 1) { requestAnimationFrame(fadeOverlay); return; }
      fold.cleanup();
    }
    requestAnimationFrame(fadeOverlay);
  }
  requestAnimationFrame(step);
}
