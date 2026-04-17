<template>
  <span 
    class="model-tag"
    @click="handleClick"
  >
    {{ model }}
    <i class="fas fa-copy copy-icon"></i>
  </span>
</template>

<script setup>
defineProps({
  model: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['copy']);

const handleClick = async () => {
  try {
    await navigator.clipboard.writeText(model);
    window.$toast?.success(`已复制: ${model}`);
    emit('copy', model);
  } catch (error) {
    console.error('Failed to copy:', error);
  }
};
</script>

<style scoped>
.model-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition);
}

.model-tag:hover {
  background: var(--primary-10);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.copy-icon {
  opacity: 0;
  font-size: 0.625rem;
  transition: var(--transition);
}

.model-tag:hover .copy-icon {
  opacity: 1;
}
</style>