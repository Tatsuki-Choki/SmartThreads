import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan } from "typeorm";
import { PublishedPostCache } from "../entities/published-post-cache.entity";
import { Account } from "../entities/account.entity";
import { ThreadsApiService } from "../accounts/threads-api.service";
import { AccountsService } from "../accounts/accounts.service";

@Injectable()
export class MetricsCollectorService {
  private readonly logger = new Logger(MetricsCollectorService.name);

  constructor(
    @InjectRepository(PublishedPostCache)
    private publishedPostRepository: Repository<PublishedPostCache>,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    private threadsApiService: ThreadsApiService,
    private accountsService: AccountsService,
  ) {}

  /**
   * Collect metrics for recent posts (runs every hour)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async collectRecentMetrics(): Promise<void> {
    this.logger.log("Starting metrics collection for recent posts");

    try {
      // Get posts from last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentPosts = await this.publishedPostRepository.find({
        where: {
          publishedAt: MoreThan(sevenDaysAgo),
        },
        relations: ["account"],
      });

      this.logger.log(`Found ${recentPosts.length} recent posts to update`);

      // Group posts by account
      const postsByAccount = new Map<string, PublishedPostCache[]>();
      for (const post of recentPosts) {
        const accountId = post.accountId;
        if (!postsByAccount.has(accountId)) {
          postsByAccount.set(accountId, []);
        }
        postsByAccount.get(accountId)!.push(post);
      }

      // Process each account's posts
      for (const [accountId, posts] of postsByAccount) {
        await this.collectAccountMetrics(accountId, posts);
      }
    } catch (error) {
      this.logger.error("Metrics collection failed", error.stack);
    }
  }

  /**
   * Collect metrics for older posts (runs daily at 2 AM)
   */
  @Cron("0 2 * * *")
  async collectHistoricalMetrics(): Promise<void> {
    this.logger.log("Starting metrics collection for historical posts");

    try {
      // Get posts older than 7 days but less than 30 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const historicalPosts = await this.publishedPostRepository
        .createQueryBuilder("post")
        .where("post.publishedAt > :thirtyDaysAgo", { thirtyDaysAgo })
        .andWhere("post.publishedAt <= :sevenDaysAgo", { sevenDaysAgo })
        .getMany();

      this.logger.log(
        `Found ${historicalPosts.length} historical posts to update`,
      );

      // Process in batches to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < historicalPosts.length; i += batchSize) {
        const batch = historicalPosts.slice(i, i + batchSize);
        await Promise.all(batch.map((post) => this.updatePostMetrics(post)));

        // Delay between batches
        if (i + batchSize < historicalPosts.length) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    } catch (error) {
      this.logger.error("Historical metrics collection failed", error.stack);
    }
  }

  /**
   * Collect metrics for a specific account's posts
   */
  private async collectAccountMetrics(
    accountId: string,
    posts: PublishedPostCache[],
  ): Promise<void> {
    try {
      const account =
        await this.accountsService.getAccountWithCredentials(accountId);

      if (!account || !account.credential) {
        this.logger.warn(
          `Account ${accountId} not found or has no credentials`,
        );
        return;
      }

      for (const post of posts) {
        try {
          const insights = await this.threadsApiService.getPostInsights(
            account.credential.accessTokenEnc,
            post.threadsPostId,
          );

          // Update post metrics
          post.metrics = {
            views:
              insights.data.find((m: any) => m.name === "views")?.values[0]
                ?.value || 0,
            likes:
              insights.data.find((m: any) => m.name === "likes")?.values[0]
                ?.value || 0,
            replies:
              insights.data.find((m: any) => m.name === "replies")?.values[0]
                ?.value || 0,
            reposts:
              insights.data.find((m: any) => m.name === "reposts")?.values[0]
                ?.value || 0,
            quotes:
              insights.data.find((m: any) => m.name === "quotes")?.values[0]
                ?.value || 0,
          };

          await this.publishedPostRepository.save(post);

          this.logger.debug(`Updated metrics for post ${post.id}`);
        } catch (error) {
          this.logger.error(
            `Failed to update metrics for post ${post.id}: ${error.message}`,
          );
        }

        // Rate limit delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      this.logger.error(
        `Failed to collect metrics for account ${accountId}: ${error.message}`,
      );
    }
  }

  /**
   * Update metrics for a single post
   */
  private async updatePostMetrics(post: PublishedPostCache): Promise<void> {
    try {
      const account = await this.accountsService.getAccountWithCredentials(
        post.accountId,
      );

      if (!account || !account.credential) {
        return;
      }

      const insights = await this.threadsApiService.getPostInsights(
        account.credential.accessTokenEnc,
        post.threadsPostId,
      );

      post.metrics = {
        views:
          insights.data.find((m: any) => m.name === "views")?.values[0]
            ?.value || 0,
        likes:
          insights.data.find((m: any) => m.name === "likes")?.values[0]
            ?.value || 0,
        replies:
          insights.data.find((m: any) => m.name === "replies")?.values[0]
            ?.value || 0,
        reposts:
          insights.data.find((m: any) => m.name === "reposts")?.values[0]
            ?.value || 0,
        quotes:
          insights.data.find((m: any) => m.name === "quotes")?.values[0]
            ?.value || 0,
      };

      await this.publishedPostRepository.save(post);
    } catch (error) {
      this.logger.error(
        `Failed to update metrics for post ${post.id}: ${error.message}`,
      );
    }
  }
}
