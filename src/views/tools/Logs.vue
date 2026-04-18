<template>
  <section id="logs" class="section" aria-labelledby="logs-title">
    <h2 id="logs-title">实时日志</h2>
    <div class="logs-controls">
      <div class="log-level-filter">
        <select v-model="logLevelFilter" class="form-control">
          <option value="all">全部级别</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
          <option value="DEBUG">DEBUG</option>
        </select>
      </div>
      <button class="btn btn-danger" @click="clearLogs">
        <i class="fas fa-trash"></i> 清空日志
      </button>
      <button class="btn btn-secondary" @click="downloadLogs">
        <i class="fas fa-download"></i> 下载日志
      </button>
      <button 
        class="btn" 
        :class="autoScroll ? 'btn-primary' : 'btn-outline'"
        @click="toggleAutoScroll"
      >
        <i class="fas fa-arrow-down"></i> 自动滚动: {{ autoScroll ? '开' : '关' }}
      </button>
    </div>
    <div 
      class="logs-container" 
      ref="logsContainer"
      role="log" 
      aria-live="polite" 
      aria-atomic="false"
    >
      <div 
        v-for="(log, index) in filteredLogs" 
        :key="index"
        class="log-entry"
        :class="log.level.toLowerCase()"
      >
        <span class="log-time">{{ log.time }}</span>
        <span class="log-level" :class="log.level.toLowerCase()">{{ log.level }}</span>
        <span class="log-message">{{ log.message }}</span>
      </div>
      <div v-if="logs.length === 0" class="empty-logs">
        <i class="fas fa-file-alt"></i>
        <span>暂无日志</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const logs = ref([])
const logLevelFilter = ref('all')
const autoScroll = ref(true)
const logsContainer = ref(null)
let eventSource = null
let pollInterval = null

const filteredLogs = computed(() => {
  if (logLevelFilter.value === 'all') return logs.value
  return logs.value.filter(log => log.level === logLevelFilter.value)
})

const formatTime = (date) => {
  return date.toLocaleTimeString('zh-CN', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const addLog = (data) => {
  try {
    const logEntry = typeof data === 'string' ? JSON.parse(data) : data
    logs.value.push({
      time: logEntry.time || formatTime(new Date()),
      level: logEntry.level || 'INFO',
      message: logEntry.message || data
    })
    
    if (logs.value.length > 1000) {
      logs.value = logs.value.slice(-1000)
    }
    
    if (autoScroll.value && logsContainer.value) {
      logsContainer.value.scrollTop = logsContainer.value.scrollHeight
    }
  } catch (e) {
    console.error('Failed to parse log:', e)
  }
}

const clearLogs = () => {
  logs.value = []
}

const downloadLogs = () => {
  const content = logs.value.map(log => 
    `${log.time} [${log.level}] ${log.message}`
  ).join('\n')
  
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `logs_${new Date().toISOString().slice(0, 10)}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const toggleAutoScroll = () => {
  autoScroll.value = !autoScroll.value
}

const fetchLogs = async () => {
  try {
    const response = await fetch('/api/logs')
    if (response.ok) {
      const data = await response.json()
      logs.value = data.map(log => ({
        time: log.time,
        level: log.level,
        message: log.message
      }))
    }
  } catch (error) {
    console.error('Failed to fetch logs:', error)
  }
}

onMounted(() => {
  fetchLogs()
  
  try {
    eventSource = new EventSource('/api/logs/stream')
    eventSource.onmessage = (event) => {
      addLog(event.data)
    }
    eventSource.onerror = () => {
      eventSource.close()
      pollInterval = setInterval(fetchLogs, 2000)
    }
  } catch (error) {
    pollInterval = setInterval(fetchLogs, 2000)
  }
  
  watch(autoScroll, (newVal) => {
    if (newVal && logsContainer.value) {
      logsContainer.value.scrollTop = logsContainer.value.scrollHeight
    }
  })
})

onUnmounted(() => {
  if (eventSource) {
    eventSource.close()
  }
  if (pollInterval) {
    clearInterval(pollInterval)
  }
})
</script>

<style scoped>
.section {
  animation: fadeIn 0.3s ease;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 8rem);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

h2 {
  margin-bottom: 1rem;
}

.logs-controls {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.log-level-filter {
  flex-shrink: 0;
}

.form-control {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
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
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.btn-secondary:hover {
  background: var(--bg-tertiary);
}

.btn-outline {
  background: transparent;
  color: var(--text-secondary);
}

.btn-outline:hover {
  background: var(--bg-tertiary);
}

.btn-danger {
  background: var(--danger-color);
  color: white;
  border-color: var(--danger-color);
}

.btn-danger:hover {
  background: #b91c1c;
}

.logs-container {
  flex: 1;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1rem;
  overflow-y: auto;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 0.8rem;
  line-height: 1.6;
}

.log-entry {
  display: flex;
  gap: 0.75rem;
  padding: 0.375rem 0;
  border-bottom: 1px solid var(--border-color);
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  color: var(--log-time);
  flex-shrink: 0;
  min-width: 70px;
}

.log-level {
  flex-shrink: 0;
  min-width: 50px;
  font-weight: 600;
  text-align: center;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
}

.log-level.info {
  background: var(--log-info);
  color: #0f766e;
}

.log-level.warn {
  background: var(--warning-bg);
  color: var(--warning-text);
}

.log-level.error {
  background: var(--danger-bg);
  color: var(--danger-text);
}

.log-level.debug {
  background: var(--info-bg);
  color: var(--info-text);
}

.log-message {
  color: var(--text-primary);
  word-break: break-all;
}

.empty-logs {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-tertiary);
}

.empty-logs i {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

@media (max-width: 768px) {
  .logs-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .log-entry {
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .log-time, .log-level {
    min-width: auto;
  }
}
</style>