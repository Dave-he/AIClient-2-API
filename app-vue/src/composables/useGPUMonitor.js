import { ref } from 'vue';
import { apiClient } from '@/utils/api.js';
import { logger } from '@/utils/logger.js';

export function useGPUMonitor() {
  const gpuStatus = ref({
    loading: true,
    error: '',
    devices: []
  });

  const pythonGpuConnected = ref(false);
  const pythonGpuInfo = ref({
    utilization: '--',
    memory: '--',
    temperature: '--',
    power: '--',
    name: '--',
    totalMemory: '--',
    usedMemory: '--',
    availableMemory: '--',
    serverTime: '--'
  });

  const fetchGpuStatus = async () => {
    try {
      gpuStatus.value.loading = true;
      gpuStatus.value.error = '';

      const response = await apiClient.get('/api/gpu/status');
      const data = response.data;

      gpuStatus.value.devices = data.devices || [];
    } catch (error) {
      gpuStatus.value.error = '无法获取GPU状态';
    } finally {
      gpuStatus.value.loading = false;
    }
  };

  const fetchPythonGpuStatus = async () => {
    try {
      const response = await apiClient.get('/api/python-gpu/status');
      const data = response.data;

      if (data.success) {
        pythonGpuConnected.value = true;
        pythonGpuInfo.value = {
          utilization: `${data.utilization}%`,
          memory: `${data.memoryUsed}/${data.memoryTotal}`,
          temperature: `${data.temperature}°C`,
          power: `${data.power}W`,
          name: data.name || '--',
          totalMemory: data.memoryTotal || '--',
          usedMemory: data.memoryUsed || '--',
          availableMemory: data.memoryAvailable || '--',
          serverTime: data.serverTime ? new Date(data.serverTime).toLocaleString('zh-CN') : '--'
        };
      } else {
        pythonGpuConnected.value = false;
      }
    } catch (error) {
      pythonGpuConnected.value = false;
    }
  };

  const refreshGpuStatus = async () => {
    await fetchGpuStatus();
  };

  const refreshPythonGpu = async () => {
    await fetchPythonGpuStatus();
  };

  return {
    gpuStatus,
    pythonGpuConnected,
    pythonGpuInfo,
    fetchGpuStatus,
    fetchPythonGpuStatus,
    refreshGpuStatus,
    refreshPythonGpu
  };
}
