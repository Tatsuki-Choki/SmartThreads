import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const frontendOrigin = configService.get(
    "FRONTEND_URL",
    "http://localhost:3001",
  );
  const corsOrigin = configService.get("CORS_ORIGIN", frontendOrigin);

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          // フロントエンドのオリジンを環境変数から許可
          connectSrc: ["'self'", corsOrigin],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Cookie parser
  app.use(cookieParser());

  // Session configuration
  app.use(
    session({
      secret: configService.get("SESSION_SECRET"),
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: configService.get("NODE_ENV") === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: "strict",
      },
    }),
  );

  // Global prefix
  app.setGlobalPrefix("v1", {
    exclude: ["health", "/"],
  });

  // CORS
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-Id",
      "X-Actor-Id",
      "Idempotency-Key",
    ],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation
  if (configService.get("ENABLE_SWAGGER_UI", true)) {
    const config = new DocumentBuilder()
      .setTitle("SmartThreads API")
      .setDescription("API for managing Threads posts and scheduling")
      .setVersion("1.0")
      .addBearerAuth()
      .addTag("Auth", "Authentication endpoints")
      .addTag("Accounts", "Threads account management")
      .addTag("Posts", "Post creation and scheduling")
      .addTag("Media", "Media asset management")
      .addTag("Health", "Health check endpoints")
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api-docs", app, document);
  }

  const port = configService.get("PORT", 3000);
  await app.listen(port);

  console.log(`🚀 SmartThreads API is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api-docs`);
}

bootstrap();
