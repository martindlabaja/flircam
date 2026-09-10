#!/bin/bash
# Run from the laptop after a fresh card boots: copies pi/ over, runs setup.sh, reboots.
# usage: ./provision.sh <ip or hostname>       (key login must work: cloud-init card → yes; Imager card → ssh-copy-id first)
set -e
H=${1:?ip or hostname}; DIR=$(cd "$(dirname "$0")" && pwd)
ssh-keygen -R "$H" >/dev/null 2>&1 || true
ssh -o StrictHostKeyChecking=accept-new optical@"$H" 'mkdir -p ~/flircam'
scp -q -r "$DIR" optical@"$H":~/flircam/
ssh -t optical@"$H" 'cd ~/flircam/pi && sudo ./setup.sh 2>&1 | tail -15'
ssh optical@"$H" 'tailscale status >/dev/null 2>&1' && echo "tailscale: logged in" || {
  echo "tailscale: run  ssh -t optical@$H sudo tailscale up  and open the URL, or put TS_AUTHKEY in secrets.env"; }
ssh optical@"$H" 'sudo reboot' || true
echo "rebooting — then open http://$H:8080"
