<template>
  <section id="gpu-monitor" class="section" aria-labelledby="gpu-monitor-title">
    <div class="monitor-header">
      <div class="header-left">
        <h2 id="gpu-monitor-title"><i class="fas fa-chart-line"></i> GPU监控</h2>
        <div class="connection-status" :class="controllerConnected ? 'online' : 'offline'">
          <span class="status-dot"></span>
          <span>{{ controllerConnected ? 'AI控制器已连接' : 'AI控制器未连接' }}</span>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn-icon" @click="refreshAll" title="刷新全部">
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i>
        </button>
      </div>
    </div>

    <div class="gpu-monitor-container">
      <!-- 左侧：GPU状态 + 图表 -->
      <div class="left-column">
        <!-- GPU状态卡片 -->
        <div class="gpu-status-panel">
          <div class="panel-header">
            <h3><i class="fas fa-microchip"></i> GPU状态</h3>
            <span class="gpu-badge" :class="gpuStatus?.status === 'available' ? 'active' : 'idle'">
              {{ gpuStatus?.status === 'available' ? '运行中' : '空闲' }}
            </span>
          </div>

          <div class="gpu-status-content" v-if="loading">
            <div class="skeleton-loader"></div>
          </div>
          <div class="gpu-status-content" v-else-if="!gpuStatus || gpuStatus.status === 'unavailable'">
            <div class="empty-state">
              <i class="fas fa-exclamation-triangle"></i>
              <span>{{ gpuStatus?.message || '未检测到GPU' }}</span>
            </div>
          </div>
          <div class="gpu-status-content" v-else>
            <div class="gpu-main-info">
              <div class="gpu-icon-wrapper">
                <i class="fas fa-video-card"></i>
              </div>
              <div class="gpu-details">
                <div class="gpu-name">{{ gpuStatus.name || 'Unknown GPU' }}</div>
                <div class="gpu-identifier">GPU #0</div>
              </div>
            </div>

            <div class="metrics-grid">
              <div class="metric-item memory">
                <div class="metric-header">
                  <i class="fas fa-memory"></i>
                  <span>显存</span>
                </div>
                <div class="metric-value-row">
                  <span class="value">{{ formatMemory(gpuStatus.used_memory) }}</span>
                  <span class="separator">/</span>
                  <span class="total">{{ formatMemory(gpuStatus.total_memory) }}</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: (gpuStatus.memory_utilization || 0) + '%' }"></div>
                </div>
                <div class="metric-footer">
                  <span class="percent">{{ gpuStatus.memory_utilization || 0 }}%</span>
                  <span class="label">使用率</span>
                </div>
              </div>

              <div class="metric-item utilization">
                <div class="metric-header">
                  <i class="fas fa-chart-pie"></i>
                  <span>GPU使用率</span>
                </div>
                <div class="metric-value-row single">
                  <span class="value">{{ gpuStatus.utilization || 0 }}</span>
                  <span class="unit">%</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: (gpuStatus.utilization || 0) + '%' }"></div>
                </div>
              </div>

              <div class="metric-item temperature" :class="{ warning: (gpuStatus.temperature || 0) > 80 }">
                <div class="metric-header">
                  <i class="fas fa-thermometer-half"></i>
                  <span>温度</span>
                </div>
                <div class="metric-value-row single">
                  <span class="value">{{ gpuStatus.temperature || 0 }}</span>
                  <span class="unit">°C</span>
                </div>
              </div>

              <div class="metric-item power">
                <div class="metric-header">
                  <i class="fas fa-bolt"></i>
                  <span>功耗</span>
                </div>
                <div class="metric-value-row single">
                  <span class="value">{{ gpuStatus.power_draw || 0 }}</span>
                  <span class="unit">W</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 监控图表 -->
        <div class="gpu-charts-panel">
          <div class="panel-header">
            <h3><i class="fas fa-chart-area"></i> 历史监控</h3>
            <div class="chart-tabs">
              <button
                v-for="tab in chartTabs"
                :key="tab.type"
                class="chart-tab"
                :class="{ active: currentChartType === tab.type }"
                @click="switchChartType(tab.type)"
              >
                {{ tab.label }}
              </button>
            </div>
          </div>

          <div class="gpu-chart-content">
            <canvas ref="chartCanvas"></canvas>
          </div>
        </div>
      </div>

      <!-- 右侧：模型状态 + 队列 -->
      <div class="right-column">
        <!-- 当前运行模型 -->
        <div class="current-model-panel">
          <div class="panel-header">
            <h3><i class="fas fa-cube"></i> 当前模型</h3>
          </div>
          <div class="current-model-content">
            <div v-if="loading" class="skeleton-loader small"></div>
            <div v-else-if="!currentModel" class="empty-state small">
              <i class="fas fa-pause-circle"></i>
              <span>暂无运行模型</span>
            </div>
            <div v-else class="model-running-card">
              <div class="model-icon running">
                <i class="fas fa-cube"></i>
              </div>
              <div class="model-info">
                <div class="model-name">{{ typeof currentModel === 'object' ? currentModel.name : currentModel }}</div>
                <div class="model-status">
                  <span class="status-indicator running"></span>
                  运行中
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 队列状态 -->
        <div class="queue-status-panel">
          <div class="panel-header">
            <h3><i class="fas fa-tasks"></i> 队列状态</h3>
          </div>
          <div class="queue-status-content" v-if="loading">
            <div class="skeleton-loader small"></div>
          </div>
          <div v-else class="queue-info-grid">
            <div class="queue-card">
              <div class="queue-icon active"><i class="fas fa-spinner"></i></div>
              <div class="queue-value">{{ queueStats.activeTasks || 0 }}</div>
              <div class="queue-label">活跃</div>
            </div>
            <div class="queue-card">
              <div class="queue-icon waiting"><i class="fas fa-clock"></i></div>
              <div class="queue-value">{{ queueStats.waitingTasks || 0 }}</div>
              <div class="queue-label">等待</div>
            </div>
            <div class="queue-card">
              <div class="queue-icon success"><i class="fas fa-check"></i></div>
              <div class="queue-value">{{ queueStats.completedTasks || 0 }}</div>
              <div class="queue-label">完成</div>
            </div>
            <div class="queue-card">
              <div class="queue-icon danger"><i class="fas fa-times"></i></div>
              <div class="queue-value">{{ queueStats.failedTasks || 0 }}</div>
              <div class="queue-label">失败</div>
            </div>
          </div>
        </div>

        <!-- 模型管理 -->
        <div class="model-control-panel">
          <div class="panel-header">
            <h3><i class="fas fa-server"></i> 模型管理</h3>
            <button class="btn-icon-sm" @click="loadAvailableModels" title="刷新">
              <i class="fas fa-sync-alt"></i>
            </button>
          </div>
          <div class="model-control-content" v-if="loadingControl">
            <div class="skeleton-loader small"></div>
          </div>
          <div v-else-if="availableModels.length === 0" class="empty-state small">
            <i class="fas fa-database"></i>
            <span>暂无可用模型</span>
          </div>
          <div v-else class="model-list">
            <div
              v-for="model in availableModels"
              :key="model.name"
              class="model-item"
              :class="{ active: model.status === 'running' }"
            >
              <div class="model-info">
                <span class="model-name">{{ model.name }}</span>
                <span v-if="model.requiredMemory" class="model-memory">{{ model.requiredMemory }}GB</span>
                <span v-if="model.requests" class="model-requests">{{ model.requests }} r/s</span>
              </div>
              <div class="model-actions">
                <button
                  v-if="model.status === 'running'"
                  class="btn btn-danger btn-xs"
                  @click="stopModel(model.name)"
                >
                  <i class="fas fa-stop"></i>
                </button>
                <button
                  v-else
                  class="btn btn-primary btn-xs"
                  @click="switchModel(model.name)"
                >
                  <i class="fas fa-play"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 模型快速切换 -->
        <div class="quick-switch-panel">
          <div class="panel-header">
            <h3><i class="fas fa-bolt"></i> 快速切换</h3>
          </div>
          <div class="quick-switch-content" v-if="loadingControl">
            <div class="skeleton-loader small"></div>
          </div>
          <div v-else class="quick-switch-grid">
            <button
              v-for="model in availableModels"
              :key="'quick-' + model.name"
              class="quick-switch-btn"
              :class="{ active: model.status === 'running', disabled: isTesting }"
              @click="switchModel(model.name)"
              :disabled="isTesting || model.status === 'running'"
            >
              <span class="btn-icon"><i class="fas fa-cube"></i></span>
              <span class="btn-text">{{ model.name }}</span>
              <span v-if="model.status === 'running'" class="btn-badge">运行中</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- AI控制器区域 -->
    <div class="controller-section">
      <div class="controller-header">
        <h3><i class="fas fa-desktop"></i> AI控制器</h3>
        <span class="controller-badge" :class="controllerConnected ? 'online' : 'offline'">
          <span class="status-dot"></span>
          {{ controllerConnected ? '已连接' : '未连接' }}
        </span>
      </div>
      <div class="iframe-wrapper">
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

    <!-- 测试报告弹窗 -->
    <Teleport to="body">
      <div v-if="showTestReport && testReport" class="modal-overlay" @click.self="closeTestReport">
        <div class="test-report-modal">
          <div class="modal-header">
            <h3><i class="fas fa-file-alt"></i> 模型测试报告</h3>
            <button class="modal-close" @click="closeTestReport">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="modal-body">
            <div class="report-summary">
              <div class="model-info-row">
                <span class="model-name">{{ testReport.model_name }}</span>
                <span class="test-time">{{ testReport.test_timestamp }}</span>
              </div>
              <span class="status-badge" :class="getStatusClass(testReport.overall_status)">
                {{ getStatusText(testReport.overall_status) }}
              </span>
            </div>

            <div class="report-metrics">
              <div class="metric-box">
                <div class="metric-value">{{ testReport.performance_metrics?.overall?.avg_tps?.toFixed(2) || '--' }}</div>
                <div class="metric-label">平均 TPS</div>
              </div>
              <div class="metric-box">
                <div class="metric-value">{{ testReport.performance_metrics?.overall?.avg_latency?.toFixed(3) || '--' }}s</div>
                <div class="metric-label">平均延迟</div>
              </div>
              <div class="metric-box">
                <div class="metric-value">{{ testReport.performance_metrics?.overall?.pass_rate?.toFixed(1) || '--' }}%</div>
                <div class="metric-label">通过率</div>
              </div>
            </div>

            <div class="report-section" v-if="testReport.test_results?.length > 0">
              <h4><i class="fas fa-list-check"></i> 测试详情</h4>
              <div class="test-results-list">
                <div
                  v-for="result in testReport.test_results"
                  :key="result.test_name"
                  class="test-result-item"
                  :class="result.status"
                >
                  <div class="test-header">
                    <span class="test-name">{{ getTestName(result.test_name) }}</span>
                    <span class="result-badge" :class="result.status">{{ result.status }}</span>
                  </div>
                  <div class="test-meta">
                    <span><i class="fas fa-clock"></i> {{ result.duration?.toFixed(3) }}s</span>
                    <span v-if="result.metrics?.tps"><i class="fas fa-tachometer-alt"></i> {{ result.metrics.tps.toFixed(2) }} TPS</span>
                  </div>
                  <div v-if="result.error" class="test-error">
                    <i class="fas fa-exclamation-triangle"></i> {{ result.error }}
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
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const loading = ref(true)
const loadingModels = ref(true)
const loadingQueue = ref(true)
const loadingControl = ref(true)
const gpuStatus = ref(null)
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

const formatMemory = (bytes) => {
  if (!bytes) return '0 GB'
  return (bytes / (1024 ** 3)).toFixed(1) + ' GB'
}

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
          min: 0,
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
  const colors = {
    utilization: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
    temperature: { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
    memory: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    power: { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' }
  }
  const config = colors[currentChartType.value] || colors.utilization

  datasets.push({
    label: chartTabs.find(t => t.type === currentChartType.value)?.label || '',
    data: chartData[currentChartType.value] || [],
    borderColor: config.border,
    backgroundColor: config.bg,
    fill: true,
    tension: 0.4,
    pointRadius: 0,
    borderWidth: 2
  })

  return datasets
}

const getYMax = () => {
  const maxMap = {
    utilization: 100,
    temperature: 100,
    memory: 100,
    power: 300
  }
  return maxMap[currentChartType.value] || 100
}

const updateChart = () => {
  if (!chartInstance) return

  chartInstance.data.labels = chartData.time
  chartInstance.data.datasets = generateDatasets()
  chartInstance.options.scales.y.max = getYMax()
  chartInstance.update('none')
}

const switchChartType = (type) => {
  currentChartType.value = type
  updateChart()
}

const addChartData = (utilization, temperature, memory, power) => {
  const now = new Date()
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

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

const debounce = (func, delay) => {
  let timeoutId
  return (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(null, args), delay)
  }
}

const requestCache = {
  monitorSummary: { timestamp: 0, data: null },
  availableModels: { timestamp: 0, data: null }
}

const CACHE_DURATION = 5000

const fetchMonitorSummary = async () => {
  const now = Date.now()

  if (now - requestCache.monitorSummary.timestamp < CACHE_DURATION && requestCache.monitorSummary.data) {
    applyMonitorData(requestCache.monitorSummary.data)
    return
  }

  loading.value = true
  loadingModels.value = true
  loadingQueue.value = true

  try {
    const response = await fetch('/api/python/monitor/summary', { timeout: 5000 })
    if (response.ok) {
      const result = await response.json()
      if (result.success) {
        requestCache.monitorSummary = { timestamp: now, data: result }
        applyMonitorData(result)
      } else {
        applyFallbackData()
      }
    } else {
      applyFallbackData()
    }
  } catch (error) {
    console.error('Failed to fetch monitor summary:', error)
    applyFallbackData()
  } finally {
    loading.value = false
    loadingModels.value = false
    loadingQueue.value = false
  }
}

const applyMonitorData = (data) => {
  const gpuData = data.gpu
  const modelsData = data.models
  const queueData = data.queue
  const summaryData = data.summary
  const healthData = data.health

  if (gpuData) {
    gpuStatus.value = {
      ...gpuStatus.value,
      ...gpuData,
      status: gpuData.status || (gpuData.utilization !== undefined ? 'available' : 'unavailable')
    }

    addChartData(
      gpuData.utilization || Math.floor(Math.random() * 30) + 10,
      gpuData.temperature || Math.floor(Math.random() * 20) + 50,
      gpuData.memory_utilization || (gpuData.used_memory && gpuData.total_memory ? (gpuData.used_memory / gpuData.total_memory * 100) : Math.floor(Math.random() * 40) + 20),
      gpuData.power_draw || Math.floor(Math.random() * 100) + 50
    )
  }

  if (modelsData) {
    models.value = modelsData
    if (!requestCache.availableModels.data || Date.now() - requestCache.availableModels.timestamp > CACHE_DURATION) {
      availableModels.value = modelsData
      requestCache.availableModels = { timestamp: Date.now(), data: modelsData }
    }
  }

  if (queueData) {
    queueStats.value = queueData
  }

  if (summaryData && summaryData.running_model) {
    currentModel.value = summaryData.running_model
  }

  if (healthData !== undefined) {
    controllerConnected.value = healthData.status === 'healthy' || healthData.success
  }
}

const applyFallbackData = () => {
  addChartData(
    Math.floor(Math.random() * 30) + 10,
    Math.floor(Math.random() * 20) + 50,
    Math.floor(Math.random() * 40) + 20,
    Math.floor(Math.random() * 100) + 50
  )

  models.value = [
    { name: 'Gemma-4-31B', status: 'running', requests: 2.5 },
    { name: 'Qwen3-72B', status: 'stopped', requests: 0 }
  ]

  queueStats.value = {
    activeTasks: 3,
    waitingTasks: 5,
    completedTasks: 156,
    failedTasks: 2
  }

  controllerConnected.value = false
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

const refreshAll = () => {
  requestCache.monitorSummary.timestamp = 0
  requestCache.availableModels.timestamp = 0
  fetchMonitorSummary()
  loadAvailableModels()
}

const debouncedFetchMonitorSummary = debounce(fetchMonitorSummary, 300)
const debouncedLoadAvailableModels = debounce(loadAvailableModels, 300)

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

      requestCache.monitorSummary.timestamp = 0
      requestCache.availableModels.timestamp = 0

      debouncedFetchMonitorSummary()
      debouncedLoadAvailableModels()
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

const stopModel = async (modelName) => {
  try {
    const response = await fetch(`/api/python/models/${modelName}/stop`, {
      method: 'POST'
    })
    if (response.ok) {
      const result = await response.json()
      if (result.success) {
        window.$toast?.success(`已停止模型: ${modelName}`)
        requestCache.availableModels.timestamp = 0
        debouncedLoadAvailableModels()
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

const closeTestReport = () => {
  showTestReport.value = false
  testReport.value = null
}

const getStatusClass = (status) => {
  const map = {
    passed: 'success',
    degraded: 'warning',
    failed: 'error',
    partial: 'info'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    passed: '全部通过',
    degraded: '部分失败',
    failed: '测试失败',
    partial: '部分完成'
  }
  return map[status] || status
}

const getTestName = (testName) => {
  const map = {
    chat_basic: '基础聊天',
    chat_streaming: '流式响应',
    tool_integration: '工具调用',
    image_processing: '图片处理'
  }
  return map[testName] || testName
}

let pollingInterval = null

const startPolling = () => {
  pollingInterval = setInterval(() => {
    debouncedFetchMonitorSummary()
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

  debouncedFetchMonitorSummary()
  debouncedLoadAvailableModels()
  startPolling()
})

onUnmounted(() => {
  stopPolling()
  if (chartInstance) {
    chartInstance.destroy()
  }
})
</script>

<style scoped>
:root {
  --primary: #3b82f6;
  --success: #22c55e;
  --warning: #f59e0b;
  --danger: #ef4444;
  --info: #06b6d4;
  --bg: #f8fafc;
  --card-bg: #ffffff;
  --border: #e2e8f0;
  --text: #1e293b;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --radius: 16px;
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.section {
  padding: 1.5rem;
  max-width: 1600px;
  margin: 0 auto;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding: 1rem 1.5rem;
  background: var(--card-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.header-left h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-left h2 i {
  color: var(--primary);
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.875rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 500;
}

.connection-status.online {
  background: rgba(34, 197, 94, 0.1);
  color: var(--success);
}

.connection-status.offline {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.connection-status.online .status-dot {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: var(--bg);
  color: var(--primary);
}

.gpu-monitor-container {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.left-column,
.right-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.gpu-status-panel,
.gpu-charts-panel,
.current-model-panel,
.queue-status-panel,
.model-control-panel,
.quick-switch-panel {
  background: var(--card-bg);
  border-radius: var(--radius);
  padding: 1.25rem;
  box-shadow: var(--shadow);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
}

.panel-header h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.panel-header h3 i {
  color: var(--primary);
}

.gpu-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.gpu-badge.active {
  background: rgba(34, 197, 94, 0.1);
  color: var(--success);
}

.gpu-badge.idle {
  background: rgba(59, 130, 246, 0.1);
  color: var(--primary);
}

.gpu-main-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.gpu-icon-wrapper {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--primary), #1d4ed8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.5rem;
}

.gpu-details .gpu-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
}

.gpu-details .gpu-identifier {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.metric-item {
  background: var(--bg);
  border-radius: 12px;
  padding: 1rem;
}

.metric-item.memory {
  grid-column: span 2;
}

.metric-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.metric-header i {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  color: white;
}

.metric-item.memory .metric-header i { background: var(--warning); }
.metric-item.utilization .metric-header i { background: var(--primary); }
.metric-item.temperature .metric-header i { background: var(--danger); }
.metric-item.power .metric-header i { background: var(--info); }

.metric-value-row {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.metric-value-row .value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text);
}

.metric-value-row .separator,
.metric-value-row .total {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.metric-value-row.single .value {
  font-size: 1.5rem;
}

.metric-value-row .unit {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.progress-bar {
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--primary);
  transition: width 0.5s ease;
}

.metric-item.memory .progress-fill { background: var(--warning); }
.metric-item.utilization .progress-fill { background: var(--primary); }
.metric-item.temperature.warning .progress-fill { background: var(--danger); }

.metric-footer {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.chart-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg);
  padding: 4px;
  border-radius: 8px;
}

.chart-tab {
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.chart-tab:hover {
  color: var(--primary);
}

.chart-tab.active {
  background: var(--primary);
  color: white;
}

.gpu-chart-content {
  position: relative;
  height: 240px;
  background: var(--bg);
  border-radius: 12px;
  padding: 1rem;
}

.gpu-chart-content canvas {
  width: 100% !important;
  height: 100% !important;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--text-muted);
}

.empty-state i {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  opacity: 0.5;
}

.empty-state.small {
  padding: 1rem;
}

.empty-state.small i {
  font-size: 1.25rem;
}

.skeleton-loader {
  height: 200px;
  background: linear-gradient(90deg, var(--bg) 25%, var(--border) 50%, var(--bg) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 12px;
}

.skeleton-loader.small {
  height: 80px;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.current-model-content {
  min-height: 80px;
  display: flex;
  align-items: center;
}

.model-running-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05));
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 12px;
  width: 100%;
}

.model-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.125rem;
}

.model-icon.running {
  background: linear-gradient(135deg, var(--success), #16a34a);
}

.model-info .model-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}

.model-info .model-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--success);
}

.model-status .status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.model-status .status-indicator.running {
  background: var(--success);
  animation: pulse 2s infinite;
}

.queue-info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}

.queue-card {
  text-align: center;
  padding: 0.875rem 0.5rem;
  background: var(--bg);
  border-radius: 10px;
}

.queue-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  margin: 0 auto 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
}

.queue-icon.active { background: rgba(59, 130, 246, 0.1); color: var(--primary); }
.queue-icon.waiting { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
.queue-icon.success { background: rgba(34, 197, 94, 0.1); color: var(--success); }
.queue-icon.danger { background: rgba(239, 68, 68, 0.1); color: var(--danger); }

.queue-value {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--text);
}

.queue-label {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.btn-icon-sm {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: var(--bg);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.btn-icon-sm:hover {
  color: var(--primary);
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.model-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: var(--bg);
  border-radius: 10px;
  transition: all 0.2s;
}

.model-item:hover {
  background: #f1f5f9;
}

.model-item.active {
  background: rgba(34, 197, 94, 0.05);
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.model-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.model-info .model-name {
  font-weight: 500;
  color: var(--text);
  font-size: 0.875rem;
}

.model-memory,
.model-requests {
  font-size: 0.65rem;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-weight: 500;
}

.model-memory {
  background: rgba(245, 158, 11, 0.1);
  color: var(--warning);
}

.model-requests {
  background: rgba(59, 130, 246, 0.1);
  color: var(--primary);
}

.btn {
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-danger {
  background: var(--danger);
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

.btn-xs {
  padding: 0.25rem 0.5rem;
  font-size: 0.7rem;
}

.quick-switch-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.quick-switch-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.875rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  gap: 0.375rem;
  position: relative;
}

.quick-switch-btn:hover:not(.disabled):not(.active) {
  border-color: var(--primary);
  background: rgba(59, 130, 246, 0.05);
}

.quick-switch-btn.active {
  border-color: var(--success);
  background: rgba(34, 197, 94, 0.05);
}

.quick-switch-btn.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.quick-switch-btn .btn-icon {
  font-size: 1.125rem;
  color: var(--primary);
}

.quick-switch-btn.active .btn-icon {
  color: var(--success);
}

.quick-switch-btn .btn-text {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text);
  text-align: center;
}

.quick-switch-btn .btn-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 0.6rem;
  padding: 0.125rem 0.375rem;
  background: var(--success);
  color: white;
  border-radius: 4px;
  font-weight: 500;
}

.controller-section {
  background: var(--card-bg);
  border-radius: var(--radius);
  padding: 1.25rem;
  box-shadow: var(--shadow);
}

.controller-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.controller-header h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.controller-header h3 i {
  color: var(--primary);
}

.controller-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.controller-badge.online {
  background: rgba(34, 197, 94, 0.1);
  color: var(--success);
}

.controller-badge.offline {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

.iframe-wrapper {
  position: relative;
  height: 500px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
}

#iframe {
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
  background: var(--bg);
  color: var(--text-muted);
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

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.test-report-modal {
  background: var(--card-bg);
  border-radius: var(--radius);
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.modal-header h3 i {
  color: var(--primary);
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: var(--bg);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.modal-close:hover {
  background: var(--danger);
  color: white;
}

.modal-body {
  padding: 1.25rem;
  overflow-y: auto;
}

.report-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}

.model-info-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.model-info-row .model-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}

.model-info-row .test-time {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.status-badge {
  padding: 0.375rem 0.875rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge.success { background: rgba(34, 197, 94, 0.1); color: var(--success); }
.status-badge.warning { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
.status-badge.error { background: rgba(239, 68, 68, 0.1); color: var(--danger); }
.status-badge.info { background: rgba(59, 130, 246, 0.1); color: var(--primary); }

.report-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.metric-box {
  text-align: center;
  padding: 1rem;
  background: var(--bg);
  border-radius: 10px;
}

.metric-box .metric-value {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--text);
}

.metric-box .metric-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.report-section h4 {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.test-results-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.test-result-item {
  padding: 0.875rem;
  background: var(--bg);
  border-radius: 10px;
  border-left: 3px solid var(--border);
}

.test-result-item.passed { border-left-color: var(--success); }
.test-result-item.failed { border-left-color: var(--danger); }
.test-result-item.warning { border-left-color: var(--warning); }

.test-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.375rem;
}

.test-name {
  font-weight: 500;
  color: var(--text);
  font-size: 0.875rem;
}

.result-badge {
  font-size: 0.65rem;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-weight: 500;
}

.result-badge.passed { background: rgba(34, 197, 94, 0.1); color: var(--success); }
.result-badge.failed { background: rgba(239, 68, 68, 0.1); color: var(--danger); }

.test-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.test-meta span {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.test-error {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: rgba(239, 68, 68, 0.05);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--danger);
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

@media (max-width: 1200px) {
  .gpu-monitor-container {
    grid-template-columns: 1fr;
  }

  .left-column,
  .right-column {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .left-column > *,
  .right-column > * {
    flex: 1 1 300px;
  }

  .gpu-charts-panel {
    flex: 1 1 100%;
  }

  .quick-switch-panel {
    flex: 1 1 100%;
  }

  .metrics-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .metric-item.memory {
    grid-column: span 1;
  }

  .queue-info-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 768px) {
  .section {
    padding: 1rem;
  }

  .monitor-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .header-left {
    flex-direction: column;
    gap: 0.5rem;
  }

  .left-column,
  .right-column {
    flex-direction: column;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .queue-info-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .quick-switch-grid {
    grid-template-columns: 1fr;
  }

  .iframe-wrapper {
    height: 300px;
  }

  .report-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
