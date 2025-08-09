import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HttpModule } from "@nestjs/axios";
import { Account } from "../entities/account.entity";
import { Credential } from "../entities/credential.entity";
import { User } from "../entities/user.entity";
import { AuditLog } from "../entities/audit-log.entity";
import { AccountsService } from "./accounts.service";
import { AccountsController } from "./accounts.controller";
import { ThreadsApiService } from "./threads-api.service";
import { CryptoModule } from "../crypto/crypto.module";
import { QueuesModule } from "../queues/queues.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Account, Credential, User, AuditLog]),
    HttpModule,
    CryptoModule,
    QueuesModule,
  ],
  controllers: [AccountsController],
  providers: [AccountsService, ThreadsApiService],
  exports: [AccountsService, ThreadsApiService],
})
export class AccountsModule {}
