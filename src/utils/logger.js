import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

class Logger {
    constructor() {
        this.config = {
            enabled: true,
            outputMode: 'all',
            logDir: 'logs',
            logLevel: 'info',
            includeRequestId: true,
            includeTimestamp: true,
            maxFileSize: 10 * 1024 * 1024,
            maxFiles: 10,
            flushInterval: 1000,
            bufferSize: 100
        };
        this.currentLogFile = null;
        this.logStream = null;
        this.asyncStorage = new AsyncLocalStorage();
        this.requestContext = new Map();
        this.contextTTL = 5 * 60 * 1000;
        this._contextCleanupTimer = null;
        this._flushTimer = null;
        this._writeBuffer = [];
        this._isFlushing = false;
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };
    }

    async initialize(config = {}) {
        this.config = { ...this.config, ...config };
        
        if (this.config.outputMode === 'none') {
            this.config.enabled = false;
            return;
        }

        if (this.config.outputMode === 'file' || this.config.outputMode === 'all') {
            await this.initializeFileLogging();
            this._startFlushTimer();
        }
    }

    async initializeFileLogging() {
        try {
            if (!await this._exists(this.config.logDir)) {
                await fsPromises.mkdir(this.config.logDir, { recursive: true });
            }

            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            this.currentLogFile = path.join(this.config.logDir, `app-${dateStr}.log`);

            this.logStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
            
            this.logStream.on('error', (err) => {
                console.error('[Logger] Failed to write to log file:', err.message);
            });
        } catch (error) {
            console.error('[Logger] Failed to initialize file logging:', error.message);
        }
    }

    _startFlushTimer() {
        if (this._flushTimer) return;
        this._flushTimer = setInterval(() => {
            this._flushBuffer().catch(err => {
                console.error('[Logger] Failed to flush buffer:', err.message);
            });
        }, this.config.flushInterval);
        if (this._flushTimer.unref) {
            this._flushTimer.unref();
        }
    }

    async _flushBuffer() {
        if (this._isFlushing || this._writeBuffer.length === 0) return;
        
        this._isFlushing = true;
        const buffer = [...this._writeBuffer];
        this._writeBuffer = [];
        
        try {
            if (this.logStream && !this.logStream.destroyed && this.logStream.writable) {
                await this._checkAndRotateLogFile();
                const data = buffer.join('');
                await new Promise((resolve, reject) => {
                    this.logStream.write(data, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }
        } catch (err) {
            console.error('[Logger] Failed to write buffered logs:', err.message);
            this._writeBuffer = [...buffer, ...this._writeBuffer];
        } finally {
            this._isFlushing = false;
        }
    }

    _exists(path) {
        return new Promise(resolve => {
            fs.access(path, fs.constants.F_OK, err => {
                resolve(!err);
            });
        });
    }

    runWithContext(requestId, callback) {
        if (!requestId) {
            requestId = randomUUID().substring(0, 8);
        }
        this.requestContext.set(requestId, { _createdAt: Date.now() });
        this._ensureContextCleanup();
        return this.asyncStorage.run(requestId, callback);
    }

    setRequestContext(requestId, context = {}) {
        if (!requestId) {
            requestId = randomUUID().substring(0, 8);
        }
        this.asyncStorage.enterWith(requestId);
        this.requestContext.set(requestId, { ...context, _createdAt: Date.now() });
        this._ensureContextCleanup();
        return requestId;
    }

    getCurrentRequestId() {
        return this.asyncStorage.getStore();
    }

    getRequestContext(requestId) {
        if (!requestId) {
            requestId = this.getCurrentRequestId();
        }
        return this.requestContext.get(requestId) || {};
    }

    clearRequestContext(requestId) {
        if (requestId) {
            this.requestContext.delete(requestId);
        }
    }

    _ensureContextCleanup() {
        if (this._contextCleanupTimer) return;
        this._contextCleanupTimer = setInterval(() => {
            const now = Date.now();
            let cleaned = 0;
            for (const [id, ctx] of this.requestContext) {
                if (now - (ctx._createdAt || 0) > this.contextTTL) {
                    this.requestContext.delete(id);
                    cleaned++;
                }
            }
            if (cleaned > 0) {
                this.log('warn', [`[Logger] Cleaned ${cleaned} stale request context(s) (TTL: ${this.contextTTL}ms)`]);
            }
            if (this.requestContext.size === 0) {
                clearInterval(this._contextCleanupTimer);
                this._contextCleanupTimer = null;
            }
        }, 60_000);
        if (this._contextCleanupTimer.unref) {
            this._contextCleanupTimer.unref();
        }
    }

    formatMessage(level, args, requestId) {
        const parts = [];

        if (this.config.includeTimestamp) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const ms = String(now.getMilliseconds()).padStart(3, '0');
            const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
            parts.push(`[${timestamp}]`);
        }

        if (this.config.includeRequestId && requestId) {
            parts.push(`[Req:${requestId}]`);
        }

        parts.push(`[${level.toUpperCase()}]`);

        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, this._getCircularReplacer(), 2);
                } catch (e) {
                    return this._formatErrorObject(arg);
                }
            }
            return String(arg);
        }).join(' ');

        parts.push(message);

        return parts.join(' ');
    }

    _getCircularReplacer() {
        const seen = new WeakSet();
        return (key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                    return '[Circular Reference]';
                }
                seen.add(value);
            }
            return value;
        };
    }

    _formatErrorObject(error) {
        if (error instanceof Error) {
            const errorInfo = {
                name: error.name,
                message: error.message,
                code: error.code,
                status: error.status,
                stack: error.stack ? error.stack.split('\n').slice(0, 5).join('\n') : undefined
            };
            return JSON.stringify(errorInfo, null, 2);
        }
        try {
            return JSON.stringify(error, this._getCircularReplacer(), 2);
        } catch {
            return String(error);
        }
    }

    shouldLog(level) {
        if (!this.config.enabled) return false;
        const currentLevel = this.levels[this.config.logLevel] ?? 1;
        const targetLevel = this.levels[level] ?? 1;
        return targetLevel >= currentLevel;
    }

    async _checkAndRotateLogFile() {
        try {
            if (!this.currentLogFile || !await this._exists(this.currentLogFile)) {
                return;
            }

            const stats = await fsPromises.stat(this.currentLogFile);
            if (stats.size >= this.config.maxFileSize) {
                if (this.logStream && !this.logStream.destroyed) {
                    await new Promise(resolve => {
                        this.logStream.end(resolve);
                    });
                }

                const timestamp = new Date().getTime();
                const ext = path.extname(this.currentLogFile);
                const basename = path.basename(this.currentLogFile, ext);
                const newName = path.join(this.config.logDir, `${basename}-${timestamp}${ext}`);
                await fsPromises.rename(this.currentLogFile, newName);

                this.logStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
                this.logStream.on('error', (err) => {
                    console.error('[Logger] Failed to write to log file:', err.message);
                });

                await this.cleanupOldLogs();
            }
        } catch (error) {
            console.error('[Logger] Failed to rotate log file:', error.message);
        }
    }

    log(level, args, requestId = null) {
        if (!this.shouldLog(level)) return;

        const message = this.formatMessage(level, args, requestId);

        if (this.config.outputMode === 'console' || this.config.outputMode === 'all') {
            const consoleMethod = level === 'error' ? console.error :
                                  level === 'warn' ? console.warn :
                                  level === 'debug' ? console.debug : console.log;
            consoleMethod(message);
        }

        if (this.config.outputMode === 'file' || this.config.outputMode === 'all') {
            this._writeBuffer.push(message + '\n');
            if (this._writeBuffer.length >= this.config.bufferSize) {
                this._flushBuffer().catch(err => {
                    console.error('[Logger] Failed to flush buffer:', err.message);
                });
            }
        }
    }

    debug(...args) {
        const requestId = this.getCurrentRequestId();
        this.log('debug', args, requestId);
    }

    info(...args) {
        const requestId = this.getCurrentRequestId();
        this.log('info', args, requestId);
    }

    warn(...args) {
        const requestId = this.getCurrentRequestId();
        this.log('warn', args, requestId);
    }

    error(...args) {
        const requestId = this.getCurrentRequestId();
        this.log('error', args, requestId);
    }

    withRequest(requestId) {
        if (!requestId) {
            requestId = this.getCurrentRequestId();
        }

        return {
            debug: (...args) => this.log('debug', args, requestId),
            info: (...args) => this.log('info', args, requestId),
            warn: (...args) => this.log('warn', args, requestId),
            error: (...args) => this.log('error', args, requestId)
        };
    }

    async close() {
        if (this._flushTimer) {
            clearInterval(this._flushTimer);
            this._flushTimer = null;
        }
        if (this._contextCleanupTimer) {
            clearInterval(this._contextCleanupTimer);
            this._contextCleanupTimer = null;
        }
        await this._flushBuffer();
        if (this.logStream && !this.logStream.destroyed) {
            await new Promise(resolve => {
                this.logStream.end(resolve);
            });
            this.logStream = null;
        }
    }

    async cleanupOldLogs() {
        try {
            if (!await this._exists(this.config.logDir)) {
                return;
            }

            const fileNames = await fsPromises.readdir(this.config.logDir);
            const files = [];

            for (const fileName of fileNames) {
                if (fileName.startsWith('app-') && fileName.endsWith('.log')) {
                    const filePath = path.join(this.config.logDir, fileName);
                    try {
                        const stats = await fsPromises.stat(filePath);
                        files.push({
                            name: fileName,
                            path: filePath,
                            time: stats.mtime.getTime()
                        });
                    } catch {
                        continue;
                    }
                }
            }

            files.sort((a, b) => b.time - a.time);

            if (files.length > this.config.maxFiles) {
                const filesToDelete = files.slice(this.config.maxFiles);
                for (const file of filesToDelete) {
                    try {
                        await fsPromises.unlink(file.path);
                    } catch (err) {
                        console.error('[Logger] Failed to delete old log file:', file.name, err.message);
                    }
                }
            }
        } catch (error) {
            console.error('[Logger] Failed to cleanup old logs:', error.message);
        }
    }

    async clearTodayLog() {
        try {
            if (!this.currentLogFile || !await this._exists(this.currentLogFile)) {
                console.warn('[Logger] No current log file to clear');
                return false;
            }

            if (this.logStream && !this.logStream.destroyed) {
                await new Promise(resolve => {
                    this.logStream.end(resolve);
                });
            }

            await fsPromises.writeFile(this.currentLogFile, '');

            this.logStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
            this.logStream.on('error', (err) => {
                console.error('[Logger] Failed to write to log file:', err.message);
            });

            console.log('[Logger] Today\'s log file cleared successfully');
            return true;
        } catch (error) {
            console.error('[Logger] Failed to clear today\'s log file:', error.message);
            return false;
        }
    }
}

const logger = new Logger();

export default logger;
export { Logger };