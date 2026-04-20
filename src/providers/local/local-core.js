import axios from 'axios';
import logger from '../../utils/logger.js';
import * as http from 'http';
import * as https from 'https';
import { configureAxiosProxy, configureTLSSidecar } from '../../utils/proxy-utils.js';
import { isRetryableNetworkError, MODEL_PROVIDER } from '../../utils/common.js';

export class LocalApiService {
    constructor(config) {
        if (!config.LOCAL_API_KEY) {
            throw new Error("API Key is required for LocalApiService (LOCAL_API_KEY).");
        }
        if (!config.LOCAL_BASE_URL) {
            throw new Error("Base URL is required for LocalApiService (LOCAL_BASE_URL).");
        }
        
        this.config = config;
        this.apiKey = config.LOCAL_API_KEY;
        this.baseUrl = config.LOCAL_BASE_URL;
        this.useSystemProxy = config?.USE_SYSTEM_PROXY_LOCAL ?? false;
        
        logger.info(`[Local Model] Base URL: ${this.baseUrl}, System proxy ${this.useSystemProxy ? 'enabled' : 'disabled'}`);

        const httpAgent = new http.Agent({
            keepAlive: true,
            maxSockets: 100,
            maxFreeSockets: 5,
            timeout: 300000,
        });
        const httpsAgent = new https.Agent({
            keepAlive: true,
            maxSockets: 100,
            maxFreeSockets: 5,
            timeout: 300000,
        });

        const headers = {
            'Content-Type': 'application/json'
        };
        if (this.apiKey && this.apiKey !== 'local-dev-key') {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const axiosConfig = {
            baseURL: this.baseUrl,
            httpAgent,
            httpsAgent,
            headers,
            timeout: 300000,
        };
        
        if (!this.useSystemProxy) {
            axiosConfig.proxy = false;
        }
        
        configureAxiosProxy(axiosConfig, config, config.MODEL_PROVIDER || MODEL_PROVIDER.LOCAL_MODEL);
        
        this.axiosInstance = axios.create(axiosConfig);
    }

    _applySidecar(axiosConfig) {
        return configureTLSSidecar(axiosConfig, this.config, this.config.MODEL_PROVIDER || MODEL_PROVIDER.LOCAL_MODEL, this.baseUrl);
    }

    async callApi(endpoint, body, isRetry = false, retryCount = 0) {
        const maxRetries = this.config.REQUEST_MAX_RETRIES || 3;
        const baseDelay = this.config.REQUEST_BASE_DELAY || 1000;

        try {
            const axiosConfig = {
                method: 'post',
                url: endpoint,
                data: body
            };
            this._applySidecar(axiosConfig);
            const response = await this.axiosInstance.request(axiosConfig);
            return response.data;
        } catch (error) {
            const status = error.response?.status;
            const data = error.response?.data;
            const errorCode = error.code;
            const errorMessage = error.message || '';
            const isNetworkError = isRetryableNetworkError(error);
            
            if (status === 401 || status === 403) {
                logger.error(`[Local Model API] Received ${status}. API Key might be invalid or expired.`);
                throw error;
            }

            if ((status === 429 || (status >= 500 && status < 600) || isNetworkError) && retryCount < maxRetries) {
                const delay = baseDelay * Math.pow(2, retryCount);
                logger.info(`[Local Model API] Error ${status || errorCode}. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.callApi(endpoint, body, isRetry, retryCount + 1);
            }

            logger.error(`[Local Model API] Error calling API (Status: ${status}, Code: ${errorCode}):`, errorMessage);
            throw error;
        }
    }

    async *streamApi(endpoint, body, isRetry = false, retryCount = 0) {
        const maxRetries = this.config.REQUEST_MAX_RETRIES || 3;
        const baseDelay = this.config.REQUEST_BASE_DELAY || 1000;

        const streamRequestBody = { ...body, stream: true };

        try {
            const axiosConfig = {
                method: 'post',
                url: endpoint,
                data: streamRequestBody,
                responseType: 'stream',
                timeout: 0,
            };
            this._applySidecar(axiosConfig);
            const response = await this.axiosInstance.request(axiosConfig);

            const stream = response.data;
            let buffer = '';

            for await (const chunk of stream) {
                buffer += chunk.toString();
                let newlineIndex;
                while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.substring(0, newlineIndex).trim();
                    buffer = buffer.substring(newlineIndex + 1);

                    if (line.startsWith('data: ')) {
                        const jsonData = line.substring(6).trim();
                        if (jsonData === '[DONE]') {
                            return;
                        }
                        try {
                            const parsedChunk = JSON.parse(jsonData);
                            yield parsedChunk;
                        } catch (e) {
                            logger.warn("[LocalApiService] Failed to parse stream chunk JSON:", e.message, "Data:", jsonData);
                        }
                    }
                }
            }
        } catch (error) {
            const status = error.response?.status;
            const errorCode = error.code;
            const isNetworkError = isRetryableNetworkError(error);
            
            if ((status === 429 || (status >= 500 && status < 600) || isNetworkError) && retryCount < maxRetries) {
                const delay = baseDelay * Math.pow(2, retryCount);
                logger.info(`[Local Model API] Stream error ${status || errorCode}. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                yield* this.streamApi(endpoint, body, isRetry, retryCount + 1);
                return;
            }

            const errorMessage = error.message || '';
            logger.error(`[Local Model API] Error calling streaming API (Status: ${status || errorCode}):`, errorMessage);
            throw error;
        }
    }

    async generateContent(model, requestBody) {
        if (requestBody._monitorRequestId) {
            this.config._monitorRequestId = requestBody._monitorRequestId;
            delete requestBody._monitorRequestId;
        }
        if (requestBody._requestBaseUrl) {
            delete requestBody._requestBaseUrl;
        }

        return this.callApi('/v1/chat/completions', requestBody);
    }

    async *generateContentStream(model, requestBody) {
        if (requestBody._monitorRequestId) {
            this.config._monitorRequestId = requestBody._monitorRequestId;
            delete requestBody._monitorRequestId;
        }
        if (requestBody._requestBaseUrl) {
            delete requestBody._requestBaseUrl;
        }

        yield* this.streamApi('/v1/chat/completions', requestBody);
    }

    async listModels() {
        try {
            // Use a separate axios request without Authorization header for health check
            // This avoids 403 errors when the vLLM server has different auth requirements
            const headers = {
                'Content-Type': 'application/json'
            };
            const axiosConfig = {
                method: 'get',
                url: '/v1/models',
                headers,
                baseURL: this.baseUrl,
                timeout: 10000,
                proxy: !this.useSystemProxy ? false : undefined
            };
            if (this.useSystemProxy) {
                configureAxiosProxy(axiosConfig, this.config, this.config.MODEL_PROVIDER || MODEL_PROVIDER.LOCAL_MODEL);
            }
            const response = await axios.request(axiosConfig);
            return response.data;
        } catch (error) {
            const status = error.response?.status;
            const data = error.response?.data;
            // Only log if it's not a 401/403 (common for health checks with no auth)
            if (status !== 401 && status !== 403) {
                logger.error(`Error listing Local models (Status: ${status}):`, data || error.message);
            }
            return { data: [] };
        }
    }

    async getGPUStatus() {
        try {
            const axiosConfig = {
                method: 'get',
                url: '/manage/gpu'
            };
            this._applySidecar(axiosConfig);
            const response = await this.axiosInstance.request(axiosConfig);
            return response.data;
        } catch (error) {
            logger.error(`Error getting GPU status:`, error.message);
            return null;
        }
    }

    async startModel(modelName) {
        try {
            const axiosConfig = {
                method: 'post',
                url: '/manage/model/start',
                data: { model: modelName }
            };
            this._applySidecar(axiosConfig);
            const response = await this.axiosInstance.request(axiosConfig);
            return response.data;
        } catch (error) {
            logger.error(`Error starting model ${modelName}:`, error.message);
            throw error;
        }
    }

    async stopModel(modelName) {
        try {
            const axiosConfig = {
                method: 'post',
                url: '/manage/model/stop',
                data: { model: modelName }
            };
            this._applySidecar(axiosConfig);
            const response = await this.axiosInstance.request(axiosConfig);
            return response.data;
        } catch (error) {
            logger.error(`Error stopping model ${modelName}:`, error.message);
            throw error;
        }
    }

    async getModelOptions() {
        try {
            const axiosConfig = {
                method: 'get',
                url: '/manage/models/summary'
            };
            this._applySidecar(axiosConfig);
            const response = await this.axiosInstance.request(axiosConfig);
            return response.data;
        } catch (error) {
            logger.error('Error getting model options:', error.message);
            return { models: [], total: 0 };
        }
    }

    async getCurrentModel() {
        try {
            const axiosConfig = {
                method: 'get',
                url: '/manage/models'
            };
            this._applySidecar(axiosConfig);
            const response = await this.axiosInstance.request(axiosConfig);
            const models = response.data;
            for (const [name, status] of Object.entries(models)) {
                if (status.running) {
                    return name;
                }
            }
            return null;
        } catch (error) {
            logger.error('Error getting current model:', error.message);
            return null;
        }
    }

    async _testModel(modelName, timeout = 30000) {
        const startTime = Date.now();
        const testRequestBody = {
            model: modelName,
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1,
            stream: false
        };

        try {
            const response = await Promise.race([
                this.callApi('/v1/chat/completions', testRequestBody),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Test timeout')), timeout)
                )
            ]);

            if (response && response.choices && response.choices.length > 0) {
                logger.info(`Model ${modelName} test successful in ${Date.now() - startTime}ms`);
                return { success: true, latency: Date.now() - startTime };
            }
            return { success: false, error: 'Invalid response' };
        } catch (error) {
            logger.error(`Model ${modelName} test failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async switchModel(targetModelName, options = {}) {
        const { 
            testAfterSwitch = true, 
            rollbackOnFailure = true, 
            testTimeout = 30000,
            maxRetries = 2 
        } = options;

        const startTime = Date.now();
        const currentModel = await this.getCurrentModel();
        
        logger.info(`Switching model from ${currentModel || 'none'} to ${targetModelName}`);

        const result = {
            success: false,
            targetModel: targetModelName,
            previousModel: currentModel,
            steps: [],
            testResult: null,
            rollbackPerformed: false,
            error: null,
            duration: 0
        };

        let retries = 0;
        let lastError = null;

        while (retries <= maxRetries) {
            try {
                result.steps.push({ 
                    step: 'switching', 
                    message: `Attempting to switch to ${targetModelName} (attempt ${retries + 1}/${maxRetries + 1})` 
                });

                const switchResponse = await this.callApi(
                    '/manage/models/switch', 
                    { model: targetModelName },
                    false,
                    0
                );

                if (!switchResponse || switchResponse.status !== 'switched') {
                    throw new Error(switchResponse?.error || 'Switch command failed');
                }

                result.steps.push({ step: 'switched', message: `Model switched to ${targetModelName}` });

                if (testAfterSwitch) {
                    result.steps.push({ step: 'testing', message: `Testing ${targetModelName}...` });

                    const waitInterval = 2000;
                    const maxWaitTime = 60000;
                    let waited = 0;
                    let testSuccess = false;

                    while (waited < maxWaitTime) {
                        const testResult = await this._testModel(targetModelName, testTimeout);
                        
                        if (testResult.success) {
                            testSuccess = true;
                            result.testResult = testResult;
                            break;
                        }

                        if (waited >= maxWaitTime - waitInterval) {
                            throw new Error(`Model test failed after ${maxWaitTime}ms: ${testResult.error}`);
                        }

                        await new Promise(resolve => setTimeout(resolve, waitInterval));
                        waited += waitInterval;
                    }

                    if (!testSuccess) {
                        throw new Error('Model test failed');
                    }

                    result.steps.push({ 
                        step: 'test_passed', 
                        message: `Model ${targetModelName} test passed in ${result.testResult.latency}ms` 
                    });
                }

                result.success = true;
                result.duration = Date.now() - startTime;
                logger.info(`Successfully switched to ${targetModelName} in ${result.duration}ms`);
                return result;

            } catch (error) {
                lastError = error;
                result.error = error.message;
                result.steps.push({ step: 'failed', message: error.message });

                if (rollbackOnFailure && currentModel && currentModel !== targetModelName) {
                    result.steps.push({ 
                        step: 'rollback', 
                        message: `Switch failed, rolling back to ${currentModel}` 
                    });

                    try {
                        await this.callApi(
                            '/manage/models/switch', 
                            { model: currentModel },
                            false,
                            0
                        );

                        await new Promise(resolve => setTimeout(resolve, 3000));

                        const rollbackTest = await this._testModel(currentModel, 15000);
                        if (rollbackTest.success) {
                            result.rollbackPerformed = true;
                            result.steps.push({ 
                                step: 'rollback_success', 
                                message: `Successfully rolled back to ${currentModel}` 
                            });
                            logger.info(`Successfully rolled back to ${currentModel}`);
                        } else {
                            result.steps.push({ 
                                step: 'rollback_failed', 
                                message: `Rollback to ${currentModel} failed: ${rollbackTest.error}` 
                            });
                            logger.error(`Rollback to ${currentModel} failed:`, rollbackTest.error);
                        }
                    } catch (rollbackError) {
                        result.steps.push({ 
                            step: 'rollback_failed', 
                            message: `Rollback to ${currentModel} failed: ${rollbackError.message}` 
                        });
                        logger.error(`Rollback to ${currentModel} failed:`, rollbackError.message);
                    }
                }

                retries++;
                if (retries <= maxRetries) {
                    const delay = Math.pow(2, retries) * 1000;
                    result.steps.push({ 
                        step: 'retry', 
                        message: `Retrying in ${delay}ms (attempt ${retries + 1})` 
                    });
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        result.duration = Date.now() - startTime;
        result.error = lastError?.message || 'Unknown error';
        logger.error(`Failed to switch to ${targetModelName} after ${maxRetries + 1} attempts:`, result.error);
        return result;
    }
}