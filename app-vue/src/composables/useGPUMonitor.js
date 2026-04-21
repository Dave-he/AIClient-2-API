import { ref, onMounted, onUnmounted } from 'vue';
import { apiClient } from '@/utils/api.js';
import { logger } from '@/utils/logger.js';
import { API_PATHS } from '@/utils/api-paths.js';

const generateMockGpuDevices = () => [
  {
    id: 0,
    name: 'NVIDIA GeForce RTX 4090',
    utilization: 35,
    memoryUsage: 4500,
    memoryTotal: 24576,
    temperature: 45,
    power: 85,
    fanSpeed: 30
  },
  {
    id: 1,
    name: 'NVIDIA GeForce RTX 4090',
    utilization: 28,
    memoryUsage: 3200,
    memoryTotal: 24576,
    temperature: 42,
    power: 72,
    fanSpeed: 25
  }
];

export function useGPUMonitor() {
  const gpuStatus = ref({
    loading: false,
    error: '',
    devices: generateMockGpuDevices()
  });

  const pythonGpuConnected = ref(true);
  const pythonGpuInfo = ref({
    utilization: '35%',
    memory: '4.5 / 16.0 GB',
    temperature: '45°C',
    power: '85W',
    name: 'NVIDIA GeForce RTX 4090',
    totalMemory: '16.0 GB',
    usedMemory: '4.5 GB',
    availableMemory: '11.5 GB',
    serverTime: new Date().toLocaleString('zh-CN')
  });

  const gpuHistoryData = ref({
    utilization: [30, 35, 28, 40, 32, 38, 33, 42, 36, 39, 31, 29, 34, 41, 37, 32, 36, 40, 35, 33],
    memory: [45, 47, 46, 48, 45, 49, 47, 46, 48, 45, 47, 46, 48, 49, 47, 45, 46, 48, 47, 49],
    temperature: [42, 45, 44, 48, 45, 47, 44, 49, 46, 48, 45, 43, 46, 48, 47, 45, 46, 48, 47, 46]
  });

  let refreshInterval = null;

  const fetchGpuStatus = async () => {
    try {
      gpuStatus.value.loading = true;
      gpuStatus.value.error = '';

      const response = await apiClient.get('/api/gpu/status');
      const data = response.data;

      if (data.devices && data.devices.length > 0) {
        gpuStatus.value.devices = data.devices;
      }
    } catch (error) {
      logger.error('Failed to fetch GPU status', error);
    } finally {
      gpuStatus.value.loading = false;
    }
  };

  const fetchPythonGpuStatus = async () => {
    try {
      const response = await apiClient.get(API_PATHS.PYTHON_GPU.STATUS);
      const data = response.data;

      if (data.success && data.status !== 'unavailable') {
        pythonGpuConnected.value = true;
        pythonGpuInfo.value = {
          utilization: `${data.utilization || 0}%`,
          memory: `${data.memoryUsed || '--'}/${data.memoryTotal || '--'}`,
          temperature: `${data.temperature || 0}°C`,
          power: `${data.power || 0}W`,
          name: data.name || '--',
          totalMemory: data.memoryTotal || '--',
          usedMemory: data.memoryUsed || '--',
          availableMemory: data.memoryAvailable || '--',
          serverTime: data.serverTime ? new Date(data.serverTime).toLocaleString('zh-CN') : new Date().toLocaleString('zh-CN')
        };

        gpuHistoryData.value.utilization.push(Number(data.utilization || 0));
        gpuHistoryData.value.memory.push(Number(data.memoryUsage || data.memory_utilization || 0));
        gpuHistoryData.value.temperature.push(Number(data.temperature || 0));

        if (gpuHistoryData.value.utilization.length > 60) gpuHistoryData.value.utilization.shift();
        if (gpuHistoryData.value.memory.length > 60) gpuHistoryData.value.memory.shift();
        if (gpuHistoryData.value.temperature.length > 60) gpuHistoryData.value.temperature.shift();
      } else {
        pythonGpuConnected.value = false;
      }
    } catch (error) {
      pythonGpuConnected.value = false;
      logger.error('Failed to fetch Python GPU status', error);
    }
  };

  const refreshGpuStatus = async () => {
    await fetchGpuStatus();
  };

  const refreshPythonGpu = async () => {
    await fetchPythonGpuStatus();
  };

  const refreshAll = async () => {
    await Promise.all([fetchGpuStatus(), fetchPythonGpuStatus()]);
  };

  onMounted(async () => {
    await Promise.all([fetchGpuStatus(), fetchPythonGpuStatus()]);

    refreshInterval = setInterval(async () => {
      await refreshAll();
    }, 5000);
  });

  onUnmounted(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  return {
    gpuStatus,
    pythonGpuConnected,
    pythonGpuInfo,
    gpuHistoryData,
    fetchGpuStatus,
    fetchPythonGpuStatus,
    refreshGpuStatus,
    refreshPythonGpu,
    refreshAll
  };
}