import { apiClient } from '@/utils/api.js';

export const authApi = {
  login: (username, password) => apiClient.post('/api/login', { username, password }),
  logout: () => apiClient.post('/api/logout'),
  validateToken: () => apiClient.get('/api/validate-token')
};

export const configApi = {
  get: () => apiClient.get('/api/config'),
  save: (config) => apiClient.post('/api/config', config),
  upload: (file) => apiClient.upload('/api/config/upload', file)
};

export const providerApi = {
  getAll: () => apiClient.get('/api/providers'),
  add: (data) => apiClient.post('/api/providers', data),
  update: (providerType, nodeId, data) => apiClient.put(`/api/providers/${providerType}/${nodeId}`, data),
  delete: (providerType, nodeId) => apiClient.delete(`/api/providers/${providerType}/${nodeId}`),
  healthCheck: (providerType, nodeId) => apiClient.post(`/api/providers/${providerType}/${nodeId}/health`),
  getModels: () => apiClient.get('/api/provider-models')
};

export const gpuApi = {
  getStatus: () => apiClient.get('/api/gpu/status'),
  getPythonStatus: () => apiClient.get('/api/python-gpu/status')
};

export const systemApi = {
  getInfo: () => apiClient.get('/api/system'),
  getMonitor: () => apiClient.get('/api/system/monitor'),
  checkUpdate: () => apiClient.get('/api/system/check-update'),
  performUpdate: () => apiClient.post('/api/system/update')
};

export const logsApi = {
  getAll: () => apiClient.get('/api/logs'),
  download: () => apiClient.get('/api/logs/download'),
  clear: () => apiClient.delete('/api/logs')
};

export const pluginsApi = {
  getAll: () => apiClient.get('/api/plugins'),
  enable: (name) => apiClient.post(`/api/plugins/${name}/enable`),
  disable: (name) => apiClient.post(`/api/plugins/${name}/disable`),
  configure: (name, config) => apiClient.post(`/api/plugins/${name}/config`, config)
};

export const usageApi = {
  getStats: (range = 'day') => apiClient.get(`/api/usage?range=${range}`),
  getModelStats: (model) => apiClient.get(`/api/model-usage-stats?model=${model}`)
};

export const oauthApi = {
  getAuthUrl: (provider) => apiClient.get(`/api/oauth/${provider}/url`),
  handleCallback: (provider, callbackUrl) => apiClient.post(`/api/oauth/${provider}/callback`, { callbackUrl }),
  refresh: (provider) => apiClient.post(`/api/oauth/${provider}/refresh`)
};

export default {
  auth: authApi,
  config: configApi,
  provider: providerApi,
  gpu: gpuApi,
  system: systemApi,
  logs: logsApi,
  plugins: pluginsApi,
  usage: usageApi,
  oauth: oauthApi
};
