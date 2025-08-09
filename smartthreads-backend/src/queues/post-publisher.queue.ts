import { Queue } from "bull";
import { InjectQueue } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";

export const POST_PUBLISHER_QUEUE = "post-publisher";

export interface PublishPostJobData {
  scheduledPostId: string;
  accountId: string;
  text: string;
  mediaRefs?: string[];
  attemptNumber: number;
}

@Injectable()
export class PostPublisherQueue {
  constructor(
    @InjectQueue(POST_PUBLISHER_QUEUE)
    private readonly queue: Queue<PublishPostJobData>,
  ) {}

  async addPublishJob(data: PublishPostJobData, delay?: number) {
    const job = await this.queue.add("publish", data, {
      delay,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      // 投稿IDをジョブIDとして固定し、再スケジュールや削除を安定化
      jobId: data.scheduledPostId,
      removeOnComplete: true,
      removeOnFail: false,
    });

    return job;
  }

  async getJob(jobId: string) {
    return this.queue.getJob(jobId);
  }

  async removeJob(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }

  async getDelayedJobs() {
    return this.queue.getDelayed();
  }

  async getActiveJobs() {
    return this.queue.getActive();
  }

  async getFailedJobs() {
    return this.queue.getFailed();
  }

  async cleanOldJobs() {
    await this.queue.clean(24 * 3600 * 1000); // Clean jobs older than 24 hours
  }
}
