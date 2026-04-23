import type {
  Classroom,
  ClassroomRole,
  JoinResponse,
  PublicClassroom,
  RecordingRecord,
  WaitingRequest,
} from './types';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4300';

const request = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed.');
  }
  return payload as T;
};

export const createClassroom = (input: {
  title: string;
  waitingRoomEnabled: boolean;
}) =>
  request<{classroom: Classroom}>('/api/classes', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const getClassroom = (classId: string) =>
  request<{classroom: PublicClassroom}>(`/api/classes/${classId}`);

export const joinClassroom = (input: {
  classId: string;
  name: string;
  role: ClassroomRole;
  accessCode: string;
}) =>
  request<JoinResponse>(`/api/classes/${input.classId}/join`, {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      role: input.role,
      accessCode: input.accessCode,
    }),
  });

export const pollJoinRequest = (requestId: string) =>
  request<JoinResponse>(`/api/join-requests/${requestId}`);

export const listWaitingRequests = (classId: string, hostAccessCode: string) =>
  request<{requests: WaitingRequest[]}>(
    `/api/classes/${classId}/waiting?hostAccessCode=${encodeURIComponent(
      hostAccessCode,
    )}`,
  );

export const decideWaitingRequest = (input: {
  classId: string;
  requestId: string;
  hostAccessCode: string;
  decision: 'approve' | 'reject';
}) =>
  request<{request: WaitingRequest}>(
    `/api/classes/${input.classId}/waiting/${input.requestId}`,
    {
      method: 'POST',
      body: JSON.stringify({
        hostAccessCode: input.hostAccessCode,
        decision: input.decision,
      }),
    },
  );

export const startRecording = (input: {
  classId: string;
  hostAccessCode: string;
  layout: 'speaker' | 'grid';
}) =>
  request<{recording: RecordingRecord}>(
    `/api/classes/${input.classId}/recordings/start`,
    {
      method: 'POST',
      body: JSON.stringify({
        hostAccessCode: input.hostAccessCode,
        layout: input.layout,
      }),
    },
  );

export const stopRecording = (input: {
  classId: string;
  hostAccessCode: string;
  recordingId: string;
}) =>
  request<{recording: RecordingRecord}>(
    `/api/classes/${input.classId}/recordings/stop`,
    {
      method: 'POST',
      body: JSON.stringify({
        hostAccessCode: input.hostAccessCode,
        recordingId: input.recordingId,
      }),
    },
  );

export const listRecordings = (classId: string, hostAccessCode: string) =>
  request<{recordings: RecordingRecord[]}>(
    `/api/classes/${classId}/recordings?hostAccessCode=${encodeURIComponent(
      hostAccessCode,
    )}`,
  );
