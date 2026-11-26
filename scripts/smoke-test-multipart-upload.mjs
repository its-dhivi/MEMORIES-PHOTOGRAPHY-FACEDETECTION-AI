import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { appendFile, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const targetBytes = Number(process.argv[2] ?? 34 * 1024 * 1024);
const partSize = 16 * 1024 * 1024;
const path = join(tmpdir(), `memories-multipart-${process.pid}.jpg`);
const env = Object.fromEntries(
  (await readFile(new URL('../.env', import.meta.url), 'utf8'))
    .split(/\r?\n/)
    .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
    .map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1)];
    }),
);
const api = env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const started = performance.now();
let eventId;

async function responseJson(response) {
  response = await response;
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(body)}`);
  return body;
}

try {
  const source = new Uint8Array(
    await (
      await fetch('https://raw.githubusercontent.com/opencv/opencv/master/samples/data/lena.jpg')
    ).arrayBuffer(),
  );
  await appendFile(path, source);
  const handle = await open(path, 'r+');
  await handle.truncate(targetBytes);
  await handle.close();

  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path, { highWaterMark: partSize })) hash.update(chunk);
  const sha256 = hash.digest('hex');

  const login = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD }),
  });
  await responseJson(login);
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(';', 1)[0])
    .join('; ');
  const csrf = decodeURIComponent(
    cookie
      .split('; ')
      .find((value) => value.startsWith('csrf_token='))
      ?.slice(11) ?? '',
  );
  const admin = (route, init = {}) =>
    responseJson(
      fetch(`${api}${route}`, {
        ...init,
        headers: {
          Cookie: cookie,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(!['GET', 'HEAD'].includes(init.method ?? 'GET') ? { 'X-CSRF-Token': csrf } : {}),
          ...init.headers,
        },
      }),
    );
  const event = await admin('/events', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Multipart transport smoke test',
      type: 'OTHER',
      eventDate: new Date().toISOString(),
      publicSlug: `multipart-smoke-${Date.now()}`,
    }),
  });
  eventId = event.id;
  const authorization = await admin(`/events/${eventId}/photos/upload-init`, {
    method: 'POST',
    body: JSON.stringify({
      filename: 'large-dslr-original.jpg',
      mimeType: 'image/jpeg',
      byteSize: targetBytes,
      sha256,
      idempotencyKey: randomUUID(),
    }),
  });
  if (authorization.uploadMode !== 'MULTIPART') throw new Error('Multipart mode was not selected');

  const file = await open(path, 'r');
  const parts = [];
  for (let partNumber = 1, offset = 0; offset < targetBytes; partNumber += 1, offset += partSize) {
    const length = Math.min(partSize, targetBytes - offset);
    const buffer = Buffer.allocUnsafe(length);
    await file.read(buffer, 0, length, offset);
    const checksumSHA256 = createHash('sha256').update(buffer).digest('base64');
    const signed = await admin(`/events/${eventId}/photos/upload-part`, {
      method: 'POST',
      body: JSON.stringify({
        uploadSessionId: authorization.uploadSessionId,
        partNumber,
        checksumSHA256,
      }),
    });
    const uploaded = await fetch(signed.uploadUrl, {
      method: 'PUT',
      headers: signed.headers,
      body: buffer,
    });
    if (!uploaded.ok) throw new Error(`Part ${partNumber} failed with ${uploaded.status}`);
    parts.push({
      partNumber,
      etag: uploaded.headers.get('etag'),
      checksumSHA256,
    });
  }
  await file.close();
  const completed = await admin(`/events/${eventId}/photos/upload-complete`, {
    method: 'POST',
    body: JSON.stringify({ uploadSessionId: authorization.uploadSessionId, parts }),
  });
  const elapsed = (performance.now() - started) / 1000;
  console.log(`BYTES=${targetBytes}`);
  console.log(`PARTS=${parts.length}`);
  console.log(`SECONDS=${elapsed.toFixed(2)}`);
  console.log(`THROUGHPUT_MIB_S=${(targetBytes / 1024 / 1024 / elapsed).toFixed(2)}`);
  console.log(`PEAK_NODE_RSS_MIB=${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)}`);
  console.log(`PHOTO_CREATED=${Boolean(completed.photoId)}`);
  console.log('MULTIPART_STORAGE_TEST=passed');
} finally {
  if (eventId) {
    const login = await fetch(`${api}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD }),
    });
    await login.json().catch(() => null);
    const cookie = login.headers
      .getSetCookie()
      .map((value) => value.split(';', 1)[0])
      .join('; ');
    const csrf = decodeURIComponent(
      cookie
        .split('; ')
        .find((value) => value.startsWith('csrf_token='))
        ?.slice(11) ?? '',
    );
    await fetch(`${api}/events/${eventId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie, 'X-CSRF-Token': csrf },
    }).catch(() => undefined);
  }
  await rm(path, { force: true });
}
