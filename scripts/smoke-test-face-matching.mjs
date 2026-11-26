import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const envFile = await readFile(new URL('../.env', import.meta.url), 'utf8');
const localEnv = Object.fromEntries(
  envFile
    .split(/\r?\n/)
    .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
const api =
  process.env.NEXT_PUBLIC_API_URL ?? localEnv.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const eventTitle = process.env.MEMORIES_TEST_EVENT ?? 'Projection Corporate Event';
const selfiePath = process.env.MEMORIES_CONSENTED_SELFIE_PATH;
if (!selfiePath)
  throw new Error(
    'Set MEMORIES_CONSENTED_SELFIE_PATH to a selfie with permission for this private test.',
  );
const selfie = await readFile(resolve(selfiePath));
const mimetype = selfie.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
  ? 'image/jpeg'
  : selfie.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? 'image/png'
    : selfie.length >= 12 &&
        selfie.toString('ascii', 0, 4) === 'RIFF' &&
        selfie.toString('ascii', 8, 12) === 'WEBP'
      ? 'image/webp'
      : null;
if (!mimetype) throw new Error('The consented test selfie must be JPEG, PNG, or WebP.');

async function json(response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${response.status}: ${body?.message ?? 'Request failed'}`);
  return body;
}

const loginResponse = await fetch(`${api}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: localEnv.SEED_ADMIN_EMAIL,
    password: localEnv.SEED_ADMIN_PASSWORD,
  }),
});
if (!loginResponse.ok) throw new Error('Admin login failed.');
await loginResponse.json();
const cookies = loginResponse.headers.getSetCookie().map((cookie) => cookie.split(';', 1)[0]);
const cookie = cookies.join('; ');
const csrfCookie = cookies.find((value) => value.startsWith('csrf_token='));
if (!cookie.includes('access_token=') || !csrfCookie)
  throw new Error('Login cookies were incomplete.');
const csrf = decodeURIComponent(csrfCookie.slice('csrf_token='.length));
const response = await fetch(
  `${api}/events?search=${encodeURIComponent(eventTitle)}&page=1&pageSize=100`,
  {
    headers: { Cookie: cookie },
  },
);
const events = await json(response);
const event = events.items.find((item) => item.title === eventTitle);
if (!event)
  throw new Error(`No authorized event named "${eventTitle}" was found for this admin account.`);

const form = new FormData();
form.set('selfie', new Blob([selfie], { type: mimetype }), 'consented-private-test-selfie');
form.set('consent', 'true');
const result = await json(
  await fetch(`${api}/events/${event.id}/matching/private-search`, {
    method: 'POST',
    headers: { Cookie: cookie, 'X-CSRF-Token': csrf },
    body: form,
  }),
);
console.log(`PRIVATE_SEARCH_STATUS=${result.status}`);
console.log(`MATCH_COUNT=${result.results.length}`);
console.log(`THRESHOLD=${result.threshold}`);
console.log('PRIVATE_FACE_MATCHING_SMOKE_TEST=passed');
