<template>
  <section id="gpu-monitor" class="section" aria-labelledby="gpu-monitor-title">
    <h2 id="gpu-monitor-title">GPU监控</h2>
    
    <div class="gpu-summary">
      <div class="summary-card">
        <div class="summary-icon">
          <i class="fas fa-microchip"></i>
        </div>
        <div class="summary-info">
          <h3>{{ gpuCount }}</h3>
          <p>GPU设备</p>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-icon">
          <i class="fas fa-percentage"></i>
        </div>
        <div class="summary-info">
          <h3>{{ avgUtilization }}%</h3>
          <p>平均利用率</p>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-icon">
          <i class="fas fa-memory"></i>
        </div>
        <div class="summary-info">
          <h3>{{ totalMemoryUsed }} / {{ totalMemory }}</h3>
          <p>显存使用</p>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-icon">
          <i class="fas fa-thermometer-half"></i>
        </div>
        <div class="summary-info">
          <h3>{{ avgTemperature }}°C</h3>
          <p>平均温度</p>
        </div>
      </div>
    </div>

    <div class="gpu-cards-container">
      <div 
        v-for="(gpu, index) in gpus" 
        :key="index"
        class="gpu-card"
      >
        <div class="gpu-header">
          <div class="gpu-name">
            <i class="fas fa-video-card"></i>
            <span>{{ gpu.name }}</span>
          </div>
          <span class="gpu-status" :class="gpu.status">{{ gpu.status === 'running' ? '运行中' : '空闲' }}</span>
        </div>
        
        <div class="gpu-metrics">
          <div class="metric">
            <div class="metric-header">
              <span class="metric-label">GPU使用率</span>
              <span class="metric-value">{{ gpu.utilization }}%</span>
            </div>
            <div class="metric-bar">
              <div 
                class="metric-fill utilization" 
                :style="{ width: gpu.utilization + '%' }"
              ></div>
            </div>
          </div>
          
          <div class="metric">
            <div class="metric-header">
              <span class="metric-label">显存使用</span>
              <span class="metric-value">{{ gpu.memoryUsed }} / {{ gpu.memoryTotal }}</span>
            </div>
            <div class="metric-bar">
              <div 
                class="metric-fill memory" 
                :style="{ width: gpu.memoryPercent + '%' }"
              ></div>
            </div>
          </div>
          
          <div class="metric">
            <div class="metric-header">
              <span class="metric-label">温度</span>
              <span class="metric-value" :class="{ warning: gpu.temperature > 80 }">
                {{ gpu.temperature }}°C
              </span>
            </div>
            <div class="metric-bar">
              <div 
                class="metric-fill temperature" 
                :class="{ warning: gpu.temperature > 80, danger: gpu.temperature > 90 }"
                :style="{ width: gpu.temperature + '%' }"
              ></div>
            </div>
          </div>
          
          <div class="metric">
            <div class="metric-header">
              <span class="metric-label">功耗</span>
              <span class="metric-value">{{ gpu.power }}W</span>
            </div>
            <div class="metric-bar">
              <div 
                class="metric-fill power" 
                :style="{ width: gpu.powerPercent + '%' }"
              ></div>
            </div>
          </div>
        </div>
        
        <div class="gpu-details">
          <div class="detail-row">
            <span class="detail-label">显存容量</span>
            <span class="detail-value">{{ gpu.memoryTotal }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">驱动版本</span>
            <span class="detail-value">{{ gpu.driverVersion }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">CUDA版本</span>
            <span class="detail-value">{{ gpu.cudaVersion }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">UUID</span>
            <span class="detail-value">{{ gpu.uuid }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="gpu-settings">
      <h3><i class="fas fa-cog"></i> GPU设置</h3>
      <div class="settings-grid">
        <div class="setting-item">
          <label>启用GPU监控</label>
          <label class="toggle-switch">
            <input type="checkbox" v-model="settings.gpuMonitorEnabled">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="setting-item">
          <label>自动风扇控制</label>
          <label class="toggle-switch">
            <input type="checkbox" v-model="settings.autoFanControl">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="setting-item">
          <label>温度预警阈值</label>
          <input 
            type="number" 
            v-model="settings.tempThreshold" 
            class="form-control" 
            min="60" 
            max="100"
          >
        </div>
        <div class="setting-item">
          <label>监控刷新间隔(秒)</label>
          <input 
            type="number" 
            v-model="settings.refreshInterval" 
            class="form-control" 
            min="1" 
            max="60"
          >
        </div>
      </div>
      <button class="btn btn-primary" @click="saveSettings">
        <i class="fas fa-save"></i> 保存设置
      </button>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'

const gpus = ref([
  {
    name: 'NVIDIA RTX 4090',
    status: 'running',
    utilization: 78,
    memoryUsed: '14.2 GB',
    memoryTotal: '24 GB',
    memoryPercent: 59,
    temperature: 72,
    power: '285',
    powerPercent: 71,
    driverVersion: '545.29.06',
    cudaVersion: '12.3',
    uuid: 'GPU-01234567-89ab-cdef-0123-456789abcdef'
  },
  {
    name: 'NVIDIA RTX 4090',
    status: 'idle',
    utilization: 5,
    memoryUsed: '2.1 GB',
    memoryTotal: '24 GB',
    memoryPercent: 9,
    temperature: 45,
    power: '45',
    powerPercent: 11,
    driverVersion: '545.29.06',
    cudaVersion: '12.3',
    uuid: 'GPU-abcdef01-2345-6789-abcd-ef0123456789'
  }
])

const settings = reactive({
  gpuMonitorEnabled: true,
  autoFanControl: true,
  tempThreshold: 80,
  refreshInterval: 5
})

const gpuCount = computed(() => gpus.value.length)

const avgUtilization = computed(() => {
  const total = gpus.value.reduce((sum, gpu) => sum + gpu.utilization, 0)
  return Math.round(total / gpus.value.length)
})

const totalMemoryUsed = computed(() => {
  const total = gpus.value.reduce((sum, gpu) => {
    const used = parseFloat(gpu.memoryUsed)
    return sum + used
  })
  return total.toFixed(1) + ' GB'
})

const totalMemory = computed(() => {
  const total = gpus.value.reduce((sum, gpu) => {
    const mem = parseFloat(gpu.memoryTotal)
    return sum + mem
  })
  return total + ' GB'
})

const avgTemperature = computed(() => {
  const total = gpus.value.reduce((sum, gpu) => sum + gpu.temperature, 0)
  return Math.round(total / gpus.value.length)
})

const saveSettings = () => {
  alert('GPU设置已保存')
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

.gpu-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.summary-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.summary-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--primary-10);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
  font-size: 1.25rem;
}

.summary-info h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.summary-info p {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  margin: 0.25rem 0 0;
}

.gpu-cards-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.gpu-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1rem;
}

.gpu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.gpu-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--text-primary);
}

.gpu-name i {
  color: var(--primary-color);
}

.gpu-status {
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
}

.gpu-status.running {
  background: var(--success-bg);
  color: var(--success-text);
}

.gpu-status.idle {
  background: var(--info-bg);
  color: var(--info-text);
}

.gpu-metrics {
  margin-bottom: 1rem;
}

.metric {
  margin-bottom: 0.75rem;
}

.metric:last-child {
  margin-bottom: 0;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.metric-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.metric-value {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
}

.metric-value.warning {
  color: var(--warning-text);
}

.metric-bar {
  height: 6px;
  background: var(--bg-secondary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.metric-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.5s ease;
}

.metric-fill.utilization {
  background: var(--primary-color);
}

.metric-fill.memory {
  background: var(--indigo-500);
}

.metric-fill.temperature {
  background: var(--success-color);
}

.metric-fill.temperature.warning {
  background: var(--warning-color);
}

.metric-fill.temperature.danger {
  background: var(--danger-color);
}

.metric-fill.power {
  background: var(--info-color);
}

.gpu-details {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 0.75rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--border-color);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.detail-value {
  font-size: 0.75rem;
  color: var(--text-primary);
}

.gpu-settings {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1rem;
}

.gpu-settings h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1rem;
}

.gpu-settings h3 i {
  color: var(--primary-color);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.setting-item label:first-child {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.form-control {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  width: 100px;
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

.btn-primary {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.btn-primary:hover {
  background: var(--primary-hover);
}

@media (max-width: 1024px) {
  .gpu-summary {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .gpu-summary {
    grid-template-columns: 1fr;
  }
  
  .gpu-cards-container {
    grid-template-columns: 1fr;
  }
  
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>