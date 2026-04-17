<template>
  <div class="dashboard">
    <div class="stats-container">
      <div class="stats-row">
        <div class="stat-item">
          <div class="stat-icon-wrapper">
            <i class="fas fa-clock"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value" :key="'uptime-' + componentKey.uptime">{{ systemInfo.uptime || '--' }}</span>
            <span class="stat-label">运行时间</span>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon-wrapper cpu">
            <i class="fas fa-microchip"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value" :key="'cpu-' + componentKey.cpu">{{ systemInfo.cpu }}%</span>
            <span class="stat-label">CPU</span>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon-wrapper memory">
            <i class="fas fa-memory"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value" :key="'memory-' + componentKey.memory">{{ systemInfo.memory }}%</span>
            <span class="stat-label">内存</span>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon-wrapper gpu">
            <i class="fas fa-video-card"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value" :key="'gpu-' + componentKey.gpu">{{ systemInfo.gpu }}%</span>
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
            <div class="chart-placeholder">
              <canvas id="systemChart"></canvas>
            </div>
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
            <div class="gpu-content" :key="'gpu-content-' + componentKey.gpu">
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

        <div class="panel provider-status">
          <div class="panel-header">
            <h3><i class="fas fa-network-wired"></i> 提供商节点状态</h3>
            <button 
              class="btn btn-sm btn-outline"
              @click="refreshProviderStatus"
            >
              <i class="fas fa-sync-alt"></i> 刷新
            </button>
          </div>
          <div class="provider-grid" :key="'provider-grid-' + componentKey.providerStatus">
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
  </div>
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

const providerStatus = ref([])
const availableModels = ref([])

const activeChartTab = ref('cpu')
const chartTabs = [
  { id: 'cpu', label: 'CPU' },
  { id: 'memory', label: '内存' },
  { id: 'gpu', label: 'GPU' }
]

const componentKey = ref({
  uptime: 0,
  cpu: 0,
  memory: 0,
  gpu: 0,
  systemInfo: 0,
  providerStatus: 0
})

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
    
    componentKey.value.systemInfo++
    componentKey.value.uptime++
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
    
    componentKey.value.cpu++
    componentKey.value.memory++
    componentKey.value.gpu++
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
    componentKey.value.providerStatus++
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

onMounted(async () => {
  await fetchSystemInfo()
  await fetchSystemMonitor()
  await fetchGpuStatus()
  await fetchProviderStatus()
  await fetchModels()

  refreshInterval = setInterval(async () => {
    await fetchSystemMonitor()
    systemInfo.value.serverTime = new Date().toLocaleString('zh-CN')
  }, 5000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
.dashboard {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.stats-container {
  margin-bottom: 24px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: white;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
}

.stat-icon-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ecfdf5;
  color: #059669;
}

.stat-icon-wrapper.cpu {
  background: #eff6ff;
  color: #3b82f6;
}

.stat-icon-wrapper.memory {
  background: #f5f3ff;
  color: #8b5cf6;
}

.stat-icon-wrapper.gpu {
  background: #fff7ed;
  color: #f97316;
}

.stat-content {
  flex: 1;
}

.stat-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
}

.stat-label {
  font-size: 12px;
  color: #64748b;
}

.dashboard-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 24px;
  margin-bottom: 24px;
}

.panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
  overflow: hidden;
  margin-bottom: 24px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.panel-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-sm {
  padding: 4px 10px;
}

.btn-outline {
  background: #f1f5f9;
  color: #64748b;
}

.btn-outline:hover {
  background: #e2e8f0;
}

.btn-primary {
  background: #059669;
  color: white;
}

.btn-primary:hover {
  background: #047857;
}

.chart-tabs {
  display: flex;
  gap: 4px;
}

.chart-tab {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  background: #f1f5f9;
  color: #64748b;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.chart-tab.active {
  background: #059669;
  color: white;
}

.chart-area {
  padding: 16px;
  height: 200px;
}

.chart-placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  border-radius: 8px;
}

.chart-legend {
  display: flex;
  gap: 16px;
  padding: 0 16px 16px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-color.cpu { background: #3b82f6; }
.legend-color.memory { background: #8b5cf6; }
.legend-color.gpu { background: #f97316; }
.legend-color.gpu-temp { background: #ef4444; }

.gpu-section {
  border-top: 1px solid #e2e8f0;
}

.gpu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
}

.gpu-header h4 {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 6px;
}

.gpu-content {
  padding: 16px;
}

.loading, .empty, .error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #94a3b8;
  padding: 20px;
}

.loading i, .empty i, .error i {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error {
  color: #dc2626;
  background: #fef2f2;
  border-radius: 8px;
}

.gpu-devices {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gpu-device {
  background: #f8fafc;
  border-radius: 8px;
  padding: 12px;
}

.gpu-device-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.gpu-name {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

.gpu-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #fee2e2;
  color: #dc2626;
}

.gpu-status.healthy {
  background: #dcfce7;
  color: #059669;
}

.gpu-device-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.info-label {
  font-size: 12px;
  color: #64748b;
  width: 60px;
}

.info-bar-container {
  flex: 1;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.info-bar {
  height: 100%;
  background: #059669;
  border-radius: 3px;
  transition: width 0.3s;
}

.info-bar.gpu-usage {
  background: #3b82f6;
}

.info-value {
  font-size: 12px;
  color: #334155;
  width: 80px;
  text-align: right;
}

.info-value.temp {
  color: #f97316;
}

.info-value.temp.warning {
  color: #dc2626;
  font-weight: 600;
}

.info-list {
  padding: 16px;
}

.info-row {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 4px;
}

.version-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-value {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

.update-badge {
  font-size: 11px;
  padding: 2px 6px;
  background: #dcfce7;
  color: #059669;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.update-controls {
  display: flex;
  gap: 8px;
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 16px;
}

.provider-card {
  padding: 12px;
  border-radius: 8px;
  background: #f8fafc;
}

.provider-card.healthy {
  border: 1px solid #dcfce7;
}

.provider-card.warning {
  border: 1px solid #fef3c7;
}

.provider-card.error {
  border: 1px solid #fee2e2;
}

.provider-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #dc2626;
}

.status-dot.healthy {
  background: #059669;
}

.status-dot.warning {
  background: #f59e0b;
}

.provider-name {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.provider-info {
  display: flex;
  gap: 12px;
}

.provider-accounts, .provider-requests {
  font-size: 11px;
  color: #64748b;
}

.expandable-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.section-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  cursor: pointer;
  background: #f8fafc;
}

.summary-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.summary-header i {
  color: #059669;
}

.summary-header span:first-of-type {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}

.expand-hint {
  font-size: 12px;
  color: #94a3b8;
}

.caret {
  color: #94a3b8;
  transition: transform 0.2s;
}

.expandable-section[open] .caret {
  transform: rotate(180deg);
}

.routing-panel {
  padding: 20px;
}

.routing-panel h3 {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.routing-desc {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 16px;
}

.routing-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.routing-item {
  background: #f8fafc;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.routing-item:hover {
  background: #ecfdf5;
  border-color: #059669;
}

.routing-item i {
  color: #059669;
  margin-bottom: 6px;
}

.route-path {
  display: block;
  font-family: monospace;
  font-size: 12px;
  color: #1e293b;
  margin-bottom: 4px;
}

.route-description {
  font-size: 11px;
  color: #64748b;
}

.routing-tips {
  background: #fffbeb;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 20px;
}

.routing-tips h4 {
  font-size: 13px;
  font-weight: 600;
  color: #92400e;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.routing-tips ul {
  margin: 0;
  padding-left: 20px;
}

.routing-tips li {
  font-size: 12px;
  color: #78350f;
  margin-bottom: 4px;
}

.routing-tips li:last-child {
  margin-bottom: 0;
}

.models-area {
  border-top: 1px solid #e2e8f0;
  padding-top: 20px;
}

.models-title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.models-desc {
  margin-bottom: 12px;
}

.highlight-note {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 6px;
}

.highlight-note i {
  color: #059669;
}

.models-container {
  min-height: 80px;
}

.models-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.model-tag {
  padding: 4px 10px;
  background: #f1f5f9;
  border-radius: 20px;
  font-size: 12px;
  color: #334155;
  cursor: pointer;
  transition: all 0.2s;
}

.model-tag:hover {
  background: #ecfdf5;
  color: #059669;
}

@media (max-width: 1024px) {
  .dashboard-layout {
    grid-template-columns: 1fr;
  }
  
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .stats-row {
    grid-template-columns: 1fr;
  }
  
  .routing-grid {
    grid-template-columns: 1fr;
  }
  
  .provider-grid {
    grid-template-columns: 1fr;
  }
}
</style>