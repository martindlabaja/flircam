# demos

Mask-driven visuals that consume the Pi's MJPEG stream. These do **not** run on the Pi —
the Pi only makes the mask. Edit here in WSL, render in Chrome on Windows (WSLg has no
usable GPU path or projector fullscreen).

## Run

```bash
./serve.sh          # http://localhost:5173  — WSL forwards localhost to Windows
```

Open `http://localhost:5173` in Chrome **on Windows**, pick a frame source, click a demo.
`f` for fullscreen on the projector head.

Sources: the Pi's stream (`http://192.168.1.235:8080/stream.mjpg`), a local webcam, or a
synthetic moving figure. The test pattern means the demos work with the Pi switched off.

## Layout

```
lib/gl.js        WebGL2: fullscreen-triangle passes, float targets, ping-pong
lib/source.js    MJPEG / webcam / test pattern -> a GL texture
lib/params.js    slider panel, persisted per demo
lib/harness.js   canvas, loop, sim buffer, shader hot-reload, uniform prelude
snow/            demo 1 — thawing snow
fireflies/       demo 2 — swarm that orbits the body, with trails
flowers/         demo 3 — meadow that blooms in the body's wake
toy/             player for shadertoy.com shaders (?s=plasma, ink, glacier, kintsugi)
```

Each demo is a folder of `index.html` + `main.js` + `.frag` files. Nothing else to register.

## Writing a demo

`main.js` declares the knobs and the passes; the `.frag` files hold the actual work and
**hot-reload on save** — no refresh.

```js
const h = await Harness.create({
  name: "snow", title: "Thawing Snow",
  shaders: { sim: "sim.frag", render: "render.frag" },
  sim: { clear: [1, 0, 0, 1] },
  params: { melt: { v: 1.2, min: 0, max: 6, step: 0.02 } },
});
h.run(() => { h.simulate("sim"); h.present("render"); });
```

Shaders declare no uniforms — the harness prepends a prelude with:

| | |
|---|---|
| `u_time` `u_dt` `u_frame` | seconds, clamped frame delta, frame count |
| `u_res` `u_texel` | target size and 1/size |
| `u_state` `u_prev` `u_stateTexel` | sim buffer (current / previous) |
| `mask()` `mask(uv)` | camera mask, aspect-corrected, mirror + invert applied |
| `hash21` `vnoise` `fbm` | noise |
| `u_<param>` | one float per param, `mirror` and `invert` come free |

Compile errors show as a red overlay with the line numbers of *your* file.

Passing `common: "flies.frag"` pastes that file into every shader of the demo — for
helpers both the sim and the render pass need (where a particle is, say). It hot-reloads
too, and rebuilds both passes when it changes.

## Running a shadertoy shader

`toy: true` swaps our prelude for a shadertoy-compatible one — `iResolution`,
`iTime`, `iTimeDelta`, `iFrame`, `iMouse`, `iDate`, `iChannel0-3`,
`iChannelResolution`, `texture2D` — and calls the toy's `mainImage` for it. So the
Image tab of a shader goes into `toy/<name>.frag` verbatim.

1. Paste the Image tab into `toy/<name>.frag` (a Buffer A tab into `<name>.buf.frag`, a
   Common tab into `<name>.common.frag`, named as `common` in the entry).
2. Add it to `SHADERS` in `toy/main.js` and wire the channels — that is the one thing
   shadertoy holds outside the code. `iChannel0: h.source.tex` is the mask;
   `h.pp.read.tex` is the feedback buffer. Its `params` become `u_<name>` uniforms, on
   top of the `speed` and `gain` every toy gets.
3. Open `toy/?s=<name>`.

`maskTex(uv)` is there too: the same read as `texture(iChannel0, uv).r` but aspect-fitted
with the panel's mirror/invert applied.

Not supported: cube maps, audio and video channels, keyboard input, more than one
feedback buffer. `iMouse` is zero, `iChannelResolution` is the target's size, and the
buffer pass runs at the sim resolution rather than the canvas. `iTime` is integrated
from `dt * speed`, so the speed slider slides the rate instead of jumping the phase.

Shaders on shadertoy are CC BY-NC-SA 3.0 unless their author says otherwise —
attribution, non-commercial, share-alike. Worth checking before a paid show.

## Keys

`h` panel · `f` fullscreen · `r` reset sim · `space` pause · `s` back to the picker

## The one Pi-side dependency

`pi/mask.py` sends `Access-Control-Allow-Origin: *` — without it Chrome refuses to upload
the cross-origin stream into a WebGL texture. After pulling that change:

```bash
scp pi/mask.py optical@192.168.1.235:~/flircam/pi/ && ssh optical@192.168.1.235 sudo systemctl restart mask
```
