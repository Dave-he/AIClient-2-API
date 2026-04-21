<template>
  <section id="providers" class="section" aria-labelledby="providers-title">
    <h2 id="providers-title">提供商池管理</h2>
    <div class="pool-description">
      <div class="highlight-note">
        <i class="fas fa-info-circle"></i>
        <span>使用默认路径配置需添加一个空节点</span>
      </div>
    </div>
    
    <div class="provider-controls">
      <div class="provider-selector">
        <label for="provider-select">选择提供商</label>
        <select id="provider-select" v-model="selectedProvider" @change="onProviderChange">
          <option value="all">全部提供商</option>
          <option v-for="p in providerList" :key="p" :value="p">{{ p }}</option>
        </select>
      </div>
      
      <div class="chart-controls">
        <div class="time-range-tabs">
          <button 
            v-for="tab in timeRangeTabs" 
            :key="tab.id"
            class="time-range-tab"
            :class="{ active: activeTimeRange === tab.id }"
            @click="onTimeRangeChange(tab.id)"
          >
            {{ tab.label }}
          </button>
        </div>
        
        <div class="chart-metric-tabs">
          <button 
            v-for="tab in metricTabs" 
            :key="tab.id"
            class="metric-tab"
            :class="{ active: activeMetric === tab.id }"
            @click="onMetricChange(tab.id)"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
    </div>
    
    <div class="usage-chart-panel">
      <div class="panel-header">
        <h3><i class="fas fa-chart-line"></i> 使用量统计</h3>
        <button class="btn btn-sm btn-outline" @click="refreshUsageData">
          <i class="fas fa-sync-alt"></i> 刷新
        </button>
      </div>
      <div class="chart-content">
        <canvas ref="usageChartCanvas"></canvas>
        <div v-if="usageChartData.length === 0" class="chart-empty-state">
          <i class="fas fa-chart-area"></i>
          <span>暂无使用数据，请等待请求产生后自动显示</span>
        </div>
      </div>
      <div class="chart-legend">
        <span v-if="selectedProvider === 'all'">总请求量</span>
        <span v-else>{{ selectedProvider }} 请求量</span>
        <span class="legend-value">{{ formatNumber(currentSeriesTotal) }}</span>
      </div>
    </div>

    <div class="model-control-panel">
      <div class="panel-header">
        <h3><i class="fas fa-cube"></i> 模型控制</h3>
        <div class="model-control-actions">
          <span v-if="currentModel" class="current-model-badge">
            <i class="fas fa-play-circle"></i> 当前: {{ currentModel }}
          </span>
          <button class="btn btn-sm btn-outline" @click="loadAvailableModels">
            <i class="fas fa-sync-alt"></i> 刷新模型
          </button>
        </div>
      </div>
      <div class="model-selector-row">
        <div class="model-dropdown">
          <select v-model="selectedModel" :disabled="isSwitching">
            <option value="">选择模型</option>
            <option v-for="model in availableModelsList" :key="model" :value="model" :disabled="model === currentModel">
              {{ model }}{{ model === currentModel ? ' (运行中)' : '' }}
            </option>
          </select>
          <button 
            class="btn btn-primary btn-sm" 
            @click="switchModel" 
            :disabled="!selectedModel || selectedModel === currentModel || isSwitching"
          >
            <i v-if="isSwitching" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-exchange-alt"></i>
            {{ isSwitching ? '切换中...' : '切换模型' }}
          </button>
          <button 
            v-if="currentModel"
            class="btn btn-danger btn-sm" 
            @click="stopCurrentModel" 
            :disabled="isSwitching"
          >
            <i v-if="isSwitching" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-stop"></i>
            停止当前
          </button>
        </div>
      </div>
    </div>
    
    <!-- Provider Pool Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">
          <i class="fas fa-server"></i>
        </div>
        <div class="stat-info">
          <h3>{{ stats.activeConnections }}</h3>
          <p>活动连接</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">
          <i class="fas fa-network-wired"></i>
        </div>
        <div class="stat-info">
          <h3>{{ stats.activeProviders }}</h3>
          <p>活跃提供商</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="stat-info">
          <h3>{{ stats.healthyProviders }}</h3>
          <p>健康提供商</p>
        </div>
      </div>
    </div>

    <!-- Provider Search Bar -->
    <div class="search-bar">
      <div class="search-input-wrapper">
        <i class="fas fa-search"></i>
        <input 
          type="text" 
          v-model="searchQuery"
          placeholder="搜索提供商名称或节点内容..."
        >
      </div>
    </div>

    <div class="header-actions">
      <button class="btn btn-primary" @click="openAddModal">
        <i class="fas fa-plus"></i> 添加提供商
      </button>
    </div>
    
    <div class="providers-container">
      <div class="providers-list">
        <div 
          v-for="provider in filteredProviders" 
          :key="provider.type"
          class="provider-group"
        >
          <div class="provider-group-header">
            <div class="provider-type-info">
              <i :class="['fas', getProviderIcon(provider.type)]"></i>
              <span class="provider-type-name">{{ getProviderTypeName(provider.type) }}</span>
              <span class="provider-count">({{ provider.nodes.length }} 节点)</span>
            </div>
            <div class="provider-group-actions">
              <button class="btn btn-sm btn-outline" @click="addNode(provider.type)">
                <i class="fas fa-plus"></i> 添加节点
              </button>
            </div>
          </div>
          
          <div class="provider-nodes">
            <div 
              v-for="node in provider.nodes" 
              :key="node.uuid"
              class="provider-node-card"
              :class="{ unhealthy: !node.healthy }"
            >
              <div class="node-header">
                <div class="node-name">
                  <span class="status-indicator" :class="{ healthy: node.healthy }"></span>
                  <span>{{ node.name }}</span>
                  <span v-if="node.disabled" class="disabled-badge">已禁用</span>
                </div>
                <div class="node-actions">
                  <button 
                    v-if="needsOAuth(provider.type)"
                    class="action-btn oauth-btn" 
                    @click="generateOAuth(provider.type, node)" 
                    title="生成OAuth授权"
                  >
                    <i class="fas fa-key"></i>
                  </button>
                  <button 
                    class="action-btn health-btn" 
                    @click="checkHealth(provider.type, node.uuid)" 
                    title="健康检查"
                  >
                    <i class="fas fa-heartbeat"></i>
                  </button>
                  <button class="action-btn" @click="editNode(provider.type, node)" title="编辑">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="action-btn" @click="deleteNode(provider.type, node.uuid)" title="删除">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              
              <div class="node-info">
                <div class="info-row">
                  <span class="info-label">UUID</span>
                  <span class="info-value">{{ node.uuid }}</span>
                </div>
                <div class="info-row" v-if="node.oauthCredsFilePath">
                  <span class="info-label">凭据路径</span>
                  <span class="info-value">{{ node.oauthCredsFilePath }}</span>
                </div>
                <div class="info-row" v-if="node.apiKey">
                  <span class="info-label">API Key</span>
                  <span class="info-value masked">{{ maskApiKey(node.apiKey) }}</span>
                </div>
                <div class="info-row" v-if="node.email">
                  <span class="info-label">邮箱</span>
                  <span class="info-value">{{ node.email }}</span>
                </div>
                <div class="info-row" v-if="node.accessToken">
                  <span class="info-label">Token</span>
                  <span class="info-value masked">{{ maskToken(node.accessToken) }}</span>
                </div>
                <div class="info-row" v-if="node.checkModel">
                  <span class="info-label">检查模型</span>
                  <span class="info-value">{{ node.checkModel }}</span>
                </div>
                <div class="info-row" v-if="node.requestCount !== undefined">
                  <span class="info-label">请求次数</span>
                  <span class="info-value">{{ node.requestCount }}</span>
                </div>
              </div>
              
              <div class="node-status">
                <span class="status-text" :class="node.healthy ? 'success' : 'danger'">
                  {{ node.healthy ? '健康' : '不健康' }}
                </span>
                <span class="last-update">更新于 {{ formatTime(node.lastUpdate) }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="filteredProviders.length === 0" class="empty-state">
          <i class="fas fa-server"></i>
          <span>暂无提供商配置</span>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ isEditing ? '编辑提供商节点' : '添加提供商节点' }}</h3>
          <button class="modal-close" @click="closeModal">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <form @submit.prevent="saveNode" class="modal-form">
          <div class="form-group">
            <label>提供商类型</label>
            <select v-model="formData.providerType" class="form-control">
              <option v-for="p in providerTypes" :key="p.value" :value="p.value">
                {{ p.label }}
              </option>
            </select>
          </div>
          
          <div class="form-group">
            <label>节点名称</label>
            <input type="text" v-model="formData.name" class="form-control" placeholder="输入节点名称">
          </div>
          
          <div class="form-group">
            <label>UUID</label>
            <input type="text" v-model="formData.uuid" class="form-control" placeholder="自动生成或手动输入">
          </div>
          
          <div class="form-group" v-if="needsApiKey(formData.providerType)">
            <label>API Key</label>
            <input type="password" v-model="formData.apiKey" class="form-control" placeholder="输入API密钥">
          </div>
          
          <div class="form-group" v-if="needsEmail(formData.providerType)">
            <label>邮箱</label>
            <input type="email" v-model="formData.email" class="form-control" placeholder="输入邮箱">
          </div>
          
          <div class="form-group" v-if="needsAccessToken(formData.providerType)">
            <label>Access Token</label>
            <input type="password" v-model="formData.accessToken" class="form-control" placeholder="输入访问令牌">
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="closeModal">取消</button>
            <button type="submit" class="btn btn-primary">保存</button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useProviders } from '@/composables/useProviders.js'
import ProviderNode from '@/components/ProviderNode.vue'
import { logger } from '@/utils/logger.js'
import { apiClient } from '@/utils/api.js'
import { Chart, registerables } from 'chart.js'
import { API_PATHS, formatPath } from '@/utils/api-paths.js'

Chart.register(...registerables)

const showModal = ref(false)
const isEditing = ref(false)
const selectedProvider = ref('all')
const activeTimeRange = ref('hour')
const activeMetric = ref('requests')
const usageChartCanvas = ref(null)
const providerList = ref([])
const usageChartData = ref([])
const usageChartLabels = ref([])
const availableModelsList = ref([])
const selectedModel = ref('')
const currentModel = ref(null)
const isSwitching = ref(false)

let usageChartInstance = null
let usagePollingInterval = null

const {
  providers,
  searchQuery,
  stats,
  providerTypes,
  filteredProviders,
  getProviderIcon,
  getProviderTypeName,
  fetchProviders,
  addProvider,
  updateProvider,
  deleteProvider,
  performHealthCheck
} = useProviders()

const timeRangeTabs = [
  { id: 'hour', label: '最近一小时' },
  { id: 'day', label: '最近一天' },
  { id: 'week', label: '最近一周' }
]

const metricTabs = [
  { id: 'requests', label: '请求次数' },
  { id: 'tokens', label: 'Token 用量' }
]

const formData = reactive({
  providerType: 'gemini-cli-oauth',
  name: '',
  uuid: '',
  apiKey: '',
  email: '',
  accessToken: ''
})

const formatNumber = (num) => {
  if (!num) return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

const currentSeriesTotal = ref(0)

const onProviderChange = async () => {
  await fetchUsageData()
}

const onTimeRangeChange = async (range) => {
  activeTimeRange.value = range
  await fetchUsageData()
}

const onMetricChange = async (metric) => {
  activeMetric.value = metric
  updateChart()
}

const fetchUsageData = async () => {
  try {
    const response = await apiClient.get(
      `/api/model-usage-stats/provider-time-series?range=${activeTimeRange.value}${selectedProvider.value !== 'all' ? `&provider=${selectedProvider.value}` : ''}`
    )
    
    if (response.data.success) {
      const data = response.data.data
      usageChartData.value = []
      usageChartLabels.value = []
      
      let total = 0
      for (const point of data.dataPoints || []) {
        usageChartLabels.value.push(formatTimeKey(point.key, activeTimeRange.value))
        
        let value = 0
        if (activeMetric.value === 'requests') {
          value = point.totalRequests || 0
        } else {
          value = point.totalTokens || 0
        }
        usageChartData.value.push(value)
        total += value
      }
      
      currentSeriesTotal.value = total
      updateChart()
    }
  } catch (error) {
    logger.error('Failed to fetch usage data', error)
  }
}

const refreshUsageData = async () => {
  await fetchUsageData()
}

const formatTimeKey = (key, range) => {
  if (range === 'hour') {
    const time = new Date(key)
    return `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`
  } else if (range === 'day') {
    const time = new Date(key)
    return `${time.getHours().toString().padStart(2, '0')}:00`
  } else {
    const time = new Date(key)
    return `${time.getMonth() + 1}/${time.getDate()}`
  }
}

const updateChart = () => {
  if (!usageChartInstance || usageChartLabels.value.length === 0) return
  
  const ctx = usageChartCanvas.value?.getContext('2d')
  if (!ctx) return
  
  const color = selectedProvider.value === 'all' 
    ? { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' }
    : { border: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' }
  
  usageChartInstance.data.labels = usageChartLabels.value
  usageChartInstance.data.datasets = [{
    label: activeMetric.value === 'requests' ? '请求次数' : 'Token 用量',
    data: usageChartData.value,
    borderColor: color.border,
    backgroundColor: color.bg,
    fill: true,
    tension: 0.4,
    pointRadius: 0,
    borderWidth: 2
  }]
  
  usageChartInstance.update('none')
}

const initUsageChart = () => {
  if (!usageChartCanvas.value) return
  
  const ctx = usageChartCanvas.value.getContext('2d')
  
  if (usageChartInstance) {
    usageChartInstance.destroy()
  }
  
  usageChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: []
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 8,
          cornerRadius: 5,
          titleFont: { size: 11 },
          bodyFont: { size: 10 }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: {
            color: '#94a3b8',
            maxTicksLimit: 8,
            font: { size: 9 }
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: {
            color: '#94a3b8',
            font: { size: 9 },
            callback: (value) => formatNumber(value)
          }
        }
      },
      animation: { duration: 300 }
    }
  })
}

const loadAvailableModels = async () => {
  try {
    const response = await apiClient.get(API_PATHS.PYTHON.MODELS.STATUS)
    if (response.data.success && response.data.models) {
      const modelsData = response.data.models
      let modelsArray = []
      
      if (Array.isArray(modelsData)) {
        modelsArray = modelsData.map(m => m.name || m)
      } else if (typeof modelsData === 'object' && modelsData !== null) {
        modelsArray = Object.keys(modelsData)
      }
      
      availableModelsList.value = modelsArray
      
      if (response.data.current_model) {
        currentModel.value = response.data.current_model
      } else {
        const runningModel = Object.entries(response.data.models).find(([_, info]) => info.running)
        if (runningModel) {
          currentModel.value = runningModel[0]
        } else {
          currentModel.value = null
        }
      }
    }
  } catch (error) {
    logger.error('Failed to load available models', error)
  }
}

const switchModel = async () => {
  if (!selectedModel.value || selectedModel.value === currentModel.value) {
    return
  }
  
  isSwitching.value = true
  try {
    const response = await apiClient.post(
      formatPath(API_PATHS.PYTHON.MODELS.SWITCH, { modelName: selectedModel.value })
    )
    
    if (response.data.success) {
      window.$toast?.success(`模型切换成功: ${selectedModel.value}`)
      currentModel.value = selectedModel.value
      selectedModel.value = ''
      await loadAvailableModels()
    } else {
      window.$toast?.error(response.data.error?.message || '模型切换失败')
    }
  } catch (error) {
    logger.error('Model switch failed', error)
    window.$toast?.error('模型切换失败: ' + error.message)
  } finally {
    isSwitching.value = false
  }
}

const stopCurrentModel = async () => {
  if (!currentModel.value) return
  
  isSwitching.value = true
  try {
    const response = await apiClient.post(
      formatPath(API_PATHS.PYTHON.MODELS.STOP, { modelName: currentModel.value })
    )
    
    if (response.data.success) {
      window.$toast?.success(`模型已停止: ${currentModel.value}`)
      currentModel.value = null
      await loadAvailableModels()
    } else {
      window.$toast?.error(response.data.error?.message || '停止模型失败')
    }
  } catch (error) {
    logger.error('Model stop failed', error)
    window.$toast?.error('停止模型失败: ' + error.message)
  } finally {
    isSwitching.value = false
  }
}

const maskApiKey = (key) => {
  if (!key) return ''
  return key.substring(0, 6) + '...' + key.substring(key.length - 4)
}

const maskToken = (token) => {
  if (!token) return ''
  return token.substring(0, 10) + '...'
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}

const needsApiKey = (type) => {
  return ['openai-custom', 'claude-custom', 'grok-custom'].includes(type)
}

const needsEmail = (type) => {
  return ['gemini-cli-oauth', 'gemini-antigravity', 'claude-kiro-oauth'].includes(type)
}

const needsAccessToken = (type) => {
  return ['gemini-cli-oauth', 'gemini-antigravity', 'claude-kiro-oauth'].includes(type)
}

const needsOAuth = (type) => {
  return [
    'gemini-cli-oauth', 
    'gemini-antigravity', 
    'claude-kiro-oauth',
    'openai-qwen-oauth',
    'openai-codex-oauth',
    'openai-iflow'
  ].includes(type)
}

const generateOAuth = async (providerType, node) => {
  try {
    const response = await apiClient.post(`/api/providers/${providerType}/${node.uuid}/oauth`);
    if (response.data.url) {
      window.open(response.data.url, '_blank');
      window.$toast?.success('已打开 OAuth 授权页面，请完成登录授权');
    }
  } catch (error) {
    window.$toast?.error('生成 OAuth 授权失败: ' + error.message);
    logger.error('OAuth generation failed', error);
  }
}

const openAddModal = () => {
  isEditing.value = false
  formData.providerType = 'openai-custom'
  formData.name = ''
  formData.uuid = ''
  formData.apiKey = ''
  formData.email = ''
  formData.accessToken = ''
  showModal.value = true
}

const editNode = (providerType, node) => {
  isEditing.value = true
  formData.providerType = providerType
  formData.name = node.name
  formData.uuid = node.uuid
  formData.apiKey = node.apiKey || ''
  formData.email = node.email || ''
  formData.accessToken = node.accessToken || ''
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const saveNode = async () => {
  if (!formData.name) {
    window.$toast?.error('请输入节点名称')
    return
  }
  
  const data = {
    providerType: formData.providerType,
    name: formData.name,
    uuid: formData.uuid,
    apiKey: formData.apiKey,
    email: formData.email,
    accessToken: formData.accessToken
  }
  
  try {
    if (isEditing.value) {
      await updateProvider(formData.providerType, formData.uuid, data)
    } else {
      await addProvider(data)
    }
    closeModal()
  } catch (error) {
    logger.error('Failed to save node', error)
  }
}

const deleteNode = async (providerType, uuid) => {
  try {
    await deleteProvider(providerType, uuid)
  } catch (error) {
    logger.error('Failed to delete node', error)
  }
}

const checkHealth = async (providerType, uuid) => {
  try {
    await performHealthCheck(providerType, uuid)
  } catch (error) {
    logger.error('Health check failed', error)
  }
}

const addNode = (providerType) => {
  formData.providerType = providerType
  isEditing.value = false
  formData.name = ''
  formData.uuid = ''
  formData.apiKey = ''
  formData.email = ''
  formData.accessToken = ''
  showModal.value = true
}

onMounted(async () => {
  await fetchProviders()
  providerList.value = Object.keys(providers.value || {})
  
  await nextTick()
  initUsageChart()
  await Promise.all([
    fetchUsageData(),
    loadAvailableModels()
  ])
  
  usagePollingInterval = setInterval(() => {
    fetchUsageData()
  }, 30000)
})

onUnmounted(() => {
  if (usagePollingInterval) {
    clearInterval(usagePollingInterval)
    usagePollingInterval = null
  }
  if (usageChartInstance) {
    usageChartInstance.destroy()
    usageChartInstance = null
  }
})

watch(() => providers.value, (newProviders) => {
  providerList.value = Object.keys(newProviders || {})
}, { deep: true })
</script>

<style scoped>
.section {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.provider-controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  align-items: flex-end;
}

.provider-selector {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.provider-selector label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.provider-selector select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-width: 180px;
}

.chart-controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.time-range-tabs,
.chart-metric-tabs {
  display: flex;
  gap: 2px;
  background: var(--bg-secondary);
  padding: 2px;
  border-radius: var(--radius-md);
}

.time-range-tab,
.metric-tab {
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-tertiary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.time-range-tab:hover,
.metric-tab:hover {
  color: var(--primary-color);
}

.time-range-tab.active,
.metric-tab.active {
  background: var(--primary-color);
  color: white;
}

.usage-chart-panel {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  margin-bottom: 1.5rem;
  overflow: hidden;
}

.usage-chart-panel .panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.usage-chart-panel .panel-header h3 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.usage-chart-panel .panel-header h3 i {
  color: var(--primary-color);
}

.chart-content {
  position: relative;
  height: 280px;
  padding: 1rem;
}

.chart-content canvas {
  width: 100% !important;
  height: 100% !important;
}

.chart-empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-tertiary);
}

.chart-empty-state i {
  font-size: 3rem;
  opacity: 0.3;
}

.chart-empty-state span {
  font-size: 0.875rem;
}

.chart-legend {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.legend-value {
  font-weight: 600;
  color: var(--primary-color);
  font-size: 0.875rem;
}

.model-control-panel {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  margin-bottom: 1.5rem;
  overflow: hidden;
}

.model-control-panel .panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.model-control-panel .panel-header h3 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.model-control-panel .panel-header h3 i {
  color: var(--primary-color);
}

.model-control-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.current-model-badge {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  color: var(--success-color);
  font-weight: 500;
}

.model-control-actions .btn-outline {
  background: transparent;
  color: var(--text-secondary);
}

.model-control-actions .btn-outline:hover {
  background: var(--bg-tertiary);
}

.model-selector-row {
  padding: 1rem;
}

.model-dropdown {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.model-dropdown select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-width: 220px;
}

.model-dropdown select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  background: var(--danger-color);
  color: white;
  border-color: var(--danger-color);
}

.btn-danger:hover {
  background: var(--danger-hover);
  border-color: var(--danger-hover);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pool-description {
  margin-bottom: 1rem;
}

.highlight-note {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--info-bg-light);
  border-radius: var(--radius-md);
  color: var(--info-text);
  font-size: 0.875rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--primary-10);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
  font-size: 1.25rem;
}

.stat-info h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.stat-info p {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  margin: 0.25rem 0 0;
}

.search-bar {
  margin-bottom: 1rem;
}

.search-input-wrapper {
  position: relative;
}

.search-input-wrapper i {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
}

.search-input-wrapper input {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.providers-container {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.providers-list {
  padding: 0.5rem;
}

.provider-group {
  margin-bottom: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.provider-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
}

.provider-type-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.provider-type-info i {
  color: var(--primary-color);
}

.provider-type-name {
  font-weight: 600;
  color: var(--text-primary);
}

.provider-count {
  color: var(--text-tertiary);
  font-size: 0.8rem;
}

.provider-group-actions {
  display: flex;
  gap: 0.5rem;
}

.provider-nodes {
  padding: 0.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 0.5rem;
}

.provider-node-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.75rem;
}

.provider-node-card.unhealthy {
  border-color: var(--danger-border);
  background: var(--danger-bg-light);
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.node-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.disabled-badge {
  font-size: 0.65rem;
  padding: 0.125rem 0.375rem;
  background: var(--warning-bg);
  color: var(--warning-text);
  border-radius: var(--radius-full);
  font-weight: 500;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--danger-color);
}

.status-indicator.healthy {
  background: var(--success-color);
}

.node-name span:last-child {
  font-weight: 500;
  color: var(--text-primary);
}

.node-actions {
  display: flex;
  gap: 0.25rem;
}

.action-btn {
  padding: 0.25rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: var(--transition);
}

.action-btn:hover {
  background: var(--bg-tertiary);
  color: var(--primary-color);
}

.action-btn.oauth-btn:hover {
  background: var(--primary-10);
  color: var(--primary-color);
}

.action-btn.health-btn:hover {
  background: var(--success-10);
  color: var(--success-color);
}

.node-info {
  margin-bottom: 0.75rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
  font-size: 0.8rem;
}

.info-label {
  color: var(--text-tertiary);
}

.info-value {
  color: var(--text-primary);
  font-family: monospace;
}

.info-value.masked {
  font-family: inherit;
}

.node-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-color);
}

.status-text {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-full);
}

.status-text.success {
  background: var(--success-bg);
  color: var(--success-text);
}

.status-text.danger {
  background: var(--danger-bg);
  color: var(--danger-text);
}

.last-update {
  font-size: 0.7rem;
  color: var(--text-tertiary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: var(--text-tertiary);
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.modal-content {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.2s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  color: var(--text-primary);
}

.modal-close {
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 0.25rem;
}

.modal-form {
  padding: 1.25rem;
}

.modal-form .form-group {
  margin-bottom: 1rem;
}

.modal-form .form-group label {
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.modal-form .form-control {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.modal-form .form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.btn {
  padding: 0.5rem 1.25rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border-color);
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.btn-secondary:hover {
  background: var(--bg-tertiary);
}

.btn-outline {
  background: transparent;
  color: var(--text-secondary);
}

.btn-outline:hover {
  background: var(--bg-tertiary);
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .provider-nodes {
    grid-template-columns: 1fr;
  }
  
  .provider-group-header {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
}
</style>