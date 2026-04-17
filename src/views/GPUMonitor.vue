<template>
  <div class="gpu-monitor-container">
    <div class="gpu-status-panel">
      <div class="panel-header">
        <h3><i class="fas fa-microchip"></i> GPU状态</h3>
        <button 
          class="btn btn-outline btn-sm"
          @click="refreshGpuStatus"
        >
          <i class="fas fa-sync-alt"></i> 刷新
        </button>
      </div>
      
      <div class="gpu-status-content" :key="'gpu-status-' + refreshKey">
        <div v-if="gpuStatus.loading" class="status-loading">
          <i class="fas fa-spinner fa-spin"></i>
          <span>加载中...</span>
        </div>
        <div v-else-if="gpuStatus.error" class="status-error">
          <i class="fas fa-exclamation-triangle"></i>
          <span>{{ gpuStatus.error }}</span>
        </div>
        <div v-else-if="gpuStatus.devices && gpuStatus.devices.length > 0" class="devices-grid">
          <div 
            v-for="(device, index) in gpuStatus.devices" 
            :key="index"
            class="device-card"
          >
            <div class="device-header">
              <span class="device-name">{{ device.name }}</span>
              <span 
                class="device-status"
                :class="device.status"
              >
                {{ device.status === 'healthy' ? '正常' : '异常' }}
              </span>
            </div>
            <div class="device-info">
              <div class="info-row">
                <span class="info-label">显存</span>
                <div class="progress-bar">
                  <div 
                    class="progress-fill"
                    :style="{ width: device.memoryUsage + '%' }"
                  ></div>
                </div>
                <span class="info-value">{{ device.memoryUsed }} / {{ device.memoryTotal }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">使用率</span>
                <div class="progress-bar">
                  <div 
                    class="progress-fill usage"
                    :style="{ width: device.utilization + '%' }"
                  ></div>
                </div>
                <span class="info-value">{{ device.utilization }}%</span>
              </div>
              <div class="info-row">
                <span class="info-label">温度</span>
                <div class="progress-bar">
                  <div 
                    class="progress-fill temp"
                    :style="{ width: Math.min(device.temperature, 100) + '%' }"
                  ></div>
                </div>
                <span class="info-value" :class="{ warning: device.temperature > 80 }">
                  {{ device.temperature }}°C
                </span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="status-empty">
          <i class="fas fa-video-card"></i>
          <span>未检测到GPU设备</span>
        </div>
      </div>
    </div>

    <div class="gpu-charts-panel">
      <div class="panel-header">
        <h3><i class="fas fa-chart-line"></i> 历史监控</h3>
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
      
      <div class="gpu-chart-content">
        <canvas id="gpuChart"></canvas>
      </div>
      
      <div class="chart-legend">
        <div class="legend-item">
          <span class="legend-color utilization"></span>
          <span>GPU使用率</span>
        </div>
        <div class="legend-item">
          <span class="legend-color temperature"></span>
          <span>温度(°C)</span>
        </div>
        <div class="legend-item">
          <span class="legend-color memory"></span>
          <span>显存使用率</span>
        </div>
      </div>
    </div>

    <div class="models-status-panel">
      <div class="panel-header">
        <h3><i class="fas fa-cubes"></i> 模型状态</h3>
      </div>
      
      <div class="models-status-content" :key="'models-' + refreshKey">
        <div v-if="modelsStatus.loading" class="status-loading">
          <i class="fas fa-spinner fa-spin"></i>
          <span>加载中...</span>
        </div>
        <div v-else-if="modelsStatus.models && modelsStatus.models.length > 0" class="models-list">
          <div 
            v-for="model in modelsStatus.models" 
            :key="model.name"
            class="model-item"
            :class="model.status"
          >
            <div class="model-icon">
              <i class="fas fa-cube"></i>
            </div>
            <div class="model-info">
              <span class="model-name">{{ model.name }}</span>
              <span class="model-size">{{ model.size }}</span>
            </div>
            <span class="model-status">
              {{ model.status === 'loaded' ? '已加载' : model.status === 'loading' ? '加载中' : '未加载' }}
            </span>
          </div>
        </div>
        <div v-else class="status-empty">
          <i class="fas fa-inbox"></i>
          <span>暂无模型</span>
        </div>
      </div>
    </div>

    <div class="queue-status-panel">
      <div class="panel-header">
        <h3><i class="fas fa-list-ol"></i> 队列状态</h3>
      </div>
      
      <div class="queue-status-content" :key="'queue-' + refreshKey">
        <div v-if="queueStatus.loading" class="status-loading">
          <i class="fas fa-spinner fa-spin"></i>
          <span>加载中...</span>
        </div>
        <div v-else class="queue-info">
          <div class="queue-item">
            <span class="queue-label">等待队列</span>
            <span class="queue-value">{{ queueStatus.pending || 0 }}</span>
          </div>
          <div class="queue-item">
            <span class="queue-label">处理中</span>
            <span class="queue-value processing">{{ queueStatus.processing || 0 }}</span>
          </div>
          <div class="queue-item">
            <span class="queue-label">今日完成</span>
            <span class="queue-value completed">{{ queueStatus.completedToday || 0 }}</span>
          </div>
          <div class="queue-item">
            <span class="queue-label">平均延迟</span>
            <span class="queue-value">{{ queueStatus.avgLatency || '--' }}ms</span>
          </div>
        </div>
      </div>
    </div>

    <div class="control-panel">
      <div class="panel-header">
        <h3><i class="fas fa-play"></i> 模型控制</h3>
      </div>
      
      <div class="model-controls" :key="'controls-' + refreshKey">
        <div v-if="controlStatus.loading" class="status-loading">
          <i class="fas fa-spinner fa-spin"></i>
          <span>加载中...</span>
        </div>
        <div v-else-if="availableModels.length > 0" class="controls-list">
          <div 
            v-for="model in availableModels" 
            :key="model.name"
            class="control-item"
          >
            <div class="control-info">
              <span class="control-name">{{ model.name }}</span>
              <span class="control-desc">{{ model.description }}</span>
            </div>
            <div class="control-actions">
              <button 
                v-if="!model.loaded"
                class="btn btn-primary btn-sm"
                @click="loadModel(model.name)"
              >
                <i class="fas fa-download"></i> 加载
              </button>
              <button 
                v-else
                class="btn btn-danger btn-sm"
                @click="unloadModel(model.name)"
              >
                <i class="fas fa-trash"></i> 卸载
              </button>
            </div>
          </div>
        </div>
        <div v-else class="status-empty">
          <i class="fas fa-server"></i>
          <span>暂无可用模型</span>
        </div>
      </div>
    </div>

    <div class="controller-integration">
      <div class="panel-header">
        <h3><i class="fas fa-desktop"></i> AI控制器</h3>
        <div class="controller-status">
          <span 
            id="controllerConnectionStatus" 
            class="status-badge"
            :class="{ offline: !controllerConnected, online: controllerConnected }"
          >
            <i class="fas fa-circle"></i> 
            {{ controllerConnected ? '已连接' : '未连接' }}
          </span>
        </div>
      </div>
      
      <div class="iframe-container">
        <div v-if="!controllerConnected" class="iframe-placeholder">
          <i class="fas fa-server"></i>
          <p>AI控制器未启动或配置</p>
          <p class="hint">请启动 Python 控制器服务以查看详细监控面板</p>
        </div>
        <iframe 
          v-else
          id="controllerIframe" 
          :src="controllerUrl"
          frameborder="0" 
          allowfullscreen
        ></iframe>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'

const gpuStatus = ref({
  loading: true,
  error: '',
  devices: []
})

const modelsStatus = ref({
  loading: true,
  models: []
})

const queueStatus = ref({
  loading: true,
  pending: 0,
  processing: 0,
  completedToday: 0,
  avgLatency: '--'
})

const controlStatus = ref({
  loading: true
})

const availableModels = ref([])
const activeChartTab = ref('utilization')
const refreshKey = ref(0)
const controllerConnected = ref(false)
const controllerUrl = ref('')

const chartTabs = [
  { id: 'utilization', label: '使用率' },
  { id: 'temperature', label: '温度' },
  { id: 'memory', label: '显存' }
]

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

const fetchGpuStatus = async () => {
  try {
    gpuStatus.value.loading = true
    gpuStatus.value.error = ''
    
    const api = createAxiosInstance()
    const response = await api.get('/api/gpu/status')
    gpuStatus.value.devices = response.data.devices || []
  } catch (error) {
    gpuStatus.value.error = '无法获取GPU状态'
    console.error('Failed to fetch GPU status:', error)
  } finally {
    gpuStatus.value.loading = false
  }
}

const fetchModelsStatus = async () => {
  try {
    modelsStatus.value.loading = true
    
    const api = createAxiosInstance()
    const response = await api.get('/api/gpu/models')
    modelsStatus.value.models = response.data.models || []
  } catch (error) {
    console.error('Failed to fetch models status:', error)
  } finally {
    modelsStatus.value.loading = false
  }
}

const fetchQueueStatus = async () => {
  try {
    queueStatus.value.loading = true
    
    const api = createAxiosInstance()
    const response = await api.get('/api/gpu/queue')
    queueStatus.value = {
      loading: false,
      pending: response.data.pending || 0,
      processing: response.data.processing || 0,
      completedToday: response.data.completedToday || 0,
      avgLatency: response.data.avgLatency || '--'
    }
  } catch (error) {
    console.error('Failed to fetch queue status:', error)
    queueStatus.value.loading = false
  }
}

const fetchAvailableModels = async () => {
  try {
    controlStatus.value.loading = true
    
    const api = createAxiosInstance()
    const response = await api.get('/api/gpu/available-models')
    availableModels.value = response.data.models || []
  } catch (error) {
    console.error('Failed to fetch available models:', error)
  } finally {
    controlStatus.value.loading = false
  }
}

const checkControllerConnection = async () => {
  try {
    const api = createAxiosInstance()
    const response = await api.get('/api/gpu/controller/status')
    controllerConnected.value = response.data.connected || false
    controllerUrl.value = response.data.url || ''
  } catch (error) {
    controllerConnected.value = false
    console.error('Failed to check controller connection:', error)
  }
}

const loadModel = async (modelName) => {
  try {
    const api = createAxiosInstance()
    await api.post('/api/gpu/models/load', { model: modelName })
    refreshKey.value++
    await fetchModelsStatus()
    await fetchAvailableModels()
    alert(`模型 ${modelName} 加载请求已发送`)
  } catch (error) {
    alert(`加载模型失败: ${error.message}`)
  }
}

const unloadModel = async (modelName) => {
  try {
    const api = createAxiosInstance()
    await api.post('/api/gpu/models/unload', { model: modelName })
    refreshKey.value++
    await fetchModelsStatus()
    await fetchAvailableModels()
    alert(`模型 ${modelName} 卸载请求已发送`)
  } catch (error) {
    alert(`卸载模型失败: ${error.message}`)
  }
}

const refreshGpuStatus = async () => {
  await fetchGpuStatus()
  await fetchModelsStatus()
  await fetchQueueStatus()
  refreshKey.value++
}

onMounted(async () => {
  await fetchGpuStatus()
  await fetchModelsStatus()
  await fetchQueueStatus()
  await fetchAvailableModels()
  await checkControllerConnection()

  refreshInterval = setInterval(async () => {
    await fetchGpuStatus()
    await fetchQueueStatus()
  }, 5000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
.gpu-monitor-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
}

.panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
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

.btn-danger {
  background: #dc2626;
  color: white;
}

.btn-danger:hover {
  background: #b91c1c;
}

.status-loading, .status-empty, .status-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 30px;
  color: #94a3b8;
}

.status-loading i {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-error {
  color: #dc2626;
  background: #fef2f2;
}

.gpu-status-panel, .gpu-charts-panel {
  grid-column: span 2;
}

.devices-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
  padding: 16px;
}

.device-card {
  background: #f8fafc;
  border-radius: 8px;
  padding: 14px;
  border: 1px solid #e2e8f0;
}

.device-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.device-name {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

.device-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #fee2e2;
  color: #dc2626;
}

.device-status.healthy {
  background: #dcfce7;
  color: #059669;
}

.device-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.info-label {
  font-size: 12px;
  color: #64748b;
  width: 50px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #059669;
  border-radius: 3px;
  transition: width 0.3s;
}

.progress-fill.usage {
  background: #3b82f6;
}

.progress-fill.temp {
  background: #f97316;
}

.info-value {
  font-size: 12px;
  color: #334155;
  width: 70px;
  text-align: right;
}

.info-value.warning {
  color: #dc2626;
  font-weight: 600;
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

.gpu-chart-content {
  padding: 16px;
  height: 200px;
  background: #f8fafc;
}

.chart-legend {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
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

.legend-color.utilization { background: #3b82f6; }
.legend-color.temperature { background: #ef4444; }
.legend-color.memory { background: #8b5cf6; }

.models-list {
  padding: 12px;
}

.model-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  margin-bottom: 8px;
  background: #f8fafc;
  border-radius: 8px;
  border-left: 3px solid #94a3b8;
}

.model-item.loaded {
  border-left-color: #059669;
}

.model-item.loading {
  border-left-color: #f59e0b;
}

.model-icon {
  width: 36px;
  height: 36px;
  background: #e2e8f0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
}

.model-info {
  flex: 1;
}

.model-name {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

.model-size {
  font-size: 11px;
  color: #64748b;
}

.model-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #f1f5f9;
  color: #64748b;
}

.queue-info {
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.queue-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  background: #f8fafc;
  border-radius: 8px;
}

.queue-label {
  font-size: 12px;
  color: #64748b;
}

.queue-value {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}

.queue-value.processing {
  color: #3b82f6;
}

.queue-value.completed {
  color: #059669;
}

.controls-list {
  padding: 12px;
}

.control-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  margin-bottom: 8px;
  background: #f8fafc;
  border-radius: 8px;
}

.control-info {
  flex: 1;
}

.control-name {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

.control-desc {
  font-size: 11px;
  color: #64748b;
}

.control-actions {
  margin-left: 12px;
}

.controller-integration {
  grid-column: span 2;
}

.controller-status {
  display: flex;
  align-items: center;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  background: #fee2e2;
  color: #dc2626;
}

.status-badge.online {
  background: #dcfce7;
  color: #059669;
}

.status-badge i {
  font-size: 10px;
}

.iframe-container {
  height: 400px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

.iframe-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #94a3b8;
}

.iframe-placeholder i {
  font-size: 48px;
  opacity: 0.5;
}

.iframe-placeholder p {
  margin: 0;
  font-size: 14px;
}

.iframe-placeholder .hint {
  font-size: 12px;
  color: #94a3b8;
}

#iframe {
  width: 100%;
  height: 100%;
}

@media (max-width: 768px) {
  .gpu-status-panel, .gpu-charts-panel, .controller-integration {
    grid-column: span 1;
  }
  
  .devices-grid {
    grid-template-columns: 1fr;
  }
  
  .queue-info {
    grid-template-columns: 1fr;
  }
}
</style>