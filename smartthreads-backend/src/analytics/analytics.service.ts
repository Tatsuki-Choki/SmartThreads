import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, SelectQueryBuilder } from "typeorm";
import { PublishedPostCache } from "../entities/published-post-cache.entity";
import { Account } from "../entities/account.entity";
import {
  AnalyticsQueryDto,
  AnalyticsPeriod,
  MetricType,
} from "./dto/analytics-query.dto";
import { AccountsService } from "../accounts/accounts.service";
import * as fs from "fs";
import * as path from "path";
import { parse } from "json2csv";

export interface PostAnalytics {
  postId: string;
  accountId: string;
  content: string;
  publishedAt: Date;
  metrics: {
    views: number;
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
    engagementRate: number;
  };
}

export interface TimeSeriesData {
  period: string;
  metrics: {
    [key: string]: number;
  };
  posts: number;
}

export interface AccountAnalytics {
  accountId: string;
  accountName: string;
  totalPosts: number;
  totalViews: number;
  totalEngagement: number;
  averageEngagementRate: number;
  topPerformingPost?: PostAnalytics;
  timeSeriesData?: TimeSeriesData[];
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(PublishedPostCache)
    private publishedPostRepository: Repository<PublishedPostCache>,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    private accountsService: AccountsService,
  ) {}

  /**
   * Get post analytics
   */
  async getPostAnalytics(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<PostAnalytics[]> {
    // Get user's accounts
    const userAccounts = await this.accountsService.getUserAccounts(userId);
    const accountIds = userAccounts.map((acc) => acc.id);

    if (accountIds.length === 0) {
      return [];
    }

    // Build query
    const qb = this.publishedPostRepository.createQueryBuilder("post");

    // Filter by account
    if (query.accountId && accountIds.includes(query.accountId)) {
      qb.where("post.accountId = :accountId", { accountId: query.accountId });
    } else {
      qb.where("post.accountId IN (:...accountIds)", { accountIds });
    }

    // Filter by date range
    if (query.startDate && query.endDate) {
      qb.andWhere("post.publishedAt BETWEEN :startDate AND :endDate", {
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
      });
    }

    // Limit results
    qb.limit(query.limit || 100);
    qb.orderBy("post.publishedAt", "DESC");

    const posts = await qb.getMany();

    // Calculate analytics
    return posts.map((post) => ({
      postId: post.id,
      accountId: post.accountId,
      content: post.content,
      publishedAt: post.publishedAt,
      metrics: {
        views: post.metrics?.views || 0,
        likes: post.metrics?.likes || 0,
        replies: post.metrics?.replies || 0,
        reposts: post.metrics?.reposts || 0,
        quotes: post.metrics?.quotes || 0,
        engagementRate: this.calculateEngagementRate(post),
      },
    }));
  }

  /**
   * Get account analytics
   */
  async getAccountAnalytics(
    userId: string,
    accountId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AccountAnalytics[]> {
    const userAccounts = await this.accountsService.getUserAccounts(userId);
    const accountIds = accountId
      ? [accountId].filter((id) => userAccounts.some((acc) => acc.id === id))
      : userAccounts.map((acc) => acc.id);

    const analytics: AccountAnalytics[] = [];

    for (const accId of accountIds) {
      const account = userAccounts.find((acc) => acc.id === accId);
      if (!account) continue;

      // Get posts for account
      const qb = this.publishedPostRepository.createQueryBuilder("post");
      qb.where("post.accountId = :accountId", { accountId: accId });

      if (startDate && endDate) {
        qb.andWhere("post.publishedAt BETWEEN :startDate AND :endDate", {
          startDate,
          endDate,
        });
      }

      const posts = await qb.getMany();

      // Calculate metrics
      const totalViews = posts.reduce(
        (sum, post) => sum + (post.metrics?.views || 0),
        0,
      );
      const totalLikes = posts.reduce(
        (sum, post) => sum + (post.metrics?.likes || 0),
        0,
      );
      const totalReplies = posts.reduce(
        (sum, post) => sum + (post.metrics?.replies || 0),
        0,
      );
      const totalReposts = posts.reduce(
        (sum, post) => sum + (post.metrics?.reposts || 0),
        0,
      );
      const totalEngagement = totalLikes + totalReplies + totalReposts;

      // Find top performing post
      const topPost = posts.reduce((top, post) => {
        const engagement =
          (post.metrics?.likes || 0) +
          (post.metrics?.replies || 0) +
          (post.metrics?.reposts || 0);
        const topEngagement =
          (top?.metrics?.likes || 0) +
          (top?.metrics?.replies || 0) +
          (top?.metrics?.reposts || 0);
        return engagement > topEngagement ? post : top;
      }, posts[0]);

      analytics.push({
        accountId: accId,
        accountName: account.displayName,
        totalPosts: posts.length,
        totalViews,
        totalEngagement,
        averageEngagementRate:
          posts.length > 0
            ? posts.reduce(
                (sum, post) => sum + this.calculateEngagementRate(post),
                0,
              ) / posts.length
            : 0,
        topPerformingPost: topPost
          ? {
              postId: topPost.id,
              accountId: topPost.accountId,
              content: topPost.content,
              publishedAt: topPost.publishedAt,
              metrics: {
                views: topPost.metrics?.views || 0,
                likes: topPost.metrics?.likes || 0,
                replies: topPost.metrics?.replies || 0,
                reposts: topPost.metrics?.reposts || 0,
                quotes: topPost.metrics?.quotes || 0,
                engagementRate: this.calculateEngagementRate(topPost),
              },
            }
          : undefined,
      });
    }

    return analytics;
  }

  /**
   * Get time series analytics
   */
  async getTimeSeriesAnalytics(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<TimeSeriesData[]> {
    const userAccounts = await this.accountsService.getUserAccounts(userId);
    const accountIds = query.accountId
      ? [query.accountId].filter((id) =>
          userAccounts.some((acc) => acc.id === id),
        )
      : userAccounts.map((acc) => acc.id);

    if (accountIds.length === 0) {
      return [];
    }

    // Get posts
    const qb = this.publishedPostRepository.createQueryBuilder("post");

    if (query.accountId) {
      qb.where("post.accountId = :accountId", { accountId: query.accountId });
    } else {
      qb.where("post.accountId IN (:...accountIds)", { accountIds });
    }

    if (query.startDate && query.endDate) {
      qb.andWhere("post.publishedAt BETWEEN :startDate AND :endDate", {
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
      });
    }

    const posts = await qb.getMany();

    // Group by period
    const grouped = this.groupByPeriod(
      posts,
      query.period || AnalyticsPeriod.DAY,
    );

    // Calculate metrics for each period
    return Object.entries(grouped)
      .map(([period, periodPosts]) => {
        const metrics: { [key: string]: number } = {};

        if (query.metrics?.includes(MetricType.VIEWS)) {
          metrics.views = periodPosts.reduce(
            (sum, post) => sum + (post.metrics?.views || 0),
            0,
          );
        }
        if (query.metrics?.includes(MetricType.LIKES)) {
          metrics.likes = periodPosts.reduce(
            (sum, post) => sum + (post.metrics?.likes || 0),
            0,
          );
        }
        if (query.metrics?.includes(MetricType.REPLIES)) {
          metrics.replies = periodPosts.reduce(
            (sum, post) => sum + (post.metrics?.replies || 0),
            0,
          );
        }
        if (query.metrics?.includes(MetricType.REPOSTS)) {
          metrics.reposts = periodPosts.reduce(
            (sum, post) => sum + (post.metrics?.reposts || 0),
            0,
          );
        }
        if (query.metrics?.includes(MetricType.ENGAGEMENT_RATE)) {
          const avgEngagement =
            periodPosts.length > 0
              ? periodPosts.reduce(
                  (sum, post) => sum + this.calculateEngagementRate(post),
                  0,
                ) / periodPosts.length
              : 0;
          metrics.engagementRate = Math.round(avgEngagement * 100) / 100;
        }

        return {
          period,
          metrics,
          posts: periodPosts.length,
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Export analytics to CSV
   */
  async exportToCSV(userId: string, query: AnalyticsQueryDto): Promise<string> {
    const analytics = await this.getPostAnalytics(userId, query);

    const fields = [
      "postId",
      "accountId",
      "content",
      "publishedAt",
      "views",
      "likes",
      "replies",
      "reposts",
      "quotes",
      "engagementRate",
    ];

    const data = analytics.map((item) => ({
      postId: item.postId,
      accountId: item.accountId,
      content: item.content.substring(0, 100),
      publishedAt: item.publishedAt,
      views: item.metrics.views,
      likes: item.metrics.likes,
      replies: item.metrics.replies,
      reposts: item.metrics.reposts,
      quotes: item.metrics.quotes,
      engagementRate: item.metrics.engagementRate,
    }));

    const csv = parse(data, { fields });

    // Save to temp file
    const filename = `analytics_${Date.now()}.csv`;
    const filepath = path.join("/tmp", filename);
    fs.writeFileSync(filepath, csv);

    return filepath;
  }

  /**
   * Calculate engagement rate
   */
  private calculateEngagementRate(post: PublishedPostCache): number {
    const views = post.metrics?.views || 1; // Avoid division by zero
    const engagement =
      (post.metrics?.likes || 0) +
      (post.metrics?.replies || 0) +
      (post.metrics?.reposts || 0) +
      (post.metrics?.quotes || 0);

    return Math.round((engagement / views) * 10000) / 100; // Return as percentage
  }

  /**
   * Group posts by time period
   */
  private groupByPeriod(
    posts: PublishedPostCache[],
    period: AnalyticsPeriod,
  ): { [key: string]: PublishedPostCache[] } {
    const grouped: { [key: string]: PublishedPostCache[] } = {};

    posts.forEach((post) => {
      const key = this.getPeriodKey(post.publishedAt, period);
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(post);
    });

    return grouped;
  }

  /**
   * Get period key for grouping
   */
  private getPeriodKey(date: Date, period: AnalyticsPeriod): string {
    const d = new Date(date);

    switch (period) {
      case AnalyticsPeriod.HOUR:
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`;

      case AnalyticsPeriod.DAY:
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      case AnalyticsPeriod.WEEK:
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        return `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getDate() + 6) / 7)).padStart(2, "0")}`;

      case AnalyticsPeriod.MONTH:
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      default:
        return d.toISOString().split("T")[0];
    }
  }
}
