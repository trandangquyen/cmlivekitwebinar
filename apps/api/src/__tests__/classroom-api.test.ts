import request from 'supertest';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createApp} from '../app.js';
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
      status: 'active',
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
});
