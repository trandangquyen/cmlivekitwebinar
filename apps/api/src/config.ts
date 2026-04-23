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
  deployment: {
    appEnv: process.env.APP_ENV || 'local',
    strictConfig: boolFromEnv(process.env.STRICT_CONFIG, false),
  },
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
    verifyWebhooks: boolFromEnv(process.env.LIVEKIT_WEBHOOK_VERIFY, true),
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

export type AppConfig = typeof config;

export class DeploymentConfigError extends Error {
  constructor(
    readonly envName: string,
    readonly issues: string[],
  ) {
    super(
      [
        `Unsafe ${envName} configuration:`,
        ...issues.map(issue => `- ${issue}`),
      ].join('\n'),
    );
    this.name = 'DeploymentConfigError';
  }
}

const placeholderValues = new Set([
  '',
  'change-me',
  'changeme',
  'devkey',
  'replace-me',
  'secret',
]);

const hasPlaceholderValue = (value: string) =>
  placeholderValues.has(value.trim().toLowerCase()) ||
  value.toLowerCase().includes('replace-me') ||
  value.toLowerCase().includes('change-me') ||
  value.toLowerCase().includes('changeme');

const hostnameFromUrl = (value: string) => {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
};

const isLoopbackUrl = (value: string) => {
  const hostname = hostnameFromUrl(value);
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1'
  );
};

export const getDeploymentConfigIssues = (
  appConfig: AppConfig = config,
): string[] => {
  const envName = appConfig.deployment.appEnv.trim().toLowerCase();
  const strict =
    appConfig.deployment.strictConfig ||
    envName === 'staging' ||
    envName === 'production';

  if (!strict) {
    return [];
  }

  const issues: string[] = [];
  const requireSecret = (name: string, value: string) => {
    if (hasPlaceholderValue(value)) {
      issues.push(`${name} must be set to a non-placeholder value.`);
    }
  };
  const requirePublicHttps = (name: string, value: string) => {
    if (!value.startsWith('https://')) {
      issues.push(`${name} must use https:// for staging/production.`);
    }
    if (isLoopbackUrl(value)) {
      issues.push(`${name} must not point at localhost in staging/production.`);
    }
  };

  requirePublicHttps('FRONTEND_ORIGIN', appConfig.api.frontendOrigin);
  requirePublicHttps('PUBLIC_API_BASE_URL', appConfig.api.publicApiBaseUrl);

  if (!appConfig.livekit.wsUrl.startsWith('wss://')) {
    issues.push('LIVEKIT_WS_URL must use wss:// for staging/production.');
  }
  if (isLoopbackUrl(appConfig.livekit.wsUrl)) {
    issues.push(
      'LIVEKIT_WS_URL must not point at localhost in staging/production.',
    );
  }

  requireSecret('LIVEKIT_API_KEY', appConfig.livekit.apiKey);
  requireSecret('LIVEKIT_API_SECRET', appConfig.livekit.apiSecret);

  if (appConfig.database.provider !== 'postgres') {
    issues.push('DATA_STORE must be postgres for staging/production.');
  }
  requireSecret('DATABASE_URL', appConfig.database.url);
  if (appConfig.database.url.includes('classroom_dev')) {
    issues.push('DATABASE_URL must not use the local classroom_dev password.');
  }
  if (appConfig.database.autoMigrate) {
    issues.push(
      'DB_AUTO_MIGRATE must be false; run migrations explicitly before deploy.',
    );
  }

  if (appConfig.recording.outputMode === 's3') {
    requireSecret('S3_ACCESS_KEY', appConfig.recording.s3.accessKey);
    requireSecret('S3_SECRET', appConfig.recording.s3.secret);
    requireSecret('S3_BUCKET', appConfig.recording.s3.bucket);
  }

  return issues;
};

export const validateDeploymentConfig = (appConfig: AppConfig = config) => {
  const issues = getDeploymentConfigIssues(appConfig);
  if (issues.length > 0) {
    throw new DeploymentConfigError(appConfig.deployment.appEnv, issues);
  }
};
