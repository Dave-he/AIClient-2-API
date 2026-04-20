<template>
  <div class="controller-section">
    <div class="controller-header">
      <h3><i class="fas fa-desktop"></i> {{ t('gpuMonitor.controller.title') }}</h3>
      <span class="controller-badge" :class="controllerConnected ? 'online' : 'offline'">
        <span class="status-dot"></span>
        {{ controllerConnected ? t('gpuMonitor.controller.connected') : t('gpuMonitor.controller.disconnected') }}
      </span>
    </div>
    <div class="iframe-wrapper">
      <iframe
        v-if="controllerConnected"
        id="controllerIframe"
        :src="controllerUrl"
        frameborder="0"
        allowfullscreen
      ></iframe>
      <div v-else class="iframe-placeholder">
        <i class="fas fa-server"></i>
        <p>{{ t('gpuMonitor.controller.notStarted') }}</p>
        <p class="hint">{{ t('gpuMonitor.controller.hint') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps({
  controllerConnected: {
    type: Boolean,
    default: false
  },
  controllerUrl: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.controller-section {
  background: var(--card-bg);
  border-radius: var(--radius);
  padding: 0.75rem;
  box-shadow: var(--shadow);
}

.controller-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.controller-header h3 {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.controller-header h3 i {
  color: var(--primary);
  font-size: 0.7rem;
}

.controller-badge {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.6rem;
  font-weight: 500;
}

.controller-badge.online {
  background: rgba(34, 197, 94, 0.1);
  color: var(--success);
}

.controller-badge.offline {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.iframe-wrapper {
  position: relative;
  height: 320px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
}

#controllerIframe {
  width: 100%;
  height: 100%;
}

.iframe-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  color: var(--text-muted);
}

.iframe-placeholder i {
  font-size: 1.75rem;
  margin-bottom: 0.5rem;
  opacity: 0.5;
}

.iframe-placeholder p {
  margin: 0.25rem 0;
  font-size: 0.8rem;
}

.iframe-placeholder .hint {
  font-size: 0.65rem;
  opacity: 0.7;
}

@media (max-width: 768px) {
  .iframe-wrapper {
    height: 220px;
  }
}
</style>