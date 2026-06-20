---
name: MoKu v2 Architecture
description: MoKu Mobile v2 rebuild — GPS accuracy, reverse geocoding, premium UI, feature additions
---

## What changed
MoKu was fully rebuilt from scratch (v1.5 → v2.0) in `artifacts/bop-app/public/moku/`.

## GPS accuracy
- Auto-starts GPS lock on page load (1.2s delay)
- `GPS_GOOD_ACC = 30m` — locks early if accuracy ≤ 30m OR elapsed ≥ 30s, otherwise waits up to 120s
- Reverse geocoding via Nominatim (free, no API key): `https://nominatim.openstreetmap.org/reverse?lat=…&lon=…&format=json`
- Geocode cache by `lat.toFixed(3),lon.toFixed(3)` key to avoid repeat requests
- GPS age check on capture: re-locks silently if GPS is >10 minutes old

## Watermark format
Four lines drawn on canvas bottom with gradient bar + gold accent line:
```
🏘 RT 005 RW 012 Tegalsari · [PhotoType]
📅 [Weekday, DD Month YYYY] · [HH:MM:SS] [WIB/WITA/WIT]
📍 [lat]°, [lng]° ±[acc]m
   [address from Nominatim if available]
```
Plus small "MoKu RT005" badge top-right.

## New features vs v1.5
- Activity modal (replaced `prompt()` with proper form)
- Photo lightbox (tap photo to view full-size)
- Individual photo download from lightbox
- Photo checklist chips with ✓ indicator
- Progress bar on active card
- Camera type chips shown in overlay
- Switch front/back camera button in overlay
- Toast notifications (no more `alert()`)
- Keyboard: Enter saves modal, Escape closes overlays
- Haptic feedback on capture (`navigator.vibrate(60)`)
- Camera rule-of-thirds grid overlay

## Version string
Main app references `moku/index.html?v=2.0` (updated in `loadMokuFrameV31()` and `goPage()`)

**Why:** Ensures browser cache busts when MoKu is updated; pattern must match `includes("v=2.0")`.
