import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDashboard } from '../../src/composables/useDashboard.js';
import { api } from '../../src/utils/api.js';

vi.mock('../../src/utils/api.js', () => ({
  api: {
    get: vi.fn()
  }
}));

describe('useDashboard Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default values', () => {
    const { stats, providerStats, gpuInfo, isLoading, error } = useDashboard();
    
    expect(stats.value).toEqual({
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0
    });
    
    expect(providerStats.value).toEqual([]);
    expect(gpuInfo.value).toEqual([]);
    expect(isLoading.value).toBe(false);
    expect(error.value).toBe(null);
  });

  it('should fetch stats successfully', async () => {
    const mockStats = {
      totalRequests: 100,
      successfulRequests: 95,
      failedRequests: 5,
      avgResponseTime: 120
    };
    
    api.get.mockResolvedValueOnce({ data: mockStats });
    
    const { stats, fetchStats } = useDashboard();
    
    await fetchStats();
    
    expect(api.get).toHaveBeenCalledWith('/api/stats');
    expect(stats.value).toEqual(mockStats);
  });

  it('should handle error when fetching stats', async () => {
    const mockError = new Error('Network error');
    api.get.mockRejectedValueOnce(mockError);
    
    const { error, fetchStats } = useDashboard();
    
    await fetchStats();
    
    expect(error.value).toBe('获取统计数据失败');
  });

  it('should fetch provider stats successfully', async () => {
    const mockProviderStats = [
      { provider: 'gemini-cli-oauth', count: 50, successRate: 98 },
      { provider: 'claude-custom', count: 30, successRate: 95 }
    ];
    
    api.get.mockResolvedValueOnce({ data: { providers: mockProviderStats } });
    
    const { providerStats, fetchProviderStats } = useDashboard();
    
    await fetchProviderStats();
    
    expect(api.get).toHaveBeenCalledWith('/api/provider-stats');
    expect(providerStats.value).toEqual(mockProviderStats);
  });

  it('should handle error when fetching provider stats', async () => {
    const mockError = new Error('Network error');
    api.get.mockRejectedValueOnce(mockError);
    
    const { error, fetchProviderStats } = useDashboard();
    
    await fetchProviderStats();
    
    expect(error.value).toBe('获取提供商统计数据失败');
  });

  it('should fetch GPU info successfully', async () => {
    const mockGpuInfo = [
      { name: 'NVIDIA RTX 3090', usage: 45, memoryUsed: 4096, memoryTotal: 24576 },
      { name: 'NVIDIA RTX 4090', usage: 60, memoryUsed: 8192, memoryTotal: 24576 }
    ];
    
    api.get.mockResolvedValueOnce({ data: { gpus: mockGpuInfo } });
    
    const { gpuInfo, fetchGpuInfo } = useDashboard();
    
    await fetchGpuInfo();
    
    expect(api.get).toHaveBeenCalledWith('/api/gpu-info');
    expect(gpuInfo.value).toEqual(mockGpuInfo);
  });

  it('should handle error when fetching GPU info', async () => {
    const mockError = new Error('GPU not available');
    api.get.mockRejectedValueOnce(mockError);
    
    const { error, fetchGpuInfo } = useDashboard();
    
    await fetchGpuInfo();
    
    expect(error.value).toBe('获取GPU信息失败');
  });

  it('should calculate success rate correctly', () => {
    const { calculateSuccessRate } = useDashboard();
    
    expect(calculateSuccessRate(100, 95)).toBe(95);
    expect(calculateSuccessRate(0, 0)).toBe(0);
    expect(calculateSuccessRate(10, 5)).toBe(50);
  });

  it('should calculate memory usage percentage correctly', () => {
    const { calculateMemoryUsage } = useDashboard();
    
    expect(calculateMemoryUsage(4096, 16384)).toBe(25);
    expect(calculateMemoryUsage(0, 1000)).toBe(0);
    expect(calculateMemoryUsage(1000, 1000)).toBe(100);
  });

  it('should fetch all data when fetchAll called', async () => {
    const mockStats = { totalRequests: 100, successfulRequests: 95, failedRequests: 5, avgResponseTime: 120 };
    const mockProviderStats = [{ provider: 'test', count: 50, successRate: 98 }];
    const mockGpuInfo = [{ name: 'Test GPU', usage: 50, memoryUsed: 1000, memoryTotal: 2000 }];
    
    api.get
      .mockResolvedValueOnce({ data: mockStats })
      .mockResolvedValueOnce({ data: { providers: mockProviderStats } })
      .mockResolvedValueOnce({ data: { gpus: mockGpuInfo } });
    
    const { stats, providerStats, gpuInfo, fetchAll } = useDashboard();
    
    await fetchAll();
    
    expect(api.get).toHaveBeenCalledTimes(3);
    expect(stats.value).toEqual(mockStats);
    expect(providerStats.value).toEqual(mockProviderStats);
    expect(gpuInfo.value).toEqual(mockGpuInfo);
  });
});