# 插件开发指南

## 1. 插件系统概述

### 1.1 插件类型

AIClient-2-API 支持两种类型的插件：

| 类型 | 说明 | 示例 |
|------|------|------|
| **auth** | 认证插件，参与认证流程 | `default-auth` |
| **middleware** | 普通中间件，不参与认证 | `api-potluck`, `ai-monitor` |

### 1.2 插件生命周期

```
discoverPlugins()   → 自动发现插件
        ↓
initAll(config)     → 初始化所有插件
        ↓
运行时：authenticate() 或 middleware()
        ↓
destroyAll()        → 销毁所有插件
```

---

## 2. 插件结构

### 2.1 目录结构

```
src/plugins/
└── your-plugin-name/
    ├── index.js              # 插件主文件（必需）
    ├── api-routes.js         # API 路由（可选）
    ├── middleware.js         # 中间件逻辑（可选）
    └── ...                   # 其他文件
```

### 2.2 基本插件定义

```javascript
/**
 * 示例插件
 */
const yourPlugin = {
    // 基本信息
    name: 'your-plugin-name',           // 插件名称（唯一标识）
    version: '1.0.0',                   // 版本号
    description: '插件描述',            // 插件描述

    // 插件类型
    type: 'middleware',                 // 'auth' 或 'middleware'

    // 优先级（数字越小优先级越高）
    _priority: 100,

    // 标记为内置插件（可选）
    // _builtin: true,

    /**
     * 初始化方法
     * @param {Object} config - 服务器配置
     * @returns {Promise<void>}
     */
    async init(config) {
        console.log(`[${this.name}] Initializing...`);
        // 初始化逻辑
    },

    /**
     * 销毁方法
     * @returns {Promise<void>}
     */
    async destroy() {
        console.log(`[${this.name}] Destroying...`);
        // 清理逻辑
    },

    /**
     * 认证方法（仅 type: 'auth' 需要）
     * @param {http.IncomingMessage} req - HTTP 请求
     * @param {http.ServerResponse} res - HTTP 响应
     * @param {URL} requestUrl - 解析后的 URL
     * @param {Object} config - 服务器配置
     * @returns {Promise<{handled: boolean, authorized: boolean|null}>}
     */
    async authenticate(req, res, requestUrl, config) {
        // 认证逻辑
        return { handled: false, authorized: null };
    },

    /**
     * 中间件方法（仅 type: 'middleware' 需要）
     * @param {http.IncomingMessage} req - HTTP 请求
     * @param {http.ServerResponse} res - HTTP 响应
     * @param {URL} requestUrl - 解析后的 URL
     * @param {Object} config - 服务器配置
     * @returns {Promise<{handled: boolean}>}
     */
    async middleware(req, res, requestUrl, config) {
        // 中间件逻辑
        return { handled: false };
    },

    /**
     * 自定义路由（可选）
     * @returns {Array<Object>} 路由定义数组
     */
    routes: [
        {
            method: 'GET',
            path: '/your-plugin/api',
            handler: async (req, res, requestUrl, config) => {
                // 路由处理逻辑
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok' }));
            }
        }
    ],

    /**
     * 静态文件路径（可选）
     * @returns {Array<string>} 静态文件目录数组
     */
    staticPaths: [
        '/your-plugin/static'
    ],

    /**
     * 钩子函数（可选）
     */
    hooks: {
        /**
         * 请求前钩子
         */
        beforeRequest: async (req, res, config) => {
            // 请求前处理
        },

        /**
         * 请求后钩子
         */
        afterRequest: async (req, res, config) => {
            // 请求后处理
        }
    }
};

export default yourPlugin;
```

---

## 3. 认证插件开发

### 3.1 认证插件示例

```javascript
/**
 * 自定义认证插件
 */
const customAuthPlugin = {
    name: 'custom-auth',
    version: '1.0.0',
    description: '自定义认证插件',
    type: 'auth',
    _priority: 100,

    async init(config) {
        console.log('[Custom Auth] Initialized');
    },

    async destroy() {
        console.log('[Custom Auth] Destroyed');
    },

    async authenticate(req, res, requestUrl, config) {
        // 获取自定义认证头
        const customToken = req.headers['x-custom-token'];

        // 验证 Token
        if (customToken === 'my-secret-token') {
            // 认证成功
            console.log('[Custom Auth] Authentication successful');
            return { handled: false, authorized: true };
        }

        // 认证失败，让其他插件处理
        return { handled: false, authorized: null };
    }
};

export default customAuthPlugin;
```

### 3.2 认证返回值说明

| 返回值 | 说明 |
|--------|------|
| `{handled: true, authorized: true}` | 已处理，认证成功 |
| `{handled: true, authorized: false}` | 已处理，认证失败 |
| `{handled: false, authorized: true}` | 未处理，认证成功（继续后续插件） |
| `{handled: false, authorized: null}` | 未处理，未认证（继续后续插件） |

---

## 4. 中间件插件开发

### 4.1 中间件插件示例

```javascript
/**
 * 日志中间件插件
 */
const loggerPlugin = {
    name: 'request-logger',
    version: '1.0.0',
    description: '请求日志中间件',
    type: 'middleware',
    _priority: 50,

    async init(config) {
        console.log('[Request Logger] Initialized');
    },

    async middleware(req, res, requestUrl, config) {
        // 记录请求信息
        const startTime = Date.now();
        const originalEnd = res.end;

        res.end = function(...args) {
            const duration = Date.now() - startTime;
            console.log(`[Request Logger] ${req.method} ${requestUrl.pathname} - ${res.statusCode} (${duration}ms)`);
            originalEnd.apply(res, args);
        };

        // 继续处理
        return { handled: false };
    }
};

export default loggerPlugin;
```

---

## 5. 路由开发

### 5.1 自定义 API 路由

```javascript
const userManagementPlugin = {
    name: 'user-management',
    version: '1.0.0',
    type: 'middleware',

    // 自定义路由
    routes: [
        {
            method: 'GET',
            path: '/users',
            handler: async (req, res, requestUrl, config) => {
                const users = await getUsers();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(users));
            }
        },
        {
            method: 'POST',
            path: '/users',
            handler: async (req, res, requestUrl, config) => {
                // 读取请求体
                let body = '';
                for await (const chunk of req) {
                    body += chunk;
                }
                const userData = JSON.parse(body);

                // 创建用户
                const newUser = await createUser(userData);
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(newUser));
            }
        }
    ]
};
```

### 5.2 路由访问

自定义路由可以通过以下方式访问：

```
http://localhost:3000/plugins/user-management/users
```

---

## 6. 静态文件服务

### 6.1 静态文件配置

```javascript
const uiPlugin = {
    name: 'custom-ui',
    version: '1.0.0',
    type: 'middleware',

    // 静态文件路径
    staticPaths: [
        '/custom-ui'  // 映射到 src/plugins/custom-ui/static/
    ]
};
```

### 6.2 静态文件访问

```
http://localhost:3000/plugins/custom-ui/index.html
```

---

## 7. 内置插件分析

### 7.1 default-auth（默认认证插件）

**位置**：`src/plugins/default-auth/`

**功能**：
- API Key 认证
- 支持多种认证方式：
  - `Authorization: Bearer <key>`
  - `x-api-key: <key>`
  - `x-goog-api-key: <key>`
  - URL query: `?key=<key>`

**优先级**：9999（最低，最后执行）

### 7.2 api-potluck（API 大锅饭）

**位置**：`src/plugins/api-potluck/`

**功能**：
- Key 管理
- 用户管理
- 用量统计
- 配额控制

### 7.3 ai-monitor（AI 监控）

**位置**：`src/plugins/ai-monitor/`

**功能**：
- 全链路抓包
- 请求/响应记录
- 监控数据展示

### 7.4 model-usage-stats（模型用量统计）

**位置**：`src/plugins/model-usage-stats/`

**功能**：
- 模型用量统计
- Token 消耗统计
- 数据可视化

---

## 8. 插件配置

### 8.1 启用插件

在 `configs/plugins.json` 中配置：

```json
{
    "plugins": {
        "your-plugin-name": {
            "enabled": true,
            "config": {
                // 插件自定义配置
            }
        }
    }
}
```

### 8.2 插件配置访问

在插件中可以通过 `init` 方法获取配置：

```javascript
async init(config) {
    // config 包含插件配置
    const pluginConfig = config.plugins?.['your-plugin-name']?.config;
    console.log('Plugin config:', pluginConfig);
}
```

---

## 9. 最佳实践

### 9.1 错误处理

```javascript
async middleware(req, res, requestUrl, config) {
    try {
        // 插件逻辑
        return { handled: false };
    } catch (error) {
        console.error(`[${this.name}] Error:`, error);
        // 不拦截错误，让主流程处理
        return { handled: false };
    }
}
```

### 9.2 日志记录

使用项目内置的 logger：

```javascript
import logger from '../../utils/logger.js';

async init(config) {
    logger.info(`[${this.name}] Initializing...`);
}
```

### 9.3 异步操作

所有插件方法都是异步的，确保正确处理异步操作：

```javascript
async authenticate(req, res, requestUrl, config) {
    const result = await someAsyncOperation();
    return { handled: false, authorized: result };
}
```

### 9.4 资源清理

在 `destroy` 方法中清理资源：

```javascript
async destroy() {
    if (this.interval) {
        clearInterval(this.interval);
    }
    if (this.dbConnection) {
        await this.dbConnection.close();
    }
}
```

---

## 10. 测试插件

### 10.1 本地开发

1. 创建插件目录和文件
2. 在 `configs/plugins.json` 中启用插件
3. 重启 AIClient-2-API
4. 测试插件功能

### 10.2 调试

查看日志输出：

```bash
journalctl -u aiclient-node -f
```

---

## 11. 高级主题

### 11.1 插件间通信

使用事件广播机制：

```javascript
// 在 ui-modules/event-broadcast.js 中定义事件
// 插件可以触发和监听事件
```

### 11.2 访问核心模块

插件可以通过以下方式访问核心模块：

```javascript
import { getServiceAdapter } from '../providers/adapter.js';
import providerPoolManager from '../providers/provider-pool-manager.js';
```

---

**文档版本**: v1.0  
**生成日期**: 2026-04-19  
**适用项目**: AIClient-2-API 插件系统
