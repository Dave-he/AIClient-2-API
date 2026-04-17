<template>
  <div class="test-api-container">
    <div class="header">
      <h1>🔌 API 测试页面</h1>
      <p>AIClient2API - 端到端测试控制台</p>
    </div>

    <div class="quick-start">
      <h3>🚀 快速开始</h3>
      <p>使用以下命令测试 API 连接：</p>
      <code>curl http://localhost:3000/health?key=123456</code>
    </div>

    <div class="test-card">
      <h2>
        <span class="icon health">🏥</span>
        健康检查
        <span :class="['status-badge', healthStatus]">{{ healthStatusText }}</span>
      </h2>
      <button class="btn btn-primary" @click="checkHealth">检查服务器状态</button>
      <div :class="['result', healthResultClass]">{{ healthResult }}</div>
    </div>

    <div class="test-card">
      <h2><span class="icon auth">🔐</span> 认证测试</h2>
      <div class="form-group">
        <label for="apiKey">API Key</label>
        <input type="text" v-model="apiKey" placeholder="输入 API Key">
      </div>
      <div class="form-group">
        <label for="authMethod">认证方式</label>
        <select v-model="authMethod">
          <option value="bearer">Bearer Token</option>
          <option value="query">Query Parameter</option>
          <option value="goog">x-goog-api-key</option>
          <option value="anthropic">x-api-key (Claude)</option>
        </select>
      </div>
      <button class="btn btn-primary" @click="testAuth">测试认证</button>
      <div :class="['result', authResultClass]">{{ authResult }}</div>
    </div>

    <div class="test-card">
      <h2><span class="icon models">📦</span> 模型列表</h2>
      <button class="btn btn-primary" @click="getModels">获取模型列表</button>
      <div :class="['result', modelsResultClass]">{{ modelsResult }}</div>
    </div>

    <div class="test-card">
      <h2><span class="icon chat">💬</span> 聊天测试</h2>
      <div class="form-group">
        <label for="modelName">模型名称</label>
        <input type="text" v-model="modelName" placeholder="输入模型名称">
      </div>
      <div class="form-group">
        <label for="messageContent">消息内容</label>
        <textarea v-model="messageContent" placeholder="输入测试消息..."></textarea>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" v-model="streamMode"> 流式响应
        </label>
      </div>
      <button class="btn btn-primary" @click="testChat">发送请求</button>
      <div :class="['result', chatResultClass]">{{ chatResult }}</div>
    </div>

    <div class="test-card">
      <h2><span class="icon health">✅</span> 自动测试套件</h2>
      <button class="btn btn-primary" @click="runAllTests">运行所有测试</button>
      <div class="test-results">
        <div v-for="(test, index) in testResults" :key="index" :class="['test-row', test.status]">
          <span class="test-name">{{ test.name }}</span>
          <span class="test-status">{{ test.statusText }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const BASE_URL = window.location.origin

const apiKey = ref('sk-2e3513944ecac08f466a2e01872ba91d')
const authMethod = ref('bearer')
const modelName = ref('gpt-4')
const messageContent = ref('你好，这是一个测试消息。')
const streamMode = ref(false)

const healthStatus = ref('offline')
const healthStatusText = ref('离线')
const healthResult = ref('')
const healthResultClass = ref('')

const authResult = ref('')
const authResultClass = ref('')

const modelsResult = ref('')
const modelsResultClass = ref('')

const chatResult = ref('')
const chatResultClass = ref('')

const testResults = ref([])

const formatJson = (data) => JSON.stringify(data, null, 2)

const checkHealth = async () => {
  healthResultClass.value = 'loading'
  healthResult.value = '正在检查...'
  healthStatus.value = 'offline'
  healthStatusText.value = '检查中'

  try {
    const response = await fetch(`${BASE_URL}/health`)
    const data = await response.json()

    if (response.ok) {
      healthResultClass.value = 'success'
      healthStatus.value = 'online'
      healthStatusText.value = '在线'
    } else {
      healthResultClass.value = 'error'
      healthStatusText.value = '异常'
    }
    healthResult.value = formatJson(data)
  } catch (error) {
    healthResultClass.value = 'error'
    healthStatusText.value = '离线'
    healthResult.value = `连接失败: ${error.message}`
  }
}

const testAuth = async () => {
  authResultClass.value = 'loading'
  authResult.value = '正在测试...'

  try {
    let url = `${BASE_URL}/health`
    const headers = {}

    switch (authMethod.value) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${apiKey.value}`
        break
      case 'query':
        url += `?key=${apiKey.value}`
        break
      case 'goog':
        headers['x-goog-api-key'] = apiKey.value
        break
      case 'anthropic':
        headers['x-api-key'] = apiKey.value
        break
    }

    const response = await fetch(url, { headers })
    const data = await response.json()

    if (response.ok) {
      authResultClass.value = 'success'
      authResult.value = `✅ 认证成功!\n\n${formatJson(data)}`
    } else {
      authResultClass.value = 'error'
      authResult.value = `❌ 认证失败 (${response.status}):\n\n${formatJson(data)}`
    }
  } catch (error) {
    authResultClass.value = 'error'
    authResult.value = `❌ 请求失败: ${error.message}`
  }
}

const getModels = async () => {
  const key = apiKey.value || '123456'
  modelsResultClass.value = 'loading'
  modelsResult.value = '正在获取模型列表...'

  try {
    const response = await fetch(`${BASE_URL}/v1/models?key=${key}`)
    const data = await response.json()

    if (response.ok) {
      modelsResultClass.value = 'success'
      modelsResult.value = formatJson(data)
    } else {
      modelsResultClass.value = 'error'
      modelsResult.value = `获取失败 (${response.status}):\n\n${formatJson(data)}`
    }
  } catch (error) {
    modelsResultClass.value = 'error'
    modelsResult.value = `请求失败: ${error.message}`
  }
}

const testChat = async () => {
  const key = apiKey.value || '123456'
  chatResultClass.value = 'loading'
  chatResult.value = '正在发送请求...'

  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions?key=${key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName.value,
        messages: [{ role: 'user', content: messageContent.value }],
        stream: streamMode.value
      })
    })

    if (streamMode.value) {
      chatResultClass.value = 'success'
      chatResult.value = ''

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chatResult.value += decoder.decode(value)
      }
    } else {
      const data = await response.json()

      if (response.ok) {
        chatResultClass.value = 'success'
        chatResult.value = formatJson(data)
      } else {
        chatResultClass.value = 'error'
        chatResult.value = `请求失败 (${response.status}):\n\n${formatJson(data)}`
      }
    }
  } catch (error) {
    chatResultClass.value = 'error'
    chatResult.value = `请求失败: ${error.message}`
  }
}

const runAllTests = async () => {
  testResults.value = []

  const tests = [
    { name: '健康检查', fn: testHealthCheck },
    { name: 'Bearer 认证', fn: testBearerAuth },
    { name: 'Query 参数认证', fn: testQueryAuth },
    { name: 'x-goog-api-key 认证', fn: testGoogAuth },
    { name: 'x-api-key 认证', fn: testAnthropicAuth },
    { name: '错误处理 - 无认证', fn: testNoAuth },
    { name: 'CORS 支持', fn: testCORS }
  ]

  for (const test of tests) {
    testResults.value.push({ name: test.name, status: 'loading', statusText: '运行中...' })

    try {
      const success = await test.fn()
      const index = testResults.value.findIndex(t => t.name === test.name)
      if (index !== -1) {
        testResults.value[index] = {
          name: test.name,
          status: success ? 'success' : 'error',
          statusText: success ? '✓ 通过' : '✗ 失败'
        }
      }
    } catch {
      const index = testResults.value.findIndex(t => t.name === test.name)
      if (index !== -1) {
        testResults.value[index] = {
          name: test.name,
          status: 'error',
          statusText: '✗ 失败'
        }
      }
    }
  }
}

const testHealthCheck = async () => {
  const response = await fetch(`${BASE_URL}/health`)
  return response.ok
}

const testBearerAuth = async () => {
  const response = await fetch(`${BASE_URL}/health`, {
    headers: { 'Authorization': 'Bearer 123456' }
  })
  return response.ok
}

const testQueryAuth = async () => {
  const response = await fetch(`${BASE_URL}/health?key=123456`)
  return response.ok
}

const testGoogAuth = async () => {
  const response = await fetch(`${BASE_URL}/health`, {
    headers: { 'x-goog-api-key': '123456' }
  })
  return response.ok
}

const testAnthropicAuth = async () => {
  const response = await fetch(`${BASE_URL}/health`, {
    headers: { 'x-api-key': '123456' }
  })
  return response.ok
}

const testNoAuth = async () => {
  const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'test', messages: [] })
  })
  return response.status === 401
}

const testCORS = async () => {
  const response = await fetch(`${BASE_URL}/v1/models`, {
    method: 'OPTIONS',
    headers: {
      'Origin': BASE_URL,
      'Access-Control-Request-Method': 'POST'
    }
  })
  return [200, 204].includes(response.status)
}

checkHealth()
</script>

<style scoped>
.test-api-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  text-align: center;
  color: white;
  margin-bottom: 30px;
}

.header h1 {
  font-size: 2.5rem;
  margin-bottom: 10px;
  text-shadow: 0 2px 10px rgba(0,0,0,0.2);
}

.header p {
  opacity: 0.9;
  font-size: 1.1rem;
}

.test-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.1);
}

.test-card h2 {
  color: #333;
  margin-bottom: 20px;
  font-size: 1.3rem;
  display: flex;
  align-items: center;
  gap: 10px;
}

.test-card h2 .icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
}

.icon.health { background: #10b981; }
.icon.auth { background: #3b82f6; }
.icon.models { background: #8b5cf6; }
.icon.chat { background: #f59e0b; }

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: #555;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
}

.form-group textarea {
  min-height: 120px;
  resize: vertical;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
}

.result {
  margin-top: 20px;
  padding: 16px;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
}

.result.success {
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #10b981;
}

.result.error {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #ef4444;
}

.result.loading {
  background: #f3f4f6;
  color: #6b7280;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  margin-left: 10px;
}

.status-badge.online {
  background: #dcfce7;
  color: #166534;
}

.status-badge.offline {
  background: #fee2e2;
  color: #991b1b;
}

.test-results {
  margin-top: 20px;
}

.test-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 8px;
}

.test-row.success { border-left: 4px solid #10b981; }
.test-row.error { border-left: 4px solid #ef4444; }
.test-row .test-name { font-weight: 500; }
.test-row .test-status {
  font-size: 0.85rem;
  padding: 4px 10px;
  border-radius: 12px;
}

.test-row.success .test-status {
  background: #dcfce7;
  color: #166534;
}

.test-row.error .test-status {
  background: #fee2e2;
  color: #991b1b;
}

.quick-start {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.quick-start h3 {
  color: #92400e;
  margin-bottom: 10px;
}

.quick-start code {
  display: block;
  background: rgba(0,0,0,0.1);
  padding: 12px;
  border-radius: 6px;
  font-size: 0.9rem;
  overflow-x: auto;
}
</style>