<template>
  <div class="not-found-container">
    <div class="not-found-content">
      <div class="not-found-icon">
        <i class="fas fa-search"></i>
      </div>
      <h1 class="not-found-title">404</h1>
      <p class="not-found-message">页面未找到</p>
      <p class="not-found-hint">您访问的页面不存在或已被移动</p>
      <button class="btn btn-primary" @click="goBack">
        <i class="fas fa-arrow-left"></i> 返回首页
      </button>
    </div>
  </div>
</template>

<script setup>
const goBack = () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = '/';
  }
};
</script>

<style scoped>
.not-found-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
}

.not-found-content {
  text-align: center;
  padding: 2rem;
}

.not-found-icon {
  width: 120px;
  height: 120px;
  margin: 0 auto 1.5rem;
  border-radius: 50%;
  background: var(--primary-10);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  color: var(--primary-color);
}

.not-found-title {
  font-size: 4rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.not-found-message {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.not-found-hint {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0 0 1.5rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border-color);
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.btn-primary:hover {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
}
</style>