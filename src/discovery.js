// =====================================================================
// DISCOVERY — cross-run "almanac" tracking for the Collection hub.
// Records which stamps/stickers/tickets/keys/materials/coloured tiles you
// have ever obtained, plus which constraints/bounty themes you have
// completed. Persists in localStorage (separate from the run save) so the
// Collection can reveal unlocked entries and show "?" placeholders for the
// rest. Dev mode treats everything as unlocked (see collGridRender).
//
// Also home to the SHARED hover-description tooltip positioner
// (positionDescTip) — every hover-to-description popup in the game floats to
// the LEFT of the hovered element, vertically centred (flip to the right if
// there is no room on the left).
// =====================================================================

var DISCOVERY_KEY = 'lexicon_discovery';
// One bag per category → { id: 1 } sets of discovered ids.
var DISC = {stamps:{}, stickers:{}, tickets:{}, keys:{}, materials:{}, colors:{}, constraints:{}, bounties:{}};

function discoveryInit() {
  try {
    var raw = JSON.parse(localStorage.getItem(DISCOVERY_KEY) || '{}');
    for (var k in DISC) if (DISC.hasOwnProperty(k) && raw[k] && typeof raw[k] === 'object') DISC[k] = raw[k];
  } catch (e) { /* leave defaults */ }
}

function _discSave() {
  try { localStorage.setItem(DISCOVERY_KEY, JSON.stringify(DISC)); } catch (e) {}
}

function discMark(cat, id) {
  if (id == null) return;
  if (!DISC[cat]) DISC[cat] = {};
  if (DISC[cat][id]) return;
  DISC[cat][id] = 1;
  _discSave();
}

function discHas(cat, id) { return !!(DISC[cat] && DISC[cat][id]); }

// SQ classification (mirrors the collection filters): stamps live in the bar,
// stickers go on the board.
function _isStampDef(d)   { return d && d.type === 'stamp'; }
function _isStickerDef(d) { return d && (d.type === 'board' || d.type === 'local'); }

// Scan current game state and record everything currently owned/present.
// Cheap and idempotent — safe to call from saveGame and when the Collection
// opens. Consumables that are used straight out of a pack never sit in the
// inventory, so they are also marked at use time (see consumables.js).
function discoveryScan() {
  if (typeof S === 'undefined' || !S) return;
  var changed = false;
  function mk(cat, id) {
    if (id == null) return;
    if (!DISC[cat]) DISC[cat] = {};
    if (!DISC[cat][id]) { DISC[cat][id] = 1; changed = true; }
  }
  (S.stamps || []).forEach(function (t) { mk('stamps', t.id); });
  (S.stickerInventory || []).forEach(function (s) { mk('stickers', s.id); });
  (S.placed || []).forEach(function (p) { mk('stickers', p.id); });
  (S.consumables || []).forEach(function (c) {
    var d = (typeof tkd === 'function') ? tkd(c.id) : null;
    if (d) mk(d.kind === 'key' ? 'keys' : 'tickets', c.id);
  });
  function scanTile(t) { if (!t) return; if (t.variant) mk('colors', t.variant); if (t.material) mk('materials', t.material); }
  (S.bag || []).forEach(scanTile);
  (S.hand || []).forEach(scanTile);
  (S.pool || []).forEach(scanTile);
  if (S.bt) for (var i = 0; i < S.bt.length; i++) { scanTile(S.bt[i]); if (S.btTop) scanTile(S.btTop[i]); }
  if (changed) _discSave();
}

function discMarkConstraint(id) { discMark('constraints', id); }
function discMarkBounty(theme)  { if (theme) discMark('bounties', theme); }
function discMarkTk(def) { if (def && def.id) discMark(def.kind === 'key' ? 'keys' : 'tickets', def.id); }

// ── Collection metadata: materials & coloured tiles ──────────────────────────
// Descriptions authored from the tile ruleset (CLAUDE.md). `color` is the
// placeholder swatch fill — trivially replaced by a PNG at
// Assets/collection/{colors|materials}/{id}.png (auto-detected below).
var COLL_COLORS = [
  {id:'red',    name:'Red Tile',    desc:'Adds +4 to the multiplier when scored.',                 color:'#e05050'},
  {id:'blue',   name:'Blue Tile',   desc:'Adds +10 to letter points when scored.',                 color:'#4a94e6'},
  {id:'gold',   name:'Gold Tile',   desc:'Every gold tile on the board pays $1 after each word.',   color:'#e0b040'},
  {id:'jade',   name:'Jade Tile',   desc:'Every jade tile on the board gives ×1.5 after each word.',color:'#2a9a5a'},
  {id:'purple', name:'Purple Tile', desc:'Scores ×2 — but has a 1-in-4 chance to vanish when played.',color:'#a050e0'}
];
var COLL_MATERIALS = [
  {id:'metallic',  name:'Metallic',  desc:'Scores an extra time on every pass, doubling its contribution.', color:'#b8c0cc'},
  {id:'glass',     name:'Glass',     desc:'After committing, click it to retrieve it back to your hand.',   color:'#bfe6ff'},
  {id:'varnished', name:'Varnished', desc:'Drawn from the bag before ordinary tiles (anchor priority).',    color:'#d8b483'}
];
// Placeholder emoji per constraint (swap for PNGs at Assets/collection/constraints/{id}.png).
var COLL_CONSTRAINT_ICONS = {
  c_long:'📏', c_pal:'🔄', c_longer:'📈', c_letters:'🔤', c_hand:'✋',
  c_draw3:'🐌', c_nodisc:'🚫', c_oneplay:'🎯', c_stickers:'⛔'
};

// Auto-detect real sprite PNGs for the placeholder categories (same pattern as
// stickers/stamps/consumables). Bounties are skipped — there are too many.
(function () {
  function detect(list, dir) {
    for (var i = 0; i < list.length; i++) (function (o) {
      var img = new Image();
      img.onload = function () { o.iconPng = 'Assets/collection/' + dir + '/' + o.id + '.png'; };
      img.src = 'Assets/collection/' + dir + '/' + o.id + '.png';
    })(list[i]);
  }
  detect(COLL_COLORS, 'colors');
  detect(COLL_MATERIALS, 'materials');
  if (typeof CONSTRAINTS !== 'undefined') detect(CONSTRAINTS.slice(), 'constraints');
})();

// ── Shared hover-description tooltip positioner ──────────────────────────────
// Positions a FIXED tooltip element to the LEFT of `triggerEl`, vertically
// centred on it. Flips to the right when there is no room on the left, and
// clamps to the viewport. Used by the shop, consumables, the Collection, and
// the in-board sticker/stamp tooltip so every description popup behaves alike.
function positionDescTip(el, triggerEl) {
  if (!el || !triggerEl) return;
  var tr = triggerEl.getBoundingClientRect();
  var w = el.offsetWidth, h = el.offsetHeight, gap = 10, m = 6;
  var top = (tr.top + tr.bottom) / 2 - h / 2;
  top = Math.max(m, Math.min(top, window.innerHeight - h - m));
  var left = tr.left - w - gap;
  if (left < m) {                       // no room on the left → flip right
    left = tr.right + gap;
    if (left + w > window.innerWidth - m) left = Math.max(m, (window.innerWidth - w) / 2);
  }
  el.style.left = Math.round(left) + 'px';
  el.style.top = Math.round(top) + 'px';
}
