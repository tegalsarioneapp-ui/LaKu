---
name: MoKu BOP Sync Safety Rules
description: syncFromBOP and checkBopSync expansion and cleanup rules to prevent phantom activities and data loss
---

## Rule 1 — isAll expansion
`isAll` in both `syncFromBOP` and `checkBopSync` must NOT include `bulan === ""`.

Correct condition:
```js
const isAll = bulan === MOKU_MONTH_ALL || hasRange;
```

`bulan === ""` (no month assigned) = single unscheduled entry. Expanding it to all 12 months creates phantom Jan–Jun activities.
`MOKU_MONTH_ALL = "Januari-Desember 2026"` triggers full-year expansion.

**Why:** RAP items without a month were being exploded to 12 entries, filling MoKu with fake activities for every month of the year.

## Rule 2 — Stale cleanup safety
Stale BOP Sync cleanup must protect activities that have linked results:
```js
const hasLinkedData = id => {
  const res = (state.results || {})[id] || {};
  return Object.values(res).some(v => v && String(v).trim().length > 0);
};
state.activities = activities.filter(a => !removeIds.has(a.id)); // only removes if !hasLinkedData
```

**Why:** RAP item renames/month changes regenerate IDs. Deleting the old ID orphans all documented results tied to that activity. Activities with any result entries must be kept even when no longer in the current RAP.
