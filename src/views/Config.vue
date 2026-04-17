<template>
  <section id="config" class="section" aria-labelledby="config-title">
    <h2 id="config-title">配置管理</h2>
    <div class="config-panel">
      <div class="config-form">
        <!-- 基础设置 -->
        <div class="config-group-section">
          <h3><i class="fas fa-cog"></i> 基础设置</h3>
          <div class="form-group password-input-group">
            <label for="apiKey">API密钥</label>
            <div class="password-input-wrapper">
              <div class="input-with-toggle">
                <input 
                  type="password" 
                  v-model="config.apiKey"
                  class="form-control" 
                  placeholder="请输入API密钥" 
                  autocomplete="off"
                  :type="showApiKey ? 'text' : 'password'"
                >
                <button 
                  type="button" 
                  class="password-toggle" 
                  @click="showApiKey = !showApiKey"
                  aria-label="显示/隐藏密码"
                >
                  <i :class="['fas', showApiKey ? 'fa-eye-slash' : 'fa-eye']" aria-hidden="true"></i>
                </button>
              </div>
              <button 
                type="button" 
                class="btn btn-sm btn-secondary generate-key-btn"
                @click="generateApiKey"
                title="自动生成API密钥"
              >
                <i class="fas fa-magic"></i> 生成
              </button>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="host">监听地址</label>
              <input 
                type="text" 
                v-model="config.host"
                class="form-control"
                placeholder="例如: 127.0.0.1"
              >
            </div>
            <div class="form-group">
              <label for="port">端口</label>
              <input 
                type="number" 
                v-model="config.port"
                class="form-control"
                placeholder="3000"
              >
            </div>
          </div>
          <div class="form-group pool-section">
            <label>模型提供商 (可多选)</label>
            <div class="provider-tags">
              <button 
                v-for="provider in providers" 
                :key="provider.value"
                type="button" 
                class="provider-tag"
                :class="{ active: config.enabledProviders.includes(provider.value) }"
                @click="toggleProvider(provider.value)"
              >
                <i :class="['fas', provider.icon]"></i>
                <span>{{ provider.label }}</span>
              </button>
            </div>
            <small class="form-text">点击选择启动时初始化的模型提供商 (必须至少选择一个)</small>
          </div>
        </div>

        <!-- 代理与网络 -->
        <div class="config-group-section">
          <h3><i class="fas fa-globe"></i> 代理设置</h3>
          <div class="form-group">
            <label for="proxyUrl">代理地址</label>
            <input 
              type="text" 
              v-model="config.proxyUrl"
              class="form-control"
              placeholder="例如: http://127.0.0.1:7890 或 socks5://127.0.0.1:1080"
            >
            <small class="form-text">支持 HTTP、HTTPS 和 SOCKS5 代理，留空则不使用代理</small>
          </div>
          <div class="form-group pool-section">
            <label>启用代理的提供商</label>
            <div class="provider-tags">
              <button 
                v-for="provider in providers" 
                :key="provider.value"
                type="button" 
                class="provider-tag"
                :class="{ active: config.proxyProviders.includes(provider.value) }"
                @click="toggleProxyProvider(provider.value)"
              >
                <i :class="['fas', provider.icon]"></i>
                <span>{{ provider.label }}</span>
              </button>
            </div>
            <small class="form-text">点击选择需要通过代理访问的提供商，未选中的提供商将直接连接</small>
          </div>
          <hr>
          <div class="config-row">
            <div class="form-group">
              <label>TLS 指纹伪装 (uTLS Sidecar)</label>
              <label class="toggle-switch">
                <input type="checkbox" v-model="config.tlsSidecarEnabled">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="form-group">
              <label for="tlsSidecarPort">Sidecar 端口</label>
              <input 
                type="number" 
                v-model="config.tlsSidecarPort"
                class="form-control" 
                min="1024" 
                max="65535"
              >
            </div>
          </div>
          <div class="form-group">
            <label for="tlsSidecarProxyUrl">Sidecar 上游代理</label>
            <input 
              type="text" 
              v-model="config.tlsSidecarProxyUrl"
              class="form-control"
              placeholder="例如: http://127.0.0.1:7890"
            >
            <small class="form-text">TLS Sidecar 专用上游代理，留空则不使用代理</small>
          </div>
          <div class="form-group pool-section">
            <label>启用 TLS Sidecar 的提供商</label>
            <div class="provider-tags">
              <button 
                v-for="provider in providers" 
                :key="provider.value"
                type="button" 
                class="provider-tag"
                :class="{ active: config.tlsSidecarProviders.includes(provider.value) }"
                @click="toggleTlsSidecarProvider(provider.value)"
              >
                <i :class="['fas', provider.icon]"></i>
                <span>{{ provider.label }}</span>
              </button>
            </div>
            <small class="form-text">点击选择需要通过 TLS Sidecar 访问的提供商</small>
          </div>
          <small class="form-text">启用后选中的提供商请求将通过 Go uTLS sidecar 转发，完美模拟 Chrome TLS/H2 指纹绕过 Cloudflare（需重启服务）</small>
        </div>

        <!-- 服务治理与高可用 -->
        <div class="config-group-section">
          <h3><i class="fas fa-shield-alt"></i> 服务治理</h3>
          <div class="config-row">
            <div class="form-group">
              <label for="requestMaxRetries">请求最大重试次数</label>
              <input 
                type="number" 
                v-model="config.requestMaxRetries"
                class="form-control" 
                min="0" 
                max="10"
              >
            </div>
            <div class="form-group">
              <label for="requestBaseDelay">重试基础延迟(毫秒)</label>
              <input 
                type="number" 
                v-model="config.requestBaseDelay"
                class="form-control" 
                min="0" 
                step="100"
              >
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="credentialSwitchMaxRetries">坏凭证切换最大重试次数</label>
              <input 
                type="number" 
                v-model="config.credentialSwitchMaxRetries"
                class="form-control" 
                min="1" 
                max="50"
              >
            </div>
            <div class="form-group">
              <label for="maxErrorCount">节点最大错误阈值</label>
              <input 
                type="number" 
                v-model="config.maxErrorCount"
                class="form-control" 
                min="1" 
                max="20"
              >
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="warmupTarget">系统预热节点数</label>
              <input 
                type="number" 
                v-model="config.warmupTarget"
                class="form-control" 
                min="0" 
                max="100"
              >
            </div>
            <div class="form-group">
              <label for="refreshConcurrencyPerProvider">提供商刷新并发数</label>
              <input 
                type="number" 
                v-model="config.refreshConcurrencyPerProvider"
                class="form-control" 
                min="1" 
                max="10"
              >
            </div>
          </div>
          <div class="form-group pool-section">
            <label>跨类型 Fallback 链配置 (JSON)</label>
            <textarea 
              v-model="config.providerFallbackChain"
              class="form-control" 
              rows="4"
              placeholder='{"gemini-cli-oauth": ["gemini-antigravity"]}'
            ></textarea>
          </div>
          <div class="form-group pool-section">
            <label>跨协议模型 Fallback 映射 (JSON)</label>
            <textarea 
              v-model="config.modelFallbackMapping"
              class="form-control" 
              rows="4"
              placeholder='{"claude-opus-4-5": {"targetProviderType": "claude-custom", "targetModel": "claude-3-5-sonnet-20241022"}}'
            ></textarea>
          </div>
        </div>

        <!-- OAuth 与令牌 -->
        <div class="config-group-section">
          <h3><i class="fas fa-key"></i> OAuth & 令牌</h3>
          <div class="config-row">
            <div class="form-group">
              <label for="cronNearMinutes">令牌刷新间隔(分钟)</label>
              <input 
                type="number" 
                v-model="config.cronNearMinutes"
                class="form-control" 
                min="1" 
                max="60"
              >
            </div>
             <div class="form-group">
                <label>启用自动刷新 (需重启)</label>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="config.cronRefreshToken">
                  <span class="toggle-slider"></span>
                </label>
            </div>
          </div>
          <div class="form-group">
            <label for="loginExpiry">登录过期时间(秒)</label>
            <input 
              type="number" 
              v-model="config.loginExpiry"
              class="form-control" 
              min="60"
            >
            <small class="form-text">管理后台登录后的 Token 有效期，默认 3600 秒 (1小时)</small>
          </div>
        </div>

        <!-- 定时健康检查 -->
        <div class="config-group-section">
          <h3><i class="fas fa-heartbeat"></i> 定时健康检查</h3>
          <div class="config-row">
            <div class="form-group">
              <span class="toggle-label">启用定时检查</span>
              <label class="toggle-switch">
                <input type="checkbox" v-model="config.scheduledHealthCheckEnabled">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="form-group">
              <span class="toggle-label">启动时运行</span>
              <label class="toggle-switch">
                <input type="checkbox" v-model="config.scheduledHealthCheckStartupRun">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>检查间隔</label>
            <div class="input-with-quick-select">
              <input 
                type="number" 
                v-model="config.scheduledHealthCheckInterval"
                class="form-control" 
                min="60000" 
                max="3600000" 
                step="60000"
                placeholder="毫秒"
              >
              <div class="quick-select-btns">
                <button type="button" class="btn btn-sm btn-outline-secondary" @click="config.scheduledHealthCheckInterval = 300000">5分钟</button>
                <button type="button" class="btn btn-sm btn-outline-secondary" @click="config.scheduledHealthCheckInterval = 600000">10分钟</button>
                <button type="button" class="btn btn-sm btn-outline-secondary" @click="config.scheduledHealthCheckInterval = 1800000">30分钟</button>
              </div>
            </div>
            <small class="form-text">单位毫秒，最小60000ms(1分钟)，最大3600000ms(1小时)</small>
          </div>
          <div class="form-group">
            <label>定时检查的供应商</label>
            <div class="provider-tags">
              <button 
                v-for="provider in providers" 
                :key="provider.value"
                type="button" 
                class="provider-tag"
                :class="{ active: config.healthCheckProviders.includes(provider.value) }"
                @click="toggleHealthCheckProvider(provider.value)"
              >
                <i :class="['fas', provider.icon]"></i>
                <span>{{ provider.label }}</span>
              </button>
            </div>
            <small class="form-text">选择需要进行定时健康检查的供应商类型</small>
          </div>
        </div>

        <!-- 日志管理 -->
        <div class="config-group-section">
          <h3><i class="fas fa-file-alt"></i> 日志设置</h3>
          <div class="config-row">
            <div class="form-group">
              <label>启用日志</label>
              <label class="toggle-switch">
                <input type="checkbox" v-model="config.logEnabled">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="form-group">
              <label for="logOutputMode">日志输出模式</label>
              <select v-model="config.logOutputMode" class="form-control">
                <option value="all">全部 (控制台+文件)</option>
                <option value="console">仅控制台</option>
                <option value="file">仅文件</option>
                <option value="none">禁用</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="logLevel">日志级别</label>
              <select v-model="config.logLevel" class="form-control">
                <option value="debug">调试 (debug)</option>
                <option value="info">信息 (info)</option>
                <option value="warn">警告 (warn)</option>
                <option value="error">错误 (error)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="logDir">日志目录</label>
              <input type="text" v-model="config.logDir" class="form-control">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="logMaxFileSize">最大文件大小(字节)</label>
              <input 
                type="number" 
                v-model="config.logMaxFileSize"
                class="form-control" 
                step="1048576"
              >
            </div>
            <div class="form-group">
              <label for="logMaxFiles">最大保留文件数</label>
              <input 
                type="number" 
                v-model="config.logMaxFiles"
                class="form-control" 
                min="1"
              >
            </div>
          </div>
          <div class="config-row">
            <div class="form-group">
              <label>包含请求ID</label>
              <label class="toggle-switch">
                <input type="checkbox" v-model="config.logIncludeRequestId">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="form-group">
              <label>包含时间戳</label>
              <label class="toggle-switch">
                <input type="checkbox" v-model="config.logIncludeTimestamp">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
          <hr>
          <div class="form-row">
            <div class="form-group">
              <label for="promptLogMode">提示日志模式</label>
              <select v-model="config.promptLogMode" class="form-control">
                <option value="none">无 (none)</option>
                <option value="console">控制台 (console)</option>
                <option value="file">文件 (file)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="promptLogBaseName">提示日志基础名称</label>
              <input type="text" v-model="config.promptLogBaseName" class="form-control">
            </div>
          </div>
        </div>

        <!-- 系统与高级 -->
        <div class="config-group-section">
          <h3><i class="fas fa-cogs"></i> 系统与高级</h3>
          <div class="form-group">
            <label for="providerPoolsFilePath">提供商池配置文件路径</label>
            <input type="text" v-model="config.providerPoolsFilePath" class="form-control">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="systemPromptFilePath">系统提示文件路径</label>
              <input type="text" v-model="config.systemPromptFilePath" class="form-control">
            </div>
            <div class="form-group">
              <label for="systemPromptMode">系统提示模式</label>
              <select v-model="config.systemPromptMode" class="form-control">
                <option value="append">追加 (append)</option>
                <option value="overwrite">覆盖 (overwrite)</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="systemPrompt">系统提示内容</label>
            <textarea v-model="config.systemPrompt" class="form-control" rows="4"></textarea>
          </div>
          <div class="form-group">
            <label>系统提示词内容替换</label>
            <div class="replacements-container">
              <div 
                v-for="(replacement, index) in config.systemPromptReplacements" 
                :key="index"
                class="replacement-row"
              >
                <input 
                  type="text" 
                  v-model="replacement.from"
                  class="form-control"
                  placeholder="替换前"
                >
                <input 
                  type="text" 
                  v-model="replacement.to"
                  class="form-control"
                  placeholder="替换后"
                >
                <button 
                  type="button" 
                  class="btn btn-sm btn-danger"
                  @click="removeReplacement(index)"
                >
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <button type="button" class="btn btn-sm btn-outline-primary mt-2" @click="addReplacement">
              <i class="fas fa-plus"></i> 添加替换规则
            </button>
            <small class="form-text">按顺序逐条对系统提示词（包括请求中的和文件中的）执行内容替换。</small>
          </div>
          <div class="form-group">
            <label for="adminPassword">后台登录密码</label>
            <div class="password-input-wrapper">
              <div class="input-with-toggle">
                <input 
                  type="password" 
                  v-model="config.adminPassword"
                  class="form-control" 
                  autocomplete="new-password"
                  :type="showAdminPassword ? 'text' : 'password'"
                >
                <button 
                  type="button" 
                  class="password-toggle" 
                  @click="showAdminPassword = !showAdminPassword"
                  aria-label="显示/隐藏密码"
                >
                  <i :class="['fas', showAdminPassword ? 'fa-eye-slash' : 'fa-eye']" aria-hidden="true"></i>
                </button>
              </div>
            </div>
            <small class="form-text">修改后需要重新登录</small>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-success" @click="saveConfig">
            <i class="fas fa-save"></i> 保存配置
          </button>
          <button class="btn btn-secondary" @click="resetConfig">
            <i class="fas fa-undo"></i> 重置
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive } from 'vue'
import axios from 'axios'

const showApiKey = ref(false)
const showAdminPassword = ref(false)

const providers = [
  { value: 'gemini-cli-oauth', label: 'Gemini CLI OAuth', icon: 'fa-robot' },
  { value: 'gemini-antigravity', label: 'Gemini Antigravity', icon: 'fa-rocket' },
  { value: 'openai-custom', label: 'OpenAI Custom', icon: 'fa-brain' },
  { value: 'claude-custom', label: 'Claude Custom', icon: 'fa-comment-dots' },
  { value: 'claude-kiro-oauth', label: 'Claude Kiro OAuth', icon: 'fa-key' },
  { value: 'openai-qwen-oauth', label: 'Qwen OAuth', icon: 'fa-cloud' },
  { value: 'openaiResponses-custom', label: 'OpenAI Responses', icon: 'fa-reply' },
  { value: 'openai-codex-oauth', label: 'OpenAI Codex OAuth', icon: 'fa-code' },
  { value: 'grok-custom', label: 'Grok Reverse', icon: 'fa-search' }
]

const config = reactive({
  apiKey: '123456',
  host: '127.0.0.1',
  port: 3000,
  enabledProviders: ['gemini-cli-oauth'],
  proxyUrl: '',
  proxyProviders: [],
  tlsSidecarEnabled: false,
  tlsSidecarPort: 9090,
  tlsSidecarProxyUrl: '',
  tlsSidecarProviders: [],
  requestMaxRetries: 3,
  requestBaseDelay: 1000,
  credentialSwitchMaxRetries: 5,
  maxErrorCount: 10,
  warmupTarget: 0,
  refreshConcurrencyPerProvider: 1,
  providerFallbackChain: '{}',
  modelFallbackMapping: '{}',
  cronNearMinutes: 1,
  cronRefreshToken: true,
  loginExpiry: 3600,
  scheduledHealthCheckEnabled: false,
  scheduledHealthCheckStartupRun: true,
  scheduledHealthCheckInterval: 600000,
  healthCheckProviders: [],
  logEnabled: true,
  logOutputMode: 'all',
  logLevel: 'info',
  logDir: 'logs',
  logMaxFileSize: 10485760,
  logMaxFiles: 10,
  logIncludeRequestId: true,
  logIncludeTimestamp: true,
  promptLogMode: 'none',
  promptLogBaseName: '',
  providerPoolsFilePath: 'configs/provider_pools.json',
  systemPromptFilePath: '',
  systemPromptMode: 'append',
  systemPrompt: '',
  systemPromptReplacements: [],
  adminPassword: ''
})

const originalConfig = JSON.parse(JSON.stringify(config))

const generateApiKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let key = ''
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  config.apiKey = key
}

const toggleProvider = (value) => {
  const index = config.enabledProviders.indexOf(value)
  if (index > -1) {
    if (config.enabledProviders.length > 1) {
      config.enabledProviders.splice(index, 1)
    }
  } else {
    config.enabledProviders.push(value)
  }
}

const toggleProxyProvider = (value) => {
  const index = config.proxyProviders.indexOf(value)
  if (index > -1) {
    config.proxyProviders.splice(index, 1)
  } else {
    config.proxyProviders.push(value)
  }
}

const toggleTlsSidecarProvider = (value) => {
  const index = config.tlsSidecarProviders.indexOf(value)
  if (index > -1) {
    config.tlsSidecarProviders.splice(index, 1)
  } else {
    config.tlsSidecarProviders.push(value)
  }
}

const toggleHealthCheckProvider = (value) => {
  const index = config.healthCheckProviders.indexOf(value)
  if (index > -1) {
    config.healthCheckProviders.splice(index, 1)
  } else {
    config.healthCheckProviders.push(value)
  }
}

const addReplacement = () => {
  config.systemPromptReplacements.push({ from: '', to: '' })
}

const removeReplacement = (index) => {
  config.systemPromptReplacements.splice(index, 1)
}

const saveConfig = async () => {
  try {
    const token = localStorage.getItem('authToken')
    await axios.post('/api/config/save', config, {
      headers: { Authorization: `Bearer ${token}` }
    })
    alert('配置已保存')
  } catch (error) {
    console.error('Failed to save config:', error)
    alert('保存配置失败')
  }
}

const resetConfig = () => {
  Object.assign(config, JSON.parse(JSON.stringify(originalConfig)))
}
</script>

<style scoped>
.section {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.config-panel {
  max-width: 900px;
  margin: 0 auto;
}

.config-form {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-color);
  padding: 1.5rem;
}

.config-group-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.config-group-section:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.config-group-section h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.config-group-section h3 i {
  color: var(--primary-color);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.form-text {
  display: block;
  font-size: 0.7rem;
  color: var(--text-tertiary);
  margin-top: 0.25rem;
}

.form-control {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: var(--transition);
}

.form-control:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-10);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.config-row {
  display: flex;
  gap: 2rem;
  align-items: center;
}

.password-input-group {
  margin-bottom: 1rem;
}

.password-input-wrapper {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
}

.input-with-toggle {
  flex: 1;
  position: relative;
}

.input-with-toggle input {
  padding-right: 2.5rem;
}

.password-toggle {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
}

.generate-key-btn {
  padding: 0.5rem 1rem;
  white-space: nowrap;
}

.pool-section {
  margin-bottom: 1rem;
}

.provider-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.provider-tag {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition);
}

.provider-tag:hover {
  background: var(--bg-tertiary);
  border-color: var(--primary-color);
}

.provider-tag.active {
  background: var(--primary-10);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.provider-tag i {
  font-size: 0.875rem;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--border-color);
  transition: 0.3s;
  border-radius: 26px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: var(--primary-color);
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(22px);
}

.toggle-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-right: 0.75rem;
}

.input-with-quick-select {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
}

.input-with-quick-select .form-control {
  flex: 1;
}

.quick-select-btns {
  display: flex;
  gap: 0.25rem;
}

.replacements-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.replacement-row {
  display: flex;
  gap: 0.5rem;
}

.replacement-row .form-control {
  flex: 1;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);
}

.btn {
  padding: 0.5rem 1.25rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border-color);
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.btn-secondary:hover {
  background: var(--bg-tertiary);
}

.btn-outline-secondary {
  background: transparent;
  color: var(--text-secondary);
  border-color: var(--border-color);
}

.btn-outline-secondary:hover {
  background: var(--bg-tertiary);
}

.btn-outline-primary {
  background: transparent;
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.btn-outline-primary:hover {
  background: var(--primary-10);
}

.btn-success {
  background: var(--success-color);
  color: white;
  border-color: var(--success-color);
}

.btn-success:hover {
  background: #047857;
}

.btn-danger {
  background: var(--danger-color);
  color: white;
  border-color: var(--danger-color);
}

.btn-danger:hover {
  background: #b91c1c;
}

hr {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 1rem 0;
}

.mt-2 {
  margin-top: 0.5rem;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .config-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  
  .password-input-wrapper {
    flex-direction: column;
  }
  
  .input-with-quick-select {
    flex-direction: column;
  }
  
  .replacement-row {
    flex-direction: column;
  }
}
</style>