# Backlog

Statuses: `todo`, `in-progress`, `blocked`, `done`.

## P0: Required Before Staging

| Status      | Task                                | Notes                                                                                                   |
| ----------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| done        | Local full Docker stack             | LiveKit, Redis, Egress, API, web.                                                                       |
| done        | Local create/join/waiting room flow | Basic flow implemented.                                                                                 |
| done        | Fix hidden LiveKit footer           | CSS viewport fix applied.                                                                               |
| done        | PostgreSQL persistence              | API can use PostgreSQL with `DATA_STORE=postgres`; full Docker enables it.                              |
| done        | DB migrations                       | Initial SQL migration and npm migration commands added.                                                 |
| done        | Staging env config                  | `.env.local.example`, `.env.staging.example`, and `.env.production.example` added.                      |
| todo        | Production-safe secrets             | Replace `devkey/secret`; add secret handling.                                                           |
| todo        | Recording Egress validation         | Confirm playable files and metadata updates.                                                            |
| in-progress | API tests                           | Initial class, join, waiting room, and access guard tests added. Recording endpoint tests still needed. |
| in-progress | Web smoke tests                     | Initial create-class Playwright smoke test added. Join/waiting smoke tests still needed.                |
| in-progress | Reverse proxy/HTTPS                 | Caddy example added; staging deployment and certificate validation still needed.                        |
| todo        | Staging runbook                     | Exact deployment and rollback steps.                                                                    |
| done        | Agent Review gate                   | `agent-review` Codex skill installed and documented.                                                    |

## P1: Required Before Internal Pilot

| Status | Task                    | Notes                                                                                       |
| ------ | ----------------------- | ------------------------------------------------------------------------------------------- |
| todo   | Teacher controls        | Remote mute, remove, lock class.                                                            |
| todo   | Attendance logs         | Join/leave timestamps and participant role.                                                 |
| todo   | Recording playback page | Show completed recordings to host/admin.                                                    |
| todo   | Better preflight        | Camera/mic test, permission troubleshooting. Basic disconnect/media error surfacing exists. |
| todo   | Network status UX       | Reconnecting, poor network, packet loss warnings.                                           |
| todo   | Class schedule metadata | Start time, teacher, group/class id.                                                        |
| todo   | Admin list page         | Manage classes and recordings.                                                              |
| todo   | Basic auth model        | At minimum admin/teacher access, not public raw links only.                                 |

## P2: Required Before Larger Production

| Status | Task                     | Notes                                                  |
| ------ | ------------------------ | ------------------------------------------------------ |
| todo   | Load test harness        | Simulate 1, 5, 10, 15, 20, and 25 rooms.               |
| todo   | Bitrate policy           | Teacher, student, screen share presets.                |
| todo   | Multi-node LiveKit plan  | Room routing, Redis, node capacity.                    |
| todo   | Dedicated Egress workers | Do not compete with media nodes.                       |
| todo   | Monitoring stack         | Metrics, logs, dashboards, alerts.                     |
| todo   | AWS fallback             | Route new/restarted classes to AWS when on-prem fails. |
| todo   | Backup and restore       | DB and recording metadata.                             |
| todo   | Security review          | Tokens, role grants, CORS, headers, rate limits.       |

## Parking Lot

- Mobile browser polish.
- Native mobile app.
- Whiteboard.
- Breakout rooms.
- Quiz/polling.
- LMS/CRM integration.
- SSO.
- Multi-region routing.
