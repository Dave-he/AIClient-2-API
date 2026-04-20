<template>
  <div class="monitor-header">
    <div class="header-left">
      <h2 id="gpu-monitor-title"><i class="fas fa-chart-line"></i> GPU监控</h2>
      <div class="connection-status" :class="controllerConnected ? 'online' : 'offline'">
        <span class="status-dot"></span>
        <span>{{ controllerConnected ? 'AI控制器已连接' : 'AI控制器未连接' }}</span>
      </div>
    </div>
    <div class="header-actions">
      <button class="btn-icon" @click="$emit('refresh')" title="刷新全部">
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  controllerConnected: {
    type: Boolean,
    default: false
  }
})

defineEmits(['refresh'])
</script>

<style scoped>
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

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@media (max-width: 768px) {
  .monitor-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .header-left {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
}
</style>
