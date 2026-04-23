import cors from 'cors';
import express from 'express';
import {z} from 'zod';
import {config} from './config.js';
import {
  appendWebhookEvent,
  createClassroom,
  createWaitingRequest,
  decideWaitingRequest,
  findRecordingByEgressId,
  getClassroom,
  getWaitingRequest,
  listClassrooms,
  listRecordings,
  listWaitingRequests,
  updateRecording,
} from './store.js';
import {runAutoMigrations} from './migrations.js';
import {startRoomRecording, stopRoomRecording} from './recordings.js';
import {buildParticipantJoinPayload} from './tokens.js';
import type {ClassroomRole} from './types.js';

const app = express();

app.use(
  cors({
    origin: config.api.frontendOrigin,
    credentials: true,
  }),
);
app.use(express.json({limit: '1mb'}));

const asyncHandler =
  (handler: express.RequestHandler): express.RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

const createClassSchema = z.object({
  title: z.string().trim().min(2).max(120),
  waitingRoomEnabled: z.boolean().optional(),
});

const joinSchema = z.object({
  name: z.string().trim().min(1).max(80),
  role: z.enum(['host', 'student']),
  accessCode: z.string().trim().min(4),
});

const waitingDecisionSchema = z.object({
  hostAccessCode: z.string().trim().min(4),
  decision: z.enum(['approve', 'reject']),
});

const recordingStartSchema = z.object({
  hostAccessCode: z.string().trim().min(4),
  layout: z.enum(['speaker', 'grid']).default('speaker'),
});

const recordingStopSchema = z.object({
  hostAccessCode: z.string().trim().min(4),
  recordingId: z.string().trim().min(1),
});

const assertHostCode = async (classId: string, code: string) => {
  const classroom = await getClassroom(classId);
  if (!classroom) {
    throw Object.assign(new Error('Class not found.'), {statusCode: 404});
  }
  if (classroom.hostAccessCode !== code) {
    throw Object.assign(new Error('Invalid host access code.'), {
      statusCode: 403,
    });
  }
  return classroom;
};

const paramValue = (
  value: string | string[] | undefined,
  name: string,
): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  throw Object.assign(new Error(`Missing route parameter: ${name}.`), {
    statusCode: 400,
  });
};

const assertAccessCode = async (
  classId: string,
  role: ClassroomRole,
  code: string,
) => {
  const classroom = await getClassroom(classId);
  if (!classroom) {
    throw Object.assign(new Error('Class not found.'), {statusCode: 404});
  }
  const expected =
    role === 'host' ? classroom.hostAccessCode : classroom.studentAccessCode;
  if (expected !== code) {
    throw Object.assign(new Error('Invalid class access code.'), {
      statusCode: 403,
    });
  }
  return classroom;
};

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    dataStore: config.database.provider,
    livekitUrl: config.livekit.wsUrl,
    time: new Date().toISOString(),
  });
});

app.get(
  '/api/classes',
  asyncHandler(async (_req, res) => {
    res.json({classes: await listClassrooms()});
  }),
);

app.post(
  '/api/classes',
  asyncHandler(async (req, res) => {
    const input = createClassSchema.parse(req.body);
    const classroom = await createClassroom(input);
    res.status(201).json({classroom});
  }),
);

app.get(
  '/api/classes/:classId',
  asyncHandler(async (req, res) => {
    const classroom = await getClassroom(
      paramValue(req.params.classId, 'classId'),
    );
    if (!classroom) {
      res.status(404).json({error: 'Class not found.'});
      return;
    }
    res.json({classroom});
  }),
);

app.post(
  '/api/classes/:classId/join',
  asyncHandler(async (req, res) => {
    const input = joinSchema.parse(req.body);
    const classroom = await assertAccessCode(
      paramValue(req.params.classId, 'classId'),
      input.role,
      input.accessCode,
    );

    if (input.role === 'student' && classroom.waitingRoomEnabled) {
      const request = await createWaitingRequest({
        classId: classroom.id,
        name: input.name,
        accessCode: input.accessCode,
      });
      res.status(202).json({
        status: 'waiting',
        requestId: request.id,
        pollUrl: `${config.api.publicApiBaseUrl}/api/join-requests/${request.id}`,
      });
      return;
    }

    const payload = await buildParticipantJoinPayload({
      classroom,
      role: input.role,
      participantName: input.name,
    });
    res.json(payload);
  }),
);

app.get(
  '/api/join-requests/:requestId',
  asyncHandler(async (req, res) => {
    const request = await getWaitingRequest(
      paramValue(req.params.requestId, 'requestId'),
    );
    if (!request) {
      res.status(404).json({error: 'Join request not found.'});
      return;
    }
    if (request.status === 'pending') {
      res.json({status: 'waiting', requestId: request.id});
      return;
    }
    if (request.status === 'rejected') {
      res.status(403).json({status: 'rejected'});
      return;
    }
    const classroom = await getClassroom(request.classId);
    if (!classroom) {
      res.status(404).json({error: 'Class not found.'});
      return;
    }
    const payload = await buildParticipantJoinPayload({
      classroom,
      role: 'student',
      participantName: request.name,
    });
    res.json(payload);
  }),
);

app.get(
  '/api/classes/:classId/waiting',
  asyncHandler(async (req, res) => {
    const classroom = await assertHostCode(
      paramValue(req.params.classId, 'classId'),
      String(req.query.hostAccessCode || ''),
    );
    res.json({
      classId: classroom.id,
      requests: await listWaitingRequests(classroom.id),
    });
  }),
);

app.post(
  '/api/classes/:classId/waiting/:requestId',
  asyncHandler(async (req, res) => {
    const input = waitingDecisionSchema.parse(req.body);
    const classroom = await assertHostCode(
      paramValue(req.params.classId, 'classId'),
      input.hostAccessCode,
    );
    const request = await getWaitingRequest(
      paramValue(req.params.requestId, 'requestId'),
    );
    if (!request || request.classId !== classroom.id) {
      res.status(404).json({error: 'Join request not found.'});
      return;
    }
    const updated = await decideWaitingRequest(
      request.id,
      input.decision === 'approve' ? 'approved' : 'rejected',
    );
    res.json({request: updated});
  }),
);

app.post(
  '/api/classes/:classId/recordings/start',
  asyncHandler(async (req, res) => {
    const input = recordingStartSchema.parse(req.body);
    const classroom = await assertHostCode(
      paramValue(req.params.classId, 'classId'),
      input.hostAccessCode,
    );
    const recording = await startRoomRecording(classroom, input.layout);
    res.status(202).json({recording});
  }),
);

app.post(
  '/api/classes/:classId/recordings/stop',
  asyncHandler(async (req, res) => {
    const input = recordingStopSchema.parse(req.body);
    const classroom = await assertHostCode(
      paramValue(req.params.classId, 'classId'),
      input.hostAccessCode,
    );
    const recording = await stopRoomRecording({
      classroom,
      recordingId: input.recordingId,
    });
    res.json({recording});
  }),
);

app.get(
  '/api/classes/:classId/recordings',
  asyncHandler(async (req, res) => {
    const classroom = await assertHostCode(
      paramValue(req.params.classId, 'classId'),
      String(req.query.hostAccessCode || ''),
    );
    res.json({recordings: await listRecordings(classroom.id)});
  }),
);

app.post(
  '/api/livekit/webhook',
  asyncHandler(async (req, res) => {
    await appendWebhookEvent(req.body);
    const event = req.body as {
      egress_info?: {egress_id?: string; status?: string; error?: string};
    };
    const egressId = event.egress_info?.egress_id;
    if (egressId) {
      const recording = await findRecordingByEgressId(egressId);
      if (recording) {
        const status = String(event.egress_info?.status || '').toLowerCase();
        await updateRecording(recording.id, {
          status:
            status.includes('failed') || event.egress_info?.error
              ? 'failed'
              : status.includes('complete') || status.includes('ended')
              ? 'complete'
              : recording.status,
          error: event.egress_info?.error,
          stoppedAt:
            status.includes('complete') || status.includes('failed')
              ? new Date().toISOString()
              : recording.stoppedAt,
        });
      }
    }
    res.json({ok: true});
  }),
);

app.use(
  (
    error: Error & {statusCode?: number},
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof z.ZodError) {
      res.status(400).json({error: 'Invalid request.', details: error.issues});
      return;
    }
    res.status(error.statusCode || 500).json({
      error: error.message || 'Internal server error.',
    });
  },
);

await runAutoMigrations();

app.listen(config.api.port, () => {
  console.log(
    `Classroom API listening on http://localhost:${config.api.port}`,
  );
  console.log(`LiveKit target: ${config.livekit.wsUrl}`);
  console.log(`Data store: ${config.database.provider}`);
});
