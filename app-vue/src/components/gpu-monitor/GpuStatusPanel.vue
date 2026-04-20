<template>
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
</template>

<script setup>
defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  gpuStatus: {
    type: Object,
    default: null
  }
})

const formatMemory = (bytes) => {
  if (!bytes) return '0 GB'
  return (bytes / (1024 ** 3)).toFixed(1) + ' GB'
}
</script>

<style scoped>
.gpu-status-panel {
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
.metric-value-row .total,
.metric-value-row .unit {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.metric-value-row.single .value {
  font-size: 1.5rem;
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

.skeleton-loader {
  height: 200px;
  background: linear-gradient(90deg, var(--bg) 25%, var(--border) 50%, var(--bg) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 12px;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@media (max-width: 768px) {
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
