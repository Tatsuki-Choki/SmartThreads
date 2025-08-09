import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  ListBucketsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as crypto from "crypto";

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      endpoint: this.configService.get("S3_ENDPOINT"),
      region: this.configService.get("S3_REGION", "us-east-1"),
      credentials: {
        accessKeyId: this.configService.get("S3_ACCESS_KEY"),
        secretAccessKey: this.configService.get("S3_SECRET_KEY"),
      },
      forcePathStyle: true, // Required for MinIO
    });

    this.bucketName = this.configService.get("S3_BUCKET", "smartthreads-media");
    this.initializeBucket();
  }

  private async initializeBucket() {
    try {
      const buckets = await this.s3Client.send(new ListBucketsCommand({}));
      const bucketExists = buckets.Buckets?.some(
        (bucket) => bucket.Name === this.bucketName,
      );

      if (!bucketExists) {
        await this.s3Client.send(
          new CreateBucketCommand({
            Bucket: this.bucketName,
          }),
        );
        this.logger.log(`Created S3 bucket: ${this.bucketName}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to initialize S3 bucket: ${error.message}`,
        error.stack,
      );
    }
  }

  async uploadFile(
    fileOrBuffer: Express.Multer.File | Buffer,
    key?: string,
    mimeType?: string,
  ): Promise<{ key: string; url: string; etag: string }> {
    const isBuffer = Buffer.isBuffer(fileOrBuffer);
    const fileKey =
      key ||
      (isBuffer
        ? `file-${Date.now()}`
        : this.generateFileKey(
            (fileOrBuffer as Express.Multer.File).originalname,
          ));
    const buffer = isBuffer
      ? fileOrBuffer
      : (fileOrBuffer as Express.Multer.File).buffer;
    const contentType =
      mimeType ||
      (!isBuffer
        ? (fileOrBuffer as Express.Multer.File).mimetype
        : "application/octet-stream");
    const originalName = !isBuffer
      ? (fileOrBuffer as Express.Multer.File).originalname
      : fileKey;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          originalName,
          uploadedAt: new Date().toISOString(),
        },
      });

      const response = await this.s3Client.send(command);

      const url = await this.getFileUrl(fileKey);

      this.logger.log(`File uploaded successfully: ${fileKey}`);

      return {
        key: fileKey,
        url,
        etag: response.ETag,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      const chunks: Uint8Array[] = [];

      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      this.logger.error(
        `Failed to get file ${key}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete file ${key}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (
        error.name === "NotFound" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw error;
    }
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 3600,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async getPresignedDownloadUrl(
    key: string,
    expiresIn = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  private async getFileUrl(key: string): Promise<string> {
    const endpoint = this.configService.get("S3_ENDPOINT");
    return `${endpoint}/${this.bucketName}/${key}`;
  }

  private generateFileKey(originalName: string): string {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString("hex");
    const extension = originalName.split(".").pop();
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");

    return `uploads/${year}/${month}/${timestamp}-${randomString}.${extension}`;
  }

  async uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<{ key: string; url: string; etag: string }> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          ...metadata,
          uploadedAt: new Date().toISOString(),
        },
      });

      const response = await this.s3Client.send(command);
      const url = await this.getFileUrl(key);

      this.logger.log(`Buffer uploaded successfully: ${key}`);

      return {
        key,
        url,
        etag: response.ETag,
      };
    } catch (error) {
      this.logger.error(
        `Failed to upload buffer: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
