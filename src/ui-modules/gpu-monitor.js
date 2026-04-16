import logger from '../utils/logger.js';

const CONTROLLER_BASE_URL = 'http://localhost:5000';

export class GPUMonitorModule {
    constructor() {
        this.pollingInterval = null;
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupEventListeners();
            this.startPolling();
        });
    }

    setupEventListeners() {
        const refreshBtn = document.getElementById('refreshGpuStatusBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshAllStatus());
        }

        document.addEventListener('section-change', (event) => {
            if (event.detail.section === 'gpu-monitor') {
                this.refreshAllStatus();
                this.checkControllerConnection();
            }
        });
    }

    startPolling() {
        this.stopPolling();
        this.pollingInterval = setInterval(() => {
            if (this.isCurrentSection('gpu-monitor')) {
                this.refreshAllStatus();
                this.checkControllerConnection();
            }
        }, 2000);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    isCurrentSection(sectionId) {
        const activeSection = document.querySelector('.section.active');
        return activeSection?.id === sectionId;
    }

    async refreshAllStatus() {
        await Promise.all([
            this.refreshGpuStatus(),
            this.refreshModelsStatus(),
            this.refreshQueueStatus(),
            this.refreshModelControls()
        ]);
    }

    async checkControllerConnection() {
        const statusElement = document.getElementById('controllerConnectionStatus');
        const iframe = document.getElementById('controllerIframe');
        const placeholder = document.getElementById('iframePlaceholder');

        try {
            const response = await fetch(`${CONTROLLER_BASE_URL}/health`, {
                method: 'GET',
                timeout: 5000
            });

            if (response.ok) {
                statusElement.className = 'status-badge online';
                statusElement.innerHTML = '<i class="fas fa-circle"></i> <span>已连接</span>';
                
                if (iframe && placeholder) {
                    iframe.src = `${CONTROLLER_BASE_URL}/docs`;
                    placeholder.style.display = 'none';
                    iframe.style.display = 'block';
                }
            } else {
                throw new Error('Controller not responding');
            }
        } catch (error) {
            statusElement.className = 'status-badge offline';
            statusElement.innerHTML = '<i class="fas fa-circle"></i> <span>未连接</span>';
            
            if (iframe && placeholder) {
                iframe.src = '';
                iframe.style.display = 'none';
                placeholder.style.display = 'flex';
            }
        }
    }

    async refreshGpuStatus() {
        const container = document.getElementById('gpuStatusContent');
        if (!container) return;

        try {
            const response = await fetch(`${CONTROLLER_BASE_URL}/manage/gpu`, {
                method: 'GET',
                timeout: 5000
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.renderGpuStatus(data, container);
        } catch (error) {
            logger.warn(`Failed to fetch GPU status: ${error.message}`);
            container.innerHTML = `
                <div class="status-loading">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>无法获取GPU状态</span>
                    <span class="text-sm text-muted">${error.message}</span>
                </div>
            `;
        }
    }

    renderGpuStatus(data, container) {
        if (!data || data.status === 'unavailable') {
            container.innerHTML = `
                <div class="status-loading">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${data?.message || '未检测到GPU'}</span>
                </div>
            `;
            return;
        }

        const gpu = data.primary;
        const memoryPercent = (gpu.used_memory / gpu.total_memory) * 100;
        const memoryClass = memoryPercent > 90 ? 'high' : memoryPercent > 70 ? 'medium' : 'low';

        container.innerHTML = `
            <div class="gpu-card">
                <div class="gpu-name">${gpu.name}</div>
                <div class="gpu-metrics">
                    <div class="metric-item">
                        <div class="metric-label">显存使用</div>
                        <div class="metric-value">${(gpu.used_memory / (1024**3)).toFixed(1)} / ${(gpu.total_memory / (1024**3)).toFixed(1)} GB</div>
                        <div class="memory-bar">
                            <div class="memory-fill ${memoryClass}" style="width: ${memoryPercent}%"></div>
                        </div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">温度</div>
                        <div class="metric-value">${gpu.temperature}°C</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">使用率</div>
                        <div class="metric-value">${gpu.utilization}%</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">可用显存</div>
                        <div class="metric-value">${(gpu.available_memory / (1024**3)).toFixed(1)} GB</div>
                    </div>
                </div>
            </div>
        `;
    }

    async refreshModelsStatus() {
        const container = document.getElementById('modelsStatusContent');
        if (!container) return;

        try {
            const response = await fetch(`${CONTROLLER_BASE_URL}/manage/models`, {
                method: 'GET',
                timeout: 5000
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.renderModelsStatus(data, container);
        } catch (error) {
            logger.warn(`Failed to fetch models status: ${error.message}`);
            container.innerHTML = `
                <div class="status-loading">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>无法获取模型状态</span>
                </div>
            `;
        }
    }

    renderModelsStatus(data, container) {
        if (!data || Object.keys(data).length === 0) {
            container.innerHTML = `
                <div class="status-loading">
                    <i class="fas fa-info-circle"></i>
                    <span>暂无配置的模型</span>
                </div>
            `;
            return;
        }

        const items = Object.entries(data).map(([name, status]) => `
            <div class="model-status-item">
                <span class="model-name">${name}</span>
                <div class="model-status">
                    <span class="status-indicator ${status.running ? 'running' : 'stopped'}"></span>
                    <span style="font-size: 0.875rem; color: ${status.running ? '#22c55e' : '#6b7280'}">
                        ${status.running ? '运行中' : '已停止'}
                    </span>
                    ${status.active_requests > 0 ? `
                        <span style="font-size: 0.75rem; color: #3b82f6">
                            ${status.active_requests} 请求中
                        </span>
                    ` : ''}
                </div>
            </div>
        `).join('');

        container.innerHTML = `<div class="model-status-grid">${items}</div>`;
    }

    async refreshQueueStatus() {
        const container = document.getElementById('queueStatusContent');
        if (!container) return;

        try {
            const response = await fetch(`${CONTROLLER_BASE_URL}/manage/queue`, {
                method: 'GET',
                timeout: 5000
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.renderQueueStatus(data, container);
        } catch (error) {
            logger.warn(`Failed to fetch queue status: ${error.message}`);
            container.innerHTML = `
                <div class="status-loading">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>无法获取队列状态</span>
                </div>
            `;
        }
    }

    renderQueueStatus(data, container) {
        if (!data || Object.keys(data).length === 0) {
            container.innerHTML = `
                <div class="status-loading">
                    <i class="fas fa-info-circle"></i>
                    <span>暂无队列信息</span>
                </div>
            `;
            return;
        }

        let totalActive = 0;
        let totalLimit = 0;
        let canAccept = false;

        Object.values(data).forEach(model => {
            totalActive += model.active_requests;
            totalLimit = model.concurrency_limit;
            if (model.can_accept) canAccept = true;
        });

        container.innerHTML = `
            <div class="queue-info">
                <div class="queue-item">
                    <div class="queue-value">${totalActive}</div>
                    <div class="queue-label">活跃请求</div>
                </div>
                <div class="queue-item">
                    <div class="queue-value">${totalLimit}</div>
                    <div class="queue-label">并发限制</div>
                </div>
                <div class="queue-item">
                    <div class="queue-value">${canAccept ? '是' : '否'}</div>
                    <div class="queue-label">可接受新请求</div>
                </div>
                <div class="queue-item">
                    <div class="queue-value">${totalLimit - totalActive}</div>
                    <div class="queue-label">剩余槽位</div>
                </div>
            </div>
        `;
    }

    async refreshModelControls() {
        const container = document.getElementById('modelControls');
        if (!container) return;

        try {
            const response = await fetch(`${CONTROLLER_BASE_URL}/manage/models`, {
                method: 'GET',
                timeout: 5000
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.renderModelControls(data, container);
        } catch (error) {
            logger.warn(`Failed to fetch model controls: ${error.message}`);
            container.innerHTML = `
                <div class="status-loading">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>无法获取模型控制信息</span>
                </div>
            `;
        }
    }

    renderModelControls(data, container) {
        if (!data || Object.keys(data).length === 0) {
            container.innerHTML = `
                <div class="status-loading">
                    <i class="fas fa-info-circle"></i>
                    <span>暂无可控制的模型</span>
                </div>
            `;
            return;
        }

        const controls = Object.entries(data).map(([name, status]) => `
            <div class="control-item">
                <span class="model-name">${name}</span>
                <div class="control-btn">
                    ${status.running ? `
                        <button class="btn btn-danger btn-sm" onclick="GPUMonitor.stopModel('${name}')">
                            <i class="fas fa-stop"></i> 停止
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="GPUMonitor.switchModel('${name}')">
                            <i class="fas fa-exchange-alt"></i> 切换
                        </button>
                    ` : `
                        <button class="btn btn-success btn-sm" onclick="GPUMonitor.startModel('${name}')">
                            <i class="fas fa-play"></i> 启动
                        </button>
                    `}
                </div>
            </div>
        `).join('');

        container.innerHTML = `<div class="control-grid">${controls}</div>`;
    }

    async startModel(modelName) {
        try {
            const response = await fetch(`${CONTROLLER_BASE_URL}/manage/models/${encodeURIComponent(modelName)}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            if (response.ok) {
                logger.info(`Model ${modelName} started successfully`);
                await this.refreshAllStatus();
            } else {
                throw new Error(data.detail || 'Failed to start model');
            }
        } catch (error) {
            logger.error(`Failed to start model ${modelName}: ${error.message}`);
            alert(`启动模型失败: ${error.message}`);
        }
    }

    async stopModel(modelName) {
        try {
            const response = await fetch(`${CONTROLLER_BASE_URL}/manage/models/${encodeURIComponent(modelName)}/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            if (response.ok) {
                logger.info(`Model ${modelName} stopped successfully`);
                await this.refreshAllStatus();
            } else {
                throw new Error(data.detail || 'Failed to stop model');
            }
        } catch (error) {
            logger.error(`Failed to stop model ${modelName}: ${error.message}`);
            alert(`停止模型失败: ${error.message}`);
        }
    }

    async switchModel(modelName) {
        try {
            const response = await fetch(`${CONTROLLER_BASE_URL}/manage/models/${encodeURIComponent(modelName)}/switch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            if (response.ok) {
                logger.info(`Switched to model ${modelName} successfully`);
                await this.refreshAllStatus();
            } else {
                throw new Error(data.detail || 'Failed to switch model');
            }
        } catch (error) {
            logger.error(`Failed to switch model ${modelName}: ${error.message}`);
            alert(`切换模型失败: ${error.message}`);
        }
    }
}

const GPUMonitor = new GPUMonitorModule();

export default GPUMonitor;