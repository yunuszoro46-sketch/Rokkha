# Rokkha visual audit (Stage 1, 18 November 2026)

Scope: every route of the portal on the local preview (`localhost:3100`) at 360–1440 px, and the code in
`Frontend/src`. Screen-by-screen UX findings are in [UI_UX_AUDIT.md](UI_UX_AUDIT.md); this file covers the visual
system. Framework: Next.js 14 (app router, all pages client-rendered through `CitizenPortalApp.tsx`), Tailwind
CSS 3 with shadcn/ui primitives (`components/ui`), lucide icons, Leaflet map. Build: `npm run build`; type check:
`npx tsc --noEmit`; no frontend test runner and no ESLint config.

## Pages by audience

| Audience | Pages |
| --- | --- |
| Public / citizens | `/` home, `/map` forecast and point check, `/alerts` warnings, `/shelters`, `/contacts`, help request and tracking (modal on every page), About & limits (modal) |
| Rescue responders (login, role rescuer/admin) | `/rescue` shared board |
| Administrators (login, role admin) | `/admin` teams, accounts, registered places |
| Everyone | `/login` |
| Unlinked legacy pages | `/hydro`, `/satellite` (removed from navigation earlier; kept, not redesigned) |

## Problems found

| Area | Problem | Resolution |
| --- | --- | --- |
| Colour | ~25 hard-coded hex colours used several hundred times; red used for ordinary prominence (help button, form header, chips); multi-colour gradient on the help button | Shared `--rk-*` tokens with the Calm Humanitarian palette; 425 colour classes moved to tokens; red kept for critical states only; gradient removed |
| Typography | System font stack; sizes from 10 px to 44 px without a scale; tiny meta labels (10–11 px) | Inter + Noto Sans Bengali; 13 px minimum; documented scale |
| Navigation | Two menus with different names (top links and a left rail); left rail took ~65 px on phones; later a bottom bar; no dropdowns; focus outline removed | One top bar with small dropdowns, phone menu with tap-to-expand sections, focus ring restored; bottom bar and left rail removed |
| Components | Each screen built its own cards, alerts and buttons; emoji used as icons | Shared `Notice`, `StatusBadge`, `SiteHeader`, `ContactDirectory`; lucide icons only |
| Mobile | Floating help button covered content; long tab rows wrapped; citizen controls on rescue pages | Help button in the header area; staff pages without citizen controls |
| Accessibility | Focus ring hidden in navigation; `lang` stuck on English; several contrast pairs untested | Fixed; every token pair measured (≥ 4.5:1 for text) |
| Decoration | Background pattern with wrong coordinates ("28°W"); decorative risk map on the home page | Removed |
| Public content | Test counts, architecture cards, data-source jargon on the home page | Removed from the public page (still in the repository docs) |

## Screens still to restyle in detail

Warnings (cut-off district names, per-level guidance), Shelters (badges, coordinates, duplicates), Forecast map
(base map labels), Login (decorative background), Admin layout, Saved-sample banner wording, Bangla copy review.

## Homepage redesign (sections A–H, 18 November 2026)

- New homepage: hero with Request help and Rescue & relief teams, What Rokkha does, real needs (the five request
  categories the form supports), How it works (horizontal / vertical stepper), Built for both sides, principles,
  flood updates preview (real forecast only) with safety guidance and the contacts link, closing call to action.
  No statistics, partners, testimonials or technical facts.
- Motion: CSS only (waves, floating help mark, connecting dashes, fade-in on scroll, card lift); everything stops
  under `prefers-reduced-motion`; content is visible without JavaScript.
- Removed a fixed 3-second "Preparing flood intelligence" splash on every page load and a 2.4-second splash after
  login: it delayed the Request help button without waiting for any data. After login rescuers land on the board.
- Found, still open: the login form's email and password fields have no connected labels (placeholders only).

## Design direction correction: Earth & Emerald (19 November 2026)

### Design review (Stage 1)

- **Palette too plain.** Teal on white with one accent read as a generic admin template. Every surface was
  white or near-white, there was no depth and nothing of the land or rivers the product is about. Teal also
  did both jobs, brand colour and data colour.
- **Wrong hierarchy on the homepage.** The hero ("When floods disrupt lives, help should never be hard to
  find"), four of the six sections and both main buttons were about asking for help and rescue teams. The
  forecast, the satellite observations and the map, which are Rokkha's main work, appeared only in one card
  near the bottom.
- **Wrong animation.** Houses linked to a help point with a floating boat illustrated a rescue service. It
  showed nothing about rain, rivers, geography or forecasting.
- **Forecast map without forecast colours.** Districts were not coloured by their forecast level at all. Only
  the selected district was filled bright green, which read as "safe". There was no legend, and the base-map
  attribution was hidden.

### What replaced it

- **Earth & Emerald palette** (forest, emerald, ivory, sand, mist, moss, clay, river) with three controlled
  gradients and a separate flood data scale. Manrope headings, Inter text, IBM Plex Mono for data labels.
  Every text pair was measured. Two of the brief's pairs failed and were adjusted: emerald text on mist
  (4.25:1) and moss as text (3.5:1).
- **Navigation reordered:** Flood intelligence and Forecasts & alerts come first; Get help and Rescue teams
  are unchanged but come after them. The desktop menu now starts at 1280 px; below that the menu button is
  used.
- **New hero** "See the risk before the water rises." with Explore flood intelligence (to the map) and
  Request assistance. Under it, today's real model forecast counts and issue time, or "not issued yet".
- **New hero visual:** an illustration built on the real Bangladesh outline with approximate main rivers.
  Contours fade in, the rivers draw, rain moves in from the north-east, a risk overlay grows along the rivers
  on a Now / +6 h / +24 h timeline (auto-advancing, or picked by the visitor), and one area to watch is
  marked. It is labelled "Illustration · not a live forecast" and shows no numbers.
- **Homepage, six sections:** hero; Understand the changing risk (forecasts, geographic view, warnings,
  monitoring); How Rokkha works (the real four-step pipeline with named sources); Explore flood intelligence
  (today's real districts to watch, map, point check, shelters, safety guidance); Preparedness and
  assistance (the four help types open the form pre-ticked, track, contacts, rescue-team card); closing call
  to action.
- **Forecast map:** districts coloured Alert / Watch / Low chance, with no forecast shown as dashed grey; a
  legend with date and "model estimate"; selected district outlined in forest; OpenStreetMap attribution
  restored; the page no longer gets stuck zooming the map when scrolling.
- **Other screens re-themed** through the tokens: about 250 remaining hard-coded colours moved to tokens. The
  district report button lost its four-colour gradient. The district detail map no longer fills the
  district red, and its pins use drawn symbols instead of emoji.
- **Login page:** earth background instead of the satellite photo, "Log in to Rokkha", opens on Log in,
  labels connected to their fields (closes the open label issue above), plain button wording.

### Still open

Warnings page detail (district names, per-level guidance), shelter cards, admin layout, Bangla copy review by
a native speaker, the old unused `.site-header` CSS block in `globals.css`, and the unused
`RainRiverCharts` / `DistrictSatelliteTimeline` components (real data that could become a "river and rain"
view later).
