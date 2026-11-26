import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';

const outputDirectory = process.env.VISUAL_OUTPUT ?? 'docs/screenshots/phase46-after';
const eventId = '11111111-1111-4111-8111-111111111111';

function editorialImage(primary: string, secondary: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${primary}"/><stop offset="1" stop-color="${secondary}"/></linearGradient></defs><rect width="1200" height="900" fill="url(#g)"/><circle cx="840" cy="280" r="170" fill="white" opacity=".18"/><path d="M0 720C240 540 430 820 690 650s360-120 510-40v290H0z" fill="white" opacity=".12"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const cover = editorialImage('#745f55', '#c6a788');
const event = {
  id: eventId,
  title: 'Arun & Priya Wedding',
  type: 'WEDDING',
  description: 'A two-day wedding celebration shared with family and friends.',
  eventDate: '2026-12-01T12:00:00.000Z',
  location: 'Chennai',
  status: 'ACTIVE',
  publicSlug: 'arun-priya-wedding',
  coverPhotoId: null,
  coverUrl: cover,
  publicUrl: 'http://localhost:3000/e/arun-priya-wedding',
  photoCount: 1284,
  storageBytes: 18_240_000_000,
  processing: { ready: 1160, failed: 8, pending: 116, percent: 90 },
};

async function json(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockPrivateApi(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/auth/me'))
      return json(route, {
        id: '22222222-2222-4222-8222-222222222222',
        email: 'studio@memories.test',
        displayName: 'Ananya Rao',
        platformRole: 'USER',
        memberships: [{ studioId: 'studio-1', studioName: 'Memories Photography', role: 'OWNER' }],
      });
    if (path.endsWith('/dashboard/overview'))
      return json(route, {
        totalEvents: 24,
        activeEvents: 6,
        completedEvents: 16,
        totalPhotos: 18420,
        storageBytes: 246_000_000_000,
        awaitingProcessing: 116,
        processedPhotos: 18190,
        failedJobs: 8,
        guestSearches: 3640,
      });
    if (path.endsWith('/dashboard/recent-events') || path.endsWith('/events'))
      return json(route, {
        items: [
          event,
          {
            ...event,
            id: 'event-2',
            title: 'Meera Turns One',
            type: 'BIRTHDAY',
            status: 'DRAFT',
            photoCount: 428,
            processing: { ready: 428, failed: 0, pending: 0, percent: 100 },
            coverUrl: editorialImage('#857d72', '#d8cfc3'),
          },
          {
            ...event,
            id: 'event-3',
            title: 'Northstar Annual Meet',
            type: 'CORPORATE',
            status: 'EXPIRED',
            photoCount: 782,
            processing: { ready: 782, failed: 0, pending: 0, percent: 100 },
            coverUrl: editorialImage('#3d5557', '#a9c2bc'),
          },
        ],
        page: 1,
        pageSize: 12,
        total: 3,
        totalPages: 1,
      });
    if (path.endsWith('/dashboard/analytics'))
      return json(route, {
        eventsOverTime: [{ date: '2026-09-01', count: 4 }],
        photosOverTime: [
          { date: '2026-09-01', count: 640, bytes: 8_000_000_000 },
          { date: '2026-10-01', count: 1180, bytes: 14_000_000_000 },
          { date: '2026-11-01', count: 920, bytes: 11_000_000_000 },
        ],
        processing: { COMPLETED: 18190, FAILED: 8, PENDING: 116 },
        events: [event],
      });
    if (path.endsWith('/processing/stats'))
      return json(route, {
        counts: { PENDING: 116, ACTIVE: 12, COMPLETED: 18190, FAILED: 8, DEAD_LETTER: 0 },
        retryAttempts: 14,
        workers: { thumbnail: 2, ai: 0, deletion: 1, aiAvailable: false },
        photos: {
          total: 18420,
          indexed: 18190,
          withFaces: 16420,
          noFaces: 1770,
          failed: 8,
          averageProcessingDurationMs: 1840,
        },
        model: { ready: false },
      });
    if (path.includes('/processing/jobs'))
      return json(route, {
        items: [
          {
            id: 'job-1',
            type: 'FACE_INDEX',
            status: 'FAILED',
            attempts: 3,
            maxAttempts: 3,
            errorSummary: 'Recognition model is not configured.',
            createdAt: '2026-11-20T08:00:00.000Z',
            event: { id: eventId, title: event.title },
            photo: { id: 'photo-1', originalFilename: 'MP_1024.jpg' },
          },
        ],
        page: 1,
        pageSize: 30,
        total: 1,
        totalPages: 1,
      });
    if (path.endsWith(`/events/${eventId}`)) return json(route, event);
    return json(route, {});
  });
}

async function mockGuestApi(page: Page) {
  await page.route('**/api/guest/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/events/'))
      return json(route, {
        title: event.title,
        type: event.type,
        description: event.description,
        eventDate: event.eventDate,
        location: event.location,
        studioName: 'Memories Photography',
        coverUrl: cover,
        available: true,
        pinRequired: false,
        finderAvailable: true,
        finderMessage: 'Available',
        consentVersion: '1.0',
      });
    return json(route, { expiresAt: '2026-12-01T13:00:00.000Z' });
  });
}

test.beforeAll(() => mkdirSync(outputDirectory, { recursive: true }));

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1050 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`capture Phase 4.5 private workspace ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockPrivateApi(page);
    for (const [name, path] of [
      ['dashboard', '/dashboard'],
      ['events', '/dashboard/events'],
      ['event-workspace', `/dashboard/events/${eventId}`],
      ['processing', '/dashboard/processing'],
      ['analytics', '/dashboard/analytics'],
    ] as const) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      await page.waitForTimeout(450);
      await page.screenshot({
        path: `${outputDirectory}/${name}-${viewport.name}.png`,
        fullPage: true,
      });
    }
  });

  test(`capture Phase 4.5 guest journey ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockGuestApi(page);
    for (const [name, path] of [
      ['guest-event', '/e/arun-priya-wedding'],
      ['booth', '/booth/arun-priya-wedding'],
    ] as const) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      await page.waitForTimeout(450);
      await page.screenshot({
        path: `${outputDirectory}/${name}-${viewport.name}.png`,
        fullPage: true,
      });
    }
  });
}

test('capture Phase 4.5 tablet booth', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await mockGuestApi(page);
  await page.goto('/booth/arun-priya-wedding');
  await expect(page.locator('main')).toBeVisible();
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${outputDirectory}/booth-tablet.png`, fullPage: true });
});
