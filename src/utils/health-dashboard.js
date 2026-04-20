import logger from './logger.js';
import { getMetricsManager } from './metrics.js';
import { getAlertManager } from './alert-manager.js';
import { getEventBroadcaster } from '../ui-modules/event-broadcast.js';
import { getIPCManager } from '../core/ipc-manager.js';
import os from 'os';

export class HealthDashboard {
    constructor() {
        this.systemStatus = {
            status: 'unknown',
            timestamp: Date.now()
        };
    }

    async getSystemOverview() {
        const metrics = getMetricsManager().getSummary();
        const alerts = getAlertManager().getStatus();
        const events = getEventBroadcaster().getStats();
        const ipc = getIPCManager().getStats();

        const systemInfo = {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            uptime: process.uptime(),
            startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
        };

        const memoryUsage = process.memoryUsage();
        const totalMemory = os.totalmem();
        
        const memoryInfo = {
            rss: memoryUsage.rss,
            heapTotal: memoryUsage.heapTotal,
            heapUsed: memoryUsage.heapUsed,
            external: memoryUsage.external,
            total: totalMemory,
            usedPercent: ((memoryUsage.rss / totalMemory) * 100).toFixed(2)
        };

        const cpuInfo = {
            cores: os.cpus().length,
            model: os.cpus()[0]?.model || 'Unknown',
            speed: os.cpus()[0]?.speed || 0
        };

        const requestStats = {
            total: metrics.counters.requests_total || 0,
            success: metrics.counters.requests_success || 0,
            error: metrics.counters.requests_error || 0,
            successRate: metrics.counters.requests_total 
                ? ((metrics.counters.requests_success / metrics.counters.requests_total) * 100).toFixed(2)
                : 100
        };

        const providerStats = {
            total: metrics.gauges.providers_total || 0,
            healthy: metrics.gauges.providers_healthy || 0,
            unhealthy: metrics.gauges.providers_unhealthy || 0,
            healthyRate: metrics.gauges.providers_total 
                ? ((metrics.gauges.providers_healthy / metrics.gauges.providers_total) * 100).toFixed(2)
                : 100
        };

        return {
            timestamp: new Date().toISOString(),
            system: systemInfo,
            memory: memoryInfo,
            cpu: cpuInfo,
            requests: requestStats,
            providers: providerStats,
            metrics,
            alerts,
            events,
            ipc,
            overallStatus: this._calculateOverallStatus(requestStats, providerStats, alerts)
        };
    }

    _calculateOverallStatus(requests, providers, alerts) {
        if (providers.unhealthy > 0) return 'degraded';
        if (alerts.activeAlerts > 0) return 'warning';
        if (requests.successRate < 90) return 'warning';
        return 'healthy';
    }

    async getRequestMetrics() {
        const metrics = getMetricsManager();
        const durationMetric = metrics.get('requests_duration_ms');
        
        return {
            totalRequests: metrics.get('requests_total')?.value || 0,
            successfulRequests: metrics.get('requests_success')?.value || 0,
            failedRequests: metrics.get('requests_error')?.value || 0,
            durationStats: durationMetric?.toJSON()?.stats || null
        };
    }

    async getProviderHealth() {
        const metrics = getMetricsManager();
        
        return {
            healthy: metrics.get('providers_healthy')?.value || 0,
            unhealthy: metrics.get('providers_unhealthy')?.value || 0,
            total: metrics.get('providers_total')?.value || 0
        };
    }

    async getRecentAlerts(limit = 20) {
        const alertManager = getAlertManager();
        return alertManager.getAlertHistory({ limit });
    }

    async getPerformanceStats() {
        const loggerStats = logger.getPerformanceStats();
        const metrics = getMetricsManager().getSummary();
        
        return {
            requestTimings: loggerStats,
            metrics
        };
    }

    async getComponentStatus() {
        const ipc = getIPCManager().getStats();
        const events = getEventBroadcaster().getStats();
        const alerts = getAlertManager().getStatus();
        
        return {
            ipcManager: {
                status: ipc.workerConnected ? 'healthy' : 'unhealthy',
                pendingRequests: ipc.pendingRequests,
                heartbeatFailures: ipc.heartbeatFailureCount
            },
            eventBroadcaster: {
                status: 'healthy',
                clients: events.clientCount,
                queuedMessages: events.queuedMessages
            },
            alertManager: {
                status: alerts.activeAlerts > 0 ? 'warning' : 'healthy',
                activeAlerts: alerts.activeAlerts,
                configuredChannels: {
                    webhook: alerts.webhookConfigured,
                    dingtalk: alerts.dingtalkConfigured,
                    wecom: alerts.wecomConfigured
                }
            },
            logger: {
                status: 'healthy',
                level: logger.getStatus().logLevel,
                samplingRate: logger.getStatus().samplingRate
            }
        };
    }

    async getLogs(limit = 50) {
        const logs = logger.getBuffer().slice(-limit);
        return logs;
    }

    async exportMetrics(format = 'json') {
        const metrics = getMetricsManager();
        
        if (format === 'prometheus') {
            return metrics.exportPrometheusFormat();
        }
        
        return JSON.stringify(metrics.getMetrics(), null, 2);
    }

    async getDiagnostics() {
        const overview = await this.getSystemOverview();
        const components = await this.getComponentStatus();
        
        const diagnostics = {
            timestamp: new Date().toISOString(),
            overview,
            components,
            environment: {
                NODE_ENV: process.env.NODE_ENV || 'development',
                IS_WORKER_PROCESS: process.env.IS_WORKER_PROCESS === 'true',
                NODE_OPTIONS: process.env.NODE_OPTIONS || 'None',
                CPU_CORES: os.cpus().length,
                TOTAL_MEMORY: os.totalmem()
            },
            uptime: {
                process: process.uptime(),
                system: os.uptime()
            }
        };

        return diagnostics;
    }
}

let healthDashboardInstance = null;

export function getHealthDashboard() {
    if (!healthDashboardInstance) {
        healthDashboardInstance = new HealthDashboard();
    }
    return healthDashboardInstance;
}

export function initializeHealthDashboard() {
    healthDashboardInstance = new HealthDashboard();
    return healthDashboardInstance;
}