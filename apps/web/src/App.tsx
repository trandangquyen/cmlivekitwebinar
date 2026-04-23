import {useEffect, useMemo, useState} from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useRoomContext,
  VideoConference,
} from '@livekit/components-react';
import {
  Check,
  Clipboard,
  LogOut,
  Radio,
  ShieldCheck,
  StopCircle,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  createClassroom,
  decideWaitingRequest,
  getClassroom,
  joinClassroom,
  listRecordings,
  listWaitingRequests,
  pollJoinRequest,
  startRecording,
  stopRecording,
} from './api';
import type {
  Classroom,
  ClassroomRole,
  JoinedSession,
  RecordingRecord,
  WaitingRequest,
} from './types';

type Route =
  | {name: 'home'}
  | {name: 'join'; classId: string; role?: ClassroomRole; code?: string};

const parseRoute = (): Route => {
  const url = new URL(window.location.href);
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'join' && parts[1]) {
    const rawRole = url.searchParams.get('role') || undefined;
    const role =
      rawRole === 'host' || rawRole === 'student' ? rawRole : undefined;
    return {
      name: 'join',
      classId: parts[1],
      role,
      code: url.searchParams.get('code') || undefined,
    };
  }
  return {name: 'home'};
};

const copyText = async (value: string) => {
  await navigator.clipboard.writeText(value);
};

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const [session, setSession] = useState<JoinedSession | null>(null);

  useEffect(() => {
    const onPopState = () => setRoute(parseRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState(null, '', path);
    setRoute(parseRoute());
  };

  if (session) {
    return (
      <ClassroomRoom
        session={session}
        onLeave={() => {
          setSession(null);
          navigate('/');
        }}
      />
    );
  }

  return (
    <main className="app-shell">
      {route.name === 'join' ? (
        <JoinPage
          classId={route.classId}
          initialRole={route.role || 'student'}
          initialCode={route.code || ''}
          onJoined={setSession}
          onBack={() => navigate('/')}
        />
      ) : (
        <HomePage navigate={navigate} />
      )}
    </main>
  );
}

function HomePage({navigate}: {navigate: (path: string) => void}) {
  const [title, setTitle] = useState('Demo English Class');
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(true);
  const [created, setCreated] = useState<Classroom | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const {classroom} = await createClassroom({title, waitingRoomEnabled});
      setCreated(classroom);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="home-layout">
      <div className="brand-band">
        <div>
          <p className="eyebrow">Self-hosted WebRTC classroom</p>
          <h1>LiveKit Classroom</h1>
        </div>
        <div className="status-pill">
          <ShieldCheck size={18} />
          Open-source SFU
        </div>
      </div>

      <div className="workspace-grid">
        <form className="panel form-panel" onSubmit={submit}>
          <label>
            Class title
            <input
              value={title}
              onChange={event => setTitle(event.target.value)}
              minLength={2}
              maxLength={120}
              required
            />
          </label>

          <label className="inline-toggle">
            <input
              type="checkbox"
              checked={waitingRoomEnabled}
              onChange={event => setWaitingRoomEnabled(event.target.checked)}
            />
            Waiting room
          </label>

          <button className="primary-button" type="submit" disabled={busy}>
            <Video size={18} />
            {busy ? 'Creating...' : 'Create class'}
          </button>

          {error ? <p className="error-text">{error}</p> : null}
        </form>

        <div className="panel links-panel">
          {created ? (
            <>
              <div className="class-created">
                <p className="eyebrow">Class ready</p>
                <h2>{created.title}</h2>
              </div>

              <LinkRow label="Host link" value={created.links.host} />
              <LinkRow label="Student link" value={created.links.student} />

              <div className="button-row">
                <button
                  className="secondary-button"
                  onClick={() => copyText(created.links.host)}>
                  <Clipboard size={18} />
                  Copy host
                </button>
                <button
                  className="primary-button"
                  onClick={() =>
                    navigate(
                      `/join/${created.id}?role=host&code=${created.hostAccessCode}`,
                    )
                  }>
                  <Video size={18} />
                  Enter class
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Users size={28} />
              <h2>Create a class</h2>
              <p>Host and student links appear here.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function LinkRow({label, value}: {label: string; value: string}) {
  return (
    <div className="link-row">
      <span>{label}</span>
      <input readOnly value={value} />
      <button className="icon-button" onClick={() => copyText(value)}>
        <Clipboard size={18} />
      </button>
    </div>
  );
}

function JoinPage({
  classId,
  initialRole,
  initialCode,
  onJoined,
  onBack,
}: {
  classId: string;
  initialRole: ClassroomRole;
  initialCode: string;
  onJoined: (session: JoinedSession) => void;
  onBack: () => void;
}) {
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState<ClassroomRole>(initialRole);
  const [accessCode, setAccessCode] = useState(initialCode);
  const [initialAudio, setInitialAudio] = useState(true);
  const [initialVideo, setInitialVideo] = useState(true);
  const [waitingRequestId, setWaitingRequestId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getClassroom(classId)
      .then(({classroom}) => setClassroom(classroom))
      .catch(err => setError(err instanceof Error ? err.message : String(err)));
  }, [classId]);

  useEffect(() => {
    if (!waitingRequestId) {
      return;
    }
    const timer = window.setInterval(async () => {
      try {
        const result = await pollJoinRequest(waitingRequestId);
        if (result.status === 'joined') {
          window.clearInterval(timer);
          onJoined({
            ...result,
            accessCode,
            initialAudio,
            initialVideo,
          });
        }
      } catch (err) {
        window.clearInterval(timer);
        setWaitingRequestId('');
        setError(err instanceof Error ? err.message : String(err));
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [accessCode, initialAudio, initialVideo, onJoined, waitingRequestId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setWaitingRequestId('');
    try {
      const result = await joinClassroom({
        classId,
        name,
        role,
        accessCode,
      });
      if (result.status === 'waiting') {
        setWaitingRequestId(result.requestId);
      } else {
        onJoined({
          ...result,
          accessCode,
          initialAudio,
          initialVideo,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="join-layout">
      <button className="text-button" onClick={onBack}>
        Back
      </button>

      <form className="panel join-panel" onSubmit={submit}>
        <p className="eyebrow">Join class</p>
        <h1>{classroom?.title || 'Classroom'}</h1>

        <label>
          Display name
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            required
            autoFocus
          />
        </label>

        <div className="segmented">
          <button
            type="button"
            className={role === 'student' ? 'active' : ''}
            onClick={() => setRole('student')}>
            Student
          </button>
          <button
            type="button"
            className={role === 'host' ? 'active' : ''}
            onClick={() => setRole('host')}>
            Host
          </button>
        </div>

        <label>
          Access code
          <input
            value={accessCode}
            onChange={event => setAccessCode(event.target.value)}
            required
          />
        </label>

        <div className="device-row">
          <label className="inline-toggle">
            <input
              type="checkbox"
              checked={initialAudio}
              onChange={event => setInitialAudio(event.target.checked)}
            />
            Mic
          </label>
          <label className="inline-toggle">
            <input
              type="checkbox"
              checked={initialVideo}
              onChange={event => setInitialVideo(event.target.checked)}
            />
            Camera
          </label>
        </div>

        <button
          className="primary-button"
          type="submit"
          disabled={busy || !!waitingRequestId}>
          <Video size={18} />
          {waitingRequestId ? 'Waiting...' : busy ? 'Joining...' : 'Join'}
        </button>

        {waitingRequestId ? (
          <p className="notice-text">Waiting for host approval.</p>
        ) : null}
        {error ? <p className="error-text">{error}</p> : null}
      </form>
    </section>
  );
}

function ClassroomRoom({
  session,
  onLeave,
}: {
  session: JoinedSession;
  onLeave: () => void;
}) {
  const roomOptions = useMemo(
    () =>
      ({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          simulcast: true,
          videoEncoding: {
            maxBitrate: 700_000,
            maxFramerate: 24,
          },
          screenShareEncoding: {
            maxBitrate: 2_500_000,
            maxFramerate: 15,
          },
        },
      }) as never,
    [],
  );

  return (
    <div className="classroom-shell">
      <LiveKitRoom
        token={session.participantToken}
        serverUrl={session.livekitUrl}
        connect
        audio={session.initialAudio}
        video={session.initialVideo}
        options={roomOptions}
        onDisconnected={onLeave}>
        <RoomAudioRenderer />
        <ClassroomTopbar session={session} onLeave={onLeave} />
        <section className="conference-surface">
          <VideoConference />
        </section>
      </LiveKitRoom>
    </div>
  );
}

function ClassroomTopbar({
  session,
  onLeave,
}: {
  session: JoinedSession;
  onLeave: () => void;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const [activeRecording, setActiveRecording] =
    useState<RecordingRecord | null>(null);
  const [recordings, setRecordings] = useState<RecordingRecord[]>([]);
  const [recordingError, setRecordingError] = useState('');

  const isHost = session.role === 'host';

  const refreshRecordings = async () => {
    if (!isHost) {
      return;
    }
    const result = await listRecordings(session.classId, session.accessCode);
    setRecordings(result.recordings);
  };

  const toggleRecording = async () => {
    setRecordingError('');
    try {
      if (!activeRecording) {
        const {recording} = await startRecording({
          classId: session.classId,
          hostAccessCode: session.accessCode,
          layout: 'speaker',
        });
        setActiveRecording(recording);
        await refreshRecordings();
      } else {
        const {recording} = await stopRecording({
          classId: session.classId,
          hostAccessCode: session.accessCode,
          recordingId: activeRecording.id,
        });
        setActiveRecording(null);
        setRecordings(current =>
          current.map(item => (item.id === recording.id ? recording : item)),
        );
      }
    } catch (err) {
      setRecordingError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    refreshRecordings().catch(() => {});
  }, []);

  return (
    <header className="classroom-topbar">
      <div className="room-title">
        <span className="live-dot" />
        <div>
          <strong>{session.title}</strong>
          <span>{session.role}</span>
        </div>
      </div>

      <div className="topbar-actions">
        <span className="participant-count">
          <Users size={18} />
          {participants.length}
        </span>

        {isHost ? (
          <>
            <WaitingHostPanel
              classId={session.classId}
              hostAccessCode={session.accessCode}
            />
            <button
              className={
                activeRecording ? 'danger-button' : 'secondary-button'
              }
              onClick={toggleRecording}>
              {activeRecording ? <StopCircle size={18} /> : <Radio size={18} />}
              {activeRecording ? 'Stop rec' : 'Record'}
            </button>
          </>
        ) : null}

        <button
          className="secondary-button"
          onClick={() => {
            room.disconnect();
            onLeave();
          }}>
          <LogOut size={18} />
          Leave
        </button>
      </div>

      {recordingError ? (
        <div className="topbar-message error-text">{recordingError}</div>
      ) : null}
      {isHost && recordings.length ? (
        <div className="recording-list">
          {recordings.slice(0, 3).map(recording => (
            <span key={recording.id}>
              {recording.status}
              {recording.outputPath ? `: ${recording.outputPath}` : ''}
            </span>
          ))}
        </div>
      ) : null}
    </header>
  );
}

function WaitingHostPanel({
  classId,
  hostAccessCode,
}: {
  classId: string;
  hostAccessCode: string;
}) {
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<WaitingRequest[]>([]);
  const pending = requests.filter(request => request.status === 'pending');

  const refresh = async () => {
    const result = await listWaitingRequests(classId, hostAccessCode);
    setRequests(result.requests);
  };

  useEffect(() => {
    refresh().catch(() => {});
    const timer = window.setInterval(() => refresh().catch(() => {}), 2500);
    return () => window.clearInterval(timer);
  }, [classId, hostAccessCode]);

  const decide = async (
    requestId: string,
    decision: 'approve' | 'reject',
  ) => {
    await decideWaitingRequest({
      classId,
      requestId,
      hostAccessCode,
      decision,
    });
    await refresh();
  };

  return (
    <div className="waiting-menu">
      <button className="secondary-button" onClick={() => setOpen(!open)}>
        <Users size={18} />
        Waiting {pending.length}
      </button>

      {open ? (
        <div className="waiting-popover">
          {pending.length ? (
            pending.map(request => (
              <div className="waiting-row" key={request.id}>
                <span>{request.name}</span>
                <div>
                  <button
                    className="icon-button"
                    onClick={() => decide(request.id, 'approve')}>
                    <Check size={17} />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => decide(request.id, 'reject')}>
                    <X size={17} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="muted-text">No pending requests.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
