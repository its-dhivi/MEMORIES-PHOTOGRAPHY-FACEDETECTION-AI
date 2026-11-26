import { Prisma, PrismaClient } from '@prisma/client';
import { performance } from 'node:perf_hooks';

const eventId = process.argv[2];
const runs = Number(process.argv[3] ?? 20);
if (!eventId)
  throw new Error('Usage: pnpm --filter @memories/api benchmark:vector <event-uuid> [runs]');

const prisma = new PrismaClient();
try {
  const probes = await prisma.$queryRaw<
    Array<{ embedding: string; modelVersion: string }>
  >(Prisma.sql`
    SELECT embedding::text AS embedding, "modelVersion"
    FROM "FaceEmbedding" WHERE "eventId" = ${eventId}::uuid LIMIT 1
  `);
  const probe = probes[0];
  if (!probe) throw new Error('The event has no indexed face embeddings');
  const timings: number[] = [];
  for (let run = 0; run < runs; run += 1) {
    const started = performance.now();
    await prisma.$queryRaw(Prisma.sql`
      SELECT fe."photoId", 1 - (fe.embedding <=> ${probe.embedding}::vector) AS similarity
      FROM "FaceEmbedding" fe JOIN "Photo" p ON p.id = fe."photoId"
      WHERE fe."eventId" = ${eventId}::uuid AND fe."modelVersion" = ${probe.modelVersion}
        AND p."deletedAt" IS NULL AND p.status = 'READY'
      ORDER BY fe.embedding <=> ${probe.embedding}::vector LIMIT 100
    `);
    timings.push(performance.now() - started);
  }
  timings.sort((left, right) => left - right);
  const count = await prisma.faceEmbedding.count({ where: { eventId } });
  console.log(
    JSON.stringify(
      {
        eventId,
        embeddingCount: count,
        runs,
        meanMs: timings.reduce((sum, value) => sum + value, 0) / timings.length,
        p95Ms: timings[Math.max(0, Math.ceil(timings.length * 0.95) - 1)],
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
