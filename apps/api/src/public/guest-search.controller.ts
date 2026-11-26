import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import {
  CreateGuestSessionDto,
  GuestBulkDownloadDto,
  GuestConsentDto,
  GuestPhotoDownloadDto,
} from './guest-search.dto';
import { GuestSearchService, type UploadedSelfie } from './guest-search.service';

@Public()
@ApiTags('guest search')
@Controller('public')
export class GuestSearchController {
  constructor(private readonly searches: GuestSearchService) {}

  @Post('events/:slug/sessions')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a short-lived event-scoped guest session' })
  createSession(@Param('slug') slug: string, @Body() body: CreateGuestSessionDto) {
    return this.searches.createSession(slug, body);
  }

  @Get('events/:slug/session')
  @ApiHeader({ name: 'X-Guest-Session', required: true })
  @ApiOperation({ summary: 'Validate an event-scoped guest session' })
  session(@Param('slug') slug: string, @Headers('x-guest-session') token: string) {
    return this.searches.session(slug, token);
  }

  @Post('events/:slug/consent')
  @ApiHeader({ name: 'X-Guest-Session', required: true })
  @ApiOperation({ summary: 'Grant or withdraw biometric matching consent' })
  consent(
    @Param('slug') slug: string,
    @Headers('x-guest-session') token: string,
    @Body() body: GuestConsentDto,
  ) {
    return this.searches.consent(slug, token, body);
  }

  @Post('events/:slug/search')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('selfie', { limits: { fileSize: 15 * 1024 * 1024, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiHeader({ name: 'X-Guest-Session', required: true })
  @ApiOperation({ summary: 'Run an event-scoped face search using a consented selfie' })
  search(
    @Param('slug') slug: string,
    @Headers('x-guest-session') token: string,
    @UploadedFile() selfie: UploadedSelfie,
  ) {
    return this.searches.search(slug, token, selfie);
  }

  @Get('searches/:searchId')
  @ApiHeader({ name: 'X-Guest-Session', required: true })
  @ApiOperation({ summary: 'Get an owned guest search status' })
  status(@Param('searchId') searchId: string, @Headers('x-guest-session') token: string) {
    return this.searches.status(searchId, token);
  }

  @Get('searches/:searchId/results')
  @ApiHeader({ name: 'X-Guest-Session', required: true })
  @ApiOperation({ summary: 'Get expiring results owned by the guest session' })
  results(
    @Param('searchId') searchId: string,
    @Headers('x-guest-session') token: string,
    @Query('page') page = '1',
  ) {
    return this.searches.results(searchId, token, Number(page));
  }

  @Post('photos/:photoId/download')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiHeader({ name: 'X-Guest-Session', required: true })
  @ApiOperation({ summary: 'Authorize a short-lived original photo download' })
  download(
    @Param('photoId') photoId: string,
    @Headers('x-guest-session') token: string,
    @Body() body: GuestPhotoDownloadDto,
  ) {
    return this.searches.download(photoId, body.searchId, token);
  }

  @Post('searches/:searchId/download-all')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiHeader({ name: 'X-Guest-Session', required: true })
  @ApiOperation({ summary: 'Create a bounded background ZIP export' })
  downloadAll(@Param('searchId') searchId: string, @Headers('x-guest-session') token: string) {
    return this.searches.downloadAll(searchId, token);
  }

  @Post('searches/:searchId/download-selected')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiHeader({ name: 'X-Guest-Session', required: true })
  @ApiOperation({ summary: 'Create a ZIP containing an explicitly authorized result subset' })
  downloadSelected(
    @Param('searchId') searchId: string,
    @Headers('x-guest-session') token: string,
    @Body() body: GuestBulkDownloadDto,
  ) {
    return this.searches.downloadSelected(searchId, token, body.photoIds);
  }

  @Get('download-jobs/:jobId')
  @ApiHeader({ name: 'X-Guest-Session', required: true })
  @ApiOperation({ summary: 'Get an owned ZIP export status' })
  downloadJob(@Param('jobId') jobId: string, @Headers('x-guest-session') token: string) {
    return this.searches.downloadJob(jobId, token);
  }
}
