import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";

export enum AuditAction {
  // Account actions
  ACCOUNT_LINKED = "account_linked",
  ACCOUNT_UNLINKED = "account_unlinked",
  ACCOUNT_UPDATED = "account_updated",
  CREDENTIALS_ROTATED = "credentials_rotated",

  // Post actions
  POST_CREATED = "post_created",
  POST_SCHEDULED = "post_scheduled",
  POST_PUBLISHED = "post_published",
  POST_UPDATED = "post_updated",
  POST_CANCELLED = "post_cancelled",
  POST_DELETED = "post_deleted",
  POST_FAILED = "post_failed",

  // Media actions
  MEDIA_UPLOADED = "media_uploaded",
  MEDIA_DELETED = "media_deleted",
  MEDIA_PROCESSED = "media_processed",

  // User actions
  USER_LOGIN = "user_login",
  USER_LOGOUT = "user_logout",
  USER_CREATED = "user_created",
  USER_UPDATED = "user_updated",
  USER_DELETED = "user_deleted",
  USER_ROLE_CHANGED = "user_role_changed",

  // Security actions
  PASSWORD_CHANGED = "password_changed",
  TWO_FACTOR_ENABLED = "two_factor_enabled",
  TWO_FACTOR_DISABLED = "two_factor_disabled",
  API_KEY_CREATED = "api_key_created",
  API_KEY_REVOKED = "api_key_revoked",
  TOKEN_EXPIRY_WARNING = "token_expiry_warning",
  TOKEN_EXPIRED = "token_expired",
  TOKEN_VALIDATION_FAILED = "token_validation_failed",

  // System actions
  HEALTH_CHECK_PERFORMED = "health_check_performed",
  TOKEN_REFRESHED = "token_refreshed",
  CLEANUP_PERFORMED = "cleanup_performed",
}

@Entity("audit_logs")
@Index(["action"])
@Index(["actorId"])
@Index(["timestamp"])
@Index(["targetType", "targetId"])
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({ type: "varchar", length: 100, nullable: true })
  targetType?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  targetId?: string;

  @Column({ type: "jsonb", nullable: true })
  details: any;

  @Column({ type: "varchar", length: 45, nullable: true })
  ipAddress?: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  userAgent?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  sessionId?: string;

  @Column({ type: "boolean", default: true })
  success: boolean;

  @Column({ type: "text", nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  timestamp: Date;

  @ManyToOne(() => User, (user) => user.auditLogs, {
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "actorId" })
  actor?: User;

  @Column({ type: "uuid", nullable: true })
  actorId?: string;
}
