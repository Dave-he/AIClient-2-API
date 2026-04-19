import { createRouter, createWebHistory } from 'vue-router';

const loadView = (view) => {
  return () => import(/* webpackChunkName: "view-[request]" */ `@/views/${view}.vue`);
};

const loadLayout = (layout) => {
  return () => import(/* webpackChunkName: "layout-[request]" */ `@/components/${layout}.vue`);
};

const routes = [
  {
    path: '/',
    name: 'Layout',
    component: loadLayout('Layout'),
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
    document.dispatchEvent(new CustomEvent('route-prefetch', { detail: to.name }));
  }
});

export { router };
export default router;