import { ThreadsContentValidator } from "./threads.validator";

describe("ThreadsContentValidator", () => {
  let validator: ThreadsContentValidator;

  beforeEach(() => {
    validator = new ThreadsContentValidator();
  });

  describe("validateContent", () => {
    it("should accept valid content within character limit", () => {
      const content = "This is a valid Threads post!";
      const result = validator.validateContent(content);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.characterCount).toBe(content.length);
    });

    it("should reject content exceeding 500 characters", () => {
      const content = "a".repeat(501);
      const result = validator.validateContent(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Content exceeds 500 character limit");
      expect(result.characterCount).toBe(501);
    });

    it("should reject empty content", () => {
      const result = validator.validateContent("");

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Content cannot be empty");
    });

    it("should reject content with only whitespace", () => {
      const result = validator.validateContent("   \n\t  ");

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Content cannot be empty");
    });

    it("should count emoji characters correctly", () => {
      const content = "Hello 👋 World 🌍";
      const result = validator.validateContent(content);

      expect(result.isValid).toBe(true);
      expect(result.characterCount).toBe(16); // Emojis count as 2 chars each
    });

    it("should handle line breaks correctly", () => {
      const content = "Line 1\nLine 2\n\nLine 3";
      const result = validator.validateContent(content);

      expect(result.isValid).toBe(true);
      expect(result.characterCount).toBe(content.length);
    });

    it("should detect prohibited content", () => {
      const content = "Buy followers now! Click here: spam.com";
      const result = validator.validateContent(content);

      expect(result.warnings).toContain("Content may violate Threads policies");
    });

    it("should handle mentions correctly", () => {
      const content = "Hello @user1 and @user2!";
      const result = validator.validateContent(content);

      expect(result.isValid).toBe(true);
      expect(result.mentions).toEqual(["user1", "user2"]);
    });

    it("should handle hashtags correctly", () => {
      const content = "Check out #SmartThreads #ThreadsAPI";
      const result = validator.validateContent(content);

      expect(result.isValid).toBe(true);
      expect(result.hashtags).toEqual(["SmartThreads", "ThreadsAPI"]);
    });

    it("should detect URLs in content", () => {
      const content = "Visit https://example.com for more info";
      const result = validator.validateContent(content);

      expect(result.isValid).toBe(true);
      expect(result.urls).toEqual(["https://example.com"]);
    });
  });

  describe("validateMediaUrls", () => {
    it("should accept valid image URLs", () => {
      const urls = [
        "https://example.com/image.jpg",
        "https://example.com/photo.png",
      ];
      const result = validator.validateMediaUrls(urls);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should accept valid video URLs", () => {
      const urls = ["https://example.com/video.mp4"];
      const result = validator.validateMediaUrls(urls);

      expect(result.isValid).toBe(true);
      expect(result.mediaType).toBe("video");
    });

    it("should reject more than 10 media items", () => {
      const urls = Array(11).fill("https://example.com/image.jpg");
      const result = validator.validateMediaUrls(urls);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Maximum 10 media items allowed");
    });

    it("should reject mixing images and videos", () => {
      const urls = [
        "https://example.com/image.jpg",
        "https://example.com/video.mp4",
      ];
      const result = validator.validateMediaUrls(urls);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Cannot mix images and videos in a single post",
      );
    });

    it("should reject invalid URLs", () => {
      const urls = ["not-a-url", "ftp://example.com/file"];
      const result = validator.validateMediaUrls(urls);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid media URL: not-a-url");
    });

    it("should reject unsupported file formats", () => {
      const urls = ["https://example.com/document.pdf"];
      const result = validator.validateMediaUrls(urls);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Unsupported media format: pdf");
    });

    it("should handle empty media array", () => {
      const result = validator.validateMediaUrls([]);

      expect(result.isValid).toBe(true);
      expect(result.mediaType).toBe("none");
    });
  });

  describe("validateScheduledTime", () => {
    it("should accept future scheduled time", () => {
      const futureTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const result = validator.validateScheduledTime(futureTime);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject past scheduled time", () => {
      const pastTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const result = validator.validateScheduledTime(pastTime);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Scheduled time must be in the future");
    });

    it("should reject scheduled time less than 10 minutes in future", () => {
      const nearFuture = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
      const result = validator.validateScheduledTime(nearFuture);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Scheduled time must be at least 10 minutes in the future",
      );
    });

    it("should reject scheduled time more than 30 days in future", () => {
      const farFuture = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000); // 31 days from now
      const result = validator.validateScheduledTime(farFuture);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Cannot schedule posts more than 30 days in advance",
      );
    });

    it("should handle null scheduled time", () => {
      const result = validator.validateScheduledTime(null);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("validateReplySettings", () => {
    it("should accept valid reply settings", () => {
      const settings = {
        canReply: true,
        hideReplies: false,
      };
      const result = validator.validateReplySettings(settings);

      expect(result.isValid).toBe(true);
    });

    it("should handle mentioned_only reply type", () => {
      const settings = {
        replyType: "mentioned_only",
      };
      const result = validator.validateReplySettings(settings);

      expect(result.isValid).toBe(true);
      expect(result.apiFormat).toEqual({
        reply_control: "mentioned_only",
      });
    });
  });
});
