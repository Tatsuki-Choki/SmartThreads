import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  POST_PUBLISHER_QUEUE,
  PublishPostJobData,
} from "../queues/post-publisher.queue";
import {
  ScheduledPost,
  ScheduledPostStatus,
} from "../entities/scheduled-post.entity";
import { Account } from "../entities/account.entity";
import { AuditLog, AuditAction } from "../entities/audit-log.entity";

@Processor(POST_PUBLISHER_QUEUE)
export class PostPublisherProcessor {
  private readonly logger = new Logger(PostPublisherProcessor.name);

  constructor(
    @InjectRepository(ScheduledPost)
    private scheduledPostRepository: Repository<ScheduledPost>,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  @Process("publish")
  async handlePublish(job: Job<PublishPostJobData>) {
    const { scheduledPostId, accountId, text, mediaRefs, attemptNumber } =
      job.data;

    this.logger.log(
      `Processing publish job for post ${scheduledPostId} (attempt ${attemptNumber})`,
    );

    try {
      // Get scheduled post
      const scheduledPost = await this.scheduledPostRepository.findOne({
        where: { id: scheduledPostId },
        relations: ["account", "createdBy"],
      });

      if (!scheduledPost) {
        throw new Error(`Scheduled post ${scheduledPostId} not found`);
      }

      // Update status to processing
      scheduledPost.status = ScheduledPostStatus.PROCESSING;
      scheduledPost.attempts = attemptNumber;
      await this.scheduledPostRepository.save(scheduledPost);

      // Get account with credentials
      const account = await this.accountRepository.findOne({
        where: { id: accountId },
        relations: ["credential"],
      });

      if (!account || !account.credential) {
        throw new Error(`Account ${accountId} or credentials not found`);
      }

      // TODO: Implement actual Threads API call here
      // For now, simulate a successful post
      const mockExternalPostId = `threads_${Date.now()}`;
      const mockPermalink = `https://threads.net/@${account.threadsUserId}/post/${mockExternalPostId}`;

      // Update scheduled post with success
      scheduledPost.status = ScheduledPostStatus.COMPLETED;
      scheduledPost.externalPostId = mockExternalPostId;
      scheduledPost.permalink = mockPermalink;
      scheduledPost.publishedAt = new Date();
      await this.scheduledPostRepository.save(scheduledPost);

      // Create audit log
      await this.auditLogRepository.save({
        action: AuditAction.POST_PUBLISHED,
        targetType: "scheduled_post",
        targetId: scheduledPostId,
        actorId: scheduledPost.createdById,
        success: true,
        details: {
          accountId,
          externalPostId: mockExternalPostId,
          permalink: mockPermalink,
        },
      });

      this.logger.log(
        `Successfully published post ${scheduledPostId} as ${mockExternalPostId}`,
      );

      return {
        success: true,
        externalPostId: mockExternalPostId,
        permalink: mockPermalink,
      };
    } catch (error) {
      this.logger.error(
        `Failed to publish post ${scheduledPostId}: ${error.message}`,
        error.stack,
      );

      // Update scheduled post with failure
      const scheduledPost = await this.scheduledPostRepository.findOne({
        where: { id: scheduledPostId },
      });

      if (scheduledPost) {
        scheduledPost.status = ScheduledPostStatus.FAILED;
        scheduledPost.lastError = error.message;
        scheduledPost.errorDetails = {
          attemptNumber,
          error: error.message,
          timestamp: new Date().toISOString(),
        };
        await this.scheduledPostRepository.save(scheduledPost);
      }

      // Create audit log for failure
      await this.auditLogRepository.save({
        action: AuditAction.POST_FAILED,
        targetType: "scheduled_post",
        targetId: scheduledPostId,
        success: false,
        errorMessage: error.message,
        details: {
          accountId,
          attemptNumber,
        },
      });

      throw error;
    }
  }

  @Process("retry")
  async handleRetry(job: Job<PublishPostJobData>) {
    const { scheduledPostId, attemptNumber } = job.data;

    this.logger.log(
      `Retrying publish job for post ${scheduledPostId} (attempt ${attemptNumber})`,
    );

    // Delegate to the main publish handler
    return this.handlePublish(job);
  }
}
