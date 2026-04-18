<template>
  <div class="guide-page">
    <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
      <h2 class="text-xl font-bold text-slate-800 mb-6">使用指南</h2>
      
      <div class="space-y-6">
        <div class="prose max-w-none">
          <h3 class="text-lg font-semibold text-slate-700 mb-4">简介</h3>
          <p class="text-slate-600 leading-relaxed">
            AIClient2API 是一个强大的 API 代理中间件，能够将多种 AI 提供商的 API 统一转换为标准的 OpenAI 兼容接口。
            支持多账号池管理、智能轮询、自动故障转移和健康检查机制。
          </p>
        </div>
        
        <div class="prose max-w-none">
          <h3 class="text-lg font-semibold text-slate-700 mb-4">快速开始</h3>
          <ol class="list-decimal list-inside space-y-2 text-slate-600">
            <li>在 <a href="#/providers" class="text-emerald-600 hover:underline">提供商池管理</a> 中添加您的 AI 账号</li>
            <li>配置 <a href="#/config" class="text-emerald-600 hover:underline">系统配置</a> 中的默认设置</li>
            <li>使用 API 端点调用您的 AI 模型</li>
          </ol>
        </div>
        
        <div class="prose max-w-none">
          <h3 class="text-lg font-semibold text-slate-700 mb-4">API 调用示例</h3>
          <div class="bg-slate-50 rounded-lg p-4">
            <pre class="text-sm text-slate-700 font-mono overflow-x-auto"><code>{{ curlCommand }}</code></pre>
          </div>
        </div>
        
        <div class="prose max-w-none">
          <h3 class="text-lg font-semibold text-slate-700 mb-4">支持的提供商</h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div class="p-3 bg-emerald-50 rounded-lg text-center">
              <i class="fas fa-cloud text-emerald-500 text-xl mb-2"></i>
              <p class="text-sm font-medium text-slate-700">Gemini</p>
            </div>
            <div class="p-3 bg-blue-50 rounded-lg text-center">
              <i class="fas fa-message-circle text-blue-500 text-xl mb-2"></i>
              <p class="text-sm font-medium text-slate-700">Claude</p>
            </div>
            <div class="p-3 bg-purple-50 rounded-lg text-center">
              <i class="fas fa-brain text-purple-500 text-xl mb-2"></i>
              <p class="text-sm font-medium text-slate-700">OpenAI</p>
            </div>
            <div class="p-3 bg-orange-50 rounded-lg text-center">
              <i class="fas fa-flame text-orange-500 text-xl mb-2"></i>
              <p class="text-sm font-medium text-slate-700">Grok</p>
            </div>
            <div class="p-3 bg-red-50 rounded-lg text-center">
              <i class="fas fa-robot text-red-500 text-xl mb-2"></i>
              <p class="text-sm font-medium text-slate-700">Qwen</p>
            </div>
            <div class="p-3 bg-cyan-50 rounded-lg text-center">
              <i class="fas fa-cpu text-cyan-500 text-xl mb-2"></i>
              <p class="text-sm font-medium text-slate-700">Kiro</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const BASE_URL = window.location.origin
const curlCommand = `curl -X POST ${BASE_URL}/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {
        "role": "user",
        "content": "Hello, world!"
      }
    ]
  }'`
</script>

<style scoped>
.guide-page {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
