import axios from 'axios';
import logger from '../../utils/logger.js';
import * as http from 'http';
import * as https from 'https';
import { configureAxiosProxy, configureTLSSidecar } from '../../utils/proxy-utils.js';
import { isRetryableNetworkError, MODEL_PROVIDER } from '../../utils/common.js';

export class OpenAIApiService {
    constructor(config) {
        if (!config.OPENAI_API_KEY) {
            throw new Error("OpenAI API Key is required for OpenAIApiService.");
        }
        this.config = config;
        this.apiKey = config.OPENAI_API_KEY;
        this.baseUrl = config.OPENAI_BASE_URL;
        this.useSystemProxy = config?.USE_SYSTEM_PROXY_OPENAI ?? false;
        this.timeout = config.OPENAI_TIMEOUT || 300000;
        this.maxRetries = config.REQUEST_MAX_RETRIES || 3;
        this.baseDelay = config.REQUEST_BASE_DELAY || 1000;

        logger.info(`[OpenAI] Base URL: ${this.baseUrl}, System proxy ${this.useSystemProxy ? 'enabled' : 'disabled'}, Timeout: ${this.timeout}ms`);

        const httpAgent = new http.Agent({
            keepAlive: true,
            maxSockets: 100,
            maxFreeSockets: 5,
            timeout: this.timeout,
        });
        const httpsAgent = new https.Agent({
            keepAlive: true,
            maxSockets: 100,
            maxFreeSockets: 5,
            timeout: this.timeout,
        });

        const axiosConfig = {
            baseURL: this.baseUrl,
            httpAgent,
            httpsAgent,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'Accept': 'application/json, text/event-stream'
            },
            timeout: this.timeout,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        };
        
        if (!this.useSystemProxy) {
            axiosConfig.proxy = false;
        }
        
        configureAxiosProxy(axiosConfig, config, config.MODEL_PROVIDER || MODEL_PROVIDER.OPENAI_CUSTOM);
        
        this.axiosInstance = axios.create(axiosConfig);
    }

    _applySidecar(axiosConfig) {
        return configureTLSSidecar(axiosConfig, this.config, this.config.MODEL_PROVIDER || MODEL_PROVIDER.OPENAI_CUSTOM, this.baseUrl);
    }

    async callApi(endpoint, body, isRetry = false, retryCount = 0) {
        const maxRetries = this.maxRetries;
        const baseDelay = this.baseDelay;

        try {
            const axiosConfig = {
                method: 'post',
                url: endpoint,
                data: body,
                timeout: this.timeout,
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
                logger.error(`[OpenAI API] Received ${status}. API Key might be invalid or expired.`);
                throw error;
            }

            if (status === 429 && retryCount < maxRetries) {
                const retryAfter = error.response?.headers?.['retry-after'];
                const delay = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, retryCount);
                logger.warn(`[OpenAI API] Received 429 (Too Many Requests). Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.callApi(endpoint, body, isRetry, retryCount + 1);
            }

            if ((status >= 500 && status < 600) && retryCount < maxRetries) {
                const delay = baseDelay * Math.pow(2, retryCount);
                logger.warn(`[OpenAI API] Received ${status} server error. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.callApi(endpoint, body, isRetry, retryCount + 1);
            }

            if (isNetworkError && retryCount < maxRetries) {
                const delay = baseDelay * Math.pow(2, retryCount);
                const errorIdentifier = errorCode || errorMessage.substring(0, 50);
                logger.warn(`[OpenAI API] Network error (${errorIdentifier}). Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.callApi(endpoint, body, isRetry, retryCount + 1);
            }

            logger.error(`[OpenAI API] Error calling API (Status: ${status}, Code: ${errorCode}):`, errorMessage);
            throw error;
        }
    }

    async *streamApi(endpoint, body, isRetry = false, retryCount = 0) {
        const maxRetries = this.maxRetries;
        const baseDelay = this.baseDelay;
        let anyDataSent = false;

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
                    const line = buffer.substring(0, newlineIndex);
                    buffer = buffer.substring(newlineIndex + 1);

                    if (line.startsWith('data: ')) {
                        const jsonData = line.substring(6);
                        if (jsonData.trim() === '[DONE]') {
                            yield { type: 'done' };
                            return;
                        }
                        try {
                            const parsedChunk = JSON.parse(jsonData);
                            anyDataSent = true;
                            yield parsedChunk;
                        } catch (e) {
                            if (jsonData.trim()) {
                                anyDataSent = true;
                                yield { type: 'raw', data: jsonData.trim() };
                            }
                        }
                    } else if (line.startsWith('event: ')) {
                        const eventName = line.substring(7).trim();
                        yield { type: 'event', name: eventName };
                    } else if (line.startsWith('id: ') || line.startsWith('retry: ') || line.trim() === '') {
                        continue;
                    }
                }
            }
        } catch (error) {
            const status = error.response?.status;
            const errorCode = error.code;
            const errorMessage = error.message || '';
            const isNetworkError = isRetryableNetworkError(error);
            
            if (anyDataSent) {
                logger.warn(`[OpenAI API] Cannot retry stream - data already sent to client`);
                throw error;
            }

            if (status === 401 || status === 403) {
                logger.error(`[OpenAI API] Received ${status} during stream. API Key might be invalid or expired.`);
                throw error;
            }

            if (status === 429 && retryCount < maxRetries) {
                const retryAfter = error.response?.headers?.['retry-after'];
                const delay = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, retryCount);
                logger.warn(`[OpenAI API] Received 429 during stream. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                yield* this.streamApi(endpoint, body, isRetry, retryCount + 1);
                return;
            }

            if ((status >= 500 && status < 600) && retryCount < maxRetries) {
                const delay = baseDelay * Math.pow(2, retryCount);
                logger.warn(`[OpenAI API] Received ${status} server error during stream. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                yield* this.streamApi(endpoint, body, isRetry, retryCount + 1);
                return;
            }

            if (isNetworkError && retryCount < maxRetries) {
                const delay = baseDelay * Math.pow(2, retryCount);
                const errorIdentifier = errorCode || errorMessage.substring(0, 50);
                logger.warn(`[OpenAI API] Network error (${errorIdentifier}) during stream. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                yield* this.streamApi(endpoint, body, isRetry, retryCount + 1);
                return;
            }

            logger.error(`[OpenAI API] Error calling streaming API (Status: ${status}, Code: ${errorCode}):`, errorMessage);
            throw error;
        }
    }

    async generateContent(model, requestBody) {
        // 临时存储 monitorRequestId
        if (requestBody._monitorRequestId) {
            this.config._monitorRequestId = requestBody._monitorRequestId;
            delete requestBody._monitorRequestId;
        }
        if (requestBody._requestBaseUrl) {
            delete requestBody._requestBaseUrl;
        }

        return this.callApi('/chat/completions', requestBody);
    }

    async *generateContentStream(model, requestBody) {
        // 临时存储 monitorRequestId
        if (requestBody._monitorRequestId) {
            this.config._monitorRequestId = requestBody._monitorRequestId;
            delete requestBody._monitorRequestId;
        }
        if (requestBody._requestBaseUrl) {
            delete requestBody._requestBaseUrl;
        }

        yield* this.streamApi('/chat/completions', requestBody);
    }

    async listModels() {
        try {
            const response = await this.axiosInstance.get('/models');
            return response.data;
        } catch (error) {
            const status = error.response?.status;
            const data = error.response?.data;
            logger.error(`Error listing OpenAI models (Status: ${status}):`, data || error.message);
            throw error;
        }
    }
}

