<template>
  <div class="monitor-header">
    <div class="header-left">
      <h2 id="gpu-monitor-title"><i class="fas fa-chart-line"></i> {{ t('gpuMonitor.title') }}</h2>
      <div class="connection-status" :class="controllerConnected ? 'online' : 'offline'">
        <span class="status-dot"></span>
        <span>{{ controllerConnected ? t('gpuMonitor.controller.connected') : t('gpuMonitor.controller.disconnected') }}</span>
      </div>
    </div>
    <div class="header-actions">
      <button class="btn-icon" @click="$emit('refresh')" :title="t('gpuMonitor.refresh')">
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i>
      </button>
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
  margin-bottom: 0.75rem;
  padding: 0.625rem 1rem;
  background: var(--card-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-left h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.header-left h2 i {
  color: var(--primary);
  font-size: 0.9rem;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1875rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.65rem;
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
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.connection-status.online .status-dot {
  animation: pulse 2s infinite;
}

.header-actions {
  display: flex;
  gap: 0.25rem;
}

.btn-icon {
  width: 28px;
  height: 28px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  font-size: 0.8rem;
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
    gap: 0.5rem;
    align-items: flex-start;
  }

  .header-left {
    flex-direction: column;
    gap: 0.25rem;
    align-items: flex-start;
  }
}
</style>