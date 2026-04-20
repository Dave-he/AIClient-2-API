import { ref } from 'vue';
import { apiClient } from '@/utils/api.js';
import { logger } from '@/utils/logger.js';

export function useAuth() {
  const isAuthenticated = ref(!!localStorage.getItem('authToken'));
  const isLoading = ref(false);
  const error = ref('');

  const handleLogin = async (username, password) => {
    if (!username || !password) {
      error.value = '请输入用户名和密码';
      return { success: false };
    }

    isLoading.value = true;
    error.value = '';

    try {
      const response = await apiClient.post('/api/login', {
        username,
        password
      });

      if (response.data.success) {
        localStorage.setItem('authToken', response.data.token);
        isAuthenticated.value = true;
        return { success: true, token: response.data.token };
      } else {
        error.value = response.data.message || '登录失败';
        return { success: false, message: error.value };
      }
    } catch (err) {
      error.value = err.response?.data?.message || '登录失败，请稍后重试';
      return { success: false, message: error.value };
    } finally {
      isLoading.value = false;
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    isAuthenticated.value = false;
    window.location.href = '/login';
  };

  const validateToken = async () => {
    try {
      const response = await apiClient.get('/api/validate-token');
      return response.data.valid;
    } catch (error) {
      return false;
    }
  };

  return {
    isAuthenticated,
    isLoading,
    error,
    handleLogin,
    logout,
    validateToken
  };
}
