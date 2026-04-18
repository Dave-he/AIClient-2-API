import { ref } from 'vue';
import { apiClient } from '@/utils/api.js';
import { logger } from '@/utils/logger.js';

export function useStats() {
  const stats = ref({
    totalRequests: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0
  });

  const usageData = ref([]);
  const isLoading = ref(false);
  const error = ref('');
  const timeRange = ref('day');

  const fetchStats = async () => {
    isLoading.value = true;
    error.value = '';

    try {
      const response = await apiClient.get(`/api/usage?range=${timeRange.value}`);
      const data = response.data;

      stats.value = {
        totalRequests: data.totalRequests || 0,
        totalTokens: data.totalTokens || 0,
        inputTokens: data.inputTokens || 0,
        outputTokens: data.outputTokens || 0,
        cost: data.cost || 0
      };

      usageData.value = data.usage || [];
    } catch (err) {
      error.value = '获取统计数据失败';
      logger.error('Failed to fetch stats', err);
    } finally {
      isLoading.value = false;
    }
  };

  const fetchModelStats = async (model) => {
    try {
      const response = await apiClient.get(`/api/model-usage-stats?model=${model}`);
      return response.data;
    } catch (err) {
      logger.error('Failed to fetch model stats', err);
      throw err;
    }
  };

  return {
    stats,
    usageData,
    isLoading,
    error,
    timeRange,
    fetchStats,
    fetchModelStats
  };
}
