export type ClassroomRole = 'host' | 'student';

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
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  decidedAt?: string;
}

export interface RecordingRecord {
  id: string;
  classId: string;
  egressId?: string;
  status: 'starting' | 'active' | 'stopping' | 'complete' | 'failed';
  layout: 'speaker' | 'grid';
  outputPath?: string;
  error?: string;
  startedAt: string;
  stoppedAt?: string;
}

export interface JoinedSession {
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
  accessCode: string;
  initialAudio: boolean;
  initialVideo: boolean;
}

export interface WaitingJoin {
  status: 'waiting';
  requestId: string;
  pollUrl: string;
}

export type JoinResponse =
  | Omit<JoinedSession, 'accessCode' | 'initialAudio' | 'initialVideo'>
  | WaitingJoin;
