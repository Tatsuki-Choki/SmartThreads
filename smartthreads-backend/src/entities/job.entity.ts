import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export enum JobType {
  PUBLISH_POST = "publish_post",
  DELETE_POST = "delete_post",
  SYNC_POSTS = "sync_posts",
  HEALTH_CHECK = "health_check",
  TOKEN_REFRESH = "token_refresh",
  MEDIA_PROCESS = "media_process",
  CLEANUP = "cleanup",
}

export enum JobStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

@Entity("jobs")
@Index(["type", "status"])
@Index(["runAt"])
@Index(["priority"])
export class Job {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: JobType,
  })
  type: JobType;

  @Column({ type: "jsonb" })
  payload: any;

  @Column({ type: "timestamp" })
  runAt: Date;

  @Column({
    type: "enum",
    enum: JobStatus,
    default: JobStatus.PENDING,
  })
  status: JobStatus;

  @Column({ type: "integer", default: 0 })
  attempts: number;

  @Column({ type: "integer", default: 3 })
  maxAttempts: number;

  @Column({ type: "text", nullable: true })
  lastError?: string;

  @Column({ type: "jsonb", nullable: true })
  result?: any;

  @Column({ type: "integer", default: 0 })
  priority: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  queueName?: string;

  @Column({ type: "timestamp", nullable: true })
  startedAt?: Date;

  @Column({ type: "timestamp", nullable: true })
  completedAt?: Date;

  @Column({ type: "timestamp", nullable: true })
  failedAt?: Date;

  @Column({ type: "integer", nullable: true })
  processingTime?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
