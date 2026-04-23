import {nanoid} from 'nanoid';
import {config} from './config.js';
import type {
  Classroom,
  RecordingRecord,
  WaitingRequest,
  WaitingStatus,
} from './types.js';

const classes = new Map<string, Classroom>();
const waitingRequests = new Map<string, WaitingRequest>();
const recordings = new Map<string, RecordingRecord>();
const webhookEvents: unknown[] = [];

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

const accessCode = () => nanoid(10);

export const createClassroom = (input: {
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
  const classUrl = `${config.api.frontendOrigin}/join/${id}`;

  const classroom: Classroom = {
    id,
    title: input.title.trim(),
    roomName,
    hostAccessCode,
    studentAccessCode,
    waitingRoomEnabled,
    createdAt: new Date().toISOString(),
    links: {
      host: `${classUrl}?role=host&code=${hostAccessCode}`,
      student: `${classUrl}?role=student&code=${studentAccessCode}`,
    },
  };

  classes.set(id, classroom);
  return classroom;
};

export const getClassroom = (id: string) => classes.get(id) || null;

export const listClassrooms = () =>
  Array.from(classes.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

export const createWaitingRequest = (input: {
  classId: string;
  name: string;
  accessCode: string;
}): WaitingRequest => {
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
};

export const getWaitingRequest = (id: string) =>
  waitingRequests.get(id) || null;

export const listWaitingRequests = (classId: string) =>
  Array.from(waitingRequests.values())
    .filter(request => request.classId === classId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export const decideWaitingRequest = (
  requestId: string,
  status: Extract<WaitingStatus, 'approved' | 'rejected'>,
) => {
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
};

export const createRecording = (
  record: Omit<RecordingRecord, 'id' | 'startedAt'>,
) => {
  const recording: RecordingRecord = {
    ...record,
    id: nanoid(14),
    startedAt: new Date().toISOString(),
  };
  recordings.set(recording.id, recording);
  return recording;
};

export const updateRecording = (
  id: string,
  patch: Partial<RecordingRecord>,
) => {
  const existing = recordings.get(id);
  if (!existing) {
    return null;
  }
  const updated = {...existing, ...patch};
  recordings.set(id, updated);
  return updated;
};

export const getRecording = (id: string) => recordings.get(id) || null;

export const findRecordingByEgressId = (egressId: string) =>
  Array.from(recordings.values()).find(item => item.egressId === egressId) ||
  null;

export const listRecordings = (classId: string) =>
  Array.from(recordings.values())
    .filter(recording => recording.classId === classId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

export const appendWebhookEvent = (event: unknown) => {
  webhookEvents.push(event);
  if (webhookEvents.length > 500) {
    webhookEvents.shift();
  }
};
