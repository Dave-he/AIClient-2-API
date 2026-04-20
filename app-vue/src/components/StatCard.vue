<template>
  <div class="stat-item" :class="{ [type]: type }">
    <div class="stat-icon-wrapper" :class="{ [type]: type }">
      <i :class="['fas', icon]"></i>
    </div>
    <div class="stat-content" :class="{ [type]: type }">
      <span class="stat-value">{{ value }}</span>
      <span class="stat-label">{{ label }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  icon: {
    type: String,
    required: true
  },
  value: {
    type: [String, Number],
    required: true
  },
  label: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: '',
    validator: (val) => ['', 'cpu', 'memory', 'gpu', 'uptime'].includes(val)
  }
});
</script>

<style scoped>
.stat-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-right: 1px solid var(--border-color);
  transition: var(--transition);
}

.stat-item:last-child {
  border-right: none;
}

.stat-item:hover {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.stat-icon-wrapper {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  color: var(--primary-color);
  background: var(--primary-10);
  flex-shrink: 0;
}

.stat-icon-wrapper.cpu {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
}

.stat-icon-wrapper.memory {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
}

.stat-icon-wrapper.gpu {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
}

.stat-icon-wrapper.uptime {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  color: white;
}

.stat-content.uptime .stat-value {
  font-size: 0.875rem;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.stat-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 0.65rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>