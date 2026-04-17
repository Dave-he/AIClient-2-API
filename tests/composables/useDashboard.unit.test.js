import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { useDashboard } from '../../src/composables/useDashboard.js';
import { apiClient } from '@/utils/api.js';

jest.mock('@/utils/api.js', () => ({
  apiClient: {
    get: jest.fn()
  }
}));

jest.mock('@/utils/logger.js', () => ({
  logger: {
    error: jest.fn()
  }
}));

describe('useDashboard Composable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize with default values', () => {
    const { systemInfo, providerStatus, gpuStatus, pythonGpuConnected } = useDashboard();
    
    expect(systemInfo.value.uptime).toBe('--');
    expect(systemInfo.value.cpu).toBe(0);
    expect(systemInfo.value.memory).toBe(0);
    expect(providerStatus.value).toEqual([]);
    expect(gpuStatus.value.loading).toBe(true);
    expect(pythonGpuConnected.value).toBe(false);
  });

  it('should fetch system info successfully', async () => {
    const mockSystemInfo = {
      uptime: 86400,
      appVersion: '1.0.0',
      nodeVersion: '20.0.0',
      serverTime: new Date().toISOString(),
      platform: 'linux',
      pid: 1234
    };
    
    apiClient.get.mockResolvedValueOnce({ data: mockSystemInfo });
    
    const { fetchSystemInfo, systemInfo } = useDashboard();
    
    await fetchSystemInfo();
    
    expect(apiClient.get).toHaveBeenCalledWith('/api/system');
    expect(systemInfo.value.version).toBe('1.0.0');
  });

  it('should fetch system monitor data', async () => {
    const mockMonitorData = {
      cpu: { usage: 45 },
      memory: { usagePercent: '60' },
      gpu: { usage: 30 }
    };
    
    apiClient.get.mockResolvedValueOnce({ data: mockMonitorData });
    
    const { fetchSystemMonitor, systemInfo } = useDashboard();
    
    await fetchSystemMonitor();
    
    expect(apiClient.get).toHaveBeenCalledWith('/api/system/monitor');
    expect(systemInfo.value.cpu).toBe(45);
    expect(systemInfo.value.memory).toBe(60);
  });

  it('should fetch provider status', async () => {
    const mockProviderData = {
      providers: {
        'gemini-cli-oauth': [{ isHealthy: true, requestCount: 10 }],
        'claude-custom': [{ isHealthy: false }, { isHealthy: true }]
      }
    };
    
    apiClient.get.mockResolvedValueOnce({ data: mockProviderData });
    
    const { fetchProviderStatus, providerStatus } = useDashboard();
    
    await fetchProviderStatus();
    
    expect(apiClient.get).toHaveBeenCalledWith('/api/providers');
    expect(providerStatus.value.length).toBe(2);
  });

  it('should format uptime correctly', () => {
    const { formatUptime } = useDashboard();
    
    expect(formatUptime(86400)).toBe('1天 0小时 0分钟');
    expect(formatUptime(3661)).toBe('0天 1小时 1分钟');
    expect(formatUptime(60)).toBe('0天 0小时 1分钟');
  });
});