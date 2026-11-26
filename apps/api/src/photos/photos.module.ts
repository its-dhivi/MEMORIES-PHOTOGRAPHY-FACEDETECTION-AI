import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  PhotoDeletionProcessor,
  ThumbnailProcessor,
  UploadCleanupService,
} from './photo-processors';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue(
      { name: 'thumbnail-generation' },
      { name: 'photo-processing' },
      { name: 'photo-deletion' },
    ),
  ],
  controllers: [PhotosController],
  providers: [PhotosService, ThumbnailProcessor, PhotoDeletionProcessor, UploadCleanupService],
  exports: [PhotosService],
})
export class PhotosModule {}
