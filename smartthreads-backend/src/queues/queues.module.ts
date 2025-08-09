import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";

// Entities
import { ScheduledPost, Account, AuditLog, MediaAsset, Job } from "../entities";

// Queues
import {
  PostPublisherQueue,
  POST_PUBLISHER_QUEUE,
} from "./post-publisher.queue";
import { PostDeletionQueue, POST_DELETION_QUEUE } from "./post-deletion.queue";
import { HealthCheckQueue, HEALTH_CHECK_QUEUE } from "./health-check.queue";
import {
  MediaProcessorQueue,
  MEDIA_PROCESSOR_QUEUE,
} from "./media-processor.queue";

// Processors
import { PostPublisherProcessor } from "../processors/post-publisher.processor";

// Services
import { SchedulerService } from "./scheduler.service";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      ScheduledPost,
      Account,
      AuditLog,
      MediaAsset,
      Job,
    ]),
    BullModule.registerQueueAsync({
      name: POST_PUBLISHER_QUEUE,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get("REDIS_HOST", "localhost"),
          port: configService.get("REDIS_PORT", 6379),
          password: configService.get("REDIS_PASSWORD"),
        },
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: false,
          attempts: configService.get("JOB_MAX_RETRIES", 3),
          backoff: {
            type: configService.get("JOB_BACKOFF_TYPE", "exponential"),
            delay: configService.get("JOB_RETRY_DELAY_MS", 5000),
          },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueueAsync({
      name: HEALTH_CHECK_QUEUE,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get("REDIS_HOST", "localhost"),
          port: configService.get("REDIS_PORT", 6379),
          password: configService.get("REDIS_PASSWORD"),
        },
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 2,
          backoff: {
            type: "fixed",
            delay: 10000,
          },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueueAsync({
      name: MEDIA_PROCESSOR_QUEUE,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get("REDIS_HOST", "localhost"),
          port: configService.get("REDIS_PORT", 6379),
          password: configService.get("REDIS_PASSWORD"),
        },
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueueAsync({
      name: POST_DELETION_QUEUE,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get("REDIS_HOST", "localhost"),
          port: configService.get("REDIS_PORT", 6379),
          password: configService.get("REDIS_PASSWORD"),
        },
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    PostPublisherQueue,
    PostDeletionQueue,
    HealthCheckQueue,
    MediaProcessorQueue,
    PostPublisherProcessor,
    SchedulerService,
  ],
  exports: [
    PostPublisherQueue,
    PostDeletionQueue,
    HealthCheckQueue,
    MediaProcessorQueue,
    SchedulerService,
  ],
})
export class QueuesModule {}
