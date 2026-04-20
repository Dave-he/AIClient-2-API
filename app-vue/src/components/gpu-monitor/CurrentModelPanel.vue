<template>
  <div class="current-model-panel">
    <div class="panel-header">
      <h3><i class="fas fa-cube"></i> {{ t('gpuMonitor.currentModel.title') }}</h3>
    </div>
    <div class="current-model-content">
      <div v-if="loading" class="skeleton-loader small"></div>
      <div v-else-if="!currentModel" class="empty-state small">
        <i class="fas fa-pause-circle"></i>
        <span>{{ t('gpuMonitor.currentModel.noModel') }}</span>
      </div>
      <div v-else class="model-running-card">
        <div class="model-icon running">
          <i class="fas fa-cube"></i>
        </div>
        <div class="model-info">
          <div class="model-name">{{ typeof currentModel === 'object' ? currentModel.name : currentModel }}</div>
          <div class="model-status">
            <span class="status-indicator running"></span>
            {{ t('gpuMonitor.currentModel.running') }}
          </div>
        </div>
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
  currentModel: {
    type: [Object, String],
    default: null
  }
})
</script>

<style scoped>
.current-model-panel {
  background: var(--card-bg);
  border-radius: var(--radius);
  padding: 1rem;
  box-shadow: var(--shadow);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}

.panel-header h3 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.panel-header h3 i {
  color: var(--primary);
}

.current-model-content {
  min-height: 70px;
  display: flex;
  align-items: center;
}

.model-running-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05));
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 10px;
  width: 100%;
}

.model-icon {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1rem;
}

.model-icon.running {
  background: linear-gradient(135deg, var(--success), #16a34a);
}

.model-info .model-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
}

.model-info .model-status {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.725rem;
  color: var(--success);
}

.status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-indicator.running {
  background: var(--success);
  animation: pulse 2s infinite;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  color: var(--text-muted);
}

.empty-state i {
  font-size: 1.5rem;
  margin-bottom: 0.375rem;
  opacity: 0.5;
}

.empty-state.small {
  padding: 0.75rem;
}

.empty-state.small i {
  font-size: 1.125rem;
}

.skeleton-loader {
  height: 200px;
  background: linear-gradient(90deg, var(--bg) 25%, var(--border) 50%, var(--bg) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 10px;
  width: 100%;
}

.skeleton-loader.small {
  height: 70px;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>