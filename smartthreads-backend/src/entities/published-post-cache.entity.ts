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

@Entity("published_posts_cache")
@Index(["externalPostId"], { unique: true })
@Index(["publishedAt"])
@Index(["accountId"])
export class PublishedPostCache {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255, unique: true })
  externalPostId: string;

  @Column({ type: "varchar", length: 500 })
  permalink: string;

  @Column({ type: "text" })
  text: string;

  @Column({ type: "jsonb", nullable: true })
  mediaUrls: string[];

  @Column({ type: "timestamp" })
  publishedAt: Date;

  @Column({ type: "integer", default: 0 })
  likesCount: number;

  @Column({ type: "integer", default: 0 })
  repliesCount: number;

  @Column({ type: "integer", default: 0 })
  repostsCount: number;

  @Column({ type: "jsonb", nullable: true })
  metadata: any;

  // Virtual properties for compatibility
  get threadsPostId(): string {
    return this.externalPostId;
  }

  get content(): string {
    return this.text;
  }

  get metrics() {
    return {
      views: this.metadata?.views || 0,
      likes: this.likesCount,
      replies: this.repliesCount,
      reposts: this.repostsCount,
      quotes: this.metadata?.quotes || 0,
    };
  }

  set metrics(value: any) {
    this.likesCount = value.likes || 0;
    this.repliesCount = value.replies || 0;
    this.repostsCount = value.reposts || 0;
    if (!this.metadata) this.metadata = {};
    this.metadata.views = value.views || 0;
    this.metadata.quotes = value.quotes || 0;
  }

  @Column({ type: "timestamp", nullable: true })
  lastSyncedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Account, (account) => account.publishedPostsCache, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "accountId" })
  account: Account;

  @Column({ type: "uuid" })
  accountId: string;
}
