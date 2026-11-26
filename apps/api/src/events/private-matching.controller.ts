import { Body, Controller, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { UploadedSelfie } from '../public/guest-search.service';
import { PrivateMatchingService } from './private-matching.service';

@ApiTags('events')
@ApiCookieAuth('access-token')
@Controller('events/:eventId/matching')
export class PrivateMatchingController {
  constructor(private readonly matching: PrivateMatchingService) {}

  @Post('private-search')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('selfie', { limits: { fileSize: 15 * 1024 * 1024, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  privateSearch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId') eventId: string,
    @Body('consent') consent: string,
    @UploadedFile() selfie: UploadedSelfie,
  ) {
    return this.matching.search(user.id, eventId, selfie, consent === 'true');
  }
}
