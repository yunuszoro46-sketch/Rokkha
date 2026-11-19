# ADR-001: Shared rescue board with atomic claims and team ownership

## Status

Accepted (18 November 2026)

## Context

Many NGOs and volunteer teams work in the same flooded area. Before this change a rescue request had a free
status (`new → acknowledged → team_sent → resolved`) that any rescuer account could move, and nothing recorded
which team was responding. Two teams could drive to the same house while another family waited, and the person
asking for help could be told "team sent" without knowing who.

Requirements (approved product decisions): one shared pool, no central dispatcher, exactly one primary team per
request, explicit "en route" confirmation, safe release, optional support from a second team, honest status for
the sender, no account needed to ask for help.

## Decision

- **Teams as a small collection** (`rescue_teams`: name, organisation) and one `team_id` per account, managed by
  admins. No new authentication system: the existing roles `rescuer`/`admin` still decide who reaches the board.
- **Ownership in the request document** (`team`, `support_teams`, `support_request`, `releases`). Every action is
  one `find_one_and_update` with the expected status and owner in the filter. MongoDB applies a single-document
  update atomically, so a second simultaneous accept matches nothing and gets 409. No multi-document transaction
  is needed.
- **Release returns the request to the board.** "Unable to reach" and "released" are recorded reasons, not
  resting states, so no request waits on a team that gave up.
- **Contact details only for teams that took responsibility** (and admins). Everyone on the board sees what is
  needed to judge distance and urgency.
- **Action endpoints** (`/sos/{id}/accept`, `/progress`, `/release`, …) instead of one free `PATCH`, so each
  action has its own permission rule and its own test.

## Alternatives considered

- **Central dispatcher assigns every request.** Rejected by the product owner: too slow in a flood, and a single
  point of failure.
- **Optimistic "claim" in the frontend only.** Rejected: two phones can click at the same moment; the database
  must decide.
- **Organisations as separate tenants with private boards.** Rejected for now: the point is one shared pool. The
  organisation is stored on each team, so filtering by organisation can be added later.
- **Keep `unable_to_reach` as a resting status.** Rejected: the request would sit with a team that cannot help.

## Consequences

- The old `PATCH /sos/{id}` is removed; backend and frontend must be deployed together.
- Admins must create teams and assign rescuers before anyone can accept a request.
- The history now names teams, which the sender can see (team name and organisation only).
