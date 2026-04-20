<template>
  <div class="controller-section">
    <div class="controller-header">
      <h3><i class="fas fa-desktop"></i> AI控制器</h3>
      <span class="controller-badge" :class="controllerConnected ? 'online' : 'offline'">
        <span class="status-dot"></span>
        {{ controllerConnected ? '已连接' : '未连接' }}
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
        <p>AI控制器未启动或配置</p>
        <p class="hint">请启动 Python 控制器服务以查看详细监控面板</p>
      </div>
    </div>
  </div>
</template>

<script setup>
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
  padding: 1.25rem;
  box-shadow: var(--shadow);
}

.controller-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.controller-header h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.controller-header h3 i {
  color: var(--primary);
}

.controller-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
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
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.iframe-wrapper {
  position: relative;
  height: 500px;
  border-radius: 12px;
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
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.iframe-placeholder p {
  margin: 0.5rem 0;
}

.iframe-placeholder .hint {
  font-size: 0.875rem;
  opacity: 0.7;
}

@media (max-width: 768px) {
  .iframe-wrapper {
    height: 300px;
  }
}
</style>
