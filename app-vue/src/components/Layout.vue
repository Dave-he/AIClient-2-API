<template>
  <div class="container">
    <Header />
    <div class="main-content">
      <Sidebar />
      <main class="content" role="main" id="content-container">
        <router-view v-slot="{ Component }" :key="route.fullPath">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import Header from './Header.vue'
import Sidebar from './Sidebar.vue'

const route = useRoute()
</script>

<style scoped>
.container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  display: flex;
  gap: 1rem;
  padding: 1rem;
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
}

.content {
  flex: 1;
  min-width: 0;
}

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
    padding: 0.5rem;
    gap: 0.5rem;
  }

  .content {
    position: relative;
    overflow: visible;
  }
}
</style>

<style>
#mobileMenuToggle.active {
  background: var(--primary-10);
  color: var(--primary-color);
}

@media (max-width: 768px) {
  #content-container {
    transition: opacity 0.3s ease;
  }

  #content-container.content-dimmed {
    opacity: 0.5;
    pointer-events: none;
  }
}
</style>