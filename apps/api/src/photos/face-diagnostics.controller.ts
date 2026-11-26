import { Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { UploadedSelfie } from '../public/guest-search.service';
import { FaceDiagnosticsService } from './face-diagnostics.service';

@ApiTags('face diagnostics')
@ApiCookieAuth('access-token')
@Controller('events/:eventId/photos/:photoId/diagnostics')
export class FaceDiagnosticsController {
  constructor(private readonly diagnostics: FaceDiagnosticsService) {}

  @Get()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  inspect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId') eventId: string,
    @Param('photoId') photoId: string,
  ) {
    return this.diagnostics.inspect(user.id, eventId, photoId);
  }

  @Post('probe')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('selfie', { limits: { fileSize: 15 * 1024 * 1024, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  probe(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId') eventId: string,
    @Param('photoId') photoId: string,
    @UploadedFile() selfie: UploadedSelfie,
  ) {
    return this.diagnostics.probe(user.id, eventId, photoId, selfie);
  }
}
