import { Process, Processor } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PublishedPostCache } from "../entities/published-post-cache.entity";
import { Account } from "../entities/account.entity";
import { AuditLog, AuditAction } from "../entities/audit-log.entity";
import { ThreadsApiService } from "../accounts/threads-api.service";
import { AccountsService } from "../accounts/accounts.service";

export interface DeletePostJobData {
  postId: string;
  userId: string;
  retryCount?: number;
}

@Injectable()
@Processor("post-deletion")
export class PostDeletionProcessor {
  private readonly logger = new Logger(PostDeletionProcessor.name);

  constructor(
    @InjectRepository(PublishedPostCache)
    private publishedPostRepository: Repository<PublishedPostCache>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private threadsApiService: ThreadsApiService,
    private accountsService: AccountsService,
  ) {}

  @Process("delete")
  async handleDelete(job: Job<DeletePostJobData>) {
    const { postId, userId, retryCount = 0 } = job.data;

    this.logger.log(
      `Processing deletion job for post ${postId} (attempt ${retryCount + 1})`,
    );

    try {
      // Get post details
      const post = await this.publishedPostRepository.findOne({
        where: { id: postId },
      });

      if (!post) {
        this.logger.warn(`Post ${postId} not found in cache`);
        return { success: true, message: "Post already deleted or not found" };
      }

      // Get account with credentials
      const account = await this.accountsService.getAccountWithCredentials(
        post.accountId,
      );

      if (!account || !account.credential) {
        throw new Error("Account or credentials not found");
      }

      // Delete from Threads
      await this.threadsApiService.deletePost(
        account.credential.accessTokenEnc,
        post.threadsPostId,
      );

      // Remove from cache
      await this.publishedPostRepository.remove(post);

      // Create audit log
      await this.createAuditLog(
        AuditAction.POST_DELETED,
        userId,
        "published_post",
        postId,
        true,
        {
          threadsPostId: post.threadsPostId,
          accountId: post.accountId,
        },
      );

      this.logger.log(`Successfully deleted post ${postId} from Threads`);

      return { success: true, postId };
    } catch (error) {
      this.logger.error(
        `Failed to delete post ${postId}: ${error.message}`,
        error.stack,
      );

      // Check if we should retry
      if (retryCount < 3) {
        // Throw error to trigger Bull's retry mechanism
        throw error;
      }

      // Max retries reached, mark as failed
      await this.createAuditLog(
        AuditAction.POST_DELETED,
        userId,
        "published_post",
        postId,
        false,
        { retryCount },
        error.message,
      );

      return {
        success: false,
        postId,
        error: error.message,
        maxRetriesReached: true,
      };
    }
  }

  @Process("bulk-delete")
  async handleBulkDelete(job: Job<{ postIds: string[]; userId: string }>) {
    const { postIds, userId } = job.data;

    this.logger.log(`Processing bulk deletion for ${postIds.length} posts`);

    const results = {
      successful: [] as string[],
      failed: [] as { postId: string; error: string }[],
    };

    // Process deletions in parallel batches
    const batchSize = 5;
    for (let i = 0; i < postIds.length; i += batchSize) {
      const batch = postIds.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (postId) => {
          try {
            await this.handleDelete({
              data: { postId, userId },
            } as Job<DeletePostJobData>);

            results.successful.push(postId);
          } catch (error) {
            results.failed.push({
              postId,
              error: error.message,
            });
          }
        }),
      );

      // Add delay between batches to avoid rate limits
      if (i + batchSize < postIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Update job progress
      const progress = Math.floor(((i + batch.length) / postIds.length) * 100);
      await job.progress(progress);
    }

    this.logger.log(
      `Bulk deletion completed: ${results.successful.length} successful, ${results.failed.length} failed`,
    );

    return results;
  }

  private async createAuditLog(
    action: AuditAction,
    actorId: string,
    targetType: string,
    targetId: string,
    success: boolean,
    details?: any,
    errorMessage?: string,
  ): Promise<void> {
    await this.auditLogRepository.save({
      action,
      actorId,
      targetType,
      targetId,
      success,
      details,
      errorMessage,
    });
  }
}
