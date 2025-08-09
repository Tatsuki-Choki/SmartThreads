import { Queue } from "bull";
import { InjectQueue } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";

export const HEALTH_CHECK_QUEUE = "health-check";

export interface HealthCheckJobData {
  accountId: string;
  checkType: "token_validation" | "api_connectivity" | "permissions";
}

@Injectable()
export class HealthCheckQueue {
  constructor(
    @InjectQueue(HEALTH_CHECK_QUEUE)
    private readonly queue: Queue<HealthCheckJobData>,
  ) {}

  async addHealthCheckJob(data: HealthCheckJobData) {
    const job = await this.queue.add("check", data, {
      attempts: 2,
      backoff: {
        type: "fixed",
        delay: 10000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    return job;
  }

  async schedulePeriodicHealthCheck(accountId: string) {
    // Schedule a recurring health check every hour
    const job = await this.queue.add(
      "periodic-check",
      {
        accountId,
        checkType: "token_validation",
      } as HealthCheckJobData,
      {
        repeat: {
          cron: "0 * * * *", // Every hour
        },
        removeOnComplete: true,
      },
    );

    return job;
  }

  async removePeriodicHealthCheck(accountId: string) {
    const repeatableJobs = await this.queue.getRepeatableJobs();
    const jobToRemove = repeatableJobs.find(
      (job) => job.name === "periodic-check" && job.id?.includes(accountId),
    );

    if (jobToRemove) {
      await this.queue.removeRepeatableByKey(jobToRemove.key);
    }
  }

  async getHealthCheckStatus() {
    const [active, delayed, failed] = await Promise.all([
      this.queue.getActiveCount(),
      this.queue.getDelayedCount(),
      this.queue.getFailedCount(),
    ]);

    return {
      active,
      delayed,
      failed,
      total: active + delayed + failed,
    };
  }
}
