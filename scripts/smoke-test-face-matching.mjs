import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const rootEnv = Object.fromEntries(
  (await readFile(new URL('../.env', import.meta.url), 'utf8'))
    .split(/\r?\n/)
    .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);
const api = rootEnv.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function json(response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

const login = await fetch(`${api}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: rootEnv.SEED_ADMIN_EMAIL,
    password: rootEnv.SEED_ADMIN_PASSWORD,
  }),
});
await json(login);
const setCookies = login.headers.getSetCookie();
const cookie = setCookies.map((value) => value.split(';', 1)[0]).join('; ');
const csrf = decodeURIComponent(
  cookie
    .split('; ')
    .find((value) => value.startsWith('csrf_token='))
    ?.slice('csrf_token='.length) ?? '',
);
if (!cookie.includes('access_token=') || !csrf) throw new Error('Login cookies were incomplete');

async function admin(path, init = {}) {
  return json(
    await fetch(`${api}${path}`, {
      ...init,
      headers: {
        Cookie: cookie,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(!['GET', 'HEAD'].includes(init.method ?? 'GET') ? { 'X-CSRF-Token': csrf } : {}),
        ...init.headers,
      },
    }),
  );
}

const slug = `face-match-smoke-${Date.now()}`;
let event;
try {
  event = await admin('/events', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Face matching smoke test',
      type: 'OTHER',
      eventDate: new Date().toISOString(),
      location: 'Local verification',
      publicSlug: slug,
    }),
  });
  await admin(`/events/${event.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'ACTIVE' }),
  });
  await admin(`/events/${event.id}/settings`, {
    method: 'PATCH',
    body: JSON.stringify({
      accessEnabled: true,
      downloadsEnabled: true,
      downloadAllEnabled: true,
    }),
  });
  await admin(`/events/${event.id}/settings/approve-matching`, {
    method: 'POST',
    body: JSON.stringify({
      threshold: 0.64,
      modelVersion: rootEnv.FACE_MODEL_VERSION,
      preprocessingVersion: rootEnv.FACE_PREPROCESSING_VERSION ?? 'auraface-rgb-112-v1',
      source: 'smoke-test',
      evaluationResults: { note: 'Local same-image pipeline test only' },
    }),
  });

  const imageResponse = await fetch(
    'https://raw.githubusercontent.com/opencv/opencv/master/samples/data/lena.jpg',
  );
  if (!imageResponse.ok) throw new Error('Could not fetch the public smoke-test image');
  const image = new Uint8Array(await imageResponse.arrayBuffer());
  const sha256 = createHash('sha256').update(image).digest('hex');
  const authorization = await admin(`/events/${event.id}/photos/upload-init`, {
    method: 'POST',
    body: JSON.stringify({
      filename: 'face-match-smoke.jpg',
      mimeType: 'image/jpeg',
      byteSize: image.byteLength,
      sha256,
      idempotencyKey: randomUUID(),
    }),
  });
  const put = await fetch(authorization.uploadUrl, {
    method: 'PUT',
    headers: authorization.headers,
    body: image,
  });
  if (!put.ok) throw new Error(`Storage upload failed with ${put.status}`);
  const completed = await admin(`/events/${event.id}/photos/upload-complete`, {
    method: 'POST',
    body: JSON.stringify({ uploadSessionId: authorization.uploadSessionId }),
  });

  let indexedPhoto;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const page = await admin(`/events/${event.id}/photos?page=1&pageSize=10`);
    indexedPhoto = page.items.find((photo) => photo.id === completed.photoId);
    if (indexedPhoto?.status === 'READY' || indexedPhoto?.status === 'FAILED') break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (indexedPhoto?.status !== 'READY' || indexedPhoto.faceCount !== 1) {
    throw new Error(`Photo indexing did not succeed: ${JSON.stringify(indexedPhoto)}`);
  }

  const publicEvent = await json(await fetch(`${api}/public/events/${slug}`));
  if (!publicEvent.finderAvailable) throw new Error(publicEvent.finderMessage);
  const session = await json(
    await fetch(`${api}/public/events/${slug}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '' }),
    }),
  );
  const guestHeaders = { 'X-Guest-Session': session.guestSessionToken };
  await json(
    await fetch(`${api}/public/events/${slug}/consent`, {
      method: 'POST',
      headers: { ...guestHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accepted: true, version: publicEvent.consentVersion }),
    }),
  );
  const form = new FormData();
  form.set('selfie', new Blob([image], { type: 'image/jpeg' }), 'selfie.jpg');
  const search = await json(
    await fetch(`${api}/public/events/${slug}/search`, {
      method: 'POST',
      headers: guestHeaders,
      body: form,
    }),
  );
  const results = await json(
    await fetch(`${api}/public/searches/${search.searchId}/results`, { headers: guestHeaders }),
  );
  if (!results.items.some((photo) => photo.photoId === completed.photoId)) {
    throw new Error('The indexed photograph was not returned for its matching selfie');
  }

  const unauthorized = await fetch(`${api}/public/searches/${search.searchId}/download-selected`, {
    method: 'POST',
    headers: { ...guestHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoIds: [randomUUID()] }),
  });
  if (unauthorized.status !== 403) {
    throw new Error(`Unauthorized selected download returned ${unauthorized.status}`);
  }

  const zipStarted = performance.now();
  const zipRequest = await json(
    await fetch(`${api}/public/searches/${search.searchId}/download-selected`, {
      method: 'POST',
      headers: { ...guestHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds: [completed.photoId] }),
    }),
  );
  let zipJob;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    zipJob = await json(
      await fetch(`${api}/public/download-jobs/${zipRequest.jobId}`, { headers: guestHeaders }),
    );
    if (zipJob.status === 'COMPLETED' || zipJob.status === 'FAILED') break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (zipJob?.status !== 'COMPLETED' || !zipJob.url) {
    throw new Error(`Selected ZIP did not complete: ${JSON.stringify(zipJob)}`);
  }
  const zip = await fetch(zipJob.url, { headers: { Range: 'bytes=0-3' } });
  const signature = Buffer.from(await zip.arrayBuffer())
    .subarray(0, 4)
    .toString('hex');
  if (signature !== '504b0304') throw new Error('Selected download was not a ZIP archive');

  console.log(`MODEL=${indexedPhoto.modelVersion}`);
  console.log(`INDEXED_FACES=${indexedPhoto.faceCount}`);
  console.log(`AUTHORIZED_MATCHES=${results.items.length}`);
  console.log(`SELECTED_ZIP_SECONDS=${((performance.now() - zipStarted) / 1000).toFixed(2)}`);
  console.log('SELECTED_ZIP_TEST=passed');
  console.log('UNAUTHORIZED_SELECTION_TEST=passed');
  console.log('FACE_MATCHING_SMOKE_TEST=passed');
} finally {
  if (event?.id) {
    await fetch(`${api}/events/${event.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie, 'X-CSRF-Token': csrf },
    });
  }
}
