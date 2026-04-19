<template>
  <section id="providers" class="section" aria-labelledby="providers-title">
    <h2 id="providers-title">提供商池管理</h2>
    <div class="pool-description">
      <div class="highlight-note">
        <i class="fas fa-info-circle"></i>
        <span>使用默认路径配置需添加一个空节点</span>
      </div>
    </div>
    
    <!-- Provider Pool Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">
          <i class="fas fa-server"></i>
        </div>
        <div class="stat-info">
          <h3>{{ stats.activeConnections }}</h3>
          <p>活动连接</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">
          <i class="fas fa-network-wired"></i>
        </div>
        <div class="stat-info">
          <h3>{{ stats.activeProviders }}</h3>
          <p>活跃提供商</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="stat-info">
          <h3>{{ stats.healthyProviders }}</h3>
          <p>健康提供商</p>
        </div>
      </div>
    </div>

    <!-- Provider Search Bar -->
    <div class="search-bar">
      <div class="search-input-wrapper">
        <i class="fas fa-search"></i>
        <input 
          type="text" 
          v-model="searchQuery"
          placeholder="搜索提供商名称或节点内容..."
        >
      </div>
    </div>

    <div class="header-actions">
      <button class="btn btn-primary" @click="openAddModal">
        <i class="fas fa-plus"></i> 添加提供商
      </button>
    </div>
    
    <div class="providers-container">
      <div class="providers-list">
        <div 
          v-for="provider in filteredProviders" 
          :key="provider.type"
          class="provider-group"
        >
          <div class="provider-group-header">
            <div class="provider-type-info">
              <i :class="['fas', getProviderIcon(provider.type)]"></i>
              <span class="provider-type-name">{{ getProviderTypeName(provider.type) }}</span>
              <span class="provider-count">({{ provider.nodes.length }} 节点)</span>
            </div>
            <div class="provider-group-actions">
              <button class="btn btn-sm btn-outline" @click="addNode(provider.type)">
                <i class="fas fa-plus"></i> 添加节点
              </button>
            </div>
          </div>
          
          <div class="provider-nodes">
            <div 
              v-for="node in provider.nodes" 
              :key="node.uuid"
              class="provider-node-card"
              :class="{ unhealthy: !node.healthy }"
            >
              <div class="node-header">
                <div class="node-name">
                  <span class="status-indicator" :class="{ healthy: node.healthy }"></span>
                  <span>{{ node.name }}</span>
                  <span v-if="node.disabled" class="disabled-badge">已禁用</span>
                </div>
                <div class="node-actions">
                  <button 
                    v-if="needsOAuth(provider.type)"
                    class="action-btn oauth-btn" 
                    @click="generateOAuth(provider.type, node)" 
                    title="生成OAuth授权"
                  >
                    <i class="fas fa-key"></i>
                  </button>
                  <button 
                    class="action-btn health-btn" 
                    @click="checkHealth(provider.type, node.uuid)" 
                    title="健康检查"
                  >
                    <i class="fas fa-heartbeat"></i>
                  </button>
                  <button class="action-btn" @click="editNode(provider.type, node)" title="编辑">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="action-btn" @click="deleteNode(provider.type, node.uuid)" title="删除">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              
              <div class="node-info">
                <div class="info-row">
                  <span class="info-label">UUID</span>
                  <span class="info-value">{{ node.uuid }}</span>
                </div>
                <div class="info-row" v-if="node.oauthCredsFilePath">
                  <span class="info-label">凭据路径</span>
                  <span class="info-value">{{ node.oauthCredsFilePath }}</span>
                </div>
                <div class="info-row" v-if="node.apiKey">
                  <span class="info-label">API Key</span>
                  <span class="info-value masked">{{ maskApiKey(node.apiKey) }}</span>
                </div>
                <div class="info-row" v-if="node.email">
                  <span class="info-label">邮箱</span>
                  <span class="info-value">{{ node.email }}</span>
                </div>
                <div class="info-row" v-if="node.accessToken">
                  <span class="info-label">Token</span>
                  <span class="info-value masked">{{ maskToken(node.accessToken) }}</span>
                </div>
                <div class="info-row" v-if="node.checkModel">
                  <span class="info-label">检查模型</span>
                  <span class="info-value">{{ node.checkModel }}</span>
                </div>
                <div class="info-row" v-if="node.requestCount !== undefined">
                  <span class="info-label">请求次数</span>
                  <span class="info-value">{{ node.requestCount }}</span>
                </div>
              </div>
              
              <div class="node-status">
                <span class="status-text" :class="node.healthy ? 'success' : 'danger'">
                  {{ node.healthy ? '健康' : '不健康' }}
                </span>
                <span class="last-update">更新于 {{ formatTime(node.lastUpdate) }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="filteredProviders.length === 0" class="empty-state">
          <i class="fas fa-server"></i>
          <span>暂无提供商配置</span>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ isEditing ? '编辑提供商节点' : '添加提供商节点' }}</h3>
          <button class="modal-close" @click="closeModal">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <form @submit.prevent="saveNode" class="modal-form">
          <div class="form-group">
            <label>提供商类型</label>
            <select v-model="formData.providerType" class="form-control">
              <option v-for="p in providerTypes" :key="p.value" :value="p.value">
                {{ p.label }}
              </option>
            </select>
          </div>
          
          <div class="form-group">
            <label>节点名称</label>
            <input type="text" v-model="formData.name" class="form-control" placeholder="输入节点名称">
          </div>
          
          <div class="form-group">
            <label>UUID</label>
            <input type="text" v-model="formData.uuid" class="form-control" placeholder="自动生成或手动输入">
          </div>
          
          <div class="form-group" v-if="needsApiKey(formData.providerType)">
            <label>API Key</label>
            <input type="password" v-model="formData.apiKey" class="form-control" placeholder="输入API密钥">
          </div>
          
          <div class="form-group" v-if="needsEmail(formData.providerType)">
            <label>邮箱</label>
            <input type="email" v-model="formData.email" class="form-control" placeholder="输入邮箱">
          </div>
          
          <div class="form-group" v-if="needsAccessToken(formData.providerType)">
            <label>Access Token</label>
            <input type="password" v-model="formData.accessToken" class="form-control" placeholder="输入访问令牌">
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="closeModal">取消</button>
            <button type="submit" class="btn btn-primary">保存</button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useProviders } from '@/composables/useProviders.js'
import ProviderNode from '@/components/ProviderNode.vue'
import { logger } from '@/utils/logger.js'
import { apiClient } from '@/utils/api.js'

const showModal = ref(false)
const isEditing = ref(false)

const {
  providers,
  searchQuery,
  stats,
  providerTypes,
  filteredProviders,
  getProviderIcon,
  getProviderTypeName,
  fetchProviders,
  addProvider,
  updateProvider,
  deleteProvider,
  performHealthCheck
} = useProviders()

const formData = reactive({
  providerType: 'gemini-cli-oauth',
  name: '',
  uuid: '',
  apiKey: '',
  email: '',
  accessToken: ''
})

const maskApiKey = (key) => {
  if (!key) return ''
  return key.substring(0, 6) + '...' + key.substring(key.length - 4)
}

const maskToken = (token) => {
  if (!token) return ''
  return token.substring(0, 10) + '...'
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}

const needsApiKey = (type) => {
  return ['openai-custom', 'claude-custom', 'grok-custom'].includes(type)
}

const needsEmail = (type) => {
  return ['gemini-cli-oauth', 'gemini-antigravity', 'claude-kiro-oauth'].includes(type)
}

const needsAccessToken = (type) => {
  return ['gemini-cli-oauth', 'gemini-antigravity', 'claude-kiro-oauth'].includes(type)
}

const needsOAuth = (type) => {
  return [
    'gemini-cli-oauth', 
    'gemini-antigravity', 
    'claude-kiro-oauth',
    'openai-qwen-oauth',
    'openai-codex-oauth',
    'openai-iflow'
  ].includes(type)
}

const generateOAuth = async (providerType, node) => {
  try {
    const response = await apiClient.post(`/api/providers/${providerType}/${node.uuid}/oauth`);
    if (response.data.url) {
      window.open(response.data.url, '_blank');
      window.$toast?.success('已打开 OAuth 授权页面，请完成登录授权');
    }
  } catch (error) {
    window.$toast?.error('生成 OAuth 授权失败: ' + error.message);
    logger.error('OAuth generation failed', error);
  }
}

const openAddModal = () => {
  isEditing.value = false
  formData.providerType = 'openai-custom'
  formData.name = ''
  formData.uuid = ''
  formData.apiKey = ''
  formData.email = ''
  formData.accessToken = ''
  showModal.value = true
}

const editNode = (providerType, node) => {
  isEditing.value = true
  formData.providerType = providerType
  formData.name = node.name
  formData.uuid = node.uuid
  formData.apiKey = node.apiKey || ''
  formData.email = node.email || ''
  formData.accessToken = node.accessToken || ''
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const saveNode = async () => {
  if (!formData.name) {
    window.$toast?.error('请输入节点名称')
    return
  }
  
  const data = {
    providerType: formData.providerType,
    name: formData.name,
    uuid: formData.uuid,
    apiKey: formData.apiKey,
    email: formData.email,
    accessToken: formData.accessToken
  }
  
  try {
    if (isEditing.value) {
      await updateProvider(formData.providerType, formData.uuid, data)
    } else {
      await addProvider(data)
    }
    closeModal()
  } catch (error) {
    logger.error('Failed to save node', error)
  }
}

const deleteNode = async (providerType, uuid) => {
  try {
    await deleteProvider(providerType, uuid)
  } catch (error) {
    logger.error('Failed to delete node', error)
  }
}

const checkHealth = async (providerType, uuid) => {
  try {
    await performHealthCheck(providerType, uuid)
  } catch (error) {
    logger.error('Health check failed', error)
  }
}

const addNode = (providerType) => {
  formData.providerType = providerType
  isEditing.value = false
  formData.name = ''
  formData.uuid = ''
  formData.apiKey = ''
  formData.email = ''
  formData.accessToken = ''
  showModal.value = true
}

onMounted(() => {
  fetchProviders()
})
</script>

<style scoped>
.section {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.pool-description {
  margin-bottom: 1rem;
}

.highlight-note {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--info-bg-light);
  border-radius: var(--radius-md);
  color: var(--info-text);
  font-size: 0.875rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--primary-10);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
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

.search-bar {
  margin-bottom: 1rem;
}

.search-input-wrapper {
  position: relative;
}

.search-input-wrapper i {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
}

.search-input-wrapper input {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.providers-container {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.providers-list {
  padding: 0.5rem;
}

.provider-group {
  margin-bottom: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.provider-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
}

.provider-type-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.provider-type-info i {
  color: var(--primary-color);
}

.provider-type-name {
  font-weight: 600;
  color: var(--text-primary);
}

.provider-count {
  color: var(--text-tertiary);
  font-size: 0.8rem;
}

.provider-group-actions {
  display: flex;
  gap: 0.5rem;
}

.provider-nodes {
  padding: 0.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 0.5rem;
}

.provider-node-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.75rem;
}

.provider-node-card.unhealthy {
  border-color: var(--danger-border);
  background: var(--danger-bg-light);
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.node-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.disabled-badge {
  font-size: 0.65rem;
  padding: 0.125rem 0.375rem;
  background: var(--warning-bg);
  color: var(--warning-text);
  border-radius: var(--radius-full);
  font-weight: 500;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--danger-color);
}

.status-indicator.healthy {
  background: var(--success-color);
}

.node-name span:last-child {
  font-weight: 500;
  color: var(--text-primary);
}

.node-actions {
  display: flex;
  gap: 0.25rem;
}

.action-btn {
  padding: 0.25rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: var(--transition);
}

.action-btn:hover {
  background: var(--bg-tertiary);
  color: var(--primary-color);
}

.action-btn.oauth-btn:hover {
  background: var(--primary-10);
  color: var(--primary-color);
}

.action-btn.health-btn:hover {
  background: var(--success-10);
  color: var(--success-color);
}

.node-info {
  margin-bottom: 0.75rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
  font-size: 0.8rem;
}

.info-label {
  color: var(--text-tertiary);
}

.info-value {
  color: var(--text-primary);
  font-family: monospace;
}

.info-value.masked {
  font-family: inherit;
}

.node-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-color);
}

.status-text {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-full);
}

.status-text.success {
  background: var(--success-bg);
  color: var(--success-text);
}

.status-text.danger {
  background: var(--danger-bg);
  color: var(--danger-text);
}

.last-update {
  font-size: 0.7rem;
  color: var(--text-tertiary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: var(--text-tertiary);
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.modal-content {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.2s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  color: var(--text-primary);
}

.modal-close {
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 0.25rem;
}

.modal-form {
  padding: 1.25rem;
}

.modal-form .form-group {
  margin-bottom: 1rem;
}

.modal-form .form-group label {
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.modal-form .form-control {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.modal-form .form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.btn {
  padding: 0.5rem 1.25rem;
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

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
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

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .provider-nodes {
    grid-template-columns: 1fr;
  }
  
  .provider-group-header {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
}
</style>