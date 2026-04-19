import logger from './logger.js';

const DEFAULT_PYTHON_CONTROLLER_URL = 'http://localhost:5000';

let controllerUrl = DEFAULT_PYTHON_CONTROLLER_URL;

export function setControllerUrl(url) {
    controllerUrl = url;
}

export function getControllerUrl() {
    return controllerUrl;
}

async function callPythonController(endpoint, method = 'GET', body = null, headers = {}) {
    const url = `${controllerUrl}${endpoint}`;
    
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };
        
        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(url, options);
        
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

export async function getVLLMAvailableModels() {
    try {
        const data = await callPythonController('/vllm/models');
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to get vLLM available models: ${error.message}`);
        return { success: false, error: error.message, models: [] };
    }
}

export async function getVLLMModelStatus() {
    try {
        const data = await callPythonController('/vllm/model/status');
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to get vLLM model status: ${error.message}`);
        return { success: false, error: error.message };
    }
}

export async function switchVLLMModel(modelName) {
    try {
        const data = await callPythonController('/vllm/model/switch', 'POST', { model_name: modelName });
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to switch vLLM model ${modelName}: ${error.message}`);
        throw error;
    }
}

export async function startVLLMService() {
    try {
        const data = await callPythonController('/vllm/service/start', 'POST');
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to start vLLM service: ${error.message}`);
        throw error;
    }
}

export async function stopVLLMService() {
    try {
        const data = await callPythonController('/vllm/service/stop', 'POST');
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to stop vLLM service: ${error.message}`);
        throw error;
    }
}

export async function restartVLLMService() {
    try {
        const data = await callPythonController('/vllm/service/restart', 'POST');
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to restart vLLM service: ${error.message}`);
        throw error;
    }
}

export async function getVLLMServiceStatus() {
    try {
        const data = await callPythonController('/vllm/service/status');
        return data;
    } catch (error) {
        logger.error(`[Python Controller] Failed to get vLLM service status: ${error.message}`);
        return { success: false, error: error.message };
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
