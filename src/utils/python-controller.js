import logger from './logger.js';

const DEFAULT_PYTHON_CONTROLLER_URL = 'http://localhost:5000';

let controllerUrl = DEFAULT_PYTHON_CONTROLLER_URL;

export function setControllerUrl(url) {
    controllerUrl = url;
}

export function getControllerUrl() {
    return controllerUrl;
}

export async function callPythonController(endpoint, method = 'GET', body = null, headers = {}) {
    const url = `${controllerUrl}${endpoint}`;
    
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
            logger.error(`[Python Controller] Request failed: ${method} ${url} - ${response.status} ${errorText}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Error calling ${method} ${url}: ${error.message}`);
        throw error;
    }
}

export async function getVLLMModels() {
    try {
        const data = await callPythonController('/v1/models');
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to get VLLM models: ${error.message}`);
        return { object: 'list', data: [] };
    }
}

export async function getModelStatus() {
    try {
        const data = await callPythonController('/manage/models');
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to get model status: ${error.message}`);
        return {};
    }
}

export async function startModel(modelName) {
    try {
        const data = await callPythonController(`/manage/models/${modelName}/start`, 'POST');
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to start model ${modelName}: ${error.message}`);
        throw error;
    }
}

export async function stopModel(modelName) {
    try {
        const data = await callPythonController(`/manage/models/${modelName}/stop`, 'POST');
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to stop model ${modelName}: ${error.message}`);
        throw error;
    }
}

export async function switchModel(modelName) {
    try {
        const data = await callPythonController(`/manage/models/${modelName}/switch`, 'POST');
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to switch model ${modelName}: ${error.message}`);
        throw error;
    }
}

export async function getGPUStatus() {
    try {
        const data = await callPythonController('/manage/gpu');
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to get GPU status: ${error.message}`);
        return null;
    }
}

export async function getQueueStatus() {
    try {
        const data = await callPythonController('/manage/queue');
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to get queue status: ${error.message}`);
        return {};
    }
}

export async function getHealthStatus() {
    try {
        const data = await callPythonController('/health');
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to get health status: ${error.message}`);
        return { status: 'unhealthy' };
    }
}