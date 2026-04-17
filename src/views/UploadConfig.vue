<template>
  <section id="upload-config" class="section" aria-labelledby="upload-config-title">
    <h2 id="upload-config-title">凭据文件管理</h2>
    
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

    <div class="credentials-list">
      <h3><i class="fas fa-file-folder"></i> 已上传的凭据文件</h3>
      
      <div v-if="credentials.length === 0" class="empty-state">
        <i class="fas fa-folder-open"></i>
        <p>暂无凭据文件</p>
      </div>
      
      <div 
        v-for="credential in credentials" 
        :key="credential.id" 
        class="credential-card"
      >
        <div class="credential-info">
          <div class="credential-icon">
            <i class="fas fa-file-json"></i>
          </div>
          <div class="credential-details">
            <h4 class="credential-name">{{ credential.filename }}</h4>
            <div class="credential-meta">
              <span class="meta-item">{{ credential.size }}</span>
              <span class="meta-divider">·</span>
              <span class="meta-item">{{ credential.provider }}</span>
              <span class="meta-divider">·</span>
              <span class="meta-item">{{ credential.lastModified }}</span>
            </div>
          </div>
        </div>
        <div class="credential-status" :class="credential.status">
          {{ credential.status === 'active' ? '已激活' : credential.status === 'expired' ? '已过期' : '待激活' }}
        </div>
        <div class="credential-actions">
          <button class="btn btn-sm btn-outline" @click="downloadCredential(credential)">
            <i class="fas fa-download"></i>
          </button>
          <button 
            v-if="credential.status !== 'active'" 
            class="btn btn-sm btn-primary" 
            @click="activateCredential(credential)"
          >
            <i class="fas fa-check"></i> 激活
          </button>
          <button class="btn btn-sm btn-danger" @click="deleteCredential(credential)">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="info-panel">
      <h3><i class="fas fa-info-circle"></i> 上传说明</h3>
      <div class="info-content">
        <div class="info-item">
          <i class="fas fa-file-json"></i>
          <div>
            <h4>支持的文件格式</h4>
            <p>仅支持 JSON 格式的凭据文件，文件大小不超过 1MB</p>
          </div>
        </div>
        <div class="info-item">
          <i class="fas fa-key"></i>
          <div>
            <h4>凭据文件来源</h4>
            <p>凭据文件可通过 OAuth 授权自动生成，或从其他环境导出后上传</p>
          </div>
        </div>
        <div class="info-item">
          <i class="fas fa-link"></i>
          <div>
            <h4>关联到提供商</h4>
            <p>上传后需要在提供商池管理中关联到对应的提供商节点</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'

const isDragging = ref(false)
const fileInput = ref(null)

const credentials = ref([
  {
    id: 1,
    filename: 'gemini-cli-oauth-token.json',
    size: '2.3 KB',
    provider: 'gemini-cli-oauth',
    lastModified: '2024-01-15 10:30:00',
    status: 'active'
  },
  {
    id: 2,
    filename: 'claude-kiro-oauth-token.json',
    size: '1.8 KB',
    provider: 'claude-kiro-oauth',
    lastModified: '2024-01-14 15:45:00',
    status: 'active'
  },
  {
    id: 3,
    filename: 'openai-custom-token.json',
    size: '1.2 KB',
    provider: 'openai-custom',
    lastModified: '2024-01-10 09:00:00',
    status: 'expired'
  },
  {
    id: 4,
    filename: 'gemini-antigravity-token.json',
    size: '2.1 KB',
    provider: 'gemini-antigravity',
    lastModified: '2024-01-16 11:20:00',
    status: 'pending'
  }
])

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

const processFiles = (files) => {
  files.forEach(file => {
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      const credential = {
        id: Date.now(),
        filename: file.name,
        size: formatFileSize(file.size),
        provider: extractProvider(file.name),
        lastModified: new Date().toLocaleString('zh-CN'),
        status: 'pending'
      }
      credentials.value.push(credential)
    } else {
      alert(`文件 ${file.name} 不是有效的 JSON 文件`)
    }
  })
}

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

const extractProvider = (filename) => {
  const providers = ['gemini-cli-oauth', 'gemini-antigravity', 'claude-kiro-oauth', 'openai-custom', 'claude-custom']
  for (const provider of providers) {
    if (filename.includes(provider)) {
      return provider
    }
  }
  return 'unknown'
}

const downloadCredential = (credential) => {
  alert(`下载 ${credential.filename}`)
}

const activateCredential = (credential) => {
  credential.status = 'active'
}

const deleteCredential = (credential) => {
  if (!confirm(`确定删除凭据文件 "${credential.filename}" 吗？`)) return
  credentials.value = credentials.value.filter(c => c.id !== credential.id)
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

.upload-area {
  margin-bottom: 1rem;
}

.drop-zone {
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-lg);
  padding: 3rem;
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
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--primary-10);
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
  font-size: 1.5rem;
}

.drop-zone h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.drop-zone p {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0 0 1rem;
}

.upload-btn {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--primary-color);
  background: var(--primary-color);
  color: white;
  transition: var(--transition);
}

.upload-btn:hover {
  background: var(--primary-hover);
}

.credentials-list {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  padding: 1rem;
  margin-bottom: 1rem;
}

.credentials-list h3 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.credentials-list h3 i {
  color: var(--primary-color);
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--text-tertiary);
}

.empty-state i {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.empty-state p {
  margin: 0;
}

.credential-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  margin-bottom: 0.5rem;
}

.credential-card:last-child {
  margin-bottom: 0;
}

.credential-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.credential-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.credential-details h4 {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
}

.credential-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.65rem;
  color: var(--text-tertiary);
}

.meta-item {
  color: var(--text-secondary);
}

.meta-divider {
  color: var(--text-tertiary);
}

.credential-status {
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.65rem;
  font-weight: 600;
}

.credential-status.active {
  background: var(--success-bg);
  color: var(--success-color);
}

.credential-status.expired {
  background: var(--danger-bg);
  color: var(--danger-color);
}

.credential-status.pending {
  background: var(--warning-bg);
  color: var(--warning-color);
}

.credential-actions {
  display: flex;
  gap: 0.375rem;
}

.btn {
  padding: 0.375rem 0.5rem;
  border-radius: var(--radius-md);
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border-color);
  transition: var(--transition);
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
}

.btn-outline:hover {
  background: var(--bg-tertiary);
}

.btn-sm {
  padding: 0.25rem 0.375rem;
}

.btn-danger {
  background: var(--danger-color);
  color: white;
  border-color: var(--danger-color);
}

.btn-danger:hover {
  background: var(--danger-hover);
}

.info-panel {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  padding: 1rem;
}

.info-panel h3 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.info-panel h3 i {
  color: var(--primary-color);
}

.info-content {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.info-item {
  display: flex;
  gap: 0.75rem;
}

.info-item i {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary-10);
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.info-item h4 {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
}

.info-item p {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin: 0;
}

@media (max-width: 768px) {
  .credential-card {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .credential-actions {
    margin-top: 0.5rem;
  }
  
  .info-content {
    grid-template-columns: 1fr;
  }
}
</style>
