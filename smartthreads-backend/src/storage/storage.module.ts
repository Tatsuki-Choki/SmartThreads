import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MediaAsset } from "../entities/media-asset.entity";
import { S3Service } from "./s3.service";
import { MediaProcessorService } from "./media-processor.service";
import { MediaProcessorQueue } from "../queues/media-processor.queue";
import { BullModule } from "@nestjs/bull";
import { MEDIA_PROCESSOR_QUEUE } from "../queues/media-processor.queue";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaAsset]),
    BullModule.registerQueueAsync({
      name: MEDIA_PROCESSOR_QUEUE,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get("REDIS_HOST", "localhost"),
          port: configService.get("REDIS_PORT", 6379),
          password: configService.get("REDIS_PASSWORD"),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [S3Service, MediaProcessorService, MediaProcessorQueue],
  exports: [S3Service, MediaProcessorService],
})
export class StorageModule {}
