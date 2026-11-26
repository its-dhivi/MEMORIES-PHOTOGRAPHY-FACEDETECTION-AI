export type PlatformRole = 'SUPER_ADMIN' | 'USER';
export type StudioRole = 'OWNER' | 'ADMIN' | 'PHOTOGRAPHER';
export interface Membership {
  studioId: string;
  studioName: string;
  role: StudioRole;
}
export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  platformRole: PlatformRole;
  memberships: Membership[];
}
export interface ApiError {
  statusCode: number;
  message: string | string[];
  path: string;
  timestamp: string;
}

export type EventType = 'WEDDING' | 'RECEPTION' | 'BIRTHDAY' | 'CORPORATE' | 'OTHER';
export type EventStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'ARCHIVED' | 'DELETING';
export type PhotoStatus =
  | 'PENDING'
  | 'UPLOADING'
  | 'UPLOADED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'DELETED';

export interface ProcessingSummary {
  ready: number;
  failed: number;
  pending: number;
  percent: number;
}

export interface EventView {
  id: string;
  title: string;
  type: EventType;
  description: string | null;
  eventDate: string;
  location: string | null;
  status: EventStatus;
  publicSlug: string;
  coverPhotoId: string | null;
  coverUrl: string | null;
  publicUrl: string;
  photoCount: number;
  storageBytes: number;
  processing: ProcessingSummary;
  settings?: EventSettings;
}

export interface EventSettings {
  accessEnabled: boolean;
  accessExpiresAt: string | null;
  accessPinConfigured: boolean;
  downloadsEnabled: boolean;
  downloadAllEnabled: boolean;
  retentionDays: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DashboardOverview {
  totalEvents: number;
  activeEvents: number;
  completedEvents: number;
  totalPhotos: number;
  storageBytes: number;
  awaitingProcessing: number;
  processedPhotos: number;
  failedJobs: number;
  guestSearches: number;
}

export interface PhotoView {
  id: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  status: PhotoStatus;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
  processedAt: string | null;
  faceCount: number | null;
  skippedFaceCount: number | null;
  modelVersion: string | null;
  processingDurationMs: number | null;
  thumbnailUrl: string | null;
  previewUrl: string;
}

export interface UploadAuthorization {
  duplicate: boolean;
  photoId?: string;
  uploadSessionId?: string;
  uploadUrl?: string;
  headers?: Record<string, string>;
  expiresAt?: string;
  uploadMode?: 'SINGLE' | 'MULTIPART';
  partSize?: number;
}

export interface QrAssets {
  eventId: string;
  eventTitle: string;
  url: string;
  svg: string;
  pngDataUrl: string;
}

export interface ProcessingJobView {
  id: string;
  type: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  errorSummary: string | null;
  createdAt: string;
  event: { id: string; title: string };
  photo: { id: string; originalFilename: string } | null;
}
