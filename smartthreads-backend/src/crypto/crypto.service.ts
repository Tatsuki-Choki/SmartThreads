import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
  keyId?: string;
}

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly algorithm: string;
  private readonly masterKey: Buffer;
  private readonly keyId: string;

  constructor(private configService: ConfigService) {
    this.algorithm = this.configService.get(
      "ENCRYPTION_ALGORITHM",
      "aes-256-gcm",
    );
    this.keyId = this.configService.get("KMS_KEY_ID", "local-dev-key");

    // In production, this should come from a proper KMS
    // For development, we use a derived key from the JWT secret
    const secret = this.configService.get("JWT_SECRET");
    this.masterKey = crypto.scryptSync(secret, "salt", 32);
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(plaintext: string): EncryptedData {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);

      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");

      const tag = (cipher as any).getAuthTag().toString("hex");

      return {
        encrypted,
        iv: iv.toString("hex"),
        tag,
        keyId: this.keyId,
      };
    } catch (error) {
      this.logger.error(`Encryption failed: ${error.message}`, error.stack);
      throw new Error("Failed to encrypt data");
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: EncryptedData): string {
    try {
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.masterKey,
        Buffer.from(encryptedData.iv, "hex"),
      );

      (decipher as any).setAuthTag(Buffer.from(encryptedData.tag, "hex"));

      let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      this.logger.error(`Decryption failed: ${error.message}`, error.stack);
      throw new Error("Failed to decrypt data");
    }
  }

  /**
   * Encrypt and encode for database storage
   */
  encryptForStorage(plaintext: string): string {
    const encrypted = this.encrypt(plaintext);
    return JSON.stringify(encrypted);
  }

  /**
   * Decode and decrypt from database storage
   */
  decryptFromStorage(storedData: string): string {
    try {
      const encryptedData = JSON.parse(storedData) as EncryptedData;
      return this.decrypt(encryptedData);
    } catch (error) {
      this.logger.error(
        `Failed to decrypt stored data: ${error.message}`,
        error.stack,
      );
      throw new Error("Failed to decrypt stored data");
    }
  }

  /**
   * Generate a secure random token
   */
  generateSecureToken(length = 32): string {
    return crypto.randomBytes(length).toString("hex");
  }

  /**
   * Hash data with SHA256
   */
  hash(data: string): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Compare hash
   */
  compareHash(data: string, hash: string): boolean {
    const dataHash = this.hash(data);
    return crypto.timingSafeEqual(Buffer.from(dataHash), Buffer.from(hash));
  }

  /**
   * Rotate encryption key (for future implementation)
   */
  async rotateKey(oldKeyId: string, newKeyId: string): Promise<void> {
    // TODO: Implement key rotation logic
    // 1. Fetch old key from KMS
    // 2. Fetch new key from KMS
    // 3. Re-encrypt all data with new key
    // 4. Update keyId references
    this.logger.log(
      `Key rotation from ${oldKeyId} to ${newKeyId} would be performed here`,
    );
  }

  /**
   * Encrypt data for column-level encryption
   */
  async encryptColumnData(plaintext: string): Promise<string> {
    return this.encryptForStorage(plaintext);
  }

  /**
   * Decrypt data from column-level encryption
   */
  async decryptColumnData(encryptedData: string): Promise<string> {
    return this.decryptFromStorage(encryptedData);
  }

  /**
   * Mask sensitive data for display
   */
  maskSensitiveData(data: string, visibleChars = 4): string {
    if (data.length <= visibleChars) {
      return "*".repeat(data.length);
    }

    const masked = "*".repeat(data.length - visibleChars);
    const visible = data.slice(-visibleChars);

    return masked + visible;
  }
}
