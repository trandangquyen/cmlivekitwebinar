# Architecture Decisions

## ADR-001: Use LiveKit Self-Hosted

Decision: Use LiveKit self-hosted instead of Agora or LiveKit Cloud.

Reason:

- Avoid usage billing by participant-minute where possible.
- Keep media server under company control.
- LiveKit media server, SDKs, and Egress can be self-hosted.

Consequences:

- The company pays infrastructure costs instead of platform usage fees.
- The company owns operations, uptime, observability, and scaling.
- AWS fallback still incurs AWS compute and bandwidth costs.

## ADR-002: Build A New Frontend Instead Of Forking Agora App Builder

Decision: Build a new web app and use Agora UI only as UX reference.

Reason:

- Agora App Builder source includes restrictive licensing text.
- Agora RTC/RTM dependencies are deeply embedded.
- Replacing Agora inside the existing app would be risky and slow.

Consequences:

- More initial product work.
- Lower legal and technical coupling risk.
- Cleaner LiveKit-native architecture.

## ADR-003: Web Browser First

Decision: Support web browser first.

Reason:

- Fastest path to staging.
- Fits class links and desktop/laptop education workflows.
- Avoids native SDK complexity until product fit is proven.

Consequences:

- Mobile/native support is deferred.
- Browser permission and device handling must be robust.

## ADR-004: Docker Compose For Local Full Stack

Decision: Use Docker Compose for local LiveKit, Redis, Egress, API, and web.

Reason:

- Reproducible local stack.
- Easier handoff between agents.
- Same conceptual shape as staging/production containers.

Consequences:

- Docker Desktop is required on Windows dev machines.
- Production should evolve to VM/systemd or Kubernetes depending on operating model.

## ADR-005: In-Memory Store Is Temporary

Decision: Current API uses in-memory storage only for local MVP.

Reason:

- Fastest way to prove flow.
- No schema decisions were needed for initial LiveKit integration.

Consequences:

- PostgreSQL was mandatory before staging work could continue.
- API restart loses class and recording metadata only when `DATA_STORE=memory` is used.

## ADR-006: PostgreSQL For Staging Persistence

Decision: Use PostgreSQL as the first durable application database and keep the in-memory store only as a quick local development mode.

Reason:

- Classes, waiting room requests, and recording metadata must survive API restarts before staging.
- PostgreSQL is predictable for backup/restore, migrations, and future reporting/admin workflows.
- The full Docker stack should resemble staging more closely than the initial memory-only MVP.

Consequences:

- Staging and production must set `DATA_STORE=postgres` and a real `DATABASE_URL`.
- Database migrations are required before each API version that changes schema.
- Backup and restore procedures are now a P0 operations task before production.
