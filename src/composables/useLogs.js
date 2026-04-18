import { ref, computed } from 'vue';
import { apiClient } from '@/utils/api.js';
import { logger } from '@/utils/logger.js';

export function useLogs() {
  const logs = ref([]);
  const isLoading = ref(false);
  const error = ref('');
  const searchQuery = ref('');
  const logLevel = ref('all');

  const filteredLogs = computed(() => {
    let result = logs.value;

    if (logLevel.value !== 'all') {
      result = result.filter(log => log.level === logLevel.value);
    }

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      result = result.filter(log =>
        log.message?.toLowerCase().includes(query) ||
        log.timestamp?.toLowerCase().includes(query)
      );
    }

    return result;
  });

  const fetchLogs = async () => {
    isLoading.value = true;
    error.value = '';

    try {
      const response = await apiClient.get('/api/logs');
      logs.value = response.data.logs || [];
    } catch (err) {
      error.value = '获取日志失败';
      logger.error('Failed to fetch logs', err);
    } finally {
      isLoading.value = false;
    }
  };

  const clearLogs = () => {
    logs.value = [];
  };

  const downloadLogs = async () => {
    try {
      const response = await apiClient.get('/api/logs/download');
      const blob = new Blob([response.data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      logger.error('Failed to download logs', err);
      window.$toast?.error('下载日志失败');
    }
  };

  return {
    logs,
    isLoading,
    error,
    searchQuery,
    logLevel,
    filteredLogs,
    fetchLogs,
    clearLogs,
    downloadLogs
  };
}
