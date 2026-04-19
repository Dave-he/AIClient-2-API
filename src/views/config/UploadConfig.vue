<template>
  <section id="upload-config" class="section" aria-labelledby="upload-config-title">
    <h2 id="upload-config-title">凭据文件管理</h2>
    
    <div class="upload-config-panel">
      <div class="config-search-panel">
        <div class="search-controls">
          <div class="form-group">
            <label>搜索配置</label>
            <div class="search-input-group">
              <input 
                type="text" 
                v-model="searchQuery" 
                class="form-control" 
                placeholder="输入文件名"
              >
              <button type="button" class="btn btn-outline" @click="filterConfigs">
                <i class="fas fa-search"></i>
              </button>
            </div>
          </div>
          <div class="form-group">
            <label>提供商类型</label>
            <select v-model="providerFilter" class="form-control">
              <option value="">全部提供商</option>
              <option v-for="provider in providerTypes" :key="provider.value" :value="provider.value">
                {{ provider.label }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>关联状态</label>
            <select v-model="statusFilter" class="form-control">
              <option value="">全部状态</option>
              <option value="used">已关联</option>
              <option value="unused">未关联</option>
            </select>
          </div>
        </div>
      </div>

      <div class="config-list-container">
        <div class="config-list-header">
          <h3><i class="fas fa-file-folder"></i> 配置文件列表</h3>
          <div class="config-stats">
            <span>共 {{ stats.total }} 个配置文件</span>
            <span class="status-used">已关联: {{ stats.used }}</span>
            <span class="status-unused">未关联: {{ stats.unused }}</span>
            <button class="btn-batch-link" @click="batchLinkOAuth">
              <i class="fas fa-link"></i> 自动关联oauth
            </button>
            <button class="btn-delete-unbound" @click="deleteUnbound">
              <i class="fas fa-trash-alt"></i> 删除未关联
            </button>
            <button class="btn-refresh" @click="fetchConfigs">
              <i class="fas fa-sync-alt"></i> 刷新
            </button>
            <button class="btn-download" @click="downloadAllConfigs">
              <i class="fas fa-file-archive"></i> 打包下载
            </button>
          </div>
        </div>
        
        <div class="upload-area">
          <div 
            class="drop-zone"
            :class="{ dragging: isDragging }"
            @dragover.prevent="isDragging = true"
            @dragleave="isDragging = false"
            @drop.prevent="handleDrop"
            @click="triggerFileInput"
          >
            <input 
              ref="fileInput" 
              type="file" 
              multiple 
              accept=".json"
              class="file-input"
              @change="handleFileSelect"
            />
            <div class="drop-icon">
              <i class="fas fa-upload"></i>
            </div>
            <h3>拖拽凭据文件到此处</h3>
            <p>支持 .json 格式的凭据文件</p>
            <button class="btn btn-primary upload-btn">
              <i class="fas fa-folder-open"></i> 选择文件
            </button>
          </div>
        </div>

        <div id="configList" class="config-list">
          <div v-if="configs.length === 0" class="empty-state">
            <i class="fas fa-folder-open"></i>
            <span>暂无凭据文件</span>
          </div>
          
          <div 
            v-for="config in filteredConfigs" 
            :key="config.id" 
            class="config-card"
          >
            <div class="config-info">
              <div class="config-icon">
                <i class="fas fa-file-json"></i>
              </div>
              <div class="config-details">
                <h4 class="config-name">{{ config.filename }}</h4>
                <div class="config-meta">
                  <span class="meta-item">{{ config.provider || '未知' }}</span>
                  <span class="meta-divider">·</span>
                  <span class="meta-item">{{ config.size }}</span>
                  <span class="meta-divider">·</span>
                  <span class="meta-item">{{ config.lastModified }}</span>
                </div>
              </div>
            </div>
            <div class="config-status" :class="config.isBound ? 'used' : 'unused'">
              {{ config.isBound ? '已关联' : '未关联' }}
            </div>
            <div class="config-actions">
              <button class="action-btn" @click="downloadConfig(config)" title="下载">
                <i class="fas fa-download"></i>
              </button>
              <button 
                v-if="!config.isBound" 
                class="action-btn link-btn" 
                @click="linkConfig(config)" 
                title="关联"
              >
                <i class="fas fa-link"></i>
              </button>
              <button class="action-btn delete-btn" @click="deleteConfig(config)" title="删除">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiClient } from '@/utils/api.js'

const isDragging = ref(false)
const fileInput = ref(null)
const searchQuery = ref('')
const providerFilter = ref('')
const statusFilter = ref('')

const providerTypes = [
  { value: 'gemini-cli-oauth', label: 'Gemini CLI OAuth' },
  { value: 'gemini-antigravity', label: 'Gemini Antigravity' },
  { value: 'claude-kiro-oauth', label: 'Claude Kiro OAuth' },
  { value: 'openai-custom', label: 'OpenAI Custom' },
  { value: 'claude-custom', label: 'Claude Custom' },
  { value: 'openai-qwen-oauth', label: 'Qwen OAuth' },
  { value: 'openai-codex-oauth', label: 'Codex OAuth' },
  { value: 'openai-iflow', label: 'iFlow OAuth' },
  { value: 'grok-custom', label: 'Grok Custom' }
]

const configs = ref([])

const stats = computed(() => {
  const used = configs.value.filter(c => c.isBound).length
  return {
    total: configs.value.length,
    used,
    unused: configs.value.length - used
  }
})

const filteredConfigs = computed(() => {
  let result = configs.value
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(c => c.filename.toLowerCase().includes(query))
  }
  
  if (providerFilter.value) {
    result = result.filter(c => c.provider === providerFilter.value)
  }
  
  if (statusFilter.value === 'used') {
    result = result.filter(c => c.isBound)
  } else if (statusFilter.value === 'unused') {
    result = result.filter(c => !c.isBound)
  }
  
  return result
})

const triggerFileInput = () => {
  fileInput.value.click()
}

const handleFileSelect = (event) => {
  const files = event.target.files
  if (files.length > 0) {
    processFiles(Array.from(files))
  }
}

const handleDrop = (event) => {
  isDragging.value = false
  const files = event.dataTransfer.files
  if (files.length > 0) {
    processFiles(Array.from(files))
  }
}

const processFiles = async (files) => {
  const formData = new FormData()
  files.forEach(file => {
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      formData.append('files', file)
    } else {
      window.$toast?.error(`文件 ${file.name} 不是有效的 JSON 文件`)
    }
  })
  
  if (formData.getAll('files').length > 0) {
    try {
      await apiClient.post('/api/config/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      await fetchConfigs()
      window.$toast?.success('文件上传成功')
    } catch (error) {
      window.$toast?.error('上传失败: ' + error.message)
    }
  }
}

const fetchConfigs = async () => {
  try {
    const response = await apiClient.get('/api/config/list')
    configs.value = response.data.configs || []
  } catch (error) {
    console.error('Failed to fetch configs', error)
  }
}

const downloadConfig = async (config) => {
  try {
    const response = await apiClient.get(`/api/config/download/${config.filename}`, {
      responseType: 'blob'
    })
    const url = window.URL.createObjectURL(response.data)
    const a = document.createElement('a')
    a.href = url
    a.download = config.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    window.$toast?.error('下载失败: ' + error.message)
  }
}

const downloadAllConfigs = async () => {
  try {
    const response = await apiClient.get('/api/config/download-all', {
      responseType: 'blob'
    })
    const url = window.URL.createObjectURL(response.data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'configs.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    window.$toast?.error('打包下载失败: ' + error.message)
  }
}

const linkConfig = async (config) => {
  try {
    await apiClient.post(`/api/config/link/${config.filename}`)
    await fetchConfigs()
    window.$toast?.success('关联成功')
  } catch (error) {
    window.$toast?.error('关联失败: ' + error.message)
  }
}

const batchLinkOAuth = async () => {
  try {
    await apiClient.post('/api/config/batch-link')
    await fetchConfigs()
    window.$toast?.success('批量关联完成')
  } catch (error) {
    window.$toast?.error('批量关联失败: ' + error.message)
  }
}

const deleteConfig = async (config) => {
  if (!confirm(`确定删除配置文件 "${config.filename}" 吗？`)) return
  try {
    await apiClient.delete(`/api/config/delete/${config.filename}`)
    await fetchConfigs()
    window.$toast?.success('删除成功')
  } catch (error) {
    window.$toast?.error('删除失败: ' + error.message)
  }
}

const deleteUnbound = async () => {
  if (!confirm('确定删除所有未关联的配置文件吗？')) return
  try {
    await apiClient.delete('/api/config/delete-unbound')
    await fetchConfigs()
    window.$toast?.success('已删除所有未关联配置')
  } catch (error) {
    window.$toast?.error('删除失败: ' + error.message)
  }
}

const filterConfigs = () => {
}

onMounted(() => {
  fetchConfigs()
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

.upload-config-panel {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.config-search-panel {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.search-controls {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: flex-end;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-group label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-control {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-width: 160px;
}

.search-input-group {
  display: flex;
  align-items: center;
}

.search-input-group .form-control {
  border-radius: var(--radius-md) 0 0 var(--radius-md);
  border-right: none;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border-color);
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.btn-outline {
  background: transparent;
  color: var(--text-secondary);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}

.btn-outline:hover {
  background: var(--bg-tertiary);
}

.config-list-container {
  padding: 1rem;
}

.config-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.config-list-header h3 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.config-list-header h3 i {
  color: var(--primary-color);
}

.config-stats {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 0.8rem;
}

.config-stats span {
  color: var(--text-secondary);
}

.status-used {
  color: var(--success-color);
}

.status-unused {
  color: var(--warning-color);
}

.btn-batch-link,
.btn-delete-unbound,
.btn-refresh,
.btn-download {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.btn-batch-link:hover {
  background: var(--primary-10);
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.btn-delete-unbound:hover {
  background: var(--danger-10);
  color: var(--danger-color);
  border-color: var(--danger-color);
}

.btn-refresh:hover,
.btn-download:hover {
  background: var(--bg-tertiary);
}

.upload-area {
  margin-bottom: 1rem;
}

.drop-zone {
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-lg);
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: var(--transition);
  background: var(--bg-secondary);
}

.drop-zone:hover {
  border-color: var(--primary-color);
}

.drop-zone.dragging {
  border-color: var(--primary-color);
  background: var(--primary-5);
}

.file-input {
  display: none;
}

.drop-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--primary-10);
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 0.75rem;
  font-size: 1.25rem;
}

.drop-zone h3 {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.375rem;
}

.drop-zone p {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 0 0 0.75rem;
}

.upload-btn {
  padding: 0.375rem 0.75rem;
  font-size: 0.8rem;
}

.config-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--text-tertiary);
}

.empty-state i {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.config-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.config-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.config-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.config-details h4 {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.125rem;
}

.config-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.65rem;
}

.meta-item {
  color: var(--text-secondary);
}

.meta-divider {
  color: var(--text-tertiary);
}

.config-status {
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.65rem;
  font-weight: 600;
}

.config-status.used {
  background: var(--success-bg);
  color: var(--success-color);
}

.config-status.unused {
  background: var(--warning-bg);
  color: var(--warning-color);
}

.config-actions {
  display: flex;
  gap: 0.25rem;
}

.action-btn {
  padding: 0.375rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: var(--transition);
}

.action-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.action-btn.link-btn:hover {
  background: var(--primary-10);
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.action-btn.delete-btn:hover {
  background: var(--danger-10);
  color: var(--danger-color);
  border-color: var(--danger-color);
}

@media (max-width: 768px) {
  .search-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-input-group {
    flex: 1;
  }
  
  .search-input-group .form-control {
    flex: 1;
  }
  
  .config-stats {
    justify-content: flex-start;
  }
  
  .config-card {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .config-actions {
    margin-top: 0.5rem;
  }
  
  .btn-batch-link span,
  .btn-delete-unbound span,
  .btn-refresh span,
  .btn-download span {
    display: none;
  }
}
</style>