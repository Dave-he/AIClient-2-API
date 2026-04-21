const LOG_LEVELS_ENUM = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  OFF: 4
};

let currentLogLevel = LOG_LEVELS_ENUM.INFO;

function shouldLog(level) {
  return level >= currentLogLevel;
}

function log(level, ...args) {
  if (!shouldLog(level)) return;
  
  const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
  const levelName = levelNames[level] || 'INFO';
  
  if (typeof console !== 'undefined') {
    const timestamp = new Date().toISOString();
    console[['log', 'log', 'warn', 'error'][level]](`[${timestamp}] [CACHE] [${levelName}]`, ...args);
  }
}

class CacheNode {
  constructor(key, value, ttl) {
    this.key = key;
    this.value = value;
    this.expireTime = ttl ? Date.now() + ttl : null;
    this.accessTime = Date.now();
    this.accessCount = 1;
  }
  
  isExpired() {
    return this.expireTime !== null && Date.now() > this.expireTime;
  }
  
  touch() {
    this.accessTime = Date.now();
    this.accessCount++;
  }
}

class MemoryCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 300000;
    this.cleanupInterval = options.cleanupInterval || 60000;
    
    this._startCleanup();
  }
  
  _startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this._cleanupExpired();
    }, this.cleanupInterval);
  }
  
  _cleanupExpired() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, node] of this.cache) {
      if (node.isExpired()) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      log(LOG_LEVELS_ENUM.DEBUG, `Cleaned ${cleaned} expired entries`);
    }
  }
  
  _evictLRU() {
    if (this.cache.size <= this.maxSize) return;
    
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].accessTime - b[1].accessTime);
    
    const toRemove = entries.slice(0, Math.floor(this.maxSize * 0.2));
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }
    
    log(LOG_LEVELS_ENUM.DEBUG, `Evicted ${toRemove.length} LRU entries`);
  }
  
  get(key) {
    const node = this.cache.get(key);
    
    if (!node) {
      log(LOG_LEVELS_ENUM.DEBUG, `Cache miss: ${key}`);
      return null;
    }
    
    if (node.isExpired()) {
      this.cache.delete(key);
      log(LOG_LEVELS_ENUM.DEBUG, `Cache expired: ${key}`);
      return null;
    }
    
    node.touch();
    log(LOG_LEVELS_ENUM.DEBUG, `Cache hit: ${key}`);
    return node.value;
  }
  
  set(key, value, ttl) {
    const effectiveTTL = ttl !== undefined ? ttl : this.defaultTTL;
    const node = new CacheNode(key, value, effectiveTTL);
    
    this.cache.set(key, node);
    this._evictLRU();
    
    log(LOG_LEVELS_ENUM.DEBUG, `Cache set: ${key} (TTL: ${effectiveTTL}ms)`);
  }
  
  delete(key) {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    
    if (existed) {
      log(LOG_LEVELS_ENUM.DEBUG, `Cache deleted: ${key}`);
    }
    
    return existed;
  }
  
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    log(LOG_LEVELS_ENUM.INFO, `Cache cleared: ${size} entries`);
  }
  
  has(key) {
    const node = this.cache.get(key);
    return node !== undefined && !node.isExpired();
  }
  
  get size() {
    return this.cache.size;
  }
  
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cache.clear();
  }
}

class StorageCache {
  constructor(storage) {
    this.storage = storage;
    this.keyPrefix = 'cache_';
  }
  
  _getKey(key) {
    return this.keyPrefix + key;
  }
  
  get(key) {
    const stored = this.storage.getItem(this._getKey(key));
    
    if (!stored) {
      return null;
    }
    
    try {
      const data = JSON.parse(stored);
      
      if (data.expireTime && Date.now() > data.expireTime) {
        this.delete(key);
        return null;
      }
      
      return data.value;
    } catch (e) {
      log(LOG_LEVELS_ENUM.ERROR, `Failed to parse cached data for ${key}:`, e);
      this.delete(key);
      return null;
    }
  }
  
  set(key, value, ttl) {
    const data = {
      value,
      expireTime: ttl ? Date.now() + ttl : null,
      timestamp: Date.now()
    };
    
    try {
      this.storage.setItem(this._getKey(key), JSON.stringify(data));
    } catch (e) {
      log(LOG_LEVELS_ENUM.WARN, `Failed to cache ${key}:`, e);
    }
  }
  
  delete(key) {
    this.storage.removeItem(this._getKey(key));
  }
  
  clear() {
    const keys = [];
    
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key && key.startsWith(this.keyPrefix)) {
        keys.push(key);
      }
    }
    
    for (const key of keys) {
      this.storage.removeItem(key);
    }
  }
  
  has(key) {
    const stored = this.storage.getItem(this._getKey(key));
    
    if (!stored) return false;
    
    try {
      const data = JSON.parse(stored);
      return !data.expireTime || Date.now() <= data.expireTime;
    } catch (e) {
      return false;
    }
  }
}

class IndexedDBCache {
  constructor() {
    this.db = null;
    this.ready = this._init();
    this.dbName = 'AppCacheDB';
    this.storeName = 'cache';
  }
  
  async _init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => {
        log(LOG_LEVELS_ENUM.WARN, 'IndexedDB not available, falling back to memory');
        resolve(false);
      };
      
      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(true);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('expireTime', 'expireTime', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }
  
  async get(key) {
    if (!await this.ready) return null;
    
    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);
      
      request.onsuccess = () => {
        const data = request.result;
        
        if (!data) {
          resolve(null);
          return;
        }
        
        if (data.expireTime && Date.now() > data.expireTime) {
          this.delete(key);
          resolve(null);
          return;
        }
        
        resolve(data.value);
      };
      
      request.onerror = () => {
        resolve(null);
      };
    });
  }
  
  async set(key, value, ttl) {
    if (!await this.ready) return;
    
    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const data = {
        key,
        value,
        expireTime: ttl ? Date.now() + ttl : null,
        timestamp: Date.now()
      };
      
      const request = store.put(data);
      
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }
  
  async delete(key) {
    if (!await this.ready) return;
    
    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }
  
  async clear() {
    if (!await this.ready) return;
    
    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }
  
  async has(key) {
    if (!await this.ready) return false;
    
    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);
      
      request.onsuccess = () => {
        const data = request.result;
        
        if (!data) {
          resolve(false);
          return;
        }
        
        const isExpired = data.expireTime && Date.now() > data.expireTime;
        
        if (isExpired) {
          this.delete(key);
          resolve(false);
        } else {
          resolve(true);
        }
      };
      
      request.onerror = () => resolve(false);
    });
  }
}

class MultiLevelCache {
  constructor(options = {}) {
    this.memory = new MemoryCache({
      maxSize: options.memoryMaxSize || 500,
      defaultTTL: options.memoryTTL || 60000
    });
    
    this.session = new StorageCache(sessionStorage);
    this.local = new StorageCache(localStorage);
    this.indexedDB = new IndexedDBCache();
    
    this.policies = {
      'api/system': { levels: ['memory'], ttl: 5000 },
      'api/providers': { levels: ['memory', 'session'], ttl: 60000 },
      'api/models': { levels: ['memory', 'session', 'local'], ttl: 300000 },
      'api/config': { levels: ['memory', 'session', 'local'], ttl: 180000 },
      'ui/theme': { levels: ['memory', 'local'], ttl: 86400000 },
      'ui/preferences': { levels: ['memory', 'local'], ttl: 604800000 }
    };
    
    this.defaultPolicy = { levels: ['memory'], ttl: 30000 };
  }
  
  _getPolicy(key) {
    for (const [pattern, policy] of Object.entries(this.policies)) {
      if (key.startsWith(pattern)) {
        return policy;
      }
    }
    return this.defaultPolicy;
  }
  
  async get(key) {
    const policy = this._getPolicy(key);
    
    for (const level of policy.levels) {
      let value;
      
      switch (level) {
        case 'memory':
          value = this.memory.get(key);
          if (value !== null) {
            log(LOG_LEVELS_ENUM.DEBUG, `Cache hit (memory): ${key}`);
            return value;
          }
          break;
        
        case 'session':
          value = this.session.get(key);
          if (value !== null) {
            log(LOG_LEVELS_ENUM.DEBUG, `Cache hit (session): ${key}`);
            this.memory.set(key, value, policy.ttl);
            return value;
          }
          break;
        
        case 'local':
          value = this.local.get(key);
          if (value !== null) {
            log(LOG_LEVELS_ENUM.DEBUG, `Cache hit (local): ${key}`);
            this.memory.set(key, value, policy.ttl);
            return value;
          }
          break;
        
        case 'indexedDB':
          value = await this.indexedDB.get(key);
          if (value !== null) {
            log(LOG_LEVELS_ENUM.DEBUG, `Cache hit (indexedDB): ${key}`);
            this.memory.set(key, value, policy.ttl);
            return value;
          }
          break;
      }
    }
    
    log(LOG_LEVELS_ENUM.DEBUG, `Cache miss: ${key}`);
    return null;
  }
  
  async set(key, value, ttl) {
    const policy = this._getPolicy(key);
    const effectiveTTL = ttl !== undefined ? ttl : policy.ttl;
    
    for (const level of policy.levels) {
      switch (level) {
        case 'memory':
          this.memory.set(key, value, effectiveTTL);
          break;
        
        case 'session':
          this.session.set(key, value, effectiveTTL);
          break;
        
        case 'local':
          this.local.set(key, value, effectiveTTL);
          break;
        
        case 'indexedDB':
          await this.indexedDB.set(key, value, effectiveTTL);
          break;
      }
    }
    
    log(LOG_LEVELS_ENUM.DEBUG, `Cache set: ${key} (levels: ${policy.levels.join(', ')})`);
  }
  
  async delete(key) {
    this.memory.delete(key);
    this.session.delete(key);
    this.local.delete(key);
    await this.indexedDB.delete(key);
    
    log(LOG_LEVELS_ENUM.DEBUG, `Cache deleted: ${key}`);
  }
  
  async clear() {
    this.memory.clear();
    this.session.clear();
    this.local.clear();
    await this.indexedDB.clear();
    
    log(LOG_LEVELS_ENUM.INFO, 'All cache levels cleared');
  }
  
  async has(key) {
    const policy = this._getPolicy(key);
    
    for (const level of policy.levels) {
      let exists;
      
      switch (level) {
        case 'memory':
          exists = this.memory.has(key);
          break;
        
        case 'session':
          exists = this.session.has(key);
          break;
        
        case 'local':
          exists = this.local.has(key);
          break;
        
        case 'indexedDB':
          exists = await this.indexedDB.has(key);
          break;
      }
      
      if (exists) return true;
    }
    
    return false;
  }
  
  get memorySize() {
    return this.memory.size;
  }
  
  destroy() {
    this.memory.destroy();
  }
}

const cacheManager = new MultiLevelCache();

function withCache(key, ttl) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      const cacheKey = typeof key === 'function' ? key(...args) : key;
      const cached = await cacheManager.get(cacheKey);
      
      if (cached !== null) {
        return cached;
      }
      
      const result = await originalMethod.apply(this, args);
      await cacheManager.set(cacheKey, result, ttl);
      
      return result;
    };
    
    return descriptor;
  };
}

function withCacheSync(key, ttl) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(...args) {
      const cacheKey = typeof key === 'function' ? key(...args) : key;
      const cached = cacheManager.memory.get(cacheKey);
      
      if (cached !== null) {
        return cached;
      }
      
      const result = originalMethod.apply(this, args);
      cacheManager.memory.set(cacheKey, result, ttl);
      
      return result;
    };
    
    return descriptor;
  };
}

export { cacheManager, withCache, withCacheSync, MultiLevelCache, MemoryCache };
