import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ApiKeyManager, getApiKeyManager, API_KEY_CONFIG } from '../src/utils/api-key-manager.js';
import fs from 'fs';
import path from 'path';

describe('API Key Manager', () => {
    let apiKeyManager;
    const testKeyFile = 'configs/api_keys_test.json';

    beforeEach(() => {
        apiKeyManager = new ApiKeyManager();
        apiKeyManager.keyFile = testKeyFile;
        apiKeyManager.keys = new Map();
    });

    afterEach(() => {
        if (fs.existsSync(testKeyFile)) {
            fs.unlinkSync(testKeyFile);
        }
        apiKeyManager = null;
    });

    describe('API_KEY_CONFIG', () => {
        it('should have correct default values', () => {
            expect(API_KEY_CONFIG.KEY_LENGTH).toBe(32);
            expect(API_KEY_CONFIG.KEY_PREFIX).toBe('sk-');
            expect(API_KEY_CONFIG.MAX_KEYS).toBe(100);
        });
    });

    describe('generateKey', () => {
        it('should generate a key with correct format', () => {
            const key = apiKeyManager.generateKey();
            expect(key).toMatch(/^sk-[A-Za-z0-9_-]{43}$/);
        });

        it('should generate unique keys', () => {
            const key1 = apiKeyManager.generateKey();
            const key2 = apiKeyManager.generateKey();
            expect(key1).not.toBe(key2);
        });
    });

    describe('createKey', () => {
        it('should create a new API key', () => {
            const result = apiKeyManager.createKey('Test Key');
            
            expect(result.key).toMatch(/^sk-/);
            expect(result.name).toBe('Test Key');
            expect(result.id).toBeDefined();
            expect(result.enabled).toBe(true);
            expect(result.permissions).toEqual(['all']);
            expect(result.createdAt).toBeDefined();
        });

        it('should create key with custom permissions', () => {
            const result = apiKeyManager.createKey('Restricted Key', ['read', 'write']);
            expect(result.permissions).toEqual(['read', 'write']);
        });

        it('should create key with expiration date', () => {
            const expiresAt = new Date(Date.now() + 86400000).toISOString();
            const result = apiKeyManager.createKey('Temp Key', ['all'], expiresAt);
            expect(result.expiresAt).toBe(expiresAt);
        });

        it('should track usage count', () => {
            const result = apiKeyManager.createKey('Usage Test');
            apiKeyManager.updateKeyUsage(result.key);
            apiKeyManager.updateKeyUsage(result.key);
            
            const keyData = apiKeyManager.getKeyInfo(result.key);
            expect(keyData.usageCount).toBe(2);
        });
    });

    describe('validateKey', () => {
        it('should validate a valid key', () => {
            const result = apiKeyManager.createKey('Valid Key');
            const validation = apiKeyManager.validateKey(result.key);
            
            expect(validation.valid).toBe(true);
            expect(validation.keyData.name).toBe('Valid Key');
        });

        it('should reject invalid key', () => {
            const validation = apiKeyManager.validateKey('invalid-key');
            expect(validation.valid).toBe(false);
            expect(validation.reason).toBe('Invalid API key');
        });

        it('should reject missing key', () => {
            const validation = apiKeyManager.validateKey(null);
            expect(validation.valid).toBe(false);
            expect(validation.reason).toBe('Missing API key');
        });

        it('should reject disabled key', () => {
            const result = apiKeyManager.createKey('Disabled Key');
            apiKeyManager.disableKey(result.key);
            
            const validation = apiKeyManager.validateKey(result.key);
            expect(validation.valid).toBe(false);
            expect(validation.reason).toBe('API key is disabled');
        });

        it('should reject expired key', () => {
            const expiresAt = new Date(Date.now() - 86400000).toISOString();
            const result = apiKeyManager.createKey('Expired Key', ['all'], expiresAt);
            
            const validation = apiKeyManager.validateKey(result.key);
            expect(validation.valid).toBe(false);
            expect(validation.reason).toBe('API key has expired');
        });
    });

    describe('authenticate', () => {
        it('should authenticate with Authorization header', () => {
            const result = apiKeyManager.createKey('Auth Test');
            const req = {
                headers: { authorization: `Bearer ${result.key}` }
            };
            
            const authResult = apiKeyManager.authenticate(req);
            expect(authResult.valid).toBe(true);
            expect(authResult.keyData.name).toBe('Auth Test');
        });

        it('should authenticate with X-API-Key header', () => {
            const result = apiKeyManager.createKey('X-API-Key Test');
            const req = {
                headers: { 'x-api-key': result.key }
            };
            
            const authResult = apiKeyManager.authenticate(req);
            expect(authResult.valid).toBe(true);
        });

        it('should authenticate with query parameter', () => {
            const result = apiKeyManager.createKey('Query Test');
            const req = {
                headers: {},
                query: { api_key: result.key }
            };
            
            const authResult = apiKeyManager.authenticate(req);
            expect(authResult.valid).toBe(true);
        });
    });

    describe('checkPermission', () => {
        it('should allow permission when key has all permissions', () => {
            const result = apiKeyManager.createKey('All Permissions');
            const hasPermission = apiKeyManager.checkPermission(result.key, 'admin');
            expect(hasPermission).toBe(true);
        });

        it('should allow permission when key has specific permission', () => {
            const result = apiKeyManager.createKey('Specific Permissions', ['read', 'write']);
            const hasPermission = apiKeyManager.checkPermission(result.key, 'read');
            expect(hasPermission).toBe(true);
        });
    });

    describe('disableKey and enableKey', () => {
        it('should disable and enable a key', () => {
            const result = apiKeyManager.createKey('Toggle Test');
            
            apiKeyManager.disableKey(result.key);
            let validation = apiKeyManager.validateKey(result.key);
            expect(validation.valid).toBe(false);
            
            apiKeyManager.enableKey(result.key);
            validation = apiKeyManager.validateKey(result.key);
            expect(validation.valid).toBe(true);
        });
    });

    describe('deleteKey', () => {
        it('should delete a key', () => {
            const result = apiKeyManager.createKey('Delete Test');
            apiKeyManager.deleteKey(result.key);
            
            const validation = apiKeyManager.validateKey(result.key);
            expect(validation.valid).toBe(false);
        });
    });

    describe('getAllKeys', () => {
        it('should return all keys with masked key values', () => {
            apiKeyManager.createKey('Key 1');
            apiKeyManager.createKey('Key 2');
            
            const keys = apiKeyManager.getAllKeys();
            expect(keys.length).toBe(2);
            expect(keys[0].key).toMatch(/^sk-[A-Za-z0-9_-]{7}\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*$/);
        });
    });

    describe('getStats', () => {
        it('should return correct stats', () => {
            apiKeyManager.createKey('Active Key');
            apiKeyManager.createKey('Disabled Key');
            apiKeyManager.disableKey(apiKeyManager.getAllKeys()[1].key);
            
            const stats = apiKeyManager.getStats();
            expect(stats.totalKeys).toBe(2);
            expect(stats.activeKeys).toBe(1);
            expect(stats.disabledKeys).toBe(1);
        });
    });

    describe('regenerateKey', () => {
        it('should regenerate a key', () => {
            const result = apiKeyManager.createKey('Regen Test');
            const oldKey = result.key;
            
            const newResult = apiKeyManager.regenerateKey(oldKey);
            
            expect(newResult.key).not.toBe(oldKey);
            expect(newResult.name).toBe('Regen Test');
            
            const oldValidation = apiKeyManager.validateKey(oldKey);
            expect(oldValidation.valid).toBe(false);
            
            const newValidation = apiKeyManager.validateKey(newResult.key);
            expect(newValidation.valid).toBe(true);
        });
    });

    describe('saveKeys and loadKeys', () => {
        it('should save and load keys from file', () => {
            apiKeyManager.createKey('Save Test');
            apiKeyManager.saveKeys();
            
            const newManager = new ApiKeyManager();
            newManager.keyFile = testKeyFile;
            newManager.loadKeys();
            
            expect(newManager.getAllKeys().length).toBe(1);
            expect(newManager.getAllKeys()[0].name).toBe('Save Test');
        });
    });

    describe('getApiKeyManager', () => {
        it('should return singleton instance', () => {
            const instance1 = getApiKeyManager();
            const instance2 = getApiKeyManager();
            expect(instance1).toBe(instance2);
        });
    });
});