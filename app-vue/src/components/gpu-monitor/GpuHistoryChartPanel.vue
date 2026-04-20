<template>
  <div class="gpu-charts-panel">
    <div class="panel-header">
      <h3><i class="fas fa-chart-area"></i> 历史监控</h3>
      <div class="chart-tabs">
        <button
          v-for="tab in chartTabs"
          :key="tab.type"
          class="chart-tab"
          :class="{ active: chartType === tab.type }"
          @click="$emit('update:chartType', tab.type)"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <div class="gpu-chart-content">
      <canvas ref="chartCanvas"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  chartTabs: {
    type: Array,
    default: () => []
  },
  chartType: {
    type: String,
    default: 'utilization'
  },
  chartData: {
    type: Object,
    default: () => ({ time: [], utilization: [], temperature: [], memory: [], power: [], powerPercent: [] })
  }
})

defineEmits(['update:chartType'])

const chartCanvas = ref(null)
let chartInstance = null

const colors = {
  all: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  utilization: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  temperature: { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  memory: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  power: { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' }
}

const generateDatasets = () => {
  if (props.chartType === 'all') {
    return [
      {
        label: 'GPU使用率',
        data: props.chartData.utilization || [],
        borderColor: colors.utilization.border,
        backgroundColor: colors.utilization.bg,
        fill: false,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
        yAxisID: 'y'
      },
      {
        label: '显存使用率',
        data: props.chartData.memory || [],
        borderColor: colors.memory.border,
        backgroundColor: colors.memory.bg,
        fill: false,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
        yAxisID: 'y'
      },
      {
        label: '功耗占比',
        data: props.chartData.powerPercent || [],
        borderColor: colors.power.border,
        backgroundColor: colors.power.bg,
        fill: false,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
        borderDash: [6, 4],
        yAxisID: 'y'
      },
      {
        label: '温度',
        data: props.chartData.temperature || [],
        borderColor: colors.temperature.border,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        fill: false,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
        yAxisID: 'y1'
      }
    ]
  }

  const config = colors[props.chartType] || colors.utilization
  return [{
    label: props.chartTabs.find(t => t.type === props.chartType)?.label || '',
    data: props.chartType === 'power' ? (props.chartData.power || []) : (props.chartData[props.chartType] || []),
    borderColor: config.border,
    backgroundColor: config.bg,
    fill: true,
    tension: 0.4,
    pointRadius: 0,
    borderWidth: 2,
    yAxisID: 'y'
  }]
}

const getYMax = () => {
  const maxMap = {
    all: 100,
    utilization: 100,
    temperature: 100,
    memory: 100,
    power: 300
  }
  return maxMap[props.chartType] || 100
}

const getYTitle = () => {
  return props.chartType === 'power' ? '功耗 (W)' : '占比 (%)'
}

const getSecondaryYMax = () => {
  const temperatureValues = props.chartData.temperature || []
  const maxTemperature = Math.max(100, ...temperatureValues)
  return Math.ceil(maxTemperature / 10) * 10
}

const createChart = () => {
  if (!chartCanvas.value) return
  const ctx = chartCanvas.value.getContext('2d')

  chartInstance = new (window.Chart || require('chart.js').Chart)(ctx, {
    type: 'line',
    data: {
      labels: props.chartData.time,
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
          display: props.chartType === 'all',
          position: 'bottom',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            boxHeight: 8,
            color: '#64748b',
            padding: 16
          }
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
          title: {
            display: true,
            text: getYTitle(),
            color: '#64748b'
          },
          min: 0,
          max: getYMax()
        },
        y1: {
          display: props.chartType === 'all',
          position: 'right',
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            color: '#ef4444'
          },
          title: {
            display: props.chartType === 'all',
            text: '温度 (°C)',
            color: '#ef4444'
          },
          min: 0,
          max: getSecondaryYMax()
        }
      },
      animation: {
        duration: 300
      }
    }
  })
}

const updateChart = () => {
  if (!chartInstance) return
  chartInstance.data.labels = props.chartData.time
  chartInstance.data.datasets = generateDatasets()
  chartInstance.options.plugins.legend.display = props.chartType === 'all'
  chartInstance.options.scales.y.max = getYMax()
  chartInstance.options.scales.y.title.text = getYTitle()
  chartInstance.options.scales.y1.display = props.chartType === 'all'
  chartInstance.options.scales.y1.title.display = props.chartType === 'all'
  chartInstance.options.scales.y1.max = getSecondaryYMax()
  chartInstance.update('none')
}

watch(() => props.chartType, updateChart)
watch(() => props.chartData, updateChart, { deep: true })

onMounted(createChart)

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy()
  }
})
</script>

<style scoped>
.gpu-charts-panel {
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
</style>
