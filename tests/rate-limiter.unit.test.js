import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RateLimiter, getRateLimiter, RATE_LIMIT_CONFIG } from '../src/utils/rate-limiter.js';

describe('Rate Limiter', () => {
    let rateLimiter;

    beforeEach(() => {
        rateLimiter = new RateLimiter();
    });

    afterEach(() => {
        rateLimiter = null;
    });

    describe('RATE_LIMIT_CONFIG', () => {
        it('should have correct default values', () => {
            expect(RATE_LIMIT_CONFIG.DEFAULT_RATE_LIMIT).toBe(100);
            expect(RATE_LIMIT_CONFIG.DEFAULT_RATE_LIMIT_WINDOW_MS).toBe(60000);
            expect(RATE_LIMIT_CONFIG.DEFAULT_BURST_LIMIT).toBe(20);
            expect(RATE_LIMIT_CONFIG.MAX_RATE_LIMIT).toBe(1000);
            expect(RATE_LIMIT_CONFIG.MIN_RATE_LIMIT_WINDOW_MS).toBe(1000);
        });
    });

    describe('getClientIp', () => {
        it('should get IP from x-forwarded-for header', () => {
            const req = {
                headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
                socket: { remoteAddress: '127.0.0.1' }
            };
            const ip = rateLimiter.getClientIp(req);
            expect(ip).toBe('192.168.1.1');
        });

        it('should get IP from x-real-ip header', () => {
            const req = {
                headers: { 'x-real-ip': '192.168.1.2' },
                socket: { remoteAddress: '127.0.0.1' }
            };
            const ip = rateLimiter.getClientIp(req);
            expect(ip).toBe('192.168.1.2');
        });

        it('should get IP from socket remoteAddress as fallback', () => {
            const req = {
                headers: {},
                socket: { remoteAddress: '192.168.1.3' }
            };
            const ip = rateLimiter.getClientIp(req);
            expect(ip).toBe('192.168.1.3');
        });
    });

    describe('getClientKey', () => {
        it('should generate client key from IP and API key', () => {
            const req = {
                headers: { 'x-api-key': 'test-key' },
                socket: { remoteAddress: '192.168.1.1' }
            };
            const key = rateLimiter.getClientKey(req);
            expect(key).toBe('192.168.1.1:test-key');
        });

        it('should use anonymous for missing API key', () => {
            const req = {
                headers: {},
                socket: { remoteAddress: '192.168.1.1' }
            };
            const key = rateLimiter.getClientKey(req);
            expect(key).toBe('192.168.1.1:anonymous');
        });
    });

    describe('checkLimit', () => {
        it('should allow requests within limit', () => {
            const req = {
                headers: { 'x-api-key': 'test-key' },
                socket: { remoteAddress: '192.168.1.1' }
            };

            for (let i = 0; i < 10; i++) {
                const result = rateLimiter.checkLimit(req);
                expect(result.allowed).toBe(true);
                expect(result.remaining).toBe(90 - i);
            }
        });

        it('should block requests exceeding rate limit', () => {
            const req = {
                headers: { 'x-api-key': 'test-key' },
                socket: { remoteAddress: '192.168.1.1' }
            };

            for (let i = 0; i < 100; i++) {
                rateLimiter.checkLimit(req);
            }

            const result = rateLimiter.checkLimit(req);
            expect(result.allowed).toBe(false);
            expect(result.message).toBe('Rate limit exceeded');
        });

        it('should block requests exceeding burst limit', async () => {
            const req = {
                headers: { 'x-api-key': 'burst-test' },
                socket: { remoteAddress: '192.168.1.2' }
            };

            for (let i = 0; i < 20; i++) {
                const result = rateLimiter.checkLimit(req);
                expect(result.allowed).toBe(true);
            }

            const result = rateLimiter.checkLimit(req);
            expect(result.allowed).toBe(false);
            expect(result.message).toBe('Burst limit exceeded');
        });
    });

    describe('handleRequest', () => {
        it('should set rate limit headers', () => {
            const req = {
                headers: { 'x-api-key': 'test-handle' },
                socket: { remoteAddress: '192.168.1.1' }
            };
            const res = {
                setHeader: jest.fn()
            };

            rateLimiter.handleRequest(req, res);

            expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(Number));
            expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
            expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Retry-After', expect.any(Number));
        });
    });

    describe('getStats', () => {
        it('should return correct stats', () => {
            const req1 = { headers: { 'x-api-key': 'key1' }, socket: { remoteAddress: '192.168.1.1' } };
            const req2 = { headers: { 'x-api-key': 'key2' }, socket: { remoteAddress: '192.168.1.2' } };

            rateLimiter.checkLimit(req1);
            rateLimiter.checkLimit(req1);
            rateLimiter.checkLimit(req2);

            const stats = rateLimiter.getStats();
            expect(stats.activeClients).toBe(2);
            expect(stats.totalClients).toBe(2);
            expect(stats.totalRequests).toBe(3);
        });
    });

    describe('resetClient', () => {
        it('should reset client rate limit', () => {
            const req = {
                headers: { 'x-api-key': 'reset-test' },
                socket: { remoteAddress: '192.168.1.1' }
            };

            rateLimiter.checkLimit(req);
            rateLimiter.resetClient('192.168.1.1:reset-test');

            const result = rateLimiter.checkLimit(req);
            expect(result.remaining).toBe(99);
        });
    });

    describe('getRateLimiter', () => {
        it('should return singleton instance', () => {
            const instance1 = getRateLimiter();
            const instance2 = getRateLimiter();
            expect(instance1).toBe(instance2);
        });
    });
});