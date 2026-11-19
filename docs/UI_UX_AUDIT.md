# Rokkha UI/UX audit (18 November 2026)

Audited on the local preview (`http://localhost:3100`, local backend and test database) at 360, 390 and 1280 px,
plus the code in `Frontend/src`. Design rules: `Frontend/design-system/rokkha/MASTER.md`.
Status column: **Fixed** = changed in this redesign round; **Open** = still to do.

## Structure found

- One client component, `CitizenPortalApp.tsx` (about 1,800 lines), renders every route: `/` (overview), `/map`,
  `/alerts`, `/shelters`, `/rescue`, `/admin`, `/login`; `/hydro` and `/satellite` are separate pages no longer
  linked. Shared parts: `SideDashboard` (left rail), the site header (inline), `SosCenter` (help request
  modal), `RescuePanel`, `AdminPanel`, `AlertsFeed`, `NearestShelters`, `LeafletFloodMap`, `AttributionFooter`,
  `PortalAccessPage` (login), `DataSourceBanner`, district report modal, "About" modal, loading screen.
- About 25 hard-coded colours used several hundred times; no design tokens; system font stack; the keyboard focus
  outline removed in navigation; a decorative background showing wrong coordinates ("28°W").

## Screens

| Screen | Audience | Problems found | Redesign | Status |
| --- | --- | --- | --- | --- |
| Home `/` | Citizens | Engineering facts for visitors ("352 automated backend tests", architecture cards, data-source names); placeholder stat "Previous / Historical Analysis"; vague headline ("Detect Forecast & respond"); help button with a multi-colour gradient; decorative risk map that is not today's data | New homepage: plain headline, two actions (Ask for help, Check my area), today's forecast only from real data with date and update time, how to get help in 3 steps, verified contacts, safety advice, plain "how Rokkha works" | Fixed |
| Navigation (all) | All | Two menus with different names (top bar vs left rail); left rail always visible and taking ~65 px on phones; staff and citizen links mixed | One header (citizen links + staff links only for staff); phones get a 5-item bottom bar and a full-width help button; left rail removed | Fixed |
| Help request (modal) | Citizens | Raw coordinates shown to the person; emoji used as icons | Readable place ("Near Dharampasha, Sunamganj") from our own server, accuracy from the phone, coordinates only for rescue teams; lucide icons | Fixed |
| Request status | Citizens | — (rewritten in the previous round: honest steps from the server) | Kept; plural fix | Fixed |
| Contacts | Citizens | 999 as the main action; 109 (women and children helpline, not flood related) listed; emoji phone icons | Verified directory grouped by kind of help, one-tap call buttons, source and check date on every card; 999 and 1090 as a small reference in the footer | Fixed |
| Forecast `/map` | Citizens | "District::" and "Date::"; map labels in several languages around Bangladesh | Double colons fixed | Partly (map style open) |
| Warnings `/alerts` | Citizens | District names cut off on phones; no "what to do" per level | — | Open |
| Shelters `/shelters` | Citizens | Red "Critical" badge on every hospital; raw coordinates; "Capacity: Not specified" repeated; duplicates in data | — | Open |
| Rescue board `/rescue` | Rescue teams | Citizen district picker and "My District Report" shown to rescuers; location shown as coordinates first | Own page title, no citizen controls, readable area first (server-side upazila name), coordinates small with map link | Fixed |
| Admin `/admin` | Admins | Long single column; plural "1 members" | Team management added in the previous round; staff title; plural fixed | Partly |
| Login | All | Large decorative satellite background | — | Open |
| Saved-sample notice | All | Was removed on 17 Nov | Restored (previous round) | Fixed |
| Footer | All | Emoji icons, unverified 109, "WGS84 Geodesic Coordinates" jargon | Plain footer with 999 / 1090 reference and "not a government emergency service" | Fixed |

## Accessibility (WCAG 2.2 AA)

- Focus ring removed in navigation (2.4.7): **fixed**, a visible ring for keyboard users everywhere.
- `lang` stayed "en" in Bangla mode (3.1.1): **fixed**, it follows the language switch.
- Fixed bars covering focused items (2.4.11): bottom space reserved on phones and `scroll-padding-bottom` set.
- Contrast: all design tokens checked at 5.4:1 or better.
- Reduced motion honoured globally.
- Open: alt texts of map images, the map's keyboard instructions, a full automated scan (no axe tooling in the
  project).

## Reusable components introduced

`rk/Notice` + `StatusBadge`, `site/SiteHeader` + `MobileNav`, `site/HomePage`, `site/ContactDirectory`,
`data/floodContacts.ts`, `lib/rescueLabels.ts`.
