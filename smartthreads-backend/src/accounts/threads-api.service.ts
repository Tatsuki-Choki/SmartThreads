import { Injectable, Logger, HttpException, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { AxiosError } from "axios";

export interface ThreadsProfile {
  id: string;
  username: string;
  threads_profile_picture_url?: string;
  threads_biography?: string;
}

export interface ThreadsApiError {
  error: {
    message: string;
    type: string;
    code: number;
    fbtrace_id?: string;
  };
}

export interface ThreadsTokenInfo {
  data: {
    app_id: string;
    type: string;
    application: string;
    expires_at: number;
    is_valid: boolean;
    scopes: string[];
    user_id: string;
  };
}

@Injectable()
export class ThreadsApiService {
  private readonly logger = new Logger(ThreadsApiService.name);
  private readonly baseUrl = "https://graph.threads.net";
  private readonly apiVersion = "v1.0";

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  /**
   * Validate access token and get token info
   */
  async validateToken(accessToken: string): Promise<ThreadsTokenInfo> {
    try {
      const url = `${this.baseUrl}/debug_token`;
      const response = await firstValueFrom(
        this.httpService.get<ThreadsTokenInfo>(url, {
          params: {
            input_token: accessToken,
            access_token: accessToken, // Self-validation
          },
        }),
      );

      return response.data;
    } catch (error) {
      this.handleApiError(error, "Token validation failed");
    }
  }

  /**
   * Get user profile from Threads
   */
  async getUserProfile(
    accessToken: string,
    userId?: string,
  ): Promise<ThreadsProfile> {
    try {
      const url = userId
        ? `${this.baseUrl}/${this.apiVersion}/${userId}`
        : `${this.baseUrl}/${this.apiVersion}/me`;

      const response = await firstValueFrom(
        this.httpService.get<ThreadsProfile>(url, {
          params: {
            fields: "id,username,threads_profile_picture_url,threads_biography",
            access_token: accessToken,
          },
        }),
      );

      return response.data;
    } catch (error) {
      this.handleApiError(error, "Failed to fetch user profile");
    }
  }

  /**
   * Test API connectivity and permissions
   */
  async testConnection(
    clientId: string,
    clientSecret: string,
    accessToken: string,
  ): Promise<{
    valid: boolean;
    profile?: ThreadsProfile;
    tokenInfo?: ThreadsTokenInfo;
    error?: string;
  }> {
    try {
      // First validate the token
      const tokenInfo = await this.validateToken(accessToken);

      if (!tokenInfo.data.is_valid) {
        return {
          valid: false,
          error: "Token is invalid or expired",
          tokenInfo,
        };
      }

      // Then get the user profile
      const profile = await this.getUserProfile(accessToken);

      return {
        valid: true,
        profile,
        tokenInfo,
      };
    } catch (error) {
      this.logger.error("Connection test failed:", error);
      return {
        valid: false,
        error: error.message || "Connection test failed",
      };
    }
  }

  /**
   * Create a Threads post
   */
  async createPost(
    accessToken: string,
    userId: string,
    text: string,
    mediaUrls?: string[],
  ): Promise<{ id: string; permalink?: string }> {
    try {
      // Step 1: Create media container
      const containerUrl = `${this.baseUrl}/${this.apiVersion}/${userId}/threads`;

      const containerParams: any = {
        media_type: "TEXT",
        text,
        access_token: accessToken,
      };

      // Add media if provided
      if (mediaUrls && mediaUrls.length > 0) {
        if (mediaUrls.length === 1) {
          containerParams.media_type = "IMAGE";
          containerParams.image_url = mediaUrls[0];
        } else {
          containerParams.media_type = "CAROUSEL";
          containerParams.children = mediaUrls.map((url) => ({
            media_type: "IMAGE",
            image_url: url,
          }));
        }
      }

      const containerResponse = await firstValueFrom(
        this.httpService.post(containerUrl, null, {
          params: containerParams,
        }),
      );

      const containerId = containerResponse.data.id;

      // Step 2: Publish the container
      const publishUrl = `${this.baseUrl}/${this.apiVersion}/${userId}/threads_publish`;

      const publishResponse = await firstValueFrom(
        this.httpService.post(publishUrl, null, {
          params: {
            creation_id: containerId,
            access_token: accessToken,
          },
        }),
      );

      return publishResponse.data;
    } catch (error) {
      this.handleApiError(error, "Failed to create post");
    }
  }

  /**
   * Delete a Threads post
   */
  async deletePost(
    accessToken: string,
    postId: string,
  ): Promise<{ success: boolean }> {
    try {
      const url = `${this.baseUrl}/${this.apiVersion}/${postId}`;

      await firstValueFrom(
        this.httpService.delete(url, {
          params: {
            access_token: accessToken,
          },
        }),
      );

      return { success: true };
    } catch (error) {
      this.handleApiError(error, "Failed to delete post");
    }
  }

  /**
   * Get user's posts
   */
  async getUserPosts(
    accessToken: string,
    userId: string,
    limit = 25,
    after?: string,
  ): Promise<{
    data: any[];
    paging?: {
      cursors: {
        before: string;
        after: string;
      };
      next?: string;
    };
  }> {
    try {
      const url = `${this.baseUrl}/${this.apiVersion}/${userId}/threads`;

      const params: any = {
        fields: "id,media_type,media_url,permalink,text,timestamp,username",
        limit,
        access_token: accessToken,
      };

      if (after) {
        params.after = after;
      }

      const response = await firstValueFrom(
        this.httpService.get(url, { params }),
      );

      return response.data;
    } catch (error) {
      this.handleApiError(error, "Failed to fetch user posts");
    }
  }

  /**
   * Get post insights (metrics)
   */
  async getPostInsights(accessToken: string, postId: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/${this.apiVersion}/${postId}/insights`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: {
            metric: "views,likes,replies,reposts,quotes",
            access_token: accessToken,
          },
        }),
      );

      return response.data;
    } catch (error) {
      this.handleApiError(error, "Failed to fetch post insights");
    }
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: any, message: string): never {
    if (error.response?.data?.error) {
      const apiError = error.response.data as ThreadsApiError;
      this.logger.error(
        `Threads API Error: ${apiError.error.message}`,
        apiError.error,
      );

      throw new HttpException(
        {
          message: apiError.error.message,
          type: apiError.error.type,
          code: apiError.error.code,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (error.response?.status === 401) {
      throw new HttpException(
        "Invalid or expired access token",
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (error.response?.status === 403) {
      throw new HttpException(
        "Insufficient permissions for this operation",
        HttpStatus.FORBIDDEN,
      );
    }

    if (error.response?.status === 429) {
      throw new HttpException(
        "Rate limit exceeded. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.logger.error(`${message}: ${error.message}`, {
      status: error.response?.status,
      data: error.response?.data,
      stack: error.stack,
    });
    throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
