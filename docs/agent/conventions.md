# 开发约定

## 目录结构约定

```
AIClient-2-API/
├── src/                    # 源代码
│   ├── auth/               # OAuth 认证模块
│   ├── core/               # 核心模块（master, config, plugin）
│   ├── convert/            # 协议转换引擎
│   ├── converters/         # 转换器实现（策略模式）
│   ├── handlers/           # HTTP 请求处理器
│   ├── plugins/            # 插件系统
│   ├── providers/          # AI 提供商层
│   ├── services/           # 服务层
│   ├── ui-modules/         # UI 后端模块
│   └── utils/              # 工具函数
├── configs/                # 配置文件目录
├── tests/                  # 测试用例
├── docs/                   # 文档
└── static/                 # 静态资源
```

## 命名约定

### 文件命名
- 使用 kebab-case：`provider-pool-manager.js`
- 测试文件：`*.test.js` 或 `*.spec.js`
- 配置文件：`*.config.js` 或 `*-config.js`

### 变量命名
- 常量：UPPER_SNAKE_CASE（如 `MAX_ERROR_COUNT`）
- 类：PascalCase（如 `ProviderPoolManager`）
- 函数/变量：camelCase（如 `selectProvider`）
- 私有方法：下划线前缀（如 `_calculateNodeScore`）

### 模块导出
- ES Modules：使用 `export default` 和 `export const`
- 单例模式：导出已实例化的对象

## 编码约定

### 异步处理
- 使用 `async/await` 而非回调
- 错误处理使用 `try/catch`
- 并发控制使用 Promise 队列

### 日志规范
- 使用统一的 logger 模块
- 日志级别：debug < info < warn < error
- 敏感信息必须脱敏

### 错误处理
- 必须捕获并处理异常
- 提供有意义的错误消息
- 网络错误需要重试机制

## 测试约定

### 单元测试
- 测试文件放在 `tests/` 目录
- 使用 Jest 框架
- 每个模块至少有一个测试文件

### 测试命名
- 描述性命名：`should return null when no healthy providers`
- 使用 describe/it 组织测试

## Git 约定

### 提交信息格式
```
type(scope): subject

- type: feat | fix | docs | style | refactor | test | chore
- scope: 模块名（可选）
- subject: 简短描述
```

### 示例
```
feat(provider): add health check retry mechanism
fix(auth): handle OAuth token refresh timeout
docs(readme): update installation guide
```

## 安全约定

### API Key 处理
- 不在日志中输出完整 API Key
- 使用环境变量存储敏感信息
- 配置文件排除在版本控制之外

### 认证安全
- 密码使用 PBKDF2 + SHA-512 加密
- 登录失败次数限制
- 会话超时机制
