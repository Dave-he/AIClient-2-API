import { ref } from 'vue';
import { apiClient } from '@/utils/api.js';
import { logger } from '@/utils/logger.js';

export function usePlugins() {
  const plugins = ref([]);
  const isLoading = ref(false);
  const error = ref('');

  const fetchPlugins = async () => {
    isLoading.value = true;
    error.value = '';

    try {
      const response = await apiClient.get('/api/plugins');
      plugins.value = response.data.plugins || [];
    } catch (err) {
      error.value = '获取插件列表失败';
      logger.error('Failed to fetch plugins', err);
    } finally {
      isLoading.value = false;
    }
  };

  const enablePlugin = async (pluginName) => {
    try {
      await apiClient.post(`/api/plugins/${pluginName}/enable`);
      await fetchPlugins();
      window.$toast?.success('插件启用成功');
    } catch (err) {
      window.$toast?.error('启用插件失败');
      throw err;
    }
  };

  const disablePlugin = async (pluginName) => {
    try {
      await apiClient.post(`/api/plugins/${pluginName}/disable`);
      await fetchPlugins();
      window.$toast?.success('插件禁用成功');
    } catch (err) {
      window.$toast?.error('禁用插件失败');
      throw err;
    }
  };

  const configurePlugin = async (pluginName, config) => {
    try {
      await apiClient.post(`/api/plugins/${pluginName}/config`, config);
      await fetchPlugins();
      window.$toast?.success('插件配置更新成功');
    } catch (err) {
      window.$toast?.error('更新插件配置失败');
      throw err;
    }
  };

  return {
    plugins,
    isLoading,
    error,
    fetchPlugins,
    enablePlugin,
    disablePlugin,
    configurePlugin
  };
}
