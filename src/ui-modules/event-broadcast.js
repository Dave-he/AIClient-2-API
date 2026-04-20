import { promises as fs } from 'fs';
import path from 'path';
import multer from 'multer';
import logger from '../utils/logger.js';

const TOKEN_STORE_FILE = path.join(process.cwd(), 'configs', 'token-store.json');
const USAGE_CACHE_FILE = path.join(process.cwd(), 'configs', 'usage-cache.json');

export class EventBroadcaster {
    constructor(options = {}) {
        this.clients = new Set();
        this.logBuffer = [];
        this.maxLogBufferSize = options.maxLogBufferSize || 100;
        this.keepAliveInterval = options.keepAliveInterval || 30000;
        this.maxQueuedMessages = options.maxQueuedMessages || 100;
        this.messageQueue = [];
        this.isProcessingQueue = false;
        this.originalLog = console.log;
        this.originalError = console.error;
        this.enabled = true;
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }

    addClient(response) {
        if (!this.enabled) return;
        
        const clientId = Symbol('client');
        const client = {
            id: clientId,
            response,
            lastActivity: Date.now(),
            keepAliveTimer: null
        };

        this.clients.add(client);

        client.keepAliveTimer = setInterval(() => {
            if (!response.writableEnded && !response.destroyed) {
                try {
                    response.write(':\n\n');
                    client.lastActivity = Date.now();
                } catch (err) {
                    logger.error('[EventBroadcaster] Failed to write keepalive:', err.message);
                    this.removeClient(client);
                }
            } else {
                this.removeClient(client);
            }
        }, this.keepAliveInterval);

        logger.info(`[EventBroadcaster] Client connected, total: ${this.clients.size}`);
        return clientId;
    }

    removeClient(client) {
        if (typeof client === 'symbol') {
            client = [...this.clients].find(c => c.id === client);
        }
        if (!client) return;

        if (client.keepAliveTimer) {
            clearInterval(client.keepAliveTimer);
        }
        this.clients.delete(client);
        
        logger.info(`[EventBroadcaster] Client disconnected, total: ${this.clients.size}`);
    }

    broadcast(eventType, data) {
        if (!this.enabled) return;

        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        const message = `event: ${eventType}\ndata: ${payload}\n\n`;

        this.messageQueue.push({ eventType, data, message });
        if (this.messageQueue.length > this.maxQueuedMessages) {
            this.messageQueue.shift();
        }

        this.processQueue();
    }

    async processQueue() {
        if (this.isProcessingQueue || this.messageQueue.length === 0) return;

        this.isProcessingQueue = true;
        try {
            while (this.messageQueue.length > 0) {
                const item = this.messageQueue.shift();
                await this._broadcastToClients(item.message);
            }
        } finally {
            this.isProcessingQueue = false;
        }
    }

    async _broadcastToClients(message) {
        const disconnected = [];
        
        for (const client of this.clients) {
            try {
                if (!client.response.writableEnded && !client.response.destroyed) {
                    client.response.write(message);
                    client.lastActivity = Date.now();
                } else {
                    disconnected.push(client);
                }
            } catch (err) {
                logger.error('[EventBroadcaster] Failed to broadcast to client:', err.message);
                disconnected.push(client);
            }
        }

        for (const client of disconnected) {
            this.removeClient(client);
        }
    }

    addLogEntry(level, ...args) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message: args.map(arg => {
                if (typeof arg === 'string') return arg;
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return String(arg);
                }
            }).join(' ')
        };

        this.logBuffer.push(logEntry);
        if (this.logBuffer.length > this.maxLogBufferSize) {
            this.logBuffer.shift();
        }

        this.broadcast('log', logEntry);
    }

    setupConsoleOverride() {
        const self = this;

        console.log = function(...args) {
            self.originalLog.apply(console, args);
            self.addLogEntry('info', ...args);
        };

        console.error = function(...args) {
            self.originalError.apply(console, args);
            self.addLogEntry('error', ...args);
        };
    }

    restoreConsole() {
        console.log = this.originalLog;
        console.error = this.originalError;
    }

    getLogBuffer(count = this.maxLogBufferSize) {
        return [...this.logBuffer].slice(-count);
    }

    getStats() {
        return {
            clientCount: this.clients.size,
            logBufferSize: this.logBuffer.length,
            queuedMessages: this.messageQueue.length,
            enabled: this.enabled
        };
    }

    clearLogBuffer() {
        this.logBuffer = [];
    }

    closeAllConnections() {
        for (const client of this.clients) {
            if (client.keepAliveTimer) {
                clearInterval(client.keepAliveTimer);
            }
            try {
                if (!client.response.writableEnded) {
                    client.response.end();
                }
            } catch (err) {
                logger.error('[EventBroadcaster] Error closing connection:', err.message);
            }
        }
        this.clients.clear();
        logger.info('[EventBroadcaster] All connections closed');
    }
}

const eventBroadcaster = new EventBroadcaster();

export function broadcastEvent(eventType, data) {
    eventBroadcaster.broadcast(eventType, data);
}

export async function handleEvents(req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    try {
        res.write('\n');
    } catch (err) {
        logger.error('[EventBroadcaster] Failed to write initial data:', err.message);
        return true;
    }

    const clientId = eventBroadcaster.addClient(res);

    req.on('close', () => {
        eventBroadcaster.removeClient(clientId);
    });

    return true;
}

export function initializeUIManagement() {
    eventBroadcaster.setupConsoleOverride();
    logger.info('[EventBroadcaster] UI management initialized');
}

export function getEventBroadcaster() {
    return eventBroadcaster;
}

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            const uploadPath = path.join(process.cwd(), 'configs', 'temp');
            await fs.mkdir(uploadPath, { recursive: true });
            cb(null, uploadPath);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${timestamp}_${sanitizedName}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['.json', '.txt', '.key', '.pem', '.p12', '.pfx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Unsupported file type'), false);
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

export function handleUploadOAuthCredentials(req, res, options = {}) {
    const {
        providerMap = {},
        logPrefix = '[UI API]',
        userInfo = '',
        customUpload = null
    } = options;

    const uploadMiddleware = customUpload ? customUpload.single('file') : upload.single('file');

    return new Promise((resolve) => {
        uploadMiddleware(req, res, async (err) => {
            if (err) {
                logger.error(`${logPrefix} File upload error:`, err.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: {
                        message: err.message || 'File upload failed'
                    }
                }));
                resolve(true);
                return;
            }

            try {
                if (!req.file) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: {
                            message: 'No file was uploaded'
                        }
                    }));
                    resolve(true);
                    return;
                }

                const providerType = req.body.provider || 'common';
                const provider = providerMap[providerType] || providerType;
                const tempFilePath = req.file.path;

                let targetDir = path.join(process.cwd(), 'configs', provider);

                if (provider === 'kiro') {
                    const timestamp = Date.now();
                    const originalNameWithoutExt = path.parse(req.file.originalname).name;
                    const subFolder = `${timestamp}_${originalNameWithoutExt}`;
                    targetDir = path.join(targetDir, subFolder);
                }

                await fs.mkdir(targetDir, { recursive: true });

                const targetFilePath = path.join(targetDir, req.file.filename);
                await fs.rename(tempFilePath, targetFilePath);

                const relativePath = path.relative(process.cwd(), targetFilePath);

                broadcastEvent('config_update', {
                    action: 'add',
                    filePath: relativePath,
                    provider: provider,
                    timestamp: new Date().toISOString()
                });

                const userInfoStr = userInfo ? `, ${userInfo}` : '';
                logger.info(`${logPrefix} OAuth credentials file uploaded: ${targetFilePath} (provider: ${provider}${userInfoStr})`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'File uploaded successfully',
                    filePath: relativePath,
                    originalName: req.file.originalname,
                    provider: provider
                }));
                resolve(true);

            } catch (error) {
                logger.error(`${logPrefix} File upload processing error:`, error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: {
                        message: 'File upload processing failed: ' + error.message
                    }
                }));
                resolve(true);
            }
        });
    });
}