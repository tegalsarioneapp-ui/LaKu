---
name: Activity workspace model
description: Durable constraints for the Persiapan Kegiatan Operasional workspace and its legacy compatibility layer
---

The activity-preparation experience uses a per-activity snapshot alongside the legacy scalar form fields. The legacy IDs and document renderers remain the compatibility contract; selecting an activity hydrates the scalar fields, and save/autosave copies them back to that activity record.

**Why:** The original application stored one global preparation object, so changing the selected RAP activity could overwrite attendance, notes, and receipt data from another activity. Replacing the old renderer outright would also break document generation and backups.

**How to apply:** Keep the activity index and active record when extending this area. Treat the existing form IDs and `previewPkDoc`/print pipeline as stable interfaces. The main HTML loads additional patch modules after `app.js`, so any final `goPage` or `activateTab` behavior that must win over late modules needs a post-load runtime reinstallation.