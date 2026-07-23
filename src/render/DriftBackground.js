/**
 * DriftBackground — an ambient WebGL2 "liquid drift" background engine.
 *
 * Takes a still image and makes it slowly drift and warp forever, then renders
 * it through a dithered, palette-quantized, optional-CRT pipeline. Three passes:
 *
 *   1. Flow field   — velocity = curl of 3D simplex noise (divergence-free, no
 *                     pressure solver). Eased toward the target each frame.
 *   2. Displacement — a persistent RG16F field of per-pixel UV offsets. Each
 *                     frame it is advected by the flow, has the flow accumulated
 *                     into it, then decays toward zero. The seed image is NEVER
 *                     resampled into a running buffer, so it never blurs.
 *   3. Display      — sample the pristine seed image ONCE at the displaced UV,
 *                     then (optionally) auto-level → tone-curve → ordered-dither
 *                     → quantize to a brightness-indexed palette ramp → CRT post.
 *
 * IMPORTANT — the palette is a VALUE RAMP indexed by luminance, NOT a
 * nearest-RGB match. The palette array MUST be ordered dark → light. Every entry
 * then owns an equal slice of the brightness range. An unordered palette
 * produces garbage, silently.
 *
 * This module is self-contained: no dependencies, no bundler, pure ES-module
 * vanilla JS. It renders to a <canvas> and does nothing else.
 *
 * NOTE — because it is delivered as an ES module, the demo (and any consumer)
 * must be loaded over http(s) or inside Electron, not opened as a bare file://
 * page (browsers block cross-file ES-module imports over file://).
 *
 * @example
 *   <!-- classic script tag: defines the global `DriftBackground` -->
 *   <script src="src/render/DriftBackground.js"></script>
 *   <script>
 *   const drift = new DriftBackground(document.getElementById('bg'), {
 *     driftSpeed: 0.15,
 *     warp: 0.35,
 *     detail: 2.0,
 *     pixelSize: 1,
 *     contrast: 1.0,
 *     dither: 0.9,
 *     tone: 0,
 *     palette: ['#452620', '#583028', '#663931', '#76473f', '#8f563b', '#c99263'],
 *     autoLevels: true,
 *     crt: { enabled: false, amount: 0.6 },
 *     onError: (err) => console.error(err),
 *   });
 *
 *   // Image | ImageBitmap | Canvas | Blob | URL (URLs load as data URLs)
 *   drift.setImage('assets/wood.jpg').then(() => drift.start());
 *
 *   drift.setParams({ warp: 0.6, pixelSize: 4, crt: { enabled: true } });
 *
 *   drift.stop();
 *   drift.destroy();
 *   </script>
 *
 * REMOVED since the previous version (these throw if passed, rather than being
 * silently ignored):
 *   - `flow`        → replaced by `warp` (displacement gain).
 *   - `persistence` → replaced by the internal `decay` constant.
 *   - `simResolution` / `dyeResolution` → the dye texture is gone; resolutions
 *     are the fixed internals below (velocity 150, displacement 360, seed 1280).
 *
 * LOADING — this is a classic (non-module) script: it defines a global
 * `window.DriftBackground`. That is deliberate, so it works inside the game's
 * `file://` Electron page (where ES-module imports are blocked) and matches the
 * codebase's all-globals, no-bundler convention. It also assigns
 * `module.exports` when present, so Node/tests can `require()` it.
 */

(function () {
'use strict';

// ---------------------------------------------------------------------------
// Internal constants (ported verbatim from the prototype)
// ---------------------------------------------------------------------------

const DT = 0.016;              // displacement integration step
const DECAY = 0.985;           // per-frame relaxation of the displacement field
const NOISE_STRENGTH = 3.0;    // curl → velocity magnitude
const GAIN_MULT = 60;          // warp → displacement gain: gain = warp * 60
const FLOW_BLEND = 0.55;       // ease velocity toward the noise target each frame

const VELOCITY_RES = 150;      // short-axis target for the velocity field
const DISPLACEMENT_RES = 360;  // short-axis target for the displacement field
const SEED_RES = 1280;         // short-axis target for the seed image (detail cap)

/** Default palette ramp — ordered dark → light. This ordering is load-bearing. */
const DEFAULT_PALETTE = ['#452620', '#583028', '#663931', '#76473f', '#8f563b', '#c99263'];

/** Params that existed in the old API and must now fail loudly. */
const REMOVED_PARAMS = {
  flow: 'use `warp` (displacement gain) instead',
  persistence: 'removed — the displacement field now decays via an internal constant',
  simResolution: 'removed — resolutions are fixed internals now',
  dyeResolution: 'removed — the dye texture no longer exists',
};

const DEFAULTS = {
  driftSpeed: 0.15,
  warp: 0.35,
  detail: 2.0,
  pixelSize: 1,
  contrast: 1.0,
  dither: 0.9,
  tone: 0,
  palette: DEFAULT_PALETTE,
  autoLevels: true,
  crt: { enabled: false, amount: 0.6 },
  pixelRatio: 1,
  onError: null,
};

// ---------------------------------------------------------------------------
// Shader sources (GLSL ES 3.00) — ported verbatim from fluid-pixel.html
// ---------------------------------------------------------------------------

const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv=aPos*0.5+0.5; gl_Position=vec4(aPos,0.0,1.0); }`;

const SNOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
    + i.y+vec4(0.0,i1.y,i2.y,1.0))
    + i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const F_FLOW = `#version 300 es
precision highp float; precision highp sampler2D;
in vec2 vUv; out vec4 o;
uniform sampler2D uVelocity;
uniform float uTime,uScale,uStrength,uBlend,uAspect;
${SNOISE}
vec2 curl(vec2 p,float t){
  float e=0.1;
  float a=snoise(vec3(p.x,p.y+e,t));
  float b=snoise(vec3(p.x,p.y-e,t));
  float c=snoise(vec3(p.x+e,p.y,t));
  float d=snoise(vec3(p.x-e,p.y,t));
  return vec2(a-b, d-c)/(2.0*e);
}
void main(){
  vec2 p=vUv; p.x*=uAspect;
  vec2 target=curl(p*uScale,uTime)*uStrength;
  o=vec4(mix(texture(uVelocity,vUv).xy,target,uBlend),0.0,1.0);
}`;

const F_DISP = `#version 300 es
precision highp float; precision highp sampler2D;
in vec2 vUv; out vec4 o;
uniform sampler2D uVelocity,uDisp;
uniform vec2 texelSize;
uniform float dt,gain,decay;
void main(){
  vec2 vel=texture(uVelocity,vUv).xy;
  vec2 d=texture(uDisp, vUv - dt*vel*texelSize).xy;
  d += vel*texelSize*dt*gain;
  o=vec4(d*decay,0.0,1.0);
}`;

/**
 * The display fragment shader bakes NP (palette length) and the PAL ramp as
 * compile-time constants, so it must be regenerated + relinked whenever the
 * palette length/contents change. Everything else is verbatim from the
 * prototype (bayer2, shade, CRT post).
 */
function buildDisplaySource(paletteFloats) {
  const NP = paletteFloats.length;
  const entries = paletteFloats
    .map((c) => `  vec3(${c[0].toFixed(4)},${c[1].toFixed(4)},${c[2].toFixed(4)})`)
    .join(',\n');
  return `#version 300 es
precision highp float; precision highp sampler2D;
in vec2 vUv; out vec4 o;
uniform sampler2D uDisp,uSeed;
uniform vec2 resolution;
uniform float pixelSize,paletteOn,contrast,dither,tone,loL,hiL,crtOn,crtAmt;
const int NP=${NP};
const vec3 PAL[${NP}]=vec3[${NP}](
${entries}
);
float bayer2(vec2 a){ a=floor(a); return fract(a.x/2.0+a.y*a.y*0.75); }
vec3 shade(vec2 p){
  vec2 px=vec2(max(pixelSize,1.0))/resolution;
  vec2 uv=(floor(p/px)+0.5)*px;
  vec2 d=texture(uDisp,uv).xy;
  vec3 c=texture(uSeed,clamp(uv+d,0.001,0.999)).rgb;
  if(paletteOn>0.5){
    float l=dot(c,vec3(0.2126,0.7152,0.0722));
    l=clamp((l-loL)/max(hiL-loL,0.001),0.0,1.0);
    l=clamp((l-0.5)*contrast+0.5+tone,0.0,1.0);
    vec2 bc=floor(p/px);
    float b8=bayer2(0.25*bc)*0.0625+bayer2(0.5*bc)*0.25+bayer2(bc);
    l=clamp(l+(b8-0.5)*dither/float(NP-1),0.0,1.0);
    int idx=int(floor(l*float(NP-1)+0.5));
    vec3 q=PAL[0];
    for(int i=0;i<NP;i++){ if(i==idx) q=PAL[i]; }
    c=q;
  }
  return c;
}
void main(){
  vec3 c;
  if(crtOn>0.5){
    float sp=(1.0+2.0*crtAmt)/resolution.x;
    c  = shade(vUv+vec2(-2.0*sp,0.0))*0.10;
    c += shade(vUv+vec2(-sp,0.0))*0.22;
    c += shade(vUv)*0.36;
    c += shade(vUv+vec2(sp,0.0))*0.22;
    c += shade(vUv+vec2(2.0*sp,0.0))*0.10;
    float sl=0.5+0.5*cos(vUv.y*resolution.y*3.14159265);
    c*=mix(1.0,0.72+0.28*sl,crtAmt);
    int m=int(mod(floor(vUv.x*resolution.x),3.0));
    vec3 mask=vec3(m==0?1.06:0.94, m==1?1.06:0.94, m==2?1.06:0.94);
    c*=mix(vec3(1.0),mask,crtAmt);
    vec2 v=vUv-0.5;
    c*=mix(1.0,1.0-dot(v,v)*0.75,crtAmt);
    c*=1.0+0.22*crtAmt;
  }else{
    c=shade(vUv);
  }
  o=vec4(c,1.0);
}`;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Parse a palette entry (`#rrggbb` string or `[r,g,b]` floats 0..1) → floats. */
function toRgbFloat(entry) {
  if (typeof entry === 'string') {
    let h = entry.trim().replace(/^#/, '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) {
      throw new Error('DriftBackground: invalid palette hex "' + entry + '"');
    }
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
    ];
  }
  if (Array.isArray(entry) && entry.length >= 3) {
    return [+entry[0] || 0, +entry[1] || 0, +entry[2] || 0];
  }
  throw new Error('DriftBackground: palette entries must be "#rrggbb" or [r,g,b] floats');
}

function normalizePalette(palette) {
  const src = (palette && palette.length) ? palette : DEFAULT_PALETTE;
  if (src.length < 2) {
    throw new Error('DriftBackground: palette needs at least 2 entries (ordered dark → light)');
  }
  return src.map(toRgbFloat);
}

function paletteSignature(floats) {
  return floats.map((c) => c.map((n) => n.toFixed(4)).join(',')).join('|');
}

// ---------------------------------------------------------------------------
// DriftBackground
// ---------------------------------------------------------------------------

class DriftBackground {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} [options] — see PARAMS above, plus `pixelRatio` and
   *   `onError(err)`.
   */
  constructor(canvas, options = {}) {
    if (!canvas || !canvas.getContext) {
      throw new Error('DriftBackground: a canvas element is required');
    }
    this._rejectRemoved(options);

    this.canvas = canvas;
    this.params = Object.assign({}, DEFAULTS, options);
    this.params.crt = Object.assign({}, DEFAULTS.crt, options.crt || {});
    this.onError = this.params.onError || null;
    this.pixelRatio = this.params.pixelRatio || 1;

    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      preserveDrawingBuffer: false, premultipliedAlpha: false,
    });
    if (!gl) throw new Error('DriftBackground: WebGL2 is not available in this browser');
    this.gl = gl;

    if (!gl.getExtension('EXT_color_buffer_float')) {
      throw new Error('DriftBackground: EXT_color_buffer_float is required (half-float render targets)');
    }
    gl.getExtension('OES_texture_float_linear'); // smooth 16F sampling where available

    // Runtime state -------------------------------------------------------
    this._running = false;
    this._raf = 0;
    this._time = 0;
    this._lastFrame = 0;
    this._seedReady = false;
    this._source = null;      // last resolved Image/Canvas/ImageBitmap
    this._seedCanvas = null;
    this._loL = 0;
    this._hiL = 1;
    this._trackedShaders = [];

    this.velocity = null;
    this.disp = null;

    // GL objects ----------------------------------------------------------
    this._buildQuad();
    this._createSeedTexture();
    this._bakedPaletteSig = null;
    this._buildStaticPrograms();
    this._buildDisplayProgram(normalizePalette(this.params.palette));
    this.resize(); // creates framebuffers (and re-seeds if a source exists)

    // Listeners -----------------------------------------------------------
    this._onVisibility = this._onVisibility.bind(this);
    this._onResize = this._onResize.bind(this);
    this._frame = this._frame.bind(this);
    document.addEventListener('visibilitychange', this._onVisibility);
    window.addEventListener('resize', this._onResize);
  }

  _rejectRemoved(obj) {
    if (!obj) return;
    for (const key in REMOVED_PARAMS) {
      if (key in obj) {
        throw new Error('DriftBackground: `' + key + '` was removed — ' + REMOVED_PARAMS[key]);
      }
    }
  }

  // -- program / buffer setup -------------------------------------------------

  _compile(type, src) {
    const gl = this.gl;
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error('DriftBackground: shader compile failed: ' + log);
    }
    this._trackedShaders.push(sh);
    return sh;
  }

  _createProgram(fragSrc) {
    const gl = this.gl;
    const vs = this._compile(gl.VERTEX_SHADER, VERT);
    const fs = this._compile(gl.FRAGMENT_SHADER, fragSrc);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error('DriftBackground: program link failed: ' + log);
    }
    const u = {};
    const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const nm = gl.getActiveUniform(program, i).name;
      u[nm] = gl.getUniformLocation(program, nm);
    }
    return { program, u, shaders: [vs, fs] };
  }

  _buildStaticPrograms() {
    this.flow = this._createProgram(F_FLOW);
    this.dispProg = this._createProgram(F_DISP);
  }

  _buildDisplayProgram(paletteFloats) {
    const gl = this.gl;
    const sig = paletteSignature(paletteFloats);
    if (this.display && this._bakedPaletteSig === sig) return;
    if (this.display) {
      gl.deleteProgram(this.display.program);
      for (const s of this.display.shaders) gl.deleteShader(s);
    }
    this.display = this._createProgram(buildDisplaySource(paletteFloats));
    this._bakedPaletteSig = sig;
  }

  _buildQuad() {
    const gl = this.gl;
    this._vao = gl.createVertexArray();
    gl.bindVertexArray(this._vao);
    this._vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, -1, 1, 1, 1, -1, -1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    // Keep the VAO bound for the engine's lifetime.
  }

  _createSeedTexture() {
    const gl = this.gl;
    this.seedTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.seedTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA,
      gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  }

  // -- framebuffers -----------------------------------------------------------

  /** Prototype's resolution mapping — `target` is the short axis. */
  _res(target) {
    const w = this.canvas.width || 1;
    const h = this.canvas.height || 1;
    const ar = w / h;
    return ar >= 1
      ? { w: Math.round(target * ar), h: target }
      : { w: target, h: Math.round(target / ar) };
  }

  _fbo(w, h, internal, format, filter) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      tex, fbo: f, w, h, texelX: 1 / w, texelY: 1 / h,
      attach: (id) => { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; },
    };
  }

  _dbl(w, h, internal, format, filter) {
    let a = this._fbo(w, h, internal, format, filter);
    let b = this._fbo(w, h, internal, format, filter);
    return {
      w, h, texelX: 1 / w, texelY: 1 / h,
      get read() { return a; },
      get write() { return b; },
      swap() { const t = a; a = b; b = t; },
      attach(id) { return a.attach(id); },
    };
  }

  _deleteDouble(d) {
    if (!d) return;
    const gl = this.gl;
    gl.deleteTexture(d.read.tex); gl.deleteFramebuffer(d.read.fbo);
    gl.deleteTexture(d.write.tex); gl.deleteFramebuffer(d.write.fbo);
  }

  _blit(target) {
    const gl = this.gl;
    if (target == null) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    } else {
      gl.viewport(0, 0, target.w, target.h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // -- public API -------------------------------------------------------------

  /** Recompute the canvas backing store + framebuffers from client size. */
  resize() {
    const gl = this.gl;
    const dpr = this.pixelRatio;
    const cw = this.canvas.clientWidth || this.canvas.width || 1;
    const ch = this.canvas.clientHeight || this.canvas.height || 1;
    const w = Math.max(1, Math.floor(cw * dpr));
    const h = Math.max(1, Math.floor(ch * dpr));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;

    const v = this._res(VELOCITY_RES);
    const d = this._res(DISPLACEMENT_RES);
    const velChanged = !this.velocity || this.velocity.w !== v.w || this.velocity.h !== v.h;
    const dispChanged = !this.disp || this.disp.w !== d.w || this.disp.h !== d.h;

    if (velChanged) {
      this._deleteDouble(this.velocity);
      this.velocity = this._dbl(v.w, v.h, gl.RG16F, gl.RG, gl.LINEAR);
    }
    if (dispChanged) {
      this._deleteDouble(this.disp);
      this.disp = this._dbl(d.w, d.h, gl.RG16F, gl.RG, gl.LINEAR);
    }
    // Seed resolution follows the canvas aspect, so re-rasterise it on resize.
    if (this._source) this._uploadSeed();
  }

  /**
   * Set the seed image. Accepts HTMLImageElement, ImageBitmap,
   * HTMLCanvasElement, Blob/File, or a URL string. URLs/files are loaded as DATA
   * URLs (never blob: URLs) to avoid canvas tainting. Resolves once uploaded.
   * @param {HTMLImageElement|ImageBitmap|HTMLCanvasElement|Blob|string} source
   * @returns {Promise<void>}
   */
  async setImage(source) {
    try {
      this._source = await this._resolveDrawable(source);
      this._uploadSeed();
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (this.onError) this.onError(e);
      throw e;
    }
  }

  /**
   * Live-update a subset of params. Changing `palette` (length or contents)
   * relinks the display program. Passing a removed param throws.
   * @param {Partial<typeof DEFAULTS>} partial
   */
  setParams(partial) {
    if (!partial) return;
    this._rejectRemoved(partial);

    if ('crt' in partial && partial.crt) {
      this.params.crt = Object.assign({}, this.params.crt, partial.crt);
    }
    const rest = Object.assign({}, partial);
    delete rest.crt;
    Object.assign(this.params, rest);

    if ('pixelRatio' in partial) { this.pixelRatio = partial.pixelRatio || 1; this.resize(); }
    if ('onError' in partial) this.onError = partial.onError || null;
    if ('palette' in partial && partial.palette) {
      this._buildDisplayProgram(normalizePalette(partial.palette));
    }
    if ('autoLevels' in partial && partial.autoLevels && this._source) {
      this._uploadSeed(); // (re)compute levels now that they are needed
    }
  }

  /** Begin the rAF render loop (no-op if already running). */
  start() {
    if (this._running) return;
    this._running = true;
    this._lastFrame = performance.now();
    this._raf = requestAnimationFrame(this._frame);
  }

  /** Pause the render loop. */
  stop() {
    this._running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
  }

  /** Delete every GL object, remove listeners, cancel rAF. */
  destroy() {
    this.stop();
    document.removeEventListener('visibilitychange', this._onVisibility);
    window.removeEventListener('resize', this._onResize);
    if (this._resizeTimer) { clearTimeout(this._resizeTimer); this._resizeTimer = 0; }

    const gl = this.gl;
    this._deleteDouble(this.velocity);
    this._deleteDouble(this.disp);
    this.velocity = this.disp = null;

    if (this.seedTex) gl.deleteTexture(this.seedTex);
    if (this._vbo) gl.deleteBuffer(this._vbo);
    if (this._vao) gl.deleteVertexArray(this._vao);
    for (const p of [this.flow, this.dispProg, this.display]) {
      if (p) gl.deleteProgram(p.program);
    }
    for (const s of this._trackedShaders) gl.deleteShader(s);
    this._trackedShaders = [];

    this.flow = this.dispProg = this.display = null;
    this.seedTex = this._vbo = this._vao = null;
    this._source = null;
    this._seedReady = false;
  }

  // -- image loading ----------------------------------------------------------

  async _resolveDrawable(source) {
    if (typeof source === 'string') {
      const res = await fetch(source);
      if (!res.ok) throw new Error('DriftBackground: failed to fetch image "' + source + '" (' + res.status + ')');
      return this._decodeImage(await this._blobToDataUrl(await res.blob()));
    }
    if (typeof Blob !== 'undefined' && source instanceof Blob) {
      return this._decodeImage(await this._blobToDataUrl(source));
    }
    return source; // Image / ImageBitmap / Canvas
  }

  _blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(new Error('DriftBackground: failed to read image blob'));
      fr.readAsDataURL(blob);
    });
  }

  _decodeImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('DriftBackground: failed to decode image'));
      img.src = src;
    });
  }

  /** Cover-fit the source onto the seed canvas, analyse levels, upload. */
  _uploadSeed() {
    const gl = this.gl;
    const r = this._res(SEED_RES);
    if (!this._seedCanvas) this._seedCanvas = document.createElement('canvas');
    const c = this._seedCanvas;
    c.width = r.w; c.height = r.h;
    const ctx = c.getContext('2d', { willReadFrequently: true });

    const img = this._source;
    const iw = img.naturalWidth || img.width || img.videoWidth || r.w;
    const ih = img.naturalHeight || img.height || img.videoHeight || r.h;
    const s = Math.max(r.w / iw, r.h / ih); // cover
    const dw = iw * s, dh = ih * s;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, r.w, r.h);
    ctx.drawImage(img, (r.w - dw) / 2, (r.h - dh) / 2, dw, dh);

    // Only read pixels back when auto-levels is actually on — getImageData is
    // both wasted work otherwise and a canvas-taint hazard for some sources.
    if (this.params.autoLevels) this._analyseLevels(ctx, r.w, r.h);

    try {
      gl.bindTexture(gl.TEXTURE_2D, this.seedTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    } catch (err) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      const e = err instanceof Error ? err : new Error(String(err));
      const wrapped = new Error('DriftBackground: seed texture upload failed: ' + e.message);
      if (this.onError) this.onError(wrapped);
      throw wrapped;
    }
    this._seedReady = true;
  }

  /** Build a luminance histogram, take the 2nd/98th percentiles as loL/hiL. */
  _analyseLevels(ctx, w, h) {
    const data = ctx.getImageData(0, 0, w, h).data;
    const hist = new Float64Array(256);
    let n = 0;
    for (let i = 0; i < data.length; i += 16) { // every 4th pixel
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      hist[Math.min(255, l | 0)]++; n++;
    }
    const pct = (t) => {
      let acc = 0;
      for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= t * n) return i / 255; }
      return 1;
    };
    let lo = pct(0.02), hi = pct(0.98);
    if (hi - lo < 0.05) { lo = Math.max(0, lo - 0.05); hi = Math.min(1, hi + 0.05); }
    this._loL = lo; this._hiL = hi;
  }

  // -- render loop ------------------------------------------------------------

  _onVisibility() {
    if (document.hidden) {
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
    } else if (this._running && !this._raf) {
      this._lastFrame = performance.now();
      this._raf = requestAnimationFrame(this._frame);
    }
  }

  _onResize() {
    if (this._resizeTimer) return;
    this._resizeTimer = setTimeout(() => { this._resizeTimer = 0; this.resize(); }, 100);
  }

  _frame() {
    if (!this._running) return;
    this._raf = requestAnimationFrame(this._frame);
    const now = performance.now();
    let dt = (now - this._lastFrame) * 0.001;
    this._lastFrame = now;
    if (!(dt > 0)) dt = 1 / 60;
    dt = Math.min(dt, 0.05);
    this._time += dt * this.params.driftSpeed;
    this._step();
    this._render();
  }

  /** Passes 1 + 2: flow field, then displacement accumulation. */
  _step() {
    const gl = this.gl, p = this.params;
    gl.bindVertexArray(this._vao);

    // Pass 1 — flow field → velocity.write
    gl.useProgram(this.flow.program);
    gl.uniform1i(this.flow.u.uVelocity, this.velocity.attach(0));
    gl.uniform1f(this.flow.u.uTime, this._time);
    gl.uniform1f(this.flow.u.uScale, p.detail);
    gl.uniform1f(this.flow.u.uStrength, NOISE_STRENGTH);
    gl.uniform1f(this.flow.u.uBlend, FLOW_BLEND);
    gl.uniform1f(this.flow.u.uAspect, this.canvas.width / this.canvas.height);
    this._blit(this.velocity.write);
    this.velocity.swap();

    // Pass 2 — displacement accumulation → disp.write
    gl.useProgram(this.dispProg.program);
    gl.uniform1i(this.dispProg.u.uVelocity, this.velocity.attach(0));
    gl.uniform1i(this.dispProg.u.uDisp, this.disp.attach(1));
    gl.uniform2f(this.dispProg.u.texelSize, this.disp.texelX, this.disp.texelY);
    gl.uniform1f(this.dispProg.u.dt, DT);
    gl.uniform1f(this.dispProg.u.gain, p.warp * GAIN_MULT);
    gl.uniform1f(this.dispProg.u.decay, DECAY);
    this._blit(this.disp.write);
    this.disp.swap();
  }

  /** Pass 3: sample the seed at the displaced UV, quantize, CRT. */
  _render() {
    const gl = this.gl, p = this.params;
    if (!this._seedReady) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    const u = this.display.u;
    gl.useProgram(this.display.program);
    gl.uniform1i(u.uDisp, this.disp.attach(0));
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.seedTex);
    gl.uniform1i(u.uSeed, 1);
    gl.uniform2f(u.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.pixelSize, p.pixelSize);
    gl.uniform1f(u.paletteOn, p.palette ? 1 : 0);
    gl.uniform1f(u.contrast, p.contrast);
    gl.uniform1f(u.dither, p.dither);
    gl.uniform1f(u.tone, p.tone);
    gl.uniform1f(u.loL, p.autoLevels ? this._loL : 0);
    gl.uniform1f(u.hiL, p.autoLevels ? this._hiL : 1);
    gl.uniform1f(u.crtOn, p.crt && p.crt.enabled ? 1 : 0);
    gl.uniform1f(u.crtAmt, p.crt ? p.crt.amount : 0);
    this._blit(null);
  }
}

if (typeof window !== 'undefined') window.DriftBackground = DriftBackground;
if (typeof module !== 'undefined' && module.exports) module.exports = DriftBackground;

})();
