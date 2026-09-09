# Pre-Flight Checklist — Mask Appliance

Everything that can be finished at home. Only lighting, framing, and threshold tuning genuinely require the venue.

---

## A. Build the image (no camera needed)

Develop against any cheap webcam — swap `aravissrc` for `v4l2src` and everything downstream is identical.

- [ ] OS installed, updated, 64-bit
- [ ] `usbcore.usbfs_memory_mb=1000` in `/boot/cmdline.txt`
- [ ] Aravis + GStreamer plugin installed
- [ ] OpenCV segmentation running
- [ ] MJPEG HTTP output working *(this is v1 — ship it)*
- [ ] *(v2, optional)* plain NDI output, running alongside MJPEG
- [ ] systemd autostart on boot
- [ ] Web UI: live preview + threshold slider
- [ ] Sensible defaults — runs with zero configuration

**Then clone it.** `dd` the card to an image file, flash a second card. On site you swap cards instead of debugging.

## B. Prove the camera end-to-end

The awkward failures live here. Do this at home, with the real Blackfly S.

- [ ] Camera enumerates via Aravis
- [ ] usbfs setting survives a reboot
- [ ] Powered hub holds up under **sustained** streaming (run it an hour, not a minute)
- [ ] Yank the USB cable mid-stream → does it auto-recover? *(This will happen on site.)*
- [ ] Power-cycle the Pi with camera attached → clean start
- [ ] Confirm target resolution/fps is actually achievable, not theoretical

## C. Test the artists' side

- [ ] MJPEG URL opens in a browser
- [ ] TouchDesigner pulls it via Video Stream In TOP
- [ ] **OBS → add URL as source → Virtual Camera on** — confirm it appears as a system webcam
- [ ] Two receivers at once — bandwidth still holds

*(v2, optional)* Plain NDI at mask resolution, seen by name in TouchDesigner / Resolume. Free SDK, ARM64 supported. **Not a blocker** — MJPEG plus OBS Virtual Camera covers every tool.

## D. Network — bring your own

- [ ] Small switch or travel router packed
- [ ] Static fallback IP set alongside mDNS
- [ ] Hostname and static IP **written on the case in marker**
- [ ] Don't plan on negotiating with venue IT or an unpredictable DHCP server

## E. Optics — settle before you travel

The one mistake that can't be fixed on the day.

- [ ] Venue dimensions obtained
- [ ] Field of view computed: camera-to-subject distance, subject width, sensor size
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
- [ ] Both power supplies: Pi USB-C 5 V/3 A, and the hub's
- [ ] HR10 12 V supply, if you built one

---

## On site — what's actually left

1. Mount and frame the camera
2. Set the lighting
3. Fine-focus
4. Tune the threshold via the web UI
5. Give artists the handout: MJPEG URL, plus the OBS Virtual Camera note
