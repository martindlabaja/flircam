# Blackfly S → Raspberry Pi → Network Mask Appliance

**Goal:** a box artists plug in, that appears in their software as a live mask source. No terminal, no SDK, no config.

The Pi does the segmentation. Artists receive a plain video stream — white silhouette on black — which every VJ/mapping tool already knows how to use as a luma key or alpha input.

**Camera:** cased Blackfly S USB3, 5 MP. Exact model: `BFS-U3-_____` *(fill in: 51S5 = 73 fps full-res, 50S5 = 35 fps; everything below is otherwise identical)*.
**Verified against:** Teledyne FLIR Blackfly S Installation Guide (Aug 2025) and the per-model spec pages.

---

## 1. Camera connectors

| Connector | Carries | Needed? |
|---|---|---|
| USB 3.1 Micro-B, locking | Data **and** power | Yes — runs the camera on its own |
| HR10 6-pin Hirose (HR10A-7R-6PB) | Power + trigger/strobe, **no data** | Yes with a 5 m cable — see §4 |

The Blackfly S is **USB3 Vision / GenICam, not UVC**. It will never appear as `/dev/video0` unaided.

## 2. HR10 pinout

| Pin | Wire | Function |
|---|---|---|
| 1 | Green | +12 V DC power in (8–24 V) / non-isolated input (Line 3) |
| 2 | Black | Opto-isolated input (Line 0) |
| 3 | Red | +3.3 V out, 120 mA max / non-isolated I/O (Line 2) |
| 4 | White | Opto-isolated output, open drain (Line 1) |
| 5 | Blue | Opto ground — **not** camera ground |
| 6 | Brown | Camera power ground |

- 12 V nominal, 8–24 V range, 3 W max.
- 5 V USB is below the minimum — needs a PD/QC trigger board or boost converter.
- External power takes precedence over USB when both are present.

## 3. Cabling

- Single passive cable, Type-A to locking Micro-B. FLIR's longest is 5 m. Never stack an extension.
- FLIR part numbers: **ACC-01-2300** (3 m), **ACC-01-2301** (5 m), **ACC-01-2302** (5 m, high-performance).
- **5 m on an embedded host is a power problem, not a data problem.** FLIR: "not recommended for laptops or on board controllers"; external GPIO power "is required" for those systems.
- Beyond 5 m → active repeater cable (needs its own power) or USB3-over-fiber.

## 4. Power

| Cable | Camera power |
|---|---|
| ≤ 3 m | Powered USB 3.0 hub, self-powered, 5 V/3 A+ |
| 5 m | HR10 12 V supply from day one, hub still carries data |

The Pi's own supply is separate and still required: 5 V/3 A for Pi 4, 5 V/5 A for Pi 5.

Pi 4: both USB3 ports share one ~4 Gbps link. Pi 5: two independent 5 Gbps ports. A hub adds no bandwidth either way.

## 5. Networking — WiFi chain: hotspot > home > venue

No Ethernet. The Pi carries three profiles; NetworkManager joins the highest-priority one in range and drops down the chain when it fails:

| Priority | Profile | When |
|---|---|---|
| 20 | `hotspot` | phone hotspot — **on-site fallback**, dev away from home |
| 10 | `home` | development at home |
| 0 | `venue` | the show |

It does **not** climb back up while connected. So on site: hotspot off → Pi joins venue. Venue dies → hotspot on, power-cycle the Pi → everyone joins the hotspot. At home, keep the hotspot off while the Pi boots unless you want it there.

**Venue WiFi risks — ask before travelling:**

- **Client isolation** (guest networks): blocks Pi ↔ laptop traffic entirely. Deal-breaker. Must be off, or get a dedicated SSID/VLAN for you and the artists.
- **Captive portal**: a headless Pi can't click "accept". Need a portal-free SSID or a MAC whitelist.
- **WPA2-Enterprise** (username + password): NetworkManager handles it, Imager can't. Configure over SSH.
- **mDNS across APs/VLANs** is often blocked, so `mask.local` may fail. Ask for a DHCP reservation for the Pi's MAC; write that IP on the case.
- Prefer 5 GHz and not the public SSID.

**Pi side:**

```
# home = the network the Pi first booted on; pi/setup.sh copies it into profile "home", priority 10
sudo pi/wifi.sh hotspot "<hotspot SSID>"     # prompts for password; or put both in secrets.env →
sudo pi/wifi.sh venue "<venue SSID>"         #   wifi.env on the boot partition, setup.sh imports it
nmcli -f NAME,AUTOCONNECT-PRIORITY,DEVICE connection show
iw dev wlan0 get power_save                  # → off, after reboot
```

WPA2-Enterprise venues need a hand-made profile instead of `wifi.sh` (`802-1x.eap peap`, identity, password).

Power save off is not optional: it causes periodic latency spikes and dropouts. Pi 4/5 WiFi is weak — keep the Pi within a few metres of the access point, not in a metal case.

**NDI over venue WiFi:** NDI is unicast per receiver and NDI itself discourages WiFi. MJPEG at mask resolution is the safe path. Test NDI with one receiver before promising it.

---

## 6. Software stack

**Capture: Aravis.** In the Debian / Pi OS repos. The `aravissrc` GStreamer plugin ships inside `libaravis-0.8-0`, no source build needed.

```
sudo apt install libaravis-0.8-0 aravis-tools-cli
sudo cp aravis.rules /etc/udev/rules.d/   # from github.com/AravisProject/aravis — without it the camera is root-only
arv-tool-0.8                               # lists the camera
```

Scripted in `pi/setup.sh` (run once with sudo, then reboot). `pi/mask.py` is the v1 pipeline: capture → threshold → MJPEG on port 8080, slider and Power off / Reboot buttons at `/`, `source: webcam|aravis` in `pi/config.json`.

FLIR / Point Grey USB vendor ID is `1e10`; add it to `aravis.rules` if missing.

Alternative: Spinnaker SDK ARM64. Official, but FLIR's ARM notes still target Ubuntu 18.04 and the download page is behind a login — **unverified**. Only if Aravis fails.

**Process:** OpenCV. Background subtraction or thresholding at 320×240 — comfortable on any Pi. IR-lighting the scene makes this far more reliable.

**Mandatory Linux tweaks:**

1. Append to `/boot/firmware/cmdline.txt` (Pi OS Bookworm and later) and reboot:
   ```
   usbcore.usbfs_memory_mb=1000
   ```
   Default is 16 MB. FLIR recommends 1000. Streaming fails immediately without it.
2. The camera reverts to factory defaults (or a saved UserSet) on **every power cycle**. Either save a UserSet on-camera and make it the default, or have the pipeline set every parameter on start. Needed for auto-recover.

## 7. Output — staged

**A network stream is not a webcam.** No OS sees a stream URL as a capture device unaided. The trick is to let the artist's own machine do that conversion, for free.

### v1 — MJPEG over HTTP. Ship this.

- GStreamer pipeline, or ~50 lines of Python. No SDK, no licensing, nothing to read.
- The artist gets a URL. That's the entire handout.
- Native in TouchDesigner (Video Stream In TOP), browsers, OBS, Processing, openFrameworks, anything with OpenCV.

**For tools MJPEG doesn't reach natively (Resolume, MadMapper):** the artist installs OBS, adds the URL as a Media Source, enables **OBS Virtual Camera**. The stream becomes a real system webcam visible to every application on their machine. One free install, no licensing, identical on Mac and Windows.

### v2 — add plain NDI if artists ask

Nicer discovery: appears in a dropdown by name, nothing to install on their side. Native in TouchDesigner, Resolume, MadMapper, Isadora, OBS, Notch. **The standard NDI SDK is free** and ships Raspberry Pi arm64 libraries.

### NDI HX — probably never

HX is the compressed variant. Sending HX needs the NDI **Advanced** SDK plus a license ID from NDI — that's the friction. People reach for it because of bandwidth, but the ~100 Mbps figures assume 1080p60. A 320×240 flat silhouette sits inside plain NDI's budget even on 5 GHz WiFi; 640×480 with several receivers gets tight. **Test before assuming you need HX.**

## 8. Resolution and board choice

MJPEG and NDI do not use H.264, so the Pi's hardware encoder is irrelevant. At mask resolution — 320×240 to 640×480, Mono8, on-camera binning — a **Pi 4 or Pi 5 is comfortable**. If buying new, Pi 5: faster CPU for segmentation and NDI, independent USB3 ports.

Full 5 MP is not viable — crop or bin on-camera. Avoid CPU debayering: mono model, or Mono8 pixel format. **Masks don't need resolution** — spend the budget on latency, not pixels.

## 9. Latency

Chain: exposure → readout → USB → segment → encode → network → decode → composite ≈ **150–300 ms**.
Most of that is receiver-side buffering (OBS Media Source, decoder), not the camera. The camera itself is exposure + readout + one or two frame periods. **Measure it — don't assume.**

Mitigations, by impact:

1. WiFi hygiene: 5 GHz, power save off, Pi close to the access point (§5).
2. Segment on the Pi — send the mask, not the camera picture.
3. Low resolution. MJPEG has no inter-frame buffering; if you ever use H.264, disable B-frames and use a zero-latency tune.
4. Receiver side: OBS Media Source → Network Buffering 0 MB.

---

## 10. Appliance checklist

The setup burden is yours, not the artists'. Minimum for it to feel like a product:

- [ ] Fixed hostname / mDNS name (`mask.local`)
- [ ] Auto-start on boot, auto-recover on camera disconnect
- [ ] Sensible defaults — works with nothing configured
- [ ] Small web page on the Pi: live mask preview + threshold slider, no terminal
- [ ] One-page handout: the MJPEG URL, plus a two-line note on OBS Virtual Camera
- [ ] *(v2)* NDI source named something human (`Mask — Studio A`), running alongside MJPEG
