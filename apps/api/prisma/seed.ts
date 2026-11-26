import { PrismaClient, StudioRole } from '@prisma/client';
import * as argon2 from 'argon2';
const prisma = new PrismaClient();
async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12)
    throw new Error('Set SEED_ADMIN_EMAIL and a 12+ character SEED_ADMIN_PASSWORD');
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
  const studio = await prisma.studio.upsert({
    where: { slug: 'memories-photography' },
    update: {},
    create: { name: 'Memories Photography', slug: 'memories-photography' },
  });
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, displayName: 'Studio Administrator' },
  });
  await prisma.studioMember.upsert({
    where: { studioId_userId: { studioId: studio.id, userId: user.id } },
    update: { role: StudioRole.OWNER },
    create: { studioId: studio.id, userId: user.id, role: StudioRole.OWNER },
  });
  console.info(`Seeded studio and administrator ${email}`);
}
main().finally(() => prisma.$disconnect());
