import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import logger from './logger.js';
import { CONFIG } from '../core/config-manager.js';
import { AuthError, PermissionError } from './error-handler.js';

export const API_KEY_CONFIG = {
    KEY_LENGTH: 32,
    KEY_PREFIX: 'sk-',
    MAX_KEYS: 100,
    KEY_FILE_PATH: 'configs/api_keys.json'
};

export class ApiKeyManager {
    constructor() {
        this.keys = new Map();
        this.keyFile = API_KEY_CONFIG.KEY_FILE_PATH;
        this.loadKeys();
    }

    loadKeys() {
        try {
            if (fs.existsSync(this.keyFile)) {
                const data = fs.readFileSync(this.keyFile, 'utf8');
                const keys = JSON.parse(data);
                this.keys = new Map(Object.entries(keys));
                logger.info(`[ApiKeyManager] Loaded ${this.keys.size} API keys from ${this.keyFile}`);
            }
        } catch (error) {
            logger.error(`[ApiKeyManager] Failed to load API keys: ${error.message}`);
            this.keys = new Map();
        }
    }

    saveKeys() {
        try {
            const data = Object.fromEntries(this.keys);
            fs.writeFileSync(this.keyFile, JSON.stringify(data, null, 2), 'utf8');
            logger.info(`[ApiKeyManager] Saved ${this.keys.size} API keys to ${this.keyFile}`);
        } catch (error) {
            logger.error(`[ApiKeyManager] Failed to save API keys: ${error.message}`);
            throw error;
        }
    }

    generateKey(prefix = API_KEY_CONFIG.KEY_PREFIX) {
        const randomBytes = crypto.randomBytes(API_KEY_CONFIG.KEY_LENGTH).toString('base64url');
        return `${prefix}${randomBytes}`;
    }

    createKey(name, permissions = ['all'], expiresAt = null) {
        if (this.keys.size >= API_KEY_CONFIG.MAX_KEYS) {
            throw new PermissionError('API key limit exceeded', { maxKeys: API_KEY_CONFIG.MAX_KEYS });
        }

        const key = this.generateKey();
        const keyId = crypto.randomUUID();
        
        const keyData = {
            id: keyId,
            name,
            permissions,
            expiresAt,
            createdAt: new Date().toISOString(),
            lastUsedAt: null,
            usageCount: 0,
            enabled: true
        };

        this.keys.set(key, keyData);
        this.saveKeys();
        
        logger.info(`[ApiKeyManager] Created new API key: ${name} (${keyId})`);
        return { key, ...keyData };
    }

    validateKey(key) {
        if (!key) {
            return { valid: false, reason: 'Missing API key' };
        }

        const keyData = this.keys.get(key);
        if (!keyData) {
            return { valid: false, reason: 'Invalid API key' };
        }

        if (!keyData.enabled) {
            return { valid: false, reason: 'API key is disabled' };
        }

        if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
            return { valid: false, reason: 'API key has expired' };
        }

        return { valid: true, keyData };
    }

    authenticate(req) {
        let apiKey = null;

        if (req.headers.authorization) {
            const authHeader = req.headers.authorization;
            if (authHeader.startsWith('Bearer ')) {
                apiKey = authHeader.substring(7);
            } else {
                apiKey = authHeader;
            }
        }

        if (!apiKey && req.headers['x-api-key']) {
            apiKey = req.headers['x-api-key'];
        }

        if (!apiKey && req.query['api_key']) {
            apiKey = req.query['api_key'];
        }

        if (!apiKey && CONFIG.REQUIRED_API_KEY && !CONFIG.REQUIRED_API_KEY.startsWith('******')) {
            if (apiKey === CONFIG.REQUIRED_API_KEY) {
                return {
                    valid: true,
                    keyData: {
                        id: 'default',
                        name: 'Default Key',
                        permissions: ['all'],
                        createdAt: new Date().toISOString(),
                        lastUsedAt: new Date().toISOString(),
                        usageCount: 0,
                        enabled: true
                    }
                };
            }
        }

        const result = this.validateKey(apiKey);
        if (result.valid) {
            this.updateKeyUsage(apiKey);
        }

        return result;
    }

    updateKeyUsage(key) {
        const keyData = this.keys.get(key);
        if (keyData) {
            keyData.lastUsedAt = new Date().toISOString();
            keyData.usageCount++;
            this.saveKeys();
        }
    }

    checkPermission(key, permission) {
        const result = this.validateKey(key);
        if (!result.valid) {
            throw new AuthError(result.reason);
        }

        const keyData = result.keyData;
        if (!keyData.permissions.includes('all') && !keyData.permissions.includes(permission)) {
            throw new PermissionError('Insufficient permissions', {
                required: permission,
                available: keyData.permissions
            });
        }

        return true;
    }

    disableKey(key) {
        const keyData = this.keys.get(key);
        if (!keyData) {
            throw new AuthError('API key not found');
        }

        keyData.enabled = false;
        this.saveKeys();
        logger.info(`[ApiKeyManager] Disabled API key: ${keyData.name} (${keyData.id})`);
        return keyData;
    }

    enableKey(key) {
        const keyData = this.keys.get(key);
        if (!keyData) {
            throw new AuthError('API key not found');
        }

        keyData.enabled = true;
        this.saveKeys();
        logger.info(`[ApiKeyManager] Enabled API key: ${keyData.name} (${keyData.id})`);
        return keyData;
    }

    deleteKey(key) {
        const keyData = this.keys.get(key);
        if (!keyData) {
            throw new AuthError('API key not found');
        }

        this.keys.delete(key);
        this.saveKeys();
        logger.info(`[ApiKeyManager] Deleted API key: ${keyData.name} (${keyData.id})`);
        return keyData;
    }

    getKeyInfo(key) {
        const keyData = this.keys.get(key);
        if (!keyData) {
            return null;
        }
        return { ...keyData };
    }

    getAllKeys() {
        const keys = [];
        this.keys.forEach((data, key) => {
            keys.push({
                key: key.substring(0, 8) + '************************',
                ...data
            });
        });
        return keys;
    }

    getStats() {
        const now = new Date();
        const activeKeys = Array.from(this.keys.values())
            .filter(k => k.enabled && (!k.expiresAt || new Date(k.expiresAt) > now))
            .length;

        const totalUsage = Array.from(this.keys.values())
            .reduce((sum, k) => sum + k.usageCount, 0);

        return {
            totalKeys: this.keys.size,
            activeKeys,
            disabledKeys: this.keys.size - activeKeys,
            totalUsage,
            maxKeys: API_KEY_CONFIG.MAX_KEYS
        };
    }

    regenerateKey(oldKey) {
        const keyData = this.keys.get(oldKey);
        if (!keyData) {
            throw new AuthError('API key not found');
        }

        const newKey = this.generateKey();
        this.keys.delete(oldKey);
        this.keys.set(newKey, {
            ...keyData,
            createdAt: new Date().toISOString(),
            lastUsedAt: null,
            usageCount: 0
        });
        this.saveKeys();

        logger.info(`[ApiKeyManager] Regenerated API key: ${keyData.name} (${keyData.id})`);
        return { key: newKey, ...keyData };
    }
}

let apiKeyManagerInstance = null;

export function getApiKeyManager() {
    if (!apiKeyManagerInstance) {
        apiKeyManagerInstance = new ApiKeyManager();
    }
    return apiKeyManagerInstance;
}

export function initializeApiKeyManager() {
    apiKeyManagerInstance = new ApiKeyManager();
    return apiKeyManagerInstance;
}