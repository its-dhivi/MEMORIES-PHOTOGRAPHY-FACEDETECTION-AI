import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import {
  AuditActorType,
  ConsentType,
  DownloadJobStatus,
  EventStatus,
  GuestSessionStatus,
  PhotoStatus,
  Prisma,
  SearchStatus,
} from '@prisma/client';
import type { Queue } from 'bullmq';
import * as argon2 from 'argon2';
import { createHmac, randomBytes } from 'node:crypto';
import { AiService } from '../ai/ai.service';
import { StorageService } from '../infrastructure/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateGuestSessionDto, GuestConsentDto } from './guest-search.dto';

interface MatchRow {
  photoId: string;
  similarity: number;
}

export interface UploadedSelfie {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

@Injectable()
export class GuestSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    @InjectQueue('guest-downloads') private readonly downloadQueue: Queue,
  ) {}

  async createSession(slug: string, input: CreateGuestSessionDto) {
    const event = await this.prisma.event.findFirst({
      where: { publicSlug: slug, deletedAt: null },
      include: { settings: true },
    });
    if (!event || event.status !== EventStatus.ACTIVE || !event.settings?.accessEnabled)
      throw new NotFoundException('Event is unavailable');
    if (event.settings.accessExpiresAt && event.settings.accessExpiresAt <= new Date())
      throw new NotFoundException('Event access has expired');
    if (event.settings.accessPinHash) {
      if (!input.pin || !(await argon2.verify(event.settings.accessPinHash, input.pin)))
        throw new UnauthorizedException('Invalid event PIN');
    }
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await this.prisma.guestSession.create({
      data: { eventId: event.id, tokenHash: this.hashToken(token), expiresAt },
    });
    return { guestSessionToken: token, expiresAt };
  }

  async consent(slug: string, token: string, input: GuestConsentDto) {
    const session = await this.requireSession(token, slug);
    if (input.version !== session.event.settings?.consentVersion)
      throw new BadRequestException('Consent notice version is no longer current');
    if (!input.accepted) {
      await this.prisma.$transaction([
        this.prisma.guestConsent.updateMany({
          where: {
            guestSessionId: session.id,
            type: ConsentType.BIOMETRIC_PROCESSING,
            withdrawnAt: null,
          },
          data: { withdrawnAt: new Date() },
        }),
        this.prisma.photoSearch.updateMany({
          where: {
            guestSessionId: session.id,
            status: { in: [SearchStatus.PENDING, SearchStatus.PROCESSING, SearchStatus.COMPLETED] },
          },
          data: { status: SearchStatus.EXPIRED },
        }),
        this.prisma.guestDownloadJob.updateMany({
          where: {
            guestSessionId: session.id,
            status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] },
          },
          data: { status: DownloadJobStatus.EXPIRED },
        }),
        this.prisma.guestSession.update({
          where: { id: session.id },
          data: { status: GuestSessionStatus.REVOKED },
        }),
        this.prisma.auditLog.create({
          data: {
            studioId: session.event.studioId,
            eventId: session.eventId,
            guestSessionId: session.id,
            actorType: AuditActorType.GUEST_SESSION,
            action: 'guest.biometric_consent_withdrawn',
            resourceType: 'GuestConsent',
          },
        }),
      ]);
      return { consented: false };
    }
    await this.prisma.$transaction([
      this.prisma.guestConsent.create({
        data: {
          guestSessionId: session.id,
          type: ConsentType.BIOMETRIC_PROCESSING,
          version: input.version,
          noticeSnapshot: { purpose: 'Event-scoped photo matching', selfieRetentionMinutes: 0 },
        },
      }),
      this.prisma.auditLog.create({
        data: {
          studioId: session.event.studioId,
          eventId: session.eventId,
          guestSessionId: session.id,
          actorType: AuditActorType.GUEST_SESSION,
          action: 'guest.biometric_consent_granted',
          resourceType: 'GuestConsent',
          metadata: { version: input.version },
        },
      }),
    ]);
    return { consented: true };
  }

  async session(slug: string, token: string) {
    const session = await this.requireSession(token, slug);
    const consented = session.consents.some(
      (consent) =>
        consent.type === ConsentType.BIOMETRIC_PROCESSING &&
        consent.withdrawnAt === null &&
        consent.version === session.event.settings?.consentVersion,
    );
    return {
      expiresAt: session.expiresAt,
      consented,
      consentVersion: session.event.settings!.consentVersion,
    };
  }

  async search(slug: string, token: string, file: UploadedSelfie) {
    const session = await this.requireSession(token, slug, true);
    if (!file?.buffer?.length) throw new BadRequestException('A selfie is required');
    const settings = session.event.settings!;
    await this.assertPublicMatchingAvailable(settings.faceMatchingEnabled === true);
    const threshold = Number(settings.similarityThreshold);
    const search = await this.prisma.photoSearch.create({
      data: {
        eventId: session.eventId,
        guestSessionId: session.id,
        status: SearchStatus.PROCESSING,
        threshold,
        expiresAt: new Date(Date.now() + settings.searchResultTtlMinutes * 60_000),
      },
    });
    try {
      const analysis = await this.ai.embedSelfie(file.buffer, file.mimetype, file.originalname);
      this.assertAnalysisIsValidated(analysis.modelVersion, analysis.preprocessingVersion);
      const embedding = analysis.faces[0]?.embedding;
      if (!embedding) throw new BadRequestException('Selfie did not contain a usable face');
      const vector = `[${embedding.join(',')}]`;
      const limit = this.config.get<number>('FACE_MATCH_MAX_RESULTS', 1000);
      const matches = await this.prisma.$queryRaw<MatchRow[]>(Prisma.sql`
        SELECT ranked."photoId", ranked.similarity::double precision AS similarity
        FROM (
          SELECT fe."photoId", MAX(1 - (fe.embedding <=> ${vector}::vector)) AS similarity
          FROM "FaceEmbedding" fe
          JOIN "Photo" p ON p.id = fe."photoId"
          WHERE fe."eventId" = ${session.eventId}::uuid
            AND fe."modelVersion" = ${analysis.modelVersion}
            AND fe."preprocessingVersion" = ${analysis.preprocessingVersion}
            AND fe."qualityStatus" = 'ACCEPTED'
            AND p."eventId" = ${session.eventId}::uuid
            AND p."deletedAt" IS NULL AND p.status = 'READY'
          GROUP BY fe."photoId"
        ) ranked
        WHERE ranked.similarity >= ${threshold}
        ORDER BY ranked.similarity DESC, ranked."photoId" ASC
        LIMIT ${limit}
      `);
      await this.prisma.$transaction(async (tx) => {
        if (matches.length) {
          await tx.searchResult.createMany({
            data: matches.map((match, index) => ({
              searchId: search.id,
              photoId: match.photoId,
              similarity: match.similarity,
              rank: index + 1,
            })),
          });
        }
        await tx.photoSearch.update({
          where: { id: search.id },
          data: {
            status: SearchStatus.COMPLETED,
            faceCount: 1,
            modelVersion: analysis.modelVersion,
            preprocessingVersion: analysis.preprocessingVersion,
            completedAt: new Date(),
          },
        });
        await tx.auditLog.create({
          data: {
            eventId: session.eventId,
            studioId: session.event.studioId,
            guestSessionId: session.id,
            actorType: AuditActorType.GUEST_SESSION,
            action: 'guest.face_search_completed',
            resourceType: 'PhotoSearch',
            resourceId: search.id,
            metadata: { resultCount: matches.length, modelVersion: analysis.modelVersion },
          },
        });
      });
      return { searchId: search.id, status: SearchStatus.COMPLETED, expiresAt: search.expiresAt };
    } catch (error) {
      await this.prisma.photoSearch.update({
        where: { id: search.id },
        data: {
          status: SearchStatus.FAILED,
          failureCode: 'SELFIE_PROCESSING_FAILED',
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async assertPublicMatchingAvailable(eventEnabled: boolean) {
    if (
      !eventEnabled ||
      !this.config.get<boolean>('PUBLIC_FACE_MATCHING_ENABLED', false) ||
      !this.config.get<boolean>('PUBLIC_FACE_MATCHING_MODEL_VALIDATED', false)
    )
      throw new ForbiddenException('Public face matching is unavailable');
    const model = await this.ai.readiness();
    if (!model.ready) throw new ForbiddenException('Recognition model is unavailable');
    const expectedModel = this.config.get<string>('FACE_MODEL_VERSION');
    const expectedPreprocessing = this.config.get<string>('FACE_PREPROCESSING_VERSION');
    if (
      !expectedModel ||
      !expectedPreprocessing ||
      model.modelVersion !== expectedModel ||
      model.preprocessingVersion !== expectedPreprocessing
    )
      throw new ForbiddenException(
        'System validated recognition model does not match the active model',
      );
  }

  private assertAnalysisIsValidated(modelVersion: string, preprocessingVersion: string) {
    const expectedModel = this.config.get<string>('FACE_MODEL_VERSION');
    const expectedPreprocessing = this.config.get<string>('FACE_PREPROCESSING_VERSION');
    if (modelVersion !== expectedModel || preprocessingVersion !== expectedPreprocessing) {
      throw new ForbiddenException(
        'System validated recognition model does not match the active model',
      );
    }
  }

  async status(searchId: string, token: string) {
    const session = await this.requireSession(token);
    const search = await this.prisma.photoSearch.findFirst({
      where: { id: searchId, guestSessionId: session.id, eventId: session.eventId },
      select: {
        id: true,
        status: true,
        failureCode: true,
        expiresAt: true,
        createdAt: true,
        completedAt: true,
      },
    });
    if (!search) throw new NotFoundException('Search not found');
    return search;
  }

  async results(searchId: string, token: string, page = 1) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
      throw new BadRequestException('Invalid results page');
    const session = await this.requireSession(token, undefined, true);
    const pageSize = 100;
    const resultWhere = {
      searchId,
      photo: { deletedAt: null, status: PhotoStatus.READY },
    } as const;
    const search = await this.prisma.photoSearch.findFirst({
      where: {
        id: searchId,
        guestSessionId: session.id,
        eventId: session.eventId,
        status: SearchStatus.COMPLETED,
        expiresAt: { gt: new Date() },
      },
      include: {
        results: {
          where: { photo: { deletedAt: null, status: 'READY' } },
          orderBy: { rank: 'asc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            photo: {
              select: { id: true, originalFilename: true, thumbnailKey: true, previewKey: true },
            },
          },
        },
      },
    });
    if (!search) throw new NotFoundException('Search results are unavailable');
    const total = await this.prisma.searchResult.count({ where: resultWhere });
    return {
      searchId,
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
      expiresAt: search.expiresAt,
      downloadsEnabled: session.event.settings!.downloadsEnabled,
      downloadAllEnabled: session.event.settings!.downloadAllEnabled,
      items: await Promise.all(
        search.results.map(async (result) => ({
          photoId: result.photo.id,
          filename: result.photo.originalFilename,
          thumbnailUrl: result.photo.thumbnailKey
            ? await this.storage.signedReadUrl(result.photo.thumbnailKey)
            : null,
          previewUrl: result.photo.previewKey
            ? await this.storage.signedReadUrl(result.photo.previewKey)
            : null,
        })),
      ),
    };
  }

  async download(photoId: string, searchId: string, token: string) {
    const session = await this.requireSession(token, undefined, true);
    if (!session.event.settings?.downloadsEnabled)
      throw new ForbiddenException('Downloads are disabled');
    const result = await this.prisma.searchResult.findFirst({
      where: {
        searchId,
        photoId,
        search: {
          guestSessionId: session.id,
          eventId: session.eventId,
          status: SearchStatus.COMPLETED,
          expiresAt: { gt: new Date() },
        },
        photo: { eventId: session.eventId, deletedAt: null, status: 'READY' },
      },
      include: { photo: true },
    });
    if (!result) throw new NotFoundException('Authorized photograph is unavailable');
    const url = await this.storage.signedDownloadUrl(
      result.photo.originalKey,
      result.photo.originalFilename,
    );
    await this.prisma.downloadLog.create({
      data: {
        studioId: session.event.studioId,
        guestSessionId: session.id,
        searchId,
        photoId,
      },
    });
    return { url, expiresInSeconds: 120 };
  }

  async downloadAll(searchId: string, token: string) {
    return this.createDownloadJob(searchId, token);
  }

  async downloadSelected(searchId: string, token: string, photoIds: string[]) {
    return this.createDownloadJob(searchId, token, [...new Set(photoIds)]);
  }

  private async createDownloadJob(searchId: string, token: string, selectedPhotoIds?: string[]) {
    const session = await this.requireSession(token, undefined, true);
    const settings = session.event.settings!;
    if (!settings.downloadsEnabled || !settings.downloadAllEnabled)
      throw new ForbiddenException('Download all is disabled');
    const search = await this.prisma.photoSearch.findFirst({
      where: {
        id: searchId,
        guestSessionId: session.id,
        eventId: session.eventId,
        status: SearchStatus.COMPLETED,
        expiresAt: { gt: new Date() },
      },
      include: {
        results: {
          where: {
            photo: { deletedAt: null, status: 'READY' },
            ...(selectedPhotoIds ? { photoId: { in: selectedPhotoIds } } : {}),
          },
          include: { photo: { select: { id: true, byteSize: true } } },
        },
      },
    });
    if (!search) throw new NotFoundException('Search results are unavailable');
    if (selectedPhotoIds && search.results.length !== selectedPhotoIds.length)
      throw new ForbiddenException('One or more selected photographs are not authorized');
    const maximumPhotos = this.config.get<number>('GUEST_ZIP_MAX_PHOTOS', 100);
    const maximumBytes = BigInt(this.config.get<number>('GUEST_ZIP_MAX_BYTES', 2_147_483_648));
    const estimatedBytes = search.results.reduce((sum, item) => sum + item.photo.byteSize, 0n);
    if (!search.results.length)
      throw new BadRequestException('There are no photographs to download');
    if (search.results.length > maximumPhotos || estimatedBytes > maximumBytes)
      throw new BadRequestException('This result set is too large for a ZIP download');
    const expiresAt = new Date(Math.min(search.expiresAt.getTime(), Date.now() + 30 * 60_000));
    const downloadJob = await this.prisma.guestDownloadJob.create({
      data: {
        eventId: session.eventId,
        guestSessionId: session.id,
        searchId,
        totalPhotos: search.results.length,
        estimatedBytes,
        selectedPhotoIds: selectedPhotoIds ?? Prisma.JsonNull,
        expiresAt,
      },
    });
    const queued = await this.downloadQueue.add(
      'create-guest-zip',
      { downloadJobId: downloadJob.id },
      {
        jobId: downloadJob.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
      },
    );
    await this.prisma.guestDownloadJob.update({
      where: { id: downloadJob.id },
      data: { queueJobId: String(queued.id) },
    });
    return { jobId: downloadJob.id, status: downloadJob.status, expiresAt };
  }

  async downloadJob(jobId: string, token: string) {
    const session = await this.requireSession(token, undefined, true);
    const job = await this.prisma.guestDownloadJob.findFirst({
      where: { id: jobId, guestSessionId: session.id, eventId: session.eventId },
    });
    if (!job || job.expiresAt <= new Date())
      throw new NotFoundException('Download job is unavailable');
    const queueJob = job.queueJobId ? await this.downloadQueue.getJob(job.queueJobId) : null;
    return {
      jobId: job.id,
      status: job.status,
      failureCode: job.failureCode,
      expiresAt: job.expiresAt,
      progress: queueJob?.progress ?? null,
      url:
        job.status === DownloadJobStatus.COMPLETED && job.objectKey
          ? await this.storage.signedDerivativeDownloadUrl(job.objectKey, 'memories-photos.zip')
          : null,
    };
  }

  private async requireSession(token: string, slug?: string, requireConsent = false) {
    if (!token) throw new UnauthorizedException('Guest session is required');
    const session = await this.prisma.guestSession.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { event: { include: { settings: true } }, consents: true },
    });
    const now = new Date();
    if (
      !session ||
      session.status !== 'ACTIVE' ||
      session.expiresAt <= now ||
      session.event.deletedAt
    )
      throw new UnauthorizedException('Guest session has expired');
    if (slug && session.event.publicSlug !== slug)
      throw new ForbiddenException('Session belongs to another event');
    const settings = session.event.settings;
    if (
      session.event.status !== EventStatus.ACTIVE ||
      !settings?.accessEnabled ||
      (settings.accessExpiresAt && settings.accessExpiresAt <= now)
    )
      throw new ForbiddenException('Event access is disabled');
    if (
      requireConsent &&
      !session.consents.some(
        (consent) =>
          consent.type === ConsentType.BIOMETRIC_PROCESSING &&
          consent.withdrawnAt === null &&
          consent.version === settings.consentVersion,
      )
    )
      throw new ForbiddenException('Current biometric consent is required');
    await this.prisma.guestSession.update({ where: { id: session.id }, data: { lastSeenAt: now } });
    return session;
  }

  private hashToken(token: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('COOKIE_SECRET'))
      .update(token)
      .digest('hex');
  }
}
