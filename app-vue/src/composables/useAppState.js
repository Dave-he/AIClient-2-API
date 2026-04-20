import { ref, computed, watch } from 'vue';
import { logger } from '@/utils/logger.js';

const appState = ref({
  user: null,
  theme: 'light',
  locale: 'zh-CN',
  sidebarCollapsed: false,
  notifications: [],
  systemStatus: 'online',
  settings: {
    autoRefresh: true,
    refreshInterval: 5000,
    showNotifications: true,
    compactMode: false
  }
});

let notificationId = 0;

export function useAppState() {
  const user = computed(() => appState.value.user);
  const theme = computed(() => appState.value.theme);
  const locale = computed(() => appState.value.locale);
  const sidebarCollapsed = computed(() => appState.value.sidebarCollapsed);
  const notifications = computed(() => appState.value.notifications);
  const systemStatus = computed(() => appState.value.systemStatus);
  const settings = computed(() => appState.value.settings);

  const setUser = (userData) => {
    appState.value.user = userData;
  };

  const setTheme = (newTheme) => {
    appState.value.theme = newTheme;
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const setLocale = (newLocale) => {
    appState.value.locale = newLocale;
    localStorage.setItem('locale', newLocale);
  };

  const toggleSidebar = () => {
    appState.value.sidebarCollapsed = !appState.value.sidebarCollapsed;
  };

  const setSidebarCollapsed = (collapsed) => {
    appState.value.sidebarCollapsed = collapsed;
  };

  const addNotification = (options) => {
    const id = ++notificationId;
    const notification = {
      id,
      type: options.type || 'info',
      message: options.message,
      title: options.title,
      duration: options.duration || 3000,
      dismissible: options.dismissible !== false
    };
    
    appState.value.notifications.push(notification);

    if (notification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration);
    }

    return id;
  };

  const removeNotification = (id) => {
    const index = appState.value.notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      appState.value.notifications.splice(index, 1);
    }
  };

  const clearNotifications = () => {
    appState.value.notifications = [];
  };

  const setSystemStatus = (status) => {
    appState.value.systemStatus = status;
  };

  const updateSettings = (newSettings) => {
    appState.value.settings = { ...appState.value.settings, ...newSettings };
    localStorage.setItem('appSettings', JSON.stringify(appState.value.settings));
  };

  const loadSettings = () => {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        appState.value.settings = { ...appState.value.settings, ...parsed };
      } catch (e) {
        logger.error('Failed to load settings:', e);
      }
    }
  };

  const resetSettings = () => {
    appState.value.settings = {
      autoRefresh: true,
      refreshInterval: 5000,
      showNotifications: true,
      compactMode: false
    };
    localStorage.removeItem('appSettings');
  };

  watch(theme, (newTheme) => {
    document.documentElement.setAttribute('data-theme', newTheme);
  });

  watch(locale, (newLocale) => {
    localStorage.setItem('locale', newLocale);
  });

  return {
    user,
    theme,
    locale,
    sidebarCollapsed,
    notifications,
    systemStatus,
    settings,
    setUser,
    setTheme,
    setLocale,
    toggleSidebar,
    setSidebarCollapsed,
    addNotification,
    removeNotification,
    clearNotifications,
    setSystemStatus,
    updateSettings,
    loadSettings,
    resetSettings
  };
}
