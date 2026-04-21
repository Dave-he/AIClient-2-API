import { existsSync } from 'fs';
import logger from '../utils/logger.js';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CONFIG } from '../core/config-manager.js';
import { getClientIp } from '../utils/common.js';
import { PASSWORD } from '../utils/constants.js';
import { csrfManager, validatePath, validateOrigin, generateCookieConfig } from '../utils/security.js';

// Token存储到本地文件中
const TOKEN_STORE_FILE = path.join(process.cwd(), 'configs', 'token-store.json');

/**
 * 默认密码（当pwd文件不存在时使用）
 */
const DEFAULT_PASSWORD = 'admin123';

/**
 * 读取密码文件内容
 * 如果文件不存在或读取失败，返回默认密码
 */
export async function readPasswordFile() {
    const pwdFilePath = path.join(process.cwd(), 'configs', 'pwd');
    try {
        // 使用异步方式检查文件是否存在并读取，避免竞态条件
        const password = await fs.readFile(pwdFilePath, 'utf8');
        const trimmedPassword = password.trim();
        // 如果密码文件为空，使用默认密码
        if (!trimmedPassword) {
            logger.info('[Auth] Password file is empty, using default password: ' + DEFAULT_PASSWORD);
            return DEFAULT_PASSWORD;
        }
        logger.info('[Auth] Successfully read password file');
        return trimmedPassword;
    } catch (error) {
        // ENOENT means file does not exist, which is normal
        if (error.code === 'ENOENT') {
            logger.info('[Auth] Password file does not exist, using default password: ' + DEFAULT_PASSWORD);
        } else {
            logger.error('[Auth] Failed to read password file:', error.code || error.message);
            logger.info('[Auth] Using default password: ' + DEFAULT_PASSWORD);
        }
        return DEFAULT_PASSWORD;
    }
}

/**
 * 验证登录凭据
 */
export async function validateCredentials(password) {
    const storedPassword = await readPasswordFile();
    if (!storedPassword || !password) return false;

    // 新格式：pbkdf2:salt:hash
    if (storedPassword.startsWith('pbkdf2:')) {
        const parts = storedPassword.split(':');
        if (parts.length !== 3) return false;
        const [, salt, storedHash] = parts;
        const inputHash = await new Promise((resolve, reject) =>
            crypto.pbkdf2(password.trim(), salt, PASSWORD.PBKDF2_ITERATIONS, PASSWORD.PBKDF2_KEYLEN, PASSWORD.PBKDF2_DIGEST, (err, key) =>
                err ? reject(err) : resolve(key.toString('hex'))
            )
        );
        return crypto.timingSafeEqual(Buffer.from(inputHash, 'hex'), Buffer.from(storedHash, 'hex'));
    }

    // 旧格式：明文（兼容迁移期，建议通过 UI 重新设置密码以升级为哈希格式）
    // 使用 timingSafeEqual 防止时序攻击
    const a = Buffer.from(password.trim());
    const b = Buffer.from(storedPassword);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

/**
 * 解析请求体JSON
 */
function parseRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                if (!body.trim()) {
                    resolve({});
                } else {
                    resolve(JSON.parse(body));
                }
            } catch (error) {
                reject(new Error('Invalid JSON format'));
            }
        });
        req.on('error', reject);
    });
}

/**
 * 生成简单的token
 */
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

 /**
 * 生成token过期时间
 */
function getExpiryTime() {
    const now = Date.now();
    const expiry = (CONFIG.LOGIN_EXPIRY || 3600) * 1000; // 使用配置的过期时间，默认1小时
    return now + expiry;
}


/**
 * 读取token存储文件
 */
async function readTokenStore() {
    try {
        if (existsSync(TOKEN_STORE_FILE)) {
            const content = await fs.readFile(TOKEN_STORE_FILE, 'utf8');
            if (!content.trim()) {
                await writeTokenStore({ tokens: {} });
                return { tokens: {} };
            }
            return JSON.parse(content);
        } else {
            await writeTokenStore({ tokens: {} });
            return { tokens: {} };
        }
    } catch (error) {
        logger.error('[Token Store] Failed to read token store file:', error);
        await writeTokenStore({ tokens: {} });
        return { tokens: {} };
    }
}

/**
 * 写入token存储文件
 */
async function writeTokenStore(tokenStore) {
    try {
        const content = JSON.stringify(tokenStore, null, 2);
        const tempFile = TOKEN_STORE_FILE + '.tmp';
        
        await fs.writeFile(tempFile, content, 'utf8');
        
        try {
            await fs.rename(tempFile, TOKEN_STORE_FILE);
        } catch (renameError) {
            if (renameError.code === 'ENOENT') {
                await fs.writeFile(TOKEN_STORE_FILE, content, 'utf8');
                await fs.unlink(tempFile).catch(() => {});
            } else {
                throw renameError;
            }
        }
    } catch (error) {
        logger.error('[Token Store] Failed to write token store file:', error);
    }
}

/**
 * 验证简单token
 */
export async function verifyToken(token) {
    const tokenStore = await readTokenStore();
    const tokenInfo = tokenStore.tokens[token];
    if (!tokenInfo) {
        return null;
    }
    
    // 检查是否过期
    if (Date.now() > tokenInfo.expiryTime) {
        await deleteToken(token);
        return null;
    }
    
    return tokenInfo;
}

/**
 * 保存token到本地文件
 */
async function saveToken(token, tokenInfo) {
    const tokenStore = await readTokenStore();
    tokenStore.tokens[token] = tokenInfo;
    await writeTokenStore(tokenStore);
}

/**
 * 删除token
 */
async function deleteToken(token) {
    const tokenStore = await readTokenStore();
    if (tokenStore.tokens[token]) {
        delete tokenStore.tokens[token];
        await writeTokenStore(tokenStore);
    }
}

/**
 * 管理登录尝试频率和锁定
 */
class LoginAttemptManager {
    constructor() {
        this.attempts = new Map(); // IP -> { count, lastAttempt, lockoutUntil }
    }

    /**
     * 获取 IP 的状态
     */
    getIpStatus(ip) {
        if (!this.attempts.has(ip)) {
            this.attempts.set(ip, { count: 0, lastAttempt: 0, lockoutUntil: 0 });
        }
        return this.attempts.get(ip);
    }

    /**
     * 检查是否被锁定
     */
    isLockedOut(ip) {
        const status = this.getIpStatus(ip);
        if (status.lockoutUntil > Date.now()) {
            return {
                locked: true,
                remainingTime: Math.ceil((status.lockoutUntil - Date.now()) / 1000)
            };
        }
        // 如果锁定时间已过，重置失败次数
        if (status.lockoutUntil > 0 && status.lockoutUntil <= Date.now()) {
            status.count = 0;
            status.lockoutUntil = 0;
        }
        return { locked: false };
    }

    /**
     * 检查是否请求过于频繁
     */
    isTooFrequent(ip) {
        const status = this.getIpStatus(ip);
        const minInterval = CONFIG.LOGIN_MIN_INTERVAL || 1000;
        const now = Date.now();
        if (now - status.lastAttempt < minInterval) {
            return true;
        }
        status.lastAttempt = now;
        return false;
    }

    /**
     * 记录一次失败
     */
    recordFailure(ip) {
        const status = this.getIpStatus(ip);
        status.count++;
        const maxAttempts = CONFIG.LOGIN_MAX_ATTEMPTS || 5;
        const lockoutDuration = (CONFIG.LOGIN_LOCKOUT_DURATION || 1800) * 1000;

        if (status.count >= maxAttempts) {
            status.lockoutUntil = Date.now() + lockoutDuration;
            logger.warn(`[Auth] IP ${ip} locked out due to too many failed login attempts (${status.count})`);
            return true;
        }
        return false;
    }

    /**
     * 成功后重置
     */
    reset(ip) {
        this.attempts.delete(ip);
    }
}

const loginAttemptManager = new LoginAttemptManager();

/**
 * 清理过期的token
 */
export async function cleanupExpiredTokens() {
    const tokenStore = await readTokenStore();
    const now = Date.now();
    let hasChanges = false;
    
    for (const token in tokenStore.tokens) {
        if (now > tokenStore.tokens[token].expiryTime) {
            delete tokenStore.tokens[token];
            hasChanges = true;
        }
    }
    
    if (hasChanges) {
        await writeTokenStore(tokenStore);
    }
}

/**
 * 检查token验证（同时支持 Header 和 Cookie）
 */
export async function checkAuth(req) {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }

    if (!token) {
        const cookieHeader = req.headers.cookie;
        if (cookieHeader) {
            const cookies = cookieHeader.split(';').map(c => c.trim());
            for (const cookie of cookies) {
                const [name, value] = cookie.split('=');
                if (name === 'auth_token') {
                    token = value;
                    break;
                }
            }
        }
    }

    if (!token) {
        return false;
    }

    const tokenInfo = await verifyToken(token);

    return tokenInfo !== null;
}

/**
 * 获取 CSRF Token
 */
export async function handleGetCsrfToken(req, res) {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }

    if (!token) {
        const cookieHeader = req.headers.cookie;
        if (cookieHeader) {
            const cookies = cookieHeader.split(';').map(c => c.trim());
            for (const cookie of cookies) {
                const [name, value] = cookie.split('=');
                if (name === 'auth_token') {
                    token = value;
                    break;
                }
            }
        }
    }

    if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'No authentication token provided'
        }));
        return true;
    }

    const tokenInfo = await verifyToken(token);
    if (!tokenInfo) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'Invalid or expired token'
        }));
        return true;
    }

    const csrfToken = csrfManager.generateToken(token);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        success: true,
        csrfToken
    }));
    return true;
}

/**
 * 验证登录Token有效性（供前端检查登录状态使用）
 * 同时支持 Authorization Header 和 Cookie 中的 Token
 */
export async function handleValidateToken(req, res) {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }

    if (!token) {
        const cookieHeader = req.headers.cookie;
        if (cookieHeader) {
            const cookies = cookieHeader.split(';').map(c => c.trim());
            for (const cookie of cookies) {
                const [name, value] = cookie.split('=');
                if (name === 'auth_token') {
                    token = value;
                    break;
                }
            }
        }
    }

    if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: false, message: 'No token provided' }));
        return true;
    }

    const tokenInfo = await verifyToken(token);

    if (tokenInfo) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: true, message: 'Token is valid' }));
    } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: false, message: 'Token is invalid or expired' }));
    }
    return true;
}

/**
 * 处理登录请求
 */
export async function handleLoginRequest(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: false, 
            message: 'Only POST requests are supported',
            messageCode: 'login.error.postOnly'
        }));
        return true;
    }

    const ip = getClientIp(req);
    
    // 1. 验证请求来源 (CSRF 防护)
    if (!validateOrigin(req)) {
        logger.warn(`[Auth] Invalid origin from IP: ${ip}`);
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'Invalid origin',
            messageCode: 'login.error.invalidOrigin'
        }));
        return true;
    }

    // 2. 验证 CSRF Token (如果请求头中有)
    const csrfToken = req.headers['x-csrf-token'];
    const sessionId = req.headers['x-session-id'];
    if (sessionId && csrfToken && !csrfManager.validateToken(sessionId, csrfToken)) {
        logger.warn(`[Auth] Invalid CSRF token from IP: ${ip}`);
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'Invalid CSRF token',
            messageCode: 'login.error.invalidCsrf'
        }));
        return true;
    }

    // 3. 检查锁定状态
    const lockout = loginAttemptManager.isLockedOut(ip);
    if (lockout.locked) {
        logger.warn(`[Auth] Login attempt from locked IP: ${ip}, reason: account_locked, remaining: ${lockout.remainingTime}s`);
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: `Account temporarily locked due to too many failed attempts. Please try again in ${lockout.remainingTime} seconds.`,
            messageCode: 'login.error.locked',
            messageParams: { time: lockout.remainingTime }
        }));
        return true;
    }

    // 4. 频率限制
    if (loginAttemptManager.isTooFrequent(ip)) {
        logger.warn(`[Auth] Login attempt too frequent from IP: ${ip}, reason: rate_limit`);
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'Too many requests, please slow down.',
            messageCode: 'login.error.tooFrequent'
        }));
        return true;
    }

    try {
        const requestData = await parseRequestBody(req);
        const { password } = requestData;
        
        if (!password) {
            logger.warn(`[Auth] Login failed from IP: ${ip}, reason: empty_password`);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: false, 
                message: 'Password cannot be empty',
                messageCode: 'login.error.empty'
            }));
            return true;
        }

        const isValid = await validateCredentials(password);
        
        if (isValid) {
            logger.info(`[Auth] Login successful from IP: ${ip}`);
            loginAttemptManager.reset(ip);

            const token = generateToken();
            const loginExpiry = CONFIG.LOGIN_EXPIRY || 3600;
            const expiryTime = Date.now() + (loginExpiry * 1000);
            const rememberMe = requestData.rememberMe === true;

            await saveToken(token, {
                username: 'admin',
                loginTime: Date.now(),
                expiryTime,
                userAgent: req.headers['user-agent'],
                ip: ip
            });

            const csrfToken = csrfManager.generateToken(token);
            const isProduction = process.env.NODE_ENV === 'production';

            res.setHeader('Set-Cookie', [
                `auth_token=${token}; ${generateCookieConfig(rememberMe, isProduction)}`,
                `csrf_token=${csrfToken}; Path=/; SameSite=Strict${isProduction ? '; Secure' : ''}`
            ]);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Login successful',
                expiresIn: `${loginExpiry} seconds`,
                csrfToken
            }));
        } else {
            // 登录失败，记录
            const isLocked = loginAttemptManager.recordFailure(ip);
            const status = loginAttemptManager.getIpStatus(ip);
            const maxAttempts = CONFIG.LOGIN_MAX_ATTEMPTS || 5;
            const remaining = maxAttempts - status.count;
            const lockoutDuration = CONFIG.LOGIN_LOCKOUT_DURATION || 1800;

            logger.warn(`[Auth] Login failed from IP: ${ip}, reason: incorrect_password, remaining_attempts: ${Math.max(0, remaining)}${isLocked ? ', result: locked' : ''}`);

            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: isLocked 
                    ? `Incorrect password. Account locked for ${Math.ceil(lockoutDuration / 60)} minutes.` 
                    : `Incorrect password. ${remaining} attempts remaining.`,
                messageCode: isLocked ? 'login.error.incorrectWithLock' : 'login.error.incorrectWithRemaining',
                messageParams: isLocked ? { time: Math.ceil(lockoutDuration / 60) } : { count: remaining }
            }));
        }

    } catch (error) {
        logger.error('[Auth] Login processing error:', error);
        const isJsonError = error.message === 'Invalid JSON format';
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: error.message || 'Server error',
            messageCode: isJsonError ? 'login.error.invalidJson' : undefined
        }));
    }
    return true;
}

// 定时清理过期token
setInterval(cleanupExpiredTokens, 5 * 60 * 1000); // 每5分钟清理一次


