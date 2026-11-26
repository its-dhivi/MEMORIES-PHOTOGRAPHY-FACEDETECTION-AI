import { ForbiddenException } from '@nestjs/common';
import { StudioRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { StudioAccessService } from './studio-access.service';

describe('StudioAccessService', () => {
  it('rejects users who do not belong to the requested studio', async () => {
    const prisma = {
      studioMember: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new StudioAccessService(prisma);
    await expect(service.requireMembership('user-id', 'studio-id')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('enforces allowed studio roles', async () => {
    const prisma = {
      studioMember: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ userId: 'u', studioId: 's', role: StudioRole.PHOTOGRAPHER }),
      },
    } as unknown as PrismaService;
    const service = new StudioAccessService(prisma);
    await expect(service.requireMembership('u', 's', [StudioRole.OWNER])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
