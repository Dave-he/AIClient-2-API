# AIClient-2-API 项目架构文档

## 项目概述

**AIClient-2-API** 是一个强大的 API 代理中间件，能够将多种 AI 提供商（Gemini、Claude、Grok、Codex、Kiro 等）的 API 统一转换为标准的 OpenAI 兼容接口。采用策略模式、适配器模式和插件架构设计，支持多账号池管理、智能轮询、自动故障转移和健康检查机制，确保 99.9% 的服务可用性。

---

## 目录结构

```
AIClient-2-API/
├── src/                          # 核心源代码
│   ├── auth/                     # OAuth 认证模块
│   │   ├── gemini-oauth.js       # Gemini OAuth 认证
│   │   ├── kiro-oauth.js         # Kiro OAuth 认证
│   │   ├── codex-oauth.js        # Codex OAuth 认证
│   │   ├── qwen-oauth.js         # Qwen OAuth 认证
│   │   ├── iflow-oauth.js        # iFlow OAuth 认证
│   │   └── oauth-handlers.js     # OAuth 统一处理器
│   ├── core/                     # 核心模块
│   │   ├── master.js             # 主进程管理器（子进程管理、资源监控）
│   │   ├── config-manager.js     # 配置管理器（验证、CLI 参数解析）
│   │   └── plugin-manager.js     # 插件管理器（生命周期、路由、认证）
│   ├── convert/                  # 协议转换引擎
│   │   ├── convert.js            # 数据格式转换核心逻辑
│   │   └── convert-old.js        # 旧版转换逻辑（保留）
│   ├── converters/               # 转换器实现
│   │   ├── BaseConverter.js      # 转换器基类
│   │   ├── register-converters.js# 转换器注册入口
│   │   └── strategies/           # 具体转换策略
│   │       ├── OpenAIConverter.js
│   │       ├── ClaudeConverter.js
│   │       ├── GeminiConverter.js
│   │       └── GrokConverter.js
│   ├── handlers/                 # 请求处理器
│   │   └── request-handler.js    # HTTP 请求统一入口
│   ├── plugins/                  # 插件系统
│   │   ├── default-auth/         # API Key 认证插件
│   │   ├── ai-monitor/           # AI 接口监控插件（全链路抓包）
│   │   ├── api-potluck/          # API 大锅饭（Key 管理和用量统计）
│   │   └── model-usage-stats/    # 模型用量统计插件
│   ├── providers/                # AI 提供商层
│   │   ├── adapter.js            # 适配器注册与工厂（核心）
│   │   ├── provider-pool-manager.js # 提供商池管理器
│   │   ├── provider-models.js    # 模型配置管理
│   │   ├── openai/               # OpenAI 协议实现
│   │   │   ├── openai-core.js    # OpenAI Core 服务
│   │   │   ├── openai-responses-core.js # Responses API
│   │   │   ├── codex-core.js     # Codex 核心
│   │   │   ├── qwen-core.js      # Qwen 核心
│   │   │   └── iflow-core.js     # iFlow 核心
│   │   ├── claude/               # Claude 协议实现
│   │   │   ├── claude-core.js    # Claude Core 服务
│   │   │   └── claude-kiro.js    # Kiro 专用实现
│   │   ├── gemini/               # Gemini 协议实现
│   │   │   ├── gemini-core.js    # Gemini Core 服务
│   │   │   └── antigravity-core.js # Antigravity 专用
│   │   ├── grok/                 # Grok 协议实现
│   │   │   ├── grok-core.js      # Grok Core 服务
│   │   │   └── ws-imagine.js     # 图片生成 WebSocket
│   │   ├── local/                # 本地模型集成
│   │   │   ├── local-core.js     # 本地模型核心
│   │   │   └── local-strategy.js # 本地模型策略
│   │   └── forward/              # 直接转发
│   │       ├── forward-core.js   # 转发核心
│   │       └── forward-strategy.js# 转发策略
│   ├── services/                 # 服务层
│   │   ├── api-server.js         # API 服务器主入口（Worker 进程）
│   │   ├── api-manager.js        # API 请求路由分发
│   │   ├── service-manager.js    # 服务初始化管理
│   │   ├── ui-manager.js         # UI 静态文件服务
│   │   └── usage-service.js      # 用量服务
│   ├── ui-modules/               # UI 后端模块
│   │   ├── config-api.js         # 配置 API
│   │   ├── gpu-monitor.js        # GPU 监控
│   │   ├── oauth-api.js          # OAuth API
│   │   ├── provider-api.js       # 提供商 API
│   │   └── usage-api.js          # 用量 API
│   └── utils/                    # 工具模块
│       ├── logger.js             # 日志系统
│       ├── common.js             # 通用工具函数
│       ├── token-utils.js        # Token 计算工具
│       ├── provider-utils.js     # 提供商工具函数
│       ├── tls-sidecar.js        # TLS Sidecar 管理
│       ├── grok-assets-proxy.js  # Grok 资源代理
│       └── constants.js          # 全局常量定义
├── static/                       # 前端静态资源
│   ├── app/                      # 前端应用核心
│   │   ├── app.js                # 主应用逻辑
│   │   ├── auth.js               # 认证逻辑
│   │   ├── config-manager.js     # 配置管理器
│   │   ├── i18n.js               # 国际化
│   │   ├── navigation.js         # 导航系统
│   │   ├── event-stream.js       # 事件流（SSE）
│   │   └── ...                   # 其他前端模块
│   ├── components/               # Web Components
│   ├── index.html                # 主页面
│   └── login.html                # 登录页面
├── configs/                      # 配置文件目录
│   ├── config.json               # 主配置文件
│   ├── plugins.json              # 插件配置
│   ├── provider_pools.json       # 提供商池配置
│   └── ...                       # 其他配置文件
├── app-controller/               # Python 控制器（本地模型管理）
├── tls-sidecar/                  # Go TLS Sidecar（TLS 指纹模拟）
└── scripts/                      # 辅助脚本
```

---

## 核心架构

### 1. 进程模型

```
┌─────────────────────────────────────────────────────────────┐
│                         主进程 (Master)                     │
│                     src/core/master.js                      │
│                                                             │
│  • 子进程管理（启动/停止/重启）                              │
│  • 资源监控（CPU/内存阈值告警）                              │
│  • 管理端口 3100（/master/status 等）                       │
│  • IPC 通信（message 事件）                                  │
└─────────────────────────┬───────────────────────────────────┘
                          │ fork()
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                       Worker 进程                           │
│                   src/services/api-server.js                │
│                                                             │
│  • HTTP 服务器（默认 3000 端口）                             │
│  • 插件系统加载                                              │
│  • 提供商池初始化                                            │
│  • 请求处理管道                                              │
└─────────────────────────────────────────────────────────────┘
```

**关键设计**：
- 主进程监控 Worker 进程，崩溃后通过 systemctl 重启服务
- 重启策略：不直接杀进程，而是通过 `systemctl restart aiclient-node` 命令重启
- 环境变量 `IS_WORKER_PROCESS` 标识是否为子进程

### 2. 请求处理管道

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Request Handler                          │
│               src/handlers/request-handler.js               │
├─────────────────────────────────────────────────────────────┤
│ 1. CORS 处理                                                │
│ 2. 静态文件服务（/static/、/login.html 等）                  │
│ 3. 插件路由分发                                             │
│ 4. UI API 请求处理（配置、提供商、日志等）                   │
│ 5. 健康检查端点（/health）                                  │
│ 6. 提供商路径重写（如 /gemini-cli-oauth/v1/...）            │
│ 7. 认证流程（插件系统 type='auth'）                         │
│ 8. 中间件流程（插件系统 type!='auth'）                      │
│ 9. API 请求分发（handleAPIRequests）                        │
└─────────────────────────────────────────────────────────────┘
```

**提供商路径重写机制**：
- 请求路径首段如果是已注册的提供商名称（如 `/gemini-cli-oauth`、`/claude-custom`），会自动切换 `MODEL_PROVIDER` 并移除该段路径
- 支持通过 `Model-Provider` 请求头指定提供商

### 3. 提供商适配器架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Adapter Registry                        │
│                  src/providers/adapter.js                   │
├─────────────────────────────────────────────────────────────┤
│  接口：ApiServiceAdapter                                    │
│  ├── generateContent(model, requestBody)                    │
│  ├── generateContentStream(model, requestBody)              │
│  ├── listModels()                                           │
│  ├── refreshToken()                                         │
│  ├── forceRefreshToken()                                    │
│  └── isExpiryDateNear()                                     │
│                                                             │
│  已注册适配器：                                             │
│  ├── OpenAIApiServiceAdapter     → openai-custom            │
│  ├── OpenAIResponsesApiServiceAdapter → openaiResponses-custom│
│  ├── ClaudeApiServiceAdapter     → claude-custom            │
│  ├── GeminiApiServiceAdapter     → gemini-cli-oauth         │
│  ├── AntigravityApiServiceAdapter→ gemini-antigravity       │
│  ├── KiroApiServiceAdapter       → claude-kiro-oauth        │
│  ├── CodexApiServiceAdapter      → openai-codex-oauth       │
│  ├── GrokApiServiceAdapter       → grok-custom              │
│  └── LocalApiServiceAdapter      → local-model              │
└─────────────────────────────────────────────────────────────┘
```

**适配器工厂模式**：
```javascript
getServiceAdapter(config)  // 返回单例适配器实例
```

### 4. 提供商池管理机制

```
┌─────────────────────────────────────────────────────────────┐
│                   ProviderPoolManager                       │
│             src/providers/provider-pool-manager.js          │
├─────────────────────────────────────────────────────────────┤
│  核心功能：                                                  │
│  ├── 健康状态管理（healthy/unhealthy）                       │
│  ├── LRU 评分选择策略（_calculateNodeScore）                 │
│  ├── 并发控制（concurrencyLimit + queueLimit）               │
│  ├── 令牌刷新机制（_enqueueRefresh）                         │
│  ├── 故障转移链（providerFallbackChain）                     │
│  ├── 模型映射降级（modelFallbackMapping）                    │
│  └── 定时健康检查                                           │
│                                                             │
│  关键方法：                                                  │
│  ├── selectProviderWithFallback()  → 选择提供商（含故障转移）│
│  ├── acquireSlot()                 → 获取并发槽位            │
│  ├── markProviderUnhealthy()       → 标记不健康              │
│  ├── markProviderHealthy()         → 标记健康                │
│  └── performHealthChecks()         → 执行健康检查            │
└─────────────────────────────────────────────────────────────┘
```

**LRU 评分算法**：
```
Score = baseScore + usageScore + sequenceScore + loadScore + freshBonus
  - baseScore: 基于最后使用时间（新鲜节点使用负偏移）
  - usageScore: 使用次数惩罚（每次+10秒）
  - sequenceScore: 序列号打破平局
  - loadScore: 负载权重（每请求+5秒）
  - freshBonus: 新鲜节点微调
```

### 5. 插件系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      PluginManager                          │
│                src/core/plugin-manager.js                   │
├─────────────────────────────────────────────────────────────┤
│  插件类型：                                                  │
│  ├── AUTH（认证插件，参与认证流程）                          │
│  └── MIDDLEWARE（普通中间件，不参与认证）                    │
│                                                             │
│  生命周期：                                                  │
│  ├── discoverPlugins()   → 自动发现                         │
│  ├── initAll(config)     → 初始化所有插件                    │
│  └── destroyAll()        → 销毁所有插件                      │
│                                                             │
│  扩展点：                                                    │
│  ├── authenticate()      → 认证方法                          │
│  ├── middleware()        → 请求中间件                        │
│  ├── routes[]           → 路由定义                          │
│  ├── staticPaths[]      → 静态文件路径                      │
│  └── hooks{}            → 钩子函数                          │
│                                                             │
│  内置插件：                                                  │
│  ├── default-auth        → API Key 认证                     │
│  ├── ai-monitor          → AI 接口监控（全链路抓包）         │
│  ├── api-potluck         → Key 管理和用量统计               │
│  └── model-usage-stats   → 模型用量统计                     │
└─────────────────────────────────────────────────────────────┘
```

### 6. 协议转换引擎

```
┌─────────────────────────────────────────────────────────────┐
│                  Converters Layer                           │
│              src/converters/                                │
├─────────────────────────────────────────────────────────────┤
│  转换策略：                                                  │
│  ├── OpenAI → Claude    (OpenAIConverter)                   │
│  ├── Claude → OpenAI    (ClaudeConverter)                   │
│  ├── Gemini → OpenAI    (GeminiConverter)                   │
│  └── Grok → OpenAI      (GrokConverter)                     │
│                                                             │
│  基类：BaseConverter                                        │
│  ├── convertRequest()    → 请求转换                         │
│  ├── convertResponse()   → 响应转换                         │
│  └── convertStream()     → 流式转换                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 支持的提供商

| 提供商 | 常量 | 协议 | 认证方式 |
|--------|------|------|----------|
| Gemini CLI | `gemini-cli-oauth` | OpenAI/Gemini | OAuth 2.0 |
| Antigravity | `gemini-antigravity` | OpenAI/Gemini | OAuth 2.0 |
| OpenAI Custom | `openai-custom` | OpenAI | API Key |
| OpenAI Responses | `openaiResponses-custom` | Responses | API Key |
| Claude Custom | `claude-custom` | Claude | API Key |
| Kiro | `claude-kiro-oauth` | OpenAI/Claude | OAuth 2.0 |
| Qwen | `openai-qwen-oauth` | OpenAI | OAuth 2.0 |
| iFlow | `openai-iflow` | OpenAI | OAuth 2.0 |
| Codex | `openai-codex-oauth` | Responses | OAuth 2.0 |
| Grok | `grok-custom` | OpenAI | Cookie/SSO |
| Local Model | `local-model` | OpenAI | 无 |

---

## 配置体系

### 配置来源优先级
1. **默认配置**（config-manager.js 中的 defaultConfig）
2. **配置文件**（`configs/config.json`）
3. **CLI 参数**（命令行覆盖）

### 核心配置项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `SERVER_PORT` | 服务器端口 | 3000 |
| `REQUIRED_API_KEY` | API 认证密钥 | 123456 |
| `MODEL_PROVIDER` | 默认提供商 | gemini-cli-oauth |
| `PROVIDER_POOLS_FILE_PATH` | 提供商池文件路径 | configs/provider_pools.json |
| `MAX_ERROR_COUNT` | 不健康阈值 | 10 |
| `CRON_NEAR_MINUTES` | 令牌刷新间隔 | 15 |
| `TLS_SIDECAR_ENABLED` | TLS Sidecar 开关 | false |
| `providerFallbackChain` | 故障转移链 | {} |
| `SCHEDULED_HEALTH_CHECK` | 定时健康检查 | {enabled: false} |

---

## 故障转移机制

### 1. Provider Fallback Chain
```json
{
  "providerFallbackChain": {
    "gemini-cli-oauth": ["gemini-antigravity"],
    "claude-kiro-oauth": ["claude-custom"]
  }
}
```
- 当主提供商类型全部不健康时，自动尝试兼容协议的提供商
- 仅在同协议或兼容协议之间进行降级

### 2. Model Fallback Mapping
```json
{
  "modelFallbackMapping": {
    "claude-opus-4-5": {
      "targetProviderType": "claude-custom",
      "targetModel": "claude-3-5-sonnet-20241022"
    }
  }
}
```
- 当请求特定模型不可用时，自动映射到替代模型

---

## 健康检查

### 检查时机
- **启动时**：`performInitialHealthChecks()`
- **定时**：`SCHEDULED_HEALTH_CHECK` 配置触发
- **手动**：Web UI 或 API 触发

### 检查模型映射
| 提供商 | 健康检查模型 |
|--------|-------------|
| gemini-cli-oauth | gemini-2.5-flash |
| openai-custom | gpt-4o-mini |
| claude-custom | claude-3-7-sonnet-20250219 |
| claude-kiro-oauth | claude-haiku-4-5 |
| openai-codex-oauth | gpt-5-codex-mini |

---

## 开发模式

### 新增提供商步骤
1. 在 `src/utils/constants.js` 的 `MODEL_PROVIDER` 中添加常量
2. 在 `src/providers/xxx/` 下创建 `xxx-core.js` 和 `xxx-strategy.js`
3. 在 `src/providers/adapter.js` 中创建适配器类并注册
4. 在 `ProviderPoolManager.DEFAULT_HEALTH_CHECK_MODELS` 中添加健康检查模型

### 新增插件步骤
1. 在 `src/plugins/` 下创建插件目录和 `index.js`
2. 实现插件接口（name、version、init、middleware 等）
3. 在 `configs/plugins.json` 中启用插件

---

## 运维相关

### 服务管理
```bash
# 重启 Node.js 主服务（推荐）
sudo systemctl restart aiclient-node

# 重启 Python 控制器服务（推荐）
sudo systemctl restart aiclient-python

# 查看服务状态
sudo systemctl status aiclient-node
sudo systemctl status aiclient-python

# 查看服务日志
journalctl -u aiclient-node -f
journalctl -u aiclient-python -f
```

### 日志位置
- 日志目录：`logs/`
- 最大文件大小：10MB
- 最大保留文件数：10

### 管理端点
- `GET /master/status` - 主进程状态
- `GET /master/health` - 健康检查
- `POST /master/restart` - 重启 Worker
- `POST /master/stop` - 停止 Worker
- `POST /master/start` - 启动 Worker

### Web UI
- 默认地址：`http://localhost:3000`
- 默认密码：`admin123`
- 密码文件：`configs/pwd`

---

## 关键设计模式

### 1. 策略模式
- 各提供商的实现（openai-core.js、claude-core.js 等）使用策略模式，统一接口
- 转换器策略（OpenAIConverter、ClaudeConverter 等）

### 2. 适配器模式
- `ApiServiceAdapter` 接口定义统一方法
- 各提供商适配器包装具体实现

### 3. 工厂模式
- `getServiceAdapter(config)` 工厂方法创建适配器实例
- 适配器注册表管理所有可用适配器

### 4. 单例模式
- `PluginManager` 使用单例
- 服务实例缓存（`serviceInstances` 映射）

### 5. 观察者模式
- 事件广播机制（`ui-modules/event-broadcast.js`）
- 健康状态变化广播

### 6. 责任链模式
- 插件认证流程
- 故障转移链（providerFallbackChain）

---

## 外部依赖

### Python 控制器（app-controller/）
- 本地模型管理
- GPU 监控
- WebSocket 管理

### Go TLS Sidecar（tls-sidecar/）
- 使用 Go uTLS 模拟浏览器 TLS 指纹
- 解决 Cloudflare 403 拦截
- 编译：`cd tls-sidecar && go build -o tls-sidecar`

---

## 测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 测试摘要
npm run test:summary
```

测试框架：Jest
测试文件：`tests/` 目录

---

## 安全特性

- **API Key 认证**：支持多种认证方式（Bearer Token、Header、Query）
- **登录保护**：最大尝试次数、锁定持续时间、最小间隔
- **密码安全**：PBKDF2 + SHA-512，310000 次迭代
- **CORS 控制**：支持跨域请求配置
- **日志脱敏**：敏感信息自动脱敏

---

## 性能优化

### 1. 提供商选择并发安全
- 互斥锁确保同一提供商类型不会并发选择同一节点
- 序列号机制确保毫秒级并发也能区分

### 2. 令牌刷新优化
- 缓冲队列机制（5秒延迟去重）
- 并发控制（全局2个并行，每个提供商内部1个）
- 刷新超时保护（默认60秒）

### 3. 配置保存优化
- 防抖机制（1秒延迟批量写入）
- 避免频繁文件 I/O

### 4. 请求处理优化
- 请求上下文管理（AsyncLocalStorage）
- 每个请求独立配置副本

---

## 版本信息

当前项目版本信息请参考 `VERSION` 文件。

详细的版本更新日志请参考 `README.md` 中的版本更新记录。
