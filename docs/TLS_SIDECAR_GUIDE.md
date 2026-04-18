# TLS Sidecar 技术文档

## 1. 项目概述

### 1.1 定位
**TLS Sidecar** 是一个用 Go 语言编写的 uTLS 反向代理，用于模拟浏览器 TLS 指纹，解决 Cloudflare 等服务的 403 拦截问题。

### 1.2 核心价值
- 🛡️ **反拦截**：模拟 Chrome 浏览器 TLS 指纹，绕过 Cloudflare 检测
- 🔄 **协议自动**：自动协商 HTTP/2 或 HTTP/1.1
- 📡 **流式支持**：完整支持 SSE 流式响应
- 🔌 **代理支持**：支持 HTTP/HTTPS/SOCKS5 上游代理

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                AIClient-2-API (Node.js)                     │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP 请求
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              TLS Sidecar (Go) 127.0.0.1:9090                │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Header: X-Target-Url: https://api.example.com      │  │
│  │  Header: X-Proxy-Url: socks5://user:pass@proxy:port│  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
┌───────────────────┐         ┌───────────────────┐
│  直接连接        │         │  通过代理连接      │
│  (uTLS Chrome)   │         │  (uTLS + Proxy)    │
└──────────┬────────┘         └───────────┬───────┘
           │                             │
           └──────────────┬──────────────┘
                          ▼
              ┌───────────────────────┐
              │  目标服务器           │
              │  (ALPN: h2/http1.1)   │
              └───────────────────────┘
```

### 2.2 关键组件

| 组件 | 职责 | 文件位置 |
|------|------|----------|
| **HTTP Server** | 接收请求，健康检查 | `main.go:176-213` |
| **Proxy Handler** | 处理代理请求 | `main.go:226-314` |
| **uTLS RoundTripper** | 自定义传输，连接复用 | `main.go:69-172` |
| **uTLS Dialer** | 建立 uTLS 连接，代理支持 | `main.go:318-424` |

---

## 3. 工作原理

### 3.1 请求流程

```
1. Node.js 发送请求到 TLS Sidecar
   └─ 目标: http://127.0.0.1:9090
   └─ Header: X-Target-Url: https://actual-target.com
   └─ Header: X-Proxy-Url: socks5://proxy:port (可选)

2. TLS Sidecar 接收请求
   └─ 解析 X-Target-Url
   └─ 解析 X-Proxy-Url (如果有)
   └─ 清理非浏览器 Header
   └─ 保持 Header 小写

3. 建立 uTLS 连接
   └─ TCP 连接（可能经过代理）
   └─ uTLS 握手 (Chrome Auto 指纹)
   └─ ALPN 协商 (h2/http1.1)

4. 根据 ALPN 选择传输
   └─ h2: 使用 HTTP/2 ClientConn，复用连接
   └─ http/1.1: 使用 HTTP/1.1 Transport

5. 转发请求并响应
   └─ 流式响应支持 (SSE)
   └─ 刷新缓冲区
```

### 3.2 uTLS 指纹模拟

使用 `utls.HelloChrome_Auto` 自动选择最新的 Chrome Client Hello 指纹：

```go
tlsConn := utls.UClient(rawConn, &utls.Config{
    ServerName: host,
    NextProtos: []string{"h2", "http/1.1"},
}, utls.HelloChrome_Auto)
```

---

## 4. 关键特性

### 4.1 HTTP/2 连接复用

**核心机制**：

```go
type utlsRoundTripper struct {
    proxyURL string
    mu      sync.Mutex
    h2Conns map[string]*http2.ClientConn // 按 host 缓存 H2 连接
}
```

**优势**：
- 复用已建立的 HTTP/2 连接
- 减少 TLS 握手开销
- 提高请求吞吐量

### 4.2 Header 清理策略

为防止 Cloudflare 识别，严格清理以下 Header：

```go
// 移除所有代理、本地网络特征标头
if lk == "connection" || lk == "keep-alive" || lk == "transfer-encoding" ||
    lk == "te" || lk == "trailer" || lk == "upgrade" || lk == "host" ||
    lk == "x-forwarded-for" || lk == "x-real-ip" || lk == "x-forwarded-proto" ||
    lk == "x-forwarded-host" || lk == "via" || lk == "proxy-connection" ||
    lk == "cf-connecting-ip" || lk == "true-client-ip" {
    continue
}
```

### 4.3 代理支持

支持的代理类型：

| 类型 | Scheme | 说明 |
|------|--------|------|
| **SOCKS5** | `socks5://`, `socks5h://` | SOCKS5 代理 |
| **HTTP** | `http://`, `https://` | HTTP CONNECT 代理 |

**带认证的代理 URL 示例**：

```
socks5://user:password@proxy-host:port
http://user:password@proxy-host:port
```

### 4.4 SSE 流式支持

为支持 Server-Sent Events 流式响应，采用以下策略：

```go
// 不设置写超时（仅监听 localhost，安全）
writeTimeout = 0

// 每次读取后立即刷新
flusher, canFlush := w.(http.Flusher)
if canFlush {
    flusher.Flush()
}
```

---

## 5. API 使用

### 5.1 请求格式

发送请求到 TLS Sidecar 时，需要设置以下 Header：

| Header | 必填 | 说明 |
|--------|------|------|
| `X-Target-Url` | 是 | 实际目标 URL |
| `X-Proxy-Url` | 否 | 上游代理 URL |

**Node.js 调用示例**：

```javascript
import http from 'http';

const options = {
    hostname: '127.0.0.1',
    port: 9090,
    path: '/',
    method: 'POST',
    headers: {
        'X-Target-Url': 'https://api.example.com/v1/chat',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 ... Chrome/...'
    }
};

const req = http.request(options, (res) => {
    res.pipe(process.stdout);
});

req.write(JSON.stringify({ prompt: 'Hello' }));
req.end();
```

### 5.2 健康检查

```bash
curl http://127.0.0.1:9090/health
```

**响应**：

```json
{
    "status": "ok",
    "tls": "utls-chrome-auto",
    "protocols": "h2,http/1.1"
}
```

---

## 6. 配置说明

### 6.1 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `TLS_SIDECAR_PORT` | `9090` | 监听端口 |

### 6.2 超时配置

```go
const (
    readTimeout  = 30 * time.Second  // 读超时
    writeTimeout = 0                  // 写超时（SSE 不设）
    idleTimeout  = 120 * time.Second // 空闲超时
)
```

---

## 7. 部署指南

### 7.1 编译

```bash
cd tls-sidecar
go build -o tls-sidecar main.go
```

### 7.2 运行

```bash
# 默认端口 9090
./tls-sidecar

# 自定义端口
TLS_SIDECAR_PORT=9091 ./tls-sidecar
```

### 7.3 与 AIClient-2-API 集成

在 `configs/config.json` 中启用 TLS Sidecar：

```json
{
    "TLS_SIDECAR_ENABLED": true,
    "TLS_SIDECAR_PORT": 9090
}
```

---

## 8. 性能优化

### 8.1 RoundTripper 缓存

按 proxyURL 分组缓存 RoundTripper，复用连接：

```go
var (
    rtCacheMu sync.Mutex
    rtCache   = make(map[string]*utlsRoundTripper)
)
```

### 8.2 HTTP/2 连接池

每个 host 维护一个 HTTP/2 ClientConn 缓存：

```go
h2Conns map[string]*http2.ClientConn
```

---

## 9. 故障排查

### 9.1 常见问题

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| **403 Forbidden** | TLS 指纹被识别 | 检查 Header 清理是否正确 |
| **连接超时** | 网络问题，代理不可用 | 检查代理配置，网络连接 |
| **TLS 握手失败** | ALPN 协商问题 | 检查 uTLS 配置 |
| **SSE 中断** | 写超时设置 | 确保 writeTimeout = 0 |

### 9.2 日志查看

TLS Sidecar 输出日志到 stdout：

```
[TLS-Sidecar] Listening on 127.0.0.1:9090 (Chrome uTLS, H2+H1 auto)
[TLS-Sidecar] Connected to api.example.com:443, ALPN: "h2"
[TLS-Sidecar] Cached H2 conn failed for api.example.com:443: ..., reconnecting
```

---

## 10. 安全说明

### 10.1 监听地址

TLS Sidecar 默认只监听 `127.0.0.1`，不暴露到公网，确保安全。

### 10.2 认证

TLS Sidecar 本身不提供认证机制，依赖：
- 仅监听 localhost
- AIClient-2-API 的认证机制

---

## 11. 技术栈

| 组件 | 说明 |
|------|------|
| **Go** | 开发语言 |
| **uTLS** | 自定义 TLS 库 |
| **HTTP/2** | HTTP/2 支持 |
| **SOCKS5/HTTP Proxy** | 代理支持 |

---

**文档版本**: v1.0  
**生成日期**: 2026-04-19  
**适用项目**: TLS Sidecar
