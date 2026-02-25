# URL Scheme Redesign — Implementation Tasks

> Derived from [plan.md](./plan.md). All changes target `assets/index/index.html`.

---

## Phase 1: Core Parsing & URL Generation

These are the foundational changes. Everything else depends on the new URL format being parseable and producible.

### Task 1.1 — Rewrite `parseURLFragment()` ✅

**Depends on:** Nothing (starting point)

Replace the current `&`/`=`-based parser with the new `/`-delimited, prefix-based parser:

1. Strip leading `#` if present
2. Inspect the **first character** of the remaining string:
   - `/` → no base note name; remove leading `/`, split remainder on `/`, filter empties — all segments are parameters
   - Any other char → base note name present; split on `/`, discard first segment (decorative slug), remaining segments are parameters
3. For each parameter segment: first char = type, rest = value
4. Return array of `{ type, value }` objects (same shape as current implementation)

**Acceptance criteria:**
- `parseURLFragment('#/pindex')` → `[{ type: 'p', value: 'index' }]`
- `parseURLFragment('#/uABC12345/uDEF67890')` → `[{ type: 'u', value: 'ABC12345' }, { type: 'u', value: 'DEF67890' }]`
- `parseURLFragment('#my-note/uABC12345/uDEF67890')` → `[{ type: 'u', value: 'ABC12345' }, { type: 'u', value: 'DEF67890' }]` (slug discarded)
- Empty/missing hash returns `[]`

---

### Task 1.2 — Rewrite `updateURL()` ✅

**Depends on:** Task 1.1 (must agree on format)

Replace the `#type=value&...` builder with the new `#{slug}/{type}{value}/...` builder:

1. Collect all panels' `paramType` and `paramValue` from dataset attributes
2. Build parameter path: `/{type}{value}` for each panel, joined together
3. Read `dataset.slug` from the first panel element to derive the base note name
4. Produce final hash: `#{slug}/{type}{value}/{type}{value}/...`
5. If no panels exist, set hash to empty
6. Use `history.replaceState` for base-name auto-fill updates; `pushState` for actual navigation changes

**Acceptance criteria:**
- Single panel with slug `evergreen-notes`, type `u`, value `ABC12345` → `#evergreen-notes/uABC12345`
- Two panels → `#{first-panel-slug}/uABC12345/uDEF67890`
- No panels → empty hash
- Base-name auto-fill uses `replaceState`, not `pushState`

---

## Phase 2: Data Plumbing

Ensures the slug data flows from note JSON into the DOM so `updateURL()` can read it.

### Task 2.1 — Update `createPanel()` to store slug on panel element ✅

**Depends on:** Task 1.2 (updateURL needs `dataset.slug` to exist)

When creating a panel from `noteData`, store `noteData.slug` as `panel.dataset.slug` so `updateURL()` can read the first panel's slug without re-fetching.

**Acceptance criteria:**
- After `createPanel()` runs, `panelElement.dataset.slug` equals the note's `slug` field from JSON
- If `slug` is missing/undefined in JSON, `dataset.slug` is set to empty string (so `updateURL` falls back to `#/...` format)

---

## Phase 3: Hardcoded URL References

Update all places that construct URLs with the old format. These can be done in parallel but depend on Phase 1 for the format to be consistent.

### Task 3.1 — Update home link

**Depends on:** Task 1.1

Change the header home link from `#p=index` to `#/pindex`.

---

### Task 3.2 — Update backlink URLs

**Depends on:** Task 1.1

Change backlink `href` construction from `#u=${encodeURIComponent(link.uid)}` to `#/u${encodeURIComponent(link.uid)}`.

---

### Task 3.3 — Update permanent link data attribute

**Depends on:** Task 1.1

Change permanent link value from `#p=${noteData.hash}` to `#/p${noteData.hash}`.

---

## Phase 4: Dependent Logic Updates

These functions consume the output of the parser or URL builder and need minor adjustments.

### Task 4.1 — Update `loadPanelsFromURL()`

**Depends on:** Task 1.1, Task 1.2

Verify/update fallback behavior:
- Already calls `parseURLFragment()` and iterates the result
- Ensure it handles the case where `parseURLFragment` returns an empty array (no hash, or bare slug with no parameters) by falling back to `addPanel('p', 'index')`

**Acceptance criteria:**
- Navigating to `#` or `#some-slug` (no parameters) loads the index note
- Navigating to `#/pindex` loads the index note
- Navigating to `#/uABC12345/uDEF67890` loads two panels

---

### Task 4.2 — Verify link click handler in `createPanel()`

**Depends on:** Task 1.1, Task 3.1–3.3

The `a[href^="#"]` click handler calls `parseURLFragment(href)`. Verify it works correctly with the new format — no code change expected if Phase 1 and Phase 3 are correct, but explicitly test:

- Clicking an internal `#/u{uid}` link parses correctly and opens the right panel
- Clicking an internal `#/p{hash}` link parses correctly

---

### Task 4.3 — Verify `updateOpenedNoteLinks()`

**Depends on:** Task 1.1, Task 3.1–3.3

This function calls `parseURLFragment()` on each link's `href`. Verify it works with the new format — no code change expected, but explicitly test:

- Opened-note styling is correctly applied to links matching currently open panels

---

### Task 4.4 — Verify search result click handler

**Depends on:** Task 1.2

The search result handler calls `addPanel('u', uid)` directly (no URL construction). Verify that after the panel opens, `updateURL()` produces correct output. No code change expected.

---

## Phase 5: Integration Testing

End-to-end verification using the testing checklist from the plan.

### Task 5.1 — Manual testing pass

**Depends on:** All previous tasks

Run through the full testing checklist:

- [ ] `#/pindex` loads the home/index note
- [ ] `#/uABC12345` loads a single note and URL auto-updates to `#{slug}/uABC12345`
- [ ] `#/uABC12345/uDEF67890` loads two panels and URL auto-updates with first panel's slug
- [ ] `#my-note/uABC12345/uDEF67890` loads two panels (ignoring `my-note` slug)
- [ ] Clicking an internal link appends the new note's parameter to the URL
- [ ] Closing the first panel updates the base note name to the new first panel's slug
- [ ] Closing any panel removes its parameter segment from the URL
- [ ] Search results open correctly and URL updates
- [ ] Home link navigates to `#/pindex`
- [ ] Backlinks render with correct `#/u{uid}` format
- [ ] Permanent link copies correct `#/p{hash}` URL

---

## Dependency Graph

```
Phase 1 (Core)
  Task 1.1  parseURLFragment ──────────────────────┐
  Task 1.2  updateURL ─────────────────────────┐    │
                                                │    │
Phase 2 (Data)                                  │    │
  Task 2.1  createPanel slug ──► Task 1.2       │    │
                                                │    │
Phase 3 (Hardcoded URLs)          ◄─────────────┼── Task 1.1
  Task 3.1  home link                           │
  Task 3.2  backlinks                           │
  Task 3.3  permanent link                      │
                                                │
Phase 4 (Dependent Logic)                       │
  Task 4.1  loadPanelsFromURL ──► Task 1.1, 1.2│
  Task 4.2  link click handler ──► Task 1.1, 3.x
  Task 4.3  updateOpenedNoteLinks ──► Task 1.1, 3.x
  Task 4.4  search handler ──► Task 1.2         │
                                                │
Phase 5 (Testing)                               │
  Task 5.1  manual testing ──► ALL              │
```

## Suggested Implementation Order

1. **Task 1.1** — `parseURLFragment()` rewrite
2. **Task 1.2** — `updateURL()` rewrite
3. **Task 2.1** — Store slug on panel element
4. **Tasks 3.1, 3.2, 3.3** — Update hardcoded URLs (can be done together in one pass)
5. **Task 4.1** — Update `loadPanelsFromURL()` fallback
6. **Tasks 4.2, 4.3, 4.4** — Verification of dependent handlers
7. **Task 5.1** — Full integration test