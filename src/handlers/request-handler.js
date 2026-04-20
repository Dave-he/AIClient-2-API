/**
 * HTTP 请求处理器 (Request Handler)
 * 
 * 整个系统的请求入口，负责：
 * 1. CORS 头处理和预检请求
 * 2. 静态文件服务（Vue 新界面 + 旧界面）
 * 3. 插件路由分发
 * 4. UI API 请求处理（配置、提供商、日志等）
 * 5. 提供商路径重写（支持 /gemini-cli-oauth/v1/... 等路径格式）
 * 6. 认证流程（通过插件系统）
 * 7. 中间件流程（通过插件系统）
 * 8. API 请求分发
 * 
 * 提供商切换机制：
 * - 请求头：Model-Provider
 * - URL 路径首段：/gemini-cli-oauth/, /claude-custom/ 等
 * 
 * 处理流程：
 * Request → CORS → Static Files → Plugin Routes → UI API 
 *        → Provider Path Rewrite → Auth (Plugins) → Middleware (Plugins) 
 *        → Rate Limit → API Request → Response
 */

import deepmerge from 'deepmerge';
import logger from '../utils/logger.js';
import { handleError, getClientIp } from '../utils/common.js';
import { handleUIApiRequests, serveStaticFiles, serveVueFiles } from '../services/ui-manager.js';
import { handleAPIRequests } from '../services/api-manager.js';
import { getApiService, getProviderStatus } from '../services/service-manager.js';
import { getProviderPoolManager } from '../services/service-manager.js';
import { MODEL_PROVIDER } from '../utils/constants.js';
import { getRegisteredProviders, isRegisteredProvider } from '../providers/adapter.js';
import { countTokensAnthropic } from '../utils/token-utils.js';
import { PROMPT_LOG_FILENAME } from '../core/config-manager.js';
import { getPluginManager } from '../core/plugin-manager.js';
import { randomUUID } from 'crypto';
import { handleGrokAssetsProxy } from '../utils/grok-assets-proxy.js';
import { getMaxRequestSize, containsImageContent } from '../utils/network-utils.js';
import { getRateLimiter } from '../utils/rate-limiter.js';

const IMAGE_ENDPOINTS = ['/v1/chat/completions', '/v1/images/validate', '/v1/images/upload'];

function generateRequestId() {
    return randomUUID().slice(0, 8);
}

function parseRequestBody(req, config) {
    return new Promise((resolve, reject) => {
        const maxSize = getMaxRequestSize(config);
        let body = [];
        let totalSize = 0;
        
        req.on('data', chunk => {
            totalSize += chunk.length;
            if (totalSize > maxSize) {
                req.destroy(new Error(`Request size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`));
                reject(new Error(`Request size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`));
                return;
            }
            body.push(chunk);
        });
        
        req.on('end', () => {
            try {
                const buffer = Buffer.concat(body);
                const contentType = req.headers['content-type'] || '';
                
                if (contentType.includes('application/json')) {
                    const bodyStr = buffer.toString('utf8');
                    const parsed = bodyStr ? JSON.parse(bodyStr) : {};
                    if (containsImageContent(parsed)) {
                        logger.info(`[Image Request] Detected image content in request, size: ${totalSize} bytes`);
                    }
                    resolve(parsed);
                } else if (contentType.includes('multipart/form-data')) {
                    logger.info(`[Image Request] Multipart form data received, size: ${totalSize} bytes`);
                    resolve({ _rawBody: buffer, _contentType: contentType });
                } else {
                    resolve({ _rawBody: buffer, _contentType: contentType });
                }
            } catch (e) {
                reject(new Error('Invalid JSON in request body'));
            }
        });
        
        req.on('error', reject);
    });
}

/**
 * Main request handler. It authenticates the request, determines the endpoint type,
 * and delegates to the appropriate specialized handler function.
 * @param {Object} config - The server configuration
 * @param {Object} providerPoolManager - The provider pool manager instance
 * @returns {Function} - The request handler function
 */
export function createRequestHandler(config, providerPoolManager) {
    const pluginManager = getPluginManager();
    return async function requestHandler(req, res) {
        // Generate unique request ID and set it in logger context
        const clientIp = getClientIp(req);
        const requestId = `${clientIp}:${generateRequestId()}`;

        return logger.runWithContext(requestId, async () => {
            // Deep copy the config for each request to allow dynamic modification
            const currentConfig = deepmerge({}, config);
            currentConfig._pluginRequestId = requestId;
            
            // 计算当前请求的基础 URL
            const protocol = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
            const host = req.headers.host;
            currentConfig.requestBaseUrl = `${protocol}://${host}`;
            
            const requestUrl = new URL(req.url, `http://${req.headers.host}`);
            let path = requestUrl.pathname;
            const method = req.method;

            try {
                // Set CORS headers for all requests
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-goog-api-key, Model-Provider, X-Requested-With, Accept, Origin');
                res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours cache for preflight

                // Handle CORS preflight requests
                if (method === 'OPTIONS') {
                    res.writeHead(204);
                    res.end();
                    return;
                }

                // Serve Vue app files from vue-dist/ directory (new UI)
                if (path.startsWith('/vue/') || path === '/vue' || path === '/vue/index.html') {
                    const vuePath = path === '/vue' ? '/vue/index.html' : path;
                    const served = await serveVueFiles(vuePath, res);
                    if (served) return;
                }

                // Serve static files from static/ directory (old UI)
                // 只提供static目录下的旧界面静态文件
                if (path === '/' || path === '/index.html' || path === '/login.html' ||
                    path.startsWith('/static/') || path.startsWith('/app/') ||
                    path.startsWith('/components/') || path.startsWith('/assets/') || path === '/favicon.ico' ||
                    pluginManager.isPluginStaticPath(path)) {
                    const served = await serveStaticFiles(path, res, currentConfig);
                    if (served) return;
                }

                // 执行插件路由
                const pluginRouteHandled = await pluginManager.executeRoutes(method, path, req, res, currentConfig);
                if (pluginRouteHandled) return;

                const uiHandled = await handleUIApiRequests(method, path, req, res, currentConfig, providerPoolManager);
                if (uiHandled) return;

                // logger.info(`\n${new Date().toLocaleString()}`);
                logger.info(`[Server] Received request: ${req.method} http://${req.headers.host}${req.url}`);

                // Health check endpoint
                if (method === 'GET' && path === '/health') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: 'healthy',
                        timestamp: new Date().toISOString(),
                        provider: currentConfig.MODEL_PROVIDER
                    }));
                    return true;
                }

                // Grok assets proxy endpoint
                if (method === 'GET' && path === '/api/grok/assets') {
                    await handleGrokAssetsProxy(req, res, currentConfig, providerPoolManager);
                    return true;
                }

                // providers health endpoint
                // url params: provider[string], customName[string], unhealthRatioThreshold[float]
                // 支持provider, customName过滤记录 
                // 支持unhealthRatioThreshold控制不健康比例的阈值, 当unhealthyRatio超过阈值返回summaryHealthy: false
                if (method === 'GET' && path === '/provider_health') {
                    try {
                        const provider = requestUrl.searchParams.get('provider');
                        const customName = requestUrl.searchParams.get('customName');
                        let unhealthRatioThreshold = requestUrl.searchParams.get('unhealthRatioThreshold');
                        unhealthRatioThreshold = unhealthRatioThreshold === null ? 0.0001 : parseFloat(unhealthRatioThreshold);
                        let provideStatus = await getProviderStatus(currentConfig, { provider, customName });
                        let summaryHealth = true;
                        if (!isNaN(unhealthRatioThreshold)) {
                            summaryHealth = provideStatus.unhealthyRatio <= unhealthRatioThreshold;
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            timestamp: new Date().toISOString(),
                            items: provideStatus.providerPoolsSlim,
                            count: provideStatus.count,
                            unhealthyCount: provideStatus.unhealthyCount,
                            unhealthyRatio: provideStatus.unhealthyRatio,
                            unhealthySummeryMessage: provideStatus.unhealthySummeryMessage,
                            summaryHealth
                        }));
                        return true;
                    } catch (error) {
                        logger.info(`[Server] req provider_health error: ${error.message}`);
                        handleError(res, { status: 500, message: `Failed to get providers health: ${error.message}` }, currentConfig.MODEL_PROVIDER, null, req);
                        return;
                    }
                }

                // GPU status endpoint (for Local Model integration)
                if (method === 'GET' && path === '/manage/gpu') {
                    try {
                        const { getServiceAdapter, serviceInstances } = await import('../providers/adapter.js');
                        const { MODEL_PROVIDER } = await import('../utils/constants.js');
                        
                        let gpuStatus = null;
                        let error = null;
                        
                        const localConfig = { ...currentConfig, MODEL_PROVIDER: MODEL_PROVIDER.LOCAL_MODEL };
                        const providerKey = localConfig.uuid ? MODEL_PROVIDER.LOCAL_MODEL + localConfig.uuid : MODEL_PROVIDER.LOCAL_MODEL;
                        
                        if (serviceInstances[providerKey]) {
                            const adapter = serviceInstances[providerKey];
                            if (typeof adapter.getGPUStatus === 'function') {
                                gpuStatus = await adapter.getGPUStatus();
                            }
                        }
                        
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            timestamp: new Date().toISOString(),
                            gpuStatus,
                            error
                        }));
                        return true;
                    } catch (err) {
                        logger.error(`[Server] GPU status error: ${err.message}`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            timestamp: new Date().toISOString(),
                            gpuStatus: null,
                            error: err.message
                        }));
                        return true;
                    }
                }

                // Model management endpoints (for Local Model integration)
                if (method === 'POST' && path === '/manage/model/start') {
                    try {
                        const body = await parseRequestBody(req);
                        const modelName = body?.model;
                        
                        if (!modelName) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, error: 'Model name is required' }));
                            return true;
                        }
                        
                        const { getServiceAdapter, serviceInstances } = await import('../providers/adapter.js');
                        const { MODEL_PROVIDER } = await import('../utils/constants.js');
                        
                        const localConfig = { ...currentConfig, MODEL_PROVIDER: MODEL_PROVIDER.LOCAL_MODEL };
                        const providerKey = localConfig.uuid ? MODEL_PROVIDER.LOCAL_MODEL + localConfig.uuid : MODEL_PROVIDER.LOCAL_MODEL;
                        
                        if (serviceInstances[providerKey]) {
                            const adapter = serviceInstances[providerKey];
                            if (typeof adapter.startModel === 'function') {
                                const result = await adapter.startModel(modelName);
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ success: true, data: result }));
                                return true;
                            }
                        }
                        
                        res.writeHead(503, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Local model service not available' }));
                        return true;
                    } catch (err) {
                        logger.error(`[Server] Start model error: ${err.message}`);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: err.message }));
                        return true;
                    }
                }

                if (method === 'POST' && path === '/manage/model/stop') {
                    try {
                        const body = await parseRequestBody(req);
                        const modelName = body?.model;
                        
                        if (!modelName) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, error: 'Model name is required' }));
                            return true;
                        }
                        
                        const { getServiceAdapter, serviceInstances } = await import('../providers/adapter.js');
                        const { MODEL_PROVIDER } = await import('../utils/constants.js');
                        
                        const localConfig = { ...currentConfig, MODEL_PROVIDER: MODEL_PROVIDER.LOCAL_MODEL };
                        const providerKey = localConfig.uuid ? MODEL_PROVIDER.LOCAL_MODEL + localConfig.uuid : MODEL_PROVIDER.LOCAL_MODEL;
                        
                        if (serviceInstances[providerKey]) {
                            const adapter = serviceInstances[providerKey];
                            if (typeof adapter.stopModel === 'function') {
                                const result = await adapter.stopModel(modelName);
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ success: true, data: result }));
                                return true;
                            }
                        }
                        
                        res.writeHead(503, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Local model service not available' }));
                        return true;
                    } catch (err) {
                        logger.error(`[Server] Stop model error: ${err.message}`);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: err.message }));
                        return true;
                    }
                }


                // vLLM Model Management endpoints (via Node.js proxy)
                if (path.startsWith('/vllm/')) {
                    logger.info(`[Node Proxy] Handling vLLM request: ${method} ${path}`);
                    // These endpoints will be handled by handleAPIRequests
                    // No need to handle them here, they'll be routed through the API manager
                }

                // Handle API requests
                // Allow overriding MODEL_PROVIDER via request header
                const modelProviderHeader = req.headers['model-provider'];
                if (modelProviderHeader) {
                    if (isRegisteredProvider(modelProviderHeader)) {
                        currentConfig.MODEL_PROVIDER = modelProviderHeader;
                        logger.info(`[Config] MODEL_PROVIDER overridden by header to: ${currentConfig.MODEL_PROVIDER}`);
                    } else {
                        logger.warn(`[Config] Provider ${modelProviderHeader} in header is not available.`);
                        handleError(res, { status: 400, message: `Provider ${modelProviderHeader} in header is not available.` }, currentConfig.MODEL_PROVIDER, null, req);
                        return;
                    }
                }
                
                // Check if the first path segment matches a MODEL_PROVIDER and switch if it does
                const pathSegments = path.split('/').filter(segment => segment.length > 0);
                
                if (pathSegments.length > 0) {
                    const firstSegment = pathSegments[0];
                    const isValidProvider = isRegisteredProvider(firstSegment);
                    const isAutoMode = firstSegment === MODEL_PROVIDER.AUTO;

                    if (firstSegment && (isValidProvider || isAutoMode)) {
                        currentConfig.MODEL_PROVIDER = firstSegment;
                        logger.info(`[Config] MODEL_PROVIDER overridden by path segment to: ${currentConfig.MODEL_PROVIDER}`);
                        pathSegments.shift();
                        path = '/' + pathSegments.join('/');
                        requestUrl.pathname = path;
                    } else if (firstSegment && Object.values(MODEL_PROVIDER).includes(firstSegment)) {
                        // 如果在 MODEL_PROVIDER 中但没注册适配器，拦截并报错
                        logger.warn(`[Config] Provider ${firstSegment} is recognized but no adapter is registered.`);
                        handleError(res, { status: 400, message: `Provider ${firstSegment} is not available.` }, currentConfig.MODEL_PROVIDER, null, req);
                        return;
                    } else if (firstSegment && !isValidProvider) {
                        logger.info(`[Config] Ignoring invalid MODEL_PROVIDER in path segment: ${firstSegment}`);
                    }
                }

                // 1. 执行认证流程（只有 type='auth' 的插件参与）
                const authResult = await pluginManager.executeAuth(req, res, requestUrl, currentConfig);
                if (authResult.handled) {
                    // 认证插件已处理请求（如发送了错误响应）
                    return;
                }
                if (!authResult.authorized) {
                    // 没有认证插件授权，使用 handleError 返回 401
                    handleError(res, { status: 401, message: 'Unauthorized: API key is invalid or missing.' }, currentConfig.MODEL_PROVIDER, null, req);
                    return;
                }
                
                // 2. 执行普通中间件（type!='auth' 的插件）
                const middlewareResult = await pluginManager.executeMiddleware(req, res, requestUrl, currentConfig);
                if (middlewareResult.handled) {
                    // 中间件已处理请求
                    return;
                }

                // Handle count_tokens requests (Anthropic API compatible)
                if (path.includes('/count_tokens') && method === 'POST') {
                    try {
                        const body = await parseRequestBody(req);
                        logger.info(`[Server] Handling count_tokens request for model: ${body.model}`);

                        // Use common utility method directly
                        try {
                            const result = countTokensAnthropic(body);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(result));
                        } catch (tokenError) {
                            logger.warn(`[Server] Common countTokens failed, falling back: ${tokenError.message}`);
                            // Last resort: return 0
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ input_tokens: 0 }));
                        }
                        return true;
                    } catch (error) {
                        logger.error(`[Server] count_tokens error: ${error.message}`);
                        handleError(res, { status: 500, message: `Failed to count tokens: ${error.message}` }, currentConfig.MODEL_PROVIDER, null, req);
                        return;
                    }
                }

                try {
                    const rateLimiter = getRateLimiter();
                    const rateLimitResult = rateLimiter.checkLimit(req);

                    res.setHeader('X-RateLimit-Limit', rateLimitResult.limit);
                    res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining);
                    res.setHeader('X-RateLimit-Retry-After', rateLimitResult.retryAfter);

                    if (!rateLimitResult.allowed) {
                        handleError(res, { 
                            status: 429, 
                            message: rateLimitResult.message,
                            code: 'RATE_LIMIT_EXCEEDED',
                            details: {
                                retryAfter: rateLimitResult.retryAfter
                            }
                        }, currentConfig.MODEL_PROVIDER, null, req);
                        return;
                    }

                    // Handle API requests
                    const apiHandled = await handleAPIRequests(method, path, req, res, currentConfig, undefined, providerPoolManager, PROMPT_LOG_FILENAME);
                    if (apiHandled) return;

                    // Fallback for unmatched routes
                    handleError(res, { status: 404, message: 'Not Found' }, currentConfig.MODEL_PROVIDER, null, req);
                } catch (error) {
                    handleError(res, error, currentConfig.MODEL_PROVIDER, null, req);
                }
            } catch (error) {
                    logger.error(`[Server] Unhandled error in request handler: ${error.message}`, error);
                    try {
                        if (!res.headersSent) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                        }
                        res.end(JSON.stringify({ error: 'Internal Server Error' }));
                    } catch (e) {
                        logger.error(`[Server] Failed to send error response: ${e.message}`);
                        try {
                            if (res.destroy) {
                                res.destroy();
                            }
                        } catch (destroyErr) {
                            logger.error(`[Server] Failed to destroy response: ${destroyErr.message}`);
                        }
                    }
                } finally {
                    // Clear request context after request is complete
                    logger.clearRequestContext(requestId);
                }
            });
        };

    }
