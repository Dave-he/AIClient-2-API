import logger from './logger.js';
import { CONFIG } from '../core/config-manager.js';
import { serviceInstances, invalidateServiceAdapter } from '../providers/adapter.js';
import { getProviderPoolManager } from '../services/service-manager.js';
import { getAlertManager, sendSystemErrorAlert } from './alert-manager.js';

export const CONFIG_UPDATE_EVENT = {
    CONFIG_CHANGED: 'config_changed',
    PROVIDER_POOL_CHANGED: 'provider_pool_changed',
    MODEL_CONFIG_CHANGED: 'model_config_changed',
    RELOAD_COMPLETED: 'reload_completed'
};

export const HOT_RELOADABLE_CONFIGS = [
    'LOG_LEVEL',
    'LOG_OUTPUT_MODE',
    'REQUEST_MAX_RETRIES',
    'REQUEST_BASE_DELAY',
    'CRON_NEAR_MINUTES',
    'CRON_REFRESH_TOKEN',
    'MAX_ERROR_COUNT',
    'SCHEDULED_HEALTH_CHECK',
    'providerFallbackChain',
    'modelFallbackMapping',
    'PROXY_URL',
    'PROXY_ENABLED_PROVIDERS',
    'HEALTH_ALERT_WEBHOOK_URL',
    'ALERT_DINGTALK_WEBHOOK',
    'ALERT_WECOM_WEBHOOK',
    'WARMUP_TARGET',
    'REFRESH_CONCURRENCY_PER_PROVIDER',
    'REFRESH_CONCURRENCY_GLOBAL',
    'REFRESH_BUFFER_DELAY',
    'REFRESH_TASK_TIMEOUT_MS'
];

export class ConfigHotReloader {
    constructor() {
        this.listeners = new Map();
        this.pendingChanges = [];
        this.isReloading = false;
        this.lastReloadTime = null;
        this.auditLog = [];
        this.maxAuditLogSize = 100;
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    async emit(event, data) {
        const callbacks = this.listeners.get(event) || [];
        for (const callback of callbacks) {
            try {
                await callback(data);
            } catch (error) {
                logger.error(`[ConfigHotReloader] Error in event handler for ${event}:`, error.message);
            }
        }
    }

    async updateConfig(updates, options = {}) {
        const { persist = true, skipValidation = false, forceReload = false } = options;
        
        const changes = [];
        const errors = [];

        for (const [key, value] of Object.entries(updates)) {
            if (HOT_RELOADABLE_CONFIGS.includes(key)) {
                const oldValue = CONFIG[key];
                
                if (!skipValidation) {
                    const validation = this._validateConfig(key, value);
                    if (!validation.valid) {
                        errors.push({ key, error: validation.error });
                        continue;
                    }
                }

                CONFIG[key] = value;
                changes.push({ key, oldValue, newValue: value });
                
                await this._applyConfigChange(key, value, oldValue);
            }
        }

        if (errors.length > 0) {
            await this._logAudit('update_failed', { errors, attemptedChanges: Object.keys(updates) });
            return { success: false, errors, changes };
        }

        if (persist && changes.length > 0) {
            await this._persistConfig();
        }

        await this._logAudit('update', { changes });
        await this.emit(CONFIG_UPDATE_EVENT.CONFIG_CHANGED, { changes });

        if (forceReload) {
            await this.reloadAll();
        }

        return { success: true, changes, errors: [] };
    }

    _validateConfig(key, value) {
        switch (key) {
            case 'LOG_LEVEL':
                if (!['debug', 'info', 'warn', 'error'].includes(value)) {
                    return { valid: false, error: 'Invalid log level' };
                }
                break;
            case 'REQUEST_MAX_RETRIES':
                if (!Number.isInteger(value) || value < 0 || value > 10) {
                    return { valid: false, error: 'REQUEST_MAX_RETRIES must be between 0 and 10' };
                }
                break;
            case 'CRON_NEAR_MINUTES':
                if (!Number.isInteger(value) || value < 1 || value > 120) {
                    return { valid: false, error: 'CRON_NEAR_MINUTES must be between 1 and 120' };
                }
                break;
            case 'MAX_ERROR_COUNT':
                if (!Number.isInteger(value) || value < 1 || value > 100) {
                    return { valid: false, error: 'MAX_ERROR_COUNT must be between 1 and 100' };
                }
                break;
            case 'SCHEDULED_HEALTH_CHECK':
                if (typeof value !== 'object') {
                    return { valid: false, error: 'SCHEDULED_HEALTH_CHECK must be an object' };
                }
                if (value.enabled !== undefined && typeof value.enabled !== 'boolean') {
                    return { valid: false, error: 'SCHEDULED_HEALTH_CHECK.enabled must be boolean' };
                }
                if (value.interval !== undefined && (!Number.isInteger(value.interval) || value.interval < 60000)) {
                    return { valid: false, error: 'SCHEDULED_HEALTH_CHECK.interval must be at least 60000ms' };
                }
                break;
            case 'PROXY_URL':
                if (value && !this._isValidUrl(value)) {
                    return { valid: false, error: 'Invalid PROXY_URL format' };
                }
                break;
            case 'HEALTH_ALERT_WEBHOOK_URL':
            case 'ALERT_DINGTALK_WEBHOOK':
            case 'ALERT_WECOM_WEBHOOK':
                if (value && !this._isValidUrl(value)) {
                    return { valid: false, error: `Invalid ${key} format` };
                }
                break;
        }
        return { valid: true };
    }

    _isValidUrl(string) {
        try {
            const url = new URL(string);
            return ['http:', 'https:'].includes(url.protocol);
        } catch {
            return false;
        }
    }

    async _applyConfigChange(key, newValue, oldValue) {
        switch (key) {
            case 'LOG_LEVEL':
                await this._updateLoggerConfig({ logLevel: newValue });
                break;
            case 'LOG_OUTPUT_MODE':
                await this._updateLoggerConfig({ outputMode: newValue });
                break;
            case 'SCHEDULED_HEALTH_CHECK':
                await this._updateHealthCheckConfig(newValue, oldValue);
                break;
            case 'HEALTH_ALERT_WEBHOOK_URL':
            case 'ALERT_DINGTALK_WEBHOOK':
            case 'ALERT_WECOM_WEBHOOK':
                await this._updateAlertManagerConfig();
                break;
            case 'providerFallbackChain':
                await this._updateProviderFallbackChain(newValue);
                break;
            case 'modelFallbackMapping':
                await this._updateModelFallbackMapping(newValue);
                break;
        }
    }

    async _updateLoggerConfig(options) {
        try {
            logger.updateConfig(options);
            logger.info(`[ConfigHotReloader] Logger config updated: ${JSON.stringify(options)}`);
        } catch (error) {
            logger.error('[ConfigHotReloader] Failed to update logger config:', error.message);
        }
    }

    async _updateHealthCheckConfig(newConfig, oldConfig) {
        try {
            const prevEnabled = oldConfig?.enabled === true;
            const nowEnabled = newConfig?.enabled === true;
            const newInterval = newConfig?.interval;

            if (prevEnabled && !nowEnabled && globalThis.stopHealthCheckTimer) {
                globalThis.stopHealthCheckTimer();
                globalThis._activeHealthCheckInterval = undefined;
                logger.info('[ConfigHotReloader] Scheduled health check stopped');
            } else if (!prevEnabled && nowEnabled && globalThis.reloadHealthCheckTimer) {
                globalThis._activeHealthCheckInterval = newInterval;
                globalThis.reloadHealthCheckTimer(newInterval);
                logger.info('[ConfigHotReloader] Scheduled health check started');
            } else if (nowEnabled && newInterval !== (oldConfig?.interval) && globalThis.reloadHealthCheckTimer) {
                globalThis._activeHealthCheckInterval = newInterval;
                globalThis.reloadHealthCheckTimer(newInterval);
                logger.info(`[ConfigHotReloader] Scheduled health check interval updated to ${newInterval}ms`);
            }
        } catch (error) {
            logger.error('[ConfigHotReloader] Failed to update health check config:', error.message);
        }
    }

    async _updateAlertManagerConfig() {
        try {
            const alertManager = getAlertManager(CONFIG);
            alertManager.config = {
                HEALTH_ALERT_WEBHOOK_URL: CONFIG.HEALTH_ALERT_WEBHOOK_URL,
                ALERT_DINGTALK_WEBHOOK: CONFIG.ALERT_DINGTALK_WEBHOOK,
                ALERT_WECOM_WEBHOOK: CONFIG.ALERT_WECOM_WEBHOOK
            };
            logger.info('[ConfigHotReloader] Alert manager config updated');
        } catch (error) {
            logger.error('[ConfigHotReloader] Failed to update alert manager config:', error.message);
        }
    }

    async _updateProviderFallbackChain(newChain) {
        try {
            const poolManager = getProviderPoolManager();
            if (poolManager) {
                poolManager.fallbackChain = newChain;
                logger.info('[ConfigHotReloader] Provider fallback chain updated');
            }
        } catch (error) {
            logger.error('[ConfigHotReloader] Failed to update provider fallback chain:', error.message);
        }
    }

    async _updateModelFallbackMapping(newMapping) {
        try {
            const poolManager = getProviderPoolManager();
            if (poolManager) {
                poolManager.modelFallbackMapping = newMapping;
                logger.info('[ConfigHotReloader] Model fallback mapping updated');
            }
        } catch (error) {
            logger.error('[ConfigHotReloader] Failed to update model fallback mapping:', error.message);
        }
    }

    async _persistConfig() {
        const fs = await import('fs');
        try {
            const configPath = 'configs/config.json';
            const configToSave = {};
            
            HOT_RELOADABLE_CONFIGS.forEach(key => {
                if (CONFIG[key] !== undefined) {
                    configToSave[key] = CONFIG[key];
                }
            });

            fs.writeFileSync(configPath, JSON.stringify(configToSave, null, 2), 'utf-8');
            logger.info('[ConfigHotReloader] Configuration persisted to config.json');
        } catch (error) {
            logger.error('[ConfigHotReloader] Failed to persist config:', error.message);
            throw error;
        }
    }

    async reloadAll() {
        if (this.isReloading) {
            logger.warn('[ConfigHotReloader] Reload already in progress');
            return { success: false, message: 'Reload already in progress' };
        }

        this.isReloading = true;
        const startTime = Date.now();

        try {
            await this.emit(CONFIG_UPDATE_EVENT.CONFIG_CHANGED, { action: 'pre-reload' });

            Object.keys(serviceInstances).forEach(key => delete serviceInstances[key]);

            const { initApiService } = await import('../services/service-manager.js');
            await initApiService(CONFIG, false);

            const poolManager = getProviderPoolManager();
            if (poolManager) {
                poolManager.initializeProviderStatus();
            }

            this.lastReloadTime = new Date().toISOString();
            const duration = Date.now() - startTime;

            await this._logAudit('reload', { duration });
            await this.emit(CONFIG_UPDATE_EVENT.RELOAD_COMPLETED, { duration });

            logger.info(`[ConfigHotReloader] Configuration reload completed in ${duration}ms`);
            return { success: true, duration, message: 'Configuration reloaded successfully' };
        } catch (error) {
            logger.error('[ConfigHotReloader] Failed to reload configuration:', error.message);
            await sendSystemErrorAlert(error, { context: 'config_reload' });
            
            await this._logAudit('reload_failed', { error: error.message });
            
            return { success: false, message: error.message };
        } finally {
            this.isReloading = false;
        }
    }

    async updateProviderPool(providerType, updates) {
        try {
            const poolManager = getProviderPoolManager();
            if (!poolManager) {
                return { success: false, message: 'Provider pool manager not available' };
            }

            if (!poolManager.providerPools[providerType]) {
                poolManager.providerPools[providerType] = [];
            }

            const changes = [];
            updates.forEach(update => {
                const { uuid, ...fields } = update;
                
                const existingIndex = poolManager.providerPools[providerType].findIndex(
                    p => p.uuid === uuid
                );

                if (existingIndex >= 0) {
                    const oldConfig = { ...poolManager.providerPools[providerType][existingIndex] };
                    Object.assign(poolManager.providerPools[providerType][existingIndex], fields);
                    changes.push({ type: 'update', uuid, oldConfig, newConfig: fields });
                } else {
                    poolManager.providerPools[providerType].push(update);
                    changes.push({ type: 'add', uuid, config: update });
                }
            });

            poolManager.initializeProviderStatus();

            const fs = await import('fs');
            const poolsPath = CONFIG.PROVIDER_POOLS_FILE_PATH || 'configs/provider_pools.json';
            fs.writeFileSync(poolsPath, JSON.stringify(poolManager.providerPools, null, 2), 'utf-8');

            await this._logAudit('provider_pool_update', { providerType, changes });
            await this.emit(CONFIG_UPDATE_EVENT.PROVIDER_POOL_CHANGED, { providerType, changes });

            return { success: true, changes };
        } catch (error) {
            logger.error('[ConfigHotReloader] Failed to update provider pool:', error.message);
            return { success: false, message: error.message };
        }
    }

    async invalidateProviderAdapter(providerType, uuid) {
        try {
            invalidateServiceAdapter(providerType, uuid);
            
            const poolManager = getProviderPoolManager();
            if (poolManager) {
                const provider = poolManager._findProvider(providerType, uuid);
                if (provider) {
                    provider.config.needsRefresh = true;
                }
            }

            await this._logAudit('adapter_invalidated', { providerType, uuid });
            logger.info(`[ConfigHotReloader] Invalidated adapter for ${providerType}/${uuid}`);
            
            return { success: true };
        } catch (error) {
            logger.error('[ConfigHotReloader] Failed to invalidate provider adapter:', error.message);
            return { success: false, message: error.message };
        }
    }

    async _logAudit(action, details) {
        const entry = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            action,
            details,
            timestamp: new Date().toISOString()
        };

        this.auditLog.unshift(entry);
        if (this.auditLog.length > this.maxAuditLogSize) {
            this.auditLog.pop();
        }

        logger.info(`[ConfigHotReloader] Audit: ${action} - ${JSON.stringify(details)}`);
    }

    getStatus() {
        return {
            isReloading: this.isReloading,
            lastReloadTime: this.lastReloadTime,
            pendingChanges: this.pendingChanges.length,
            auditLogCount: this.auditLog.length,
            hotReloadableConfigs: HOT_RELOADABLE_CONFIGS
        };
    }

    getAuditLog(options = {}) {
        let log = [...this.auditLog];
        if (options.limit) {
            log = log.slice(0, options.limit);
        }
        if (options.action) {
            log = log.filter(entry => entry.action === options.action);
        }
        return log;
    }
}

let hotReloaderInstance = null;

export function getConfigHotReloader() {
    if (!hotReloaderInstance) {
        hotReloaderInstance = new ConfigHotReloader();
    }
    return hotReloaderInstance;
}

export function initializeConfigHotReloader() {
    hotReloaderInstance = new ConfigHotReloader();
    return hotReloaderInstance;
}