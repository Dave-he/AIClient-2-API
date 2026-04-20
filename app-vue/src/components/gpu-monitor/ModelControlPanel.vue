<template>
  <div class="model-control-panel">
    <div class="panel-header">
      <h3><i class="fas fa-server"></i> 模型管理</h3>
      <button class="btn-icon-sm" @click="$emit('refresh-models')" title="刷新">
        <i class="fas fa-sync-alt"></i>
      </button>
    </div>
    <div class="model-control-content" v-if="loading">
      <div class="skeleton-loader small"></div>
    </div>
    <div v-else-if="availableModels.length === 0" class="empty-state small">
      <i class="fas fa-database"></i>
      <span>暂无可用模型</span>
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
            {{ model.status === 'running' ? '运行中' : '已停止' }}
          </span>
        </div>
        <div class="model-actions">
          <button
            v-if="model.status === 'running'"
            class="btn btn-danger btn-xs"
            @click="$emit('stop-model', model.name)"
          >
            <i class="fas fa-stop"></i>
            停止
          </button>
          <button
            v-else
            class="btn btn-primary btn-xs"
            @click="$emit('switch-model', model.name)"
            :disabled="isTesting"
          >
            <i class="fas fa-play"></i>
            切换
          </button>
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

.model-list.compact .model-item {
  padding: 0.875rem;
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

.model-name {
  font-weight: 500;
  color: var(--text);
  font-size: 0.875rem;
}

.model-memory,
.model-runtime-status {
  font-size: 0.65rem;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
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

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
</style>
