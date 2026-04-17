<template>
  <section id="tutorial" class="section" aria-labelledby="tutorial-title">
    <h2 id="tutorial-title">配置教程</h2>
    
    <div class="tutorial-container">
      <div class="tutorial-sidebar">
        <div 
          v-for="(step, index) in tutorialSteps" 
          :key="step.id"
          class="sidebar-item"
          :class="{ active: currentStep === index }"
          @click="currentStep = index"
        >
          <span class="step-number">{{ index + 1 }}</span>
          <span class="step-title">{{ step.title }}</span>
        </div>
      </div>
      
      <div class="tutorial-content">
        <div v-for="(step, index) in tutorialSteps" :key="step.id" v-show="currentStep === index">
          <div class="step-header">
            <div class="step-icon" :style="{ background: step.color + '20', color: step.color }">
              <i :class="['fas', step.icon]"></i>
            </div>
            <div>
              <h3>{{ step.title }}</h3>
              <p class="step-subtitle">{{ step.subtitle }}</p>
            </div>
          </div>
          
          <div class="step-content">
            <div v-html="step.content"></div>
          </div>
          
          <div class="step-actions">
            <button 
              v-if="index > 0" 
              class="btn btn-outline" 
              @click="currentStep = index - 1"
            >
              <i class="fas fa-arrow-left"></i> 上一步
            </button>
            <button 
              v-if="index < tutorialSteps.length - 1" 
              class="btn btn-primary" 
              @click="currentStep = index + 1"
            >
              下一步 <i class="fas fa-arrow-right"></i>
            </button>
            <button 
              v-if="index === tutorialSteps.length - 1" 
              class="btn btn-primary" 
              @click="finishTutorial"
            >
              <i class="fas fa-check"></i> 完成
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="quick-links">
      <h3><i class="fas fa-link"></i> 快速链接</h3>
      <div class="links-grid">
        <a href="#guide" class="link-item">
          <i class="fas fa-book-open"></i>
          <span>完整使用指南</span>
        </a>
        <a href="#providers" class="link-item">
          <i class="fas fa-network-wired"></i>
          <span>提供商池管理</span>
        </a>
        <a href="#config" class="link-item">
          <i class="fas fa-cog"></i>
          <span>配置管理</span>
        </a>
        <a href="#logs" class="link-item">
          <i class="fas fa-file-alt"></i>
          <span>查看日志</span>
        </a>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'

const currentStep = ref(0)

const tutorialSteps = [
  {
    id: 1,
    title: '系统概述',
    subtitle: '了解 AIClient2API 的核心功能',
    icon: 'fa-info-circle',
    color: '#3B82F6',
    content: `
      <p>AIClient2API 是一个强大的 API 代理中间件，能够将多种 AI 提供商的 API 统一转换为标准的 OpenAI 兼容接口。</p>
      <div class="feature-list">
        <div class="feature-item">
          <i class="fas fa-plug"></i>
          <div>
            <h4>统一接入</h4>
            <p>通过标准 OpenAI 兼容协议，一次配置即可接入多种大模型</p>
          </div>
        </div>
        <div class="feature-item">
          <i class="fas fa-rocket"></i>
          <div>
            <h4>突破限制</h4>
            <p>利用 OAuth 授权机制，有效突破免费 API 速率和配额限制</p>
          </div>
        </div>
        <div class="feature-item">
          <i class="fas fa-exchange-alt"></i>
          <div>
            <h4>协议转换</h4>
            <p>支持 OpenAI、Claude、Gemini 三大协议间的智能转换</p>
          </div>
        </div>
      </div>
    `
  },
  {
    id: 2,
    title: '配置基础参数',
    subtitle: '设置 API Key 和基本配置',
    icon: 'fa-key',
    color: '#10B981',
    content: `
      <p>在「配置管理」页面设置基础参数：</p>
      <ol>
        <li>设置 API Key（必填，用于客户端认证）</li>
        <li>配置监听地址和端口（默认 127.0.0.1:3000）</li>
        <li>选择启动时初始化的模型提供商</li>
      </ol>
      <div class="code-block">
        <pre><code># 默认 API Key（建议修改）
REQUIRED_API_KEY=your-secret-key

# 监听配置
HOST=127.0.0.1
PORT=3000</code></pre>
      </div>
    `
  },
  {
    id: 3,
    title: '生成 OAuth 授权',
    subtitle: '为提供商生成认证凭据',
    icon: 'fa-shield-alt',
    color: '#F59E0B',
    content: `
      <p>在「提供商池管理」页面为各提供商生成 OAuth 授权：</p>
      <div class="step-list">
        <div class="step-item">
          <span class="step-badge">1</span>
          <div>
            <h4>选择提供商</h4>
            <p>选择需要授权的提供商类型（如 Gemini CLI OAuth）</p>
          </div>
        </div>
        <div class="step-item">
          <span class="step-badge">2</span>
          <div>
            <h4>点击生成授权</h4>
            <p>系统会自动打开浏览器进行 OAuth 登录</p>
          </div>
        </div>
        <div class="step-item">
          <span class="step-badge">3</span>
          <div>
            <h4>完成授权</h4>
            <p>凭据会自动保存到服务器</p>
          </div>
        </div>
      </div>
    `
  },
  {
    id: 4,
    title: '管理凭据文件',
    subtitle: '查看和管理已生成的凭据',
    icon: 'fa-file-json',
    color: '#8B5CF6',
    content: `
      <p>在「凭据文件管理」页面可以查看和管理所有凭据文件：</p>
      <ul>
        <li><strong>查看状态</strong> - 了解凭据是否已激活或已过期</li>
        <li><strong>上传凭据</strong> - 从其他环境导入凭据文件</li>
        <li><strong>下载备份</strong> - 导出凭据文件进行备份</li>
        <li><strong>删除凭据</strong> - 移除不再需要的凭据</li>
      </ul>
      <div class="note-box">
        <i class="fas fa-info-circle"></i>
        <p>凭据文件会自动关联到对应的提供商池节点，无需手动配置</p>
      </div>
    `
  },
  {
    id: 5,
    title: '开始使用',
    subtitle: '在客户端中配置使用',
    icon: 'fa-rocket',
    color: '#EC4899',
    content: `
      <p>配置完成后，在您的 AI 客户端中设置：</p>
      <div class="code-block">
        <pre><code># API 端点地址
http://localhost:3000/{provider}/v1

# API Key（配置文件中的 REQUIRED_API_KEY）
Bearer your-secret-key

# 示例：调用 Gemini CLI OAuth
curl http://localhost:3000/gemini-cli-oauth/v1/chat/completions \\
  -H "Authorization: Bearer your-secret-key" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "gemini-2.5-flash", "messages": [{"role": "user", "content": "Hello"}]}'</code></pre>
      </div>
      <p class="success-message">
        <i class="fas fa-check-circle"></i>
        恭喜！您已完成所有配置步骤，可以开始使用 AIClient2API 了。
      </p>
    `
  }
]

const finishTutorial = () => {
  window.$toast?.success('教程已完成！您现在可以开始使用 AIClient2API 了。')
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

.tutorial-container {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.tutorial-sidebar {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  padding: 0.5rem;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition);
  font-size: 0.8rem;
}

.sidebar-item:hover {
  background: var(--bg-tertiary);
}

.sidebar-item.active {
  background: var(--primary-10);
  color: var(--primary-color);
}

.step-number {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 600;
  flex-shrink: 0;
}

.sidebar-item.active .step-number {
  background: var(--primary-color);
  color: white;
}

.step-title {
  flex: 1;
  color: var(--text-secondary);
}

.sidebar-item.active .step-title {
  color: var(--primary-color);
  font-weight: 600;
}

.tutorial-content {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  padding: 1rem;
}

.step-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.step-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.step-header h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
}

.step-subtitle {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0;
}

.step-content {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.step-content p {
  margin: 0 0 0.75rem;
}

.step-content ol {
  margin: 0 0 0.75rem;
  padding-left: 1.25rem;
}

.step-content li {
  margin-bottom: 0.375rem;
}

.feature-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.feature-item {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.feature-item i {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary-10);
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.feature-item h4 {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
}

.feature-item p {
  font-size: 0.7rem;
  margin: 0;
}

.step-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.step-item {
  display: flex;
  gap: 0.5rem;
}

.step-badge {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
  flex-shrink: 0;
}

.step-item h4 {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
}

.step-item p {
  font-size: 0.75rem;
  margin: 0;
}

.code-block {
  background: var(--code-bg);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  margin-top: 0.75rem;
}

.code-block pre {
  margin: 0;
  overflow-x: auto;
}

.code-block code {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.7rem;
  color: var(--code-text);
}

.note-box {
  display: flex;
  gap: 0.5rem;
  background: var(--warning-bg-alt);
  padding: 0.75rem;
  border-radius: var(--radius-md);
  margin-top: 0.75rem;
}

.note-box i {
  color: var(--warning-color);
  flex-shrink: 0;
}

.note-box p {
  font-size: 0.75rem;
  color: var(--warning-text);
  margin: 0;
}

.success-message {
  display: flex;
  gap: 0.5rem;
  background: var(--success-bg);
  padding: 0.75rem;
  border-radius: var(--radius-md);
  margin-top: 0.75rem;
  color: var(--success-color);
}

.success-message i {
  flex-shrink: 0;
}

.step-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border-color);
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.btn-outline {
  background: transparent;
  color: var(--text-secondary);
}

.btn-outline:hover {
  background: var(--bg-tertiary);
}

.quick-links {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  padding: 1rem;
}

.quick-links h3 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.quick-links h3 i {
  color: var(--primary-color);
}

.links-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}

.link-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--text-secondary);
  transition: var(--transition);
}

.link-item:hover {
  background: var(--primary-10);
  color: var(--primary-color);
}

.link-item i {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary-10);
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

@media (max-width: 1024px) {
  .tutorial-container {
    grid-template-columns: 200px 1fr;
  }
  
  .feature-list {
    grid-template-columns: 1fr;
  }
  
  .links-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .tutorial-container {
    grid-template-columns: 1fr;
  }
  
  .tutorial-sidebar {
    overflow-x: auto;
  }
  
  .sidebar-item {
    display: inline-flex;
    margin-right: 0.25rem;
  }
  
  .links-grid {
    grid-template-columns: 1fr;
  }
}
</style>
