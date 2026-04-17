import axios from 'axios';
import { router } from '@/router/index.js';

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

export const apiClient = {
  get: (url, config = {}) => {
    return requestWithRetry(() => api.get(url, config));
  },

  post: (url, data = {}, config = {}) => {
    return requestWithRetry(() => api.post(url, data, config));
  },

  put: (url, data = {}, config = {}) => {
    return requestWithRetry(() => api.put(url, data, config));
  },

  patch: (url, data = {}, config = {}) => {
    return requestWithRetry(() => api.patch(url, data, config));
  },

  delete: (url, config = {}) => {
    return requestWithRetry(() => api.delete(url, config));
  },

  upload: (url, file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return api.post(url, formData, {
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
  },

  createDownload: (url, filename) => {
    return api.get(url, { responseType: 'blob' }).then(response => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    });
  },

  cancelToken: axios.CancelToken,

  isCancel: axios.isCancel
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