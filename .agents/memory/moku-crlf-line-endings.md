---
name: MoKu index.html CRLF line endings
description: artifacts/bop-app/public/moku/index.html uses CRLF line endings, unlike styles.css and app.js in the same folder which use LF.
---

`artifacts/bop-app/public/moku/index.html` has Windows-style CRLF (`\r\n`) line endings, while the sibling `styles.css` and `app.js` files use plain LF. This is file-specific, not folder-wide — check each file individually with `file <path>` before assuming.

**Why:** The `edit` tool matches `old_string` byte-for-byte. If you type a multi-line `old_string` with normal `\n` newlines, it silently fails to match against CRLF content (no error explaining why — it just reports no match), because Python is not available in this environment to inspect/fix raw bytes programmatically.

**How to apply:** Before editing a `.html`/text file that isn't matching as expected, run `file <path>` to check for "CRLF line terminators". If CRLF, convert to LF first (`sed -i 's/\r$//' path`), make edits normally, then restore CRLF afterward (`sed -i 's/$/\r/' path`) to preserve the original file convention and avoid noisy diffs.
