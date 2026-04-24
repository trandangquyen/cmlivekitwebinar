import {expect, test} from '@playwright/test';

const classroomResponse = {
  classroom: {
    id: 'class-waiting',
    title: 'Waiting Room English',
    waitingRoomEnabled: true,
    createdAt: new Date('2026-04-24T00:00:00.000Z').toISOString(),
  },
};

test('invite link pre-fills the host role and access code on the join page', async ({
  page,
}) => {
  await page.route('**/api/classes/class-waiting', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(classroomResponse),
    });
  });

  await page.goto('/join/class-waiting?role=host&code=host-code1');

  await expect(page.getByRole('heading', {name: 'Waiting Room English'})).toBeVisible();
  await expect(page.getByLabel('Access code')).toHaveValue('host-code1');
  await expect(page.locator('.segmented button.active')).toHaveText('Host');
});

test('student sees waiting-room status after submitting a join request', async ({
  page,
}) => {
  let joinPayload: Record<string, string> | null = null;

  await page.route('**/api/classes/class-waiting', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(classroomResponse),
    });
  });

  await page.route('**/api/classes/class-waiting/join', async route => {
    joinPayload = route.request().postDataJSON() as Record<string, string>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'waiting',
        requestId: 'join-request-1',
        pollUrl: '/api/join-requests/join-request-1',
      }),
    });
  });

  await page.route('**/api/join-requests/join-request-1', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'waiting',
        requestId: 'join-request-1',
        pollUrl: '/api/join-requests/join-request-1',
      }),
    });
  });

  await page.goto('/join/class-waiting?role=student&code=student-code1');
  await page.getByLabel('Display name').fill('Student One');
  await page.getByRole('button', {name: 'Join'}).click();

  expect(joinPayload).toEqual({
    name: 'Student One',
    role: 'student',
    accessCode: 'student-code1',
  });
  await expect(page.getByRole('button', {name: 'Waiting...'})).toBeDisabled();
  await expect(page.locator('.notice-text')).toHaveText(
    'Waiting for host approval.',
  );
});
