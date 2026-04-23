# Project Status

Last updated: 2026-04-22

## Summary

The project has moved from planning into a working local MVP baseline. The system now runs as a full Docker stack with self-hosted LiveKit, Redis, Egress, API, and web frontend.

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
- Fixed classroom viewport issue where LiveKit control footer was hidden below the visible area.
- Verified locally:
  - `npm run build` passes.
  - Docker stack runs.
  - API health returns 200.
  - Web health returns 200.

## Current Known Limitations

- Data is in memory only. Restarting API loses classes, waiting requests, and recording metadata.
- No authentication or company user management yet.
- Host/student access codes are basic link secrets, not production-grade access control.
- Recording flow is scaffolded, but needs end-to-end validation for actual output files and browser layout.
- No real database, object storage, reverse proxy, HTTPS, observability, or backups yet.
- LiveKit is using dev credentials and local network settings.
- UDP port range is intentionally small for local dev and is not production capacity.
- No automated tests yet.
- No load test harness yet.
- No staging environment yet.

## Current Local Runtime

- Web: `http://localhost:8080`
- API: `http://localhost:4300`
- LiveKit: `ws://localhost:7880`
- Redis: `localhost:6379`
- UDP media ports: `50000-50100/udp`

## Immediate Risk Assessment

- Highest technical risk: capacity for 13-23 concurrent classes with 14-16 cameras per class.
- Highest product risk: matching Agora-level classroom controls without overbuilding the first production release.
- Highest operations risk: on-prem network quality, public IP/NAT/TURN, monitoring, and incident response.
- Highest data risk: no persistent DB/storage yet.

## Next Milestone

Move from local MVP to staging-ready v0.2:

- Add PostgreSQL persistence.
- Add environment-specific configuration.
- Add HTTPS/reverse proxy plan.
- Validate Egress recording.
- Add basic automated tests.
- Prepare staging deployment runbook.
