import logger from '../utils/logger.js';

export class IPCManager {
    constructor() {
        this.workerProcess = null;
        this.messageHandlers = new Map();
        this.pendingRequests = new Map();
        this.requestIdCounter = 0;
        this.heartbeatInterval = null;
        this.heartbeatTimeout = 60000;
        this.lastHeartbeatTime = 0;
        this.heartbeatFailureCount = 0;
        this.maxHeartbeatFailures = 3;
        this.onWorkerDisconnect = null;
        this.onHeartbeatTimeout = null;
    }

    registerMessageHandler(messageType, handler) {
        if (!this.messageHandlers.has(messageType)) {
            this.messageHandlers.set(messageType, []);
        }
        this.messageHandlers.get(messageType).push(handler);
        logger.info(`[IPCManager] Registered handler for message type: ${messageType}`);
    }

    unregisterMessageHandler(messageType, handler) {
        const handlers = this.messageHandlers.get(messageType);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
                logger.info(`[IPCManager] Unregistered handler for message type: ${messageType}`);
            }
        }
    }

    setWorkerProcess(worker) {
        if (this.workerProcess) {
            this._cleanupWorker();
        }

        this.workerProcess = worker;
        this.lastHeartbeatTime = Date.now();
        this.heartbeatFailureCount = 0;

        worker.on('message', (message) => {
            this._handleMessage(message);
        });

        worker.on('exit', (code, signal) => {
            logger.info(`[IPCManager] Worker process exited with code ${code}, signal ${signal}`);
            this._cleanupWorker();
            if (this.onWorkerDisconnect) {
                this.onWorkerDisconnect(code, signal);
            }
        });

        worker.on('error', (error) => {
            logger.error('[IPCManager] Worker process error:', error.message);
        });

        this._startHeartbeat();
        logger.info('[IPCManager] Worker process attached');
    }

    _cleanupWorker() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        this.workerProcess = null;
        this.pendingRequests.forEach(({ reject }) => {
            reject(new Error('Worker disconnected'));
        });
        this.pendingRequests.clear();
    }

    _startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(() => {
            if (!this.workerProcess) {
                return;
            }

            const now = Date.now();
            if (now - this.lastHeartbeatTime > this.heartbeatTimeout) {
                this.heartbeatFailureCount++;
                logger.warn(`[IPCManager] Heartbeat timeout, failure count: ${this.heartbeatFailureCount}`);

                if (this.heartbeatFailureCount >= this.maxHeartbeatFailures) {
                    logger.error('[IPCManager] Max heartbeat failures reached');
                    if (this.onHeartbeatTimeout) {
                        this.onHeartbeatTimeout();
                    }
                }
            }

            try {
                this.send({ type: 'heartbeat', timestamp: now });
            } catch (error) {
                logger.error('[IPCManager] Failed to send heartbeat:', error.message);
            }
        }, this.heartbeatTimeout / 2);
    }

    _handleMessage(message) {
        if (!message || !message.type) {
            logger.warn('[IPCManager] Invalid message received');
            return;
        }

        if (message.type === 'heartbeat_response') {
            this.lastHeartbeatTime = Date.now();
            this.heartbeatFailureCount = 0;
            return;
        }

        if (message.type === 'response' && message.requestId) {
            const pending = this.pendingRequests.get(message.requestId);
            if (pending) {
                this.pendingRequests.delete(message.requestId);
                if (message.error) {
                    pending.reject(new Error(message.error));
                } else {
                    pending.resolve(message.data);
                }
            }
            return;
        }

        const handlers = this.messageHandlers.get(message.type);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(message);
                } catch (error) {
                    logger.error(`[IPCManager] Error in handler for ${message.type}:`, error.message);
                }
            });
        } else {
            logger.warn(`[IPCManager] No handler registered for message type: ${message.type}`);
        }
    }

    send(message) {
        if (!this.workerProcess) {
            throw new Error('No worker process attached');
        }

        if (typeof message !== 'object' || message === null) {
            throw new Error('Message must be an object');
        }

        message.timestamp = message.timestamp || Date.now();
        this.workerProcess.send(message);
    }

    async sendRequest(message, timeout = 30000) {
        if (!this.workerProcess) {
            throw new Error('No worker process attached');
        }

        const requestId = `req_${++this.requestIdCounter}_${Date.now()}`;
        const requestMessage = {
            ...message,
            type: message.type || 'request',
            requestId,
            timestamp: Date.now()
        };

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('Request timeout'));
            }, timeout);

            this.pendingRequests.set(requestId, {
                resolve: (data) => {
                    clearTimeout(timeoutId);
                    resolve(data);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });

            try {
                this.workerProcess.send(requestMessage);
            } catch (error) {
                clearTimeout(timeoutId);
                this.pendingRequests.delete(requestId);
                reject(error);
            }
        });
    }

    getStats() {
        return {
            workerConnected: this.workerProcess !== null,
            pendingRequests: this.pendingRequests.size,
            registeredHandlers: this.messageHandlers.size,
            heartbeatFailureCount: this.heartbeatFailureCount,
            lastHeartbeatTime: this.lastHeartbeatTime,
            requestIdCounter: this.requestIdCounter
        };
    }

    destroy() {
        this._cleanupWorker();
        this.messageHandlers.clear();
        logger.info('[IPCManager] Destroyed');
    }
}

const ipcManager = new IPCManager();

export function getIPCManager() {
    return ipcManager;
}

export function initializeIPCManager() {
    return ipcManager;
}