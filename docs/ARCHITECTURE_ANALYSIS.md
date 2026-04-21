# AIClient-2-API 架构分析文档

## 1. 项目概览

### 1.1 项目定位
**AIClient-2-API** 是一个高性能的 API 代理中间件，旨在将多种 AI 提供商（Gemini、Claude、Grok、Codex、Kiro 等）的 API 统一转换为标准的 OpenAI 兼容接口，为开发者提供一致的编程体验。

### 1.2 核心价值
- **协议统一**：屏蔽各 AI 提供商的 API 差异，提供 OpenAI 标准接口
- **高可用性**：99.9% 服务可用性保障，支持故障转移和健康检查
- **多账号管理**：智能账号池轮询，负载均衡
- **灵活扩展**：插件化架构，易于扩展新功能

---

## 2. 系统架构设计

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                    前端展示层 (Frontend)                     │
│                  static/, src/views/                        │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    API 服务层 (API Layer)                    │
│              src/services/, src/handlers/                   │
├─────────────────────────────────────────────────────────────┤
│  • HTTP 请求处理                                            │
│  • 路由分发                                                 │
│  • 认证授权                                                 │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                  插件扩展层 (Plugin Layer)                   │
│                      src/plugins/                           │
├─────────────────────────────────────────────────────────────┤
│  • 认证插件 (AUTH)                                          │
│  • 中间件插件 (MIDDLEWARE)                                  │
│  • 监控插件                                                 │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                协议转换层 (Conversion Layer)                  │
│                    src/converters/                          │
├─────────────────────────────────────────────────────────────┤
│  • OpenAI ↔ Claude                                         │
│  • OpenAI ↔ Gemini                                         │
│  • OpenAI ↔ Grok                                           │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                提供商适配层 (Provider Layer)                  │
│                    src/providers/                           │
├─────────────────────────────────────────────────────────────┤
│  • 适配器模式 (Adapter Pattern)                             │
│  • 提供商池管理 (Pool Manager)                             │
│  • 健康检查 (Health Check)                                  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                  外部 AI 提供商 (External Providers)          │
│  Gemini, Claude, Grok, OpenAI, Codex, Kiro, Qwen, iFlow     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 进程模型

```
                    ┌─────────────────────────────┐
                    │     主进程 (Master)         │
                    │   src/core/master.js        │
                    └──────────────┬──────────────┘
                                   │ fork()
                    ┌──────────────▼──────────────┐
                    │   Worker 进程 (Worker)      │
                    │ src/services/api-server.js  │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  Python 控制器 (Optional)   │
                    │   app-controller/           │
                    └─────────────────────────────┘
```

**主进程职责**：
- 子进程生命周期管理（启动/停止/重启）
- 系统资源监控（CPU/内存阈值告警）
- 管理端口 3100（/master/status 等）
- IPC 通信协调

**Worker 进程职责**：
- HTTP 服务器（默认 3000 端口）
- 插件系统加载与管理
- 提供商池初始化
- 请求处理管道执行

---

## 3. 核心模块分析

### 3.1 提供商适配器架构

#### 设计模式：适配器模式 + 工厂模式

```javascript
// src/providers/adapter.js
class ApiServiceAdapter {
  generateContent(model, requestBody) { }
  generateContentStream(model, requestBody) { }
  listModels() { }
  refreshToken() { }
  forceRefreshToken() { }
  isExpiryDateNear() { }
}

// 具体适配器
class GeminiApiServiceAdapter extends ApiServiceAdapter { }
class ClaudeApiServiceAdapter extends ApiServiceAdapter { }
class OpenAIApiServiceAdapter extends ApiServiceAdapter { }

// 工厂方法
function getServiceAdapter(config) {
  switch (config.MODEL_PROVIDER) {
    case MODEL_PROVIDER.GEMINI_CLI_OAUTH:
      return GeminiApiServiceAdapter.getInstance(config);
    // ...
  }
}
```

**优势**：
- 统一接口，屏蔽底层差异
- 单一实例，资源复用
- 易于扩展新提供商

### 3.2 提供商池管理

#### 核心机制

```
Provider Pool Manager
├── 健康状态管理 (Health Status)
├── LRU 评分选择 (LRU Scoring)
├── 并发控制 (Concurrency Control)
├── 令牌刷新 (Token Refresh)
├── 故障转移 (Fallback Chain)
└── 定时健康检查 (Scheduled Health Check)
```

#### LRU 评分算法

```
Score = baseScore + usageScore + sequenceScore + loadScore + freshBonus

baseScore:   基于最后使用时间（新鲜节点使用负偏移）
usageScore:  使用次数惩罚（每次+10秒）
sequenceScore: 序列号打破平局
loadScore:   负载权重（每请求+5秒）
freshBonus:  新鲜节点微调
```

#### 关键数据流

```
请求到达
    ↓
selectProviderWithFallback()
    ↓
acquireSlot() - 获取并发槽位
    ↓
执行请求
    ↓
成功/失败
    ↓
markProviderHealthy() / markProviderUnhealthy()
    ↓
更新评分，释放槽位
```

### 3.3 协议转换引擎

#### 转换器层次

```
BaseConverter (基类)
    ├── convertRequest()
    ├── convertResponse()
    └── convertStream()
         ↓
    具体策略类
         ├── OpenAIConverter
         ├── ClaudeConverter
         ├── GeminiConverter
         └── GrokConverter
```

#### 转换流程

```
OpenAI 格式请求
    ↓
检测目标协议
    ↓
convertRequest() - 转换为提供商格式
    ↓
发送到提供商 API
    ↓
接收提供商响应
    ↓
convertResponse() / convertStream() - 转换回 OpenAI 格式
    ↓
返回给客户端
```

### 3.4 插件系统

#### 插件类型

1. **AUTH 类型**：参与认证流程
2. **MIDDLEWARE 类型**：普通中间件，不参与认证

#### 插件生命周期

```
discoverPlugins() - 自动发现插件
    ↓
initAll(config) - 初始化所有插件
    ↓
运行时：authenticate() / middleware()
    ↓
destroyAll() - 销毁所有插件
```

#### 扩展点

- `authenticate()` - 认证方法
- `middleware()` - 请求中间件
- `routes[]` - 路由定义
- `staticPaths[]` - 静态文件路径
- `hooks{}` - 钩子函数

---

## 4. 请求处理管道

### 4.1 完整处理流程

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────────┐
│  1. CORS 处理                           │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  2. 静态文件服务                        │
│  (/static/, /login.html 等)            │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  3. 插件路由分发                        │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  4. UI API 请求处理                     │
│  (配置、提供商、日志等)                 │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  5. 健康检查端点 (/health)              │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  6. 提供商路径重写                      │
│  (如 /gemini-cli-oauth/v1/...)          │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  7. 认证流程                           │
│  (插件系统 type='auth')                │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  8. 中间件流程                          │
│  (插件系统 type!='auth')               │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  9. API 请求分发                        │
│  (handleAPIRequests)                    │
└─────────────────────────────────────────┘
```

### 4.2 提供商路径重写机制

**支持两种方式**：
1. **路径前缀**：`/gemini-cli-oauth/v1/chat/completions`
2. **请求头**：`Model-Provider: gemini-cli-oauth`

---

## 5. 配置体系

### 5.1 配置来源优先级

```
1. CLI 参数 (最高优先级)
    ↓
2. 配置文件 (configs/config.json)
    ↓
3. 默认配置 (config-manager.js 中的 defaultConfig)
```

### 5.2 核心配置项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `SERVER_PORT` | 服务器端口 | 3000 |
| `REQUIRED_API_KEY` | API 认证密钥 | 123456 |
| `MODEL_PROVIDER` | 默认提供商 | gemini-cli-oauth |
| `PROVIDER_POOLS_FILE_PATH` | 提供商池文件路径 | configs/provider_pools.json |
| `MAX_ERROR_COUNT` | 不健康阈值 | 10 |
| `CRON_NEAR_MINUTES` | 令牌刷新间隔 | 15 |
| `TLS_SIDECAR_ENABLED` | TLS Sidecar 开关 | false |

---

## 6. 高可用性设计

### 6.1 故障转移机制

#### Provider Fallback Chain

```json
{
  "providerFallbackChain": {
    "gemini-cli-oauth": ["gemini-antigravity"],
    "claude-kiro-oauth": ["claude-custom"]
  }
}
```

**逻辑**：当主提供商类型全部不健康时，自动尝试兼容协议的提供商

#### Model Fallback Mapping

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

**逻辑**：当请求特定模型不可用时，自动映射到替代模型

### 6.2 健康检查机制

#### 检查时机

- **启动时**：`performInitialHealthChecks()`
- **定时**：`SCHEDULED_HEALTH_CHECK` 配置触发
- **手动**：Web UI 或 API 触发

#### 健康检查模型映射

| 提供商 | 健康检查模型 |
|--------|-------------|
| gemini-cli-oauth | gemini-2.5-flash |
| openai-custom | gpt-4o-mini |
| claude-custom | claude-3-7-sonnet-20250219 |
| claude-kiro-oauth | claude-haiku-4-5 |

---

## 7. 设计模式应用

### 7.1 策略模式 (Strategy Pattern)

**应用场景**：
- 各提供商的实现（openai-core.js、claude-core.js 等）
- 转换器策略（OpenAIConverter、ClaudeConverter 等）

**优势**：
- 算法族可以自由切换
- 避免多重条件判断
- 符合开闭原则

### 7.2 适配器模式 (Adapter Pattern)

**应用场景**：
- `ApiServiceAdapter` 接口定义统一方法
- 各提供商适配器包装具体实现

**优势**：
- 将不兼容的接口转换为兼容接口
- 解耦客户端和具体实现

### 7.3 工厂模式 (Factory Pattern)

**应用场景**：
- `getServiceAdapter(config)` 工厂方法创建适配器实例
- 适配器注册表管理所有可用适配器

**优势**：
- 对象创建与使用分离
- 易于扩展新产品

### 7.4 单例模式 (Singleton Pattern)

**应用场景**：
- `PluginManager` 使用单例
- 服务实例缓存（`serviceInstances` 映射）

**优势**：
- 控制实例数量
- 资源共享

### 7.5 观察者模式 (Observer Pattern)

**应用场景**：
- 事件广播机制（`ui-modules/event-broadcast.js`）
- 健康状态变化广播

**优势**：
- 松耦合
- 广播通信

### 7.6 责任链模式 (Chain of Responsibility Pattern)

**应用场景**：
- 插件认证流程
- 故障转移链（providerFallbackChain）

**优势**：
- 请求处理者解耦
- 动态组合处理链

---

## 8. 性能优化策略

### 8.1 提供商选择并发安全

- 互斥锁确保同一提供商类型不会并发选择同一节点
- 序列号机制确保毫秒级并发也能区分

### 8.2 令牌刷新优化

- 缓冲队列机制（5秒延迟去重）
- 并发控制（全局2个并行，每个提供商内部1个）
- 刷新超时保护（默认60秒）

### 8.3 配置保存优化

- 防抖机制（1秒延迟批量写入）
- 避免频繁文件 I/O

### 8.4 请求处理优化

- 请求上下文管理（AsyncLocalStorage）
- 每个请求独立配置副本

---

## 9. 安全特性

### 9.1 认证授权

- **API Key 认证**：支持多种认证方式（Bearer Token、Header、Query）
- **登录保护**：最大尝试次数、锁定持续时间、最小间隔

### 9.2 数据安全

- **密码安全**：PBKDF2 + SHA-512，310000 次迭代
- **日志脱敏**：敏感信息自动脱敏

### 9.3 访问控制

- **CORS 控制**：支持跨域请求配置

---

## 10. 扩展性分析

### 10.1 新增提供商

1. 在 `src/utils/constants.js` 的 `MODEL_PROVIDER` 中添加常量
2. 在 `src/providers/xxx/` 下创建 `xxx-core.js` 和 `xxx-strategy.js`
3. 在 `src/providers/adapter.js` 中创建适配器类并注册
4. 在 `ProviderPoolManager.DEFAULT_HEALTH_CHECK_MODELS` 中添加健康检查模型

### 10.2 新增插件

1. 在 `src/plugins/` 下创建插件目录和 `index.js`
2. 实现插件接口（name、version、init、middleware 等）
3. 在 `configs/plugins.json` 中启用插件

### 10.3 新增转换器

1. 在 `src/converters/strategies/` 下创建新转换器类
2. 继承 `BaseConverter` 并实现转换方法
3. 在 `register-converters.js` 中注册

---

## 11. 运维架构

### 11.1 服务管理

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

### 11.2 日志管理

- 日志目录：`logs/`
- 最大文件大小：10MB
- 最大保留文件数：10

### 11.3 管理端点

- `GET /master/status` - 主进程状态
- `GET /master/health` - 健康检查
- `POST /master/restart` - 重启 Worker
- `POST /master/stop` - 停止 Worker
- `POST /master/start` - 启动 Worker

---

## 12. 外部依赖

### 12.1 Python 控制器 (app-controller/)

- 本地模型管理
- GPU 监控
- WebSocket 管理

### 12.2 Go TLS Sidecar (tls-sidecar/)

- 使用 Go uTLS 模拟浏览器 TLS 指纹
- 解决 Cloudflare 403 拦截
- 编译：`cd tls-sidecar && go build -o tls-sidecar`

---

## 13. 总结

### 13.1 架构优势

1. **模块化设计**：各模块职责清晰，低耦合高内聚
2. **高可用性**：故障转移、健康检查、多账号轮询
3. **扩展性强**：插件化架构，易于扩展新功能
4. **性能优秀**：多种优化策略，保障高并发性能
5. **安全可靠**：完善的认证授权和数据保护机制

### 13.2 技术亮点

- 多种设计模式的灵活应用
- 完善的多进程架构
- 智能的提供商池管理
- 灵活的插件扩展机制

### 13.3 适用场景

- 需要统一接入多个 AI 提供商的应用
- 对高可用性有严格要求的生产环境
- 需要灵活扩展和定制的场景
- 需要管理多个 API Key 的场景
