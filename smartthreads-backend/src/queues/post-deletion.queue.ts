import { Queue } from "bull";
import { InjectQueue } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";

export const POST_DELETION_QUEUE = "post-deletion";

export interface DeletePostJobData {
  postId: string;
  userId: string;
  retryCount?: number;
}

export interface BulkDeleteJobData {
  postIds: string[];
  userId: string;
}

@Injectable()
export class PostDeletionQueue {
  constructor(
    @InjectQueue(POST_DELETION_QUEUE)
    private readonly queue: Queue,
  ) {}

  async addDeleteJob(postId: string, userId: string) {
    const job = await this.queue.add(
      "delete",
      {
        postId,
        userId,
        retryCount: 0,
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return job;
  }

  async addBulkDeleteJob(postIds: string[], userId: string) {
    const job = await this.queue.add(
      "bulk-delete",
      {
        postIds,
        userId,
      },
      {
        attempts: 1, // Bulk jobs handle retries internally
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return job;
  }

  async getJob(jobId: string) {
    return this.queue.getJob(jobId);
  }

  async getJobProgress(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (job) {
      return {
        progress: job.progress(),
        state: await job.getState(),
        data: job.data,
      };
    }
    return null;
  }

  async getActiveJobs() {
    return this.queue.getActive();
  }

  async getFailedJobs() {
    return this.queue.getFailed();
  }

  async retryFailedJob(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (job && (await job.isFailed())) {
      await job.retry();
      return true;
    }
    return false;
  }

  async cleanOldJobs() {
    await this.queue.clean(24 * 3600 * 1000); // Clean jobs older than 24 hours
  }
}
