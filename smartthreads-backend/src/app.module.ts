import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bull";
import { ThrottlerModule } from "@nestjs/throttler";
import { getDatabaseConfig } from "./config/database.config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { CryptoModule } from "./crypto/crypto.module";
import { StorageModule } from "./storage/storage.module";
import { QueuesModule } from "./queues/queues.module";
import { AccountsModule } from "./accounts/accounts.module";
import { WorkersModule } from "./workers/workers.module";
import { PostsModule } from "./posts/posts.module";
import { MediaModule } from "./media/media.module";
import { ScheduleModule } from "@nestjs/schedule";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
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
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get("RATE_LIMIT_WINDOW_MS", 60000),
          limit: configService.get("RATE_LIMIT_MAX_REQUESTS", 100),
        },
      ],
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    CryptoModule,
    AuthModule,
    StorageModule,
    QueuesModule,
    AccountsModule,
    WorkersModule,
    PostsModule,
    MediaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
