import {config} from './config.js';
import {
  createRecording,
  getRecording,
  updateRecording,
} from './store.js';
import {buildRoomRecordToken} from './tokens.js';
import type {Classroom, RecordingRecord} from './types.js';

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
    throw new Error(
      `LiveKit Egress ${method} failed: ${JSON.stringify(payload)}`,
    );
  }
  return payload;
};

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
  if (!recording.egressId) {
    throw new Error('Recording has no Egress id yet.');
  }

  await updateRecording(recording.id, {status: 'stopping'});
  const token = await buildRoomRecordToken(input.classroom);
  await egressRpc('StopEgress', token, {
    egress_id: recording.egressId,
  });

  return await updateRecording(recording.id, {
    status: 'complete',
    stoppedAt: new Date().toISOString(),
  });
};
