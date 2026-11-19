# Spec: Shared rescue board, flood-data honesty and rescue location (November 2026)

Status: being implemented on branches `feature/shared-rescue-backend` (from `main`) and
`feature/shared-rescue-frontend` (from `production`). Nothing is deployed until both are reviewed and merged
together (see "Deployment" below).

## 1. Objective

Rokkha connects people trapped or affected by floods with the rescue teams and NGOs already working in the area.

- **A person in need** sends one request without an account: what they need, where they are, how many people,
  whether someone is seriously ill or injured, who is vulnerable, and how to contact them. They get a reference
  number and honest progress updates.
- **Rescue teams** (several organisations, several teams each) see one shared board of open requests. One team
  accepts a request and becomes its primary team; every other team immediately sees "Team X is responding" and
  can no longer take it. The primary team reports its progress and the outcome, or releases the request.
- **Nobody is misled**: no confirmation before the server has stored the request, no team status before the team
  confirmed it, no saved or sample flood data shown as live, no location that the person did not give.

Out of scope (deferred): SMS / push / phone notifications, the advanced risk map, a responder dashboard or mobile
redesign, general UI polish.

## 2. Current state (verified on 18 Nov 2026, not taken from earlier audits)

Backend (`main`, `app/modules/rescue`):
- Works: anonymous request (`POST /sos`) with a phone-made private key (`client_id`, stored only as a SHA-256
  hash), retries never stored twice, 10 new requests per hour per connection, a status history, rescuer list
  restricted to roles `rescuer`/`admin`, status changes guarded against two simultaneous clicks.
- Missing: teams and organisations (a rescuer is a lone account), the claim of a request, the statuses en route /
  arrived / in progress, release with a reason, support from a second team, several needs per request,
  injury / vulnerability, a request **without GPS**, a short reference number.
- The live database holds 0 rescue requests and 2 accounts (read-only check), so no data migration is needed.

Frontend (`production`):
- Works: the request is saved on the phone first and only called "received" after the server answered; the
  queue retries by itself.
- **Bug (Priority C):** choosing a district instead of GPS sends the **district's centre point** as the
  person's location (`SosCenter.tsx` `handleSelectDistrict`). A team would go to the wrong place.
- The rescue form does **not** reuse the flood-check point (that bug was only in the old copy on `main`).
- **Bug (Priority B):** the "saved sample, not live" banner (`DataSourceBanner`) was removed on 17 Nov, so
  when the backend does not answer, saved results of 2022 are shown without any label.
- The map and warnings open on 18 June 2022 and call it "Current Flood Risk" without a date.
- The production API address is correct (`.env.production` → Render). `localhost` is only a fallback used by
  `npm run dev`; it is defined in three files.

## 3. Requirements and decisions

### 3.1 Request (Priority A1, C)

| Field | Rule |
| --- | --- |
| `client_id` | unchanged: 32–64 characters, made by the phone, the private key for the status |
| `needs` | 1–5 of `food_water`, `medical`, `house_danger`, `evacuation`, `other`; duplicates removed |
| `need` (old) | still accepted from older phones' queues: `rescue`→`evacuation`, `shelter`→`other`, others the same |
| `people` | 1–1000, default 1 |
| `serious_injury` | `true` / `false` / not answered (`null`) |
| `vulnerable` | any of `children`, `elderly`, `disability`, `pregnant` |
| `location` | GeoJSON point inside Bangladesh, or **missing** |
| `location_source` | `gps`, `saved_place` or `manual`; `null` for old clients (never guessed) |
| `accuracy_m` | only what the device reported |
| `place` | `district_pcode`, `upazila`, `union`, `village`, `area`, `landmark`, `details` (all text, optional) |
| `note`, `contact_name`, `contact_phone` | as before |

A request needs **either** a point **or** a manual place with a valid district **and** at least one of
village / area / landmark / details. Coordinates are never made up from a place name; a missing point is stored
as missing, never as 0. With a point, the district comes from the point.

### 3.2 Teams

- New collection `rescue_teams`: `name`, `organization`, `created_at`. An admin creates teams and puts rescuer
  accounts into one team (`users.team_id`). The account's team is shown in `/auth/me`.
- Only accounts with role `rescuer` or `admin` reach the board. Only an account **in a team** can accept or work
  on a request.

### 3.3 Lifecycle (Priority A3–A6)

Statuses: `available`, `accepted`, `en_route`, `arrived`, `in_progress`, `completed`, `cancelled`.

| Action | Who | From | To |
| --- | --- | --- | --- |
| accept | any team | `available` | `accepted` (team becomes primary) |
| en route | primary team | `accepted` | `en_route` |
| arrived | primary team | `en_route` | `arrived` |
| in progress | primary team | `arrived` | `in_progress` |
| completed (with outcome) | primary team | `arrived`, `in_progress` | `completed` |
| release (reason `unable_to_reach`, `lacks_resources`, `other`) | primary team or admin | `accepted` … `in_progress` | `available` |
| ask for support | primary team | `accepted` … `in_progress` | (unchanged; support needed) |
| join as support | another team | while support is asked | (unchanged; added to support teams) |
| cancel | the sender (private key) | any open status | `cancelled` |
| close (reason `duplicate`, `not_genuine`, `other`) | admin | any open status | `cancelled` |

- Every action is one atomic MongoDB `find_one_and_update` whose filter contains the expected status (and the
  primary team). Two teams accepting at the same moment: exactly one succeeds, the other gets **409** with the
  request's current state. The frontend is never the guard.
- `UNABLE_TO_REACH` and `RELEASED` from the brief are **release reasons recorded in the history**, not resting
  states: a request that one team cannot reach goes straight back to the board, so it never waits on a team that
  has given up. Other teams see "1 team could not reach this place" with the time.
- Every history step stores the event, the resulting status, the time, the team (name, organisation), the reason
  and note when given, and internally the acting account.
- A support team never becomes primary and cannot change the status; the board shows it.

### 3.4 Privacy (Priority A2, C5)

- Board (role `rescuer`/`admin`): everything needed to judge a request (needs, people, injury, vulnerability,
  location, place, note, times, teams). **Contact name and phone** are only shown to the primary team, support
  teams and admins; other teams see "contact hidden until a team accepts".
- Sender: status, reference, district, history (events, times, team name and organisation), message from the
  team. Never another person's data. The status is read with the private key only; the reference number is
  for talking to people and gives no access.
- Logs never contain the private key's value in plain form outside the URL path already used today (unchanged;
  see Remaining issues).

### 3.5 Victim-facing wording (Priority A7, A8)

Shown only from the server's history: received → "Your request has been received" (with reference), accepted →
"A rescue team has accepted your request: <team>", en route → "The rescue team is on its way", arrived → "The
rescue team has arrived", in progress → "Help is being given", completed → "Help has been completed", released
with `unable_to_reach` → "The team could not reach your location. Your request is open again for other teams".
Before the server answers: "Saved on this phone, not sent yet". No SMS, call or push is claimed.

### 3.6 Flood data (Priority B)

- Every part of a page that uses the saved sample says so (restore `DataSourceBanner`).
- The forecast shown first is **today's** (Asia/Dhaka). The card names its date and the time the forecast was
  issued (`issued_at`). When there is none for today: "No forecast for today yet", never another day's.
- The production build never falls back to `localhost`; one shared definition of the API address.
- There is no browser cache of flood data today; none is added. Saved sample = the "demo" state.
- Official warnings (FFWC), model forecasts, satellite observations, modelled hazard and community requests
  keep their existing separate labels; requests are never shown as warnings.

## 4. API contract changes (backend)

New or changed (all under `/api/v1`):

- `POST /sos` — body as in 3.1; answer (201, or 200 for a retry) adds `reference`, `needs`, `team`.
- `GET /sos/status/{client_id}`, `POST /sos/status/{client_id}/cancel` — answers as above.
- `GET /sos` (board) — `status` (one status) or default all open; `district_pcode`; `mine=true` (my team's);
  `limit`. Items include `reference`, `team`, `support_teams`, `support_request`, `releases`, `contact_hidden`.
- `POST /sos/{id}/accept`, `POST /sos/{id}/progress` (`status`: `en_route`/`arrived`/`in_progress`/`completed`,
  `message_to_sender`, `outcome` for completed), `POST /sos/{id}/release` (`reason`, `note`),
  `POST /sos/{id}/support-request` (`note`), `POST /sos/{id}/support`, `POST /sos/{id}/close` (admin).
- `GET /admin/teams`, `POST /admin/teams`, `PATCH /admin/users/{id}/team` (`team_id` or null).
- Removed: `PATCH /sos/{id}` (the old free status change). Errors keep the project's `{"detail": "..."}` form:
  401 not logged in, 403 role or team missing, 404 unknown, 409 state changed / already claimed, 422 invalid.
- Field and status names stay lower snake case, like the rest of this API.

## 5. Commands

Backend: `cd Backend && .venv/bin/python -m pytest -q` (local Docker MongoDB on port 27018, never Atlas).
Frontend: `cd Frontend && npx tsc --noEmit && npm run build`. Browser checks: local backend + `npm run dev`,
driven with Playwright.

## 6. Testing strategy

- Backend API tests (pytest, real local MongoDB) for every row of 3.1 and 3.3, privacy rules, 409 on a second
  accept, and a **concurrent** accept from 8 threads where exactly one wins.
- Frontend: type check and production build (no unit test framework exists; none is added), then the critical
  scenarios in a real browser against a local backend.

## 7. Boundaries

- Always: keep the old offline-queued requests working; record who did what; tests before claiming done.
- Ask first: deploying, committing, pushing, touching production data, new dependencies.
- Never: confirm anything the server has not confirmed; invent coordinates, depth, levels or times; show contact
  details to teams that did not accept; build the advanced map or the deferred redesign.

## 8. Success criteria

The 19 scenarios of the brief (section 5, Phase 7) pass, each mapped to a test or a recorded browser check.

## 9. Deployment

Backend and frontend change the same contract. Merge and deploy them **together**: first the backend (`main`,
Render), then within minutes the frontend (`production`, Vercel). Between the two, the live rescuer panel would
call the removed `PATCH /sos/{id}`. No data migration is needed (0 requests stored).

## 10. Remaining issues / open points

- The sender's private key travels in the URL path of the status call (unchanged); moving it into a header is a
  small follow-up.
- No notifications: teams must look at the board.
- No admin "teams" screen beyond create / assign.
