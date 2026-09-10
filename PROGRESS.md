# Progress — Mask Appliance

Tick as you go. Docs: `blackfly-s-rpi-setup.md` (why), `preflight-checklist.md` (what), `pi/` (scripts).

## Decisions

| Setting | Value | Note |
|---|---|---|
| Hostname | `mask` | reachable as `mask.local`; docs and scripts assume it |
| Username | `optical` | same as your laptop user → `ssh mask.local` needs no `user@` |
| Password | `optical` | console fallback only; SSH uses the key, sudo needs none |
| SSH login | password now, key after first boot | key already exists in WSL: `~/.ssh/id_ed25519.pub` |
| WiFi chain | `hotspot` 20 > `home` (Tomaskovi) 10 > `venue` 0 | `home` done; others via `pi/wifi.sh` |
| Tailscale | #1 `mask` `100.88.7.77`, #2 `mask-1` `100.86.146.117` | from anywhere: `ssh optical@mask`, `http://mask:8080` |
| Country / timezone | `__` / `Europe/____` | Imager → locale settings |

## Step 1 — Flash the card (laptop, no Pi needed)

- [x] Raspberry Pi Imager installed (raspberrypi.com/software)
- [x] SSH key exists — in WSL, `~/.ssh/id_ed25519.pub`
- [x] Imager: Device = your Pi · OS = *Raspberry Pi OS (other)* → **Raspberry Pi OS Lite (64-bit)** · Storage = SD card
- [x] Edit settings → **General**: hostname `mask`, username `optical` + password, home WiFi SSID + password, country, timezone
- [x] **Services**: enable SSH → password authentication (key copied in Step 2)
- [ ] Write, wait for verify — *Imager 2.0 stuck on "starting download" → Step 1b*

## Step 1b — Flash from WSL instead (Imager 2.0 hangs on download)

- [ ] Image downloaded: `~/pi-images/2026-06-18-raspios-trixie-arm64-lite.img.xz` (sha256 checked, see `download.log`)
- [ ] Fill `~/pi-images/secrets.env` (PASSWORD, WIFI_SSID, WIFI_PASSWORD, COUNTRY, TIMEZONE) — never in the repo
- [ ] `pi/make-cloudinit.sh ~/pi-images/secrets.env ~/pi-images/cloudinit` → hostname `mask`, user `optical`, SSH key + password, home WiFi
- [ ] Admin PowerShell: `Get-Disk` → note the SD card number → `wsl --mount \\.\PHYSICALDRIVE<n> --bare`
- [ ] WSL: `lsblk` shows the new disk (e.g. `/dev/sde`, right size)
- [ ] `sudo pi/flash.sh ~/pi-images/*.img.xz ~/pi-images/cloudinit /dev/sde`
- [ ] PowerShell: `wsl --unmount \\.\PHYSICALDRIVE<n>` → card into Pi

## Step 2 — First boot

- [x] Card in, power on, wait 2 min (first boot resizes and reboots itself)
- [x] Pi at `192.168.1.64` (`ping.exe -4 mask.local` from WSL finds it; WSL itself can't resolve `.local`)
- [x] Windows terminal: `ssh optical@mask.local` — WSL often can't resolve `.local`; use Windows `ssh` or the IP from your router
- [x] From WSL: `ssh-copy-id optical@mask.local` (use the IP if WSL can't resolve `.local`) → next login needs no password
- [x] `sudo apt update && sudo apt full-upgrade -y && sudo reboot` *(skipped full-upgrade; image is June 2026)*

## Step 3 — Install

- [x] `pi/` copied with `scp` to `~/flircam/pi` (repo not pushed yet)
- [x] `sudo pi/setup.sh && sudo reboot`
- [x] After reboot: `systemctl status mask` → active, `/usr/sbin/iw dev wlan0 get power_save` → off, active profile `home`
- [x] `cat /proc/cmdline` contains `usbfs_memory_mb=1000`
- [x] `sudo tailscale up` → logged in; Pi is `mask` / `100.88.7.77` on the tailnet
- [x] Tailscale in WSL (`opticalframewor`); `ssh optical@mask` and `http://mask:8080` work over the tailnet
- [x] Same test with the laptop on the phone hotspot: `ssh optical@mask` + `http://mask:8080` work via tailnet. WSL's tailscaled needs `sudo systemctl restart tailscaled` after a WiFi switch; install the Windows client for on-site use

## Step 4 — Webcam test

- [x] Genius USB webcam plugged in (Pi 4 Model B)
- [x] `http://192.168.1.64:8080` shows a live mask — 18 fps at 640×480, ~50 % of one core; slider works
- [x] Power off / Reboot buttons on the page — always use them instead of pulling the plug (reboot tested)
- [x] OBS → Media Source `http://mask:8080/stream.mjpg`, Network Buffering 0 → Virtual Camera on

## Step 5 — WiFi chain

- [x] `sudo pi/wifi.sh hotspot redmi` → profile `hotspot`, priority 20, power save off
- [ ] `sudo pi/wifi.sh venue "<SSID>"` (when the venue answers)
- [x] Hotspot on, Pi rebooted → joined `hotspot` with home WiFi still up; page reachable at `mask.local` / 192.168.43.65 from the laptop on the hotspot

## Step 6 — Second card (redundancy)

Same hostname `mask` on purpose: a drop-in spare. Don't run both Pis at once on the same network (mDNS renames the second to `mask-2.local`, Tailscale to `mask-1`). All credentials come from `~/pi-images/secrets.env`; when the venue answers, fill `VENUE_SSID` / `VENUE_PASSWORD`, re-run `pi/make-cloudinit.sh`, and on the running Pi `sudo pi/wifi.sh venue "<SSID>" "<pw>"`.

- [x] Fresh card in the **built-in Realtek reader** (not the Alcor USB one — see `sd-card-recovery.md`)
- [x] Admin PowerShell: `Get-Disk` → card number `<n>`; if Offline: `diskpart` → `select disk <n>` → `online disk` → `exit`
- [x] `Start-Process -Wait -FilePath "C:\Program Files\Raspberry Pi Ltd\Imager\rpi-imager.exe" -ArgumentList '--cli','C:\Users\marti\pi-images\2026-06-18-raspios-trixie-arm64-lite.img.xz','\\.\PhysicalDrive<n>'`
- [x] Replug the reader; `Copy-Item C:\Users\marti\pi-images\cloudinit\* "$((Get-Volume -FileSystemLabel bootfs).DriveLetter):\"` (4 files: user-data, meta-data, network-config, wifi.env)
- [x] Eject, card into the second Pi, **first Pi off**, power on, wait 2 min
- [x] Find it: `ping.exe -4 mask.local` from WSL → IP
- [x] `pi/provision.sh <ip>` → copies scripts, runs setup.sh (usbfs, Aravis, OpenCV, WiFi chain from wifi.env, sudoers, service), reboots
- [x] `sudo tailscale up` + URL, unless `TS_AUTHKEY` was in secrets.env → done, tailnet name `mask-1`, `100.86.146.117`
- [x] Verify: page at `http://mask.local:8080`, `nmcli connection show` lists hotspot 20 / home 10, Power off from the page works
- [ ] Label the card and the Pi: "mask #2"

## Step 7 — Camera arrives

→ `preflight-checklist.md` section B.

---

## Log

- 2026-09-10 (night) — Second Pi (4B rev 1.5, `mask`, 192.168.1.235) provisioned: setup.sh clean, hotspot 20 / home 10, powersave off, usbfs, sudoers, service enabled, Aravis 0.8.34 + OpenCV 4.10. Card had no ssh key and sudo asked a password (Imager-style user-data), so key was added by hand and setup ran with `sudo -S`. Tailscale `mask-1` / `100.86.146.117`; Reboot button from the page works, back on home WiFi in 15 s, page 200 via LAN and tailnet, webcam ~30 fps. Pending: label the card and Pi.
- 2026-09-10 (evening) — Fallback rehearsed: hotspot beats home at boot; Tailscale reaches the Pi across networks; OBS confirmed. Second-card recipe written (Step 6), `pi/provision.sh` added.
- 2026-09-10 — Tailscale on Pi + WSL, works. Hotspot profile added (chain: hotspot 20 > home 10 > venue 0). Power off / Reboot buttons on the web page, reboot tested. Webcam pipeline live at 18 fps. Pending: hotspot fallback rehearsal, OBS test, venue creds.
- 2026-09-10 — Card flashed (see `sd-card-recovery.md`). Pi boots, hostname `mask`, on Tomaskovi, key login works. `pi/setup.sh` done, rebooted: usbfs set, Aravis + OpenCV installed, service active, page answers on :8080, `home` profile active at priority 20.

- 2026-09-09 — Imager 2.0 hung on download; switched to WSL route: image via curl, cloud-init files from `pi/cloudinit`, write with `pi/flash.sh`.
- 2026-09-09 — Plan verified against FLIR docs. WiFi chain designed. `pi/` scaffold written and smoke-tested with a fake camera. Nothing run on a Pi yet.
