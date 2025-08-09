import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThanOrEqual, In } from "typeorm";
import { ConfigService } from "@nestjs/config";
import {
  ScheduledPost,
  ScheduledPostStatus,
} from "../entities/scheduled-post.entity";
import { PostPublisherQueue } from "./post-publisher.queue";

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly batchSize: number;
  private isProcessing = false;

  constructor(
    @InjectRepository(ScheduledPost)
    private scheduledPostRepository: Repository<ScheduledPost>,
    private postPublisherQueue: PostPublisherQueue,
    private configService: ConfigService,
  ) {
    this.batchSize = this.configService.get("SCHEDULER_BATCH_SIZE", 10);
  }

  async onModuleInit() {
    this.logger.log("Scheduler service initialized");
    // Process any pending posts on startup
    await this.processPendingPosts();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingPosts() {
    if (this.isProcessing) {
      this.logger.debug("Scheduler is already processing, skipping this run");
      return;
    }

    this.isProcessing = true;

    try {
      const now = new Date();
      const pendingPosts = await this.scheduledPostRepository.find({
        where: {
          status: In([ScheduledPostStatus.PENDING, ScheduledPostStatus.FAILED]),
          scheduledAt: LessThanOrEqual(now),
        },
        relations: ["account"],
        take: this.batchSize,
        order: {
          scheduledAt: "ASC",
        },
      });

      if (pendingPosts.length === 0) {
        return;
      }

      this.logger.log(`Found ${pendingPosts.length} posts to publish`);

      for (const post of pendingPosts) {
        try {
          // Check if we should retry failed posts
          if (
            post.status === ScheduledPostStatus.FAILED &&
            post.attempts >= 3
          ) {
            this.logger.warn(
              `Post ${post.id} has failed ${post.attempts} times, skipping`,
            );
            continue;
          }

          // Add to queue for processing
          await this.postPublisherQueue.addPublishJob({
            scheduledPostId: post.id,
            accountId: post.accountId,
            text: post.text,
            mediaRefs: post.mediaRefs,
            attemptNumber: post.attempts + 1,
          });

          // Update status to processing
          post.status = ScheduledPostStatus.PROCESSING;
          await this.scheduledPostRepository.save(post);

          this.logger.log(`Queued post ${post.id} for publishing`);
        } catch (error) {
          this.logger.error(
            `Failed to queue post ${post.id}: ${error.message}`,
            error.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error in scheduler: ${error.message}`, error.stack);
    } finally {
      this.isProcessing = false;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldJobs() {
    try {
      this.logger.log("Running cleanup for old jobs");
      await this.postPublisherQueue.cleanOldJobs();

      // Also clean up old completed posts from database
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.scheduledPostRepository
        .createQueryBuilder()
        .delete()
        .where("status = :status", { status: ScheduledPostStatus.COMPLETED })
        .andWhere("publishedAt < :date", { date: thirtyDaysAgo })
        .execute();

      if (result.affected > 0) {
        this.logger.log(`Cleaned up ${result.affected} old completed posts`);
      }
    } catch (error) {
      this.logger.error(`Error in cleanup: ${error.message}`, error.stack);
    }
  }

  @Cron("0 0 * * *") // Daily at midnight
  async generateDailyReport() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stats = await this.scheduledPostRepository
        .createQueryBuilder("post")
        .select("post.status", "status")
        .addSelect("COUNT(*)", "count")
        .where("post.publishedAt >= :yesterday", { yesterday })
        .andWhere("post.publishedAt < :today", { today })
        .groupBy("post.status")
        .getRawMany();

      this.logger.log("Daily report:", stats);

      // TODO: Send report via email or notification
    } catch (error) {
      this.logger.error(
        `Error generating daily report: ${error.message}`,
        error.stack,
      );
    }
  }

  async getSchedulerStatus() {
    const [pending, processing, failed] = await Promise.all([
      this.scheduledPostRepository.count({
        where: { status: ScheduledPostStatus.PENDING },
      }),
      this.scheduledPostRepository.count({
        where: { status: ScheduledPostStatus.PROCESSING },
      }),
      this.scheduledPostRepository.count({
        where: { status: ScheduledPostStatus.FAILED },
      }),
    ]);

    return {
      isProcessing: this.isProcessing,
      batchSize: this.batchSize,
      stats: {
        pending,
        processing,
        failed,
      },
    };
  }
}
