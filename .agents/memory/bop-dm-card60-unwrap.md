---
name: BOP dm-card60 Output Unwrap
description: docOutput/pkDocOutput/lpjOutput must show document content directly, not collapsed into dm-card60 cards
---

## Rule
`#docOutput`, `#pkDocOutput`, and `#lpjOutput` are the main document render containers. They must NOT show their v1.60 `dm-card60` wrapper cards — document HTML must be visible directly.

Enforced via CSS in PATCH v1.62 (app.js ~line 10468):
```css
#docOutput .dm-card60, #pkDocOutput .dm-card60, #lpjOutput .dm-card60 { display: none !important; }
#docOutput.has-doc60 > *:not(.dm-card60), ... { display: block !important; }
```

This overrides v1.60's `.doc-paper.has-doc60 > *:not(.dm-card60) { display: none }` for these specific IDs only. dm-card60 cards remain active for other `.doc-paper` elements (e.g., riwayat/history view).

**Why:** User wants Generate Dokumen area to show document directly without collapsed card wrappers. The empty box bug (just icon, no title) was caused by pkDocOutput being on the same DOM page as docOutput, both wrapped.

**How to apply:** Never add `doc-paper` class to output containers without also adding the unwrap CSS override for their ID.
