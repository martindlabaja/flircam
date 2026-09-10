# Pre-Flight Checklist — Mask Appliance

Everything that can be finished at home. Only lighting, framing, and threshold tuning genuinely require the venue.

---

## A. Build the image (no camera needed)

Develop against any cheap webcam — `pi/config.json` `source: webcam` now, `aravis` later; everything downstream is identical. `sudo pi/setup.sh` does the items marked ⚙.

- [ ] Pi OS 64-bit (Bookworm or newer), updated
- [ ] ⚙ `usbcore.usbfs_memory_mb=1000` in `/boot/firmware/cmdline.txt`
- [ ] ⚙ `libaravis-0.8-0` + `aravis-tools-cli` installed, `aravis.rules` udev rule in place
- [ ] Pipeline sets every camera parameter on start (camera resets on power cycle) — or a default UserSet saved on-camera
- [ ] OpenCV segmentation running
- [ ] MJPEG HTTP output working *(this is v1 — ship it)*
- [ ] *(v2, optional)* plain NDI output, running alongside MJPEG
- [ ] ⚙ systemd autostart on boot
- [ ] Web UI: live preview + threshold slider + **Power off / Reboot** buttons (never pull the plug on a running Pi)
- [ ] Sensible defaults — runs with zero configuration

**Then clone it.** `dd` the card to an image file, flash a second card. On site you swap cards instead of debugging.

## B. Prove the camera end-to-end

The awkward failures live here. Do this at home, with the real Blackfly S.

- [ ] `arv-tool-0.8` lists the camera as a normal user (udev rule works)
- [ ] usbfs setting survives a reboot
- [ ] Power holds up under **sustained** streaming (run it an hour, not a minute) — hub for ≤ 3 m cable, HR10 12 V for 5 m
- [ ] Yank the USB cable mid-stream → does it auto-recover? *(This will happen on site.)*
- [ ] Power-cycle the Pi with camera attached → clean start, parameters re-applied
- [ ] Confirm target resolution/fps is actually achievable, not theoretical
- [ ] Measure end-to-end latency once, so you can quote it

## C. Test the artists' side

- [ ] MJPEG URL opens in a browser
- [ ] TouchDesigner pulls it via Video Stream In TOP
- [ ] **OBS → Media Source, Network Buffering 0 → Virtual Camera on** — confirm it appears as a system webcam
- [ ] Two receivers at once over WiFi — bandwidth and latency still hold

*(v2, optional)* Plain NDI at mask resolution, seen by name in TouchDesigner / Resolume. Free SDK, Pi arm64 supported. **Not a blocker** — MJPEG plus OBS Virtual Camera covers every tool.

## D. Network

Ask the venue before travelling:

- [ ] SSID + password for a **non-guest, non-isolated, portal-free** network, ideally 5 GHz
- [ ] Client isolation confirmed off, or a dedicated SSID/VLAN for you and the artists
- [ ] DHCP reservation for the Pi's MAC, in case mDNS doesn't cross their APs

On the Pi:

- [ ] Three profiles on the Pi: `hotspot` 20, `home` 10, `venue` 0 — `pi/wifi.sh`
- [ ] WiFi power save off on both profiles, survives reboot (`iw dev wlan0 get power_save` → off)
- [ ] `mask.local` resolves from a laptop on home WiFi and on the hotspot; two clients see each other
- [ ] Chain rehearsed once: home WiFi off → Pi lands on hotspot after power-cycle, stream reachable
- [ ] Hostname and reserved venue IP **written on the case in marker**

## E. Optics — settle before you travel

The one mistake that can't be fixed on the day.

- [ ] Venue dimensions obtained
- [ ] Field of view computed: camera-to-subject distance, subject width, sensor size (2/3")
- [ ] Correct focal length lens sourced
- [ ] Pre-focused roughly at home
- [ ] **Focus and iris rings locked** — setscrew or gaffer tape, so they can't drift in transit

## F. Tune offline

- [ ] Test footage recorded at home
- [ ] Segmentation tuned against the file
- [ ] Parameter ranges roughly right

Won't match venue lighting, but you'll be nudging a slider on site rather than writing code.

## G. Physical

- [ ] Every cable labelled
- [ ] Tripod plate / mount pre-fitted
- [ ] IR illuminator packed (if used)
- [ ] **Spare USB3 cable** — highest-wear item, and the one thing that will strand you
- [ ] Spare SD card (the clone from step A)
- [ ] Both power supplies: Pi (5 V/3 A for Pi 4, 5 V/5 A for Pi 5) and the hub's
- [ ] HR10 12 V supply — **required with a 5 m cable**

---

## On site — what's actually left

1. Mount and frame the camera
2. Set the lighting
3. Fine-focus
4. Tune the threshold via the web UI
5. Give artists the handout: MJPEG URL, plus the OBS Virtual Camera note
