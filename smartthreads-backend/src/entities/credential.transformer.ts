import { ValueTransformer } from "typeorm";
import { CryptoService } from "../crypto/crypto.service";

let cryptoServiceInstance: CryptoService;

export const setCryptoServiceInstance = (service: CryptoService) => {
  cryptoServiceInstance = service;
};

export class EncryptedColumnTransformer implements ValueTransformer {
  to(value: string | undefined): string | undefined {
    if (!value || !cryptoServiceInstance) {
      return value;
    }
    return cryptoServiceInstance.encryptForStorage(value);
  }

  from(value: string | undefined): string | undefined {
    if (!value || !cryptoServiceInstance) {
      return value;
    }
    try {
      return cryptoServiceInstance.decryptFromStorage(value);
    } catch (error) {
      console.error("Failed to decrypt column value:", error);
      return undefined;
    }
  }
}
