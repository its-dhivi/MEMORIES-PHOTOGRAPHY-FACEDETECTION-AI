import type {
  ApiError,
  AuthenticatedUser,
  DashboardOverview,
  EventSettings,
  EventView,
  Paginated,
  PhotoView,
  ProcessingJobView,
  QrAssets,
  UploadAuthorization,
} from '@memories/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function csrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find((value) => value.startsWith('csrf_token='))
    ?.split('=')[1];
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  const csrf = csrfToken();
  if (csrf) headers.set('X-CSRF-Token', decodeURIComponent(csrf));
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
  if (response.status === 401 && retry && !['/auth/login', '/auth/refresh'].includes(path)) {
    const refreshed = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshed.ok) return apiRequest<T>(path, init, false);
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiError | null;
    const message = Array.isArray(error?.message)
      ? error.message.join(', ')
      : (error?.message ?? 'Request failed');
    throw new ApiRequestError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const authApi = {
  login: (input: { email: string; password: string }) =>
    apiRequest<AuthenticatedUser>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  me: () => apiRequest<AuthenticatedUser>('/auth/me'),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
  forgotPassword: (email: string) =>
    apiRequest<{ accepted: true; developmentToken?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (input: { token: string; password: string }) =>
    apiRequest<void>('/auth/reset-password', { method: 'POST', body: JSON.stringify(input) }),
};

function queryString(values: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

export const dashboardApi = {
  overview: () => apiRequest<DashboardOverview>('/dashboard/overview'),
  recentEvents: () => apiRequest<Paginated<EventView>>('/dashboard/recent-events'),
  analytics: () =>
    apiRequest<{
      eventsOverTime: Array<{ date: string; count: number }>;
      photosOverTime: Array<{ date: string; count: number; bytes: number }>;
      processing: Record<string, number>;
      events: Array<{
        id: string;
        title: string;
        eventDate: string;
        photoCount: number;
        storageBytes: number;
      }>;
    }>('/dashboard/analytics'),
};

export const eventsApi = {
  list: (filters: Record<string, string | number | undefined> = {}) =>
    apiRequest<Paginated<EventView>>(`/events${queryString(filters)}`),
  get: (id: string) => apiRequest<EventView>(`/events/${id}`),
  create: (input: Record<string, unknown>) =>
    apiRequest<EventView>('/events', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Record<string, unknown>) =>
    apiRequest<EventView>(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) => apiRequest<void>(`/events/${id}`, { method: 'DELETE' }),
  settings: (id: string) => apiRequest<EventSettings>(`/events/${id}/settings`),
  updateSettings: (id: string, input: Record<string, unknown>) =>
    apiRequest<EventSettings>(`/events/${id}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  privateSearch: (id: string, selfie: File) => {
    const body = new FormData();
    body.append('selfie', selfie);
    body.append('consent', 'true');
    return apiRequest<{
      status: string;
      threshold: number;
      results: Array<{
        photoId: string;
        filename: string;
        similarity: number;
        previewUrl: string | null;
      }>;
    }>(`/events/${id}/matching/private-search`, { method: 'POST', body });
  },
  qr: (id: string) => apiRequest<QrAssets>(`/events/${id}/qr`),
};

export const photosApi = {
  list: (eventId: string, filters: Record<string, string | number | undefined> = {}) =>
    apiRequest<Paginated<PhotoView>>(`/events/${eventId}/photos${queryString(filters)}`),
  initialize: (eventId: string, input: Record<string, unknown>) =>
    apiRequest<UploadAuthorization>(`/events/${eventId}/photos/upload-init`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  complete: (
    eventId: string,
    uploadSessionId: string,
    parts?: Array<{ partNumber: number; etag: string; checksumSHA256?: string }>,
  ) =>
    apiRequest<{ photoId: string; queued: boolean }>(`/events/${eventId}/photos/upload-complete`, {
      method: 'POST',
      body: JSON.stringify({ uploadSessionId, parts }),
    }),
  partUrl: (eventId: string, input: Record<string, unknown>) =>
    apiRequest<{
      partNumber: number;
      uploadUrl: string;
      headers: Record<string, string>;
      expiresAt: string;
    }>(`/events/${eventId}/photos/upload-part`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  uploadState: (eventId: string, sessionId: string) =>
    apiRequest<{
      uploadSessionId: string;
      status: string;
      uploadMode: string;
      partSize: number | null;
      byteSize: number;
      sha256: string;
      expiresAt: string;
      parts: Array<{
        partNumber: number;
        etag: string;
        size: number;
        checksumSHA256?: string;
      }>;
    }>(`/events/${eventId}/photos/uploads/${sessionId}`),
  cancelUpload: (eventId: string, sessionId: string) =>
    apiRequest<void>(`/events/${eventId}/photos/uploads/${sessionId}`, { method: 'DELETE' }),
  remove: (id: string) => apiRequest<void>(`/photos/${id}`, { method: 'DELETE' }),
  reprocess: (id: string) =>
    apiRequest<{ jobId: string; queued: boolean }>(`/photos/${id}/reprocess`, { method: 'POST' }),
  diagnostics: (eventId: string, photoId: string) =>
    apiRequest<FaceDiagnostic>(`/events/${eventId}/photos/${photoId}/diagnostics`),
  probe: (eventId: string, photoId: string, selfie: File) => {
    const body = new FormData();
    body.append('selfie', selfie);
    return apiRequest<FaceProbe>(`/events/${eventId}/photos/${photoId}/diagnostics/probe`, {
      method: 'POST',
      body,
    });
  },
};

export interface FaceDiagnostic {
  photoId: string;
  filename: string;
  status: string;
  failureCode: string | null;
  derivativeStatus: string;
  modelVersion: string | null;
  detectionVersion: string | null;
  indexedFaces: Array<{
    faceIndex: number;
    modelVersion: string;
    preprocessingVersion: string;
    qualityStatus: string;
  }>;
  observation: {
    modelVersion: string;
    preprocessingVersion: string;
    detectionPipelineVersion: string;
    width: number;
    height: number;
    faces: Array<{
      boundingBox: { x: number; y: number; width: number; height: number };
      detectionConfidence: number;
      qualityScore: number;
      qualityStatus: string;
      landmarks: number[][] | null;
      alignedPreview: string | null;
      embeddingStatus: string;
    }>;
  } | null;
  previewUrl: string | null;
  originalUrl: string;
  reason: string | null;
}

export interface FaceProbe {
  similarity: number | null;
  threshold: number;
  accepted: boolean;
  reason: string;
  modelVersion: string;
  preprocessingVersion: string;
  resultLimit: number;
}

export const processingApi = {
  jobs: (filters: Record<string, string | number | undefined> = {}) =>
    apiRequest<Paginated<ProcessingJobView>>(`/processing/jobs${queryString(filters)}`),
  stats: () =>
    apiRequest<{
      counts: Record<string, number>;
      retryAttempts: number;
      workers: { thumbnail: number; ai: number; deletion: number; aiAvailable: boolean };
      photos: {
        total: number;
        indexed: number;
        withFaces: number;
        noFaces: number;
        failed: number;
        averageProcessingDurationMs: number;
      };
      model: { ready: boolean; modelVersion?: string; providers?: string[] };
    }>('/processing/stats'),
  retry: (id: string) =>
    apiRequest<{ jobId: string; queued: boolean }>(`/processing/jobs/${id}/retry`, {
      method: 'POST',
    }),
};

export const publicEventsApi = {
  get: (slug: string) =>
    apiRequest<{
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
    }>(`/public/events/${encodeURIComponent(slug)}`),
};
