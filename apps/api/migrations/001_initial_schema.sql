CREATE TABLE IF NOT EXISTS classrooms (
  id text PRIMARY KEY,
  title text NOT NULL,
  room_name text NOT NULL UNIQUE,
  host_access_code text NOT NULL,
  student_access_code text NOT NULL,
  waiting_room_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS classrooms_created_at_idx
  ON classrooms (created_at DESC);

CREATE TABLE IF NOT EXISTS waiting_requests (
  id text PRIMARY KEY,
  class_id text NOT NULL REFERENCES classrooms (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'student',
  name text NOT NULL,
  access_code text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CONSTRAINT waiting_requests_role_check
    CHECK (role = 'student'),
  CONSTRAINT waiting_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS waiting_requests_class_id_created_at_idx
  ON waiting_requests (class_id, created_at ASC);

CREATE TABLE IF NOT EXISTS recordings (
  id text PRIMARY KEY,
  class_id text NOT NULL REFERENCES classrooms (id) ON DELETE CASCADE,
  egress_id text UNIQUE,
  status text NOT NULL,
  layout text NOT NULL,
  output_path text,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  stopped_at timestamptz,
  CONSTRAINT recordings_status_check
    CHECK (status IN ('starting', 'active', 'stopping', 'complete', 'failed')),
  CONSTRAINT recordings_layout_check
    CHECK (layout IN ('speaker', 'grid'))
);

CREATE INDEX IF NOT EXISTS recordings_class_id_started_at_idx
  ON recordings (class_id, started_at DESC);

CREATE TABLE IF NOT EXISTS webhook_events (
  id bigserial PRIMARY KEY,
  event jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_events_received_at_idx
  ON webhook_events (received_at DESC);
