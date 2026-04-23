import {nanoid} from 'nanoid';
import type {QueryResultRow} from 'pg';
import {config} from './config.js';
import {isPostgresEnabled, query} from './db.js';
import type {
  Classroom,
  RecordingRecord,
  WaitingRequest,
  WaitingStatus,
} from './types.js';

type ClassroomRow = QueryResultRow & {
  id: string;
  title: string;
  room_name: string;
  host_access_code: string;
  student_access_code: string;
  waiting_room_enabled: boolean;
  created_at: Date | string;
};

type WaitingRequestRow = QueryResultRow & {
  id: string;
  class_id: string;
  role: 'student';
  name: string;
  access_code: string;
  status: WaitingStatus;
  created_at: Date | string;
  decided_at: Date | string | null;
};

type RecordingRow = QueryResultRow & {
  id: string;
  class_id: string;
  egress_id: string | null;
  status: RecordingRecord['status'];
  layout: RecordingRecord['layout'];
  output_path: string | null;
  error: string | null;
  started_at: Date | string;
  stopped_at: Date | string | null;
};

const classes = new Map<string, Classroom>();
const waitingRequests = new Map<string, WaitingRequest>();
const recordings = new Map<string, RecordingRecord>();
const webhookEvents: unknown[] = [];

export const resetMemoryStore = () => {
  classes.clear();
  waitingRequests.clear();
  recordings.clear();
  webhookEvents.length = 0;
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

const accessCode = () => nanoid(10);

const toIso = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const optionalIso = (value: Date | string | null | undefined) =>
  value ? toIso(value) : undefined;

const linksForClassroom = (
  id: string,
  hostAccessCode: string,
  studentAccessCode: string,
) => {
  const classUrl = `${config.api.frontendOrigin}/join/${id}`;
  return {
    host: `${classUrl}?role=host&code=${hostAccessCode}`,
    student: `${classUrl}?role=student&code=${studentAccessCode}`,
  };
};

const classroomFromRow = (row: ClassroomRow): Classroom => ({
  id: row.id,
  title: row.title,
  roomName: row.room_name,
  hostAccessCode: row.host_access_code,
  studentAccessCode: row.student_access_code,
  waitingRoomEnabled: row.waiting_room_enabled,
  createdAt: toIso(row.created_at),
  links: linksForClassroom(
    row.id,
    row.host_access_code,
    row.student_access_code,
  ),
});

const waitingRequestFromRow = (row: WaitingRequestRow): WaitingRequest => ({
  id: row.id,
  classId: row.class_id,
  role: row.role,
  name: row.name,
  accessCode: row.access_code,
  status: row.status,
  createdAt: toIso(row.created_at),
  decidedAt: optionalIso(row.decided_at),
});

const recordingFromRow = (row: RecordingRow): RecordingRecord => ({
  id: row.id,
  classId: row.class_id,
  egressId: row.egress_id || undefined,
  status: row.status,
  layout: row.layout,
  outputPath: row.output_path || undefined,
  error: row.error || undefined,
  startedAt: toIso(row.started_at),
  stoppedAt: optionalIso(row.stopped_at),
});

const memoryCreateClassroom = (input: {
  title: string;
  waitingRoomEnabled?: boolean;
}): Classroom => {
  const id = nanoid(12);
  const safeTitle = slugify(input.title) || 'classroom';
  const hostAccessCode = accessCode();
  const studentAccessCode = accessCode();
  const roomName = `class_${safeTitle}_${id}`;
  const waitingRoomEnabled =
    input.waitingRoomEnabled ?? config.classroom.defaultWaitingRoom;

  const classroom: Classroom = {
    id,
    title: input.title.trim(),
    roomName,
    hostAccessCode,
    studentAccessCode,
    waitingRoomEnabled,
    createdAt: new Date().toISOString(),
    links: linksForClassroom(id, hostAccessCode, studentAccessCode),
  };

  classes.set(id, classroom);
  return classroom;
};

export const createClassroom = async (input: {
  title: string;
  waitingRoomEnabled?: boolean;
}): Promise<Classroom> => {
  if (!isPostgresEnabled) {
    return memoryCreateClassroom(input);
  }

  const id = nanoid(12);
  const safeTitle = slugify(input.title) || 'classroom';
  const hostAccessCode = accessCode();
  const studentAccessCode = accessCode();
  const roomName = `class_${safeTitle}_${id}`;
  const waitingRoomEnabled =
    input.waitingRoomEnabled ?? config.classroom.defaultWaitingRoom;
  const result = await query<ClassroomRow>(
    `
      INSERT INTO classrooms (
        id,
        title,
        room_name,
        host_access_code,
        student_access_code,
        waiting_room_enabled
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      id,
      input.title.trim(),
      roomName,
      hostAccessCode,
      studentAccessCode,
      waitingRoomEnabled,
    ],
  );

  return classroomFromRow(result.rows[0]);
};

export const getClassroom = async (id: string): Promise<Classroom | null> => {
  if (!isPostgresEnabled) {
    return classes.get(id) || null;
  }

  const result = await query<ClassroomRow>(
    'SELECT * FROM classrooms WHERE id = $1',
    [id],
  );
  return result.rows[0] ? classroomFromRow(result.rows[0]) : null;
};

export const listClassrooms = async (): Promise<Classroom[]> => {
  if (!isPostgresEnabled) {
    return Array.from(classes.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  const result = await query<ClassroomRow>(
    'SELECT * FROM classrooms ORDER BY created_at DESC',
  );
  return result.rows.map(classroomFromRow);
};

export const createWaitingRequest = async (input: {
  classId: string;
  name: string;
  accessCode: string;
}): Promise<WaitingRequest> => {
  if (!isPostgresEnabled) {
    const request: WaitingRequest = {
      id: nanoid(14),
      classId: input.classId,
      role: 'student',
      name: input.name,
      accessCode: input.accessCode,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    waitingRequests.set(request.id, request);
    return request;
  }

  const result = await query<WaitingRequestRow>(
    `
      INSERT INTO waiting_requests (
        id,
        class_id,
        role,
        name,
        access_code,
        status
      )
      VALUES ($1, $2, 'student', $3, $4, 'pending')
      RETURNING *
    `,
    [nanoid(14), input.classId, input.name, input.accessCode],
  );
  return waitingRequestFromRow(result.rows[0]);
};

export const getWaitingRequest = async (
  id: string,
): Promise<WaitingRequest | null> => {
  if (!isPostgresEnabled) {
    return waitingRequests.get(id) || null;
  }

  const result = await query<WaitingRequestRow>(
    'SELECT * FROM waiting_requests WHERE id = $1',
    [id],
  );
  return result.rows[0] ? waitingRequestFromRow(result.rows[0]) : null;
};

export const listWaitingRequests = async (
  classId: string,
): Promise<WaitingRequest[]> => {
  if (!isPostgresEnabled) {
    return Array.from(waitingRequests.values())
      .filter(request => request.classId === classId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  const result = await query<WaitingRequestRow>(
    `
      SELECT *
      FROM waiting_requests
      WHERE class_id = $1
      ORDER BY created_at ASC
    `,
    [classId],
  );
  return result.rows.map(waitingRequestFromRow);
};

export const decideWaitingRequest = async (
  requestId: string,
  status: Extract<WaitingStatus, 'approved' | 'rejected'>,
): Promise<WaitingRequest | null> => {
  if (!isPostgresEnabled) {
    const request = waitingRequests.get(requestId);
    if (!request) {
      return null;
    }
    const updated: WaitingRequest = {
      ...request,
      status,
      decidedAt: new Date().toISOString(),
    };
    waitingRequests.set(requestId, updated);
    return updated;
  }

  const result = await query<WaitingRequestRow>(
    `
      UPDATE waiting_requests
      SET status = $2, decided_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [requestId, status],
  );
  return result.rows[0] ? waitingRequestFromRow(result.rows[0]) : null;
};

export const createRecording = async (
  record: Omit<RecordingRecord, 'id' | 'startedAt'>,
): Promise<RecordingRecord> => {
  if (!isPostgresEnabled) {
    const recording: RecordingRecord = {
      ...record,
      id: nanoid(14),
      startedAt: new Date().toISOString(),
    };
    recordings.set(recording.id, recording);
    return recording;
  }

  const result = await query<RecordingRow>(
    `
      INSERT INTO recordings (
        id,
        class_id,
        egress_id,
        status,
        layout,
        output_path,
        error,
        stopped_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      nanoid(14),
      record.classId,
      record.egressId || null,
      record.status,
      record.layout,
      record.outputPath || null,
      record.error || null,
      record.stoppedAt || null,
    ],
  );
  return recordingFromRow(result.rows[0]);
};

export const updateRecording = async (
  id: string,
  patch: Partial<RecordingRecord>,
): Promise<RecordingRecord | null> => {
  if (!isPostgresEnabled) {
    const existing = recordings.get(id);
    if (!existing) {
      return null;
    }
    const updated = {...existing, ...patch};
    recordings.set(id, updated);
    return updated;
  }

  const existing = await getRecording(id);
  if (!existing) {
    return null;
  }
  const updated = {...existing, ...patch};
  const result = await query<RecordingRow>(
    `
      UPDATE recordings
      SET
        egress_id = $2,
        status = $3,
        layout = $4,
        output_path = $5,
        error = $6,
        stopped_at = $7
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      updated.egressId || null,
      updated.status,
      updated.layout,
      updated.outputPath || null,
      updated.error || null,
      updated.stoppedAt || null,
    ],
  );
  return result.rows[0] ? recordingFromRow(result.rows[0]) : null;
};

export const getRecording = async (
  id: string,
): Promise<RecordingRecord | null> => {
  if (!isPostgresEnabled) {
    return recordings.get(id) || null;
  }

  const result = await query<RecordingRow>(
    'SELECT * FROM recordings WHERE id = $1',
    [id],
  );
  return result.rows[0] ? recordingFromRow(result.rows[0]) : null;
};

export const findRecordingByEgressId = async (
  egressId: string,
): Promise<RecordingRecord | null> => {
  if (!isPostgresEnabled) {
    return (
      Array.from(recordings.values()).find(
        item => item.egressId === egressId,
      ) || null
    );
  }

  const result = await query<RecordingRow>(
    'SELECT * FROM recordings WHERE egress_id = $1',
    [egressId],
  );
  return result.rows[0] ? recordingFromRow(result.rows[0]) : null;
};

export const listRecordings = async (
  classId: string,
): Promise<RecordingRecord[]> => {
  if (!isPostgresEnabled) {
    return Array.from(recordings.values())
      .filter(recording => recording.classId === classId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  const result = await query<RecordingRow>(
    `
      SELECT *
      FROM recordings
      WHERE class_id = $1
      ORDER BY started_at DESC
    `,
    [classId],
  );
  return result.rows.map(recordingFromRow);
};

export const appendWebhookEvent = async (event: unknown) => {
  if (!isPostgresEnabled) {
    webhookEvents.push(event);
    if (webhookEvents.length > 500) {
      webhookEvents.shift();
    }
    return;
  }

  await query('INSERT INTO webhook_events (event) VALUES ($1::jsonb)', [
    JSON.stringify(event),
  ]);
  await query(`
    DELETE FROM webhook_events
    WHERE id NOT IN (
      SELECT id
      FROM webhook_events
      ORDER BY received_at DESC, id DESC
      LIMIT 500
    )
  `);
};
