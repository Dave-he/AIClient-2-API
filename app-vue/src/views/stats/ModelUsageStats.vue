<template>
  <div class="model-usage-stats-container">
    <header class="navbar">
      <div class="navbar-inner">
        <div class="brand">
          <span class="brand-icon"><i class="fas fa-chart-line"></i></span>
          <div>
            <div class="brand-title">模型用量统计</div>
            <div class="brand-sub">统一查看 Provider / Model 的请求次数与 Token 累计</div>
          </div>
        </div>
        <div class="nav-actions">
          <a class="nav-btn" href="/"><i class="fas fa-arrow-left"></i><span>返回控制台</span></a>
          <button class="theme-toggle" @click="toggleTheme"><i class="fas fa-moon"></i><i class="fas fa-sun"></i></button>
        </div>
      </div>
    </header>

    <main class="main">
      <section class="hero">
        <div class="panel hero-main">
          <span class="eyebrow"><i class="fas fa-chart-pie"></i> 统计面板</span>
          <h1>模型用量统计面板</h1>
          <div class="copy">通过 <code>/api/model-usage-stats</code> 查看系统已累计的请求数、输入 Token、输出 Token 和 Provider / Model 维度分布。</div>
          <div class="meta">
            <span class="tag"><i class="fas fa-key"></i> 支持后台 Token 与 API Key</span>
            <span class="tag"><i class="fas fa-database"></i> 基于插件持久化统计</span>
            <span class="tag"><i class="fas fa-filter"></i> 支持搜索、排序、刷新与重置</span>
          </div>
        </div>
        <aside class="panel auth">
          <div class="title">
            <h2 class="section-title"><i class="fas fa-shield-halved"></i>访问凭证</h2>
            <span :class="['pill', authConnected ? '' : 'idle']">{{ authConnected ? '已连接' : '未连接' }}</span>
          </div>
          <div class="sub">与其他管理页面一致，这里不会自动读取服务端敏感配置。输入凭证后可加载统计接口，刷新后会从本地缓存恢复。</div>
          <div class="group">
            <label class="label" for="credentialValue">访问凭证</label>
            <input class="input" v-model="credentialValue" type="password" placeholder="输入 Token 或 API Key">
            <div class="help">这里直接填后台登录 Token 或服务 API Key。页面会自动同时尝试 <code>Authorization: Bearer</code> 和 <code>x-api-key</code> 两种方式。</div>
          </div>
          <div class="row">
            <button class="btn btn-primary" @click="connectAndLoad"><i class="fas fa-plug"></i><span>连接并加载</span></button>
            <button class="btn btn-secondary" @click="clearCredential"><i class="fas fa-eraser"></i><span>清空凭证</span></button>
          </div>
          <div :class="['status', statusType, { show: showStatus }]">
            <i :class="statusIcon"></i><span>{{ statusMessage }}</span>
          </div>
        </aside>
      </section>

      <section class="stats">
        <article class="card green"><div class="card-label">总请求数</div><div class="card-value">{{ totalRequests }}</div><div class="note">累计成功落库的模型调用次数</div></article>
        <article class="card blue"><div class="card-label">输入 Token</div><div class="card-value">{{ promptTokens }}</div><div class="note">输入 token 的累计值</div></article>
        <article class="card cyan"><div class="card-label">缓存 Token</div><div class="card-value">{{ cachedTokens }}</div><div class="note">缓存命中的累计值</div></article>
        <article class="card indigo"><div class="card-label">输出 Token</div><div class="card-value">{{ completionTokens }}</div><div class="note">输出 token 的累计值</div></article>
        <article class="card orange"><div class="card-label">总 Token</div><div class="card-value">{{ totalTokens }}</div><div class="note">{{ updatedAt }}</div></article>
      </section>

      <section class="split">
        <div class="panel calendar-panel">
          <div class="calendar-header">
            <h2 class="section-title"><i class="fas fa-calendar-days"></i> Token 使用趋势 (3个月)</h2>
            <div class="calendar-legend">
              <div class="level level-1"></div>
              <div class="level level-4"></div>
            </div>
          </div>
          <div class="calendar-wrapper">
            <div class="calendar-grid">
              <div
                v-for="(day, index) in calendarDays"
                :key="index"
                class="calendar-day"
                :data-level="day.level"
              ></div>
            </div>
          </div>
          <div class="calendar-footer">{{ calendarFooter }}</div>
        </div>
        <div class="panel">
          <h2 class="section-title"><i class="fas fa-sitemap"></i>Provider 分布</h2>
          <div class="bars" id="providerBars">
            <div v-for="item in providerBars" :key="item.name" class="bar">
              <div class="bar-head">
                <div class="bar-name" :title="item.name">{{ item.name }}</div>
                <div class="bar-value">{{ item.value }}</div>
              </div>
              <div class="track">
                <div class="fill" :style="{ width: item.width + '%' }" :class="{ 'other': item.isOther }"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="panel">
          <h2 class="section-title"><i class="fas fa-fire"></i>Top Models</h2>
          <div class="bars">
            <div v-for="item in topModelBars" :key="item.name" class="bar">
              <div class="bar-head">
                <div class="bar-name" :title="item.name">{{ item.name }}</div>
                <div class="bar-value">{{ item.value }}</div>
              </div>
              <div class="track">
                <div class="fill" :style="{ width: item.width + '%' }" :class="{ 'other': item.isOther }"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="tools">
          <h2 class="section-title"><i class="fas fa-layer-group"></i>Provider 视图</h2>
          <div class="row">
            <button class="btn btn-secondary" @click="loadData"><i class="fas fa-rotate-right"></i><span>刷新</span></button>
            <button class="btn btn-secondary" @click="resetTokenData"><i class="fas fa-eraser"></i><span>重置 Token</span></button>
            <button class="btn btn-danger" @click="resetData"><i class="fas fa-trash-can"></i><span>重置统计</span></button>
          </div>
        </div>
        <div class="providers">
          <div v-for="provider in providers" :key="provider.name" class="provider">
            <div class="provider-head">
              <div>
                <div class="provider-name">{{ provider.name }}</div>
                <div class="provider-sub">包含 {{ provider.count }} 个模型</div>
              </div>
              <span class="provider-badge"><i class="fas fa-bolt"></i>{{ provider.requestCount }} 次调用</span>
            </div>
            <div class="mini">
              <div class="mini-box"><div class="mini-label">总 Token</div><div class="mini-value">{{ provider.totalTokens }}</div></div>
              <div class="mini-box"><div class="mini-label">输入</div><div class="mini-value">{{ provider.promptTokens }}</div></div>
              <div class="mini-box"><div class="mini-label">缓存</div><div class="mini-value">{{ provider.cachedTokens }}</div></div>
              <div class="mini-box"><div class="mini-label">输出</div><div class="mini-value">{{ provider.completionTokens }}</div></div>
              <div class="mini-box"><div class="mini-label">最近使用</div><div class="mini-value">{{ provider.lastUsedAt }}</div></div>
            </div>
          </div>
        </div>
      </section>

      <section class="table-card">
        <div class="tools">
          <h2 class="section-title"><i class="fas fa-table"></i>模型明细</h2>
          <div class="tool-row">
            <input class="search" v-model="searchInput" type="search" placeholder="搜索 provider 或 model">
            <select class="select" v-model="sortSelect">
              <option value="totalTokens-desc">按总 Token 降序</option>
              <option value="requestCount-desc">按请求数降序</option>
              <option value="promptTokens-desc">按输入 Token 降序</option>
              <option value="completionTokens-desc">按输出 Token 降序</option>
              <option value="provider-asc">按 Provider 升序</option>
              <option value="model-asc">按 Model 升序</option>
            </select>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Model</th>
                <th>请求数</th>
                <th>Prompt</th>
                <th>Cached</th>
                <th>Completion</th>
                <th>Total</th>
                <th>最近使用</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredRows" :key="row.provider + row.model">
                <td><span class="tag"><i class="fas fa-server"></i>{{ row.provider }}</span></td>
                <td>{{ row.model }}</td>
                <td class="mono">{{ row.requestCount }}</td>
                <td class="mono">{{ row.promptTokens }}</td>
                <td class="mono">{{ row.cachedTokens }}</td>
                <td class="mono">{{ row.completionTokens }}</td>
                <td class="mono">{{ row.totalTokens }}</td>
                <td>{{ row.lastUsedAt }}</td>
              </tr>
              <tr v-if="filteredRows.length === 0">
                <td colspan="8" style="text-align:center;color:#9ca3af">没有匹配的数据</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p class="footer">如果上游响应没有提供 usage，调用次数仍会统计，但 token 数可能保持为 0。</p>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { logger } from '@/utils/logger.js'

const API_BASE = '/api/model-usage-stats'
const STORAGE_KEY = 'model_usage_stats_auth'

const credentialValue = ref('')
const searchInput = ref('')
const sortSelect = ref('totalTokens-desc')

const authConnected = ref(false)
const showStatus = ref(true)
const statusType = ref('info')
const statusMessage = ref('尚未加载统计数据。')

const totalRequests = ref('0')
const promptTokens = ref('0')
const cachedTokens = ref('0')
const completionTokens = ref('0')
const totalTokens = ref('0')
const updatedAt = ref('等待数据')

const calendarDays = ref([])
const calendarFooter = ref('')

const providerBars = ref([])
const topModelBars = ref([])
const providers = ref([])
const rows = ref([])

const formatNumber = (num) => new Intl.NumberFormat('zh-CN').format(Number(num || 0))

const formatToken = (num) => {
  const value = Number(num || 0)
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  const units = [
    { threshold: 1e9, suffix: 'G' },
    { threshold: 1e6, suffix: 'M' },
    { threshold: 1e3, suffix: 'K' }
  ]
  for (const unit of units) {
    if (abs >= unit.threshold) {
      const scaled = value / unit.threshold
      const digits = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2
      return `${scaled.toFixed(digits).replace(/\.0+$|(\.\d*[1-9])0+$/, '$1')}${unit.suffix}`
    }
  }
  return formatNumber(value)
}

const formatRelativeTime = (iso) => {
  if (!iso) return '未记录'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const m = Math.floor((Date.now() - d.getTime()) / 6e4)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const day = Math.floor(h / 24)
  return day < 30 ? `${day} 天前` : d.toLocaleString('zh-CN')
}

const statusIcon = computed(() => {
  switch (statusType.value) {
    case 'error': return 'fas fa-triangle-exclamation'
    case 'success': return 'fas fa-circle-check'
    default: return 'fas fa-circle-info'
  }
})

const filteredRows = computed(() => {
  const keyword = searchInput.value.trim().toLowerCase()
  const [field, dir] = sortSelect.value.split('-')
  let list = [...rows.value]
  
  if (keyword) {
    list = list.filter(r => 
      r.provider.toLowerCase().includes(keyword) || r.model.toLowerCase().includes(keyword)
    )
  }
  
  list.sort((a, b) => {
    if (field === 'provider' || field === 'model') {
      const l = String(a[field] || '')
      const r = String(b[field] || '')
      return dir === 'desc' ? r.localeCompare(l) : l.localeCompare(r)
    }
    const l = Number(a[field] || 0)
    const r = Number(b[field] || 0)
    return dir === 'desc' ? r - l : l - r
  })
  
  return list
})

const saveCredential = () => {
  if (credentialValue.value) {
    localStorage.setItem(STORAGE_KEY, credentialValue.value)
  }
}

const restoreCredential = () => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    credentialValue.value = saved
  }
}

const clearCredential = () => {
  localStorage.removeItem(STORAGE_KEY)
  credentialValue.value = ''
  authConnected.value = false
  statusType.value = 'info'
  statusMessage.value = '已清空本地保存的凭证。'
}

const headers = () => {
  if (!credentialValue.value) throw new Error('请先输入访问凭证。')
  return {
    Authorization: `Bearer ${credentialValue.value}`,
    'x-api-key': credentialValue.value
  }
}

const request = async (url, options = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...headers()
    }
  })
  const text = await res.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`接口返回了非 JSON 内容: ${text || '(empty)'}`)
  }
  if (!res.ok) {
    if (payload?.error?.code === 'PLUGIN_DISABLED') {
      throw new Error('插件未启用：请先在插件管理中启用 model-usage-stats。')
    }
    throw new Error(payload?.error?.message || payload?.message || `请求失败 (${res.status})`)
  }
  return payload
}

const renderSummary = (data) => {
  const s = data.summary || {}
  totalRequests.value = formatNumber(s.requestCount)
  promptTokens.value = formatToken(s.promptTokens)
  cachedTokens.value = formatToken(s.cachedTokens)
  completionTokens.value = formatToken(s.completionTokens)
  totalTokens.value = formatToken(s.totalTokens)
  updatedAt.value = data.updatedAt ? `更新于 ${new Date(data.updatedAt).toLocaleString('zh-CN')}` : '尚未写入'
}

const renderCalendar = (dailyData = {}) => {
  calendarDays.value = []
  const now = new Date()
  const startDate = new Date()
  startDate.setMonth(now.getMonth() - 3)
  startDate.setDate(startDate.getDate() - startDate.getDay())

  const values = Object.values(dailyData).map(d => d.totalTokens || 0)
  const max = Math.max(...values, 1000)
  const dayCount = Math.floor((now - startDate) / (24 * 3600 * 1000)) + 1
  let currentTotal = 0

  for (let i = 0; i < dayCount; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    if (date > now) break

    const dateKey = date.toISOString().split('T')[0]
    const data = dailyData[dateKey] || { totalTokens: 0, requestCount: 0 }
    const tokens = data.totalTokens || 0
    currentTotal += tokens

    let level = 0
    if (tokens > 0) {
      const ratio = tokens / max
      level = ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4
    }

    calendarDays.value.push({ level })
  }
  calendarFooter.value = `最近三个月累计消耗: ${formatToken(currentTotal)} Token`
}

const renderBars = (providersRaw, modelsRaw) => {
  const providers = providersRaw.slice(0, 3)
  if (providersRaw.length > 3) {
    const otherTokens = providersRaw.slice(3).reduce((sum, p) => sum + p.totalTokens, 0)
    providers.push({ name: `其它 (${providersRaw.length - 3} 个)`, totalTokens: otherTokens, isOther: true })
  }
  
  const maxProviderTokens = Math.max(...providers.map(p => p.totalTokens), 1)
  providerBars.value = providers.map(p => ({
    name: p.name,
    value: formatToken(p.totalTokens),
    width: Math.max((p.totalTokens / maxProviderTokens) * 100, 2),
    isOther: p.isOther
  }))

  const topModels = modelsRaw.slice(0, 3)
  if (modelsRaw.length > 3) {
    const otherTokens = modelsRaw.slice(3).reduce((sum, m) => sum + (Number(m.totalTokens) || 0), 0)
    topModels.push({ name: `其它 (${modelsRaw.length - 3} 个)`, totalTokens: otherTokens, isOther: true })
  }
  
  const maxModelTokens = Math.max(...topModels.map(m => Number(m.totalTokens) || 0), 1)
  topModelBars.value = topModels.map(m => ({
    name: m.isOther ? m.name : `${m.provider} / ${m.model}`,
    value: formatToken(m.totalTokens),
    width: Math.max((Number(m.totalTokens) / maxModelTokens) * 100, 2),
    isOther: m.isOther
  }))
}

const renderProviders = (data) => {
  providers.value = Object.entries(data.providers || {}).map(([name, p]) => {
    const s = p.summary || {}
    return {
      name,
      count: formatNumber(Object.keys(p.models || {}).length),
      requestCount: formatNumber(s.requestCount),
      totalTokens: formatToken(s.totalTokens),
      promptTokens: formatToken(s.promptTokens),
      cachedTokens: formatToken(s.cachedTokens),
      completionTokens: formatToken(s.completionTokens),
      lastUsedAt: formatRelativeTime(s.lastUsedAt)
    }
  }).sort((a, b) => {
    const aTokens = Number((a.totalTokens.match(/[\d.]+/) || [0])[0])
    const bTokens = Number((b.totalTokens.match(/[\d.]+/) || [0])[0])
    return bTokens - aTokens
  })
}

const flatten = (data) => {
  const list = []
  for (const [provider, pd] of Object.entries(data.providers || {})) {
    for (const [model, md] of Object.entries(pd.models || {})) {
      list.push({
        provider,
        model,
        ...md
      })
    }
  }
  return list
}

const renderTable = (data) => {
  rows.value = flatten(data).map(row => ({
    ...row,
    requestCount: formatNumber(row.requestCount),
    promptTokens: formatToken(row.promptTokens),
    cachedTokens: formatToken(row.cachedTokens),
    completionTokens: formatToken(row.completionTokens),
    totalTokens: formatToken(row.totalTokens),
    lastUsedAt: formatRelativeTime(row.lastUsedAt)
  }))
}

const render = (data) => {
  renderSummary(data)
  renderCalendar(data.daily || {})
  
  const providersRaw = Object.entries(data.providers || {}).map(([name, p]) => ({
    name,
    totalTokens: Number(p.summary?.totalTokens || 0)
  })).sort((a, b) => b.totalTokens - a.totalTokens)
  
  const modelsRaw = flatten(data).sort((a, b) => Number(b.totalTokens || 0) - Number(a.totalTokens || 0))
  
  renderBars(providersRaw, modelsRaw)
  renderProviders(data)
  renderTable(data)
}

const connectAndLoad = async () => {
  try {
    saveCredential()
    statusType.value = 'info'
    statusMessage.value = '正在加载统计数据...'
    showStatus.value = true
    
    const payload = await request(API_BASE)
    render(payload.data || payload)
    authConnected.value = true
    statusType.value = 'success'
    statusMessage.value = `已加载 ${rows.value.length} 条模型统计。`
  } catch (error) {
    logger.error(error)
    authConnected.value = false
    statusType.value = 'error'
    statusMessage.value = error.message
  }
}

const resetData = async () => {
  if (!confirm('确认重置全部模型统计吗？此操作会清空已落库的累计数据。')) return
  try {
    statusType.value = 'info'
    statusMessage.value = '正在重置统计数据...'
    const payload = await request(`${API_BASE}/reset`, { method: 'POST' })
    render(payload.data || payload)
    statusType.value = 'success'
    statusMessage.value = '统计数据已重置。'
  } catch (error) {
    logger.error(error)
    statusType.value = 'error'
    statusMessage.value = error.message
  }
}

const resetTokenData = async () => {
  if (!confirm('确认重置模型 Token 统计吗？这会清空输入 / 输出 / 缓存 / 总 Token，但保留请求次数与最近使用时间。')) return
  try {
    statusType.value = 'info'
    statusMessage.value = '正在重置 Token 统计...'
    const payload = await request(`${API_BASE}/reset-tokens`, { method: 'POST' })
    render(payload.data || payload)
    statusType.value = 'success'
    statusMessage.value = '模型 Token 统计已重置。'
  } catch (error) {
    logger.error(error)
    statusType.value = 'error'
    statusMessage.value = error.message
  }
}

const loadData = connectAndLoad
const toggleTheme = () => {}

onMounted(() => {
  restoreCredential()
  if (credentialValue.value.trim()) {
    connectAndLoad()
  }
})
</script>

<style scoped>
.model-usage-stats-container {
  min-height: 100vh;
  background: #f3f4f6;
}

.navbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.navbar-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.brand-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #10b981, #34d399);
  color: white;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.brand-title {
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
}

.brand-sub {
  font-size: 12px;
  color: #6b7280;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nav-btn,
.theme-toggle,
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: white;
  color: #1f2937;
  text-decoration: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

.theme-toggle {
  width: 40px;
  padding: 0;
  color: #6b7280;
}

.nav-btn:hover,
.theme-toggle:hover,
.btn:hover {
  border-color: #10b981;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
  transform: translateY(-1px);
}

.main {
  max-width: 1400px;
  margin: 0 auto;
  padding: 30px 24px 48px;
}

.hero,
.split,
.stats {
  display: grid;
  gap: 24px;
}

.hero {
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  margin-bottom: 24px;
}

.split {
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  margin-bottom: 24px;
}

.stats {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-bottom: 24px;
}

.panel,
.card,
.provider,
.table-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.hero-main,
.auth,
.panel,
.table-card {
  padding: 24px;
}

.hero-main {
  background: linear-gradient(135deg, #10b981, #34d399);
  color: white;
  position: relative;
  overflow: hidden;
}

.hero-main h1,
.hero-main .eyebrow,
.hero-main .copy,
.hero-main .tag {
  color: white;
}

.hero-main .eyebrow,
.hero-main .tag {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.2);
}

.hero-main::after {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 60%;
  height: 150%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  transform: rotate(-20deg);
}

.eyebrow,
.pill,
.tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.eyebrow {
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  color: #6b7280;
}

.pill {
  background: #dcfce7;
  border: 1px solid #bbf7d0;
  color: #166534;
}

.pill.idle {
  background: #f3f4f6;
  border-color: #e5e7eb;
  color: #6b7280;
}

h1 {
  margin: 14px 0 12px;
  font-size: 30px;
  line-height: 1.2;
  color: #1f2937;
}

.copy,
.sub,
.help,
.footer,
.note {
  color: #6b7280;
  font-size: 14px;
  line-height: 1.7;
}

.meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.meta .tag {
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  color: #6b7280;
}

.title,
.tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.title {
  margin-bottom: 12px;
}

.section-title {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 10px;
}

.label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
}

.input,
.select,
.search {
  width: 100%;
  min-height: 42px;
  padding: 0 14px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  color: #1f2937;
  font-size: 14px;
  transition: all 0.2s;
}

.input:focus,
.select:focus,
.search:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
}

.group {
  margin-bottom: 16px;
}

.row,
.tool-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.status {
  display: none;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 8px;
  margin-top: 16px;
  font-size: 13px;
  border: 1px solid transparent;
}

.status.show {
  display: flex;
}

.status.info {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.status.success {
  background: #dcfce7;
  border-color: #bbf7d0;
  color: #166534;
}

.status.error {
  background: #fef2f2;
  border-color: #fecaca;
  color: #dc2626;
}

.card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: all 0.2s;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.1);
}

.card-label {
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 8px;
}

.card-value {
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
  font-family: 'JetBrains Mono', monospace;
}

.card.green { border-top: 4px solid #10b981; }
.card.blue { border-top: 4px solid #3b82f6; }
.card.cyan { border-top: 4px solid #06b6d4; }
.card.indigo { border-top: 4px solid #6366f1; }
.card.orange { border-top: 4px solid #f59e0b; }

.bars {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bar-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.bar-name {
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 70%;
}

.bar-value {
  color: #6b7280;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
}

.track {
  height: 8px;
  background: #f3f4f6;
  border-radius: 4px;
  overflow: hidden;
}

.fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  border-radius: 4px;
  transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.fill.other {
  background: #94a3b8;
}

.calendar-panel {
  padding: 16px;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.calendar-legend {
  display: flex;
  align-items: center;
  gap: 3px;
}

.calendar-legend .level {
  width: 9px;
  height: 9px;
  border-radius: 1px;
}

.calendar-wrapper {
  overflow-x: auto;
  padding: 5px 0;
  display: flex;
  justify-content: flex-start;
}

.calendar-grid {
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(7, 11px);
  gap: 3px;
}

.calendar-day {
  width: 11px;
  height: 11px;
  border-radius: 2px;
  background: #e5e7eb;
}

.calendar-day[data-level="1"] { background: #9be9a8; }
.calendar-day[data-level="2"] { background: #40c463; }
.calendar-day[data-level="3"] { background: #30a14e; }
.calendar-day[data-level="4"] { background: #216e39; }

.calendar-footer {
  margin-top: 8px;
  font-size: 11px;
  color: #9ca3af;
}

.providers {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  padding: 20px 0;
}

.provider {
  padding: 20px;
  transition: all 0.2s;
}

.provider:hover {
  border-color: #10b981;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
}

.provider-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.provider-name {
  font-size: 16px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 4px;
}

.provider-sub {
  font-size: 12px;
  color: #9ca3af;
}

.provider-badge {
  padding: 4px 8px;
  background: #f3f4f6;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 6px;
}

.mini {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.mini-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mini-label {
  font-size: 10px;
  font-weight: 700;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.mini-value {
  font-size: 13px;
  font-weight: 700;
  color: #1f2937;
  font-family: 'JetBrains Mono', monospace;
}

.table-card {
  overflow: hidden;
}

.table-card .tools {
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th {
  text-align: left;
  padding: 14px 20px;
  background: white;
  color: #9ca3af;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #e5e7eb;
}

td {
  padding: 14px 20px;
  border-bottom: 1px solid #e5e7eb;
  color: #1f2937;
}

tr:last-child td {
  border-bottom: none;
}

tr:hover td {
  background: #f9fafb;
}

.mono {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  font-size: 13px;
}

.btn-primary {
  background: linear-gradient(135deg, #10b981, #34d399);
  color: white;
  border-color: transparent;
}

.btn-secondary {
  background: #f3f4f6;
  color: #4b5563;
}

.btn-danger {
  background: #fef2f2;
  color: #dc2626;
  border-color: #fecaca;
}

.footer {
  text-align: center;
  margin-top: 32px;
  padding-bottom: 24px;
}
</style>