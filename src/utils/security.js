/**
 * 安全工具模块
 * 提供 CSRF 防护、路径安全校验等安全功能
 */

import crypto from 'crypto';
import path from 'path';
import logger from './logger.js';

/**
 * CSRF Token 管理器
 */
export class CSRFManager {
    constructor() {
        this.tokens = new Map();
        this.tokenExpiry = 3600000;
    }

    generateToken(sessionId) {
        const token = crypto.randomBytes(32).toString('hex');
        this.tokens.set(sessionId, {
            token,
            createdAt: Date.now()
        });
        return token;
    }

    validateToken(sessionId, token) {
        const stored = this.tokens.get(sessionId);
        if (!stored) {
            return false;
        }

        if (Date.now() - stored.createdAt > this.tokenExpiry) {
            this.tokens.delete(sessionId);
            return false;
        }

        return crypto.timingSafeEqual(
            Buffer.from(stored.token, 'hex'),
            Buffer.from(token, 'hex')
        );
    }

    deleteToken(sessionId) {
        this.tokens.delete(sessionId);
    }
}

export const csrfManager = new CSRFManager();

/**
 * 路径安全校验
 * 防止路径遍历攻击
 * @param {string} filePath - 待校验的文件路径
 * @param {string[]} allowedDirs - 允许的目录列表
 * @param {string} basePath - 基础路径，默认为当前工作目录
 * @returns {Object} { safe: boolean, error?: string, resolvedPath?: string }
 */
export function validatePath(filePath, allowedDirs = ['configs'], basePath = process.cwd()) {
    if (!filePath || typeof filePath !== 'string') {
        return { safe: false, error: 'Invalid file path' };
    }

    const normalizedInput = filePath.replace(/\0/g, '');
    
    const fullPath = path.resolve(basePath, normalizedInput);
    
    if (normalizedInput.includes('..')) {
        logger.warn(`[Security] Path traversal attempt detected: ${filePath}`);
        return { safe: false, error: 'Path traversal not allowed' };
    }

    let isAllowed = false;
    for (const dir of allowedDirs) {
        const allowedPath = path.resolve(basePath, dir);
        if (fullPath.startsWith(allowedPath + path.sep) || fullPath === allowedPath) {
            isAllowed = true;
            break;
        }
    }

    if (!isAllowed) {
        logger.warn(`[Security] Access denied to path outside allowed directories: ${filePath}`);
        return { safe: false, error: `Access denied: path must be within ${allowedDirs.join(', ')}` };
    }

    return { safe: true, resolvedPath: fullPath };
}

/**
 * Cookie 配置生成器
 * @param {boolean} rememberMe - 是否记住登录
 * @param {boolean} isProduction - 是否生产环境
 * @returns {string} Cookie 配置字符串
 */
export function generateCookieConfig(rememberMe = false, isProduction = process.env.NODE_ENV === 'production') {
    const maxAge = rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60;
    const parts = [
        `Max-Age=${maxAge}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Strict'
    ];

    if (isProduction) {
        parts.push('Secure');
    }

    return parts.join('; ');
}

/**
 * 验证请求来源 (防止 CSRF)
 * @param {Object} req - HTTP 请求对象
 * @returns {boolean} 是否来自合法来源
 */
export function validateOrigin(req) {
    const origin = req.headers.origin || req.headers.referer;
    const host = req.headers.host;

    if (!origin) {
        return true;
    }

    try {
        const originUrl = new URL(origin);
        const originHost = originUrl.host;

        if (originHost === host) {
            return true;
        }

        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
        if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
            return true;
        }

        logger.warn(`[Security] Invalid origin detected: ${origin}, host: ${host}`);
        return false;
    } catch (e) {
        logger.warn(`[Security] Invalid origin header: ${origin}`);
        return false;
    }
}

/**
 * 生成安全的文件名
 * @param {string} filename - 原始文件名
 * @returns {string} 安全的文件名
 */
export function sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
        return 'unknown';
    }

    return filename
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\.{2,}/g, '.')
        .substring(0, 255);
}

/**
 * HTML 转义（防止 XSS）
 * @param {string} text - 待转义文本
 * @returns {string} 转义后的文本
 */
export function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
    };
    
    return text.replace(/[&<>"'/]/g, char => map[char]);
}

/**
 * 从 Cookie 中提取 Token
 * @param {string} cookieHeader - Cookie 头字符串
 * @param {string} tokenName - Token 名称
 * @returns {string|null} Token 值
 */
export function extractTokenFromCookie(cookieHeader, tokenName = 'auth_token') {
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const cookie of cookies) {
        const [name, value] = cookie.split('=');
        if (name === tokenName) {
            return value;
        }
    }
    return null;
}
