import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { StorageModule } from '../infrastructure/storage.module';
import { AiService } from './ai.service';
import { PhotoIndexingProcessor } from './photo-indexing.processor';

@Module({
  imports: [StorageModule, BullModule.registerQueue({ name: 'photo-processing' })],
  providers: [AiService, PhotoIndexingProcessor],
  exports: [AiService],
})
export class AiModule {}
