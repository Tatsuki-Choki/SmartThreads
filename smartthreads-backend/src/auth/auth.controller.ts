import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  Redirect,
  Res,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ThreadsCallbackDto } from "./dto/threads-callback.dto";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { CurrentUser } from "./decorators/current-user.decorator";
import { User } from "../entities/user.entity";
import { ThreadsOAuthService } from "./threads-oauth.service";
import { Response } from "express";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private threadsOAuthService: ThreadsOAuthService,
  ) {}

  @Post("register")
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({ status: 201, description: "User successfully registered" })
  @ApiResponse({ status: 400, description: "Bad request" })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login user" })
  @ApiResponse({ status: 200, description: "User successfully logged in" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Logout user" })
  @ApiResponse({ status: 200, description: "User successfully logged out" })
  async logout(@CurrentUser() user: User) {
    await this.authService.logout(user.id);
    return { message: "Successfully logged out" };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token using refresh token" })
  @ApiResponse({ status: 200, description: "Token successfully refreshed" })
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshWithToken(body.refreshToken);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({ status: 200, description: "User profile" })
  async getMe(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      timezone: user.timezone,
      language: user.language,
      twoFactorEnabled: user.twoFactorEnabled,
      notificationSettings: user.notificationSettings,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  @Get("profile")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({ status: 200, description: "User profile" })
  async getProfile(@CurrentUser() user: User) {
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        timezone: user.timezone,
        language: user.language,
      }
    };
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Change user password" })
  @ApiResponse({ status: 200, description: "Password successfully changed" })
  @ApiResponse({ status: 400, description: "Bad request" })
  async changePassword(
    @CurrentUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      user.id,
      changePasswordDto.oldPassword,
      changePasswordDto.newPassword,
    );
    return { message: "Password successfully changed" };
  }

  @Get("threads/authorize")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Redirect to Threads OAuth authorization" })
  @ApiResponse({ status: 302, description: "Redirect to Threads OAuth" })
  @Redirect()
  threadsAuthorize(@CurrentUser() user: User) {
    const state = Buffer.from(
      JSON.stringify({
        userId: user.id,
        timestamp: Date.now(),
      }),
    ).toString("base64");

    const url = this.threadsOAuthService.getAuthorizationUrl(state);
    return { url };
  }

  @Post("dev/create-test-user")
  @ApiOperation({ summary: "Create test user for development" })
  @ApiResponse({ status: 201, description: "Test user created" })
  async createTestUser() {
    if (process.env.NODE_ENV !== "development") {
      throw new BadRequestException(
        "Test endpoints only available in development",
      );
    }
    return this.authService.createTestUser();
  }

  @Post("test-login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Test login for development" })
  @ApiResponse({ status: 200, description: "Test user logged in" })
  async testLogin() {
    if (process.env.NODE_ENV !== "development") {
      throw new BadRequestException(
        "Test endpoints only available in development",
      );
    }
    return this.authService.createTestUser();
  }

  @Get("threads/callback")
  @ApiOperation({ summary: "Handle Threads OAuth callback" })
  @ApiResponse({ status: 200, description: "OAuth callback handled" })
  @ApiResponse({ status: 400, description: "Invalid callback parameters" })
  async threadsCallback(
    @Query() callbackDto: ThreadsCallbackDto,
    @Res() res: Response,
  ) {
    try {
      // Check for error from Threads
      if (callbackDto.error) {
        throw new Error(
          callbackDto.error_description || "Authorization failed",
        );
      }

      // Decode state to get user ID
      const state = callbackDto.state
        ? JSON.parse(Buffer.from(callbackDto.state, "base64").toString())
        : null;

      // Exchange code for token
      const { accessToken, userId: threadsUserId } =
        await this.threadsOAuthService.exchangeCodeForToken(callbackDto.code);

      // Get long-lived token
      const { accessToken: longLivedToken, expiresIn } =
        await this.threadsOAuthService.exchangeForLongLivedToken(accessToken);

      // Get user profile
      const profile =
        await this.threadsOAuthService.getUserProfile(longLivedToken);

      // Save account to database
      await this.authService.linkThreadsAccount(state?.userId, {
        threadsUserId: profile.id,
        username: profile.username,
        accessToken: longLivedToken,
        expiresIn,
        profile,
      });

      // Redirect to frontend success page
      res.redirect(
        `${process.env.FRONTEND_URL}/accounts/link/success?account=${profile.username}`,
      );
    } catch (error) {
      // Redirect to frontend error page
      res.redirect(
        `${process.env.FRONTEND_URL}/accounts/link/error?message=${encodeURIComponent(
          error.message,
        )}`,
      );
    }
  }
}
