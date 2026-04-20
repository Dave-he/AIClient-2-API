const requestCache = new Map();
const CACHE_DURATION = 30000;
const MAX_CACHE_SIZE = 100;

class CacheNode {
  constructor(key, value, duration) {
    this.key = key;
    this.value = value;
    this.timestamp = Date.now();
    this.duration = duration;
    this.accessTime = Date.now();
    this.hitCount = 0;
  }

  isExpired() {
    return Date.now() - this.timestamp > this.duration;
  }

  touch() {
    this.accessTime = Date.now();
    this.hitCount++;
  }
}

class RequestCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = MAX_CACHE_SIZE;
    this.defaultDuration = CACHE_DURATION;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
    this.hooks = {
      onHit: [],
      onMiss: [],
      onSet: [],
      onDelete: [],
      onEvict: []
    };
  }

  _emitHook(hookName, ...args) {
    this.hooks[hookName]?.forEach(hook => hook(...args));
  }

  _evictLRU(count = 1) {
    if (this.cache.size <= this.maxSize) return;

    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].accessTime - b[1].accessTime);

    const toEvict = entries.slice(0, count);
    for (const [key, node] of toEvict) {
      this.cache.delete(key);
      this.stats.evictions++;
      this._emitHook('onEvict', key, node.value);
    }
  }

  set(key, value, duration = this.defaultDuration) {
    const normalizedKey = this._normalizeKey(key);
    
    if (this.cache.size >= this.maxSize) {
      this._evictLRU(Math.floor(this.maxSize * 0.2));
    }

    const node = new CacheNode(normalizedKey, value, duration);
    this.cache.set(normalizedKey, node);
    this.stats.sets++;
    
    this._emitHook('onSet', normalizedKey, value, duration);
    return this;
  }

  get(key) {
    const normalizedKey = this._normalizeKey(key);
    const node = this.cache.get(normalizedKey);

    if (!node) {
      this.stats.misses++;
      this._emitHook('onMiss', normalizedKey);
      return null;
    }

    if (node.isExpired()) {
      this.cache.delete(normalizedKey);
      this.stats.misses++;
      this.stats.deletes++;
      this._emitHook('onMiss', normalizedKey, 'expired');
      return null;
    }

    node.touch();
    this.stats.hits++;
    this._emitHook('onHit', normalizedKey, node.value);
    return node.value;
  }

  has(key) {
    const normalizedKey = this._normalizeKey(key);
    const node = this.cache.get(normalizedKey);
    return node !== undefined && !node.isExpired();
  }

  delete(key) {
    const normalizedKey = this._normalizeKey(key);
    const node = this.cache.get(normalizedKey);
    
    if (node) {
      this.cache.delete(normalizedKey);
      this.stats.deletes++;
      this._emitHook('onDelete', normalizedKey, node.value);
      return true;
    }
    return false;
  }

  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this._emitHook('onClear', size);
    return size;
  }

  _normalizeKey(key) {
    if (typeof key === 'object') {
      try {
        return JSON.stringify(key);
      } catch {
        return String(key);
      }
    }
    return String(key);
  }

  get size() {
    return this.cache.size;
  }

  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2)
      : '0.00';
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      totalRequests: this.stats.hits + this.stats.misses,
      currentSize: this.cache.size,
      maxSize: this.maxSize
    };
  }

  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
  }

  on(event, callback) {
    if (this.hooks[event]) {
      this.hooks[event].push(callback);
    }
    return this;
  }

  off(event, callback) {
    if (this.hooks[event]) {
      const index = this.hooks[event].indexOf(callback);
      if (index > -1) {
        this.hooks[event].splice(index, 1);
      }
    }
    return this;
  }

  keys() {
    return Array.from(this.cache.keys());
  }

  values() {
    return Array.from(this.cache.values()).map(node => node.value);
  }

  entries() {
    return Array.from(this.cache.entries()).map(([key, node]) => ({
      key,
      value: node.value,
      timestamp: node.timestamp,
      duration: node.duration,
      accessTime: node.accessTime,
      hitCount: node.hitCount
    }));
  }

  prune() {
    const now = Date.now();
    let pruned = 0;
    
    for (const [key, node] of this.cache) {
      if (now - node.timestamp > node.duration) {
        this.cache.delete(key);
        pruned++;
        this.stats.deletes++;
      }
    }
    
    if (pruned > 0) {
      this._emitHook('onPrune', pruned);
    }
    return pruned;
  }

  setMaxSize(size) {
    this.maxSize = size;
    this._evictLRU();
    return this;
  }

  setDefaultDuration(duration) {
    this.defaultDuration = duration;
    return this;
  }
}

export const cache = new RequestCache();

class PendingRequests {
  constructor() {
    this.pending = new Map();
    this.timeout = 60000;
  }

  getKey(config) {
    const { method = 'GET', url = '', params = {}, data = {} } = config;
    
    const paramsKey = typeof params === 'object' 
      ? JSON.stringify(Object.keys(params).sort().reduce((acc, key) => {
          acc[key] = params[key];
          return acc;
        }, {}))
      : String(params);
    
    const dataKey = typeof data === 'object' && !Array.isArray(data)
      ? JSON.stringify(Object.keys(data).sort().reduce((acc, key) => {
          acc[key] = data[key];
          return acc;
        }, {}))
      : String(data);
    
    return `${method.toUpperCase()}:${url}:${paramsKey}:${dataKey}`;
  }

  add(key, promise) {
    this.pending.set(key, {
      promise,
      timestamp: Date.now(),
      timeoutId: setTimeout(() => {
        this.pending.delete(key);
      }, this.timeout)
    });
  }

  remove(key) {
    const entry = this.pending.get(key);
    if (entry) {
      clearTimeout(entry.timeoutId);
      this.pending.delete(key);
    }
  }

  has(key) {
    return this.pending.has(key);
  }

  get(key) {
    const entry = this.pending.get(key);
    return entry?.promise;
  }

  clear() {
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timeoutId);
    }
    this.pending.clear();
  }

  get size() {
    return this.pending.size;
  }

  setTimeout(timeout) {
    this.timeout = timeout;
    return this;
  }
}

export const pendingRequests = new PendingRequests();

export const requestConfig = {
  enableCache: true,
  enableDeduplication: true,
  defaultCacheDuration: CACHE_DURATION,
  cacheableMethods: ['get'],
  excludedPaths: [],
  maxCacheSize: MAX_CACHE_SIZE
};

export function configureRequest(config) {
  Object.assign(requestConfig, config);
  
  if (config.maxCacheSize !== undefined) {
    cache.setMaxSize(config.maxCacheSize);
  }
  if (config.defaultCacheDuration !== undefined) {
    cache.setDefaultDuration(config.defaultCacheDuration);
  }
}

export function isCacheable(config) {
  if (!requestConfig.enableCache) return false;
  
  const method = config.method?.toLowerCase();
  if (!requestConfig.cacheableMethods.includes(method)) return false;
  
  const url = config.url || '';
  return !requestConfig.excludedPaths.some(path => url.includes(path));
}

export function invalidateCache(pattern) {
  if (typeof pattern === 'string') {
    const keysToDelete = [];
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => cache.delete(key));
    return keysToDelete.length;
  } else if (pattern instanceof RegExp) {
    const keysToDelete = [];
    for (const key of cache.keys()) {
      if (pattern.test(key)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => cache.delete(key));
    return keysToDelete.length;
  } else {
    const size = cache.size;
    cache.clear();
    return size;
  }
}

export function getCacheStats() {
  return cache.getStats();
}

export function resetCacheStats() {
  cache.resetStats();
}

export function pruneCache() {
  return cache.prune();
}