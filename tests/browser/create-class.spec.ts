import {expect, test} from '@playwright/test';

test('teacher can create a class and see join links', async ({page}) => {
  await page.route('**/api/classes', async route => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        classroom: {
          id: 'class-prod-ready',
          title: 'Production Readiness Class',
          roomName: 'class_production_readiness',
          hostAccessCode: 'host-code1',
          studentAccessCode: 'student-c1',
          waitingRoomEnabled: true,
          createdAt: new Date('2026-04-23T00:00:00.000Z').toISOString(),
          links: {
            host: 'http://localhost:5173/join/class-prod-ready?role=host&code=host-code1',
            student:
              'http://localhost:5173/join/class-prod-ready?role=student&code=student-c1',
          },
        },
      }),
    });
  });

  await page.goto('/');
  await page.getByLabel('Class title').fill('Production Readiness Class');
  await page.getByRole('button', {name: /create class/i}).click();

  await expect(page.getByText('Class ready')).toBeVisible();
  const readonlyLinks = page.locator('input[readonly]');
  await expect(readonlyLinks.nth(0)).toHaveValue(/role=host/);
  await expect(readonlyLinks.nth(1)).toHaveValue(/role=student/);
});
