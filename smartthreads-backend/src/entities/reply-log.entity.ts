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
import { KeywordReply } from "./keyword-reply.entity";
import { ReplyTemplate } from "./reply-template.entity";

export enum ReplyStatus {
  PENDING = "pending",
  SUCCESS = "success",
  FAILED = "failed",
}

@Entity("reply_logs")
@Index(["keywordReplyId", "status"])
@Index(["createdAt"])
export class ReplyLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  commentId: string;

  @Column({ type: "text" })
  originalComment: string;

  @Column({ type: "text" })
  replyText: string;

  @Column({
    type: "enum",
    enum: ReplyStatus,
    default: ReplyStatus.PENDING,
  })
  status: ReplyStatus;

  @Column({ type: "text", nullable: true })
  errorMessage?: string;

  @Column({ type: "timestamp", nullable: true })
  executedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => KeywordReply, (keywordReply) => keywordReply.logs, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "keywordReplyId" })
  keywordReply: KeywordReply;

  @Column({ type: "uuid" })
  keywordReplyId: string;

  @ManyToOne(() => ReplyTemplate, (template) => template.logs, {
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "replyTemplateId" })
  replyTemplate?: ReplyTemplate;

  @Column({ type: "uuid", nullable: true })
  replyTemplateId?: string;
}