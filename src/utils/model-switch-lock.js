import logger from '../utils/logger.js';
import { callPythonControllerRaw } from '../utils/python-controller.js';

const LOCK_KEY = 'model_switch_lock';
const LOCK_EXPIRE_MS = 300000;
const POLL_INTERVAL_MS = 5000;

let isSwitching = false;
let switchTask = null;
let switchModelName = null;

let redisClient = null;

async function getRedisClient() {
    if (redisClient) return redisClient;
    
    try {
        const redisModule = await import('redis');
        redisClient = redisModule.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });
        
        redisClient.on('error', (err) => {
            logger.warn('[Model Switch] Redis error (using fallback):', err.message);
        });
        
        await redisClient.connect();
        logger.info('[Model Switch] Redis connected');
        return redisClient;
    } catch (error) {
        logger.info('[Model Switch] Redis not available, using in-memory lock');
        redisClient = null;
        return null;
    }
}

async function acquireLock(client) {
    const expireTime = Date.now() + LOCK_EXPIRE_MS;
    
    if (client) {
        try {
            const result = await client.set(LOCK_KEY, expireTime.toString(), {
                EX: Math.floor(LOCK_EXPIRE_MS / 1000),
                NX: true
            });
            return result === 'OK';
        } catch (error) {
            logger.warn('[Model Switch] Redis lock failed, using fallback:', error.message);
        }
    }
    
    if (isSwitching) {
        return false;
    }
    
    isSwitching = true;
    return true;
}

async function releaseLock(client) {
    if (client) {
        try {
            await client.del(LOCK_KEY);
        } catch (error) {
            logger.error('[Model Switch] Failed to release Redis lock:', error.message);
        }
    }
    
    isSwitching = false;
    switchTask = null;
    switchModelName = null;
}

async function isLocked(client) {
    if (client) {
        try {
            const value = await client.get(LOCK_KEY);
            if (value) {
                const expireTime = parseInt(value);
                if (Date.now() > expireTime) {
                    await client.del(LOCK_KEY);
                    return false;
                }
                return true;
            }
            return false;
        } catch (error) {
            return isSwitching;
        }
    }
    
    return isSwitching && (Date.now() < (switchTask?.expireTime || 0));
}

export async function handleModelSwitchRequest(req, res) {
    try {
        const client = await getRedisClient();
        
        if (await isLocked(client)) {
            res.writeHead(202, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'switching_in_progress',
                message: `Model switch is in progress for: ${switchModelName || 'unknown'}`,
                retry_after: POLL_INTERVAL_MS / 1000
            }));
            return true;
        }
        
        const body = await parseRequestBody(req);
        const modelName = body.model_name || body.model;
        
        if (!modelName) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: {
                    message: 'model_name is required in request body',
                    code: 'MISSING_MODEL_NAME'
                }
            }));
            return true;
        }
        
        const locked = await acquireLock(client);
        if (!locked) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'switching_in_progress',
                message: 'Another model switch operation is in progress',
                retry_after: POLL_INTERVAL_MS / 1000
            }));
            return true;
        }
        
        switchModelName = modelName;
        switchTask = executeModelSwitch(client, modelName);
        
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'switching_started',
            message: `Starting model switch to ${modelName}`,
            model_name: modelName,
            note: 'Switch is running asynchronously. Poll this endpoint to check status.'
        }));
        
        switchTask.catch((error) => {
            logger.error('[Model Switch] Background switch failed:', error.message);
        }).finally(async () => {
            await releaseLock(client);
        });
        
        return true;
    } catch (error) {
        logger.error('[Model Switch] Failed to handle switch request:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: {
                message: `Failed to switch model: ${error.message}`,
                code: 'SWITCH_FAILED'
            }
        }));
        return true;
    }
}

async function executeModelSwitch(client, modelName) {
    const startTime = Date.now();
    try {
        logger.info(`[Model Switch] Starting switch to ${modelName}`);
        
        const models = await getModelsList();
        const availableModels = Object.keys(models);
        
        if (!availableModels.includes(modelName)) {
            throw new Error(`Model ${modelName} not found. Available: ${availableModels.join(', ')}`);
        }
        
        const testEnabled = false;
        
        logger.info(`[Model Switch] Calling Python controller switch endpoint`);
        const switchResult = await callPythonControllerRaw(
            `/manage/models/${encodeURIComponent(modelName)}/switch?test_enabled=${testEnabled}`,
            'POST'
        );
        
        logger.info(`[Model Switch] Python switch response: ${JSON.stringify(switchResult).substring(0, 200)}`);
        
        if (switchResult.error || switchResult.detail) {
            throw new Error(switchResult.detail || switchResult.error);
        }
        
        logger.info(`[Model Switch] Waiting for model ${modelName} to be ready...`);
        await waitForModelReady(modelName, 180000);
        
        const duration = Date.now() - startTime;
        logger.info(`[Model Switch] Successfully switched to ${modelName} in ${duration}ms`);
        
    } catch (error) {
        logger.error(`[Model Switch] Failed to switch to ${modelName}: ${error.message}`);
        throw error;
    }
}

async function getModelsList() {
    return callPythonControllerRaw('/manage/models', 'GET');
}

async function waitForModelReady(modelName, timeout) {
    const start = Date.now();
    let lastStatus = 'unknown';
    
    while (Date.now() - start < timeout) {
        const models = await getModelsList();
        const modelInfo = models[modelName];
        
        if (!modelInfo) {
            throw new Error(`Model ${modelName} disappeared from models list`);
        }
        
        const currentStatus = modelInfo.running ? 'running' : (modelInfo.status || 'starting');
        if (currentStatus !== lastStatus) {
            logger.info(`[Model Switch] Model ${modelName} status: ${currentStatus}`);
            lastStatus = currentStatus;
        }
        
        if (modelInfo.running) {
            logger.info(`[Model Switch] Model ${modelName} is ready on port ${modelInfo.port || 8000}`);
            await sleep(3000);
            return true;
        }
        
        await sleep(POLL_INTERVAL_MS);
    }
    
    throw new Error(`Timeout (${timeout}ms) waiting for model ${modelName} to be ready`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                reject(new Error('Invalid JSON in request body'));
            }
        });
        req.on('error', reject);
    });
}
