import logger from '../utils/logger.js';
import { CONFIG } from '../core/config-manager.js';

export function getControllerBaseUrl() {
    return CONFIG.CONTROLLER_BASE_URL || 'http://localhost:5000';
}

const gpuCache = {
    data: null,
    timestamp: 0,
    ttl: 30000
};

const queueCache = {
    data: null,
    timestamp: 0,
    ttl: 30000
};

const modelsCache = {
    data: null,
    timestamp: 0,
    ttl: 60000
};

const monitorSummaryCache = {
    data: null,
    timestamp: 0,
    ttl: 30000,
    timeRange: null
};

const DEFAULT_REFRESH_INTERVAL = 30000;

let refreshIntervalId = null;

function invalidateControllerCaches() {
    gpuCache.data = null;
    gpuCache.timestamp = 0;
    queueCache.data = null;
    queueCache.timestamp = 0;
    modelsCache.data = null;
    modelsCache.timestamp = 0;
    monitorSummaryCache.data = null;
    monitorSummaryCache.timestamp = 0;
}

export async function preloadControllerData(options = {}) {
    const { silent = false } = options;
    logger.info('[Controller Cache] Starting preload of controller data...');
    const startTime = Date.now();
    
    // Build headers with controller API key if configured
    const headers = {};
    if (CONFIG.CONTROLLER_API_KEY) {
        headers['X-Controller-Api-Key'] = CONFIG.CONTROLLER_API_KEY;
    }
    
    try {
        const controllerOptions = { timeout: 10000, retries: 1, silent: true };
        const [gpuData, modelsData, queueData, summaryData, healthData, serviceData] = await Promise.all([
            callPythonController('/manage/gpu', 'GET', null, headers, controllerOptions).catch(() => null),
            callPythonController('/manage/models', 'GET', null, headers, controllerOptions).catch(() => null),
            callPythonController('/manage/queue', 'GET', null, headers, controllerOptions).catch(() => null),
            callPythonController('/manage/models/summary', 'GET', null, headers, controllerOptions).catch(() => null),
            callPythonController('/health', 'GET', null, headers, controllerOptions).catch(() => null),
            callPythonController('/manage/service/status', 'GET', null, headers, controllerOptions).catch(() => null)
        ]);

        const now = Date.now();
        
        if (gpuData) {
            gpuCache.data = gpuData;
            gpuCache.timestamp = now;
        }
        if (modelsData) {
            modelsCache.data = modelsData;
            modelsCache.timestamp = now;
        }
        if (queueData) {
            queueCache.data = queueData;
            queueCache.timestamp = now;
        }
        
        const result = {
            success: true,
            timestamp: now,
            gpu: gpuData,
            models: modelsData,
            queue: queueData,
            summary: summaryData,
            health: healthData,
            service: serviceData,
            controllerUrl: getControllerBaseUrl()
        };
        
        monitorSummaryCache.data = result;
        monitorSummaryCache.timestamp = now;
        monitorSummaryCache.timeRange = null;

        const duration = Date.now() - startTime;
        logger.info(`[Controller Cache] Preload completed in ${duration}ms`);
        
        return { success: true, duration, cached: !!gpuData || !!modelsData || !!queueData };
    } catch (error) {
        logger.warn(`[Controller Cache] Preload failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

export function startPeriodicRefresh(interval = DEFAULT_REFRESH_INTERVAL) {
    stopPeriodicRefresh();
    
    refreshIntervalId = setInterval(async () => {
        logger.debug('[Controller Cache] Running periodic refresh...');
        await preloadControllerData();
    }, interval);
    
    logger.info(`[Controller Cache] Periodic refresh scheduled every ${interval}ms`);
}

export function stopPeriodicRefresh() {
    if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
        refreshIntervalId = null;
        logger.info('[Controller Cache] Periodic refresh stopped');
    }
}

export function isRefreshRunning() {
    return refreshIntervalId !== null;
}

function buildHeaders(req) {
    const headers = {};
    
    if (CONFIG.CONTROLLER_API_KEY) {
        headers['X-Controller-Api-Key'] = CONFIG.CONTROLLER_API_KEY;
    }
    
    if (req.headers.authorization) {
        headers['Authorization'] = req.headers.authorization;
    }
    if (req.headers['x-request-id']) {
        headers['X-Request-Id'] = req.headers['x-request-id'];
    }
    headers['X-Proxy-By'] = 'AIClient-2-API';
    return headers;
}

/**
 * Call Python Controller API with timeout and retry support
 * @param {string} endpoint - API endpoint path
 * @param {string} method - HTTP method
 * @param {object|null} body - Request body
 * @param {object} headers - Request headers
 * @param {object} options - Additional options
 * @param {number} options.timeout - Request timeout in ms (default: 10000)
 * @param {number} options.retries - Number of retries on failure (default: 1)
 * @param {boolean} options.silent - Suppress error logs (default: false)
 */
async function callPythonController(endpoint, method = 'GET', body = null, headers = {}, options = {}) {
    const { timeout = 10000, retries = 1, silent = false } = options;
    const controllerBaseUrl = () => getControllerBaseUrl();
    const url = `${controllerBaseUrl()}${endpoint}`;
    
    const makeRequest = async (attempt) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                },
                body: body ? JSON.stringify(body) : null,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorText = await response.text();
                if (!silent) {
                    logger.error(`[Python Controller API] Request failed: ${method} ${url} - ${response.status} ${errorText}`);
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            clearTimeout(timeoutId);
            
            // Check if we should retry
            if (attempt < retries && (error.name === 'AbortError' || error.message === 'fetch failed')) {
                logger.debug(`[Python Controller API] Retrying ${method} ${url} (attempt ${attempt + 1}/${retries + 1})`);
                await new Promise(resolve => setTimeout(resolve, 100 * attempt)); // Exponential backoff
                return makeRequest(attempt + 1);
            }
            
            if (!silent) {
                const level = attempt > 0 ? 'warn' : 'error';
                logger[level](`[Python Controller API] Error calling ${method} ${url}: ${error.message}`);
            }
            throw error;
        }
    };
    
    return makeRequest(0);
}

export async function getGPUStatusData(req) {
    const now = Date.now();
    if (gpuCache.data && (now - gpuCache.timestamp) < gpuCache.ttl) {
        return gpuCache.data;
    }

    const headers = buildHeaders(req);
    const data = await callPythonController('/manage/gpu', 'GET', null, headers, { silent: true }).catch(() => null);
    if (data) {
        gpuCache.data = data;
        gpuCache.timestamp = now;
    }
    return data || gpuCache.data;
}

export async function handleGetVLLMModels(req, res) {
    try {
        const headers = buildHeaders(req);
        const data = await callPythonController('/v1/models', 'GET', null, headers, { timeout: 15000 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleGetMonitorSummary(req, res) {
    try {
        const now = Date.now();

        const url = new URL(req.url, `http://${req.headers.host}`);
        const timeRange = url.searchParams.get('time_range');

        if (monitorSummaryCache.data && (now - monitorSummaryCache.timestamp) < monitorSummaryCache.ttl) {
            if (monitorSummaryCache.timeRange === timeRange) {
                res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
                res.end(JSON.stringify({
                    ...monitorSummaryCache.data,
                    timestamp: now
                }));
                return true;
            }
        }

        const headers = buildHeaders(req);
        const controllerBaseUrl = getControllerBaseUrl();

        const staleThreshold = 5000;
        const useStaleCache = (cache) => cache.data && (now - cache.timestamp) < cache.ttl + staleThreshold;

        const [gpuCacheValid, queueCacheValid, modelsCacheValid] = [
            useStaleCache(gpuCache),
            useStaleCache(queueCache),
            useStaleCache(modelsCache)
        ];

        const allCachesValid = gpuCacheValid && queueCacheValid && modelsCacheValid;

        if (allCachesValid && monitorSummaryCache.data && monitorSummaryCache.timeRange === timeRange) {
            const result = {
                ...monitorSummaryCache.data,
                timestamp: now
            };
            monitorSummaryCache.timestamp = now;
            res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'STALE_REFRESH' });
            res.end(JSON.stringify(result));
            return true;
        }

        const historyParams = timeRange ? `?time_range=${timeRange}&count=60` : '?count=60';
        const controllerOptions = { timeout: 10000, retries: 1, silent: true };

        const [gpuData, gpuHistoryData, modelsData, queueData, summaryData, healthData, serviceData] = await Promise.all([
            gpuCacheValid ? Promise.resolve(gpuCache.data) : callPythonController('/manage/gpu', 'GET', null, headers, controllerOptions).catch(() => null),
            callPythonController(`/manage/gpu/history${historyParams}`, 'GET', null, headers, controllerOptions).catch(() => null),
            modelsCacheValid ? Promise.resolve(modelsCache.data) : callPythonController('/manage/models', 'GET', null, headers, controllerOptions).catch(() => null),
            queueCacheValid ? Promise.resolve(queueCache.data) : callPythonController('/manage/queue', 'GET', null, headers, controllerOptions).catch(() => null),
            callPythonController('/manage/models/summary', 'GET', null, headers, controllerOptions).catch(() => null),
            callPythonController('/health', 'GET', null, headers, controllerOptions).catch(() => null),
            callPythonController('/manage/service/status', 'GET', null, headers, controllerOptions).catch(() => null)
        ]);

        if (!gpuCacheValid && gpuData) {
            gpuCache.data = gpuData;
            gpuCache.timestamp = now;
        }
        if (!modelsCacheValid && modelsData) {
            modelsCache.data = modelsData;
            modelsCache.timestamp = now;
        }
        if (!queueCacheValid && queueData) {
            queueCache.data = queueData;
            queueCache.timestamp = now;
        }

        if (gpuData && gpuHistoryData && gpuHistoryData.history) {
            gpuData.history = gpuHistoryData.history;
        }

        const result = {
            success: true,
            timestamp: now,
            gpu: gpuData,
            models: modelsData,
            queue: queueData,
            summary: summaryData,
            health: healthData,
            service: serviceData,
            controllerUrl: controllerBaseUrl
        };

        monitorSummaryCache.data = result;
        monitorSummaryCache.timestamp = now;
        monitorSummaryCache.timeRange = timeRange;

        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'MISS' });
        res.end(JSON.stringify(result));
    } catch (error) {
        logger.error(`[Python Controller API] Error getting monitor summary: ${error.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleGetModelStatus(req, res) {
    try {
        const headers = buildHeaders(req);
        const data = await callPythonController('/manage/models', 'GET', null, headers, { silent: true });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, models: data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleGetModelSummary(req, res) {
    try {
        const headers = buildHeaders(req);
        const data = await callPythonController('/manage/models/summary', 'GET', null, headers, { silent: true });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleStartModel(req, res, modelName) {
    try {
        const headers = buildHeaders(req);
        const data = await callPythonController(`/manage/models/${modelName}/start`, 'POST', null, headers, { timeout: 60000 });
        invalidateControllerCaches();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleStopModel(req, res, modelName) {
    try {
        const headers = buildHeaders(req);
        const data = await callPythonController(`/manage/models/${modelName}/stop`, 'POST', null, headers, { timeout: 60000 });
        invalidateControllerCaches();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleSwitchModel(req, res, modelName) {
    try {
        const headers = buildHeaders(req);
        const data = await callPythonController(`/manage/models/${modelName}/switch?test_enabled=false`, 'POST', null, headers, { timeout: 120000 });
        invalidateControllerCaches();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleGetGPUStatus(req, res) {
    try {
        const hadCache = gpuCache.data && (Date.now() - gpuCache.timestamp) < gpuCache.ttl;
        const data = await getGPUStatusData(req);
        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': hadCache ? 'HIT' : 'MISS' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleGetGPUHistory(req, res) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const queryString = url.search;
        
        const headers = buildHeaders(req);
        
        const data = await callPythonController(`/manage/gpu/history${queryString}`, 'GET', null, headers, { silent: true });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleGetQueueStatus(req, res) {
    try {
        const now = Date.now();
        if (queueCache.data && (now - queueCache.timestamp) < queueCache.ttl) {
            res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
            res.end(JSON.stringify({ success: true, queue: queueCache.data }));
            return true;
        }

        const headers = buildHeaders(req);
        const data = await callPythonController('/manage/queue', 'GET', null, headers, { silent: true }).catch(() => null);
        if (data) {
            queueCache.data = data;
            queueCache.timestamp = now;
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'MISS' });
        res.end(JSON.stringify({ success: true, queue: data || queueCache.data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleGetModelsStatus(req, res) {
    try {
        const now = Date.now();
        if (modelsCache.data && (now - modelsCache.timestamp) < modelsCache.ttl) {
            res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
            res.end(JSON.stringify({ success: true, models: modelsCache.data }));
            return true;
        }

        const headers = buildHeaders(req);
        const data = await callPythonController('/manage/models', 'GET', null, headers, { silent: true }).catch(() => null);
        if (data) {
            modelsCache.data = data;
            modelsCache.timestamp = now;
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'MISS' });
        res.end(JSON.stringify({ success: true, models: data || modelsCache.data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleGetHealthStatus(req, res) {
    try {
        const headers = buildHeaders(req);
        const data = await callPythonController('/health', 'GET', null, headers, { silent: true });
        const controllerBaseUrl = getControllerBaseUrl();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data, controllerUrl: controllerBaseUrl }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleTestModel(req, res, modelName) {
    try {
        const headers = buildHeaders(req);
        const data = await callPythonController(`/v1/test/model/${modelName}`, 'POST', null, headers);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleGetModelTestReport(req, res, modelName) {
    try {
        const headers = buildHeaders(req);
        const data = await callPythonController(`/v1/test/report/${modelName}`, 'GET', null, headers);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleGetAllTestReports(req, res) {
    try {
        const headers = buildHeaders(req);
        const data = await callPythonController('/v1/test/reports', 'GET', null, headers);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleSwitchAndTestModel(req, res, modelName) {
    try {
        const headers = buildHeaders(req);
        const data = await callPythonController(`/v1/test/model/${modelName}/switch-and-test`, 'POST', null, headers);
        invalidateControllerCaches();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleRunComparativeAnalysis(req, res) {
    try {
        let body = null;
        if (req.body) {
            body = await new Promise((resolve) => {
                let data = '';
                req.on('data', (chunk) => { data += chunk; });
                req.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        resolve(null);
                    }
                });
            });
        }
        const headers = buildHeaders(req);
        const data = await callPythonController('/v1/test/comparative', 'POST', body, headers);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleClearTestReports(req, res) {
    try {
        const headers = buildHeaders(req);
        const data = await callPythonController('/v1/test/reports', 'DELETE', null, headers);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleGetTestStatus(req, res) {
    try {
        const headers = buildHeaders(req);
        const data = await callPythonController('/v1/test/status', 'GET', null, headers);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleGetPythonServiceStatus(req, res) {
    try {
        const headers = buildHeaders(req);
        const data = await callPythonController('/manage/service/status', 'GET', null, headers);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleStartPythonService(req, res) {
    try {
        let body = null;
        if (req.body) {
            body = await new Promise((resolve) => {
                let data = '';
                req.on('data', (chunk) => { data += chunk; });
                req.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        resolve(null);
                    }
                });
            });
        }
        const headers = buildHeaders(req);
        const data = await callPythonController('/manage/service/start', 'POST', body, headers);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleStopPythonService(req, res) {
    try {
        let body = null;
        if (req.body) {
            body = await new Promise((resolve) => {
                let data = '';
                req.on('data', (chunk) => { data += chunk; });
                req.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        resolve(null);
                    }
                });
            });
        }
        const headers = buildHeaders(req);
        const data = await callPythonController('/manage/service/stop', 'POST', body, headers);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleRestartPythonService(req, res) {
    try {
        let body = null;
        if (req.body) {
            body = await new Promise((resolve) => {
                let data = '';
                req.on('data', (chunk) => { data += chunk; });
                req.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        resolve(null);
                    }
                });
            });
        }
        const headers = buildHeaders(req);
        const data = await callPythonController('/manage/service/restart', 'POST', body, headers);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleUpdateConfig(req, res) {
    try {
        let body = null;
        if (req.body) {
            body = await new Promise((resolve) => {
                let data = '';
                req.on('data', (chunk) => { data += chunk; });
                req.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        resolve(null);
                    }
                });
            });
        }
        const headers = buildHeaders(req);
        const data = await callPythonController('/manage/config', 'PUT', body, headers);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}
