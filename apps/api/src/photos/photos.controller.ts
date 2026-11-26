import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ListPhotosDto, UploadCompleteDto, UploadInitDto, UploadPartUrlDto } from './photos.dto';
import { PhotosService } from './photos.service';

@ApiTags('photographs')
@ApiCookieAuth('access-token')
@Controller()
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Get('events/:id/photos')
  @ApiOperation({ summary: 'List authorized event photographs with signed previews' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventId: string,
    @Query() query: ListPhotosDto,
  ) {
    return this.photos.list(user.id, eventId, query);
  }

  @Post('events/:id/photos/upload-init')
  @ApiOperation({ summary: 'Authorize a private direct-to-storage photograph upload' })
  initialize(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventId: string,
    @Body() input: UploadInitDto,
  ) {
    return this.photos.initialize(user.id, eventId, input);
  }

  @Post('events/:id/photos/upload-complete')
  @ApiOperation({ summary: 'Verify an uploaded object and create its processing jobs' })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventId: string,
    @Body() input: UploadCompleteDto,
  ) {
    return this.photos.complete(user.id, eventId, input);
  }

  @Post('events/:id/photos/upload-part')
  @ApiOperation({ summary: 'Create a checksum-bound URL for one multipart upload part' })
  partUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventId: string,
    @Body() input: UploadPartUrlDto,
  ) {
    return this.photos.partUrl(user.id, eventId, input);
  }

  @Get('events/:id/photos/uploads/:sessionId')
  @ApiOperation({ summary: 'Inspect resumable multipart upload state and verified parts' })
  uploadState(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.photos.uploadState(user.id, eventId, sessionId);
  }

  @Delete('events/:id/photos/uploads/:sessionId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cancel an upload and abort storage multipart state' })
  cancelUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.photos.cancelUpload(user.id, eventId, sessionId);
  }

  @Delete('photos/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Queue idempotent deletion of a photograph and derivatives' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.photos.remove(user.id, id);
  }

  @Post('photos/:id/reprocess')
  @ApiOperation({ summary: 'Retry derivative or AI processing for a failed photograph' })
  reprocess(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.photos.reprocess(user.id, id);
  }
}
