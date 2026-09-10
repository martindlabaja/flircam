#!/bin/bash
# Fill pi/cloudinit/* templates from a secrets file. Output goes OUTSIDE the repo.
# usage: ./make-cloudinit.sh ~/pi-images/secrets.env ~/pi-images/cloudinit
# secrets.env lines (no quotes needed, spaces OK): PASSWORD=  WIFI_SSID=  WIFI_PASSWORD=  COUNTRY=CZ  TIMEZONE=Europe/Prague
#   optional: HOTSPOT_SSID= HOTSPOT_PASSWORD= VENUE_SSID= VENUE_PASSWORD= TS_AUTHKEY=  → written to wifi.env, imported by setup.sh
set -e
DIR=$(cd "$(dirname "$0")" && pwd)
python3 - "$DIR/cloudinit" "${1:?secrets.env}" "${2:?output dir}" "$HOME/.ssh/id_ed25519.pub" <<'PY'
import os, subprocess, sys
src, env, out, keyfile = sys.argv[1:]
v = {}
for line in open(env):
    if "=" in line and not line.startswith("#"):
        k, _, val = line.rstrip("\n").partition("="); v[k.strip()] = val.strip()
missing = [k for k in ("PASSWORD", "WIFI_SSID", "WIFI_PASSWORD", "COUNTRY", "TIMEZONE") if not v.get(k)]
if missing: sys.exit(f"fill in {env}: {', '.join(missing)}")
h = subprocess.check_output(["openssl", "passwd", "-6", "-stdin"], input=v["PASSWORD"].encode()).decode().strip()
q = lambda s: s.replace("\\", "\\\\").replace('"', '\\"')
sub = {"__HASH__": h, "__KEY__": open(keyfile).read().strip(), "__SSID__": q(v["WIFI_SSID"]),
       "__WIFI_PASSWORD__": q(v["WIFI_PASSWORD"]), "__COUNTRY__": v["COUNTRY"], "__TIMEZONE__": v["TIMEZONE"]}
os.makedirs(out, exist_ok=True)
for f in ("user-data", "meta-data", "network-config"):
    s = open(f"{src}/{f}").read()
    for k, val in sub.items(): s = s.replace(k, val)
    p = f"{out}/{f}"; open(p, "w").write(s); os.chmod(p, 0o600)
extra = [f"{k}={v[k]}" for k in ("HOTSPOT_SSID", "HOTSPOT_PASSWORD", "VENUE_SSID", "VENUE_PASSWORD", "TS_AUTHKEY") if v.get(k)]
open(f"{out}/wifi.env", "w").write("\n".join(extra) + "\n"); os.chmod(f"{out}/wifi.env", 0o600)
print(f"written: {out}/{{user-data,meta-data,network-config,wifi.env}}  ({len([e for e in extra if e.endswith("_SSID") or "_SSID=" in e])} extra WiFi profiles, tailscale key: {"yes" if v.get("TS_AUTHKEY") else "no"})")
PY
