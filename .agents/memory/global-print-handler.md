---
name: Global print handler
description: Constraint for keeping the Document Studio print action on the shared KOP renderer.
---

The Document Studio print button registers its legacy print function with `addEventListener`; replacing only its `onclick` property does not remove that listener. The shared print pipeline must intercept the button in capture phase and stop immediate propagation.

**Why:** Both handlers can otherwise run from one click, producing a print preview with legacy KOP geometry instead of the correct application preview.

**How to apply:** When changing global document printing, keep the capture-phase guard on the dynamically created Document Studio print button and route it through the shared print renderer.