import logger from '../utils/logger.js';
import { CONFIG } from '../core/config-manager.js';

const CONTROLLER_BASE_URL = CONFIG.CONTROLLER_BASE_URL || 'http://localhost:5000';

async function callPythonController(endpoint, method = 'GET', body = null, headers = {}) {
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

export async function handleGetVLLMModels(req, res) {
    try {
        const data = await callPythonController('/v1/models');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleGetModelStatus(req, res) {
    try {
        const data = await callPythonController('/manage/models');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, models: data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleStartModel(req, res, modelName) {
    try {
        const data = await callPythonController(`/manage/models/${encodeURIComponent(modelName)}/start`, 'POST');
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
        const data = await callPythonController(`/manage/models/${encodeURIComponent(modelName)}/stop`, 'POST');
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
        const data = await callPythonController(`/manage/models/${encodeURIComponent(modelName)}/switch`, 'POST');
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
        const data = await callPythonController('/manage/gpu');
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
        const data = await callPythonController('/manage/queue');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, queue: data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleGetHealthStatus(req, res) {
    try {
        const data = await callPythonController('/health');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}

export async function handleTestModel(req, res, modelName) {
    try {
        const data = await callPythonController(`/v1/test/model/${encodeURIComponent(modelName)}`, 'POST');
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
        const data = await callPythonController(`/v1/test/report/${encodeURIComponent(modelName)}`);
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
        const data = await callPythonController('/v1/test/reports');
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
        const data = await callPythonController(`/v1/test/model/${encodeURIComponent(modelName)}/switch-and-test`, 'POST');
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
        const data = await callPythonController('/v1/test/comparative', 'POST', body);
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
        const data = await callPythonController('/v1/test/reports', 'DELETE');
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
        const data = await callPythonController('/v1/test/status');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}