# Staging Checklist

## Environment

- [ ] Staging server selected.
- [ ] Public domain/subdomain selected.
- [ ] DNS points to staging server.
- [ ] HTTPS certificate installed.
- [ ] Required ports opened:
  - TCP 80/443 for web/API/proxy.
  - TCP 7880/7881 or proxied LiveKit ports.
  - UDP media port range sized for staging load.
- [ ] Secrets replaced:
  - `LIVEKIT_API_KEY`
  - `LIVEKIT_API_SECRET`
  - DB credentials
  - storage credentials
- [ ] `.env.staging.example` copied into the deployment secret store with real values.
- [ ] `APP_ENV=staging` and `STRICT_CONFIG=true` are set.
- [ ] API startup guard passes with no unsafe configuration errors.
- [ ] Reverse proxy based on `infra/reverse-proxy/Caddyfile.example` or equivalent is deployed.
- [ ] TURN/coturn is deployed or explicitly waived after network testing.

## Data

- [ ] PostgreSQL deployed.
- [ ] Migrations run.
- [ ] API uses PostgreSQL, not in-memory store.
- [ ] Recording metadata persists across API restart.
- [ ] Backup procedure documented.
- [ ] Restore procedure tested.

Implementation note: the API supports `DATA_STORE=postgres`, `DATABASE_URL`, and `npm run migrate --workspace @classroom/api`. The local full Docker stack uses Postgres with `DB_AUTO_MIGRATE=true`; staging should normally run migrations explicitly.

## App

- [ ] Web served over HTTPS.
- [ ] API served over HTTPS.
- [ ] LiveKit WebSocket URL uses public staging domain.
- [ ] Create class works.
- [ ] Host link works.
- [ ] Student link works.
- [ ] Waiting room approve/reject works.
- [ ] Camera/mic works.
- [ ] Screen share works.
- [ ] Chat works.
- [ ] Leave/rejoin works.
- [ ] Recording start/stop works.
- [ ] Recording output file is playable.
- [ ] `npm run verify` passes before deployment.
- [ ] `Agent Review` has no blocking findings for the staging release.

## Operations

- [ ] `docker compose ps` or equivalent service status documented.
- [ ] Health endpoint monitored.
- [ ] LiveKit logs available.
- [ ] API logs available.
- [ ] Web/proxy logs available.
- [ ] Restart procedure documented.
- [ ] Rollback procedure documented.
- [ ] `docs/STAGING_RUNBOOK.md` has been followed or explicitly updated for the staging host.

## Acceptance

- [ ] One host + two students can complete a 30-minute test class.
- [ ] One host + 15 students can complete a 2-hour rehearsal class before production signoff.
- [ ] Browser refresh/rejoin is acceptable.
- [ ] No obvious UI overlap at desktop viewport.
- [ ] Teacher can operate without developer instructions.
