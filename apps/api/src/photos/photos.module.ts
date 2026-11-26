import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { StorageModule } from '../infrastructure/storage.module';
import { FaceDiagnosticsController } from './face-diagnostics.controller';
import { FaceDiagnosticsService } from './face-diagnostics.service';
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
    AiModule,
    StorageModule,
    BullModule.registerQueue(
      { name: 'thumbnail-generation' },
      { name: 'photo-processing' },
      { name: 'photo-deletion' },
    ),
  ],
  controllers: [PhotosController, FaceDiagnosticsController],
  providers: [
    PhotosService,
    FaceDiagnosticsService,
    ThumbnailProcessor,
    PhotoDeletionProcessor,
    UploadCleanupService,
  ],
  exports: [PhotosService],
})
export class PhotosModule {}
