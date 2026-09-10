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
