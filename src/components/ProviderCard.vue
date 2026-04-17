<template>
  <div class="provider-card" :class="provider.status">
    <div class="provider-header">
      <span class="status-dot" :class="provider.status"></span>
      <span class="provider-name">{{ provider.name }}</span>
    </div>
    <div class="provider-info">
      <span class="provider-accounts">{{ provider.accounts }} 账户</span>
      <span class="provider-requests">{{ provider.requests }} 请求</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  provider: {
    type: Object,
    required: true,
    validator: (val) => ['healthy', 'warning', 'error'].includes(val.status)
  }
});
</script>

<style scoped>
.provider-card {
  padding: 0.875rem;
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  transition: var(--transition);
  cursor: pointer;
}

.provider-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.provider-card.healthy {
  border-color: rgba(var(--success-color-rgb), 0.3);
  background: rgba(var(--success-color-rgb), 0.05);
}

.provider-card.warning {
  border-color: rgba(var(--warning-color-rgb), 0.3);
  background: rgba(var(--warning-color-rgb), 0.05);
}

.provider-card.error {
  border-color: rgba(var(--danger-color-rgb), 0.3);
  background: rgba(var(--danger-color-rgb), 0.05);
}

.provider-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-tertiary);
}

.status-dot.healthy {
  background: var(--success-color);
  box-shadow: 0 0 8px var(--success-color);
}

.status-dot.warning {
  background: var(--warning-color);
  box-shadow: 0 0 8px var(--warning-color);
}

.status-dot.error {
  background: var(--danger-color);
  box-shadow: 0 0 8px var(--danger-color);
}

.provider-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.provider-info {
  display: flex;
  gap: 1rem;
}

.provider-accounts,
.provider-requests {
  font-size: 0.75rem;
  color: var(--text-secondary);
}
</style>