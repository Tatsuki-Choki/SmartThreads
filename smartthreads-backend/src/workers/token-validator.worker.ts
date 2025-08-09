import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import { Credential } from "../entities/credential.entity";
import { Account, AccountStatus } from "../entities/account.entity";
import { AuditLog, AuditAction } from "../entities/audit-log.entity";
import { ThreadsApiService } from "../accounts/threads-api.service";

@Injectable()
export class TokenValidatorWorker {
  private readonly logger = new Logger(TokenValidatorWorker.name);

  constructor(
    @InjectRepository(Credential)
    private credentialRepository: Repository<Credential>,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private threadsApiService: ThreadsApiService,
  ) {}

  /**
   * Check for expiring tokens (runs every hour)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiringTokens(): Promise<void> {
    this.logger.log("Starting token expiry check");

    try {
      // Find tokens expiring in the next 7 days
      const expiryThreshold = new Date();
      expiryThreshold.setDate(expiryThreshold.getDate() + 7);

      const expiringCredentials = await this.credentialRepository.find({
        where: {
          expiresAt: LessThan(expiryThreshold),
        },
        relations: ["account"],
      });

      this.logger.log(`Found ${expiringCredentials.length} expiring tokens`);

      for (const credential of expiringCredentials) {
        await this.handleExpiringToken(credential);
      }
    } catch (error) {
      this.logger.error("Token expiry check failed", error.stack);
    }
  }

  /**
   * Validate all active tokens (runs daily at 3 AM)
   */
  @Cron("0 3 * * *")
  async validateAllTokens(): Promise<void> {
    this.logger.log("Starting daily token validation");

    try {
      const accounts = await this.accountRepository.find({
        where: { status: AccountStatus.ACTIVE },
        relations: ["credential"],
      });

      this.logger.log(`Validating ${accounts.length} active accounts`);

      for (const account of accounts) {
        if (!account.credential) {
          this.logger.warn(`Account ${account.id} has no credentials`);
          continue;
        }

        await this.validateToken(account, account.credential);
      }
    } catch (error) {
      this.logger.error("Token validation failed", error.stack);
    }
  }

  /**
   * Handle expiring token
   */
  private async handleExpiringToken(credential: Credential): Promise<void> {
    const account = credential.account;

    // Calculate days until expiry
    const daysUntilExpiry = Math.ceil(
      (credential.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    // Update account status if expiring soon
    if (daysUntilExpiry <= 3) {
      account.status = AccountStatus.WARNING;
      account.lastHealthCheckError = `Token expires in ${daysUntilExpiry} days`;
      await this.accountRepository.save(account);

      // Create audit log
      await this.createAuditLog(
        AuditAction.TOKEN_EXPIRY_WARNING,
        null,
        "credential",
        credential.id,
        true,
        {
          accountId: account.id,
          daysUntilExpiry,
          expiresAt: credential.expiresAt,
        },
      );

      this.logger.warn(
        `Token for account ${account.id} expires in ${daysUntilExpiry} days`,
      );
    }

    // Mark as expired if already expired
    if (daysUntilExpiry <= 0) {
      account.status = AccountStatus.ERROR;
      account.lastHealthCheckError = "Access token has expired";
      await this.accountRepository.save(account);

      await this.createAuditLog(
        AuditAction.TOKEN_EXPIRED,
        null,
        "credential",
        credential.id,
        true,
        {
          accountId: account.id,
          expiredAt: credential.expiresAt,
        },
      );

      this.logger.error(`Token for account ${account.id} has expired`);
    }
  }

  /**
   * Validate a single token
   */
  private async validateToken(
    account: Account,
    credential: Credential,
  ): Promise<void> {
    try {
      const tokenInfo = await this.threadsApiService.validateToken(
        credential.accessTokenEnc,
      );

      if (!tokenInfo.data.is_valid) {
        // Token is invalid
        account.status = AccountStatus.ERROR;
        account.lastHealthCheckError = "Token validation failed";
        account.lastHealthCheckAt = new Date();
        await this.accountRepository.save(account);

        await this.createAuditLog(
          AuditAction.TOKEN_VALIDATION_FAILED,
          null,
          "account",
          account.id,
          false,
          {
            reason: "Token marked as invalid by API",
            tokenInfo: tokenInfo.data,
          },
        );

        this.logger.error(`Token validation failed for account ${account.id}`);
      } else {
        // Token is valid - update expiry if provided
        if (tokenInfo.data.expires_at) {
          credential.expiresAt = new Date(tokenInfo.data.expires_at * 1000);
          credential.lastVerifiedAt = new Date();
          await this.credentialRepository.save(credential);
        }

        // Update account if it was in error state
        if (account.status === AccountStatus.ERROR) {
          account.status = AccountStatus.ACTIVE;
          account.lastHealthCheckError = null;
          account.lastHealthCheckAt = new Date();
          await this.accountRepository.save(account);

          this.logger.log(`Account ${account.id} recovered from error state`);
        }
      }
    } catch (error) {
      // API call failed
      account.status = AccountStatus.ERROR;
      account.lastHealthCheckError = `Token validation error: ${error.message}`;
      account.lastHealthCheckAt = new Date();
      await this.accountRepository.save(account);

      await this.createAuditLog(
        AuditAction.TOKEN_VALIDATION_FAILED,
        null,
        "account",
        account.id,
        false,
        null,
        error.message,
      );

      this.logger.error(
        `Token validation error for account ${account.id}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Create audit log
   */
  private async createAuditLog(
    action: AuditAction,
    actorId: string | null,
    targetType: string,
    targetId: string,
    success: boolean,
    details?: any,
    errorMessage?: string,
  ): Promise<void> {
    await this.auditLogRepository.save({
      action,
      actorId,
      targetType,
      targetId,
      success,
      details,
      errorMessage,
    });
  }
}
