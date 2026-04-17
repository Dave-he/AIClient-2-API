<template>
  <section id="custom-models" class="section" aria-labelledby="custom-models-title">
    <h2 id="custom-models-title">自定义模型管理</h2>
    
    <div class="model-controls">
      <button class="btn btn-primary" @click="openAddModal">
        <i class="fas fa-plus"></i> 添加模型
      </button>
    </div>

    <div class="models-container">
      <div 
        v-for="model in models" 
        :key="model.id"
        class="model-card"
      >
        <div class="model-header">
          <div class="model-info">
            <h3>{{ model.name }}</h3>
            <span class="model-provider">{{ model.provider }}</span>
          </div>
          <div class="model-actions">
            <button class="action-btn" @click="editModel(model)" title="编辑">
              <i class="fas fa-edit"></i>
            </button>
            <button class="action-btn delete" @click="deleteModel(model.id)" title="删除">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        
        <div class="model-config">
          <div class="config-row">
            <span class="config-label">基础模型</span>
            <span class="config-value">{{ model.baseModel }}</span>
          </div>
          <div class="config-row">
            <span class="config-label">最大Token</span>
            <span class="config-value">{{ model.maxTokens }}</span>
          </div>
          <div class="config-row">
            <span class="config-label">温度</span>
            <span class="config-value">{{ model.temperature }}</span>
          </div>
          <div class="config-row">
            <span class="config-label">Top P</span>
            <span class="config-value">{{ model.topP }}</span>
          </div>
          <div class="config-row">
            <span class="config-label">频率惩罚</span>
            <span class="config-value">{{ model.frequencyPenalty }}</span>
          </div>
          <div class="config-row">
            <span class="config-label">存在惩罚</span>
            <span class="config-value">{{ model.presencePenalty }}</span>
          </div>
        </div>
        
        <div class="model-status">
          <span class="status-badge" :class="model.enabled ? 'success' : 'disabled'">
            {{ model.enabled ? '已启用' : '已禁用' }}
          </span>
          <button 
            class="btn btn-sm"
            :class="model.enabled ? 'btn-secondary' : 'btn-primary'"
            @click="toggleModel(model)"
          >
            {{ model.enabled ? '禁用' : '启用' }}
          </button>
        </div>
      </div>
      
      <div v-if="models.length === 0" class="empty-state">
        <i class="fas fa-cube"></i>
        <span>暂无自定义模型</span>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ isEditing ? '编辑模型' : '添加自定义模型' }}</h3>
          <button class="modal-close" @click="closeModal">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <form @submit.prevent="saveModel" class="modal-form">
          <div class="form-group">
            <label>模型名称</label>
            <input 
              type="text" 
              v-model="formData.name" 
              class="form-control" 
              placeholder="输入模型名称"
              required
            >
          </div>
          
          <div class="form-group">
            <label>提供商</label>
            <select v-model="formData.provider" class="form-control">
              <option value="openai-custom">OpenAI Custom</option>
              <option value="claude-custom">Claude Custom</option>
              <option value="gemini-cli-oauth">Gemini CLI OAuth</option>
              <option value="local-model">本地模型</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>基础模型</label>
            <input 
              type="text" 
              v-model="formData.baseModel" 
              class="form-control" 
              placeholder="如: gpt-4o-mini"
              required
            >
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>最大Token</label>
              <input 
                type="number" 
                v-model="formData.maxTokens" 
                class="form-control" 
                min="1" 
                max="100000"
              >
            </div>
            <div class="form-group">
              <label>温度</label>
              <input 
                type="number" 
                v-model="formData.temperature" 
                class="form-control" 
                min="0" 
                max="2" 
                step="0.1"
              >
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Top P</label>
              <input 
                type="number" 
                v-model="formData.topP" 
                class="form-control" 
                min="0" 
                max="1" 
                step="0.01"
              >
            </div>
            <div class="form-group">
              <label>频率惩罚</label>
              <input 
                type="number" 
                v-model="formData.frequencyPenalty" 
                class="form-control" 
                min="-2" 
                max="2" 
                step="0.1"
              >
            </div>
          </div>
          
          <div class="form-group">
            <label>存在惩罚</label>
            <input 
              type="number" 
              v-model="formData.presencePenalty" 
              class="form-control" 
              min="-2" 
              max="2" 
              step="0.1"
            >
          </div>
          
          <div class="form-group">
            <label>启用模型</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="formData.enabled">
              <span class="toggle-slider"></span>
            </label>
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
import { ref, reactive } from 'vue'

const models = ref([
  {
    id: '1',
    name: 'my-custom-gpt4',
    provider: 'OpenAI Custom',
    baseModel: 'gpt-4o-mini',
    maxTokens: 16384,
    temperature: 0.7,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
    enabled: true
  },
  {
    id: '2',
    name: 'creative-writer',
    provider: 'Claude Custom',
    baseModel: 'claude-3-5-sonnet-20241022',
    maxTokens: 200000,
    temperature: 1.2,
    topP: 0.85,
    frequencyPenalty: -0.5,
    presencePenalty: 0.5,
    enabled: true
  },
  {
    id: '3',
    name: 'code-assistant',
    provider: 'OpenAI Custom',
    baseModel: 'gpt-5-codex-mini',
    maxTokens: 8192,
    temperature: 0.2,
    topP: 0.5,
    frequencyPenalty: 0.1,
    presencePenalty: 0,
    enabled: false
  }
])

const showModal = ref(false)
const isEditing = ref(false)

const formData = reactive({
  id: '',
  name: '',
  provider: 'openai-custom',
  baseModel: '',
  maxTokens: 8192,
  temperature: 0.7,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  enabled: true
})

const openAddModal = () => {
  isEditing.value = false
  formData.id = ''
  formData.name = ''
  formData.provider = 'openai-custom'
  formData.baseModel = ''
  formData.maxTokens = 8192
  formData.temperature = 0.7
  formData.topP = 1
  formData.frequencyPenalty = 0
  formData.presencePenalty = 0
  formData.enabled = true
  showModal.value = true
}

const editModel = (model) => {
  isEditing.value = true
  Object.assign(formData, model)
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const saveModel = () => {
  if (!formData.name || !formData.baseModel) {
    alert('请填写模型名称和基础模型')
    return
  }
  
  if (isEditing.value) {
    const index = models.value.findIndex(m => m.id === formData.id)
    if (index > -1) {
      models.value[index] = { ...formData }
    }
  } else {
    models.value.push({
      ...formData,
      id: Date.now().toString()
    })
  }
  
  closeModal()
}

const deleteModel = (id) => {
  if (confirm('确定要删除这个模型吗？')) {
    models.value = models.value.filter(m => m.id !== id)
  }
}

const toggleModel = (model) => {
  model.enabled = !model.enabled
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

.model-controls {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
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
  padding: 0.25rem 0.75rem;
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

.models-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 1rem;
}

.model-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1rem;
}

.model-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.model-info h3 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  color: var(--text-primary);
}

.model-provider {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.model-actions {
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

.action-btn.delete:hover {
  color: var(--danger-color);
  border-color: var(--danger-color);
}

.model-config {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.config-row {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--border-color);
}

.config-row:last-child {
  border-bottom: none;
}

.config-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.config-value {
  font-size: 0.75rem;
  color: var(--text-primary);
  font-family: monospace;
}

.model-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge.success {
  background: var(--success-bg);
  color: var(--success-text);
}

.status-badge.disabled {
  background: var(--bg-secondary);
  color: var(--text-tertiary);
}

.empty-state {
  grid-column: 1 / -1;
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

.modal-form .form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
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

.modal-form .form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

@media (max-width: 768px) {
  .models-container {
    grid-template-columns: 1fr;
  }
  
  .modal-form .form-row {
    grid-template-columns: 1fr;
  }
}
</style>