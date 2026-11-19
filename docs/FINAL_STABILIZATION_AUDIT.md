# Final stabilization audit — 19 November 2026

Scope: the final polish and stabilization pass before release. Everything below was checked on the local preview
(frontend `feature/shared-rescue-frontend`, backend `feature/shared-rescue-backend`, local test database
`rokkha_preview`). **Nothing was committed, pushed, merged or deployed, and production data was not read or changed.**

## 1. Baseline (before this pass)

- **Git:** both branches have all work uncommitted (frontend about 66 changed or new paths, backend about 33). `origin/main` is one commit ahead with a daily satellite update that doesn't touch the changed files.
- **Tests:** 440 backend and 77 frontend passing; type check and production build passing.
- **Architecture:** unchanged. FastAPI, MongoDB, Next.js 14 App Router, MapLibre on `/map` only, the admin console lazy-loaded on `/admin`.

## 2. Findings

### Critical (security, data loss, broken core function)

| Finding | Status |
| --- | --- |
| A visitor-supplied `True-Client-IP` header bypassed the 10-per-hour limit on new help requests (found by the attack script; 12 of 12 accepted) | **Fixed** (backend): only `CF-Connecting-IP` or the connection address is used. Test added |
| One account could flood the audit log (30 refused requests = 30 events) | **Fixed** (backend): repeats within a minute are counted on one event. Test added |
| A suspended, expired or demoted account still looked logged in until reload (the server already refused it) | **Fixed** (frontend): a 401 logs the page out at once; the account is re-checked on page changes and tab focus. Test added |
| Production may hold rescue requests with the old status names (`new`, `acknowledged`, `team_sent`, `resolved`) that the new backend doesn't convert | **Not verifiable without a production read** — see the deployment checklist |

### Important (usability or reliability)

| Finding | Status |
| --- | --- |
| No account indicator in the navbar (only a Log out button) | **Fixed:** account menu with initials avatar, real name, role, team, and only supported actions (my place and report, my help requests, rescue board, Admin Control Centre, log out); also in the phone menu |
| Logged-in English menu overlapped the logo at 1280–1440 px; at 1536 px and up, the wider account button pushed "About" under the language button | **Fixed:** wider header on large screens, safe centring, icon-only account button on laptops. Test added (English and Bangla, 1280–1920 px) |
| Next.js 14.2.35 has open advisories; all fixes need Next 15.5 or 16 | **Needs attention:** see section 3 |

### Minor

| Finding | Status |
| --- | --- |
| Initials taken from a bracket in names like "… (Team A)" | Fixed: letters and digits only |
| Audit table didn't show repeated refusals | Fixed: "+N more within a minute" |
| The crawler reported "menus with no items" | Not a defect: the menus are disclosure lists; the selector was wrong |

## 3. Dependency advisories (npm audit: 2 critical, 3 high; actual exposure assessed)

| Package (installed) | Severity reported | Reaches Rokkha? | Recommendation |
| --- | --- | --- | --- |
| next 14.2.35 (last 14.x) | critical, high | The **critical** items need the image optimizer (off: `images.unoptimized`), Windows hosting (Vercel is Linux), or Server Actions, middleware or rewrites (none used). The App Router denial-of-service items **do apply in principle** | Plan an upgrade to Next 15.5.x (patched) as its own change with full regression. Not in this pass: it is a major version |
| maplibre-gl 4.7.1 | critical (sanitiser bypass) | No attacker-controlled HTML reaches MapLibre: popup text is escaped first, and the attribution is a constant | Upgrade to 6.x with the map test suite in a later change |
| postcss (via next) | high | Build-time only | Comes with the Next upgrade |
| @playwright/test 1.48.2 | high | Test tool only (browser download check); the tests use the installed Chrome | Minor upgrade to 1.65 when convenient |

## 4. Deployment-readiness checklist

1. **Production data compatibility:** count rescue requests whose `status` is `new`, `acknowledged`, `team_sent` or `resolved` (read-only). If any exist, write and test a conversion on a copy first. *Not done: needs the owner's go-ahead to read production.*
2. **Migrations:** no schema migration is needed. New collections (`admin_audit`, `announcements`) and indexes are created at startup. Existing users without `status` count as active.
3. **Backup:** take an Atlas backup or snapshot immediately before deploying, and confirm it can be restored. *Not done.*
4. **Compatibility:** the new frontend needs the new backend (55 of 55 endpoints match; the live backend matches 31 of 55). The live frontend breaks on the new backend. **Deploy together, backend first.**
5. **Environment:**
   - Render: same `MONGODB_URI`, `MONGODB_DATABASE`, `CORS_ORIGINS` (must include rokkha-app.vercel.app), `PUBLIC_READ_ONLY=true`.
   - Vercel: `NEXT_PUBLIC_API_URL` = the Render API.
   - No new variables are required.
6. **Order:**
   - push the backend to `main` outside the 09:30 Bangladesh daily-update window;
   - wait for Render and confirm `/api/v1/health`;
   - merge the frontend into `production` (Vercel deploys);
   - confirm at least one production admin exists (`scripts/set_role.py`).
7. **Smoke tests after deploy:**
   - home and map load;
   - Point Check;
   - Alerts with the day stepper;
   - Shelters with "Use my location";
   - a help request from a phone, then an admin closes it;
   - rescuer log in, accept, release;
   - admin overview and audit log;
   - log out.
8. **Rollback:**
   - Vercel: promote the previous deployment.
   - Render: redeploy the previous commit of `main`.
   - The new collections can stay (unused by the old code).
   - Restore the backup only if data was converted.

## 5. Final results (all actually run, 19 Nov 2026)

| Check | Result |
| --- | --- |
| Backend tests (pytest, local MongoDB) | 442 passed |
| Frontend type check / production build | pass / pass (first load 237 kB per page) |
| Frontend tests (Playwright: 12 unit + browser) | 81 passed, 0 failed, 0 skipped |
| Accessibility (axe, WCAG 2.2 A/AA) | no serious or critical findings (part of the suite) |
| Attack script (41 attempts: auth, escalation, injection, cross-team access, XSS, sessions, limits, CORS) | 41 blocked after the two fixes |
| Responsive crawl (3 roles × 2 languages × 10 widths, 360–1920 px) | one overflow found (admin analytics at 360 px, a screen-reader table) and fixed; no page errors, failed requests or nav overlap |
| `npm ci` from the lockfile | pass |
