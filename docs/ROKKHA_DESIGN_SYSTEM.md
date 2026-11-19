# Rokkha design system — "Earth & Emerald: Environmental Intelligence"

*Forecast first. Understand the geography. Warn early. Coordinate help when needed.*

Rokkha is first a flood forecasting, geospatial and early-warning platform, and second a help-request and
rescue-coordination service. The look should be that of a mature climate-intelligence product with a human
purpose: rich and natural (river, forest, earth), calm, scientific without being cold. It should look neither
like a plain admin template nor like a flashy SaaS page.

Adopted 19 November 2026; replaces "Calm Humanitarian" (teal on white), which reviewers found too plain and too
rescue-led. Tokens live in `Frontend/src/app/globals.css` (`--rk-*`) and `Frontend/tailwind.config.ts`
(`rk-*` colours, `bg-grad-*`, `font-display`, `font-mono`). Components never use raw hex values. Leaflet and
SVG illustrations need literal colours; they copy the token values and say so in a comment. The UI UX Pro Max
persistent file `Frontend/design-system/rokkha/MASTER.md` points here.

Token *names* did not change from the earlier system (`rk-brand`, `rk-ink`, `rk-page`…), so every screen
re-themed from the token file. New names were added for the Earth & Emerald accents and the data scale.

## 1. Brand colours

| Token | Hex | Use |
| --- | --- | --- |
| `rk-forest` | `#173D32` deep forest | brand, strong headings, dark sections, selected district edge |
| `rk-brand` | `#247A5B` emerald | primary buttons, active navigation (white text 5.2:1) |
| `rk-brand-strong` | `#1B6249` | hover/pressed; emerald *text* on mist, sand or pale emerald |
| `rk-brand-soft` | `#EAF3EE` pale emerald | selected states (emerald text 4.6:1). Lighter than the brief's mist so emerald text passes |
| `rk-ink` | `#344B45` slate green | body text (8.2:1 on ivory) |
| `rk-muted` | `#4F5F53` | secondary text (6.0:1 ivory, 4.8:1 sand). Darker than moss, which fails as text (3.5:1) |
| `rk-page` | `#F4F0E6` warm ivory | page background |
| `rk-surface` | `#FFFFFF` | cards, forms |
| `rk-secondary` | `#EFE7D8` light sand | quiet sections, hover |
| `rk-sand` | `#E5D8C3` sand | warm surfaces, **ink text only** |
| `rk-mist` | `#DCEBE5` water mist | light surfaces; light text on dark forest (9.7:1) |
| `rk-line` | `#E0D8C8` | borders |
| `rk-moss` | `#71866A` moss | icons, small natural details, never small text |
| `rk-clay` / `rk-clay-text` | `#B87955` / `#8E5434` | restrained accents: section eyebrows, decoration |
| `rk-river` / `rk-river-text` | `#6FA9B5` / `#2C6573` | water in illustrations; river text when needed |
| `rk-danger` / `-accent` / `-soft` | `#A63D32` / `#B3392D` / `#F8E9E5` | critical text, destructive buttons, errors |
| `rk-warning` / `-accent` / `-soft` | `#85540F` / `#E9B949` / `#FBF1DC` | warning text / amber fills (forest text 6.6:1) |
| `rk-success`, `rk-info` (+ `-soft`) | `#2E7046`, `#2C6573` | completed / neutral information |

Distribution: ivory pages, white cards, forest for identity and one or two dark sections per page, emerald for
the action. Sand, mist, moss, clay and river are supporting colours and are never spread evenly. Every
text/background pair above was measured against WCAG 2.2 AA (4.5:1). The brief's mist (`#DCEBE5`) behind emerald
text measured 4.25:1, which fails, so a lighter pale emerald is used for selected states.

## 2. Flood data colours (not brand colours)

The map and the forecast use their own scale. It is always shown with a word and a legend.

| Level (from the model) | Token | Hex | Wording |
| --- | --- | --- | --- |
| Alert | `rk-risk-alert` | `#B3392D` | "Alert — be ready to move" |
| Watch | `rk-risk-watch` | `#E9B949` | "Watch — get prepared" |
| Low chance | `rk-risk-low` | `#CFD9CC` | "Low chance — not zero" (pale grey-green, never a "safe" green) |
| No forecast / not covered | `rk-risk-unknown` | `#C9C5BA` + dashed edge | never drawn as low |

The model produces exactly these levels. There is no separate "high" level, so none is shown. A "moderate"
or "critical" band would claim a resolution the model does not have. The selected district gets a thick forest
outline, not a fill colour.

## 3. Gradients

Use them only on the hero, large compositions and at most two section backgrounds per page. Never use them on
ordinary cards, buttons or text.

| Utility / variable | Stops | Where |
| --- | --- | --- |
| `bg-grad-earth` / `--rk-grad-earth` | ivory → sand → mist | homepage hero background, login background |
| `--rk-grad-forest` | forest → emerald → `#6F9B79` | feature card, closing call to action |
| `--rk-grad-river` | forest → `#315D50` → river | "How Rokkha works" section |

Faint contour lines (`Contours` in `HomePage.tsx`, 7–13 % opacity) give the dark sections texture without
any extra colour.

## 4. Type

- **Manrope** (`font-display`, all `h1`–`h4`) for headings, weights 700–800, tracking −1.5 %.
- **Inter** for interface and body text.
- **IBM Plex Mono** (`font-mono`) only for data and metadata: forecast dates and issue times, coordinates,
  source tags (ERA5, GloFAS…), section eyebrows, the illustration label. Never for paragraphs.
- **Noto Sans Bengali** for Bangla in all three roles. In Bangla, eyebrows and mono labels lose their
  letter-spacing (spacing breaks conjunct letters).

Sizes: 13 meta · 15–17 body · 18–22 card title · 28–40 section title · 38–58 hero. Line height 1.5 for body
text and 1.06–1.15 for titles. No text below 13 px.

## 5. Space, radius, elevation

The grid is 4 px. Content is at most 1240 px wide. Side padding is 16 px on phones and 24 px from 768 px.
Sections are 64–96 px tall vertically. Radius: 12 px small cards and inputs, 24–28 px large panels and the
hero visual. Elevation: a 1 px `rk-line` border, and `--rk-shadow-float` only for floating layers (dropdowns,
hero visual, login card).

## 6. Components

- **Buttons:** primary emerald with white text, 48–52 px tall for main actions. Secondary white with a forest
  border at 25 %. On dark sections the primary button becomes ivory with forest text. Labels say what happens.
- **Cards:** white, `rk-line` border, one action. A whole card can be the button and then ends with
  "Open →". The `rk-lift` hover is turned off under reduced motion.
- **Messages:** the shared `Notice` (`info | warning | danger | success | neutral`); `StatusBadge` for short
  states.
- **Forms:** a connected label above every field (`htmlFor`/`id`), help text under it, 44 px controls.
  Placeholders are examples, never labels.

## 7. Navigation

Desktop (≥ 1280 px): logo · **Home · Flood intelligence ▾ · Forecasts & alerts ▾ · Get help ▾ · Rescue teams ▾
· About ▾** · language · **Request help**. The first three carry the product; help and rescue stay one click
away. Below 1280 px a menu button opens tap-to-expand sections. Flood intelligence is open by default, and
"Request help" stays visible under the bar on inner pages.

| Section | Items (all working destinations) |
| --- | --- |
| Flood intelligence | Forecast map · Check a place · How the forecast is made (`/#how`) · Data sources and limits (About) |
| Forecasts & alerts | Current warnings · Flood safety guidance (`/#safety-title`) · Official warnings (FFWC, external) |
| Get help | Emergency rescue · Food and drinking water · Medical · Shelter and housing safety (form opens with that need ticked) · Find a nearby shelter · Track my request |
| Rescue teams | Rescue team login (public) / Rescue board, plus Admin for administrators |
| About | About Rokkha and its limits · Contact directory |

Dropdowns open on hover and on click/tap. They stay open for 150 ms while the pointer moves into them, close on
Escape (focus returns to the trigger) and on tabbing away, and carry `aria-expanded`/`aria-controls`.

## 8. Maps and data visualisation

- Colour districts by the real forecast level for the chosen date and show the legend next to the map, with
  the date and "Model estimate at district level; not an official warning."
- Missing data appears as grey with a dashed edge and the words "No forecast / not covered".
- Base map (OpenStreetMap) at 80 % opacity, so the forecast colours read first. Attribution always visible.
- Page scrolling is never captured by the map. Wheel zoom turns on after a click on the map.
- Always state the date a forecast is for, when it was issued (Bangladesh time) and that it is a model estimate;
  official warnings link to ffwc.gov.bd.
- Keep official warnings, observations (satellite), model predictions, historical information and community
  requests apart in words and in colour.

## 9. Motion

- CSS and SVG only; no animation library.
- Slow and natural: 1–2 s fades and line drawing, a 16 s drift for rain, 3.2 s steps on the hero timeline.
  No bouncing, spinning or pulsing everywhere: one halo marks the single "area to watch".
- `prefers-reduced-motion`: every animation stops and the illustration shows its finished picture. The
  timeline does not auto-advance (people can still pick a step).
- Content is visible without JavaScript; fade-in on scroll only applies to blocks that start below the fold.

## 10. Honest visuals

The homepage hero (`HeroIntelligenceMap.tsx`) is an **illustration**, labelled "ILLUSTRATION · NOT A LIVE
FORECAST", with an accessible title and description that say the same.

- The country outline is real: it is projected from the district boundaries.
- The rivers are traced approximately.
- The rain, the risk overlay, "Now / +6 h / +24 h" and the marked places are illustrative and carry no
  numbers. The model forecasts one day per district, not 6-hourly.

Real numbers appear only from the API: today's Alert/Watch counts and the issue time sit under the hero, and
"Districts to watch today" further down. When the data is not there yet they say so.

## 11. Words

Plain, short and kind. Flood-intelligence copy describes only what is built: a daily district machine-learning
forecast from rain (ERA5, GFS), river flow (GloFAS), Sentinel-1 satellite flood observations (Copernicus GFM)
and modelled hazard (JRC); Watch and Alert levels; a point check of modelled depth and past flooding. No
accuracy figures, partners or endorsements on public pages. A forecast is always "model estimate, not an
official warning", and missing data says "currently unavailable" or "not issued yet", never a made-up value.

## 12. Responsive and accessibility checks

Check at 360, 390, 768, 1024, 1280 and 1440 px: no horizontal scroll and no content under sticky bars. WCAG
2.2 AA throughout: contrast as measured above, 44 × 44 px targets, a visible focus ring (2 px emerald),
semantic landmarks, `lang` following the language switch, `aria-live` on changing forecast text.
