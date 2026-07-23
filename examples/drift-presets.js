/**
 * Baked DriftBackground presets — settings + image, ready to "stick in the
 * background" with no UI.
 *
 * Each preset is { image, params } where:
 *   - `image`  is a URL relative to the page loading it (drop files in
 *              examples/backgrounds/ and reference them as 'backgrounds/<name>').
 *   - `params` is any DriftBackground option (see src/render/DriftBackground.js).
 *
 * To tune a preset: open examples/drift-background-demo.html, dial in the sliders,
 * then copy the numbers here. Palettes are ordered dark → light (load-bearing).
 */

// Classic script (no ES modules — the game runs on file://). Exposes globals
// `DRIFT_PRESETS` and `DRIFT_DEFAULT_PRESET`.
(function () {
'use strict';

const WOOD_RAMP = ['#452620', '#583028', '#663931', '#76473f', '#8f563b', '#c99263'];

const PRESETS = {
  // Subtle, readable ambient wash — gentle drift, palette tone, no CRT.
  woodWarm: {
    image: 'backgrounds/sample.png',
    params: {
      driftSpeed: 0.12, warp: 0.16, detail: 1.8, pixelSize: 1,
      contrast: 1.05, dither: 0.7, tone: 0.02,
      palette: WOOD_RAMP, autoLevels: true,
      crt: { enabled: false, amount: 0.6 },
    },
  },

  // Chunky retro look — pixelated, dithered ramp, CRT scanlines/mask on.
  retroCRT: {
    image: 'backgrounds/sample.png',
    params: {
      driftSpeed: 0.15, warp: 0.24, detail: 2.2, pixelSize: 4,
      contrast: 1.2, dither: 0.9, tone: 0.0,
      palette: WOOD_RAMP, autoLevels: true,
      crt: { enabled: true, amount: 0.6 },
    },
  },

  // Photographic — the raw image drifting, no palette quantization.
  cleanDrift: {
    image: 'backgrounds/sample.png',
    params: {
      driftSpeed: 0.10, warp: 0.14, detail: 1.6, pixelSize: 1,
      contrast: 1.0, dither: 0.0, tone: 0.0,
      palette: null, autoLevels: false,
      crt: { enabled: false, amount: 0.6 },
    },
  },
};

const DEFAULT_PRESET = 'woodWarm';

window.DRIFT_PRESETS = PRESETS;
window.DRIFT_DEFAULT_PRESET = DEFAULT_PRESET;
})();
