<template>
  <section id="dashboard" class="section active" aria-labelledby="dashboard-title">
    <h2 id="dashboard-title">系统概览</h2>
    
    <div class="stats-container">
      <div class="stats-row">
        <StatCard icon="fa-clock" :value="systemInfo.uptime" label="运行时间" />
        <StatCard icon="fa-microchip" :value="`${systemInfo.cpu}%`" label="CPU" type="cpu" />
        <StatCard icon="fa-memory" :value="`${systemInfo.memory}%`" label="内存" type="memory" />
        <StatCard icon="fa-video-card" :value="`${systemInfo.gpu}%`" label="GPU" type="gpu" />
      </div>
    </div>

    <div class="dashboard-layout">
      <div class="dashboard-left">
        <div class="panel system-monitor">
          <div class="panel-header">
            <h3><i class="fas fa-chart-line"></i> 系统资源监控</h3>
            <div class="chart-tabs">
              <button 
                v-for="tab in chartTabs" 
                :key="tab.id"
                class="chart-tab"
                :class="{ active: activeChartTab === tab.id }"
                @click="activeChartTab = tab.id"
              >
                {{ tab.label }}
              </button>
            </div>
          </div>
          <div class="chart-area">
            <canvas id="systemChart"></canvas>
          </div>
          <div class="chart-legend">
            <div class="legend-item">
              <span class="legend-color cpu"></span>
              <span>CPU使用率</span>
            </div>
            <div class="legend-item">
              <span class="legend-color memory"></span>
              <span>内存使用率</span>
            </div>
            <div class="legend-item">
              <span class="legend-color gpu"></span>
              <span>GPU使用率</span>
            </div>
            <div class="legend-item">
              <span class="legend-color gpu-temp"></span>
              <span>GPU温度</span>
            </div>
          </div>

          <div class="gpu-section">
            <div class="gpu-header">
              <h4><i class="fas fa-microchip"></i> GPU状态</h4>
              <button 
                class="btn btn-sm btn-outline"
                @click="refreshGpuStatus"
              >
                <i class="fas fa-sync-alt"></i>
              </button>
            </div>
            <div class="gpu-content">
              <div v-if="gpuStatus.loading" class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <span>加载中...</span>
              </div>
              <div v-else-if="gpuStatus.error" class="error">
                <i class="fas fa-exclamation-circle"></i>
                <span>{{ gpuStatus.error }}</span>
              </div>
              <div v-else-if="gpuStatus.devices.length === 0" class="empty">
                <i class="fas fa-video-card"></i>
                <span>未检测到GPU设备</span>
              </div>
              <div v-else class="gpu-devices">
                <div 
                  v-for="device in gpuStatus.devices" 
                  :key="device.id"
                  class="gpu-device"
                >
                  <div class="gpu-device-header">
                    <span class="gpu-name">{{ device.name }}</span>
                    <span class="gpu-usage">{{ device.utilization }}%</span>
                  </div>
                  <div class="gpu-memory-bar">
                    <div 
                      class="gpu-memory-fill" 
                      :style="{ width: device.memoryUsagePercent + '%' }"
                    ></div>
                  </div>
                  <div class="gpu-info">
                    <span>{{ device.memoryUsed }} / {{ device.memoryTotal }}</span>
                    <span class="gpu-temp">{{ device.temperature }}°C</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="pythonGpuConnected" class="python-gpu-section">
            <div class="python-gpu-header">
              <h4><i class="fas fa-cpu"></i> Python GPU 监控</h4>
              <button 
                class="btn btn-sm btn-outline"
                @click="refreshPythonGpu"
              >
                <i class="fas fa-sync-alt"></i>
              </button>
            </div>
            <div class="python-gpu-content">
              <div class="python-gpu-summary">
                <div class="python-gpu-info">
                  <span class="label">设备名称</span>
                  <span class="value">{{ pythonGpuInfo.name }}</span>
                </div>
                <div class="python-gpu-info">
                  <span class="label">显存使用</span>
                  <span class="value">{{ pythonGpuInfo.memory }}</span>
                </div>
                <div class="python-gpu-info">
                  <span class="label">使用率</span>
                  <span class="value">{{ pythonGpuInfo.utilization }}</span>
                </div>
                <div class="python-gpu-info">
                  <span class="label">温度</span>
                  <span class="value">{{ pythonGpuInfo.temperature }}</span>
                </div>
                <div class="python-gpu-info">
                  <span class="label">功耗</span>
                  <span class="value">{{ pythonGpuInfo.power }}</span>
                </div>
                <div class="python-gpu-info">
                  <span class="label">Python时间</span>
                  <span class="value">{{ pythonGpuInfo.serverTime }}</span>
                </div>
              </div>
              <div class="python-chart-tabs">
                <button 
                  v-for="tab in pythonChartTabs" 
                  :key="tab.id"
                  class="chart-tab"
                  :class="{ active: activePythonChartTab === tab.id }"
                  @click="activePythonChartTab = tab.id"
                >
                  {{ tab.label }}
                </button>
              </div>
              <div class="python-chart-area">
                <canvas id="pythonGpuChart"></canvas>
              </div>
            </div>
          </div>
        </div>

        <div class="panel token-panel">
          <div class="panel-header">
            <h3><i class="fas fa-coins"></i> Token 使用统计</h3>
            <div class="time-range-tabs">
              <button 
                v-for="tab in timeRangeTabs" 
                :key="tab.id"
                class="time-range-tab"
                :class="{ active: activeTimeRange === tab.id }"
                @click="activeTimeRange = tab.id"
              >
                {{ tab.label }}
              </button>
            </div>
          </div>
          <div class="token-chart-area">
            <canvas id="tokenChart"></canvas>
          </div>
          <div v-if="tokenChartData.total" class="token-summary">
            <div class="token-stat">
              <span class="token-stat-label">总消耗</span>
              <span class="token-stat-value">{{ formatTokens(tokenChartData.total) }}</span>
            </div>
            <div class="token-stat">
              <span class="token-stat-label">输入</span>
              <span class="token-stat-value">{{ formatTokens(tokenChartData.input) }}</span>
            </div>
            <div class="token-stat">
              <span class="token-stat-label">输出</span>
              <span class="token-stat-value">{{ formatTokens(tokenChartData.output) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="dashboard-right">
        <div class="panel system-info-panel">
          <div class="panel-header">
            <h3><i class="fas fa-info-circle"></i> 系统信息</h3>
            <button 
              v-if="hasUpdate"
              class="btn btn-sm btn-update"
              @click="performUpdate"
            >
              <i class="fas fa-download"></i> 更新至 {{ latestVersion }}
            </button>
          </div>
          <div class="system-info-content">
            <div class="system-info-item">
              <span class="info-label">版本</span>
              <span class="info-value">{{ systemInfo.version }}</span>
            </div>
            <div class="system-info-item">
              <span class="info-label">Node.js</span>
              <span class="info-value">{{ systemInfo.nodeVersion }}</span>
            </div>
            <div class="system-info-item">
              <span class="info-label">运行模式</span>
              <span class="info-value mode" :class="systemInfo.mode">{{ systemInfo.mode === 'production' ? '生产环境' : '开发环境' }}</span>
            </div>
            <div class="system-info-item">
              <span class="info-label">平台</span>
              <span class="info-value">{{ systemInfo.platform }}</span>
            </div>
            <div class="system-info-item">
              <span class="info-label">服务器时间</span>
              <span class="info-value">{{ systemInfo.serverTime }}</span>
            </div>
            <div class="system-info-item">
              <span class="info-label">进程ID</span>
              <span class="info-value">{{ systemInfo.pid }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="panel provider-status provider-status-panel">
      <div class="panel-header">
        <h3><i class="fas fa-network-wired"></i> 提供商节点状态</h3>
        <button 
          class="btn btn-sm btn-outline"
          @click="refreshProviderStatus"
        >
          <i class="fas fa-sync-alt"></i> 刷新
        </button>
      </div>
      <div class="provider-grid provider-grid-horizontal">
        <div v-if="providerStatus.length === 0" class="loading">
          <i class="fas fa-spinner fa-spin"></i>
          <span>加载中...</span>
        </div>
        <ProviderCard 
          v-for="provider in providerStatus" 
          :key="provider.name"
          :provider="provider"
        />
      </div>
    </div>

    <details class="expandable-section">
      <summary class="section-summary">
        <div class="summary-header">
          <i class="fas fa-tools"></i>
          <span>高级信息 (路径路由与模型列表)</span>
          <span class="expand-hint">展开更多</span>
        </div>
        <i class="fas fa-chevron-down caret"></i>
      </summary>

      <div class="routing-panel">
        <h3><i class="fas fa-route"></i> 路径路由调用示例</h3>
        <p class="routing-desc">通过不同路径路由访问不同的AI模型提供商，支持灵活的模型切换</p>
        
        <div class="routing-filter">
          <div class="filter-tabs">
            <button 
              v-for="filter in providerFilters" 
              :key="filter.id"
              class="filter-tab"
              :class="{ active: activeProviderFilter === filter.id }"
              @click="activeProviderFilter = filter.id"
            >
              <i :class="['fas', filter.icon]"></i>
              <span>{{ filter.label }}</span>
            </button>
          </div>
        </div>
        
        <div class="routing-grid">
          <div 
            v-for="route in filteredRoutes" 
            :key="route.path"
            class="routing-item"
            @click="copyToClipboard(route.fullPath)"
          >
            <div class="route-provider-badge" :class="route.provider">
              <i :class="getProviderIcon(route.provider)"></i>
            </div>
            <div class="route-content">
              <span class="route-path">{{ route.fullPath }}</span>
              <span class="route-description">{{ route.description }}</span>
            </div>
            <i class="fas fa-copy copy-icon"></i>
          </div>
        </div>

        <div class="routing-tips">
          <h4><i class="fas fa-lightbulb"></i> 使用提示</h4>
          <ul>
            <li><strong>即时切换:</strong> 通过修改URL路径即可切换不同的AI模型提供商</li>
            <li><strong>客户端配置:</strong> 在Cherry-Studio、NextChat、Cline等客户端中设置API端点为对应路径</li>
            <li><strong>跨协议调用:</strong> 支持OpenAI协议调用Claude模型，或Claude协议调用OpenAI模型</li>
          </ul>
        </div>

        <div class="models-area">
          <div class="models-header">
            <h4 class="models-title"><i class="fas fa-cube"></i> 可用模型列表</h4>
            <div class="model-search">
              <i class="fas fa-search"></i>
              <input 
                type="text" 
                v-model="modelSearchQuery" 
                placeholder="搜索模型..."
                class="search-input"
              />
            </div>
          </div>
          <div class="models-desc">
            <div class="highlight-note">
              <i class="fas fa-info-circle"></i>
              <span>点击模型名称可直接复制到剪贴板</span>
            </div>
          </div>
          
          <div class="models-container">
            <div v-if="availableModels.length === 0" class="loading">
              <i class="fas fa-spinner fa-spin"></i>
              <span>加载中...</span>
            </div>
            <div v-else-if="filteredModels.length === 0" class="no-results">
              <i class="fas fa-search"></i>
              <span>未找到匹配的模型</span>
            </div>
            <div v-else class="models-list">
              <ModelTag 
                v-for="model in filteredModels" 
                :key="model"
                :model="model"
              />
            </div>
          </div>
        </div>
      </div>
    </details>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useDashboard } from '@/composables/useDashboard.js';
import StatCard from '@/components/StatCard.vue';
import ProviderCard from '@/components/ProviderCard.vue';
import ModelTag from '@/components/ModelTag.vue';

const {
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
  performUpdate,
  copyToClipboard
} = useDashboard();

const activeChartTab = ref('cpu');
const chartTabs = [
  { id: 'cpu', label: 'CPU' },
  { id: 'memory', label: '内存' },
  { id: 'gpu', label: 'GPU' }
];

const activePythonChartTab = ref('utilization');
const pythonChartTabs = [
  { id: 'utilization', label: '使用率' },
  { id: 'memory', label: '显存' },
  { id: 'temperature', label: '温度' },
  { id: 'all', label: '全部' }
];

const activeTimeRange = ref('hour');
const timeRangeTabs = [
  { id: 'hour', label: '最近一小时' },
  { id: 'day', label: '最近一天' },
  { id: 'week', label: '最近一周' }
];

const tokenChartData = ref({});

const formatTokens = (tokens) => {
  if (!tokens) return '--';
  if (tokens >= 1000000) {
    return (tokens / 1000000).toFixed(2) + 'M';
  } else if (tokens >= 1000) {
    return (tokens / 1000).toFixed(1) + 'K';
  }
  return tokens.toString();
};

const activeProviderFilter = ref('all');
const providerFilters = [
  { id: 'all', label: '全部', icon: 'fa-globe' },
  { id: 'gemini', label: 'Gemini', icon: 'fa-google' },
  { id: 'claude', label: 'Claude', icon: 'fa-robot' },
  { id: 'openai', label: 'OpenAI', icon: 'fa-openid' },
  { id: 'other', label: '其他', icon: 'fa-more' }
];

const filteredRoutes = computed(() => {
  if (activeProviderFilter.value === 'all') {
    return routingExamples.value;
  }
  if (activeProviderFilter.value === 'other') {
    const mainProviders = ['gemini', 'claude', 'openai', 'default'];
    return routingExamples.value.filter(r => !mainProviders.includes(r.provider));
  }
  return routingExamples.value.filter(r => r.provider === activeProviderFilter.value);
});

const modelSearchQuery = ref('');

const filteredModels = computed(() => {
  if (!modelSearchQuery.value.trim()) {
    return availableModels.value;
  }
  const query = modelSearchQuery.value.toLowerCase();
  return availableModels.value.filter(model => 
    model.toLowerCase().includes(query)
  );
});

const getProviderIcon = (provider) => {
  const iconMap = {
    'default': 'fa-circle-o',
    'gemini': 'fa-google',
    'claude': 'fa-robot',
    'openai': 'fa-openid',
    'codex': 'fa-code',
    'qwen': 'fa-cloud',
    'iflow': 'fa-flask',
    'grok': 'fa-bolt',
    'local': 'fa-server'
  };
  return iconMap[provider] || 'fa-circle-o';
};
</script>