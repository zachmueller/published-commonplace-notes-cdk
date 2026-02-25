# URL Scheme Redesign — Implementation Plan

## Summary of Changes

**Old format:** `#type=value&type=value&...` (e.g., `#u=abc123&u=def456`)
**New format:** `#{base_note_slug}/{type}{value}/{type}{value}/...` (e.g., `#evergreen-notes/uABC12345/uDEF67890`)

## Key Design Decisions

| Aspect | Old | New |
|---|---|---|
| Delimiter between notes | `&` | `/` |
| Parameter format | `type=value` | `{type}{value}` (no `=`) |
| Title parameter char | `t` | `~` |
| Base note name in URL | Not present | Optional slug from first panel's JSON `slug` field |
| URL without base name | N/A | Starts with `#/` (leading `/` immediately after `#`) — this is the **sole** mechanism for detecting slug absence |

### Parameter types

| Prefix | Meaning | Example segment |
|---|---|---|
| `u` | UID lookup | `uABC12345` |
| `p` | Permanent hash | `p7f3a2b1c` |
| `~` | Title/slug lookup | `~evergreen-notes` |
| `d` | Diff (future) | `d{hash1}\|{hash2}` |

### Base note name behavior

- Purely decorative — derived from the first panel's `slug` field in its JSON data
- On initial load without a base name (URL starts `#/...`), the URL auto-updates to prepend the first panel's slug
- If the first panel is closed, the base name regenerates from the new leftmost panel's slug
- The base name is **ignored** during parsing (only parameter segments determine which notes load)

## Changes Required (all in `assets/index/index.html`)

### 1. Rewrite `parseURLFragment()`

**Current behavior:** Splits on `&`, then splits each segment on `=` to get `{type, value}`.

**New behavior:**
- Strip leading `#` if present
- Check the **first character** of the remaining fragment:
  - `/` → no base note name present; remove the leading `/`, split the remainder on `/`, filter out empty segments — all segments are parameters
  - Any other character → base note name is present; split on `/`, discard the **first** segment (the decorative slug), remaining segments are parameters
- For each parameter segment: first character is the type, the rest is the value
- Return an array of `{ type, value }` objects (same shape as today)

### 2. Rewrite `updateURL()`

**Current behavior:** Builds `#type=value&type=value&...` from panel `dataset` attributes.

**New behavior:**
- Collect all panels' `paramType` and `paramValue`
- Build parameter path: `/{type}{value}` for each panel, joined together
- Derive base note name: read `dataset.slug` from the first panel element (see step 3)
- Produce: `#{slug}/{type}{value}/{type}{value}/...`
- If no panels exist, set hash to empty
- Use `history.replaceState` (not `pushState`) for base-name auto-fill updates, and `pushState` for actual navigation changes

### 3. Update `createPanel()` — store slug on panel element

- When creating a panel from `noteData`, store `noteData.slug` as `panel.dataset.slug` so `updateURL()` can read the first panel's slug without re-fetching

### 4. Update all hardcoded URL references

| Location | Old | New |
|---|---|---|
| Home link (header) | `#p=index` | `#/pindex` |
| Backlinks | `#u=${encodeURIComponent(link.uid)}` | `#/u${encodeURIComponent(link.uid)}` |
| Permanent link data attr | `#p=${noteData.hash}` | `#/p${noteData.hash}` |

The search result click handler already calls `addPanel('u', uid)` directly, so it doesn't need URL format changes — just verify `updateURL()` produces the correct output.

### 5. Update link click handler in `createPanel()`

- The `a[href^="#"]` click handler calls `parseURLFragment(href)` — will work automatically once `parseURLFragment` is updated, provided the inline links themselves are updated (step 4)

### 6. Update `loadPanelsFromURL()`

- Minimal change: already calls `parseURLFragment()` and iterates the result
- Ensure it handles the case where `parseURLFragment` returns an empty array (no hash, or just a bare slug with no parameters) by falling back to `addPanel('p', 'index')`

### 7. Update `updateOpenedNoteLinks()`

- Calls `parseURLFragment()` on each link's `href` — will work automatically once the parser and link formats are updated

## Disambiguation Logic (in `parseURLFragment`)

To detect whether a base note name (decorative slug) is present or absent:
- Strip the leading `#` and check the **first character** of the remaining fragment
- `/` → no base note name; all `/`-delimited segments are parameters
- Any other character → the first `/`-delimited segment is the decorative slug (discard it); subsequent segments are parameters
- This is unambiguous because:
  - `updateURL()` always produces `#/{params}` when no slug is available (transient state before slug resolves)
  - `updateURL()` always produces `#{slug}/{params}` when a slug is present
  - All programmatically generated and hardcoded links to individual notes use the `#/` prefix (e.g., `#/pindex`, `#/u{uid}`)

## Files Modified

| File | Change |
|---|---|
| `assets/index/index.html` | All changes above (single file) |

## Testing Checklist

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
