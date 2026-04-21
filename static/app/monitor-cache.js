import { eventBus, EVENTS } from './event-bus.js';
import { API_PATHS } from './api-paths.js';

export class MonitorCache {
    constructor() {
        this._cache = {};
        this._timestamps = {};
        this._fetching = {};
        this._callbacks = {};
        this._cacheTTL = 10000;
        this._preloadedData = {};
        
        // 重试配置
        this._maxRetries = 3;
        this._initialTimeout = 2000;
        this._timeoutIncrement = 1000;
    }

    async getSummary(forceRefresh = false) {
        return this._getWithCache(API_PATHS.PYTHON.MONITOR.SUMMARY, 'summary', forceRefresh);
    }

    async getDashboardSummary(forceRefresh = false) {
        return this._getWithCache('/api/dashboard/summary', 'dashboardSummary', forceRefresh);
    }

    async getModelsSummary(forceRefresh = false) {
        return this._getWithCache(API_PATHS.PYTHON.MODELS.SUMMARY, 'modelsSummary', forceRefresh);
    }

    async getModelsStatus(forceRefresh = false) {
        return this._getWithCache(API_PATHS.PYTHON.MODELS.STATUS, 'modelsStatus', forceRefresh);
    }

    async getGpuStatus(forceRefresh = false) {
        const summary = await this.getSummary(forceRefresh);
        return summary?.gpu ? { success: true, ...summary.gpu } : null;
    }

    async getServiceStatus(forceRefresh = false) {
        const summary = await this.getSummary(forceRefresh);
        return summary?.service ? { success: true, ...summary.service } : null;
    }

    async getHealth(forceRefresh = false) {
        const summary = await this.getSummary(forceRefresh);
        return summary?.health ? { success: true, ...summary.health } : null;
    }

    async getQueueStatus(forceRefresh = false) {
        const summary = await this.getSummary(forceRefresh);
        return summary?.queue ? { success: true, queue: summary.queue } : null;
    }

    async getGpuConfig(forceRefresh = false) {
        return this._getWithCache(API_PATHS.PYTHON_GPU.CONFIG, 'gpuConfig', forceRefresh);
    }

    async getProvidersDynamic(forceRefresh = false) {
        return this._getWithCache('/api/providers/dynamic', 'providersDynamic', forceRefresh);
    }

    async getProvidersStatic(forceRefresh = false) {
        return this._getWithCache('/api/providers/static', 'providersStatic', forceRefresh);
    }

    async getSystemMonitor(forceRefresh = false) {
        return this._getWithCache('/api/system/monitor', 'systemMonitor', forceRefresh);
    }

    async getTokenUsage(range = 'hour', forceRefresh = false) {
        return this._getWithCache(`/api/usage/stats?range=${range}`, `tokenUsage_${range}`, forceRefresh);
    }

    async batchGet(keys, forceRefresh = false) {
        const results = {};
        const fetchPromises = [];

        for (const key of keys) {
            const method = this._getMethodForKey(key);
            if (method) {
                fetchPromises.push(
                    method.call(this, forceRefresh).then(data => {
                        results[key] = data;
                    }).catch(() => {
                        results[key] = null;
                    })
                );
            }
        }

        await Promise.all(fetchPromises);
        return results;
    }

    async preloadDashboardData() {
        const startTime = performance.now();
        
        try {
            const dashboardSummary = await this.getDashboardSummary(true);
            
            if (dashboardSummary && dashboardSummary.success) {
                if (dashboardSummary.system) {
                    this._cache['systemMonitor'] = dashboardSummary.system;
                    this._timestamps['systemMonitor'] = Date.now();
                }
                if (dashboardSummary.python) {
                    this._cache['summary'] = dashboardSummary.python;
                    this._timestamps['summary'] = Date.now();
                    
                    if (dashboardSummary.python.gpu) {
                        this._cache['gpuStatus'] = { success: true, ...dashboardSummary.python.gpu };
                        this._timestamps['gpuStatus'] = Date.now();
                    }
                    if (dashboardSummary.python.models) {
                        this._cache['modelsStatus'] = { success: true, models: dashboardSummary.python.models };
                        this._timestamps['modelsStatus'] = Date.now();
                    }
                    if (dashboardSummary.python.queue) {
                        this._cache['queueStatus'] = { success: true, queue: dashboardSummary.python.queue };
                        this._timestamps['queueStatus'] = Date.now();
                    }
                }
                if (dashboardSummary.providers) {
                    this._cache['providersStatic'] = dashboardSummary.providers;
                    this._timestamps['providersStatic'] = Date.now();
                }
            }

            this._preloadedData = dashboardSummary;
            this._preloadedData.preloadTime = performance.now() - startTime;
            
            return {
                success: true,
                duration: this._preloadedData.preloadTime,
                cachedKeys: Object.keys(this._cache)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                duration: performance.now() - startTime
            };
        }
    }

    _getMethodForKey(key) {
        const methodMap = {
            'summary': this.getSummary,
            'dashboardSummary': this.getDashboardSummary,
            'modelsSummary': this.getModelsSummary,
            'modelsStatus': this.getModelsStatus,
            'gpuStatus': this.getGpuStatus,
            'serviceStatus': this.getServiceStatus,
            'health': this.getHealth,
            'queueStatus': this.getQueueStatus,
            'gpuConfig': this.getGpuConfig,
            'providersDynamic': this.getProvidersDynamic,
            'providersStatic': this.getProvidersStatic,
            'systemMonitor': this.getSystemMonitor
        };
        return methodMap[key];
    }

    async _getWithCache(url, cacheKey, forceRefresh = false) {
        const now = Date.now();

        if (!forceRefresh && this._cache[cacheKey] && (now - this._timestamps[cacheKey]) < this._cacheTTL) {
            return this._cache[cacheKey];
        }

        if (this._fetching[cacheKey]) {
            return new Promise((resolve) => {
                if (!this._callbacks[cacheKey]) {
                    this._callbacks[cacheKey] = [];
                }
                this._callbacks[cacheKey].push(resolve);
            });
        }

        this._fetching[cacheKey] = true;

        try {
            const token = localStorage.getItem('authToken');
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const data = await this._fetchWithRetry(url, headers, cacheKey);
            
            this._cache[cacheKey] = data;
            this._timestamps[cacheKey] = Date.now();

            return data;
        } finally {
            this._fetching[cacheKey] = false;
            if (this._callbacks[cacheKey]) {
                this._callbacks[cacheKey].forEach(cb => cb(this._cache[cacheKey]));
                this._callbacks[cacheKey] = [];
            }
        }
    }

    async _fetchWithRetry(url, headers, cacheKey) {
        let lastError = null;
        
        for (let attempt = 0; attempt <= this._maxRetries; attempt++) {
            const timeout = this._initialTimeout + (attempt * this._timeoutIncrement);
            
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: headers,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                return data;
            } catch (error) {
                lastError = error;
                
                if (attempt < this._maxRetries) {
                    console.warn(`[MonitorCache] Request attempt ${attempt + 1} failed for ${cacheKey}: ${error.message}. Retrying in ${timeout}ms...`);
                    await this._delay(timeout);
                }
            }
        }
        
        console.error(`[MonitorCache] All ${this._maxRetries + 1} attempts failed for ${cacheKey}:`, lastError);
        throw lastError;
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getCachedData(cacheKey) {
        return this._cache[cacheKey];
    }

    getAllCachedData() {
        return { ...this._cache };
    }

    invalidateCache(cacheKey = null) {
        if (cacheKey) {
            delete this._cache[cacheKey];
            delete this._timestamps[cacheKey];
        } else {
            this._cache = {};
            this._timestamps = {};
        }
        
        eventBus.emit(EVENTS.CACHE_INVALIDATED, { cacheKey });
    }

    setTTL(ttl) {
        this._cacheTTL = ttl;
    }

    getPreloadedData() {
        return this._preloadedData;
    }

    isDataCached(cacheKey) {
        return !!this._cache[cacheKey] && 
               (Date.now() - this._timestamps[cacheKey]) < this._cacheTTL;
    }
}

export const monitorCache = new MonitorCache();
window.monitorCache = monitorCache;