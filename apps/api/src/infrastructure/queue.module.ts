import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.getOrThrow<string>('REDIS_URL'));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            ...(url.username ? { username: url.username } : {}),
            ...(url.password ? { password: url.password } : {}),
            ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
            maxRetriesPerRequest: null,
          },
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: 'exponential', delay: 2_000 },
            removeOnComplete: { age: 86_400, count: 10_000 },
            removeOnFail: false,
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
