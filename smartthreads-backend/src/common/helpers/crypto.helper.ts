import * as crypto from "crypto";

export class CryptoHelper {
  private readonly algorithm = "aes-256-gcm";
  private readonly key: Buffer;

  constructor(encryptionKey: string) {
    // Ensure key is 32 bytes for AES-256
    this.key = crypto.scryptSync(encryptionKey, "salt", 32);
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Return IV:AuthTag:Encrypted
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  decrypt(encryptedData: string): string {
    const parts = encryptedData.split(":");

    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format");
    }

    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  hash(data: string): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  compareHash(data: string, hash: string): boolean {
    const dataHash = this.hash(data);
    return crypto.timingSafeEqual(Buffer.from(dataHash), Buffer.from(hash));
  }

  generateRandomToken(length: number = 32): string {
    return crypto.randomBytes(length).toString("hex");
  }

  encryptObject(obj: any): string {
    const jsonString = JSON.stringify(obj);
    return this.encrypt(jsonString);
  }

  decryptObject(encryptedData: string): any {
    const jsonString = this.decrypt(encryptedData);
    return JSON.parse(jsonString);
  }
}
