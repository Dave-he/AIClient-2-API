import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';

function getOAuthSessions() {
    if (!global.codexOAuthSessions) {
        global.codexOAuthSessions = new Map();
    }
    return global.codexOAuthSessions;
}

function cleanupAllCodexSessions() {
    const sessions = getOAuthSessions();
    for (const [sessionId, session] of sessions.entries()) {
        try {
            if (session.pollTimer) {
                clearInterval(session.pollTimer);
            }
            if (session.server && session.server.listening) {
                session.server.close(() => {});
            }
        } catch (error) {
            console.warn(`Failed to cleanup session ${sessionId}:`, error.message);
        }
    }
    sessions.clear();
}

describe('Codex OAuth Session Management', () => {
    beforeEach(() => {
        global.codexOAuthSessions = new Map();
    });

    afterEach(() => {
        cleanupAllCodexSessions();
    });

    test('cleanupAllCodexSessions should clear all sessions', () => {
        const mockTimer = setInterval(() => {}, 1000);
        
        global.codexOAuthSessions.set('test-session', {
            auth: {},
            state: 'test-state',
            pkce: { verifier: 'test', challenge: 'test' },
            server: { listening: true, close: () => {} },
            pollTimer: mockTimer,
            createdAt: Date.now()
        });

        expect(global.codexOAuthSessions.size).toBe(1);

        cleanupAllCodexSessions();

        expect(global.codexOAuthSessions.size).toBe(0);
        clearInterval(mockTimer);
    });

    test('cleanupAllCodexSessions should handle empty sessions', () => {
        expect(global.codexOAuthSessions.size).toBe(0);
        
        expect(() => cleanupAllCodexSessions()).not.toThrow();
        
        expect(global.codexOAuthSessions.size).toBe(0);
    });

    test('cleanupAllCodexSessions should handle multiple sessions', () => {
        const timer1 = setInterval(() => {}, 1000);
        const timer2 = setInterval(() => {}, 1000);

        global.codexOAuthSessions.set('session-1', {
            auth: {},
            state: 'state-1',
            pkce: { verifier: 'v1', challenge: 'c1' },
            server: { listening: true, close: () => {} },
            pollTimer: timer1,
            createdAt: Date.now()
        });

        global.codexOAuthSessions.set('session-2', {
            auth: {},
            state: 'state-2',
            pkce: { verifier: 'v2', challenge: 'c2' },
            server: { listening: true, close: () => {} },
            pollTimer: timer2,
            createdAt: Date.now()
        });

        expect(global.codexOAuthSessions.size).toBe(2);

        cleanupAllCodexSessions();

        expect(global.codexOAuthSessions.size).toBe(0);
        clearInterval(timer1);
        clearInterval(timer2);
    });

    test('cleanupAllCodexSessions should handle errors gracefully', () => {
        const mockServer = {
            listening: true,
            close: (callback) => callback(new Error('Force closed'))
        };

        global.codexOAuthSessions.set('error-session', {
            auth: {},
            state: 'error-state',
            pkce: { verifier: 'test', challenge: 'test' },
            server: mockServer,
            pollTimer: null,
            createdAt: Date.now()
        });

        expect(() => cleanupAllCodexSessions()).not.toThrow();
        expect(global.codexOAuthSessions.size).toBe(0);
    });

    test('getOAuthSessions should initialize if not exists', () => {
        delete global.codexOAuthSessions;
        
        const sessions = getOAuthSessions();
        
        expect(sessions).toBeInstanceOf(Map);
        expect(global.codexOAuthSessions).toBe(sessions);
    });

    test('getOAuthSessions should return existing sessions', () => {
        global.codexOAuthSessions = new Map([['test', 'value']]);
        
        const sessions = getOAuthSessions();
        
        expect(sessions.get('test')).toBe('value');
    });
});