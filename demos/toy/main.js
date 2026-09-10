// Player for shadertoy.com shaders. A toy is its Image tab dropped into
// <name>.frag verbatim — `toy: true` gives it iResolution/iTime/iChannelN and
// calls mainImage for it. Add an entry here and say what its channels are.
//
// ?s=<key> picks the shader.
import { Harness } from "../lib/harness.js";

// every toy gets these two; `params` adds its own knobs
const BASE = {
  speed: { v: 1.0, min: 0, max: 4, step: 0.01, label: "iTime speed" },
  gain:  { v: 1.0, min: 0, max: 3, step: 0.01, label: "exposure" },
};

const SHADERS = {
  plasma: {
    title: "Plasma — shadertoy",
    image: "plasma.frag",
    params: { warp: { v: 0.6, min: 0, max: 3, step: 0.01, label: "mask warp" } },
  },
  ink: {
    title: "Ink — shadertoy + Buffer A",
    image: "ink.frag",
    buffer: "ink.buf.frag",
    sim: { format: "rgba16f", clear: [0, 0, 0, 1], maxHeight: 720 },
    params: {
      flow:   { v: 1.0, min: 0, max: 4, step: 0.01, label: "ink drift" },
      decay:  { v: 0.5, min: 0, max: 4, step: 0.01, label: "ink fades /s" },
      inject: { v: 2.5, min: 0, max: 8, step: 0.05, label: "ink from body" },
    },
  },
  glacier: {
    title: "Glacier — shadertoy + Buffer A",
    image: "glacier.frag",
    buffer: "glacier.buf.frag",
    // the ice map is smooth and gets sampled at every march step, so it wants a
    // small buffer, not a big one
    sim: { format: "rgba16f", clear: [0, 0, 0, 1], maxHeight: 400 },
    params: {
      accum:  { v: 1.5,  min: 0, max: 6,   step: 0.02,  label: "ice from body /s" },
      melt:   { v: 0.25, min: 0, max: 2,   step: 0.01,  label: "melts /s" },
      creep:  { v: 0.25, min: 0, max: 1,   step: 0.01,  label: "glacier creep" },
      lift:   { v: 1.1,  min: 0, max: 2,   step: 0.01,  label: "body height" },
      relief: { v: 0.50, min: 0, max: 1.5, step: 0.01,  label: "fractal relief" },
      tilt:   { v: 0.75, min: 0, max: 1,   step: 0.01,  label: "camera pitch" },
      orbit:  { v: 0.35, min: 0, max: 1,   step: 0.01,  label: "camera sway" },
      fog:    { v: 0.7,  min: 0, max: 3,   step: 0.01,  label: "haze" },
      view:   { v: 0,    min: 0, max: 2,   step: 1,     label: "view 0-2" },
    },
  },
  kintsugi: {
    title: "Kintsugi — shadertoy + Buffer A",
    image: "kintsugi.frag",
    buffer: "kintsugi.buf.frag",
    common: "kintsugi.common.frag",           // the fracture network, needed by both passes
    // the gold runs one texel per frame along veins a texel wide, so the buffer's
    // size is the pace and the finest crack it can carry; 540 lines is the balance
    sim: { format: "rgba16f", clear: [0, 0, 0, 0], maxHeight: 540 },
    params: {
      flow:   { v: 0.6,  min: 0,   max: 1,   step: 0.01, label: "gold runs" },
      reach:  { v: 1.0,  min: 0.2, max: 4,   step: 0.01, label: "how far it gets" },
      linger: { v: 2.0,  min: 0.1, max: 15,  step: 0.1,  label: "flow dies after (s)" },
      fade:   { v: 90,   min: 3,   max: 600, step: 1,    label: "gold tarnishes (s)" },
      width:  { v: 1.0,  min: 0.5, max: 2.5, step: 0.01, label: "vein width" },
      pulse:  { v: 0.35, min: 0,   max: 2,   step: 0.01, label: "light along veins" },
      glow:   { v: 1.0,  min: 0,   max: 3,   step: 0.01, label: "glow around body" },
      pool:   { v: 0.8,  min: 0,   max: 1.5, step: 0.01, label: "molten under body" },
      drip:   { v: 0.3,  min: 0,   max: 2,   step: 0.01, label: "idle drips" },
      view:   { v: 0,    min: 0,   max: 3,   step: 1,    label: "view 0-3" },
    },
  },
};

const which = new URLSearchParams(location.search).get("s") || "plasma";
const S = SHADERS[which] || SHADERS.plasma;

const shaders = { image: S.image };
if (S.buffer) shaders.buffer = S.buffer;

const h = await Harness.create({
  name: "toy." + which,
  title: S.title,
  toy: true,                                  // shadertoy prelude instead of ours
  shaders,
  common: S.common,                           // a Common tab, pasted into both passes
  sim: S.buffer ? S.sim : null,
  params: { ...BASE, ...S.params },
});

// iTime is integrated rather than read off the clock, so turning `speed` slides
// the shader's rate instead of jumping its phase
let t = 0;
h.run(() => {
  t += h.dt * h.params.values.speed;
  const mask = h.source.tex;
  if (S.buffer) {
    h.simulate("buffer", { u_toyTime: t, iChannel0: h.pp.read.tex, iChannel1: mask });
    h.present("image", { u_toyTime: t, iChannel0: h.pp.read.tex, iChannel1: mask });
  } else {
    h.present("image", { u_toyTime: t, iChannel0: mask, iChannel1: mask });
  }
});
