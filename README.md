# LiveKit Classroom

Self-hosted classroom project for replacing Agora App Builder with an open-source WebRTC SFU stack.

LiveKit has paid Cloud plans, but the media server, SDKs, and Egress service can be self-hosted. This project is wired for self-hosting first: local/on-prem LiveKit + Redis + Egress, with AWS fallback handled by changing environment endpoints.

## What is included

- `apps/api`: Express API for class creation, join tokens, waiting room approval, recording start/stop, and LiveKit webhook intake.
- `apps/web`: React/Vite web classroom using LiveKit React Components with camera, mic, screen share, chat, grid/focus layout, and host recording controls.
- `docker-compose.full.yml`: full local stack with PostgreSQL, LiveKit, Redis, Egress, API, and web.
- `docker-compose.livekit.yml`: local/on-prem media-only LiveKit stack with Redis and Egress.
- `apps/api/migrations`: PostgreSQL schema migrations for class, waiting room, recording, and webhook metadata.

## Project Coordination

This project is expected to continue across multiple work sessions and agents. Start every session with:

1. `AGENTS.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/ROADMAP.md`
4. `docs/BACKLOG.md`

Use these supporting docs when needed:

- `docs/DECISIONS.md`: architecture decisions.
- `docs/STAGING_CHECKLIST.md`: staging readiness.
- `docs/PRODUCTION_CHECKLIST.md`: production readiness.
- `docs/PRODUCTION_READINESS_PLAN.md`: production gates for 25 concurrent classes.
- `docs/CAPACITY_TEST_PLAN.md`: load and soak test ladder for 25-class proof.
- `docs/AGENT_REVIEW.md`: how to invoke the Agent Review quality gate.
- `docs/HANDOFF_TEMPLATE.md`: handoff format for the next agent.

## Production Target

The final production target is 25 simultaneous classes with 16 participants per class, about 400 concurrent participants. Pilot runs are production rehearsals, not lower-quality demos. Production readiness requires measured capacity proof, a 2-hour soak test, monitoring, backup/restore validation, recording validation, and a clean Agent Review gate.

## Quick Start

1. Copy `.env.example` to `.env` and keep the default dev keys for local testing. The default `DATA_STORE=memory` is only for quick local development. Environment-specific examples are available as `.env.local.example`, `.env.staging.example`, and `.env.production.example`.
2. Start LiveKit media stack only:

   ```powershell
   docker compose -f docker-compose.livekit.yml up
   ```

3. Install dependencies and run both apps:

   ```powershell
   npm install
   npm run dev:api
   npm run dev:web
   ```

4. Open `http://localhost:5173`, create a class, then use the host and student links in separate browser windows.

## Quality Gates

Run the fast local gate before handoff or Agent Review:

```powershell
npm run verify
```

Run the browser smoke tests separately when a local browser test is needed:

```powershell
npm run test:browser
```

## Persistence And Migrations

Full Docker mode uses PostgreSQL and runs API migrations automatically for local convenience. For a non-Docker API process, set:

```powershell
DATA_STORE=postgres
DATABASE_URL=postgresql://classroom:classroom_dev@localhost:5432/classroom
npm run migrate --workspace @classroom/api
```

For staging/production, run migrations explicitly before starting the new API version:

```powershell
npm run build --workspace @classroom/api
npm run migrate:prod --workspace @classroom/api
```

Keep `DB_AUTO_MIGRATE=false` outside local full-stack development unless the deployment process intentionally owns automatic migrations.

## Full Docker Stack On Windows

Use this when you want Docker to run PostgreSQL, LiveKit, Redis, Egress, the API, and the web app together.

1. Check prerequisites:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/check-docker.ps1
   ```

2. If Docker is missing, install Docker Desktop from an elevated PowerShell session:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/install-docker-desktop.ps1 -InstallWsl
   ```

   Reboot if Windows asks, then start Docker Desktop once.

   If your current terminal is not elevated, use:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/open-admin-installer.ps1
   ```

   Approve the Windows UAC prompt, then let the elevated installer finish.

3. Start everything:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/start-stack.ps1 -Full
   ```

4. Open:
   - Web: `http://localhost:8080`
   - API health: `http://localhost:4300/api/health`
   - LiveKit WebSocket: `ws://localhost:7880`

The local Docker LiveKit config advertises `rtc.node_ip: 127.0.0.1` so browser tabs on the same Windows machine can reach the host-mapped WebRTC UDP ports. If you join from another device on the LAN, validate Egress recording, or deploy to staging, replace this with the host LAN/public IP or use `rtc.use_external_ip=true` as appropriate for that network.

For production on a public server, update `infra/livekit/*.yaml` with the real domain, set `rtc.use_external_ip=true` or an explicit NAT IP, replace `devkey/secret`, and widen the UDP port range.

## Production Notes

- Replace `devkey` and `secret`.
- Set `rtc.use_external_ip=true` or configure NAT/public IP according to the on-prem network.
- Expand the UDP port range beyond `50000-50100` for real load.
- Run multiple LiveKit nodes behind a load balancer and shared Redis; pin each room to one node.
- Run separate Egress workers. Room composite recordings are CPU-heavy and should not compete with media nodes.
