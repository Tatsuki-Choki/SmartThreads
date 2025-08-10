import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan, MoreThan } from "typeorm";
import {
  ScheduledPost,
  PostStatus,
  ScheduledPostStatus,
  ScheduleMode,
} from "../entities/scheduled-post.entity";
import { PublishedPostCache } from "../entities/published-post-cache.entity";
import { Account } from "../entities/account.entity";
import { AuditLog, AuditAction } from "../entities/audit-log.entity";
import { CreatePostDto } from "./dto/create-post.dto";
import { UpdatePostDto } from "./dto/update-post.dto";
import {
  PostPublisherQueue,
  PublishPostJobData,
} from "../queues/post-publisher.queue";
import { PostDeletionQueue } from "../queues/post-deletion.queue";
import { AccountsService } from "../accounts/accounts.service";
import { ThreadsApiService } from "../accounts/threads-api.service";

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectRepository(ScheduledPost)
    private scheduledPostRepository: Repository<ScheduledPost>,
    @InjectRepository(PublishedPostCache)
    private publishedPostRepository: Repository<PublishedPostCache>,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private accountsService: AccountsService,
    private postPublisherQueue: PostPublisherQueue,
    private postDeletionQueue: PostDeletionQueue,
    private threadsApiService: ThreadsApiService,
  ) {}

  /**
   * Create a new scheduled post
   */
  async createPost(
    userId: string,
    createPostDto: CreatePostDto,
  ): Promise<ScheduledPost> {
    const { accountId, text, mediaUrls, scheduledFor } = createPostDto;

    // Verify account ownership
    const account = await this.accountsService.getAccountById(
      accountId,
      userId,
    );
    if (!account) {
      throw new ForbiddenException("Account not found or access denied");
    }

    // Validate scheduled time
    if (scheduledFor) {
      const scheduledDate = new Date(scheduledFor);
      const now = new Date();

      if (scheduledDate <= now) {
        throw new BadRequestException("Scheduled time must be in the future");
      }

      // Minimum 5 minutes in the future
      const minScheduleTime = new Date(now.getTime() + 5 * 60 * 1000);
      if (scheduledDate < minScheduleTime) {
        throw new BadRequestException(
          "Posts must be scheduled at least 5 minutes in advance",
        );
      }
    }

    try {
      // Create scheduled post
      const post = this.scheduledPostRepository.create({
        accountId,
        text: text,
        mediaRefs: mediaUrls || [],
        scheduledAt: scheduledFor ? new Date(scheduledFor) : new Date(),
        scheduleMode: scheduledFor
          ? ScheduleMode.SCHEDULED
          : ScheduleMode.IMMEDIATE,
        status: scheduledFor
          ? ScheduledPostStatus.SCHEDULED
          : ScheduledPostStatus.PENDING,
        attempts: 0,
        createdById: userId,
      });

      const savedPost = await this.scheduledPostRepository.save(post);

      // Queue for immediate publishing if not scheduled
      const publishData: PublishPostJobData = {
        scheduledPostId: savedPost.id,
        accountId: savedPost.accountId,
        text: savedPost.text,
        mediaRefs: savedPost.mediaRefs,
        attemptNumber: 0,
      };

      if (!scheduledFor) {
        await this.postPublisherQueue.addPublishJob(publishData, 0);
      } else {
        // Calculate delay for scheduled posting
        const delay = new Date(scheduledFor).getTime() - Date.now();
        await this.postPublisherQueue.addPublishJob(publishData, delay);
      }

      // Create audit log
      await this.createAuditLog(
        scheduledFor ? AuditAction.POST_SCHEDULED : AuditAction.POST_CREATED,
        userId,
        "scheduled_post",
        savedPost.id,
        true,
        {
          accountId,
          scheduledFor,
          hasMedia: (mediaUrls?.length || 0) > 0,
        },
      );

      this.logger.log(`Post ${savedPost.id} created for account ${accountId}`);

      return savedPost;
    } catch (error) {
      await this.createAuditLog(
        AuditAction.POST_CREATED,
        userId,
        "scheduled_post",
        null,
        false,
        null,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Get scheduled posts
   */
  async getScheduledPosts(
    userId: string,
    accountId?: string,
    status?: string,
  ): Promise<ScheduledPost[]> {
    // Get user's accounts
    const userAccounts = await this.accountsService.getUserAccounts(userId);
    const accountIds = userAccounts.map((acc) => acc.id);

    if (accountIds.length === 0) {
      return [];
    }

    const query = this.scheduledPostRepository.createQueryBuilder("post");

    if (accountId) {
      // Verify ownership
      if (!accountIds.includes(accountId)) {
        throw new ForbiddenException("Account access denied");
      }
      query.where("post.accountId = :accountId", { accountId });
    } else {
      query.where("post.accountId IN (:...accountIds)", { accountIds });
    }

    if (status) {
      query.andWhere("post.status = :status", { status });
    }

    // DBカラム名に合わせる（scheduledFor は仮想プロパティ）
    query.orderBy("post.scheduledAt", "ASC");

    return query.getMany();
  }

  /**
   * Get a specific scheduled post
   */
  async getScheduledPost(
    postId: string,
    userId: string,
  ): Promise<ScheduledPost> {
    const post = await this.scheduledPostRepository.findOne({
      where: { id: postId },
      relations: ["account"],
    });

    if (!post) {
      throw new NotFoundException("Post not found");
    }

    // Verify ownership
    const account = await this.accountsService.getAccountById(
      post.accountId,
      userId,
    );
    if (!account) {
      throw new ForbiddenException("Access denied");
    }

    return post;
  }

  /**
   * Update a scheduled post
   */
  async updatePost(
    postId: string,
    userId: string,
    updatePostDto: UpdatePostDto,
  ): Promise<ScheduledPost> {
    const post = await this.getScheduledPost(postId, userId);

    // Can only update scheduled posts
    if (post.status !== ScheduledPostStatus.SCHEDULED) {
      throw new BadRequestException(
        "Can only update posts with SCHEDULED status",
      );
    }

    // Validate new scheduled time if provided
    if (updatePostDto.scheduledFor) {
      const scheduledDate = new Date(updatePostDto.scheduledFor);
      const now = new Date();

      if (scheduledDate <= now) {
        throw new BadRequestException("Scheduled time must be in the future");
      }

      const minScheduleTime = new Date(now.getTime() + 5 * 60 * 1000);
      if (scheduledDate < minScheduleTime) {
        throw new BadRequestException(
          "Posts must be scheduled at least 5 minutes in advance",
        );
      }
    }

    try {
      // Update post
      Object.assign(post, updatePostDto);
      const updatedPost = await this.scheduledPostRepository.save(post);

      // Reschedule job if time changed
      if (updatePostDto.scheduledFor) {
        await this.postPublisherQueue.removeJob(postId);
        const delay =
          new Date(updatePostDto.scheduledFor).getTime() - Date.now();
        // Get post details for queue
        const postData = await this.scheduledPostRepository.findOne({
          where: { id: postId },
        });

        if (postData) {
          const publishData: PublishPostJobData = {
            scheduledPostId: postData.id,
            accountId: postData.accountId,
            text: postData.text,
            mediaRefs: postData.mediaRefs,
            attemptNumber: 0,
          };
          await this.postPublisherQueue.addPublishJob(publishData, delay);
        }
      }

      // Create audit log
      await this.createAuditLog(
        AuditAction.POST_UPDATED,
        userId,
        "scheduled_post",
        postId,
        true,
        updatePostDto,
      );

      return updatedPost;
    } catch (error) {
      await this.createAuditLog(
        AuditAction.POST_UPDATED,
        userId,
        "scheduled_post",
        postId,
        false,
        null,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Cancel a scheduled post
   */
  async cancelPost(postId: string, userId: string): Promise<void> {
    const post = await this.getScheduledPost(postId, userId);

    if (post.status !== ScheduledPostStatus.SCHEDULED) {
      throw new BadRequestException(
        "Can only cancel posts with SCHEDULED status",
      );
    }

    try {
      // Update status
      post.status = PostStatus.CANCELLED;
      await this.scheduledPostRepository.save(post);

      // Remove from queue
      await this.postPublisherQueue.removeJob(postId);

      // Create audit log
      await this.createAuditLog(
        AuditAction.POST_CANCELLED,
        userId,
        "scheduled_post",
        postId,
        true,
      );

      this.logger.log(`Post ${postId} cancelled`);
    } catch (error) {
      await this.createAuditLog(
        AuditAction.POST_CANCELLED,
        userId,
        "scheduled_post",
        postId,
        false,
        null,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Get published posts
   */
  async getPublishedPosts(
    userId: string,
    accountId?: string,
    limit = 25,
    offset = 0,
  ): Promise<{ posts: PublishedPostCache[]; total: number }> {
    // Get user's accounts
    const userAccounts = await this.accountsService.getUserAccounts(userId);
    const accountIds = userAccounts.map((acc) => acc.id);

    if (accountIds.length === 0) {
      return { posts: [], total: 0 };
    }

    const query = this.publishedPostRepository.createQueryBuilder("post");

    if (accountId) {
      // Verify ownership
      if (!accountIds.includes(accountId)) {
        throw new ForbiddenException("Account access denied");
      }
      query.where("post.accountId = :accountId", { accountId });
    } else {
      query.where("post.accountId IN (:...accountIds)", { accountIds });
    }

    const [posts, total] = await query
      .orderBy("post.publishedAt", "DESC")
      .limit(limit)
      .offset(offset)
      .getManyAndCount();

    return { posts, total };
  }

  /**
   * Delete a published post from Threads
   */
  async deletePublishedPost(postId: string, userId: string): Promise<void> {
    const post = await this.publishedPostRepository.findOne({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException("Post not found");
    }

    // Verify ownership
    const account = await this.accountsService.getAccountById(
      post.accountId,
      userId,
    );
    if (!account) {
      throw new ForbiddenException("Access denied");
    }

    try {
      // Queue deletion job
      await this.postDeletionQueue.addDeleteJob(postId, userId);

      // Create audit log
      await this.createAuditLog(
        AuditAction.POST_DELETED,
        userId,
        "published_post",
        postId,
        true,
        { threadsPostId: post.threadsPostId },
      );

      this.logger.log(`Deletion queued for post ${postId}`);
    } catch (error) {
      await this.createAuditLog(
        AuditAction.POST_DELETED,
        userId,
        "published_post",
        postId,
        false,
        null,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Send a test post to Threads immediately
   */
  async sendTestPost(
    accessToken: string,
    userId: string,
    text?: string,
  ): Promise<{
    success: boolean;
    postId?: string;
    permalink?: string;
    message: string;
  }> {
    const testText =
      text ||
      `SmartThreads テスト投稿 - ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`;

    try {
      // Create the post using the Threads API
      const result = await this.threadsApiService.createPost(
        accessToken,
        userId,
        testText,
      );

      this.logger.log(`Test post created successfully: ${result.id}`);

      // Save to published posts cache for testing purposes
      try {
        const publishedPost = this.publishedPostRepository.create({
          accountId: "test-account-" + userId, // Use test account ID
          externalPostId: result.id,
          text: testText,
          mediaUrls: [],
          publishedAt: new Date(),
          permalink: result.permalink,
        });

        await this.publishedPostRepository.save(publishedPost);
        this.logger.log(`Test post saved to cache: ${publishedPost.id}`);
      } catch (cacheError) {
        this.logger.warn(
          `Failed to save test post to cache: ${cacheError.message}`,
        );
      }

      return {
        success: true,
        postId: result.id,
        permalink: result.permalink,
        message: "Test post sent successfully",
      };
    } catch (error) {
      this.logger.error("Test post failed:", error);

      return {
        success: false,
        message: `Test post failed: ${error.message || "Unknown error"}`,
      };
    }
  }

  /**
   * Create audit log
   */
  private async createAuditLog(
    action: AuditAction,
    actorId: string,
    targetType: string,
    targetId: string | null,
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
