import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { URLSearchParams } from "url";

@Injectable()
export class ThreadsOAuthService {
  private readonly logger = new Logger(ThreadsOAuthService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly scopes: string;
  private readonly authorizationUrl = "https://threads.net/oauth/authorize";
  private readonly tokenUrl = "https://graph.threads.net/oauth/access_token";
  private readonly profileUrl = "https://graph.threads.net/v1.0/me";

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.clientId = this.configService.get("THREADS_APP_ID");
    this.clientSecret = this.configService.get("THREADS_APP_SECRET");
    this.redirectUri = this.configService.get("THREADS_REDIRECT_URI");
    this.scopes = this.configService.get(
      "THREADS_SCOPE",
      "threads_basic,threads_content_publish",
    );
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes,
      response_type: "code",
      ...(state && { state }),
    });

    return `${this.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<{
    accessToken: string;
    userId: string;
  }> {
    try {
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "authorization_code",
        redirect_uri: this.redirectUri,
        code,
      });

      const response = await firstValueFrom(
        this.httpService.post(this.tokenUrl, params.toString(), {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }),
      );

      const { access_token, user_id } = response.data;

      if (!access_token || !user_id) {
        throw new BadRequestException("Invalid token response from Threads");
      }

      this.logger.log(
        `Successfully exchanged code for token for user ${user_id}`,
      );

      return {
        accessToken: access_token,
        userId: user_id,
      };
    } catch (error) {
      this.logger.error(
        `Failed to exchange code for token: ${error.message}`,
        error.stack,
      );

      if (error.response?.data?.error_message) {
        throw new UnauthorizedException(error.response.data.error_message);
      }

      throw new UnauthorizedException("Failed to authenticate with Threads");
    }
  }

  /**
   * Exchange short-lived token for long-lived token
   */
  async exchangeForLongLivedToken(shortLivedToken: string): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    try {
      const params = new URLSearchParams({
        grant_type: "th_exchange_token",
        client_secret: this.clientSecret,
        access_token: shortLivedToken,
      });

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.tokenUrl}/access_token?${params.toString()}`,
        ),
      );

      const { access_token, expires_in } = response.data;

      if (!access_token) {
        throw new BadRequestException("Invalid long-lived token response");
      }

      this.logger.log("Successfully exchanged for long-lived token");

      return {
        accessToken: access_token,
        expiresIn: expires_in || 5184000, // Default to 60 days
      };
    } catch (error) {
      this.logger.error(
        `Failed to exchange for long-lived token: ${error.message}`,
        error.stack,
      );
      throw new UnauthorizedException(
        "Failed to exchange for long-lived token",
      );
    }
  }

  /**
   * Refresh long-lived token
   */
  async refreshToken(token: string): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    try {
      const params = new URLSearchParams({
        grant_type: "th_refresh_token",
        access_token: token,
      });

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.tokenUrl}/refresh_access_token?${params.toString()}`,
        ),
      );

      const { access_token, expires_in } = response.data;

      if (!access_token) {
        throw new BadRequestException("Invalid refresh token response");
      }

      this.logger.log("Successfully refreshed token");

      return {
        accessToken: access_token,
        expiresIn: expires_in || 5184000,
      };
    } catch (error) {
      this.logger.error(
        `Failed to refresh token: ${error.message}`,
        error.stack,
      );
      throw new UnauthorizedException("Failed to refresh token");
    }
  }

  /**
   * Get user profile from Threads
   */
  async getUserProfile(accessToken: string): Promise<{
    id: string;
    username: string;
    name?: string;
    profilePictureUrl?: string;
    biography?: string;
    followersCount?: number;
    followsCount?: number;
    mediaCount?: number;
    isVerified?: boolean;
  }> {
    try {
      const params = new URLSearchParams({
        fields:
          "id,username,threads_profile_picture_url,threads_biography,name",
        access_token: accessToken,
      });

      const response = await firstValueFrom(
        this.httpService.get(`${this.profileUrl}?${params.toString()}`),
      );

      const data = response.data;

      return {
        id: data.id,
        username: data.username,
        name: data.name,
        profilePictureUrl: data.threads_profile_picture_url,
        biography: data.threads_biography,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get user profile: ${error.message}`,
        error.stack,
      );
      throw new UnauthorizedException("Failed to get user profile");
    }
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await this.getUserProfile(accessToken);
      return true;
    } catch (error) {
      return false;
    }
  }
}
