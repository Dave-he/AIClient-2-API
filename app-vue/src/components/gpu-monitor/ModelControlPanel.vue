<template>
  <div class="model-control-panel">
    <div class="panel-header">
      <h3><i class="fas fa-server"></i> {{ t('gpuMonitor.modelControl.title') }}</h3>
      <button class="btn-icon-sm" @click="$emit('refresh-models')" :title="t('common.refresh')">
        <i class="fas fa-sync-alt"></i>
      </button>
    </div>
    <div class="model-control-content" v-if="loading">
      <div class="skeleton-loader small"></div>
    </div>
    <div v-else-if="availableModels.length === 0" class="empty-state small">
      <i class="fas fa-database"></i>
      <span>{{ t('gpuMonitor.modelControl.noModels') }}</span>
    </div>
    <div v-else class="model-list compact">
      <div
        v-for="model in availableModels"
        :key="model.name"
        class="model-item"
        :class="{ active: model.status === 'running' }"
      >
        <div class="model-info">
          <span class="model-name">{{ model.name }}</span>
          <span v-if="model.requiredMemory" class="model-memory">{{ model.requiredMemory }}GB</span>
          <span class="model-runtime-status" :class="model.status === 'running' ? 'running' : 'stopped'">
            {{ model.status === 'running' ? t('gpuMonitor.running') : t('gpuMonitor.modelControl.stopped') }}
          </span>
        </div>
        <div class="model-actions">
          <button
            v-if="model.status === 'running'"
            class="btn btn-danger btn-xs"
            @click="$emit('stop-model', model.name)"
          >
            <i class="fas fa-stop"></i>
            {{ t('gpuMonitor.modelControl.stop') }}
          </button>
          <button
            v-else
            class="btn btn-primary btn-xs"
            @click="$emit('switch-model', model.name)"
            :disabled="isTesting"
          >
            <i class="fas fa-play"></i>
            {{ t('gpuMonitor.modelControl.switch') }}
          </button>
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
  availableModels: {
    type: Array,
    default: () => []
  },
  isTesting: {
    type: Boolean,
    default: false
  }
})

defineEmits(['refresh-models', 'switch-model', 'stop-model'])
</script>

<style scoped>
.model-control-panel {
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

.btn-icon-sm {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: none;
  background: var(--bg);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.625rem;
  transition: all 0.2s;
}

.btn-icon-sm:hover {
  color: var(--primary);
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.model-list.compact .model-item {
  padding: 0.5rem;
}

.model-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem;
  background: var(--bg);
  border-radius: 6px;
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
  gap: 0.25rem;
  flex-wrap: wrap;
}

.model-name {
  font-weight: 500;
  color: var(--text);
  font-size: 0.75rem;
}

.model-memory,
.model-runtime-status {
  font-size: 0.55rem;
  padding: 0.0875rem 0.25rem;
  border-radius: 3px;
  font-weight: 500;
}

.model-memory {
  background: rgba(245, 158, 11, 0.1);
  color: var(--warning);
}

.model-runtime-status.running {
  background: rgba(34, 197, 94, 0.1);
  color: var(--success);
}

.model-runtime-status.stopped {
  background: rgba(148, 163, 184, 0.14);
  color: var(--text-secondary);
}

.btn {
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-size: 0.6rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
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
  padding: 0.15rem 0.35rem;
  font-size: 0.575rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  color: var(--text-muted);
}

.empty-state i {
  font-size: 1.25rem;
  margin-bottom: 0.25rem;
  opacity: 0.5;
}

.empty-state.small {
  padding: 0.5rem;
}

.empty-state.small i {
  font-size: 1rem;
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
</style>