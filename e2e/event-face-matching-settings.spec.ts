import { expect, test } from '@playwright/test';

const eventId = '11111111-1111-4111-8111-111111111111';

test('owners can use private search and set event guest matching without evaluation artifacts', async ({ page }) => {
  let savedSettings: Record<string, unknown> | undefined;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/auth/me')) {
      await route.fulfill({ json: {
        id: '22222222-2222-4222-8222-222222222222', email: 'owner@memories.test',
        displayName: 'Event Owner', platformRole: 'USER',
        memberships: [{ studioId: 'studio-a', studioName: 'Memories', role: 'OWNER' }],
      } });
      return;
    }
    if (path.endsWith(`/events/${eventId}/settings`) && request.method() === 'PATCH') {
      savedSettings = request.postDataJSON() as Record<string, unknown>;
      await route.fulfill({ json: { ...savedSettings, accessPinConfigured: false } });
      return;
    }
    if (path.endsWith(`/events/${eventId}/settings`)) {
      await route.fulfill({ json: {
        accessEnabled: true, accessExpiresAt: null, accessPinConfigured: false,
        downloadsEnabled: true, downloadAllEnabled: true, retentionDays: 90,
        faceMatchingEnabled: false, similarityThreshold: 0.64,
      } });
      return;
    }
    if (path.endsWith(`/events/${eventId}/matching/private-search`)) {
      await route.fulfill({ json: {
        status: 'COMPLETED', threshold: 0.64,
        results: [{ photoId: 'photo-a', filename: 'event-photo.jpg', similarity: 0.82, previewUrl: null }],
      } });
      return;
    }
    if (path.endsWith(`/events/${eventId}`)) {
      await route.fulfill({ json: {
        id: eventId, title: 'Projection Corporate Event', type: 'CORPORATE',
        description: '', eventDate: '2026-11-27T12:00:00.000Z', location: 'Chennai',
        status: 'ACTIVE', publicSlug: 'projection-corporate-event',
      } });
      return;
    }
    await route.fulfill({ json: {} });
  });

  await page.goto(`/dashboard/events/${eventId}/settings`);
  await expect(page.getByRole('heading', { name: 'Face matching' })).toBeVisible();
  await expect(page.getByText(/signed gallery|evaluation artifact|face matching approval/i)).toHaveCount(0);
  await expect(page.getByLabel('Enable Face Matching')).not.toBeChecked();
  await page.getByLabel('Enable Face Matching').check();
  await page.getByLabel('Similarity threshold').fill('0.72');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect.poll(() => savedSettings).toMatchObject({ faceMatchingEnabled: true, similarityThreshold: 0.72 });

  await page.locator('input[type="file"]').setInputFiles({
    name: 'authorized-selfie.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff]),
  });
  await page.getByLabel('I have permission to process this selfie for this event search.').check();
  await page.getByRole('button', { name: 'Search event photos privately' }).click();
  await expect(page.getByText('1 matching photos at threshold 0.64')).toBeVisible();
  await expect(page.getByText('event-photo.jpg')).toBeVisible();
});
