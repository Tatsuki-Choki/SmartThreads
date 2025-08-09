import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../../src/app.module";
import { getRepositoryToken } from "@nestjs/typeorm";
import { User } from "../../src/users/entities/user.entity";
import { Account } from "../../src/accounts/entities/account.entity";
import { ScheduledPost } from "../../src/posts/entities/scheduled-post.entity";
import { Repository } from "typeorm";

describe("PostsController (e2e)", () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let accountRepository: Repository<Account>;
  let postRepository: Repository<ScheduledPost>;
  let accessToken: string;
  let userId: string;
  let accountId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    accountRepository = moduleFixture.get<Repository<Account>>(
      getRepositoryToken(Account),
    );
    postRepository = moduleFixture.get<Repository<ScheduledPost>>(
      getRepositoryToken(ScheduledPost),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up
    await postRepository.delete({});
    await accountRepository.delete({});
    await userRepository.delete({});

    // Create test user and get token
    const response = await request(app.getHttpServer())
      .post("/auth/register")
      .send({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

    accessToken = response.body.access_token;
    userId = response.body.user.id;

    // Create test account
    const account = await accountRepository.save({
      user: { id: userId },
      username: "testuser",
      threadsUserId: "threads123",
      isActive: true,
    });
    accountId = account.id;
  });

  describe("/v1/scheduled-posts (POST)", () => {
    it("should create a scheduled post", async () => {
      const postData = {
        accountId,
        content: "Test post content",
        scheduledFor: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
      };

      const response = await request(app.getHttpServer())
        .post("/v1/scheduled-posts")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(postData)
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body.content).toBe(postData.content);
      expect(response.body.status).toBe("pending");
      expect(response.body.accountId).toBe(accountId);
    });

    it("should create immediate post", async () => {
      const postData = {
        accountId,
        content: "Immediate post",
      };

      const response = await request(app.getHttpServer())
        .post("/v1/scheduled-posts")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(postData)
        .expect(201);

      expect(response.body.status).toBe("pending");
      expect(response.body.scheduledFor).toBeNull();
    });

    it("should reject post with invalid content length", async () => {
      const postData = {
        accountId,
        content: "a".repeat(501), // Exceeds 500 character limit
      };

      await request(app.getHttpServer())
        .post("/v1/scheduled-posts")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(postData)
        .expect(400);
    });

    it("should reject post with past scheduled time", async () => {
      const postData = {
        accountId,
        content: "Test post",
        scheduledFor: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      };

      await request(app.getHttpServer())
        .post("/v1/scheduled-posts")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(postData)
        .expect(400);
    });

    it("should handle media URLs", async () => {
      const postData = {
        accountId,
        content: "Post with media",
        mediaUrls: [
          "https://example.com/image1.jpg",
          "https://example.com/image2.png",
        ],
      };

      const response = await request(app.getHttpServer())
        .post("/v1/scheduled-posts")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(postData)
        .expect(201);

      expect(response.body.mediaUrls).toEqual(postData.mediaUrls);
    });

    it("should reject mixing images and videos", async () => {
      const postData = {
        accountId,
        content: "Mixed media post",
        mediaUrls: [
          "https://example.com/image.jpg",
          "https://example.com/video.mp4",
        ],
      };

      await request(app.getHttpServer())
        .post("/v1/scheduled-posts")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(postData)
        .expect(400);
    });

    it("should enforce idempotency", async () => {
      const idempotencyKey = "unique-key-123";
      const postData = {
        accountId,
        content: "Idempotent post",
      };

      const response1 = await request(app.getHttpServer())
        .post("/v1/scheduled-posts")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Idempotency-Key", idempotencyKey)
        .send(postData)
        .expect(201);

      const response2 = await request(app.getHttpServer())
        .post("/v1/scheduled-posts")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Idempotency-Key", idempotencyKey)
        .send(postData)
        .expect(201);

      expect(response1.body.id).toBe(response2.body.id);
    });
  });

  describe("/v1/scheduled-posts (GET)", () => {
    beforeEach(async () => {
      // Create test posts
      await postRepository.save([
        {
          account: { id: accountId },
          content: "Post 1",
          status: "pending",
          scheduledFor: new Date(Date.now() + 3600000),
        },
        {
          account: { id: accountId },
          content: "Post 2",
          status: "published",
          publishedAt: new Date(),
        },
        {
          account: { id: accountId },
          content: "Post 3",
          status: "failed",
          error: "Test error",
        },
      ]);
    });

    it("should list all scheduled posts", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/scheduled-posts")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveLength(3);
      expect(response.body).toHaveProperty("meta");
    });

    it("should filter by status", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/scheduled-posts?status=pending")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe("pending");
    });

    it("should filter by account", async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/scheduled-posts?accountId=${accountId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach((post) => {
        expect(post.accountId).toBe(accountId);
      });
    });

    it("should paginate results", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/scheduled-posts?page=1&limit=2")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(2);
      expect(response.body.meta.total).toBe(3);
    });
  });

  describe("/v1/scheduled-posts/:id (GET)", () => {
    let postId: string;

    beforeEach(async () => {
      const post = await postRepository.save({
        account: { id: accountId },
        content: "Test post",
        status: "pending",
      });
      postId = post.id;
    });

    it("should get post by id", async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/scheduled-posts/${postId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(postId);
      expect(response.body.content).toBe("Test post");
    });

    it("should return 404 for non-existent post", async () => {
      await request(app.getHttpServer())
        .get("/v1/scheduled-posts/non-existent-id")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(404);
    });

    it("should not allow access to other users posts", async () => {
      // Create another user
      const otherUserResponse = await request(app.getHttpServer())
        .post("/auth/register")
        .send({
          email: "other@example.com",
          password: "Password123!",
          name: "Other User",
        });

      const otherToken = otherUserResponse.body.access_token;

      await request(app.getHttpServer())
        .get(`/v1/scheduled-posts/${postId}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(403);
    });
  });

  describe("/v1/scheduled-posts/:id (PUT)", () => {
    let postId: string;

    beforeEach(async () => {
      const post = await postRepository.save({
        account: { id: accountId },
        content: "Original content",
        status: "pending",
        scheduledFor: new Date(Date.now() + 7200000), // 2 hours from now
      });
      postId = post.id;
    });

    it("should update scheduled post", async () => {
      const updateData = {
        content: "Updated content",
        scheduledFor: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      };

      const response = await request(app.getHttpServer())
        .put(`/v1/scheduled-posts/${postId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.content).toBe(updateData.content);
    });

    it("should not update published post", async () => {
      // Update post to published
      await postRepository.update(postId, { status: "published" });

      const updateData = {
        content: "Cannot update",
      };

      await request(app.getHttpServer())
        .put(`/v1/scheduled-posts/${postId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(updateData)
        .expect(400);
    });

    it("should validate updated content", async () => {
      const updateData = {
        content: "a".repeat(501), // Exceeds limit
      };

      await request(app.getHttpServer())
        .put(`/v1/scheduled-posts/${postId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(updateData)
        .expect(400);
    });
  });

  describe("/v1/scheduled-posts/:id (DELETE)", () => {
    let postId: string;

    beforeEach(async () => {
      const post = await postRepository.save({
        account: { id: accountId },
        content: "To be deleted",
        status: "pending",
      });
      postId = post.id;
    });

    it("should delete scheduled post", async () => {
      await request(app.getHttpServer())
        .delete(`/v1/scheduled-posts/${postId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      const deletedPost = await postRepository.findOne({
        where: { id: postId },
      });
      expect(deletedPost).toBeNull();
    });

    it("should not delete published post", async () => {
      await postRepository.update(postId, { status: "published" });

      await request(app.getHttpServer())
        .delete(`/v1/scheduled-posts/${postId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(400);
    });

    it("should return 404 for non-existent post", async () => {
      await request(app.getHttpServer())
        .delete("/v1/scheduled-posts/non-existent")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe("Batch operations", () => {
    let postIds: string[] = [];

    beforeEach(async () => {
      const posts = await postRepository.save([
        {
          account: { id: accountId },
          content: "Batch post 1",
          status: "pending",
        },
        {
          account: { id: accountId },
          content: "Batch post 2",
          status: "pending",
        },
        {
          account: { id: accountId },
          content: "Batch post 3",
          status: "pending",
        },
      ]);
      postIds = posts.map((p) => p.id);
    });

    it("should delete multiple posts", async () => {
      const response = await request(app.getHttpServer())
        .post("/v1/scheduled-posts/batch-delete")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ ids: postIds })
        .expect(200);

      expect(response.body.deleted).toBe(3);

      const remainingPosts = await postRepository.find({
        where: { account: { id: accountId } },
      });
      expect(remainingPosts).toHaveLength(0);
    });

    it("should reschedule multiple posts", async () => {
      const newScheduledTime = new Date(Date.now() + 7200000).toISOString();

      const response = await request(app.getHttpServer())
        .post("/v1/scheduled-posts/batch-reschedule")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          ids: postIds,
          scheduledFor: newScheduledTime,
        })
        .expect(200);

      expect(response.body.updated).toBe(3);

      const updatedPosts = await postRepository.find({
        where: { account: { id: accountId } },
      });

      updatedPosts.forEach((post) => {
        expect(new Date(post.scheduledFor).toISOString()).toBe(
          newScheduledTime,
        );
      });
    });
  });
});
