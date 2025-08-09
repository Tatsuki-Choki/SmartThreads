import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../entities/user.entity";
import { Account } from "../entities/account.entity";
import { Credential } from "../entities/credential.entity";
import { AuditLog } from "../entities/audit-log.entity";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { ThreadsOAuthService } from "./threads-oauth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { LocalStrategy } from "./strategies/local.strategy";
import { SessionSerializer } from "./session.serializer";
import { CryptoModule } from "../crypto/crypto.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Account, Credential, AuditLog]),
    HttpModule,
    PassportModule.register({
      defaultStrategy: "jwt",
      session: true,
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get("JWT_SECRET"),
        signOptions: {
          // Access token 有効期限を環境変数に合わせる
          expiresIn: configService.get("JWT_ACCESS_EXPIRATION", "15m"),
        },
      }),
      inject: [ConfigService],
    }),
    CryptoModule,
  ],
  providers: [
    AuthService,
    ThreadsOAuthService,
    LocalStrategy,
    JwtStrategy,
    SessionSerializer,
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
