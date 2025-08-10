import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { KeywordRepliesService } from "./keyword-replies.service";
import {
  KeywordRepliesController,
  ReplyLogsController,
} from "./keyword-replies.controller";
import {
  KeywordReply,
  ReplyTemplate,
  ReplyLog,
  Account,
} from "../entities";

@Module({
  imports: [
    TypeOrmModule.forFeature([KeywordReply, ReplyTemplate, ReplyLog, Account]),
  ],
  controllers: [KeywordRepliesController, ReplyLogsController],
  providers: [KeywordRepliesService],
  exports: [KeywordRepliesService],
})
export class KeywordRepliesModule {}