import logger from './logger.js';
import { CONFIG } from '../core/config-manager.js';
import { RateLimitError, AuthError } from './error-handler.js';

export const RATE_LIMIT_CONFIG = {
    DEFAULT_RATE_LIMIT: 100,
    DEFAULT_RATE_LIMIT_WINDOW_MS: 60000,
    DEFAULT_BURST_LIMIT: 20,
    MAX_RATE_LIMIT: 1000,
    MIN_RATE_LIMIT_WINDOW_MS: 1000
};

export class RateLimiter {
    constructor() {
        this.clients = new Map();
        this.globalLimit = {
            requests: 0,
            timestamp: Date.now()
        };
        this.globalLimitConfig = {
            limit: 1000,
            windowMs: 60000
        };
    }

    getClientKey(req) {
        const ip = this.getClientIp(req);
        const apiKey = req.headers['authorization'] || req.headers['x-api-key'] || req.query['api_key'] || 'anonymous';
        return `${ip}:${apiKey}`;
    }

    getClientIp(req) {
        return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
               req.headers['x-real-ip'] ||
               req.socket?.remoteAddress ||
               'unknown';
    }

    getClientConfig(clientKey) {
        const defaultConfig = {
            limit: CONFIG.RATE_LIMIT || RATE_LIMIT_CONFIG.DEFAULT_RATE_LIMIT,
            windowMs: CONFIG.RATE_LIMIT_WINDOW_MS || RATE_LIMIT_CONFIG.DEFAULT_RATE_LIMIT_WINDOW_MS,
            burstLimit: CONFIG.BURST_LIMIT || RATE_LIMIT_CONFIG.DEFAULT_BURST_LIMIT
        };

        if (CONFIG.RATE_LIMIT_RULES && CONFIG.RATE_LIMIT_RULES[clientKey]) {
            return { ...defaultConfig, ...CONFIG.RATE_LIMIT_RULES[clientKey] };
        }

        if (CONFIG.RATE_LIMIT_RULES && CONFIG.RATE_LIMIT_RULES['*']) {
            return { ...defaultConfig, ...CONFIG.RATE_LIMIT_RULES['*'] };
        }

        return defaultConfig;
    }

    checkLimit(req) {
        const now = Date.now();
        const clientKey = this.getClientKey(req);
        const config = this.getClientConfig(clientKey);

        if (!this.clients.has(clientKey)) {
            this.clients.set(clientKey, {
                requests: 0,
                burstRequests: 0,
                timestamp: now,
                burstTimestamp: now
            });
        }

        const client = this.clients.get(clientKey);

        if (now - client.timestamp >= config.windowMs) {
            client.requests = 0;
            client.timestamp = now;
        }

        if (now - client.burstTimestamp >= 1000) {
            client.burstRequests = 0;
            client.burstTimestamp = now;
        }

        client.requests++;
        client.burstRequests++;

        if (client.burstRequests > config.burstLimit) {
            return {
                allowed: false,
                remaining: 0,
                retryAfter: Math.ceil((1000 - (now - client.burstTimestamp)) / 1000),
                limit: config.burstLimit,
                message: 'Burst limit exceeded'
            };
        }

        if (client.requests > config.limit) {
            const waitTime = Math.ceil((config.windowMs - (now - client.timestamp)) / 1000);
            return {
                allowed: false,
                remaining: 0,
                retryAfter: waitTime,
                limit: config.limit,
                message: 'Rate limit exceeded'
            };
        }

        return {
            allowed: true,
            remaining: config.limit - client.requests,
            retryAfter: 0,
            limit: config.limit
        };
    }

    async handleRequest(req, res, next) {
        const result = this.checkLimit(req);

        res.setHeader('X-RateLimit-Limit', result.limit);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Retry-After', result.retryAfter);

        if (!result.allowed) {
            throw new RateLimitError(result.message, {
                limit: result.limit,
                remaining: result.remaining,
                retryAfter: result.retryAfter,
                clientKey: this.getClientKey(req)
            });
        }

        if (next) {
            return next();
        }
        return true;
    }

    getStats() {
        const now = Date.now();
        const activeClients = Array.from(this.clients.entries())
            .filter(([, client]) => now - client.timestamp < 3600000)
            .length;

        const totalRequests = Array.from(this.clients.values())
            .reduce((sum, client) => sum + client.requests, 0);

        return {
            activeClients,
            totalClients: this.clients.size,
            totalRequests,
            globalLimit: this.globalLimitConfig
        };
    }

    resetClient(clientKey) {
        this.clients.delete(clientKey);
        logger.info(`[RateLimiter] Reset rate limit for client: ${clientKey}`);
    }

    updateConfig(newConfig) {
        this.globalLimitConfig = {
            limit: newConfig.limit || this.globalLimitConfig.limit,
            windowMs: newConfig.windowMs || this.globalLimitConfig.windowMs
        };
        logger.info(`[RateLimiter] Updated global rate limit config: ${JSON.stringify(this.globalLimitConfig)}`);
    }
}

let rateLimiterInstance = null;

export function getRateLimiter() {
    if (!rateLimiterInstance) {
        rateLimiterInstance = new RateLimiter();
    }
    return rateLimiterInstance;
}

export function initializeRateLimiter(config = {}) {
    rateLimiterInstance = new RateLimiter();
    rateLimiterInstance.updateConfig(config);
    return rateLimiterInstance;
}