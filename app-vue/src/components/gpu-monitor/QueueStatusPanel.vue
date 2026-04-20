<template>
  <div class="queue-status-panel">
    <div class="panel-header">
      <h3><i class="fas fa-tasks"></i> {{ t('gpuMonitor.queue.title') }}</h3>
    </div>
    <div class="queue-status-content" v-if="loading">
      <div class="skeleton-loader small"></div>
    </div>
    <div v-else class="queue-info-grid">
      <div class="queue-card">
        <div class="queue-icon active"><i class="fas fa-spinner"></i></div>
        <div class="queue-value">{{ queueStats.activeTasks || 0 }}</div>
        <div class="queue-label">{{ t('gpuMonitor.queue.active') }}</div>
      </div>
      <div class="queue-card">
        <div class="queue-icon waiting"><i class="fas fa-clock"></i></div>
        <div class="queue-value">{{ queueStats.waitingTasks || 0 }}</div>
        <div class="queue-label">{{ t('gpuMonitor.queue.waiting') }}</div>
      </div>
      <div class="queue-card">
        <div class="queue-icon success"><i class="fas fa-check"></i></div>
        <div class="queue-value">{{ queueStats.completedTasks || 0 }}</div>
        <div class="queue-label">{{ t('gpuMonitor.queue.completed') }}</div>
      </div>
      <div class="queue-card">
        <div class="queue-icon danger"><i class="fas fa-times"></i></div>
        <div class="queue-value">{{ queueStats.failedTasks || 0 }}</div>
        <div class="queue-label">{{ t('gpuMonitor.queue.failed') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  queueStats: {
    type: Object,
    default: () => ({})
  }
})
</script>

<style scoped>
.queue-status-panel {
  background: var(--card-bg);
  border-radius: var(--radius);
  padding: 0.75rem;
  box-shadow: var(--shadow);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  padding-bottom: 0.375rem;
  border-bottom: 1px solid var(--border);
}

.panel-header h3 {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.panel-header h3 i {
  color: var(--primary);
  font-size: 0.7rem;
}

.queue-info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.375rem;
}

.queue-card {
  text-align: center;
  padding: 0.5rem 0.25rem;
  background: var(--bg);
  border-radius: 6px;
}

.queue-icon {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  margin: 0 auto 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
}

.queue-icon.active { background: rgba(59, 130, 246, 0.1); color: var(--primary); }
.queue-icon.waiting { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
.queue-icon.success { background: rgba(34, 197, 94, 0.1); color: var(--success); }
.queue-icon.danger { background: rgba(239, 68, 68, 0.1); color: var(--danger); }

.queue-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
}

.queue-label {
  font-size: 0.6rem;
  color: var(--text-muted);
}

.skeleton-loader {
  height: 200px;
  background: linear-gradient(90deg, var(--bg) 25%, var(--border) 50%, var(--bg) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}

.skeleton-loader.small {
  height: 60px;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@media (max-width: 768px) {
  .queue-info-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>