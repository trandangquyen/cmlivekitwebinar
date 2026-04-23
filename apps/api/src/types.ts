export type ClassroomRole = 'host' | 'student';

export type WaitingStatus = 'pending' | 'approved' | 'rejected';

export type RecordingStatus =
  | 'starting'
  | 'active'
  | 'stopping'
  | 'complete'
  | 'failed';

export interface Classroom {
  id: string;
  title: string;
  roomName: string;
  hostAccessCode: string;
  studentAccessCode: string;
  waitingRoomEnabled: boolean;
  createdAt: string;
  links: {
    host: string;
    student: string;
  };
}

export interface WaitingRequest {
  id: string;
  classId: string;
  role: 'student';
  name: string;
  accessCode: string;
  status: WaitingStatus;
  createdAt: string;
  decidedAt?: string;
}

export interface RecordingRecord {
  id: string;
  classId: string;
  egressId?: string;
  status: RecordingStatus;
  layout: 'speaker' | 'grid';
  outputPath?: string;
  error?: string;
  startedAt: string;
  stoppedAt?: string;
}

export interface ParticipantJoinPayload {
  status: 'joined';
  classId: string;
  title: string;
  role: ClassroomRole;
  participantName: string;
  livekitUrl: string;
  roomName: string;
  participantToken: string;
  permissions: {
    canPublish: boolean;
    canSubscribe: boolean;
    canPublishData: boolean;
    roomAdmin: boolean;
    roomRecord: boolean;
  };
}

export interface WaitingJoinPayload {
  status: 'waiting';
  requestId: string;
  pollUrl: string;
}
