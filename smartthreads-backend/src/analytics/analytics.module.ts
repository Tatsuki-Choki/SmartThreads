import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { PublishedPostCache } from "../entities/published-post-cache.entity";
import { Account } from "../entities/account.entity";
import { User } from "../entities/user.entity";
import { AuditLog } from "../entities/audit-log.entity";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsController } from "./analytics.controller";
import { MetricsCollectorService } from "./metrics-collector.service";
import { AccountsModule } from "../accounts/accounts.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([PublishedPostCache, Account, User, AuditLog]),
    ScheduleModule.forRoot(),
    AccountsModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, MetricsCollectorService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
