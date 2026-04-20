export class MonitorCache {
    constructor() {
        this._cache = {};
        this._timestamps = {};
        this._fetching = {};
        this._callbacks = {};
        this._cacheTTL = 5000;
    }

    async getSummary(forceRefresh = false) {
        return this._getWithCache('/api/python/monitor/summary', 'summary', forceRefresh);
    }

    async getModelsStatus(forceRefresh = false) {
        return this._getWithCache('/api/python/models/status', 'modelsStatus', forceRefresh);
    }

    async getGpuStatus(forceRefresh = false) {
        return this._getWithCache('/api/python-gpu/status', 'gpuStatus', forceRefresh);
    }

    async getProvidersDynamic(forceRefresh = false) {
        return this._getWithCache('/api/providers/dynamic', 'providersDynamic', forceRefresh);
    }

    async getProvidersStatic(forceRefresh = false) {
        return this._getWithCache('/api/providers/static', 'providersStatic', forceRefresh);
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
            const response = await fetch(url, {
                method: 'GET',
                timeout: 10000
            });

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
}

export const monitorCache = new MonitorCache();
window.monitorCache = monitorCache;
