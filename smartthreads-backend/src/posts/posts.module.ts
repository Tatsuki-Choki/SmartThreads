import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduledPost } from "../entities/scheduled-post.entity";
import { PublishedPostCache } from "../entities/published-post-cache.entity";
import { Account } from "../entities/account.entity";
import { User } from "../entities/user.entity";
import { AuditLog } from "../entities/audit-log.entity";
import { PostsService } from "./posts.service";
import { PostsController } from "./posts.controller";
import { AccountsModule } from "../accounts/accounts.module";
import { QueuesModule } from "../queues/queues.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScheduledPost,
      PublishedPostCache,
      Account,
      User,
      AuditLog,
    ]),
    AccountsModule,
    QueuesModule,
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
