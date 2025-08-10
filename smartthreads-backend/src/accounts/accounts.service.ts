import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Account, AccountStatus } from "../entities/account.entity";
import { Credential } from "../entities/credential.entity";
import { User } from "../entities/user.entity";
import { AuditLog, AuditAction } from "../entities/audit-log.entity";
import { LinkAccountDto } from "./dto/link-account.dto";
import { RotateCredentialsDto } from "./dto/rotate-credentials.dto";
import { ThreadsApiService } from "./threads-api.service";
import { CryptoService } from "../crypto/crypto.service";
import { HealthCheckQueue } from "../queues/health-check.queue";

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(Credential)
    private credentialRepository: Repository<Credential>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private threadsApiService: ThreadsApiService,
    private cryptoService: CryptoService,
    private healthCheckQueue: HealthCheckQueue,
  ) {}

  /**
   * Link a Threads account to a user
   */
  /**
   * Fetch Threads user info using access token
   */
  /**
   * Fetch Threads user info using access token
   */
  /**
   * Fetch Threads user info using access token
   */
  async fetchThreadsUserInfo(params: {
    accessToken: string;
    clientId: string;
    clientSecret: string;
  }): Promise<{ userId: string; username?: string; tokenExpiry?: string }> {
    try {
      this.logger.log('Fetching user info from Threads API...');
      
      // Threads APIを使用してユーザー情報を取得（fieldsパラメータでusernameも取得）
      const userResponse = await fetch('https://graph.threads.net/v1.0/me?fields=id,username', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${params.accessToken}`
        }
      });

      this.logger.log(`User API response status: ${userResponse.status}`);
      
      // レスポンステキストを先に取得してログ出力
      const responseText = await userResponse.text();
      this.logger.log(`User API response text: ${responseText}`);

      if (!userResponse.ok) {
        let errorMessage = 'Failed to fetch user info from Threads API';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error?.message || errorMessage;
        } catch (parseError) {
          // JSONパースに失敗した場合はそのままデフォルトメッセージを使用
          this.logger.warn('Failed to parse error response JSON:', parseError);
          errorMessage = `API Error (${userResponse.status}): ${responseText}`;
        }
        throw new BadRequestException(errorMessage);
      }

      let userData;
      try {
        userData = JSON.parse(responseText);
      } catch (parseError) {
        this.logger.error('Failed to parse user response JSON:', parseError);
        throw new BadRequestException('Invalid response from Threads API');
      }
      const userId = userData.id;
      const username = userData.username;

      this.logger.log(`Fetched user info: ID=${userId}, username=${username}`);

      // トークンの有効期限を取得
      let tokenExpiry: string | undefined;
      try {
        const tokenInfoResponse = await fetch(
          `https://graph.facebook.com/debug_token?input_token=${params.accessToken}&access_token=${params.clientId}|${params.clientSecret}`
        );

        if (tokenInfoResponse.ok) {
          const tokenInfo = await tokenInfoResponse.json();
          this.logger.log(`Token debug response:`, JSON.stringify(tokenInfo, null, 2));
          
          if (tokenInfo.data && tokenInfo.data.expires_at) {
            const expiryDate = new Date(tokenInfo.data.expires_at * 1000);
            tokenExpiry = expiryDate.toISOString();
            this.logger.log(`Token expiry: ${tokenExpiry}`);
          } else {
            this.logger.warn('No expires_at found in token debug response');
          }
        } else {
          const errorData = await tokenInfoResponse.json();
          this.logger.warn('Failed to fetch token debug info:', errorData);
        }
      } catch (error) {
        // トークン情報の取得に失敗しても、User IDとusernameは返す
        this.logger.warn('Failed to fetch token expiry info', error);
      }

      const result = { userId, username, tokenExpiry };
      this.logger.log(`Returning result:`, result);
      
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Failed to fetch Threads user info', error);
      throw new BadRequestException('Failed to fetch user info from Threads API');
    }
  }

  async linkAccount(
    userId: string,
    linkAccountDto: LinkAccountDto,
  ): Promise<Account> {
    const { name, threadsUserId, clientId, clientSecret, accessToken, timezone } = linkAccountDto;

    try {
      // Check if account already exists
      const existingAccount = await this.accountRepository.findOne({
        where: { threadsUserId: threadsUserId },
      });

      if (existingAccount) {
        throw new ConflictException("This Threads account is already linked");
      }

      // Validate credentials with Threads API
      const testResult = await this.threadsApiService.testConnection(
        clientId,
        clientSecret,
        accessToken,
      );

      if (!testResult.valid) {
        throw new BadRequestException(
          testResult.error || "Invalid credentials",
        );
      }

      const { profile, tokenInfo } = testResult;

      // Create account using provided data
      const account = this.accountRepository.create({
        threadsUserId: threadsUserId,
        displayName: name,
        iconUrl: profile?.threads_profile_picture_url || null,
        status: AccountStatus.ACTIVE,
        permissions: tokenInfo?.data?.scopes || [],
        userId,
        lastHealthCheckAt: new Date(),
      });

      const savedAccount = await this.accountRepository.save(account);

      // Create encrypted credentials
      const credential = this.credentialRepository.create({
        accountId: savedAccount.id,
        clientIdEnc: clientId,
        clientSecretEnc: clientSecret,
        accessTokenEnc: accessToken,
        scopes: tokenInfo?.data?.scopes || [],
        expiresAt: tokenInfo?.data?.expires_at
          ? new Date(tokenInfo.data.expires_at * 1000)
          : null,
        lastVerifiedAt: new Date(),
        byoMode: true,
      });

      await this.credentialRepository.save(credential);

      // Update user timezone if provided
      if (timezone) {
        await this.userRepository.update(userId, { timezone });
      }

      // Schedule periodic health checks
      await this.healthCheckQueue.schedulePeriodicHealthCheck(savedAccount.id);

      // Create audit log
      await this.createAuditLog(
        AuditAction.ACCOUNT_LINKED,
        userId,
        "account",
        savedAccount.id,
        true,
        { threadsUserId: threadsUserId, displayName: name },
      );

      this.logger.log(
        `Account linked successfully: ${name} (${threadsUserId})`,
      );

      return savedAccount;
    } catch (error) {
      await this.createAuditLog(
        AuditAction.ACCOUNT_LINKED,
        userId,
        "account",
        null,
        false,
        null,
        error.message,
      );

      throw error;
    }
  }

  /**
   * Get all accounts for a user
   */
  async getUserAccounts(userId: string): Promise<Account[]> {
    return this.accountRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Get account by ID
   */
  async getAccountById(accountId: string, userId: string): Promise<Account> {
    const account = await this.accountRepository.findOne({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new NotFoundException("Account not found");
    }

    return account;
  }

  /**
   * Check account health
   */
  async checkAccountHealth(accountId: string): Promise<{
    healthy: boolean;
    error?: string;
    lastChecked: Date;
  }> {
    try {
      const account = await this.accountRepository.findOne({
        where: { id: accountId },
        relations: ["credential"],
      });

      if (!account || !account.credential) {
        throw new NotFoundException("Account or credentials not found");
      }

      // Test connection with Threads API
      const testResult = await this.threadsApiService.testConnection(
        account.credential.clientIdEnc,
        account.credential.clientSecretEnc,
        account.credential.accessTokenEnc,
      );

      // Update account status
      account.lastHealthCheckAt = new Date();
      account.status = testResult.valid
        ? AccountStatus.ACTIVE
        : AccountStatus.ERROR;
      account.lastHealthCheckError = testResult.error || null;

      await this.accountRepository.save(account);

      // Create audit log
      await this.createAuditLog(
        AuditAction.HEALTH_CHECK_PERFORMED,
        null,
        "account",
        accountId,
        testResult.valid,
        { error: testResult.error },
      );

      return {
        healthy: testResult.valid,
        error: testResult.error,
        lastChecked: account.lastHealthCheckAt,
      };
    } catch (error) {
      this.logger.error(
        `Health check failed for account ${accountId}: ${error.message}`,
        error.stack,
      );

      return {
        healthy: false,
        error: error.message,
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Rotate account credentials
   */
  async rotateCredentials(
    accountId: string,
    userId: string,
    rotateDto: RotateCredentialsDto,
  ): Promise<Account> {
    const account = await this.getAccountById(accountId, userId);
    const credential = await this.credentialRepository.findOne({
      where: { accountId },
    });

    if (!credential) {
      throw new NotFoundException("Credentials not found");
    }

    try {
      // Use existing client ID/secret if not provided
      const clientId = rotateDto.clientId || credential.clientIdEnc;
      const clientSecret = rotateDto.clientSecret || credential.clientSecretEnc;

      // Validate new credentials
      const testResult = await this.threadsApiService.testConnection(
        clientId,
        clientSecret,
        rotateDto.accessToken,
      );

      if (!testResult.valid) {
        throw new BadRequestException(
          testResult.error || "Invalid credentials",
        );
      }

      // Update credentials
      if (rotateDto.clientId) {
        credential.clientIdEnc = rotateDto.clientId;
      }
      if (rotateDto.clientSecret) {
        credential.clientSecretEnc = rotateDto.clientSecret;
      }
      credential.accessTokenEnc = rotateDto.accessToken;
      credential.lastVerifiedAt = new Date();
      credential.expiresAt = testResult.tokenInfo?.data.expires_at
        ? new Date(testResult.tokenInfo.data.expires_at * 1000)
        : null;

      await this.credentialRepository.save(credential);

      // Update account status
      account.status = AccountStatus.ACTIVE;
      account.lastHealthCheckAt = new Date();
      account.lastHealthCheckError = null;
      await this.accountRepository.save(account);

      // Create audit log
      await this.createAuditLog(
        AuditAction.CREDENTIALS_ROTATED,
        userId,
        "account",
        accountId,
        true,
      );

      this.logger.log(`Credentials rotated for account ${accountId}`);

      return account;
    } catch (error) {
      await this.createAuditLog(
        AuditAction.CREDENTIALS_ROTATED,
        userId,
        "account",
        accountId,
        false,
        null,
        error.message,
      );

      throw error;
    }
  }

  /**
   * Unlink account
   */
  async unlinkAccount(
    accountId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const account = await this.getAccountById(accountId, userId);

    try {
      // Remove periodic health checks
      await this.healthCheckQueue.removePeriodicHealthCheck(accountId);

      // Delete account (cascade will delete credentials)
      await this.accountRepository.remove(account);

      // Create audit log
      await this.createAuditLog(
        AuditAction.ACCOUNT_UNLINKED,
        userId,
        "account",
        accountId,
        true,
        { threadsUserId: account.threadsUserId },
      );

      this.logger.log(`Account unlinked: ${accountId}`);

      return { success: true };
    } catch (error) {
      await this.createAuditLog(
        AuditAction.ACCOUNT_UNLINKED,
        userId,
        "account",
        accountId,
        false,
        null,
        error.message,
      );

      throw error;
    }
  }

  /**
   * Get account with decrypted credentials (internal use only)
   */
  async getAccountWithCredentials(
    accountId: string,
  ): Promise<Account & { credential: Credential }> {
    const account = await this.accountRepository.findOne({
      where: { id: accountId },
      relations: ["credential"],
    });

    if (!account || !account.credential) {
      throw new NotFoundException("Account or credentials not found");
    }

    return account as Account & { credential: Credential };
  }

  /**
   * Create audit log
   */
  private async createAuditLog(
    action: AuditAction,
    actorId: string | null,
    targetType: string,
    targetId: string | null,
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
