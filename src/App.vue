<template>
  <div id="app">
    <ErrorBoundary>
      <router-view v-slot="{ Component }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </router-view>
    </ErrorBoundary>
    <Toast ref="toastRef" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import Toast from '@/components/Toast.vue';
import ErrorBoundary from '@/components/ErrorBoundary.vue';

const toastRef = ref(null);

const showToast = {
  success: (message, duration) => toastRef.value?.success(message, duration),
  error: (message, duration) => toastRef.value?.error(message, duration),
  warning: (message, duration) => toastRef.value?.warning(message, duration),
  info: (message, duration) => toastRef.value?.info(message, duration)
};

globalThis.$toast = showToast;
</script>

<style>
#app {
  min-height: 100vh;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
