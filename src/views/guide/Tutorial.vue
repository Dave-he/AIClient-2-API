<template>
  <section id="tutorial" class="section" aria-labelledby="tutorial-title">
    <h2 id="tutorial-title">配置教程</h2>
    
    <div class="tutorial-panel">
      <h3><i class="fas fa-file-code"></i> 配置文件说明</h3>
      <div class="tutorial-content">
        <p>所有配置文件都存放在 <code>configs/</code> 目录下。主要配置文件包括：</p>
        
        <div class="config-file-list">
          <div class="config-file-item">
            <div class="file-header">
              <i class="fas fa-file-alt"></i>
              <span class="file-name">config.json</span>
              <span class="file-badge required">必需</span>
            </div>
            <p class="file-desc">主配置文件，包含 API Key、端口、模型提供商等核心设置 (保存配置管理后自动新建)</p>
          </div>
          <div class="config-file-item">
            <div class="file-header">
              <i class="fas fa-file-alt"></i>
              <span class="file-name">provider_pools.json</span>
              <span class="file-badge required">必需</span>
            </div>
            <p class="file-desc">提供商池配置，用于多账号轮询和故障转移 (保存节点后自动新建)</p>
          </div>
          <div class="config-file-item">
            <div class="file-header">
              <i class="fas fa-file-alt"></i>
              <span class="file-name">plugins.json</span>
              <span class="file-badge optional">可选</span>
            </div>
            <p class="file-desc">插件配置，用于启用或禁用系统插件</p>
          </div>
          <div class="config-file-item">
            <div class="file-header">
              <i class="fas fa-lock"></i>
              <span class="file-name">pwd</span>
              <span class="file-badge optional">可选</span>
            </div>
            <p class="file-desc">后台登录密码文件，默认密码为 admin123</p>
          </div>
        </div>
      </div>
    </div>

    <div class="tutorial-panel">
      <h3><i class="fas fa-cogs"></i> 主配置详解 (config.json)</h3>
      <div class="tutorial-content">
        <div class="config-section">
          <h4>基础设置</h4>
          <div class="config-table">
            <table>
              <thead>
                <tr>
                  <th>参数</th>
                  <th>类型</th>
                  <th>默认值</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>REQUIRED_API_KEY</code></td>
                  <td>string</td>
                  <td>-</td>
                  <td>访问本服务所需的 API Key</td>
                </tr>
                <tr>
                  <td><code>SERVER_PORT</code></td>
                  <td>number</td>
                  <td>3000</td>
                  <td>服务监听端口</td>
                </tr>
                <tr>
                  <td><code>HOST</code></td>
                  <td>string</td>
                  <td>0.0.0.0</td>
                  <td>服务监听地址</td>
                </tr>
                <tr>
                  <td><code>MODEL_PROVIDER</code></td>
                  <td>string</td>
                  <td>-</td>
                  <td>默认模型提供商</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="config-section">
          <h4>代理设置</h4>
          <div class="config-table">
            <table>
              <thead>
                <tr>
                  <th>参数</th>
                  <th>类型</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>PROXY_URL</code></td>
                  <td>string</td>
                  <td>代理地址，支持 HTTP、HTTPS、SOCKS5</td>
                </tr>
                <tr>
                  <td><code>PROXY_ENABLED_PROVIDERS</code></td>
                  <td>array</td>
                  <td>启用代理的提供商列表</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="config-section">
          <h4>服务治理</h4>
          <div class="config-table">
            <table>
              <thead>
                <tr>
                  <th>参数</th>
                  <th>类型</th>
                  <th>默认值</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>REQUEST_MAX_RETRIES</code></td>
                  <td>number</td>
                  <td>3</td>
                  <td>最大重试次数</td>
                </tr>
                <tr>
                  <td><code>REQUEST_BASE_DELAY</code></td>
                  <td>number</td>
                  <td>1000</td>
                  <td>重试基础延迟（毫秒）</td>
                </tr>
                <tr>
                  <td><code>CREDENTIAL_SWITCH_MAX_RETRIES</code></td>
                  <td>number</td>
                  <td>5</td>
                  <td>坏凭证切换最大重试次数</td>
                </tr>
                <tr>
                  <td><code>MAX_ERROR_COUNT</code></td>
                  <td>number</td>
                  <td>10</td>
                  <td>提供商最大错误次数，超过后标记为不健康</td>
                </tr>
                <tr>
                  <td><code>WARMUP_TARGET</code></td>
                  <td>number</td>
                  <td>0</td>
                  <td>系统启动时自动刷新的节点数量</td>
                </tr>
                <tr>
                  <td><code>REFRESH_CONCURRENCY_PER_PROVIDER</code></td>
                  <td>number</td>
                  <td>1</td>
                  <td>提供商内刷新并发数</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="config-section">
          <h4>日志设置</h4>
          <div class="config-table">
            <table>
              <thead>
                <tr>
                  <th>参数</th>
                  <th>类型</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>LOG_ENABLED</code></td>
                  <td>boolean</td>
                  <td>启用日志</td>
                </tr>
                <tr>
                  <td><code>LOG_OUTPUT_MODE</code></td>
                  <td>string</td>
                  <td>日志输出模式 (all/console/file/none)</td>
                </tr>
                <tr>
                  <td><code>PROMPT_LOG_MODE</code></td>
                  <td>string</td>
                  <td>提示词日志模式：none(关闭)、console(控制台)、file(文件)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="config-example">
          <h4>配置示例</h4>
          <pre><code>{
    "REQUIRED_API_KEY": "your-api-key",
    "SERVER_PORT": 3000,
    "HOST": "0.0.0.0",
    "MODEL_PROVIDER": "gemini-cli-oauth,claude-kiro-oauth",
    "PROXY_URL": "http://127.0.0.1:7890",
    "PROXY_ENABLED_PROVIDERS": ["gemini-cli-oauth", "claude-kiro-oauth"],
    "REQUEST_MAX_RETRIES": 3,
    "MAX_ERROR_COUNT": 10,
    "WARMUP_TARGET": 5,
    "LOG_ENABLED": true,
    "LOG_OUTPUT_MODE": "all"
}</code></pre>
        </div>
      </div>
    </div>

    <div class="tutorial-panel">
      <h3><i class="fas fa-layer-group"></i> 提供商池配置 (provider_pools.json)</h3>
      <div class="tutorial-content">
        <p>提供商池用于配置多个账号，实现负载均衡和故障转移。每个提供商类型可以配置多个账号节点。</p>
        
        <div class="config-section">
          <h4>节点配置参数</h4>
          <div class="config-table">
            <table>
              <thead>
                <tr>
                  <th>参数</th>
                  <th>类型</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>uuid</code></td>
                  <td>string</td>
                  <td>节点唯一标识，自动生成</td>
                </tr>
                <tr>
                  <td><code>name</code></td>
                  <td>string</td>
                  <td>节点自定义名称</td>
                </tr>
                <tr>
                  <td><code>oauthCredsFilePath</code></td>
                  <td>string</td>
                  <td>OAuth 凭据文件路径</td>
                </tr>
                <tr>
                  <td><code>checkHealth</code></td>
                  <td>boolean</td>
                  <td>是否启用健康检查</td>
                </tr>
                <tr>
                  <td><code>checkModel</code></td>
                  <td>string</td>
                  <td>健康检查使用的模型</td>
                </tr>
                <tr>
                  <td><code>notSupportedModels</code></td>
                  <td>array</td>
                  <td>该节点不支持的模型列表</td>
                </tr>
                <tr>
                  <td><code>disabled</code></td>
                  <td>boolean</td>
                  <td>是否禁用该节点</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="config-example">
          <h4>配置示例</h4>
          <pre><code>{
    "gemini-cli-oauth": [
        {
            "uuid": "gemini-account-1",
            "name": "Gemini 账号 1",
            "oauthCredsFilePath": "configs/gemini/oauth_creds_1.json",
            "checkHealth": true,
            "checkModel": "gemini-3-flash-preview"
        }
    ],
    "claude-kiro-oauth": [
        {
            "uuid": "kiro-account-1",
            "name": "Kiro 账号 1",
            "oauthCredsFilePath": "configs/kiro/kiro-auth-token.json",
            "checkHealth": true
        }
    ]
}</code></pre>
        </div>
      </div>
    </div>

    <div class="tutorial-panel">
      <h3><i class="fas fa-random"></i> Fallback 降级配置</h3>
      <div class="tutorial-content">
        <p>当某一提供商类型的所有账号都不可用时，可以自动切换到配置的备用提供商。</p>
        
        <div class="config-section">
          <h4>跨类型 Fallback 链</h4>
          <p>在 config.json 中配置 providerFallbackChain，指定每个提供商类型的备用类型：</p>
          <pre><code>{
    "providerFallbackChain": {
        "gemini-cli-oauth": ["gemini-antigravity"],
        "gemini-antigravity": ["gemini-cli-oauth"],
        "claude-kiro-oauth": ["claude-custom"],
        "claude-custom": ["claude-kiro-oauth"]
    }
}</code></pre>
        </div>

        <div class="config-section">
          <h4>跨协议模型映射</h4>
          <p>当主提供商不可用时，可以将特定模型映射到其他协议的提供商：</p>
          <pre><code>{
    "modelFallbackMapping": {
        "gemini-claude-opus-4-5-thinking": {
            "targetProviderType": "claude-kiro-oauth",
            "targetModel": "claude-opus-4-5"
        }
    }
}</code></pre>
        </div>
      </div>
    </div>

    <div class="tutorial-panel">
      <h3><i class="fas fa-key"></i> OAuth 授权路径</h3>
      <div class="tutorial-content">
        <p>各提供商的 OAuth 凭据文件默认存储位置（建议保持在 <code>configs/</code> 目录下以便统一管理）：</p>
        
        <div class="oauth-path-list">
          <div v-for="provider in oauthProviders" :key="provider.name" class="oauth-path-item">
            <div class="oauth-provider-icon" :style="{ background: provider.color + '20', color: provider.color }">
              <i :class="['fas', provider.icon]"></i>
            </div>
            <div class="oauth-path-info">
              <span class="oauth-provider-name">{{ provider.name }}</span>
              <span class="oauth-path">{{ provider.path }}</span>
            </div>
          </div>
        </div>

        <div class="tutorial-note">
          <i class="fas fa-lightbulb"></i>
          <span>推荐通过 Web UI 控制台的"提供商池管理"页面点击"生成授权"按钮进行可视化授权，系统会自动保存凭据文件。</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
const oauthProviders = [
  { name: 'Gemini CLI OAuth', icon: 'fa-google', color: '#4285F4', path: 'configs/gemini/oauth_creds_*.json' },
  { name: 'Gemini Antigravity', icon: 'fa-google', color: '#EA4335', path: 'configs/gemini/antigravity_*.json' },
  { name: 'Claude Kiro OAuth', icon: 'fa-robot', color: '#00C851', path: 'configs/kiro/kiro-auth-token.json' },
  { name: 'Codex OAuth', icon: 'fa-code', color: '#607D8B', path: 'configs/codex/oauth_creds_*.json' },
  { name: 'Qwen OAuth', icon: 'fa-cloud', color: '#FF6B6B', path: 'configs/qwen/oauth_creds_*.json' },
  { name: 'iFlow OAuth', icon: 'fa-flask', color: '#9C27B0', path: 'configs/iflow/oauth_creds_*.json' }
]
</script>

<style scoped>
.section {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.tutorial-panel {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  padding: 1rem;
  margin-bottom: 1rem;
}

.tutorial-panel h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tutorial-panel h3 i {
  color: var(--primary-color);
}

.tutorial-content {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.tutorial-content p {
  margin: 0 0 0.75rem;
}

.tutorial-content code {
  background: var(--code-bg);
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius-sm);
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.75rem;
}

.config-file-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.config-file-item {
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  border: 1px solid var(--border-color);
}

.file-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.file-header i {
  color: var(--primary-color);
}

.file-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.8rem;
}

.file-badge {
  font-size: 0.6rem;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
}

.file-badge.required {
  background: var(--danger-10);
  color: var(--danger-color);
}

.file-badge.optional {
  background: var(--warning-10);
  color: var(--warning-color);
}

.file-desc {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 0;
}

.config-section {
  margin-top: 1rem;
}

.config-section h4 {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.config-section p {
  font-size: 0.8rem;
  margin-bottom: 0.5rem;
}

.config-table {
  overflow-x: auto;
}

.config-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
}

.config-table th,
.config-table td {
  padding: 0.5rem;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.config-table th {
  background: var(--bg-tertiary);
  font-weight: 600;
  color: var(--text-primary);
}

.config-table td code {
  font-size: 0.7rem;
}

.config-example {
  margin-top: 1rem;
}

.config-example h4 {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.config-example pre {
  background: var(--code-bg);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  overflow-x: auto;
  margin: 0;
}

.config-example code {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.7rem;
  color: var(--code-text);
  background: transparent;
  padding: 0;
}

.oauth-path-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.oauth-path-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  border: 1px solid var(--border-color);
}

.oauth-provider-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
}

.oauth-path-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.oauth-provider-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
}

.oauth-path {
  font-size: 0.7rem;
  color: var(--text-secondary);
  font-family: 'Monaco', 'Menlo', monospace;
}

.tutorial-note {
  display: flex;
  gap: 0.5rem;
  background: var(--warning-bg-alt);
  padding: 0.75rem;
  border-radius: var(--radius-md);
  margin-top: 1rem;
  font-size: 0.8rem;
}

.tutorial-note i {
  color: var(--warning-color);
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .config-file-list,
  .oauth-path-list {
    grid-template-columns: 1fr;
  }
  
  .config-table {
    font-size: 0.7rem;
  }
}
</style>