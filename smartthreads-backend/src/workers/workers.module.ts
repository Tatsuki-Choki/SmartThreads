import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TokenValidatorWorker } from "./token-validator.worker";
import { Credential } from "../entities/credential.entity";
import { Account } from "../entities/account.entity";
import { AuditLog } from "../entities/audit-log.entity";
import { AccountsModule } from "../accounts/accounts.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Credential, Account, AuditLog]),
    AccountsModule,
  ],
  providers: [TokenValidatorWorker],
  exports: [TokenValidatorWorker],
})
export class WorkersModule {}
