# 开发命令

## 包管理器

本项目使用 **pnpm** 作为包管理器。

```bash
# 安装依赖
pnpm install

# 添加依赖
pnpm add <package>

# 添加开发依赖
pnpm add -D <package>

# 更新依赖
pnpm update
```

## 开发命令

### 启动服务

```bash
# 启动主进程（生产模式）
pnpm start

# 启动开发服务器（热重载）
pnpm dev

# 指定端口启动
node src/core/master.js --port 3000

# 指定配置文件
node src/core/master.js --config configs/config.json
```

### 构建命令

```bash
# 构建项目（根目录无构建步骤）
pnpm build

# 构建 Vue 前端
pnpm build:vue

# 预览构建结果
pnpm preview
```

### 测试命令

```bash
# 运行所有测试
pnpm test

# 运行单元测试
pnpm test:unit

# 运行集成测试
pnpm test:integration

# 运行 E2E 测试
pnpm test:e2e

# 运行压力测试
pnpm test:stress

# 运行限流测试
pnpm test:rate-limit
```

### 代码质量

```bash
# 运行 Lint（如果配置）
pnpm lint

# 类型检查（如果有 TypeScript）
# pnpm type-check
```

## 服务管理（Linux）

```bash
# 启动服务
sudo systemctl start aiclient-node

# 停止服务
sudo systemctl stop aiclient-node

# 重启服务
sudo systemctl restart aiclient-node

# 查看服务状态
sudo systemctl status aiclient-node

# 查看服务日志
journalctl -u aiclient-node -f
```

## 管理端点

服务运行后，可以通过以下管理端点操作：

```bash
# 查看主进程状态
curl http://localhost:3100/master/status

# 健康检查
curl http://localhost:3100/master/health

# 重启 Worker
curl -X POST http://localhost:3100/master/restart

# 停止 Worker
curl -X POST http://localhost:3100/master/stop

# 启动 Worker
curl -X POST http://localhost:3100/master/start
```

## 环境变量

```bash
# 服务器端口
SERVER_PORT=3000

# API 认证密钥
REQUIRED_API_KEY=your-api-key

# 默认提供商
MODEL_PROVIDER=gemini-cli-oauth

# 日志目录
LOG_DIR=logs/
```

## 常见开发任务

### 添加新提供商

1. 在 `src/utils/constants.js` 中添加常量
2. 在 `src/providers/xxx/` 下创建实现
3. 在 `src/providers/adapter.js` 中注册适配器
4. 添加健康检查模型配置

### 添加新插件

1. 在 `src/plugins/` 下创建插件目录
2. 实现 `index.js` 导出插件接口
3. 在 `configs/plugins.json` 中启用插件

### 添加新测试

1. 在 `tests/` 目录下创建测试文件
2. 使用 Jest 框架编写测试
3. 在 `package.json` 中添加测试脚本

## 调试技巧

### 查看日志

```bash
# 实时查看日志
tail -f logs/AIClient-*.log

# 搜索错误日志
grep -r "ERROR" logs/
```

### 调试模式

```bash
# 启用调试日志
LOG_LEVEL=debug pnpm dev
```

### 常见问题排查

1. **端口占用**: 检查是否有进程占用端口 `lsof -i :3000`
2. **依赖问题**: 清除缓存重装 `rm -rf node_modules && pnpm install`
3. **配置问题**: 检查配置文件格式 `node -e "console.log(JSON.parse(require('fs').readFileSync('configs/config.json')))"`

## Web UI

- 默认地址：`http://localhost:3000`
- 默认密码：`admin123`
- 密码文件：`configs/pwd`
