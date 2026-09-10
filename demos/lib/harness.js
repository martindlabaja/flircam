// Shared demo harness: canvas + GL, frame source, params panel, ping-pong sim
// buffer, hot-reloading shaders, and the rAF loop.
//
// A demo is main.js + a couple of .frag files. The harness prepends a prelude to
// every fragment shader that declares the common uniforms, one uniform per param,
// and a few helpers — so shaders never declare uniforms themselves.

import { createGL, Program, PingPong } from "./gl.js";
import { Source, savedSrc } from "./source.js";
import { Params } from "./params.js";

const KEYS = "h panel &nbsp;·&nbsp; f fullscreen &nbsp;·&nbsp; r reset &nbsp;·&nbsp; space pause &nbsp;·&nbsp; s source";

const PRELUDE_TAIL = `
in vec2 v_uv;
out vec4 fragColor;

uniform float u_time, u_dt, u_frame;
uniform vec2 u_res, u_texel;
uniform sampler2D u_state, u_prev;
uniform sampler2D u_mask;
uniform vec2 u_stateTexel;   // texel of the sim buffer (differs from u_texel in the final pass)
uniform vec2 u_maskFit;

// Camera mask, aspect-corrected (cover) and optionally mirrored.
// White = subject, unless the camera/threshold is inverted.
vec2 maskUV(vec2 uv){
  uv = (uv - 0.5) * u_maskFit + 0.5;
  if (u_mirror > 0.5) uv.x = 1.0 - uv.x;
  return uv;
}
float mask(vec2 uv){
  vec2 m = maskUV(uv);
  float v = texture(u_mask, m).r;
  if (u_invert > 0.5) v = 1.0 - v;
  // outside the camera frame there is no subject
  return (m.x < 0.0 || m.x > 1.0 || m.y < 0.0 || m.y > 1.0) ? 0.0 : v;
}
float mask(){ return mask(v_uv); }

float hash21(vec2 p){
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p + 19.19);
  return fract((p.x + p.y) * p.x);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1,0)), f.x),
             mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}
`;

// Shadertoy compatibility: a shader written for shadertoy.com drops in as-is,
// with iChannel0-3 wired by the demo. Deliberately no hash21/fbm/noise here —
// toys bring their own and a redefinition is a compile error.
const TOY_HEAD = `
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time, u_dt, u_frame, u_toyTime;
uniform vec2 u_res, u_texel, u_stateTexel, u_maskFit;
uniform sampler2D u_state, u_prev, u_mask;
uniform sampler2D iChannel0, iChannel1, iChannel2, iChannel3;

#define texture2D texture
#define textureCube texture
#define iTime u_toyTime
#define iTimeDelta u_dt
#define iFrameRate (1.0 / max(u_dt, 1e-5))
#define iSampleRate 44100.0
#define iMouse vec4(0.0)
#define iDate vec4(2026.0, 1.0, 1.0, 0.0)
vec3 iResolution = vec3(1.0);
int iFrame = 0;
vec3 iChannelResolution[4];
float iChannelTime[4];

// the camera mask, aspect-corrected, with the panel's mirror/invert applied.
// On shadertoy this would be texture(iChannel0, fragCoord/iResolution.xy).r
float maskTex(vec2 uv){
  uv = (uv - 0.5) * u_maskFit + 0.5;
  if (u_mirror > 0.5) uv.x = 1.0 - uv.x;
  float v = texture(u_mask, uv).r;
  if (u_invert > 0.5) v = 1.0 - v;
  return (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) ? 0.0 : v;
}
`;

// appended after the toy's own code, so it can call mainImage
const TOY_TAIL = `
void main(){
  iResolution = vec3(u_res, 1.0);
  iFrame = int(u_frame);
  for (int i = 0; i < 4; i++){ iChannelResolution[i] = vec3(u_res, 1.0); iChannelTime[i] = u_toyTime; }
  vec4 c = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(c, gl_FragCoord.xy);
  fragColor = c;
}
`;

export class Harness {
  static async create(opts) {
    const h = new Harness(opts);
    await h.init();
    return h;
  }

  constructor(opts) {
    this.opts = opts;
    this.paused = false;
    this.time = 0;
    this.frame = 0;
    this.fps = 0;
    // `mirror` and `invert` are wanted by every camera demo, so they come free
    this.params = new Params({ mirror: { v: false }, invert: { v: false }, ...opts.params }, opts.name);
  }

  async init() {
    document.title = this.opts.title;
    this.canvas = document.querySelector("canvas") || document.body.appendChild(document.createElement("canvas"));
    this.gl = createGL(this.canvas);
    this.source = await Source.create(this.gl, savedSrc());

    this.prelude = "#version 300 es\nprecision highp float;\nprecision highp sampler2D;\n" +
      Object.keys(this.params.values).map((n) => `uniform float u_${n};`).join("\n") +
      (this.opts.toy ? TOY_HEAD : PRELUDE_TAIL) + "\n#line 1\n"; // author line numbers in compile errors

    this.params.mount(this.opts.title, KEYS);
    this.overlay = document.createElement("pre");
    this.overlay.id = "err";
    this.overlay.style.cssText =
      "position:fixed;left:0;top:0;right:260px;margin:0;padding:12px;z-index:10;white-space:pre-wrap;" +
      "background:#3b0d0dee;color:#ffb4b4;font:11px ui-monospace,monospace;display:none";
    document.body.append(this.overlay);

    // shaders: { name: 'file.frag' } — fetched, compiled, then polled for edits
    // opts.common: a .frag chunk pasted into every shader of this demo, for
    // helpers both the sim and the render pass need (a particle's position, say)
    this.commonSrc = this.opts.common ? await this.fetchText(this.opts.common) : "";

    this.shaders = {};
    await Promise.all(Object.entries(this.opts.shaders).map(async ([name, url]) => {
      this.shaders[name] = { url, src: "", prog: null };
      await this.load(name, true);
    }));
    this.copy = new Program(this.gl, this.prelude + "void main(){ fragColor = texture(u_state, v_uv); }", "copy");

    this.resize();
    addEventListener("resize", () => this.resize());
    if (this.opts.sim) this.pp.clear(this.opts.sim.clear || [0, 0, 0, 1]);

    // a silent fallback to the test pattern is the one failure that looks like
    // success — say so on screen, not just in the console
    if (this.source.warn) this.toast(this.source.warn + " — running the test pattern instead");

    addEventListener("keydown", (e) => this.key(e));
    setInterval(() => this.poll(), 800);
  }

  async fetchText(url) {
    return (await fetch(url + "?t=" + Date.now(), { cache: "no-store" })).text();
  }

  async load(name, throwOnError = false, force = false) {
    const s = this.shaders[name];
    const src = await this.fetchText(s.url);
    if (src === s.src && !force) return false;
    s.src = src;
    try {
      const body = this.prelude + this.commonSrc + "\n#line 1\n" + src + (this.opts.toy ? TOY_TAIL : "");
      const prog = new Program(this.gl, body, s.url);
      s.prog?.dispose();
      s.prog = prog;
      this.error(null);
    } catch (e) {
      this.error(e.message);
      if (throwOnError && !s.prog) throw e;
    }
    return true;
  }

  async poll() {
    let force = false;
    if (this.opts.common) {
      const src = await this.fetchText(this.opts.common);
      if (src !== this.commonSrc) { this.commonSrc = src; force = true; }
    }
    for (const name in this.shaders) await this.load(name, false, force);
  }

  toast(msg) {
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:11;padding:8px 12px;border-radius:6px;" +
      "background:#3b2a0dee;color:#ffd9a0;font:12px ui-monospace,monospace;max-width:60vw;" +
      "transition:opacity 1s;border:1px solid #ffffff1f";
    document.body.append(el);
    setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 1200); }, 8000);
  }

  error(msg) {
    this.overlay.style.display = msg ? "block" : "none";
    if (msg) { this.overlay.textContent = msg; console.error(msg); }
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(innerWidth * dpr)), h = Math.max(1, Math.round(innerHeight * dpr));
    this.canvas.width = w; this.canvas.height = h;
    this.canvas.style.width = "100%"; this.canvas.style.height = "100%";
    if (!this.opts.sim) return;
    // sim runs on its own grid, capped so a 4K projector doesn't tank the framerate
    const cap = this.opts.sim.maxHeight || 720;
    const sh = Math.min(h, cap), sw = Math.max(1, Math.round(sh * (w / h)));
    if (!this.pp) this.pp = new PingPong(this.gl, sw, sh, this.opts.sim.format || "rgba16f");
    else this.pp.resize(sw, sh, this.copy);
  }

  reset() { this.pp?.clear(this.opts.sim?.clear || [0, 0, 0, 1]); }

  key(e) {
    if (e.key === "h") this.params.toggle();
    else if (e.key === "f") document.fullscreenElement ? document.exitFullscreen() : document.body.requestFullscreen();
    else if (e.key === "r") this.reset();
    else if (e.key === " ") { this.paused = !this.paused; e.preventDefault(); }
    else if (e.key === "s") location.href = "../index.html";
    else return;
  }

  // Uniforms every pass gets. `w`,`h` are the target's size, not the window's.
  globals(w, h) {
    const s = this.source;
    // cover-fit the camera frame into the target
    const srcAR = (s.width || 4) / (s.height || 3), dstAR = w / h;
    const fit = dstAR > srcAR ? [1, srcAR / dstAR] : [dstAR / srcAR, 1];
    return this.params.uniforms({
      u_time: this.time, u_dt: this.dt, u_frame: this.frame,
      u_res: [w, h], u_texel: [1 / w, 1 / h],
      u_mask: s.tex, u_maskFit: fit,
    });
  }

  // One ping-pong step: reads u_prev, writes the new state.
  simulate(name, extra) {
    if (this.paused) return;
    const prog = this.shaders[name].prog;
    if (!prog) return;
    const t = this.pp.write;
    t.bind();
    prog.draw({ ...this.globals(t.w, t.h), u_stateTexel: [1 / t.w, 1 / t.h],
      u_prev: this.pp.read.tex, u_state: this.pp.read.tex, ...extra });
    this.pp.swap();
  }

  // Final pass, straight to the screen. u_state is the current sim state.
  present(name, extra) {
    const gl = this.gl, prog = this.shaders[name].prog;
    if (!prog) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const state = this.pp?.read.tex;
    const texel = this.pp ? [1 / this.pp.w, 1 / this.pp.h] : [1 / this.canvas.width, 1 / this.canvas.height];
    prog.draw({ ...this.globals(this.canvas.width, this.canvas.height), u_stateTexel: texel,
      u_state: state, u_prev: state, ...extra });
  }

  run(fn) {
    let last = performance.now(), acc = 0, n = 0;
    const loop = (now) => {
      requestAnimationFrame(loop);
      const raw = (now - last) / 1000;
      last = now;
      this.dt = Math.min(raw, 1 / 30); // clamp: a stalled tab must not blow up the sim
      if (!this.paused) { this.time += this.dt; this.frame++; }
      this.source.update(this.time);
      fn(this);
      acc += raw; n++;
      if (acc > 0.5) {
        this.fps = Math.round(n / acc); acc = 0; n = 0;
        this.params.stat.innerHTML =
          `${this.fps} fps &nbsp; ${this.pp ? this.pp.w + "x" + this.pp.h : ""}<br>src: ${this.source.label}` +
          (this.paused ? "<br><b>paused</b>" : "");
      }
    };
    requestAnimationFrame(loop);
  }
}
