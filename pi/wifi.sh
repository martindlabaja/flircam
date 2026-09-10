#!/bin/bash
# Add or replace one WiFi profile. Works while the network is out of range (pre-load venue creds at home).
# Chain: hotspot (20) > home (10) > venue (0). NetworkManager joins the highest-priority network in range.
# usage: sudo ./wifi.sh <home|hotspot|venue> "<SSID>" ["<password>"]
set -e
declare -A PRIO=([hotspot]=20 [home]=10 [venue]=0)
NAME=$1; SSID=$2; PASS=$3
[ -n "${PRIO[$NAME]}" ] && [ -n "$SSID" ] || { echo "usage: sudo $0 <home|hotspot|venue> <SSID> [password]"; exit 1; }
[ -n "$PASS" ] || read -rsp "password for $SSID: " PASS
if nmcli -t -f NAME connection show --active | grep -qx "$NAME"; then   # active: modify, don't drop it
  nmcli connection modify "$NAME" 802-11-wireless.ssid "$SSID" wifi-sec.psk "$PASS" \
    connection.autoconnect-priority "${PRIO[$NAME]}" wifi.powersave 2
else
  nmcli connection delete "$NAME" >/dev/null 2>&1 || true
  nmcli connection add type wifi ifname wlan0 con-name "$NAME" ssid "$SSID" \
    wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$PASS" \
    connection.autoconnect yes connection.autoconnect-priority "${PRIO[$NAME]}" wifi.powersave 2
fi
nmcli -f NAME,AUTOCONNECT-PRIORITY,DEVICE connection show
