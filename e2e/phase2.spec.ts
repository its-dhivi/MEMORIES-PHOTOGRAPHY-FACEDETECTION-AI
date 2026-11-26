import { expect, test } from '@playwright/test';

test('photographer completes the Phase 2 event and photo workflow', async ({ page }) => {
  test.skip(
    !process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD,
    'E2E credentials are required',
  );
  await page.goto('/login');
  await page.getByLabel('Email address').fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel('Password').fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: 'Create event' }).first().click();
  const slug = `playwright-event-${Date.now()}`;
  await page.getByLabel('Event name').fill('Playwright Event');
  await page.getByLabel('Event date').fill('2026-12-01T18:00');
  await page.getByLabel('Public slug').fill(slug);
  await page.getByRole('button', { name: 'Create event' }).click();
  await expect(page.getByText('Playwright Event')).toBeVisible();
  const eventUrl = page.url();

  await page.getByRole('link', { name: 'Upload photographs' }).click();
  await page.getByLabel('Choose photographs').setInputFiles({
    name: 'phase2-fixture.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await page.getByRole('button', { name: 'Upload queue' }).click();
  await expect(page.getByText('complete', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByAltText('phase2-fixture.png')).toBeVisible();

  await page.getByRole('link', { name: 'Processing' }).click();
  await expect(page.getByRole('heading', { name: 'Processing queue' })).toBeVisible();
  await expect(page.getByText('Playwright Event')).toBeVisible();

  await page.goto(eventUrl);
  await page.getByRole('link', { name: 'QR code' }).first().click();
  await expect(page.getByAltText('QR code for Playwright Event')).toBeVisible();
  await page.goto(`/e/${slug}`);
  await expect(page.getByRole('heading', { name: 'Playwright Event' })).toBeVisible();

  await page.goto(`${eventUrl}/photos`);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTitle('Delete').click();
  await expect(page.getByAltText('phase2-fixture.png')).not.toBeVisible();
});
