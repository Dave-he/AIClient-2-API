<template>
  <section id="dashboard" class="section active" aria-labelledby="dashboard-title">
    <h2 id="dashboard-title">系统概览</h2>
    
    <div class="stats-container">
      <div class="stats-row">
        <div class="stat-item">
          <div class="stat-icon-wrapper">
            <i class="fas fa-clock"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ systemInfo.uptime || '--' }}</span>
            <span class="stat-label">运行时间</span>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon-wrapper cpu">
            <i class="fas fa-microchip"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ systemInfo.cpu }}%</span>
            <span class="stat-label">CPU</span>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon-wrapper memory">
            <i class="fas fa-memory"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ systemInfo.memory }}%</span>
            <span class="stat-label">内存</span>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon-wrapper gpu">
            <i class="fas fa-video-card"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ systemInfo.gpu }}%</span>
            <span class="stat-label">GPU</span>
          </div>
        </div>
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
                <i class="fas fa-exclamation-triangle"></i>
                <span>{{ gpuStatus.error }}</span>
              </div>
              <div v-else-if="gpuStatus.devices && gpuStatus.devices.length > 0" class="gpu-devices">
                <div 
                  v-for="(device, index) in gpuStatus.devices" 
                  :key="index"
                  class="gpu-device"
                >
                  <div class="gpu-device-header">
                    <span class="gpu-name">{{ device.name }}</span>
                    <span 
                      class="gpu-status"
                      :class="{ healthy: device.status === 'healthy' }"
                    >
                      {{ device.status === 'healthy' ? '正常' : '异常' }}
                    </span>
                  </div>
                  <div class="gpu-device-info">
                    <div class="info-row">
                      <span class="info-label">显存使用</span>
                      <div class="info-bar-container">
                        <div 
                          class="info-bar" 
                          :style="{ width: device.memoryUsage + '%' }"
                        ></div>
                      </div>
                      <span class="info-value">{{ device.memoryUsed }} / {{ device.memoryTotal }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">GPU使用率</span>
                      <div class="info-bar-container">
                        <div 
                          class="info-bar gpu-usage" 
                          :style="{ width: device.utilization + '%' }"
                        ></div>
                      </div>
                      <span class="info-value">{{ device.utilization }}%</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">温度</span>
                      <span class="info-value temp" :class="{ warning: device.temperature > 80 }">
                        {{ device.temperature }}°C
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="empty">
                <i class="fas fa-video-card"></i>
                <span>未检测到GPU设备</span>
              </div>
            </div>
          </div>
        </div>

        <div class="panel token-trend-panel">
          <div class="panel-header">
            <h3><i class="fas fa-line-chart"></i> Token使用趋势</h3>
            <div class="time-range-tabs">
              <button 
                v-for="tab in timeRangeTabs" 
                :key="tab.id"
                class="time-range-tab"
                :class="{ active: activeTimeRange === tab.id }"
                @click="activeTimeRange = tab.id; updateTokenChart()"
              >
                {{ tab.label }}
              </button>
            </div>
          </div>
          <div class="chart-area token-chart-area">
            <canvas id="tokenTrendChart"></canvas>
          </div>
          <div class="chart-legend">
            <div class="legend-item">
              <span class="legend-color prompt"></span>
              <span>输入Token</span>
            </div>
            <div class="legend-item">
              <span class="legend-color completion"></span>
              <span>输出Token</span>
            </div>
            <div class="legend-item">
              <span class="legend-color total"></span>
              <span>总Token</span>
            </div>
          </div>
        </div>

        <div class="panel python-gpu-monitor">
          <div class="panel-header">
            <h3><i class="fas fa-server"></i> Python服务端GPU监控</h3>
            <div class="panel-controls">
              <div class="connection-status" id="pythonGpuConnectionStatus">
                <span class="status-badge" :class="{ offline: !pythonGpuConnected }">
                  <i class="fas fa-circle"></i> <span>{{ pythonGpuConnected ? '已连接' : '未连接' }}</span>
                </span>
              </div>
              <button class="btn btn-sm btn-outline" @click="refreshPythonGpu">
                <i class="fas fa-sync-alt"></i>
              </button>
            </div>
          </div>

          <div class="python-gpu-stats">
            <div class="python-stat-item">
              <div class="python-stat-icon gpu">
                <i class="fas fa-microchip"></i>
              </div>
              <div class="python-stat-content">
                <span class="python-stat-value">{{ pythonGpuInfo.utilization || '--' }}</span>
                <span class="python-stat-label">GPU使用率</span>
              </div>
            </div>
            <div class="python-stat-item">
              <div class="python-stat-icon memory">
                <i class="fas fa-memory"></i>
              </div>
              <div class="python-stat-content">
                <span class="python-stat-value">{{ pythonGpuInfo.memory || '--' }}</span>
                <span class="python-stat-label">显存使用</span>
              </div>
            </div>
            <div class="python-stat-item">
              <div class="python-stat-icon temp">
                <i class="fas fa-thermometer-half"></i>
              </div>
              <div class="python-stat-content">
                <span class="python-stat-value">{{ pythonGpuInfo.temperature || '--' }}</span>
                <span class="python-stat-label">温度</span>
              </div>
            </div>
            <div class="python-stat-item">
              <div class="python-stat-icon power">
                <i class="fas fa-bolt"></i>
              </div>
              <div class="python-stat-content">
                <span class="python-stat-value">{{ pythonGpuInfo.power || '--' }}</span>
                <span class="python-stat-label">功耗</span>
              </div>
            </div>
          </div>

          <div class="python-gpu-chart-area">
            <div class="chart-type-tabs">
              <button 
                v-for="tab in pythonChartTabs" 
                :key="tab.id"
                class="chart-type-tab"
                :class="{ active: activePythonChartTab === tab.id }"
                @click="activePythonChartTab = tab.id"
              >
                {{ tab.label }}
              </button>
            </div>
            <canvas id="pythonGpuChart"></canvas>
            <div class="python-chart-legend">
              <div class="legend-item"><span class="legend-color gpu-util"></span><span>GPU使用率</span></div>
              <div class="legend-item"><span class="legend-color gpu-mem"></span><span>显存使用率</span></div>
              <div class="legend-item"><span class="legend-color gpu-temp"></span><span>GPU温度</span></div>
            </div>
          </div>

          <div class="python-gpu-details">
            <div class="python-gpu-info">
              <div class="info-row">
                <div class="info-item">
                  <span class="info-label"><i class="fas fa-tag"></i> GPU型号</span>
                  <span class="info-value">{{ pythonGpuInfo.name || '--' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label"><i class="fas fa-hdd"></i> 总显存</span>
                  <span class="info-value">{{ pythonGpuInfo.totalMemory || '--' }}</span>
                </div>
              </div>
              <div class="info-row">
                <div class="info-item">
                  <span class="info-label"><i class="fas fa-chart-bar"></i> 已用显存</span>
                  <span class="info-value">{{ pythonGpuInfo.usedMemory || '--' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label"><i class="fas fa-chart-line"></i> 可用显存</span>
                  <span class="info-value">{{ pythonGpuInfo.availableMemory || '--' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="dashboard-right">
        <div class="panel system-info">
          <div class="panel-header">
            <h3>系统信息</h3>
            <div class="update-controls">
              <button 
                class="btn btn-sm btn-outline"
                @click="checkUpdate"
              >
                <i class="fas fa-sync-alt"></i> 检查更新
              </button>
              <button 
                v-if="hasUpdate"
                class="btn btn-sm btn-primary"
                @click="performUpdate"
              >
                <i class="fas fa-download"></i> 立即更新
              </button>
            </div>
          </div>
          <div class="info-list">
            <div class="info-row">
              <div class="info-item">
                <span class="info-label"><i class="fas fa-tag"></i> 版本号</span>
                <div class="version-wrapper">
                  <span class="info-value">{{ systemInfo.version || '--' }}</span>
                  <span 
                    v-if="hasUpdate" 
                    class="update-badge"
                  >
                    <i class="fas fa-arrow-up"></i> {{ latestVersion }}
                  </span>
                </div>
              </div>
              <div class="info-item">
                <span class="info-label"><i class="fas fa-code"></i> Node.js</span>
                <span class="info-value">{{ systemInfo.nodeVersion || '--' }}</span>
              </div>
            </div>
            <div class="info-row">
              <div class="info-item">
                <span class="info-label"><i class="fas fa-clock"></i> 服务器时间</span>
                <span class="info-value">{{ systemInfo.serverTime || '--' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label"><i class="fas fa-desktop"></i> 操作系统</span>
                <span class="info-value">{{ systemInfo.platform || '--' }}</span>
              </div>
            </div>
            <div class="info-row">
              <div class="info-item">
                <span class="info-label"><i class="fas fa-cogs"></i> 运行模式</span>
                <span class="info-value" :class="systemInfo.mode === 'production' ? 'text-emerald-600' : 'text-blue-600'">
                  {{ systemInfo.mode || '--' }}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label"><i class="fas fa-microchip"></i> 进程 PID</span>
                <span class="info-value">{{ systemInfo.pid || '--' }}</span>
              </div>
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
        <div 
          v-for="provider in providerStatus" 
          :key="provider.name"
          class="provider-card"
          :class="provider.status"
        >
          <div class="provider-header">
            <span 
              class="status-dot"
              :class="provider.status"
            ></span>
            <span class="provider-name">{{ provider.name }}</span>
          </div>
          <div class="provider-info">
            <span class="provider-accounts">{{ provider.accounts }} 账户</span>
            <span class="provider-requests">{{ provider.requests }} 请求</span>
          </div>
        </div>
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
        
        <div class="routing-grid">
          <div 
            v-for="route in routingExamples" 
            :key="route.path"
            class="routing-item"
            @click="copyToClipboard(route.fullPath)"
          >
            <i class="fas fa-link"></i>
            <span class="route-path">{{ route.fullPath }}</span>
            <span class="route-description">{{ route.description }}</span>
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
          <h4 class="models-title"><i class="fas fa-cube"></i> 可用模型列表</h4>
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
            <div v-else class="models-list">
              <span 
                v-for="model in availableModels" 
                :key="model"
                class="model-tag"
                @click="copyToClipboard(model)"
              >
                {{ model }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </details>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'

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
})

const gpuStatus = ref({
  loading: true,
  error: '',
  devices: []
})

const pythonGpuConnected = ref(false)
const pythonGpuInfo = ref({
  utilization: '--',
  memory: '--',
  temperature: '--',
  power: '--',
  name: '--',
  totalMemory: '--',
  usedMemory: '--',
  availableMemory: '--'
})

const providerStatus = ref([])
const availableModels = ref([])

const activeChartTab = ref('cpu')
const chartTabs = [
  { id: 'cpu', label: 'CPU' },
  { id: 'memory', label: '内存' },
  { id: 'gpu', label: 'GPU' }
]

const activePythonChartTab = ref('utilization')
const pythonChartTabs = [
  { id: 'utilization', label: '使用率' },
  { id: 'memory', label: '显存' },
  { id: 'temperature', label: '温度' },
  { id: 'all', label: '全部' }
]

const activeTimeRange = ref('hour')
const timeRangeTabs = [
  { id: 'hour', label: '最近一小时' },
  { id: 'day', label: '最近一天' },
  { id: 'week', label: '最近一周' }
]

const tokenChartData = ref({})
let tokenChart = null

const hasUpdate = ref(false)
const latestVersion = ref('')

const routingExamples = ref([
  { path: '/api/v1/chat/completions', description: '默认提供商', fullPath: '/api/v1/chat/completions' },
  { path: '/gemini-cli-oauth/v1/chat/completions', description: 'Gemini CLI OAuth', fullPath: '/gemini-cli-oauth/v1/chat/completions' },
  { path: '/claude-custom/v1/chat/completions', description: 'Claude Custom', fullPath: '/claude-custom/v1/chat/completions' },
  { path: '/openai-custom/v1/chat/completions', description: 'OpenAI Custom', fullPath: '/openai-custom/v1/chat/completions' }
])

let refreshInterval = null

const getToken = () => {
  return localStorage.getItem('authToken')
}

const createAxiosInstance = () => {
  const token = getToken()
  return axios.create({
    baseURL: window.location.origin,
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    }
  })
}

const formatUptime = (seconds) => {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${days}天 ${hours}小时 ${minutes}分钟`
}

const fetchSystemInfo = async () => {
  try {
    const api = createAxiosInstance()
    const response = await api.get('/api/system')
    const data = response.data
    
    systemInfo.value = {
      ...systemInfo.value,
      uptime: formatUptime(data.uptime),
      version: data.appVersion || '--',
      nodeVersion: data.nodeVersion || '--',
      serverTime: new Date(data.serverTime).toLocaleString('zh-CN'),
      platform: data.platform === 'linux' ? 'Linux x64' : (data.platform === 'win32' ? 'Windows' : data.platform) || '--',
      mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      pid: data.pid || '--'
    }
  } catch (error) {
    console.error('Failed to fetch system info:', error)
  }
}

const fetchSystemMonitor = async () => {
  try {
    const api = createAxiosInstance()
    const response = await api.get('/api/system/monitor')
    const data = response.data
    
    systemInfo.value = {
      ...systemInfo.value,
      cpu: Math.round(data.cpu?.usage || 0),
      memory: Math.round(parseFloat(data.memory?.usagePercent || 0)),
      gpu: Math.round(data.gpu?.usage || 0)
    }
  } catch (error) {
    console.error('Failed to fetch system monitor:', error)
  }
}

const fetchGpuStatus = async () => {
  try {
    gpuStatus.value.loading = true
    gpuStatus.value.error = ''
    
    const api = createAxiosInstance()
    const response = await api.get('/api/gpu/status')
    const data = response.data
    
    gpuStatus.value.devices = data.devices || []
  } catch (error) {
    gpuStatus.value.error = '无法获取GPU状态'
    console.error('Failed to fetch GPU status:', error)
  } finally {
    gpuStatus.value.loading = false
  }
}

const fetchPythonGpuStatus = async () => {
  try {
    const api = createAxiosInstance()
    const response = await api.get('/api/python-gpu/status')
    const data = response.data
    
    if (data.success) {
      pythonGpuConnected.value = true
      pythonGpuInfo.value = {
        utilization: `${data.utilization}%`,
        memory: `${data.memoryUsed}/${data.memoryTotal}`,
        temperature: `${data.temperature}°C`,
        power: `${data.power}W`,
        name: data.name || '--',
        totalMemory: data.memoryTotal || '--',
        usedMemory: data.memoryUsed || '--',
        availableMemory: data.memoryAvailable || '--'
      }
    } else {
      pythonGpuConnected.value = false
    }
  } catch (error) {
    pythonGpuConnected.value = false
    console.error('Failed to fetch Python GPU status:', error)
  }
}

const fetchProviderStatus = async () => {
  try {
    const api = createAxiosInstance()
    const response = await api.get('/api/providers')
    const data = response.data
    
    const providers = []
    for (const [type, items] of Object.entries(data.providers || {})) {
      if (Array.isArray(items) && items.length > 0) {
        const healthyCount = items.filter(p => p.isHealthy !== false).length
        const status = healthyCount === items.length ? 'healthy' : 
                       healthyCount > 0 ? 'warning' : 'error'
        
        providers.push({
          name: type.replace(/-/g, ' '),
          status,
          accounts: items.length,
          requests: items.reduce((sum, p) => sum + (p.requestCount || 0), 0)
        })
      }
    }
    
    providerStatus.value = providers
  } catch (error) {
    console.error('Failed to fetch provider status:', error)
  }
}

const fetchModels = async () => {
  try {
    const api = createAxiosInstance()
    const response = await api.get('/api/provider-models')
    const data = response.data
    
    const models = new Set()
    for (const typeModels of Object.values(data)) {
      if (Array.isArray(typeModels)) {
        typeModels.forEach(model => models.add(model))
      }
    }
    
    availableModels.value = Array.from(models).sort()
  } catch (error) {
    console.error('Failed to fetch models:', error)
  }
}

const refreshGpuStatus = async () => {
  await fetchGpuStatus()
}

const refreshPythonGpu = async () => {
  await fetchPythonGpuStatus()
}

const refreshProviderStatus = async () => {
  await fetchProviderStatus()
  await fetchModels()
}

const checkUpdate = async () => {
  try {
    const api = createAxiosInstance()
    const response = await api.get('/api/system/check-update')
    if (response.data.hasUpdate) {
      hasUpdate.value = true
      latestVersion.value = response.data.latestVersion
    }
  } catch (error) {
    console.error('Failed to check update:', error)
  }
}

const performUpdate = async () => {
  try {
    const api = createAxiosInstance()
    await api.post('/api/system/update')
    alert('更新已开始，请等待服务重启')
  } catch (error) {
    console.error('Failed to perform update:', error)
  }
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    alert(`已复制: ${text}`)
  } catch (error) {
    console.error('Failed to copy:', error)
  }
}

const fetchTokenUsageData = async () => {
  try {
    const api = createAxiosInstance()
    const response = await api.get('/api/model-usage-stats')
    const data = response.data
    tokenChartData.value = data.data || data
    updateTokenChart()
  } catch (error) {
    console.error('Failed to fetch token usage data:', error)
  }
}

const initTokenChart = () => {
  const canvas = document.getElementById('tokenTrendChart')
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  
  let rect = canvas.getBoundingClientRect()
  
  if (rect.width === 0 || rect.height === 0) {
    const container = canvas.parentElement
    if (container) {
      const containerRect = container.getBoundingClientRect()
      rect = {
        width: Math.max(containerRect.width - 32, 300),
        height: 160
      }
    } else {
      rect = { width: 400, height: 160 }
    }
  }

  if (rect.width <= 0 || rect.height <= 0) {
    rect = { width: 400, height: 160 }
  }

  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)

  tokenChart = {
    ctx,
    width: rect.width,
    height: rect.height,
    padding: { top: 15, right: 15, bottom: 28, left: 40 }
  }
}

const generateTokenTimeRangeData = (data, range) => {
  const now = new Date()
  const result = { labels: [], promptTokens: [], completionTokens: [], totalTokens: [] }
  
  let interval, count
  switch(range) {
    case 'hour':
      interval = 60 * 1000
      count = 60
      break
    case 'day':
      interval = 60 * 60 * 1000
      count = 24
      break
    case 'week':
      interval = 24 * 60 * 60 * 1000
      count = 7
      break
    default:
      interval = 60 * 1000
      count = 60
  }

  for (let i = count - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * interval)
    let label
    
    if (range === 'hour') {
      label = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`
    } else if (range === 'day') {
      label = `${time.getHours().toString().padStart(2, '0')}:00`
    } else {
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      label = weekdays[time.getDay()]
    }
    
    result.labels.push(label)
    
    let prompt = 0, completion = 0, total = 0
    
    if (range === 'hour') {
      const minuteKey = time.toISOString().slice(0, 16)
      if (data.hourly && data.hourly[minuteKey]) {
        const d = data.hourly[minuteKey]
        prompt = d.promptTokens || 0
        completion = d.completionTokens || 0
        total = d.totalTokens || 0
      }
    } else if (range === 'day') {
      const hourKey = time.toISOString().slice(0, 13)
      if (data.hourly && data.hourly[hourKey]) {
        const d = data.hourly[hourKey]
        prompt = d.promptTokens || 0
        completion = d.completionTokens || 0
        total = d.totalTokens || 0
      } else if (data.daily) {
        const dateKey = time.toISOString().slice(0, 10)
        if (data.daily[dateKey]) {
          const d = data.daily[dateKey]
          prompt += (d.promptTokens || 0) / 24
          completion += (d.completionTokens || 0) / 24
          total += (d.totalTokens || 0) / 24
        }
      }
    } else {
      const dateKey = time.toISOString().slice(0, 10)
      if (data.daily && data.daily[dateKey]) {
        const d = data.daily[dateKey]
        prompt = d.promptTokens || 0
        completion = d.completionTokens || 0
        total = d.totalTokens || 0
      }
    }
    
    result.promptTokens.push(Math.round(prompt))
    result.completionTokens.push(Math.round(completion))
    result.totalTokens.push(Math.round(total))
  }
  
  return result
}

const updateTokenChart = () => {
  if (!tokenChart) {
    initTokenChart()
  }

  if (!tokenChart) return

  const { ctx, width, height, padding } = tokenChart
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  ctx.clearRect(0, 0, width, height)

  const chartData = generateTokenTimeRangeData(tokenChartData.value, activeTimeRange.value)
  
  if (chartData.labels.length === 0) {
    ctx.fillStyle = '#6b7280'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('暂无数据', width / 2, height / 2)
    return
  }

  const allValues = [...chartData.promptTokens, ...chartData.completionTokens, ...chartData.totalTokens]
  const maxValue = Math.max(...allValues.filter(v => v > 0), 1)
  const minValue = 0

  drawGrid(ctx, chartWidth, chartHeight, padding)
  drawTokenAxes(ctx, chartWidth, chartHeight, padding, chartData.labels, minValue, maxValue)

  const datasets = [
    { data: chartData.promptTokens, color: '#3b82f6', gradient: ['#3b82f6', '#60a5fa'], label: '输入 Token' },
    { data: chartData.completionTokens, color: '#10b981', gradient: ['#10b981', '#34d399'], label: '输出 Token' },
    { data: chartData.totalTokens, color: '#8b5cf6', gradient: ['#8b5cf6', '#a78bfa'], label: '总 Token' }
  ]

  datasets.forEach(ds => {
    drawArea(ctx, chartWidth, chartHeight, padding, ds, minValue, maxValue)
    drawLine(ctx, chartWidth, chartHeight, padding, ds, minValue, maxValue)
  })

  datasets.forEach(ds => {
    drawPoint(ctx, chartWidth, chartHeight, padding, ds, minValue, maxValue)
  })
}

const drawGrid = (ctx, chartWidth, chartHeight, padding) => {
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])

  const gridLines = 5
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartHeight / gridLines) * i
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(padding.left + chartWidth, y)
    ctx.stroke()
  }

  ctx.setLineDash([])
}

const drawTokenAxes = (ctx, chartWidth, chartHeight, padding, labels, minValue, maxValue) => {
  ctx.strokeStyle = '#9ca3af'
  ctx.lineWidth = 2

  ctx.beginPath()
  ctx.moveTo(padding.left, padding.top)
  ctx.lineTo(padding.left, padding.top + chartHeight)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(padding.left, padding.top + chartHeight)
  ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight)
  ctx.stroke()

  ctx.fillStyle = '#6b7280'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'right'

  const gridLines = 5
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartHeight / gridLines) * i
    const value = Math.round(maxValue - ((maxValue - minValue) / gridLines) * i)
    const formattedValue = formatTokenValue(value)
    ctx.fillText(formattedValue, padding.left - 8, y + 4)
  }

  ctx.textAlign = 'center'
  const step = Math.ceil(labels.length / 5)
  for (let i = 0; i < labels.length; i += step) {
    const x = padding.left + (chartWidth / (labels.length - 1)) * i
    ctx.fillText(labels[i], x, padding.top + chartHeight + 22)
  }
}

const formatTokenValue = (value) => {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M'
  } else if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K'
  }
  return value.toString()
}

const drawArea = (ctx, chartWidth, chartHeight, padding, dataset, minValue, maxValue) => {
  const dataLength = dataset.data.length
  if (dataLength < 2) return

  const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight)
  gradient.addColorStop(0, dataset.gradient[0] + '30')
  gradient.addColorStop(1, dataset.gradient[1] + '05')

  ctx.fillStyle = gradient
  ctx.beginPath()

  dataset.data.forEach((value, index) => {
    const x = padding.left + (chartWidth / (dataLength - 1)) * index
    const y = padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight

    if (index === 0) {
      ctx.moveTo(x, padding.top + chartHeight)
      ctx.lineTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })

  const lastX = padding.left + (chartWidth / (dataLength - 1)) * (dataLength - 1)
  ctx.lineTo(lastX, padding.top + chartHeight)
  ctx.closePath()
  ctx.fill()
}

const drawLine = (ctx, chartWidth, chartHeight, padding, dataset, minValue, maxValue) => {
  const dataLength = dataset.data.length
  if (dataLength < 2) return

  ctx.strokeStyle = dataset.color
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()

  dataset.data.forEach((value, index) => {
    const x = padding.left + (chartWidth / (dataLength - 1)) * index
    const y = padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight

    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      const prevX = padding.left + (chartWidth / (dataLength - 1)) * (index - 1)
      const prevY = padding.top + chartHeight - ((dataset.data[index - 1] - minValue) / (maxValue - minValue)) * chartHeight
      
      const cpX = (prevX + x) / 2
      ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2)
    }
  })

  ctx.stroke()
}

const drawPoint = (ctx, chartWidth, chartHeight, padding, dataset, minValue, maxValue) => {
  const dataLength = dataset.data.length
  if (dataLength === 0) return

  const lastIndex = dataLength - 1
  const value = dataset.data[lastIndex]
  if (value <= 0) return

  const x = padding.left + (chartWidth / (dataLength - 1)) * lastIndex
  const y = padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight

  ctx.beginPath()
  ctx.arc(x, y, 6, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = dataset.color
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x, y, 3, 0, Math.PI * 2)
  ctx.fillStyle = dataset.color
  ctx.fill()
}

onMounted(async () => {
  await fetchSystemInfo()
  await fetchSystemMonitor()
  await fetchGpuStatus()
  await fetchPythonGpuStatus()
  await fetchProviderStatus()
  await fetchModels()
  await fetchTokenUsageData()

  refreshInterval = setInterval(async () => {
    await fetchSystemMonitor()
    systemInfo.value.serverTime = new Date().toLocaleString('zh-CN')
  }, 5000)

  setTimeout(() => {
    initTokenChart()
    updateTokenChart()
  }, 100)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
.section {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.stats-container {
  margin-bottom: 1rem;
}

.stats-row {
  display: flex;
  gap: 0.5rem;
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  padding: 0.75rem;
  box-shadow: var(--shadow-sm);
}

.stat-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-right: 1px solid var(--border-color);
  transition: var(--transition);
}

.stat-item:last-child {
  border-right: none;
}

.stat-item:hover {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.stat-icon-wrapper {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  color: var(--primary-color);
  background: var(--primary-10);
  flex-shrink: 0;
}

.stat-icon-wrapper.cpu {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
}

.stat-icon-wrapper.memory {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
}

.stat-icon-wrapper.gpu {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.stat-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 0.65rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dashboard-layout {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 1rem;
  margin-bottom: 1rem;
}

.dashboard-left {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dashboard-right {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.panel {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.panel-header h3 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.panel-header h3 i {
  color: var(--primary-color);
}

.panel-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chart-tabs {
  display: flex;
  gap: 0.25rem;
}

.chart-tab {
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
}

.chart-tab:hover {
  background: var(--bg-tertiary);
  border-color: var(--primary-color);
}

.chart-tab.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.chart-area {
  position: relative;
  height: 160px;
  background: var(--bg-secondary);
  padding: 0.5rem;
}

#systemChart, #pythonGpuChart {
  width: 100% !important;
  height: 100% !important;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-color);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.legend-color {
  width: 0.6rem;
  height: 0.3rem;
  border-radius: 2px;
}

.legend-color.cpu { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
.legend-color.memory { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
.legend-color.gpu { background: linear-gradient(90deg, #8b5cf6, #a78bfa); }
.legend-color.gpu-temp { background: linear-gradient(90deg, #ef4444, #f87171); }
.legend-color.gpu-util { background: #3b82f6; }
.legend-color.gpu-mem { background: #8b5cf6; }
.legend-color.prompt { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
.legend-color.completion { background: linear-gradient(90deg, #10b981, #34d399); }
.legend-color.total { background: linear-gradient(90deg, #8b5cf6, #a78bfa); }

.time-range-tabs {
  display: flex;
  gap: 0.375rem;
  background: var(--bg-secondary);
  padding: 0.25rem;
  border-radius: var(--radius-md);
}

.time-range-tab {
  padding: 0.375rem 0.75rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
}

.time-range-tab:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.time-range-tab.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.gpu-section {
  border-top: 1px solid var(--border-color);
}

.gpu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
}

.gpu-header h4 {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.gpu-content {
  padding: 0.75rem 1rem;
}

.loading, .empty, .error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--text-tertiary);
  padding: 1rem;
}

.loading i {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error {
  color: var(--danger-color);
  background: var(--danger-bg-light);
  border-radius: var(--radius-md);
}

.gpu-devices {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.gpu-device {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 0.75rem;
}

.gpu-device-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.gpu-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.gpu-status {
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  background: var(--danger-bg);
  color: var(--danger-text);
}

.gpu-status.healthy {
  background: var(--success-bg);
  color: var(--success-text);
}

.gpu-device-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.info-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  width: 50px;
}

.info-bar-container {
  flex: 1;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.info-bar {
  height: 100%;
  background: var(--primary-color);
  border-radius: 2px;
  transition: width 0.3s;
}

.info-bar.gpu-usage {
  background: var(--info-color);
}

.info-value {
  font-size: 0.7rem;
  color: var(--text-primary);
  width: 70px;
  text-align: right;
}

.info-value.temp {
  color: var(--warning-color);
}

.info-value.temp.warning {
  color: var(--danger-color);
  font-weight: 600;
}

.python-gpu-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-color);
}

.python-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.python-stat-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
}

.python-stat-icon.gpu {
  background: var(--info-bg);
  color: var(--info-color);
}

.python-stat-icon.memory {
  background: var(--warning-bg);
  color: var(--warning-color);
}

.python-stat-icon.temp {
  background: var(--danger-bg);
  color: var(--danger-color);
}

.python-stat-icon.power {
  background: var(--success-bg);
  color: var(--success-color);
}

.python-stat-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
}

.python-stat-value {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary);
}

.python-stat-label {
  font-size: 0.6rem;
  color: var(--text-secondary);
}

.python-gpu-chart-area {
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-color);
}

.chart-type-tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.chart-type-tab {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 0.65rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
}

.chart-type-tab:hover {
  background: var(--bg-tertiary);
}

.chart-type-tab.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.python-chart-legend {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.python-gpu-details {
  padding: 0.75rem 1rem;
}

.python-gpu-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-list {
  padding: 0.75rem 1rem;
}

.info-list .info-row {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.info-list .info-row:last-child {
  margin-bottom: 0;
}

.info-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-list .info-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  width: auto;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.info-list .info-value {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
  width: auto;
  text-align: left;
}

.version-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.update-badge {
  font-size: 0.65rem;
  padding: 0.15rem 0.4rem;
  background: var(--success-bg);
  color: var(--success-text);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.update-controls {
  display: flex;
  gap: 0.5rem;
}

.provider-grid {
  display: grid;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
}

.provider-grid-horizontal {
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
}

.provider-card {
  padding: 0.75rem;
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
}

.provider-card.healthy {
  border: 1px solid var(--success-bg);
}

.provider-card.warning {
  border: 1px solid var(--warning-border);
}

.provider-card.error {
  border: 1px solid var(--danger-border);
}

.provider-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--danger-color);
}

.status-dot.healthy {
  background: var(--success-color);
}

.status-dot.warning {
  background: var(--warning-color);
}

.provider-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
}

.provider-info {
  display: flex;
  gap: 0.75rem;
}

.provider-accounts, .provider-requests {
  font-size: 0.65rem;
  color: var(--text-secondary);
}

.expandable-section {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
  overflow: hidden;
  margin-top: 1rem;
}

.section-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  cursor: pointer;
  background: var(--bg-secondary);
}

.summary-header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.summary-header i {
  color: var(--primary-color);
}

.summary-header span:first-of-type {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.expand-hint {
  font-size: 0.7rem;
  color: var(--text-tertiary);
}

.caret {
  color: var(--text-tertiary);
  transition: transform 0.2s;
}

.expandable-section[open] .caret {
  transform: rotate(180deg);
}

.routing-panel {
  padding: 1.25rem;
}

.routing-panel h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.routing-desc {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.routing-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.routing-item {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  cursor: pointer;
  transition: var(--transition);
}

.routing-item:hover {
  background: var(--primary-10);
}

.routing-item i {
  color: var(--primary-color);
  margin-bottom: 0.375rem;
}

.route-path {
  display: block;
  font-family: monospace;
  font-size: 0.7rem;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.route-description {
  font-size: 0.65rem;
  color: var(--text-secondary);
}

.routing-tips {
  background: var(--warning-bg-alt);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  margin-bottom: 1.25rem;
}

.routing-tips h4 {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--warning-text);
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.5rem;
}

.routing-tips ul {
  margin: 0;
  padding-left: 1.25rem;
}

.routing-tips li {
  font-size: 0.7rem;
  color: var(--warning-text-dark);
  margin-bottom: 0.25rem;
}

.routing-tips li:last-child {
  margin-bottom: 0;
}

.models-area {
  border-top: 1px solid var(--border-color);
  padding-top: 1.25rem;
}

.models-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.models-desc {
  margin-bottom: 0.75rem;
}

.highlight-note {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.7rem;
  color: var(--text-secondary);
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.highlight-note i {
  color: var(--primary-color);
}

.models-container {
  min-height: 3rem;
}

.models-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.model-tag {
  padding: 0.25rem 0.625rem;
  background: var(--bg-secondary);
  border-radius: 9999px;
  font-size: 0.7rem;
  color: var(--text-primary);
  cursor: pointer;
  transition: var(--transition);
}

.model-tag:hover {
  background: var(--primary-10);
  color: var(--primary-color);
}

.btn {
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border-color);
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.65rem;
}

.btn-outline {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.btn-outline:hover {
  background: var(--bg-tertiary);
  border-color: var(--primary-color);
}

.btn-primary {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.btn-primary:hover {
  background: var(--primary-hover);
}

@media (max-width: 1024px) {
  .dashboard-layout {
    grid-template-columns: 1fr;
  }
  
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-row {
    flex-wrap: wrap;
  }
  
  .stat-item {
    min-width: calc(50% - 0.25rem);
  }
  
  .routing-grid {
    grid-template-columns: 1fr;
  }
  
  .provider-grid-horizontal {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .python-gpu-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .stat-item {
    min-width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }
  
  .stat-item:last-child {
    border-bottom: none;
  }
  
  .provider-grid-horizontal {
    grid-template-columns: 1fr;
  }
  
  .python-gpu-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>