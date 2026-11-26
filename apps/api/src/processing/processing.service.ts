import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { JobStatus, JobType, Prisma } from '@prisma/client';
import type { Queue } from 'bullmq';
import { StudioAccessService } from '../auth/studio-access.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ListProcessingJobsDto } from './processing.dto';
import { AiService } from '../ai/ai.service';

@Injectable()
export class ProcessingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StudioAccessService,
    private readonly ai: AiService,
    @InjectQueue('thumbnail-generation') private readonly thumbnails: Queue,
    @InjectQueue('photo-processing') private readonly photos: Queue,
    @InjectQueue('photo-deletion') private readonly deletions: Queue,
    @InjectQueue('event-deletion') private readonly events: Queue,
  ) {}

  async list(studioId: string, input: ListProcessingJobsDto) {
    const where: Prisma.ProcessingJobWhereInput = {
      event: { studioId },
      ...(input.status ? { status: input.status } : {}),
      ...(input.eventId ? { eventId: input.eventId } : {}),
    };
    const [total, jobs] = await this.prisma.$transaction([
      this.prisma.processingJob.count({ where }),
      this.prisma.processingJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: {
          event: { select: { id: true, title: true } },
          photo: { select: { id: true, originalFilename: true } },
        },
      }),
    ]);
    return {
      items: jobs.map((job) => ({
        ...job,
        payload: undefined,
        error: undefined,
        errorSummary: this.sanitizeError(job.error),
      })),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
    };
  }

  async stats(studioId: string) {
    const [
      grouped,
      photoMetrics,
      indexed,
      withFaces,
      noFaces,
      failed,
      thumbnailWorkers,
      aiWorkers,
      deletionWorkers,
      eventWorkers,
      model,
    ] = await Promise.all([
      this.prisma.processingJob.groupBy({
        by: ['status'],
        where: { event: { studioId } },
        _count: true,
        _sum: { attempts: true },
      }),
      this.prisma.photo.aggregate({
        where: { event: { studioId }, deletedAt: null },
        _count: true,
        _avg: { processingDurationMs: true },
      }),
      this.prisma.photo.count({ where: { event: { studioId }, deletedAt: null, status: 'READY' } }),
      this.prisma.photo.count({
        where: { event: { studioId }, deletedAt: null, status: 'READY', faceCount: { gt: 0 } },
      }),
      this.prisma.photo.count({
        where: { event: { studioId }, deletedAt: null, status: 'READY', faceCount: 0 },
      }),
      this.prisma.photo.count({
        where: { event: { studioId }, deletedAt: null, status: 'FAILED' },
      }),
      this.thumbnails.getWorkers().catch(() => []),
      this.photos.getWorkers().catch(() => []),
      this.deletions.getWorkers().catch(() => []),
      this.events.getWorkers().catch(() => []),
      this.ai.readiness(),
    ]);
    return {
      counts: Object.fromEntries(grouped.map((row) => [row.status, row._count])),
      retryAttempts: grouped.reduce((sum, row) => sum + Number(row._sum.attempts ?? 0), 0),
      workers: {
        thumbnail: thumbnailWorkers.length,
        ai: aiWorkers.length,
        deletion: deletionWorkers.length + eventWorkers.length,
        aiAvailable: aiWorkers.length > 0 && model.ready,
      },
      photos: {
        total: photoMetrics._count,
        indexed,
        withFaces,
        noFaces,
        failed,
        averageProcessingDurationMs: Math.round(photoMetrics._avg.processingDurationMs ?? 0),
      },
      model,
    };
  }

  async retry(userId: string, jobId: string) {
    const job = await this.prisma.processingJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Processing job not found');
    await this.access.requireEventAccess(userId, job.eventId);
    if (
      job.status !== JobStatus.FAILED &&
      job.status !== JobStatus.DEAD_LETTER &&
      job.status !== JobStatus.RETRYING
    ) {
      throw new BadRequestException('Only failed processing jobs can be retried');
    }
    const queue = this.queueFor(job.type);
    const name = this.nameFor(job.type);
    const queueJob = await queue.add(
      name,
      { ...(job.payload as Record<string, unknown>), processingJobId: job.id },
      {
        jobId: `${job.id}-${Date.now()}`,
        attempts: job.maxAttempts,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
    await this.prisma.processingJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.PENDING,
        queueJobId: String(queueJob.id),
        error: Prisma.JsonNull,
        completedAt: null,
      },
    });
    return { jobId: job.id, queued: true };
  }

  async reindexEvent(userId: string, eventId: string) {
    await this.access.requireEventAccess(userId, eventId);
    const model = await this.ai.readiness();
    if (!model.ready || !model.modelVersion)
      throw new BadRequestException('AI model is not ready for reindexing');
    const photos = await this.prisma.photo.findMany({
      where: {
        eventId,
        deletedAt: null,
        status: { not: 'DELETED' },
        OR: [{ modelVersion: null }, { modelVersion: { not: model.modelVersion } }],
      },
      select: { id: true },
      take: 1000,
    });
    let queued = 0;
    for (const photo of photos) {
      const processingJob = await this.prisma.processingJob.findFirst({
        where: { photoId: photo.id, type: JobType.PHOTO_PROCESS },
        orderBy: { createdAt: 'desc' },
      });
      if (!processingJob) continue;
      await this.prisma.$transaction([
        this.prisma.processingJob.update({
          where: { id: processingJob.id },
          data: { status: JobStatus.PENDING, error: Prisma.JsonNull, completedAt: null },
        }),
        this.prisma.photo.update({ where: { id: photo.id }, data: { status: 'QUEUED' } }),
      ]);
      await this.photos.add(
        'process-photo',
        { photoId: photo.id, eventId, processingJobId: processingJob.id },
        {
          jobId: `${processingJob.id}-reindex-${Date.now()}`,
          attempts: processingJob.maxAttempts,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
      queued += 1;
    }
    return { modelVersion: model.modelVersion, queued, remainingMayExist: photos.length === 1000 };
  }

  private queueFor(type: JobType): Queue {
    if (type === JobType.THUMBNAIL_GENERATE) return this.thumbnails;
    if (type === JobType.PHOTO_PROCESS) return this.photos;
    if (type === JobType.PHOTO_DELETE) return this.deletions;
    if (type === JobType.EVENT_DELETE) return this.events;
    throw new BadRequestException('This job type cannot be retried from the dashboard');
  }

  private nameFor(type: JobType): string {
    if (type === JobType.THUMBNAIL_GENERATE) return 'generate-derivatives';
    if (type === JobType.PHOTO_PROCESS) return 'process-photo';
    if (type === JobType.PHOTO_DELETE) return 'delete-photo';
    return 'delete-event';
  }

  private sanitizeError(error: Prisma.JsonValue | null): string | null {
    if (!error || typeof error !== 'object' || Array.isArray(error)) return null;
    const message = 'message' in error && typeof error.message === 'string' ? error.message : null;
    return message ? message.slice(0, 300) : 'Processing failed';
  }
}
