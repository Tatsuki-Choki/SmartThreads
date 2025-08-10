import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
import { Account } from "./account.entity";
import { ReplyTemplate } from "./reply-template.entity";
import { ReplyLog } from "./reply-log.entity";

export enum MatchType {
  EXACT = "exact",
  PARTIAL = "partial",
}

@Entity("keyword_replies")
@Index(["accountId", "isActive"])
@Index(["priority", "isActive"])
export class KeywordReply {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  keyword: string;

  @Column({
    type: "enum",
    enum: MatchType,
    default: MatchType.PARTIAL,
  })
  matchType: MatchType;

  @Column({ type: "integer", default: 5 })
  priority: number;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @Column({ type: "integer", default: 0 })
  totalMatches: number;

  @Column({ type: "integer", default: 0 })
  successfulReplies: number;

  @Column({ type: "integer", default: 0 })
  failedReplies: number;

  @Column({ type: "timestamp", nullable: true })
  lastTriggeredAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Account, { onDelete: "CASCADE" })
  @JoinColumn({ name: "accountId" })
  account: Account;

  @Column({ type: "uuid" })
  accountId: string;

  @OneToMany(() => ReplyTemplate, (template) => template.keywordReply, {
    cascade: true,
    eager: true,
  })
  replies: ReplyTemplate[];

  @OneToMany(() => ReplyLog, (log) => log.keywordReply)
  logs: ReplyLog[];
}