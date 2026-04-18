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
        this.lastGpuData = null;
        this.animationFrame = null;
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupEventListeners();
            this.setupWebSocket();
            this.startPolling();
            this.initGpuStatusElements();
        });
    }

    initGpuStatusElements() {
        const container = document.getElementById('gpuStatusContent');
        if (!container) return;

        container.innerHTML = `
            <div class="gpu-card glass-effect">
                <div class="gpu-header">
                    <div class="gpu-name" id="gpuName">
                        <i class="fas fa-video-card"></i>
                        <span>检测中...</span>
                    </div>
                    <div class="gpu-status-badge" id="gpuStatusBadge">
                        <span class="status-indicator"></span>
                        <span>初始化</span>
                    </div>
                </div>
                
                <div class="gpu-metrics-grid">
                    <div class="metric-card">
                        <div class="metric-icon" id="memoryIcon"><i class="fas fa-memory"></i></div>
                        <div class="metric-info">
                            <div class="metric-label">显存</div>
                            <div class="metric-value" id="memoryValue">--</div>
                            <div class="metric-bar-container">
                                <div class="metric-bar-bg">
                                    <div class="metric-bar-fill memory" id="memoryBar"></div>
                                </div>
                                <span class="metric-percent" id="memoryPercent">--%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="metric-card">
                        <div class="metric-icon" id="utilIcon"><i class="fas fa-cpu"></i></div>
                        <div class="metric-info">
                            <div class="metric-label">GPU使用率</div>
                            <div class="metric-value" id="utilValue">--%</div>
                            <div class="metric-gauge">
                                <svg viewBox="0 0 100 50">
                                    <path d="M 10 45 A 40 40 0 0 1 90 45" fill="none" stroke="#e5e7eb" stroke-width="8" stroke-linecap="round"/>
                                    <path id="utilArc" d="M 10 45 A 40 40 0 0 1 50 45" fill="none" stroke="#3b82f6" stroke-width="8" stroke-linecap="round"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                    
                    <div class="metric-card">
                        <div class="metric-icon" id="tempIcon"><i class="fas fa-thermometer-half"></i></div>
                        <div class="metric-info">
                            <div class="metric-label">温度</div>
                            <div class="metric-value" id="tempValue">--°C</div>
                            <div class="metric-bar-container">
                                <div class="metric-bar-bg">
                                    <div class="metric-bar-fill temperature" id="tempBar"></div>
                                </div>
                                <span class="metric-percent" id="tempPercent">--%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="metric-card">
                        <div class="metric-icon" id="powerIcon"><i class="fas fa-bolt"></i></div>
                        <div class="metric-info">
                            <div class="metric-label">功耗</div>
                            <div class="metric-value" id="powerValue">--W</div>
                            <div class="metric-bar-container">
                                <div class="metric-bar-bg">
                                    <div class="metric-bar-fill power" id="powerBar"></div>
                                </div>
                                <span class="metric-percent" id="powerPercent">--%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="metric-card compact">
                        <div class="metric-icon small" id="fanIcon"><i class="fas fa-wind"></i></div>
                        <div class="metric-info">
                            <div class="metric-label">风扇转速</div>
                            <div class="metric-value" id="fanValue">--%</div>
                        </div>
                    </div>
                    
                    <div class="metric-card compact">
                        <div class="metric-icon small" id="clockIcon"><i class="fas fa-gauge"></i></div>
                        <div class="metric-info">
                            <div class="metric-label">核心频率</div>
                            <div class="metric-value" id="clockValue">-- MHz</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
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
                this.updateGpuStatusFromSocket(data.gpu.current);
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

    updateGpuStatusFromSocket(gpu) {
        if (!gpu) return;

        const memoryPercent = gpu.memory_utilization || ((gpu.used_memory / gpu.total_memory) * 100);
        const usedGB = (gpu.used_memory / (1024**3)).toFixed(1);
        const totalGB = (gpu.total_memory / (1024**3)).toFixed(1);

        this.animateValue('memoryValue', `${usedGB} / ${totalGB} GB`);
        this.animateBar('memoryBar', memoryPercent);
        this.animateValue('memoryPercent', `${Math.round(memoryPercent)}%`);

        this.animateValue('utilValue', `${gpu.utilization}%`);
        this.animateGauge('utilArc', gpu.utilization);

        this.animateValue('tempValue', `${gpu.temperature}°C`);
        const tempPercent = Math.min(gpu.temperature, 100);
        this.animateBar('tempBar', tempPercent);
        this.animateValue('tempPercent', `${gpu.temperature}%`);
        this.updateTempColor(gpu.temperature);

        this.animateValue('powerValue', `${gpu.power_draw}W / ${gpu.power_limit}W`);
        this.animateBar('powerBar', gpu.power_percent || 0);
        this.animateValue('powerPercent', `${gpu.power_percent || 0}%`);

        this.animateValue('fanValue', `${gpu.fan_speed || 0}%`);
        this.animateValue('clockValue', `${gpu.clock_sm || 0} MHz`);

        document.getElementById('gpuName').innerHTML = `<i class="fas fa-video-card"></i><span>${gpu.name}</span>`;
        
        const statusBadge = document.getElementById('gpuStatusBadge');
        const isActive = gpu.utilization > 10;
        statusBadge.className = `gpu-status-badge ${isActive ? 'active' : 'idle'}`;
        statusBadge.innerHTML = `<span class="status-indicator"></span><span>${isActive ? '运行中' : '空闲'}</span>`;

        this.lastGpuData = gpu;
    }

    animateValue(elementId, newValue) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        if (element.textContent !== newValue) {
            element.classList.add('value-change');
            element.textContent = newValue;
            setTimeout(() => element.classList.remove('value-change'), 300);
        }
    }

    animateBar(elementId, targetWidth) {
        const bar = document.getElementById(elementId);
        if (!bar) return;
        
        bar.style.width = `${targetWidth}%`;
    }

    animateGauge(elementId, percentage) {
        const arc = document.getElementById(elementId);
        if (!arc) return;

        const angle = (percentage / 100) * 180;
        const radian = (angle * Math.PI) / 180;
        const x = 50 + 40 * Math.cos(radian - Math.PI);
        const y = 45 + 40 * Math.sin(radian - Math.PI);
        
        arc.setAttribute('d', `M 10 45 A 40 40 0 0 1 ${x} ${y}`);
        arc.style.stroke = this.getGaugeColor(percentage);
    }

    getGaugeColor(percentage) {
        if (percentage < 50) return '#22c55e';
        if (percentage < 80) return '#f59e0b';
        return '#ef4444';
    }

    updateTempColor(temperature) {
        const tempBar = document.getElementById('tempBar');
        const tempValue = document.getElementById('tempValue');
        
        if (tempBar) {
            if (temperature > 90) tempBar.classList.add('danger');
            else if (temperature > 80) tempBar.classList.add('warning');
            else {
                tempBar.classList.remove('warning', 'danger');
            }
        }
        
        if (tempValue) {
            if (temperature > 90) tempValue.classList.add('danger');
            else if (temperature > 80) tempValue.classList.add('warning');
            else {
                tempValue.classList.remove('warning', 'danger');
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
            padding: { top: 30, right: 40, bottom: 40, left: 60 },
            animationProgress: 0
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
        
        this.animateChart();
    }

    animateChart() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        this.chart.animationProgress = 0;
        
        const animate = () => {
            this.chart.animationProgress += 0.05;
            if (this.chart.animationProgress < 1) {
                this.renderChart(this.chart.animationProgress);
                this.animationFrame = requestAnimationFrame(animate);
            } else {
                this.renderChart(1);
            }
        };
        
        animate();
    }

    renderEmptyChart() {
        const { ctx, width, height, padding } = this.chart;
        
        ctx.clearRect(0, 0, width, height);
        
        ctx.fillStyle = '#6b7280';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据', width / 2, height / 2);
    }

    renderChart(progress = 1) {
        const { ctx, width, height, padding } = this.chart;
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        ctx.clearRect(0, 0, width, height);

        if (this.gpuHistoryData.length === 0) {
            this.renderEmptyChart();
            return;
        }
        
        const datasets = this.getChartDatasets();
        
        let allValues = [];
        datasets.forEach(ds => allValues.push(...ds.data));
        const minValue = Math.min(...allValues) * 0.9;
        const maxValue = Math.max(...allValues) * 1.1;
        
        this.drawGrid(ctx, chartWidth, chartHeight, padding);
        this.drawAxes(ctx, chartWidth, chartHeight, padding, minValue, maxValue);
        this.drawLines(ctx, chartWidth, chartHeight, padding, datasets, minValue, maxValue, progress);
        this.drawPoints(ctx, chartWidth, chartHeight, padding, datasets, minValue, maxValue);
        this.drawLegend(ctx, width, padding);
    }

    getChartDatasets() {
        const datasets = [];
        
        if (this.currentChartType === 'utilization' || this.currentChartType === 'all') {
            datasets.push({
                data: this.gpuHistoryData.map(d => d.utilization),
                color: '#3b82f6',
                label: 'GPU使用率',
                gradient: this.createGradient('#3b82f6', '#1d4ed8')
            });
        }
        
        if (this.currentChartType === 'temperature' || this.currentChartType === 'all') {
            datasets.push({
                data: this.gpuHistoryData.map(d => d.temperature),
                color: '#ef4444',
                label: '温度(°C)',
                gradient: this.createGradient('#ef4444', '#dc2626')
            });
        }
        
        if (this.currentChartType === 'memory' || this.currentChartType === 'all') {
            datasets.push({
                data: this.gpuHistoryData.map(d => d.memory_utilization),
                color: '#f59e0b',
                label: '显存使用率',
                gradient: this.createGradient('#f59e0b', '#d97706')
            });
        }
        
        if (this.currentChartType === 'power' || this.currentChartType === 'all') {
            datasets.push({
                data: this.gpuHistoryData.map(d => d.power_percent || 0),
                color: '#06b6d4',
                label: '功耗(%)',
                gradient: this.createGradient('#06b6d4', '#0891b2')
            });
        }
        
        return datasets;
    }

    createGradient(color1, color2) {
        const gradient = this.chart.ctx.createLinearGradient(0, 0, 0, this.chart.height);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        return gradient;
    }

    drawGrid(ctx, chartWidth, chartHeight, padding) {
        ctx.strokeStyle = '#f3f4f6';
        ctx.lineWidth = 1;
        
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartHeight / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();
        }
        
        for (let i = 0; i <= 4; i++) {
            const x = padding.left + (chartWidth / 4) * i;
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + chartHeight);
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
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartHeight / gridLines) * i;
            const value = maxValue - ((maxValue - minValue) / gridLines) * i;
            ctx.fillText(Math.round(value), padding.left - 10, y + 4);
        }
        
        ctx.textAlign = 'center';
        const timeLabels = ['-60s', '-45s', '-30s', '-15s', '现在'];
        for (let i = 0; i < 5; i++) {
            const x = padding.left + (chartWidth / 4) * i;
            ctx.fillText(timeLabels[i], x, padding.top + chartHeight + 25);
        }
        
        ctx.save();
        ctx.translate(20, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('数值', 0, 0);
        ctx.restore();
    }

    drawLines(ctx, chartWidth, chartHeight, padding, datasets, minValue, maxValue, progress) {
        const dataLength = this.gpuHistoryData.length;
        const visibleLength = Math.floor(dataLength * progress);
        
        datasets.forEach(ds => {
            ctx.strokeStyle = ds.color;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            
            const visibleData = ds.data.slice(0, visibleLength);
            
            visibleData.forEach((value, index) => {
                const x = padding.left + (chartWidth / (dataLength - 1)) * index;
                const y = padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;
                
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
            
            if (visibleLength > 1) {
                ctx.fillStyle = ds.gradient;
                ctx.globalAlpha = 0.15;
                ctx.beginPath();
                ctx.moveTo(padding.left, padding.top + chartHeight);
                
                visibleData.forEach((value, index) => {
                    const x = padding.left + (chartWidth / (dataLength - 1)) * index;
                    const y = padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;
                    ctx.lineTo(x, y);
                });
                
                ctx.lineTo(padding.left + (chartWidth / (dataLength - 1)) * (visibleLength - 1), padding.top + chartHeight);
                ctx.closePath();
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        });
    }

    drawPoints(ctx, chartWidth, chartHeight, padding, datasets, minValue, maxValue) {
        const dataLength = this.gpuHistoryData.length;
        
        datasets.forEach(ds => {
            const lastValue = ds.data[ds.data.length - 1];
            const x = padding.left + (chartWidth / (dataLength - 1)) * (ds.data.length - 1);
            const y = padding.top + chartHeight - ((lastValue - minValue) / (maxValue - minValue)) * chartHeight;
            
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = ds.color;
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = ds.color;
            ctx.fill();
        });
    }

    drawLegend(ctx, width, padding) {
        const legendItems = [];
        
        if (this.currentChartType === 'utilization' || this.currentChartType === 'all') {
            legendItems.push({ color: '#3b82f6', label: 'GPU使用率' });
        }
        if (this.currentChartType === 'temperature' || this.currentChartType === 'all') {
            legendItems.push({ color: '#ef4444', label: '温度(°C)' });
        }
        if (this.currentChartType === 'memory' || this.currentChartType === 'all') {
            legendItems.push({ color: '#f59e0b', label: '显存使用率' });
        }
        if (this.currentChartType === 'power' || this.currentChartType === 'all') {
            legendItems.push({ color: '#06b6d4', label: '功耗(%)' });
        }
        
        const legendWidth = legendItems.length * 120;
        const startX = (width - legendWidth) / 2;
        
        legendItems.forEach((item, index) => {
            const x = startX + index * 120;
            const y = padding.top - 10;
            
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.roundRect(x, y, 12, 12, 3);
            ctx.fill();
            
            ctx.fillStyle = '#6b7280';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(item.label, x + 18, y + 10);
        });
    }

    startPolling() {
        this.stopPolling();
        this.pollingInterval = setInterval(() => {
            if (this.isCurrentSection('gpu-monitor')) {
                this.refreshAllStatus();
                this.checkControllerConnection();
            }
        }, 3000);
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
                this.animateStatusChange(statusElement, true);
                
                if (iframe && placeholder) {
                    iframe.src = `${CONTROLLER_BASE_URL}/docs`;
                    placeholder.style.display = 'none';
                    iframe.style.display = 'block';
                }
            } else {
                throw new Error('Controller not responding');
            }
        } catch (error) {
            this.animateStatusChange(statusElement, false);
            
            if (iframe && placeholder) {
                iframe.src = '';
                iframe.style.display = 'none';
                placeholder.style.display = 'flex';
            }
        }
    }

    animateStatusChange(element, isOnline) {
        if (!element) return;
        
        element.classList.add('status-transition');
        setTimeout(() => {
            element.className = `status-badge ${isOnline ? 'online' : 'offline'} status-transition`;
            element.innerHTML = `<i class="fas fa-circle"></i> <span>${isOnline ? '已连接' : '未连接'}</span>`;
        }, 50);
    }

    async refreshGpuStatus() {
        try {
            const response = await fetch(`/api/python-gpu/status`, {
                method: 'GET',
                timeout: 5000
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to get GPU status');
            }
            if (result.primary) {
                this.updateGpuStatusFromSocket(result.primary);
            } else if (result.status === 'available') {
                this.updateGpuStatusFromSocket(result);
            }
        } catch (error) {
            logger.warn(`Failed to fetch GPU status: ${error.message}`);
        }
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
                <div class="model-info">
                    <span class="model-name">${name}</span>
                    ${status.active_requests > 0 ? `
                        <span class="model-requests">${status.active_requests} 请求中</span>
                    ` : ''}
                </div>
                <div class="model-status">
                    <span class="status-indicator ${status.running ? 'running' : 'stopped'}"></span>
                    <span>${status.running ? '运行中' : '已停止'}</span>
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
            <div class="queue-info-grid">
                <div class="queue-card">
                    <div class="queue-icon"><i class="fas fa-tasks"></i></div>
                    <div class="queue-value">${totalActive}</div>
                    <div class="queue-label">活跃请求</div>
                </div>
                <div class="queue-card">
                    <div class="queue-icon"><i class="fas fa-gauge"></i></div>
                    <div class="queue-value">${totalLimit}</div>
                    <div class="queue-label">并发限制</div>
                </div>
                <div class="queue-card">
                    <div class="queue-icon"><i class="fas fa-check-circle"></i></div>
                    <div class="queue-value ${canAccept ? 'success' : 'danger'}">${canAccept ? '是' : '否'}</div>
                    <div class="queue-label">可接受新请求</div>
                </div>
                <div class="queue-card">
                    <div class="queue-icon"><i class="fas fa-chart-line"></i></div>
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
                <div class="control-btn-group">
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