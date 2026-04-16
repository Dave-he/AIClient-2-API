import axios from 'axios';
import logger from '../../utils/logger.js';
import * as http from 'http';
import * as https from 'https';
import { configureAxiosProxy, configureTLSSidecar } from '../../utils/proxy-utils.js';
import { isRetryableNetworkError, MODEL_PROVIDER } from '../../utils/common.js';

/**
 * ForwardApiService - A provider that forwards requests to a specified API endpoint.
 * Transparently passes all parameters and includes an API key in the headers.
 */
export class ForwardApiService {
    constructor(config) {
        if (!config.FORWARD_API_KEY) {
            throw new Error("API Key is required for ForwardApiService (FORWARD_API_KEY).");
        }
        if (!config.FORWARD_BASE_URL) {
            throw new Error("Base URL is required for ForwardApiService (FORWARD_BASE_URL).");
        }
        
        this.config = config;
        this.apiKey = config.FORWARD_API_KEY;
        this.baseUrl = config.FORWARD_BASE_URL;
        this.useSystemProxy = config?.USE_SYSTEM_PROXY_FORWARD ?? false;
        this.headerName = config?.FORWARD_HEADER_NAME || 'Authorization';
        this.headerValuePrefix = config?.FORWARD_HEADER_VALUE_PREFIX || 'Bearer ';
        this.timeout = config.FORWARD_TIMEOUT || 300000;
        this.maxRetries = config.REQUEST_MAX_RETRIES || 3;
        this.baseDelay = config.REQUEST_BASE_DELAY || 1000;
        this.maxDelay = config.REQUEST_MAX_DELAY || 30000; // 最大重试延迟，默认30秒

        logger.info(`[Forward] Base URL: ${this.baseUrl}, System proxy ${this.useSystemProxy ? 'enabled' : 'disabled'}, Timeout: ${this.timeout}ms`);

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

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
        };
        headers[this.headerName] = `${this.headerValuePrefix}${this.apiKey}`;

        const axiosConfig = {
            baseURL: this.baseUrl,
            httpAgent,
            httpsAgent,
            headers,
            timeout: this.timeout,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        };
        
        if (!this.useSystemProxy) {
            axiosConfig.proxy = false;
        }
        
        configureAxiosProxy(axiosConfig, config, config.MODEL_PROVIDER || MODEL_PROVIDER.FORWARD_API);
        
        this.axiosInstance = axios.create(axiosConfig);
    }

    _applySidecar(axiosConfig) {
        return configureTLSSidecar(axiosConfig, this.config, this.config.MODEL_PROVIDER || MODEL_PROVIDER.FORWARD_API, this.baseUrl);
    }

    async callApi(endpoint, body, isRetry = false, retryCount = 0) {
        const maxRetries = this.maxRetries;
        const baseDelay = this.baseDelay;
        const maxDelay = this.maxDelay;

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
                logger.error(`[Forward API] Received ${status}. API Key might be invalid or expired.`);
                throw error;
            }

            if (status === 429 && retryCount < maxRetries) {
                const retryAfter = error.response?.headers?.['retry-after'];
                const rawDelay = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, retryCount);
                const delay = Math.min(rawDelay, maxDelay);
                logger.warn(`[Forward API] Received 429 (Too Many Requests). Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.callApi(endpoint, body, isRetry, retryCount + 1);
            }

            if ((status >= 500 && status < 600) && retryCount < maxRetries) {
                const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
                logger.warn(`[Forward API] Received ${status} server error. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.callApi(endpoint, body, isRetry, retryCount + 1);
            }

            if (isNetworkError && retryCount < maxRetries) {
                const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
                const errorIdentifier = errorCode || errorMessage.substring(0, 50);
                logger.warn(`[Forward API] Network error (${errorIdentifier}). Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.callApi(endpoint, body, isRetry, retryCount + 1);
            }

            logger.error(`[Forward API] Error calling API (Status: ${status}, Code: ${errorCode}):`, errorMessage);
            throw error;
        }
    }

    async *streamApi(endpoint, body, isRetry = false, retryCount = 0) {
        const maxRetries = this.maxRetries;
        const baseDelay = this.baseDelay;
        const maxDelay = this.maxDelay;
        let anyDataSent = false;

        try {
            const axiosConfig = {
                method: 'post',
                url: endpoint,
                data: body,
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

                    if (line.startsWith('event: ')) {
                        const eventName = line.substring(7).trim();
                        yield { type: 'event', name: eventName };
                    } else if (line.startsWith('data: ')) {
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
                    } else if (line.startsWith('id: ')) {
                        continue;
                    } else if (line.startsWith('retry: ')) {
                        continue;
                    } else if (line.trim() === '') {
                        continue;
                    } else if (line.startsWith('error: ')) {
                        logger.error(`[Forward API] Stream error: ${line.substring(7)}`);
                    }
                }
            }
        } catch (error) {
            const status = error.response?.status;
            const errorCode = error.code;
            const errorMessage = error.message || '';
            const isNetworkError = isRetryableNetworkError(error);
            
            if (anyDataSent) {
                logger.warn(`[Forward API] Cannot retry stream - data already sent to client`);
                throw error;
            }

            if (status === 429 && retryCount < maxRetries) {
                const retryAfter = error.response?.headers?.['retry-after'];
                const delay = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, retryCount);
                logger.warn(`[Forward API] Stream received 429. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                yield* this.streamApi(endpoint, body, isRetry, retryCount + 1);
                return;
            }

            if ((status >= 500 && status < 600) && retryCount < maxRetries) {
                const delay = baseDelay * Math.pow(2, retryCount);
                logger.warn(`[Forward API] Stream received ${status} server error. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                yield* this.streamApi(endpoint, body, isRetry, retryCount + 1);
                return;
            }

            if (isNetworkError && retryCount < maxRetries) {
                const delay = baseDelay * Math.pow(2, retryCount);
                const errorIdentifier = errorCode || errorMessage.substring(0, 50);
                logger.warn(`[Forward API] Stream network error (${errorIdentifier}). Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                yield* this.streamApi(endpoint, body, isRetry, retryCount + 1);
                return;
            }

            logger.error(`[Forward API] Error calling streaming API (Status: ${status || errorCode}):`, errorMessage);
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

        // Transparently pass the endpoint if provided in requestBody, otherwise use default
        const endpoint = requestBody.endpoint || '';
        return this.callApi(endpoint, requestBody);
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

        const endpoint = requestBody.endpoint || '';
        yield* this.streamApi(endpoint, requestBody);
    }

    async listModels() {
        try {
            const axiosConfig = {
                method: 'get',
                url: '/models'
            };
            this._applySidecar(axiosConfig);
            const response = await this.axiosInstance.request(axiosConfig);
            return response.data;
        } catch (error) {
            logger.error(`Error listing Forward models:`, error.message);
            return { data: [] };
        }
    }
}
