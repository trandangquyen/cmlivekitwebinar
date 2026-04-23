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
- Scale target: 13-23 concurrent classes eventually, but local MVP is only a functional baseline.

## Read Order For Every Agent

1. `AGENTS.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/ROADMAP.md`
4. `docs/BACKLOG.md`
5. `docs/DECISIONS.md`
6. If deploying or validating: `docs/STAGING_CHECKLIST.md` and `docs/PRODUCTION_CHECKLIST.md`

## Current Stack

- Frontend: React + Vite + LiveKit React Components.
- API: Express + TypeScript + LiveKit server SDK.
- Local infrastructure: Docker Compose, LiveKit, Redis, LiveKit Egress, API, Nginx web.
- Main compose file: `docker-compose.full.yml`.

## Common Commands

```powershell
cd C:\xampp\htdocs\CMWebinarAgora\livekit-classroom
npm run build
powershell -ExecutionPolicy Bypass -File .\scripts\check-docker.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-stack.ps1 -Full
docker compose -f docker-compose.full.yml ps
```

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
- Do not promise 23 concurrent rooms on one 1Gbps server. Capacity must be proven by load tests.
- Optimize video defaults before scaling: simulcast, dynacast, adaptive stream, bitrate caps.
