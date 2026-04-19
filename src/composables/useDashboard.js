import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { apiClient } from '@/utils/api.js';
import { logger } from '@/utils/logger.js';
import { SimpleChart } from '@/utils/chart.js';

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

  // 图表实例
  let systemChart = null;
  let pythonGpuChart = null;
  let tokenChart = null;
  let refreshInterval = null;
  let chartUpdateInterval = null;

  // 图表数据
  const cpuData = ref([]);
  const memoryData = ref([]);
  const gpuData = ref([]);
  const gpuTempData = ref([]);
  const tokenChartData = ref({
    total: 0,
    input: 0,
    output: 0,
    history: []
  });

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}天 ${hours}小时 ${minutes}分钟`;
  };

  // 初始化图表
  const initCharts = async () => {
    await nextTick();
    
    const chartConfigs = {
      cpu: { lineColor: '#3b82f6', fillColor: 'rgba(59, 130, 246, 0.1)', label: 'CPU使用率' },
      memory: { lineColor: '#10b981', fillColor: 'rgba(16, 185, 129, 0.1)', label: '内存使用率' },
      gpu: { lineColor: '#8b5cf6', fillColor: 'rgba(139, 92, 246, 0.1)', label: 'GPU使用率' }
    };

    systemChart = new SimpleChart('systemChart', {
      ...chartConfigs.cpu,
      maxPoints: 60
    });

    pythonGpuChart = new SimpleChart('pythonGpuChart', {
      lineColor: '#f59e0b',
      fillColor: 'rgba(245, 158, 11, 0.1)',
      maxPoints: 60
    });

    tokenChart = new SimpleChart('tokenChart', {
      lineColor: '#06b6d4',
      fillColor: 'rgba(6, 182, 212, 0.1)',
      maxPoints: 60,
      maxValue: 100000,
      minValue: 0
    });
  };

  // 更新图表数据
  const updateChartData = () => {
    if (systemChart) {
      systemChart.data = cpuData.value.length > 0 ? cpuData.value : [];
      systemChart.draw();
    }
    if (pythonGpuChart && pythonGpuConnected.value) {
      const utilValue = parseFloat(pythonGpuInfo.value.utilization) || 0;
      pythonGpuChart.addPoint(utilValue);
      pythonGpuChart.draw();
    }
  };

  // 获取Token统计数据
  const fetchTokenStats = async () => {
    try {
      const response = await apiClient.get('/api/token-stats');
      const data = response.data;
      
      if (data.total) {
        tokenChartData.value = {
          total: data.total || 0,
          input: data.input || 0,
          output: data.output || 0,
          history: data.history || []
        };

        if (tokenChart && tokenChartData.value.history.length > 0) {
          tokenChart.data = tokenChartData.value.history.map(h => h.total || 0);
          tokenChart.draw();
        }
      }
    } catch (error) {
      logger.error('Failed to fetch token stats', error);
    }
  };

  const fetchSystemInfo = async () => {
    try {
      const response = await apiClient.get('/api/system');
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
      logger.error('Failed to fetch system info', error);
    }
  };

  const fetchSystemMonitor = async () => {
    try {
      const response = await apiClient.get('/api/system/monitor');
      const data = response.data;
      
      const cpu = Math.round(data.cpu?.usage || 0);
      const memory = Math.round(parseFloat(data.memory?.usagePercent || 0));
      const gpu = Math.round(data.gpu?.usage || 0);
      const gpuTemp = data.gpu?.temperature || 0;
      
      systemInfo.value = {
        ...systemInfo.value,
        cpu,
        memory,
        gpu
      };

      // 记录图表数据
      cpuData.value.push(cpu);
      memoryData.value.push(memory);
      gpuData.value.push(gpu);
      gpuTempData.value.push(gpuTemp);

      // 保留最多60个数据点
      if (cpuData.value.length > 60) cpuData.value.shift();
      if (memoryData.value.length > 60) memoryData.value.shift();
      if (gpuData.value.length > 60) gpuData.value.shift();
      if (gpuTempData.value.length > 60) gpuTempData.value.shift();

      // 更新图表
      updateChartData();
    } catch (error) {
      logger.error('Failed to fetch system monitor', error);
    }
  };

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

  const fetchProviderStatus = async () => {
    try {
      const response = await apiClient.get('/api/providers');
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
      logger.error('Failed to fetch provider status', error);
    }
  };

  const fetchModels = async () => {
    try {
      const response = await apiClient.get('/api/provider-models');
      const data = response.data;
      
      const models = new Set();
      for (const typeModels of Object.values(data)) {
        if (Array.isArray(typeModels)) {
          typeModels.forEach(model => models.add(model));
        }
      }
      
      availableModels.value = Array.from(models).sort();
    } catch (error) {
      logger.error('Failed to fetch models', error);
    }
  };

  const checkUpdate = async () => {
    try {
      const response = await apiClient.get('/api/system/check-update');
      if (response.data.hasUpdate) {
        hasUpdate.value = true;
        latestVersion.value = response.data.latestVersion;
      }
    } catch (error) {
      logger.error('Failed to check update', error);
    }
  };

  const performUpdate = async () => {
    try {
      await apiClient.post('/api/system/update');
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
      logger.error('Failed to copy', error);
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
    await fetchTokenStats();

    // 初始化图表
    await initCharts();

    // 每5秒更新系统监控
    refreshInterval = setInterval(async () => {
      await fetchSystemMonitor();
      await fetchSystemInfo();
    }, 5000);

    // 每30秒更新Token统计
    chartUpdateInterval = setInterval(async () => {
      await fetchTokenStats();
    }, 30000);

    // 窗口resize时重绘图表
    window.addEventListener('resize', () => {
      if (systemChart) systemChart.draw();
      if (pythonGpuChart) pythonGpuChart.draw();
      if (tokenChart) tokenChart.draw();
    });
  });

  onUnmounted(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    if (chartUpdateInterval) {
      clearInterval(chartUpdateInterval);
    }
    window.removeEventListener('resize', () => {
      if (systemChart) systemChart.draw();
      if (pythonGpuChart) pythonGpuChart.draw();
      if (tokenChart) tokenChart.draw();
    });
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