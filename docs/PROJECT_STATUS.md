# Project Status

Last updated: 2026-04-23

## Summary

The project has moved from planning into a working local MVP baseline and the first staging-foundation work has started. The full Docker stack now runs with self-hosted LiveKit, Redis, Egress, PostgreSQL, API, and web frontend.

## Completed

- Created new project `livekit-classroom` separate from Agora App Builder.
- Confirmed direction: LiveKit self-hosted is used to avoid LiveKit Cloud/Agora usage billing.
- Implemented API for:
  - Class creation.
  - Host/student links.
  - LiveKit participant token generation.
  - Waiting room request and host approval.
  - Recording start/stop via LiveKit Egress.
  - Recording list endpoint.
  - LiveKit webhook intake.
- Implemented web app for:
  - Create class.
  - Join by host/student link.
  - Waiting room polling.
  - LiveKit video conference.
  - Camera/mic/screen share/chat through LiveKit components.
  - Host waiting room controls.
  - Host recording button.
- Added Docker support:
  - `docker-compose.full.yml` for full local stack.
  - `docker-compose.livekit.yml` for media-only dev stack.
  - Dockerfiles for API and web.
  - Windows setup scripts.
- Added PostgreSQL persistence foundation:
  - API store can use PostgreSQL with `DATA_STORE=postgres`.
  - Full Docker stack includes PostgreSQL and API auto-migrations for local use.
  - Migration tooling and initial schema live under `apps/api/migrations`.
  - Class, waiting room, recording, and webhook metadata persist when Postgres is enabled.
- Fixed classroom viewport issue where LiveKit control footer was hidden below the visible area.
- Fixed local Docker Desktop media candidate handling for same-machine browser demos by advertising `127.0.0.1` instead of the LiveKit container IP.
- Added frontend error surfacing for unexpected LiveKit disconnects and camera/microphone failures instead of silently navigating back to `/`.
- Verified locally:
  - `npm run build` passes.
  - `npm run typecheck` passes.
  - Docker stack runs.
  - API health returns 200.
  - Web health returns 200.
  - Full Docker API reports `dataStore=postgres`.
  - Initial PostgreSQL migration applies in the API container.
  - API-created class survives API container restart when `DATA_STORE=postgres`.

## Current Known Limitations

- Quick local dev still defaults to `DATA_STORE=memory`; staging/full Docker must use `DATA_STORE=postgres`.
- No authentication or company user management yet.
- Host/student access codes are basic link secrets, not production-grade access control.
- Recording flow is scaffolded, but needs end-to-end validation for actual output files and browser layout.
- No object storage, reverse proxy, HTTPS, observability, or backups yet.
- Staging PostgreSQL server, backup/restore, and operational migration procedure are not validated yet.
- LiveKit is using dev credentials and local network settings.
- Local Docker media config is same-machine oriented (`rtc.node_ip=127.0.0.1`); LAN, staging, and Egress validation need a reachable LAN/public IP or external-IP setup.
- UDP port range is intentionally small for local dev and is not production capacity.
- No automated tests yet.
- No load test harness yet.
- No staging environment yet.

## Current Local Runtime

- Web: `http://localhost:8080`
- API: `http://localhost:4300`
- LiveKit: `ws://localhost:7880`
- LiveKit media candidate mode: `rtc.node_ip=127.0.0.1` for same-machine Docker Desktop browser testing.
- Redis: `localhost:6379`
- PostgreSQL: `localhost:5432` in full Docker mode.
- UDP media ports: `50000-50100/udp`

## Immediate Risk Assessment

- Highest technical risk: capacity for 13-23 concurrent classes with 14-16 cameras per class.
- Highest product risk: matching Agora-level classroom controls without overbuilding the first production release.
- Highest operations risk: on-prem network quality, public IP/NAT/TURN, monitoring, and incident response.
- Highest data risk: PostgreSQL persistence exists, but backups and restore validation are not implemented.

## Next Milestone

Move from local MVP to staging-ready v0.2:

- Finish environment-specific configuration.
- Add HTTPS/reverse proxy plan.
- Validate Egress recording.
- Add basic automated tests.
- Prepare staging deployment runbook.
