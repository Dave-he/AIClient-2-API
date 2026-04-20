<template>
  <div class="provider-node" :class="{ healthy: node.healthy, unhealthy: !node.healthy }">
    <div class="node-header">
      <div class="node-status">
        <span 
          class="status-indicator"
          :class="{ healthy: node.healthy, unhealthy: !node.healthy }"
        ></span>
        <span class="node-name">{{ node.name || '未命名' }}</span>
      </div>
      <div class="node-actions">
        <button 
          class="btn btn-sm btn-outline" 
          @click="$emit('edit')"
          title="编辑"
        >
          <i class="fas fa-edit"></i>
        </button>
        <button 
          class="btn btn-sm btn-outline" 
          @click="$emit('health')"
          title="健康检查"
        >
          <i class="fas fa-heartbeat"></i>
        </button>
        <button 
          class="btn btn-sm btn-danger" 
          @click="$emit('delete')"
          title="删除"
        >
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
    
    <div class="node-info">
      <div class="info-row" v-if="node.uuid">
        <span class="info-label">UUID</span>
        <span class="info-value mono">{{ node.uuid }}</span>
      </div>
      <div class="info-row" v-if="node.email">
        <span class="info-label">邮箱</span>
        <span class="info-value">{{ node.email }}</span>
      </div>
      <div class="info-row" v-if="node.apiKey">
        <span class="info-label">API Key</span>
        <span class="info-value mono">****</span>
      </div>
      <div class="info-row">
        <span class="info-label">状态</span>
        <span class="info-value" :class="{ healthy: node.healthy, unhealthy: !node.healthy }">
          {{ node.healthy ? '健康' : '异常' }}
        </span>
      </div>
      <div class="info-row" v-if="node.lastUsed">
        <span class="info-label">最后使用</span>
        <span class="info-value">{{ node.lastUsed }}</span>
      </div>
      <div class="info-row" v-if="node.requestCount !== undefined">
        <span class="info-label">请求数</span>
        <span class="info-value">{{ node.requestCount }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  node: {
    type: Object,
    required: true
  }
});

defineEmits(['edit', 'health', 'delete']);
</script>

<style scoped>
.provider-node {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 0.875rem;
  transition: var(--transition);
}

.provider-node:hover {
  box-shadow: var(--shadow-md);
}

.provider-node.healthy {
  border-color: rgba(var(--success-color-rgb), 0.3);
}

.provider-node.unhealthy {
  border-color: rgba(var(--danger-color-rgb), 0.3);
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.node-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-tertiary);
}

.status-indicator.healthy {
  background: var(--success-color);
  box-shadow: 0 0 8px var(--success-color);
}

.status-indicator.unhealthy {
  background: var(--danger-color);
  box-shadow: 0 0 8px var(--danger-color);
}

.node-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.node-actions {
  display: flex;
  gap: 0.25rem;
}

.btn {
  padding: 0.375rem 0.625rem;
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-secondary);
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.6875rem;
}

.btn-outline {
  background: transparent;
  border-color: var(--border-color);
}

.btn-outline:hover {
  background: var(--bg-tertiary);
}

.btn-danger {
  border-color: var(--danger-border);
  color: var(--danger-color);
}

.btn-danger:hover {
  background: var(--danger-bg-light);
}

.node-info {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.info-value {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.info-value.mono {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
}

.info-value.healthy {
  color: var(--success-color);
}

.info-value.unhealthy {
  color: var(--danger-color);
}
</style>