# Backlog

Statuses: `todo`, `in-progress`, `blocked`, `done`.

## P0: Required Before Staging

| Status | Task | Notes |
| --- | --- | --- |
| done | Local full Docker stack | LiveKit, Redis, Egress, API, web. |
| done | Local create/join/waiting room flow | Basic flow implemented. |
| done | Fix hidden LiveKit footer | CSS viewport fix applied. |
| todo | PostgreSQL persistence | Replace in-memory store. |
| todo | DB migrations | Choose migration tool and document commands. |
| todo | Staging env config | Separate local/staging/prod config. |
| todo | Production-safe secrets | Replace `devkey/secret`; add secret handling. |
| todo | Recording Egress validation | Confirm playable files and metadata updates. |
| todo | API tests | Class creation, join, waiting approval, recording endpoints. |
| todo | Web smoke tests | Create class, join host, join student waiting room. |
| todo | Reverse proxy/HTTPS | Nginx/Caddy/Traefik plan for staging. |
| todo | Staging runbook | Exact deployment and rollback steps. |

## P1: Required Before Internal Pilot

| Status | Task | Notes |
| --- | --- | --- |
| todo | Teacher controls | Remote mute, remove, lock class. |
| todo | Attendance logs | Join/leave timestamps and participant role. |
| todo | Recording playback page | Show completed recordings to host/admin. |
| todo | Better preflight | Camera/mic test, permission troubleshooting. |
| todo | Network status UX | Reconnecting, poor network, packet loss warnings. |
| todo | Class schedule metadata | Start time, teacher, group/class id. |
| todo | Admin list page | Manage classes and recordings. |
| todo | Basic auth model | At minimum admin/teacher access, not public raw links only. |

## P2: Required Before Larger Production

| Status | Task | Notes |
| --- | --- | --- |
| todo | Load test harness | Simulate 13-23 rooms and participants. |
| todo | Bitrate policy | Teacher, student, screen share presets. |
| todo | Multi-node LiveKit plan | Room routing, Redis, node capacity. |
| todo | Dedicated Egress workers | Do not compete with media nodes. |
| todo | Monitoring stack | Metrics, logs, dashboards, alerts. |
| todo | AWS fallback | Route new/restarted classes to AWS when on-prem fails. |
| todo | Backup and restore | DB and recording metadata. |
| todo | Security review | Tokens, role grants, CORS, headers, rate limits. |

## Parking Lot

- Mobile browser polish.
- Native mobile app.
- Whiteboard.
- Breakout rooms.
- Quiz/polling.
- LMS/CRM integration.
- SSO.
- Multi-region routing.
