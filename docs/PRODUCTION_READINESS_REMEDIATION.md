# Production readiness remediation — 19 November 2026

Follow-up to the 7.6/10 local assessment. Scope: performance, rescue verification, Bangla, shelter data,
Alerts quiet days, tablets, accessibility, CI, and older-page consistency. Nothing was committed, pushed or
deployed. Measurements are from the local preview (Next.js 14.2 production build, local backend, local
test database `rokkha_preview`).

## 1. Performance

| Measure | Before | After |
| --- | --- | --- |
| First Load JS per main route (`next build`) | 590 kB → 520 kB (earlier same day) | **235 kB** |
| Shared chunk with district boundaries (0.97 MB raw / 293 kB gzip) | on every page | loaded only when shapes are needed (district report map, offline point lookup) |
| Saved-sample JSON (satellite 0.79 MB, hydro 65 kB) | on every page | loaded only when the backend does not answer |

JavaScript actually transferred, measured in Chrome with the network log, phone viewport, after the change:

| Route | JS transferred | Boundary file downloaded? |
| --- | --- | --- |
| `/`, `/alerts`, `/shelters`, `/contacts`, `/login`, `/rescue` | 251 kB | no |
| `/intelligence` | 293 kB | no |
| `/map` | 491 kB (includes MapLibre, about 208 kB, which only this page needs) | no |

- **How:**
  - `src/lib/districts.ts` provides the 64 district names from a 5 kB derived list (`src/data/district_list.json`). A unit test checks the list is identical to the boundary file.
  - The same file loads the boundary file on demand (cached) and provides a pure point lookup.
  - `src/services/api.ts` loads saved samples on demand.
- **Load times on localhost are not representative of phones and are not claimed as an improvement.**
- **Still large:** the 98 kB (gzip) shared chunk still contains the saved forecast and flood-history samples (about 285 kB raw), which a few synchronous code paths use.

## 2. Rescue verification

- **Accounts:**
  - `Backend/scripts/seed_local_test_accounts.py` creates one local admin and two rescuers in two teams through the normal API.
  - It refuses non-local databases and APIs, reads credentials from the environment (git-ignored `Frontend/.env.e2e.local`), and is idempotent.
  - Tested: run twice; refusal tested with an Atlas-style URI.
- **Browser tests (`Frontend/tests/e2e/rescue.spec.ts`)** use two real browser sessions, one per team:
  - Both teams press Accept at the same moment. Exactly one wins (one `accepted` step in the stored history). The other sees "The board has been refreshed" and loses the action buttons. Both boards show the same state.
  - Accepting does not mark the team en route. Each step (en route → arrived → in progress → completed) is a separate click, and every step records the team.
  - The sender reads the real status with their own key.
  - A release with the reason "Could not reach the place" puts the request back on the board. The other team accepts it, and the release is recorded with reason and team. An admin then closes the test request.
  - Permissions: the board API refuses anonymous users (401), and admin routes refuse a rescuer (403).
- **Backend:** `tests/test_api_rescue_board.py` and `tests/test_api_rescue.py` (43 tests, including 8 simultaneous accepts against real MongoDB) all pass.
- **Limit:** the backend allows 10 new requests per connection per hour. Each run of `rescue.spec.ts` creates 2, so about five runs per hour.

## 3. Bangla

`docs/BANGLA_REVIEW.md` (an AI review, **not** verified by a native speaker) lists 81 items. Section 5 records what was applied:
- the safety and meaning fixes;
- one pair of level names everywhere: Alert = সতর্কতা, Watch = নজরদারি (বিপদ only for FFWC's বিপদসীমা);
- English shown in Bangla mode;
- dates and units.

The items in "Needs a native-speaker check" remain open.

## 4. Shelter data

`docs/SHELTER_DATA_AUDIT.md` was read-only on the local copy.

- **Presentation-only changes** (`src/lib/facilities.ts`, unit-tested):
  - names are tidied for display, with the original shown on hover;
  - "Capacity not recorded" (the import never writes 0);
  - source and update date are shown, plus "whether it is open or has space now is unknown";
  - entries with the same name within 200 m are marked "May be listed twice". They are never merged, and similar names (for example "Eye" vs "ENT" hospital) are not flagged;
  - the type-derived "criticality" label was removed from the citizen list (it repeated the type and was wrong for animal hospitals).
- **Not changed:** stored records, categories, duplicates. These need review at the source (OSM) or an import decision.
- **Important finding:** no record in the local copy has `source_id`, which the importer uses to avoid duplicates. **Check production before running the importer again.**

## 5. Alerts and responsive design

- **Alerts:** a context panel built only from real data:
  - forecast status: issued time, or not stored, or saved sample when the server is unreachable;
  - coverage counts from the stored records;
  - what Watch and Alert mean, and that no Watch or Alert does not mean safe;
  - official sources: ffwc.gov.bd, 1090 (press 5) and 999;
  - next steps: map, shelters, methodology.
- **Day selector:** kept.
- **Widths checked:** 360, 390, 430, 768, 820, 1024, 1366, 1440 and 1920 px, on all routes. No horizontal scrolling.
- **Fixes:**
  - Intelligence section bar: fading edges with arrow buttons when more sections exist, and the current section scrolls into view;
  - homepage call-to-action labels no longer wrap at 1024 px;
  - contact groups use three columns on wide screens;
  - help links (contacts) moved to "Get help";
  - the duplicate Intelligence link was removed from "About".

## 6. Accessibility and CI

- **Tool:** axe-core 4.10 through `@axe-core/playwright` (dev dependency). WCAG 2.0, 2.1 and 2.2 A/AA rules were checked.
- **Coverage:** 8 pages in English and Bangla, the help-request dialog, the district report dialog, and the map with a district selected.
- **Found and fixed:**
  - login tabs pointed at missing panels (critical);
  - 4 contrast failures;
  - 3 interactive charts were marked as images;
  - map pins had no name.
- **Test:** `tests/e2e/a11y-scan.spec.ts` now fails on any serious or critical violation.
- **Exception:** the map pins' target size in the district report uses WCAG 2.5.8's "equivalent" exception. The same places are now listed as text under the map.
- **Not done:** no screen-reader testing. This is still outstanding, and automated checks do not prove WCAG conformance.
- **Security fix found on the way:** facility names were inserted into Leaflet popup HTML without escaping (`DistrictDetailMap.tsx`). They are now escaped.
- **CI:** `.github/workflows/frontend-checks.yml` runs on pull requests and pushes to `production`: `npm ci`, type check, production build, unit tests. It needs no secrets. The browser tests need a backend on a local test database, so they run on a developer machine (`npm run test:e2e`).
- **Map test time:** about 50 s for 15 tests. It has no fixed sleeps; each test starts MapLibre with the real geography (about 2 s). It was left as is rather than weakening isolation.

## 7. Results (actually run)

| Check | Result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | pass |
| Production build | pass |
| Frontend tests (Playwright: 12 unit + 55 browser) | **67 passed, 0 skipped** |
| Backend tests (pytest, local MongoDB) | **387 passed** |
| `npm ci` from the lockfile (clean folder) | pass |
