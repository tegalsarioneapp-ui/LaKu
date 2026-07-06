---
name: BOP dm-card60 Output Unwrap
description: docOutput/pkDocOutput/lpjOutput must show document content directly — dm-card60 removed from DOM via MutationObserver in v1.62
---

## Rule
`#docOutput`, `#pkDocOutput`, and `#lpjOutput` must NOT show dm-card60 wrapper cards. Document HTML must render directly.

**Approach: JS DOM removal (not CSS override)**
CSS `display:none` was insufficient because v1.60 injects rules with equal or higher specificity.

In PATCH v1.62:
- `unwrapOutputEl(container)`: removes `.dm-card60` child from DOM, removes `has-doc60` class, resets child display
- `watchOutputEl(id)`: MutationObserver on each output container — fires when `.dm-card60` is added (via addedNodes filter), calls `requestAnimationFrame(unwrapOutputEl)`
- v1.60's observer won't re-wrap after removal because it only fires when ADDED nodes are non-card elements (removedNodes don't trigger re-wrap logic)

**Why CSS failed:** v1.60 has `.doc-paper.has-doc60>*:not(.dm-card60){display:none!important}` which hides all non-card children. CSS ID-selector override was theoretically stronger but didn't work in practice — DOM removal is deterministic.

**Why removing dm-card60 from DOM is safe:**
v1.60's observer check: `Array.from(m.addedNodes).some(n => !n.classList.contains('dm-card60'))`.
When we REMOVE dm-card60, the mutation has only removedNodes — no addedNodes → observer does nothing.
Next re-wrap only happens when previewDoc() runs again (adds new content → addedNodes → wrap → our observer removes again).

**How to apply:** Any new document output container added to the app MUST be added to `OUTPUT_IDS` array in v1.62.
