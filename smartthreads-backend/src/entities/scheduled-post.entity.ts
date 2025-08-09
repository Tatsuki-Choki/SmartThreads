import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Account } from "./account.entity";
import { User } from "./user.entity";

export enum ScheduledPostStatus {
  PENDING = "pending",
  SCHEDULED = "scheduled",
  PROCESSING = "processing",
  COMPLETED = "completed",
  PUBLISHED = "published",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

// Alias for backward compatibility
export const PostStatus = ScheduledPostStatus;

export enum ScheduleMode {
  IMMEDIATE = "immediate",
  SCHEDULED = "scheduled",
}

@Entity("scheduled_posts")
@Index(["scheduledAt"])
@Index(["status"])
@Index(["accountId"])
export class ScheduledPost {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "text" })
  text: string;

  @Column({ type: "jsonb", nullable: true })
  mediaRefs: string[];

  @Column({
    type: "enum",
    enum: ScheduleMode,
    default: ScheduleMode.SCHEDULED,
  })
  scheduleMode: ScheduleMode;

  @Column({ type: "timestamp" })
  scheduledAt: Date;

  @Column({
    type: "enum",
    enum: ScheduledPostStatus,
    default: ScheduledPostStatus.PENDING,
  })
  status: ScheduledPostStatus;

  @Column({ type: "integer", default: 0 })
  attempts: number;

  @Column({ type: "text", nullable: true })
  lastError?: string;

  @Column({ type: "jsonb", nullable: true })
  errorDetails?: any;

  @Column({ type: "varchar", length: 255, nullable: true })
  externalPostId?: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  permalink?: string;

  @Column({ type: "timestamp", nullable: true })
  publishedAt?: Date;

  @Column({ type: "varchar", length: 255, nullable: true })
  idempotencyKey?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Account, (account) => account.scheduledPosts, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "accountId" })
  account: Account;

  @Column({ type: "uuid" })
  accountId: string;

  @ManyToOne(() => User, (user) => user.scheduledPosts, {
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "createdById" })
  createdBy: User;

  @Column({ type: "uuid", nullable: true })
  createdById?: string;

  // Virtual properties for compatibility
  get content(): string {
    return this.text;
  }

  set content(value: string) {
    this.text = value;
  }

  get mediaUrls(): string[] {
    return this.mediaRefs || [];
  }

  set mediaUrls(value: string[]) {
    this.mediaRefs = value;
  }

  get scheduledFor(): Date | null {
    return this.scheduleMode === ScheduleMode.SCHEDULED
      ? this.scheduledAt
      : null;
  }

  set scheduledFor(value: Date | null) {
    if (value) {
      this.scheduleMode = ScheduleMode.SCHEDULED;
      this.scheduledAt = value;
    } else {
      this.scheduleMode = ScheduleMode.IMMEDIATE;
    }
  }
}
