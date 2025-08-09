import { Queue } from "bull";
import { InjectQueue } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";

export const MEDIA_PROCESSOR_QUEUE = "media-processor";

export interface MediaProcessorJobData {
  mediaAssetId: string;
  accountId: string;
  operations: Array<
    "compress" | "resize" | "remove_exif" | "generate_thumbnail"
  >;
  originalPath: string;
  targetPath?: string;
}

@Injectable()
export class MediaProcessorQueue {
  constructor(
    @InjectQueue(MEDIA_PROCESSOR_QUEUE)
    private readonly queue: Queue<MediaProcessorJobData>,
  ) {}

  async addProcessingJob(data: MediaProcessorJobData) {
    const job = await this.queue.add("process", data, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    return job;
  }

  async addBulkProcessingJobs(jobs: MediaProcessorJobData[]) {
    const bulkJobs = jobs.map((data) => ({
      name: "process",
      data,
      opts: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }));

    return this.queue.addBulk(bulkJobs);
  }

  async getProcessingStatus(mediaAssetId: string) {
    const jobs = await this.queue.getJobs(["active", "waiting", "delayed"]);
    const job = jobs.find((j) => j.data.mediaAssetId === mediaAssetId);

    if (job) {
      return {
        status: await job.getState(),
        progress: job.progress(),
        data: job.data,
      };
    }

    return null;
  }

  async cleanCompletedJobs() {
    await this.queue.clean(3600 * 1000); // Clean jobs older than 1 hour
  }
}
