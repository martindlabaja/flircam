import { Harness } from "../lib/harness.js";

const h = await Harness.create({
  name: "snow",
  title: "Thawing Snow",
  shaders: { sim: "sim.frag", render: "render.frag" },
  sim: { format: "rgba16f", clear: [1, 0, 0, 1], maxHeight: 720 }, // start under full snow
  params: {
    snowfall: { v: 0.10, min: 0, max: 0.4, step: 0.002, label: "snowfall /s" },
    heat:     { v: 2.5,  min: 0, max: 8,   step: 0.05,  label: "body heat" },
    melt:     { v: 1.2,  min: 0, max: 6,   step: 0.02 },
    cool:     { v: 0.8,  min: 0, max: 4,   step: 0.02,  label: "cool down" },
    bleed:    { v: 0.35, min: 0, max: 1,   step: 0.01,  label: "heat bleed" },
    slump:    { v: 0.12, min: 0, max: 1,   step: 0.01,  label: "snow slump" },
    dunes:    { v: 0.18, min: 0, max: 0.6, step: 0.01,  label: "dune relief" },
    dry:      { v: 0.15, min: 0, max: 2,   step: 0.01,  label: "ground dries /s" },
    relief:   { v: 3.0,  min: 0, max: 12,  step: 0.1 },
    sparkle:  { v: 0.35, min: 0, max: 1,   step: 0.01 },
    edge:     { v: 0.08, min: 0.005, max: 0.4, step: 0.005, label: "edge softness" },
    wetrim:   { v: 0.6,  min: 0, max: 1,   step: 0.01,  label: "wet melt line" },
    view:     { v: 0, min: 0, max: 3, step: 1, label: "view 0-3" },
  },
});

h.run(() => {
  h.simulate("sim");
  h.present("render");
});
