import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Account } from "./account.entity";

export enum MediaType {
  IMAGE = "image",
  VIDEO = "video",
  GIF = "gif",
}

export enum MediaStatus {
  UPLOADING = "uploading",
  PROCESSING = "processing",
  READY = "ready",
  ERROR = "error",
  DELETED = "deleted",
}

@Entity("media_assets")
@Index(["ownerAccountId"])
@Index(["status"])
export class MediaAsset {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: MediaType,
  })
  type: MediaType;

  @Column({ type: "varchar", length: 500 })
  storageUrl: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  thumbnailUrl?: string;

  @Column({ type: "varchar", length: 255 })
  filename: string;

  @Column({ type: "varchar", length: 50 })
  mimeType: string;

  @Column({ type: "bigint" })
  size: number;

  @Column({ type: "integer", nullable: true })
  width?: number;

  @Column({ type: "integer", nullable: true })
  height?: number;

  @Column({ type: "integer", nullable: true })
  duration?: number;

  @Column({
    type: "enum",
    enum: MediaStatus,
    default: MediaStatus.UPLOADING,
  })
  status: MediaStatus;

  @Column({ type: "jsonb", nullable: true })
  metadata: {
    originalName?: string;
    exifRemoved?: boolean;
    compressed?: boolean;
    compressionRatio?: number;
    checksum?: string;
  };

  @Column({ type: "varchar", length: 255, nullable: true })
  s3Key?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  s3Bucket?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Account, (account) => account.mediaAssets, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "ownerAccountId" })
  ownerAccount: Account;

  @Column({ type: "uuid" })
  ownerAccountId: string;

  @Column({ type: "uuid", nullable: true })
  uploadedBy?: string;

  // Virtual properties for compatibility
  get fileName(): string {
    return this.filename;
  }

  set fileName(value: string) {
    this.filename = value;
  }

  get originalName(): string {
    return this.metadata?.originalName || this.filename;
  }

  get url(): string {
    return this.storageUrl;
  }

  set url(value: string) {
    this.storageUrl = value;
  }

  get key(): string {
    return this.s3Key || "";
  }

  set key(value: string) {
    this.s3Key = value;
  }
}
