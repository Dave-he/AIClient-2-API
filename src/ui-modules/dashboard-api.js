import logger from '../utils/logger.js';
import { CONFIG } from '../core/config-manager.js';
import * as systemApi from './system-api.js';
import * as pythonControllerApi from './python-controller-api.js';
import { getStats as getModelUsageStats } from '../plugins/model-usage-stats/stats-manager.js';
import { getPluginManager } from '../core/plugin-manager.js';

const dashboardCache = {
    data: null,
    timestamp: 0,
    ttl: 10000
};

export async function invalidateDashboardCache() {
    dashboardCache.data = null;
    dashboardCache.timestamp = 0;
}

export async function handleGetDashboardSummary(req, res, currentConfig, providerPoolManager) {
    const now = Date.now();
    
    if (dashboardCache.data && (now - dashboardCache.timestamp) < dashboardCache.ttl) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
        res.end(JSON.stringify({
            ...dashboardCache.data,
            timestamp: now
        }));
        return true;
    }

    try {
        const [systemData, pythonSummary, tokenStats, providersStatic, providersDynamic] = await Promise.all([
            fetchSystemData(req),
            fetchPythonSummary(req),
            fetchTokenStats(req),
            fetchProvidersStatic(req, currentConfig, providerPoolManager),
            fetchProvidersDynamic(req, currentConfig, providerPoolManager)
        ]);

        const result = {
            success: true,
            timestamp: now,
            system: systemData,
            python: pythonSummary,
            tokenStats,
            providers: providersStatic,
            providersDynamic: providersDynamic,
            controllerUrl: pythonControllerApi.getControllerBaseUrl()
        };

        dashboardCache.data = result;
        dashboardCache.timestamp = now;

        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'MISS' });
        res.end(JSON.stringify(result));
    } catch (error) {
        logger.error('[Dashboard API] Error getting dashboard summary:', error);
        
        const fallbackResult = {
            success: true,
            timestamp: now,
            system: null,
            python: { success: false },
            tokenStats: null,
            providers: null,
            providersDynamic: null,
            controllerUrl: pythonControllerApi.getControllerBaseUrl()
        };

        try {
            fallbackResult.system = await fetchSystemData(req);
        } catch (e) {
            logger.warn('[Dashboard API] Failed to get fallback system data:', e.message);
        }

        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'FALLBACK' });
        res.end(JSON.stringify(fallbackResult));
    }
    return true;
}

async function fetchSystemData(req) {
    return new Promise((resolve) => {
        const mockRes = {
            writeHead: () => {},
            end: (data) => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    resolve(null);
                }
            }
        };
        systemApi.handleGetSystemMonitor(req, mockRes).then(() => {}).catch(() => resolve(null));
    });
}

async function fetchPythonSummary(req) {
    return new Promise((resolve) => {
        const mockRes = {
            writeHead: () => {},
            end: (data) => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch {
                    resolve({ success: false });
                }
            }
        };
        pythonControllerApi.handleGetMonitorSummary(req, mockRes).then(() => {}).catch(() => resolve({ success: false }));
    });
}

async function fetchTokenStats(req) {
    try {
        const pluginManager = getPluginManager();
        const modelUsageStatsPlugin = pluginManager.plugins.get('model-usage-stats');
        
        if (modelUsageStatsPlugin && modelUsageStatsPlugin._enabled !== false) {
            const stats = await getModelUsageStats();
            return {
                success: true,
                ...stats
            };
        }
        return { success: false, reason: 'Plugin not enabled' };
    } catch (error) {
        logger.warn('[Dashboard API] Failed to get token stats:', error.message);
        return { success: false, error: error.message };
    }
}

async function fetchProvidersStatic(req, currentConfig, providerPoolManager) {
    try {
        const mockRes = {
            writeHead: () => {},
            end: (data) => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch {
                    resolve(null);
                }
            }
        };
        
        let resolve;
        const promise = new Promise(r => resolve = r);
        
        const providerApi = await import('./provider-api.js');
        providerApi.handleGetProvidersStatic(req, mockRes, currentConfig, providerPoolManager)
            .then(() => {}).catch(() => resolve(null));
        
        return promise;
    } catch (error) {
        logger.warn('[Dashboard API] Failed to get providers static data:', error.message);
        return null;
    }
}

async function fetchProvidersDynamic(req, currentConfig, providerPoolManager) {
    try {
        const mockRes = {
            writeHead: () => {},
            end: (data) => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch {
                    resolve(null);
                }
            }
        };
        
        let resolve;
        const promise = new Promise(r => resolve = r);
        
        const providerApi = await import('./provider-api.js');
        providerApi.handleGetProvidersDynamic(req, mockRes, currentConfig, providerPoolManager)
            .then(() => {}).catch(() => resolve(null));
        
        return promise;
    } catch (error) {
        logger.warn('[Dashboard API] Failed to get providers dynamic data:', error.message);
        return null;
    }
}

export async function preloadDashboardData() {
    logger.info('[Dashboard API] Preloading dashboard data...');
    const startTime = Date.now();
    
    try {
        const mockReq = {
            headers: {},
            url: '/api/dashboard/summary'
        };
        
        const mockRes = {
            writeHead: () => {},
            end: (data) => {
                try {
                    const parsed = JSON.parse(data);
                    dashboardCache.data = parsed;
                    dashboardCache.timestamp = Date.now();
                } catch {}
            }
        };
        
        await handleGetDashboardSummary(mockReq, mockRes, CONFIG, null);
        
        const duration = Date.now() - startTime;
        logger.info(`[Dashboard API] Preload completed in ${duration}ms`);
        return { success: true, duration };
    } catch (error) {
        logger.warn('[Dashboard API] Preload failed:', error.message);
        return { success: false, error: error.message };
    }
}