# AIClient-2-API Vue 前端

AIClient-2-API 的现代化 Vue 3 前端应用，可独立运行和开发。

## 技术栈

- **Vue 3** - 渐进式 JavaScript 框架
- **Vue Router 4** - 官方路由管理器
- **Vite 8** - 下一代前端构建工具
- **Element Plus** - Vue 3 UI 组件库
- **Vue I18n** - 国际化插件
- **Axios** - HTTP 请求库
- **Tailwind CSS** - 实用优先的 CSS 框架

## 快速开始

### 独立运行（推荐）

Vue 前端可以完全独立于后端运行：

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env

# 启动开发服务器
npm run dev
```

访问 http://localhost:5173

### 与后端联调

如果需要与后端联调，先启动后端服务：

```bash
# 终端 1：在项目根目录启动后端
cd ..
npm run dev

# 终端 2：在 app-vue 目录启动前端
npm run dev
```

### 构建生产版本

```bash
npm run build    # 构建到 dist/ 目录
npm run preview  # 预览构建结果
```

## 环境变量

创建 `.env` 文件配置开发环境：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_PORT` | 开发服务器端口 | 5173 |
| `VITE_API_BASE_URL` | 后端 API 地址 | http://localhost:3000 |
| `VITE_PREVIEW_PORT` | 预览服务器端口 | 9090 |

## 项目结构

```
src/
├── components/        # 可复用组件
│   ├── Header.vue     # 页头（语言/主题切换）
│   ├── Sidebar.vue    # 侧边栏导航
│   ├── Layout.vue     # 布局容器
│   ├── Modal.vue      # 模态框
│   ├── Toast.vue      # 消息提示
│   └── ...
├── composables/       # 组合式函数
│   ├── useApi.js      # API 调用封装
│   ├── useAuth.js     # 认证逻辑
│   ├── useConfig.js   # 配置管理
│   ├── useDashboard.js # 仪表板数据
│   └── ...
├── views/             # 页面视图
│   ├── core/          # 核心页面
│   ├── config/        # 配置页面
│   ├── providers/     # 提供商页面
│   ├── stats/         # 统计页面
│   └── ...
├── router/            # 路由配置
├── locales/           # 国际化文件
│   ├── zh-CN.json     # 中文
│   └── en.json        # 英文
└── utils/             # 工具函数
```

## 功能特性

### 🌐 国际化
- 支持中文/英文切换
- 使用 Vue I18n
- 翻译文件位于 `src/locales/`

### 🎨 主题切换
- 支持亮色/暗色主题
- 自动保存用户偏好
- CSS 变量驱动

### 📊 仪表板
- 系统状态概览
- 提供商健康状态
- 实时数据更新

### ⚙️ 配置管理
- 服务配置编辑
- 提供商池管理
- 自定义模型配置

### 📈 统计分析
- 用量统计图表
- 模型使用分析
- 请求趋势展示

## 开发指南

### 组件开发

使用 Vue 3 Composition API：

```vue
<template>
  <div class="my-component">
    {{ message }}
  </div>
</template>

<script setup>
import { ref } from 'vue';

const message = ref('Hello World');
</script>

<style scoped>
.my-component {
  /* 样式 */
}
</style>
```

### API 调用

使用封装好的 useApi：

```javascript
import { useApi } from '@/composables/useApi';

const { data, loading, error, get, post } = useApi();

// GET 请求
const config = await get('/api/config');

// POST 请求
await post('/api/config', { key: 'value' });
```

### 路由导航

```javascript
import { useRouter } from 'vue-router';

const router = useRouter();
router.push('/config');
```

### 国际化

```vue
<template>
  <p>{{ t('dashboard.title') }}</p>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>
```

## 构建优化

Vite 配置了以下优化：

- **代码分割**: 自动拆分 vendor、composables、components
- **Gzip 压缩**: 大于 10KB 的文件自动压缩
- **Tree Shaking**: 移除未使用代码
- **CSS 代码分割**: 按需加载样式

## 相关文档

- [前端开发文档](../docs/FRONTEND_DEVELOPMENT.md)
- [项目架构文档](../AGENTS.md)
- [快速开始指南](../docs/QUICKSTART.md)

## License

MIT
