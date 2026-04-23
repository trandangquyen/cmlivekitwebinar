import {config} from './config.js';
import {createRecording, getRecording, updateRecording} from './store.js';
import {buildRoomRecordToken} from './tokens.js';
import type {Classroom, RecordingRecord} from './types.js';

class EgressRpcError extends Error {
  constructor(
    readonly method: 'StartRoomCompositeEgress' | 'StopEgress',
    readonly statusCode: number,
    readonly payload: Record<string, unknown>,
  ) {
    super(`LiveKit Egress ${method} failed: ${JSON.stringify(payload)}`);
    this.name = 'EgressRpcError';
  }
}

const safePathPart = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

const egressRpc = async (
  method: 'StartRoomCompositeEgress' | 'StopEgress',
  token: string,
  body: Record<string, unknown>,
) => {
  const response = await fetch(
    `${config.livekit.httpUrl}/twirp/livekit.Egress/${method}`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    throw new EgressRpcError(method, response.status, payload);
  }
  return payload;
};

const terminalRecordingStatuses = new Set<RecordingRecord['status']>([
  'complete',
  'failed',
]);

const egressTerminalStatusFromStopError = (
  error: unknown,
): RecordingRecord['status'] | null => {
  if (
    !(error instanceof EgressRpcError) ||
    error.method !== 'StopEgress'
  ) {
    return null;
  }

  if (error.payload.code === 'not_found') {
    return 'failed';
  }
  if (error.payload.code !== 'failed_precondition') {
    return null;
  }

  const message = String(error.payload.msg || '');
  if (!message.toLowerCase().includes('cannot be stopped')) {
    return null;
  }

  const status = message.match(/status\s+(EGRESS_[A-Z_]+)/i)?.[1];
  if (status === 'EGRESS_COMPLETE') {
    return 'complete';
  }
  if (status === 'EGRESS_FAILED' || status === 'EGRESS_ABORTED') {
    return 'failed';
  }

  return null;
};

const egressErrorMessage = (error: unknown) =>
  error instanceof EgressRpcError
    ? String(error.payload.msg || error.message)
    : error instanceof Error
      ? error.message
      : String(error);

const buildFileOutput = (classroom: Classroom) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const title = safePathPart(classroom.title) || 'classroom';
  const filepath = `${config.recording.localPrefix}/${classroom.id}/${timestamp}-${title}.mp4`;

  if (config.recording.outputMode === 's3') {
    const {s3} = config.recording;
    if (!s3.accessKey || !s3.secret || !s3.bucket) {
      throw new Error(
        'S3 recording output requires S3_ACCESS_KEY, S3_SECRET, and S3_BUCKET.',
      );
    }

    return {
      file_type: 'MP4',
      filepath: `${classroom.id}/${timestamp}-${title}.mp4`,
      s3: {
        access_key: s3.accessKey,
        secret: s3.secret,
        bucket: s3.bucket,
        region: s3.region,
        endpoint: s3.endpoint || undefined,
        force_path_style: s3.forcePathStyle,
      },
    };
  }

  return {
    file_type: 'MP4',
    filepath,
  };
};

export const startRoomRecording = async (
  classroom: Classroom,
  layout: RecordingRecord['layout'] = 'speaker',
) => {
  const fileOutput = buildFileOutput(classroom);
  const recording = await createRecording({
    classId: classroom.id,
    status: 'starting',
    layout,
    outputPath: String(fileOutput.filepath || ''),
  });

  try {
    const token = await buildRoomRecordToken(classroom);
    const result = await egressRpc('StartRoomCompositeEgress', token, {
      room_name: classroom.roomName,
      layout,
      file_outputs: [fileOutput],
    });
    return await updateRecording(recording.id, {
      status: 'active',
      egressId: String(result.egress_id || result.egressId || ''),
    });
  } catch (error) {
    await updateRecording(recording.id, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      stoppedAt: new Date().toISOString(),
    });
    throw error;
  }
};

export const stopRoomRecording = async (input: {
  classroom: Classroom;
  recordingId: string;
}) => {
  const recording = await getRecording(input.recordingId);
  if (!recording || recording.classId !== input.classroom.id) {
    throw new Error('Recording not found for this class.');
  }
  if (terminalRecordingStatuses.has(recording.status)) {
    return recording;
  }
  if (!recording.egressId) {
    throw new Error('Recording has no Egress id yet.');
  }

  await updateRecording(recording.id, {status: 'stopping'});
  const token = await buildRoomRecordToken(input.classroom);
  try {
    await egressRpc('StopEgress', token, {
      egress_id: recording.egressId,
    });
  } catch (error) {
    const terminalStatus = egressTerminalStatusFromStopError(error);
    const updated = await updateRecording(recording.id, {
      status: terminalStatus || recording.status,
      error:
        terminalStatus === 'failed'
          ? egressErrorMessage(error)
          : recording.error,
      stoppedAt: terminalStatus
        ? recording.stoppedAt || new Date().toISOString()
        : recording.stoppedAt,
    });

    if (terminalStatus && updated) {
      return updated;
    }
    throw error;
  }

  return await updateRecording(recording.id, {
    status: 'complete',
    stoppedAt: new Date().toISOString(),
  });
};
