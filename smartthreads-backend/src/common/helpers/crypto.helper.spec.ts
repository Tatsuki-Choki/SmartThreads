import { CryptoHelper } from "./crypto.helper";

describe("CryptoHelper", () => {
  let cryptoHelper: CryptoHelper;
  const testKey = "test-encryption-key-32-characters!!";

  beforeEach(() => {
    cryptoHelper = new CryptoHelper(testKey);
  });

  describe("encrypt and decrypt", () => {
    it("should encrypt and decrypt text successfully", () => {
      const plainText = "This is a secret message";

      const encrypted = cryptoHelper.encrypt(plainText);
      expect(encrypted).not.toBe(plainText);
      expect(encrypted).toContain(":"); // Should contain IV separator

      const decrypted = cryptoHelper.decrypt(encrypted);
      expect(decrypted).toBe(plainText);
    });

    it("should generate different ciphertexts for same plaintext", () => {
      const plainText = "Same message";

      const encrypted1 = cryptoHelper.encrypt(plainText);
      const encrypted2 = cryptoHelper.encrypt(plainText);

      expect(encrypted1).not.toBe(encrypted2); // Different IVs
      expect(cryptoHelper.decrypt(encrypted1)).toBe(plainText);
      expect(cryptoHelper.decrypt(encrypted2)).toBe(plainText);
    });

    it("should handle empty strings", () => {
      const plainText = "";

      const encrypted = cryptoHelper.encrypt(plainText);
      const decrypted = cryptoHelper.decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it("should handle special characters", () => {
      const plainText = "!@#$%^&*()_+{}[]|\\:\";'<>?,./~`";

      const encrypted = cryptoHelper.encrypt(plainText);
      const decrypted = cryptoHelper.decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it("should handle unicode characters", () => {
      const plainText = "🔐 こんにちは 你好 مرحبا";

      const encrypted = cryptoHelper.encrypt(plainText);
      const decrypted = cryptoHelper.decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it("should handle long texts", () => {
      const plainText = "a".repeat(10000);

      const encrypted = cryptoHelper.encrypt(plainText);
      const decrypted = cryptoHelper.decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it("should throw error for invalid encrypted data", () => {
      expect(() => {
        cryptoHelper.decrypt("invalid-encrypted-data");
      }).toThrow();
    });

    it("should throw error for tampered encrypted data", () => {
      const plainText = "Original message";
      const encrypted = cryptoHelper.encrypt(plainText);

      // Tamper with the encrypted data
      const parts = encrypted.split(":");
      parts[1] = parts[1].substring(0, parts[1].length - 2) + "XX";
      const tampered = parts.join(":");

      expect(() => {
        cryptoHelper.decrypt(tampered);
      }).toThrow();
    });
  });

  describe("hash", () => {
    it("should generate consistent hash for same input", () => {
      const data = "test-data";

      const hash1 = cryptoHelper.hash(data);
      const hash2 = cryptoHelper.hash(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex length
    });

    it("should generate different hashes for different inputs", () => {
      const hash1 = cryptoHelper.hash("data1");
      const hash2 = cryptoHelper.hash("data2");

      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty string", () => {
      const hash = cryptoHelper.hash("");

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
    });
  });

  describe("generateRandomToken", () => {
    it("should generate token of specified length", () => {
      const token = cryptoHelper.generateRandomToken(32);

      expect(token).toHaveLength(64); // Hex encoding doubles the length
    });

    it("should generate unique tokens", () => {
      const tokens = new Set();

      for (let i = 0; i < 100; i++) {
        tokens.add(cryptoHelper.generateRandomToken(16));
      }

      expect(tokens.size).toBe(100); // All tokens should be unique
    });

    it("should default to 32 bytes", () => {
      const token = cryptoHelper.generateRandomToken();

      expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
    });
  });

  describe("compareHash", () => {
    it("should return true for matching hashes", () => {
      const data = "password123";
      const hash = cryptoHelper.hash(data);

      const result = cryptoHelper.compareHash(data, hash);
      expect(result).toBe(true);
    });

    it("should return false for non-matching hashes", () => {
      const hash = cryptoHelper.hash("password123");

      const result = cryptoHelper.compareHash("wrongpassword", hash);
      expect(result).toBe(false);
    });

    it("should handle empty strings", () => {
      const hash = cryptoHelper.hash("");

      expect(cryptoHelper.compareHash("", hash)).toBe(true);
      expect(cryptoHelper.compareHash("not-empty", hash)).toBe(false);
    });
  });

  describe("encryptObject and decryptObject", () => {
    it("should encrypt and decrypt objects", () => {
      const obj = {
        username: "testuser",
        apiKey: "secret-key-123",
        settings: {
          theme: "dark",
          notifications: true,
        },
      };

      const encrypted = cryptoHelper.encryptObject(obj);
      expect(typeof encrypted).toBe("string");

      const decrypted = cryptoHelper.decryptObject(encrypted);
      expect(decrypted).toEqual(obj);
    });

    it("should handle arrays", () => {
      const arr = [1, 2, 3, "test", { key: "value" }];

      const encrypted = cryptoHelper.encryptObject(arr);
      const decrypted = cryptoHelper.decryptObject(encrypted);

      expect(decrypted).toEqual(arr);
    });

    it("should handle null and undefined values in objects", () => {
      const obj = {
        nullValue: null,
        undefinedValue: undefined,
        normalValue: "test",
      };

      const encrypted = cryptoHelper.encryptObject(obj);
      const decrypted = cryptoHelper.decryptObject(encrypted);

      expect(decrypted.nullValue).toBeNull();
      expect(decrypted.undefinedValue).toBeUndefined();
      expect(decrypted.normalValue).toBe("test");
    });

    it("should throw error for invalid JSON after decryption", () => {
      const invalidEncrypted = cryptoHelper.encrypt("not-valid-json");

      expect(() => {
        cryptoHelper.decryptObject(invalidEncrypted);
      }).toThrow();
    });
  });
});
