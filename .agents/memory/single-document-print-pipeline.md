---
name: Single document print pipeline
description: Durable rule for the Generate 7 Dokumen print flow
---

The Generate 7 Dokumen flow should expose one print action only. The action must send the current preview/editor HTML to the shared Global Print KOP renderer; do not add a second popup, direct window.print path, or HTML-download path to the same modal.

**Why:** Multiple legacy handlers on the same modal produced different print documents and allowed an older popup path to override the official KOP layout.

**How to apply:** When changing this modal, keep Preview and Edit separate from printing, keep one print button, and route it through the shared renderer after selecting the newest editor content.