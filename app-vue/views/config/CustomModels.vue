<template>
  <section id="custom-models" class="section" aria-labelledby="custom-models-title">
    <div class="section-header">
      <h2 id="custom-models-title">自定义模型管理</h2>
      <button class="btn btn-primary" @click="openAddModal">
        <i class="fas fa-plus"></i> 添加模型
      </button>
    </div>
    
    <div class="pool-description">
      <div class="highlight-note">
        <i class="fas fa-info-circle"></i>
        <span>自定义模型管理支持三种用法：1. 为已存在模型定义默认参数设置；2. 将一个模型映射到其他提供商或实际模型；3. 新建一个模型并加入模型列表，新建模型后需要重启服务生效。</span>
      </div>
    </div>

    <div class="custom-models-container">
      <div class="table-responsive">
        <table class="custom-models-table">
          <thead>
            <tr>
              <th>模型 ID / 别名</th>
              <th>显示名称</th>
              <th>列表提供商</th>
              <th>实际路由</th>
              <th>参数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="model in models" :key="model.id">
              <td>
                <div class="model-id-cell">
                  <span class="model-id">{{ model.id }}</span>
                  <span v-if="model.alias" class="model-alias">别名: {{ model.alias }}</span>
                </div>
              </td>
              <td>{{ model.name || '-' }}</td>
              <td>
                <span class="provider-badge">{{ getProviderLabel(model.provider) }}</span>
              </td>
              <td>
                <div v-if="model.actualProvider || model.actualModel" class="actual-route">
                  <span v-if="model.actualProvider" class="actual-provider">{{ getProviderLabel(model.actualProvider) }}</span>
                  <span v-if="model.actualModel" class="actual-model">{{ model.actualModel }}</span>
                </div>
                <span v-else class="no-route">-</span>
              </td>
              <td class="params-cell">
                <div class="params-list">
                  <span v-if="model.maxTokens" class="param-item">maxTokens: {{ model.maxTokens }}</span>
                  <span v-if="model.temperature !== undefined" class="param-item">temp: {{ model.temperature }}</span>
                  <span v-if="model.contextLength" class="param-item">ctx: {{ model.contextLength }}</span>
                </div>
              </td>
              <td class="actions-cell">
                <button class="action-btn" @click="editModel(model)" title="编辑">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete" @click="deleteModel(model.id)" title="删除">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
            <tr v-if="models.length === 0">
              <td colspan="6" class="empty-row">
                <div class="empty-state">
                  <i class="fas fa-cube"></i>
                  <span>暂无自定义模型</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3><i class="fas fa-cube"></i> {{ isEditing ? '编辑模型' : '添加模型' }}</h3>
          <button class="modal-close" @click="closeModal">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <form @submit.prevent="saveModel" class="modal-form">
          <input type="hidden" v-model="formData.originalId">
          
          <div class="form-row">
            <div class="form-group">
              <label>模型 ID</label>
              <input 
                type="text" 
                v-model="formData.id" 
                class="form-control" 
                placeholder="my-custom-gpt4"
                required
              >
            </div>
            <div class="form-group">
              <label>显示名称</label>
              <input 
                type="text" 
                v-model="formData.name" 
                class="form-control" 
                placeholder="我的模型"
              >
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>调用别名</label>
              <input 
                type="text" 
                v-model="formData.alias" 
                class="form-control" 
                placeholder="gpt-4"
              >
            </div>
            <div class="form-group">
              <label>模型列表提供商</label>
              <select v-model="formData.provider" class="form-control" required>
                <option v-for="p in providerTypes" :key="p.value" :value="p.value">
                  {{ p.label }}
                </option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>实际路由提供商</label>
            <select v-model="formData.actualProvider" class="form-control">
              <option value="">不指定（使用列表提供商）</option>
              <option v-for="p in providerTypes" :key="p.value" :value="p.value">
                {{ p.label }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>下游实际模型 ID</label>
            <input 
              type="text" 
              v-model="formData.actualModel" 
              class="form-control" 
              placeholder="gpt-4-0613"
            >
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>上下文长度</label>
              <input 
                type="number" 
                v-model="formData.contextLength" 
                class="form-control" 
                placeholder="8192"
              >
            </div>
            <div class="form-group">
              <label>最大 Token</label>
              <input 
                type="number" 
                v-model="formData.maxTokens" 
                class="form-control" 
                placeholder="4096"
              >
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>温度 (Temp)</label>
              <input 
                type="number" 
                v-model="formData.temperature" 
                class="form-control" 
                step="0.1" 
                min="0" 
                max="2"
                placeholder="0.7"
              >
            </div>
            <div class="form-group">
              <label>Top P</label>
              <input 
                type="number" 
                v-model="formData.topP" 
                class="form-control" 
                step="0.01" 
                min="0" 
                max="1"
                placeholder="1.0"
              >
            </div>
          </div>

          <div class="form-group">
            <label>描述</label>
            <textarea 
              v-model="formData.description" 
              class="form-control" 
              rows="2"
              placeholder="模型描述..."
            ></textarea>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="closeModal">取消</button>
            <button type="submit" class="btn btn-primary">
              <i class="fas fa-save"></i> 保存配置
            </button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted } from 'vue'
import { useCustomModels } from '@/composables/useCustomModels.js'

const {
  models,
  showModal,
  isEditing,
  formData,
  openAddModal,
  editModel,
  closeModal,
  saveModel,
  deleteModel,
  fetchModels
} = useCustomModels()

const providerTypes = [
  { value: 'openai-custom', label: 'OpenAI Custom' },
  { value: 'claude-custom', label: 'Claude Custom' },
  { value: 'gemini-cli-oauth', label: 'Gemini CLI OAuth' },
  { value: 'gemini-antigravity', label: 'Gemini Antigravity' },
  { value: 'claude-kiro-oauth', label: 'Claude Kiro OAuth' },
  { value: 'openai-qwen-oauth', label: 'Qwen OAuth' },
  { value: 'openai-codex-oauth', label: 'Codex OAuth' },
  { value: 'openai-iflow', label: 'iFlow OAuth' },
  { value: 'grok-custom', label: 'Grok Custom' },
  { value: 'local-model', label: '本地模型' }
]

const getProviderLabel = (type) => {
  const provider = providerTypes.find(p => p.value === type)
  return provider?.label || type
}

onMounted(() => {
  fetchModels()
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

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h2 {
  margin: 0;
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

.pool-description {
  margin-bottom: 1rem;
}

.highlight-note {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--info-bg-light);
  border-radius: var(--radius-md);
  color: var(--info-text);
  font-size: 0.85rem;
}

.highlight-note i {
  flex-shrink: 0;
  color: var(--info-color);
}

.custom-models-container {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.table-responsive {
  overflow-x: auto;
}

.custom-models-table {
  width: 100%;
  border-collapse: collapse;
}

.custom-models-table thead {
  background: var(--bg-secondary);
}

.custom-models-table th,
.custom-models-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.custom-models-table th {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.8rem;
}

.custom-models-table td {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.model-id-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.model-id {
  font-family: monospace;
  color: var(--text-primary);
}

.model-alias {
  font-size: 0.7rem;
  color: var(--text-tertiary);
  font-style: italic;
}

.provider-badge {
  padding: 0.25rem 0.5rem;
  background: var(--primary-10);
  color: var(--primary-color);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
}

.actual-route {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.actual-provider {
  font-size: 0.75rem;
  color: var(--primary-color);
}

.actual-model {
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--text-primary);
}

.no-route {
  color: var(--text-tertiary);
}

.params-cell {
  min-width: 180px;
}

.params-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.param-item {
  font-size: 0.7rem;
  padding: 0.125rem 0.375rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  font-family: monospace;
}

.actions-cell {
  white-space: nowrap;
}

.action-btn {
  padding: 0.375rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: var(--transition);
  margin-right: 0.25rem;
}

.action-btn:hover {
  background: var(--bg-tertiary);
  color: var(--primary-color);
}

.action-btn.delete:hover {
  color: var(--danger-color);
  border-color: var(--danger-color);
}

.empty-row {
  text-align: center;
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
  max-width: 600px;
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
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

.modal-form textarea.form-control {
  resize: vertical;
  min-height: 60px;
}

.modal-form .form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

@media (max-width: 768px) {
  .section-header {
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-start;
  }
  
  .custom-models-table {
    font-size: 0.75rem;
  }
  
  .custom-models-table th,
  .custom-models-table td {
    padding: 0.5rem;
  }
  
  .modal-form .form-row {
    grid-template-columns: 1fr;
  }
}
</style>