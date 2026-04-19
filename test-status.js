#!/usr/bin/env node

/**
 * Test script to check if getStatus function is working correctly
 */

import { fork } from 'child_process';
import os from 'os';

// Mock worker process
const mockWorkerProcess = {
  pid: 12345,
  resourceUsage: () => {
    return {
      userCPUTime: 1000000,
      systemCPUTime: 500000
    };
  },
  memoryUsage: () => {
    return {
      rss: 100000000,
      heapTotal: 50000000,
      heapUsed: 30000000,
      external: 10000000
    };
  }
};

// Mock worker status
const workerStatus = {
  pid: mockWorkerProcess.pid,
  startTime: new Date().toISOString(),
  restartCount: 0,
  lastRestartTime: null,
  isRestarting: false
};

// Mock resource monitor status
const resourceMonitorStatus = {
  consecutiveCpuAlerts: 0,
  consecutiveMemoryAlerts: 0,
  lastCpuAlertTime: null,
  lastMemoryAlertTime: null,
  recentCpuUsage: [],
  recentMemoryUsage: [],
  maxSamples: 12
};

// Mock config
const config = {
  resourceMonitor: {
    enabled: true,
    interval: 5000,
    cpuThreshold: 80,
    memoryThreshold: 80,
    maxConsecutiveAlerts: 3
  }
};

/**
 * Get worker resource usage
 */
function getWorkerResourceUsage() {
  if (!mockWorkerProcess) {
    return null;
  }

  try {
    const usage = mockWorkerProcess.resourceUsage ? mockWorkerProcess.resourceUsage() : null;
    const memory = mockWorkerProcess.memoryUsage ? mockWorkerProcess.memoryUsage() : null;
    
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
      pid: mockWorkerProcess.pid,
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
    console.warn('[Master] Failed to get worker resource usage:', error.message);
    return null;
  }
}

/**
 * Calculate CPU usage percentage
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
 * Get status information
 */
function getStatus() {
  console.log('Calling getWorkerResourceUsage...');
  const workerUsage = getWorkerResourceUsage();
  console.log('Worker usage:', workerUsage);
  
  console.log('Calculating CPU percentage...');
  const cpuPercent = workerUsage ? calculateCpuPercentage(workerUsage) : 0;
  console.log('CPU percentage:', cpuPercent);
  
  console.log('Building status object...');
  const status = {
    master: {
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      memoryPercentage: ((process.memoryUsage().rss / os.totalmem()) * 100).toFixed(2)
    },
    worker: {
      pid: workerStatus.pid,
      startTime: workerStatus.startTime,
      restartCount: workerStatus.restartCount,
      lastRestartTime: workerStatus.lastRestartTime,
      isRestarting: workerStatus.isRestarting,
      isRunning: mockWorkerProcess !== null,
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
  
  console.log('Status object built successfully');
  return status;
}

// Test the getStatus function
try {
  console.log('Testing getStatus function...');
  const status = getStatus();
  console.log('Status:', JSON.stringify(status, null, 2));
  console.log('Test passed! getStatus function works correctly.');
} catch (error) {
  console.error('Test failed! Error:', error);
  console.error('Stack:', error.stack);
}
