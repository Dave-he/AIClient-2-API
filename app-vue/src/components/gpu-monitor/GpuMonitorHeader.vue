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
  margin-bottom: 1rem;
  padding: 0.875rem 1.25rem;
  background: var(--card-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-left h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.header-left h2 i {
  color: var(--primary);
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.725rem;
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
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.connection-status.online .status-dot {
  animation: pulse 2s infinite;
}

.header-actions {
  display: flex;
  gap: 0.375rem;
}

.btn-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
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
    gap: 0.75rem;
    align-items: flex-start;
  }

  .header-left {
    flex-direction: column;
    gap: 0.375rem;
    align-items: flex-start;
  }
}
</style>