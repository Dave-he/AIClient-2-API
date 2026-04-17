import { ref, onMounted, onUnmounted } from 'vue';
import { api } from '@/utils/api.js';

export function useDashboard() {
  const systemInfo = ref({
    uptime: '--',
    cpu: 0,
    memory: 0,
    gpu: 0,
    version: '--',
    nodeVersion: '--',
    serverTime: '--',
    platform: '--',
    mode: 'development',
    pid: '--'
  });

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

  const providerStatus = ref([]);
  const availableModels = ref([]);

  const hasUpdate = ref(false);
  const latestVersion = ref('');

  const routingExamples = ref([
    { path: '/api/v1/chat/completions', description: '默认提供商', fullPath: '/api/v1/chat/completions' },
    { path: '/gemini-cli-oauth/v1/chat/completions', description: 'Gemini CLI OAuth', fullPath: '/gemini-cli-oauth/v1/chat/completions' },
    { path: '/claude-custom/v1/chat/completions', description: 'Claude Custom', fullPath: '/claude-custom/v1/chat/completions' },
    { path: '/openai-custom/v1/chat/completions', description: 'OpenAI Custom', fullPath: '/openai-custom/v1/chat/completions' }
  ]);

  let refreshInterval = null;

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}天 ${hours}小时 ${minutes}分钟`;
  };

  const fetchSystemInfo = async () => {
    try {
      const response = await api.get('/api/system');
      const data = response.data;
      
      systemInfo.value = {
        ...systemInfo.value,
        uptime: formatUptime(data.uptime),
        version: data.appVersion || '--',
        nodeVersion: data.nodeVersion || '--',
        serverTime: new Date(data.serverTime).toLocaleString('zh-CN'),
        platform: data.platform === 'linux' ? 'Linux x64' : (data.platform === 'win32' ? 'Windows' : data.platform) || '--',
        mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
        pid: data.pid || '--'
      };
    } catch (error) {
      console.error('Failed to fetch system info:', error);
    }
  };

  const fetchSystemMonitor = async () => {
    try {
      const response = await api.get('/api/system/monitor');
      const data = response.data;
      
      systemInfo.value = {
        ...systemInfo.value,
        cpu: Math.round(data.cpu?.usage || 0),
        memory: Math.round(parseFloat(data.memory?.usagePercent || 0)),
        gpu: Math.round(data.gpu?.usage || 0)
      };
    } catch (error) {
      console.error('Failed to fetch system monitor:', error);
    }
  };

  const fetchGpuStatus = async () => {
    try {
      gpuStatus.value.loading = true;
      gpuStatus.value.error = '';
      
      const response = await api.get('/api/gpu/status');
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
      const response = await api.get('/api/python-gpu/status');
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

  const fetchProviderStatus = async () => {
    try {
      const response = await api.get('/api/providers');
      const data = response.data;
      
      const providers = [];
      for (const [type, items] of Object.entries(data.providers || {})) {
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
      
      providerStatus.value = providers;
    } catch (error) {
      console.error('Failed to fetch provider status:', error);
    }
  };

  const fetchModels = async () => {
    try {
      const response = await api.get('/api/provider-models');
      const data = response.data;
      
      const models = new Set();
      for (const typeModels of Object.values(data)) {
        if (Array.isArray(typeModels)) {
          typeModels.forEach(model => models.add(model));
        }
      }
      
      availableModels.value = Array.from(models).sort();
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const checkUpdate = async () => {
    try {
      const response = await api.get('/api/system/check-update');
      if (response.data.hasUpdate) {
        hasUpdate.value = true;
        latestVersion.value = response.data.latestVersion;
      }
    } catch (error) {
      console.error('Failed to check update:', error);
    }
  };

  const performUpdate = async () => {
    try {
      await api.post('/api/system/update');
      window.$toast?.success('更新已开始，请等待服务重启');
    } catch (error) {
      window.$toast?.error('更新失败: ' + error.message);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      window.$toast?.success(`已复制: ${text}`);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const refreshGpuStatus = async () => {
    await fetchGpuStatus();
  };

  const refreshPythonGpu = async () => {
    await fetchPythonGpuStatus();
  };

  const refreshProviderStatus = async () => {
    await fetchProviderStatus();
    await fetchModels();
  };

  onMounted(async () => {
    await fetchSystemInfo();
    await fetchSystemMonitor();
    await fetchGpuStatus();
    await fetchPythonGpuStatus();
    await fetchProviderStatus();
    await fetchModels();
    await checkUpdate();

    refreshInterval = setInterval(async () => {
      await fetchSystemMonitor();
      await fetchSystemInfo();
    }, 5000);
  });

  onUnmounted(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  return {
    systemInfo,
    gpuStatus,
    pythonGpuConnected,
    pythonGpuInfo,
    providerStatus,
    availableModels,
    hasUpdate,
    latestVersion,
    routingExamples,
    refreshGpuStatus,
    refreshPythonGpu,
    refreshProviderStatus,
    checkUpdate,
    performUpdate,
    copyToClipboard
  };
}