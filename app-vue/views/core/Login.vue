<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100">
    <div class="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md mx-4">
      <div class="text-center mb-8">
        <div class="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-robot text-emerald-500 text-3xl"></i>
        </div>
        <h1 class="text-2xl font-bold text-slate-800">{{ $t('login.title') }}</h1>
        <p class="text-slate-500 mt-2">{{ $t('login.subtitle') }}</p>
      </div>

      <form @submit.prevent="handleLogin">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">{{ $t('login.username') }}</label>
            <input
              type="text"
              v-model="username"
              class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              :placeholder="$t('login.usernamePlaceholder')"
              :disabled="isLoading"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">{{ $t('login.password') }}</label>
            <div class="relative">
              <input
                :type="showPassword ? 'text' : 'password'"
                v-model="password"
                class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                :placeholder="$t('login.passwordPlaceholder')"
                :disabled="isLoading"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                @click="showPassword = !showPassword"
                :aria-label="$t('common.passwordToggle')"
              >
                <i :class="['fas', showPassword ? 'fa-eye-slash' : 'fa-eye']"></i>
              </button>
            </div>
          </div>

          <button
            type="submit"
            class="w-full py-3 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
            :disabled="isLoading || !username || !password"
          >
            <i v-if="isLoading" class="fas fa-spinner fa-spin"></i>
            {{ isLoading ? $t('login.loginLoading') : $t('login.loginButton') }}
          </button>
        </div>

        <div v-if="error" class="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {{ error }}
        </div>
      </form>

      <div class="mt-6 text-center">
        <p class="text-sm text-slate-500">
          {{ $t('login.defaultUsername') }}: <code class="px-2 py-1 bg-slate-100 rounded text-slate-700">admin</code>
        </p>
        <p class="text-sm text-slate-500 mt-1">
          {{ $t('login.defaultPassword') }}: <code class="px-2 py-1 bg-slate-100 rounded text-slate-700">admin123</code>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiClient, setToken } from '@/utils/api.js';

const { t } = useI18n();
const username = ref('admin');
const password = ref('');
const showPassword = ref(false);
const isLoading = ref(false);
const error = ref('');

const handleLogin = async () => {
  if (!username.value || !password.value) {
    error.value = t('login.usernamePasswordRequired');
    return;
  }

  isLoading.value = true;
  error.value = '';

  try {
    const response = await apiClient.post('/api/login', {
      username: username.value,
      password: password.value
    });

    if (response.data.success) {
      setToken(response.data.token);
      window.location.href = '/vue/';
    } else {
      error.value = response.data.message || t('login.loginFailed');
    }
  } catch (err) {
    error.value = err.response?.data?.message || t('login.loginFailedTryLater');
  } finally {
    isLoading.value = false;
  }
};
</script>
