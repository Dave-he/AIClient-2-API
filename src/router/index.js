import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/components/Layout.vue'),
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
      }
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
