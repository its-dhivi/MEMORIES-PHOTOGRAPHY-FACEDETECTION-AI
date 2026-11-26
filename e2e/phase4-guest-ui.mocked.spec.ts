import { expect, test } from '@playwright/test';

function bmp(width: number, height: number): Buffer {
  const row = Math.ceil((width * 3) / 4) * 4;
  const pixels = row * height;
  const output = Buffer.alloc(54 + pixels);
  output.write('BM');
  output.writeUInt32LE(output.length, 2);
  output.writeUInt32LE(54, 10);
  output.writeUInt32LE(40, 14);
  output.writeInt32LE(width, 18);
  output.writeInt32LE(height, 22);
  output.writeUInt16LE(1, 26);
  output.writeUInt16LE(24, 28);
  output.writeUInt32LE(pixels, 34);
  output.fill(190, 54);
  return output;
}

test('mocked guest UI completes PIN, consent, selfie, and results flow', async ({ page }) => {
  await page.route('**/api/guest/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/guest/events/demo' && request.method() === 'GET')
      return json({
        title: 'Arun & Priya Wedding',
        type: 'WEDDING',
        description: null,
        eventDate: '2026-12-01T12:00:00.000Z',
        location: 'Chennai',
        studioName: 'Memories Photography',
        coverUrl: null,
        available: true,
        pinRequired: true,
        finderAvailable: true,
        finderMessage: 'Available',
        consentVersion: '1.0',
      });
    if (path.endsWith('/session') && request.method() === 'POST')
      return json({ expiresAt: '2026-12-01T13:00:00.000Z' });
    if (path.endsWith('/session'))
      return json({
        expiresAt: '2026-12-01T13:00:00.000Z',
        consented: false,
        consentVersion: '1.0',
      });
    if (path.endsWith('/consent')) return json({ consented: true });
    if (path.endsWith('/search'))
      return json({
        searchId: '11111111-1111-4111-8111-111111111111',
        status: 'COMPLETED',
        expiresAt: '2026-12-01T13:00:00.000Z',
      });
    if (path.endsWith('/results'))
      return json({
        searchId: '11111111-1111-4111-8111-111111111111',
        page: 1,
        pageSize: 100,
        total: 1,
        hasMore: false,
        expiresAt: '2026-12-01T13:00:00.000Z',
        downloadsEnabled: true,
        downloadAllEnabled: true,
        items: [
          {
            photoId: '22222222-2222-4222-8222-222222222222',
            filename: 'memory.jpg',
            thumbnailUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
            previewUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
          },
        ],
      });
    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: '{"message":"Not found"}',
    });
  });

  await page.goto('/e/demo');
  await expect(page.getByRole('heading', { name: 'Arun & Priya Wedding' })).toBeVisible();
  await page.getByRole('button', { name: 'Find My Photos' }).click();
  await page.getByLabel('Event PIN').fill('2468');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /I agree/ }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'selfie.png', mimeType: 'image/png', buffer: bmp(320, 320) });
  await page.getByRole('button', { name: 'Find my photos' }).click();
  await expect(page.getByText('1 matching photograph')).toBeVisible();
  await expect(page.getByAltText('memory.jpg')).toBeVisible();
  await page.getByRole('button', { name: 'Select photos' }).click();
  await page.getByRole('button', { name: 'Select memory.jpg' }).click();
  await expect(page.getByText('1 photos selected')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download 1' })).toBeEnabled();
});

test('mocked kiosk revokes and clears the previous guest session', async ({ page }) => {
  let withdrawals = 0;
  await page.route('**/api/guest/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/guest/events/demo')
      return json({
        title: 'Demo Wedding',
        type: 'WEDDING',
        description: null,
        eventDate: '2026-12-01T12:00:00.000Z',
        location: null,
        studioName: 'Memories Photography',
        coverUrl: null,
        available: true,
        pinRequired: false,
        finderAvailable: true,
        finderMessage: 'Available',
        consentVersion: '1.0',
      });
    if (path.endsWith('/session')) return json({ expiresAt: '2026-12-01T13:00:00.000Z' });
    if (path.endsWith('/consent')) {
      if ((request.postDataJSON() as { accepted: boolean }).accepted === false) withdrawals++;
      return json({ consented: true });
    }
    if (path.endsWith('/search'))
      return json({
        searchId: '11111111-1111-4111-8111-111111111111',
        status: 'COMPLETED',
        expiresAt: '2026-12-01T13:00:00.000Z',
      });
    if (path.endsWith('/results'))
      return json({
        searchId: '11111111-1111-4111-8111-111111111111',
        expiresAt: '2026-12-01T13:00:00.000Z',
        downloadsEnabled: true,
        downloadAllEnabled: false,
        items: [],
      });
    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: '{"message":"Not found"}',
    });
  });
  await page.goto('/booth/demo');
  await page.getByRole('button', { name: /start photo search/i }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /agree and continue/i }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'selfie.png', mimeType: 'image/png', buffer: bmp(320, 320) });
  await page.getByRole('button', { name: /find my photos/i }).click();
  await page.getByRole('button', { name: /finish and clear session/i }).click();
  await expect(page.getByRole('button', { name: /start photo search/i })).toBeVisible();
  expect(withdrawals).toBe(1);
});
