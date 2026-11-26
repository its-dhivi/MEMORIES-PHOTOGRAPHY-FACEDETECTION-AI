import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../infrastructure/storage.service';

@Processor('event-deletion', { concurrency: 1 })
export class EventDeletionProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<{ eventId: string }>): Promise<void> {
    const photos = await this.prisma.photo.findMany({
      where: { eventId: job.data.eventId },
      select: { originalKey: true, thumbnailKey: true, previewKey: true, aiInputKey: true },
    });
    const objects = photos.flatMap((photo) => [
      { key: photo.originalKey, derivative: false },
      ...(photo.thumbnailKey ? [{ key: photo.thumbnailKey, derivative: true }] : []),
      ...(photo.previewKey ? [{ key: photo.previewKey, derivative: true }] : []),
      ...(photo.aiInputKey ? [{ key: photo.aiInputKey, derivative: true }] : []),
    ]);
    for (let index = 0; index < objects.length; index += 500) {
      await this.storage.deleteObjects(objects.slice(index, index + 500));
    }
    await this.prisma.event.deleteMany({ where: { id: job.data.eventId, status: 'DELETING' } });
  }
}
