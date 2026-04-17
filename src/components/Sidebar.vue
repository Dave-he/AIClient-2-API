<template>
  <aside class="sidebar" role="navigation" aria-label="Main Navigation">
    <nav class="sidebar-nav">
      <router-link 
        v-for="item in navItems" 
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
        :data-section="item.section"
      >
        <i :class="['fas', item.icon]" aria-hidden="true"></i> 
        <span>{{ item.label }}</span>
      </router-link>
    </nav>
  </aside>
</template>

<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  { path: '/', label: '仪表盘', icon: 'fa-tachometer-alt', section: 'dashboard' },
  { path: '/guide', label: '使用指南', icon: 'fa-book', section: 'guide' },
  { path: '/tutorial', label: '配置教程', icon: 'fa-graduation-cap', section: 'tutorial' },
  { path: '/config', label: '配置管理', icon: 'fa-cog', section: 'config' },
  { path: '/providers', label: '提供商池管理', icon: 'fa-network-wired', section: 'providers' },
  { path: '/custom-models', label: '自定义模型管理', icon: 'fa-cubes', section: 'custom-models' },
  { path: '/upload-config', label: '凭据文件管理', icon: 'fa-upload', section: 'upload-config' },
  { path: '/usage', label: '用量查询', icon: 'fa-chart-bar', section: 'usage' },
  { path: '/plugins', label: '插件管理', icon: 'fa-puzzle-piece', section: 'plugins' },
  { path: '/logs', label: '实时日志', icon: 'fa-file-alt', section: 'logs' },
  { path: '/gpu-monitor', label: 'GPU监控', icon: 'fa-video-card', section: 'gpu-monitor' }
]

const isActive = (path) => {
  if (path === '/' && route.path === '/') {
    return true
  }
  return route.path.startsWith(path) && path !== '/'
}
</script>

<style scoped>
.sidebar {
  width: 260px;
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  height: fit-content;
  position: sticky;
  top: 5rem;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  color: var(--text-secondary);
  text-decoration: none;
  transition: var(--transition);
  font-weight: 500;
  cursor: pointer;
  border-radius: var(--radius-lg);
  user-select: none;
}

.nav-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--primary-10);
  color: var(--primary-color);
  font-weight: 600;
}

.nav-item i {
  width: 20px;
  text-align: center;
  font-size: 1.1em;
}

@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
    position: relative;
    top: 0;
  }

  .sidebar-nav {
    flex-direction: row;
    overflow-x: auto;
    padding: 0 1rem;
    gap: 0.25rem;
  }

  .nav-item {
    flex-direction: column;
    padding: 0.5rem;
    min-width: 60px;
    text-align: center;
    gap: 0.25rem;
  }

  .nav-item span {
    font-size: 0.65rem;
  }
}

@media (max-width: 480px) {
  .sidebar-nav {
    gap: 0.125rem;
  }

  .nav-item {
    min-width: 50px;
    padding: 0.35rem;
  }

  .nav-item i {
    font-size: 0.9em;
  }
}
</style>
