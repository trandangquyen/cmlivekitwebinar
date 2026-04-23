import {AccessToken} from 'livekit-server-sdk';
import {nanoid} from 'nanoid';
import {config} from './config.js';
import type {Classroom, ClassroomRole, ParticipantJoinPayload} from './types.js';

const identityFor = (role: ClassroomRole) => `${role}_${nanoid(12)}`;

export const buildParticipantJoinPayload = async (input: {
  classroom: Classroom;
  role: ClassroomRole;
  participantName: string;
}): Promise<ParticipantJoinPayload> => {
  const {classroom, role, participantName} = input;
  const isHost = role === 'host';
  const identity = identityFor(role);
  const permissions = {
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: isHost,
    roomRecord: isHost,
  };
  const token = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
    identity,
    name: participantName,
    ttl: config.classroom.tokenTtl,
    metadata: JSON.stringify({
      classId: classroom.id,
      role,
    }),
  });

  token.addGrant({
    room: classroom.roomName,
    roomJoin: true,
    canPublish: permissions.canPublish,
    canSubscribe: permissions.canSubscribe,
    canPublishData: permissions.canPublishData,
    roomAdmin: permissions.roomAdmin,
    roomRecord: permissions.roomRecord,
  });

  return {
    status: 'joined',
    classId: classroom.id,
    title: classroom.title,
    role,
    participantName,
    livekitUrl: config.livekit.wsUrl,
    roomName: classroom.roomName,
    participantToken: await token.toJwt(),
    permissions,
  };
};

export const buildRoomRecordToken = async (classroom: Classroom) => {
  const token = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
    identity: `recording_api_${classroom.id}`,
    ttl: '10m',
  });

  token.addGrant({
    room: classroom.roomName,
    roomJoin: true,
    roomRecord: true,
  });

  return token.toJwt();
};
