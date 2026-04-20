import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { apiClient } from '@/utils/api.js';
import { logger } from '@/utils/logger.js';
import { SimpleChart } from '@/utils/chart.js';

const generateMockHistoryData = (baseValue, variance, count = 20) => {
  const data = [];
  for (let i = 0; i < count; i++) {
    const variation = Math.sin(i * 0.5) * variance;
    data.push(Math.max(0, Math.min(100, baseValue + variation + (Math.random() - 0.5) * variance)));
  }
  return data;
};

const generateMockTokenHistory = (count = 12) => {
  const history = [];
  const now = Date.now();
  for (let i = count - 1; i >= 0; i--) {
    const hour = new Date(now - i * 3600000);
    const baseValue = 50000 + Math.random() * 100000;
    history.push({
      label: `${hour.getHours().toString().padStart(2, '0')}:00`,
      promptTokens: Math.round(baseValue * 0.7),
      completionTokens: Math.round(baseValue * 0.3),
      totalTokens: Math.round(baseValue)
    });
  }
  return history;
};

export function useDashboard() {
  const systemInfo = ref({
    uptime: '--',
    cpu: 15,
    memory: 45,
    gpu: 30,
    version: '--',
    nodeVersion: '--',
    serverTime: new Date().toLocaleString('zh-CN'),
    platform: 'Linux x64',
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    pid: '--'
  });

  const gpuStatus = ref({
    loading: false,
    error: '',
    devices: []
  });

  const pythonGpuConnected = ref(false);
  const pythonGpuInfo = ref({
    utilization: '35%',
    memory: '4.5 / 16.0 GB',
    temperature: '45°C',
    power: '85W',
    name: 'NVIDIA GeForce RTX 4090',
    totalMemory: '16.0 GB',
    usedMemory: '4.5 GB',
    availableMemory: '11.5 GB',
    serverTime: new Date().toLocaleString('zh-CN'),
    utilizationValue: 35,
    memoryUsageValue: 28,
    temperatureValue: 45,
    powerValue: 85
  });

  const providerStatus = ref([
    { name: 'gemini cli oauth', status: 'healthy', accounts: 2, requests: 120 },
    { name: 'claude custom', status: 'healthy', accounts: 1, requests: 85 },
    { name: 'openai custom', status: 'warning', accounts: 3, requests: 200 }
  ]);

  const availableModels = ref([
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'claude-3-5-sonnet-20241022',
    'gpt-4o-mini',
    'gpt-4o'
  ]);

  const activeChartTab = ref('cpu');
  const activePythonChartTab = ref('utilization');
  const activeTokenSeries = ref('total');
  const activeTimeRange = ref('hour');

  const hasUpdate = ref(false);
  const latestVersion = ref('');

  const routingExamples = ref([
    { path: '/api/v1/chat/completions', description: '默认提供商', fullPath: '/api/v1/chat/completions', provider: 'default' },
    { path: '/gemini-cli-oauth/v1/chat/completions', description: 'Gemini CLI OAuth', fullPath: '/gemini-cli-oauth/v1/chat/completions', provider: 'gemini' },
    { path: '/gemini-antigravity/v1/chat/completions', description: 'Gemini Antigravity', fullPath: '/gemini-antigravity/v1/chat/completions', provider: 'gemini' },
    { path: '/claude-custom/v1/chat/completions', description: 'Claude Custom', fullPath: '/claude-custom/v1/chat/completions', provider: 'claude' },
    { path: '/claude-kiro-oauth/v1/chat/completions', description: 'Claude Kiro OAuth', fullPath: '/claude-kiro-oauth/v1/chat/completions', provider: 'claude' },
    { path: '/openai-custom/v1/chat/completions', description: 'OpenAI Custom', fullPath: '/openai-custom/v1/chat/completions', provider: 'openai' },
    { path: '/openai-codex-oauth/v1/chat/completions', description: 'Codex OAuth', fullPath: '/openai-codex-oauth/v1/chat/completions', provider: 'codex' },
    { path: '/openai-qwen-oauth/v1/chat/completions', description: 'Qwen OAuth', fullPath: '/openai-qwen-oauth/v1/chat/completions', provider: 'qwen' },
    { path: '/openai-iflow/v1/chat/completions', description: 'iFlow OAuth', fullPath: '/openai-iflow/v1/chat/completions', provider: 'iflow' },
    { path: '/grok-custom/v1/chat/completions', description: 'Grok Custom', fullPath: '/grok-custom/v1/chat/completions', provider: 'grok' },
    { path: '/local-model/v1/chat/completions', description: '本地模型', fullPath: '/local-model/v1/chat/completions', provider: 'local' }
  ]);

  let systemChart = null;
  let pythonGpuChart = null;
  let tokenChart = null;
  let refreshInterval = null;
  let chartUpdateInterval = null;

  const cpuData = ref(generateMockHistoryData(18, 8));
  const memoryData = ref(generateMockHistoryData(47, 5));
  const gpuData = ref(generateMockHistoryData(32, 10));
  const gpuTempData = ref(generateMockHistoryData(46, 4));
  const pythonGpuUtilizationData = ref(generateMockHistoryData(35, 12));
  const pythonGpuMemoryData = ref(generateMockHistoryData(28, 8));
  const pythonGpuTemperatureData = ref(generateMockHistoryData(45, 5));
  const tokenChartData = ref({
    total: 150000,
    input: 105000,
    output: 45000,
    history: generateMockTokenHistory()
  });

  const getSystemChartSeries = () => {
    const configs = {
      cpu: { data: cpuData.value, lineColor: '#3b82f6', fillColor: 'rgba(59, 130, 246, 0.12)', label: 'CPU使用率', axis: 'primary' },
      memory: { data: memoryData.value, lineColor: '#10b981', fillColor: 'rgba(16, 185, 129, 0.12)', label: '内存使用率', axis: 'primary' },
      gpu: { data: gpuData.value, lineColor: '#8b5cf6', fillColor: 'rgba(139, 92, 246, 0.12)', label: 'GPU使用率', axis: 'primary' },
      gpuTemp: { data: gpuTempData.value, lineColor: '#ef4444', fillColor: 'rgba(239, 68, 68, 0.08)', label: 'GPU温度', axis: 'secondary', fill: false }
    };

    switch (activeChartTab.value) {
      case 'memory':
        return [configs.memory];
      case 'gpu':
        return [configs.gpu, configs.gpuTemp];
      default:
        return [configs.cpu];
    }
  };

  const getPythonChartSeries = () => {
    const seriesMap = {
      utilization: [{ data: pythonGpuUtilizationData.value, lineColor: '#8b5cf6', fillColor: 'rgba(139, 92, 246, 0.12)', label: 'GPU使用率', axis: 'primary' }],
      memory: [{ data: pythonGpuMemoryData.value, lineColor: '#3b82f6', fillColor: 'rgba(59, 130, 246, 0.12)', label: '显存使用率', axis: 'primary' }],
      temperature: [{ data: pythonGpuTemperatureData.value, lineColor: '#ef4444', fillColor: 'rgba(239, 68, 68, 0.08)', label: 'GPU温度', axis: 'secondary', fill: false }],
      all: [
        { data: pythonGpuUtilizationData.value, lineColor: '#8b5cf6', fillColor: 'rgba(139, 92, 246, 0.12)', label: 'GPU使用率', axis: 'primary', fill: false },
        { data: pythonGpuMemoryData.value, lineColor: '#3b82f6', fillColor: 'rgba(59, 130, 246, 0.12)', label: '显存使用率', axis: 'primary', fill: false },
        { data: pythonGpuTemperatureData.value, lineColor: '#ef4444', fillColor: 'rgba(239, 68, 68, 0.08)', label: 'GPU温度', axis: 'secondary', fill: false }
      ]
    };

    return seriesMap[activePythonChartTab.value] || seriesMap.utilization;
  };

  const getTokenSeries = () => {
    const labels = tokenChartData.value.history.map((item) => item.label || item.hour || item.key || '');
    const promptSeries = { data: tokenChartData.value.history.map(h => h.promptTokens || h.input || 0), lineColor: '#3b82f6', fillColor: 'rgba(59, 130, 246, 0.12)', label: '输入 Token', axis: 'primary' };
    const completionSeries = { data: tokenChartData.value.history.map(h => h.completionTokens || h.output || 0), lineColor: '#10b981', fillColor: 'rgba(16, 185, 129, 0.12)', label: '输出 Token', axis: 'primary' };
    const totalSeries = { data: tokenChartData.value.history.map(h => h.total || h.totalTokens || 0), lineColor: '#8b5cf6', fillColor: 'rgba(139, 92, 246, 0.12)', label: '总 Token', axis: 'primary' };

    let series;
    switch (activeTokenSeries.value) {
      case 'prompt':
        series = [promptSeries];
        break;
      case 'completion':
        series = [completionSeries];
        break;
      case 'all':
        series = [
          { ...promptSeries, fill: false },
          { ...completionSeries, fill: false },
          { ...totalSeries, fill: false }
        ];
        break;
      default:
        series = [totalSeries];
    }

    return { labels, series };
  };

  const updateSystemChart = () => {
    if (!systemChart) return;
    systemChart.series = getSystemChartSeries();
    systemChart.options.secondaryAxis = activeChartTab.value === 'gpu'
      ? {
          enabled: true,
          minValue: 0,
          maxValue: 100,
          color: '#ef4444',
          formatter: (value) => `${Math.round(value)}°C`
        }
      : { enabled: false };
    systemChart.draw();
  };

  const updatePythonGpuChart = () => {
    if (!pythonGpuChart || !pythonGpuConnected.value) return;
    pythonGpuChart.series = getPythonChartSeries();
    pythonGpuChart.options.secondaryAxis = activePythonChartTab.value === 'all' || activePythonChartTab.value === 'temperature'
      ? {
          enabled: true,
          minValue: 0,
          maxValue: 100,
          color: '#ef4444',
          formatter: (value) => `${Math.round(value)}°C`
        }
      : { enabled: false };
    pythonGpuChart.draw();
  };

  const updateTokenChart = () => {
    if (!tokenChart || tokenChartData.value.history.length === 0) return;
    const { labels, series } = getTokenSeries();
    tokenChart.series = series;
    tokenChart.options.xAxisLabels = labels;
    tokenChart.draw();
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}天 ${hours}小时 ${minutes}分钟`;
  };

  const initCharts = async () => {
    await nextTick();

    systemChart = new SimpleChart('systemChart', {
      lineColor: '#3b82f6',
      fillColor: 'rgba(59, 130, 246, 0.1)',
      maxPoints: 60,
      yAxisFormatter: (value) => `${Math.round(value)}%`
    });

    pythonGpuChart = new SimpleChart('pythonGpuChart', {
      lineColor: '#f59e0b',
      fillColor: 'rgba(245, 158, 11, 0.1)',
      maxPoints: 60,
      yAxisFormatter: (value) => `${Math.round(value)}%`
    });

    tokenChart = new SimpleChart('tokenChart', {
      lineColor: '#06b6d4',
      fillColor: 'rgba(6, 182, 212, 0.1)',
      maxPoints: 60,
      maxValue: 100000,
      minValue: 0,
      yAxisFormatter: (value) => {
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
        return Math.round(value).toString();
      }
    });
  };

  const updateChartData = () => {
    updateSystemChart();
    updatePythonGpuChart();
  };

  const fetchTokenStats = async () => {
    try {
      const response = await apiClient.get(`/api/token-stats?range=${activeTimeRange.value}`);
      const data = response.data;
      
      if (data.total) {
        tokenChartData.value = {
          total: data.total || 0,
          input: data.input || 0,
          output: data.output || 0,
          history: data.history || []
        };
        updateTokenChart();
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

      cpuData.value.push(cpu);
      memoryData.value.push(memory);
      gpuData.value.push(gpu);
      gpuTempData.value.push(gpuTemp);

      if (cpuData.value.length > 60) cpuData.value.shift();
      if (memoryData.value.length > 60) memoryData.value.shift();
      if (gpuData.value.length > 60) gpuData.value.shift();
      if (gpuTempData.value.length > 60) gpuTempData.value.shift();

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
        const memoryUsageValue = Number(data.memoryUsage ?? data.memory_utilization ?? 0);
        const utilizationValue = Number(data.utilization || 0);
        const temperatureValue = Number(data.temperature || 0);
        const powerValue = Number(data.power || 0);
        pythonGpuConnected.value = true;
        pythonGpuInfo.value = {
          utilization: `${utilizationValue}%`,
          memory: `${data.memoryUsed}/${data.memoryTotal}`,
          temperature: `${temperatureValue}°C`,
          power: `${powerValue}W`,
          name: data.name || '--',
          totalMemory: data.memoryTotal || '--',
          usedMemory: data.memoryUsed || '--',
          availableMemory: data.memoryAvailable || '--',
          serverTime: data.serverTime ? new Date(data.serverTime).toLocaleString('zh-CN') : '--',
          utilizationValue,
          memoryUsageValue,
          temperatureValue,
          powerValue
        };

        pythonGpuUtilizationData.value.push(utilizationValue);
        pythonGpuMemoryData.value.push(memoryUsageValue);
        pythonGpuTemperatureData.value.push(temperatureValue);

        if (pythonGpuUtilizationData.value.length > 60) pythonGpuUtilizationData.value.shift();
        if (pythonGpuMemoryData.value.length > 60) pythonGpuMemoryData.value.shift();
        if (pythonGpuTemperatureData.value.length > 60) pythonGpuTemperatureData.value.shift();

        updatePythonGpuChart();
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
    await Promise.all([fetchProviderStatus(), fetchModels()]);
  };

  onMounted(async () => {
    const startTime = performance.now();
    
    await initCharts();
    updateSystemChart();
    updatePythonGpuChart();
    updateTokenChart();

    const fastDataPromises = [
      fetchSystemInfo(),
      fetchSystemMonitor(),
      fetchPythonGpuStatus()
    ];

    const slowDataPromises = [
      fetchGpuStatus(),
      fetchProviderStatus(),
      fetchModels(),
      checkUpdate(),
      fetchTokenStats()
    ];

    await Promise.all(fastDataPromises);

    Promise.all(slowDataPromises).then(() => {
      const duration = performance.now() - startTime;
      logger.debug(`Dashboard data loaded in ${duration.toFixed(2)}ms`);
    });

    refreshInterval = setInterval(async () => {
      await Promise.all([
        fetchSystemMonitor(),
        fetchSystemInfo(),
        fetchPythonGpuStatus()
      ]);
    }, 5000);

    chartUpdateInterval = setInterval(async () => {
      await fetchTokenStats();
    }, 30000);

    const resizeHandler = () => {
      if (systemChart) systemChart.draw();
      if (pythonGpuChart) pythonGpuChart.draw();
      if (tokenChart) tokenChart.draw();
    };
    window.addEventListener('resize', resizeHandler);

    onUnmounted(() => {
      if (refreshInterval) clearInterval(refreshInterval);
      if (chartUpdateInterval) clearInterval(chartUpdateInterval);
      window.removeEventListener('resize', resizeHandler);
    });
  });

  watch(activeChartTab, () => {
    updateSystemChart();
  });

  watch(activePythonChartTab, () => {
    updatePythonGpuChart();
  });

  watch(activeTokenSeries, () => {
    updateTokenChart();
  });

  watch(activeTimeRange, async () => {
    await fetchTokenStats();
  });

  return {
    systemInfo,
    gpuStatus,
    pythonGpuConnected,
    pythonGpuInfo,
    providerStatus,
    availableModels,
    activeChartTab,
    activePythonChartTab,
    activeTokenSeries,
    activeTimeRange,
    tokenChartData,
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