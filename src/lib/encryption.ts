/**
 * Encryption utilities for API keys using AES-256-GCM
 * Keys are encrypted at rest and never logged or exposed to client after save
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

function getEncryptionKey(): Buffer {
  const key = process.env.APP_ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error(
      'FATAL: APP_ENCRYPTION_KEY environment variable is not set. ' +
      'Generate a 32-byte hex key with: openssl rand -hex 32'
    );
  }
  
  // Key should be 64 hex characters (32 bytes)
  if (key.length !== 64) {
    throw new Error(
      'FATAL: APP_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ' +
      'Generate with: openssl rand -hex 32'
    );
  }
  
  return Buffer.from(key, 'hex');
}

export interface EncryptedData {
  encryptedKey: string; // hex encoded
  iv: string; // hex encoded
  authTag: string; // hex encoded
}

/**
 * Encrypts a plaintext API key using AES-256-GCM
 * @param plaintext The API key to encrypt
 * @returns Object containing encrypted data, IV, and auth tag (all hex encoded)
 */
export function encryptApiKey(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encryptedKey: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypts an API key from encrypted storage
 * @param encryptedData Object containing encrypted data, IV, and auth tag
 * @returns The decrypted plaintext API key
 */
export function decryptApiKey(encryptedData: EncryptedData): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const authTag = Buffer.from(encryptedData.authTag, 'hex');
  
  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData.encryptedKey, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Gets the last 4 characters of an API key for display purposes
 * @param apiKey The full API key
 * @returns Last 4 characters, or masked if too short
 */
export function getKeyLastFour(apiKey: string): string {
  if (apiKey.length < 4) {
    return '****';
  }
  return apiKey.slice(-4);
}

/**
 * Redacts an API key from an error message or string
 * Used to prevent accidental exposure in logs
 */
export function redactApiKey(text: string, apiKey: string): string {
  if (!apiKey || apiKey.length < 8) return text;
  
  // Create a regex that matches the key
  const escaped = apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'g');
  
  return text.replace(regex, '[REDACTED]');
}

/**
 * Validates that the encryption key is properly configured
 * Call this at app startup to fail fast
 */
export function validateEncryptionSetup(): void {
  try {
    getEncryptionKey();
    
    // Test encryption/decryption roundtrip
    const testData = 'test-key-12345';
    const encrypted = encryptApiKey(testData);
    const decrypted = decryptApiKey(encrypted);
    
    if (decrypted !== testData) {
      throw new Error('Encryption roundtrip test failed');
    }
  } catch (error) {
    // Re-throw with context
    if (error instanceof Error && error.message.startsWith('FATAL:')) {
      throw error;
    }
    throw new Error(`Encryption setup validation failed: ${error}`);
  }
}
