#!/bin/bash
# Write the image, then drop cloud-init files on the boot partition.
# WSL: first, in admin PowerShell:  wsl --mount \\.\PHYSICALDRIVE<n> --bare   (n from Get-Disk)
# usage: sudo ./flash.sh <image.img.xz> <cloud-init dir> /dev/sdX
set -e
IMG=${1:?image.img.xz}; CI=${2:?cloud-init dir}; DEV=${3:?/dev/sdX}
[ -b "$DEV" ] || { echo "no block device $DEV"; exit 1; }
for f in user-data meta-data network-config; do [ -f "$CI/$f" ] || { echo "missing $CI/$f"; exit 1; }; done
lsblk -o NAME,SIZE,MODEL "$DEV"
if [ "$FORCE" != 1 ]; then read -rp "ERASE $DEV — type yes: " a; [ "$a" = yes ] || exit 1; fi
xz -dc "$IMG" | dd of="$DEV" bs=4M status=progress conv=fsync
blockdev --rereadpt "$DEV"; sleep 2
BOOT=$(lsblk -nrpo NAME "$DEV" | sed -n 2p)
M=$(mktemp -d); mount "$BOOT" "$M"
cp "$CI"/{user-data,meta-data,network-config} "$M"/; [ -f "$CI/wifi.env" ] && cp "$CI/wifi.env" "$M"/
sync; umount "$M"; rmdir "$M"
echo "done. WSL: wsl --unmount \\\\.\\PHYSICALDRIVE<n>   then boot the Pi"
