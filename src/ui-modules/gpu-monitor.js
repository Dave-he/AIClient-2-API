import logger from '../utils/logger.js';
import { CONFIG } from '../core/config-manager.js';

const CONTROLLER_BASE_URL = CONFIG.CONTROLLER_BASE_URL || 'http://192.168.7.103:5000';

export class GPUMonitorModule {
    constructor() {
        this.pollingInterval = null;
        this.webSocket = null;
        this.chart = null;
        this.currentChartType = 'utilization';
        this.gpuHistoryData = [];
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupEventListeners();
            this.setupWebSocket();
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

        const chartTabs = document.querySelectorAll('.chart-tab');
        chartTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                chartTabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.currentChartType = e.target.dataset.chartType;
                this.updateChart();
            });
        });
    }

    setupWebSocket() {
        const controllerHost = new URL(CONTROLLER_BASE_URL).host;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${controllerHost}/ws/monitor`;
        
        try {
            this.webSocket = new WebSocket(wsUrl);
            
            this.webSocket.onopen = () => {
                logger.info('WebSocket connected to GPU monitor');
            };
            
            this.webSocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'status_update') {
                        this.handleWebSocketMessage(data);
                    }
                } catch (error) {
                    logger.error('Failed to parse WebSocket message:', error);
                }
            };
            
            this.webSocket.onerror = (error) => {
                logger.error('WebSocket error:', error);
            };
            
            this.webSocket.onclose = () => {
                logger.info('WebSocket disconnected, reconnecting...');
                setTimeout(() => this.setupWebSocket(), 3000);
            };
        } catch (error) {
            logger.error('Failed to connect WebSocket:', error);
        }
    }

    handleWebSocketMessage(data) {
        if (data.gpu) {
            if (data.gpu.current) {
                this.renderGpuStatusFromSocket(data.gpu);
            }
            if (data.gpu.history && data.gpu.history.length > 0) {
                this.gpuHistoryData = data.gpu.history;
                this.updateChart();
            }
        }
        if (data.models) {
            const container = document.getElementById('modelsStatusContent');
            if (container) {
                this.renderModelsStatus(data.models, container);
            }
        }
    }

    initChart() {
        const canvas = document.getElementById('gpuChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        
        this.chart = {
            ctx,
            width: rect.width,
            height: rect.height,
            padding: { top: 20, right: 20, bottom: 30, left: 50 }
        };
    }

    updateChart() {
        if (!this.chart) {
            this.initChart();
        }
        
        if (!this.chart || this.gpuHistoryData.length === 0) {
            this.renderEmptyChart();
            return;
        }
        
        this.renderChart();
    }

    renderEmptyChart() {
        const { ctx, width, height, padding } = this.chart;
        
        ctx.clearRect(0, 0, width, height);
        
        ctx.fillStyle = '#6b7280';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据', width / 2, height / 2);
    }

    renderChart() {
        const { ctx, width, height, padding } = this.chart;
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        ctx.clearRect(0, 0, width, height);
        
        if (this.gpuHistoryData.length === 0) {
            this.renderEmptyChart();
            return;
        }
        
        let datasets = [];
        
        if (this.currentChartType === 'utilization' || this.currentChartType === 'all') {
            datasets.push({
                data: this.gpuHistoryData.map(d => d.utilization),
                color: '#3b82f6',
                label: 'GPU使用率'
            });
        }
        
        if (this.currentChartType === 'temperature' || this.currentChartType === 'all') {
            datasets.push({
                data: this.gpuHistoryData.map(d => d.temperature),
                color: '#ef4444',
                label: '温度'
            });
        }
        
        if (this.currentChartType === 'memory' || this.currentChartType === 'all') {
            datasets.push({
                data: this.gpuHistoryData.map(d => d.memory_utilization),
                color: '#f59e0b',
                label: '显存使用率'
            });
        }
        
        let allValues = [];
        datasets.forEach(ds => allValues.push(...ds.data));
        const minValue = Math.min(...allValues) * 0.9;
        const maxValue = Math.max(...allValues) * 1.1;
        
        this.drawGrid(ctx, chartWidth, chartHeight, padding, minValue, maxValue);
        this.drawAxes(ctx, chartWidth, chartHeight, padding, minValue, maxValue);
        this.drawLines(ctx, chartWidth, chartHeight, padding, datasets, minValue, maxValue);
        this.drawPoints(ctx, chartWidth, chartHeight, padding, datasets, minValue, maxValue);
    }

    drawGrid(ctx, chartWidth, chartHeight, padding, minValue, maxValue) {
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartHeight / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();
        }
    }

    drawAxes(ctx, chartWidth, chartHeight, padding, minValue, maxValue) {
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + chartHeight);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top + chartHeight);
        ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
        ctx.stroke();
        
        ctx.fillStyle = '#6b7280';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartHeight / gridLines) * i;
            const value = maxValue - ((maxValue - minValue) / gridLines) * i;
            ctx.fillText(Math.round(value), padding.left - 5, y + 3);
        }
        
        ctx.textAlign = 'center';
        const timeLabels = ['-60s', '-45s', '-30s', '-15s', '现在'];
        for (let i = 0; i < 5; i++) {
            const x = padding.left + (chartWidth / 4) * i;
            ctx.fillText(timeLabels[i], x, padding.top + chartHeight + 20);
        }
    }

    drawLines(ctx, chartWidth, chartHeight, padding, datasets, minValue, maxValue) {
        const dataLength = this.gpuHistoryData.length;
        
        datasets.forEach(ds => {
            ctx.strokeStyle = ds.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            ds.data.forEach((value, index) => {
                const x = padding.left + (chartWidth / (dataLength - 1)) * index;
                const y = padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;
                
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
        });
    }

    drawPoints(ctx, chartWidth, chartHeight, padding, datasets, minValue, maxValue) {
        const dataLength = this.gpuHistoryData.length;
        
        datasets.forEach(ds => {
            ctx.fillStyle = ds.color;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            
            ds.data.forEach((value, index) => {
                if (index === ds.data.length - 1) {
                    const x = padding.left + (chartWidth / (dataLength - 1)) * index;
                    const y = padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;
                    
                    ctx.beginPath();
                    ctx.arc(x, y, 5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            });
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

    renderGpuStatusFromSocket(gpuData) {
        const container = document.getElementById('gpuStatusContent');
        if (!container) return;

        if (!gpuData.current || gpuData.status === 'unavailable') {
            container.innerHTML = `
                <div class="status-loading">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${gpuData.message || '未检测到GPU'}</span>
                </div>
            `;
            return;
        }

        const gpu = gpuData.current;
        const memoryPercent = gpu.memory_utilization || ((gpu.used_memory / gpu.total_memory) * 100);
        const memoryClass = memoryPercent > 90 ? 'high' : memoryPercent > 70 ? 'medium' : 'low';

        container.innerHTML = `
            <div class="gpu-card">
                <div class="gpu-name">${gpu.name || 'Unknown GPU'}</div>
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
                        <div class="metric-value">${gpu.temperature || 0}°C</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">使用率</div>
                        <div class="metric-value">${gpu.utilization || 0}%</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">功耗</div>
                        <div class="metric-value">${gpu.power_draw || 0}W / ${gpu.power_limit || 0}W</div>
                        <div class="memory-bar">
                            <div class="memory-fill power" style="width: ${gpu.power_percent || 0}%"></div>
                        </div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">可用显存</div>
                        <div class="metric-value">${(gpu.available_memory / (1024**3)).toFixed(1)} GB</div>
                    </div>
                </div>
            </div>
        `;
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
                        <div class="metric-label">功耗</div>
                        <div class="metric-value">${gpu.power_draw || 0}W / ${gpu.power_limit || 0}W</div>
                        <div class="memory-bar">
                            <div class="memory-fill power" style="width: ${gpu.power_percent || 0}%"></div>
                        </div>
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