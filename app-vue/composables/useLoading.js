import { ref } from 'vue';

const loadingCount = ref(0);
const loadingText = ref('');

export function useLoading() {
  const isLoading = () => loadingCount.value > 0;

  const startLoading = (text = '加载中...') => {
    loadingCount.value++;
    loadingText.value = text;
  };

  const stopLoading = () => {
    if (loadingCount.value > 0) {
      loadingCount.value--;
    }
    if (loadingCount.value === 0) {
      loadingText.value = '';
    }
  };

  const resetLoading = () => {
    loadingCount.value = 0;
    loadingText.value = '';
  };

  return {
    isLoading,
    loadingCount,
    loadingText,
    startLoading,
    stopLoading,
    resetLoading
  };
}

export { loadingCount, loadingText };
