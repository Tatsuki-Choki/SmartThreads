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
import { KeywordReply } from "./keyword-reply.entity";
import { ReplyLog } from "./reply-log.entity";

@Entity("reply_templates")
@Index(["keywordReplyId", "isActive"])
export class ReplyTemplate {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "text" })
  text: string;

  @Column({ type: "integer", default: 100 })
  weight: number;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @Column({ type: "integer", default: 0 })
  usageCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => KeywordReply, (keywordReply) => keywordReply.replies, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "keywordReplyId" })
  keywordReply: KeywordReply;

  @Column({ type: "uuid" })
  keywordReplyId: string;

  @OneToMany(() => ReplyLog, (log) => log.replyTemplate)
  logs: ReplyLog[];
}