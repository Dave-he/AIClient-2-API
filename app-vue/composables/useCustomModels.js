import { ref } from 'vue';
import { apiClient } from '@/utils/api.js';
import { logger } from '@/utils/logger.js';

export function useCustomModels() {
  const models = ref([]);
  const showModal = ref(false);
  const isEditing = ref(false);

  const providers = [
    { value: 'openai-custom', label: 'OpenAI Custom' },
    { value: 'claude-custom', label: 'Claude Custom' },
    { value: 'gemini-cli-oauth', label: 'Gemini CLI OAuth' },
    { value: 'claude-kiro-oauth', label: 'Claude Kiro OAuth' },
    { value: 'openai-qwen-oauth', label: 'Qwen OAuth' },
    { value: 'openai-codex-oauth', label: 'OpenAI Codex OAuth' },
    { value: 'grok-custom', label: 'Grok Reverse' }
  ];

  const formData = ref({
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
  });

  const fetchModels = async () => {
    try {
      const response = await apiClient.get('/api/custom-models');
      models.value = response.data.models || [];
    } catch (error) {
      logger.error('Failed to fetch custom models', error);
      window.$toast?.error('获取自定义模型失败');
    }
  };

  const openAddModal = () => {
    isEditing.value = false;
    formData.value = {
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
    };
    showModal.value = true;
  };

  const editModel = (model) => {
    isEditing.value = true;
    formData.value = { ...model };
    showModal.value = true;
  };

  const closeModal = () => {
    showModal.value = false;
  };

  const saveModel = async () => {
    if (!formData.value.name || !formData.value.baseModel) {
      window.$toast?.error('请填写模型名称和基础模型');
      return;
    }

    try {
      if (isEditing.value) {
        await apiClient.put(`/api/custom-models/${formData.value.id}`, formData.value);
        window.$toast?.success('模型更新成功');
      } else {
        await apiClient.post('/api/custom-models', formData.value);
        window.$toast?.success('模型添加成功');
      }
      await fetchModels();
      closeModal();
    } catch (error) {
      window.$toast?.error('保存失败: ' + error.message);
    }
  };

  const deleteModel = async (id) => {
    if (!confirm('确定要删除这个模型吗？')) return;

    try {
      await apiClient.delete(`/api/custom-models/${id}`);
      await fetchModels();
      window.$toast?.success('模型删除成功');
    } catch (error) {
      window.$toast?.error('删除失败: ' + error.message);
    }
  };

  const toggleModel = async (model) => {
    try {
      await apiClient.patch(`/api/custom-models/${model.id}/toggle`, {
        enabled: !model.enabled
      });
      await fetchModels();
      window.$toast?.success(model.enabled ? '模型已禁用' : '模型已启用');
    } catch (error) {
      window.$toast?.error('操作失败: ' + error.message);
    }
  };

  return {
    models,
    showModal,
    isEditing,
    formData,
    providers,
    fetchModels,
    openAddModal,
    editModel,
    closeModal,
    saveModel,
    deleteModel,
    toggleModel
  };
}