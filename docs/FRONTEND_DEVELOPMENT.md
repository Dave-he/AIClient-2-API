# 前端开发文档

## 1. 项目概述

### 1.1 技术栈

AIClient-2-API 前端采用现代 Vue 3 技术栈：

| 技术 | 说明 | 版本 |
|------|------|------|
| **Vue 3** | 前端框架 | 3.4+ |
| **Vue Router** | 路由管理 | 4.2+ |
| **Vite** | 构建工具 | 8.0+ |
| **Element Plus** | UI 组件库 | 2.5+ |
| **Vue I18n** | 国际化 | 9.9+ |
| **Axios** | HTTP 请求 | 1.6+ |
| **Tailwind CSS** | CSS 框架 | 3.4+ |

### 1.2 新旧前端

项目包含两套前端系统：

| 系统 | 技术 | 位置 | 说明 |
|------|------|------|------|
| **新前端** | Vue 3 + Vite | `app-vue/` | 推荐使用，现代化架构，可独立运行 |
| **旧前端** | 原生 JS + Web Components | `static/` | 保留兼容，逐步迁移 |

### 1.3 独立运行

Vue 前端可以完全独立于后端运行，方便前端开发调试：

```bash
# 进入 Vue 项目目录
cd app-vue

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env

# 启动开发服务器
npm run dev

# 访问 http://localhost:5173
```

---

## 2. 项目结构

### 2.1 新前端结构（Vue 3）

```
app-vue/
├── src/                      # 源代码
│   ├── components/           # Vue 组件
│   │   ├── Header.vue        # 页头（语言/主题切换）
│   │   ├── Layout.vue       # 布局容器
│   │   ├── Loading.vue      # 加载状态
│   │   ├── Modal.vue        # 模态框
│   │   ├── ModelTag.vue     # 模型标签
│   │   ├── ProviderCard.vue # 提供商卡片
│   │   ├── ProviderNode.vue # 提供商节点状态
│   │   ├── Sidebar.vue      # 侧边栏导航
│   │   ├── StatCard.vue     # 统计卡片
│   │   └── Toast.vue        # 消息提示
│   ├── composables/         # 组合式函数
│   │   ├── index.js         # 导出入口
│   │   ├── useApi.js        # API 调用封装
│   │   ├── useAppState.js   # 应用状态管理
│   │   ├── useAuth.js       # 认证逻辑
│   │   ├── useConfig.js     # 配置管理
│   │   ├── useCustomModels.js # 自定义模型
│   │   ├── useDashboard.js  # 仪表板数据
│   │   ├── useGPUMonitor.js # GPU 监控
│   │   ├── useLoading.js    # 加载状态
│   │   ├── useLogs.js       # 日志管理
│   │   ├── usePlugins.js    # 插件管理
│   │   ├── useProviders.js  # 提供商管理
│   │   └── useStats.js      # 统计数据
│   ├── views/                # 页面视图
│   │   ├── core/            # 核心页面
│   │   │   ├── Dashboard.vue # 仪表板
│   │   │   ├── Login.vue    # 登录页
│   │   │   └── NotFound.vue # 404 页面
│   │   ├── config/          # 配置页面
│   │   │   ├── Config.vue   # 配置管理
│   │   │   ├── CustomModels.vue # 自定义模型
│   │   │   └── UploadConfig.vue # 配置上传
│   │   ├── providers/       # 提供商页面
│   │   │   ├── Providers.vue # 提供商列表
│   │   │   └── GPUMonitor.vue # GPU 监控
│   │   ├── stats/           # 统计页面
│   │   │   ├── Usage.vue    # 用量统计
│   │   │   └── ModelUsageStats.vue # 模型统计
│   │   ├── plugins/         # 插件页面
│   │   │   ├── Potluck.vue  # 大锅饭管理
│   │   │   └── PotluckUser.vue # 用户管理
│   │   ├── guide/           # 指南页面
│   │   │   ├── Guide.vue    # 使用指南
│   │   │   └── Tutorial.vue # 教程
│   │   └── tools/           # 工具页面
│   │       ├── Logs.vue     # 日志查看
│   │       ├── Plugins.vue  # 插件管理
│   │       └── TestAPI.vue  # API 测试
│   ├── router/              # 路由配置
│   │   └── index.js         # 路由定义（含权限守卫）
│   ├── locales/             # 国际化
│   │   ├── index.js         # i18n 配置
│   │   ├── zh-CN.json       # 中文翻译
│   │   └── en.json          # 英文翻译
│   ├── utils/               # 工具函数
│   │   ├── api.js           # API 客户端
│   │   ├── chart.js         # 图表配置
│   │   ├── error-handler.js # 错误处理
│   │   ├── logger.js        # 日志工具
│   │   ├── performance.js   # 性能监控
│   │   └── request-cache.js # 请求缓存
│   ├── App.vue              # 根组件
│   ├── main.js              # 应用入口
│   └── style.css            # 全局样式
├── dist/                    # 构建输出
├── vite.config.js           # Vite 配置
├── package.json             # 依赖管理
├── tailwind.config.js       # Tailwind 配置
├── postcss.config.js        # PostCSS 配置
├── .env.example             # 环境变量示例
└── README.md                # 项目文档
```

### 2.2 旧前端结构（原生 JS）

```
static/
├── app/                   # 应用核心
│   ├── app.js             # 主应用
│   ├── auth.js            # 认证
│   ├── config-manager.js  # 配置管理
│   ├── i18n.js            # 国际化
│   ├── navigation.js      # 导航
│   ├── event-stream.js    # 事件流
│   └── ...
├── components/            # Web Components
├── index.html             # 主页面
└── login.html             # 登录页面
```

---

## 3. 新前端开发（Vue 3）

---

## 3. 新前端开发（Vue 3）

### 3.1 快速开始

#### 独立运行（推荐开发方式）

Vue 前端可以完全独立运行，不需要启动后端服务：

```bash
# 1. 进入 Vue 项目目录
cd app-vue

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 设置 VITE_API_BASE_URL（后端 API 地址）

# 4. 启动开发服务器
npm run dev

# 5. 访问 http://localhost:5173
```

#### 环境变量说明

创建 `.env` 文件配置开发环境：

```env
# 开发服务器端口
VITE_PORT=5173

# 后端 API 地址（用于代理）
VITE_API_BASE_URL=http://localhost:3000

# 预览服务器端口
VITE_PREVIEW_PORT=9090
```

#### 与后端联调

如果需要与后端联调，确保后端服务已启动：

```bash
# 终端 1：启动后端服务（在项目根目录）
npm run dev

# 终端 2：启动 Vue 前端（在 app-vue 目录）
cd app-vue && npm run dev
```

#### 构建生产版本

```bash
npm run build    # 构建到 dist/ 目录
npm run preview  # 预览构建结果
```

### 3.2 路由配置

路由定义在 `src/router/index.js`：

```javascript
import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from '@/views/core/Dashboard.vue';
import Config from '@/views/config/Config.vue';
// ... 其他导入

const routes = [
    {
        path: '/',
        name: 'Dashboard',
        component: Dashboard
    },
    {
        path: '/config',
        name: 'Config',
        component: Config
    },
    // ... 其他路由
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

export default router;
```

### 3.3 组合式函数（Composables）

项目使用 Vue 3 组合式函数来复用逻辑。

#### useApi.js - API 调用

```javascript
import { ref } from 'vue';

export function useApi() {
    const loading = ref(false);
    const error = ref(null);
    const data = ref(null);

    const request = async (method, endpoint, body = null) => {
        loading.value = true;
        error.value = null;
        try {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            if (body) {
                options.body = JSON.stringify(body);
            }
            const response = await fetch(endpoint, options);
            data.value = await response.json();
            return data.value;
        } catch (err) {
            error.value = err;
            throw err;
        } finally {
            loading.value = false;
        }
    };

    return { loading, error, data, request };
}
```

#### useAuth.js - 认证

```javascript
import { ref, computed } from 'vue';

export function useAuth() {
    const isAuthenticated = ref(false);
    const user = ref(null);

    const login = async (password) => {
        // 登录逻辑
        isAuthenticated.value = true;
    };

    const logout = () => {
        isAuthenticated.value = false;
        user.value = null;
    };

    return { isAuthenticated, user, login, logout };
}
```

### 3.4 组件开发

#### Toast 组件示例

```vue
<template>
  <div class="toast-container">
    <div v-for="toast in toasts" :key="toast.id" class="toast">
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const toasts = ref([]);

const show = (message, type = 'info', duration = 3000) => {
    const id = Date.now();
    toasts.value.push({ id, message, type });
    setTimeout(() => {
        toasts.value = toasts.value.filter(t => t.id !== id);
    }, duration);
};

const success = (message, duration) => show(message, 'success', duration);
const error = (message, duration) => show(message, 'error', duration);
const warning = (message, duration) => show(message, 'warning', duration);
const info = (message, duration) => show(message, 'info', duration);

defineExpose({ success, error, warning, info });
</script>

<style scoped>
.toast-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
}
.toast {
    padding: 12px 24px;
    margin: 8px;
    border-radius: 4px;
    color: white;
    background: #333;
}
</style>
```

### 3.5 页面开发

#### Dashboard 页面示例

```vue
<template>
  <Layout>
    <h1>Dashboard</h1>
    <div class="stats-grid">
      <StatCard title="Total Requests" :value="stats.totalRequests" />
      <StatCard title="Active Providers" :value="stats.activeProviders" />
    </div>
  </Layout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import Layout from '@/components/Layout.vue';
import StatCard from '@/components/StatCard.vue';
import { useDashboard } from '@/composables/useDashboard';

const { stats, fetchStats } = useDashboard();

onMounted(() => {
    fetchStats();
});
</script>

<style scoped>
.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-top: 24px;
}
</style>
```

---

## 4. 旧前端开发（原生 JS）

### 4.1 应用结构

旧前端采用模块化的原生 JavaScript 开发：

```javascript
// static/app/app.js
class App {
    constructor() {
        this.modules = {};
    }

    init() {
        // 初始化模块
        this.initAuth();
        this.initNavigation();
        this.initConfig();
    }
}
```

### 4.2 Web Components

旧前端使用原生 Web Components：

```javascript
// 自定义元素定义
class ProviderCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <div class="provider-card">
                <!-- 内容 -->
            </div>
        `;
    }
}

customElements.define('provider-card', ProviderCard);
```

---

## 5. 样式指南

### 5.1 Tailwind CSS

新前端使用 Tailwind CSS：

```vue
<template>
  <div class="flex items-center justify-between p-4 bg-white rounded-lg shadow">
    <h1 class="text-xl font-bold text-gray-800">Title</h1>
    <button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
      Button
    </button>
  </div>
</template>
```

### 5.2 全局样式

全局样式定义在 `src/style.css`：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
    --primary-color: #3b82f6;
    --secondary-color: #64748b;
}

body {
    font-family: system-ui, -apple-system, sans-serif;
}
```

---

## 6. 状态管理

### 6.1 简单状态管理

对于简单状态，使用 Vue 的响应式 API：

```javascript
import { reactive, computed } from 'vue';

const state = reactive({
    user: null,
    isAuthenticated: false,
    config: {}
});

const isLoggedIn = computed(() => state.isAuthenticated);

export const useStore = () => ({
    state,
    isLoggedIn,
    setUser: (user) => { state.user = user; },
    setAuth: (value) => { state.isAuthenticated = value; }
});
```

---

## 7. API 调用

### 7.1 使用 fetch

```javascript
// 获取配置
const fetchConfig = async () => {
    const response = await fetch('/api/config');
    return await response.json();
};

// 更新配置
const updateConfig = async (newConfig) => {
    const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
    });
    return await response.json();
};
```

### 7.2 SSE 事件流

```javascript
const connectEventStream = () => {
    const eventSource = new EventSource('/api/events');

    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // 处理事件
    };

    eventSource.onerror = () => {
        console.error('SSE 连接失败');
    };

    return eventSource;
};
```

---

## 8. 国际化（i18n）

### 8.1 使用 i18n

旧前端有完整的国际化系统：

```javascript
// static/app/i18n.js
const i18n = {
    currentLang: 'zh-CN',
    translations: {
        'zh-CN': {
            'dashboard.title': '仪表板',
            'config.title': '配置'
        },
        'en': {
            'dashboard.title': 'Dashboard',
            'config.title': 'Config'
        }
    },

    t(key) {
        return this.translations[this.currentLang]?.[key] || key;
    }
};
```

---

## 9. 开发工具

### 9.1 Vue DevTools

推荐安装 Vue DevTools 浏览器扩展：
- Chrome: https://chrome.google.com/webstore/detail/vuejs-devtools/
- Firefox: https://addons.mozilla.org/firefox/addon/vue-js-devtools/

### 9.2 Hot Module Replacement (HMR)

Vite 支持热模块替换，开发时修改代码自动刷新浏览器。

---

## 10. 测试

### 10.1 单元测试

```javascript
import { describe, it, expect } from 'vitest';
import { useAuth } from '@/composables/useAuth';

describe('useAuth', () => {
    it('should initialize with unauthenticated state', () => {
        const { isAuthenticated } = useAuth();
        expect(isAuthenticated.value).toBe(false);
    });
});
```

### 10.2 运行测试

```bash
npm run test
```

---

## 11. 最佳实践

### 11.1 组件设计

- 保持组件小而专注
- 使用 Props 和 Events 进行通信
- 避免组件间的直接依赖

### 11.2 组合式函数

- 将可复用的逻辑抽取到 composables
- 保持 composables 纯函数化
- 使用 ref 和 reactive 管理状态

### 11.3 性能优化

- 使用 v-once 和 v-memo 优化渲染
- 合理使用 computed 属性
- 避免不必要的响应式数据

---

## 12. 迁移指南

### 12.1 从旧前端迁移

对于需要从旧前端迁移的功能：

1. 分析旧代码逻辑
2. 创建对应的 Vue 组件
3. 移植功能到新前端
4. 测试验证
5. 逐步替换

---

**文档版本**: v1.0  
**生成日期**: 2026-04-19  
**适用项目**: AIClient-2-API 前端
