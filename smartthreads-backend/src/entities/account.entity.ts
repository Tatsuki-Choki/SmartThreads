import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";
import { Credential } from "./credential.entity";
import { ScheduledPost } from "./scheduled-post.entity";
import { PublishedPostCache } from "./published-post-cache.entity";
import { MediaAsset } from "./media-asset.entity";

export enum AccountStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  WARNING = "warning",
  ERROR = "error",
  SUSPENDED = "suspended",
}

@Entity("accounts")
@Index(["threadsUserId"], { unique: true })
@Index(["userId"])
export class Account {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255, unique: true })
  threadsUserId: string;

  @Column({ type: "varchar", length: 255 })
  displayName: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  iconUrl?: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  profileUrl?: string;

  @Column({
    type: "enum",
    enum: AccountStatus,
    default: AccountStatus.ACTIVE,
  })
  status: AccountStatus;

  @Column({ type: "jsonb", nullable: true })
  permissions: string[];

  @Column({ type: "timestamp", nullable: true })
  lastHealthCheckAt?: Date;

  @Column({ type: "varchar", length: 500, nullable: true })
  lastHealthCheckError?: string;

  @Column({ type: "integer", default: 0 })
  totalPostsCount: number;

  @Column({ type: "integer", default: 0 })
  scheduledPostsCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.accounts, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "uuid" })
  userId: string;

  @OneToOne(() => Credential, (credential) => credential.account, {
    cascade: true,
  })
  credential: Credential;

  @OneToMany(() => ScheduledPost, (post) => post.account)
  scheduledPosts: ScheduledPost[];

  @OneToMany(() => PublishedPostCache, (cache) => cache.account)
  publishedPostsCache: PublishedPostCache[];

  @OneToMany(() => MediaAsset, (media) => media.ownerAccount)
  mediaAssets: MediaAsset[];
}
