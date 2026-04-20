<template>
  <Modal
    :visible="visible && !!report"
    title="模型测试报告"
    icon="fa-file-alt"
    size="large"
    @update:visible="handleVisibleChange"
    @close="$emit('close')"
  >
    <div v-if="report" class="modal-body-content">
      <div class="report-summary">
        <div class="model-info-row">
          <span class="model-name">{{ report.model_name }}</span>
          <span class="test-time">{{ report.test_timestamp }}</span>
        </div>
        <span class="status-badge" :class="getStatusClass(report.overall_status)">
          {{ getStatusText(report.overall_status) }}
        </span>
      </div>

      <div class="report-metrics">
        <div class="metric-box">
          <div class="metric-value">{{ report.performance_metrics?.overall?.avg_tps?.toFixed(2) || '--' }}</div>
          <div class="metric-label">平均 TPS</div>
        </div>
        <div class="metric-box">
          <div class="metric-value">{{ report.performance_metrics?.overall?.avg_latency?.toFixed(3) || '--' }}s</div>
          <div class="metric-label">平均延迟</div>
        </div>
        <div class="metric-box">
          <div class="metric-value">{{ report.performance_metrics?.overall?.pass_rate?.toFixed(1) || '--' }}%</div>
          <div class="metric-label">通过率</div>
        </div>
      </div>

      <div class="report-section" v-if="report.test_results?.length > 0">
        <h4><i class="fas fa-list-check"></i> 测试详情</h4>
        <div class="test-results-list">
          <div
            v-for="result in report.test_results"
            :key="result.test_name"
            class="test-result-item"
            :class="result.status"
          >
            <div class="test-header">
              <span class="test-name">{{ getTestName(result.test_name) }}</span>
              <span class="result-badge" :class="result.status">{{ result.status }}</span>
            </div>
            <div class="test-meta">
              <span><i class="fas fa-clock"></i> {{ result.duration?.toFixed(3) }}s</span>
              <span v-if="result.metrics?.tps"><i class="fas fa-tachometer-alt"></i> {{ result.metrics.tps.toFixed(2) }} TPS</span>
            </div>
            <div v-if="result.error" class="test-error">
              <i class="fas fa-exclamation-triangle"></i> {{ result.error }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script setup>
import Modal from '@/components/Modal.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  report: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'update:visible'])

const handleVisibleChange = (value) => {
  emit('update:visible', value)
  if (!value) {
    emit('close')
  }
}

const getStatusClass = (status) => {
  const map = {
    passed: 'success',
    degraded: 'warning',
    failed: 'error',
    partial: 'info'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    passed: '全部通过',
    degraded: '部分失败',
    failed: '测试失败',
    partial: '部分完成'
  }
  return map[status] || status
}

const getTestName = (testName) => {
  const map = {
    chat_basic: '基础聊天',
    chat_streaming: '流式响应',
    tool_integration: '工具调用',
    image_processing: '图片处理'
  }
  return map[testName] || testName
}
</script>

<style scoped>
.modal-body-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.report-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.model-info-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.model-info-row .model-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.model-info-row .test-time {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.status-badge {
  padding: 0.375rem 0.875rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge.success { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
.status-badge.warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
.status-badge.error { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.status-badge.info { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }

.report-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.metric-box {
  text-align: center;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 10px;
}

.metric-box .metric-value {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--text-primary);
}

.metric-box .metric-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.report-section h4 {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.test-results-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.test-result-item {
  padding: 0.875rem;
  background: var(--bg-secondary);
  border-radius: 10px;
  border-left: 3px solid var(--border-color);
}

.test-result-item.passed { border-left-color: #22c55e; }
.test-result-item.failed { border-left-color: #ef4444; }
.test-result-item.warning { border-left-color: #f59e0b; }

.test-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.375rem;
}

.test-name {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.result-badge {
  font-size: 0.65rem;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-weight: 500;
}

.result-badge.passed { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
.result-badge.failed { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

.test-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.test-meta span {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.test-error {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: rgba(239, 68, 68, 0.05);
  border-radius: 6px;
  font-size: 0.75rem;
  color: #ef4444;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

@media (max-width: 768px) {
  .report-summary {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .report-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
