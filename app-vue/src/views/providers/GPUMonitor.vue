<template>
  <section id="gpu-monitor" class="section" aria-labelledby="gpu-monitor-title">
    <GpuMonitorHeader
      :loading="loading"
      :controller-connected="controllerConnected"
      @refresh="refreshAll"
    />

    <div class="gpu-monitor-container">
      <div class="left-column">
        <GpuStatusPanel :loading="loading" :gpu-status="gpuStatus" />
        <GpuHistoryChartPanel
          v-model:chart-type="currentChartType"
          :chart-tabs="chartTabs"
          :chart-data="chartData"
        />
      </div>

      <div class="right-column">
        <CurrentModelPanel :loading="loading" :current-model="currentModel" />
        <QueueStatusPanel :loading="loadingQueue" :queue-stats="queueStats" />
        <ModelControlPanel
          :loading="loadingControl"
          :available-models="availableModels"
          :is-testing="isTesting"
          @refresh-models="loadAvailableModels"
          @switch-model="switchModel"
          @stop-model="stopModel"
        />
      </div>
    </div>

    <ControllerPanel
      :controller-connected="controllerConnected"
      :controller-url="controllerUrl"
    />

    <ModelTestReportModal
      :visible="showTestReport"
      :report="testReport"
      @update:visible="showTestReport = $event"
      @close="closeTestReport"
    />
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import GpuMonitorHeader from '@/components/gpu-monitor/GpuMonitorHeader.vue'
import GpuStatusPanel from '@/components/gpu-monitor/GpuStatusPanel.vue'
import GpuHistoryChartPanel from '@/components/gpu-monitor/GpuHistoryChartPanel.vue'
import CurrentModelPanel from '@/components/gpu-monitor/CurrentModelPanel.vue'
import QueueStatusPanel from '@/components/gpu-monitor/QueueStatusPanel.vue'
import ModelControlPanel from '@/components/gpu-monitor/ModelControlPanel.vue'
import ControllerPanel from '@/components/gpu-monitor/ControllerPanel.vue'
import ModelTestReportModal from '@/components/gpu-monitor/ModelTestReportModal.vue'

const { t } = useI18n()

const loading = ref(true)
const loadingModels = ref(true)
const loadingQueue = ref(true)
const loadingControl = ref(true)
const gpuStatus = ref(null)
const models = ref([])
const queueStats = ref({})
const availableModels = ref([])
const currentChartType = ref('all')
const controllerConnected = ref(false)
const currentModel = ref(null)

const testReport = ref(null)
const isTesting = ref(false)
const showTestReport = ref(false)

const chartData = ref({
  time: [],
  utilization: [],
  temperature: [],
  memory: [],
  power: [],
  powerPercent: []
})

const chartTabs = [
  { type: 'all', label: t('gpuMonitor.history.overview') },
  { type: 'utilization', label: t('gpuMonitor.utilization') },
  { type: 'temperature', label: t('gpuMonitor.temperature') },
  { type: 'memory', label: t('gpuMonitor.memory') },
  { type: 'power', label: t('gpuMonitor.power') }
]

const controllerUrl = ref('/api/python/manage')

const addChartData = (utilization, temperature, memory, power, powerPercent = 0) => {
  const now = new Date()
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

  chartData.value.time.push(timeStr)
  chartData.value.utilization.push(utilization)
  chartData.value.temperature.push(temperature)
  chartData.value.memory.push(memory)
  chartData.value.power.push(power)
  chartData.value.powerPercent.push(powerPercent)

  if (chartData.value.time.length > 30) {
    chartData.value.time.shift()
    chartData.value.utilization.shift()
    chartData.value.temperature.shift()
    chartData.value.memory.shift()
    chartData.value.power.shift()
    chartData.value.powerPercent.shift()
  }
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
    const usedMemoryBytes = gpuData.used_memory || 0
    const totalMemoryBytes = gpuData.total_memory || 0
    const memoryUtilizationFromBytes = totalMemoryBytes > 0 ? Math.round((usedMemoryBytes / totalMemoryBytes) * 100) : 0
    const memoryUtilization = gpuData.memory_utilization ?? memoryUtilizationFromBytes
    const powerPercent = gpuData.power_percent ?? (
      gpuData.power_limit && gpuData.power_draw
        ? Math.round((gpuData.power_draw / gpuData.power_limit) * 100)
        : 0
    )
    gpuStatus.value = {
      ...gpuStatus.value,
      ...gpuData,
      memory_utilization: memoryUtilization,
      power_percent: powerPercent,
      status: gpuData.status || (gpuData.utilization !== undefined ? 'available' : 'unavailable')
    }

    if (gpuData.history && gpuData.history.length > 0) {
      const historyData = gpuData.history.map(item => {
        const usedMem = Number(item.used_memory || 0)
        const totalMem = Number(item.total_memory || 0)
        const memUtil = item.memory_utilization ?? (totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0)
        const pwrPercent = item.power_percent ?? (item.power_limit && item.power_draw ? Math.round((item.power_draw / item.power_limit) * 100) : 0)
        const timestamp = item.timestamp || item.time || Date.now()
        const date = new Date(timestamp)
        const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`

        return {
          time: timeStr,
          utilization: item.utilization ?? 0,
          temperature: item.temperature ?? 0,
          memory: memUtil,
          power: item.power_draw ?? 0,
          powerPercent: pwrPercent
        }
      })

      chartData.value.time = historyData.map(d => d.time)
      chartData.value.utilization = historyData.map(d => d.utilization)
      chartData.value.temperature = historyData.map(d => d.temperature)
      chartData.value.memory = historyData.map(d => d.memory)
      chartData.value.power = historyData.map(d => d.power)
      chartData.value.powerPercent = historyData.map(d => d.powerPercent)
    }

    const currentUtilization = gpuData.utilization ?? 0
    const currentTemperature = gpuData.temperature ?? 0
    const currentPowerDraw = gpuData.power_draw ?? 0

    addChartData(
      currentUtilization,
      currentTemperature,
      memoryUtilization,
      currentPowerDraw,
      powerPercent
    )
  }

  if (modelsData) {
    let modelsArray = []
    if (Array.isArray(modelsData)) {
      modelsArray = modelsData.map(m => ({
        ...m,
        requiredMemory: m.requiredMemory || m.required_memory || null
      }))
    } else if (typeof modelsData === 'object' && modelsData !== null) {
      modelsArray = Object.entries(modelsData).map(([name, info]) => ({
        name,
        status: info.running ? 'running' : 'stopped',
        running: info.running || false,
        port: info.port || null,
        service: info.service || null,
        activeRequests: info.active_requests || 0,
        preloaded: info.preloaded || false,
        requiredMemory: info.requiredMemory || info.required_memory || null,
        description: info.description || ''
      }))
    }
    models.value = modelsArray

    if (!requestCache.availableModels.data || Date.now() - requestCache.availableModels.timestamp > CACHE_DURATION) {
      availableModels.value = modelsArray
      requestCache.availableModels = { timestamp: Date.now(), data: modelsArray }
    }
  }

  if (queueData) {
    queueStats.value = queueData
  }

  if (summaryData) {
    if (summaryData.running_model) {
      const runningModelName = typeof summaryData.running_model === 'string'
        ? summaryData.running_model
        : summaryData.running_model.name

      const runningModelFromSummary = summaryData.models?.find(m => m.name === runningModelName || m.running)

      if (runningModelFromSummary) {
        currentModel.value = {
          name: runningModelFromSummary.name,
          status: 'running',
          port: runningModelFromSummary.port || null,
          memory: runningModelFromSummary.required_memory || runningModelFromSummary.memory || null
        }
      } else {
        currentModel.value = {
          name: runningModelName,
          status: 'running'
        }
      }
    } else if (summaryData.models && summaryData.models.length > 0) {
      const runningModel = summaryData.models.find(m => m.running)
      if (runningModel) {
        currentModel.value = {
          name: runningModel.name,
          status: 'running',
          port: runningModel.port || null,
          memory: runningModel.required_memory || runningModel.memory || null
        }
      } else {
        currentModel.value = null
      }
    } else {
      currentModel.value = null
    }
  }

  if (healthData !== undefined) {
    controllerConnected.value = healthData.status === 'healthy' || healthData.success
  }
}

const applyFallbackData = () => {
  gpuStatus.value = {
    status: 'unavailable',
    message: t('gpuMonitor.noGpu')
  }

  models.value = []
  availableModels.value = []
  queueStats.value = {
    activeTasks: 0,
    waitingTasks: 0,
    completedTasks: 0,
    failedTasks: 0
  }
  currentModel.value = null
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
      if (result.success && result.models) {
        const modelsData = result.models
        let modelsArray = []

        if (Array.isArray(modelsData)) {
          modelsArray = modelsData.map(m => ({
            ...m,
            requiredMemory: m.requiredMemory || m.required_memory || null
          }))
        } else if (typeof modelsData === 'object' && modelsData !== null) {
          modelsArray = Object.entries(modelsData).map(([name, info]) => ({
            name,
            status: info.running ? 'running' : 'stopped',
            running: info.running || false,
            port: info.port || null,
            service: info.service || null,
            activeRequests: info.active_requests || 0,
            preloaded: info.preloaded || false,
            requiredMemory: info.requiredMemory || info.required_memory || null,
            description: info.description || ''
          }))
        }

        availableModels.value = modelsArray
        requestCache.availableModels = { timestamp: now, data: modelsArray }
      } else {
        availableModels.value = []
      }
    } else {
      availableModels.value = []
    }
  } catch (error) {
    console.error('Failed to fetch available models:', error)
    availableModels.value = []
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

    window.$toast?.info(`${t('gpuMonitor.model.switch')}: ${modelName}`)

    const response = await fetch(`/api/python/test/model/${encodeURIComponent(modelName)}/switch-and-test`, {
      method: 'POST'
    })

    if (response.ok) {
      const result = await response.json()

      if (result.success) {
        window.$toast?.success(`${t('gpuMonitor.model.switch')}: ${modelName}`)
        if (result.status === 'completed' && result.report) {
          testReport.value = result.report
          showTestReport.value = true
        }
      } else {
        window.$toast?.error(result.error?.message || `${t('common.操作失败')}: ${modelName}`)
      }

      requestCache.monitorSummary.timestamp = 0
      requestCache.availableModels.timestamp = 0

      debouncedFetchMonitorSummary()
      debouncedLoadAvailableModels()
    } else {
      const error = await response.json()
      window.$toast?.error(error.error?.message || `${t('common.操作失败')}: ${modelName}`)
    }
  } catch (error) {
    console.error('Failed to switch model:', error)
    window.$toast?.error(`${t('common.操作失败')}: ${error.message}`)
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
        window.$toast?.success(`${t('gpuMonitor.model.stop')}: ${modelName}`)
        requestCache.availableModels.timestamp = 0
        debouncedLoadAvailableModels()
        debouncedFetchMonitorSummary()
      } else {
        window.$toast?.error(result.error?.message || `${t('common.操作失败')}: ${modelName}`)
      }
    } else {
      const error = await response.json()
      window.$toast?.error(error.error?.message || `${t('common.操作失败')}: ${modelName}`)
    }
  } catch (error) {
    console.error('Failed to stop model:', error)
    window.$toast?.error(`${t('common.操作失败')}: ${error.message}`)
  }
}

const closeTestReport = () => {
  showTestReport.value = false
  testReport.value = null
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
  debouncedFetchMonitorSummary()
  debouncedLoadAvailableModels()
  startPolling()
})

onUnmounted(() => {
  stopPolling()
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
  --radius: 10px;
  --shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03);
}

.section {
  padding: 0.75rem;
  max-width: 1600px;
  margin: 0 auto;
}

.gpu-monitor-container {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.left-column,
.right-column {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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
    flex: 1 1 260px;
  }
}

@media (max-width: 768px) {
  .section {
    padding: 0.5rem;
  }

  .left-column,
  .right-column {
    flex-direction: column;
  }

  .gpu-monitor-container {
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
}
</style>