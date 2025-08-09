import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from "@nestjs/swagger";
import { PostsService } from "./posts.service";
import { CreatePostDto } from "./dto/create-post.dto";
import { UpdatePostDto } from "./dto/update-post.dto";
import { TestPostDto } from "./dto/test-post.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../entities/user.entity";
import { ScheduledPost, PostStatus } from "../entities/scheduled-post.entity";
import { PublishedPostCache } from "../entities/published-post-cache.entity";

@ApiTags("posts")
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post("scheduled-posts")
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: "Create a new scheduled post" })
  @ApiResponse({
    status: 201,
    description: "Post created successfully",
    type: ScheduledPost,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request data",
  })
  async createPost(
    @Request() req,
    @Body() createPostDto: CreatePostDto,
  ): Promise<ScheduledPost> {
    return this.postsService.createPost(req.user.id, createPostDto);
  }

  @Get("scheduled-posts")
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @ApiOperation({ summary: "Get scheduled posts" })
  @ApiQuery({ name: "accountId", required: false })
  @ApiQuery({ name: "status", required: false, enum: PostStatus })
  @ApiResponse({
    status: 200,
    description: "List of scheduled posts",
    type: [ScheduledPost],
  })
  async getScheduledPosts(
    @Request() req,
    @Query("accountId") accountId?: string,
    @Query("status") status?: string,
  ): Promise<ScheduledPost[]> {
    return this.postsService.getScheduledPosts(req.user.id, accountId, status);
  }

  @Get("scheduled-posts/:id")
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @ApiOperation({ summary: "Get a specific scheduled post" })
  @ApiResponse({
    status: 200,
    description: "Scheduled post details",
    type: ScheduledPost,
  })
  @ApiResponse({
    status: 404,
    description: "Post not found",
  })
  async getScheduledPost(
    @Request() req,
    @Param("id") id: string,
  ): Promise<ScheduledPost> {
    return this.postsService.getScheduledPost(id, req.user.id);
  }

  @Patch("scheduled-posts/:id")
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: "Update a scheduled post" })
  @ApiResponse({
    status: 200,
    description: "Post updated successfully",
    type: ScheduledPost,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request or post status",
  })
  @ApiResponse({
    status: 404,
    description: "Post not found",
  })
  async updatePost(
    @Request() req,
    @Param("id") id: string,
    @Body() updatePostDto: UpdatePostDto,
  ): Promise<ScheduledPost> {
    return this.postsService.updatePost(id, req.user.id, updatePostDto);
  }

  @Delete("scheduled-posts/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: "Cancel a scheduled post" })
  @ApiResponse({
    status: 204,
    description: "Post cancelled successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid post status",
  })
  @ApiResponse({
    status: 404,
    description: "Post not found",
  })
  async cancelPost(@Request() req, @Param("id") id: string): Promise<void> {
    await this.postsService.cancelPost(id, req.user.id);
  }

  @Get("published-posts")
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @ApiOperation({ summary: "Get published posts" })
  @ApiQuery({ name: "accountId", required: false })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "List of published posts with pagination",
    schema: {
      type: "object",
      properties: {
        posts: { type: "array", items: { type: "object" } },
        total: { type: "number" },
      },
    },
  })
  async getPublishedPosts(
    @Request() req,
    @Query("accountId") accountId?: string,
    @Query("limit") limit = 25,
    @Query("offset") offset = 0,
  ): Promise<{ posts: PublishedPostCache[]; total: number }> {
    return this.postsService.getPublishedPosts(
      req.user.id,
      accountId,
      +limit,
      +offset,
    );
  }

  @Delete("published-posts/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: "Delete a published post from Threads" })
  @ApiResponse({
    status: 204,
    description: "Post deletion queued",
  })
  @ApiResponse({
    status: 404,
    description: "Post not found",
  })
  async deletePublishedPost(
    @Request() req,
    @Param("id") id: string,
  ): Promise<void> {
    await this.postsService.deletePublishedPost(id, req.user.id);
  }

  @Post("test-post")
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: "Send a test post to Threads immediately" })
  @ApiResponse({
    status: 200,
    description: "Test post sent successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request data",
  })
  async sendTestPost(
    @Request() req,
    @Body() testPostDto: TestPostDto,
  ): Promise<{
    success: boolean;
    postId?: string;
    permalink?: string;
    message: string;
  }> {
    return this.postsService.sendTestPost(
      testPostDto.accessToken,
      testPostDto.userId,
      testPostDto.text,
    );
  }
}
