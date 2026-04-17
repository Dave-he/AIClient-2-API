import axios from 'axios';
import { router } from '@/router/index.js';
import { performanceMonitor } from '@/utils/performance.js';
import { logger } from '@/utils/logger.js';

const createApiInstance = (baseURL = window.location.origin) => {
  const token = localStorage.getItem('authToken');
  const instance = axios.create({
    baseURL,
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    },
    timeout: 30000,
    withCredentials: true
  });

  instance.interceptors.request.use(
    (config) => {
      const currentToken = localStorage.getItem('authToken');
      if (currentToken) {
        config.headers.Authorization = `Bearer ${currentToken}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  instance.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      if (error.response?.status === 401) {
        localStorage.removeItem('authToken');
        if (router) {
          router.push('/login');
        } else {
          window.location.href = '/vue/login';
        }
      } else if (error.response?.status === 403) {
        window.$toast?.error('权限不足');
      } else if (error.response?.status === 500) {
        window.$toast?.error('服务器内部错误');
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

const api = createApiInstance();

const requestWithRetry = async (fn, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && error.response?.status >= 500) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return requestWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

const withPerformance = async (fn, method, url) => {
  const startTime = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - startTime;
    performanceMonitor.recordApiCall(duration, true);
    logger.debug(`API ${method} ${url} completed in ${duration.toFixed(2)}ms`);
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitor.recordApiCall(duration, false);
    logger.error(`API ${method} ${url} failed in ${duration.toFixed(2)}ms`, error);
    throw error;
  }
};

export const apiClient = {
  get: async (url, config = {}) => {
    return withPerformance(
      () => requestWithRetry(() => api.get(url, config)),
      'GET',
      url
    );
  },

  post: async (url, data = {}, config = {}) => {
    return withPerformance(
      () => requestWithRetry(() => api.post(url, data, config)),
      'POST',
      url
    );
  },

  put: async (url, data = {}, config = {}) => {
    return withPerformance(
      () => requestWithRetry(() => api.put(url, data, config)),
      'PUT',
      url
    );
  },

  patch: async (url, data = {}, config = {}) => {
    return withPerformance(
      () => requestWithRetry(() => api.patch(url, data, config)),
      'PATCH',
      url
    );
  },

  delete: async (url, config = {}) => {
    return withPerformance(
      () => requestWithRetry(() => api.delete(url, config)),
      'DELETE',
      url
    );
  },

  upload: async (url, file, onProgress) => {
    const startTime = performance.now();
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const result = await api.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (onProgress) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(percentCompleted);
          }
        }
      });
      const duration = performance.now() - startTime;
      performanceMonitor.recordApiCall(duration, true);
      logger.debug(`API UPLOAD ${url} completed in ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordApiCall(duration, false);
      logger.error(`API UPLOAD ${url} failed in ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  },

  createDownload: async (url, filename) => {
    const startTime = performance.now();
    try {
      const response = await api.get(url, { responseType: 'blob' });
      const duration = performance.now() - startTime;
      performanceMonitor.recordApiCall(duration, true);
      logger.debug(`API DOWNLOAD ${url} completed in ${duration.toFixed(2)}ms`);
      
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordApiCall(duration, false);
      logger.error(`API DOWNLOAD ${url} failed in ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  },

  cancelToken: axios.CancelToken,

  isCancel: axios.isCancel,

  getStats: () => {
    return performanceMonitor.getStats();
  },

  resetStats: () => {
    performanceMonitor.reset();
  }
};

export const getToken = () => {
  return localStorage.getItem('authToken');
};

export const setToken = (token) => {
  localStorage.setItem('authToken', token);
};

export const removeToken = () => {
  localStorage.removeItem('authToken');
};

export const refreshApiInstance = (baseURL) => {
  return createApiInstance(baseURL);
};

export default apiClient;