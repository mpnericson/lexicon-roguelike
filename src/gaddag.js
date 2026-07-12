// =====================================================================
// GADDAG — compact word index for the solver (Gordon 1994)
//
// For every word and every split i (1..L) the sequence
//   REV(word[0..i]) [+ '>' + word[i..L]]
// is inserted and end-flagged. The solver starts at a board anchor,
// walks the reversed prefix leftwards, switches direction on '>', and
// extends rightwards — generating only words that fit the board and rack
// instead of scanning the whole dictionary.
//
// Storage is a flat Int32Array (object nodes cost ~5× more memory):
// node k occupies arr[k*3 .. k*3+2]:
//   arr[k*3]   char code (65-90 letters, 62 for '>') | 256 end-of-word flag
//   arr[k*3+1] first child node index (0 = none)
//   arr[k*3+2] next sibling node index (0 = none)
// Node 0 is the root. ~178k words → ~4.2M nodes ≈ 50MB, ~0.5s build.
//
// GADDAG stays null until the chunked build finishes; solver entry points
// must check it.
// =====================================================================

var GADDAG = null;
var GD_SW = 62;   // '>' direction switch
var GD_END = 256; // end-of-word flag bit

function _gdBuilder() {
  var cap = 1 << 20, arr = new Int32Array(cap * 3), count = 1; // node 0 = root
  function child(n, c) {
    var k = arr[n * 3 + 1];
    while (k) { if ((arr[k * 3] & 255) === c) return k; k = arr[k * 3 + 2]; }
    if (count >= cap) { cap *= 2; var a = new Int32Array(cap * 3); a.set(arr); arr = a; }
    k = count++;
    arr[k * 3] = c; arr[k * 3 + 1] = 0; arr[k * 3 + 2] = arr[n * 3 + 1];
    arr[n * 3 + 1] = k;
    return k;
  }
  return {
    insertWord: function (w) {
      var L = w.length;
      for (var i = 1; i <= L; i++) {
        var n = 0;
        for (var j = i - 1; j >= 0; j--) n = child(n, w.charCodeAt(j));
        if (i < L) {
          n = child(n, GD_SW);
          for (var j2 = i; j2 < L; j2++) n = child(n, w.charCodeAt(j2));
        }
        arr[n * 3] |= GD_END;
      }
    },
    finish: function () { return { arr: arr.slice(0, count * 3), nodes: count }; }
  };
}

// Synchronous build from a word array — used by tests and small lists.
function buildGaddagSync(words) {
  var b = _gdBuilder();
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    if (w.length >= 2 && w.length <= B) b.insertWord(w.toUpperCase());
  }
  GADDAG = b.finish();
  return GADDAG;
}

// Chunked build from DICT (Set of uppercase words) — keeps the UI responsive.
// Call after loadDict(); onDone fires once GADDAG is ready.
function buildGaddag(dictSet, onDone) {
  if (!dictSet) { if (onDone) onDone(); return; }
  var words = [];
  dictSet.forEach(function (w) { if (w.length >= 2 && w.length <= B) words.push(w); });
  var b = _gdBuilder(), i = 0, CHUNK = 6000;
  function step() {
    var end = Math.min(i + CHUNK, words.length);
    for (; i < end; i++) b.insertWord(words[i]);
    if (i < words.length) setTimeout(step, 0);
    else { GADDAG = b.finish(); if (onDone) onDone(); }
  }
  setTimeout(step, 0);
}

function gdChild(n, c) {
  var arr = GADDAG.arr, k = arr[n * 3 + 1];
  while (k) { if ((arr[k * 3] & 255) === c) return k; k = arr[k * 3 + 2]; }
  return 0;
}
function gdEnd(n) { return (GADDAG.arr[n * 3] & GD_END) !== 0; }
