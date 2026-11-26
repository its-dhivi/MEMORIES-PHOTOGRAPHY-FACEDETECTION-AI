import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { ConsentType, DownloadJobStatus } from '@prisma/client';
import type { Job } from 'bullmq';
import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../infrastructure/storage.service';

@Processor('guest-downloads', { concurrency: 1 })
export class GuestDownloadProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<{ downloadJobId: string }>): Promise<void> {
    const record = await this.prisma.guestDownloadJob.findUnique({
      where: { id: job.data.downloadJobId },
      include: {
        guestSession: { include: { consents: true } },
        search: {
          include: {
            results: {
              orderBy: { rank: 'asc' },
              include: { photo: true },
            },
          },
        },
      },
    });
    if (!record || record.status === DownloadJobStatus.EXPIRED) return;
    const consented = record.guestSession.consents.some(
      (item) => item.type === ConsentType.BIOMETRIC_PROCESSING && item.withdrawnAt === null,
    );
    if (
      record.guestSession.status !== 'ACTIVE' ||
      record.guestSession.expiresAt <= new Date() ||
      record.search.expiresAt <= new Date() ||
      !consented
    ) {
      await this.prisma.guestDownloadJob.update({
        where: { id: record.id },
        data: { status: DownloadJobStatus.EXPIRED },
      });
      return;
    }
    await this.prisma.guestDownloadJob.update({
      where: { id: record.id },
      data: { status: DownloadJobStatus.PROCESSING, startedAt: new Date() },
    });
    const objectKey = `guest-zips/${record.eventId}/${record.id}.zip`;
    const archive = archiver('zip', { forceZip64: true, store: true });
    const output = new PassThrough();
    archive.pipe(output);
    const upload = this.storage.putDerivativeStream(objectKey, output, 'application/zip');
    try {
      const selected = Array.isArray(record.selectedPhotoIds)
        ? new Set(record.selectedPhotoIds.filter((id): id is string => typeof id === 'string'))
        : null;
      const results = selected
        ? record.search.results.filter((result) => selected.has(result.photoId))
        : record.search.results;
      const maximumOutput = this.config.get<number>('GUEST_ZIP_MAX_OUTPUT_BYTES', 11_811_160_064);
      for (const [index, result] of results.entries()) {
        if (result.photo.deletedAt || result.photo.status !== 'READY') continue;
        const source = await this.storage.originalStream(result.photo.originalKey);
        const safe = result.photo.originalFilename.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(-140);
        await new Promise<void>((resolve, reject) => {
          source.once('error', reject);
          archive.once('entry', () => resolve());
          archive.append(source, {
            name: `${String(index + 1).padStart(3, '0')}-${safe}`,
            store: true,
          });
        });
        if (archive.pointer() > maximumOutput) throw new Error('ZIP output limit exceeded');
        await job.updateProgress({ completed: index + 1, total: results.length });
      }
      await archive.finalize();
      await upload;
      const completed = await this.prisma.guestDownloadJob.updateMany({
        where: { id: record.id, status: DownloadJobStatus.PROCESSING },
        data: {
          status: DownloadJobStatus.COMPLETED,
          objectKey,
          byteSize: archive.pointer(),
          completedAt: new Date(),
        },
      });
      if (!completed.count)
        await this.storage.deleteObjects([{ key: objectKey, derivative: true }]);
    } catch (error) {
      archive.abort();
      await this.prisma.guestDownloadJob.update({
        where: { id: record.id },
        data: {
          status: DownloadJobStatus.FAILED,
          failureCode: 'ZIP_GENERATION_FAILED',
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }
}

@Injectable()
export class GuestDownloadCleanupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Interval(15 * 60 * 1000)
  async cleanup(): Promise<void> {
    const expired = await this.prisma.guestDownloadJob.findMany({
      where: {
        OR: [
          { expiresAt: { lte: new Date() }, status: { not: DownloadJobStatus.EXPIRED } },
          { status: DownloadJobStatus.EXPIRED, objectKey: { not: null } },
        ],
      },
      select: { id: true, objectKey: true },
      take: 100,
    });
    for (const item of expired) {
      if (item.objectKey)
        await this.storage.deleteObjects([{ key: item.objectKey, derivative: true }]);
      await this.prisma.guestDownloadJob.update({
        where: { id: item.id },
        data: { status: DownloadJobStatus.EXPIRED, objectKey: null },
      });
    }
  }
}
