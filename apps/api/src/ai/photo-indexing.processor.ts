import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { JobStatus, PhotoStatus, Prisma } from '@prisma/client';
import type { Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { StorageService } from '../infrastructure/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';

interface PhotoIndexJob {
  photoId: string;
  eventId: string;
  processingJobId: string;
}

const AI_WORKER_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.FACE_MAX_CONCURRENT_INFERENCES ?? '2', 10),
);

@Injectable()
@Processor('photo-processing', { concurrency: AI_WORKER_CONCURRENCY })
export class PhotoIndexingProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ai: AiService,
  ) {
    super();
  }

  async process(job: Job<PhotoIndexJob>): Promise<void> {
    const started = Date.now();
    const photo = await this.prisma.photo.findFirst({
      where: {
        id: job.data.photoId,
        eventId: job.data.eventId,
        deletedAt: null,
        event: { deletedAt: null },
      },
    });
    if (!photo || photo.status === PhotoStatus.DELETED) return;
    const reindexing = Boolean(photo.processedAt && photo.modelVersion);
    await this.prisma.$transaction([
      this.prisma.processingJob.update({
        where: { id: job.data.processingJobId },
        data: { status: JobStatus.ACTIVE, attempts: job.attemptsMade + 1, startedAt: new Date() },
      }),
      this.prisma.photo.update({
        where: { id: photo.id },
        data: { status: reindexing ? PhotoStatus.READY : PhotoStatus.PROCESSING },
      }),
    ]);
    try {
      if (!photo.aiInputKey) throw new Error('AI input derivative is unavailable');
      const image = await this.storage.readDerivative(photo.aiInputKey);
      const analysis = await this.ai.analyzePhoto(image, 'image/jpeg', `${photo.id}-ai-input.jpg`);
      const accepted = analysis.faces.filter((face) => face.embedding !== null);
      if (
        accepted.some(
          (face) =>
            face.embedding?.length !== analysis.embeddingDimension ||
            face.embedding?.every(Number.isFinite) !== true,
        )
      ) {
        throw new UnprocessableEntityException('AI service returned an invalid embedding');
      }
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.photo.findFirst({
          where: { id: photo.id, deletedAt: null, event: { deletedAt: null } },
          select: { id: true },
        });
        if (!current) return;
        await tx.faceEmbedding.deleteMany({
          where: {
            photoId: photo.id,
            modelVersion: analysis.modelVersion,
            preprocessingVersion: analysis.preprocessingVersion,
          },
        });
        for (const [faceIndex, face] of accepted.entries()) {
          const vector = `[${face.embedding!.join(',')}]`;
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO "FaceEmbedding"
              ("id", "eventId", "photoId", "faceIndex", "modelName", "modelVersion", "preprocessingVersion",
               "embedding", "boundingBox", "detectionConfidence", "qualityScore",
               "qualityStatus", "processedAt", "createdAt")
            VALUES
              (${randomUUID()}::uuid, ${photo.eventId}::uuid, ${photo.id}::uuid, ${faceIndex},
               ${analysis.modelName}, ${analysis.modelVersion}, ${analysis.preprocessingVersion}, ${vector}::vector,
               ${JSON.stringify(face.boundingBox)}::jsonb, ${face.detectionConfidence},
               ${face.qualityScore}, ${face.qualityStatus}, NOW(), NOW())
          `);
        }
        await tx.photo.update({
          where: { id: photo.id },
          data: {
            status: PhotoStatus.READY,
            faceCount: analysis.faces.length,
            skippedFaceCount: analysis.faces.length - accepted.length,
            modelVersion: analysis.modelVersion,
            detectionVersion: analysis.detectionPipelineVersion,
            processingDurationMs: Date.now() - started,
            processedAt: new Date(),
            failureCode: null,
            failureMessage: null,
          },
        });
        await tx.processingJob.update({
          where: { id: job.data.processingJobId },
          data: { status: JobStatus.COMPLETED, completedAt: new Date(), error: Prisma.JsonNull },
        });
      });
    } catch (error) {
      const permanent = error instanceof UnprocessableEntityException;
      const finalAttempt = permanent || job.attemptsMade + 1 >= Number(job.opts.attempts ?? 1);
      const code = permanent ? 'IMAGE_UNSUITABLE' : 'AI_PROCESSING_FAILED';
      await this.prisma.$transaction([
        this.prisma.processingJob.update({
          where: { id: job.data.processingJobId },
          data: {
            status: finalAttempt ? JobStatus.DEAD_LETTER : JobStatus.RETRYING,
            error: { code, message: 'Face indexing did not complete' },
          },
        }),
        this.prisma.photo.updateMany({
          where: { id: photo.id, deletedAt: null },
          data: {
            status: reindexing
              ? PhotoStatus.READY
              : finalAttempt
                ? PhotoStatus.FAILED
                : PhotoStatus.QUEUED,
            failureCode: finalAttempt ? code : null,
            failureMessage: finalAttempt ? 'Face indexing failed' : null,
          },
        }),
      ]);
      if (!permanent) throw error;
    }
  }
}
