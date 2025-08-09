import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { User } from "../entities/user.entity";
import { Account } from "../entities/account.entity";
import { Credential } from "../entities/credential.entity";
import { ScheduledPost } from "../entities/scheduled-post.entity";
import { PublishedPostCache } from "../entities/published-post-cache.entity";
import { MediaAsset } from "../entities/media-asset.entity";
import { Job } from "../entities/job.entity";
import { AuditLog } from "../entities/audit-log.entity";

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const isProduction = configService.get("NODE_ENV") === "production";

  return {
    type: "postgres",
    url: configService.get("DATABASE_URL"),
    entities: [
      User,
      Account,
      Credential,
      ScheduledPost,
      PublishedPostCache,
      MediaAsset,
      Job,
      AuditLog,
    ],
    synchronize: !isProduction,
    logging: configService.get("NODE_ENV") === "development",
    poolSize: configService.get("DATABASE_POOL_MAX", 10),
    extra: {
      min: configService.get("DATABASE_POOL_MIN", 2),
      max: configService.get("DATABASE_POOL_MAX", 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
    migrations: ["dist/migrations/*.js"],
    migrationsRun: true,
    migrationsTableName: "migrations",
    ssl: isProduction
      ? {
          rejectUnauthorized: false,
        }
      : false,
  };
};
