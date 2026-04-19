import { existsSync, readFileSync } from 'fs';
import path from 'path';
import http from 'http';

// Import UI modules
import * as auth from '../ui-modules/auth.js';
import * as configApi from '../ui-modules/config-api.js';
import * as providerApi from '../ui-modules/provider-api.js';
import * as usageApi from '../ui-modules/usage-api.js';
import * as pluginApi from '../ui-modules/plugin-api.js';
import * as uploadConfigApi from '../ui-modules/upload-config-api.js';
import * as systemApi from '../ui-modules/system-api.js';
import * as updateApi from '../ui-modules/update-api.js';
import * as oauthApi from '../ui-modules/oauth-api.js';
import * as customModelsApi from '../ui-modules/custom-models-api.js';
import * as pythonControllerApi from '../ui-modules/python-controller-api.js';
import * as eventBroadcast from '../ui-modules/event-broadcast.js';

// Re-export from event-broadcast module
export { broadcastEvent, initializeUIManagement, handleUploadOAuthCredentials, upload } from '../ui-modules/event-broadcast.js';

import { getStats as getModelUsageStats } from '../plugins/model-usage-stats/stats-manager.js';

/**
 * Serve Vue app files from vue-dist directory
 * @param {string} pathParam - The request path (e.g., /vue/index.html)
 * @param {http.ServerResponse} res - The HTTP response object
 */
export async function serveVueFiles(pathParam, res) {
    let filePath;
    
    const strippedPath = pathParam.replace('/vue/', '');
    filePath = path.join(process.cwd(), 'vue-dist', strippedPath || 'index.html');

    if (existsSync(filePath)) {
        const ext = path.extname(filePath);
        const contentType = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.ico': 'image/x-icon',
            '.svg': 'image/svg+xml',
            '.json': 'application/json',
            '.wasm': 'application/wasm'
        }[ext] || 'text/plain';

        const content = readFileSync(filePath);

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
        return true;
    }
    return false;
}

/**
 * Serve static files for the UI
 * @param {string} pathParam - The request path
 * @param {http.ServerResponse} res - The HTTP response object
 * @param {Object} [currentConfig] - The current configuration object (optional)
 */
export async function serveStaticFiles(pathParam, res, currentConfig = {}) {
    const staticPathPrefixes = ['/static/', '/assets/', '/app/', '/components/'];
    const isStaticPath = staticPathPrefixes.some(prefix => pathParam.startsWith(prefix)) ||
                         pathParam === '/' || pathParam === '/index.html' || pathParam === '/login.html' || pathParam === '/favicon.ico';

    if (!isStaticPath) {
        return false;
    }

    let filePath;

    if (pathParam === '/' || pathParam === '/index.html' || pathParam === '/login.html') {
        filePath = path.join(process.cwd(), 'static', pathParam === '/' ? 'index.html' : pathParam);
    } else {
        let strippedPath = pathParam;
        if (strippedPath.startsWith('/static/')) {
            strippedPath = strippedPath.replace('/static/', '');
        } else if (strippedPath.startsWith('/assets/')) {
            strippedPath = strippedPath.replace('/assets/', 'assets/');
        } else if (strippedPath.startsWith('/app/')) {
            strippedPath = strippedPath.replace('/app/', 'app/');
        } else if (strippedPath.startsWith('/components/')) {
            strippedPath = strippedPath.replace('/components/', 'components/');
        }
        filePath = path.join(process.cwd(), 'static', strippedPath);
    }

    if (existsSync(filePath)) {
        const ext = path.extname(filePath);
        const contentType = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.ico': 'image/x-icon',
            '.svg': 'image/svg+xml'
        }[ext] || 'text/plain';

        let content = readFileSync(filePath);

        if (ext === '.html') {
            const controllerBaseUrl = currentConfig.CONTROLLER_BASE_URL || 'http://localhost:5000';
            content = content.toString().replace(
                /window\.CONTROLLER_BASE_URL = window\.CONTROLLER_BASE_URL \|\|[\s\S]*?'http:\/\/localhost:5000';/,
                `window.CONTROLLER_BASE_URL = '${controllerBaseUrl}';`
            );
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
        return true;
    }
    if (isStaticPath) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return true;
    }
    return false;
}

/**
 * Handle UI management API requests
 * @param {string} method - The HTTP method
 * @param {string} path - The request path
 * @param {http.IncomingMessage} req - The HTTP request object
 * @param {http.ServerResponse} res - The HTTP response object
 * @param {Object} currentConfig - The current configuration object
 * @param {Object} providerPoolManager - The provider pool manager instance
 * @returns {Promise<boolean>} - True if the request was handled by UI API
 */
export async function handleUIApiRequests(method, pathParam, req, res, currentConfig, providerPoolManager) {
    // 处理登录接口
    if (method === 'POST' && pathParam === '/api/login') {
        return await auth.handleLoginRequest(req, res);
    }

    // 验证登录Token接口（用于前端检查登录状态）
    if (method === 'GET' && pathParam === '/api/validate-token') {
        return await auth.handleValidateToken(req, res);
    }

    // 健康检查接口（用于前端token验证）
    if (method === 'GET' && pathParam === '/api/health') {
        return await systemApi.handleHealthCheck(req, res);
    }

    // Handle UI management API requests (需要token验证，除了登录接口、健康检查、Events接口和GPU状态接口)
    if (pathParam.startsWith('/api/') && pathParam !== '/api/login' && pathParam !== '/api/health' && pathParam !== '/api/events' && pathParam !== '/api/grok/assets' && pathParam !== '/api/python-gpu/status') {
        // 检查token验证
        const isAuth = await auth.checkAuth(req);
        if (!isAuth) {
            res.writeHead(401, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            });
            res.end(JSON.stringify({
                error: {
                    message: 'Unauthorized access, please login first',
                    code: 'UNAUTHORIZED'
                }
            }));
            return true;
        }
    }

    // 文件上传API
    if (method === 'POST' && pathParam === '/api/upload-oauth-credentials') {
        return await eventBroadcast.handleUploadOAuthCredentials(req, res);
    }

    // Update admin password
    if (method === 'POST' && pathParam === '/api/admin-password') {
        return await configApi.handleUpdateAdminPassword(req, res);
    }

    // Get configuration
    if (method === 'GET' && pathParam === '/api/config') {
        return await configApi.handleGetConfig(req, res, currentConfig);
    }

    // Update configuration
    if (method === 'POST' && pathParam === '/api/config') {
        return await configApi.handleUpdateConfig(req, res, currentConfig);
    }

    // Get system information
    if (method === 'GET' && pathParam === '/api/system') {
        return await systemApi.handleGetSystem(req, res);
    }

    // Download today's log file
    if (method === 'GET' && pathParam === '/api/system/download-log') {
        return await systemApi.handleDownloadTodayLog(req, res);
    }

    // Clear today's log file
    if (method === 'POST' && pathParam === '/api/system/clear-log') {
        return await systemApi.handleClearTodayLog(req, res);
    }

    // Get system monitor data
    if (method === 'GET' && pathParam === '/api/system/monitor') {
        return await systemApi.handleGetSystemMonitor(req, res);
    }

    // Get provider pools summary
    if (method === 'GET' && pathParam === '/api/providers') {
        return await providerApi.handleGetProviders(req, res, currentConfig, providerPoolManager);
    }

    // Get provider static data (supported provider types - cacheable)
    if (method === 'GET' && pathParam === '/api/providers/static') {
        return await providerApi.handleGetProvidersStatic(req, res, currentConfig, providerPoolManager);
    }

    // Get provider dynamic data (status, active requests - real-time)
    if (method === 'GET' && pathParam === '/api/providers/dynamic') {
        return await providerApi.handleGetProvidersDynamic(req, res, currentConfig, providerPoolManager);
    }

    // Get supported provider types based on registered adapters
    if (method === 'GET' && pathParam === '/api/providers/supported') {
        return await providerApi.handleGetSupportedProviders(req, res, currentConfig, providerPoolManager);
    }

    // Get specific provider type details
    const providerTypeMatch = pathParam.match(/^\/api\/providers\/([^\/]+)$/);
    if (method === 'GET' && providerTypeMatch) {
        const providerType = decodeURIComponent(providerTypeMatch[1]);
        return await providerApi.handleGetProviderType(req, res, currentConfig, providerPoolManager, providerType);
    }

    // Get available models for all providers or specific provider type
    if (method === 'GET' && pathParam === '/api/provider-models') {
        return await providerApi.handleGetProviderModels(req, res, currentConfig, providerPoolManager);
    }

    // Get available models for a specific provider type
    const providerModelsMatch = pathParam.match(/^\/api\/provider-models\/([^\/]+)$/);
    if (method === 'GET' && providerModelsMatch) {
        const providerType = decodeURIComponent(providerModelsMatch[1]);
        return await providerApi.handleGetProviderTypeModels(req, res, currentConfig, providerPoolManager, providerType);
    }

    // Add new provider configuration
    if (method === 'POST' && pathParam === '/api/providers') {
        return await providerApi.handleAddProvider(req, res, currentConfig, providerPoolManager);
    }

    // Reset all providers health status for a specific provider type
    // NOTE: This must be before the generic /{providerType}/{uuid} route to avoid matching 'reset-health' as UUID
    const resetHealthMatch = pathParam.match(/^\/api\/providers\/([^\/]+)\/reset-health$/);
    if (method === 'POST' && resetHealthMatch) {
        const providerType = decodeURIComponent(resetHealthMatch[1]);
        return await providerApi.handleResetProviderHealth(req, res, currentConfig, providerPoolManager, providerType);
    }

    // Perform health check for all providers of a specific type
    // NOTE: This must be before the generic /{providerType}/{uuid} route to avoid matching 'health-check' as UUID
    const healthCheckMatch = pathParam.match(/^\/api\/providers\/([^\/]+)\/health-check$/);
    if (method === 'POST' && healthCheckMatch) {
        const providerType = decodeURIComponent(healthCheckMatch[1]);
        return await providerApi.handleHealthCheck(req, res, currentConfig, providerPoolManager, providerType);
    }

    // Detect available models for a specific provider node
    const detectModelsMatch = pathParam.match(/^\/api\/providers\/([^\/]+)\/([^\/]+)\/detect-models$/);
    if (method === 'POST' && detectModelsMatch) {
        const providerType = decodeURIComponent(detectModelsMatch[1]);
        const providerUuid = detectModelsMatch[2];
        return await providerApi.handleDetectProviderModels(req, res, currentConfig, providerPoolManager, providerType, providerUuid);
    }

    // Perform health check for a specific provider node
    const singleHealthCheckMatch = pathParam.match(/^\/api\/providers\/([^\/]+)\/([^\/]+)\/health-check$/);
    if (method === 'POST' && singleHealthCheckMatch) {
        const providerType = decodeURIComponent(singleHealthCheckMatch[1]);
        const providerUuid = singleHealthCheckMatch[2];
        return await providerApi.handleSingleProviderHealthCheck(req, res, currentConfig, providerPoolManager, providerType, providerUuid);
    }

    // Delete all unhealthy providers for a specific type
    // NOTE: This must be before the generic /{providerType}/{uuid} route to avoid matching 'delete-unhealthy' as UUID
    const deleteUnhealthyMatch = pathParam.match(/^\/api\/providers\/([^\/]+)\/delete-unhealthy$/);
    if (method === 'DELETE' && deleteUnhealthyMatch) {
        const providerType = decodeURIComponent(deleteUnhealthyMatch[1]);
        return await providerApi.handleDeleteUnhealthyProviders(req, res, currentConfig, providerPoolManager, providerType);
    }

    // Refresh UUIDs for all unhealthy providers of a specific type
    // NOTE: This must be before the generic /{providerType}/{uuid} route to avoid matching 'refresh-unhealthy-uuids' as UUID
    const refreshUnhealthyUuidsMatch = pathParam.match(/^\/api\/providers\/([^\/]+)\/refresh-unhealthy-uuids$/);
    if (method === 'POST' && refreshUnhealthyUuidsMatch) {
        const providerType = decodeURIComponent(refreshUnhealthyUuidsMatch[1]);
        return await providerApi.handleRefreshUnhealthyUuids(req, res, currentConfig, providerPoolManager, providerType);
    }

    // Disable/Enable specific provider configuration
    const disableEnableProviderMatch = pathParam.match(/^\/api\/providers\/([^\/]+)\/([^\/]+)\/(disable|enable)$/);
    if (disableEnableProviderMatch) {
        const providerType = decodeURIComponent(disableEnableProviderMatch[1]);
        const providerUuid = disableEnableProviderMatch[2];
        const action = disableEnableProviderMatch[3];
        return await providerApi.handleDisableEnableProvider(req, res, currentConfig, providerPoolManager, providerType, providerUuid, action);
    }

    // Refresh UUID for specific provider configuration
    const refreshUuidMatch = pathParam.match(/^\/api\/providers\/([^\/]+)\/([^\/]+)\/refresh-uuid$/);
    if (method === 'POST' && refreshUuidMatch) {
        const providerType = decodeURIComponent(refreshUuidMatch[1]);
        const providerUuid = refreshUuidMatch[2];
        return await providerApi.handleRefreshProviderUuid(req, res, currentConfig, providerPoolManager, providerType, providerUuid);
    }

    // Update specific provider configuration
    // NOTE: This generic route must be after all specific routes like /reset-health, /health-check, /delete-unhealthy
    const updateProviderMatch = pathParam.match(/^\/api\/providers\/([^\/]+)\/([^\/]+)$/);
    if (method === 'PUT' && updateProviderMatch) {
        const providerType = decodeURIComponent(updateProviderMatch[1]);
        const providerUuid = updateProviderMatch[2];
        return await providerApi.handleUpdateProvider(req, res, currentConfig, providerPoolManager, providerType, providerUuid);
    }

    // Delete specific provider configuration
    if (method === 'DELETE' && updateProviderMatch) {
        const providerType = decodeURIComponent(updateProviderMatch[1]);
        const providerUuid = updateProviderMatch[2];
        return await providerApi.handleDeleteProvider(req, res, currentConfig, providerPoolManager, providerType, providerUuid);
    }

    // Generate OAuth authorization URL for providers
    const generateAuthUrlMatch = pathParam.match(/^\/api\/providers\/([^\/]+)\/generate-auth-url$/);
    if (method === 'POST' && generateAuthUrlMatch) {
        const providerType = decodeURIComponent(generateAuthUrlMatch[1]);
        return await oauthApi.handleGenerateAuthUrl(req, res, currentConfig, providerType);
    }

    // Handle manual OAuth callback
    if (method === 'POST' && pathParam === '/api/oauth/manual-callback') {
        return await oauthApi.handleManualOAuthCallback(req, res);
    }

    // Server-Sent Events for real-time updates
    if (method === 'GET' && pathParam === '/api/events') {
        return await eventBroadcast.handleEvents(req, res);
    }

    // Get upload configuration files list
    if (method === 'GET' && pathParam === '/api/upload-configs') {
        return await uploadConfigApi.handleGetUploadConfigs(req, res, currentConfig, providerPoolManager);
    }

    // View specific configuration file
    const viewConfigMatch = pathParam.match(/^\/api\/upload-configs\/view\/(.+)$/);
    if (method === 'GET' && viewConfigMatch) {
        const filePath = decodeURIComponent(viewConfigMatch[1]);
        return await uploadConfigApi.handleViewConfigFile(req, res, filePath);
    }

    // Download specific configuration file
    const downloadConfigMatch = pathParam.match(/^\/api\/upload-configs\/download\/(.+)$/);
    if (method === 'GET' && downloadConfigMatch) {
        const filePath = decodeURIComponent(downloadConfigMatch[1]);
        return await uploadConfigApi.handleDownloadConfigFile(req, res, filePath);
    }

    // Delete specific configuration file
    const deleteConfigMatch = pathParam.match(/^\/api\/upload-configs\/delete\/(.+)$/);
    if (method === 'DELETE' && deleteConfigMatch) {
        const filePath = decodeURIComponent(deleteConfigMatch[1]);
        return await uploadConfigApi.handleDeleteConfigFile(req, res, filePath);
    }

    // Force expire specific configuration file
    const forceExpireConfigMatch = pathParam.match(/^\/api\/upload-configs\/force-expire\/(.+)$/);
    if (method === 'POST' && forceExpireConfigMatch) {
        const filePath = decodeURIComponent(forceExpireConfigMatch[1]);
        return await uploadConfigApi.handleForceExpireConfig(req, res, filePath, currentConfig, providerPoolManager);
    }

    // Download all configs as zip
    if (method === 'GET' && pathParam === '/api/upload-configs/download-all') {
        return await uploadConfigApi.handleDownloadAllConfigs(req, res);
    }

    // Delete all unbound config files
    if (method === 'DELETE' && pathParam === '/api/upload-configs/delete-unbound') {
        return await uploadConfigApi.handleDeleteUnboundConfigs(req, res, currentConfig, providerPoolManager);
    }

    // Quick link config to corresponding provider based on directory
    if (method === 'POST' && pathParam === '/api/quick-link-provider') {
        return await providerApi.handleQuickLinkProvider(req, res, currentConfig, providerPoolManager);
    }

    // Get usage limits for all providers
    if (method === 'GET' && pathParam === '/api/usage') {
        return await usageApi.handleGetUsage(req, res, currentConfig, providerPoolManager);
    }

    // Get supported providers for usage query
    if (method === 'GET' && pathParam === '/api/usage/supported-providers') {
        return await usageApi.handleGetSupportedProviders(req, res);
    }

    // Get usage limits for a specific provider type
    const usageProviderMatch = pathParam.match(/^\/api\/usage\/([^\/]+)$/);
    if (method === 'GET' && usageProviderMatch) {
        const providerType = decodeURIComponent(usageProviderMatch[1]);
        return await usageApi.handleGetProviderUsage(req, res, currentConfig, providerPoolManager, providerType);
    }

    // Get aggregate usage stats (totalRequests, totalTokens, etc.) from model-usage-stats
    if (method === 'GET' && pathParam === '/api/usage/stats') {
        return await handleGetUsageStats(req, res);
    }

    // Check for updates - compare local VERSION with latest git tag
    if (method === 'GET' && pathParam === '/api/check-update') {
        return await updateApi.handleCheckUpdate(req, res);
    }

    // Perform update - git fetch and checkout to latest tag
    if (method === 'POST' && pathParam === '/api/update') {
        return await updateApi.handlePerformUpdate(req, res);
    }

    // Reload configuration files
    if (method === 'POST' && pathParam === '/api/reload-config') {
        return await configApi.handleReloadConfig(req, res, providerPoolManager);
    }

    // Restart service (worker process)
    if (method === 'POST' && pathParam === '/api/restart-service') {
        return await systemApi.handleRestartService(req, res);
    }

    // Get service mode information
    if (method === 'GET' && pathParam === '/api/service-mode') {
        return await systemApi.handleGetServiceMode(req, res);
    }

    // Batch import Kiro refresh tokens with SSE (real-time progress)
    if (method === 'POST' && pathParam === '/api/kiro/batch-import-tokens') {
        return await oauthApi.handleBatchImportKiroTokens(req, res);
    }

    if (method === 'POST' && pathParam === '/api/gemini/batch-import-tokens') {
        return await oauthApi.handleBatchImportGeminiTokens(req, res);
    }

    if (method === 'POST' && pathParam === '/api/codex/batch-import-tokens') {
        return await oauthApi.handleBatchImportCodexTokens(req, res);
    }

    // Import AWS SSO credentials for Kiro
    if (method === 'POST' && pathParam === '/api/kiro/import-aws-credentials') {
        return await oauthApi.handleImportAwsCredentials(req, res);
    }

    // Get plugins list
    if (method === 'GET' && pathParam === '/api/plugins') {
        return await pluginApi.handleGetPlugins(req, res);
    }

    // Toggle plugin status
    const togglePluginMatch = pathParam.match(/^\/api\/plugins\/(.+)\/toggle$/);
    if (method === 'POST' && togglePluginMatch) {
        const pluginName = decodeURIComponent(togglePluginMatch[1]);
        return await pluginApi.handleTogglePlugin(req, res, pluginName);
    }

    // Custom models management
    if (method === 'GET' && pathParam === '/api/custom-models') {
        return await customModelsApi.handleGetCustomModels(req, res, currentConfig);
    }

    if (method === 'POST' && pathParam === '/api/custom-models') {
        return await customModelsApi.handleAddCustomModel(req, res, currentConfig);
    }

    const customModelMatch = pathParam.match(/^\/api\/custom-models\/(.+)$/);
    if (customModelMatch) {
        const modelId = decodeURIComponent(customModelMatch[1]);
        if (method === 'PUT') {
            return await customModelsApi.handleUpdateCustomModel(req, res, currentConfig, modelId);
        }
        if (method === 'DELETE') {
            return await customModelsApi.handleDeleteCustomModel(req, res, currentConfig, modelId);
        }
    }

    // Config hot reload API endpoints
    if (method === 'GET' && pathParam === '/api/hot-reload/status') {
        return await configApi.handleHotReloadStatus(req, res);
    }

    if (method === 'POST' && pathParam === '/api/hot-reload/update') {
        return await configApi.handleHotReloadUpdate(req, res);
    }

    if (method === 'POST' && pathParam === '/api/hot-reload/reload-all') {
        return await configApi.handleHotReloadReloadAll(req, res);
    }

    if (method === 'GET' && pathParam === '/api/hot-reload/audit-log') {
        return await configApi.handleHotReloadAuditLog(req, res);
    }

    if (method === 'POST' && pathParam === '/api/hot-reload/invalidate-adapter') {
        return await configApi.handleHotReloadInvalidateAdapter(req, res);
    }

    // Python Controller API - VLLM Models Management
    // Get available VLLM models
    if (method === 'GET' && pathParam === '/api/python/vllm/models') {
        return await pythonControllerApi.handleGetVLLMModels(req, res);
    }

    // Get model status
    if (method === 'GET' && pathParam === '/api/python/models/status') {
        return await pythonControllerApi.handleGetModelStatus(req, res);
    }

    // Start model
    const startModelMatch = pathParam.match(/^\/api\/python\/models\/([^\/]+)\/start$/);
    if (method === 'POST' && startModelMatch) {
        const modelName = decodeURIComponent(startModelMatch[1]);
        return await pythonControllerApi.handleStartModel(req, res, modelName);
    }

    // Stop model
    const stopModelMatch = pathParam.match(/^\/api\/python\/models\/([^\/]+)\/stop$/);
    if (method === 'POST' && stopModelMatch) {
        const modelName = decodeURIComponent(stopModelMatch[1]);
        return await pythonControllerApi.handleStopModel(req, res, modelName);
    }

    // Switch model (one-click model switching)
    const switchModelMatch = pathParam.match(/^\/api\/python\/models\/([^\/]+)\/switch$/);
    if (method === 'POST' && switchModelMatch) {
        const modelName = decodeURIComponent(switchModelMatch[1]);
        return await pythonControllerApi.handleSwitchModel(req, res, modelName);
    }

    // Get GPU status via Python controller
    if (method === 'GET' && pathParam === '/api/python/gpu/status') {
        return await pythonControllerApi.handleGetGPUStatus(req, res);
    }

    // Get GPU history via Python controller
    if (method === 'GET' && pathParam.startsWith('/api/python/gpu/history')) {
        return await pythonControllerApi.handleGetGPUHistory(req, res);
    }

    // Get queue status
    if (method === 'GET' && pathParam === '/api/python/queue/status') {
        return await pythonControllerApi.handleGetQueueStatus(req, res);
    }

    // Get health status
    if (method === 'GET' && pathParam === '/api/python/health') {
        return await pythonControllerApi.handleGetHealthStatus(req, res);
    }

    // Test model endpoint
    const testModelMatch = pathParam.match(/^\/api\/python\/test\/model\/([^\/]+)$/);
    if (method === 'POST' && testModelMatch) {
        const modelName = decodeURIComponent(testModelMatch[1]);
        return await pythonControllerApi.handleTestModel(req, res, modelName);
    }

    // Get model test report
    const testReportMatch = pathParam.match(/^\/api\/python\/test\/report\/([^\/]+)$/);
    if (method === 'GET' && testReportMatch) {
        const modelName = decodeURIComponent(testReportMatch[1]);
        return await pythonControllerApi.handleGetModelTestReport(req, res, modelName);
    }

    // Get all test reports
    if (method === 'GET' && pathParam === '/api/python/test/reports') {
        return await pythonControllerApi.handleGetAllTestReports(req, res);
    }

    // Switch and test model endpoint
    const switchAndTestMatch = pathParam.match(/^\/api\/python\/test\/model\/([^\/]+)\/switch-and-test$/);
    if (method === 'POST' && switchAndTestMatch) {
        const modelName = decodeURIComponent(switchAndTestMatch[1]);
        return await pythonControllerApi.handleSwitchAndTestModel(req, res, modelName);
    }

    // Run comparative analysis
    if (method === 'POST' && pathParam === '/api/python/test/comparative') {
        return await pythonControllerApi.handleRunComparativeAnalysis(req, res);
    }

    // Clear test reports
    if (method === 'DELETE' && pathParam === '/api/python/test/reports') {
        return await pythonControllerApi.handleClearTestReports(req, res);
    }

    // Get test status
    if (method === 'GET' && pathParam === '/api/python/test/status') {
        return await pythonControllerApi.handleGetTestStatus(req, res);
    }

    // Python GPU status proxy endpoint (legacy - kept for backward compatibility)
    if (method === 'GET' && pathParam === '/api/python-gpu/status') {
        return await handlePythonGpuStatus(req, res, currentConfig);
    }

    return false;
}

async function handlePythonGpuStatus(req, res, currentConfig) {
    const controllerBaseUrl = currentConfig.CONTROLLER_BASE_URL || 'http://192.168.7.103:5000';
    
    try {
        const pythonUrl = new URL('/manage/gpu', controllerBaseUrl);
        
        const response = await new Promise((resolve, reject) => {
            const options = {
                hostname: pythonUrl.hostname,
                port: pythonUrl.port,
                path: pythonUrl.pathname,
                method: 'GET',
                timeout: 5000
            };
            
            const proxyReq = http.request(options, (proxyRes) => {
                let data = '';
                proxyRes.on('data', (chunk) => {
                    data += chunk;
                });
                proxyRes.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve({
                            success: proxyRes.statusCode === 200,
                            ...jsonData
                        });
                    } catch {
                        resolve({
                            success: proxyRes.statusCode === 200,
                            rawData: data
                        });
                    }
                });
            });
            
            proxyReq.on('error', (e) => {
                reject(e);
            });
            
            proxyReq.on('timeout', () => {
                proxyReq.destroy();
                reject(new Error('Timeout'));
            });
            
            proxyReq.end();
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
        return true;
    } catch (error) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: error.message
        }));
        return true;
    }
}

async function handleGetUsageStats(req, res) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const range = url.searchParams.get('range') || 'day';

        const stats = await getModelUsageStats();

        const now = new Date();
        let startTime;
        switch (range) {
            case 'today':
                startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startTime = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'year':
                startTime = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        const startKey = startTime.toISOString().slice(0, 10);

        let filteredStats = stats;
        let hourlyData = [];
        if (stats.daily) {
            const dailyEntries = Object.entries(stats.daily)
                .filter(([date]) => date >= startKey)
                .sort(([a], [b]) => a.localeCompare(b));

            const aggregated = dailyEntries.reduce((acc, [, data]) => {
                acc.requestCount += data.requestCount || 0;
                acc.promptTokens += data.promptTokens || 0;
                acc.completionTokens += data.completionTokens || 0;
                acc.totalTokens += data.totalTokens || 0;
                acc.cachedTokens += data.cachedTokens || 0;
                return acc;
            }, { requestCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0 });

            filteredStats = { ...stats, summary: aggregated };
        }

        if (stats.hourly) {
            const hourStartKey = startKey + 'T';
            const hourEntries = Object.entries(stats.hourly)
                .filter(([hour]) => hour >= hourStartKey)
                .sort(([a], [b]) => a.localeCompare(b));
            hourlyData = hourEntries.map(([hour, data]) => ({
                hour: hour,
                tokens: data.totalTokens || 0
            }));
        }

        const totalRequests = filteredStats.summary?.requestCount || 0;
        const totalTokens = filteredStats.summary?.totalTokens || 0;
        const inputTokens = filteredStats.summary?.promptTokens || 0;
        const outputTokens = filteredStats.summary?.completionTokens || 0;

        const topModels = [];
        if (stats.providers) {
            for (const [provider, providerData] of Object.entries(stats.providers)) {
                if (providerData.models) {
                    for (const [model, modelData] of Object.entries(providerData.models)) {
                        topModels.push({
                            name: model,
                            provider: provider,
                            tokens: modelData.totalTokens || 0,
                            requests: modelData.requestCount || 0
                        });
                    }
                }
            }
        }
        topModels.sort((a, b) => b.tokens - a.tokens);
        const top5Models = topModels.slice(0, 5);

        const modelDistribution = top5Models.map(m => ({
            name: m.name,
            tokens: m.tokens
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            totalRequests,
            totalTokens,
            inputTokens,
            outputTokens,
            cost: 0,
            topModels: top5Models,
            hourlyData,
            modelDistribution,
            range
        }));
        return true;
    } catch (error) {
        logger.error('[UI API] Failed to get usage stats:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: { message: 'Failed to get usage stats: ' + error.message }
        }));
        return true;
    }
}
