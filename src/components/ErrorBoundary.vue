<template>
  <div class="error-boundary">
    <div v-if="error" class="error-container">
      <div class="error-icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h2 class="error-title">组件渲染错误</h2>
      <p class="error-message">{{ error.message }}</p>
      <div class="error-actions">
        <button class="btn btn-primary" @click="handleRetry">
          <i class="fas fa-redo"></i> 重试
        </button>
        <button class="btn btn-outline" @click="handleReset">
          <i class="fas fa-home"></i> 返回首页
        </button>
      </div>
      <details class="error-details">
        <summary>错误详情</summary>
        <pre class="error-stack">{{ error.stack }}</pre>
      </details>
    </div>
    <slot v-else />
  </div>
</template>

<script setup>
import { ref, onErrorCaptured } from 'vue';
import { logger } from '@/utils/logger.js';

const error = ref(null);
const retryCount = ref(0);
const MAX_RETRY_COUNT = 3;

onErrorCaptured((err, instance, info) => {
  error.value = err;
  logger.error('ErrorBoundary caught error:', err, info);
  return false;
});

const handleRetry = () => {
  if (retryCount.value < MAX_RETRY_COUNT) {
    retryCount.value++;
    error.value = null;
    window.$toast?.info(`正在重试 (${retryCount.value}/${MAX_RETRY_COUNT})`);
  } else {
    window.$toast?.error('重试次数已达上限，请返回首页或刷新页面');
  }
};

const handleReset = () => {
  window.location.href = '/';
};
</script>

<style scoped>
.error-boundary {
  min-height: 100%;
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  text-align: center;
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  margin: 2rem auto;
  max-width: 600px;
}

.error-icon {
  font-size: 4rem;
  color: var(--danger-color);
  margin-bottom: 1rem;
  animation: shake 0.5s ease-in-out;
}

.error-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.error-message {
  font-size: 1rem;
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
  max-width: 500px;
}

.error-actions {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.error-details {
  width: 100%;
  max-width: 500px;
  margin-top: 1rem;
}

.error-details summary {
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 0.875rem;
  user-select: none;
}

.error-details summary:hover {
  color: var(--primary-color);
}

.error-stack {
  margin-top: 0.5rem;
  padding: 1rem;
  background: var(--code-bg);
  color: var(--code-text);
  font-size: 0.75rem;
  border-radius: var(--radius-md);
  overflow-x: auto;
  text-align: left;
  max-height: 300px;
  overflow-y: auto;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

@media (max-width: 768px) {
  .error-container {
    padding: 2rem 1rem;
    margin: 1rem;
  }

  .error-icon {
    font-size: 3rem;
  }

  .error-title {
    font-size: 1.25rem;
  }

  .error-actions {
    flex-direction: column;
    width: 100%;
  }
}
</style>
