import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventDeletionProcessor } from './event-deletion.processor';
import { ProcessingController } from './processing.controller';
import { ProcessingService } from './processing.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    AuthModule,
    AiModule,
    BullModule.registerQueue(
      { name: 'thumbnail-generation' },
      { name: 'photo-processing' },
      { name: 'photo-deletion' },
      { name: 'event-deletion' },
    ),
  ],
  controllers: [ProcessingController],
  providers: [ProcessingService, EventDeletionProcessor],
})
export class ProcessingModule {}
