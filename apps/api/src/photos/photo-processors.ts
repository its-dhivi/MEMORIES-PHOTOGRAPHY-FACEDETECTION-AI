import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { JobStatus, PhotoStatus, Prisma, UploadStatus } from '@prisma/client';
import type { Job, Queue } from 'bullmq';
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../infrastructure/storage.service';

interface ThumbnailJobData {
  photoId: string;
  processingJobId: string;
  aiJobId?: string;
}

@Processor('thumbnail-generation', { concurrency: 2 })
export class ThumbnailProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue('photo-processing') private readonly aiQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<ThumbnailJobData>): Promise<void> {
    const photo = await this.prisma.photo.findUnique({ where: { id: job.data.photoId } });
    if (!photo || photo.deletedAt) return;
    const reindexing = Boolean(photo.processedAt && photo.modelVersion);
    await this.prisma.$transaction([
      this.prisma.processingJob.update({
        where: { id: job.data.processingJobId },
        data: { status: JobStatus.ACTIVE, startedAt: new Date(), attempts: job.attemptsMade + 1 },
      }),
      this.prisma.photo.update({
        where: { id: photo.id },
        data: { status: reindexing ? PhotoStatus.READY : PhotoStatus.PROCESSING },
      }),
    ]);
    const temporaryPath = join(tmpdir(), `memories-${photo.id}-${randomUUID()}`);
    try {
      await pipeline(
        await this.storage.originalStream(photo.originalKey),
        createWriteStream(temporaryPath),
      );
      const source = sharp(temporaryPath, { limitInputPixels: 80_000_000 }).rotate();
      const metadata = await source.metadata();
      const [thumbnail, preview, aiInput] = await Promise.all([
        source
          .clone()
          .resize(480, 480, { fit: 'cover', withoutEnlargement: true })
          .webp({ quality: 78 })
          .toBuffer(),
        source
          .clone()
          .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 84 })
          .toBuffer(),
        source
          .clone()
          .resize(4096, 4096, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 90, mozjpeg: true })
          .toBuffer(),
      ]);
      const prefix = `studios/${photo.eventId}/photos/${photo.id}`;
      const thumbnailKey = `${prefix}/thumbnail.webp`;
      const previewKey = `${prefix}/preview.webp`;
      const aiInputKey = `${prefix}/ai-input.jpg`;
      await Promise.all([
        this.storage.putDerivative(thumbnailKey, thumbnail, 'image/webp'),
        this.storage.putDerivative(previewKey, preview, 'image/webp'),
        this.storage.putDerivative(aiInputKey, aiInput, 'image/jpeg'),
      ]);
      await this.prisma.$transaction([
        this.prisma.photo.update({
          where: { id: photo.id },
          data: {
            thumbnailKey,
            previewKey,
            aiInputKey,
            derivativeStatus: 'READY',
            width: metadata.width ?? null,
            height: metadata.height ?? null,
            status: reindexing ? PhotoStatus.READY : PhotoStatus.QUEUED,
          },
        }),
        this.prisma.processingJob.update({
          where: { id: job.data.processingJobId },
          data: { status: JobStatus.COMPLETED, completedAt: new Date(), error: Prisma.JsonNull },
        }),
      ]);

      const aiJob = job.data.aiJobId
        ? await this.prisma.processingJob.findUnique({ where: { id: job.data.aiJobId } })
        : await this.prisma.processingJob.findFirst({
            where: { photoId: photo.id, type: 'PHOTO_PROCESS' },
            orderBy: { createdAt: 'desc' },
          });
      if (!aiJob) return;
      try {
        const queued = await this.aiQueue.add(
          'process-photo',
          { photoId: photo.id, eventId: photo.eventId, processingJobId: aiJob.id },
          {
            jobId: `${aiJob.id}-${Date.now()}`,
            attempts: aiJob.maxAttempts,
            backoff: { type: 'exponential', delay: 2000 },
          },
        );
        await this.prisma.processingJob.update({
          where: { id: aiJob.id },
          data: { queueJobId: String(queued.id), status: JobStatus.PENDING },
        });
      } catch {
        await this.prisma.photo.update({
          where: { id: photo.id },
          data: {
            status: reindexing ? PhotoStatus.READY : PhotoStatus.UPLOADED,
            failureCode: 'AI_QUEUE_UNAVAILABLE',
          },
        });
      }
    } catch (error) {
      const finalAttempt = job.attemptsMade + 1 >= Number(job.opts.attempts ?? 1);
      const message =
        error instanceof Error ? error.message.slice(0, 500) : 'Derivative generation failed';
      await this.prisma.$transaction([
        this.prisma.processingJob.update({
          where: { id: job.data.processingJobId },
          data: {
            status: finalAttempt ? JobStatus.DEAD_LETTER : JobStatus.RETRYING,
            error: { code: 'DERIVATIVE_GENERATION_FAILED', message },
          },
        }),
        this.prisma.photo.update({
          where: { id: photo.id },
          data: {
            status: reindexing
              ? PhotoStatus.READY
              : finalAttempt
                ? PhotoStatus.FAILED
                : PhotoStatus.QUEUED,
            failureCode: finalAttempt ? 'DERIVATIVE_GENERATION_FAILED' : null,
            failureMessage: finalAttempt ? 'Image preview generation failed' : null,
            derivativeStatus: finalAttempt ? 'UNSUPPORTED' : 'PROCESSING',
          },
        }),
      ]);
      throw error;
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }
}

@Processor('photo-deletion', { concurrency: 3 })
export class PhotoDeletionProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<{ photoId: string; processingJobId: string }>): Promise<void> {
    const photo = await this.prisma.photo.findUnique({ where: { id: job.data.photoId } });
    if (!photo) return;
    await this.prisma.processingJob.update({
      where: { id: job.data.processingJobId },
      data: { status: JobStatus.ACTIVE, attempts: job.attemptsMade + 1, startedAt: new Date() },
    });
    await this.storage.deleteObjects([
      { key: photo.originalKey, derivative: false },
      ...(photo.thumbnailKey ? [{ key: photo.thumbnailKey, derivative: true }] : []),
      ...(photo.previewKey ? [{ key: photo.previewKey, derivative: true }] : []),
      ...(photo.aiInputKey ? [{ key: photo.aiInputKey, derivative: true }] : []),
    ]);
    await this.prisma.$transaction([
      this.prisma.faceEmbedding.deleteMany({ where: { photoId: photo.id } }),
      this.prisma.processingJob.updateMany({
        where: {
          photoId: photo.id,
          id: { not: job.data.processingJobId },
          status: { not: JobStatus.COMPLETED },
        },
        data: { status: JobStatus.COMPLETED, completedAt: new Date() },
      }),
      this.prisma.processingJob.update({
        where: { id: job.data.processingJobId },
        data: { status: JobStatus.COMPLETED, completedAt: new Date() },
      }),
    ]);
  }
}

@Injectable()
export class UploadCleanupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Interval(15 * 60 * 1000)
  async expireOrphans(): Promise<void> {
    const expired = await this.prisma.uploadSession.findMany({
      where: { status: UploadStatus.PENDING, expiresAt: { lte: new Date() } },
      select: { id: true, objectKey: true, multipartUploadId: true },
      take: 100,
    });
    for (const session of expired) {
      try {
        if (session.multipartUploadId)
          await this.storage.abortMultipartUpload(session.objectKey, session.multipartUploadId);
        else await this.storage.deleteObjects([{ key: session.objectKey, derivative: false }]);
      } finally {
        await this.prisma.uploadSession.updateMany({
          where: { id: session.id, status: UploadStatus.PENDING },
          data: { status: UploadStatus.EXPIRED },
        });
      }
    }
  }
}
