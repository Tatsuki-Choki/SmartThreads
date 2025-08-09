import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { User, UserRole } from "../entities/user.entity";
import { Account, AccountStatus } from "../entities/account.entity";
import { Credential } from "../entities/credential.entity";
import { AuditLog, AuditAction } from "../entities/audit-log.entity";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { CryptoService } from "../crypto/crypto.service";
import { ConfigService } from "@nestjs/config";

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    timezone: string;
    language: string;
  };
  accessToken: string;
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(Credential)
    private credentialRepository: Repository<Credential>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private jwtService: JwtService,
    private cryptoService: CryptoService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, name, timezone, language } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException("User with this email already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = await this.userRepository.save({
      email,
      password: hashedPassword,
      name,
      role: UserRole.EDITOR,
      timezone: timezone || "Asia/Tokyo",
      language: language || "ja",
      isActive: true,
      notificationSettings: {
        email: true,
        push: false,
        tokenExpiry72h: true,
        tokenExpiry24h: true,
        tokenExpiry1h: true,
        scheduleSuccess: true,
        scheduleFailure: true,
      },
    });

    // Create audit log
    await this.createAuditLog(
      AuditAction.USER_CREATED,
      user.id,
      "user",
      user.id,
      true,
    );

    // Generate tokens
    const tokens = await this.generateTokens(user);

    this.logger.log(`New user registered: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        timezone: user.timezone,
        language: user.language,
      },
      ...tokens,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    // Find user
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException("Account is deactivated");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      await this.createAuditLog(
        AuditAction.USER_LOGIN,
        user.id,
        "user",
        user.id,
        false,
        "Invalid password",
      );
      throw new UnauthorizedException("Invalid credentials");
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Create audit log
    await this.createAuditLog(
      AuditAction.USER_LOGIN,
      user.id,
      "user",
      user.id,
      true,
    );

    // Generate tokens
    const tokens = await this.generateTokens(user);

    this.logger.log(`User logged in: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        timezone: user.timezone,
        language: user.language,
      },
      ...tokens,
    };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      return user;
    }

    return null;
  }

  async validateJwtPayload(payload: JwtPayload): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("User not found or inactive");
    }

    return user;
  }

  async refreshWithToken(refreshToken: string): Promise<AuthResponse> {
    if (!refreshToken) {
      throw new BadRequestException("Missing refresh token");
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret:
          this.configService.get<string>("JWT_REFRESH_SECRET") ||
          this.configService.get<string>("JWT_SECRET"),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });
      if (!user || !user.isActive) {
        throw new UnauthorizedException("User not found or inactive");
      }

      const tokens = await this.generateTokens(user);
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          timezone: user.timezone,
          language: user.language,
        },
        ...tokens,
      };
    } catch (e) {
      this.logger.warn(`Invalid refresh token: ${e?.message}`);
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  async logout(userId: string): Promise<void> {
    await this.createAuditLog(
      AuditAction.USER_LOGOUT,
      userId,
      "user",
      userId,
      true,
    );

    this.logger.log(`User logged out: ${userId}`);
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException("User not found");
    }

    // Verify old password
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isPasswordValid) {
      await this.createAuditLog(
        AuditAction.PASSWORD_CHANGED,
        userId,
        "user",
        userId,
        false,
        "Invalid old password",
      );
      throw new BadRequestException("Invalid old password");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await this.userRepository.save(user);

    // Create audit log
    await this.createAuditLog(
      AuditAction.PASSWORD_CHANGED,
      userId,
      "user",
      userId,
      true,
    );

    this.logger.log(`Password changed for user: ${userId}`);
  }

  private async generateTokens(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>("JWT_SECRET"),
      expiresIn: this.configService.get<string>("JWT_ACCESS_EXPIRATION", "15m"),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret:
        this.configService.get<string>("JWT_REFRESH_SECRET") ||
        this.configService.get<string>("JWT_SECRET"),
      expiresIn: this.configService.get<string>("JWT_REFRESH_EXPIRATION", "7d"),
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private async createAuditLog(
    action: AuditAction,
    actorId: string,
    targetType: string,
    targetId: string,
    success: boolean,
    errorMessage?: string,
  ): Promise<void> {
    await this.auditLogRepository.save({
      action,
      actorId,
      targetType,
      targetId,
      success,
      errorMessage,
      details: {},
    });
  }

  async linkThreadsAccount(
    userId: string,
    data: {
      threadsUserId: string;
      username: string;
      accessToken: string;
      expiresIn: number;
      profile: any;
    },
  ): Promise<Account> {
    try {
      // Check if account already exists
      let account = await this.accountRepository.findOne({
        where: { threadsUserId: data.threadsUserId },
        relations: ["credential"],
      });

      if (account) {
        // Update existing account
        account.displayName = data.profile.name || data.username;
        account.iconUrl = data.profile.profilePictureUrl;
        account.status = AccountStatus.ACTIVE;
        account.lastHealthCheckAt = new Date();

        // Update credentials
        const credential = account.credential;
        credential.accessTokenEnc = await this.cryptoService.encryptColumnData(
          data.accessToken,
        );
        credential.expiresAt = new Date(Date.now() + data.expiresIn * 1000);
        credential.lastVerifiedAt = new Date();

        await this.credentialRepository.save(credential);
        await this.accountRepository.save(account);

        this.logger.log(`Updated existing Threads account: ${data.username}`);
      } else {
        // Create new account
        account = await this.accountRepository.save({
          userId,
          threadsUserId: data.threadsUserId,
          displayName: data.profile.name || data.username,
          iconUrl: data.profile.profilePictureUrl,
          profileUrl: `https://threads.net/@${data.username}`,
          status: AccountStatus.ACTIVE,
          permissions: [
            "threads_basic",
            "threads_content_publish",
            "threads_manage_insights",
            "threads_manage_replies",
            "threads_read_replies",
          ],
          lastHealthCheckAt: new Date(),
        });

        // Create credentials
        await this.credentialRepository.save({
          accountId: account.id,
          clientIdEnc: await this.cryptoService.encryptColumnData(
            process.env.THREADS_APP_ID,
          ),
          clientSecretEnc: await this.cryptoService.encryptColumnData(
            process.env.THREADS_APP_SECRET,
          ),
          accessTokenEnc: await this.cryptoService.encryptColumnData(
            data.accessToken,
          ),
          expiresAt: new Date(Date.now() + data.expiresIn * 1000),
          lastVerifiedAt: new Date(),
          byoMode: false,
          scopes: [
            "threads_basic",
            "threads_content_publish",
            "threads_manage_insights",
            "threads_manage_replies",
            "threads_read_replies",
          ],
        });

        this.logger.log(`Linked new Threads account: ${data.username}`);
      }

      // Create audit log
      await this.createAuditLog(
        AuditAction.ACCOUNT_LINKED,
        userId,
        "account",
        account.id,
        true,
      );

      return account;
    } catch (error) {
      this.logger.error(
        `Failed to link Threads account: ${error.message}`,
        error.stack,
      );

      await this.createAuditLog(
        AuditAction.ACCOUNT_LINKED,
        userId,
        "account",
        data.threadsUserId,
        false,
        error.message,
      );

      throw error;
    }
  }

  /**
   * Create test user for development
   */
  async createTestUser() {
    const testUserId = "123e4567-e89b-12d3-a456-426614174000";
    const testEmail = "dev@smartthreads.local";

    // Check if test user already exists
    let testUser = await this.userRepository.findOne({
      where: { id: testUserId },
    });

    if (!testUser) {
      // Create test user in database
      testUser = await this.userRepository.save({
        id: testUserId,
        email: testEmail,
        password: "dev-password-hash",
        name: "Development User",
        role: UserRole.ADMIN,
        timezone: "Asia/Tokyo",
        language: "ja",
        isActive: true,
        notificationSettings: {
          email: true,
          push: false,
          tokenExpiry72h: true,
          tokenExpiry24h: true,
          tokenExpiry1h: true,
          scheduleSuccess: true,
          scheduleFailure: true,
        },
      });

      this.logger.log(`Development test user created: ${testUser.email}`);
    }

    return {
      message: "Development authentication bypass enabled",
      user: {
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        role: testUser.role,
        timezone: testUser.timezone,
        language: testUser.language,
      },
      accessToken: "dev-token-bypass",
      refreshToken: "dev-refresh-bypass",
    };
  }
}
