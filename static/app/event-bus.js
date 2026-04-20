// 全局事件总线系统 - 用于协调各模块间的数据更新通知

export class EventBus {
    constructor() {
        this._listeners = {};
        this._pendingUpdates = {};
        this._debounceTimers = {};
    }

    /**
     * 注册事件监听器
     * @param {string} eventName - 事件名称
     * @param {Function} callback - 回调函数
     * @param {Object} options - 选项（可选）
     */
    on(eventName, callback, options = {}) {
        if (!this._listeners[eventName]) {
            this._listeners[eventName] = [];
        }
        
        const listener = {
            callback,
            once: options.once || false,
            debounce: options.debounce || 0
        };
        
        this._listeners[eventName].push(listener);
        return () => this.off(eventName, callback);
    }

    /**
     * 移除事件监听器
     * @param {string} eventName - 事件名称
     * @param {Function} callback - 回调函数
     */
    off(eventName, callback) {
        if (!this._listeners[eventName]) return;
        
        this._listeners[eventName] = this._listeners[eventName].filter(
            listener => listener.callback !== callback
        );
    }

    /**
     * 触发事件
     * @param {string} eventName - 事件名称
     * @param {*} data - 事件数据
     */
    emit(eventName, data = null) {
        if (!this._listeners[eventName]) return;

        const listeners = this._listeners[eventName];
        
        listeners.forEach((listener, index) => {
            if (listener.debounce > 0) {
                this._handleDebounced(eventName, listener, data, index);
            } else {
                this._executeCallback(eventName, listener, data);
                
                if (listener.once) {
                    listeners.splice(index, 1);
                }
            }
        });
    }

    _handleDebounced(eventName, listener, data, index) {
        const key = `${eventName}-${index}`;
        
        if (this._debounceTimers[key]) {
            clearTimeout(this._debounceTimers[key]);
        }
        
        this._debounceTimers[key] = setTimeout(() => {
            this._executeCallback(eventName, listener, data);
            
            if (listener.once) {
                this._listeners[eventName].splice(index, 1);
            }
            
            delete this._debounceTimers[key];
        }, listener.debounce);
    }

    _executeCallback(eventName, listener, data) {
        try {
            listener.callback(data);
        } catch (error) {
            console.error(`[EventBus] Error executing callback for event "${eventName}":`, error);
        }
    }

    /**
     * 注册一次性监听器
     * @param {string} eventName - 事件名称
     * @param {Function} callback - 回调函数
     */
    once(eventName, callback) {
        return this.on(eventName, callback, { once: true });
    }

    /**
     * 注册带防抖的监听器
     * @param {string} eventName - 事件名称
     * @param {Function} callback - 回调函数
     * @param {number} debounceMs - 防抖时间（毫秒）
     */
    onDebounced(eventName, callback, debounceMs) {
        return this.on(eventName, callback, { debounce: debounceMs });
    }

    /**
     * 获取所有已注册的事件名称
     * @returns {string[]} 事件名称数组
     */
    getEventNames() {
        return Object.keys(this._listeners);
    }

    /**
     * 获取指定事件的监听器数量
     * @param {string} eventName - 事件名称
     * @returns {number} 监听器数量
     */
    getListenerCount(eventName) {
        return this._listeners[eventName]?.length || 0;
    }

    /**
     * 清除所有监听器
     */
    clearAll() {
        this._listeners = {};
        Object.values(this._debounceTimers).forEach(timer => clearTimeout(timer));
        this._debounceTimers = {};
    }
}

// 创建单例实例
export const eventBus = new EventBus();
window.eventBus = eventBus;

// 预定义事件名称常量
export const EVENTS = {
    // 配置相关
    CONFIG_UPDATED: 'configUpdated',
    CONFIG_RELOADED: 'configReloaded',
    
    // 提供商相关
    PROVIDERS_UPDATED: 'providersUpdated',
    PROVIDER_STATUS_CHANGED: 'providerStatusChanged',
    
    // 模型相关
    MODELS_UPDATED: 'modelsUpdated',
    MODEL_STATUS_CHANGED: 'modelStatusChanged',
    
    // 配置文件相关
    UPLOAD_CONFIG_UPDATED: 'uploadConfigUpdated',
    
    // 用量相关
    USAGE_UPDATED: 'usageUpdated',
    
    // 插件相关
    PLUGINS_UPDATED: 'pluginsUpdated',
    
    // 系统相关
    SYSTEM_INFO_UPDATED: 'systemInfoUpdated',
    HEALTH_STATUS_CHANGED: 'healthStatusChanged',
    
    // UI相关
    SECTION_CHANGED: 'sectionChanged',
    LOGIN_STATUS_CHANGED: 'loginStatusChanged',
    
    // 缓存相关
    CACHE_INVALIDATED: 'cacheInvalidated'
};

export default {
    EventBus,
    eventBus,
    EVENTS
};