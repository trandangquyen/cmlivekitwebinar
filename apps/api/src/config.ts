import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

const candidateEnvFiles = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
];

for (const envPath of candidateEnvFiles) {
  if (fs.existsSync(envPath)) {
    dotenv.config({path: envPath, override: false});
  }
}

const boolFromEnv = (value: string | undefined, fallback: boolean) => {
  if (value === undefined || value === '') {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const intFromEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const databaseUrl = process.env.DATABASE_URL || '';

export const config = {
  api: {
    port: intFromEnv(process.env.API_PORT, 4300),
    frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    publicApiBaseUrl:
      process.env.PUBLIC_API_BASE_URL || 'http://localhost:4300',
  },
  livekit: {
    wsUrl: process.env.LIVEKIT_WS_URL || 'ws://localhost:7880',
    httpUrl: process.env.LIVEKIT_HTTP_URL || 'http://localhost:7880',
    apiKey: process.env.LIVEKIT_API_KEY || 'devkey',
    apiSecret: process.env.LIVEKIT_API_SECRET || 'secret',
  },
  classroom: {
    defaultWaitingRoom: boolFromEnv(
      process.env.CLASSROOM_DEFAULT_WAITING_ROOM,
      true,
    ),
    tokenTtl: process.env.CLASSROOM_TOKEN_TTL || '3h',
  },
  database: {
    provider: process.env.DATA_STORE || (databaseUrl ? 'postgres' : 'memory'),
    url: databaseUrl,
    ssl: boolFromEnv(process.env.DATABASE_SSL, false),
    autoMigrate: boolFromEnv(process.env.DB_AUTO_MIGRATE, false),
  },
  recording: {
    outputMode: process.env.RECORDING_OUTPUT_MODE || 'local',
    localPrefix: process.env.RECORDING_LOCAL_PREFIX || '/out/recordings',
    s3: {
      accessKey: process.env.S3_ACCESS_KEY || '',
      secret: process.env.S3_SECRET || '',
      bucket: process.env.S3_BUCKET || '',
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || '',
      forcePathStyle: boolFromEnv(process.env.S3_FORCE_PATH_STYLE, true),
    },
  },
};
