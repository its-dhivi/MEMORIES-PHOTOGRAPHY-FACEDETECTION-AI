import {
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
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../infrastructure/storage.service';
import { StudioAccessService } from '../auth/studio-access.service';
import type {
  CreateEventDto,
  ListEventsDto,
  UpdateEventDto,
  UpdateEventSettingsDto,
} from './events.dto';

const WRITE_ROLES = [StudioRole.OWNER, StudioRole.ADMIN, StudioRole.PHOTOGRAPHER];
const ADMIN_ROLES = [StudioRole.OWNER, StudioRole.ADMIN];

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
    const view = { ...settings };
    Reflect.deleteProperty(view, 'accessPinHash');
    Reflect.deleteProperty(view, 'previousSimilarityThreshold');
    Reflect.deleteProperty(view, 'matchingApprovedAt');
    Reflect.deleteProperty(view, 'matchingApprovedById');
    Reflect.deleteProperty(view, 'matchingModelVersion');
    Reflect.deleteProperty(view, 'matchingPreprocessingVersion');
    Reflect.deleteProperty(view, 'matchingApprovalEvidence');
    return {
      ...view,
      accessPinConfigured: Boolean(settings.accessPinHash),
    };
  }

  async updateSettings(userId: string, eventId: string, input: UpdateEventSettingsDto) {
    const hasMatchingChange =
      input.faceMatchingEnabled !== undefined || input.similarityThreshold !== undefined;
    const { studioId } = await this.access.requireEventAccess(
      userId,
      eventId,
      hasMatchingChange ? ADMIN_ROLES : WRITE_ROLES,
    );
    const accessPinHash = input.accessPin
      ? await argon2.hash(input.accessPin, { type: argon2.argon2id })
      : undefined;
    const operations: Prisma.PrismaPromise<unknown>[] = [
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
          ...(input.faceMatchingEnabled !== undefined
            ? { faceMatchingEnabled: input.faceMatchingEnabled }
            : {}),
          ...(input.similarityThreshold !== undefined
            ? { similarityThreshold: input.similarityThreshold }
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
    ];
    if (input.faceMatchingEnabled === false) {
      operations.push(
        this.prisma.photoSearch.updateMany({
          where: {
            eventId,
            status: { in: [SearchStatus.PENDING, SearchStatus.PROCESSING, SearchStatus.COMPLETED] },
          },
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
      );
    }
    await this.prisma.$transaction(operations);
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
