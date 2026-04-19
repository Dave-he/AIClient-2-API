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
        const headers = {};
        if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
        }
        const data = await callPythonController('/v1/models', 'GET', null, headers);
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
        const headers = {};
        if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
        }
        const data = await callPythonController('/manage/models', 'GET', null, headers);
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
        const headers = {};
        if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
        }
        const data = await callPythonController(`/manage/models/${encodeURIComponent(modelName)}/start`, 'POST', null, headers);
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
        const headers = {};
        if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
        }
        const data = await callPythonController(`/manage/models/${encodeURIComponent(modelName)}/stop`, 'POST', null, headers);
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
        const headers = {};
        if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
        }
        const data = await callPythonController(`/manage/models/${encodeURIComponent(modelName)}/switch`, 'POST', null, headers);
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
        const headers = {};
        if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
        }
        const data = await callPythonController('/manage/gpu', 'GET', null, headers);
        res.writeHead(200, { 'Content-Type': 'application/json' });
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
        
        // Extract authorization header from request
        const headers = {};
        if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
        }
        
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
        const headers = {};
        if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
        }
        const data = await callPythonController('/manage/queue', 'GET', null, headers);
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
        const headers = {};
        if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
        }
        const data = await callPythonController('/health', 'GET', null, headers);
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
        const headers = {};
        if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
        }
        const data = await callPythonController(`/v1/test/model/${encodeURIComponent(modelName)}`, 'POST', null, headers);
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
        const headers = {};
        if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
        }
        const data = await callPythonController(`/v1/test/report/${encodeURIComponent(modelName)}`, 'GET', null, headers);
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
        const headers = {};
        if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
        }
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
        const headers = {};
        if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
        }
        const data = await callPythonController(`/v1/test/model/${encodeURIComponent(modelName)}/switch-and-test`, 'POST', null, headers);
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
        const headers = {};
        if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
        }
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
        const headers = {};
        if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
        }
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
        const headers = {};
        if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
        }
        const data = await callPythonController('/v1/test/status', 'GET', null, headers);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...data }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: error.message } }));
    }
    return true;
}