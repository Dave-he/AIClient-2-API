import { ref, reactive } from 'vue';
import { apiClient } from '@/utils/api.js';
import { logger } from '@/utils/logger.js';

export function useConfig() {
  const config = reactive({
    apiKey: '123456',
    host: '127.0.0.1',
    port: 3000,
    enabledProviders: ['gemini-cli-oauth'],
    proxyUrl: '',
    proxyProviders: [],
    tlsSidecarEnabled: false,
    tlsSidecarPort: 9090,
    tlsSidecarProxyUrl: '',
    tlsSidecarProviders: [],
    requestMaxRetries: 3,
    requestBaseDelay: 1000,
    credentialSwitchMaxRetries: 5,
    maxErrorCount: 10,
    warmupTarget: 0,
    refreshConcurrencyPerProvider: 1,
    providerFallbackChain: '{}',
    modelFallbackMapping: '{}',
    cronNearMinutes: 1,
    cronRefreshToken: true,
    loginExpiry: 3600,
    scheduledHealthCheckEnabled: false,
    scheduledHealthCheckStartupRun: true,
    scheduledHealthCheckInterval: 600000,
    healthCheckProviders: [],
    logEnabled: true,
    logOutputMode: 'all',
    logLevel: 'info',
    logDir: 'logs',
    logMaxFileSize: 10485760,
    logMaxFiles: 10,
    logIncludeRequestId: true,
    logIncludeTimestamp: true,
    promptLogMode: 'none',
    promptLogBaseName: '',
    providerPoolsFilePath: 'configs/provider_pools.json',
    systemPromptFilePath: '',
    systemPromptMode: 'append',
    systemPrompt: '',
    systemPromptReplacements: [],
    adminPassword: ''
  });

  const originalConfig = ref(null);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const showApiKey = ref(false);
  const showAdminPassword = ref(false);

  const fetchConfig = async () => {
    isLoading.value = true;
    try {
      const response = await apiClient.get('/api/config');
      Object.assign(config, response.data);
      originalConfig.value = JSON.parse(JSON.stringify(response.data));
    } catch (error) {
      logger.error('Failed to fetch config', error);
      window.$toast?.error('获取配置失败');
    } finally {
      isLoading.value = false;
    }
  };

  const saveConfig = async () => {
    isSaving.value = true;
    try {
      await apiClient.post('/api/config', config);
      originalConfig.value = JSON.parse(JSON.stringify(config));
      window.$toast?.success('配置保存成功');
    } catch (error) {
      logger.error('Failed to save config', error);
      window.$toast?.error('保存配置失败');
      throw error;
    } finally {
      isSaving.value = false;
    }
  };

  const resetConfig = () => {
    if (originalConfig.value) {
      Object.assign(config, originalConfig.value);
    }
  };

  const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    config.apiKey = key;
  };

  const toggleProvider = (value) => {
    const index = config.enabledProviders.indexOf(value);
    if (index === -1) {
      config.enabledProviders.push(value);
    } else {
      config.enabledProviders.splice(index, 1);
    }
  };

  return {
    config,
    originalConfig,
    isLoading,
    isSaving,
    showApiKey,
    showAdminPassword,
    fetchConfig,
    saveConfig,
    resetConfig,
    generateApiKey,
    toggleProvider
  };
}
