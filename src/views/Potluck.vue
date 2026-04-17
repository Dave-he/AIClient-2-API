<template>
  <div class="potluck-container">
    <nav class="navbar">
      <div class="navbar-inner">
        <div class="navbar-brand">
          <span class="icon">🍲</span>
          <span>API 大锅饭</span>
          <span class="badge">管理端</span>
        </div>
        <div class="navbar-actions">
          <button class="theme-toggle" @click="toggleTheme">
            <i class="fas fa-sun"></i>
            <i class="fas fa-moon"></i>
          </button>
          <button class="btn btn-primary" @click="openCreateModal">
            <i class="fas fa-plus"></i> <span class="btn-text">生成新 Key</span>
          </button>
        </div>
      </div>
    </nav>

    <div class="main-container">
      <div class="stats-grid">
        <div class="stat-card purple">
          <div class="label">总 Key 数</div>
          <div class="value">{{ stats.totalKeys }}</div>
        </div>
        <div class="stat-card green">
          <div class="label">已启用</div>
          <div class="value">{{ stats.enabledKeys }}</div>
        </div>
        <div class="stat-card pink">
          <div class="label">今日总调用</div>
          <div class="value">{{ stats.todayUsage }}</div>
        </div>
        <div class="stat-card cyan">
          <div class="label">累计调用</div>
          <div class="value">{{ stats.totalUsage }}</div>
        </div>
        <div class="stat-card green">
          <div class="label">今日 Tokens</div>
          <div class="value">{{ formatToken(stats.todayTokens) }}</div>
        </div>
        <div class="stat-card cyan">
          <div class="label">今日缓存 Tokens</div>
          <div class="value">{{ formatToken(stats.todayCachedTokens) }}</div>
        </div>
        <div class="stat-card pink">
          <div class="label">累计 Tokens</div>
          <div class="value">{{ formatToken(stats.totalTokens) }}</div>
        </div>
        <div class="stat-card cyan">
          <div class="label">累计缓存 Tokens</div>
          <div class="value">{{ formatToken(stats.totalCachedTokens) }}</div>
        </div>
      </div>

      <div v-if="showUsageStats" class="usage-stats-section">
        <h3 class="section-title">
          <i class="fas fa-chart-pie"></i> 节点与 Token 使用统计 (最近 3 个月)
        </h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="label">Token 用量日历</div>
            <div class="calendar-wrapper">
              <div class="calendar-grid">
                <div
                  v-for="(day, index) in calendarDays"
                  :key="index"
                  class="calendar-day"
                  :data-level="day.level"
                  @mouseenter="showCalendarTooltip($event, day)"
                  @mouseleave="hideCalendarTooltip"
                ></div>
              </div>
            </div>
            <div class="calendar-footer">{{ calendarFooter }}</div>
          </div>
          <div class="stat-card">
            <div class="label">提供商占比</div>
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
            <div class="label">模型活跃度</div>
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

      <div class="keys-section">
        <div class="keys-header">
          <h2 class="section-title"><i class="fas fa-key"></i> Key 列表</h2>
          <div class="toolbar">
            <input type="text" v-model="searchTerm" class="search-box" placeholder="搜索名称或 Key...">
            <select v-model="sortBy" class="sort-select">
              <option value="name-asc">名称 A-Z</option>
              <option value="name-desc">名称 Z-A</option>
              <option value="usage-desc">今日用量 ↓</option>
              <option value="usage-asc">今日用量 ↑</option>
              <option value="total-desc">累计用量 ↓</option>
              <option value="lastUsed-desc">最近使用 ↓</option>
              <option value="created-desc">创建时间 ↓</option>
            </select>
            <button class="btn btn-secondary btn-sm" @click="resetAllTokenStats">
              <i class="fas fa-eraser"></i> 重置全部 Token
            </button>
            <button class="btn btn-secondary btn-sm" @click="showApplyLimitModal">
              <i class="fas fa-cog"></i> 批量应用限额
            </button>
          </div>
        </div>
        <div class="keys-list">
          <div v-if="filteredKeys.length === 0" class="empty-state">
            <div class="icon"><i class="fas fa-inbox"></i></div>
            <p>还没有任何 API Key</p>
            <button class="btn btn-primary btn-lg" @click="openCreateModal">
              <i class="fas fa-plus"></i> 生成第一个 Key
            </button>
          </div>
          <div v-for="key in filteredKeys" :key="key.id" class="key-card" :class="{ disabled: !key.enabled }">
            <div class="key-info">
              <div class="key-name">{{ key.name }}
                <button class="btn-copy" @click="openEditName(key.id, key.name)"><i class="fas fa-edit"></i></button>
              </div>
              <div class="key-id">{{ key.maskedKey }}
                <button class="btn-copy" @click="copyToClipboard(key.id)"><i class="fas fa-copy"></i></button>
              </div>
              <div v-if="key.providerDistribution?.length" class="key-dist-mini">
                <span v-for="prov in key.providerDistribution" :key="prov.name" class="dist-badge">
                  {{ prov.name }}: <b>{{ prov.count }}</b>
                </span>
              </div>
            </div>
            <div class="key-stats">
              <div class="key-stat">
                <div class="label">今日/限额</div>
                <div class="value" :class="getUsageClass(key.todayUsage, key.dailyLimit)">
                  {{ key.todayUsage }}/{{ key.dailyLimit }}
                </div>
                <div class="value muted">
                  {{ formatToken(key.todayTotalTokens) }} Tokens
                  <span v-if="key.todayCachedTokens">(含 {{ formatToken(key.todayCachedTokens) }} 缓存)</span>
                </div>
                <div class="progress-bar">
                  <div class="fill" :class="getProgressClass(key.todayUsage, key.dailyLimit)"
                    :style="{ width: Math.min((key.todayUsage / key.dailyLimit) * 100, 100) + '%' }">
                  </div>
                </div>
              </div>
              <div class="key-stat">
                <div class="label">累计</div>
                <div class="value">{{ key.totalUsage }}</div>
                <div class="value muted">
                  {{ formatToken(key.totalTokens) }} Tokens
                  <span v-if="key.totalCachedTokens">(含 {{ formatToken(key.totalCachedTokens) }} 缓存)</span>
                </div>
              </div>
              <div class="key-stat">
                <div class="label">最后调用</div>
                <div class="value muted">{{ formatTime(key.lastUsedAt) }}</div>
              </div>
              <div class="key-stat">
                <div class="label">状态</div>
                <div class="value" :style="{ color: key.enabled ? '#10b981' : '#ef4444' }">
                  {{ key.enabled ? '启用' : '禁用' }}
                </div>
              </div>
            </div>
            <div class="key-actions">
              <button class="btn btn-secondary btn-sm" @click="resetUsage(key.id)"><i class="fas fa-redo"></i> 重置</button>
              <button class="btn btn-secondary btn-sm" @click="resetTokenStats(key.id)"><i class="fas fa-eraser"></i> Token</button>
              <button class="btn btn-secondary btn-sm" @click="openEditLimit(key.id, key.dailyLimit)"><i class="fas fa-sliders-h"></i> 限额</button>
              <button class="btn btn-secondary btn-sm" @click="toggleKey(key.id)">
                <i :class="key.enabled ? 'fas fa-toggle-on' : 'fas fa-toggle-off'"></i>
                {{ key.enabled ? '禁用' : '启用' }}
              </button>
              <button class="btn btn-danger btn-sm" @click="deleteKey(key.id)"><i class="fas fa-trash"></i> 删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreateModal">
      <div class="modal">
        <div class="modal-header">
          <h3><i class="fas fa-plus-circle"></i> 生成新 API Key</h3>
          <button class="modal-close" @click="closeCreateModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Key 名称 (可选)</label>
            <input type="text" v-model="newKeyName" placeholder="例如：测试用户 1">
          </div>
          <div class="form-group">
            <label>每日调用限额</label>
            <input type="number" v-model="newKeyLimit" placeholder="500" min="1">
          </div>
          <button class="btn btn-primary btn-block" @click="createKey">
            <i class="fas fa-check"></i> 生成 Key
          </button>
        </div>
      </div>
    </div>

    <div v-if="showKeyModal" class="modal-overlay" @click.self="closeKeyModal">
      <div class="modal">
        <div class="modal-header">
          <h3><i class="fas fa-key"></i> Key 已生成</h3>
          <button class="modal-close" @click="closeKeyModal">&times;</button>
        </div>
        <div class="modal-body">
          <p>请妥善保存此 Key，关闭后将无法再次查看完整内容：</p>
          <div class="key-display">{{ currentNewKey }}</div>
          <button class="btn btn-secondary btn-block" @click="copyKey">
            <i class="fas fa-copy"></i> 复制 Key
          </button>
        </div>
      </div>
    </div>

    <div v-if="showEditLimitModal" class="modal-overlay" @click.self="closeEditLimitModal">
      <div class="modal">
        <div class="modal-header">
          <h3><i class="fas fa-sliders-h"></i> 修改每日限额</h3>
          <button class="modal-close" @click="closeEditLimitModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>新的每日限额</label>
            <input type="number" v-model="editLimitValue" min="1">
          </div>
          <button class="btn btn-primary btn-block" @click="updateLimit">
            <i class="fas fa-save"></i> 保存
          </button>
        </div>
      </div>
    </div>

    <div v-if="showEditNameModal" class="modal-overlay" @click.self="closeEditNameModal">
      <div class="modal">
        <div class="modal-header">
          <h3><i class="fas fa-edit"></i> 修改 Key 名称</h3>
          <button class="modal-close" @click="closeEditNameModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>新的名称</label>
            <input type="text" v-model="editNameValue" placeholder="例如：测试用户 1">
          </div>
          <button class="btn btn-primary btn-block" @click="updateName">
            <i class="fas fa-save"></i> 保存
          </button>
        </div>
      </div>
    </div>

    <div v-if="showApplyLimitModal" class="modal-overlay" @click.self="closeApplyLimitModal">
      <div class="modal">
        <div class="modal-header">
          <h3><i class="fas fa-cog"></i> 批量应用每日限额</h3>
          <button class="modal-close" @click="closeApplyLimitModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>每日调用限额</label>
            <input type="number" v-model="applyLimitValue" placeholder="500" min="1">
          </div>
          <div class="warning-box">
            <p><i class="fas fa-exclamation-triangle"></i> 风险提示：</p>
            <ul>
              <li>所有 Key 的每日限额将被覆盖</li>
              <li>已单独设置限额的 Key 也会被修改</li>
              <li>此操作不可撤销</li>
            </ul>
          </div>
          <button class="btn btn-primary btn-block" @click="applyDailyLimitToAll">
            <i class="fas fa-check"></i> 应用限额
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const API_BASE = '/api/potluck'

const stats = ref({
  totalKeys: 0,
  enabledKeys: 0,
  todayUsage: 0,
  totalUsage: 0,
  todayTokens: 0,
  todayCachedTokens: 0,
  totalTokens: 0,
  totalCachedTokens: 0
})

const allKeys = ref([])
const searchTerm = ref('')
const sortBy = ref('created-desc')
const showUsageStats = ref(false)
const calendarDays = ref([])
const calendarFooter = ref('')
const providerDistribution = ref([])
const modelDistribution = ref([])

const showCreateModal = ref(false)
const showKeyModal = ref(false)
const showEditLimitModal = ref(false)
const showEditNameModal = ref(false)
const showApplyLimitModal = ref(false)

const newKeyName = ref('')
const newKeyLimit = ref(500)
const currentNewKey = ref('')
const editLimitKeyId = ref('')
const editLimitValue = ref(0)
const editNameKeyId = ref('')
const editNameValue = ref('')
const applyLimitValue = ref(500)

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

const formatTime = (isoStr) => {
  if (!isoStr) return '从未'
  const d = new Date(isoStr)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前'
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getUsageClass = (usage, limit) => {
  const percent = limit > 0 ? (usage / limit) * 100 : 0
  return percent >= 90 ? 'danger' : percent >= 70 ? 'warning' : ''
}

const getProgressClass = (usage, limit) => {
  const percent = limit > 0 ? (usage / limit) * 100 : 0
  return percent >= 90 ? 'danger' : percent >= 70 ? 'warning' : ''
}

const filteredKeys = computed(() => {
  let filtered = allKeys.value
  if (searchTerm.value) {
    const term = searchTerm.value.toLowerCase().trim()
    filtered = filtered.filter(k => k.name.toLowerCase().includes(term) || k.id.toLowerCase().includes(term))
  }
  const [field, order] = sortBy.value.split('-')
  filtered.sort((a, b) => {
    let va, vb
    if (field === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase() }
    else if (field === 'usage') { va = a.todayUsage; vb = b.todayUsage }
    else if (field === 'total') { va = a.totalUsage; vb = b.totalUsage }
    else if (field === 'lastUsed') { va = a.lastUsedAt || ''; vb = b.lastUsedAt || '' }
    else if (field === 'created') { va = a.createdAt || ''; vb = b.createdAt || '' }
    if (va < vb) return order === 'asc' ? -1 : 1
    if (va > vb) return order === 'asc' ? 1 : -1
    return 0
  })
  return filtered
})

const apiRequest = async (url, options = {}) => {
  const token = localStorage.getItem('authToken')
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const response = await fetch(url, { ...options, headers })
  const data = await response.json()
  if (response.status === 401) { window.location.href = '/login'; return null }
  return data
}

const loadData = async () => {
  const result = await apiRequest(`${API_BASE}/keys`)
  if (!result || !result.success) { return }
  const { keys, stats: dataStats } = result.data
  stats.value = dataStats
  
  renderCalendar(dataStats.usageHistory)
  renderUsageHistory(dataStats.usageHistory)
  
  allKeys.value = keys.map(key => ({
    ...key,
    providerDistribution: Object.entries(key.usageHistory || {}).reduce((acc, [date, day]) => {
      if (day.providers) {
        Object.entries(day.providers).forEach(([p, usage]) => {
          const count = typeof usage === 'number' ? usage : (usage.requestCount || 0)
          const existing = acc.find(a => a.name === p)
          if (existing) existing.count += count
          else acc.push({ name: p, count })
        })
      }
      return acc
    }, []).sort((a, b) => b.count - a.count).slice(0, 3)
  }))
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
  showUsageStats.value = Object.keys(usageHistory).length > 0
}

const renderUsageHistory = (usageHistory) => {
  if (!usageHistory || Object.keys(usageHistory).length === 0) {
    showUsageStats.value = false
    return
  }

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

const openCreateModal = () => {
  newKeyName.value = ''
  newKeyLimit.value = 500
  showCreateModal.value = true
}

const closeCreateModal = () => {
  showCreateModal.value = false
}

const createKey = async () => {
  const name = newKeyName.value
  const dailyLimit = parseInt(newKeyLimit.value) || 500
  const result = await apiRequest(`${API_BASE}/keys`, {
    method: 'POST',
    body: JSON.stringify({ name, dailyLimit })
  })
  if (result && result.success) {
    currentNewKey.value = result.data.key
    showCreateModal.value = false
    showKeyModal.value = true
    loadData()
  }
}

const closeKeyModal = () => {
  showKeyModal.value = false
  currentNewKey.value = ''
}

const copyKey = async () => {
  await navigator.clipboard.writeText(currentNewKey.value)
  closeKeyModal()
}

const copyToClipboard = async (text) => {
  await navigator.clipboard.writeText(text)
}

const openEditLimit = (keyId, currentLimit) => {
  editLimitKeyId.value = keyId
  editLimitValue.value = currentLimit
  showEditLimitModal.value = true
}

const closeEditLimitModal = () => {
  showEditLimitModal.value = false
}

const updateLimit = async () => {
  const dailyLimit = parseInt(editLimitValue.value)
  if (!dailyLimit || dailyLimit < 1) return
  const result = await apiRequest(`${API_BASE}/keys/${editLimitKeyId.value}/limit`, {
    method: 'PUT',
    body: JSON.stringify({ dailyLimit })
  })
  if (result && result.success) {
    showEditLimitModal.value = false
    loadData()
  }
}

const openEditName = (keyId, currentName) => {
  editNameKeyId.value = keyId
  editNameValue.value = currentName
  showEditNameModal.value = true
}

const closeEditNameModal = () => {
  showEditNameModal.value = false
}

const updateName = async () => {
  const result = await apiRequest(`${API_BASE}/keys/${editNameKeyId.value}/name`, {
    method: 'PUT',
    body: JSON.stringify({ name: editNameValue.value })
  })
  if (result && result.success) {
    showEditNameModal.value = false
    loadData()
  }
}

const showApplyLimitModal = () => {
  applyLimitValue.value = 500
  showApplyLimitModal.value = true
}

const closeApplyLimitModal = () => {
  showApplyLimitModal.value = false
}

const applyDailyLimitToAll = async () => {
  const dailyLimit = parseInt(applyLimitValue.value)
  if (!dailyLimit || dailyLimit < 1) return
  const result = await apiRequest(`${API_BASE}/keys/apply-limit`, {
    method: 'POST',
    body: JSON.stringify({ dailyLimit })
  })
  if (result && result.success) {
    showApplyLimitModal.value = false
    loadData()
  }
}

const resetUsage = async (keyId) => {
  const result = await apiRequest(`${API_BASE}/keys/${keyId}/reset-usage`, { method: 'POST' })
  if (result && result.success) loadData()
}

const resetTokenStats = async (keyId) => {
  const result = await apiRequest(`${API_BASE}/keys/${keyId}/reset-tokens`, { method: 'POST' })
  if (result && result.success) loadData()
}

const resetAllTokenStats = async () => {
  const result = await apiRequest(`${API_BASE}/keys/reset-all-tokens`, { method: 'POST' })
  if (result && result.success) loadData()
}

const toggleKey = async (keyId) => {
  const key = allKeys.value.find(k => k.id === keyId)
  const result = await apiRequest(`${API_BASE}/keys/${keyId}/toggle`, {
    method: 'PUT',
    body: JSON.stringify({ enabled: !key.enabled })
  })
  if (result && result.success) loadData()
}

const deleteKey = async (keyId) => {
  if (!confirm('确定删除此 Key 吗？')) return
  const result = await apiRequest(`${API_BASE}/keys/${keyId}`, { method: 'DELETE' })
  if (result && result.success) loadData()
}

const showCalendarTooltip = (e, day) => {}
const hideCalendarTooltip = () => {}
const toggleTheme = () => {}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.potluck-container {
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
  max-width: 1400px;
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

.navbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

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

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-secondary {
  background: #f3f4f6;
  color: #4b5563;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-danger {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.btn-danger:hover {
  background: #fecaca;
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
  max-width: 1400px;
  margin: 0 auto;
  padding: 30px 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
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
.stat-card.pink::before { background: linear-gradient(90deg, #ec4899, #f472b6); }
.stat-card.cyan::before { background: linear-gradient(90deg, #06b6d4, #22d3ee); }

.stat-card .label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
}

.stat-card .value {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
}

.stat-card.purple .value { color: #6366f1; }
.stat-card.green .value { color: #10b981; }
.stat-card.pink .value { color: #ec4899; }
.stat-card.cyan .value { color: #06b6d4; }

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
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
  cursor: pointer;
  transition: transform 0.1s;
}

.calendar-day:hover {
  transform: scale(1.2);
  outline: 1px solid #10b981;
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

.keys-section {
  margin-top: 10px;
}

.keys-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}

.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.search-box {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px 14px;
  color: #1f2937;
  font-size: 14px;
  width: 220px;
}

.sort-select {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px 14px;
  color: #1f2937;
  font-size: 14px;
  cursor: pointer;
}

.keys-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.key-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  transition: all 0.2s;
}

.key-card:hover {
  border-color: #10b981;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
}

.key-card.disabled { opacity: 0.6; }

.key-info { flex: 1; min-width: 200px; }

.key-name {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 6px;
}

.key-id {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-copy {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  color: #6b7280;
  cursor: pointer;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s;
}

.btn-copy:hover {
  background: #e5e7eb;
  color: #10b981;
  border-color: #10b981;
}

.key-dist-mini {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.dist-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  color: #6b7280;
}

.dist-badge b { color: #10b981; }

.key-stats {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.key-stat {
  text-align: center;
  min-width: 70px;
}

.key-stat .label {
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 4px;
}

.key-stat .value {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.key-stat .value.warning { color: #f59e0b; }
.key-stat .value.danger { color: #dc2626; }
.key-stat .value.muted { color: #9ca3af; font-size: 12px; }

.progress-bar {
  height: 6px;
  background: #f3f4f6;
  border-radius: 999px;
  overflow: hidden;
  margin-top: 6px;
}

.progress-bar .fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  transition: width 0.3s;
}

.progress-bar .fill.warning { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
.progress-bar .fill.danger { background: linear-gradient(90deg, #dc2626, #f87171); }

.key-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
}

.empty-state .icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }

.modal-overlay {
  display: flex;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 0;
  max-width: 500px;
  width: 100%;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.modal-close {
  background: none;
  border: none;
  color: #6b7280;
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.modal-body { padding: 24px; }

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.form-group { margin-bottom: 20px; }

.form-group label {
  display: block;
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
  margin-bottom: 8px;
}

.form-group input {
  width: 100%;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 12px 16px;
  color: #1f2937;
  font-size: 14px;
}

.form-group input:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
}

.key-display {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: #059669;
  word-break: break-all;
  margin: 16px 0;
}

.warning-box {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
}

.warning-box p {
  color: #dc2626;
  font-size: 13px;
  margin: 0;
}

.warning-box ul {
  color: #dc2626;
  font-size: 12px;
  margin: 8px 0 0 16px;
  padding: 0;
}
</style>