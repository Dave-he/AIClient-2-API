# 快速入门指南

## 1. 项目介绍

**AIClient-2-API** 是一个强大的 API 代理中间件，能够将多种 AI 提供商的 API 统一转换为标准的 OpenAI 兼容接口。

### 1.1 主要特性

- 🌐 **多提供商支持**：Gemini、Claude、Grok、OpenAI、Codex 等
- 🔄 **协议转换**：自动转换为 OpenAI 兼容格式
- 📊 **多账号池**：智能轮询，自动故障转移
- 🧩 **插件系统**：灵活扩展功能
- 🎛️ **本地模型**：Python 控制器管理本地 LLM
- 🛡️ **TLS Sidecar**：绕过 Cloudflare 403 拦截

---

## 2. 快速开始

### 2.1 环境要求

| 组件 | 要求 |
|------|------|
| **Node.js** | >= 16 |
| **Python** | >= 3.10 (可选，用于本地模型) |
| **Go** | >= 1.18 (可选，用于 TLS Sidecar) |
| **Redis** | >= 6.0 (可选，用于 Python 控制器) |

### 2.2 安装

#### 克隆项目

```bash
git clone https://github.com/your-org/AIClient-2-API.git
cd AIClient-2-API
```

#### 安装依赖

```bash
npm install
```

### 2.3 配置

#### 基本配置

复制配置示例：

```bash
cp configs/config.json.example configs/config.json
cp configs/provider_pools.json.example configs/provider_pools.json
cp configs/plugins.json.example configs/plugins.json
```

编辑 `configs/config.json`：

```json
{
    "SERVER_PORT": 3000,
    "REQUIRED_API_KEY": "your-secret-key-here",
    "MODEL_PROVIDER": "gemini-cli-oauth",
    "TLS_SIDECAR_ENABLED": false
}
```

#### 配置提供商

根据需要配置提供商池 `configs/provider_pools.json`。

### 2.4 启动

#### 开发模式

```bash
npm run dev
```

#### 生产模式

```bash
npm start
```

#### 使用 systemd (Linux)

```bash
# 安装服务
sudo bash scripts/install-services.sh

# 启动服务
sudo systemctl start aiclient-node
```

### 2.5 访问

打开浏览器访问：

```
http://localhost:3000
```

默认密码：`admin123`

---

## 3. 基本使用

### 3.1 API 调用

#### OpenAI 格式调用

```bash
curl http://localhost:3000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your-secret-key-here" \
    -d '{
        "model": "gpt-4",
        "messages": [
            {"role": "user", "content": "Hello!"}
        ]
    }'
```

#### 指定提供商

方式一：使用路径前缀

```bash
curl http://localhost:3000/gemini-cli-oauth/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your-secret-key-here" \
    -d '{...}'
```

方式二：使用请求头

```bash
curl http://localhost:3000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your-secret-key-here" \
    -H "Model-Provider: claude-custom" \
    -d '{...}'
```

### 3.2 Web UI 使用

1. 登录 http://localhost:3000
2. 配置提供商和 API Key
3. 测试 API 调用
4. 查看用量和监控

---

## 4. 本地模型使用 (可选)

### 4.1 安装 Python 控制器

```bash
cd app-controller
pip install -r requirements.txt
```

### 4.2 配置模型

编辑 `app-controller/config.yaml`：

```yaml
models:
  gemma-2-9b:
    service: vllm-gemma
    port: 8000
    required_memory: 12GB
    preload: true
    keep_alive: true

settings:
  concurrency_limit: 4
  min_available_memory: 2GB
```

### 4.3 启动服务

```bash
# 开发模式
python main.py

# 生产模式
uvicorn main:app --host 0.0.0.0 --port 5000 --workers 4

# 使用 systemd
sudo systemctl start ai-controller
```

### 4.4 集成到 AIClient-2-API

在 AIClient-2-API 中添加自定义提供商，指向 Python 控制器。

---

## 5. TLS Sidecar 使用 (可选)

### 5.1 编译

```bash
cd tls-sidecar
go build -o tls-sidecar main.go
```

### 5.2 启动

```bash
./tls-sidecar
```

### 5.3 启用

在 `configs/config.json` 中启用：

```json
{
    "TLS_SIDECAR_ENABLED": true,
    "TLS_SIDECAR_PORT": 9090
}
```

---

## 6. 插件使用

### 6.1 启用插件

编辑 `configs/plugins.json`：

```json
{
    "plugins": {
        "api-potluck": {
            "enabled": true,
            "config": {}
        },
        "ai-monitor": {
            "enabled": true,
            "config": {}
        }
    }
}
```

### 6.2 重启服务

```bash
sudo systemctl restart aiclient-node
```

---

## 7. 常见配置示例

### 7.1 配置多个提供商

```json
{
    "providerFallbackChain": {
        "gemini-cli-oauth": ["gemini-antigravity", "claude-custom"],
        "claude-custom": ["openai-custom"]
    }
}
```

### 7.2 配置健康检查

```json
{
    "SCHEDULED_HEALTH_CHECK": {
        "enabled": true,
        "interval": 300000,
        "timeout": 10000,
        "threshold": 3
    }
}
```

---

## 8. 故障排除

### 8.1 常见问题

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| **API 调用失败 | 配置错误或密钥无效 | 检查配置和 API Key |
| **健康检查失败 | 提供商服务不可用 | 检查提供商服务状态 |
| **启动失败 | 端口被占用或权限问题 | 检查端口占用和权限 |
| **认证失败 | API Key 不正确 | 确认 REQUIRED_API_KEY 配置 |

### 8.2 查看日志

```bash
# 查看服务状态
sudo systemctl status aiclient-node

# 查看日志
journalctl -u aiclient-node -f
```

---

## 9. 下一步

- 阅读架构分析文档了解项目架构
- 学习插件开发指南扩展功能
- 配置更多提供商提高可用性
- 使用 Python 控制器管理本地模型

---

**文档版本**: v1.0  
**生成日期**: 2026-04-19  
**适用项目**: AIClient-2-API