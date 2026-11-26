const { PrismaClient, Prisma } = require('@prisma/client');
const { Queue } = require('bullmq');

async function main() {
  const modelVersion = process.env.FACE_MODEL_VERSION;
  const detectionVersion = process.env.FACE_DETECTION_PIPELINE_VERSION || 'phase5-v2';
  if (!modelVersion) throw new Error('FACE_MODEL_VERSION is required');
  const url = new URL(process.env.REDIS_URL);
  const connection = {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.username && { username: url.username }),
    ...(url.password && { password: url.password }),
    ...(url.protocol === 'rediss:' && { tls: {} }),
    maxRetriesPerRequest: null,
  };
  const prisma = new PrismaClient();
  const queue = new Queue('photo-processing', { connection });
  const thumbnails = new Queue('thumbnail-generation', { connection });
  try {
    const photos = await prisma.photo.findMany({
      where: {
        deletedAt: null,
        processedAt: { not: null },
        OR: [
          { modelVersion: { not: modelVersion } },
          { detectionVersion: null },
          { detectionVersion: { not: detectionVersion } },
        ],
      },
      select: { id: true, eventId: true, aiInputKey: true, detectionVersion: true },
    });
    console.log(`Photos needing ${modelVersion} / ${detectionVersion}: ${photos.length}`);
    if (!process.argv.includes('--apply')) return;
    for (const photo of photos) {
      const job = await prisma.processingJob.findFirst({
        where: { photoId: photo.id, type: 'PHOTO_PROCESS' },
        orderBy: { createdAt: 'desc' },
      });
      if (!job) throw new Error(`No processing job for photo ${photo.id}`);
      if (['PENDING', 'ACTIVE', 'RETRYING'].includes(job.status)) continue;
      const needsDerivative = photo.detectionVersion !== detectionVersion || !photo.aiInputKey;
      const thumbnailJob = !needsDerivative
        ? null
        : await prisma.processingJob.findFirst({
            where: { photoId: photo.id, type: 'THUMBNAIL_GENERATE' },
            orderBy: { createdAt: 'desc' },
          });
      if (needsDerivative && !thumbnailJob)
        throw new Error(`No derivative job for photo ${photo.id}`);
      await prisma.$transaction([
        prisma.processingJob.update({
          where: { id: job.id },
          data: { status: 'PENDING', error: Prisma.JsonNull, completedAt: null },
        }),
        ...(thumbnailJob
          ? [
              prisma.processingJob.update({
                where: { id: thumbnailJob.id },
                data: { status: 'PENDING', error: Prisma.JsonNull, completedAt: null },
              }),
            ]
          : []),
      ]);
      if (thumbnailJob) {
        await thumbnails.add(
          'generate-derivatives',
          { photoId: photo.id, processingJobId: thumbnailJob.id, aiJobId: job.id },
          { jobId: `${thumbnailJob.id}-reindex-${Date.now()}` },
        );
      } else
        await queue.add(
          'process-photo',
          { photoId: photo.id, eventId: photo.eventId, processingJobId: job.id },
          {
            jobId: `${job.id}-reindex-${Date.now()}`,
            attempts: job.maxAttempts,
            backoff: { type: 'exponential', delay: 2000 },
          },
        );
    }
    console.log(`Queued ${photos.length} photos for reindexing`);
  } finally {
    await thumbnails.close();
    await queue.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
