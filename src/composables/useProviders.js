import { ref, computed } from 'vue';
import { apiClient } from '@/utils/api.js';

export function useProviders() {
  const providers = ref([]);
  const searchQuery = ref('');
  const stats = ref({
    activeConnections: 0,
    activeProviders: 0,
    healthyProviders: 0
  });

  const providerTypes = [
    { value: 'gemini-cli-oauth', label: 'Gemini CLI OAuth', icon: 'fa-robot' },
    { value: 'gemini-antigravity', label: 'Gemini Antigravity', icon: 'fa-rocket' },
    { value: 'openai-custom', label: 'OpenAI Custom', icon: 'fa-brain' },
    { value: 'claude-custom', label: 'Claude Custom', icon: 'fa-comment-dots' },
    { value: 'claude-kiro-oauth', label: 'Claude Kiro OAuth', icon: 'fa-key' },
    { value: 'openai-qwen-oauth', label: 'Qwen OAuth', icon: 'fa-cloud' },
    { value: 'openaiResponses-custom', label: 'OpenAI Responses', icon: 'fa-reply' },
    { value: 'openai-codex-oauth', label: 'OpenAI Codex OAuth', icon: 'fa-code' },
    { value: 'grok-custom', label: 'Grok Reverse', icon: 'fa-search' }
  ];

  const filteredProviders = computed(() => {
    if (!searchQuery.value) return providers.value;
    
    const query = searchQuery.value.toLowerCase();
    return providers.value.map(provider => ({
      ...provider,
      nodes: provider.nodes.filter(node => 
        node.name?.toLowerCase().includes(query) ||
        node.uuid?.toLowerCase().includes(query) ||
        node.email?.toLowerCase().includes(query)
      )
    })).filter(provider => provider.nodes.length > 0);
  });

  const getProviderIcon = (type) => {
    const provider = providerTypes.find(p => p.value === type);
    return provider?.icon || 'fa-server';
  };

  const getProviderTypeName = (type) => {
    const provider = providerTypes.find(p => p.value === type);
    return provider?.label || type;
  };

  const fetchProviders = async () => {
    try {
      const response = await apiClient.get('/api/providers');
      providers.value = Object.entries(response.data.providers || {}).map(([type, nodes]) => ({
        type,
        nodes: nodes.map(node => ({
          ...node,
          healthy: node.isHealthy !== false,
          lastUsed: node.lastUsed || '-'
        }))
      }));
      updateStats();
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      window.$toast?.error('获取提供商列表失败');
    }
  };

  const addProvider = async (data) => {
    try {
      await apiClient.post('/api/providers', data);
      await fetchProviders();
      window.$toast?.success('提供商添加成功');
    } catch (error) {
      window.$toast?.error('添加失败: ' + error.message);
      throw error;
    }
  };

  const updateProvider = async (providerType, nodeId, data) => {
    try {
      await apiClient.put(`/api/providers/${providerType}/${nodeId}`, data);
      await fetchProviders();
      window.$toast?.success('提供商更新成功');
    } catch (error) {
      window.$toast?.error('更新失败: ' + error.message);
      throw error;
    }
  };

  const deleteProvider = async (providerType, nodeId) => {
    try {
      await apiClient.delete(`/api/providers/${providerType}/${nodeId}`);
      await fetchProviders();
      window.$toast?.success('提供商删除成功');
    } catch (error) {
      window.$toast?.error('删除失败: ' + error.message);
      throw error;
    }
  };

  const performHealthCheck = async (providerType, nodeId) => {
    try {
      const response = await apiClient.post(`/api/providers/${providerType}/${nodeId}/health`);
      await fetchProviders();
      return response.data;
    } catch (error) {
      window.$toast?.error('健康检查失败: ' + error.message);
      throw error;
    }
  };

  const updateStats = () => {
    stats.value = {
      activeConnections: providers.value.reduce((sum, p) => sum + p.nodes.length, 0),
      activeProviders: providers.value.length,
      healthyProviders: providers.value.reduce((sum, p) => 
        sum + p.nodes.filter(n => n.healthy).length, 0)
    };
  };

  return {
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
    performHealthCheck,
    updateStats
  };
}