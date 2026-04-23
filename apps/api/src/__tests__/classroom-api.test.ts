import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createApp} from '../app.js';
import {
  config,
  getDeploymentConfigIssues,
  validateDeploymentConfig,
  type AppConfig,
} from '../config.js';
import {recordingPatchFromLocalManifest} from '../recordings.js';
import {resetMemoryStore} from '../store.js';

const app = createApp();

beforeEach(() => {
  resetMemoryStore();
  vi.unstubAllGlobals();
});

describe('classroom API', () => {
  it('creates a class and returns host and student links', async () => {
    const response = await request(app)
      .post('/api/classes')
      .send({title: 'Production Readiness Class', waitingRoomEnabled: true})
      .expect(201);

    expect(response.body.classroom).toMatchObject({
      title: 'Production Readiness Class',
      waitingRoomEnabled: true,
    });
    expect(response.body.classroom.hostAccessCode).toHaveLength(10);
    expect(response.body.classroom.studentAccessCode).toHaveLength(10);
    expect(response.body.classroom.links.host).toContain('/join/');
    expect(response.body.classroom.links.student).toContain('/join/');
  });

  it('does not expose access codes from public class read endpoints', async () => {
    const created = await request(app)
      .post('/api/classes')
      .send({title: 'Security Class', waitingRoomEnabled: true})
      .expect(201);
    const classroom = created.body.classroom;

    const single = await request(app)
      .get(`/api/classes/${classroom.id}`)
      .expect(200);
    expect(single.body.classroom).toMatchObject({
      id: classroom.id,
      title: 'Security Class',
      waitingRoomEnabled: true,
    });
    expect(single.body.classroom.hostAccessCode).toBeUndefined();
    expect(single.body.classroom.studentAccessCode).toBeUndefined();
    expect(single.body.classroom.links).toBeUndefined();

    const list = await request(app).get('/api/classes').expect(200);
    expect(list.body.classes).toHaveLength(1);
    expect(list.body.classes[0]).toMatchObject({
      id: classroom.id,
      title: 'Security Class',
      waitingRoomEnabled: true,
    });
    expect(list.body.classes[0].hostAccessCode).toBeUndefined();
    expect(list.body.classes[0].studentAccessCode).toBeUndefined();
    expect(list.body.classes[0].links).toBeUndefined();
  });

  it('requires host approval when the waiting room is enabled', async () => {
    const created = await request(app)
      .post('/api/classes')
      .send({title: 'Waiting Room Class', waitingRoomEnabled: true})
      .expect(201);
    const classroom = created.body.classroom;

    const joinResponse = await request(app)
      .post(`/api/classes/${classroom.id}/join`)
      .send({
        name: 'Student One',
        role: 'student',
        accessCode: classroom.studentAccessCode,
      })
      .expect(202);

    expect(joinResponse.body.status).toBe('waiting');
    expect(joinResponse.body.requestId).toBeTruthy();

    const waitingList = await request(app)
      .get(
        `/api/classes/${classroom.id}/waiting?hostAccessCode=${classroom.hostAccessCode}`,
      )
      .expect(200);
    expect(waitingList.body.requests).toHaveLength(1);
    expect(waitingList.body.requests[0]).toMatchObject({
      name: 'Student One',
      status: 'pending',
    });

    await request(app)
      .post(
        `/api/classes/${classroom.id}/waiting/${joinResponse.body.requestId}`,
      )
      .send({hostAccessCode: classroom.hostAccessCode, decision: 'approve'})
      .expect(200);

    const pollResponse = await request(app)
      .get(`/api/join-requests/${joinResponse.body.requestId}`)
      .expect(200);

    expect(pollResponse.body.status).toBe('joined');
    expect(pollResponse.body.role).toBe('student');
    expect(pollResponse.body.participantToken).toBeTruthy();
  });

  it('rejects an invalid student access code', async () => {
    const created = await request(app)
      .post('/api/classes')
      .send({title: 'Access Guard Class', waitingRoomEnabled: false})
      .expect(201);

    await request(app)
      .post(`/api/classes/${created.body.classroom.id}/join`)
      .send({
        name: 'Student One',
        role: 'student',
        accessCode: 'wrong-code',
      })
      .expect(403);
  });

  it('marks recording failed when LiveKit cannot stop an already failed egress', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({egress_id: 'egress_failed_1'}), {
          status: 200,
          headers: {'content-type': 'application/json'},
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'failed_precondition',
            msg: 'egress with status EGRESS_FAILED cannot be stopped',
          }),
          {
            status: 400,
            headers: {'content-type': 'application/json'},
          },
        ),
      );

    const created = await request(app)
      .post('/api/classes')
      .send({title: 'Recording Failure Class', waitingRoomEnabled: false})
      .expect(201);
    const classroom = created.body.classroom;

    const started = await request(app)
      .post(`/api/classes/${classroom.id}/recordings/start`)
      .send({hostAccessCode: classroom.hostAccessCode, layout: 'speaker'})
      .expect(202);

    expect(started.body.recording).toMatchObject({
      status: 'starting',
      egressId: 'egress_failed_1',
    });

    const stopped = await request(app)
      .post(`/api/classes/${classroom.id}/recordings/stop`)
      .send({
        hostAccessCode: classroom.hostAccessCode,
        recordingId: started.body.recording.id,
      })
      .expect(200);

    expect(stopped.body.recording).toMatchObject({
      status: 'failed',
      error: 'egress with status EGRESS_FAILED cannot be stopped',
    });
    expect(stopped.body.recording.stoppedAt).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not mark recording complete when StopEgress reports an aborted output', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({egress_id: 'egress_aborted_1'}), {
          status: 200,
          headers: {'content-type': 'application/json'},
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            egress_id: 'egress_aborted_1',
            status: 'EGRESS_ABORTED',
            error: 'Start signal not received',
          }),
          {
            status: 200,
            headers: {'content-type': 'application/json'},
          },
        ),
      );

    const created = await request(app)
      .post('/api/classes')
      .send({title: 'Recording Aborted Class', waitingRoomEnabled: false})
      .expect(201);
    const classroom = created.body.classroom;

    const started = await request(app)
      .post(`/api/classes/${classroom.id}/recordings/start`)
      .send({hostAccessCode: classroom.hostAccessCode, layout: 'speaker'})
      .expect(202);

    const stopped = await request(app)
      .post(`/api/classes/${classroom.id}/recordings/stop`)
      .send({
        hostAccessCode: classroom.hostAccessCode,
        recordingId: started.body.recording.id,
      })
      .expect(200);

    expect(stopped.body.recording).toMatchObject({
      status: 'failed',
      error: 'Start signal not received',
    });
    expect(stopped.body.recording.stoppedAt).toBeTruthy();
  });

  it('marks local recording complete when Egress writes a manifest and output file', async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'classroom-recording-'),
    );
    const egressId = 'egress_manifest_1';
    const outputPath = path.join(tempDir, 'recording.mp4');
    const endedAt = 1_776_926_300_052_152_718n;

    await fs.writeFile(outputPath, 'fake mp4 data');
    await fs.writeFile(
      path.join(tempDir, `${egressId}.json`),
      JSON.stringify({
        egress_id: egressId,
        ended_at: endedAt.toString(),
        files: [{filename: outputPath, location: outputPath}],
      }),
    );

    const patch = await recordingPatchFromLocalManifest({
      id: 'recording_1',
      classId: 'class_1',
      egressId,
      status: 'stopping',
      layout: 'speaker',
      outputPath,
      startedAt: new Date(0).toISOString(),
    });

    expect(patch).toMatchObject({
      status: 'complete',
      stoppedAt: new Date(Number(endedAt / 1_000_000n)).toISOString(),
    });
  });

  it('rejects webhook events without a valid signature', async () => {
    await request(app)
      .post('/api/livekit/webhook')
      .set('content-type', 'application/webhook+json')
      .send(
        JSON.stringify({
          egress_info: {
            egress_id: 'egress_invalid_signature',
            status: 'EGRESS_COMPLETE',
          },
        }),
      )
      .expect(401);
  });
});

describe('deployment config validation', () => {
  const validStrictConfig = (): AppConfig => ({
    ...config,
    deployment: {
      appEnv: 'staging',
      strictConfig: true,
    },
    api: {
      ...config.api,
      frontendOrigin: 'https://classroom-staging.example.com',
      publicApiBaseUrl: 'https://classroom-staging.example.com',
    },
    livekit: {
      ...config.livekit,
      wsUrl: 'wss://livekit-staging.example.com',
      httpUrl: 'http://livekit:7880',
      apiKey: 'staging-livekit-key',
      apiSecret: 'staging-livekit-secret-with-real-entropy',
    },
    database: {
      ...config.database,
      provider: 'postgres',
      url: 'postgresql://classroom:staging-password@postgres:5432/classroom',
      autoMigrate: false,
    },
    recording: {
      ...config.recording,
      outputMode: 's3',
      s3: {
        ...config.recording.s3,
        accessKey: 'staging-access-key',
        secret: 'staging-storage-secret',
        bucket: 'classroom-recordings-staging',
      },
    },
  });

  it('accepts a strict staging configuration with real secrets and public TLS URLs', () => {
    expect(getDeploymentConfigIssues(validStrictConfig())).toEqual([]);
  });

  it('blocks staging when local defaults or placeholders are still configured', () => {
    const unsafeConfig: AppConfig = {
      ...validStrictConfig(),
      api: {
        ...config.api,
        frontendOrigin: 'http://localhost:5173',
        publicApiBaseUrl: 'http://localhost:4300',
      },
      livekit: {
        ...config.livekit,
        wsUrl: 'ws://localhost:7880',
        apiKey: 'devkey',
        apiSecret: 'secret',
      },
      database: {
        ...config.database,
        provider: 'memory',
        url: 'postgresql://classroom:replace-me@localhost:5432/classroom_dev',
        autoMigrate: true,
      },
      recording: {
        ...config.recording,
        outputMode: 's3',
        s3: {
          ...config.recording.s3,
          accessKey: 'replace-me',
          secret: 'replace-me',
          bucket: 'replace-me',
        },
      },
    };

    expect(() => validateDeploymentConfig(unsafeConfig)).toThrow(
      'Unsafe staging configuration',
    );
    expect(getDeploymentConfigIssues(unsafeConfig)).toEqual(
      expect.arrayContaining([
        'FRONTEND_ORIGIN must use https:// for staging/production.',
        'FRONTEND_ORIGIN must not point at localhost in staging/production.',
        'PUBLIC_API_BASE_URL must use https:// for staging/production.',
        'PUBLIC_API_BASE_URL must not point at localhost in staging/production.',
        'LIVEKIT_WS_URL must use wss:// for staging/production.',
        'LIVEKIT_WS_URL must not point at localhost in staging/production.',
        'LIVEKIT_API_KEY must be set to a non-placeholder value.',
        'LIVEKIT_API_SECRET must be set to a non-placeholder value.',
        'DATA_STORE must be postgres for staging/production.',
        'DATABASE_URL must be set to a non-placeholder value.',
        'DATABASE_URL must not use the local classroom_dev password.',
        'DB_AUTO_MIGRATE must be false; run migrations explicitly before deploy.',
        'S3_ACCESS_KEY must be set to a non-placeholder value.',
        'S3_SECRET must be set to a non-placeholder value.',
        'S3_BUCKET must be set to a non-placeholder value.',
      ]),
    );
  });
});
