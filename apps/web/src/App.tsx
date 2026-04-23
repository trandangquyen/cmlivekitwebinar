import {useEffect, useMemo, useRef, useState} from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useRoomContext,
  VideoConference,
} from '@livekit/components-react';
import {DisconnectReason, MediaDeviceFailure} from 'livekit-client';
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
import {toast} from 'sonner';
import type {
  Classroom,
  ClassroomRole,
  JoinedSession,
  PublicClassroom,
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
  toast.success('Copied to clipboard!');
};

const liveRecordingStatuses = new Set<RecordingRecord['status']>([
  'starting',
  'active',
  'stopping',
]);

const isLiveRecording = (recording: RecordingRecord) =>
  liveRecordingStatuses.has(recording.status);

const terminalRecordingStatuses = new Set<RecordingRecord['status']>([
  'complete',
  'failed',
]);

const RECORDING_TERMINAL_NOTICE_TTL_MS = 10_000;

const formatDisconnectReason = (reason?: DisconnectReason) => {
  const reasonName =
    reason === undefined
      ? 'UNKNOWN_REASON'
      : DisconnectReason[reason] || String(reason);
  const guidance: Partial<Record<DisconnectReason, string>> = {
    [DisconnectReason.JOIN_FAILURE]:
      'The browser could not finish the WebRTC join. Check LiveKit media ports and advertised IP.',
    [DisconnectReason.SIGNAL_CLOSE]:
      'The signaling connection closed before the room became active.',
    [DisconnectReason.CONNECTION_TIMEOUT]:
      'The WebRTC connection timed out before media could flow.',
    [DisconnectReason.MEDIA_FAILURE]:
      'The media connection failed after signaling connected.',
    [DisconnectReason.SERVER_SHUTDOWN]: 'The LiveKit server stopped.',
  };

  return `Disconnected from the classroom (${reasonName}). ${
    reason === undefined
      ? 'Check the browser console and LiveKit logs for the exact failure.'
      : guidance[reason] ||
        'Check the browser console and LiveKit logs for details.'
  }`;
};

const mediaDeviceLabel = (kind?: MediaDeviceKind) => {
  if (kind === 'audioinput') {
    return 'Microphone';
  }
  if (kind === 'videoinput') {
    return 'Camera';
  }
  return 'Media device';
};

const formatMediaDeviceFailure = (
  failure?: MediaDeviceFailure,
  kind?: MediaDeviceKind,
) => {
  const device = mediaDeviceLabel(kind);
  const messages: Partial<Record<MediaDeviceFailure, string>> = {
    [MediaDeviceFailure.PermissionDenied]:
      'permission was denied. Allow access in the browser permission prompt.',
    [MediaDeviceFailure.NotFound]:
      'was not found. Check that the device is connected and enabled.',
    [MediaDeviceFailure.DeviceInUse]:
      'is already in use. On Windows, another tab or app can lock the same device.',
    [MediaDeviceFailure.Other]: 'could not be started.',
  };

  return `${device} ${messages[failure || MediaDeviceFailure.Other]}`;
};

const formatRoomError = (error: Error) =>
  `LiveKit error: ${error.message || error.name || 'Unknown error.'}`;

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const [session, setSession] = useState<JoinedSession | null>(null);
  const [roomExitNotice, setRoomExitNotice] = useState('');

  useEffect(() => {
    const onPopState = () => setRoute(parseRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (path: string) => {
    setRoomExitNotice('');
    window.history.pushState(null, '', path);
    setRoute(parseRoute());
  };

  if (session) {
    return (
      <ClassroomRoom
        session={session}
        onLeave={() => {
          setRoomExitNotice('');
          setSession(null);
          navigate('/');
        }}
        onDisconnected={message => {
          setSession(null);
          setRoomExitNotice(message);
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
          notice={roomExitNotice}
          onJoined={joinedSession => {
            setRoomExitNotice('');
            setSession(joinedSession);
          }}
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
      toast.success('Class created successfully');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
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
                  onClick={() => copyText(created.links.host)}
                >
                  <Clipboard size={18} />
                  Copy host
                </button>
                <button
                  className="primary-button"
                  onClick={() =>
                    navigate(
                      `/join/${created.id}?role=host&code=${created.hostAccessCode}`,
                    )
                  }
                >
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
  notice,
  onJoined,
  onBack,
}: {
  classId: string;
  initialRole: ClassroomRole;
  initialCode: string;
  notice?: string;
  onJoined: (session: JoinedSession) => void;
  onBack: () => void;
}) {
  const [classroom, setClassroom] = useState<PublicClassroom | null>(null);
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
      .catch(err => {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        toast.error(msg);
      });
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
          toast.dismiss('waiting-toast');
          toast.success('Joined classroom');
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
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        toast.error(msg);
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
        toast.info('Waiting for host approval...', {id: 'waiting-toast'});
      } else {
        toast.success('Joined classroom');
        onJoined({
          ...result,
          accessCode,
          initialAudio,
          initialVideo,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
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
            onClick={() => setRole('student')}
          >
            Student
          </button>
          <button
            type="button"
            className={role === 'host' ? 'active' : ''}
            onClick={() => setRole('host')}
          >
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
          disabled={busy || !!waitingRequestId}
        >
          <Video size={18} />
          {waitingRequestId ? 'Waiting...' : busy ? 'Joining...' : 'Join'}
        </button>

        {waitingRequestId ? (
          <p className="notice-text">Waiting for host approval.</p>
        ) : null}
        {notice ? <p className="error-text">{notice}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </form>
    </section>
  );
}

function ClassroomRoom({
  session,
  onLeave,
  onDisconnected,
}: {
  session: JoinedSession;
  onLeave: () => void;
  onDisconnected: (message: string) => void;
}) {
  const userLeavingRef = useRef(false);
  const [roomIssue, setRoomIssue] = useState('');
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
        onConnected={() => setRoomIssue('')}
        onError={error => {
          const msg = formatRoomError(error);
          setRoomIssue(msg);
          toast.error(msg);
        }}
        onMediaDeviceFailure={(failure, kind) => {
          const msg = formatMediaDeviceFailure(failure, kind);
          setRoomIssue(msg);
          toast.error(msg);
        }}
        onDisconnected={reason => {
          if (
            userLeavingRef.current ||
            reason === DisconnectReason.CLIENT_INITIATED
          ) {
            return;
          }
          const msg = formatDisconnectReason(reason);
          toast.error(msg);
          onDisconnected(msg);
        }}
      >
        <RoomAudioRenderer />
        <ClassroomTopbar
          session={session}
          roomIssue={roomIssue}
          onLeave={() => {
            userLeavingRef.current = true;
            onLeave();
          }}
        />
        <section className="conference-surface">
          <VideoConference />
        </section>
      </LiveKitRoom>
    </div>
  );
}

function ClassroomTopbar({
  session,
  roomIssue,
  onLeave,
}: {
  session: JoinedSession;
  roomIssue: string;
  onLeave: () => void;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const [activeRecording, setActiveRecording] =
    useState<RecordingRecord | null>(null);
  const [recordings, setRecordings] = useState<RecordingRecord[]>([]);
  const [recordingError, setRecordingError] = useState('');
  const [recordingBusy, setRecordingBusy] = useState(false);
  const hiddenTerminalRecordingIdsRef = useRef(new Set<string>());
  const terminalRecordingHideTimersRef = useRef(new Map<string, number>());

  const isHost = session.role === 'host';
  const topbarMessage = roomIssue || recordingError;

  const filterVisibleRecordings = (items: RecordingRecord[]) =>
    items.filter(
      recording =>
        isLiveRecording(recording) ||
        !hiddenTerminalRecordingIdsRef.current.has(recording.id),
    );

  const refreshRecordings = async () => {
    if (!isHost) {
      return;
    }

    const result = await listRecordings(session.classId, session.accessCode);
    const visibleRecordings = filterVisibleRecordings(result.recordings);
    setRecordings(visibleRecordings);
    setActiveRecording(visibleRecordings.find(isLiveRecording) || null);
  };

  const toggleRecording = async () => {
    if (recordingBusy) {
      return;
    }

    setRecordingError('');
    setRecordingBusy(true);
    try {
      if (!activeRecording) {
        const {recording} = await startRecording({
          classId: session.classId,
          hostAccessCode: session.accessCode,
          layout: 'speaker',
        });
        setActiveRecording(isLiveRecording(recording) ? recording : null);
        toast.success('Recording started');
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
        toast.success('Recording stopped');
        await refreshRecordings();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRecordingError(msg);
      toast.error(msg);
      await refreshRecordings().catch(() => {});
    } finally {
      setRecordingBusy(false);
    }
  };

  useEffect(() => {
    refreshRecordings().catch(() => {});
    if (!isHost) {
      return;
    }

    const intervalId = window.setInterval(() => {
      refreshRecordings().catch(() => {});
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    recordings
      .filter(recording => terminalRecordingStatuses.has(recording.status))
      .forEach(recording => {
        if (hiddenTerminalRecordingIdsRef.current.has(recording.id)) {
          return;
        }
        if (terminalRecordingHideTimersRef.current.has(recording.id)) {
          return;
        }

        if (recording.status === 'complete') {
          toast.success(
            `Recording complete: ${recording.outputPath || 'Saved'}`,
          );
        } else if (recording.status === 'failed') {
          toast.error(
            `Recording failed: ${recording.error || 'Unknown error'}`,
          );
        }

        const timeoutId = window.setTimeout(() => {
          hiddenTerminalRecordingIdsRef.current.add(recording.id);
          terminalRecordingHideTimersRef.current.delete(recording.id);
          setRecordings(current =>
            current.filter(item => item.id !== recording.id),
          );
        }, RECORDING_TERMINAL_NOTICE_TTL_MS);

        terminalRecordingHideTimersRef.current.set(recording.id, timeoutId);
      });
  }, [recordings]);

  useEffect(
    () => () => {
      terminalRecordingHideTimersRef.current.forEach(timeoutId => {
        window.clearTimeout(timeoutId);
      });
      terminalRecordingHideTimersRef.current.clear();
    },
    [],
  );

  const recordingButtonDisabled =
    recordingBusy || activeRecording?.status === 'stopping';
  const recordingButtonLabel = activeRecording
    ? recordingBusy
      ? 'Stopping...'
      : activeRecording.status === 'stopping'
        ? 'Stopping...'
        : 'Stop rec'
    : recordingBusy
      ? 'Starting...'
      : 'Record';

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
              className={activeRecording ? 'danger-button' : 'secondary-button'}
              disabled={recordingButtonDisabled}
              onClick={toggleRecording}
            >
              {activeRecording ? <StopCircle size={18} /> : <Radio size={18} />}
              {recordingButtonLabel}
            </button>
          </>
        ) : null}

        <button
          className="secondary-button"
          onClick={() => {
            onLeave();
            room.disconnect();
          }}
        >
          <LogOut size={18} />
          Leave
        </button>
      </div>

      {topbarMessage ? (
        <div className="topbar-message error-text">{topbarMessage}</div>
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

  const decide = async (requestId: string, decision: 'approve' | 'reject') => {
    try {
      await decideWaitingRequest({
        classId,
        requestId,
        hostAccessCode,
        decision,
      });
      toast.success(`Request ${decision}d`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="waiting-menu">
      <button
        className="secondary-button"
        onClick={() => {
          if (pending.length === 0) {
            toast.info('No pending requests.');
            setOpen(false);
          } else {
            setOpen(!open);
          }
        }}
      >
        <Users size={18} />
        Waiting {pending.length}
      </button>

      {open && pending.length > 0 ? (
        <div className="waiting-popover">
          {pending.map(request => (
            <div className="waiting-row" key={request.id}>
              <span>{request.name}</span>
              <div>
                <button
                  className="icon-button"
                  onClick={() => decide(request.id, 'approve')}
                >
                  <Check size={17} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => decide(request.id, 'reject')}
                >
                  <X size={17} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
