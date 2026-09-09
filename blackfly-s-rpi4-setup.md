# Blackfly S → Pi 4 → Network Mask Appliance

**Goal:** a box artists plug in, that appears in their software as a live mask source. No terminal, no SDK, no config.

The Pi does the segmentation. Artists receive a plain video stream — white silhouette on black — which every VJ/mapping tool already knows how to use as a luma key or alpha input.

---

## 1. Camera connectors

| Connector | Carries | Needed? |
|---|---|---|
| USB 3.1 Gen 1 Micro-B | Data **and** power | Yes — runs the camera on its own |
| HR10 6-pin Hirose | Power + trigger/strobe, **no data** | Optional |

The Blackfly S is **USB3 Vision / GenICam, not UVC**. It will never appear as `/dev/video0` unaided.

## 2. HR10 pinout (only if externally powering)

| Pin | Wire | Function |
|---|---|---|
| 1 | Green | +12 V DC power / non-isolated input (Line 3) |
| 2 | Black | Opto-isolated input (Line 0) |
| 3 | Red | +3.3 V out / non-isolated I/O (Line 2) |
| 4 | White | Opto-isolated output (Line 1) |
| 5 | Blue | Opto ground — **not** camera ground |
| 6 | Brown | Camera power ground |

- Cased BFS-U3: 12 V nominal, 8–24 V range, 3 W max.
- 5 V USB is below the minimum — needs a PD/QC trigger board or boost converter.
- Board-level variants take 5 V nominal (4–5.5 V). **Verify your exact model before applying voltage.**
- External power takes precedence over USB when both are present.

## 3. Cabling

- Single passive USB cable, **5 m max**. Never stack an extension.
- Qualified: ACC-01-2301 / ACC-01-2304 (5 m locking), ACC-01-2300 (3 m).
- Beyond 5 m → active repeater cable (needs its own power) or USB3-over-fiber.

## 4. Power

1. **Powered USB 3.0 hub** — first choice. Self-powered, 5 V/3 A+. Must be USB 3.0.
2. **Pi's own 5 V/3 A USB-C supply** — separate, still required.
3. **HR10 12 V** — fallback if dropouts persist under sustained streaming.

Pi 4's two USB3 ports share one VL805 controller on a PCIe 2.0 x1 link (~4 Gbps). A hub adds no bandwidth.

## 5. Networking — use Ethernet

Wire the Pi. Artists can be on WiFi; the Pi should not be.

- Removes the most fragile link in the chain, and its jitter.
- NDI is **unicast per receiver** — three artists means three times the outbound bandwidth.
- Same cable run you need for power anyway.

---

## 6. Software stack

**Capture:** **Aravis** — open source, in Debian repos, ships the `aravissrc` GStreamer plugin. Easiest path on Pi OS.
Alternative: Spinnaker SDK ARM64 (official, but built against Ubuntu 22.04 / Python 3.10 — use Ubuntu Server 64-bit if you go this way).

**Process:** OpenCV. Background subtraction or thresholding at 320×240 — comfortable on a Pi 4. IR-lighting the scene makes this far more reliable.

**Mandatory Linux tweak** — add to `/boot/cmdline.txt` and reboot:

```
usbcore.usbfs_memory_mb=1000
```

The default 16 MB USB buffer is too small and causes immediate streaming failure. Nearly everyone hits this.

## 7. Output — staged

**A network stream is not a webcam.** No OS sees a stream URL as a capture device unaided. The trick is to let the artist's own machine do that conversion, for free.

### v1 — MJPEG over HTTP. Ship this.

- GStreamer pipeline, or ~50 lines of Python. No SDK, no licensing, nothing to read.
- The artist gets a URL. That's the entire handout.
- Native in TouchDesigner (Video Stream In TOP), browsers, OBS, Processing, openFrameworks, anything with OpenCV.

**For tools MJPEG doesn't reach natively (Resolume, MadMapper):** the artist installs OBS, adds the URL as a source, enables **OBS Virtual Camera**. The stream becomes a real system webcam device visible to every application on their machine. One free install, no licensing, identical on Mac and Windows. This fully solves the "behaves like a webcam" goal.

### v2 — add plain NDI if artists ask

Nicer discovery: appears in a dropdown by name, nothing to install on their side. Native in TouchDesigner, Resolume, MadMapper, Isadora, OBS, Notch. **The SDK is free to use** and covers Linux ARM64.

### NDI HX — probably never

HX is the compressed variant, and it's where the licensing friction lives. People reach for it because of bandwidth — but the ~100 Mbps figures assume 1080p60 video. You are sending a 320×240 or 640×480 flat black-and-white silhouette over wired Ethernet. Plain NDI should sit well inside budget at mask resolution. **Test before assuming you need HX.** Only revisit if you later need high-res video over a constrained link, which masks won't require.

## 8. Expected performance (Pi 4, hardware H.264)

| Resolution | Frame rate |
|---|---|
| 640×480 | 60 fps, comfortable |
| 720p | 30–60 fps, comfortable |
| 1080p | ~30 fps, near encoder ceiling |
| Full 5 MP | Not viable — crop/bin on-camera |

Set Mono8 or on-camera binning. Avoid CPU debayering. **Masks don't need resolution** — a flat black-and-white silhouette compresses to almost nothing, so spend the budget on latency, not pixels.

Pi 4 > Pi 5 here: the Pi 5 dropped the hardware H.264 encoder.

## 9. Latency

Chain: exposure → buffer → USB → segment → encode → network → decode → composite ≈ **150–300 ms**.
The camera alone contributes ~100–200 ms even on a fast desktop. Expect the mask to trail the subject slightly.

Mitigations, by impact:

1. Ethernet instead of WiFi.
2. Segment on the Pi — send the mask, not the camera picture.
3. Low resolution. MJPEG has no inter-frame buffering; if using H.264, disable B-frames and use a zero-latency tune.
4. If the projector host is within 5 m, consider dropping the Pi entirely and plugging the camera straight in.

---

## 10. Appliance checklist

The setup burden is yours, not the artists'. Minimum for it to feel like a product:

- [ ] Fixed hostname / mDNS name (`mask.local`)
- [ ] Auto-start on boot, auto-recover on camera disconnect
- [ ] Sensible defaults — works with nothing configured
- [ ] Small web page on the Pi: live mask preview + threshold slider, no terminal
- [ ] One-page handout: the MJPEG URL, plus a two-line note on OBS Virtual Camera
- [ ] *(v2)* NDI source named something human (`Mask — Studio A`), running alongside MJPEG
