import logger from '../utils/logger.js';
import { CONFIG } from '../core/config-manager.js';

const gpuCache = {
    data: null,
    timestamp: 0,
    ttl: 5000
};

const queueCache = {
    data: null,
    timestamp: 0,
    ttl: 5000
};

const modelsCache = {
    data: null,
    timestamp: 0,
    ttl: 5000
};

const monitorSummaryCache = {
    data: null,
    timestamp: 0,
    ttl: 5000
};

let refreshIntervalId = null;
const DEFAULT_REFRESH_INTERVAL = 10000;

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

export async function preloadControllerData() {
    logger.info('[Controller Cache] Starting preload of controller data...');
    const startTime = Date.now();
    
    // Build headers with controller API key if configured
    const headers = {};
    if (CONFIG.CONTROLLER_API_KEY) {
        headers['X-Controller-Api-Key'] = CONFIG.CONTROLLER_API_KEY;
    }
    
    try {
        const [gpuData, modelsData, queueData, summaryData, healthData, serviceData] = await Promise.all([
            callPythonController('/manage/gpu', 'GET', null, headers).catch(() => null),
            callPythonController('/manage/models', 'GET', null, headers).catch(() => null),
            callPythonController('/manage/queue', 'GET', null, headers).catch(() => null),
            callPythonController('/manage/models/summary', 'GET', null, headers).catch(() => null),
            callPythonController('/health', 'GET', null, headers).catch(() => null),
            callPythonController('/manage/service/status', 'GET', null, headers).catch(() => null)
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
            controllerUrl: CONFIG.CONTROLLER_BASE_URL || 'http://localhost:5000'
        };
        
        monitorSummaryCache.data = result;
        monitorSummaryCache.timestamp = now;
        
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

async function callPythonController(endpoint, method = 'GET', body = null, headers = {}) {
    const CONTROLLER_BASE_URL = CONFIG.CONTROLLER_BASE_URL || 'http://localhost:5000';
    const url = `${CONTROLLER_BASE_URL}${endpoint}`;
    
    try {
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: body ? JSON.stringify(body) : null
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`[Python Controller API] Request failed: ${method} ${url} - ${response.status} ${errorText}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        logger.error(`[Python Controller API] Error calling ${method} ${url}: ${error.message}`);
        throw error;
    }
}

export async function getGPUStatusData(req) {
    const now = Date.now();
    if (gpuCache.data && (now - gpuCache.timestamp) < gpuCache.ttl) {
        return gpuCache.data;
    }

    const headers = buildHeaders(req);
    const data = await callPythonController('/manage/gpu', 'GET', null, headers);
    gpuCache.data = data;
    gpuCache.timestamp = now;
    return data;
}

export async function handleGetVLLMModels(req, res) {
    try {
        const headers = buildHeaders(req);
        const data = await callPythonController('/v1/models', 'GET', null, headers);
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
        
        if (monitorSummaryCache.data && (now - monitorSummaryCache.timestamp) < monitorSummaryCache.ttl) {
            res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
            res.end(JSON.stringify({
                ...monitorSummaryCache.data,
                timestamp: now
            }));
            return true;
        }

        const headers = buildHeaders(req);
        const controllerBaseUrl = CONFIG.CONTROLLER_BASE_URL || 'http://localhost:5000';
        
        const [gpuData, gpuHistoryData, modelsData, queueData, summaryData, healthData, serviceData] = await Promise.all([
            callPythonController('/manage/gpu', 'GET', null, headers).catch(() => null),
            callPythonController('/manage/gpu/history?count=60', 'GET', null, headers).catch(() => null),
            callPythonController('/manage/models', 'GET', null, headers).catch(() => null),
            callPythonController('/manage/queue', 'GET', null, headers).catch(() => null),
            callPythonController('/manage/models/summary', 'GET', null, headers).catch(() => null),
            callPythonController('/health', 'GET', null, headers).catch(() => null),
            callPythonController('/manage/service/status', 'GET', null, headers).catch(() => null)
        ]);

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
        const data = await callPythonController('/manage/models', 'GET', null, headers);
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
        const data = await callPythonController('/manage/models/summary', 'GET', null, headers);
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
        const data = await callPythonController(`/manage/models/${modelName}/start`, 'POST', null, headers);
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
        const data = await callPythonController(`/manage/models/${modelName}/stop`, 'POST', null, headers);
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
        const data = await callPythonController(`/manage/models/${modelName}/switch`, 'POST', null, headers);
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
        
        const data = await callPythonController(`/manage/gpu/history${queryString}`, 'GET', null, headers);
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
        const data = await callPythonController('/manage/queue', 'GET', null, headers);
        queueCache.data = data;
        queueCache.timestamp = now;
        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'MISS' });
        res.end(JSON.stringify({ success: true, queue: data }));
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
        const data = await callPythonController('/manage/models', 'GET', null, headers);
        modelsCache.data = data;
        modelsCache.timestamp = now;
        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'MISS' });
        res.end(JSON.stringify({ success: true, models: data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleGetHealthStatus(req, res) {
    try {
        const headers = buildHeaders(req);
        const data = await callPythonController('/health', 'GET', null, headers);
        const controllerBaseUrl = CONFIG.CONTROLLER_BASE_URL || 'http://localhost:5000';
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
