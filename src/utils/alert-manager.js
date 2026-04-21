import logger from './logger.js';

export const ALERT_LEVEL = {
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    CRITICAL: 'critical'
};

export const ALERT_TYPE = {
    PROVIDER_UNHEALTHY: 'provider_unhealthy',
    PROVIDER_RECOVERED: 'provider_recovered',
    TOKEN_EXPIRED: 'token_expired',
    RATE_LIMIT: 'rate_limit',
    SYSTEM_ERROR: 'system_error',
    CONFIG_ERROR: 'config_error',
    HEALTH_CHECK_FAILED: 'health_check_failed'
};

export class AlertManager {
    constructor(config = {}) {
        this.config = config;
        this.alertHistory = [];
        this.silencedAlerts = new Map();
        this.maxHistorySize = config.maxAlertHistory || 100;
        this.defaultSilenceMinutes = config.defaultSilenceMinutes || 60;
    }

    async sendAlert(alertType, level, message, details = {}) {
        const alert = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: alertType,
            level,
            message,
            details: { ...details },
            timestamp: new Date().toISOString(),
            acknowledged: false
        };

        if (this._isSilenced(alertType, details.providerType, details.uuid)) {
            logger.info(`[AlertManager] Alert silenced: ${alertType} for ${details.uuid}`);
            return { sent: false, silenced: true, alert };
        }

        this._addHistory(alert);
        
        const results = [];

        if (this.config.HEALTH_ALERT_WEBHOOK_URL) {
            const webhookResult = await this._sendToWebhook(alert);
            results.push({ type: 'webhook', success: webhookResult.success, error: webhookResult.error });
        }

        if (this.config.ALERT_DINGTALK_WEBHOOK) {
            const dingtalkResult = await this._sendToDingtalk(alert);
            results.push({ type: 'dingtalk', success: dingtalkResult.success, error: dingtalkResult.error });
        }

        if (this.config.ALERT_WECOM_WEBHOOK) {
            const wecomResult = await this._sendToWecom(alert);
            results.push({ type: 'wecom', success: wecomResult.success, error: wecomResult.error });
        }

        this._logAlert(alert);

        return { sent: true, silenced: false, alert, results };
    }

    async _sendToWebhook(alert) {
        try {
            const axios = (await import('axios')).default;
            await axios.post(this.config.HEALTH_ALERT_WEBHOOK_URL, alert, {
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            });
            logger.info(`[AlertManager] Alert sent to webhook: ${alert.type}`);
            return { success: true };
        } catch (error) {
            logger.error(`[AlertManager] Failed to send alert to webhook: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async _sendToDingtalk(alert) {
        try {
            const axios = (await import('axios')).default;
            const dingtalkMessage = {
                msgtype: 'text',
                text: {
                    content: `【${alert.level.toUpperCase()}】${alert.message}\n\n详情：${JSON.stringify(alert.details, null, 2)}`
                }
            };
            await axios.post(this.config.ALERT_DINGTALK_WEBHOOK, dingtalkMessage, {
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            });
            logger.info(`[AlertManager] Alert sent to DingTalk: ${alert.type}`);
            return { success: true };
        } catch (error) {
            logger.error(`[AlertManager] Failed to send alert to DingTalk: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async _sendToWecom(alert) {
        try {
            const axios = (await import('axios')).default;
            const wecomMessage = {
                msgtype: 'text',
                text: {
                    content: `【${alert.level.toUpperCase()}】${alert.message}\n\n详情：${JSON.stringify(alert.details, null, 2)}`
                }
            };
            await axios.post(this.config.ALERT_WECOM_WEBHOOK, wecomMessage, {
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            });
            logger.info(`[AlertManager] Alert sent to WeCom: ${alert.type}`);
            return { success: true };
        } catch (error) {
            logger.error(`[AlertManager] Failed to send alert to WeCom: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    _logAlert(alert) {
        const emoji = {
            [ALERT_LEVEL.INFO]: 'ℹ️',
            [ALERT_LEVEL.WARN]: '⚠️',
            [ALERT_LEVEL.ERROR]: '❌',
            [ALERT_LEVEL.CRITICAL]: '🔥'
        };
        
        logger[alert.level](`[AlertManager] ${emoji[alert.level]} ${alert.type}: ${alert.message}`);
        if (Object.keys(alert.details).length > 0) {
            logger[alert.level]('[AlertManager] Alert details:', alert.details);
        }
    }

    _addHistory(alert) {
        this.alertHistory.unshift(alert);
        if (this.alertHistory.length > this.maxHistorySize) {
            this.alertHistory.pop();
        }
    }

    _isSilenced(alertType, providerType, uuid) {
        const silenceKey = `${alertType}-${providerType}-${uuid}`;
        const silenceUntil = this.silencedAlerts.get(silenceKey);
        if (silenceUntil && Date.now() < silenceUntil) {
            return true;
        }
        if (silenceUntil && Date.now() >= silenceUntil) {
            this.silencedAlerts.delete(silenceKey);
        }
        return false;
    }

    silenceAlert(alertType, providerType, uuid, minutes = this.defaultSilenceMinutes) {
        const silenceKey = `${alertType}-${providerType}-${uuid}`;
        const silenceUntil = Date.now() + (minutes * 60 * 1000);
        this.silencedAlerts.set(silenceKey, silenceUntil);
        logger.info(`[AlertManager] Silenced ${alertType} for ${providerType}/${uuid} for ${minutes} minutes`);
        return { silenceKey, silenceUntil: new Date(silenceUntil).toISOString() };
    }

    acknowledgeAlert(alertId) {
        const alert = this.alertHistory.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            alert.acknowledgedAt = new Date().toISOString();
            logger.info(`[AlertManager] Alert ${alertId} acknowledged`);
            return true;
        }
        return false;
    }

    getAlertHistory(options = {}) {
        let history = [...this.alertHistory];
        
        if (options.level) {
            history = history.filter(a => a.level === options.level);
        }
        if (options.type) {
            history = history.filter(a => a.type === options.type);
        }
        if (options.providerType) {
            history = history.filter(a => a.details.providerType === options.providerType);
        }
        if (options.unacknowledgedOnly) {
            history = history.filter(a => !a.acknowledged);
        }
        if (options.limit) {
            history = history.slice(0, options.limit);
        }
        
        return history;
    }

    getUnacknowledgedCount() {
        return this.alertHistory.filter(a => !a.acknowledged).length;
    }

    clearHistory() {
        this.alertHistory = [];
        logger.info('[AlertManager] Alert history cleared');
    }

    getStatus() {
        return {
            activeAlerts: this.alertHistory.filter(a => !a.acknowledged).length,
            totalAlerts: this.alertHistory.length,
            silencedCount: this.silencedAlerts.size,
            webhookConfigured: !!this.config.HEALTH_ALERT_WEBHOOK_URL,
            dingtalkConfigured: !!this.config.ALERT_DINGTALK_WEBHOOK,
            wecomConfigured: !!this.config.ALERT_WECOM_WEBHOOK
        };
    }
}

let alertManagerInstance = null;

export function getAlertManager(config = {}) {
    if (!alertManagerInstance) {
        alertManagerInstance = new AlertManager(config);
    }
    return alertManagerInstance;
}

export function initializeAlertManager(config) {
    alertManagerInstance = new AlertManager(config);
    return alertManagerInstance;
}

export async function sendProviderUnhealthyAlert(providerType, providerConfig, errorMessage) {
    const alertManager = getAlertManager();
    return await alertManager.sendAlert(
        ALERT_TYPE.PROVIDER_UNHEALTHY,
        ALERT_LEVEL.ERROR,
        `Provider ${providerType} (${providerConfig.customName || providerConfig.uuid}) became unhealthy`,
        {
            providerType,
            uuid: providerConfig.uuid,
            customName: providerConfig.customName,
            errorMessage,
            errorCount: providerConfig.errorCount,
            usageCount: providerConfig.usageCount
        }
    );
}

export async function sendProviderRecoveredAlert(providerType, providerConfig) {
    const alertManager = getAlertManager();
    return await alertManager.sendAlert(
        ALERT_TYPE.PROVIDER_RECOVERED,
        ALERT_LEVEL.INFO,
        `Provider ${providerType} (${providerConfig.customName || providerConfig.uuid}) recovered`,
        {
            providerType,
            uuid: providerConfig.uuid,
            customName: providerConfig.customName,
            usageCount: providerConfig.usageCount
        }
    );
}

export async function sendTokenExpiredAlert(providerType, providerConfig) {
    const alertManager = getAlertManager();
    return await alertManager.sendAlert(
        ALERT_TYPE.TOKEN_EXPIRED,
        ALERT_LEVEL.WARN,
        `Token expired for ${providerType} (${providerConfig.customName || providerConfig.uuid})`,
        {
            providerType,
            uuid: providerConfig.uuid,
            customName: providerConfig.customName
        }
    );
}

export async function sendRateLimitAlert(providerType, providerConfig) {
    const alertManager = getAlertManager();
    return await alertManager.sendAlert(
        ALERT_TYPE.RATE_LIMIT,
        ALERT_LEVEL.WARN,
        `Rate limit exceeded for ${providerType} (${providerConfig.customName || providerConfig.uuid})`,
        {
            providerType,
            uuid: providerConfig.uuid,
            customName: providerConfig.customName
        }
    );
}

export async function sendSystemErrorAlert(error, context = {}) {
    const alertManager = getAlertManager();
    return await alertManager.sendAlert(
        ALERT_TYPE.SYSTEM_ERROR,
        ALERT_LEVEL.CRITICAL,
        `System error: ${error.message}`,
        {
            error: error.message,
            stack: error.stack?.substring(0, 500),
            ...context
        }
    );
}