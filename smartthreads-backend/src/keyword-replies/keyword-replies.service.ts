import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, FindManyOptions, In } from "typeorm";
import {
  KeywordReply,
  ReplyTemplate,
  ReplyLog,
  ReplyStatus,
  Account,
} from "../entities";
import {
  CreateKeywordReplyDto,
  UpdateKeywordReplyDto,
  KeywordReplyQueryDto,
  ReplyLogQueryDto,
} from "./dto";

@Injectable()
export class KeywordRepliesService {
  constructor(
    @InjectRepository(KeywordReply)
    private keywordReplyRepository: Repository<KeywordReply>,
    @InjectRepository(ReplyTemplate)
    private replyTemplateRepository: Repository<ReplyTemplate>,
    @InjectRepository(ReplyLog)
    private replyLogRepository: Repository<ReplyLog>,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>
  ) {}

  async create(
    userId: string,
    createKeywordReplyDto: CreateKeywordReplyDto
  ): Promise<KeywordReply> {
    // アカウントの所有者確認
    const account = await this.accountRepository.findOne({
      where: { id: createKeywordReplyDto.accountId, userId },
    });

    if (!account) {
      throw new ForbiddenException("アカウントへのアクセス権限がありません");
    }

    // 重みの合計が100になることを確認
    const totalWeight = createKeywordReplyDto.replies.reduce(
      (sum, reply) => sum + reply.weight,
      0
    );

    if (totalWeight !== 100) {
      throw new BadRequestException(
        "返信テンプレートの重みの合計は100である必要があります"
      );
    }

    // 同じキーワードが既に存在しないかチェック
    const existingKeyword = await this.keywordReplyRepository.findOne({
      where: {
        accountId: createKeywordReplyDto.accountId,
        keyword: createKeywordReplyDto.keyword,
      },
    });

    if (existingKeyword) {
      throw new BadRequestException(
        "このアカウントには既に同じキーワードが設定されています"
      );
    }

    const keywordReply = this.keywordReplyRepository.create({
      ...createKeywordReplyDto,
      replies: createKeywordReplyDto.replies.map((reply) =>
        this.replyTemplateRepository.create(reply)
      ),
    });

    return this.keywordReplyRepository.save(keywordReply);
  }

  async findAll(
    userId: string,
    query: KeywordReplyQueryDto
  ): Promise<KeywordReply[]> {
    const findOptions: FindManyOptions<KeywordReply> = {
      relations: ["replies", "account"],
      order: { priority: "DESC", createdAt: "DESC" },
      take: query.limit,
      skip: query.offset,
    };

    const whereConditions: any = {};

    if (query.accountId) {
      // アカウントの所有者確認
      const account = await this.accountRepository.findOne({
        where: { id: query.accountId, userId },
      });

      if (!account) {
        throw new ForbiddenException("アカウントへのアクセス権限がありません");
      }

      whereConditions.accountId = query.accountId;
    } else {
      // 全てのアカウントを取得する場合は、ユーザーが所有するアカウントのみ
      const userAccounts = await this.accountRepository.find({
        where: { userId },
        select: ["id"],
      });

      const accountIds = userAccounts.map((account) => account.id);
      whereConditions.accountId = accountIds.length > 0 ? In(accountIds) : [];
    }

    if (query.isActive !== undefined) {
      whereConditions.isActive = query.isActive;
    }

    findOptions.where = whereConditions;

    return this.keywordReplyRepository.find(findOptions);
  }

  async findOne(userId: string, id: string): Promise<KeywordReply> {
    const keywordReply = await this.keywordReplyRepository.findOne({
      where: { id },
      relations: ["replies", "account"],
    });

    if (!keywordReply) {
      throw new NotFoundException("キーワード返信設定が見つかりません");
    }

    // 所有者確認
    if (keywordReply.account.userId !== userId) {
      throw new ForbiddenException("アクセス権限がありません");
    }

    return keywordReply;
  }

  async update(
    userId: string,
    id: string,
    updateKeywordReplyDto: UpdateKeywordReplyDto
  ): Promise<KeywordReply> {
    const keywordReply = await this.findOne(userId, id);

    // 返信テンプレートが更新される場合は重みの合計をチェック
    if (updateKeywordReplyDto.replies) {
      const activeReplies = updateKeywordReplyDto.replies.filter(
        (reply) => reply.isActive !== false
      );
      const totalWeight = activeReplies.reduce(
        (sum, reply) => sum + (reply.weight || 0),
        0
      );

      if (totalWeight !== 100) {
        throw new BadRequestException(
          "アクティブな返信テンプレートの重みの合計は100である必要があります"
        );
      }

      // 既存のテンプレートを削除して新しいものを作成
      await this.replyTemplateRepository.delete({
        keywordReplyId: id,
      });

      const newTemplates = updateKeywordReplyDto.replies.map((reply) =>
        this.replyTemplateRepository.create({
          ...reply,
          keywordReplyId: id,
        })
      );

      await this.replyTemplateRepository.save(newTemplates);
      delete updateKeywordReplyDto.replies;
    }

    await this.keywordReplyRepository.update(id, updateKeywordReplyDto);
    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const keywordReply = await this.findOne(userId, id);
    await this.keywordReplyRepository.remove(keywordReply);
  }

  async getStats(userId: string, accountId?: string): Promise<any[]> {
    const whereConditions: any = {};

    if (accountId) {
      // アカウントの所有者確認
      const account = await this.accountRepository.findOne({
        where: { id: accountId, userId },
      });

      if (!account) {
        throw new ForbiddenException("アカウントへのアクセス権限がありません");
      }

      whereConditions.accountId = accountId;
    } else {
      // ユーザーが所有するアカウントのみ
      const userAccounts = await this.accountRepository.find({
        where: { userId },
        select: ["id"],
      });

      const accountIds = userAccounts.map((account) => account.id);
      whereConditions.accountId = accountIds.length > 0 ? In(accountIds) : [];
    }

    const keywordReplies = await this.keywordReplyRepository.find({
      where: whereConditions,
      select: [
        "id",
        "keyword",
        "totalMatches",
        "successfulReplies",
        "failedReplies",
        "lastTriggeredAt",
      ],
    });

    return keywordReplies.map((kr) => ({
      keywordReplyId: kr.id,
      keyword: kr.keyword,
      totalMatches: kr.totalMatches,
      successfulReplies: kr.successfulReplies,
      failedReplies: kr.failedReplies,
      lastTriggered: kr.lastTriggeredAt,
    }));
  }

  async getReplyLogs(
    userId: string,
    query: ReplyLogQueryDto
  ): Promise<ReplyLog[]> {
    const findOptions: FindManyOptions<ReplyLog> = {
      relations: ["keywordReply", "replyTemplate"],
      order: { createdAt: "DESC" },
      take: query.limit,
      skip: query.offset,
    };

    const whereConditions: any = {};

    if (query.keywordReplyId) {
      // キーワード返信の所有者確認
      const keywordReply = await this.findOne(userId, query.keywordReplyId);
      whereConditions.keywordReplyId = query.keywordReplyId;
    } else {
      // ユーザーが所有するアカウントのキーワード返信のログのみ
      const userAccounts = await this.accountRepository.find({
        where: { userId },
        select: ["id"],
      });

      const accountIds = userAccounts.map((account) => account.id);

      if (accountIds.length > 0) {
        const userKeywordReplies = await this.keywordReplyRepository.find({
          where: { accountId: In(accountIds) },
          select: ["id"],
        });

        const keywordReplyIds = userKeywordReplies.map((kr) => kr.id);
        whereConditions.keywordReplyId =
          keywordReplyIds.length > 0 ? In(keywordReplyIds) : [];
      } else {
        whereConditions.keywordReplyId = [];
      }
    }

    findOptions.where = whereConditions;

    return this.replyLogRepository.find(findOptions);
  }

  /**
   * コメントに対してキーワードマッチングを行い、該当する返信を実行する
   */
  async processComment(
    accountId: string,
    commentId: string,
    commentText: string
  ): Promise<void> {
    // アクティブなキーワード返信設定を優先度順に取得
    const keywordReplies = await this.keywordReplyRepository.find({
      where: { accountId, isActive: true },
      relations: ["replies"],
      order: { priority: "DESC" },
    });

    for (const keywordReply of keywordReplies) {
      let isMatch = false;

      if (keywordReply.matchType === "exact") {
        isMatch = commentText.trim() === keywordReply.keyword;
      } else {
        isMatch = commentText.includes(keywordReply.keyword);
      }

      if (isMatch) {
        // マッチした場合、統計を更新
        await this.keywordReplyRepository.update(keywordReply.id, {
          totalMatches: keywordReply.totalMatches + 1,
          lastTriggeredAt: new Date(),
        });

        // アクティブな返信テンプレートから重み付きでランダム選択
        const activeReplies = keywordReply.replies.filter(
          (reply) => reply.isActive
        );

        if (activeReplies.length === 0) continue;

        const selectedReply = this.selectWeightedRandomReply(activeReplies);

        // ログを作成
        const replyLog = this.replyLogRepository.create({
          commentId,
          originalComment: commentText,
          replyText: selectedReply.text,
          keywordReplyId: keywordReply.id,
          replyTemplateId: selectedReply.id,
          status: ReplyStatus.PENDING,
        });

        await this.replyLogRepository.save(replyLog);

        // 実際の返信処理はここでThreads APIを呼び出す
        // TODO: Threads APIでの返信実装

        // 最初にマッチしたキーワードのみ処理して終了
        break;
      }
    }
  }

  private selectWeightedRandomReply(
    replies: ReplyTemplate[]
  ): ReplyTemplate {
    const totalWeight = replies.reduce((sum, reply) => sum + reply.weight, 0);
    const random = Math.floor(Math.random() * totalWeight);

    let currentWeight = 0;
    for (const reply of replies) {
      currentWeight += reply.weight;
      if (random < currentWeight) {
        return reply;
      }
    }

    // フォールバック（通常は実行されない）
    return replies[0];
  }
}