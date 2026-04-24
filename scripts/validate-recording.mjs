import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const apiBaseUrl =
  process.env.RECORDING_VALIDATE_API_BASE_URL || 'http://127.0.0.1:4300';
const captureDurationMs = Math.max(
  3_000,
  Number(process.env.RECORDING_VALIDATE_CAPTURE_MS || 8_000),
);
const settleTimeoutMs = Math.max(
  30_000,
  Number(process.env.RECORDING_VALIDATE_SETTLE_MS || 90_000),
);
const recordingsHostDir =
  process.env.RECORDING_VALIDATE_HOST_DIR || path.join(repoRoot, 'recordings');
const recordingLocalPrefix =
  process.env.RECORDING_LOCAL_PREFIX || '/out/recordings';
const headless = process.env.RECORDING_VALIDATE_HEADLESS !== 'false';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `${options.method || 'GET'} ${url} failed: ${payload.error || response.status}`,
    );
  }

  return payload;
};

const waitForHealth = async () => {
  let lastError = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const health = await requestJson(`${apiBaseUrl}/api/health`);
      if (health.ok) {
        return health;
      }
    } catch (error) {
      lastError = error;
    }

    await sleep(1_000);
  }

  throw new Error(
    `API health check did not become ready at ${apiBaseUrl}: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
};

const joinClassroom = async (page, inviteUrl, name) => {
  await page.goto(inviteUrl, {waitUntil: 'networkidle'});
  await page.getByLabel('Display name').fill(name);
  await page.getByRole('button', {name: 'Join'}).click();
  await page.locator('.classroom-topbar').waitFor({timeout: 60_000});
  await page
    .locator('.classroom-topbar')
    .getByRole('button', {name: 'Leave'})
    .waitFor({timeout: 60_000});
};

const pollRecording = async (classId, hostAccessCode, predicate) => {
  const deadline = Date.now() + settleTimeoutMs;
  while (Date.now() < deadline) {
    const payload = await requestJson(
      `${apiBaseUrl}/api/classes/${classId}/recordings?hostAccessCode=${encodeURIComponent(
        hostAccessCode,
      )}`,
    );
    const match = payload.recordings.find(predicate);
    if (match) {
      return match;
    }
    await sleep(1_000);
  }

  throw new Error('Timed out while polling recording status from the API.');
};

const hostPathForRecording = outputPath => {
  const normalizedPrefix = recordingLocalPrefix.replace(/\\/g, '/');
  const normalizedOutput = outputPath.replace(/\\/g, '/');

  if (!normalizedOutput.startsWith(normalizedPrefix)) {
    throw new Error(
      `Recording output path ${outputPath} does not start with ${recordingLocalPrefix}.`,
    );
  }

  const relativePath = normalizedOutput
    .slice(normalizedPrefix.length)
    .replace(/^\/+/, '');

  return path.join(recordingsHostDir, ...relativePath.split('/'));
};

const looksLikeMp4 = async filepath => {
  const handle = await fs.open(filepath, 'r');
  try {
    const buffer = Buffer.alloc(16);
    const {bytesRead} = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead < 12) {
      return false;
    }
    return buffer.toString('ascii', 4, 8) === 'ftyp';
  } finally {
    await handle.close();
  }
};

const validateArtifacts = async recording => {
  if (!recording.outputPath) {
    throw new Error('Recording completed without an outputPath.');
  }
  if (!recording.egressId) {
    throw new Error('Recording completed without an egressId.');
  }

  const hostOutputPath = hostPathForRecording(recording.outputPath);
  const manifestPath = path.join(
    path.dirname(hostOutputPath),
    `${recording.egressId}.json`,
  );

  const [outputStat, manifestRaw] = await Promise.all([
    fs.stat(hostOutputPath),
    fs.readFile(manifestPath, 'utf8'),
  ]);
  const manifest = JSON.parse(manifestRaw);

  if (!outputStat.isFile() || outputStat.size <= 0) {
    throw new Error(`Recording output file is missing or empty: ${hostOutputPath}`);
  }
  if (!(await looksLikeMp4(hostOutputPath))) {
    throw new Error(`Recording output does not look like an MP4 file: ${hostOutputPath}`);
  }
  if (manifest.egress_id !== recording.egressId) {
    throw new Error(
      `Manifest egress id ${manifest.egress_id} does not match API egress id ${recording.egressId}.`,
    );
  }
  if (!manifest.ended_at) {
    throw new Error(`Manifest ${manifestPath} is missing ended_at.`);
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error(`Manifest ${manifestPath} does not list any output files.`);
  }
  if (
    !manifest.files.some(
      file =>
        file?.filename === recording.outputPath || file?.location === recording.outputPath,
    )
  ) {
    throw new Error(
      `Manifest ${manifestPath} does not reference the API output path ${recording.outputPath}.`,
    );
  }

  return {
    hostOutputPath,
    manifestPath,
    sizeBytes: outputStat.size,
  };
};

const main = async () => {
  console.log(`Checking API health at ${apiBaseUrl} ...`);
  const health = await waitForHealth();
  console.log(
    `API ready. dataStore=${health.dataStore}, livekitUrl=${health.livekitUrl}`,
  );

  const title = `Egress Validation ${new Date().toISOString()}`;
  const created = await requestJson(`${apiBaseUrl}/api/classes`, {
    method: 'POST',
    body: JSON.stringify({
      title,
      waitingRoomEnabled: false,
    }),
  });
  const {classroom} = created;
  console.log(`Created class ${classroom.id}`);

  const browser = await chromium.launch({
    headless,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  });

  const contextOptions = {
    ignoreHTTPSErrors: true,
    permissions: ['camera', 'microphone'],
    viewport: {width: 1440, height: 900},
  };

  const hostContext = await browser.newContext(contextOptions);
  const studentContext = await browser.newContext(contextOptions);
  const hostPage = await hostContext.newPage();
  const studentPage = await studentContext.newPage();

  try {
    console.log('Joining host session ...');
    await joinClassroom(hostPage, classroom.links.host, 'Host Recorder');
    console.log('Joining student session ...');
    await joinClassroom(studentPage, classroom.links.student, 'Student One');

    await sleep(3_000);

    console.log('Starting recording via API ...');
    const started = await requestJson(
      `${apiBaseUrl}/api/classes/${classroom.id}/recordings/start`,
      {
        method: 'POST',
        body: JSON.stringify({
          hostAccessCode: classroom.hostAccessCode,
          layout: 'speaker',
        }),
      },
    );
    const startedRecording = started.recording;
    console.log(`Recording started: ${startedRecording.id}`);

    await sleep(captureDurationMs);

    console.log('Stopping recording via API ...');
    await requestJson(
      `${apiBaseUrl}/api/classes/${classroom.id}/recordings/stop`,
      {
        method: 'POST',
        body: JSON.stringify({
          hostAccessCode: classroom.hostAccessCode,
          recordingId: startedRecording.id,
        }),
      },
    );

    console.log('Waiting for recording to settle ...');
    const completedRecording = await pollRecording(
      classroom.id,
      classroom.hostAccessCode,
      item =>
        item.id === startedRecording.id &&
        (item.status === 'complete' || item.status === 'failed'),
    );

    if (completedRecording.status !== 'complete') {
      throw new Error(
        `Recording finished with status=${completedRecording.status}: ${
          completedRecording.error || 'Unknown error'
        }`,
      );
    }

    const artifactSummary = await validateArtifacts(completedRecording);
    console.log('Egress recording validation passed.');
    console.log(`Class ID: ${classroom.id}`);
    console.log(`Recording ID: ${completedRecording.id}`);
    console.log(`Egress ID: ${completedRecording.egressId}`);
    console.log(`Output file: ${artifactSummary.hostOutputPath}`);
    console.log(`Manifest: ${artifactSummary.manifestPath}`);
    console.log(`Size: ${artifactSummary.sizeBytes} bytes`);
  } finally {
    await Promise.allSettled([
      hostContext.close(),
      studentContext.close(),
      browser.close(),
    ]);
  }
};

await main().catch(error => {
  console.error(
    error instanceof Error ? error.stack || error.message : String(error),
  );
  process.exitCode = 1;
});
