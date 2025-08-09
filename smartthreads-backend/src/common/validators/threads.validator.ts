export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  characterCount?: number;
  mentions?: string[];
  hashtags?: string[];
  urls?: string[];
  mediaType?: "image" | "video" | "none";
  apiFormat?: any;
}

export class ThreadsContentValidator {
  private readonly MAX_CONTENT_LENGTH = 500;
  private readonly MAX_MEDIA_ITEMS = 10;
  private readonly MIN_SCHEDULE_MINUTES = 10;
  private readonly MAX_SCHEDULE_DAYS = 30;

  private readonly PROHIBITED_PATTERNS = [
    /buy\s+followers/i,
    /click\s+here/i,
    /spam/i,
    /18\+/i,
  ];

  private readonly IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];
  private readonly VIDEO_EXTENSIONS = ["mp4", "mov", "avi", "webm"];

  validateContent(content: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if content is empty
    if (!content || content.trim().length === 0) {
      errors.push("Content cannot be empty");
      return { isValid: false, errors, characterCount: 0 };
    }

    // Count characters (including emojis)
    const characterCount = this.countCharacters(content);

    // Check character limit
    if (characterCount > this.MAX_CONTENT_LENGTH) {
      errors.push(`Content exceeds ${this.MAX_CONTENT_LENGTH} character limit`);
    }

    // Check for prohibited content
    for (const pattern of this.PROHIBITED_PATTERNS) {
      if (pattern.test(content)) {
        warnings.push("Content may violate Threads policies");
        break;
      }
    }

    // Extract mentions
    const mentions = this.extractMentions(content);

    // Extract hashtags
    const hashtags = this.extractHashtags(content);

    // Extract URLs
    const urls = this.extractUrls(content);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      characterCount,
      mentions,
      hashtags,
      urls,
    };
  }

  validateMediaUrls(urls: string[]): ValidationResult {
    const errors: string[] = [];

    if (!urls || urls.length === 0) {
      return { isValid: true, errors: [], mediaType: "none" };
    }

    // Check media count limit
    if (urls.length > this.MAX_MEDIA_ITEMS) {
      errors.push(`Maximum ${this.MAX_MEDIA_ITEMS} media items allowed`);
    }

    let hasImage = false;
    let hasVideo = false;

    for (const url of urls) {
      // Validate URL format
      if (!this.isValidUrl(url)) {
        errors.push(`Invalid media URL: ${url}`);
        continue;
      }

      // Check file extension
      const extension = this.getFileExtension(url);

      if (this.IMAGE_EXTENSIONS.includes(extension)) {
        hasImage = true;
      } else if (this.VIDEO_EXTENSIONS.includes(extension)) {
        hasVideo = true;
      } else {
        errors.push(`Unsupported media format: ${extension}`);
      }
    }

    // Check for mixing media types
    if (hasImage && hasVideo) {
      errors.push("Cannot mix images and videos in a single post");
    }

    const mediaType = hasVideo ? "video" : hasImage ? "image" : "none";

    return {
      isValid: errors.length === 0,
      errors,
      mediaType,
    };
  }

  validateScheduledTime(scheduledTime: Date | null): ValidationResult {
    const errors: string[] = [];

    if (!scheduledTime) {
      return { isValid: true, errors: [] };
    }

    const now = new Date();
    const timeDiff = scheduledTime.getTime() - now.getTime();

    // Check if time is in the past
    if (timeDiff < 0) {
      errors.push("Scheduled time must be in the future");
    }

    // Check minimum schedule time
    const minTime = this.MIN_SCHEDULE_MINUTES * 60 * 1000;
    if (timeDiff < minTime && timeDiff >= 0) {
      errors.push(
        `Scheduled time must be at least ${this.MIN_SCHEDULE_MINUTES} minutes in the future`,
      );
    }

    // Check maximum schedule time
    const maxTime = this.MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000;
    if (timeDiff > maxTime) {
      errors.push(
        `Cannot schedule posts more than ${this.MAX_SCHEDULE_DAYS} days in advance`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  validateReplySettings(settings: any): ValidationResult {
    const errors: string[] = [];
    const apiFormat: any = {};

    if (settings.replyType) {
      const validTypes = ["everyone", "mentioned_only", "no_one"];
      if (!validTypes.includes(settings.replyType)) {
        errors.push(`Invalid reply type: ${settings.replyType}`);
      } else {
        apiFormat.reply_control = settings.replyType;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      apiFormat,
    };
  }

  private countCharacters(text: string): number {
    // Count actual characters including emojis properly
    return Array.from(text).length;
  }

  private extractMentions(text: string): string[] {
    const mentionPattern = /@(\w+)/g;
    const matches = text.match(mentionPattern);
    return matches ? matches.map((m) => m.substring(1)) : [];
  }

  private extractHashtags(text: string): string[] {
    const hashtagPattern = /#(\w+)/g;
    const matches = text.match(hashtagPattern);
    return matches ? matches.map((h) => h.substring(1)) : [];
  }

  private extractUrls(text: string): string[] {
    const urlPattern = /https?:\/\/[^\s]+/g;
    const matches = text.match(urlPattern);
    return matches || [];
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  private getFileExtension(url: string): string {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname;
      const lastDot = path.lastIndexOf(".");
      if (lastDot === -1) return "";
      return path.substring(lastDot + 1).toLowerCase();
    } catch {
      return "";
    }
  }
}
