---
name: MoKu Watermark Premium v2
description: drawWatermark in moku/app.js — premium redesign with 3 font tiers, gold accent, address prominent, coordinates always secondary
---

## Rule
`drawWatermark` (moku/app.js ~line 857) uses three font sizes:
- **fzTitle** (`W * 0.028`): activity name — bold white
- **fzInfo** (`W * 0.020`): date/time (white) + address (gold `#ffd660`)
- **fzSub** (`W * 0.014`): raw coordinates (silver) + RT identity line (always)

Gold address slot (`addrLine`) always shows a human-readable label:
- If geocoded → address string
- If GPS only, no geocode → `"📍 Lokasi GPS terdeteksi"` (NOT raw coords)
- If no GPS → `"📍 GPS tidak tersedia"`

Raw coordinates (`coordLine`) always appear in the small silver line **whenever GPS is available** — never in the gold slot.

RT identity line `"RT 005 RW 012 · Tegalsari, Candisari, Semarang"` is always rendered at the bottom regardless of GPS state.

**Why:** User wants RT identity always present and address prominent/readable. Raw coordinates as discreet secondary info, not the headline.

**How to apply:** Any future change to watermark rendering must maintain this separation. Gold slot = human label. Silver slot = technical coords.
