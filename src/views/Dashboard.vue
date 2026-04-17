<template>
  <div class="dashboard">
    <div class="stats-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div 
        class="stat-card bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
        :key="'uptime-' + componentKey.uptime"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-slate-500 mb-1">运行时间</p>
            <h3 class="text-2xl font-bold text-slate-800">{{ systemInfo.uptime || '--' }}</h3>
          </div>
          <div class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <i class="fas fa-clock text-emerald-600 text-xl"></i>
          </div>
        </div>
      </div>
      
      <div 
        class="stat-card bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
        :key="'cpu-' + componentKey.cpu"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-slate-500 mb-1">CPU 使用</p>
            <h3 class="text-2xl font-bold" :class="getCpuColor(systemInfo.cpu)">
              {{ systemInfo.cpu }}%
            </h3>
          </div>
          <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <i class="fas fa-microchip text-blue-600 text-xl"></i>
          </div>
        </div>
        <div class="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div 
            class="h-full rounded-full transition-all duration-500"
            :class="getCpuBarColor(systemInfo.cpu)"
            :style="{ width: systemInfo.cpu + '%' }"
          ></div>
        </div>
      </div>
      
      <div 
        class="stat-card bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
        :key="'memory-' + componentKey.memory"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-slate-500 mb-1">内存使用</p>
            <h3 class="text-2xl font-bold" :class="getMemoryColor(systemInfo.memory)">
              {{ systemInfo.memory }}%
            </h3>
          </div>
          <div class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <i class="fas fa-memory text-purple-600 text-xl"></i>
          </div>
        </div>
        <div class="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div 
            class="h-full rounded-full transition-all duration-500"
            :class="getMemoryBarColor(systemInfo.memory)"
            :style="{ width: systemInfo.memory + '%' }"
          ></div>
        </div>
      </div>
      
      <div 
        class="stat-card bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
        :key="'gpu-' + componentKey.gpu"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-slate-500 mb-1">GPU 使用</p>
            <h3 class="text-2xl font-bold" :class="getGpuColor(systemInfo.gpu)">
              {{ systemInfo.gpu }}%
            </h3>
          </div>
          <div class="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <i class="fas fa-video-card text-orange-600 text-xl"></i>
          </div>
        </div>
        <div class="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div 
            class="h-full rounded-full transition-all duration-500"
            :class="getGpuBarColor(systemInfo.gpu)"
            :style="{ width: systemInfo.gpu + '%' }"
          ></div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-slate-800">系统资源监控</h3>
          <div class="flex gap-2">
            <button 
              v-for="tab in chartTabs" 
              :key="tab.id"
              class="px-3 py-1.5 text-sm rounded-lg transition-colors"
              :class="[
                activeChartTab === tab.id 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              ]"
              @click="activeChartTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>
        <div class="h-64 flex items-center justify-center bg-slate-50 rounded-lg">
          <div class="text-center">
            <div class="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i class="fas fa-chart-line text-emerald-500 text-2xl"></i>
            </div>
            <p class="text-slate-500">资源使用图表</p>
            <p class="text-sm text-slate-400">CPU、内存、GPU 实时监控</p>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div 
          class="bg-white rounded-xl shadow-sm border border-slate-100 p-6"
          :key="'system-info-' + componentKey.systemInfo"
        >
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-slate-800">系统信息</h3>
            <button 
              class="px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1"
              @click="refreshSystemInfo"
            >
              <i class="fas fa-refresh"></i> 刷新
            </button>
          </div>
          <div class="space-y-3">
            <div class="flex justify-between items-center py-2 border-b border-slate-100">
              <span class="text-slate-500">版本号</span>
              <span class="font-medium text-slate-800">{{ systemInfo.version || '--' }}</span>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-slate-100">
              <span class="text-slate-500">Node.js</span>
              <span class="font-medium text-slate-800">{{ systemInfo.nodeVersion || '--' }}</span>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-slate-100">
              <span class="text-slate-500">服务器时间</span>
              <span class="font-medium text-slate-800">{{ systemInfo.serverTime || '--' }}</span>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-slate-100">
              <span class="text-slate-500">操作系统</span>
              <span class="font-medium text-slate-800">{{ systemInfo.platform || '--' }}</span>
            </div>
            <div class="flex justify-between items-center py-2">
              <span class="text-slate-500">运行模式</span>
              <span class="font-medium" :class="systemInfo.mode === 'production' ? 'text-emerald-600' : 'text-blue-600'">
                {{ systemInfo.mode || '--' }}
              </span>
            </div>
          </div>
        </div>

        <div 
          class="bg-white rounded-xl shadow-sm border border-slate-100 p-6"
          :key="'provider-status-' + componentKey.providerStatus"
        >
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-slate-800">提供商节点状态</h3>
            <button 
              class="px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1"
              @click="refreshProviderStatus"
            >
              <i class="fas fa-refresh"></i> 刷新
            </button>
          </div>
          <div v-if="providerStatus.length > 0" class="grid grid-cols-2 gap-3">
            <div 
              v-for="provider in providerStatus" 
              :key="provider.name"
              class="p-3 rounded-lg border transition-all"
              :class="[
                provider.status === 'healthy' ? 'bg-emerald-50 border-emerald-200' :
                provider.status === 'warning' ? 'bg-amber-50 border-amber-200' :
                'bg-red-50 border-red-200'
              ]"
            >
              <div class="flex items-center gap-2 mb-1">
                <span 
                  class="w-2 h-2 rounded-full"
                  :class="[
                    provider.status === 'healthy' ? 'bg-emerald-500' :
                    provider.status === 'warning' ? 'bg-amber-500' :
                    'bg-red-500'
                  ]"
                ></span>
                <span class="text-sm font-medium text-slate-800">{{ provider.name }}</span>
              </div>
              <p class="text-xs text-slate-500">{{ provider.accounts }} 账户</p>
            </div>
          </div>
          <div v-else class="text-center py-8 text-slate-400">
            <i class="fas fa-inbox text-4xl mb-2 opacity-50"></i>
            <p>暂无提供商数据</p>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-6 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <details class="w-full">
        <summary class="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors">
          <div class="flex items-center gap-3">
            <i class="fas fa-tools text-emerald-500"></i>
            <span class="font-medium text-slate-800">高级信息</span>
            <span class="text-sm text-slate-400">(路径路由与模型列表)</span>
          </div>
          <i class="fas fa-chevron-down text-slate-400 transition-transform"></i>
        </summary>
        <div class="p-4 border-t border-slate-100">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 class="text-sm font-semibold text-slate-700 mb-3">路径路由调用示例</h4>
              <div class="space-y-2">
                <div class="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 font-mono">
                  /api/v1/chat/completions
                </div>
                <div class="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 font-mono">
                  /gemini-cli-oauth/v1/chat/completions
                </div>
                <div class="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 font-mono">
                  /claude-custom/v1/chat/completions
                </div>
              </div>
            </div>
            <div>
              <h4 class="text-sm font-semibold text-slate-700 mb-3">可用模型列表</h4>
              <div v-if="availableModels.length > 0" class="flex flex-wrap gap-2">
                <span 
                  v-for="model in availableModels" 
                  :key="model"
                  class="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full hover:bg-emerald-100 hover:text-emerald-700 cursor-pointer transition-colors"
                  @click="copyModelName(model)"
                >
                  {{ model }}
                </span>
              </div>
              <div v-else class="text-center py-4 text-slate-400">
                <p>暂无可用模型</p>
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
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
  mode: 'development'
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

const getCpuColor = (value) => {
  if (value >= 80) return 'text-red-500'
  if (value >= 60) return 'text-amber-500'
  return 'text-slate-800'
}

const getCpuBarColor = (value) => {
  if (value >= 80) return 'bg-red-500'
  if (value >= 60) return 'bg-amber-500'
  return 'bg-emerald-500'
}

const getMemoryColor = (value) => {
  if (value >= 85) return 'text-red-500'
  if (value >= 70) return 'text-amber-500'
  return 'text-slate-800'
}

const getMemoryBarColor = (value) => {
  if (value >= 85) return 'bg-red-500'
  if (value >= 70) return 'bg-amber-500'
  return 'bg-purple-500'
}

const getGpuColor = (value) => {
  if (value >= 90) return 'text-red-500'
  if (value >= 75) return 'text-amber-500'
  return 'text-slate-800'
}

const getGpuBarColor = (value) => {
  if (value >= 90) return 'bg-red-500'
  if (value >= 75) return 'bg-amber-500'
  return 'bg-orange-500'
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
      mode: process.env.NODE_ENV === 'production' ? 'production' : 'development'
    }
    
    componentKey.value.systemInfo++
    componentKey.value.uptime++
  } catch (error) {
    console.error('Failed to fetch system info:', error)
    if (error.response?.status === 401) {
      window.location.href = '/login.html'
    }
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
      gpu: 0
    }
    
    componentKey.value.cpu++
    componentKey.value.memory++
    componentKey.value.gpu++
  } catch (error) {
    console.error('Failed to fetch system monitor:', error)
    if (error.response?.status === 401) {
      window.location.href = '/login.html'
    }
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
          accounts: items.length
        })
      }
    }
    
    providerStatus.value = providers
    componentKey.value.providerStatus++
  } catch (error) {
    console.error('Failed to fetch provider status:', error)
    if (error.response?.status === 401) {
      window.location.href = '/login.html'
    }
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
    if (error.response?.status === 401) {
      window.location.href = '/login.html'
    }
  }
}

const refreshSystemInfo = async () => {
  await fetchSystemInfo()
  await fetchSystemMonitor()
}

const refreshProviderStatus = async () => {
  await fetchProviderStatus()
  await fetchModels()
}

const copyModelName = (model) => {
  navigator.clipboard.writeText(model)
  alert(`已复制: ${model}`)
}

onMounted(async () => {
  await fetchSystemInfo()
  await fetchSystemMonitor()
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

.stat-card {
  animation: slideUp 0.3s ease backwards;
}

.stat-card:nth-child(1) { animation-delay: 0.1s; }
.stat-card:nth-child(2) { animation-delay: 0.15s; }
.stat-card:nth-child(3) { animation-delay: 0.2s; }
.stat-card:nth-child(4) { animation-delay: 0.25s; }

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

details summary::-webkit-details-marker {
  display: none;
}
</style>