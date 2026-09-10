// Player for shadertoy.com shaders. A toy is its Image tab dropped into
// <name>.frag verbatim — `toy: true` gives it iResolution/iTime/iChannelN and
// calls mainImage for it. Add an entry here and say what its channels are.
//
// ?s=<key> picks the shader.
import { Harness } from "../lib/harness.js";

const SHADERS = {
  plasma: { title: "Plasma — shadertoy", image: "plasma.frag" },
  ink:    { title: "Ink — shadertoy + Buffer A", image: "ink.frag", buffer: "ink.buf.frag" },
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
  sim: S.buffer ? { format: "rgba16f", clear: [0, 0, 0, 1], maxHeight: 720 } : null,
  params: {
    speed:  { v: 1.0, min: 0, max: 4, step: 0.01, label: "iTime speed" },
    gain:   { v: 1.0, min: 0, max: 3, step: 0.01 },
    warp:   { v: 0.6, min: 0, max: 3, step: 0.01, label: "mask warp" },
    flow:   { v: 1.0, min: 0, max: 4, step: 0.01, label: "ink drift" },
    decay:  { v: 0.5, min: 0, max: 4, step: 0.01, label: "ink fades /s" },
    inject: { v: 2.5, min: 0, max: 8, step: 0.05, label: "ink from body" },
  },
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
