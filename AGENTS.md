# Agent Coordination Guide

This file is the first document every agent should read before changing this project.

## Project Goal

Build a self-hosted online classroom platform using open-source LiveKit instead of Agora billing. The target is education use for the company, not a resale product. The product should run primarily on company/on-prem servers, with AWS fallback when needed.

## Current Product Direction

- Use **LiveKit self-hosted**, not LiveKit Cloud.
- Do not build a WebRTC SFU from scratch.
- Do not reuse Agora App Builder source as the production base. Use it only as UX reference.
- Web browser is the first supported platform.
- Class model: about 16 participants per class, most participants may enable camera.
- Production scale target: 25 concurrent classes, 16 participants per class, about 400 concurrent participants, with all participants allowed to publish camera.
- Pilot is a production rehearsal and does not lower engineering or operations standards.

## Read Order For Every Agent

1. `AGENTS.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/ROADMAP.md`
4. `docs/BACKLOG.md`
5. `docs/DECISIONS.md`
6. `docs/PRODUCTION_READINESS_PLAN.md`
7. If deploying or validating: `docs/LAN_RUNBOOK.md`, `docs/LAN_DEPLOY_NOTEBOOK.md`, `docs/STAGING_CHECKLIST.md`, `docs/PRODUCTION_CHECKLIST.md`, and `docs/CAPACITY_TEST_PLAN.md`

## Current Stack

- Frontend: React + Vite + LiveKit React Components.
- API: Express + TypeScript + LiveKit server SDK.
- Local infrastructure: Docker Compose, LiveKit, Redis, LiveKit Egress, API, Nginx web.
- Main compose file: `docker-compose.full.yml`.

## Common Commands

```powershell
cd C:\xampp\htdocs\CMWebinarAgora\livekit-classroom
npm run build
npm run verify
powershell -ExecutionPolicy Bypass -File .\scripts\check-docker.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-stack.ps1 -Full
docker compose -f docker-compose.full.yml ps
```

**Important Note for Frontend Development**: The full Docker stack (`start-stack.ps1 -Full`) serves a statically built production bundle of the React frontend on `http://localhost:8080`. It does NOT have hot-module reloading. If you make changes to the React code in `apps/web/src` or `apps/api`, a simple browser hard-refresh will not show your changes. You must either:

1. Rebuild the stack: `powershell -ExecutionPolicy Bypass -File .\scripts\start-stack.ps1 -Full -Rebuild`
2. OR, run the local Vite dev server (`npm run dev:web`) which serves on `http://localhost:5173` with HMR.

Open:

- Web: `http://localhost:8080`
- API health: `http://localhost:4300/api/health`
- LiveKit WebSocket: `ws://localhost:7880`

## Handoff Rules

- Update `docs/PROJECT_STATUS.md` after meaningful changes.
- Update `docs/BACKLOG.md` whenever task status changes.
- Add major architecture decisions to `docs/DECISIONS.md`.
- Do not leave Docker or dev server assumptions unstated in the final handoff.
- If a change affects staging/production, update the relevant checklist.
- Keep the system self-host-first unless the user explicitly changes direction.

## Engineering Guardrails

- Keep secrets out of git. `.env` is local-only.
- Replace `devkey` and `secret` before staging.
- Recording/Egress must not run on the same constrained media node in production.
- Do not promise 25 concurrent rooms on one 1Gbps server. Capacity must be proven by load tests.
- Optimize video defaults before scaling: simulcast, dynacast, adaptive stream, bitrate caps.
- Run `Agent Review` after large tasks and before important commits. Blocking findings must be resolved before considering the task done.
