#!/bin/bash
# One-shot Pi setup. Run once on a fresh Pi OS Lite 64-bit: sudo ./setup.sh
set -e
[ "$EUID" -eq 0 ] || { echo "run with sudo"; exit 1; }
DIR=$(cd "$(dirname "$0")" && pwd)
USER_NAME=${SUDO_USER:-pi}

# USB buffer for USB3 Vision (default 16 MB is too small)
CMD=/boot/firmware/cmdline.txt
grep -q usbfs_memory_mb "$CMD" || sed -i '1 s/$/ usbcore.usbfs_memory_mb=1000/' "$CMD"

# Aravis (USB3 Vision + aravissrc), OpenCV, GStreamer
apt-get update
apt-get install -y libaravis-0.8-0 aravis-tools-cli python3-opencv iw \
  gstreamer1.0-plugins-base gstreamer1.0-plugins-good
curl -fsSL https://raw.githubusercontent.com/AravisProject/aravis/main/src/aravis.rules \
  -o /etc/udev/rules.d/aravis.rules
udevadm control --reload

# WiFi chain: hotspot (20) > home (10) > venue (0). The network the Pi booted on becomes "home".
# Add the others: sudo ./wifi.sh hotspot "<SSID>" ; sudo ./wifi.sh venue "<SSID>"
ACTIVE=$(nmcli -t -f NAME,TYPE connection show --active | awk -F: '$2=="802-11-wireless"{print $1; exit}')
if [ -n "$ACTIVE" ] && [ "$ACTIVE" != home ]; then
  "$DIR/wifi.sh" home "$(nmcli -g 802-11-wireless.ssid connection show "$ACTIVE")" \
                      "$(nmcli -s -g 802-11-wireless-security.psk connection show "$ACTIVE")"
fi

# hotspot / venue from wifi.env on the boot partition (made by make-cloudinit.sh) — second card works out of the box
ENVF=/boot/firmware/wifi.env
get() { sed -n "s/^$1=//p" "$ENVF" | head -1; }
if [ -f "$ENVF" ]; then
  [ -n "$(get HOTSPOT_SSID)" ] && "$DIR/wifi.sh" hotspot "$(get HOTSPOT_SSID)" "$(get HOTSPOT_PASSWORD)"
  [ -n "$(get VENUE_SSID)" ]   && "$DIR/wifi.sh" venue   "$(get VENUE_SSID)"   "$(get VENUE_PASSWORD)"
fi

# Tailscale: remote access from home while the Pi sits on the venue network. Login is the one manual step.
command -v tailscale >/dev/null || curl -fsSL https://tailscale.com/install.sh | sh
systemctl enable --now tailscaled
# auth key in wifi.env (Tailscale admin → Settings → Keys → reusable, pre-authorized) logs in without a browser
if [ -f "$ENVF" ] && [ -n "$(get TS_AUTHKEY)" ] && ! tailscale status >/dev/null 2>&1; then
  tailscale up --auth-key="$(get TS_AUTHKEY)"
fi

# Let the web UI power off / reboot cleanly (SD-card safe) without a password
echo "$USER_NAME ALL=(root) NOPASSWD: /usr/bin/systemctl poweroff, /usr/bin/systemctl reboot" > /etc/sudoers.d/mask
chmod 440 /etc/sudoers.d/mask && visudo -cf /etc/sudoers.d/mask >/dev/null

# Service
sed "s|@DIR@|$DIR|; s|@USER@|$USER_NAME|" "$DIR/mask.service" > /etc/systemd/system/mask.service
systemctl daemon-reload
systemctl enable mask

tailscale status >/dev/null 2>&1 && echo "OK — tailscale logged in" || echo "OK — now: sudo tailscale up   (open the URL it prints, once per card)"
echo "then reboot and open http://mask.local:8080"
