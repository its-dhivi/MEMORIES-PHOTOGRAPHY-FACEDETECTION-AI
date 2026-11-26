import type { Job } from 'bullmq';
import type { StorageService } from '../infrastructure/storage.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AiService } from './ai.service';
import { PhotoIndexingProcessor } from './photo-indexing.processor';

describe('PhotoIndexingProcessor', () => {
  it('marks a valid photograph with no detected faces as ready', async () => {
    const photo = {
      id: 'photo-a',
      eventId: 'event-a',
      originalKey: 'private/photo-a.jpg',
      aiInputKey: 'private/photo-a-ai.jpg',
      originalFilename: 'photo-a.jpg',
      mimeType: 'image/jpeg',
      status: 'QUEUED',
      deletedAt: null,
    };
    type PhotoUpdateInput = { where: { id: string }; data: Record<string, unknown> };
    const photoUpdate = jest
      .fn<Promise<typeof photo>, [PhotoUpdateInput]>()
      .mockResolvedValue(photo);
    const jobUpdate = jest.fn().mockResolvedValue({});
    const deleteFaces = jest.fn().mockResolvedValue({ count: 0 });
    const tx = {
      photo: { findFirst: jest.fn().mockResolvedValue({ id: photo.id }), update: photoUpdate },
      faceEmbedding: { deleteMany: deleteFaces },
      processingJob: { update: jobUpdate },
    };
    const transaction = jest.fn(
      (input: readonly unknown[] | ((client: typeof tx) => Promise<unknown>)) =>
        typeof input === 'function' ? input(tx) : Promise.resolve([]),
    );
    const prisma = {
      photo: {
        findFirst: jest.fn().mockResolvedValue(photo),
        update: photoUpdate,
        updateMany: jest.fn(),
      },
      processingJob: { update: jobUpdate },
      $transaction: transaction,
    } as unknown as PrismaService;
    const storage = { readDerivative: jest.fn().mockResolvedValue(new Uint8Array([1, 2])) };
    const ai = {
      analyzePhoto: jest.fn().mockResolvedValue({
        modelName: 'licensed-model',
        modelVersion: 'v1',
        preprocessingVersion: 'auraface-rgb-112-v1',
        detectionPipelineVersion: 'phase5-v2',
        embeddingDimension: 512,
        width: 1000,
        height: 800,
        faces: [],
      }),
    };
    const processor = new PhotoIndexingProcessor(
      prisma,
      storage as unknown as StorageService,
      ai as unknown as AiService,
    );

    await processor.process({
      data: { photoId: 'photo-a', eventId: 'event-a', processingJobId: 'job-a' },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as Job<{ photoId: string; eventId: string; processingJobId: string }>);

    expect(deleteFaces).toHaveBeenCalledWith({
      where: {
        photoId: 'photo-a',
        modelVersion: 'v1',
        preprocessingVersion: 'auraface-rgb-112-v1',
      },
    });
    expect(
      photoUpdate.mock.calls.some(
        ([input]) =>
          input.where.id === 'photo-a' &&
          input.data.status === 'READY' &&
          input.data.faceCount === 0 &&
          input.data.modelVersion === 'v1',
      ),
    ).toBe(true);
  });
});
