import { describe, expect, test, jest, beforeEach } from '@jest/globals';

describe('Provider Enhancement Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('SSE Event Parsing Logic', () => {
        test('should properly parse SSE event with all fields', () => {
            const eventData = 'event: message\r\ndata: {"id":"test","content":"hello"}\r\nid: 123\r\nretry: 5000\r\n\r\n';
            
            const parsed = parseSSEEvent(eventData);

            expect(parsed.event).toBe('message');
            expect(parsed.data).toBe('{"id":"test","content":"hello"}');
            expect(parsed.id).toBe('123');
            expect(parsed.retry).toBe(5000);
        });

        test('should handle partial SSE event data', () => {
            const eventData = 'data: {"id":"test"}\r\ndata: ,"content":"hello"}\r\n\r\n';
            const parsed = parseSSEEvent(eventData);

            expect(parsed.event).toBeNull();
            expect(parsed.data).toBe('{"id":"test"},,"content":"hello"}');
        });

        test('should handle empty event', () => {
            const eventData = '\r\n';
            const parsed = parseSSEEvent(eventData);

            expect(parsed.event).toBeNull();
            expect(parsed.data).toBeNull();
            expect(parsed.id).toBeNull();
            expect(parsed.retry).toBeNull();
        });
    });

    describe('429 Error Handling Logic', () => {
        test('should extract Retry-After header value', () => {
            const headers = new Headers({ 'retry-after': '15' });
            const retryAfter = getRetryAfter(headers);
            
            expect(retryAfter).toBe(15000);
        });

        test('should return null when Retry-After header is missing', () => {
            const headers = new Headers();
            const retryAfter = getRetryAfter(headers);
            
            expect(retryAfter).toBeNull();
        });

        test('should handle invalid Retry-After values', () => {
            const headers = new Headers({ 'retry-after': 'invalid' });
            const retryAfter = getRetryAfter(headers);
            
            expect(retryAfter).toBeNull();
        });

        test('should calculate exponential backoff correctly', () => {
            expect(calculateBackoff(0, 1000, 1.5)).toBe(1000);
            expect(calculateBackoff(1, 1000, 1.5)).toBe(1500);
            expect(calculateBackoff(2, 1000, 1.5)).toBe(2250);
            expect(calculateBackoff(3, 1000, 1.5)).toBe(3375);
        });

        test('should respect max backoff limit', () => {
            expect(calculateBackoff(10, 1000, 2, 10000)).toBe(10000);
        });
    });

    describe('Timeout Configuration', () => {
        test('should return default timeout when not specified', () => {
            const config = { API_BASE_URL: 'http://localhost:8080' };
            const timeout = getTimeout(config);
            
            expect(timeout).toBe(300000);
        });

        test('should return custom timeout when specified', () => {
            const config = { API_BASE_URL: 'http://localhost:8080', TIMEOUT: 60000 };
            const timeout = getTimeout(config);
            
            expect(timeout).toBe(60000);
        });

        test('should handle invalid timeout values', () => {
            const config = { API_BASE_URL: 'http://localhost:8080', TIMEOUT: 'invalid' };
            const timeout = getTimeout(config);
            
            expect(timeout).toBe(300000);
        });
    });

    describe('anyDataSent Flag Logic', () => {
        test('should prevent retry when anyDataSent is true', () => {
            const shouldRetry = shouldAttemptRetry(true, 503);
            
            expect(shouldRetry).toBe(false);
        });

        test('should allow retry when anyDataSent is false and status is retryable', () => {
            const shouldRetry = shouldAttemptRetry(false, 503);
            
            expect(shouldRetry).toBe(true);
        });

        test('should not retry for non-retryable status codes', () => {
            const shouldRetry = shouldAttemptRetry(false, 400);
            
            expect(shouldRetry).toBe(false);
        });
    });
});

function parseSSEEvent(eventData) {
    const event = {
        event: null,
        data: [],
        id: null,
        retry: null
    };

    const lines = eventData.split('\n');
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('event:')) {
            event.event = trimmedLine.substring(6).trim();
        } else if (trimmedLine.startsWith('data:')) {
            event.data.push(trimmedLine.substring(5).trim());
        } else if (trimmedLine.startsWith('id:')) {
            event.id = trimmedLine.substring(3).trim();
        } else if (trimmedLine.startsWith('retry:')) {
            const retryValue = parseInt(trimmedLine.substring(6).trim(), 10);
            if (!isNaN(retryValue)) {
                event.retry = retryValue;
            }
        }
    }

    if (event.data.length === 0) {
        event.data = null;
    } else if (event.data.length === 1) {
        event.data = event.data[0];
    } else {
        event.data = event.data.join(',');
    }

    return event;
}

function getRetryAfter(headers) {
    const retryAfterStr = headers.get('retry-after');
    if (!retryAfterStr) return null;
    
    const retryAfterSeconds = parseInt(retryAfterStr, 10);
    if (isNaN(retryAfterSeconds) || retryAfterSeconds <= 0) return null;
    
    return retryAfterSeconds * 1000;
}

function calculateBackoff(attempt, baseDelay, multiplier, maxDelay = 30000) {
    const delay = baseDelay * Math.pow(multiplier, attempt);
    return Math.min(delay, maxDelay);
}

function getTimeout(config) {
    const DEFAULT_TIMEOUT = 5 * 60 * 1000;
    if (config?.TIMEOUT && typeof config.TIMEOUT === 'number' && config.TIMEOUT > 0) {
        return config.TIMEOUT;
    }
    return DEFAULT_TIMEOUT;
}

function shouldAttemptRetry(anyDataSent, statusCode) {
    if (anyDataSent) return false;
    
    const retryableCodes = [429, 500, 502, 503, 504];
    return retryableCodes.includes(statusCode);
}