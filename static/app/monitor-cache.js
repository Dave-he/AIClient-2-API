export class MonitorCache {
    constructor() {
        this._cache = {};
        this._timestamps = {};
        this._fetching = {};
        this._callbacks = {};
        this._cacheTTL = 5000;
        this._preloadedData = {};
    }

    async getSummary(forceRefresh = false) {
        return this._getWithCache('/api/python/monitor/summary', 'summary', forceRefresh);
    }

    async getDashboardSummary(forceRefresh = false) {
        return this._getWithCache('/api/dashboard/summary', 'dashboardSummary', forceRefresh);
    }

    async getModelsSummary(forceRefresh = false) {
        return this._getWithCache('/api/python/models/summary', 'modelsSummary', forceRefresh);
    }

    async getModelsStatus(forceRefresh = false) {
        return this._getWithCache('/api/python/models/status', 'modelsStatus', forceRefresh);
    }

    async getGpuStatus(forceRefresh = false) {
        return this._getWithCache('/api/python-gpu/status', 'gpuStatus', forceRefresh);
    }

    async getServiceStatus(forceRefresh = false) {
        return this._getWithCache('/api/python-gpu/service/status', 'serviceStatus', forceRefresh);
    }

    async getHealth(forceRefresh = false) {
        return this._getWithCache('/api/python/health', 'health', forceRefresh);
    }

    async getQueueStatus(forceRefresh = false) {
        return this._getWithCache('/api/python/queue/status', 'queueStatus', forceRefresh);
    }

    async getGpuConfig(forceRefresh = false) {
        return this._getWithCache('/api/python-gpu/config', 'gpuConfig', forceRefresh);
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
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
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