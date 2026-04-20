<template>
  <div class="queue-status-panel">
    <div class="panel-header">
      <h3><i class="fas fa-tasks"></i> {{ t('gpuMonitor.queue.title') }}</h3>
    </div>
    <div class="queue-status-content" v-if="loading">
      <div class="skeleton-loader small"></div>
    </div>
    <div v-else class="queue-info-grid">
      <div class="queue-card">
        <div class="queue-icon active"><i class="fas fa-spinner"></i></div>
        <div class="queue-value">{{ queueStats.activeTasks || 0 }}</div>
        <div class="queue-label">{{ t('gpuMonitor.queue.active') }}</div>
      </div>
      <div class="queue-card">
        <div class="queue-icon waiting"><i class="fas fa-clock"></i></div>
        <div class="queue-value">{{ queueStats.waitingTasks || 0 }}</div>
        <div class="queue-label">{{ t('gpuMonitor.queue.waiting') }}</div>
      </div>
      <div class="queue-card">
        <div class="queue-icon success">