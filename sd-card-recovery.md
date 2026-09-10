# SD Card Recovery — "Dead" Cards After Pi Imager

Three cards appeared dead after imaging on Windows. **Two were fine; one had genuinely failed.** Two separate problems stacked, which made healthy cards look like dead hardware.

| Card | Outcome | Trust |
|------|---------|-------|
| 1 | **Dead** — CRC error on `clean` + bad blocks. | Bin |
| 2 | Reformats fine, but **failed Pi Imager's full write** with a bad block. | Do not deploy |
| 3 | Recovered with `diskpart`. No errors ever logged. Verified by write/readback. | **Use** |
| 4 | Never enumerated at all. | Unknown |

Three of four threw hard errors on the *known-good* reader. The bad USB reader explains the original corruption but not the bad blocks — that points to a bad batch. Return rather than recover.

---

## The two problems

**1. The USB card reader corrupted the cards during imaging.**

The Alcor Micro USB 2.0 reader destroyed the partition tables on write. Writing through it threw **6,281 disk I/O retries** (System log, `disk` event ID 153). The built-in Realtek PCIe reader threw **zero** on the same operations.

**2. Windows then made every repair look like it failed.**

With no valid MBR, the Windows storage stack *synthesizes* a fake partition — `FAT16 @ offset 0`, spanning the whole disk. It isn't on the card. `New-Partition` collided with this phantom and returned **"Not enough available capacity"**, while `Clear-Disk` had been silently succeeding the whole time.

The giveaway: a partition at **offset 0** is structurally impossible (it overlaps the MBR itself), and 30 GB of FAT16 exceeds the 4 GB FAT16 limit. Both are signs of a synthesized entry, not real data.

---

## Diagnosis that settled it

A raw read of sector 0, bypassing the partition manager:

```
BYTES ACTUALLY READ : 512 / 512
NON-ZERO BYTES      : 0 / 512
BOOT SIGNATURE      : 0x0000
```

Sector 0 was genuinely blank — no MBR at all — proving the reported partition did not exist. Zeros written to sector 0 also survived a physical eject and re-insert, proving the flash accepts and persists writes.

**Check the byte count.** A `FileStream.Read()` returning 0 leaves the buffer zeroed and reads as a false "blank sector". An earlier run without this check gave a wrong answer.

`diskpart`'s `detail disk` independently confirmed the media: `Current Read-only State : No`.

---

## The fix

The PowerShell Storage cmdlets cannot escape this — they consult the cached view. `diskpart clean` writes a fresh MBR and forces its own rescan.

Admin terminal, `list disk` first to confirm the number:

```
diskpart
list disk
select disk 3
clean
create partition primary
format fs=fat32 quick label=SDCARD
assign
exit
```

Result: partition at a properly aligned 1 MB offset, FAT32, full capacity. Verified with an 8 MB write/readback — checksums matched.

Notes:
- FAT32 works up to 32 GB; use `fs=exfat` above that.
- `Clear-Disk` + `New-Partition` in PowerShell **fails** here. Use `diskpart`.
- GParted was never needed — `diskpart clean` does the same raw-table rewrite.

---

## Telling a good card from a broken one

Windows can't read ext4, so a correctly flashed Pi card looks half-broken but is fine:

```
HEALTHY (Pi OS)                          BROKEN (no partition table)
2 partitions                             1 partition
  0.5 GB FAT32 @ 4 MB  → drive letter      29.5 GB "FAT16" @ offset 0
  29.5 GB ext4 @ 541 MB (unreadable)       no drive letter
```

**Tell:** healthy = two partitions, small one gets a drive letter. Broken = one partition, offset 0, no letter.

A card showing `bootfs` in Explorer with ~500 MB is **normal and bootable**. Do not reformat it.

---

## Telling a bad reader from bad media

Check the Windows System log — the event IDs separate the two cleanly:

| Signal | Meaning |
|--------|---------|
| `disk` **ID 153** (Warning) — "IO operation ... was retried" | Usually the *reader*. Thousands through the USB reader, zero through the Realtek. |
| `disk` **ID 7** (Error) — "has a bad block" | **The media.** Hard error, physical failure. |
| `diskpart`: "Data error (cyclic redundancy check)" | **The media.** Flash returning corrupt data. |

Card 1 threw ID 7 + CRC on the *known-good* Realtek reader, having failed the same script that recovered card 3 seconds earlier. That is a dead card — no tool on any OS fixes bad blocks.

Count them:

```powershell
Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='disk'; StartTime=(Get-Date).AddMinutes(-30)} |
  Group-Object Id | Select-Object Name,Count
```

---

## A quick format proves nothing

Card 2 passed `diskpart clean`, formatted FAT32, and survived a 512 MB write/readback with matching checksums — while having a **known bad block**.

512 MB is 1.7% of a 30 GB card. The bad region simply wasn't in it.

**Pi Imager's write + verify is the real surface test**, and card 2 had already failed it. If Imager fails on a card, a successful reformat does not clear it. Either run a full-capacity write/verify (h2testw, or `dd` + checksum over the whole device) or replace the card.

---

## Takeaways

- **Flash through the built-in Realtek slot, not the USB reader.** That reader caused this.
- Check `disk` event ID 153 counts to separate a bad reader from bad media — a good reader shows zero.
- Keep Pi Imager's **Verify** enabled; it catches a corrupt write at flash time — and it is the most thorough surface test readily to hand.
- A card that fails Imager and then reformats cleanly is **still suspect**. Don't deploy it unattended.
- `Get-Disk` / `Get-Partition` can report partitions that do not exist. Trust a raw sector read.
- **Identify a card before wiping it.** Nearly reformatted the one good bootable card — the safety gates can't catch that, only the partition signature distinguishes them.
