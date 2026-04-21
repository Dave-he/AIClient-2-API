# 安全修复报告

## 修复日期
2025-04-21

## 修复的安全问题

### 1. 🔴 高危：Token 明文存储（XSS 风险）

**问题描述**：认证 Token 存储在 localStorage 中，容易受到 XSS 攻击窃取。

**修复方案**：
- 将 Token 改用 httpOnly Cookie 存储
- 前端无法通过 JavaScript 访问 Token
- 配置 `Secure`（生产环境）、`SameSite=Strict` 属性

**修改文件**：
- `src/ui-modules/auth.js` - 后端认证改用 Cookie 设置
- `static/app/auth.js` - 前端 API 客户端支持 CSRF Token
- `static/login.html` - 移除 localStorage 存储
- `static/index.html` - 更新认证检查逻辑
- `src/utils/api.js` - Vue 版本 API 客户端更新
- `static/app/system-monitor.js` - 移除 Token 引用
- `static/app/provider-manager.js` - 移除 Token 引用
- `static/app/upload-config-manager.js` - 移除 Token 引用
- `static/app/monitor-cache.js` - 移除 Token 引用
- `static/potluck.html` - 移除 Token 引用

### 2. 🔴 高危：缺少 CSRF 保护

**问题描述**：所有 POST/PUT/DELETE 请求缺少 CSRF Token 保护，容易受到跨站请求伪造攻击。

**修复方案**：
- 实现 CSRF Token 生成和验证机制
- 登录成功后返回 CSRF Token（存储在 sessionStorage）
- 所有状态变更请求携带 `X-CSRF-Token` 请求头
- 后端验证 CSRF Token 有效性

**修改文件**：
- `src/utils/security.js` - 新增安全工具模块（CSRF Token 生成/验证）
- `src/ui-modules/auth.js` - 添加 CSRF Token 接口
- `src/services/ui-manager.js` - 添加 CSRF Token 路由

### 3. 🔴 高危：路径遍历漏洞

**问题描述**：`upload-config-api.js` 中的文件路径验证不严格，可能导致路径遍历攻击，攻击者可访问配置目录外的文件。

**修复方案**：
- 使用 `path.resolve` 规范化路径
- 严格验证路径必须在配置目录内
- 拒绝包含 `..` 或绝对路径的非法请求

**修改文件**：
- `src/ui-modules/upload-config-api.js` - 修复路径验证逻辑

## 技术细节

### Cookie 安全配置

```javascript
res.cookie('auth_token', token, {
    httpOnly: true,    // JavaScript 无法访问
    secure: process.env.NODE_ENV === 'production',  // HTTPS Only
    sameSite: 'Strict', // 严格同源策略
    maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
    path: '/'
});
```

### CSRF Token 流程

1. 客户端登录成功 → 服务端返回 CSRF Token
2. 客户端存储到 sessionStorage（仅当前会话有效）
3. 发送 POST/PUT/DELETE 请求时携带 `X-CSRF-Token` 头
4. 服务端验证 CSRF Token 与 Cookie 中的 Token 是否匹配

### 路径验证逻辑

```javascript
const CONFIGS_DIR = path.resolve('/path/to/configs');

function validateFilePath(filePath) {
    const resolvedPath = path.resolve(CONFIGS_DIR, filePath);
    if (!resolvedPath.startsWith(CONFIGS_DIR + path.sep)) {
        return { valid: false, error: 'Invalid path' };
    }
    return { valid: true, path: resolvedPath };
}
```

## 测试建议

1. **XSS 测试**：尝试通过注入脚本读取 document.cookie（应无法读取 httpOnly Cookie）
2. **CSRF 测试**：从其他网站发起请求（应被 CSRF Token 验证拦截）
3. **路径遍历测试**：请求 `/api/upload-configs/download/../../../etc/passwd`（应返回 400 错误）

## 兼容性说明

- 现有用户需要重新登录以获取新的 Cookie Token
- 旧版本 Token 将在过期后自动失效
- 建议清理 localStorage 中的旧 Token：`localStorage.removeItem('authToken')`
