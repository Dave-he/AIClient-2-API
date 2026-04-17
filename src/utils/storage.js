class StorageManager {
  constructor() {
    this.storage = localStorage;
    this.listeners = new Map();
    this.enabled = this.checkStorage();
  }

  checkStorage() {
    try {
      const key = '__storage_test__';
      this.storage.setItem(key, key);
      this.storage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  get(key, defaultValue = null) {
    if (!this.enabled) return defaultValue;
    
    try {
      const value = this.storage.getItem(key);
      if (value === null) return defaultValue;
      
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch {
      return defaultValue;
    }
  }

  set(key, value) {
    if (!this.enabled) return false;
    
    try {
      const oldValue = this.get(key);
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      this.storage.setItem(key, serialized);
      this.notifyChange(key, oldValue, value);
      return true;
    } catch {
      return false;
    }
  }

  remove(key) {
    if (!this.enabled) return false;
    
    try {
      const oldValue = this.get(key);
      this.storage.removeItem(key);
      this.notifyChange(key, oldValue, undefined);
      return true;
    } catch {
      return false;
    }
  }

  clear() {
    if (!this.enabled) return false;
    
    try {
      this.storage.clear();
      return true;
    } catch {
      return false;
    }
  }

  has(key) {
    if (!this.enabled) return false;
    
    try {
      return this.storage.getItem(key) !== null;
    } catch {
      return false;
    }
  }

  keys() {
    if (!this.enabled) return [];
    
    try {
      const keys = [];
      for (let i = 0; i < this.storage.length; i++) {
        keys.push(this.storage.key(i));
      }
      return keys;
    } catch {
      return [];
    }
  }

  length() {
    if (!this.enabled) return 0;
    
    try {
      return this.storage.length;
    } catch {
      return 0;
    }
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push(callback);
    
    return () => {
      const callbacks = this.listeners.get(key);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  notifyChange(key, oldValue, newValue) {
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback({ key, oldValue, newValue });
        } catch (e) {
          console.error('Storage callback error:', e);
        }
      });
    }
  }

  debounceSet(key, value, delay = 100) {
    if (!this.enabled) return false;
    
    const debounceKey = `__debounce_${key}`;
    const existingTimeout = this.get(debounceKey);
    
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    const timeoutId = setTimeout(() => {
      this.set(key, value);
      this.remove(debounceKey);
    }, delay);
    
    this.set(debounceKey, timeoutId);
    return true;
  }
}

class SessionStorageManager extends StorageManager {
  constructor() {
    super();
    this.storage = sessionStorage;
  }
}

export const storage = new StorageManager();
export const sessionStorageManager = new SessionStorageManager();

export const useStorage = (key, defaultValue = null) => {
  const value = storage.get(key, defaultValue);
  
  const setValue = (newValue) => {
    storage.set(key, newValue);
  };
  
  const removeValue = () => {
    storage.remove(key);
  };
  
  return [value, setValue, removeValue];
};

export default storage;