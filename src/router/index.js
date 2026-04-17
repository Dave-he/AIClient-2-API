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
        component: () => import('@/views/Dashboard.vue')
      },
      {
        path: 'guide',
        name: 'Guide',
        component: () => import('@/views/Guide.vue')
      },
      {
        path: 'tutorial',
        name: 'Tutorial',
        component: () => import('@/views/Tutorial.vue')
      },
      {
        path: 'config',
        name: 'Config',
        component: () => import('@/views/Config.vue')
      },
      {
        path: 'providers',
        name: 'Providers',
        component: () => import('@/views/Providers.vue')
      },
      {
        path: 'custom-models',
        name: 'CustomModels',
        component: () => import('@/views/CustomModels.vue')
      },
      {
        path: 'upload-config',
        name: 'UploadConfig',
        component: () => import('@/views/UploadConfig.vue')
      },
      {
        path: 'usage',
        name: 'Usage',
        component: () => import('@/views/Usage.vue')
      },
      {
        path: 'plugins',
        name: 'Plugins',
        component: () => import('@/views/Plugins.vue')
      },
      {
        path: 'logs',
        name: 'Logs',
        component: () => import('@/views/Logs.vue')
      },
      {
        path: 'gpu-monitor',
        name: 'GPUMonitor',
        component: () => import('@/views/GPUMonitor.vue')
      },
      {
        path: 'test-api',
        name: 'TestAPI',
        component: () => import('@/views/TestAPI.vue')
      },
      {
        path: 'model-usage-stats',
        name: 'ModelUsageStats',
        component: () => import('@/views/ModelUsageStats.vue')
      },
      {
        path: 'potluck',
        name: 'Potluck',
        component: () => import('@/views/Potluck.vue')
      },
      {
        path: 'potluck-user',
        name: 'PotluckUser',
        component: () => import('@/views/PotluckUser.vue')
      }
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue')
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

export default router;
