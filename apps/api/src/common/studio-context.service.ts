import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StudioContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string, requestedStudioId?: string) {
    const membership = requestedStudioId
      ? await this.prisma.studioMember.findUnique({
          where: { studioId_userId: { studioId: requestedStudioId, userId } },
          include: { studio: true },
        })
      : await this.prisma.studioMember.findFirst({
          where: { userId },
          include: { studio: true },
          orderBy: { createdAt: 'asc' },
        });
    if (!membership) throw new ForbiddenException('Studio access denied');
    return membership;
  }
}
