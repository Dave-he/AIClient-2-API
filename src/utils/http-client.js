import logger from './logger.js';

export class HttpClient {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || '';
        this.defaultHeaders = options.defaultHeaders || {};
        this.defaultTimeout = options.defaultTimeout || 30000;
        this.defaultMaxRetries = options.defaultMaxRetries || 2;
        this.defaultRetryDelay = options.defaultRetryDelay || 1000;
        this.userAgent = options.userAgent || 'AIClient-2-API/1.0.0';
        this.onRequest = options.onRequest || null;
        this.onResponse = options.onResponse || null;
        this.onError = options.onError || null;
    }

    async request(method, path, options = {}) {
        const {
            body = null,
            headers = {},
            timeout = this.defaultTimeout,
            maxRetries = this.defaultMaxRetries,
            retryDelay = this.defaultRetryDelay,
            query = null,
            responseType = 'json',
            skipRetry = false
        } = options;

        const url = this._buildUrl(path, query);

        if (this.onRequest) {
            this.onRequest({ method, url, headers, body });
        }

        const controller = new AbortController();
        const timeoutId = timeout ? setTimeout(() => controller.abort(), timeout) : null;
        
        const fetchOptions = {
            method: method.toUpperCase(),
            headers: {
                'User-Agent': this.userAgent,
                ...this.defaultHeaders,
                ...headers
            },
            signal: controller.signal
        };

        if (body) {
            if (typeof body === 'object') {
                fetchOptions.body = JSON.stringify(body);
                if (!fetchOptions.headers['Content-Type']) {
                    fetchOptions.headers['Content-Type'] = 'application/json';
                }
            } else {
                fetchOptions.body = body;
            }
        }

        const executeRequest = async () => {
            const response = await fetch(url, fetchOptions);
            if (timeoutId) clearTimeout(timeoutId);
            return this._processResponse(response, responseType);
        };

        if (skipRetry || maxRetries <= 0) {
            try {
                const result = await executeRequest();
                if (this.onResponse) {
                    this.onResponse({ method, url, result });
                }
                return result;
            } catch (error) {
                if (timeoutId) clearTimeout(timeoutId);
                if (this.onError) {
                    this.onError({ method, url, error });
                }
                throw error;
            }
        }

        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await executeRequest();
                if (this.onResponse) {
                    this.onResponse({ method, url, result });
                }
                return result;
            } catch (error) {
                lastError = error;
                if (attempt < maxRetries && this._isRetryableError(error)) {
                    const delay = retryDelay * Math.pow(2, attempt - 1);
                    logger.warn(`[HttpClient] Retry ${attempt}/${maxRetries} for ${method} ${url}: ${error.message}`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        if (this.onError) {
            this.onError({ method, url, error: lastError });
        }
        throw lastError;
    }

    async get(path, options = {}) {
        return this.request('GET', path, options);
    }

    async post(path, body = null, options = {}) {
        return this.request('POST', path, { ...options, body });
    }

    async put(path, body = null, options = {}) {
        return this.request('PUT', path, { ...options, body });
    }

    async patch(path, body = null, options = {}) {
        return this.request('PATCH', path, { ...options, body });
    }

    async delete(path, options = {}) {
        return this.request('DELETE', path, options);
    }

    _buildUrl(path, query) {
        let url = this.baseUrl ? `${this.baseUrl}${path}` : path;
        
        if (query && typeof query === 'object') {
            const searchParams = new URLSearchParams(query);
            const separator = url.includes('?') ? '&' : '?';
            url += separator + searchParams.toString();
        }
        
        return url;
    }

    async _processResponse(response, responseType) {
        const { status, headers } = response;
        
        let data;
        try {
            switch (responseType.toLowerCase()) {
                case 'json':
                    data = status !== 204 ? await response.json() : null;
                    break;
                case 'text':
                    data = await response.text();
                    break;
                case 'blob':
                    data = await response.blob();
                    break;
                case 'formdata':
                    data = await response.formData();
                    break;
                default:
                    data = status !== 204 ? await response.json() : null;
            }
        } catch (error) {
            logger.error(`[HttpClient] Failed to parse response: ${error.message}`);
            data = null;
        }

        if (!response.ok) {
            const error = new Error(data?.message || `HTTP error! status: ${status}`);
            error.status = status;
            error.response = { data, headers };
            throw error;
        }

        return {
            data,
            status,
            headers: this._headersToObject(headers),
            response
        };
    }

    _headersToObject(headers) {
        const result = {};
        headers.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }

    _isRetryableError(error) {
        if (error.name === 'AbortError') {
            return true;
        }
        if (error.status && (error.status >= 500 || error.status === 429)) {
            return true;
        }
        const retryableMessages = ['ECONNRESET', 'ECONNREFUSED', 'ENETUNREACH', 'ETIMEDOUT', 'fetch failed'];
        return retryableMessages.some(msg => error.message?.includes(msg));
    }

    setDefaultHeaders(headers) {
        this.defaultHeaders = { ...this.defaultHeaders, ...headers };
    }

    setBaseUrl(baseUrl) {
        this.baseUrl = baseUrl;
    }
}

export function createHttpClient(options = {}) {
    return new HttpClient(options);
}

const defaultClient = new HttpClient();

export function httpGet(path, options = {}) {
    return defaultClient.get(path, options);
}

export function httpPost(path, body = null, options = {}) {
    return defaultClient.post(path, body, options);
}

export function httpPut(path, body = null, options = {}) {
    return defaultClient.put(path, body, options);
}

export function httpDelete(path, options = {}) {
    return defaultClient.delete(path, options);
}