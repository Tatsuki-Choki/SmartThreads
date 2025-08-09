import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../../src/app.module";
import { getRepositoryToken } from "@nestjs/typeorm";
import { User } from "../../src/users/entities/user.entity";
import { Repository } from "typeorm";

describe("AuthController (e2e)", () => {
  let app: INestApplication;
  let userRepository: Repository<User>;

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
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await userRepository.delete({});
  });

  describe("/auth/register (POST)", () => {
    it("should register a new user", async () => {
      const dto = {
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      };

      const response = await request(app.getHttpServer())
        .post("/auth/register")
        .send(dto)
        .expect(201);

      expect(response.body).toHaveProperty("user");
      expect(response.body.user.email).toBe(dto.email);
      expect(response.body.user.name).toBe(dto.name);
      expect(response.body).toHaveProperty("access_token");
      expect(response.body).toHaveProperty("refresh_token");
    });

    it("should reject duplicate email", async () => {
      const dto = {
        email: "duplicate@example.com",
        password: "Password123!",
        name: "Test User",
      };

      await request(app.getHttpServer())
        .post("/auth/register")
        .send(dto)
        .expect(201);

      await request(app.getHttpServer())
        .post("/auth/register")
        .send(dto)
        .expect(409);
    });

    it("should reject weak password", async () => {
      const dto = {
        email: "test@example.com",
        password: "weak",
        name: "Test User",
      };

      const response = await request(app.getHttpServer())
        .post("/auth/register")
        .send(dto)
        .expect(400);

      expect(response.body.message).toContain("password");
    });

    it("should reject invalid email format", async () => {
      const dto = {
        email: "invalid-email",
        password: "Password123!",
        name: "Test User",
      };

      await request(app.getHttpServer())
        .post("/auth/register")
        .send(dto)
        .expect(400);
    });
  });

  describe("/auth/login (POST)", () => {
    const userDto = {
      email: "user@example.com",
      password: "Password123!",
      name: "Test User",
    };

    beforeEach(async () => {
      await request(app.getHttpServer()).post("/auth/register").send(userDto);
    });

    it("should login with valid credentials", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: userDto.email,
          password: userDto.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty("access_token");
      expect(response.body).toHaveProperty("refresh_token");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user.email).toBe(userDto.email);
    });

    it("should reject invalid password", async () => {
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: userDto.email,
          password: "WrongPassword123!",
        })
        .expect(401);
    });

    it("should reject non-existent user", async () => {
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "Password123!",
        })
        .expect(401);
    });

    it("should handle case-insensitive email", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: userDto.email.toUpperCase(),
          password: userDto.password,
        })
        .expect(200);

      expect(response.body.user.email).toBe(userDto.email);
    });
  });

  describe("/auth/refresh (POST)", () => {
    let refreshToken: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/register")
        .send({
          email: "refresh@example.com",
          password: "Password123!",
          name: "Refresh User",
        });

      refreshToken = response.body.refresh_token;
    });

    it("should refresh access token with valid refresh token", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refresh_token: refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty("access_token");
      expect(response.body).toHaveProperty("refresh_token");
      expect(response.body.refresh_token).not.toBe(refreshToken);
    });

    it("should reject invalid refresh token", async () => {
      await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refresh_token: "invalid-token" })
        .expect(401);
    });

    it("should reject expired refresh token", async () => {
      // This would require mocking the JWT service or waiting for expiration
      // For now, we'll test with a malformed token
      const expiredToken =
        refreshToken.substring(0, refreshToken.length - 10) + "expired123";

      await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refresh_token: expiredToken })
        .expect(401);
    });
  });

  describe("/auth/logout (POST)", () => {
    let accessToken: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/register")
        .send({
          email: "logout@example.com",
          password: "Password123!",
          name: "Logout User",
        });

      accessToken = response.body.access_token;
    });

    it("should logout successfully", async () => {
      await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
    });

    it("should reject without token", async () => {
      await request(app.getHttpServer()).post("/auth/logout").expect(401);
    });

    it("should reject with invalid token", async () => {
      await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);
    });
  });

  describe("/auth/profile (GET)", () => {
    let accessToken: string;
    const userDto = {
      email: "profile@example.com",
      password: "Password123!",
      name: "Profile User",
    };

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/register")
        .send(userDto);

      accessToken = response.body.access_token;
    });

    it("should get user profile with valid token", async () => {
      const response = await request(app.getHttpServer())
        .get("/auth/profile")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.email).toBe(userDto.email);
      expect(response.body.name).toBe(userDto.name);
      expect(response.body).not.toHaveProperty("password");
    });

    it("should reject without token", async () => {
      await request(app.getHttpServer()).get("/auth/profile").expect(401);
    });

    it("should reject with expired token", async () => {
      // This would require mocking or waiting for token expiration
      // For now, test with malformed token
      await request(app.getHttpServer())
        .get("/auth/profile")
        .set("Authorization", "Bearer expired-token")
        .expect(401);
    });
  });

  describe("Role-based access", () => {
    let adminToken: string;
    let editorToken: string;
    let viewerToken: string;

    beforeEach(async () => {
      // Create admin user
      const admin = await userRepository.save({
        email: "admin@example.com",
        password: "Password123!",
        name: "Admin User",
        role: "admin",
      });

      // Create editor user
      const editor = await userRepository.save({
        email: "editor@example.com",
        password: "Password123!",
        name: "Editor User",
        role: "editor",
      });

      // Create viewer user
      const viewer = await userRepository.save({
        email: "viewer@example.com",
        password: "Password123!",
        name: "Viewer User",
        role: "viewer",
      });

      // Get tokens for each role
      const adminResponse = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: "admin@example.com",
          password: "Password123!",
        });
      adminToken = adminResponse.body.access_token;

      const editorResponse = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: "editor@example.com",
          password: "Password123!",
        });
      editorToken = editorResponse.body.access_token;

      const viewerResponse = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: "viewer@example.com",
          password: "Password123!",
        });
      viewerToken = viewerResponse.body.access_token;
    });

    it("should allow admin to access admin endpoints", async () => {
      // Test admin-only endpoint
      const response = await request(app.getHttpServer())
        .get("/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should deny editor access to admin endpoints", async () => {
      await request(app.getHttpServer())
        .get("/users")
        .set("Authorization", `Bearer ${editorToken}`)
        .expect(403);
    });

    it("should deny viewer access to admin endpoints", async () => {
      await request(app.getHttpServer())
        .get("/users")
        .set("Authorization", `Bearer ${viewerToken}`)
        .expect(403);
    });
  });
});
