import { ForbiddenException, Injectable } from '@nestjs/common';
import { StudioRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StudioAccessService {
  constructor(private readonly prisma: PrismaService) {}
  async requireMembership(
    userId: string,
    studioId: string,
    allowed: StudioRole[] = Object.values(StudioRole),
  ) {
    const membership = await this.prisma.studioMember.findUnique({
      where: { studioId_userId: { studioId, userId } },
    });
    if (!membership || !allowed.includes(membership.role))
      throw new ForbiddenException('Studio access denied');
    return membership;
  }
  async requireEventAccess(userId: string, eventId: string, allowed?: StudioRole[]) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true, studioId: true },
    });
    if (!event) throw new ForbiddenException('Event access denied');
    await this.requireMembership(userId, event.studioId, allowed);
    return event;
  }
}
