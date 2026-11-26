import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'memories_guest_session';
const API_URL =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Context = { params: Promise<{ path: string[] }> };

function backendPath(parts: string[]): string | null {
  const path = parts.join('/');
  const rules: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/^events\/([^/]+)$/, (m) => `/public/events/${encodeURIComponent(m[1]!)}`],
    [/^events\/([^/]+)\/session$/, (m) => `/public/events/${encodeURIComponent(m[1]!)}/session`],
    [/^events\/([^/]+)\/consent$/, (m) => `/public/events/${encodeURIComponent(m[1]!)}/consent`],
    [/^events\/([^/]+)\/search$/, (m) => `/public/events/${encodeURIComponent(m[1]!)}/search`],
    [/^searches\/([0-9a-f-]+)$/, (m) => `/public/searches/${m[1]}`],
    [/^searches\/([0-9a-f-]+)\/results$/, (m) => `/public/searches/${m[1]}/results`],
    [/^searches\/([0-9a-f-]+)\/download-all$/, (m) => `/public/searches/${m[1]}/download-all`],
    [
      /^searches\/([0-9a-f-]+)\/download-selected$/,
      (m) => `/public/searches/${m[1]}/download-selected`,
    ],
    [/^photos\/([0-9a-f-]+)\/download$/, (m) => `/public/photos/${m[1]}/download`],
    [/^download-jobs\/([0-9a-f-]+)$/, (m) => `/public/download-jobs/${m[1]}`],
  ];
  for (const [pattern, build] of rules) {
    const match = path.match(pattern);
    if (match) return build(match);
  }
  return null;
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  return (
    (!origin || origin === request.nextUrl.origin) && (!fetchSite || fetchSite === 'same-origin')
  );
}

async function proxy(request: NextRequest, context: Context) {
  const { path: parts } = await context.params;
  const target = backendPath(parts);
  if (!target) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  if (request.method !== 'GET' && !sameOrigin(request))
    return NextResponse.json({ message: 'Cross-site request blocked' }, { status: 403 });

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  if (token) headers.set('x-guest-session', token);

  const isSessionCreate =
    request.method === 'POST' && /^\/public\/events\/[^/]+\/session$/.test(target);
  const actualTarget = isSessionCreate ? `${target}s` : target;
  const response = await fetch(`${API_URL}${actualTarget}${request.nextUrl.search}`, {
    method: request.method,
    headers,
    ...(request.method === 'GET' ? {} : { body: await request.arrayBuffer() }),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({ message: 'Upstream service unavailable' }));
  const outgoing = NextResponse.json(
    isSessionCreate && response.ok ? { expiresAt: payload.expiresAt } : payload,
    { status: response.status, headers: { 'Cache-Control': 'no-store' } },
  );
  if (isSessionCreate && response.ok && typeof payload.guestSessionToken === 'string') {
    outgoing.cookies.set(COOKIE_NAME, payload.guestSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(payload.expiresAt),
      priority: 'high',
    });
  }
  const isWithdrawal =
    target.endsWith('/consent') && request.method === 'POST' && payload.consented === false;
  if (isWithdrawal || response.status === 401) outgoing.cookies.delete(COOKIE_NAME);
  return outgoing;
}

export const dynamic = 'force-dynamic';
export const GET = proxy;
export const POST = proxy;
