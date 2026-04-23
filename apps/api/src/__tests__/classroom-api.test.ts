import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createApp} from '../app.js';
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
