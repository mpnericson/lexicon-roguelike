// =====================================================================
// ANIM — cinematic transitions between play and shop phases
// =====================================================================

function animBoardToShop(onDone) {
  var layer = document.getElementById('anim-layer');
  layer.innerHTML = '';

  var wrap = document.getElementById('board-wrap');
  var els = wrap.querySelectorAll('.board-tile');
  var tiles = [];
  for (var i = 0; i < els.length; i++) {
    var r = els[i].getBoundingClientRect();
    if (r.width > 0 && r.height > 0) tiles.push({el: els[i], r: r});
  }

  var bagEl = document.getElementById('bag-btn');
  var bagR = bagEl.getBoundingClientRect();
  var tx = bagR.left + bagR.width / 2;
  var ty = bagR.top + bagR.height / 2;

  var shuffled = shuffle(tiles.slice());
  var N = shuffled.length;

  bagEl.classList.add('bag-vacuuming');

  if (N === 0) { _closeBoard(function(){ bagEl.classList.remove('bag-vacuuming'); onDone(); }); return; }

  // sqrt stagger: slow start accelerating to fast finish (vacuum turning up)
  var T = 1500;
  var done = 0;
  var lastBounce = 0;

  for (var i = 0; i < N; i++) {
    (function(tile, idx) {
      var delay = T * Math.sqrt(idx / N);
      var flightDur = Math.max(200, 680 - 460 * (idx / N));

      setTimeout(function() {
        _liftAndFly(tile, layer, tx, ty, flightDur, function() {
          var now = Date.now();
          if (now - lastBounce > 75) {
            lastBounce = now;
            bagEl.classList.remove('bag-absorb');
            void bagEl.offsetWidth;
            bagEl.classList.add('bag-absorb');
          }
          done++;
          if (done === N) setTimeout(function() {
            _closeBoard(function(){ bagEl.classList.remove('bag-vacuuming'); onDone(); });
          }, 80);
        });
      }, delay);
    })(shuffled[i], i);
  }
}

function _liftAndFly(tile, layer, tx, ty, flightDur, onDone) {
  var r = tile.r;
  var clone = document.createElement('div');
  clone.className = tile.el.className;
  clone.innerHTML = tile.el.innerHTML;
  clone.style.cssText = 'position:fixed;left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;height:'+r.height+'px;z-index:810;pointer-events:none;transform-origin:center center;box-shadow:0 2px 0 #6b5535;border-radius:5px;';
  layer.appendChild(clone);
  tile.el.style.visibility = 'hidden';

  var liftDur = 90;
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

  var dur = 700;
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

      el.style.opacity = '0';
      var clone = document.createElement('div');
      clone.className = el.className;
      clone.innerHTML = el.innerHTML;
      clone.style.cssText = 'position:fixed;left:'+(bx-tw/2)+'px;top:'+(by-th/2)+'px;width:'+tw+'px;height:'+th+'px;z-index:810;pointer-events:none;transform-origin:center center;box-shadow:0 2px 0 #6b5535;border-radius:3px;transform:scale(0.1);';
      layer.appendChild(clone);

      var cpx = (bx + tx) / 2 + (Math.random() - 0.5) * 130;
      var cpy = Math.min(by, ty) - 65 - Math.random() * 80;
      var dist = Math.sqrt((tx - bx) * (tx - bx) + (ty - by) * (ty - by));
      var flightDur = 300 + dist * 0.32;
      var startRot = (Math.random() - 0.5) * 320;

      var delay = staggerT * Math.sqrt(idx / N); // sqrt stagger — fast burst, slows as bag empties
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
          clone.style.transform = 'scale('+(0.1 + e * 0.9)+') rotate('+(startRot * (1 - e))+'deg)';
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

  bagEl.classList.add('bag-vacuuming');
  var shuffled = shuffle(tiles.slice());

  _burstTilesFromBag(shuffled, bx, by, 900, function() {
    bagEl.classList.remove('bag-vacuuming');
    setTimeout(onDone, 80); // brief pause before hand tiles burst
  });
}

function _burstHandTiles() {
  var layer = document.getElementById('anim-layer');
  layer.innerHTML = '';

  var bagEl = document.getElementById('bag-btn');
  var bagR = bagEl.getBoundingClientRect();
  var bx = bagR.left + bagR.width / 2;
  var by = bagR.top + bagR.height / 2;

  var area = document.getElementById('hand-area');
  var handEls = Array.prototype.slice.call(area.querySelectorAll('.hand-tile'));
  var N = handEls.length;
  if (N === 0) return;

  bagEl.classList.add('bag-vacuuming');

  _burstTilesFromBag(handEls, bx, by, 180, function() {
    bagEl.classList.remove('bag-vacuuming');
  });
}

function animBoardZoomIn(half, onDone) {
  var boardEl = document.getElementById('board-wrap');
  var boardAreaEl = boardEl.parentNode;
  var r = boardEl.getBoundingClientRect();
  var W = r.width, BH = r.height;

  var sz = (BH - 42) / 15;
  var foldLine = Math.round(half === 'top' ? (21 + 8 * sz) : (19 + 7 * sz));

  // No pointer-events:none — right-panel z-index is elevated by zoomBoard() in ui.js
  var clipEl = document.createElement('div');
  clipEl.style.cssText = [
    'position:fixed', 'left:' + r.left + 'px', 'top:' + r.top + 'px',
    'width:' + (window.innerWidth - r.left) + 'px', 'height:' + BH + 'px',
    'overflow:hidden', 'z-index:800'
  ].join(';');
  document.body.appendChild(clipEl);

  var scaleEl = document.createElement('div');
  scaleEl.style.cssText = 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + BH + 'px;transform-origin:left top;';
  clipEl.appendChild(scaleEl);

  var perspEl = document.createElement('div');
  perspEl.style.cssText = [
    'position:absolute', 'left:0', 'top:0',
    'width:' + W + 'px', 'height:' + BH + 'px',
    'perspective:' + (BH * 1.1) + 'px',
    'perspective-origin:50% ' + foldLine + 'px'
  ].join(';');
  scaleEl.appendChild(perspEl);

  function makeCloneHalf(isTop) {
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

  var topWrap = makeCloneHalf(true);
  var botWrap = makeCloneHalf(false);
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

  function makeCloneHalf(isTop) {
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

  var topWrap = makeCloneHalf(true);
  var botWrap = makeCloneHalf(false);
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

  var fillScale = fold.fillScale;
  var dur = 950;
  var start = performance.now();

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

    topWrap.style.transform = 'rotateX('+(-e * 90)+'deg)';
    botWrap.style.transform = 'rotateX('+(e * 90)+'deg)';
    perspCont.style.transform = 'scale('+(1 + eScale * (fillScale - 1))+')';

    if (t < 1) { requestAnimationFrame(step); return; }

    onDone(); // shop renders behind still-visible overlay
    var fo = performance.now();
    function fadeOverlay(n) {
      var ft = Math.min(1, (n - fo) / 120);
      perspCont.style.opacity = (1 - ft) + '';
      if (ft < 1) { requestAnimationFrame(fadeOverlay); return; }
      fold.cleanup();
    }
    requestAnimationFrame(fadeOverlay);
  }
  requestAnimationFrame(step);
}
