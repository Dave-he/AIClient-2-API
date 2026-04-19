<template>
  <header class="header">
    <div class="header-content">
      <h1><i class="fas fa-robot"></i> <span class="header-title">AIClient2API 管理控制台</span></h1>
      <button class="mobile-menu-toggle" id="mobileMenuToggle" aria-label="Menu" title="菜单">
        <i class="fas fa-bars"></i>
      </button>
      <div class="header-controls" id="headerControls">
        <a href="https://a001.hubtoday.app/" target="_blank" class="kiro-buy-link" title="AI账号购买">
          <i class="fas fa-shopping-cart"></i> <span>AI账号购买</span>
        </a>
        <span class="status-badge" :class="{ error: !isOnline }" id="serverStatus">
          <i class="fas fa-circle"></i> <span class="status-text">{{ isOnline ? '在线' : '离线' }}</span>
        </span>
        <a href="https://github.com/justlovemaki/AIClient-2-API" target="_blank" rel="noopener noreferrer" class="github-link" title="GitHub">
          <i class="fab fa-github"></i>
        </a>
        <button id="themeToggleBtn" class="theme-toggle" aria-label="Toggle Theme" title="切换主题" @click="toggleTheme">
          <i class="fas fa-moon" v-if="currentTheme === 'light'"></i>
          <i class="fas fa-sun" v-else></i>
        </button>
        <button id="logoutBtn" class="logout-btn" title="Logout" @click="handleLogout">
          <i class="fas fa-sign-out-alt"></i> <span>登出</span>
        </button>
        <button id="restartBtn" class="logout-btn" aria-label="Restart Service" @click="handleRestart">
          <i :class="['fas', restarting ? 'fa-spin fa-circle-notch' : 'fa-redo']" id="restartBtnIcon"></i> 
          <span id="restartBtnText" class="btn-text">{{ restarting ? '重启中...' : '重启' }}</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { apiClient, removeToken } from '@/utils/api.js';

const isOnline = ref(true);
const currentTheme = ref('light');
const restarting = ref(false);
const mobileMenuOpen = ref(false);

const checkServerStatus = async () => {
  try {
    const response = await apiClient.get('/api/system');
    isOnline.value = response.status === 200;
  } catch (error) {
    isOnline.value = false;
  }
};

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value;
  const menu = document.getElementById('content-container');
  const toggle = document.getElementById('mobileMenuToggle');
  if (menu && toggle) {
    menu.classList.toggle('sidebar-visible', mobileMenuOpen.value);
    toggle.classList.toggle('active', mobileMenuOpen.value);
  }
};

const toggleTheme = () => {
  const newTheme = currentTheme.value === 'light' ? 'dark' : 'light';
  currentTheme.value = newTheme;
  localStorage.setItem('theme', newTheme);
  document.documentElement.setAttribute('data-theme', newTheme);
};

const handleLogout = async () => {
  if (confirm('确定要登出吗？')) {
    removeToken();
    window.location.href = '/vue/login';
  }
};

const handleRestart = async () => {
  if (confirm('确定要重启服务吗？')) {
    restarting.value = true;
    try {
      await apiClient.post('/api/system/restart');
      window.$toast?.success('服务重启请求已发送');
    } catch (error) {
      window.$toast?.error('重启失败: ' + error.message);
    } finally {
      restarting.value = false;
    }
  }
};

let statusInterval = null;

onMounted(() => {
  const savedTheme = localStorage.getItem('theme') || 'light';
  currentTheme.value = savedTheme;
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  checkServerStatus();
  statusInterval = setInterval(checkServerStatus, 10000);

  // 绑定移动端菜单按钮事件
  const mobileToggle = document.getElementById('mobileMenuToggle');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', toggleMobileMenu);
  }

  // 点击内容区域关闭移动端菜单
  document.addEventListener('click', (e) => {
    if (mobileMenuOpen.value && !e.target.closest('.sidebar') && !e.target.closest('#mobileMenuToggle')) {
      mobileMenuOpen.value = false;
      const menu = document.getElementById('content-container');
      const toggle = document.getElementById('mobileMenuToggle');
      if (menu && toggle) {
        menu.classList.remove('sidebar-visible');
        toggle.classList.remove('active');
      }
    }
  });
});

onUnmounted(() => {
  if (statusInterval) {
    clearInterval(statusInterval);
  }
  
  const mobileToggle = document.getElementById('mobileMenuToggle');
  if (mobileToggle) {
    mobileToggle.removeEventListener('click', toggleMobileMenu);
  }
});
</script>

<style scoped>
.header {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 100;
  transition: var(--transition);
}

.header-content {
  max-width: 1600px;
  margin: 0 auto;
  padding: 0.75rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h1 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  letter-spacing: -0.025em;
}

.header h1 i {
  margin-right: 0.5rem;
  color: var(--primary-color);
}

.header-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.mobile-menu-toggle {
  display: none;
  padding: 0.5rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition);
}

.mobile-menu-toggle:hover {
  background: var(--bg-tertiary);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.status-badge i {
  color: var(--success-color);
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  font-size: 0.6rem;
}

.status-badge.error i {
  color: var(--danger-color);
}

.status-badge.error {
  background: var(--danger-bg-light);
}

.logout-btn {
  padding: 0.5rem 1rem;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.logout-btn:hover {
  background: var(--bg-tertiary);
  color: var(--danger-color);
  border-color: var(--danger-color);
}

.logout-btn:active {
  transform: scale(0.98);
}

.logout-btn i {
  font-size: 14px;
}

.github-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.125rem;
  transition: var(--transition);
  text-decoration: none;
  position: relative;
  overflow: hidden;
}

.github-link:hover {
  background: var(--bg-tertiary);
  color: var(--primary-color);
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.github-link:active {
  transform: translateY(0);
}

.github-link i {
  transition: transform 0.3s ease;
}

.kiro-buy-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  text-decoration: none;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  transition: var(--transition);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.kiro-buy-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
}

.kiro-buy-link:active {
  transform: translateY(0);
}

.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  background: var(--theme-toggle-bg);
  color: var(--theme-toggle-icon);
  border: 1px solid var(--border-color);
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.125rem;
  transition: var(--transition);
}

.theme-toggle:hover {
  background: var(--bg-tertiary);
  color: var(--primary-color);
  border-color: var(--primary-color);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@media (max-width: 1024px) {
  .kiro-buy-link span {
    display: none;
  }
  
  .kiro-buy-link {
    padding: 0.5rem;
    border-radius: 50%;
  }
}

@media (max-width: 768px) {
  .header-content {
    padding: 0.75rem 1rem;
  }
  
  .mobile-menu-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .header h1 {
    font-size: 1rem;
  }
  
  .header-controls {
    gap: 0.5rem;
  }
  
  .logout-btn span {
    display: none;
  }
  
  .status-badge {
    padding: 0.3rem 0.6rem;
    font-size: 0.65rem;
  }
  
  .kiro-buy-link {
    display: none;
  }
}
</style>