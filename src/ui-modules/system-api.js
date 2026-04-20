import { existsSync, readFileSync, createReadStream } from 'fs';
import logger from '../utils/logger.js';
import path from 'path';
import { getCpuUsagePercent } from './system-monitor.js';
import { getGPUStatus } from '../utils/python-controller.js';
import os from 'os';
import { getProviderPoolManager } from '../services/service-manager.js';
import { getProviderModels } from '../providers/provider-models.js';

let systemMonitorHistory = {
    cpu: [],
    memory: [],
    gpu: [],
    timestamp: []
};
const MAX_HISTORY_POINTS = 60;

const systemMonitorCache = {
    data: null,
    timestamp: 0,
    ttl: 5000
};

async function collectSystemMetrics() {
    const cpuUsage = parseFloat(getCpuUsagePercent());
    const total = os.totalmem();
    const free = os.freemem();
    const memoryUsage = ((total - free) / total * 100);

    let gpuUsage = 0;
    try {
        const gpuStatus = await getGPUStatus();
        if (gpuStatus && gpuStatus.utilization !== undefined) {
            gpuUsage = parseFloat(gpuStatus.utilization);
        } else if (gpuStatus && gpuStatus.devices && gpuStatus.devices.length > 0) {
            const firstDevice = gpuStatus.devices[0];
            gpuUsage = parseFloat(firstDevice.utilization || firstDevice.util || 0);
        }
    } catch (error) {
        gpuUsage = 0;
    }

    systemMonitorHistory.cpu.push(cpuUsage);
    systemMonitorHistory.memory.push(memoryUsage);
    systemMonitorHistory.gpu.push(gpuUsage);
    systemMonitorHistory.timestamp.push(Date.now());

    if (systemMonitorHistory.cpu.length > MAX_HISTORY_POINTS) {
        systemMonitorHistory.cpu.shift();
        systemMonitorHistory.memory.shift();
        systemMonitorHistory.gpu.shift();
        systemMonitorHistory.timestamp.shift();
    }
}

collectSystemMetrics();

setInterval(collectSystemMetrics, 2000);

/**
 * 获取系统信息
 */
export async function handleGetSystem(req, res) {
    const memUsage = process.memoryUsage();
    
    // 读取版本号
    let appVersion = 'unknown';
    try {
        const versionFilePath = path.join(process.cwd(), 'VERSION');
        if (existsSync(versionFilePath)) {
            appVersion = readFileSync(versionFilePath, 'utf8').trim();
        }
    } catch (error) {
        logger.warn('[UI API] Failed to read VERSION file:', error.message);
    }
    
    // 计算 CPU 使用率
    let cpuUsage = '0.0%';
    const IS_WORKER_PROCESS = process.env.IS_WORKER_PROCESS === 'true';
    
    if (IS_WORKER_PROCESS) {
        // 如果是子进程，尝试从主进程获取状态来确定 PID，或者使用当前 PID (如果要求统计子进程自己的话)
        // 根据任务描述 "CPU 使用率应该是统计子进程的PID的使用率"
        // 这里的 system-api.js 可能运行在子进程中，直接统计 process.pid 即可
        cpuUsage = getCpuUsagePercent(process.pid);
    } else {
        // 独立运行模式下统计系统整体 CPU
        cpuUsage = getCpuUsagePercent();
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        appVersion: appVersion,
        nodeVersion: process.version,
        serverTime: new Date().toISOString(),
        memoryUsage: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
        cpuUsage: cpuUsage,
        uptime: process.uptime()
    }));
    return true;
}

/**
 * 下载当日日志
 */
export async function handleDownloadTodayLog(req, res) {
    try {
        if (!logger.currentLogFile || !existsSync(logger.currentLogFile)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: 'Today\'s log file not found' } }));
            return true;
        }

        const fileName = path.basename(logger.currentLogFile);
        res.writeHead(200, {
            'Content-Type': 'text/plain',
            'Content-Disposition': `attachment; filename="${fileName}"`
        });

        const readStream = createReadStream(logger.currentLogFile);
        readStream.pipe(res);
        return true;
    } catch (error) {
        logger.error('[UI API] Failed to download log:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Failed to download log: ' + error.message } }));
        return true;
    }
}

/**
 * 清空当日日志
 */
export async function handleClearTodayLog(req, res) {
    try {
        const success = await logger.clearTodayLog();
        
        if (success) {
            // 广播日志清空事件
            const { broadcastEvent } = await import('./event-broadcast.js');
            broadcastEvent('log_cleared', {
                action: 'log_cleared',
                timestamp: new Date().toISOString(),
                message: 'Today\'s log file has been cleared'
            });
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: '当日日志已清空'
            }));
        } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: { message: '清空日志失败' }
            }));
        }
        return true;
    } catch (error) {
        logger.error('[UI API] Failed to clear log:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: { message: 'Failed to clear log: ' + error.message }
        }));
        return true;
    }
}

/**
 * 获取系统监控历史数据
 */
export async function handleGetSystemMonitor(req, res) {
    const now = Date.now();
    if (systemMonitorCache.data && (now - systemMonitorCache.timestamp) < systemMonitorCache.ttl) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
        res.end(JSON.stringify(systemMonitorCache.data));
        return true;
    }

    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    let gpuData = {
        usage: 0,
        temperature: 0,
        history: systemMonitorHistory.gpu
    };

    try {
        const gpuStatus = await getGPUStatus();
        if (gpuStatus) {
            if (gpuStatus.utilization !== undefined) {
                gpuData.usage = parseFloat(gpuStatus.utilization);
            } else if (gpuStatus.devices && gpuStatus.devices.length > 0) {
                const firstDevice = gpuStatus.devices[0];
                gpuData.usage = parseFloat(firstDevice.utilization || firstDevice.util || 0);
                gpuData.temperature = parseFloat(firstDevice.temperature || 0);
            }
            if (gpuStatus.temperature !== undefined) {
                gpuData.temperature = parseFloat(gpuStatus.temperature);
            }
        }
    } catch (error) {
        logger.warn('[UI API] Failed to get GPU status for system monitor:', error.message);
    }

    const result = {
        cpu: {
            usage: parseFloat(getCpuUsagePercent()),
            cores: os.cpus().length,
            history: systemMonitorHistory.cpu
        },
        memory: {
            total: formatBytes(total),
            used: formatBytes(used),
            free: formatBytes(free),
            usagePercent: parseFloat(((used / total) * 100).toFixed(1)),
            history: systemMonitorHistory.memory
        },
        gpu: gpuData,
        timestamp: systemMonitorHistory.timestamp,
        platform: process.platform
    };

    systemMonitorCache.data = result;
    systemMonitorCache.timestamp = now;

    res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'MISS' });
    res.end(JSON.stringify(result));
    return true;
}

/**
 * 健康检查接口（用于前端token验证）
 */
export async function handleHealthCheck(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    return true;
}

import { CONFIG } from '../core/config-manager.js';

/**
 * 获取服务模式信息
 */
export async function handleGetServiceMode(req, res) {
    const IS_WORKER_PROCESS = process.env.IS_WORKER_PROCESS === 'true';
    const masterPort = CONFIG.MASTER_PORT || process.env.MASTER_PORT || 3100;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        mode: IS_WORKER_PROCESS ? 'worker' : 'standalone',
        pid: process.pid,
        ppid: process.ppid,
        uptime: process.uptime(),
        canAutoRestart: IS_WORKER_PROCESS && !!process.send,
        masterPort: IS_WORKER_PROCESS ? masterPort : null,
        nodeVersion: process.version,
        platform: process.platform
    }));
    return true;
}

/**
 * 重启服务端点 - 支持主进程-子进程架构
 */
export async function handleRestartService(req, res) {
    try {
        const IS_WORKER_PROCESS = process.env.IS_WORKER_PROCESS === 'true';
        
        if (IS_WORKER_PROCESS && process.send) {
            // 作为子进程运行，通知主进程重启
            logger.info('[UI API] Requesting restart from master process...');
            process.send({ type: 'restart_request' });
            
            // 广播重启事件
            const { broadcastEvent } = await import('./event-broadcast.js');
            broadcastEvent('service_restart', {
                action: 'restart_requested',
                timestamp: new Date().toISOString(),
                message: 'Service restart requested, worker will be restarted by master process'
            });
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Restart request sent to master process',
                mode: 'worker',
                details: {
                    workerPid: process.pid,
                    restartMethod: 'master_controlled'
                }
            }));
        } else {
            // 独立运行模式，无法自动重启
            logger.info('[UI API] Service is running in standalone mode, cannot auto-restart');
            
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Service is running in standalone mode. Please use master.js to enable auto-restart feature.',
                mode: 'standalone',
                hint: 'Start the service with: node src/core/master.js [args]'
            }));
        }
        return true;
    } catch (error) {
        logger.error('[UI API] Failed to restart service:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: {
                message: 'Failed to restart service: ' + error.message
            }
        }));
        return true;
    }
}

const dashboardCache = {
    data: null,
    timestamp: 0,
    ttl: 3000
};

/**
 * Dashboard聚合API - 单次请求获取所有dashboard数据
 */
export async function handleGetDashboard(req, res) {
    const now = Date.now();
    
    if (dashboardCache.data && (now - dashboardCache.timestamp) < dashboardCache.ttl) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
        res.end(JSON.stringify(dashboardCache.data));
        return true;
    }

    try {
        const [systemInfo, systemMonitor, pythonGpuStatus, providerStatus, models, tokenStats] = await Promise.all([
            fetchSystemInfo(),
            fetchSystemMonitorData(),
            fetchPythonGpuData(),
            fetchProviderStatusData(),
            fetchModelsData(),
            fetchTokenStatsData(req)
        ]);

        const result = {
            systemInfo,
            systemMonitor,
            pythonGpuStatus,
            providerStatus,
            models,
            tokenStats,
            timestamp: now
        };

        dashboardCache.data = result;
        dashboardCache.timestamp = now;

        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'MISS' });
        res.end(JSON.stringify(result));
        return true;
    } catch (error) {
        logger.error('[UI API] Failed to fetch dashboard data:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: { message: 'Failed to fetch dashboard data: ' + error.message }
        }));
        return true;
    }
}

async function fetchSystemInfo() {
    const memUsage = process.memoryUsage();
    let appVersion = 'unknown';
    
    try {
        const versionFilePath = path.join(process.cwd(), 'VERSION');
        if (existsSync(versionFilePath)) {
            appVersion = readFileSync(versionFilePath, 'utf8').trim();
        }
    } catch (error) {
        logger.warn('[UI API] Failed to read VERSION file:', error.message);
    }

    return {
        appVersion,
        nodeVersion: process.version,
        serverTime: new Date().toISOString(),
        memoryUsage: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
        cpuUsage: getCpuUsagePercent(),
        uptime: process.uptime(),
        platform: process.platform,
        pid: process.pid
    };
}

async function fetchSystemMonitorData() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    let gpuData = {
        usage: 0,
        temperature: 0,
        history: systemMonitorHistory.gpu
    };

    try {
        const gpuStatus = await getGPUStatus();
        if (gpuStatus) {
            if (gpuStatus.utilization !== undefined) {
                gpuData.usage = parseFloat(gpuStatus.utilization);
            } else if (gpuStatus.devices && gpuStatus.devices.length > 0) {
                const firstDevice = gpuStatus.devices[0];
                gpuData.usage = parseFloat(firstDevice.utilization || firstDevice.util || 0);
                gpuData.temperature = parseFloat(firstDevice.temperature || 0);
            }
            if (gpuStatus.temperature !== undefined) {
                gpuData.temperature = parseFloat(gpuStatus.temperature);
            }
        }
    } catch (error) {
        logger.warn('[UI API] Failed to get GPU status:', error.message);
    }

    return {
        cpu: {
            usage: parseFloat(getCpuUsagePercent()),
            cores: os.cpus().length,
            history: systemMonitorHistory.cpu
        },
        memory: {
            total: formatBytes(total),
            used: formatBytes(used),
            free: formatBytes(free),
            usagePercent: parseFloat(((used / total) * 100).toFixed(1)),
            history: systemMonitorHistory.memory
        },
        gpu: gpuData,
        timestamp: systemMonitorHistory.timestamp
    };
}

async function fetchPythonGpuData() {
    try {
        const { CONFIG } = await import('../core/config-manager.js');
        const controllerBaseUrl = CONFIG.CONTROLLER_BASE_URL || 'http://192.168.7.103:5000';
        
        const pythonUrl = new URL('/manage/gpu', controllerBaseUrl);
        
        const options = {
            hostname: pythonUrl.hostname,
            port: pythonUrl.port,
            path: pythonUrl.pathname,
            method: 'GET',
            timeout: 5000,
            headers: {}
        };
        
        const response = await new Promise((resolve, reject) => {
            const req = require('http').request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Invalid response from Python controller'));
                    }
                });
            });
            
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
            req.setTimeout(5000);
            req.end();
        });
        
        if (response) {
            return {
                success: true,
                utilization: response.utilization || response.gpu_utilization || 0,
                memoryUsage: response.memory_utilization || 0,
                temperature: response.temperature || 0,
                power: response.power_draw || response.power || 0,
                name: response.name || '--',
                memoryTotal: response.total_memory ? `${(response.total_memory / (1024 ** 3)).toFixed(1)} GB` : '--',
                memoryUsed: response.used_memory ? `${(response.used_memory / (1024 ** 3)).toFixed(1)} GB` : '--',
                memoryAvailable: response.available_memory ? `${(response.available_memory / (1024 ** 3)).toFixed(1)} GB` : '--',
                serverTime: new Date().toISOString()
            };
        }
    } catch (error) {
        logger.warn('[UI API] Failed to get Python GPU status:', error.message);
    }
    
    return { success: false };
}

async function fetchProviderStatusData() {
    try {
        const poolManager = getProviderPoolManager();
        if (poolManager && poolManager.providers) {
            const providers = [];
            for (const [type, items] of Object.entries(poolManager.providers)) {
                if (Array.isArray(items) && items.length > 0) {
                    const healthyCount = items.filter(p => p.isHealthy !== false).length;
                    const status = healthyCount === items.length ? 'healthy' :
                                   healthyCount > 0 ? 'warning' : 'error';
                    
                    providers.push({
                        name: type.replace(/-/g, ' '),
                        status,
                        accounts: items.length,
                        requests: items.reduce((sum, p) => sum + (p.requestCount || 0), 0)
                    });
                }
            }
            return providers;
        }
    } catch (error) {
        logger.warn('[UI API] Failed to get provider status:', error.message);
    }
    
    return [];
}

async function fetchModelsData() {
    try {
        const models = await getProviderModels();
        const modelSet = new Set();
        for (const typeModels of Object.values(models)) {
            if (Array.isArray(typeModels)) {
                typeModels.forEach(model => modelSet.add(model));
            }
        }
        return Array.from(modelSet).sort();
    } catch (error) {
        logger.warn('[UI API] Failed to get models:', error.message);
    }
    
    return [];
}

async function fetchTokenStatsData(req) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const range = url.searchParams.get('range') || 'hour';
        
        const tokenStatsUrl = new URL(`/api/token-stats?range=${range}`, `http://localhost:${process.env.PORT || 3000}`);
        
        const options = {
            hostname: tokenStatsUrl.hostname,
            port: tokenStatsUrl.port,
            path: tokenStatsUrl.pathname + tokenStatsUrl.search,
            method: 'GET',
            timeout: 5000,
            headers: {}
        };
        
        const response = await new Promise((resolve, reject) => {
            const req = require('http').request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Invalid response'));
                    }
                });
            });
            
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
            req.setTimeout(5000);
            req.end();
        });
        
        return response;
    } catch (error) {
        logger.warn('[UI API] Failed to get token stats:', error.message);
        return { total: 0, input: 0, output: 0, history: [] };
    }
}