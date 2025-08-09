import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import sharp from "sharp";
import { S3Service } from "./s3.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  MediaAsset,
  MediaType,
  MediaStatus,
} from "../entities/media-asset.entity";
import { MediaProcessorQueue } from "../queues/media-processor.queue";

export interface ProcessedMedia {
  key: string;
  url: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailKey?: string;
  thumbnailUrl?: string;
}

@Injectable()
export class MediaProcessorService {
  private readonly logger = new Logger(MediaProcessorService.name);
  private readonly maxImageSizeMB: number;
  private readonly maxVideoSizeMB: number;
  private readonly allowedImageFormats: string[];
  private readonly allowedVideoFormats: string[];

  constructor(
    private configService: ConfigService,
    private s3Service: S3Service,
    private mediaProcessorQueue: MediaProcessorQueue,
    @InjectRepository(MediaAsset)
    private mediaAssetRepository: Repository<MediaAsset>,
  ) {
    this.maxImageSizeMB = this.configService.get("MAX_IMAGE_SIZE_MB", 100);
    this.maxVideoSizeMB = this.configService.get("MAX_VIDEO_SIZE_MB", 500);
    this.allowedImageFormats = this.configService
      .get("ALLOWED_IMAGE_FORMATS", "jpg,jpeg,png,gif,webp")
      .split(",");
    this.allowedVideoFormats = this.configService
      .get("ALLOWED_VIDEO_FORMATS", "mp4,mov")
      .split(",");
  }

  async processImage(
    file: Express.Multer.File,
    accountId: string,
  ): Promise<ProcessedMedia> {
    try {
      // Validate file format
      const extension = file.originalname.split(".").pop()?.toLowerCase();
      if (!extension || !this.allowedImageFormats.includes(extension)) {
        throw new Error(`Invalid image format: ${extension}`);
      }

      // Validate file size
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > this.maxImageSizeMB) {
        throw new Error(
          `Image size (${sizeMB.toFixed(2)}MB) exceeds limit (${this.maxImageSizeMB}MB)`,
        );
      }

      // Process image with sharp
      const image = sharp(file.buffer);
      const metadata = await image.metadata();

      // Remove EXIF data
      const processedBuffer = await image
        .rotate() // Auto-rotate based on EXIF
        .withMetadata({
          orientation: undefined,
          exif: {},
        })
        .toBuffer();

      // Compress if needed
      let finalBuffer = processedBuffer;
      let compressionRatio = 1;

      if (sizeMB > 10) {
        const compressedBuffer = await sharp(processedBuffer)
          .jpeg({ quality: 85, progressive: true })
          .toBuffer();

        if (compressedBuffer.length < processedBuffer.length) {
          finalBuffer = compressedBuffer;
          compressionRatio = compressedBuffer.length / file.buffer.length;
        }
      }

      // Generate thumbnail
      const thumbnailBuffer = await sharp(processedBuffer)
        .resize(200, 200, {
          fit: "cover",
          position: "center",
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Upload to S3
      const mainKey = this.generateMediaKey(file.originalname, "images");
      const thumbnailKey = this.generateMediaKey(
        file.originalname,
        "thumbnails",
      );

      const [mainUpload, thumbnailUpload] = await Promise.all([
        this.s3Service.uploadBuffer(finalBuffer, mainKey, file.mimetype, {
          originalName: file.originalname,
          accountId,
          compressed: compressionRatio < 1 ? "true" : "false",
        }),
        this.s3Service.uploadBuffer(
          thumbnailBuffer,
          thumbnailKey,
          "image/jpeg",
          {
            originalName: file.originalname,
            accountId,
            type: "thumbnail",
          },
        ),
      ]);

      // Save to database
      const mediaAsset = await this.mediaAssetRepository.save({
        type: MediaType.IMAGE,
        storageUrl: mainUpload.url,
        thumbnailUrl: thumbnailUpload.url,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: finalBuffer.length,
        width: metadata.width,
        height: metadata.height,
        status: MediaStatus.READY,
        metadata: {
          originalName: file.originalname,
          exifRemoved: true,
          compressed: compressionRatio < 1,
          compressionRatio,
          checksum: mainUpload.etag,
        },
        s3Key: mainKey,
        s3Bucket: this.configService.get("S3_BUCKET"),
        ownerAccountId: accountId,
      });

      this.logger.log(
        `Image processed successfully: ${mediaAsset.id} (${mainKey})`,
      );

      return {
        key: mainKey,
        url: mainUpload.url,
        size: finalBuffer.length,
        width: metadata.width,
        height: metadata.height,
        thumbnailKey,
        thumbnailUrl: thumbnailUpload.url,
      };
    } catch (error) {
      this.logger.error(
        `Failed to process image: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async processVideo(
    file: Express.Multer.File,
    accountId: string,
  ): Promise<ProcessedMedia> {
    try {
      // Validate file format
      const extension = file.originalname.split(".").pop()?.toLowerCase();
      if (!extension || !this.allowedVideoFormats.includes(extension)) {
        throw new Error(`Invalid video format: ${extension}`);
      }

      // Validate file size
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > this.maxVideoSizeMB) {
        throw new Error(
          `Video size (${sizeMB.toFixed(2)}MB) exceeds limit (${this.maxVideoSizeMB}MB)`,
        );
      }

      // For now, upload video as-is
      // TODO: Implement video processing with ffmpeg
      const videoKey = this.generateMediaKey(file.originalname, "videos");

      const upload = await this.s3Service.uploadBuffer(
        file.buffer,
        videoKey,
        file.mimetype,
        {
          originalName: file.originalname,
          accountId,
        },
      );

      // Save to database
      const mediaAsset = await this.mediaAssetRepository.save({
        type: MediaType.VIDEO,
        storageUrl: upload.url,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        status: MediaStatus.READY,
        metadata: {
          originalName: file.originalname,
          checksum: upload.etag,
        },
        s3Key: videoKey,
        s3Bucket: this.configService.get("S3_BUCKET"),
        ownerAccountId: accountId,
      });

      // Queue for additional processing (thumbnail generation, etc.)
      await this.mediaProcessorQueue.addProcessingJob({
        mediaAssetId: mediaAsset.id,
        accountId,
        operations: ["generate_thumbnail"],
        originalPath: videoKey,
      });

      this.logger.log(
        `Video uploaded successfully: ${mediaAsset.id} (${videoKey})`,
      );

      return {
        key: videoKey,
        url: upload.url,
        size: file.size,
      };
    } catch (error) {
      this.logger.error(
        `Failed to process video: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteMedia(mediaAssetId: string): Promise<void> {
    try {
      const mediaAsset = await this.mediaAssetRepository.findOne({
        where: { id: mediaAssetId },
      });

      if (!mediaAsset) {
        throw new Error(`Media asset ${mediaAssetId} not found`);
      }

      // Delete from S3
      if (mediaAsset.s3Key) {
        await this.s3Service.deleteFile(mediaAsset.s3Key);
      }

      // Delete thumbnail if exists
      if (mediaAsset.thumbnailUrl) {
        const thumbnailKey = this.extractKeyFromUrl(mediaAsset.thumbnailUrl);
        if (thumbnailKey) {
          await this.s3Service.deleteFile(thumbnailKey);
        }
      }

      // Update database
      mediaAsset.status = MediaStatus.DELETED;
      await this.mediaAssetRepository.save(mediaAsset);

      this.logger.log(`Media deleted successfully: ${mediaAssetId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete media ${mediaAssetId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private generateMediaKey(
    originalName: string,
    type: "images" | "videos" | "thumbnails",
  ): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = originalName.split(".").pop();
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");

    return `${type}/${year}/${month}/${timestamp}-${randomString}.${extension}`;
  }

  private extractKeyFromUrl(url: string): string | null {
    try {
      const bucket = this.configService.get("S3_BUCKET");
      const regex = new RegExp(`${bucket}/(.+)$`);
      const match = url.match(regex);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }
}
