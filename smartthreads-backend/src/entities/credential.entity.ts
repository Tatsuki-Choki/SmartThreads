import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Account } from "./account.entity";
import { EncryptedColumnTransformer } from "./credential.transformer";

@Entity("credentials")
@Index(["accountId"], { unique: true })
export class Credential {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "text",
    transformer: new EncryptedColumnTransformer(),
  })
  clientIdEnc: string;

  @Column({
    type: "text",
    transformer: new EncryptedColumnTransformer(),
  })
  clientSecretEnc: string;

  @Column({
    type: "text",
    transformer: new EncryptedColumnTransformer(),
  })
  accessTokenEnc: string;

  @Column({
    type: "text",
    nullable: true,
    transformer: new EncryptedColumnTransformer(),
  })
  refreshTokenEnc?: string;

  @Column({ type: "jsonb", nullable: true })
  scopes: string[];

  @Column({ type: "timestamp", nullable: true })
  expiresAt?: Date;

  @Column({ type: "timestamp", nullable: true })
  lastVerifiedAt?: Date;

  @Column({ type: "boolean", default: true })
  byoMode: boolean;

  @Column({ type: "varchar", length: 255, nullable: true })
  encryptionKeyId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Account, (account) => account.credential, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "accountId" })
  account: Account;

  @Column({ type: "uuid" })
  accountId: string;
}
