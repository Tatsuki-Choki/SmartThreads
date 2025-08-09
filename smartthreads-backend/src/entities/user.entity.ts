import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { Account } from "./account.entity";
import { ScheduledPost } from "./scheduled-post.entity";
import { AuditLog } from "./audit-log.entity";

export enum UserRole {
  ADMIN = "admin",
  EDITOR = "editor",
  VIEWER = "viewer",
}

@Entity("users")
@Index(["email"], { unique: true })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  @Column({ type: "varchar", length: 255 })
  password: string;

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.VIEWER,
  })
  role: UserRole;

  @Column({ type: "varchar", length: 50, default: "Asia/Tokyo" })
  timezone: string;

  @Column({ type: "varchar", length: 10, default: "ja" })
  language: string;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @Column({ type: "boolean", default: false })
  twoFactorEnabled: boolean;

  @Column({ type: "varchar", length: 255, nullable: true })
  twoFactorSecret?: string;

  @Column({ type: "jsonb", nullable: true })
  notificationSettings: {
    email: boolean;
    push: boolean;
    tokenExpiry72h: boolean;
    tokenExpiry24h: boolean;
    tokenExpiry1h: boolean;
    scheduleSuccess: boolean;
    scheduleFailure: boolean;
  };

  @Column({ type: "timestamp", nullable: true })
  lastLoginAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Account, (account) => account.user)
  accounts: Account[];

  @OneToMany(() => ScheduledPost, (post) => post.createdBy)
  scheduledPosts: ScheduledPost[];

  @OneToMany(() => AuditLog, (log) => log.actor)
  auditLogs: AuditLog[];
}
