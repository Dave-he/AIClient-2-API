<template>
  <div class="potluck-user-container">
    <nav class="navbar">
      <div class="navbar-inner">
        <div class="navbar-brand">
          <span class="icon">🍲</span>
          <span>API 大锅饭</span>
          <span class="badge">用户版</span>
        </div>
        <div class="navbar-user" v-if="isLoggedIn">
          <span class="welcome">欢迎，<strong>{{ userName }}</strong></span>
          <button class="theme-toggle" @click="toggleTheme">
            <i class="fas fa-sun"></i>
            <i class="fas fa-moon"></i>
          </button>
          <button class="btn btn-secondary btn-sm" @click="logout">
            <i class="fas fa-sign-out-alt"></i> 退出
          </button>
        </div>
        <button v-else class="theme-toggle" @click="toggleTheme">
          <i class="fas fa-sun"></i>
          <i class="fas fa-moon"></i>
        </button>
      </div>
    </nav>

    <div class="login-container" v-if="!isLoggedIn">
      <div class="login-box">
        <h2><i class="fas fa-key"></i> 登录</h2>
        <p class="subtitle">使用您的 API Key 登录查看用量</p>
        <div class="form-group">
          <label>API Key</label>
          <input type="text" v-model="apiKeyInput" class="form-input" placeholder="maki_xxxxxxxx..." autocomplete="off">
        </div>
        <div class="form-group">
          <label class="form-checkbox">
            <input type="checkbox" v-model="rememberKey" checked>
            <span>记住我的 Key</span>
          </label>
        </div>
        <button class="btn btn-primary btn-block" @click="login">
          <i class="fas fa-sign-in-alt"></i> 登录
        </button>
      </div>
    </div>

    <div class="main-container" v-else>
      <h3 class="section-title"><i class="fas fa-chart-bar"></i> 个人使用统计</h3>

      <div class="stats-grid">
        <div class="stat-card orange">
          <div class="label">最后使用</div>
          <div class="value">{{ statLastUsed }}</div>
        </div>
        <div class="stat-card purple">
          <div class="label">每日用量</div>
          <div class="value">
            <span>{{ statToday }}</span>
            <span class="dim"> / <span>{{ statLimit }}</span></span>
          </div>
        </div>
        <div class="stat-card green">
          <div class="label">剩余额度</div>
          <div class="value">{{ statRemaining }}</div>
        </div>
        <div class="stat-card cyan">
          <div class="label">累计调用</div>
          <div class="value">{{ statTotal }}</div>
        </div>
        <div class="stat-card green">
          <div class="label">今日 Tokens</div>
          <div class="value">{{ statTodayTokens }}</div>
        </div>
        <div class="stat-card cyan">
          <div class="label">今日缓存 Tokens</div>
          <div class="value">{{ statTodayCachedTokens }}</div>
        </div>
        <div class="stat-card purple">
          <div class="label">累计 Tokens</div>
          <div class="value">{{ statTotalTokens }}</div>
        </div>
        <div class="stat-card cyan">
          <div class="label">累计缓存 Tokens</div>
          <div class="value">{{ statTotalCachedTokens }}</div>
        </div>
      </div>

      <div v-if="showUsageStats" class="usage-stats-section">
        <h3 class="section-title"><i class="fas fa-chart-pie"></i> 我的使用趋势与分布 (最近 3 个月)</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="label">我的 Token 消耗趋势</div>
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
          <div class="stat-card">
            <div class="label">常用提供商</div>
            <div class="distribution-list">
              <div v-for="item in providerDistribution" :key="item.name" class="distribution-item">
                <div class="dist-info">
                  <span class="dist-name">{{ item.name }}</span>
                  <span class="dist-count">{{ item.count }} 次 ({{ item.percent }}%)</span>
                </div>
                <div class="dist-bar">
                  <div class="dist-fill" :style="{ width: item.percent + '%' }"></div>
                </div>
              </div>
            </div>
          </div>
          <div class="stat-card">
            <div class="label">常用模型</div>
            <div class="distribution-list">
              <div v-for="item in modelDistribution" :key="item.name" class="distribution-item">
                <div class="dist-info">
                  <span class="dist-name">{{ item.name }}</span>
                  <span class="dist-count">{{ item.count }} 次 ({{ item.percent }}%)</span>
                </div>
                <div class="dist-bar">
                  <div class="dist-fill" :style="{ width: item.percent + '%' }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <h3 class="section-title"><i class="fas fa-key"></i> API 密钥</h3>

      <div class="apikey-display">
        <input type="text" :value="currentApiKey" readonly>
        <button class="btn btn-primary btn-block" @click="copyApiKey">
          <i :class="copyIconClass"></i> <span>{{ copyButtonText }}</span>
        </button>
      </div>

      <div class="info-box">
        <p>
          <i class="fas fa-info-circle"></i>
          API Key 用于访问 API 服务。请妥善保管，不要泄露给他人。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const API_BASE = '/api/potluckuser'

const apiKeyInput = ref('')
const rememberKey = ref(true)
const isLoggedIn = ref(false)
const currentApiKey = ref('')
const userName = ref('')

const statLastUsed = ref('从未')
const statToday = ref(0)
const statLimit = ref(0)
const statRemaining = ref(0)
const statTotal = ref(0)
const statTodayTokens = ref('0')
const statTodayCachedTokens = ref('0')
const statTotalTokens = ref('0')
const statTotalCachedTokens = ref('0')

const showUsageStats = ref(false)
const calendarDays = ref([])
const calendarFooter = ref('')
const providerDistribution = ref([])
const modelDistribution = ref([])

const copyIconClass = ref('fas fa-copy')
const copyButtonText = ref('复制 Key')

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

const login = async () => {
  const apiKey = apiKeyInput.value.trim()
  if (!apiKey) {
    window.$toast?.error('请输入 API Key')
    return
  }
  if (!apiKey.startsWith('maki_')) {
    window.$toast?.error('API Key 格式不正确')
    return
  }

  currentApiKey.value = apiKey

  try {
    const response = await fetch(`${API_BASE}/usage`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })
    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error?.message || '登录失败')
    }

    if (rememberKey.value) {
      localStorage.setItem('potluck_user_key', apiKey)
    }

    isLoggedIn.value = true
    displayUserInfo(data.data)
  } catch (error) {
    window.$toast?.error(error.message)
  }
}

const logout = () => {
  currentApiKey.value = ''
  isLoggedIn.value = false
  localStorage.removeItem('potluck_user_key')
  apiKeyInput.value = ''
}

const displayUserInfo = (data) => {
  userName.value = data.name || '用户'

  statToday.value = data.usage.today
  statLimit.value = data.usage.limit
  statRemaining.value = data.usage.remaining
  statTotal.value = data.total || 0

  statTodayTokens.value = formatToken(data.usage?.totalTokens || 0)
  statTodayCachedTokens.value = formatToken(data.usage?.cachedTokens || 0)
  statTotalTokens.value = formatToken(data.tokens?.total || 0)
  statTotalCachedTokens.value = formatToken(data.tokens?.cached || 0)

  if (data.lastUsedAt) {
    const date = new Date(data.lastUsedAt)
    statLastUsed.value = date.toLocaleString('zh-CN')
  } else {
    statLastUsed.value = '从未'
  }

  renderUsageHistory(data.usageHistory)
  renderCalendar(data.usageHistory || {})
}

const renderCalendar = (usageHistory = {}) => {
  calendarDays.value = []
  const now = new Date()
  const startDate = new Date()
  startDate.setMonth(now.getMonth() - 3)
  startDate.setDate(startDate.getDate() - startDate.getDay())

  const dailyData = {}
  Object.entries(usageHistory).forEach(([date, data]) => {
    dailyData[date] = {
      totalTokens: data.summary?.totalTokens || 0,
      requestCount: data.summary?.requestCount || 0
    }
  })

  const values = Object.values(dailyData).map(d => d.totalTokens)
  const max = Math.max(...values, 1000)
  const dayCount = Math.floor((now - startDate) / (24 * 3600 * 1000)) + 1
  let currentTotal = 0

  for (let i = 0; i < dayCount; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    if (date > now) break

    const dateKey = date.toISOString().split('T')[0]
    const entry = dailyData[dateKey] || { totalTokens: 0, requestCount: 0 }
    const tokens = entry.totalTokens
    currentTotal += tokens

    let level = 0
    if (tokens > 0) {
      const ratio = tokens / max
      level = ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4
    }

    calendarDays.value.push({
      date: dateKey,
      level,
      tokens,
      requests: entry.requestCount
    })
  }
  calendarFooter.value = `最近三个月累计消耗: ${formatToken(currentTotal)} Tokens`
}

const renderUsageHistory = (usageHistory) => {
  if (!usageHistory || Object.keys(usageHistory).length === 0) {
    showUsageStats.value = false
    return
  }

  showUsageStats.value = true

  const aggregatedProviders = {}
  const aggregatedModels = {}
  let totalCalls = 0

  Object.values(usageHistory).forEach(day => {
    if (day.providers) {
      Object.entries(day.providers).forEach(([p, usage]) => {
        const count = typeof usage === 'number' ? usage : (usage.requestCount || 0)
        aggregatedProviders[p] = (aggregatedProviders[p] || 0) + count
        totalCalls += count
      })
    }
    if (day.models) {
      Object.entries(day.models).forEach(([m, usage]) => {
        const count = typeof usage === 'number' ? usage : (usage.requestCount || 0)
        aggregatedModels[m] = (aggregatedModels[m] || 0) + count
      })
    }
  })

  if (totalCalls === 0) {
    showUsageStats.value = false
    return
  }

  providerDistribution.value = Object.entries(aggregatedProviders)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({
      name,
      count: formatNumber(count),
      percent: Math.round((count / totalCalls) * 100)
    }))

  modelDistribution.value = Object.entries(aggregatedModels)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({
      name,
      count: formatNumber(count),
      percent: Math.round((count / totalCalls) * 100)
    }))
}

const copyApiKey = async () => {
  await navigator.clipboard.writeText(currentApiKey.value)
  copyIconClass.value = 'fas fa-check'
  copyButtonText.value = '已复制'
  setTimeout(() => {
    copyIconClass.value = 'fas fa-copy'
    copyButtonText.value = '复制 Key'
  }, 2000)
}

const toggleTheme = () => {}

onMounted(() => {
  const savedKey = localStorage.getItem('potluck_user_key')
  if (savedKey) {
    apiKeyInput.value = savedKey
    login()
  }
})
</script>

<style scoped>
.potluck-user-container {
  min-height: 100vh;
  background: #f3f4f6;
}

.navbar {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.navbar-inner {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
}

.navbar-brand .icon { font-size: 28px; }

.navbar-brand .badge {
  background: linear-gradient(135deg, #10b981, #34d399);
  color: white;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
}

.navbar-user {
  display: flex;
  align-items: center;
  gap: 12px;
}

.navbar-user .welcome {
  color: #6b7280;
  font-size: 14px;
}

.navbar-user .welcome strong { color: #1f2937; }

.theme-toggle {
  width: 40px;
  height: 40px;
  padding: 0;
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #d1d5db;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.125rem;
  transition: all 0.2s;
}

.theme-toggle:hover {
  background: #e5e7eb;
  border-color: #10b981;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #10b981, #34d399);
  color: white;
}

.btn-secondary {
  background: #f3f4f6;
  color: #4b5563;
  border: 1px solid #d1d5db;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-block {
  width: 100%;
  justify-content: center;
}

.main-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 30px 24px;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 1.5rem;
  text-align: center;
  position: relative;
  overflow: hidden;
  transition: all 0.2s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
}

.stat-card.purple::before { background: linear-gradient(90deg, #6366f1, #8b5cf6); }
.stat-card.green::before { background: linear-gradient(90deg, #10b981, #34d399); }
.stat-card.cyan::before { background: linear-gradient(90deg, #06b6d4, #22d3ee); }
.stat-card.orange::before { background: linear-gradient(90deg, #f59e0b, #fbbf24); }

.stat-card .label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 10px;
}

.stat-card .value {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
}

.stat-card .value .dim {
  font-size: 1.25rem;
  color: #6b7280;
  font-weight: 400;
}

.stat-card.purple .value > span:first-child { color: #6366f1; }
.stat-card.green .value > span:first-child { color: #10b981; }
.stat-card.cyan .value { color: #06b6d4; }
.stat-card.orange .value { color: #f59e0b; font-size: 1.25rem; }

.login-container {
  min-height: calc(100vh - 64px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.login-box {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.1);
}

.login-box h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  text-align: center;
  margin-bottom: 8px;
}

.login-box .subtitle {
  text-align: center;
  color: #6b7280;
  font-size: 14px;
  margin-bottom: 30px;
}

.form-group { margin-bottom: 20px; }

.form-group label {
  display: block;
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 12px 16px;
  color: #1f2937;
  font-size: 14px;
  font-family: 'JetBrains Mono', monospace;
}

.form-input:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
}

.form-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
}

.form-checkbox input {
  width: 16px;
  height: 16px;
  accent-color: #10b981;
}

.apikey-display {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.apikey-display input {
  width: 100%;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 14px 16px;
  color: #059669;
  font-size: 14px;
  font-family: 'JetBrains Mono', monospace;
  text-align: center;
  margin-bottom: 16px;
}

.info-box {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 14px 16px;
}

.info-box p {
  font-size: 13px;
  color: #1d4ed8;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.usage-stats-section {
  margin-bottom: 2.5rem;
}

.calendar-wrapper {
  overflow-x: auto;
  padding: 10px 0;
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
  font-size: 11px;
  color: #9ca3af;
  margin-top: 8px;
}

.distribution-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.distribution-item {
  width: 100%;
}

.dist-info {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 4px;
}

.dist-name {
  color: #1f2937;
  font-weight: 500;
}

.dist-count {
  color: #6b7280;
}

.dist-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
}

.dist-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  border-radius: 999px;
}
</style>