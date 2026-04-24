# LAN Deploy Notebook

Use this notebook when handing the LAN-first deployment to another backend engineer or agent. It is optimized for the internal rehearsal server `192.168.1.125`.

## Fixed Deployment Target

- Server IP: `192.168.1.125`
- Chosen internal classroom domain: `classroom-lan.test`
- Chosen internal LiveKit domain: `livekit-lan.test`
- TLS mode: internal company certificate files mounted into Caddy
- Recording mode: local MP4 files under `./recordings`

If the company CA will not issue certs for `.test`, stop here and replace both domains in `.env.lan` before deployment.

## Files To Use

- `docker-compose.lan.yml`
- `.env.lan.example` -> copy to `.env.lan`
- `infra/livekit/livekit.lan.yaml`
- `infra/livekit/egress.lan.yaml`
- `infra/reverse-proxy/Caddyfile.lan`
- `docs/LAN_RUNBOOK.md`

Do not deploy `docker-compose.full.yml` to the LAN server for this rehearsal.

## Operator Record

- Date:
- Operator:
- Commit SHA:
- Server OS:
- Docker version:
- Company certificate filenames:
- DNS managed by:
- Notes:

## Preflight Checklist

- [ ] Repo is checked out on the target commit.
- [ ] Server IP is still `192.168.1.125`.
- [ ] Docker Engine and Docker Compose are installed.
- [ ] Company certificate is available for both internal domains.
- [ ] Internal DNS or hosts-file mapping is prepared for all test machines.
- [ ] Firewall allows `80/tcp`, `443/tcp`, `7881/tcp`, and `50000-52000/udp`.
- [ ] At least `16 vCPU` and `32 GB RAM` are free for the rehearsal window.
- [ ] Local disk has enough free space for recordings.
- [ ] No conflicting service already binds ports `80`, `443`, `7881`, or `50000-52000/udp`.

## One-Time Setup

1. Copy the env file:

   ```bash
   cp .env.lan.example .env.lan
   ```

2. Review `.env.lan` and update only what is necessary:
   - `POSTGRES_PASSWORD`
   - `DATABASE_URL`
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
   - TLS cert/key filenames

3. If `LIVEKIT_API_KEY` or `LIVEKIT_API_SECRET` changes, update the same values in `infra/livekit/livekit.lan.yaml`.

4. Place certificate files under:

   ```text
   infra/reverse-proxy/certs/
   ```

5. Make sure every client machine resolves:

   ```text
   192.168.1.125 classroom-lan.test livekit-lan.test
   ```

## Deployment Steps

1. Build the images:

   ```bash
   docker compose --env-file .env.lan -f docker-compose.lan.yml build
   ```

2. Start infrastructure first:

   ```bash
   docker compose --env-file .env.lan -f docker-compose.lan.yml up -d postgres redis livekit egress
   ```

3. Run migrations explicitly:

   ```bash
   docker compose --env-file .env.lan -f docker-compose.lan.yml run --rm api npm run migrate:prod --workspace @classroom/api
   ```

4. Start app-facing services:

   ```bash
   docker compose --env-file .env.lan -f docker-compose.lan.yml up -d api web caddy
   ```

5. Confirm service state:

   ```bash
   docker compose --env-file .env.lan -f docker-compose.lan.yml ps
   ```

## Validation Commands

Run these on the server after deployment:

```bash
curl -kI https://classroom-lan.test
curl -k https://classroom-lan.test/api/health
docker compose --env-file .env.lan -f docker-compose.lan.yml logs --tail=50 caddy
docker compose --env-file .env.lan -f docker-compose.lan.yml logs --tail=50 api
docker compose --env-file .env.lan -f docker-compose.lan.yml logs --tail=50 livekit
docker compose --env-file .env.lan -f docker-compose.lan.yml logs --tail=50 egress
```

Expected API health result:

- `ok: true`
- `dataStore: postgres`
- `livekitUrl: wss://livekit-lan.test`

## Functional Acceptance Checklist

- [ ] `https://classroom-lan.test` opens from at least one client machine.
- [ ] Browser shows a trusted certificate or an explicitly approved internal company certificate.
- [ ] Create class works.
- [ ] Host invite link works.
- [ ] Student invite link works.
- [ ] Waiting room approve/reject works.
- [ ] Host and student can enable camera and microphone.
- [ ] Screen share works.
- [ ] Chat works.
- [ ] Leave and rejoin work.
- [ ] Recording start works.
- [ ] Recording stop works.
- [ ] A playable MP4 appears under `recordings/<class-id>/`.
- [ ] Restarting only the API does not lose class and recording metadata.

## Rehearsal Plan

1. Smoke test:
   - `1 host + 2 students`
   - 10 minutes
   - recording enabled

2. Medium rehearsal:
   - `1 host + 5 students`
   - 15 minutes
   - recording enabled

3. Main LAN rehearsal:
   - `1 host + 15 students`
   - 30 minutes
   - recording enabled

4. Parallel-room check:
   - `2 rooms`
   - `8-10 users` each
   - no config changes between runs

## Troubleshooting Notes

- If the site opens but camera/microphone fails, verify HTTPS trust and browser permissions first.
- If clients cannot join media but API works, verify `LIVEKIT_NODE_IP=192.168.1.125` and UDP `50000-52000`.
- If signaling works but some machines fail on stricter networks, note that TURN is not included in this LAN bundle yet.
- If the API fails strict startup checks, inspect `.env.lan` for placeholder or inconsistent values.
- If recording fails, inspect `egress` logs first, then check whether MP4 and manifest files appear under `recordings/`.
- If Caddy fails to start, verify cert/key paths and file permissions.
- If company CA trust is not available on all machines, certificate warnings will block realistic browser testing.

## Rollback

1. Stop only the app-facing services first:

   ```bash
   docker compose --env-file .env.lan -f docker-compose.lan.yml stop caddy web api
   ```

2. Restore the previous known-good commit or image set.
3. Restart the previous version with the same `.env.lan`.
4. Do not delete PostgreSQL volumes unless the rollback plan explicitly includes data loss.

## Handoff Output

When finishing, record:

- Final commit SHA used on the server.
- Whether the certificate was trusted on client machines.
- Exact result of `/api/health`.
- Number of clients tested.
- Whether recording produced a playable MP4.
- Any ports or DNS entries changed during deployment.
- The first blocker the next operator should check.

## Paste-Ready Prompt For The Next BE Or Agent

```text
Read AGENTS.md, docs/PROJECT_STATUS.md, docs/BACKLOG.md, docs/LAN_RUNBOOK.md, and docs/LAN_DEPLOY_NOTEBOOK.md first.

Deploy the LAN-first classroom bundle to the internal server 192.168.1.125 using docker-compose.lan.yml and .env.lan. Keep the chosen domains classroom-lan.test and livekit-lan.test unless the company CA cannot issue certs for .test, in which case update both domains consistently before starting.

Use internal company cert files in infra/reverse-proxy/certs, run migrations explicitly before starting api/web/caddy, verify https://classroom-lan.test/api/health returns ok with dataStore=postgres and livekitUrl=wss://livekit-lan.test, then run the LAN rehearsal checklist including recording and capture the results in the handoff notes.
```
