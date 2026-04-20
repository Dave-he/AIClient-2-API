<template>
  <section id="gpu-monitor" class="section" aria-labelledby="gpu-monitor-title">
    <h2 id="gpu-monitor-title">GPU监控面板</h2>
    
    <div class="gpu-monitor-container">
      <!-- GPU Status Panel -->
      <div class="gpu-status-panel">
        <div class="panel-header">
          <h3><i class="fas fa-microchip"></i> GPU状态</h3>
          <button class="btn btn-outline btn-sm" @click="refreshGpuStatus" title="刷新">
            <i class="fas fa-sync-alt"></i> 刷新
          </button>
        </div>
        
        <div class="gpu-status-content">
          <div v-if="loading" class="status-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>加载中...</span>
          </div>
          <div v-else-if="!gpuStatus || gpuStatus.status === 'unavailable'" class="gpu-unavailable">
            <i class="fas fa-exclamation-circle"></i>
            <span>{{ gpuStatus?.message || '未检测到GPU' }}</span>
          </div>
          <div v-else class="gpu-card">
            <div class="gpu-header">
              <div class="gpu-name">
                <i class="fas fa-video-card"></i>
                <span>{{ gpuStatus.name }}</span>
              </div>
              <span class="gpu-status-badge" :class="gpuStatus.status === 'available' ? 'active' : 'idle'">
                <span class="status-indicator"></span>
                {{ gpuStatus.status === 'available' ? '运行中' : '空闲' }}
              </span>
            </div>
            <div class="gpu-metrics-grid">
              <div class="metric-card compact">
                <div class="metric-icon small" id="memoryIcon">
                  <i class="fas fa-memory"></i>
                </div>
                <div class="metric-info">
                  <div class="metric-label">显存</div>
                  <div class="metric-value">{{ (gpuStatus.used_memory / (1024 ** 3)).toFixed(1) }} / {{ (gpuStatus.total_memory / (1024 ** 3)).toFixed(1) }} GB</div>
                  <div class="metric-bar-container">
                    <div class="metric-bar-bg">
                      <div class="metric-bar-fill memory" :style="{ width: (gpuStatus.memory_utilization || 0) + '%' }"></div>
                    </div>
                    <span class="metric-percent">{{ gpuStatus.memory_utilization || 0 }}%</span>
                  </div>
                </div>
              </div>
              <div class="metric-card compact">
                <div class="metric-icon small" id="utilIcon">
                  <i class="fas fa-chart-line"></i>
                </div>
                <div class="metric-info">
                  <div class="metric-label">使用率</div>
                  <div class="metric-value">{{ gpuStatus.utilization || 0 }}%</div>
                </div>
              </div>
              <div class="metric-card compact">
                <div class="metric-icon small" id="tempIcon">
                  <i class="fas fa-thermometer-half"></i>
                </div>
                <div class="metric-info">
                  <div class="metric-label">温度</div>
                  <div class="metric-value" :class="{ warning: (gpuStatus.temperature || 0) > 80 }">{{ gpuStatus.temperature || 0 }}°C</div>
                </div>
              </div>
              <div class="metric-card compact">
                <div class="metric-icon small" id="powerIcon">
                  <i class="fas fa-bolt"></i>
                </div>
                <div class="metric-info">
                  <div class="metric-label">功耗</div>
                  <div class="metric-value">{{ gpuStatus.power_draw || 0 }}W</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- GPU Charts Panel -->
      <div class="gpu-charts-panel">
        <div class="panel-header">
          <h3><i class="fas fa-chart-line"></i> 历史监控</h3>
          <div class="chart-tabs">
            <button 
              v-for="tab in chartTabs" 
              :key="tab.type"
              class="chart-tab"
              :class="{ active: currentChartType === tab.type }"
              @click="switchChartType(tab.type)"
            >{{ tab.label }}</button>
          </div>
        </div>
        
        <div class="gpu-chart-content">
          <canvas ref="chartCanvas"></canvas>
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
      
      <!-- Current Model Panel -->
      <div class="current-model-panel">
        <div class="panel-header">
          <h3><i class="fas fa-check-circle"></i> 当前运行模型</h3>
        </div>
        
        <div class="current-model-content">
          <div v-if="!currentModel" class="empty-state">
            <i class="fas fa-cube"></i>
            <span>暂无运行中的模型</span>
          </div>
          <div v-else class="current-model-card">
            <div class="current-model-icon">
              <i class="fas fa-cube"></i>
            </div>
            <div class="current-model-info">
              <div class="current-model-name">{{ typeof currentModel === 'object' ? currentModel.name : currentModel }}</div>
              <div class="current-model-status">
                <span class="status-badge success">
                  <i class="fas fa-circle"></i> 运行中
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Models Status Panel -->
      <div class="models-status-panel">
        <div class="panel-header">
          <h3><i class="fas fa-cubes"></i> 模型状态</h3>
        </div>
        
        <div class="models-status-content">
          <div v-if="loadingModels" class="status-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>加载中...</span>
          </div>
          <div v-else-if="models.length === 0" class="status-loading">
            <i class="fas fa-cube"></i>
            <span>暂无模型</span>
          </div>
          <div v-else class="model-status-grid">
            <div 
              v-for="model in models" 
              :key="model.name" 
              class="model-status-item"
              :class="{ active: model.name === (typeof currentModel === 'object' ? currentModel.name : currentModel) }"
            >
              <div class="model-info">
                <span class="model-name">{{ model.name }}</span>
                <span v-if="model.requests" class="model-requests">{{ model.requests }} req/s</span>
              </div>
              <div class="model-status">
                <span class="status-indicator" :class="model.status"></span>
                {{ model.status === 'running' ? '运行中' : '已停止' }}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Queue Status Panel -->
      <div class="queue-status-panel">
        <div class="panel-header">
          <h3><i class="fas fa-list-ol"></i> 队列状态</h3>
        </div>
        
        <div class="queue-status-content">
          <div v-if="loadingQueue" class="status-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>加载中...</span>
          </div>
          <div v-else class="queue-info-grid">
            <div class="queue-card">
              <div class="queue-icon"><i class="fas fa-users"></i></div>
              <div class="queue-value">{{ queueStats.activeTasks || 0 }}</div>
              <div class="queue-label">活跃任务</div>
            </div>
            <div class="queue-card">
              <div class="queue-icon"><i class="fas fa-clock"></i></div>
              <div class="queue-value">{{ queueStats.waitingTasks || 0 }}</div>
              <div class="queue-label">等待队列</div>
            </div>
            <div class="queue-card">
              <div class="queue-icon"><i class="fas fa-check-circle"></i></div>
              <div class="queue-value success">{{ queueStats.completedTasks || 0 }}</div>
              <div class="queue-label">已完成</div>
            </div>
            <div class="queue-card">
              <div class="queue-icon"><i class="fas fa-exclamation-triangle"></i></div>
              <div class="queue-value danger">{{ queueStats.failedTasks || 0 }}</div>
              <div class="queue-label">失败</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Control Panel -->
      <div class="control-panel">
        <div class="panel-header">
          <h3><i class="fas fa-play"></i> 模型控制</h3>
        </div>
        
        <div class="model-controls">
          <div v-if="loadingControl" class="status-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>加载中...</span>
          </div>
          <div v-else-if="availableModels.length === 0" class="status-loading">
            <i class="fas fa-hard-drive"></i>
            <span>暂无可用模型</span>
          </div>
          <div v-else class="control-grid">
            <div 
              v-for="model in availableModels" 
              :key="model.name" 
              class="control-item"
            >
              <div class="model-info-wrapper">
                <span class="model-name">{{ model.name }}</span>
                <span v-if="model.requiredMemory" class="model-memory">{{ model.requiredMemory }}GB</span>
              </div>
              <div class="control-btn-group">
                <button 
                  v-if="model.status === 'running'"
                  class="btn btn-danger btn-sm"
                  @click="stopModel(model.name)"
                >
                  <i class="fas fa-stop"></i> 停止
                </button>
                <button 
                  v-else
                  class="btn btn-success btn-sm"
                  @click="switchModel(model.name)"
                >
                  <i class="fas fa-play"></i> 启动
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Quick Model Switch Panel -->
      <div class="model-switch-panel">
        <div class="panel-header">
          <h3><i class="fas fa-exchange-alt"></i> 一键切换模型</h3>
          <button class="btn btn-outline btn-sm" @click="loadAvailableModels" title="刷新模型列表">
            <i class="fas fa-sync-alt"></i>
          </button>
        </div>
        
        <div class="quick-switch-content">
          <div v-if="loadingControl" class="status-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>加载中...</span>
          </div>
          <div v-else-if="availableModels.length === 0" class="status-loading">
            <i class="fas fa-exchange-alt"></i>
            <span>暂无可用模型</span>
          </div>
          <div v-else class="quick-switch-grid">
            <button 
              v-for="model in availableModels" 
              :key="model.name"
              class="quick-switch-btn"
              :class="{ active: model.status === 'running' }"
              @click="switchModel(model.name)"
            >
              <span class="btn-icon"><i class="fas fa-cube"></i></span>
              <span class="btn-text">{{ model.name }}</span>
              <span v-if="model.status === 'running'" class="btn-badge">运行中</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Python Controller Integration Area -->
    <div class="controller-integration">
      <div class="panel-header">
        <h3><i class="fas fa-desktop"></i> AI控制器</h3>
        <div class="controller-status">
          <span 
            :class="['status-badge', controllerConnected ? 'online' : 'offline']"
          >
            <i class="fas fa-circle"></i> {{ controllerConnected ? '已连接' : '未连接' }}
          </span>
        </div>
      </div>
      
      <div class="iframe-container">
        <iframe 
          v-if="controllerConnected"
          id="controllerIframe" 
          :src="controllerUrl" 
          frameborder="0" 
          allowfullscreen
        ></iframe>
        <div v-else class="iframe-placeholder">
          <i class="fas fa-server"></i>
          <p>AI控制器未启动或配置</p>
          <p class="hint">请启动 Python 控制器服务以查看详细监控面板</p>
        </div>
      </div>
    </div>
    
    <!-- Test Report Modal -->
    <Teleport to="body">
      <div v-if="showTestReport && testReport" class="modal-overlay" @click.self="closeTestReport">
        <div class="test-report-modal">
          <div class="modal-header">
            <h3><i class="fas fa-file-report"></i> 模型测试报告</h3>
            <button class="modal-close" @click="closeTestReport">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body">
            <div class="report-header">
              <div class="model-info">
                <span class="model-name">{{ testReport.model_name }}</span>
                <span class="test-time">{{ testReport.test_timestamp }}</span>
              </div>
              <span 
                :class="['status-badge', getStatusClass(testReport.overall_status)]"
              >
                {{ getStatusText(testReport.overall_status) }}
              </span>
            </div>
            
            <div class="report-sections">
              <!-- Feature Support -->
              <div class="report-section">
                <h4><i class="fas fa-check-circle"></i> 功能支持</h4>
                <div class="feature-grid">
                  <div 
                    v-for="(supported, feature) in testReport.feature_support" 
                    :key="feature"
                    :class="['feature-item', supported ? 'supported' : 'not-supported']"
                  >
                    <i :class="supported ? 'fas fa-check' : 'fas fa-times'"></i>
                    <span>{{ getFeatureText(feature) }}</span>
                  </div>
                </div>
              </div>
              
              <!-- Performance Metrics -->
              <div class="report-section">
                <h4><i class="fas fa-chart-line"></i> 性能指标</h4>
                <div class="metrics-grid">
                  <div class="metric-item">
                    <div class="metric-value">{{ testReport.performance_metrics.overall.avg_tps.toFixed(2) }}</div>
                    <div class="metric-label">平均 TPS</div>
                  </div>
                  <div class="metric-item">
                    <div class="metric-value">{{ testReport.performance_metrics.overall.avg_latency.toFixed(3) }}s</div>
                    <div class="metric-label">平均延迟</div>
                  </div>
                  <div class="metric-item">
                    <div class="metric-value">{{ testReport.performance_metrics.overall.pass_rate.toFixed(1) }}%</div>
                    <div class="metric-label">通过率</div>
                  </div>
                </div>
              </div>
              
              <!-- Resource Utilization -->
              <div class="report-section">
                <h4><i class="fas fa-server"></i> 资源使用</h4>
                <div class="resource-grid">
                  <div class="resource-item">
                    <div class="resource-header">CPU</div>
                    <div class="resource-info">
                      <span>平均: {{ testReport.resource_utilization.cpu.avg_percent }}%</span>
                    </div>
                  </div>
                  <div class="resource-item">
                    <div class="resource-header">内存</div>
                    <div class="resource-info">
                      <span>变化: {{ testReport.resource_utilization.memory.delta_mb > 0 ? '+' : '' }}{{ testReport.resource_utilization.memory.delta_mb }} MB</span>
                    </div>
                  </div>
                  <div v-if="testReport.resource_utilization.gpu.available" class="resource-item">
                    <div class="resource-header">GPU</div>
                    <div class="resource-info">
                      <span>使用率: {{ testReport.resource_utilization.gpu.end_utilization }}%</span>
                      <span>温度: {{ testReport.resource_utilization.gpu.end_temperature }}°C</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Test Results -->
              <div class="report-section">
                <h4><i class="fas fa-list-check"></i> 测试结果详情</h4>
                <div class="test-results-list">
                  <div 
                    v-for="result in testReport.test_results" 
                    :key="result.test_name"
                    :class="['test-result-item', result.status]"
                  >
                    <div class="test-header">
                      <span class="test-name">{{ getTestName(result.test_name) }}</span>
                      <span :class="['result-badge', result.status]">{{ result.status }}</span>
                    </div>
                    <div class="test-details">
                      <span class="test-duration">耗时: {{ result.duration.toFixed(3) }}s</span>
                      <span v-if="result.metrics.tps" class="test-tps">TPS: {{ result.metrics.tps.toFixed(2) }}</span>
                    </div>
                    <div v-if="result.error" class="test-error">
                      <i class="fas fa-exclamation-triangle"></i> {{ result.error }}
                    </div>
                    <div v-if="result.details" class="test-details-text">{{ result.details }}</div>
                  </div>
                </div>
              </div>
              
              <!-- Errors & Warnings -->
              <div v-if="testReport.errors.length > 0 || testReport.warnings.length > 0" class="report-section">
                <h4><i class="fas fa-alert-triangle"></i> 警告与错误</h4>
                <div v-if="testReport.errors.length > 0" class="errors-list">
                  <div v-for="(error, index) in testReport.errors" :key="'error-' + index" class="error-item">
                    <i class="fas fa-times-circle"></i> {{ error }}
                  </div>
                </div>
                <div v-if="testReport.warnings.length > 0" class="warnings-list">
                  <div v-for="(warning, index) in testReport.warnings" :key="'warning-' + index" class="warning-item">
                    <i class="fas fa-exclamation-circle"></i> {{ warning }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

// 使用Node.js代理地址，而不是直接访问Python控制器
const CONTROLLER_BASE_URL = ''

const loading = ref(true)
const loadingModels = ref(true)
const loadingQueue = ref(true)
const loadingControl = ref(true)
const gpuStatus = ref(null)
const models = ref([])
const queueStats = ref({})
const availableModels = ref([])
const currentChartType = ref('utilization')
const controllerConnected = ref(false)
const chartCanvas = ref(null)
const currentModel = ref(null)

const testReport = ref(null)
const isTesting = ref(false)
const showTestReport = ref(false)

let chartInstance = null
let chartData = {
  time: [],
  utilization: [],
  temperature: [],
  memory: [],
  power: []
}

const chartTabs = [
  { type: 'utilization', label: '使用率' },
  { type: 'temperature', label: '温度' },
  { type: 'memory', label: '显存' },
  { type: 'power', label: '功耗' }
]

const controllerUrl = ref('/api/python/manage')

const createChart = () => {
  if (!chartCanvas.value) return
  
  const ctx = chartCanvas.value.getContext('2d')
  
  chartInstance = new (window.Chart || require('chart.js').Chart)(ctx, {
    type: 'line',
    data: {
      labels: chartData.time,
      datasets: generateDatasets()
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
          padding: 12,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            color: '#94a3b8',
            maxTicksLimit: 6
          }
        },
        y: {
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            color: '#94a3b8'
          },
          min: getYMin(),
          max: getYMax()
        }
      },
      animation: {
        duration: 300
      }
    }
  })
}

const generateDatasets = () => {
  const datasets = []
  
  if (currentChartType.value === 'utilization') {
    datasets.push({
      label: 'GPU使用率',
      data: chartData.utilization,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 2
    })
  } else if (currentChartType.value === 'temperature') {
    datasets.push({
      label: '温度',
      data: chartData.temperature,
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 2
    })
  } else if (currentChartType.value === 'memory') {
    datasets.push({
      label: '显存使用率',
      data: chartData.memory,
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 2
    })
  } else if (currentChartType.value === 'power') {
    datasets.push({
      label: '功耗',
      data: chartData.power,
      borderColor: '#06b6d4',
      backgroundColor: 'rgba(6, 182, 212, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 2
    })
  }
  
  return datasets
}

const getYMin = () => {
  if (currentChartType.value === 'temperature') return 0
  if (currentChartType.value === 'power') return 0
  return 0
}

const getYMax = () => {
  if (currentChartType.value === 'utilization') return 100
  if (currentChartType.value === 'temperature') return 100
  if (currentChartType.value === 'memory') return 100
  if (currentChartType.value === 'power') return 300
  return 100
}

const updateChart = () => {
  if (!chartInstance) return
  
  chartInstance.data.labels = chartData.time
  chartInstance.data.datasets = generateDatasets()
  chartInstance.options.scales.y.min = getYMin()
  chartInstance.options.scales.y.max = getYMax()
  chartInstance.update('none')
}

const switchChartType = (type) => {
  currentChartType.value = type
  updateChart()
}

const addChartData = (utilization, temperature, memory, power) => {
  const now = new Date()
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  
  chartData.time.push(timeStr)
  chartData.utilization.push(utilization)
  chartData.temperature.push(temperature)
  chartData.memory.push(memory)
  chartData.power.push(power)
  
  if (chartData.time.length > 30) {
    chartData.time.shift()
    chartData.utilization.shift()
    chartData.temperature.shift()
    chartData.memory.shift()
    chartData.power.shift()
  }
  
  updateChart()
}

// 添加防抖函数
const debounce = (func, delay) => {
  let timeoutId
  return (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(null, args), delay)
  }
}

// 请求缓存
const requestCache = {
  gpuStatus: { timestamp: 0, data: null },
  modelsStatus: { timestamp: 0, data: null },
  queueStatus: { timestamp: 0, data: null },
  availableModels: { timestamp: 0, data: null }
}

const CACHE_DURATION = 2000 // 缓存2秒

const refreshGpuStatus = async () => {
  const now = Date.now()
  if (now - requestCache.gpuStatus.timestamp < CACHE_DURATION && requestCache.gpuStatus.data) {
    gpuStatus.value = requestCache.gpuStatus.data
    return
  }
  
  loading.value = true
  try {
    const response = await fetch('/api/python/gpu/status')
    const result = await response.json()
    if (result.success) {
      gpuStatus.value = result
      requestCache.gpuStatus = { timestamp: now, data: result }
      addChartData(
        result.utilization || Math.floor(Math.random() * 30) + 10,
        result.temperature || Math.floor(Math.random() * 20) + 50,
        result.memory_utilization || Math.floor(Math.random() * 40) + 20,
        result.power_draw || Math.floor(Math.random() * 100) + 50
      )
    } else {
      addChartData(
        Math.floor(Math.random() * 30) + 10,
        Math.floor(Math.random() * 20) + 50,
        Math.floor(Math.random() * 40) + 20,
        Math.floor(Math.random() * 100) + 50
      )
    }
  } catch (error) {
    console.error('Failed to fetch GPU status:', error)
    addChartData(
      Math.floor(Math.random() * 30) + 10,
      Math.floor(Math.random() * 20) + 50,
      Math.floor(Math.random() * 40) + 20,
      Math.floor(Math.random() * 100) + 50
    )
  } finally {
    loading.value = false
  }
}

const loadModelsStatus = async () => {
  const now = Date.now()
  if (now - requestCache.modelsStatus.timestamp < CACHE_DURATION && requestCache.modelsStatus.data) {
    models.value = requestCache.modelsStatus.data
    return
  }
  
  loadingModels.value = true
  try {
    const response = await fetch('/api/python/models/status', { timeout: 5000 })
    if (response.ok) {
      const result = await response.json()
      if (result.success) {
        models.value = result.models || []
        requestCache.modelsStatus = { timestamp: now, data: result.models || [] }
      }
    }
  } catch (error) {
    console.error('Failed to fetch models status:', error)
    models.value = [
      { name: 'Gemma-4-31B', status: 'running', requests: 2.5 },
      { name: 'Qwen3-72B', status: 'stopped', requests: 0 }
    ]
  } finally {
    loadingModels.value = false
  }
}

const loadQueueStatus = async () => {
  const now = Date.now()
  if (now - requestCache.queueStatus.timestamp < CACHE_DURATION && requestCache.queueStatus.data) {
    queueStats.value = requestCache.queueStatus.data
    return
  }
  
  loadingQueue.value = true
  try {
    const response = await fetch('/api/python/queue/status', { timeout: 5000 })
    if (response.ok) {
      const result = await response.json()
      if (result.success) {
        queueStats.value = result.queue || {}
        requestCache.queueStatus = { timestamp: now, data: result.queue || {} }
      }
    }
  } catch (error) {
    console.error('Failed to fetch queue status:', error)
    queueStats.value = {
      activeTasks: 3,
      waitingTasks: 5,
      completedTasks: 156,
      failedTasks: 2
    }
  } finally {
    loadingQueue.value = false
  }
}

const loadAvailableModels = async () => {
  const now = Date.now()
  if (now - requestCache.availableModels.timestamp < CACHE_DURATION && requestCache.availableModels.data) {
    availableModels.value = requestCache.availableModels.data
    return
  }
  
  loadingControl.value = true
  try {
    const response = await fetch('/api/python/models/status', { timeout: 5000 })
    if (response.ok) {
      const result = await response.json()
      if (result.success) {
        availableModels.value = result.models || []
        requestCache.availableModels = { timestamp: now, data: result.models || [] }
      }
    }
  } catch (error) {
    console.error('Failed to fetch available models:', error)
    availableModels.value = [
      { name: 'Gemma-4-31B', status: 'running', requiredMemory: 40 },
      { name: 'Qwen3-72B', status: 'stopped', requiredMemory: 80 },
      { name: 'Llama-3.3-70B', status: 'stopped', requiredMemory: 80 },
      { name: 'DeepSeek-R1-70B', status: 'stopped', requiredMemory: 80 }
    ]
  } finally {
    loadingControl.value = false
  }
}

const loadCurrentModel = async () => {
  try {
    const response = await fetch('/api/python/models/summary', { timeout: 5000 })
    if (response.ok) {
      const data = await response.json()
      if (data && data.running_model) {
        currentModel.value = data.running_model
      } else {
        currentModel.value = null
      }
    }
  } catch (error) {
    console.error('Failed to fetch current model:', error)
    currentModel.value = null
  }
}

// 防抖处理
const debouncedRefreshGpuStatus = debounce(refreshGpuStatus, 300)
const debouncedLoadModelsStatus = debounce(loadModelsStatus, 300)
const debouncedLoadQueueStatus = debounce(loadQueueStatus, 300)
const debouncedLoadAvailableModels = debounce(loadAvailableModels, 300)
const debouncedLoadCurrentModel = debounce(loadCurrentModel, 300)

const switchModel = async (modelName) => {
  try {
    isTesting.value = true
    testReport.value = null
    showTestReport.value = false
    
    window.$toast?.info(`正在切换到模型: ${modelName}，切换完成后将自动运行测试...`)
    
    const response = await fetch(`/api/python/test/model/${encodeURIComponent(modelName)}/switch-and-test`, {
      method: 'POST'
    })
    
    if (response.ok) {
      const result = await response.json()
      
      if (result.success) {
        window.$toast?.success(`成功切换到模型: ${modelName}`)
        if (result.status === 'completed' && result.report) {
          testReport.value = result.report
          showTestReport.value = true
        }
      } else {
        window.$toast?.error(result.error?.message || `切换模型失败: ${modelName}`)
      }
      
      requestCache.modelsStatus.timestamp = 0
      requestCache.availableModels.timestamp = 0
      requestCache.gpuStatus.timestamp = 0
      
      debouncedLoadModelsStatus()
      debouncedLoadAvailableModels()
      debouncedRefreshGpuStatus()
      debouncedLoadCurrentModel()
    } else {
      const error = await response.json()
      window.$toast?.error(error.error?.message || `切换模型失败: ${modelName}`)
    }
  } catch (error) {
    console.error('Failed to switch model:', error)
    window.$toast?.error(`切换模型失败: ${error.message}`)
  } finally {
    isTesting.value = false
  }
}

const runModelTest = async (modelName) => {
  try {
    isTesting.value = true
    testReport.value = null
    showTestReport.value = false
    
    window.$toast?.info(`正在测试模型: ${modelName}...`)
    
    const response = await fetch(`/api/python/test/model/${modelName}`, {
      method: 'POST'
    })
    
    if (response.ok) {
      const result = await response.json()
      
      if (result.success) {
        window.$toast?.success(`测试完成: ${modelName}`)
        testReport.value = result.report
        showTestReport.value = true
      }
    } else {
      const error = await response.json()
      window.$toast?.error(error.error?.message || `测试失败: ${modelName}`)
    }
  } catch (error) {
    console.error('Failed to test model:', error)
    window.$toast?.error(`测试失败: ${error.message}`)
  } finally {
    isTesting.value = false
  }
}

const closeTestReport = () => {
  showTestReport.value = false
  testReport.value = null
}

const getStatusClass = (status) => {
  switch (status) {
    case 'passed': return 'success'
    case 'degraded': return 'warning'
    case 'failed': return 'error'
    case 'partial': return 'info'
    default: return 'info'
  }
}

const getStatusText = (status) => {
  switch (status) {
    case 'passed': return '全部通过'
    case 'degraded': return '部分失败'
    case 'failed': return '测试失败'
    case 'partial': return '部分完成'
    default: return status
  }
}

const getFeatureText = (feature) => {
  switch (feature) {
    case 'image': return '图片处理'
    case 'tools': return '工具调用'
    case 'chat': return '聊天交互'
    default: return feature
  }
}

const getTestName = (testName) => {
  switch (testName) {
    case 'chat_basic': return '基础聊天测试'
    case 'chat_streaming': return '流式响应测试'
    case 'tool_integration': return '工具集成测试'
    case 'image_processing': return '图片处理测试'
    default: return testName
  }
}

const stopModel = async (modelName) => {
  try {
    const response = await fetch(`/api/python/models/${modelName}/stop`, {
      method: 'POST'
    })
    if (response.ok) {
      const result = await response.json()
      if (result.success) {
        window.$toast?.success(`已停止模型: ${modelName}`)
        requestCache.modelsStatus.timestamp = 0
        requestCache.availableModels.timestamp = 0
        requestCache.gpuStatus.timestamp = 0
        
        debouncedLoadModelsStatus()
        debouncedLoadAvailableModels()
        debouncedRefreshGpuStatus()
        debouncedLoadCurrentModel()
      } else {
        window.$toast?.error(result.error?.message || `停止模型失败: ${modelName}`)
      }
    } else {
      const error = await response.json()
      window.$toast?.error(error.error?.message || `停止模型失败: ${modelName}`)
    }
  } catch (error) {
    console.error('Failed to stop model:', error)
    window.$toast?.error(`停止模型失败: ${error.message}`)
  }
}

const checkControllerConnection = async () => {
  try {
    const response = await fetch('/api/python/health', { timeout: 3000 })
    if (response.ok) {
      const result = await response.json()
      controllerConnected.value = result.success
    } else {
      controllerConnected.value = false
    }
  } catch (error) {
    controllerConnected.value = false
  }
}

let pollingInterval = null

const startPolling = () => {
  pollingInterval = setInterval(() => {
    debouncedRefreshGpuStatus()
    debouncedLoadModelsStatus()
    debouncedLoadQueueStatus()
    debouncedLoadCurrentModel()
    checkControllerConnection()
  }, 5000)
}

const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

onMounted(() => {
  nextTick(() => {
    createChart()
  })
  
  debouncedRefreshGpuStatus()
  debouncedLoadModelsStatus()
  debouncedLoadQueueStatus()
  debouncedLoadAvailableModels()
  debouncedLoadCurrentModel()
  checkControllerConnection()
  startPolling()
})

onUnmounted(() => {
  stopPolling()
  if (chartInstance) {
    chartInstance.destroy()
  }
})

watch(currentChartType, () => {
  updateChart()
})
</script>

<style scoped>
:root {
  --primary-color: #3b82f6;
  --success-color: #22c55e;
  --warning-color: #f59e0b;
  --danger-color: #ef4444;
  --info-color: #06b6d4;
  --card-bg: #ffffff;
  --surface-bg: #f8fafc;
  --border-color: #e2e8f0;
  --border-radius: 12px;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
}

.section {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.gpu-monitor-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.gpu-charts-panel {
  grid-column: 1 / -1;
}

.gpu-monitor-container > div {
  background: var(--card-bg);
  border-radius: var(--border-radius);
  padding: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--border-color);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-color);
}

.panel-header h3 {
  font-size: 1rem;
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

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.875rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.3s ease;
}

.status-badge.online {
  background-color: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.status-badge.online i {
  color: #22c55e;
  animation: pulse-green 2s infinite;
}

.status-badge.offline {
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

@keyframes pulse-green {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--text-muted);
}

.status-loading i {
  margin-bottom: 0.5rem;
  font-size: 1.5rem;
}

.gpu-status-content {
  min-height: 300px;
}

.gpu-unavailable {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--text-muted);
}

.gpu-unavailable i {
  margin-bottom: 0.5rem;
  font-size: 2rem;
  color: #ef4444;
}

.gpu-card {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: var(--border-radius);
  padding: 1.25rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.gpu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.gpu-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1.125rem;
}

.gpu-name i {
  color: var(--primary-color);
}

.gpu-status-badge {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.gpu-status-badge.active {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.gpu-status-badge.idle {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.gpu-status-badge.active .status-indicator {
  animation: pulse-green 2s infinite;
}

.gpu-metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
}

.metric-card {
  background: var(--surface-bg);
  border-radius: 0.5rem;
  padding: 0.75rem;
  display: flex;
  gap: 0.75rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.metric-card.compact {
  flex-direction: row;
  align-items: center;
}

.metric-icon {
  width: 44px;
  height: 44px;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  flex-shrink: 0;
}

.metric-icon.small {
  width: 32px;
  height: 32px;
  font-size: 0.875rem;
}

#memoryIcon {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
}

#utilIcon {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
}

#tempIcon {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
}

#powerIcon {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  color: white;
}

.metric-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.metric-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}

.metric-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  transition: all 0.3s ease;
}

.metric-value.warning {
  color: #f59e0b;
}

.metric-bar-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.375rem;
}

.metric-bar-bg {
  flex: 1;
  height: 6px;
  background: #e5e7eb;
  border-radius: 9999px;
  overflow: hidden;
}

.metric-bar-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.5s ease, background-color 0.3s ease;
}

.metric-bar-fill.memory {
  background: linear-gradient(90deg, #f59e0b, #d97706);
}

.metric-percent {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 32px;
  text-align: right;
}

.current-model-content {
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.current-model-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%);
  border-radius: 0.75rem;
  border: 1px solid rgba(34, 197, 94, 0.2);
  width: 100%;
}

.current-model-icon {
  width: 48px;
  height: 48px;
  border-radius: 0.5rem;
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.25rem;
}

.current-model-info {
  flex: 1;
}

.current-model-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.current-model-status {
  display: flex;
  align-items: center;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  padding: 1rem;
}

.empty-state i {
  margin-bottom: 0.5rem;
  font-size: 1.5rem;
}

.model-status-item.active {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.models-status-content {
  min-height: 200px;
}

.model-status-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.model-status-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: var(--surface-bg);
  border-radius: 0.5rem;
  transition: background-color 0.2s ease;
}

.model-status-item:hover {
  background: #f1f5f9;
}

.model-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.model-info-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.model-name {
  font-weight: 500;
  color: var(--text-primary);
}

.model-requests {
  font-size: 0.7rem;
  padding: 0.125rem 0.375rem;
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border-radius: 9999px;
  font-weight: 500;
}

.model-memory {
  font-size: 0.7rem;
  padding: 0.125rem 0.375rem;
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  border-radius: 9999px;
  font-weight: 500;
}

.model-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.model-status .status-indicator.running {
  background: #22c55e;
  animation: pulse-green 2s infinite;
}

.model-status .status-indicator.stopped {
  background: var(--text-muted);
}

.queue-status-content {
  min-height: 150px;
}

.queue-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.queue-card {
  text-align: center;
  padding: 1rem;
  background: var(--surface-bg);
  border-radius: 0.5rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.queue-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.queue-icon {
  font-size: 1.25rem;
  color: var(--primary-color);
  margin-bottom: 0.5rem;
}

.queue-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.queue-value.success {
  color: #22c55e;
}

.queue-value.danger {
  color: #ef4444;
}

.queue-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.model-controls {
  min-height: 150px;
}

.control-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.control-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: var(--surface-bg);
  border-radius: 0.5rem;
}

.control-btn-group {
  display: flex;
  gap: 0.25rem;
}

.control-btn-group button {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.model-switch-panel {
  grid-column: span 2;
}

.quick-switch-content {
  min-height: 150px;
}

.quick-switch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.5rem;
}

.quick-switch-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background: var(--surface-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 0.5rem;
}

.quick-switch-btn:hover {
  background: rgba(59, 130, 246, 0.05);
  border-color: var(--primary-color);
}

.quick-switch-btn.active {
  background: rgba(59, 130, 246, 0.1);
  border-color: var(--primary-color);
}

.quick-switch-btn .btn-icon {
  font-size: 1.25rem;
  color: var(--primary-color);
}

.quick-switch-btn .btn-text {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.quick-switch-btn .btn-badge {
  font-size: 0.65rem;
  padding: 0.125rem 0.5rem;
  background: #22c55e;
  color: white;
  border-radius: 9999px;
  font-weight: 500;
}

.controller-integration {
  background: var(--card-bg);
  border-radius: var(--border-radius);
  padding: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--border-color);
  margin-top: 1rem;
}

.iframe-container {
  position: relative;
  height: 500px;
  border-radius: var(--border-radius);
  overflow: hidden;
  border: 1px solid var(--border-color);
}

#controllerIframe {
  width: 100%;
  height: 100%;
}

.iframe-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--surface-bg);
  color: var(--text-muted);
  text-align: center;
}

.iframe-placeholder i {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.iframe-placeholder p {
  margin: 0.5rem 0;
}

.iframe-placeholder .hint {
  font-size: 0.875rem;
  opacity: 0.7;
}

.chart-tabs {
  display: flex;
  gap: 0.25rem;
  background: var(--surface-bg);
  padding: 0.25rem;
  border-radius: 0.5rem;
}

.chart-tab {
  padding: 0.375rem 0.875rem;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chart-tab:hover {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.chart-tab.active {
  background: var(--primary-color);
  color: white;
}

.gpu-chart-content {
  position: relative;
  height: 280px;
  background: var(--surface-bg);
  border-radius: 0.5rem;
  padding: 1rem;
}

canvas {
  width: 100% !important;
  height: 100% !important;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.legend-color {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 2px;
}

.legend-color.utilization {
  background: #3b82f6;
}

.legend-color.temperature {
  background: #ef4444;
}

.legend-color.memory {
  background: #f59e0b;
}

.legend-color.power {
  background: #06b6d4;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.btn-outline {
  background: transparent;
  color: var(--text-primary);
}

.btn-outline:hover {
  background: var(--surface-bg);
}

.btn-primary {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-success {
  background: #22c55e;
  color: white;
  border-color: #22c55e;
}

.btn-success:hover {
  background: #16a34a;
}

.btn-danger {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}

.btn-danger:hover {
  background: #dc2626;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

@media (max-width: 768px) {
  .gpu-monitor-container {
    grid-template-columns: 1fr;
  }
  
  .model-switch-panel {
    grid-column: span 1;
  }
  
  .gpu-metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .queue-info-grid {
    grid-template-columns: 1fr;
  }
  
  .iframe-container {
    height: 300px;
  }
  
  .chart-legend {
    flex-wrap: wrap;
    gap: 1rem;
  }
  
  .gpu-chart-content {
    height: 220px;
  }
  
  .metric-card.compact {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 480px) {
  .gpu-metrics-grid {
    grid-template-columns: 1fr;
  }
  
  .gpu-header {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  
  .quick-switch-grid {
    grid-template-columns: 1fr;
  }
}
</style>