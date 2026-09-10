import { Harness } from "../lib/harness.js";

const h = await Harness.create({
  name: "flowers",
  title: "Flowering Meadow",
  shaders: { sim: "sim.frag", render: "render.frag" },
  sim: { format: "rgba16f", clear: [0, 0, 0, 0], maxHeight: 540 },
  params: {
    density: { v: 15,   min: 4, max: 50, step: 1,    label: "flower grid" },
    fill:    { v: 0.8,  min: 0, max: 1,  step: 0.01, label: "cells with a flower" },
    size:    { v: 0.55, min: 0.1, max: 1, step: 0.01, label: "flower size" },
    soft:    { v: 0.18, min: 0.02, max: 0.8, step: 0.01, label: "petal edge" },
    grow:    { v: 0.9,  min: 0, max: 4,  step: 0.02, label: "opens /s" },
    wilt:    { v: 0.05, min: 0, max: 1,  step: 0.005, label: "wilts /s" },
    creep:   { v: 0.10, min: 0, max: 0.6, step: 0.005, label: "bloom creeps" },
    thresh:  { v: 0.25, min: 0.02, max: 1, step: 0.01, label: "touch needed" },
    rise:    { v: 2.5,  min: 0, max: 10, step: 0.05, label: "touch /s" },
    sink:    { v: 1.5,  min: 0, max: 6,  step: 0.02, label: "touch fades /s" },
    spread:  { v: 0.25, min: 0, max: 1,  step: 0.01, label: "touch spread" },
    wind:    { v: 0.35, min: 0, max: 2,  step: 0.01 },
    grass:   { v: 0.6,  min: 0, max: 2,  step: 0.01, label: "grass texture" },
    hue:     { v: 0.0,  min: 0, max: 1,  step: 0.01, label: "palette shift" },
    shade:   { v: 0.3,  min: 0, max: 1,  step: 0.01, label: "body shadow" },
    view:    { v: 0, min: 0, max: 3, step: 1, label: "view 0-3" },
  },
});

h.run(() => {
  h.simulate("sim");
  h.present("render");
});
