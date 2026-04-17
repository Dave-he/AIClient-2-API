<template>
  <section id="usage" class="section" aria-labelledby="usage-title">
    <h2 id="usage-title">用量查询</h2>
    
    <div class="time-range-selector">
      <button 
        v-for="range in timeRanges" 
        :key="range.value"
        class="time-range-btn"
        :class="{ active: selectedRange === range.value }"
        @click="selectedRange = range.value"
      >
        {{ range.label }}
      </button>
    </div>

    <div class="usage-stats-grid">
      <div class="stat-card total">
        <div class="stat-icon">
          <i class="fas fa-chart-bar"></i>
        </div>
        <div class="stat-info">
          <h3>{{ totalUsage.toLocaleString() }}</h3>
          <p>总Token消耗</p>
        </div>
      </div>
      <div class="stat-card prompt">
        <div class="stat-icon">
          <i class="fas fa-file-text"></i>
        </div>
        <div class="stat-info">
          <h3>{{ promptTokens.toLocaleString() }}</h3>
          <p>输入Token</p>
        </div>
      </div>
      <div class="stat-card completion">
        <div class="stat-icon">
          <i class="fas fa-message-circle"></i>
        </div>
        <div class="stat-info">
          <h3>{{ completionTokens.toLocaleString() }}</h3>
          <p>输出Token</p>
        </div>
      </div>
      <div class="stat-card requests">
        <div class="stat-icon">
          <i class="fas fa-clock"></i>
        </div>
        <div class="stat-info">
          <h3>{{ requestCount.toLocaleString() }}</h3>
          <p>请求次数</p>
        </div>
      </div>
    </div>

    <div class="charts-row">
      <div class="chart-panel">
        <div class="panel-header">
          <h3><i class="fas fa-line-chart"></i> Token使用趋势</h3>
        </div>
        <div class="chart-container">
          <canvas id="usageChart"></canvas>
        </div>
      </div>
      
      <div class="chart-panel">
        <div class="panel-header">
          <h3><i class="fas fa-pie-chart"></i> 模型使用分布</h3>
        </div>
        <div class="chart-container">
          <canvas id="modelDistributionChart"></canvas>
        </div>
      </div>
    </div>

    <div class="top-models-section">
      <div class="section-header">
        <h3><i class="fas fa-trophy"></i> 热门模型排行</h3>
      </div>
      <div class="top-models-grid">
        <div 
          v-for="(model, index) in topModels" 
          :key="model.name"
          class="model-card"
          :class="{ 
            'rank-gold': index === 0,
            'rank-silver': index === 1,
            'rank-bronze': index === 2
          }"
        >
          <div class="model-rank">
            <i v-if="index === 0" class="fas fa-medal gold"></i>
            <i v-else-if="index === 1" class="fas fa-medal silver"></i>
            <i v-else-if="index === 2" class="fas fa-medal bronze"></i>
            <span v-else>{{ index + 1 }}</span>
          </div>
          <div class="model-info">
            <h4>{{ model.name }}</h4>
            <p class="model-provider">{{ model.provider }}</p>
          </div>
          <div class="model-stats">
            <div class="stat-item">
              <span class="stat-value">{{ model.tokens.toLocaleString() }}</span>
              <span class="stat-label">Token</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ model.requests }}</span>
              <span class="stat-label">请求</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="recent-requests-section">
      <div class="section-header">
        <h3><i class="fas fa-history"></i> 最近请求记录</h3>
      </div>
      <div class="requests-table-container">
        <table class="requests-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>模型</th>
              <th>提供商</th>
              <th>输入Token</th>
              <th>输出Token</th>
              <th>耗时(ms)</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(request, index) in recentRequests" :key="index">
              <td>{{ request.time }}</td>
              <td class="model-name">{{ request.model }}</td>
              <td>{{ request.provider }}</td>
              <td>{{ request.promptTokens }}</td>
              <td>{{ request.completionTokens }}</td>
              <td>{{ request.duration }}</td>
              <td>
                <span class="status-badge" :class="request.status.toLowerCase()">
                  {{ request.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

const selectedRange = ref('today')

const timeRanges = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'year', label: '本年' }
]

const totalUsage = ref(1256847)
const promptTokens = ref(892341)
const completionTokens = ref(364506)
const requestCount = ref(1542)

const topModels = ref([
  { name: 'gpt-4o-mini', provider: 'OpenAI', tokens: 452310, requests: 423 },
  { name: 'claude-3-5-sonnet', provider: 'Claude', tokens: 321543, requests: 312 },
  { name: 'gemini-2.5-flash', provider: 'Gemini', tokens: 287654, requests: 289 },
  { name: 'claude-opus-4-5', provider: 'Kiro', tokens: 124532, requests: 156 },
  { name: 'grok-beta', provider: 'Grok', tokens: 70808, requests: 162 }
])

const recentRequests = ref([
  { time: '16:45:32', model: 'gpt-4o-mini', provider: 'OpenAI Custom', promptTokens: 128, completionTokens: 256, duration: 845, status: 'SUCCESS' },
  { time: '16:44:18', model: 'claude-3-5-sonnet', provider: 'Claude Custom', promptTokens: 256, completionTokens: 512, duration: 1234, status: 'SUCCESS' },
  { time: '16:43:52', model: 'gemini-2.5-flash', provider: 'Gemini CLI', promptTokens: 512, completionTokens: 1024, duration: 987, status: 'SUCCESS' },
  { time: '16:42:31', model: 'gpt-4o-mini', provider: 'OpenAI Custom', promptTokens: 64, completionTokens: 128, duration: 456, status: 'SUCCESS' },
  { time: '16:41:05', model: 'claude-opus-4-5', provider: 'Claude Kiro', promptTokens: 1024, completionTokens: 2048, duration: 2156, status: 'SUCCESS' },
  { time: '16:39:44', model: 'grok-beta', provider: 'Grok Reverse', promptTokens: 256, completionTokens: 512, duration: 1567, status: 'SUCCESS' },
  { time: '16:38:22', model: 'gemini-2.5-flash', provider: 'Gemini CLI', promptTokens: 128, completionTokens: 256, duration: 654, status: 'SUCCESS' },
  { time: '16:37:10', model: 'gpt-4o-mini', provider: 'OpenAI Custom', promptTokens: 32, completionTokens: 64, duration: 234, status: 'ERROR' }
])

onMounted(() => {
  initCharts()
})

const initCharts = () => {
  const usageCtx = document.getElementById('usageChart')
  if (usageCtx) {
    const gradient = usageCtx.getContext('2d').createLinearGradient(0, 0, 0, 200)
    gradient.addColorStop(0, 'rgba(5, 150, 105, 0.3)')
    gradient.addColorStop(1, 'rgba(5, 150, 105, 0)')
    
    new (window.Chart || {})(usageCtx, {
      type: 'line',
      data: {
        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
        datasets: [{
          label: 'Token消耗',
          data: [45000, 32000, 89000, 125000, 98000, 67000],
          borderColor: '#059669',
          backgroundColor: gradient,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true },
          x: { grid: { display: false } }
        }
      }
    })
  }
  
  const distributionCtx = document.getElementById('modelDistributionChart')
  if (distributionCtx) {
    new (window.Chart || {})(distributionCtx, {
      type: 'doughnut',
      data: {
        labels: ['GPT-4o Mini', 'Claude 3.5 Sonnet', 'Gemini 2.5 Flash', 'Claude Opus', 'Grok'],
        datasets: [{
          data: [36, 25, 22, 10, 7],
          backgroundColor: ['#059669', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6']
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        cutout: '65%'
      }
    })
  }
}
</script>

<style scoped>
.section {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.time-range-selector {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.time-range-btn {
  padding: 0.5rem 1rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition);
}

.time-range-btn:hover {
  border-color: var(--primary-color);
}

.time-range-btn.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.usage-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-card.total .stat-icon { background: var(--primary-10); color: var(--primary-color); }
.stat-card.prompt .stat-icon { background: var(--info-bg); color: var(--info-color); }
.stat-card.completion .stat-icon { background: var(--success-bg); color: var(--success-color); }
.stat-card.requests .stat-icon { background: var(--warning-bg); color: var(--warning-text); }

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.stat-info h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.stat-info p {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  margin: 0.25rem 0 0;
}

.charts-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.chart-panel {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1rem;
}

.panel-header {
  margin-bottom: 1rem;
}

.panel-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.panel-header h3 i {
  color: var(--primary-color);
}

.chart-container {
  height: 200px;
}

.top-models-section,
.recent-requests-section {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1rem;
  margin-bottom: 1rem;
}

.section-header {
  margin-bottom: 1rem;
}

.section-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-header h3 i {
  color: var(--primary-color);
}

.top-models-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1rem;
}

.model-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 1rem;
  text-align: center;
  border: 2px solid transparent;
}

.model-card.rank-gold { border-color: #f59e0b; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); }
.model-card.rank-silver { border-color: #9ca3af; background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); }
.model-card.rank-bronze { border-color: #b45309; background: linear-gradient(135deg, #fffbeb 0%, #fde68a 100%); }

.model-rank {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-tertiary);
  margin-bottom: 0.5rem;
}

.model-rank .gold { color: #f59e0b; }
.model-rank .silver { color: #9ca3af; }
.model-rank .bronze { color: #b45309; }

.model-info h4 {
  margin: 0 0 0.25rem;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.model-provider {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin: 0;
}

.model-stats {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 0.75rem;
}

.stat-item {
  text-align: center;
}

.stat-item .stat-value {
  display: block;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.stat-item .stat-label {
  font-size: 0.65rem;
  color: var(--text-tertiary);
}

.requests-table-container {
  overflow-x: auto;
}

.requests-table {
  width: 100%;
  border-collapse: collapse;
}

.requests-table th,
.requests-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.requests-table th {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.requests-table td {
  font-size: 0.8rem;
}

.model-name {
  font-family: monospace;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-full);
  font-size: 0.7rem;
  font-weight: 600;
}

.status-badge.success {
  background: var(--success-bg);
  color: var(--success-text);
}

.status-badge.error {
  background: var(--danger-bg);
  color: var(--danger-text);
}

@media (max-width: 1024px) {
  .usage-stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .charts-row {
    grid-template-columns: 1fr;
  }
  
  .top-models-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .usage-stats-grid {
    grid-template-columns: 1fr;
  }
  
  .top-models-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>