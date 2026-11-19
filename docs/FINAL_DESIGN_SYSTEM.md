# Rokkha — final design system decisions (19 November 2026)

This is the decision record for the final polish pass. The detailed system is still
[ROKKHA_DESIGN_SYSTEM.md](ROKKHA_DESIGN_SYSTEM.md) ("Earth & Emerald"). The tokens live in one place,
`Frontend/src/app/globals.css` (`--rk-*`), and are exposed to Tailwind through `tok()` in
`Frontend/tailwind.config.ts`. **No second theme or duplicate token set was introduced.**

## 1. What UI/UX Pro Max recommended, and what was adopted

| Run | Recommendation | Decision |
| --- | --- | --- |
| `--design-system "environmental intelligence geospatial flood forecasting AI research platform professional dashboard"` | "AI-Native UI": purple `#7C3AED` + cyan, typing/pulse effects | **Rejected.** The brief asks for no AI-themed decoration, and purple has no link to water, land or Bangladesh. |
| Retry (narrower): `"environmental climate geospatial data platform"` | "Organic Biophilic": nature greens, a mono face for data, natural shadows, 16–24 px radii; anti-patterns "greenwashing", "no real data" | **Direction confirmed.** It matches the adopted Earth & Emerald system, so the existing tokens were kept. The suggested Fira Code/Fira Sans pair was not adopted because Manrope/Inter/IBM Plex Mono already do the same job and are loaded. |
| UX searches (empty state, error recovery, reduced motion, focus, touch target, dialog focus, inline validation) | Empty states must explain and offer an action; errors must offer a recovery path and be announced; visible focus; 24 px minimum target (WCAG 2.2 AA); reduced-motion support | **Adopted** as the rules in §5–§7; applied in this pass. |
| Chart search (time series / model evaluation) | Solid actual vs dashed forecast lines; direct labels; text fallback; toggles must change the chart | **Already met** by the hydrograph and `/intelligence` charts. Kept. |
| Next.js stack search | Code-split heavy components with dynamic imports; measure the bundle | **Adopted.** The saved-sample JSON now loads on demand (§8). |

The persisted skill file `Frontend/design-system/rokkha/MASTER.md` already points to the adopted system. It was
**not** regenerated or overwritten.

## 2. Identity

- **Primary:** flood forecasting, geospatial intelligence and early warning.
- **Secondary:** assistance and rescue.
- **Tone:** calm, credible and environmental; not a SaaS dashboard, not a control room.

## 3. Colour tokens (unchanged values)

| Role | Token |
| --- | --- |
| Text | `--rk-ink` #344B45 |
| Strong headings and dark sections | `--rk-forest` #173D32 |
| Secondary text | `--rk-muted` #4F5F53 (6.0:1 on ivory) |
| Page | `--rk-page` #F4F0E6 |
| Cards | `--rk-surface` #FFF |
| Quiet surfaces | `--rk-secondary`, `--rk-sand`, `--rk-mist` |
| Borders | `--rk-line` |
| Primary action (call-to-action buttons, active navigation) | `--rk-brand` #247A5B |
| Hover / pressed | `--rk-brand-strong` |
| Selected | `--rk-brand-soft` |
| Status | `--rk-danger*`, `--rk-warning*`, `--rk-success*`, `--rk-info*` |

**Flood data scale** (separate from the brand, always shown with a legend):
- `--rk-risk-alert`;
- `--rk-risk-watch`;
- `--rk-risk-low` (never a "safe" green);
- `--rk-risk-unknown` (no forecast, never shown as low).

**Rule added in this pass:** flood-status colours (alert red, watch amber) are used only for flood status.
A facility's "criticality" in the register is not a flood status, so it is now neutral text, not a red badge.

## 4. Type, spacing, radius, elevation

- **Type:**
  - Manrope for headings;
  - Inter for text;
  - IBM Plex Mono for technical values (model version, coordinates, distances, data-kind badges);
  - Noto Sans Bengali for Bangla.
- **Type scale in use:**
  - page `h1`: 20–28 px on tool pages, 34–58 px on the home and Intelligence heroes;
  - card titles: 18 px;
  - body: 16 px;
  - small text: 13–14 px;
  - badges: 11 px, nothing smaller;
  - sentence case for headings and labels (Title Case removed from Alerts, Shelters, page titles, filters).
- **Spacing:** Tailwind's 4 px grid. Cards use `p-4`/`p-5` on phones and `p-6`/`p-8` from `sm`.
- **Radius:**
  - inputs and buttons `rounded-lg`/`rounded-xl`;
  - cards `rounded-2xl`;
  - page panels `rounded-3xl`;
  - pills `rounded-full`.
- **Elevation:**
  - cards `shadow-sm`;
  - interactive cards `hover:shadow-md`;
  - floating map panels `--rk-shadow-float`;
  - no glow, no glass.

## 5. Components and states

- **Buttons** (`ui/button.tsx`):
  - every variant now has a real hover (previously the default/pill/alert hover colour equalled the base colour);
  - transitions are limited to colour, shadow and transform (150 ms);
  - press scale is turned off under reduced motion;
  - focus ring `ring-2` with offset.
- **Toggle groups** (filters) use `aria-pressed`.
- **Selects** have a visible or `sr-only` label.
- **Status pages: four distinct states, never merged:**

| State | Shown as |
| --- | --- |
| Loading | `role="status"`; pulse only when motion is allowed |
| No data for this day | Neutral icon, why it is missing, and a next step (e.g. "See the day before") |
| None reached the threshold | Neutral icon (not a green tick), plus the coverage limit (56 of 64 districts) and "low chance is not zero" |
| Request failed | `role="alert"`, "could not be loaded", "this does not mean there are none", and **Try again** |

- **Dialogs:**
  - they have an accessible name;
  - focus moves in;
  - Tab stays inside;
  - Escape closes;
  - focus returns to the opener.
  - Radix dialogs already did this; the custom help-request dialog now does too.
- **Clickable cards are `<button>`s**, so they are reachable by keyboard.

## 6. Motion

- 150–200 ms for colour and shadow changes.
- No motion that only decorates data.
- Everything stops under `prefers-reduced-motion` (global rule in `globals.css`, plus `motion-safe:`/`motion-reduce:` on pulses, spins and lifts).

## 7. Accessibility standard

- WCAG 2.2 AA.
- Text contrast is at least 4.5:1, using the token pairs above.
- Visible `:focus-visible` everywhere.
- Pointer targets at least 24 px; primary controls 40–48 px.
- One `h1` per page.
- Every form control is labelled.
- Charts have a text alternative.

## 8. Charts and maps

- Every chart states what it measures, its units, period, source, kind (observed / modelled / forecast / evaluation), how to read it, and its limits.
- Forecast lines are dashed.
- Missing days are gaps.
- Legends stay visible.
- Data-kind badges never wrap.
- Map panels never repeat the title.

## 9. Anti-patterns (do not)

- Purple or "AI" styling, glow, glass or constant animation.
- Green for "low flood chance".
- Red or amber for anything that is not flood status.
- Placeholder-only labels.
- An empty list shown when a request failed.
- Instructions pointing to controls that are not on the page.
- ISO dates in sentences (use "19 Nov 2026"; ISO stays in technical/source lines).
- Raw `[lon, lat]` arrays (show "24.922° N, 91.443° E").
