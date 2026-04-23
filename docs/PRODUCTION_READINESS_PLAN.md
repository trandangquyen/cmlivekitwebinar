# Production Readiness Plan

Target: 25 concurrent classes, 16 participants per class, about 400 concurrent participants, with all participants allowed to publish camera.

Pilot is a production rehearsal, not a lower-quality release. The system is not production-ready until the gates below are measured and documented.

## Required Gates

- Feature gates: recording, screen sharing, precall, chat, virtual background fallback, waiting room, noise cancellation defaults, active speaker, teacher controls, recording playback, admin/teacher auth.
- Infrastructure gates: HTTPS, public LiveKit `wss://`, TURN fallback, Postgres persistence, object storage recording, pinned runtime images, separated Egress workers, monitoring, backups, restore drill, rollback runbook.
- Capacity gates: 1, 5, 10, 15, 20, and 25 room tests; all-camera scenario; screen share scenario; recording stress test; 2-hour soak test.
- Acceptance metrics: CPU p95 below 70 percent, outbound network below 75 percent of NIC capacity, packet loss p95 below 2 percent, join time p95 below 5 seconds, no mass disconnects in the 2-hour soak.

## Release Path

1. Stabilize engineering foundation: lint, typecheck, API tests, browser smoke tests, Agent Review gate.
2. Deploy staging with production-like Postgres, object storage, HTTPS, public LiveKit URL, and TURN.
3. Complete pilot product workflows: admin/teacher auth, schedule metadata, precall, teacher controls, attendance, recording playback.
4. Add operations: metrics, logs, alerts, backup/restore, incident response, AWS fallback for new or restarted classes.
5. Prove 25-room capacity with a written load report before production signoff.

## Non-Negotiables

- Do not run production with `DATA_STORE=memory`.
- Do not run production with LiveKit `devkey` or `secret`.
- Do not claim 25-room readiness from estimates alone.
- Do not co-locate heavy RoomComposite Egress jobs with constrained media nodes in production.
- Do not expose recording playback without authenticated role checks.
