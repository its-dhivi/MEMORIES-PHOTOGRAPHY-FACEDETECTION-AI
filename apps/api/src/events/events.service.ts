import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import {
  AuditActorType,
  DownloadJobStatus,
  EventStatus,
  Prisma,
  SearchStatus,
  StudioRole,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../infrastructure/storage.service';
import { StudioAccessService } from '../auth/studio-access.service';
import type {
  CreateEventDto,
  ApproveMatchingDto,
  ListEventsDto,
  UpdateEventDto,
  UpdateEventSettingsDto,
} from './events.dto';

const WRITE_ROLES = [StudioRole.OWNER, StudioRole.ADMIN, StudioRole.PHOTOGRAPHER];
const APPROVAL_ROLES = [StudioRole.OWNER, StudioRole.ADMIN];

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StudioAccessService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    @InjectQueue('event-deletion') private readonly deletionQueue: Queue,
  ) {}

  async list(studioId: string, input: ListEventsDto) {
    const where: Prisma.EventWhereInput = {
      studioId,
      deletedAt: null,
      ...(input.status ? { status: input.status } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.search
        ? {
            OR: [
              { title: { contains: input.search, mode: 'insensitive' } },
              { location: { contains: input.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, events] = await this.prisma.$transaction([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        orderBy: { eventDate: input.sort },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: {
          coverPhoto: { select: { thumbnailKey: true, previewKey: true, originalKey: true } },
          _count: { select: { photos: { where: { deletedAt: null } } } },
        },
      }),
    ]);
    const photoStats = events.length
      ? await this.prisma.photo.groupBy({
          by: ['eventId', 'status'],
          where: { eventId: { in: events.map((event) => event.id) }, deletedAt: null },
          _count: true,
          _sum: { byteSize: true },
        })
      : [];
    return {
      items: await Promise.all(
        events.map((event) =>
          this.toEventView(
            event,
            photoStats.filter((stat) => stat.eventId === event.id),
          ),
        ),
      ),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
    };
  }

  async create(userId: string, studioId: string, input: CreateEventDto) {
    try {
      const event = await this.prisma.event.create({
        data: {
          studioId,
          title: input.title.trim(),
          type: input.type,
          description: input.description?.trim() || null,
          eventDate: new Date(input.eventDate),
          location: input.location?.trim() || null,
          publicSlug: input.publicSlug,
          settings: { create: {} },
          auditLogs: {
            create: {
              studioId,
              userId,
              actorType: AuditActorType.USER,
              action: 'event.created',
              resourceType: 'Event',
            },
          },
        },
        include: { settings: true },
      });
      return this.get(userId, event.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('That public slug is already in use');
      }
      throw error;
    }
  }

  async get(userId: string, eventId: string) {
    await this.access.requireEventAccess(userId, eventId);
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        studio: { select: { id: true, name: true } },
        settings: true,
        coverPhoto: { select: { thumbnailKey: true, previewKey: true, originalKey: true } },
        _count: { select: { photos: { where: { deletedAt: null } } } },
      },
    });
    if (!event || event.deletedAt) throw new NotFoundException('Event not found');
    const photoStats = await this.prisma.photo.groupBy({
      by: ['eventId', 'status'],
      where: { eventId, deletedAt: null },
      _count: true,
      _sum: { byteSize: true },
    });
    return this.toEventView(event, photoStats);
  }

  async update(userId: string, eventId: string, input: UpdateEventDto) {
    const { studioId } = await this.access.requireEventAccess(userId, eventId, WRITE_ROLES);
    if (input.coverPhotoId) {
      const photo = await this.prisma.photo.findFirst({
        where: { id: input.coverPhotoId, eventId, deletedAt: null },
        select: { id: true },
      });
      if (!photo) throw new NotFoundException('Cover photograph not found in this event');
    }
    try {
      await this.prisma.$transaction([
        this.prisma.event.update({
          where: { id: eventId },
          data: {
            ...(input.title !== undefined ? { title: input.title.trim() } : {}),
            ...(input.type !== undefined ? { type: input.type } : {}),
            ...(input.description !== undefined
              ? { description: input.description.trim() || null }
              : {}),
            ...(input.eventDate !== undefined ? { eventDate: new Date(input.eventDate) } : {}),
            ...(input.location !== undefined ? { location: input.location.trim() || null } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.publicSlug !== undefined ? { publicSlug: input.publicSlug } : {}),
            ...(input.coverPhotoId !== undefined ? { coverPhotoId: input.coverPhotoId } : {}),
          },
        }),
        this.prisma.auditLog.create({
          data: {
            studioId,
            eventId,
            userId,
            actorType: AuditActorType.USER,
            action: 'event.updated',
            resourceType: 'Event',
            resourceId: eventId,
          },
        }),
      ]);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('That public slug is already in use');
      }
      throw error;
    }
    return this.get(userId, eventId);
  }

  async remove(userId: string, eventId: string): Promise<void> {
    const existing = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, studioId: true, deletedAt: true },
    });
    if (!existing) return;
    await this.access.requireMembership(userId, existing.studioId, [
      StudioRole.OWNER,
      StudioRole.ADMIN,
    ]);
    if (existing.deletedAt) return;
    const job = await this.prisma.$transaction(async (tx) => {
      await tx.event.update({
        where: { id: eventId },
        data: { status: EventStatus.DELETING, deletedAt: new Date() },
      });
      await tx.photo.updateMany({
        where: { eventId, deletedAt: null },
        data: { status: 'DELETED', deletedAt: new Date() },
      });
      const deletion = await tx.processingJob.upsert({
        where: { idempotencyKey: `event-delete:${eventId}` },
        create: {
          eventId,
          type: 'EVENT_DELETE',
          idempotencyKey: `event-delete:${eventId}`,
          payload: { eventId },
        },
        update: {},
      });
      await tx.auditLog.create({
        data: {
          studioId: existing.studioId,
          eventId,
          userId,
          actorType: AuditActorType.USER,
          action: 'event.deletion_requested',
          resourceType: 'Event',
          resourceId: eventId,
        },
      });
      return deletion;
    });
    try {
      const queued = await this.deletionQueue.add(
        'delete-event',
        { eventId, processingJobId: job.id },
        { jobId: job.id },
      );
      await this.prisma.processingJob.update({
        where: { id: job.id },
        data: { queueJobId: String(queued.id) },
      });
    } catch {
      await this.prisma.processingJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', error: { message: 'Deletion queue is unavailable' } },
      });
      throw new ServiceUnavailableException(
        'Event deletion was recorded but the queue is unavailable',
      );
    }
  }

  async getSettings(userId: string, eventId: string) {
    await this.access.requireEventAccess(userId, eventId);
    const settings = await this.prisma.eventSettings.findUnique({ where: { eventId } });
    if (!settings) throw new NotFoundException('Event settings not found');
    return {
      ...settings,
      accessPinConfigured: Boolean(settings.accessPinHash),
      accessPinHash: undefined,
    };
  }

  async updateSettings(userId: string, eventId: string, input: UpdateEventSettingsDto) {
    const { studioId } = await this.access.requireEventAccess(userId, eventId, WRITE_ROLES);
    const accessPinHash = input.accessPin
      ? await argon2.hash(input.accessPin, { type: argon2.argon2id })
      : undefined;
    await this.prisma.$transaction([
      this.prisma.eventSettings.update({
        where: { eventId },
        data: {
          ...(input.accessEnabled !== undefined ? { accessEnabled: input.accessEnabled } : {}),
          ...(accessPinHash ? { accessPinHash } : {}),
          ...(input.clearAccessPin ? { accessPinHash: null } : {}),
          ...(input.accessExpiresAt !== undefined
            ? { accessExpiresAt: new Date(input.accessExpiresAt) }
            : {}),
          ...(input.downloadsEnabled !== undefined
            ? { downloadsEnabled: input.downloadsEnabled }
            : {}),
          ...(input.downloadAllEnabled !== undefined
            ? { downloadAllEnabled: input.downloadAllEnabled }
            : {}),
          ...(input.retentionDays !== undefined ? { retentionDays: input.retentionDays } : {}),
        },
      }),
      this.prisma.auditLog.create({
        data: {
          studioId,
          eventId,
          userId,
          actorType: AuditActorType.USER,
          action: 'event.settings_updated',
          resourceType: 'EventSettings',
          resourceId: eventId,
        },
      }),
    ]);
    return this.getSettings(userId, eventId);
  }

  async approveMatching(userId: string, eventId: string, input: ApproveMatchingDto) {
    const { studioId } = await this.access.requireEventAccess(userId, eventId, APPROVAL_ROLES);
    const settings = await this.prisma.eventSettings.findUnique({ where: { eventId } });
    if (!settings) throw new NotFoundException('Event settings not found');
    const expectedModel = this.config.getOrThrow<string>('FACE_MODEL_VERSION');
    const expectedPreprocessing = this.config.get<string>(
      'FACE_PREPROCESSING_VERSION',
      'auraface-rgb-112-v1',
    );
    if (
      input.modelVersion !== expectedModel ||
      input.preprocessingVersion !== expectedPreprocessing
    ) {
      throw new BadRequestException('Approval must match the active recognition pipeline');
    }
    const evidence = input.evaluationResults;
    const smokeOnly = input.source === 'smoke-test' && process.env.NODE_ENV !== 'production';
    if (process.env.NODE_ENV === 'production') {
      if (/synthetic|controlface|smoke/i.test(input.source)) {
        throw new BadRequestException(
          'Production approval requires representative consented event data',
        );
      }
      const secret = this.config.getOrThrow<string>('EVALUATION_SIGNING_SECRET');
      const payload = {
        eventId,
        threshold: input.threshold,
        modelVersion: input.modelVersion,
        preprocessingVersion: input.preprocessingVersion,
        source: input.source,
        evaluationResults: evidence,
      };
      const expected = createHmac('sha256', secret).update(canonicalJson(payload)).digest();
      const provided = Buffer.from(input.evidenceSignature ?? '', 'hex');
      if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
        throw new BadRequestException(
          'Production approval requires a trusted signed evaluation artifact',
        );
      }
      const events = Number(evidence.events);
      const queries = Number(evidence.queries);
      const recall = Number(evidence.photo_recall);
      const precisionLower = Number(evidence.photo_precision_95pct_wilson_lower);
      const farInterval = evidence.false_accept_rate_95pct_wilson;
      const farUpper = Array.isArray(farInterval) ? Number(farInterval[1]) : Number.NaN;
      if (
        ![events, queries, recall, precisionLower, farUpper].every(Number.isFinite) ||
        events < 3 ||
        queries < 1000 ||
        recall < 0.5 ||
        precisionLower < 0.99 ||
        farUpper > 0.001
      ) {
        throw new BadRequestException(
          'Gallery evaluation does not meet the production event, sample, precision, recall, and false-acceptance criteria',
        );
      }
    } else if (!smokeOnly) {
      const truePositive = Number(evidence.true_positive);
      const falsePositive = Number(evidence.false_positive);
      const trueNegative = Number(evidence.true_negative);
      const falseNegative = Number(evidence.false_negative);
      const precision = truePositive / (truePositive + falsePositive);
      const far = falsePositive / (falsePositive + trueNegative);
      if (
        ![truePositive, falsePositive, trueNegative, falseNegative].every(Number.isSafeInteger) ||
        truePositive < 10 ||
        falsePositive < 0 ||
        trueNegative < 1000 ||
        falseNegative < 0 ||
        precision < 0.99 ||
        far > 0.001
      ) {
        throw new BadRequestException('Evaluation evidence does not meet approval requirements');
      }
    }
    await this.prisma.$transaction([
      this.prisma.eventSettings.update({
        where: { eventId },
        data: {
          previousSimilarityThreshold: settings.similarityThreshold,
          similarityThreshold: input.threshold,
          matchingApprovedAt: new Date(),
          matchingApprovedById: userId,
          matchingModelVersion: input.modelVersion,
          matchingPreprocessingVersion: input.preprocessingVersion,
          matchingApprovalEvidence: {
            source: input.source,
            evaluationResults: evidence as Prisma.InputJsonObject,
          },
        },
      }),
      this.prisma.photoSearch.updateMany({
        where: { eventId, status: SearchStatus.COMPLETED },
        data: { status: SearchStatus.EXPIRED },
      }),
      this.prisma.guestDownloadJob.updateMany({
        where: {
          eventId,
          status: {
            in: [
              DownloadJobStatus.PENDING,
              DownloadJobStatus.PROCESSING,
              DownloadJobStatus.COMPLETED,
            ],
          },
        },
        data: { status: DownloadJobStatus.EXPIRED },
      }),
      this.prisma.auditLog.create({
        data: {
          studioId,
          eventId,
          userId,
          actorType: AuditActorType.USER,
          action: 'event.face_matching_approved',
          resourceType: 'EventSettings',
          resourceId: eventId,
          metadata: { modelVersion: input.modelVersion, threshold: input.threshold },
        },
      }),
    ]);
    return this.getSettings(userId, eventId);
  }

  async revokeMatching(userId: string, eventId: string) {
    const { studioId } = await this.access.requireEventAccess(userId, eventId, APPROVAL_ROLES);
    const settings = await this.prisma.eventSettings.findUnique({ where: { eventId } });
    if (!settings) throw new NotFoundException('Event settings not found');
    await this.prisma.$transaction([
      this.prisma.eventSettings.update({
        where: { eventId },
        data: {
          similarityThreshold: settings.previousSimilarityThreshold ?? settings.similarityThreshold,
          matchingApprovedAt: null,
          matchingApprovedById: null,
          matchingModelVersion: null,
          matchingPreprocessingVersion: null,
        },
      }),
      this.prisma.photoSearch.updateMany({
        where: { eventId, status: SearchStatus.COMPLETED },
        data: { status: SearchStatus.EXPIRED },
      }),
      this.prisma.guestDownloadJob.updateMany({
        where: {
          eventId,
          status: {
            in: [
              DownloadJobStatus.PENDING,
              DownloadJobStatus.PROCESSING,
              DownloadJobStatus.COMPLETED,
            ],
          },
        },
        data: { status: DownloadJobStatus.EXPIRED },
      }),
      this.prisma.auditLog.create({
        data: {
          studioId,
          eventId,
          userId,
          actorType: AuditActorType.USER,
          action: 'event.face_matching_revoked',
          resourceType: 'EventSettings',
          resourceId: eventId,
        },
      }),
    ]);
    return this.getSettings(userId, eventId);
  }

  private async toEventView(
    event: {
      id: string;
      title: string;
      type: string;
      description: string | null;
      eventDate: Date;
      location: string | null;
      status: string;
      publicSlug: string;
      coverPhotoId: string | null;
      createdAt: Date;
      updatedAt: Date;
      coverPhoto: {
        thumbnailKey: string | null;
        previewKey: string | null;
        originalKey: string;
      } | null;
      _count: { photos: number };
      settings?: unknown;
      studio?: { id: string; name: string };
    },
    photoStats: Array<{ status: string; _count: number; _sum: { byteSize: bigint | null } }>,
  ) {
    const processed = photoStats.find((stat) => stat.status === 'READY')?._count ?? 0;
    const failed = photoStats.find((stat) => stat.status === 'FAILED')?._count ?? 0;
    const coverKey = event.coverPhoto?.thumbnailKey ?? event.coverPhoto?.previewKey;
    return {
      ...event,
      photoCount: event._count.photos,
      storageBytes: photoStats.reduce((sum, stat) => sum + Number(stat._sum.byteSize ?? 0n), 0),
      processing: {
        ready: processed,
        failed,
        pending: Math.max(0, event._count.photos - processed - failed),
        percent: event._count.photos ? Math.round((processed / event._count.photos) * 100) : 0,
      },
      coverUrl: coverKey
        ? await this.storage.signedReadUrl(coverKey, true)
        : event.coverPhoto
          ? await this.storage.signedReadUrl(event.coverPhoto.originalKey, false)
          : null,
      publicUrl: `${this.config.getOrThrow<string>('PUBLIC_APP_URL').replace(/\/$/, '')}/e/${event.publicSlug}`,
    };
  }
}
