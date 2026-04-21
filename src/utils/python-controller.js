import logger from './logger.js';
import { CONFIG } from '../core/config-manager.js';

function resolveControllerUrl() {
    if (controllerUrl) {
        return controllerUrl;
    }
    if (process.env.CONTROLLER_BASE_URL) {
        return process.env.CONTROLLER_BASE_URL;
    }
    if (CONFIG.CONTROLLER_BASE_URL) {
        return CONFIG.CONTROLLER_BASE_URL;
    }
    return 'http://localhost:5000';
}

let controllerUrl = null;

const DEFAULT_TIMEOUT = 30000:
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_MAX_RETRIES = 1;

const cacheStore = new Map();
const pendingRequests = new Map();

const connectionStatus = {
    lastFailureTime: 0,
    consecutiveFailures: 0,
    fastFailDuration: 10000
};

function shouldFastFail() {
    if (connectionStatus.consecutiveFailures < 3) {
        return false;
    }
    return Date.now() - connectionStatus.lastFailureTime < connectionStatus.fastFailDuration;
}

function recordConnectionFailure() {
    connectionStatus.lastFailureTime = Date.now();
    connectionStatus.consecutiveFailures++;
    logger.warn(`[Python Controller] Connection failure recorded, consecutive failures: ${connectionStatus.consecutiveFailures}`);
}

function recordConnectionSuccess() {
    connectionStatus.consecutiveFailures = 0;
}

export function setControllerUrl(url) {
    logger.debug(`[Python Controller] setControllerUrl: ${url}`);
    controllerUrl = url;
}

export function getControllerUrl() {
    logger.debug(`[Python Controller] getControllerUrl: controllerUrl=${controllerUrl}, CONFIG.CONTROLLER_BASE_URL=${CONFIG?.CONTROLLER_BASE_URL}`);
    if (controllerUrl) {
        return controllerUrl;
    }
    if (typeof CONFIG !== 'undefined' && CONFIG.CONTROLLER_BASE_URL) {
        return CONFIG.CONTROLLER_BASE_URL;
    }
    logger.warn('[Python Controller] getControllerUrl: Using fallback localhost:5000');
    return 'http://localhost:5000';
}

function createCacheKey(endpoint, method, body) {
    const bodyStr = body ? JSON.stringify(body) : '';
    return `${method}:${endpoint}:${bodyStr}`;
}

function withTimeout(promise, ms, errorMessage = 'Request timed out') {
    const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(errorMessage)), ms);
    });
    return Promise.race([promise, timeout]);
}

async function retryAsync(fn, maxRetries, delay, context) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                logger.warn(`[Python Controller] Retry ${attempt}/${maxRetries} for ${context}: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
            }
        }
    }
    throw lastError;
}

async function callPythonController(endpoint, method = 'GET', body = null, headers = {}, options = {}) {
    const baseUrl = resolveControllerUrl();
    const url = `${baseUrl}${endpoint}`;
    
    if (shouldFastFail()) {
        const error = new Error(`Python Controller unavailable, fast fail mode active. Last failure: ${(Date.now() - connectionStatus.lastFailureTime) / 1000}s ago`);
        logger.warn(`[Python Controller] Fast fail for ${method} ${url}: ${error.message}`);
        throw error;
    }
    
    logger.debug(`[Python Controller] callPythonController: ${method} ${url}`);
    const {
        timeout = DEFAULT_TIMEOUT,
        maxRetries = DEFAULT_MAX_RETRIES,
        retryDelay = DEFAULT_RETRY_DELAY,
        cacheTtl = 0,
        skipCache = false
    } = options;

    const cacheKey = cacheTtl > 0 && !skipCache ? createCacheKey(endpoint, method, body) : null;

    if (cacheKey && cacheStore.has(cacheKey)) {
        const cached = cacheStore.get(cacheKey);
        if (Date.now() - cached.timestamp < cacheTtl) {
            return cached.data;
        }
        cacheStore.delete(cacheKey);
    }

    const requestKey = `${method}:${url}`;
    if (pendingRequests.has(requestKey)) {
        return pendingRequests.get(requestKey);
    }

    const requestPromise = retryAsync(async () => {
        const controller = new AbortController();
        const timeoutId = timeout ? setTimeout(() => controller.abort(), timeout) : null;
        
        const fetchOptions = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            signal: controller.signal
        };

        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        try {
            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                const errorText = await response.text();
                const error = new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                error.status = response.status;
                throw error;
            }

            const data = await response.json();
            return data;
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }, maxRetries, retryDelay, `${method} ${url}`);

    pendingRequests.set(requestKey, requestPromise);

    try {
        const data = await requestPromise;
        
        recordConnectionSuccess();
        
        if (cacheKey && cacheTtl > 0) {
            cacheStore.set(cacheKey, {
                data,
                timestamp: Date.now()
            });
        }

        return data;
    } catch (error) {
        recordConnectionFailure();
        logger.error(`[Python Controller] Error calling ${method} ${url}: ${error.message}`);
        throw error;
    } finally {
        pendingRequests.delete(requestKey);
    }
}

export async function getVLLMAvailableModels(options = {}) {
    try {
        const data = await callPythonController('/vllm/models', 'GET', null, {}, {
            cacheTtl: 60000,
            ...options
        });
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to get vLLM available models: ${error.message}`);
        return { success: false, error: error.message, models: [] };
    }
}

export async function getVLLMModelStatus(options = {}) {
    try {
        const data = await callPythonController('/vllm/model/status', 'GET', null, {}, {
            cacheTtl: 5000,
            ...options
        });
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to get vLLM model status: ${error.message}`);
        return { success: false, error: error.message };
    }
}

export async function switchVLLMModel(modelName, options = {}) {
    try {
        const data = await callPythonController('/vllm/model/switch', 'POST', { model_name: modelName }, {}, {
            timeout: 120000,
            ...options
        });
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to switch vLLM model ${modelName}: ${error.message}`);
        throw error;
    }
}

export async function startVLLMService(options = {}) {
    try {
        const data = await callPythonController('/vllm/service/start', 'POST', null, {}, {
            timeout: 180000,
            ...options
        });
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to start vLLM service: ${error.message}`);
        throw error;
    }
}

export async function stopVLLMService(options = {}) {
    try {
        const data = await callPythonController('/vllm/service/stop', 'POST', null, {}, {
            timeout: 60000,
            ...options
        });
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to stop vLLM service: ${error.message}`);
        throw error;
    }
}

export async function restartVLLMService(options = {}) {
    try {
        const data = await callPythonController('/vllm/service/restart', 'POST', null, {}, {
            timeout: 180000,
            ...options
        });
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to restart vLLM service: ${error.message}`);
        throw error;
    }
}

export async function getVLLMServiceStatus(options = {}) {
    try {
        const data = await callPythonController('/vllm/service/status', 'GET', null, {}, {
            cacheTtl: 5000,
            ...options
        });
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to get vLLM service status: ${error.message}`);
        return { success: false, error: error.message };
    }
}

export async function getGPUStatus(options = {}) {
    try {
        const data = await callPythonController('/manage/gpu', 'GET', null, {}, {
            cacheTtl: 5000,
            ...options
        });
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to get GPU status: ${error.message}`);
        return null;
    }
}

export async function getQueueStatus(options = {}) {
    try {
        const data = await callPythonController('/manage/queue', 'GET', null, {}, {
            cacheTtl: 2000,
            ...options
        });
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to get queue status: ${error.message}`);
        return {};
    }
}

export async function getHealthStatus(options = {}) {
    try {
        const data = await callPythonController('/health', 'GET', null, {}, {
            timeout: 5000,
            ...options
        });
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to get health status: ${error.message}`);
        return { status: 'unhealthy' };
    }
}

export function clearCache() {
    cacheStore.clear();
    logger.info('[Python Controller] Cache cleared');
}

export async function getCacheStats() {
    return {
        entries: cacheStore.size,
        pendingRequests: pendingRequests.size
    };
}

export async function callPythonControllerRaw(endpoint, method = 'GET', body = null, options = {}) {
    const url = `${resolveControllerUrl()}${endpoint}`;
    const {
        timeout = DEFAULT_TIMEOUT,
        maxRetries = DEFAULT_MAX_RETRIES,
        retryDelay = DEFAULT_RETRY_DELAY
    } = options;

    const requestPromise = retryAsync(async () => {
        const controller = new AbortController();
        const timeoutId = timeout ? setTimeout(() => controller.abort(), timeout) : null;
        
        const fetchOptions = {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        };

        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        try {
            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                const errorText = await response.text();
                const error = new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                error.status = response.status;
                throw error;
            }

            const data = await response.json();
            return data;
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }, maxRetries, retryDelay, `${method} ${url}`);

    return requestPromise;
}