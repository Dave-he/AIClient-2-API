<template>
  <div class="page-container">
    <aside 
      class="sidebar fixed left-0 top-0 h-screen bg-slate-800 text-white transition-all duration-300 z-50"
      :class="[
        isCollapsed ? 'w-16' : 'w-64',
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      ]"
    >
      <div class="flex flex-col h-full">
        <div class="p-4 border-b border-slate-700 flex items-center justify-between">
          <div v-if="!isCollapsed" class="flex items-center gap-3">
            <i class="fas fa-robot text-xl text-emerald-400"></i>
            <span class="font-bold text-lg">AIClient2API</span>
          </div>
          <div v-else class="flex items-center justify-center w-full">
            <i class="fas fa-robot text-xl text-emerald-400"></i>
          </div>
          <button 
            class="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            @click="isCollapsed = !isCollapsed"
          >
            <i class="fas fa-chevron-left" :class="{ 'rotate-180': isCollapsed }"></i>
          </button>
        </div>
        
        <nav class="flex-1 p-3 space-y-1 overflow-y-auto">
          <div v-for="group in menuGroups" :key="group.name" class="mb-4">
            <div v-if="!isCollapsed" class="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {{ group.name }}
            </div>
            <div class="space-y-1">
              <router-link
                v-for="item in group.items"
                :key="item.path"
                :to="item.path"
                class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200"
                :class="[
                  $route.path === item.path 
                    ? 'bg-emerald-600 text-white' 
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                ]"
              >
                <i :class="['fas', item.icon, 'text-lg flex-shrink-0']"></i>
                <span v-if="!isCollapsed" class="text-sm font-medium">{{ item.label }}</span>
                <span 
                  v-if="item.badge && !isCollapsed" 
                  class="ml-auto text-xs px-2 py-0.5 rounded-full"
                  :class="getBadgeClass(item.badge)"
                >
                  {{ item.badge }}
                </span>
                <span 
                  v-if="item.badge && isCollapsed" 
                  class="ml-auto w-2 h-2 rounded-full"
                  :class="getBadgeDotClass(item.badge)"
                ></span>
              </router-link>
            </div>
          </div>
        </nav>
        
        <div class="p-3 border-t border-slate-700">
          <button 
            class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
            @click="handleLogout"
          >
            <i class="fas fa-sign-out-alt text-lg"></i>
            <span v-if="!isCollapsed" class="text-sm font-medium">登出</span>
          </button>
        </div>
      </div>
    </aside>
    
    <div 
      v-if="isMobileMenuOpen" 
      class="fixed inset-0 bg-black/50 z-40 md:hidden"
      @click="isMobileMenuOpen = false"
    ></div>
    
    <div class="main-content flex-1 ml-0 md:ml-16 lg:ml-64 transition-all duration-300">
      <header class="header bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div class="flex items-center gap-4">
          <button 
            class="md:hidden p-2 hover:bg-slate-100 rounded-lg"
            @click="isMobileMenuOpen = !isMobileMenuOpen"
          >
            <i class="fas fa-bars"></i>
          </button>
          <h1 class="text-lg font-semibold text-slate-800">
            {{ currentPageTitle }}
          </h1>
        </div>
        
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full">
            <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span class="text-sm text-emerald-700">在线</span>
          </div>
          <button class="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <i class="fas fa-sun text-slate-600"></i>
          </button>
          <a 
            href="https://github.com/justlovemaki/AIClient-2-API" 
            target="_blank"
            class="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <i class="fab fa-github text-slate-600"></i>
          </a>
        </div>
      </header>
      
      <main class="content-area">
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
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isCollapsed = ref(false)
const isMobileMenuOpen = ref(false)

const menuGroups = [
  {
    name: '概览',
    items: [
      { path: '/', label: '仪表盘', icon: 'fa-tachometer-alt' },
      { path: '/usage', label: '用量查询', icon: 'fa-chart-bar' },
      { path: '/logs', label: '实时日志', icon: 'fa-file-alt' },
      { path: '/gpu-monitor', label: 'GPU监控', icon: 'fa-video-card' }
    ]
  },
  {
    name: '配置管理',
    items: [
      { path: '/config', label: '系统配置', icon: 'fa-cog' },
      { path: '/providers', label: '提供商池', icon: 'fa-network-wired', badge: '5' },
      { path: '/custom-models', label: '自定义模型', icon: 'fa-cubes' },
      { path: '/upload-config', label: '凭据文件', icon: 'fa-upload' }
    ]
  },
  {
    name: '扩展',
    items: [
      { path: '/plugins', label: '插件管理', icon: 'fa-puzzle-piece', badge: '3' },
      { path: '/guide', label: '使用指南', icon: 'fa-book' },
      { path: '/tutorial', label: '配置教程', icon: 'fa-graduation-cap' }
    ]
  }
]

const currentPageTitle = computed(() => {
  const pathMap = {
    '/': '系统概览',
    '/guide': '使用指南',
    '/tutorial': '配置教程',
    '/config': '系统配置',
    '/providers': '提供商池管理',
    '/custom-models': '自定义模型管理',
    '/upload-config': '凭据文件管理',
    '/usage': '用量查询',
    '/plugins': '插件管理',
    '/logs': '实时日志',
    '/gpu-monitor': 'GPU监控面板'
  }
  return pathMap[route.path] || 'AIClient2API'
})

const getBadgeClass = (badge) => {
  return 'bg-emerald-500 text-white'
}

const getBadgeDotClass = (badge) => {
  return 'bg-emerald-500'
}

const handleLogout = () => {
  localStorage.removeItem('authToken')
  window.location.href = '/login'
}
</script>

<style scoped>
.nav-item {
  position: relative;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background-color: #059669;
  border-radius: 0 3px 3px 0;
}

@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
  }
}
</style>
