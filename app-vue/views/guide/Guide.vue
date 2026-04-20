<template>
  <section id="guide" class="section" aria-labelledby="guide-title">
    <h2 id="guide-title">使用指南</h2>
    
    <!-- 项目简介 -->
    <div class="guide-panel">
      <h3><i class="fas fa-info-circle"></i> 项目简介</h3>
      <div class="guide-content">
        <p>AIClient2API 是一个突破客户端限制的 API 代理服务，将 Gemini、Antigravity、Qwen Code、Kiro 等原本仅限客户端内使用的免费大模型，转换为可供任何应用调用的标准 OpenAI 兼容接口。</p>
        <div class="feature-grid">
          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-plug"></i></div>
            <h4>统一接入</h4>
            <p>通过标准 OpenAI 兼容协议，一次配置即可接入多种大模型</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-rocket"></i></div>
            <h4>突破限制</h4>
            <p>利用 OAuth 授权机制，有效突破免费 API 速率和配额限制</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-exchange-alt"></i></div>
            <h4>协议转换</h4>
            <p>支持 OpenAI、Claude、Gemini 三大协议间的智能转换</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-server"></i></div>
            <h4>账号池管理</h4>
            <p>支持多账号轮询、自动故障转移和配置降级</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作流程图 -->
    <div class="guide-panel">
      <h3><i class="fas fa-project-diagram"></i> 操作流程图</h3>
      <div class="guide-content">
        <div class="process-flow">
          <div class="flow-step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h4>配置管理</h4>
              <p>在「配置管理」页面设置基本参数</p>
              <ul>
                <li>设置 API Key</li>
                <li>选择启动时初始化的模型提供商</li>
                <li>配置高级选项</li>
              </ul>
            </div>
          </div>
          
          <div class="flow-arrow">→</div>
          
          <div class="flow-step flow-step-branch">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4>生成授权</h4>
              <p>在「提供商池管理」页面生成 OAuth 授权</p>
              <div class="branch-options">
                <div class="branch-option">
                  <div class="branch-label">方式一：OAuth 授权</div>
                  <ul>
                    <li>点击「生成授权」按钮</li>
                    <li>在弹窗中完成 OAuth 登录</li>
                    <li>凭据自动保存</li>
                  </ul>
                </div>
                <div class="branch-divider">或</div>
                <div class="branch-option">
                  <div class="branch-label">方式二：手动上传</div>
                  <ul>
                    <li>新增提供商节点</li>
                    <li>上传已有的授权文件</li>
                    <li>手动关联凭据路径</li>
                  </ul>
                </div>
                <div class="branch-divider">或</div>
                <div class="branch-option">
                  <div class="branch-label">方式三：对接提供商 API</div>
                  <ul>
                    <li>在「配置管理」设置 API Key 和端点</li>
                    <li>系统自动识别并对接</li>
                    <li>无需手动上传凭据</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <div class="flow-arrow">→</div>
          
          <div class="flow-step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h4>管理凭据</h4>
              <p>在「凭据文件管理」页面查看和管理凭据</p>
              <ul>
                <li>查看已生成的凭据文件</li>
                <li>自动关联到提供商池</li>
                <li>删除无效凭据</li>
              </ul>
            </div>
          </div>
          
          <div class="flow-arrow">→</div>
          
          <div class="flow-step">
            <div class="step-number">4</div>
            <div class="step-content">
              <h4>开始使用</h4>
              <p>在「仪表盘」查看路由示例并开始调用 API</p>
              <ul>
                <li>查看路由调用示例</li>
                <li>复制 API 端点地址</li>
                <li>在客户端中配置使用</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 客户端配置指南 -->
    <div class="guide-panel">
      <h3><i class="fas fa-desktop"></i> 客户端配置指南</h3>
      <div class="guide-content">
        <p>以下是常见 AI 客户端的配置方法，将 API 端点设置为本服务地址即可使用：</p>
        
        <div class="client-config-list">
          <div class="client-config-item">
            <h4><i class="fas fa-cherry"></i> Cherry Studio</h4>
            <div class="config-steps">
              <ol>
                <li>打开设置 → 模型服务商</li>
                <li>添加自定义服务商</li>
                <li>设置 API 地址为: <code>http://localhost:3000/{provider}/v1</code></li>
                <li>填入 API Key（配置文件中的 REQUIRED_API_KEY）</li>
              </ol>
            </div>
          </div>
          
          <div class="client-config-item">
            <h4><i class="fas fa-terminal"></i> Cline / Continue</h4>
            <div class="config-steps">
              <ol>
                <li>打开 VS Code 设置</li>
                <li>搜索 Cline 或 Continue 配置</li>
                <li>设置 API Base URL 为: <code>http://localhost:3000/{provider}/v1</code></li>
                <li>填入 API Key 和模型名称</li>
              </ol>
            </div>
          </div>
          
          <div class="client-config-item">
            <h4><i class="fas fa-code"></i> 通用 cURL 调用</h4>
            <div class="config-steps">
              <pre><code>curl http://localhost:3000/{provider}/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "模型名称",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 1000
  }'</code></pre>
            </div>
          </div>
        </div>
        
        <div class="guide-note">
          <i class="fas fa-lightbulb"></i>
          <span>提示：将 {provider} 替换为实际的提供商路径，如 gemini-cli-oauth、claude-kiro-oauth 等。可在仪表盘的路由示例中查看完整路径。</span>
        </div>
      </div>
    </div>

    <!-- 常见问题 -->
    <div class="guide-panel">
      <h3><i class="fas fa-question-circle"></i> 常见问题</h3>
      <div class="guide-content">
        <div class="faq-list">
          <div class="faq-item">
            <div class="faq-question">Q: 请求返回 404 错误怎么办？</div>
            <div class="faq-answer">A: 检查接口路径是否正确。某些客户端会自动在 Base URL 后追加路径，导致路径重复。请查看控制台中的实际请求 URL，移除多余的路径部分。</div>
          </div>
          <div class="faq-item">
            <div class="faq-question">Q: 请求返回 429 错误怎么办？</div>
            <div class="faq-answer">A: 429 表示请求频率过高。建议配置多个账号到提供商池，启用轮询机制；或配置 Fallback 链实现跨类型降级。</div>
          </div>
          <div class="faq-item">
            <div class="faq-question">Q: OAuth 授权失败怎么办？</div>
            <div class="faq-answer">A: 确保 OAuth 回调端口可访问（Gemini: 8085, Antigravity: 8086, Kiro: 19876-19880）。Docker 用户需确保已正确映射这些端口。</div>
          </div>
          <div class="faq-item">
            <div class="faq-question">Q: 流式响应中断怎么办？</div>
            <div class="faq-answer">A: 检查网络稳定性，增加客户端请求超时时间。如使用代理，确保代理支持长连接。</div>
          </div>
          <div class="faq-item">
            <div class="faq-question">Q: 请求返回 "No available and healthy providers" 错误怎么办？</div>
            <div class="faq-answer">A: 这表示对应类型的提供商都不可用。请在"提供商池"页面检查提供商健康状态，确认 OAuth 凭据未过期，或配置 Fallback 链实现自动切换到备用提供商。</div>
          </div>
          <div class="faq-item">
            <div class="faq-question">Q: 请求返回 403 Forbidden 错误怎么办？</div>
            <div class="faq-answer">A: 403 表示访问被拒绝。首先检查"提供商池"页面中节点状态，如果节点健康检查正常，可以忽略此报错。其他可能原因包括：账号权限不足、API Key 权限受限、地区访问限制、凭据已失效等。</div>
          </div>
          <div class="faq-item">
            <div class="faq-question">Q: 为什么要开启“启用 OAuth 令牌自动刷新”？</div>
            <div class="faq-answer">A: OAuth 令牌通常有有效期（如 1 小时）。开启后，系统会在后台自动刷新即将过期的令牌，确保 24/7 稳定服务，避免因令牌过期导致的请求失败。</div>
          </div>
          <div class="faq-item">
            <div class="faq-question">Q: “预加载模型提供商”未开启对 Token 保持有什么影响？</div>
            <div class="faq-answer">A: 系统仅会对已预加载的提供商执行自动刷新。如果某提供商未预加载，其 Token 将不会在后台自动刷新，长时间不使用可能导致 Token 过期。建议将常用提供商加入预加载列表。</div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
// Guide page component
</script>

<style scoped>
.section {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.guide-panel {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  margin-bottom: 1rem;
  overflow: hidden;
}

.guide-panel h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  padding: 1rem;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.guide-panel h3 i {
  color: var(--primary-color);
}

.guide-content {
  padding: 1rem;
}

.guide-content p {
  color: var(--text-secondary);
  margin: 0 0 1rem;
  line-height: 1.6;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.feature-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 1rem;
  text-align: center;
}

.feature-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--primary-10);
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 0.75rem;
  font-size: 1.25rem;
}

.feature-card h4 {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.feature-card p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.process-flow {
  display: flex;
  align-items: stretch;
  gap: 1rem;
  flex-wrap: wrap;
}

.flow-step {
  flex: 1;
  min-width: 200px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 1rem;
  display: flex;
  gap: 0.75rem;
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}

.step-content h4 {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.step-content p {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.step-content ul {
  margin: 0;
  padding-left: 1.25rem;
}

.step-content li {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.step-content li:last-child {
  margin-bottom: 0;
}

.flow-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--text-tertiary);
  padding: 0 0.5rem;
}

.flow-step-branch {
  flex: 2;
}

.branch-options {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.branch-option {
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  padding: 0.75rem;
}

.branch-label {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.8rem;
  margin-bottom: 0.5rem;
}

.branch-divider {
  text-align: center;
  color: var(--text-tertiary);
  font-weight: 600;
  padding: 0.25rem 0;
}

.client-config-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
}

.client-config-item {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 1rem;
}

.client-config-item h4 {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.config-steps ol {
  margin: 0;
  padding-left: 1.5rem;
}

.config-steps li {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 0.375rem;
  line-height: 1.5;
}

.config-steps li:last-child {
  margin-bottom: 0;
}

.config-steps code {
  background: var(--bg-primary);
  padding: 0.125rem 0.25rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  color: var(--primary-color);
}

.config-steps pre {
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  padding: 0.75rem;
  margin: 0;
  overflow-x: auto;
}

.config-steps pre code {
  background: none;
  padding: 0;
  font-size: 0.7rem;
  color: var(--text-primary);
  display: block;
  white-space: pre;
}

.guide-note {
  background: var(--info-bg-light);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  color: var(--info-text);
  font-size: 0.8rem;
}

.guide-note i {
  flex-shrink: 0;
}

.faq-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.faq-item {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.faq-question {
  padding: 0.75rem 1rem;
  color: var(--text-primary);
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.faq-question:hover {
  background: var(--bg-tertiary);
}

.faq-answer {
  padding: 0.75rem 1rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
  border-top: 1px solid var(--border-color);
  line-height: 1.6;
}

@media (max-width: 1024px) {
  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .client-config-list {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .process-flow {
    flex-direction: column;
  }
  
  .flow-arrow {
    transform: rotate(90deg);
  }
}

@media (max-width: 768px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }
  
  .client-config-list {
    grid-template-columns: 1fr;
  }
  
  .flow-step {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .step-number {
    align-self: flex-start;
  }
}
</style>