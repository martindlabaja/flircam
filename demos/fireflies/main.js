import { Harness } from "../lib/harness.js";

const h = await Harness.create({
  name: "fireflies",
  title: "Fireflies",
  common: "flies.frag",                       // fly positions: both passes need them
  shaders: { sim: "sim.frag", render: "render.frag" },
  sim: { format: "rgba16f", clear: [0, 0, 0, 0], maxHeight: 540 },
  params: {
    density: { v: 14,   min: 6, max: 70,  step: 1,     label: "swarm grid" },
    fill:    { v: 0.40, min: 0, max: 1,   step: 0.01,  label: "cells with a fly" },
    blink:   { v: 1.2,  min: 0, max: 8,   step: 0.05,  label: "blink rate" },
    excite:  { v: 3.0,  min: 0, max: 10,  step: 0.05,  label: "excited by body" },
    attract: { v: 0.55, min: -1, max: 2,  step: 0.01,  label: "pull to body" },
    swirl:   { v: 0.35, min: -1, max: 1,  step: 0.01,  label: "orbit body" },
    rise:    { v: 3.0,  min: 0, max: 10,  step: 0.05,  label: "presence /s" },
    sink:    { v: 1.2,  min: 0, max: 6,   step: 0.02,  label: "presence fades /s" },
    spread:  { v: 0.5,  min: 0, max: 1,   step: 0.01,  label: "presence spread" },
    fade:    { v: 2.0,  min: 0.05, max: 12, step: 0.05, label: "trail fades /s" },
    halo:    { v: 0.22, min: 0, max: 1,   step: 0.01 },
    bloom:   { v: 0.8,  min: 0, max: 3,   step: 0.02,  label: "trail glow" },
    aura:    { v: 0.25, min: 0, max: 2,   step: 0.01,  label: "body aura" },
    mist:    { v: 0.35, min: 0, max: 2,   step: 0.01,  label: "night mist" },
    expose:  { v: 1.4,  min: 0.2, max: 4, step: 0.05,  label: "exposure" },
    view:    { v: 0, min: 0, max: 3, step: 1, label: "view 0-3" },
  },
});

h.run(() => {
  h.simulate("sim");
  h.present("render");
});
