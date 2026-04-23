# Roadmap

## Phase A: Local MVP Baseline

Status: Completed

Goal: prove the self-hosted LiveKit direction with a usable browser classroom.

Exit criteria:

- Full Docker stack starts locally.
- Host can create a class.
- Student can request access.
- Host can approve waiting room.
- Participants can join LiveKit room.
- Camera, mic, screen share, chat, and leave controls are usable.
- Build passes.

## Phase B: Staging-Ready Foundation

Target duration: 1-2 weeks

Goal: make the project deployable to a staging server with persistent data and basic operational safety.

Required work:

- Replace in-memory store with PostgreSQL.
- Add migration tooling.
- Add environment profiles: local, staging, production.
- Replace dev LiveKit keys.
- Add reverse proxy and HTTPS plan.
- Validate real Egress recording output.
- Add basic backend API tests.
- Add frontend smoke tests for create/join/waiting room.
- Add staging deployment runbook.
- Add monitoring basics: container health, CPU, memory, network, LiveKit logs.

Exit criteria:

- A clean server can deploy from documented commands.
- Restarting API does not lose class and recording metadata.
- Staging runs under HTTPS.
- A real 2-browser classroom session works.
- Recording creates a playable output file.
- Basic tests run in CI or documented local command.

## Phase C: Education Product v0.3

Target duration: 2-4 weeks after staging foundation

Goal: make the classroom suitable for internal pilot classes.

Required work:

- Improve classroom UI around teacher/student workflows.
- Add role-based controls:
  - Host mute remote participant.
  - Host remove participant.
  - Host lock class.
  - Host stop participant screen share if needed.
- Add attendance/session logs.
- Add class schedule metadata.
- Add recording list and playback page.
- Add simple file/material links if required.
- Add better device preflight and permission errors.
- Add network quality indicators and user-facing reconnect states.

Exit criteria:

- Pilot teacher can run a class without engineering support.
- Admin can see class, attendance, recordings.
- Common browser permission and reconnect cases are handled.

## Phase D: Capacity & On-Prem Production Readiness

Target duration: 2-4 weeks after v0.3

Goal: prove that on-prem infrastructure can handle real concurrency.

Required work:

- Build load test harness for rooms and participants.
- Benchmark 1, 5, 10, 15, 23 concurrent rooms.
- Define bitrate profiles for teacher/student/screen share.
- Expand UDP port ranges and firewall documentation.
- Separate media nodes from Egress workers.
- Add Prometheus/Grafana/Loki or equivalent.
- Add alerting for CPU, memory, packet loss, reconnect rate, egress failures.
- Write incident runbook.

Exit criteria:

- Load test report exists.
- Per-node capacity is known and documented.
- Acceptance gates are met:
  - CPU p95 below 70%.
  - outbound network below 75% of NIC capacity.
  - packet loss p95 below 2%.
  - join time p95 below 5 seconds.
  - 2h class does not suffer mass disconnects.

## Phase E: Production Launch

Target duration: 1-2 weeks after capacity proof

Goal: launch controlled production for company classes.

Required work:

- Production secrets and key rotation process.
- Production backup policy.
- AWS fallback path for new/restarted classes.
- Production domain and TLS.
- Operational dashboard.
- Support workflow for teachers.
- Rollback plan.

Exit criteria:

- Production checklist is complete.
- Pilot group signs off.
- Monitoring and alerting are live.
- Support owner is defined.
