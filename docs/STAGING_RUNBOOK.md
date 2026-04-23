# Staging Deployment Runbook

This runbook is the baseline procedure for moving the local MVP to a staging server. Do not deploy `docker-compose.full.yml` unchanged to staging; it is intentionally local-first and uses local domains, narrow media ports, and development credentials.

## 1. Prepare The Server

1. Provision a clean Linux host or VM with Docker Engine and Docker Compose.
2. Point DNS records at the server:
   - `CLASSROOM_DOMAIN`, for example `classroom-staging.example.com`.
   - `LIVEKIT_DOMAIN`, for example `livekit-staging.example.com`.
3. Open firewall ports:
   - TCP 80 and 443 for Caddy/HTTPS.
   - TCP 7881 if using LiveKit TCP fallback directly.
   - UDP media range sized for staging load. Use a wider range than local `50000-50100` before a 16-participant rehearsal.
4. Create persistent volumes or host mounts for PostgreSQL, Redis, proxy data, and any local recording output.

## 2. Prepare Secrets And Environment

1. Copy `.env.staging.example` into the staging secret store or a server-local `.env.staging` file that is not committed.
2. Replace every `replace-me` value.
3. Keep:

   ```env
   APP_ENV=staging
   STRICT_CONFIG=true
   DATA_STORE=postgres
   DB_AUTO_MIGRATE=false
   ```

4. Set public URLs to HTTPS/WSS:

   ```env
   FRONTEND_ORIGIN=https://classroom-staging.example.com
   PUBLIC_API_BASE_URL=https://classroom-staging.example.com
   LIVEKIT_WS_URL=wss://livekit-staging.example.com
   ```

5. Configure LiveKit and Egress with the same `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`. The API startup guard blocks staging boot if the API still has `devkey`, `secret`, placeholders, localhost public URLs, in-memory storage, or automatic migrations enabled.

## 3. Configure LiveKit, Egress, And HTTPS

1. Start from `infra/livekit/livekit.full.yaml` and `infra/livekit/egress.full.yaml`.
2. Replace the hardcoded local `devkey: secret` pair and webhook key with staging secrets.
3. Point the LiveKit webhook URL at the API service path:

   ```yaml
   webhook:
     api_key: <LIVEKIT_API_KEY>
     urls:
       - http://api:4300/api/livekit/webhook
   ```

4. Set `rtc.use_external_ip=true` for a public cloud VM, or set `rtc.node_ip`/NAT mapping according to the staging network.
5. Use `infra/reverse-proxy/Caddyfile.example` with `CLASSROOM_DOMAIN`, `LIVEKIT_DOMAIN`, and `ACME_EMAIL` from the staging environment.

## 4. Build And Verify The Release

Run these from the repo root before deployment:

```powershell
npm ci
npm run verify
npm run build
```

On the staging server, run migrations before starting the new API container:

```powershell
npm run migrate:prod --workspace @classroom/api
```

If migrations fail, do not start the new API version. Restore the previous release image/config and investigate the migration error.

## 5. Deploy

1. Pull or copy the reviewed release artifact to the staging server.
2. Apply the staging environment and mounted LiveKit/Egress/Caddy configs.
3. Start PostgreSQL and Redis first.
4. Run migrations explicitly.
5. Start LiveKit, Egress, API, web, and Caddy.
6. Confirm service state:

   ```powershell
   docker compose ps
   ```

7. Confirm API health:

   ```powershell
   curl https://classroom-staging.example.com/api/health
   ```

Expected health response includes `ok: true`, `dataStore: postgres`, and the staging LiveKit URL.

## 6. Validate Classroom And Recording

1. Create a class from the staging web URL.
2. Join as host in one browser and as two students in separate windows or browsers.
3. Approve waiting room requests.
4. Validate camera, microphone, screen share, chat, leave, and rejoin.
5. Start and stop recording.
6. Confirm the recording metadata appears on the API and the output file/object is playable.
7. Restart the API service and confirm the class and recording metadata still exist.
8. Run a 30-minute host plus two-student test class before any wider pilot rehearsal.

## 7. Rollback

1. Stop only the new API and web release first.
2. Restart the previous API and web image/config.
3. Do not roll the database backward unless a written migration rollback exists.
4. If a migration caused the issue, restore from the latest staging backup and document data loss risk before continuing.
5. Keep LiveKit rooms running when possible; class sessions already in progress should be ended deliberately, not by killing the media node.

## 8. Handoff Checklist

- `npm run verify` passed for the release.
- Migrations ran successfully with `DB_AUTO_MIGRATE=false`.
- API health reports `dataStore=postgres`.
- HTTPS certificate issued for both staging domains.
- One host plus two students completed the smoke session.
- Recording output is playable.
- API restart did not lose class or recording metadata.
- Rollback path has been tested or explicitly waived for the rehearsal.
