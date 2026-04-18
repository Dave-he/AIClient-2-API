import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/components/Layout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/core/Dashboard.vue')
      },
      {
        path: 'guide',
        name: 'Guide',
        component: () => import('@/views/guide/Guide.vue')
      },
      {
        path: 'tutorial',
        name: 'Tutorial',
        component: () => import('@/views/guide/Tutorial.vue')
      },
      {
        path: 'config',
        name: 'Config',
        component: () => import('@/views/config/Config.vue')
      },
      {
        path: 'providers',
        name: 'Providers',
        component: () => import('@/views/providers/Providers.vue')
      },
      {
        path: 'custom-models',
        name: 'CustomModels',
        component: () => import('@/views/config/CustomModels.vue')
      },
      {
        path: 'upload-config',
        name: 'UploadConfig',
        component: () => import('@/views/config/UploadConfig.vue')
      },
      {
        path: 'usage',
        name: 'Usage',
        component: () => import('@/views/stats/Usage.vue')
      },
      {
        path: 'plugins',
        name: 'Plugins',
        component: () => import('@/views/tools/Plugins.vue')
      },
      {
        path: 'logs',
        name: 'Logs',
        component: () => import('@/views/tools/Logs.vue')
      },
      {
        path: 'gpu-monitor',
        name: 'GPUMonitor',
        component: () => import('@/views/providers/GPUMonitor.vue')
      },
      {
        path: 'test-api',
        name: 'TestAPI',
        component: () => import('@/views/tools/TestAPI.vue')
      },
      {
        path: 'model-usage-stats',
        name: 'ModelUsageStats',
        component: () => import('@/views/stats/ModelUsageStats.vue')
      },
      {
        path: 'potluck',
        name: 'Potluck',
        component: () => import('@/views/plugins/Potluck.vue')
      },
      {
        path: 'potluck-user',
        name: 'PotluckUser',
        component: () => import('@/views/plugins/PotluckUser.vue')
      }
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/core/Login.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/core/NotFound.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

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

export { router };
export default router;
