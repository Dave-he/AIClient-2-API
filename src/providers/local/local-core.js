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
        
        this._modelSwitchLock = false;
        this._modelSwitchQueue = [];

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

        // 确保请求体中的 model 字段与传入的 model 一致
        requestBody.model = model;

        // 检查当前运行的模型
        const currentModel = await this.getCurrentModel();
        
        // 如果请求的模型未运行，尝试自动切换
        if (!currentModel || currentModel !== model) {
            logger.info(`[Local Model] Target model '${model}' is not running (current: '${currentModel || 'none'}'), attempting auto-switch...`);
            
            try {
                const switchResult = await this.switchModel(model, {
                    testAfterSwitch: true,
                    rollbackOnFailure: true,
                    testTimeout: 30000,
                    maxRetries: 1
                });
                
                if (!switchResult.success) {
                    logger.error(`[Local Model] Auto-switch to '${model}' failed: ${switchResult.error}`);
                    throw new Error(`Model '${model}' is not running and auto-switch failed: ${switchResult.error}`);
                }
                
                logger.info(`[Local Model] Successfully switched to '${model}', proceeding with request`);
            } catch (switchError) {
                logger.error(`[Local Model] Auto-switch to '${model}' failed:`, switchError.message);
                throw new Error(`Model '${model}' is not running and auto-switch failed: ${switchError.message}`);
            }
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

        // 确保请求体中的 model 字段与传入的 model 一致
        requestBody.model = model;

        // 检查当前运行的模型
        const currentModel = await this.getCurrentModel();
        
        // 如果请求的模型未运行，尝试自动切换
        if (!currentModel || currentModel !== model) {
            logger.info(`[Local Model] Target model '${model}' is not running (current: '${currentModel || 'none'}'), attempting auto-switch for stream...`);
            
            try {
                const switchResult = await this.switchModel(model, {
                    testAfterSwitch: true,
                    rollbackOnFailure: true,
                    testTimeout: 30000,
                    maxRetries: 1
                });
                
                if (!switchResult.success) {
                    logger.error(`[Local Model] Auto-switch to '${model}' failed: ${switchResult.error}`);
                    throw new Error(`Model '${model}' is not running and auto-switch failed: ${switchResult.error}`);
                }
                
                logger.info(`[Local Model] Successfully switched to '${model}', proceeding with stream request`);
            } catch (switchError) {
                logger.error(`[Local Model] Auto-switch to '${model}' failed:`, switchError.message);
                throw new Error(`Model '${model}' is not running and auto-switch failed: ${switchError.message}`);
            }
        }

        yield* this.streamApi('/v1/chat/completions', requestBody);
    }

    async listModels() {
        try {
            // 尝试获取所有可用模型列表（从 /manage/models）
            const axiosConfig = {
                method: 'get',
                url: '/manage/models'
            };
            this._applySidecar(axiosConfig);
            const response = await this.axiosInstance.request(axiosConfig);
            const models = response.data;
            
            // 将 Python controller 的模型列表转换为 OpenAI 格式
            const modelList = [];
            const now = Math.floor(Date.now() / 1000);
            
            for (const [modelName, status] of Object.entries(models)) {
                modelList.push({
                    id: modelName,
                    object: 'model',
                    created: now,
                    owned_by: 'local',
                    status: status.running ? 'running' : 'stopped',
                    preloaded: status.preloaded || false
                });
            }
            
            // 如果当前有运行的模型，将其排在前面
            modelList.sort((a, b) => {
                if (a.status === 'running' && b.status !== 'running') return -1;
                if (a.status !== 'running' && b.status === 'running') return 1;
                return a.id.localeCompare(b.id);
            });
            
            if (modelList.length > 0) {
                logger.info(`[Local Model] Found ${modelList.length} models (${modelList.filter(m => m.status === 'running').length} running)`);
            } else {
                logger.info('[Local Model] No models available');
            }
            
            return { object: 'list', data: modelList };
        } catch (error) {
            logger.error(`Error listing Local models:`, error.message);
            
            // 回退方案：只返回当前运行的模型
            try {
                const currentModel = await this.getCurrentModel();
                if (currentModel) {
                    return {
                        object: 'list',
                        data: [{
                            id: currentModel,
                            object: 'model',
                            created: Math.floor(Date.now() / 1000),
                            owned_by: 'local'
                        }]
                    };
                }
            } catch (fallbackError) {
                logger.error(`Fallback listModels also failed:`, fallbackError.message);
            }
            
            return { object: 'list', data: [] };
        }
    }

    async listRunningModels() {
        try {
            // 尝试获取所有可用模型列表（从 /manage/models）
            const axiosConfig = {
                method: 'get',
                url: '/manage/models'
            };
            this._applySidecar(axiosConfig);
            const response = await this.axiosInstance.request(axiosConfig);
            const models = response.data;
            
            // 将 Python controller 的模型列表转换为 OpenAI 格式，仅返回运行的模型
            const modelList = [];
            const now = Math.floor(Date.now() / 1000);
            
            for (const [modelName, status] of Object.entries(models)) {
                if (status.running) {
                    modelList.push({
                        id: modelName,
                        object: 'model',
                        created: now,
                        owned_by: 'local',
                        status: 'running',
                        preloaded: status.preloaded || false
                    });
                }
            }
            
            if (modelList.length > 0) {
                logger.info(`[Local Model] Found ${modelList.length} running models`);
            } else {
                logger.info('[Local Model] No running models available');
            }
            
            return { object: 'list', data: modelList };
        } catch (error) {
            logger.error(`Error listing running Local models:`, error.message);
            
            // 回退方案：只返回当前运行的模型
            try {
                const currentModel = await this.getCurrentModel();
                if (currentModel) {
                    return {
                        object: 'list',
                        data: [{
                            id: currentModel,
                            object: 'model',
                            created: Math.floor(Date.now() / 1000),
                            owned_by: 'local'
                        }]
                    };
                }
            } catch (fallbackError) {
                logger.error(`Fallback listRunningModels also failed:`, fallbackError.message);
            }
            
            return { object: 'list', data: [] };
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

    async _testConversation(modelName, timeout = 30000) {
        const startTime = Date.now();
        const conversationRequestBody = {
            model: modelName,
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'Hello, please respond with a short greeting.' }
            ],
            max_tokens: 50,
            stream: false
        };

        try {
            const response = await Promise.race([
                this.callApi('/v1/chat/completions', conversationRequestBody),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Conversation test timeout')), timeout)
                )
            ]);

            if (response && response.choices && response.choices.length > 0 && 
                response.choices[0].message && response.choices[0].message.content) {
                logger.info(`Model ${modelName} conversation test successful in ${Date.now() - startTime}ms`);
                return { 
                    success: true, 
                    latency: Date.now() - startTime,
                    response: response.choices[0].message.content.substring(0, 100)
                };
            }
            return { success: false, error: 'Invalid conversation response' };
        } catch (error) {
            logger.error(`Model ${modelName} conversation test failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async _preloadModel(modelName) {
        try {
            const preloadRequestBody = {
                model: modelName,
                messages: [{ role: 'user', content: 'preload' }],
                max_tokens: 1,
                stream: false
            };

            await this.callApi('/v1/chat/completions', preloadRequestBody);
            logger.info(`Model ${modelName} preloaded successfully`);
            return { success: true };
        } catch (error) {
            logger.error(`Model ${modelName} preload failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async switchModel(targetModelName, options = {}) {
        return new Promise((resolve) => {
            const request = {
                targetModelName,
                options,
                resolve
            };

            if (this._modelSwitchLock) {
                logger.info(`Model switch to ${targetModelName} queued: another switch is in progress`);
                this._modelSwitchQueue.push(request);
                return;
            }

            this._processModelSwitchQueue(request);
        });
    }

    async _processModelSwitchQueue(request) {
        const { targetModelName, options, resolve } = request;
        const { 
            testAfterSwitch = true, 
            rollbackOnFailure = true, 
            testTimeout = 30000,
            maxRetries = 2,
            autoConversation = true,
            preloadAfterTest = true
        } = options;

        this._modelSwitchLock = true;

        const startTime = Date.now();
        const currentModel = await this.getCurrentModel();
        
        logger.info(`Switching model from ${currentModel || 'none'} to ${targetModelName}`);

        const result = {
            success: false,
            targetModel: targetModelName,
            previousModel: currentModel,
            steps: [],
            testResult: null,
            conversationTestResult: null,
            preloadResult: null,
            rollbackPerformed: false,
            error: null,
            duration: 0
        };

        let retries = 0;
        let lastError = null;

        try {
            while (retries <= maxRetries) {
                try {
                    result.steps.push({ 
                        step: 'switching', 
                        message: `Attempting to switch to ${targetModelName} (attempt ${retries + 1}/${maxRetries + 1})` 
                    });

                    const switchResponse = await this.callApi(
                        `/manage/models/${targetModelName}/switch`, 
                        {},
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

                        if (autoConversation) {
                            result.steps.push({ step: 'conversation_test', message: `Running auto-conversation test for ${targetModelName}...` });
                            
                            try {
                                const conversationResult = await this._testConversation(targetModelName, testTimeout);
                                result.conversationTestResult = conversationResult;
                                
                                if (conversationResult.success) {
                                    result.steps.push({ 
                                        step: 'conversation_test_passed', 
                                        message: `Auto-conversation test passed in ${conversationResult.latency}ms` 
                                    });
                                } else {
                                    logger.warn(`[Local Model] Auto-conversation test failed: ${conversationResult.error}`);
                                    result.steps.push({ 
                                        step: 'conversation_test_warn', 
                                        message: `Auto-conversation test failed (non-fatal): ${conversationResult.error}` 
                                    });
                                }
                            } catch (convError) {
                                logger.warn(`[Local Model] Auto-conversation test error:`, convError.message);
                                result.steps.push({ 
                                    step: 'conversation_test_warn', 
                                    message: `Auto-conversation test error (non-fatal): ${convError.message}` 
                                });
                            }
                        }

                        if (preloadAfterTest) {
                            result.steps.push({ step: 'preloading', message: `Preloading ${targetModelName}...` });
                            
                            try {
                                const preloadResult = await this._preloadModel(targetModelName);
                                result.preloadResult = preloadResult;
                                
                                if (preloadResult.success) {
                                    result.steps.push({ 
                                        step: 'preload_success', 
                                        message: `Model ${targetModelName} preloaded successfully` 
                                    });
                                } else {
                                    logger.warn(`[Local Model] Preload failed: ${preloadResult.error}`);
                                    result.steps.push({ 
                                        step: 'preload_warn', 
                                        message: `Model preload failed (non-fatal): ${preloadResult.error}` 
                                    });
                                }
                            } catch (preloadError) {
                                logger.warn(`[Local Model] Preload error:`, preloadError.message);
                                result.steps.push({ 
                                    step: 'preload_warn', 
                                    message: `Model preload failed (non-fatal): ${preloadError.message}` 
                                });
                            }
                        }
                    }

                    result.success = true;
                    result.duration = Date.now() - startTime;
                    logger.info(`Successfully switched to ${targetModelName} in ${result.duration}ms`);
                    resolve(result);
                    return;

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
                                `/manage/models/${currentModel}/switch`, 
                                {},
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
            resolve(result);
        } finally {
            this._modelSwitchLock = false;
            this._processNextSwitchRequest();
        }
    }

    _processNextSwitchRequest() {
        if (this._modelSwitchQueue.length > 0) {
            const nextRequest = this._modelSwitchQueue.shift();
            logger.info(`Processing next queued model switch to ${nextRequest.targetModelName}`);
            this._processModelSwitchQueue(nextRequest);
        }
    }
}