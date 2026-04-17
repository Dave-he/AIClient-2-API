<template>
  <section id="plugins" class="section" aria-labelledby="plugins-title">
    <h2 id="plugins-title">插件管理</h2>
    
    <div class="plugins-grid">
      <div 
        v-for="plugin in plugins" 
        :key="plugin.name"
        class="plugin-card"
      >
        <div class="plugin-header">
          <div class="plugin-icon" :class="plugin.type">
            <i :class="plugin.icon"></i>
          </div>
          <div class="plugin-info">
            <h3>{{ plugin.name }}</h3>
            <span class="plugin-version">{{ plugin.version }}</span>
            <span class="plugin-type" :class="plugin.type">{{ plugin.type === 'auth' ? '认证插件' : '中间件' }}</span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" v-model="plugin.enabled" @change="togglePlugin(plugin)">
            <span class="toggle-slider"></span>
          </label>
        </div>
        
        <p class="plugin-description">{{ plugin.description }}</p>
        
        <div class="plugin-details">
          <div class="detail-item">
            <span class="detail-label"><i class="fas fa-user"></i> 作者</span>
            <span class="detail-value">{{ plugin.author }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label"><i class="fas fa-calendar"></i> 更新时间</span>
            <span class="detail-value">{{ plugin.lastUpdated }}</span>
          </div>
          <div class="detail-item features">
            <span class="detail-label"><i class="fas fa-feather"></i> 特性</span>
            <div class="features-list">
              <span 
                v-for="(feature, index) in plugin.features" 
                :key="index" 
                class="feature-tag"
              >
                {{ feature }}
              </span>
            </div>
          </div>
        </div>
        
        <div v-if="plugin.docs" class="plugin-docs">
          <a :href="plugin.docs" target="_blank" class="docs-link">
            <i class="fas fa-external-link-alt"></i> 查看文档
          </a>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'

const plugins = ref([
  {
    name: 'default-auth',
    version: '1.0.0',
    type: 'auth',
    icon: 'fas fa-shield-alt',
    description: '默认 API Key 认证插件，支持多种认证方式（Bearer Token、Header、Query）',
    author: 'AIClient Team',
    lastUpdated: '2024-01-15',
    features: ['API Key 认证', '多认证方式', '请求限速', 'IP白名单'],
    enabled: true,
    docs: null
  },
  {
    name: 'ai-monitor',
    version: '1.0.0',
    type: 'middleware',
    icon: 'fas fa-eye',
    description: 'AI 接口监控插件 - 捕获请求和响应参数（全链路协议转换监控，流式聚合输出，用于调试和分析）',
    author: 'AIClient Team',
    lastUpdated: '2024-01-15',
    features: ['全链路监控', '请求捕获', '响应分析', '流式输出'],
    enabled: true,
    docs: null
  },
  {
    name: 'api-potluck',
    version: '1.0.2',
    type: 'middleware',
    icon: 'fas fa-utensils',
    description: 'API 大锅饭 - Key 管理和用量统计插件，支持多用户共享 API Key',
    author: 'AIClient Team',
    lastUpdated: '2024-01-20',
    features: ['Key 管理', '用量统计', '多用户支持', '配额管理'],
    enabled: true,
    docs: '#/potluck'
  },
  {
    name: 'model-usage-stats',
    version: '1.0.0',
    type: 'middleware',
    icon: 'fas fa-chart-pie',
    description: '模型用量统计插件，记录每个模型的调用次数和 Token 消耗',
    author: 'AIClient Team',
    lastUpdated: '2024-01-15',
    features: ['用量统计', 'Token 统计', '模型排行', '数据导出'],
    enabled: true,
    docs: '#/model-usage-stats'
  },
  {
    name: 'rate-limit',
    version: '1.0.0',
    type: 'middleware',
    icon: 'fas fa-gauge',
    description: '请求限流插件，支持基于 IP、用户、API Key 的限流策略',
    author: 'AIClient Team',
    lastUpdated: '2024-01-10',
    features: ['IP限流', '用户限流', '动态调整', '熔断保护'],
    enabled: false,
    docs: null
  },
  {
    name: 'cache-proxy',
    version: '1.0.0',
    type: 'middleware',
    icon: 'fas fa-database',
    description: '请求缓存代理插件，缓存重复请求以减少 API 调用费用',
    author: 'AIClient Team',
    lastUpdated: '2024-01-08',
    features: ['智能缓存', 'TTL 控制', '内存/Redis', '命中率统计'],
    enabled: false,
    docs: null
  }
])

const togglePlugin = (plugin) => {
  if (plugin.enabled) {
    console.log(`Enabling plugin: ${plugin.name}`)
  } else {
    console.log(`Disabling plugin: ${plugin.name}`)
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

.plugins-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 1rem;
}

.plugin-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1rem;
  transition: var(--transition);
}

.plugin-card:hover {
  box-shadow: var(--shadow-lg);
}

.plugin-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.plugin-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.plugin-icon.auth {
  background: var(--primary-10);
  color: var(--primary-color);
}

.plugin-icon.middleware {
  background: var(--info-bg);
  color: var(--info-color);
}

.plugin-info {
  flex: 1;
}

.plugin-info h3 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  color: var(--text-primary);
}

.plugin-version {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-right: 0.5rem;
}

.plugin-type {
  font-size: 0.7rem;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
  background: var(--bg-secondary);
}

.plugin-type.auth {
  background: var(--primary-10);
  color: var(--primary-color);
}

.plugin-type.middleware {
  background: var(--info-bg);
  color: var(--info-color);
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--border-color);
  transition: 0.3s;
  border-radius: 26px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: var(--primary-color);
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(22px);
}

.plugin-description {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0 0 1rem;
  line-height: 1.5;
}

.plugin-details {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0.375rem 0;
  border-bottom: 1px solid var(--border-color);
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-item.features {
  flex-direction: column;
  gap: 0.5rem;
}

.detail-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.detail-value {
  font-size: 0.75rem;
  color: var(--text-primary);
}

.features-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.feature-tag {
  padding: 0.25rem 0.5rem;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.plugin-docs {
  text-align: right;
}

.docs-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--primary-color);
  text-decoration: none;
}

.docs-link:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .plugins-grid {
    grid-template-columns: 1fr;
  }
}
</style>