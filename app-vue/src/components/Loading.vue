<template>
  <div class="loading-overlay" :class="{ fullscreen: fullscreen }" v-if="visible">
    <div class="loading-content">
      <div class="loading-spinner" :class="sizeClass">
        <div class="spinner-ring"></div>
        <div class="spinner-ring spinner-ring-delay-1"></div>
        <div class="spinner-ring spinner-ring-delay-2"></div>
      </div>
      <span class="loading-text" v-if="text">{{ text }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  text: {
    type: String,
    default: '加载中...'
  },
  fullscreen: {
    type: Boolean,
    default: true
  },
  size: {
    type: String,
    default: 'default',
    validator: (value) => ['small', 'default', 'large'].includes(value)
  }
});

const sizeClass = computed(() => {
  if (props.size === 'small') return 'spinner-small';
  if (props.size === 'large') return 'spinner-large';
  return '';
});
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.loading-spinner {
  position: relative;
  width: 64px;
  height: 64px;
}

.loading-spinner.spinner-small {
  width: 32px;
  height: 32px;
}

.loading-spinner.spinner-large {
  width: 96px;
  height: 96px;
}

.spinner-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 3px solid transparent;
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
}

.spinner-ring-delay-1 {
  animation-delay: -0.4s;
  border-top-color: var(--info-color);
}

.spinner-ring-delay-2 {
  animation-delay: -0.8s;
  border-top-color: var(--warning-color);
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 0.875rem;
  color: var(--text-primary);
  background: var(--bg-primary);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}
</style>