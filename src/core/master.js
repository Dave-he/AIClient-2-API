/**
 * 主进程 (Master Process)
 * 
 * 负责管理子进程的生命周期，包括：
 * - 启动子进程
 * - 监控子进程状态
 * - 处理子进程重启请求
 * - 提供 IPC 通信
 * 
 * 使用方式：
 * node src/core/master.js [原有的命令行参数]
 */

import { fork } from 'child_process';
import logger from '../utils/logger.js';
import * as http from 'http';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { isRetryableNetworkError } from '../utils/common.js';
import os from 'os';
import { initializeConfig, CONFIG } from '../core/config-manager.js';
import { getIPCManager } from './ipc-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ipcManager = getIPCManager();

// 子进程状态
let workerStatus = {
    pid: null,
    startTime: null,
    restartCount: 0,
    lastRestartTime: null,
    isRestarting: false
};

let config = {};

// 资源监控状态
const resourceMonitorStatus = {
    consecutiveCpuAlerts: 0,
    consecutiveMemoryAlerts: 0,
    lastCpuAlertTime: null,
    lastMemoryAlertTime: null,
    recentCpuUsage: [],
    recentMemoryUsage: [],
    maxSamples: 12 // 保留最近12个样本（约1分钟数据）
};

/**
 * 启动子进程
 */
function startWorker() {
    if (ipcManager.getStats().workerConnected) {
        const stats = ipcManager.getStats();
        logger.info('[Master] Worker process already running, PID:', stats.workerConnected ? workerStatus.pid : 'unknown');
        return;
    }

    logger.info('[Master] Starting worker process...');
    logger.info('[Master] Worker script:', config.workerScript);
    logger.info('[Master] Worker args:', config.args.join(' '));

    const worker = fork(config.workerScript, config.args, {
        stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
        env: {
            ...process.env,
            IS_WORKER_PROCESS: 'true'
        }
    });

    workerStatus.pid = worker.pid;
    workerStatus.startTime = new Date().toISOString();

    logger.info('[Master] Worker process started, PID:', worker.pid);

    ipcManager.onWorkerDisconnect = (code, signal) => {
        logger.info(`[Master] Worker process exited with code ${code}, signal ${signal}`);
        workerStatus.pid = null;
        if (!workerStatus.isRestarting && code !== 0) {
            logger.info('[Master] Worker crashed, attempting auto-restart...');
            scheduleRestart();
        }
    };

    ipcManager.onHeartbeatTimeout = () => {
        logger.error('[Master] Worker heartbeat timeout, triggering restart...');
        restartWorker();
    };

    ipcManager.registerMessageHandler('ready', (message) => {
        logger.info('[Master] Worker is ready');
    });

    ipcManager.registerMessageHandler('restart_request', (message) => {
        logger.info('[Master] Worker requested restart');
        restartWorker();
    });

    ipcManager.registerMessageHandler('status', (message) => {
        logger.info('[Master] Worker status:', message.data);
    });

    ipcManager.setWorkerProcess(worker);
}

/**
 * 停止子进程
 * @param {boolean} graceful - 是否优雅关闭
 * @returns {Promise<void>}
 */
function stopWorker(graceful = true) {
    return new Promise((resolve) => {
        const stats = ipcManager.getStats();
        if (!stats.workerConnected) {
            logger.info('[Master] No worker process to stop');
            resolve();
            return;
        }

        logger.info('[Master] Stopping worker process, PID:', workerStatus.pid);

        const timeout = setTimeout(() => {
            const worker = ipcManager.workerProcess;
            if (worker) {
                logger.info('[Master] Force killing worker process...');
                worker.kill('SIGKILL');
            }
            resolve();
        }, 5000);

        const handleExit = () => {
            clearTimeout(timeout);
            logger.info('[Master] Worker process stopped');
            resolve();
        };

        ipcManager.onWorkerDisconnect = handleExit;

        if (graceful) {
            ipcManager.send({ type: 'shutdown' });
            ipcManager.workerProcess?.kill('SIGTERM');
        } else {
            ipcManager.workerProcess?.kill('SIGKILL');
        }
    });
}

/**
 * 重启子进程
 * @returns {Promise<Object>}
 */
async function restartWorker() {
    if (workerStatus.isRestarting) {
        logger.info('[Master] Restart already in progress');
        return { success: false, message: 'Restart already in progress' };
    }

    workerStatus.isRestarting = true;
    workerStatus.restartCount++;
    workerStatus.lastRestartTime = new Date().toISOString();

    logger.info('[Master] Restarting worker process...');

    try {
        await stopWorker(true);
        
        // 等待一小段时间确保端口释放
        await new Promise(resolve => setTimeout(resolve, config.restartDelay));
        
        startWorker();
        workerStatus.isRestarting = false;

        return {
            success: true,
            message: 'Worker restarted successfully',
            pid: workerStatus.pid,
            restartCount: workerStatus.restartCount
        };
    } catch (error) {
        workerStatus.isRestarting = false;
        logger.error('[Master] Failed to restart worker:', error.message);
        return {
            success: false,
            message: 'Failed to restart worker: ' + error.message
        };
    }
}

/**
 * 计划重启（用于崩溃后自动重启）
 */
function scheduleRestart() {
    if (workerStatus.restartCount >= config.maxRestartAttempts) {
        logger.error('[Master] Max restart attempts reached, giving up');
        return;
    }

    const delay = Math.min(config.restartDelay * Math.pow(2, workerStatus.restartCount), 30000);
    logger.info(`[Master] Scheduling restart in ${delay}ms...`);

    setTimeout(() => {
        restartWorker();
    }, delay);
}

/**
 * 获取子进程资源使用情况
 * @returns {Object|null}
 */
function getWorkerResourceUsage() {
    const worker = ipcManager.workerProcess;
    if (!worker) {
        return null;
    }

    try {
        const usage = worker.resourceUsage ? worker.resourceUsage() : null;
        const memory = worker.memoryUsage ? worker.memoryUsage() : null;
        
        const totalMemory = process.platform === 'win32' 
            ? (() => {
                try {
                    const cpus = os.cpus();
                    return cpus.length * 4 * 1024 * 1024 * 1024; // 假设每核4GB
                } catch {
                    return 8 * 1024 * 1024 * 1024; // 默认8GB
                }
            })()
            : os.totalmem();

        return {
            pid: worker.pid,
            cpu: usage ? {
                user: usage.userCPUTime,
                system: usage.systemCPUTime,
                total: usage.userCPUTime + usage.systemCPUTime
            } : null,
            memory: memory ? {
                rss: memory.rss,
                heapTotal: memory.heapTotal,
                heapUsed: memory.heapUsed,
                external: memory.external,
                percentage: memory.rss > 0 ? ((memory.rss / totalMemory) * 100).toFixed(2) : 0
            } : null,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        logger.warn('[Master] Failed to get worker resource usage:', error.message);
        return null;
    }
}

/**
 * 记录资源使用样本
 */
function recordResourceUsage() {
    const usage = getWorkerResourceUsage();
    if (!usage) return;

    const cpuPercent = calculateCpuPercentage(usage);
    
    resourceMonitorStatus.recentCpuUsage.push({
        timestamp: usage.timestamp,
        value: cpuPercent
    });
    resourceMonitorStatus.recentMemoryUsage.push({
        timestamp: usage.timestamp,
        value: parseFloat(usage.memory?.percentage || 0)
    });

    if (resourceMonitorStatus.recentCpuUsage.length > resourceMonitorStatus.maxSamples) {
        resourceMonitorStatus.recentCpuUsage.shift();
    }
    if (resourceMonitorStatus.recentMemoryUsage.length > resourceMonitorStatus.maxSamples) {
        resourceMonitorStatus.recentMemoryUsage.shift();
    }

    checkResourceAlerts(cpuPercent, parseFloat(usage.memory?.percentage || 0));
}

/**
 * 计算CPU使用率百分比
 */
function calculateCpuPercentage(usage) {
    if (!usage.cpu) return 0;
    
    const cpus = os.cpus();
    const elapsedMs = Date.now() - new Date(workerStatus.startTime).getTime();
    if (elapsedMs <= 0) return 0;

    const totalCpuTimeMs = (usage.cpu.user + usage.cpu.system) / 10000;
    const cpuPercent = (totalCpuTimeMs / elapsedMs) * 100 * cpus.length;
    
    return Math.min(cpuPercent, 100);
}

/**
 * 检查资源使用并触发告警
 */
function checkResourceAlerts(cpuPercent, memoryPercent) {
    const { cpuThreshold, memoryThreshold, maxConsecutiveAlerts } = config.resourceMonitor;
    const now = Date.now();

    if (cpuPercent >= cpuThreshold) {
        resourceMonitorStatus.consecutiveCpuAlerts++;
        
        if (resourceMonitorStatus.consecutiveCpuAlerts >= maxConsecutiveAlerts) {
            const timeSinceLastAlert = resourceMonitorStatus.lastCpuAlertTime 
                ? now - resourceMonitorStatus.lastCpuAlertTime 
                : Infinity;
            
            if (timeSinceLastAlert >= 60000) {
                logger.warn(`[Master] [RESOURCE ALERT] Worker CPU usage is ${cpuPercent.toFixed(2)}% (threshold: ${cpuThreshold}%)`);
                logger.warn(`[Master] [RESOURCE ALERT] Worker PID: ${workerStatus.pid}, Uptime: ${Math.floor(process.uptime())}s`);
                resourceMonitorStatus.lastCpuAlertTime = now;
            }
        }
    } else {
        resourceMonitorStatus.consecutiveCpuAlerts = 0;
    }

    if (memoryPercent >= memoryThreshold) {
        resourceMonitorStatus.consecutiveMemoryAlerts++;
        
        if (resourceMonitorStatus.consecutiveMemoryAlerts >= maxConsecutiveAlerts) {
            const timeSinceLastAlert = resourceMonitorStatus.lastMemoryAlertTime 
                ? now - resourceMonitorStatus.lastMemoryAlertTime 
                : Infinity;
            
            if (timeSinceLastAlert >= 60000) {
                logger.warn(`[Master] [RESOURCE ALERT] Worker memory usage is ${memoryPercent.toFixed(2)}% (threshold: ${memoryThreshold}%)`);
                logger.warn(`[Master] [RESOURCE ALERT] Worker PID: ${workerStatus.pid}, RSS: ${formatBytes(getWorkerResourceUsage()?.memory?.rss || 0)}`);
                resourceMonitorStatus.lastMemoryAlertTime = now;
            }
        }
    } else {
        resourceMonitorStatus.consecutiveMemoryAlerts = 0;
    }
}

/**
 * 格式化字节数
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 启动资源监控
 */
function startResourceMonitor() {
    if (!config.resourceMonitor.enabled) {
        logger.info('[Master] Resource monitoring is disabled');
        return;
    }

    logger.info('[Master] Starting resource monitor...');
    logger.info(`[Master] Resource monitor interval: ${config.resourceMonitor.interval}ms`);
    logger.info(`[Master] CPU threshold: ${config.resourceMonitor.cpuThreshold}%`);
    logger.info(`[Master] Memory threshold: ${config.resourceMonitor.memoryThreshold}%`);

    // 立即执行一次
    recordResourceUsage();

    // 设置定时任务
    setInterval(() => {
        if (ipcManager.workerProcess && !workerStatus.isRestarting) {
            recordResourceUsage();
        }
    }, config.resourceMonitor.interval);
}

/**
 * 获取状态信息
 * @returns {Object}
 */
function getStatus() {
    const workerUsage = getWorkerResourceUsage();
    const cpuPercent = workerUsage ? calculateCpuPercentage(workerUsage) : 0;
    
    return {
        master: {
            pid: process.pid,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            memoryPercentage: ((process.memoryUsage().rss / require('os').totalmem()) * 100).toFixed(2)
        },
        worker: {
            pid: workerStatus.pid,
            startTime: workerStatus.startTime,
            restartCount: workerStatus.restartCount,
            lastRestartTime: workerStatus.lastRestartTime,
            isRestarting: workerStatus.isRestarting,
            isRunning: ipcManager.workerProcess !== null,
            resourceUsage: workerUsage,
            cpuPercentage: cpuPercent.toFixed(2),
            recentCpuUsage: [...resourceMonitorStatus.recentCpuUsage],
            recentMemoryUsage: [...resourceMonitorStatus.recentMemoryUsage]
        },
        resourceMonitor: {
            enabled: config.resourceMonitor.enabled,
            interval: config.resourceMonitor.interval,
            cpuThreshold: config.resourceMonitor.cpuThreshold,
            memoryThreshold: config.resourceMonitor.memoryThreshold,
            consecutiveAlerts: {
                cpu: resourceMonitorStatus.consecutiveCpuAlerts,
                memory: resourceMonitorStatus.consecutiveMemoryAlerts
            }
        }
    };
}

/**
 * 检查端口是否被占用
 */
function isPortInUse(port) {
    return new Promise((resolve) => {
        const server = http.createServer();
        server.once('error', () => resolve(true));
        server.once('listening', () => {
            server.close(() => resolve(false));
        });
        server.listen(port);
    });
}

/**
 * 创建管理服务器
 */
async function createMasterServer() {
    const port = config.masterPort;
    
    const inUse = await isPortInUse(port);
    if (inUse) {
        logger.warn(`[Master] Port ${port} is already in use, attempting to find existing master...`);
        
        try {
            const response = await fetch(`http://localhost:${port}/master/status`);
            if (response.ok) {
                const status = await response.json();
                logger.warn(`[Master] Found existing master process, PID: ${status.pid || 'unknown'}`);
                logger.warn(`[Master] This instance will exit to avoid conflicts`);
                process.exit(1);
            }
        } catch {
            logger.warn(`[Master] Port ${port} occupied but no response from existing master`);
        }
        
        logger.error(`[Master] Cannot start: port ${port} is already in use`);
        process.exit(1);
    }
    
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const path = url.pathname;
        const method = req.method;

        // 设置 CORS 头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        // 状态端点
        if (method === 'GET' && path === '/master/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(getStatus()));
            return;
        }

        // 重启端点
        if (method === 'POST' && path === '/master/restart') {
            logger.info('[Master] Restart requested via API');
            restartWorker().then(result => {
                res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            }).catch(error => {
                logger.error('[Master] Restart error:', error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Restart failed: ' + error.message }));
            });
            return;
        }

        // 停止端点
        if (method === 'POST' && path === '/master/stop') {
            logger.info('[Master] Stop requested via API');
            stopWorker(true).then(() => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Worker stopped' }));
            }).catch(error => {
                logger.error('[Master] Stop error:', error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Stop failed: ' + error.message }));
            });
            return;
        }

        // 启动端点
        if (method === 'POST' && path === '/master/start') {
            logger.info('[Master] Start requested via API');
            if (workerProcess) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Worker already running' }));
                return;
            }
            startWorker();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Worker started', pid: workerStatus.pid }));
            return;
        }

        // 健康检查
        if (method === 'GET' && path === '/master/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'healthy',
                workerRunning: workerProcess !== null,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    });

    server.listen(config.masterPort, () => {
        logger.info(`[Master] Management server listening on port ${config.masterPort}`);
        logger.info(`[Master] Available endpoints:`);
        logger.info(`  GET  /master/status  - Get master and worker status`);
        logger.info(`  GET  /master/health  - Health check`);
        logger.info(`  POST /master/restart - Restart worker process`);
        logger.info(`  POST /master/stop    - Stop worker process`);
        logger.info(`  POST /master/start   - Start worker process`);
    });

    return server;
}

/**
 * 处理进程信号
 */
function setupSignalHandlers() {
    // 优雅关闭
    process.on('SIGTERM', async () => {
        logger.info('[Master] Received SIGTERM, shutting down...');
        await stopWorker(true);
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        logger.info('[Master] Received SIGINT, shutting down...');
        await stopWorker(true);
        process.exit(0);
    });

    // 未捕获的异常
    process.on('uncaughtException', (error) => {
        logger.error('[Master] Uncaught exception:', error);
        
        // 检查是否为可重试的网络错误
        if (isRetryableNetworkError(error)) {
            logger.warn('[Master] Network error detected, continuing operation...');
            return; // 不退出程序，继续运行
        }
        
        // 对于其他严重错误，记录但不退出（由主进程管理子进程）
        logger.error('[Master] Fatal error detected in master process');
    });

    process.on('unhandledRejection', (reason, promise) => {
        if (reason instanceof Error) {
            logger.error('[Master] Unhandled rejection at:', promise, 'reason:', reason.message);
            if (isRetryableNetworkError(reason)) {
                logger.warn('[Master] Network error in promise rejection, continuing operation...');
                return;
            }
        } else {
            logger.error('[Master] Unhandled rejection with non-Error reason:', reason);
        }
    });
}

/**
 * 初始化配置
 */
async function initConfig() {
    await initializeConfig(process.argv.slice(2));
    
    config = {
        workerScript: path.join(__dirname, '../services/api-server.js'),
        maxRestartAttempts: 10,
        restartDelay: 1000,
        masterPort: CONFIG.MASTER_PORT || parseInt(process.env.MASTER_PORT) || 3100,
        args: process.argv.slice(2),
        resourceMonitor: {
            enabled: process.env.RESOURCE_MONITOR_ENABLED !== 'false',
            interval: parseInt(process.env.RESOURCE_MONITOR_INTERVAL) || 5000,
            cpuThreshold: parseFloat(process.env.CPU_THRESHOLD) || 80,
            memoryThreshold: parseFloat(process.env.MEMORY_THRESHOLD) || 80,
            maxConsecutiveAlerts: parseInt(process.env.MAX_CONSECUTIVE_ALERTS) || 3
        }
    };
}

/**
 * 主函数
 */
async function main() {
    await initConfig();
    
    logger.info('='.repeat(50));
    logger.info('[Master] AIClient2API Master Process');
    logger.info('[Master] PID:', process.pid);
    logger.info('[Master] Node version:', process.version);
    logger.info('[Master] Working directory:', process.cwd());
    logger.info('[Master] Management port:', config.masterPort);
    logger.info('='.repeat(50));

    // 设置信号处理
    setupSignalHandlers();

    // 创建管理服务器
    await createMasterServer();

    // 启动子进程
    startWorker();

    // 启动资源监控
    startResourceMonitor();
}

// 启动主进程
main().catch(error => {
    logger.error('[Master] Failed to start:', error);
    process.exit(1);
});