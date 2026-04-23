import cors from 'cors';
import express from 'express';
import {WebhookReceiver} from 'livekit-server-sdk';
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
import {
  recordingPatchFromEgressInfo,
  startRoomRecording,
  stopRoomRecording,
  syncRecordingArtifacts,
} from './recordings.js';
import {buildParticipantJoinPayload} from './tokens.js';
import type {Classroom, ClassroomRole} from './types.js';

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

type PublicClassroom = Pick<
  Classroom,
  'id' | 'title' | 'waitingRoomEnabled' | 'createdAt'
>;

type LiveKitWebhookEvent = {
  egress_info?: {egress_id?: string; status?: string; error?: string};
};

const livekitWebhookReceiver = new WebhookReceiver(
  config.livekit.apiKey,
  config.livekit.apiSecret,
);

const asyncHandler =
  (handler: express.RequestHandler): express.RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

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

const toPublicClassroom = (classroom: Classroom): PublicClassroom => ({
  id: classroom.id,
  title: classroom.title,
  waitingRoomEnabled: classroom.waitingRoomEnabled,
  createdAt: classroom.createdAt,
});

const parseWebhookPayload = (body: unknown): LiveKitWebhookEvent => {
  if (Buffer.isBuffer(body)) {
    const rawBody = body.toString('utf8');
    if (!rawBody) {
      return {};
    }
    try {
      return JSON.parse(rawBody) as LiveKitWebhookEvent;
    } catch {
      throw Object.assign(new Error('Invalid webhook payload.'), {
        statusCode: 400,
      });
    }
  }
  if (typeof body === 'string') {
    if (!body.trim()) {
      return {};
    }
    try {
      return JSON.parse(body) as LiveKitWebhookEvent;
    } catch {
      throw Object.assign(new Error('Invalid webhook payload.'), {
        statusCode: 400,
      });
    }
  }
  if (body && typeof body === 'object') {
    return body as LiveKitWebhookEvent;
  }
  return {};
};

const receiveWebhookEvent = async (
  req: express.Request,
): Promise<LiveKitWebhookEvent> => {
  if (!config.livekit.verifyWebhooks) {
    return parseWebhookPayload(req.body);
  }

  const rawBody = Buffer.isBuffer(req.body)
    ? req.body.toString('utf8')
    : typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body || {});
  try {
    return (await livekitWebhookReceiver.receive(
      rawBody,
      req.header('Authorization') || '',
    )) as LiveKitWebhookEvent;
  } catch {
    throw Object.assign(new Error('Invalid LiveKit webhook signature.'), {
      statusCode: 401,
    });
  }
};

export const createApp = () => {
  const app = express();

  app.use(
    cors({
      origin: config.api.frontendOrigin,
      credentials: true,
    }),
  );

  app.post(
    '/api/livekit/webhook',
    express.raw({
      type: ['application/webhook+json', 'application/json'],
      limit: '1mb',
    }),
    asyncHandler(async (req, res) => {
      const event = await receiveWebhookEvent(req);
      const egressId = event.egress_info?.egress_id;
      if (egressId) {
        const recording = await findRecordingByEgressId(egressId);
        if (recording) {
          await updateRecording(recording.id, {
            ...recordingPatchFromEgressInfo(
              event.egress_info || {},
              recording.status,
            ),
          });
        }
      }
      res.json({ok: true});
      void appendWebhookEvent(event).catch(error => {
        console.error('Failed to persist LiveKit webhook event', error);
      });
    }),
  );
  app.use(express.json({limit: '1mb'}));

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
      const classes = await listClassrooms();
      res.json({classes: classes.map(toPublicClassroom)});
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
      res.json({classroom: toPublicClassroom(classroom)});
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
      const recordings = await listRecordings(classroom.id);
      const syncedRecordings = await Promise.all(
        recordings.map(recording => syncRecordingArtifacts(recording)),
      );
      res.json({recordings: syncedRecordings});
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
        res
          .status(400)
          .json({error: 'Invalid request.', details: error.issues});
        return;
      }
      res.status(error.statusCode || 500).json({
        error: error.message || 'Internal server error.',
      });
    },
  );

  return app;
};
