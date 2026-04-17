<template>
  <div class="tutorial-page">
    <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
      <h2 class="text-xl font-bold text-slate-800 mb-6">配置教程</h2>
      
      <div class="space-y-6">
        <div class="border border-slate-200 rounded-xl overflow-hidden">
          <div class="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <span class="flex items-center gap-2">
              <span class="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
              <span class="font-medium text-slate-700">添加提供商账户</span>
            </span>
          </div>
          <div class="p-4">
            <ol class="list-decimal list-inside space-y-2 text-slate-600">
              <li>进入 <a href="#/providers" class="text-emerald-600 hover:underline">提供商池管理</a></li>
              <li>点击"添加提供商"按钮</li>
              <li>选择提供商类型并填写相关配置</li>
              <li>保存配置</li>
            </ol>
          </div>
        </div>
        
        <div class="border border-slate-200 rounded-xl overflow-hidden">
          <div class="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <span class="flex items-center gap-2">
              <span class="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
              <span class="font-medium text-slate-700">配置系统参数</span>
            </span>
          </div>
          <div class="p-4">
            <ol class="list-decimal list-inside space-y-2 text-slate-600">
              <li>进入 <a href="#/config" class="text-emerald-600 hover:underline">系统配置</a></li>
              <li>设置默认提供商</li>
              <li>配置 API 密钥</li>
              <li>调整健康检查参数</li>
            </ol>
          </div>
        </div>
        
        <div class="border border-slate-200 rounded-xl overflow-hidden">
          <div class="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <span class="flex items-center gap-2">
              <span class="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
              <span class="font-medium text-slate-700">测试 API 调用</span>
            </span>
          </div>
          <div class="p-4">
            <p class="text-slate-600 mb-3">使用以下命令测试 API：</p>
            <div class="bg-slate-50 rounded-lg p-3">
              <pre class="text-sm text-slate-700 font-mono"><code>{{ curlCommand }}</code></pre>
            </div>
          </div>
        </div>
        
        <div class="border border-slate-200 rounded-xl overflow-hidden">
          <div class="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <span class="flex items-center gap-2">
              <span class="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
              <span class="font-medium text-slate-700">配置自定义模型（可选）</span>
            </span>
          </div>
          <div class="p-4">
            <ol class="list-decimal list-inside space-y-2 text-slate-600">
              <li>进入 <a href="#/custom-models" class="text-emerald-600 hover:underline">自定义模型管理</a></li>
              <li>添加自定义模型映射</li>
              <li>配置模型参数</li>
              <li>保存并测试</li>
            </ol>
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
  -d '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"Hello"}]}'`
</script>

<style scoped>
.tutorial-page {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
