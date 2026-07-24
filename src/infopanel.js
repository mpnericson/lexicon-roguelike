// =====================================================================
// RUN INFO / MENU rising popup.
//
// Reuses the end-of-round panel art (Assets/sprites/endRoundDisplay, 18
// frames) for the rise/descend animation — the SAME popup used when a round
// completes — but shows tabbed content instead of a score breakdown:
//   • Run Info  — Progress (board targets + constraints, default) and Words
//                 (every word played this run, sortable like the dictionary).
//   • Menu      — the old dropdown's options as a hub of buttons, with
//                 Give Up Run centred at the bottom.
// Both share #info-modal; a Back button slides the panel back down.
// =====================================================================
var _IP_FRAMES = 18;
var _ipTimers = [];
var _ipRisen = false;
var _ipMode = null;          // 'run' | 'menu' | null — which popup is showing
var _ipWordSort = 'alpha';   // 'alpha' | 'length' | 'score'
var _ipRunTab = 'progress';  // 'progress' | 'words'
var _ipMenuView = null;      // null (Menu hub) | 'collection' | 'achievements'
var _ipCollSection = null;   // null (Collection hub) | section key

function _ipFrameSrc(n){
  return (typeof _rdFrameSrc === 'function')
    ? _rdFrameSrc(n)
    : 'Assets/sprites/endRoundDisplay/end_round_display' + n + '.png';
}
function _ipBuildFrames(){
  var host = document.getElementById('info-frames');
  if(!host || host.children.length === _IP_FRAMES) return;
  host.innerHTML = '';
  for(var i = 1; i <= _IP_FRAMES; i++){
    var im = document.createElement('img');
    im.className = 'rd-frame'; im.alt = ''; im.src = _ipFrameSrc(i);
    host.appendChild(im);
  }
}
function _ipShowFrame(n){
  var host = document.getElementById('info-frames'); if(!host) return;
  var kids = host.children;
  for(var i = 0; i < kids.length; i++){
    var on = (i === n - 1);
    if(on !== kids[i].classList.contains('on')) kids[i].classList.toggle('on', on);
  }
}
function _ipClear(){ for(var i = 0; i < _ipTimers.length; i++) clearTimeout(_ipTimers[i]); _ipTimers = []; }

// Rise the panel from the bottom (frames 1→18), then fade the content in.
function _ipRise(onRisen){
  _ipClear();
  var modal = document.getElementById('info-modal');
  var content = document.getElementById('info-panel-content');
  _ipBuildFrames(); _ipShowFrame(1);
  content.classList.remove('rg-content-show'); content.classList.remove('rd-blink-out');
  modal.style.display = 'flex';
  _ipRisen = true;
  var n = 1;
  (function up(){
    _ipShowFrame(n);
    if(n >= _IP_FRAMES){
      _ipTimers.push(setTimeout(function(){
        content.classList.add('rg-content-show'); if(onRisen) onRisen();
      }, AT(120)));
      return;
    }
    n++; _ipTimers.push(setTimeout(up, AT(24)));
  })();
}

// Back button: fade the content, then slide the panel down (frames 18→1).
function closeInfoPanel(onDone){
  var modal = document.getElementById('info-modal');
  if(typeof _collTipHide === 'function') _collTipHide();
  if(!_ipRisen){ if(modal) modal.style.display = 'none'; _ipMode = null; if(onDone) onDone(); return; }
  _ipClear();
  _ipMode = null;
  var content = document.getElementById('info-panel-content');
  content.classList.remove('rg-content-show');
  _ipTimers.push(setTimeout(function(){
    var n = _IP_FRAMES;
    (function down(){
      _ipShowFrame(n);
      if(n <= 1){
        _ipTimers.push(setTimeout(function(){
          modal.style.display = 'none'; _ipRisen = false; if(onDone) onDone();
        }, AT(60)));
        return;
      }
      n--; _ipTimers.push(setTimeout(down, AT(24)));
    })();
  }, AT(180)));
}

// Open a popup, or collapse it if the same one's button is pressed again. If the
// OTHER popup is already up, slide it back down first, then rise the new one.
function _ipToggle(mode, render){
  if(_ipRisen && _ipMode === mode){ closeInfoPanel(); return; }
  if(_ipRisen){
    closeInfoPanel(function(){ _ipMode = mode; render(); _ipRise(); });
    return;
  }
  _ipMode = mode;
  render();
  _ipRise();
}

// Launch a full-screen feature (Collection, Settings, a new run …) from the
// Menu: the target modal covers the board, so just hide the panel instantly.
function _ipLaunch(fn){
  _ipClear();
  var modal = document.getElementById('info-modal');
  if(modal) modal.style.display = 'none';
  _ipRisen = false; _ipMode = null;
  if(typeof fn === 'function') fn();
}

// ── Shared chrome ──────────────────────────────────────────────────
function _ipSetTitle(t){ var el = document.getElementById('info-title'); if(el) el.textContent = t; }
function _ipMkBtn(cls, label, onClick){
  var b = document.createElement('button'); b.className = cls; b.textContent = label;
  b.onclick = onClick; return b;
}
// Context-aware Back: step up one level inside the Menu (section → Collection
// hub → Menu hub); otherwise slide the whole panel back down.
function _ipBack(){
  if(_ipMode === 'menu' && _ipMenuView === 'collection' && _ipCollSection){ _ipCollSection = null; _ipRenderMenu(); return; }
  if(_ipMode === 'menu' && _ipMenuView){ _ipMenuView = null; _ipCollSection = null; _ipRenderMenu(); return; }
  closeInfoPanel();
}

// =====================================================================
// RUN INFO
// =====================================================================
function openRunInfo(){
  _ipToggle('run', function(){ _ipRunTab = 'progress'; _ipRenderRunInfo(); });
}
function _ipRenderRunInfo(){
  _ipSetTitle('Run Info');
  var tabs = document.getElementById('info-tabs');
  tabs.style.display = 'flex';
  tabs.innerHTML = '';
  var defs = [['progress','Progress'], ['words','Words']];
  for(var i = 0; i < defs.length; i++){(function(d){
    var t = _ipMkBtn('ip-tab' + (_ipRunTab === d[0] ? ' active' : ''), d[1], function(){
      _ipRunTab = d[0]; _ipRenderRunInfo();
    });
    tabs.appendChild(t);
  })(defs[i]);}
  var footer = document.getElementById('info-footer');
  footer.innerHTML = '';
  footer.appendChild(_ipMkBtn('ip-back-btn', '← Back', _ipBack));
  var body = document.getElementById('info-body');
  body.innerHTML = '';
  body.scrollTop = 0;
  if(_ipRunTab === 'words') _ipRenderWords(body);
  else _ipRenderProgress(body);
}

function _ipConstraintDef(id){
  if(!id || typeof CONSTRAINTS === 'undefined') return null;
  for(var i = 0; i < CONSTRAINTS.length; i++) if(CONSTRAINTS[i].id === id) return CONSTRAINTS[i];
  return null;
}

// Progress tab — every board's round targets, marking done / current / future,
// with the boss-round constraint shown under round 3 of each board.
function _ipRenderProgress(body){
  var endless = !!(S && S.endless);
  // One block per base board; endless appends the active endless board.
  function boardBlock(title, rounds, constraintDef, boardDone, curRound){
    // rounds: [target,target,target]. curRound = index of the current round in
    // this block (or -1). boardDone = whole block already cleared.
    var wrap = document.createElement('div'); wrap.className = 'ip-prog-board';
    var head = document.createElement('div'); head.className = 'ip-prog-board-head'; head.textContent = title;
    wrap.appendChild(head);
    for(var r = 0; r < rounds.length; r++){
      var state;
      if(boardDone) state = 'done';
      else if(curRound < 0) state = 'future';    // an as-yet-unreached board
      else if(r < curRound) state = 'done';
      else if(r === curRound) state = 'current';
      else state = 'future';
      var row = document.createElement('div'); row.className = 'ip-prog-row ' + state;
      var mark = document.createElement('span'); mark.className = 'ip-prog-mark';
      mark.textContent = state === 'done' ? '✓' : (state === 'current' ? '▶' : '·');
      var name = document.createElement('span'); name.className = 'ip-prog-name';
      name.textContent = 'Round ' + (r + 1) + (r === 2 ? ' — Constraint' : '');
      var tg = document.createElement('span'); tg.className = 'ip-prog-tgt';
      if(state === 'current' && typeof tgt === 'function') tg.textContent = fmtNum(S.score) + ' / ' + fmtNum(tgt());
      else tg.textContent = fmtNum(rounds[r]);
      row.appendChild(mark); row.appendChild(name); row.appendChild(tg);
      wrap.appendChild(row);
      if(r === 2 && constraintDef){
        var con = document.createElement('div'); con.className = 'ip-prog-con';
        con.innerHTML = '<b>' + constraintDef.name + '</b> — ' + constraintDef.desc;
        wrap.appendChild(con);
      }
    }
    body.appendChild(wrap);
  }

  // Only the board the player is currently on.
  if(endless && typeof endlessBoard === 'function' && typeof endlessTgt === 'function'){
    var eb = endlessBoard();
    var er = [endlessTgt(eb, 0), endlessTgt(eb, 1), endlessTgt(eb, 2)];
    // No constraint list for endless bosses (currentConstraint returns null).
    boardBlock('Endless — Board ' + (eb + 1), er, null, false, S.bi);
  } else {
    var a = S.ai;
    var rounds = [BOARDS[a][0][2], BOARDS[a][1][2], BOARDS[a][2][2]];
    var cdef = (S && S.constraintOrder) ? _ipConstraintDef(S.constraintOrder[a]) : null;
    boardBlock('Board ' + (a + 1), rounds, cdef, false, S.bi);
  }
}

// Words tab — every distinct main word played this run, sortable like the
// dictionary (A–Z / Length / High Score).
function _ipRenderWords(body){
  var words = (S && S.runWords) ? S.runWords.slice() : [];
  var sub = document.createElement('div'); sub.className = 'ip-words-sub';
  sub.textContent = words.length + (words.length === 1 ? ' word played this run. Sort by:' : ' words played this run. Sort by:');
  body.appendChild(sub);

  var sortRow = document.createElement('div');
  sortRow.style.cssText = 'display:flex;justify-content:center;gap:8px;margin-bottom:10px;flex-wrap:wrap';
  var sdefs = [['alpha','A–Z'], ['length','Length'], ['score','High Score']];
  for(var i = 0; i < sdefs.length; i++){(function(d){
    var b = _ipMkBtn('ip-tab' + (_ipWordSort === d[0] ? ' active' : ''), d[1], function(){
      _ipWordSort = d[0]; _ipRenderRunInfo();
    });
    sortRow.appendChild(b);
  })(sdefs[i]);}
  body.appendChild(sortRow);

  if(!words.length){
    var e = document.createElement('div'); e.className = 'ip-empty';
    e.textContent = 'No words played yet this run.';
    body.appendChild(e);
    return;
  }
  if(_ipWordSort === 'score') words.sort(function(a, b){ return b.pts - a.pts || a.word.localeCompare(b.word); });
  else if(_ipWordSort === 'length') words.sort(function(a, b){ return a.word.length - b.word.length || a.word.localeCompare(b.word); });
  else words.sort(function(a, b){ return a.word.localeCompare(b.word); });

  for(var j = 0; j < words.length; j++){
    var w = words[j];
    var row = document.createElement('div'); row.className = 'ip-word-row';
    var ws = document.createElement('span'); ws.className = 'ip-word-w'; ws.textContent = w.word;
    var xs = document.createElement('span'); xs.className = 'ip-word-x'; xs.textContent = (w.count > 1 ? '×' + w.count : '');
    var ps = document.createElement('span'); ps.className = 'ip-word-pts'; ps.textContent = fmtNum(w.pts) + ' pts';
    row.appendChild(ws); row.appendChild(xs); row.appendChild(ps);
    body.appendChild(row);
  }
}

// =====================================================================
// MENU
// =====================================================================
function openMenuPanel(){
  _ipToggle('menu', function(){ _ipMenuView = null; _ipCollSection = null; _ipRenderMenu(); });
}
// Dispatcher: the Menu hub, or the Collection / Achievements sub-views embedded
// in the panel.
function _ipRenderMenu(){
  document.getElementById('info-tabs').style.display = 'none';
  if(typeof _collTipHide === 'function') _collTipHide();  // never leave a stale entry tooltip up
  if(_ipMenuView === 'collection'){ _ipRenderCollection(); return; }
  if(_ipMenuView === 'achievements'){ _ipRenderAchievements(); return; }
  if(_ipMenuView === 'settings'){ _ipRenderSettings(); return; }
  _ipRenderMenuHub();
}
function _ipRenderMenuHub(){
  _ipSetTitle('Menu');
  var body = document.getElementById('info-body');
  body.innerHTML = '';
  body.scrollTop = 0;
  var hub = document.createElement('div'); hub.id = 'info-hub';

  function hubBtn(label, val, onClick, extraCls){
    var b = document.createElement('button');
    b.className = 'ip-hub-btn' + (extraCls ? ' ' + extraCls : '');
    b.innerHTML = '<span>' + label + '</span>' + (val ? '<span class="ip-hub-val">' + val + '</span>' : '');
    b.onclick = onClick;
    hub.appendChild(b);
  }

  // Collection + Achievements navigate WITHIN the panel (no re-rise).
  hubBtn('Collection', '', function(){ _ipMenuView = 'collection'; _ipCollSection = null; _ipRenderMenu(); });
  hubBtn('Achievements', '', function(){ _ipMenuView = 'achievements'; _ipRenderMenu(); });
  hubBtn('Tutorial', '', function(){ _ipLaunch(startTutorial); });
  hubBtn('Settings', '', function(){ _ipMenuView = 'settings'; _ipRenderMenu(); });
  hubBtn('Tips', (typeof TIPS_ON !== 'undefined' && TIPS_ON) ? 'ON' : 'Off', function(){ toggleTips(); _ipRenderMenu(); });
  hubBtn('Dev Mode', (S && S.devMode) ? 'ON' : 'Off', function(){ toggleDevMode(); _ipRenderMenu(); });
  hubBtn('New Seeded Run', 'Seed: ' + ((S && S.seed) || '—'), function(){ _ipLaunch(seedRun); });
  hubBtn('New Random Run', '', function(){ _ipLaunch(function(){ startGame(); }); });
  if(S && S.devMode){
    hubBtn('▶ Enter Shop', 'dev', function(){ _ipLaunch(enterShopPhase); }, 'dev-only-hub');
    hubBtn('▶ Anim: Board → Shop', 'dev', function(){ _ipLaunch(devTestClose); }, 'dev-only-hub');
    hubBtn('▶ Anim: Shop → Board', 'dev', function(){ _ipLaunch(devTestOpen); }, 'dev-only-hub');
  }
  body.appendChild(hub);

  // Version line under the hub.
  var ver = document.createElement('div');
  ver.style.cssText = 'text-align:center;color:#c8a878;font-size:clamp(13px,1.5vw,22px);margin-top:14px';
  ver.textContent = 'v' + (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '?');
  body.appendChild(ver);

  // Footer: Give Up Run centred, Back on the left.
  var footer = document.getElementById('info-footer');
  footer.innerHTML = '';
  footer.appendChild(_ipMkBtn('ip-back-btn', '← Back', _ipBack));
  footer.appendChild(_ipMkBtn('ip-giveup-btn', 'Give Up Run', function(){ _ipLaunch(giveUpRun); }));
}

// ── Collection (embedded) — reuses the Collection data helpers + .coll-* CSS.
// Hub of section buttons; clicking one shows that section's grid. Dictionary is
// its own modal, so it still launches out of the panel.
function _ipRenderCollection(){
  if(typeof discoveryScan === 'function') discoveryScan();
  var footer = document.getElementById('info-footer');
  footer.innerHTML = '';
  footer.appendChild(_ipMkBtn('ip-back-btn', '← Back', _ipBack));
  var body = document.getElementById('info-body');
  body.innerHTML = ''; body.scrollTop = 0;
  var devAll = !!(S && S.devMode);
  var secs = (typeof _collSections === 'function') ? _collSections() : [];

  if(_ipCollSection === 'dictionary'){ _ipRenderDictionary(); return; }
  if(_ipCollSection){
    var sec = null;
    for(var i = 0; i < secs.length; i++) if(secs[i].key === _ipCollSection){ sec = secs[i]; break; }
    if(!sec){ _ipCollSection = null; _ipRenderCollection(); return; }
    _ipSetTitle(sec.label);
    var c = _collSectionCount(sec, devAll);
    var sub = document.createElement('div'); sub.className = 'ip-words-sub';
    sub.textContent = (devAll ? 'Dev mode — all unlocked · ' : '') + c.have + ' / ' + c.total + ' unlocked. Hover an entry for its description.';
    body.appendChild(sub);
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px';
    var items = sec.items();
    for(var j = 0; j < items.length; j++){(function(d){
      var unlocked = devAll || discHas(sec.cat, sec.id(d));
      var cell = document.createElement('div'); cell.className = 'coll-cell' + (unlocked ? '' : ' locked');
      if(unlocked){
        var rcol = _collRarityColor(d.rarity);
        var nameStyle = rcol ? ' style="color:' + rcol + (d.rarity === 'legendary' ? ';text-shadow:0 0 8px rgba(255,180,0,0.7)' : '') + '"' : '';
        cell.innerHTML = '<div class="coll-cell-icon">' + sec.icon(d, 64) + '</div>'
          + '<div class="coll-cell-name"' + nameStyle + '>' + d.name + '</div>';
        var fg = d.fg || '#e8e0d0', nm = d.name, desc = d.desc || '';
        cell.onmouseenter = function(){ _collTipShow(cell, nm, desc, fg); };
        cell.onmouseleave = _collTipHide;
      } else {
        cell.innerHTML = '<div class="coll-cell-icon coll-cell-locked">?</div><div class="coll-cell-name">???</div>';
      }
      grid.appendChild(cell);
    })(items[j]);}
    body.appendChild(grid);
  } else {
    _ipSetTitle('Collection');
    var hub = document.createElement('div');
    hub.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:12px';
    for(var k = 0; k < secs.length; k++){(function(sec){
      var btn = document.createElement('button'); btn.className = 'coll-hub-btn';
      var count = '';
      if(sec.special === 'dictionary') count = (typeof _wordbook !== 'undefined') ? (Object.keys(_wordbook).length + ' words') : '';
      else { var cc = _collSectionCount(sec, devAll); count = cc.have + ' / ' + cc.total; }
      btn.innerHTML = '<span class="coll-hub-label">' + sec.label + '</span><span class="coll-hub-count">' + count + '</span>';
      btn.onclick = function(){ _ipCollSection = sec.key; _ipRenderCollection(); };
      hub.appendChild(btn);
    })(secs[k]);}
    body.appendChild(hub);
  }
}

// ── Achievements (embedded) — reuses ACHIEVEMENTS + _achvStore + .achv-* CSS.
function _ipRenderAchievements(){
  var footer = document.getElementById('info-footer');
  footer.innerHTML = '';
  footer.appendChild(_ipMkBtn('ip-back-btn', '← Back', _ipBack));
  var body = document.getElementById('info-body');
  body.innerHTML = ''; body.scrollTop = 0;
  var defs = (typeof ACHIEVEMENTS !== 'undefined') ? ACHIEVEMENTS : [];
  var list = document.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:8px';
  var unlocked = 0;
  for(var i = 0; i < defs.length; i++){
    var a = defs[i];
    var done = !!(typeof _achvStore !== 'undefined' && _achvStore[a.id]);
    if(done) unlocked++;
    var el = document.createElement('div');
    el.className = 'achv-item' + (done ? ' achv-done' : '');
    el.innerHTML = '<span class="achv-icon">' + (done ? a.icon : '🔒') + '</span>'
      + '<div><div class="achv-name">' + a.name + '</div>'
      + '<div class="achv-desc">' + (done ? a.desc : '???') + '</div></div>';
    list.appendChild(el);
  }
  _ipSetTitle('Achievements (' + unlocked + ' / ' + defs.length + ')');
  body.appendChild(list);
}

// ── Dictionary (embedded) — the Collection's "dictionary" section, reusing the
// wordbook data + list builder + .wb-* CSS. Sort mirrors the standalone modal.
function _ipRenderDictionary(){
  var footer = document.getElementById('info-footer');
  footer.innerHTML = '';
  footer.appendChild(_ipMkBtn('ip-back-btn', '← Back', _ipBack));
  var body = document.getElementById('info-body');
  body.innerHTML = ''; body.scrollTop = 0;
  var entries = (typeof _wordbookEntries === 'function') ? _wordbookEntries() : [];
  _ipSetTitle('Dictionary (' + entries.length + ' word' + (entries.length === 1 ? '' : 's') + ')');

  var sortRow = document.createElement('div');
  sortRow.style.cssText = 'display:flex;justify-content:center;gap:8px;margin-bottom:8px;flex-wrap:wrap';
  var sdefs = [['alpha','A–Z'], ['length','Length'], ['score','High Score']];
  for(var i = 0; i < sdefs.length; i++){(function(d){
    var b = _ipMkBtn('ip-tab' + ((typeof _wbSort !== 'undefined' && _wbSort === d[0]) ? ' active' : ''), d[1], function(){
      if(typeof _wbSort !== 'undefined') _wbSort = d[0];
      _ipRenderDictionary();
    });
    sortRow.appendChild(b);
  })(sdefs[i]);}
  body.appendChild(sortRow);

  var total = (typeof _wordbookTotalPlayable === 'function') ? _wordbookTotalPlayable() : 0;
  var pct = total > 0 ? Math.min(100, (entries.length / total) * 100) : 0;
  var sub = document.createElement('div'); sub.className = 'ip-words-sub';
  sub.textContent = total > 0
    ? (entries.length.toLocaleString() + ' / ' + total.toLocaleString() + ' words discovered · ' + _wbFmtPct(pct))
    : 'Every word you\'ve played, with its best score.';
  body.appendChild(sub);

  var list = document.createElement('div');
  list.innerHTML = (typeof _wordbookListHtml === 'function') ? _wordbookListHtml() : '';
  body.appendChild(list);
}

// ── Settings (embedded) — panel-native volume + animation-speed sliders wired
// straight to SETTINGS (own ids so they don't collide with the modal sliders).
function _ipRenderSettings(){
  _ipSetTitle('Settings');
  var footer = document.getElementById('info-footer');
  footer.innerHTML = '';
  footer.appendChild(_ipMkBtn('ip-back-btn', '← Back', _ipBack));
  var body = document.getElementById('info-body');
  body.innerHTML = ''; body.scrollTop = 0;
  var wrap = document.createElement('div');
  wrap.style.cssText = 'max-width:560px;margin:0 auto;padding-top:6px';

  // Volume
  var vol = Math.round((SETTINGS.volume || 0) * 100);
  var vr = document.createElement('div'); vr.className = 'set-row';
  vr.innerHTML = '<div class="set-label">Volume <span class="set-val" id="ip-set-vol-val">' + vol + '%</span></div>';
  var vi = document.createElement('input');
  vi.className = 'set-slider'; vi.type = 'range'; vi.min = 0; vi.max = 100; vi.step = 1; vi.value = vol;
  vi.oninput = function(){
    var v = Math.max(0, Math.min(100, parseInt(this.value, 10) || 0));
    document.getElementById('ip-set-vol-val').textContent = v + '%';
    if(typeof setVolume === 'function') setVolume(v / 100);
    if(typeof _playTileClick === 'function') _playTileClick('select');
  };
  vr.appendChild(vi); wrap.appendChild(vr);

  // Animation speed
  var speeds = (typeof _ANIM_SPEEDS !== 'undefined') ? _ANIM_SPEEDS : [0.5, 1, 2, 4];
  var ai = speeds.indexOf(SETTINGS.animSpeed); if(ai < 0) ai = 1;
  var ar = document.createElement('div'); ar.className = 'set-row';
  ar.innerHTML = '<div class="set-label">Animation Speed <span class="set-val" id="ip-set-anim-val">' + speeds[ai] + '×</span></div>';
  var aii = document.createElement('input');
  aii.className = 'set-slider'; aii.type = 'range'; aii.min = 0; aii.max = speeds.length - 1; aii.step = 1; aii.value = ai;
  aii.oninput = function(){
    var i = Math.max(0, Math.min(speeds.length - 1, parseInt(this.value, 10) || 0));
    SETTINGS.animSpeed = speeds[i];
    if(typeof saveSettings === 'function') saveSettings();
    document.getElementById('ip-set-anim-val').textContent = speeds[i] + '×';
  };
  ar.appendChild(aii);
  var ticks = document.createElement('div'); ticks.className = 'set-ticks';
  ticks.innerHTML = '<span>0.5×</span><span>1×</span><span>2×</span><span>4×</span>';
  ar.appendChild(ticks);
  wrap.appendChild(ar);

  body.appendChild(wrap);
}
