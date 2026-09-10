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

## Keys

`h` panel · `f` fullscreen · `r` reset sim · `space` pause · `s` back to the picker

## The one Pi-side dependency

`pi/mask.py` sends `Access-Control-Allow-Origin: *` — without it Chrome refuses to upload
the cross-origin stream into a WebGL texture. After pulling that change:

```bash
scp pi/mask.py optical@192.168.1.235:~/flircam/pi/ && ssh optical@192.168.1.235 sudo systemctl restart mask
```
