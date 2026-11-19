# Admin panel audit (19 November 2026)

Source of truth: the code on the backend branch `feature/shared-rescue-backend` and the frontend branch
`feature/shared-rescue-frontend`, plus the local test database `rokkha_preview` (structure only). Old
documentation was not trusted where it differs from the code.

## 1. Administrative capabilities that already exist

| Capability | Where | Notes |
| --- | --- | --- |
| Roles `user`, `rescuer`, `admin` | `accounts/repository.py`, `accounts/router.py` `require_role(...)` | Server-side checks. New accounts are always `user`. |
| First admin is provisioned on a developer machine | `scripts/set_role.py` | No public admin registration. |
| List accounts, change role (not your own) | `GET/PATCH /admin/users[/{id}/role]` | Lists by creation date, with a limit and no search or paging. |
| Rescue teams: list, create, assign a user | `GET/POST /admin/teams`, `PATCH /admin/users/{id}/team` | One team per rescuer. |
| Registered places (assets): add or remove | `POST/DELETE /assets` (admin on the public server) | |
| Rescue board for rescuers and admins | `GET /sos`, accept / progress / release / support | Atomic acceptance, explicit steps, history per step. |
| Admin intervention on requests | `POST /sos/{id}/release` (admin may release any team), `POST /sos/{id}/close` (duplicate / not genuine / other) | Reasons are required and stored in the request history. |
| Ingestion runs with status, source, dates, errors | `ingestion_runs`, `GET /ingestion/runs` | Written by every run, including the daily update. |
| Model predictions with model version and issue time | `flood_predictions`, `GET /predictions[/model]` | |
| Model alerts (Watch / Alert) | `GET /alerts`, derived from predictions | These are model output, not official warnings. |
| Admin page (frontend) | `/admin` → `AdminPanel.tsx` | One page covering accounts and roles, teams and places. No overview, audit, data or health views. |

## 2. Reusable backend functionality

- **Auth:** sessions (`sessions`, a SHA-256 of the token, with expiry), scrypt password hashing, login rate limit, `current_user`, `require_role`.
- **Rescue:** the board service (filters, the atomic accept via `find_one_and_update` on `status: available`), history steps, release reasons, and admin close.
- **Ingestion:** run records (`ingestion_runs`), the call-usage budget, and the latest stored dates per series.
- **Predictions:** stored per district and day, with `issued_at` and `model_version`.

## 3. Database entities

- **Accounts:** `users` (no account status, no last-login time), `sessions`, `login_failures`.
- **Rescue:** `rescue_teams`, `sos_requests` (with `history`, `releases` and `team`), `sos_senders`.
- **Data:**
  - `flood_predictions`, `ingestion_runs`, `ingestion_api_usage`;
  - `rain_daily`, `rain_recent_daily`, `river_discharge_daily`, `rain_forecast_hourly`;
  - `assets`, `locations`, `weather_observations`.
- **Files:** satellite labels (`data/labels`), the model (`data/models`), boundaries and the flood grid.
- **MongoDB has no migrations framework.** Indexes are created at startup in `app/core/database.py`. New collections follow that pattern.

## 4. Permissions implemented today

- Checks are **role-based only** (`require_role`), applied per route.
- The only coordinator-like power is **admin**: releasing any team's request and closing requests.
- A "coordinator" role **does not exist**. Rescuers act for their own team only.
- Contact details on requests are visible only to the responsible teams and to admins.

## 5. What needs to be added (and what was not)

| Need | Decision |
| --- | --- |
| Permission layer over roles (for future organisation admins) | Add `admin/permissions.py`: a role → permission map and `require_permission()`. |
| Account suspension and reactivation | Add `status` to users. Suspended accounts cannot log in and their sessions are ended. Nobody can suspend themselves or the last active admin. |
| Last activity | Add `last_login_at`, written at login. |
| Audit log | New append-only collection `admin_audit`. There is no update or delete route. |
| Administrative announcements | New collection `announcements`. Every announcement is labelled as an administrative announcement, never as an official warning. Withdrawing one needs a reason. |
| Overview, data sources, analytics, system health | Read-only endpoints computed from the stored records. |
| Search and paging of users | Optional query parameters on the existing `GET /admin/users`. The response stays compatible. |
| Staff account creation by an admin | **Not added.** It would mean an admin choosing someone's password. Staff register themselves, then an admin grants the role (audited). |
| Coordinator role | **Not added** (not in the current system). The permission layer is ready for it. |
| Application error log | **Not available.** Errors are not stored, so system health says so. |
| Official alerts from authorities (FFWC) | **Not integrated** (no documented feed). Only a link is shown. |

## 6. Security risks found

1. A suspended or demoted account kept a working session until it expired. Fixed: role and status are read from the database on every request, and suspension deletes all of the account's sessions.
2. Admin actions left no attributable record beyond the request history. Fixed with the audit log.
3. An admin could remove the last admin, possibly. Fixed: the last active admin cannot be suspended or demoted.
4. Denied admin requests were invisible. They are now recorded as `permission_denied`, with the actor if known. Anonymous requests are not logged, to avoid filling the log.
5. Contact details of people asking for help are visible to admins. That is existing behaviour, needed for intervention. The new oversight table does not show contact details.

## 7. Recommendations

- Keep the scientific outputs (predictions, observations, model) read-only in the admin UI. Corrections go through re-running the pipeline, which is itself recorded in `ingestion_runs`.
- Add real error tracking (for example Sentry) before claiming application-error monitoring.
- Introduce a coordinator role later as a set of permissions, not a new code path.

## 8. What was implemented (19 November 2026, not committed)

| Part | Where | Verified by |
| --- | --- | --- |
| Permission layer (role → named permissions, `require_permission`) | `Backend/app/modules/admin/permissions.py` | Backend tests: anonymous users get 401, and users and rescuers get 403 on every admin route |
| Account status (suspend / reactivate with a reason, sessions ended, last-admin guard that survives two admins acting at once), `last_login_at`, user search and paging | `accounts/{repository,service,router,schemas}.py`, `admin/router.py` | Backend tests, including a concurrent mutual demotion |
| Append-only audit log `admin_audit` | `admin/audit.py`. Written for role, status, team and facility changes, admin release and close of requests, announcements, and denied access | Backend tests: events recorded, no secrets in them, no route that changes them |
| Announcements (`announcements`): publish, correct, withdraw, public list | `admin/service.py`, `admin/router.py`, `GET /announcements` | Backend tests (authority claims refused) and a browser test (public label, withdrawal) |
| Overview, analytics, data sources, ingestion runs, system health | `admin/service.py` (computed from stored records) | Backend tests (counts match the database; "unknown" when nothing is stored) |
| Frontend console `/admin` and `/admin/<section>` (11 sections) | `Frontend/src/components/admin/*`, `src/app/admin/[section]` | Browser tests: access by role, navigation, phone layout. The axe scan finds no serious issue on all 10 data sections |
| Public announcements on the Alerts page | `Frontend/src/components/AnnouncementsList.tsx` | Browser test |

Database: two new collections (`admin_audit`, `announcements`) and indexes created at startup (`app/core/database.py`).
Existing users gain `status` and `last_login_at` only when they change (missing means active, never logged).
**No existing records were rewritten.**

### Still not available (documented, not faked)

- Admin-created staff accounts. Staff register themselves and an admin grants the role.
- A coordinator role. The permission layer is ready for it.
- Official alert ingestion (FFWC has no feed).
- Application error tracking.
- Request rates and latency.
- Password change and reset.
- A Bangla version of the control centre. It is staff-only and English only.
- Geographic maps in the admin area. There is a district list for requests, but no map.
- Notification preferences: no notification system exists.
