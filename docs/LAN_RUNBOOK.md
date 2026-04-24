# LAN-First Internal Deployment Runbook

This runbook prepares a company-internal rehearsal environment before public staging. It targets the internal server `192.168.1.125` and uses these two internal domains:

- `classroom-lan.test`
- `livekit-lan.test`

These names avoid `.local` mDNS conflicts and are easy to point at an internal host.

## 1. Prerequisites

1. Copy the repo to the internal server.
2. Install Docker Engine and Docker Compose on the server.
3. Make sure the server can accept inbound traffic on:
   - TCP `80` and `443`
   - TCP `7881`
   - UDP `50000-52000`
4. Confirm the server LAN IP is still `192.168.1.125`.
5. Confirm the reverse proxy certs are available from the company CA or internal PKI.

## 2. DNS Or Hosts Mapping

Point both internal names at the server:

```text
192.168.1.125 classroom-lan.test livekit-lan.test
```

Preferred approach: internal DNS.

Fallback for a small rehearsal: add the same line to the hosts file on every test machine.

## 3. Environment File

1. Copy [.env.lan.example](/c:/xampp/htdocs/CMWebinarAgora/livekit-classroom/.env.lan.example) to `.env.lan`.
2. Keep the chosen domains unless you need to align with an existing company naming scheme.
3. If you change `LIVEKIT_API_KEY` or `LIVEKIT_API_SECRET` in `.env.lan`, make the same change in [livekit.lan.yaml](/c:/xampp/htdocs/CMWebinarAgora/livekit-classroom/infra/livekit/livekit.lan.yaml:1).
4. If you change `POSTGRES_PASSWORD`, keep the password inside `DATABASE_URL` aligned with it.
5. Keep:

```env
APP_ENV=staging
STRICT_CONFIG=true
DATA_STORE=postgres
DB_AUTO_MIGRATE=false
RECORDING_OUTPUT_MODE=local
LIVEKIT_HTTP_URL=http://livekit:7880
```

## 4. Certificates

1. Place the internal company cert and key files under `infra/reverse-proxy/certs/`.
2. Update the `*_TLS_CERT_FILE` and `*_TLS_KEY_FILE` paths in `.env.lan` if the filenames differ.
3. If your company CA issues one SAN cert for both names, point both domain pairs to the same files.

This bundle expects file-based TLS in Caddy, not ACME issuance.

## 5. Start The LAN Stack

Run these from the repo root on the internal server:

```bash
docker compose --env-file .env.lan -f docker-compose.lan.yml build
docker compose --env-file .env.lan -f docker-compose.lan.yml up -d postgres redis livekit egress
```

Run migrations explicitly before starting the API for the first time or after schema changes:

```bash
docker compose --env-file .env.lan -f docker-compose.lan.yml run --rm api npm run migrate:prod --workspace @classroom/api
```

Then start the app-facing services:

```bash
docker compose --env-file .env.lan -f docker-compose.lan.yml up -d api web caddy
```

## 6. Validate The Deployment

Check service status:

```bash
docker compose --env-file .env.lan -f docker-compose.lan.yml ps
```

Check API health from the server:

```bash
curl https://classroom-lan.test/api/health
```

Expected response should include:

- `ok: true`
- `dataStore: postgres`
- `livekitUrl: wss://livekit-lan.test`

## 7. Functional Rehearsal

1. Open `https://classroom-lan.test`.
2. Create a class.
3. Join as host in one browser.
4. Join as students from the other LAN machines.
5. Approve waiting room requests.
6. Validate camera, microphone, screen share, chat, leave, and rejoin.
7. Start and stop recording.
8. Confirm the recorded MP4 appears under `recordings/` on the server and is playable.

Suggested rehearsal order:

1. `1 host + 5 students`, 15 minutes, with recording.
2. `1 host + 15 students`, 30 minutes, with recording.
3. `2 rooms in parallel`, 8-10 users each, without changing the server.

## 8. Important Limits

- This bundle is optimized for LAN rehearsal, not internet-facing production.
- TURN is not included yet. Add TURN or LiveKit embedded TURN later if users outside the LAN or stricter corporate networks join.
- Recording is intentionally `local`, not S3 or MinIO.
- `docker-compose.lan.yml` keeps the stack on bridge networking for operational simplicity. If later tests show networking bottlenecks, move LiveKit to host networking as a follow-up optimization.
