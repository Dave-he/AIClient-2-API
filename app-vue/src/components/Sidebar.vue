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
  { path: '/gpu-monitor', label: 'GPU监控', icon: 'fa-video-card', section: 'gpu-monitor' },
  { path: '/test-api', label: 'API测试', icon: 'fa-flask', section: 'test-api' },
  { path: '/model-usage-stats', label: '模型用量统计', icon: 'fa-bar-chart', section: 'model-usage-stats' },
  { path: '/potluck', label: 'API大锅饭', icon: 'fa-users', section: 'potluck' },
  { path: '/potluck-user', label: '用户管理', icon: 'fa-user', section: 'potluck-user' }
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
    width: 260px;
    position: fixed;
    left: -280px;
    top: 60px;
    bottom: 0;
    z-index: 999;
    transition: left 0.3s ease;
    border-radius: 0;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
    overflow-y: auto;
  }

  .sidebar.sidebar-visible {
    left: 0;
  }

  .sidebar-nav {
    flex-direction: column;
    padding: 0.5rem;
    gap: 0.25rem;
  }

  .nav-item {
    flex-direction: row;
    padding: 0.75rem 1rem;
    min-width: auto;
    text-align: left;
    gap: 0.75rem;
  }

  .nav-item span {
    font-size: 0.85rem;
  }
}

@media (max-width: 480px) {
  .sidebar {
    width: 240px;
    left: -260px;
  }

  .sidebar.sidebar-visible {
    left: 0;
  }

  .nav-item {
    padding: 0.6rem 0.75rem;
  }

  .nav-item span {
    font-size: 0.8rem;
  }
}
</style>
