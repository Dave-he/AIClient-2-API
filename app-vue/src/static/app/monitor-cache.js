export class MonitorCache {
    constructor() {
        this._cache = null;
        this._timestamp = 0;
        this._cacheTTL = 5000;
        this._fetching = false;
        this._callbacks = [];
    }

    async getSummary(forceRefresh = false) {
        const now = Date.now();
        
        if (!forceRefresh && this._cache && (now - this._timestamp) < this._cacheTTL) {
            return this._cache;
        }

        if (this._fetching) {
            return new Promise((resolve) => {
                this._callbacks.push(resolve);
            });
        }

        this._fetching = true;

        try {
            const response = await fetch('/api/python/monitor/summary', {
                method: 'GET',
                timeout: 10000
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.success) {
                this._cache = data;
                this._timestamp = Date.now();
            }

            return data;
        } finally {
            this._fetching = false;
            this._callbacks.forEach(cb => cb(this._cache));
            this._callbacks = [];
        }
    }

    getCachedData() {
        return this._cache;
    }

    invalidateCache() {
        this._cache = null;
        this._timestamp = 0;
    }

    setTTL(ttl) {
        this._cacheTTL = ttl;
    }
}

export const monitorCache = new MonitorCache();
