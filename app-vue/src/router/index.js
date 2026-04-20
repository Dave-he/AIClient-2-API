import { createRouter, createWebHistory } from 'vue-router';

const loadView = (view) => {
  const viewMap = {
    'core/Dashboard': () => import('@/views/core/Dashboard.vue'),
    'guide/Guide': () => import('@/views/guide/Guide.vue'),
    'guide/Tutorial': () => import('@/views/guide/Tutorial.vue'),
    'config/Config': () => import('@/views/config/Config.vue'),
    'config/CustomModels': () => import('@/views/config/CustomModels.vue'),
    'config/UploadConfig': () => import('@/views/config/UploadConfig.vue'),
    'providers/Providers': () => import('@/views/providers/Providers.vue'),
    'providers/GPUMonitor': () => import('@/views/providers/GPUMonitor.vue'),
    'stats/Usage': () => import('@/views/stats/Usage.vue'),
    'stats/ModelUsageStats': () => import('@/views/stats/ModelUsageStats.vue'),
    'tools/Plugins': () => import('@/views/tools/Plugins.vue'),
    'tools/Logs': () => import('@/views/tools/Logs.vue'),
    'tools/TestAPI': () => import('@/views/tools/TestAPI.vue'),
    'plugins/Potluck': () => import('@/views/plugins/Potluck.vue'),
    'plugins/PotluckUser': () => import('@/views/plugins/PotluckUser.vue'),
    'core/Login': () => import('@/views/core/Login.vue'),
    'core/NotFound': () => import('@/views/core/NotFound.vue')
  };
  return viewMap[view] || (() => import('@/views/core/NotFound.vue'));
};

const prefetchViewMap = {
  Dashboard: () => import('@/views/core/Dashboard.vue'),
  Guide: () => import('@/views/guide/Guide.vue'),
  Config: () => import('@/views/config/Config.vue'),
  Providers: () => import('@/views/providers/Providers.vue')
};

import Layout from '@/components/Layout.vue';

const routes = [
  {
    path: '/',
    name: 'Layout',
    component: Layout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: loadView('core/Dashboard'),
        meta: { prefetch: true }
      },
      {
        path: 'guide',
        name: 'Guide',
        component: loadView('guide/Guide'),
        meta: { prefetch: true }
      },
      {
        path: 'tutorial',
        name: 'Tutorial',
        component: loadView('guide/Tutorial')
      },
      {
        path: 'config',
        name: 'Config',
        component: loadView('config/Config'),
        meta: { prefetch: true }
      },
      {
        path: 'providers',
        name: 'Providers',
        component: loadView('providers/Providers'),
        meta: { prefetch: true }
      },
      {
        path: 'custom-models',
        name: 'CustomModels',
        component: loadView('config/CustomModels')
      },
      {
        path: 'upload-config',
        name: 'UploadConfig',
        component: loadView('config/UploadConfig')
      },
      {
        path: 'usage',
        name: 'Usage',
        component: loadView('stats/Usage')
      },
      {
        path: 'plugins',
        name: 'Plugins',
        component: loadView('tools/Plugins')
      },
      {
        path: 'logs',
        name: 'Logs',
        component: loadView('tools/Logs')
      },
      {
        path: 'gpu-monitor',
        name: 'GPUMonitor',
        component: loadView('providers/GPUMonitor')
      },
      {
        path: 'test-api',
        name: 'TestAPI',
        component: loadView('tools/TestAPI')
      },
      {
        path: 'model-usage-stats',
        name: 'ModelUsageStats',
        component: loadView('stats/ModelUsageStats')
      },
      {
        path: 'potluck',
        name: 'Potluck',
        component: loadView('plugins/Potluck')
      },
      {
        path: 'potluck-user',
        name: 'PotluckUser',
        component: loadView('plugins/PotluckUser')
      }
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: loadView('core/Login')
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: loadView('core/NotFound')
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth'
      };
    } else {
      return { top: 0, behavior: 'smooth' };
    }
  }
});

router.beforeEach((to, from, next) => {
  const isAuthenticated = localStorage.getItem('authToken');
  
  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login');
  } else if (to.path === '/login' && isAuthenticated) {
    next('/');
  } else {
    next();
  }
});

router.afterEach((to) => {
  if (to.meta.prefetch) {
    prefetchViewMap[to.name]?.();
    document.dispatchEvent(new CustomEvent('route-prefetch', { detail: to.name }));
  }
});

export { router };
export default router;