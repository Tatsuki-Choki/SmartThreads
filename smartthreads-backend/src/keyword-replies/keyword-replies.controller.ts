import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import { KeywordRepliesService } from "./keyword-replies.service";
import {
  CreateKeywordReplyDto,
  UpdateKeywordReplyDto,
  KeywordReplyQueryDto,
  ReplyLogQueryDto,
} from "./dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../entities";

@Controller("keyword-replies")
@UseGuards(JwtAuthGuard)
export class KeywordRepliesController {
  constructor(private readonly keywordRepliesService: KeywordRepliesService) {}

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() createKeywordReplyDto: CreateKeywordReplyDto
  ) {
    return this.keywordRepliesService.create(user.id, createKeywordReplyDto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query() query: KeywordReplyQueryDto
  ) {
    return this.keywordRepliesService.findAll(user.id, query);
  }

  @Get("stats")
  async getStats(
    @CurrentUser() user: User,
    @Query("accountId") accountId?: string
  ) {
    return this.keywordRepliesService.getStats(user.id, accountId);
  }

  @Get(":id")
  async findOne(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string
  ) {
    return this.keywordRepliesService.findOne(user.id, id);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateKeywordReplyDto: UpdateKeywordReplyDto
  ) {
    return this.keywordRepliesService.update(user.id, id, updateKeywordReplyDto);
  }

  @Delete(":id")
  async remove(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string
  ) {
    await this.keywordRepliesService.remove(user.id, id);
    return { message: "キーワード返信設定を削除しました" };
  }
}

@Controller("reply-logs")
@UseGuards(JwtAuthGuard)
export class ReplyLogsController {
  constructor(private readonly keywordRepliesService: KeywordRepliesService) {}

  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query() query: ReplyLogQueryDto
  ) {
    return this.keywordRepliesService.getReplyLogs(user.id, query);
  }
}