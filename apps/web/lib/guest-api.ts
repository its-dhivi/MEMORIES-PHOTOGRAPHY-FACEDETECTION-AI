export class GuestApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/guest${path}`, { ...init, cache: 'no-store' });
  const data = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
  if (!response.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new GuestApiError(response.status, message ?? 'Request failed');
  }
  return data as T;
}

export interface PublicEvent {
  title: string;
  type: string;
  description: string | null;
  eventDate: string;
  location: string | null;
  studioName: string;
  coverUrl: string | null;
  available: boolean;
  pinRequired: boolean;
  finderAvailable: boolean;
  finderMessage: string;
  consentVersion: string;
}
export interface SearchResults {
  searchId: string;
  expiresAt: string;
  downloadsEnabled: boolean;
  downloadAllEnabled: boolean;
  items: Array<{
    photoId: string;
    filename: string;
    thumbnailUrl: string | null;
    previewUrl: string | null;
  }>;
}

export const guestApi = {
  event: (slug: string) => request<PublicEvent>(`/events/${encodeURIComponent(slug)}`),
  createSession: (slug: string, pin = '') =>
    request<{ expiresAt: string }>(`/events/${encodeURIComponent(slug)}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    }),
  session: (slug: string) =>
    request<{ expiresAt: string; consented: boolean; consentVersion: string }>(
      `/events/${encodeURIComponent(slug)}/session`,
    ),
  consent: (slug: string, version: string, accepted: boolean) =>
    request<{ consented: boolean }>(`/events/${encodeURIComponent(slug)}/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, accepted }),
    }),
  search: (slug: string, selfie: File) => {
    const body = new FormData();
    body.set('selfie', selfie);
    return request<{ searchId: string; status: string; expiresAt: string }>(
      `/events/${encodeURIComponent(slug)}/search`,
      { method: 'POST', body },
    );
  },
  status: (id: string) =>
    request<{ id: string; status: string; failureCode: string | null; expiresAt: string }>(
      `/searches/${id}`,
    ),
  results: (id: string) => request<SearchResults>(`/searches/${id}/results`),
  download: (photoId: string, searchId: string) =>
    request<{ url: string; expiresInSeconds: number }>(`/photos/${photoId}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchId }),
    }),
  downloadAll: (searchId: string) =>
    request<{ jobId: string; status: string; expiresAt: string }>(
      `/searches/${searchId}/download-all`,
      { method: 'POST' },
    ),
  downloadSelected: (searchId: string, photoIds: string[]) =>
    request<{ jobId: string; status: string; expiresAt: string }>(
      `/searches/${searchId}/download-selected`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds }),
      },
    ),
  downloadJob: (jobId: string) =>
    request<{
      jobId: string;
      status: string;
      failureCode: string | null;
      url: string | null;
      expiresAt: string;
      progress: { completed: number; total: number } | number | null;
    }>(`/download-jobs/${jobId}`),
};
