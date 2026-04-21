import { monitorCache } from './monitor-cache.js';
import { eventBus, EVENTS } from './event-bus.js';
import { API_PATHS, formatPath } from './api-paths.js';

export class GPUMonitorModule {
    constructor() {
        this.pollingInterval = null;
        this.webSocket = null;
        this.chart = null;
        this.currentChartType = 'all';
        this.gpuHistoryData = [];
        this.lastGpuData = null;
        this.animationFrame = null;
        this.testReport = null;
        this._isRefreshing = false;
        this.currentModel = null;
        this.lastModelsData = null;
        this.lastQueueData = null;
        this.i18n = window.i18n || { t: (key) => key };
        this._pendingUpdates = {};
        this.selectedTimeRange = 'day';
        this._refreshDebounceTimer = null;
        this._refreshDebounceDelay = 1000;
        this._lastRefreshTime = 0;
        this._minRefreshInterval = 2000;
        this.init();
        this.setupEventBusListeners();
    }

    shouldPoll() {
        return document.visibilityState === 'visible' && this.isCurrentSection('gpu-monitor');
    }

    init() {
        const initialize = () => {
            this.setupEventListeners();
            this.initGpuStatusElements();
            this.preloadData();
            // 不再需要独立轮询，改为监听 SystemMonitor 的事件
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize);
        } else {
            setTimeout(initialize, 50);
        }

        window.addEventListener('componentsLoaded', () => {
            this.initGpuStatusElements();
            this.debouncedRefresh(true);
        });
    }

    async preloadData() {
        try {
            await monitorCache.preloadDashboardData();
            const summary = monitorCache.getCachedData('dashboardSummary');
            if (summary && summary.success && summary.python) {
                if (summary.python.gpu) {
                    const gpuData = summary.python.gpu;
                    if (gpuData.primary) {
                        this.updateGpuStatusFromSocket(gpuData.primary);
                    } else if (gpuData.gpus && gpuData.gpus.length > 0) {
                        this.updateGpuStatusFromSocket(gpuData.gpus[0]);
                    } else if (gpuData.name) {
                        this.updateGpuStatusFromSocket(gpuData);
                    }
                    if (gpuData.history && gpuData.history.length > 0) {
                        this.gpuHistoryData = gpuData.history.map(item => this.normalizeHistoryPoint(item));
                        this.scheduleChartUpdate();
                    }
                }
                if (summary.python.summary) {
                    this.currentModel = this.resolveCurrentModelFromSummary(summary.python.summary);
                    this.renderCurrentModel();
                }
            }
        } catch (error) {
            console.log('[GPUMonitor] Preload failed, continuing with normal flow:', error.message);
        }
    }

    scheduleChartUpdate() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this.animationFrame = requestAnimationFrame(() => {
            this.updateChart();
        });
    }

    resolveCurrentModelFromSummary(summary) {
        if (!summary) return null;

        if (summary.running_model) {
            if (typeof summary.running_model === 'string') {
                return summary.models?.find(model => model.name === summary.running_model) || summary.running_model;
            }
            return summary.running_model;
        }

        if (Array.isArray(summary.models)) {
            const runningModels = summary.models.filter(model => model.running);
            return runningModels.length > 0 ? runningModels[0] : null;
        }

        return null;
    }

    normalizeHistoryPoint(point = {}) {
        const usedMemory = Number(point.used_memory || 0);
        const totalMemory = Number(point.total_memory || 0);
        const memoryUtilization = point.memory_utilization ?? (
            totalMemory > 0 ? Math.round((usedMemory / totalMemory) * 100) : 0
        );
        const powerDraw = Number(point.power_draw || 0);
        const powerLimit = Number(point.power_limit || 0);
        const powerPercent = point.power_percent ?? (
            powerLimit > 0 ? Math.round((powerDraw / powerLimit) * 100) : 0
        );

        return {
            ...point,
            memory_utilization: memoryUtilization,
            power_percent: powerPercent
        };
    }

    /**
     * 降采样数据 - Largest-Triangle-Three-Buckets (LTTB) 算法简化版
     * 当数据点过多时，保留关键特征并减少渲染负担
     * @param {Array} data - 原始数据数组
     * @param {number} threshold - 目标数据点数量
     * @returns {Array} - 降采样后的数据
     */
    downsampleData(data, threshold = 100) {
        if (!data || data.length <= threshold) {
            return data;
        }

        const result = [];
        const bucketSize = Math.floor(data.length / threshold);

        // 始终保留第一个点
        result.push(data[0]);

        for (let i = 1; i < threshold - 1; i++) {
            const start = Math.floor(i * bucketSize);
            const end = Math.min(start + bucketSize, data.length - 1);
            
            // 在每个桶中选择最大值和最小值的平均（保留波动特征）
            let max = -Infinity;
            let min = Infinity;
            let maxIdx = start;
            let minIdx = start;
            
            for (let j = start; j < end; j++) {
                if (data[j] > max) {
                    max = data[j];
                    maxIdx = j;
                }
                if (data[j] < min) {
                    min = data[j];
                    minIdx = j;
                }
            }
            
            // 选择离平均值更远的点以保留波动
            const avg = (max + min) / 2;
            const selectedIdx = Math.abs(data[maxIdx] - avg) > Math.abs(data[minIdx] - avg) ? maxIdx : minIdx;
            result.push(data[selectedIdx]);
        }

        // 始终保留最后一个点
        result.push(data[data.length - 1]);

        return result;
    }

    /**
     * 获取当前时间范围对应的最大渲染点数
     */
    getMaxRenderPoints() {
        switch (this.selectedTimeRange) {
            case 'hour': return 150;
            case 'day': return 200;
            case 'week': return 300;
            default: return 150;
        }
    }

    initGpuStatusElements() {
        const container = document.getElementById('gpuStatusContent');
        if (!container) {
            console.log('[GPUMonitor] gpuStatusContent not found');
            return;
        }
        console.log('[GPUMonitor] gpuStatusContent found, initializing GPU status elements');

        const t = this.i18n.t.bind(this.i18n);
        container.innerHTML = `
            <div class="gpu-card">
                <div class="gpu-header">
                    <div class="gpu-name" id="gpuName">
                        <i class="fas fa-video-card"></i>
                        <span>${t('gpuMonitor.detecting')}</span>
                    </div>
                    <div class="gpu-status-badge" id="gpuStatusBadge">
                        <span class="status-indicator"></span>
                        <span>${t('gpuMonitor.initializing')}</span>
                    </div>
                </div>

                <div class="gpu-metrics-grid">
                    <div class="metric-card">
                        <div class="metric-icon" id="memoryIcon"><i class="fas fa-memory"></i></div>
                        <div class="metric-info">
                            <div class="metric-label">${t('gpuMonitor.memory')}</div>
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
                            <div class="metric-label">${t('gpuMonitor.gpuUtilization')}</div>
                            <div class="metric-value" id="utilValue">--%</div>
                            <div class="metric-bar-container">
                                <div class="metric-bar-bg">
                                    <div class="metric-bar-fill temperature" id="utilBar"></div>
                                </div>
                                <span class="metric-percent" id="utilPercent">--%</span>
                            </div>
                        </div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-icon" id="tempIcon"><i class="fas fa-thermometer-half"></i></div>
                        <div class="metric-info">
                            <div class="metric-label">${t('gpuMonitor.temperature')}</div>
                            <div class="metric-value" id="tempValue">--°C</div>
                        </div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-icon" id="powerIcon"><i class="fas fa-bolt"></i></div>
                        <div class="metric-info">
                            <div class="metric-label">${t('gpuMonitor.power')}</div>
                            <div class="metric-value" id="powerValue">--W</div>
                            <div class="metric-bar-container">
                                <div class="metric-bar-bg">
                                    <div class="metric-bar-fill power" id="powerBar"></div>
                                </div>
                                <span class="metric-percent" id="powerPercent">--%</span>
                            </div>
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

        const refreshServiceBtn = document.getElementById('refreshServiceStatusBtn');
        if (refreshServiceBtn) {
            refreshServiceBtn.addEventListener('click', () => this.refreshPythonServiceStatus());
        }

        const startServiceBtn = document.getElementById('startPythonServiceBtn');
        if (startServiceBtn) {
            startServiceBtn.addEventListener('click', () => this.startPythonService());
        }

        const stopServiceBtn = document.getElementById('stopPythonServiceBtn');
        if (stopServiceBtn) {
            stopServiceBtn.addEventListener('click', () => this.stopPythonService());
        }

        const restartServiceBtn = document.getElementById('restartPythonServiceBtn');
        if (restartServiceBtn) {
            restartServiceBtn.addEventListener('click', () => this.restartPythonService());
        }

        const refreshConfigBtn = document.getElementById('refreshConfigBtn');
        if (refreshConfigBtn) {
            refreshConfigBtn.addEventListener('click', () => this.refreshConfig());
        }

        const editConfigBtn = document.getElementById('editConfigBtn');
        if (editConfigBtn) {
            editConfigBtn.addEventListener('click', () => this.showConfigEditor());
        }

        const refreshModelsListBtn = document.getElementById('refreshModelsListBtn');
        if (refreshModelsListBtn) {
            refreshModelsListBtn.addEventListener('click', () => this.refreshAllStatus(true));
        }

        document.addEventListener('section-change', async (event) => {
            if (event.detail.section === 'gpu-monitor') {
                this.debouncedRefresh();
                this.refreshPythonServiceStatus();
                this.refreshConfig();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.isCurrentSection('gpu-monitor')) {
                this.debouncedRefresh();
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

        const timeRangeSelect = document.getElementById('timeRangeSelect');
        if (timeRangeSelect) {
            timeRangeSelect.addEventListener('change', (e) => {
                this.selectedTimeRange = e.target.value;
                this.refreshAllStatus(true);
            });
        }

        const saveConfigBtn = document.getElementById('saveConfigBtn');
        if (saveConfigBtn) {
            saveConfigBtn.addEventListener('click', () => this.saveConfig());
        }
    }

    setupEventBusListeners() {
        let lastRefreshTime = 0;
        const DEBOUNCE_MS = 1000;

        const shouldRefresh = () => {
            const now = Date.now();
            if (now - lastRefreshTime < DEBOUNCE_MS) {
                console.log('[GPUMonitor] Debouncing refresh, last refresh was', now - lastRefreshTime, 'ms ago');
                return false;
            }
            lastRefreshTime = now;
            return true;
        };

        eventBus.on(EVENTS.CONFIG_UPDATED, () => {
            console.log('[GPUMonitor] Config updated, refreshing config');
            this.refreshConfig();
        });

        // 监听 SystemMonitor 的更新事件，避免重复轮询
        eventBus.on(EVENTS.SYSTEM_INFO_UPDATED, () => {
            console.log('[GPUMonitor] System info updated, refreshing GPU status');
            if (this.isCurrentSection('gpu-monitor') && shouldRefresh()) {
                // 从缓存读取数据，避免重复请求
                this.updateFromCache();
            }
        });

        eventBus.on(EVENTS.PROVIDERS_UPDATED, () => {
            console.log('[GPUMonitor] Providers updated');
            if (this.shouldPoll() && shouldRefresh()) {
                this.refreshAllStatus(true);
            }
        });

        eventBus.on(EVENTS.MODELS_UPDATED, () => {
            console.log('[GPUMonitor] Models updated, refreshing models list');
            if (this.shouldPoll() && shouldRefresh()) {
                this.refreshAllStatus(true);
            }
        });

        // CACHE_INVALIDATED 事件由 SystemMonitor 处理，这里只更新本地缓存
        eventBus.on(EVENTS.CACHE_INVALIDATED, () => {
            console.log('[GPUMonitor] Cache invalidated');
            // 强制刷新以获取最新数据
            if (this.isCurrentSection('gpu-monitor')) {
                this.refreshAllStatus(true);
            }
        });
    }

    /**
     * 从缓存更新 GPU 状态（避免重复请求）
     */
    updateFromCache() {
        const summary = monitorCache.getCachedData('dashboardSummary');
        if (summary && summary.python) {
            const data = summary.python;
            if (data.gpu) {
                if (data.gpu.primary) {
                    this.updateGpuStatusFromSocket(data.gpu.primary);
                } else if (data.gpu.gpus && data.gpu.gpus.length > 0) {
                    this.updateGpuStatusFromSocket(data.gpu.gpus[0]);
                } else if (data.gpu.name) {
                    this.updateGpuStatusFromSocket(data.gpu);
                }
                if (data.gpu.history && data.gpu.history.length > 0) {
                    this.gpuHistoryData = data.gpu.history.map(item => this.normalizeHistoryPoint(item));
                    this.scheduleChartUpdate();
                }
            }
            if (data.models) {
                this.lastModelsData = data.models;
                this.renderUnifiedModels();
            }
            if (data.queue) {
                const container = document.getElementById('queueStatusContent');
                if (container) this.renderQueueStatus(data.queue, container);
                this.lastQueueData = data.queue;
            }
            if (data.summary) {
                this.currentModel = this.resolveCurrentModelFromSummary(data.summary);
                this.renderCurrentModel();
            }
        }
    }

    handleWebSocketMessage(data) {
        if (data.gpu) {
            if (data.gpu.current) {
                this.updateGpuStatusFromSocket(data.gpu.current);
            }
            if (data.gpu.history && data.gpu.history.length > 0) {
                this.gpuHistoryData = data.gpu.history.map(item => this.normalizeHistoryPoint(item));
                this.scheduleChartUpdate();
            }
        }
        if (data.models) {
            this.lastModelsData = data.models;
            this.renderUnifiedModels();
        }
    }

    updateGpuStatusFromSocket(gpu) {
        if (!gpu) return;

        const usedMem = Number(gpu.used_memory) || 0;
        const totalMem = Number(gpu.total_memory) || 0;
        const memoryPercent = gpu.memory_utilization || (totalMem > 0 ? (usedMem / totalMem) * 100 : 0);
        const powerPercent = gpu.power_percent || (gpu.power_limit > 0 ? Math.round((gpu.power_draw / gpu.power_limit) * 100) : 0);
        const usedGB = (usedMem / (1024**3)).toFixed(1);
        const totalGB = (totalMem / (1024**3)).toFixed(1);

        this.animateValue('memoryValue', `${usedGB} / ${totalGB} GB`);
        this.animateBar('memoryBar', memoryPercent);
        this.animateValue('memoryPercent', `${Math.round(memoryPercent)}%`);

        this.animateValue('utilValue', `${gpu.utilization || 0}%`);
        this.animateBar('utilBar', gpu.utilization || 0);
        this.animateValue('utilPercent', `${gpu.utilization || 0}%`);

        this.animateValue('tempValue', `${gpu.temperature}°C`);
        this.updateTempColor(gpu.temperature);

        this.animateValue('powerValue', `${gpu.power_draw}W / ${gpu.power_limit}W`);
        this.animateBar('powerBar', powerPercent);
        this.animateValue('powerPercent', `${powerPercent}%`);

        this.animateValue('fanValue', `${gpu.fan_speed || 0}%`);
        this.animateValue('clockValue', `${gpu.clock_sm || 0} MHz`);

        const gpuNameElement = document.getElementById('gpuName');
        if (gpuNameElement) {
            gpuNameElement.innerHTML = `<i class="fas fa-video-card"></i><span>${gpu.name}</span>`;
        }
        
        const statusBadge = document.getElementById('gpuStatusBadge');
        if (statusBadge) {
            const isActive = gpu.utilization > 10;
            statusBadge.className = `gpu-status-badge ${isActive ? 'active' : 'idle'}`;
            statusBadge.innerHTML = `<span class="status-indicator"></span><span>${isActive ? this.i18n.t('gpuMonitor.running') : this.i18n.t('gpuMonitor.idle')}</span>`;
        }

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

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-fade-out');
            setTimeout(() => toast.remove(), 200);
        }, 3000);
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
        const canvas = document.getElementById('gpuChart');
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            this.chart = null;
            return;
        }
        
        if (!this.chart || this.chart.width !== rect.width || this.chart.height !== rect.height) {
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
        ctx.fillText(this.i18n.t('gpuMonitor.noData'), width / 2, height / 2);
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

        const primaryDatasets = datasets.filter(ds => ds.axis !== 'temperature');
        const secondaryDatasets = datasets.filter(ds => ds.axis === 'temperature');
        const primaryValues = primaryDatasets.flatMap(ds => ds.data).filter(v => Number.isFinite(v));
        const secondaryValues = secondaryDatasets.flatMap(ds => ds.data).filter(v => Number.isFinite(v));
        const minValue = this.currentChartType === 'all' ? 0 : (primaryValues.length ? Math.min(...primaryValues) * 0.9 : 0);
        const maxValue = this.currentChartType === 'all' ? 100 : (primaryValues.length ? Math.max(...primaryValues) * 1.1 : 100);
        const secondaryMinValue = 0;
        const secondaryMaxValue = secondaryValues.length ? Math.ceil(Math.max(100, ...secondaryValues) / 10) * 10 : 100;

        this.drawGrid(ctx, chartWidth, chartHeight, padding);
        this.drawAxes(ctx, chartWidth, chartHeight, padding, height, minValue, maxValue, secondaryMinValue, secondaryMaxValue);
        this.drawLines(ctx, chartWidth, chartHeight, padding, datasets, minValue, maxValue, secondaryMinValue, secondaryMaxValue, progress);
        this.drawPoints(ctx, chartWidth, chartHeight, padding, datasets, minValue, maxValue, secondaryMinValue, secondaryMaxValue);
        this.drawLegend(ctx, width, padding);
    }

    getChartDatasets() {
        const datasets = [];
        const maxPoints = this.getMaxRenderPoints();
        
        const t = this.i18n.t.bind(this.i18n);
        if (this.currentChartType === 'utilization' || this.currentChartType === 'all') {
            const rawData = this.gpuHistoryData.map(d => d.utilization);
            datasets.push({
                data: this.downsampleData(rawData, maxPoints),
                color: '#3b82f6',
                label: t('gpuMonitor.gpuUtilization'),
                gradient: this.createGradient('#3b82f6', '#1d4ed8'),
                axis: 'percent'
            });
        }
        
        if (this.currentChartType === 'temperature' || this.currentChartType === 'all') {
            const rawData = this.gpuHistoryData.map(d => d.temperature);
            datasets.push({
                data: this.downsampleData(rawData, maxPoints),
                color: '#ef4444',
                label: t('gpuMonitor.temperature') + '(°C)',
                gradient: this.createGradient('#ef4444', '#dc2626'),
                axis: 'temperature'
            });
        }
        
        if (this.currentChartType === 'memory' || this.currentChartType === 'all') {
            const rawData = this.gpuHistoryData.map(d => d.memory_utilization);
            datasets.push({
            const rawData = this.gpuHistoryData.map(d => d.memory_utilization);
            datasets.push({
                data: this.downsampleData(rawData, maxPoints),
                color: '#f59e0b',
                label: t('gpuMonitor.memoryUtilization'),
                gradient: this.createGradient('#f59e0b', '#d97706'),
                axis: 'percent'
            });
        }
        
        if (this.currentChartType === 'power' || this.currentChartType === 'all') {
            const rawData = this.gpuHistoryData.map(d => d.power_percent || 0);
            datasets.push({
                data: this.downsampleData(rawData, maxPoints),
                color: '#06b6d4',
                label: t('gpuMonitor.power') + '(%)',
                gradient: this.createGradient('#06b6d4', '#0891b2'),
                axis: 'percent',
                dashed: this.currentChartType === 'all'
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

    drawAxes(ctx, chartWidth, chartHeight, padding, minValue, maxValue, secondaryMinValue = 0, secondaryMaxValue = 100) {
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
            const suffix = this.currentChartType === 'temperature' ? '°C' : '%';
            ctx.fillText(`${Math.round(value)}${suffix}`, padding.left - 10, y + 4);
        }

        if (this.currentChartType === 'all') {
            ctx.textAlign = 'left';
            for (let i = 0; i <= gridLines; i++) {
                const y = padding.top + (chartHeight / gridLines) * i;
                const value = secondaryMaxValue - ((secondaryMaxValue - secondaryMinValue) / gridLines) * i;
                ctx.fillText(`${Math.round(value)}°C`, padding.left + chartWidth + 10, y + 4);
            }
        }
        
        ctx.textAlign = 'center';
        const timeLabels = ['-60s', '-45s', '-30s', '-15s', this.i18n.t('gpuMonitor.now')];
        for (let i = 0; i < 5; i++) {
            const x = padding.left + (chartWidth / 4) * i;
            ctx.fillText(timeLabels[i], x, padding.top + chartHeight + 25);
        }
        
        ctx.save();
        ctx.translate(20, this.chart.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText(this.i18n.t('gpuMonitor.value'), 0, 0);
        ctx.restore();
    }

    drawLines(ctx, chartWidth, chartHeight, padding, datasets, minValue, maxValue, secondaryMinValue, secondaryMaxValue, progress) {
        const dataLength = this.gpuHistoryData.length;
        const visibleLength = Math.floor(dataLength * progress);
        
        datasets.forEach(ds => {
            ctx.strokeStyle = ds.color;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.setLineDash(ds.dashed ? [6, 4] : []);
            ctx.beginPath();
            
            const visibleData = ds.data.slice(0, visibleLength);
            
            visibleData.forEach((value, index) => {
                const x = padding.left + (chartWidth / (dataLength - 1)) * index;
                const rangeMin = ds.axis === 'temperature' ? secondaryMinValue : minValue;
                const rangeMax = ds.axis === 'temperature' ? secondaryMaxValue : maxValue;
                const y = padding.top + chartHeight - ((value - rangeMin) / (rangeMax - rangeMin || 1)) * chartHeight;
                
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
                    const rangeMin = ds.axis === 'temperature' ? secondaryMinValue : minValue;
                    const rangeMax = ds.axis === 'temperature' ? secondaryMaxValue : maxValue;
                    const y = padding.top + chartHeight - ((value - rangeMin) / (rangeMax - rangeMin || 1)) * chartHeight;
                    ctx.lineTo(x, y);
                });
                
                ctx.lineTo(padding.left + (chartWidth / (dataLength - 1)) * (visibleLength - 1), padding.top + chartHeight);
                ctx.closePath();
                ctx.fill();
                ctx.globalAlpha = 1;
            }
            ctx.setLineDash([]);
        });
    }

    drawPoints(ctx, chartWidth, chartHeight, padding, datasets, minValue, maxValue, secondaryMinValue, secondaryMaxValue) {
        const dataLength = this.gpuHistoryData.length;
        
        datasets.forEach(ds => {
            const lastValue = ds.data[ds.data.length - 1];
            const x = padding.left + (chartWidth / (dataLength - 1)) * (ds.data.length - 1);
            const rangeMin = ds.axis === 'temperature' ? secondaryMinValue : minValue;
            const rangeMax = ds.axis === 'temperature' ? secondaryMaxValue : maxValue;
            const y = padding.top + chartHeight - ((lastValue - rangeMin) / (rangeMax - rangeMin || 1)) * chartHeight;
            
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
        const t = this.i18n.t.bind(this.i18n);
        const legendItems = [];
        
        if (this.currentChartType === 'utilization' || this.currentChartType === 'all') {
            legendItems.push({ color: '#3b82f6', label: t('gpuMonitor.gpuUtilization') });
        }
        if (this.currentChartType === 'temperature' || this.currentChartType === 'all') {
            legendItems.push({ color: '#ef4444', label: t('gpuMonitor.temperature') + '(°C)' });
        }
        if (this.currentChartType === 'memory' || this.currentChartType === 'all') {
            legendItems.push({ color: '#f59e0b', label: t('gpuMonitor.memoryUtilization') });
        }
        if (this.currentChartType === 'power' || this.currentChartType === 'all') {
            legendItems.push({ color: '#06b6d4', label: t('gpuMonitor.power') + '(%)' });
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

    // startPolling 已移除 - 现在依赖 SystemMonitor 的轮询和事件

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

    debouncedRefresh(force = false) {
        if (this._refreshDebounceTimer) {
            clearTimeout(this._refreshDebounceTimer);
        }
        this._refreshDebounceTimer = setTimeout(() => {
            this.refreshAllStatus(force);
        }, this._refreshDebounceDelay);
    }

    async refreshAllStatus(forceRefresh = false) {
        if (this._isRefreshing) {
            return;
        }
        this._isRefreshing = true;
        try {
            let data = null;
            try {
                data = await monitorCache.getSummary(forceRefresh, this.selectedTimeRange);
            } catch (apiError) {
                console.warn(`[GPUMonitor] API call failed: ${apiError.message}, showing mock data`);
                this.showMockGpuStatus();
                this.showMockModelsStatus();
                this.showMockQueueStatus();
                this.showMockCurrentModel();
                return;
            }

            if (data && data.success) {
                if (data.gpu) {
                    if (data.gpu.primary) {
                        this.updateGpuStatusFromSocket(data.gpu.primary);
                    } else if (data.gpu.gpus && data.gpu.gpus.length > 0) {
                        this.updateGpuStatusFromSocket(data.gpu.gpus[0]);
                    } else if (data.gpu.name) {
                        this.updateGpuStatusFromSocket(data.gpu);
                    }
                    if (data.gpu.history && data.gpu.history.length > 0) {
                        this.gpuHistoryData = data.gpu.history.map(item => this.normalizeHistoryPoint(item));
                        this.scheduleChartUpdate();
                    }
                }
                if (data.models) {
                    this.lastModelsData = data.models;
                    console.log('[GPUMonitor] Set lastModelsData from data.models:', Object.keys(data.models).length, 'models');
                }
                if (data.queue) {
                    const container = document.getElementById('queueStatusContent');
                    if (container) this.renderQueueStatus(data.queue, container);
                    this.lastQueueData = data.queue;
                }
                if (data.summary) {
                    this.currentModel = this.resolveCurrentModelFromSummary(data.summary);
                    this.renderCurrentModel();
                    if (data.summary.models) {
                        this.lastModelsData = data.summary.models;
                        console.log('[GPUMonitor] Set lastModelsData from data.summary.models:', data.summary.models.length, 'models');
                    }
                }
                this.renderUnifiedModels();
            } else {
                console.warn('[GPUMonitor] API returned unsuccessful response, showing mock data');
                this.showMockGpuStatus();
                this.showMockModelsStatus();
                this.showMockQueueStatus();
                this.showMockCurrentModel();
            }
        } catch (error) {
            console.warn(`Failed to fetch monitor summary:`, error);
            this.showMockGpuStatus();
            this.showMockModelsStatus();
            this.showMockQueueStatus();
            this.showMockCurrentModel();
        } finally {
            this._isRefreshing = false;
        }
    }

    async refreshCurrentModel() {
        try {
            const cachedData = monitorCache.getCachedData('summary');
            let data = null;

            if (cachedData) {
                data = cachedData;
            } else {
                data = await monitorCache.getModelsSummary();
            }

            if (data && (data.running_model || (data.models && data.models.length > 0))) {
                this.currentModel = this.resolveCurrentModelFromSummary(data);
            } else {
                this.currentModel = null;
            }
            this.renderCurrentModel();
        } catch (error) {
            console.warn(`Failed to fetch current model: ${error.message}`);
            this.currentModel = null;
            this.renderCurrentModel();
        }
    }

    renderCurrentModel() {
        const container = document.getElementById('currentModelInfo');
        if (!container) return;

        const t = this.i18n.t.bind(this.i18n);
        const currentModel = typeof this.currentModel === 'object' ? this.currentModel : { name: this.currentModel };
        const currentModelName = currentModel?.name;
        const meta = [];

        if (currentModel?.port) {
            meta.push(`<span class="current-model-meta"><i class="fas fa-server"></i> ${currentModel.port}</span>`);
        }
        if (currentModel?.required_memory || currentModel?.memory) {
            meta.push(`<span class="current-model-meta"><i class="fas fa-memory"></i> ${currentModel.required_memory || currentModel.memory}</span>`);
        }

        container.innerHTML = `
            <div class="current-model-info">
                <div class="current-model-label">${t('gpuMonitor.currentModel')}</div>
                <div class="current-model-value">
                    ${currentModelName ? `<span class="model-name">${currentModelName}</span>` : `<span class="no-model">-</span>`}
                    ${meta.join('')}
                </div>
            </div>
        `;
    }

    async checkControllerConnection() {
        const statusElement = document.getElementById('controllerConnectionStatus');
        const iframe = document.getElementById('controllerIframe');
        const placeholder = document.getElementById('iframePlaceholder');

        try {
            const healthData = await monitorCache.getHealth();
            let controllerBaseUrl = healthData?.controllerUrl || healthData?.url || 'http://localhost:5000';

            if (healthData && (healthData.status === 'healthy' || healthData.success)) {
                this.animateStatusChange(statusElement, true);

                if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                    const portMatch = controllerBaseUrl.match(/:(\d+)$/);
                    const controllerPort = portMatch ? portMatch[1] : '5000';
                    controllerBaseUrl = `${window.location.protocol}//${window.location.hostname}:${controllerPort}`;
                }

                if (iframe && placeholder) {
                    iframe.src = `${controllerBaseUrl}/docs`;
                    placeholder.style.display = 'none';
                    iframe.style.display = 'block';
                }
            } else {
                throw new Error('Controller not healthy');
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
            element.innerHTML = `<i class="fas fa-circle"></i> <span>${isOnline ? this.i18n.t('gpuMonitor.connected') : this.i18n.t('gpuMonitor.disconnected')}</span>`;
        }, 50);
    }

    async refreshGpuStatus() {
        try {
            const cachedData = monitorCache.getCachedData('gpuStatus');
            let result = null;

            if (cachedData && cachedData.status) {
                result = cachedData;
            } else {
                result = await monitorCache.getGpuStatus();
            }

            if (!result || !result.success) {
                throw new Error(result?.error || 'Failed to get GPU status');
            }
            if (result.primary) {
                this.updateGpuStatusFromSocket(result.primary);
            } else if (result.gpus && result.gpus.length > 0) {
                this.updateGpuStatusFromSocket(result.gpus[0]);
            } else if (result.status === 'available') {
                this.updateGpuStatusFromSocket(result);
            } else if (result.name) {
                this.updateGpuStatusFromSocket(result);
            }
        } catch (error) {
            console.warn(`Failed to fetch GPU status: ${error.message}`);
            this.showMockGpuStatus();
        }
    }

    async refreshModelsStatus() {
        try {
            const cachedData = monitorCache.getCachedData('modelsStatus');
            let models = null;

            if (cachedData && cachedData.models) {
                models = cachedData.models;
            } else {
                const result = await monitorCache.getModelsStatus();
                if (result && result.success) {
                    models = result.models;
                } else {
                    throw new Error(result?.error || 'Failed to get models status');
                }
            }

            if (models) {
                this.lastModelsData = models;
                this.renderUnifiedModels();
            }
        } catch (error) {
            console.warn(`Failed to fetch models status: ${error.message}`);
            this.showMockModelsStatus();
        }
    }

    renderModelsStatus(data, container) {
        const t = this.i18n.t.bind(this.i18n);
        if (!data || Object.keys(data).length === 0) {
            container.innerHTML = `
                <div class="status-loading">
                    <i class="fas fa-info-circle"></i>
                    <span>${t('gpuMonitor.noConfiguredModels')}</span>
                </div>
            `;
            return;
        }

        const items = Object.entries(data).map(([name, status]) => `
            <div class="model-status-item">
                <div class="model-info">
                    <span class="model-name">${name}</span>
                    ${status.active_requests > 0 ? `
                        <span class="model-requests">${status.active_requests} ${t('gpuMonitor.requesting')}</span>
                    ` : ''}
                </div>
                <div class="model-status">
                    <span class="status-indicator ${status.running ? 'running' : 'stopped'}"></span>
                    <span>${status.running ? t('gpuMonitor.running') : t('gpuMonitor.stopped')}</span>
                </div>
            </div>
        `).join('');

        container.innerHTML = `<div class="model-status-grid">${items}</div>`;
    }

    normalizeModelsForWorkbench(models) {
        if (!models) return [];

        const list = Array.isArray(models)
            ? models
            : Object.entries(models).map(([name, status]) => ({ name, ...status }));

        return list.map((model, index) => {
            const safeName = model.name || model.model_name || `model-${index}`;
            const activeRequests = Number(model.active_requests ?? model.activeRequests ?? 0);
            const port = model.port ?? model.modelPort ?? '-';
            const memory = model.required_memory ?? model.memory ?? model.modelMemory ?? '-';
            const description = model.description || model.desc || '';
            const preloaded = model.preloaded ?? model.warmup ?? false;
            const running = Boolean(model.running);
            const queueInfo = this.lastQueueData?.[safeName];

            return {
                name: safeName,
                running,
                port,
                memory,
                description,
                preloaded,
                activeRequests,
                canAccept: queueInfo?.can_accept ?? model.can_accept ?? null,
                concurrencyLimit: queueInfo?.concurrency_limit ?? model.concurrency_limit ?? null,
                remainingSlots: queueInfo ? queueInfo.concurrency_limit - queueInfo.active_requests : null
            };
        }).sort((left, right) => {
            if (left.running === right.running) {
                return left.name.localeCompare(right.name);
            }
            return left.running ? -1 : 1;
        });
    }

    renderUnifiedModels() {
        const container = document.getElementById('quickSwitchContent');
        if (!container) {
            console.warn('[GPUMonitor] quickSwitchContent container not found');
            return;
        }

        console.log('[GPUMonitor] Rendering unified models, data:', this.lastModelsData);
        this.renderQuickSwitch(this.lastModelsData, container);
    }

    async refreshQueueStatus() {
        const container = document.getElementById('queueStatusContent');
        if (!container) return;

        try {
            const cachedData = monitorCache.getCachedData('queueStatus');
            let queue = null;

            if (cachedData && cachedData.queue) {
                queue = cachedData.queue;
            } else {
                const result = await monitorCache.getQueueStatus();
                if (result && result.success) {
                    queue = result.queue;
                } else {
                    throw new Error(result?.error || 'Failed to get queue status');
                }
            }

            if (queue) {
                this.renderQueueStatus(queue, container);
            }
        } catch (error) {
            console.warn(`Failed to fetch queue status: ${error.message}`);
            const t = this.i18n.t.bind(this.i18n);
            container.innerHTML = `
                <div class="status-loading">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${t('gpuMonitor.cannotGetQueueStatus')}</span>
                </div>
            `;
        }
    }

    renderQueueStatus(data, container) {
        const t = this.i18n.t.bind(this.i18n);
        if (!data || Object.keys(data).length === 0) {
            container.innerHTML = `
                <div class="status-loading">
                    <i class="fas fa-info-circle"></i>
                    <span>${t('gpuMonitor.noQueueInfo')}</span>
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
                    <div class="queue-label">${t('gpuMonitor.activeRequests')}</div>
                </div>
                <div class="queue-card">
                    <div class="queue-icon"><i class="fas fa-gauge"></i></div>
                    <div class="queue-value">${totalLimit}</div>
                    <div class="queue-label">${t('gpuMonitor.concurrencyLimit')}</div>
                </div>
                <div class="queue-card">
                    <div class="queue-icon"><i class="fas fa-check-circle"></i></div>
                    <div class="queue-value ${canAccept ? 'success' : 'danger'}">${canAccept ? t('gpuMonitor.yes') : t('gpuMonitor.no')}</div>
                    <div class="queue-label">${t('gpuMonitor.canAcceptNew')}</div>
                </div>
                <div class="queue-card">
                    <div class="queue-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="queue-value">${totalLimit - totalActive}</div>
                    <div class="queue-label">${t('gpuMonitor.remainingSlots')}</div>
                </div>
            </div>
        `;
    }

    async refreshModelControls() {
        try {
            const cachedData = monitorCache.getCachedData('modelsStatus');
            let models = null;

            if (cachedData && cachedData.models) {
                models = cachedData.models;
            } else {
                const result = await monitorCache.getModelsStatus();
                if (result && result.success) {
                    models = result.models;
                } else {
                    throw new Error(result?.error || 'Failed to get model controls');
                }
            }

            if (models) {
                this.lastModelsData = models;
                this.renderUnifiedModels();
            }
        } catch (error) {
            console.warn(`Failed to fetch model controls: ${error.message}`);
            this.showMockQuickSwitch();
        }
    }

    async startModel(modelName) {
        try {
            const token = window.authManager ? window.authManager.getToken() : null;
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(formatPath(API_PATHS.PYTHON.MODELS.START, { modelName }), {
                method: 'POST',
                headers
            });

            const result = await response.json();
            if (result.success) {
                console.log(`Model ${modelName} started successfully`);
                monitorCache.invalidateCache();
                await this.refreshAllStatus();
            } else {
                throw new Error(result.error?.message || 'Failed to start model');
            }
        } catch (error) {
            console.error(`Failed to start model ${modelName}: ${error.message}`);
            alert(`${this.i18n.t('gpuMonitor.startModelFailed')}: ${error.message}`);
        }
    }

    async stopModel(modelName) {
        try {
            const token = window.authManager ? window.authManager.getToken() : null;
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(formatPath(API_PATHS.PYTHON.MODELS.STOP, { modelName }), {
                method: 'POST',
                headers
            });

            const result = await response.json();
            if (result.success) {
                console.log(`Model ${modelName} stopped successfully`);
                monitorCache.invalidateCache();
                await this.refreshAllStatus();
            } else {
                throw new Error(result.error?.message || 'Failed to stop model');
            }
        } catch (error) {
            console.error(`Failed to stop model ${modelName}: ${error.message}`);
            alert(`${this.i18n.t('gpuMonitor.stopModelFailed')}: ${error.message}`);
        }
    }

    async switchModel(modelName) {
        try {
            const token = window.authManager ? window.authManager.getToken() : null;
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(formatPath(API_PATHS.PYTHON.TEST.SWITCH_AND_TEST, { modelName }), {
                method: 'POST',
                headers
            });

            const result = await response.json();
            if (result.success) {
                console.log(`Switched to model ${modelName} successfully`);
                monitorCache.invalidateCache();
                if (result.status === 'completed' && result.report) {
                    this.testReport = result.report;
                    this.showTestReport();
                }
                await this.refreshAllStatus();
            } else {
                throw new Error(result.error?.message || 'Failed to switch model');
            }
        } catch (error) {
            console.error(`Failed to switch model ${modelName}: ${error.message}`);
            alert(`${this.i18n.t('gpuMonitor.switchModelFailed')}: ${error.message}`);
        }
    }

    async runModelTest(modelName) {
        try {
            const token = window.authManager ? window.authManager.getToken() : null;
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(formatPath(API_PATHS.PYTHON.TEST.MODEL, { modelName }), {
                method: 'POST',
                headers
            });

            const result = await response.json();
            if (result.success) {
                if (result.status === 'completed' && result.report) {
                    this.testReport = result.report;
                    this.showTestReport();
                }
            } else {
                throw new Error(result.error?.message || 'Failed to test model');
            }
        } catch (error) {
            console.error(`Failed to test model ${modelName}: ${error.message}`);
            alert(`${this.i18n.t('gpuMonitor.testModelFailed')}: ${error.message}`);
        }
    }

    showTestReport() {
        if (!this.testReport) return;

        const reportHTML = this.generateReportHTML();
        
        const modal = document.createElement('div');
        modal.className = 'test-report-modal-overlay';
        modal.innerHTML = reportHTML;
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('modal-close')) {
                document.body.removeChild(modal);
            }
        });

        document.addEventListener('keydown', function closeModal(e) {
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
                document.removeEventListener('keydown', closeModal);
            }
        });
    }

    generateReportHTML() {
        const report = this.testReport;
        const t = this.i18n.t.bind(this.i18n);
        
        const getStatusClass = (status) => {
            switch (status) {
                case 'passed': return 'success';
                case 'degraded': return 'warning';
                case 'failed': return 'error';
                default: return 'info';
            }
        };

        const getStatusText = (status) => {
            switch (status) {
                case 'passed': return t('gpuMonitor.allPassed');
                case 'degraded': return t('gpuMonitor.partialFailed');
                case 'failed': return t('gpuMonitor.testFailed');
                default: return status;
            }
        };

        const getFeatureText = (feature) => {
            switch (feature) {
                case 'image': return t('gpuMonitor.imageProcessing');
                case 'tools': return t('gpuMonitor.toolCalls');
                case 'chat': return t('gpuMonitor.chatInteraction');
                default: return feature;
            }
        };

        const getTestName = (testName) => {
            switch (testName) {
                case 'chat_basic': return t('gpuMonitor.basicChatTest');
                case 'chat_streaming': return t('gpuMonitor.streamingTest');
                case 'tool_integration': return t('gpuMonitor.toolIntegrationTest');
                case 'image_processing': return t('gpuMonitor.imageProcessingTest');
                default: return testName;
            }
        };

        const featureGrid = Object.entries(report.feature_support).map(([feature, supported]) => `
            <div class="feature-item ${supported ? 'supported' : 'not-supported'}">
                <i class="fas ${supported ? 'fa-check' : 'fa-times'}"></i>
                <span>${getFeatureText(feature)}</span>
            </div>
        `).join('');

        const testResults = report.test_results.map(result => `
            <div class="test-result-item ${result.status}">
                <div class="test-header">
                    <span class="test-name">${getTestName(result.test_name)}</span>
                    <span class="result-badge ${result.status}">${result.status === 'passed' ? t('gpuMonitor.passed') : result.status === 'failed' ? t('gpuMonitor.failed') : t('gpuMonitor.skipped')}</span>
                </div>
                <div class="test-details">
                    <span class="test-duration">${t('gpuMonitor.duration')}: ${result.duration.toFixed(3)}s</span>
                    ${result.metrics.tps ? `<span class="test-tps">TPS: ${result.metrics.tps.toFixed(2)}</span>` : ''}
                </div>
                ${result.error ? `<div class="test-error"><i class="fas fa-exclamation-triangle"></i> ${result.error}</div>` : ''}
                ${result.details ? `<div class="test-details-text">${result.details}</div>` : ''}
            </div>
        `).join('');

        const errorsList = report.errors?.map((error) => `
            <div class="error-item"><i class="fas fa-times-circle"></i> ${error}</div>
        `).join('');

        const warningsList = report.warnings?.map((warning) => `
            <div class="warning-item"><i class="fas fa-exclamation-circle"></i> ${warning}</div>
        `).join('');

        return `
            <div class="test-report-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-file-report"></i> ${t('gpuMonitor.modelTestReport')}</h3>
                    <button class="modal-close"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <div class="report-header">
                        <div class="model-info">
                            <span class="model-name">${report.model_name}</span>
                            <span class="test-time">${report.test_timestamp}</span>
                        </div>
                        <span class="status-badge ${getStatusClass(report.overall_status)}">${getStatusText(report.overall_status)}</span>
                    </div>

                    <div class="report-sections">
                        <div class="report-section">
                            <h4><i class="fas fa-check-circle"></i> ${t('gpuMonitor.featureSupport')}</h4>
                            <div class="feature-grid">${featureGrid}</div>
                        </div>

                        <div class="report-section">
                            <h4><i class="fas fa-chart-line"></i> ${t('gpuMonitor.performanceMetrics')}</h4>
                            <div class="metrics-grid">
                                <div class="metric-item">
                                    <div class="metric-value">${report.performance_metrics?.overall?.avg_tps?.toFixed(2) || '0'}</div>
                                    <div class="metric-label">${t('gpuMonitor.avgTps')}</div>
                                </div>
                                <div class="metric-item">
                                    <div class="metric-value">${report.performance_metrics?.overall?.avg_latency?.toFixed(3) || '0'}s</div>
                                    <div class="metric-label">${t('gpuMonitor.avgLatency')}</div>
                                </div>
                                <div class="metric-item">
                                    <div class="metric-value">${report.performance_metrics?.overall?.pass_rate?.toFixed(1) || '0'}%</div>
                                    <div class="metric-label">${t('gpuMonitor.passRate')}</div>
                                </div>
                            </div>
                        </div>

                        <div class="report-section">
                            <h4><i class="fas fa-server"></i> ${t('gpuMonitor.resourceUsage')}</h4>
                            <div class="resource-grid">
                                <div class="resource-item">
                                    <div class="resource-header">CPU</div>
                                    <div class="resource-info">
                                        <span>${t('gpuMonitor.avg')}: ${report.resource_utilization?.cpu?.avg_percent || '0'}%</span>
                                    </div>
                                </div>
                                <div class="resource-item">
                                    <div class="resource-header">${t('gpuMonitor.memory')}</div>
                                    <div class="resource-info">
                                        <span>${t('gpuMonitor.change')}: ${report.resource_utilization?.memory?.delta_mb > 0 ? '+' : ''}${report.resource_utilization?.memory?.delta_mb || '0'} MB</span>
                                    </div>
                                </div>
                                ${report.resource_utilization?.gpu?.available ? `
                                <div class="resource-item">
                                    <div class="resource-header">GPU</div>
                                    <div class="resource-info">
                                        <span>${t('gpuMonitor.utilization')}: ${report.resource_utilization?.gpu?.end_utilization || '0'}%</span>
                                        <span>${t('gpuMonitor.temperature')}: ${report.resource_utilization?.gpu?.end_temperature || '0'}°C</span>
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                        </div>

                        <div class="report-section">
                            <h4><i class="fas fa-list-check"></i> ${t('gpuMonitor.testResultsDetail')}</h4>
                            <div class="test-results-list">${testResults}</div>
                        </div>

                        ${(errorsList || warningsList) ? `
                        <div class="report-section">
                            <h4><i class="fas fa-alert-triangle"></i> ${t('gpuMonitor.warningsAndErrors')}</h4>
                            ${errorsList ? `<div class="errors-list">${errorsList}</div>` : ''}
                            ${warningsList ? `<div class="warnings-list">${warningsList}</div>` : ''}
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    async refreshPythonServiceStatus() {
        const container = document.getElementById('pythonServiceStatus');
        if (!container) return;

        try {
            let result = null;

            const cachedData = monitorCache.getCachedData('serviceStatus');
            if (cachedData) {
                result = cachedData;
            } else {
                result = await monitorCache.getServiceStatus();
            }

            if (result && result.success) {
                this.renderPythonServiceStatus(result, container);
            } else {
                throw new Error(result?.error?.message || 'Failed to get service status');
            }
        } catch (error) {
            console.warn(`Failed to fetch Python service status: ${error.message}`);
            this.showMockPythonServiceStatus();
        }
    }

    renderPythonServiceStatus(data, container) {
        const t = this.i18n.t.bind(this.i18n);
        const isRunning = data.running;
        const status = data.status || 'unknown';
        const serviceName = data.service || 'aiclient-python';
        const configFile = data.config_file || 'config.yaml';

        container.innerHTML = `
            <div class="service-info-grid">
                <div class="service-info-card">
                    <div class="service-info-label">${t('gpuMonitor.serviceName')}</div>
                    <div class="service-info-value">${serviceName}</div>
                </div>
                <div class="service-info-card">
                    <div class="service-info-label">${t('gpuMonitor.runStatus')}</div>
                    <div class="service-info-value ${isRunning ? 'running' : 'stopped'}">
                        <i class="fas ${isRunning ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                        ${isRunning ? t('gpuMonitor.running') : t('gpuMonitor.stopped')}
                    </div>
                </div>
                <div class="service-info-card">
                    <div class="service-info-label">systemd ${t('gpuMonitor.status')}</div>
                    <div class="service-info-value">${status}</div>
                </div>
                <div class="service-info-card">
                    <div class="service-info-label">${t('gpuMonitor.configFile')}</div>
                    <div class="service-info-value" style="font-size: 0.75rem; word-break: break-all;">${configFile}</div>
                </div>
            </div>
        `;

        this.updateServiceButtons(isRunning);
    }

    updateServiceButtons(isRunning) {
        const startBtn = document.getElementById('startPythonServiceBtn');
        const stopBtn = document.getElementById('stopPythonServiceBtn');
        const restartBtn = document.getElementById('restartPythonServiceBtn');

        if (startBtn) startBtn.disabled = isRunning;
        if (stopBtn) stopBtn.disabled = !isRunning;
        if (restartBtn) restartBtn.disabled = !isRunning;
    }

    async startPythonService() {
        try {
            const token = window.authManager ? window.authManager.getToken() : null;
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(API_PATHS.PYTHON_GPU.SERVICE.START, {
                method: 'POST',
                headers
            });

            const result = await response.json();
            if (result.success) {
                console.log('Python service started successfully');
                monitorCache.invalidateCache();
                await this.refreshPythonServiceStatus();
                setTimeout(() => this.refreshAllStatus(), 3000);
            } else {
                throw new Error(result.error?.message || 'Failed to start service');
            }
        } catch (error) {
            console.error(`Failed to start Python service: ${error.message}`);
            alert(`${this.i18n.t('gpuMonitor.startFailed')}: ${error.message}`);
        }
    }

    async stopPythonService() {
        try {
            const token = window.authManager ? window.authManager.getToken() : null;
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(API_PATHS.PYTHON_GPU.SERVICE.STOP, {
                method: 'POST',
                headers
            });

            const result = await response.json();
            if (result.success) {
                console.log('Python service stopped successfully');
                monitorCache.invalidateCache();
                await this.refreshPythonServiceStatus();
            } else {
                throw new Error(result.error?.message || 'Failed to stop service');
            }
        } catch (error) {
            console.error(`Failed to stop Python service: ${error.message}`);
            alert(`${this.i18n.t('gpuMonitor.stopFailed')}: ${error.message}`);
        }
    }

    async restartPythonService() {
        try {
            const token = window.authManager ? window.authManager.getToken() : null;
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(API_PATHS.PYTHON_GPU.SERVICE.RESTART, {
                method: 'POST',
                headers
            });

            const result = await response.json();
            if (result.success) {
                console.log('Python service restarted successfully');
                monitorCache.invalidateCache();
                await this.refreshPythonServiceStatus();
                setTimeout(() => this.refreshAllStatus(), 5000);
            } else {
                throw new Error(result.error?.message || 'Failed to restart service');
            }
        } catch (error) {
            console.error(`Failed to restart Python service: ${error.message}`);
            alert(`${this.i18n.t('gpuMonitor.restartFailed')}: ${error.message}`);
        }
    }

    async refreshConfig() {
        const container = document.getElementById('configContent');
        if (!container) return;

        try {
            let config = null;

            const cachedData = monitorCache.getCachedData();
            if (cachedData && cachedData.service && cachedData.service.config) {
                config = cachedData.service.config;
            } else {
                const token = window.authManager ? window.authManager.getToken() : null;
                const headers = {};
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                const response = await fetch(API_PATHS.PYTHON_GPU.SERVICE.STATUS, {
                    method: 'GET',
                    headers,
                    timeout: 5000
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                if (result.success && result.config) {
                    config = result.config;
                } else {
                    throw new Error(result.error?.message || 'Failed to get config');
                }
            }

            if (config) {
                this.renderConfig(config, container);
            }
        } catch (error) {
            console.warn(`Failed to fetch config: ${error.message}`);
            this.showMockConfig();
        }
    }

    renderConfig(config, container) {
        const t = this.i18n.t.bind(this.i18n);
        if (!config) {
            container.innerHTML = `
                <div class="status-loading">
                    <i class="fas fa-info-circle"></i>
                    <span>${t('gpuMonitor.noConfig')}</span>
                </div>
            `;
            return;
        }

        let html = '';

        if (config.models) {
            html += `<div class="config-section">
                <div class="config-section-header"><i class="fas fa-cubes"></i> ${t('gpuMonitor.modelConfig')} (${Object.keys(config.models).length})</div>`;
            Object.entries(config.models).forEach(([name, modelConfig]) => {
                const isRunning = modelConfig.running !== undefined ? modelConfig.running : false;
                const port = modelConfig.port || '-';
                const memory = modelConfig.required_memory || '-';
                const supportsImages = modelConfig.supports_images ? t('gpuMonitor.yes') : t('gpuMonitor.no');
                html += `
                    <div class="config-item">
                        <div>
                            <div class="config-item-label">${name}</div>
                            <div style="font-size: 0.7rem; color: var(--text-muted);">${t('gpuMonitor.port')}: ${port} | ${t('gpuMonitor.memory')}: ${memory} | ${t('gpuMonitor.multimodal')}: ${supportsImages}</div>
                        </div>
                        <span class="status-indicator ${isRunning ? 'running' : 'stopped'}"></span>
                    </div>
                `;
            });
            html += `</div>`;
        }

        if (config.settings) {
            html += `<div class="config-section">
                <div class="config-section-header"><i class="fas fa-sliders-h"></i> ${t('gpuMonitor.globalSettings')}</div>`;
            
            const settings = config.settings;
            const settingItems = [
                { label: t('gpuMonitor.concurrencyLimit'), value: settings.concurrency_limit || '-' },
                { label: t('gpuMonitor.maxQueueLength'), value: settings.max_queue_length || '-' },
                { label: t('gpuMonitor.requestTimeout'), value: settings.request_timeout || '-' },
                { label: t('gpuMonitor.warmupModel'), value: settings.warmup_model || '-' }
            ];
            
            settingItems.forEach(item => {
                html += `
                    <div class="config-item">
                        <div class="config-item-label">${item.label}</div>
                        <div class="config-item-value">${item.value}</div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        container.innerHTML = html || `
            <div class="status-loading">
                <i class="fas fa-info-circle"></i>
                <span>${t('gpuMonitor.noConfigInfo')}</span>
            </div>
        `;
    }

    showConfigEditor() {
        const modal = document.getElementById('configEditorModal');
        const textarea = document.getElementById('configEditorTextarea');
        if (modal && textarea) {
            modal.style.display = 'flex';
        }
    }

    async saveConfig() {
        const modal = document.getElementById('configEditorModal');
        const textarea = document.getElementById('configEditorTextarea');
        if (!modal || !textarea) return;

        const configContent = textarea.value;
        
        try {
            const token = window.authManager ? window.authManager.getToken() : null;
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(API_PATHS.PYTHON_GPU.CONFIG, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ config: configContent })
            });

            const result = await response.json();
            if (result.success) {
                this.showToast(this.i18n.t('gpuMonitor.configSaved'), 'success');
                modal.style.display = 'none';
                await this.refreshConfig();
            } else {
                throw new Error(result.error?.message || this.i18n.t('gpuMonitor.configSaveFailed'));
            }
        } catch (error) {
            console.error('Failed to save config:', error.message);
            this.showToast(`${this.i18n.t('gpuMonitor.configSaveFailed')}: ${error.message}`, 'error');
        }
    }

    async refreshQuickSwitch() {
        const container = document.getElementById('quickSwitchContent');
        if (!container) return;

        try {
            let models = null;

            const cachedData = monitorCache.getCachedData('modelsStatus');
            if (cachedData && cachedData.models) {
                const modelList = [];
                for (const [name, status] of Object.entries(cachedData.models)) {
                    modelList.push({
                        name,
                        running: status.running,
                        port: status.port,
                        preloaded: status.preloaded,
                        required_memory: status.required_memory,
                        description: status.description
                    });
                }
                models = modelList;
            } else {
                const result = await monitorCache.getModelsStatus();
                if (result && result.success) {
                    const modelList = [];
                    for (const [name, status] of Object.entries(result.models)) {
                        modelList.push({
                            name,
                            running: status.running,
                            port: status.port,
                            preloaded: status.preloaded,
                            required_memory: status.required_memory,
                            description: status.description
                        });
                    }
                    models = modelList;
                } else {
                    throw new Error(result?.error || 'Failed to get models');
                }
            }

            if (models) {
                this.renderQuickSwitch(models, container);
            }
        } catch (error) {
            console.warn(`Failed to fetch quick switch models: ${error.message}`);
            this.showMockQuickSwitch();
        }
    }

    renderQuickSwitch(models, container) {
        const t = this.i18n.t.bind(this.i18n);
        const modelList = this.normalizeModelsForWorkbench(models);
        console.log('[GPUMonitor] renderQuickSwitch - normalized models:', modelList.length, modelList);

        if (modelList.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-cubes"></i>
                    <p>${t('gpuMonitor.noModelsAvailable')}</p>
                    <p class="hint">${t('gpuMonitor.noModelsHint')}</p>
                </div>
            `;
            return;
        }

        const currentModelName = typeof this.currentModel === 'object' ? this.currentModel?.name : this.currentModel;

        const items = modelList.map((model) => {
            const name = model.name;
            const isCurrentModel = currentModelName === name;
            return `
            <div class="model-switch-item ${model.running ? 'is-running' : ''}">
                <div class="model-switch-header">
                    <div>
                        <div class="model-switch-name">${name}</div>
                        ${model.description ? `<div class="model-switch-subtitle">${model.description}</div>` : ''}
                    </div>
                    <span class="model-switch-status ${(isCurrentModel || model.running) ? 'status-running' : 'status-stopped'}">
                        <i class="fas ${(isCurrentModel || model.running) ? 'fa-circle-play' : 'fa-circle'}"></i>
                        ${isCurrentModel ? t('gpuMonitor.currentModel') : (model.running ? t('gpuMonitor.running') : t('gpuMonitor.stopped'))}
                    </span>
                </div>

                <div class="model-switch-details">
                    <div class="model-detail-pill">
                        <span class="model-detail-label">${t('gpuMonitor.port')}</span>
                        <span class="model-detail-value">${model.port}</span>
                    </div>
                    <div class="model-detail-pill">
                        <span class="model-detail-label">${t('gpuMonitor.memory')}</span>
                        <span class="model-detail-value">${model.memory}</span>
                    </div>
                    <div class="model-detail-pill">
                        <span class="model-detail-label">${t('gpuMonitor.activeRequests')}</span>
                        <span class="model-detail-value">${model.activeRequests}</span>
                    </div>
                    <div class="model-detail-pill">
                        <span class="model-detail-label">${t('gpuMonitor.concurrencyLimit')}</span>
                        <span class="model-detail-value">${model.concurrencyLimit ?? '-'}</span>
                    </div>
                    <div class="model-detail-pill">
                        <span class="model-detail-label">${t('gpuMonitor.remainingSlots')}</span>
                        <span class="model-detail-value">${model.remainingSlots ?? '-'}</span>
                    </div>
                    <div class="model-detail-pill">
                        <span class="model-detail-label">${t('gpuMonitor.preloaded')}</span>
                        <span class="model-detail-value">${model.preloaded ? t('gpuMonitor.yes') : t('gpuMonitor.no')}</span>
                    </div>
                </div>

                <div class="model-switch-actions">
                    ${isCurrentModel ? `
                        <button class="btn btn-danger btn-sm" onclick="window.GPUMonitor.stopModel('${name}')">
                            <i class="fas fa-stop"></i> ${t('gpuMonitor.stop')}
                        </button>
                        <button class="btn btn-info btn-sm" onclick="window.GPUMonitor.runModelTest('${name}')">
                            <i class="fas fa-flask"></i> ${t('gpuMonitor.test')}
                        </button>
                    ` : model.running ? `
                        <button class="btn btn-danger btn-sm" onclick="window.GPUMonitor.stopModel('${name}')">
                            <i class="fas fa-stop"></i> ${t('gpuMonitor.stop')}
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="window.GPUMonitor.switchModel('${name}')">
                            <i class="fas fa-exchange-alt"></i> ${t('gpuMonitor.switch')}
                        </button>
                        <button class="btn btn-info btn-sm" onclick="window.GPUMonitor.runModelTest('${name}')">
                            <i class="fas fa-flask"></i> ${t('gpuMonitor.test')}
                        </button>
                    ` : `
                        <button class="btn btn-success btn-sm" onclick="window.GPUMonitor.startModel('${name}')">
                            <i class="fas fa-play"></i> ${t('gpuMonitor.start')}
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="window.GPUMonitor.switchModel('${name}')">
                            <i class="fas fa-right-left"></i> ${t('gpuMonitor.switchAndTest')}
                        </button>
                    `}
                </div>
            </div>
        `;
        }).join('');

        container.innerHTML = `<div class="models-switch-list">${items}</div>`;
    }

    showMockGpuStatus() {
        const mockData = {
            name: 'GPU未连接',
            used_memory: 0,
            total_memory: 0,
            temperature: 0,
            utilization: 0,
            power_draw: 0,
            power_limit: 0,
            fan_speed: 0,
            clock_sm: 0
        };
        this.updateGpuStatusFromSocket(mockData);
    }

    showMockModelsStatus() {
        this.lastModelsData = {
            'Qwen/Qwen2-7B-Instruct': { running: false, active_requests: 0 },
            'Qwen/Qwen2-14B-Instruct': { running: true, active_requests: 2, port: 8001, preloaded: true, required_memory: '24GB' },
            'Qwen/Qwen2-72B-Instruct': { running: false, active_requests: 0, port: 8002, preloaded: false, required_memory: '80GB' }
        };
        this.renderUnifiedModels();
    }

    showMockQueueStatus() {
        const container = document.getElementById('queueStatusContent');
        if (!container) return;
        
        const mockQueue = {
            'Qwen/Qwen2-14B-Instruct': {
                active_requests: 2,
                concurrency_limit: 4,
                can_accept: true
            }
        };
        this.lastQueueData = mockQueue;
        this.renderQueueStatus(mockQueue, container);
    }

    showMockPythonServiceStatus() {
        const container = document.getElementById('pythonServiceStatus');
        if (!container) return;
        
        const t = this.i18n.t.bind(this.i18n);
        container.innerHTML = `
            <div class="service-info-grid">
                <div class="service-info-card">
                    <div class="service-info-label">${t('gpuMonitor.serviceName')}</div>
                    <div class="service-info-value">aiclient-python</div>
                </div>
                <div class="service-info-card">
                    <div class="service-info-label">${t('gpuMonitor.runStatus')}</div>
                    <div class="service-info-value stopped">
                        <i class="fas fa-times-circle"></i>
                        ${t('gpuMonitor.stopped')}
                    </div>
                </div>
                <div class="service-info-card">
                    <div class="service-info-label">systemd ${t('gpuMonitor.status')}</div>
                    <div class="service-info-value">inactive</div>
                </div>
                <div class="service-info-card">
                    <div class="service-info-label">${t('gpuMonitor.configFile')}</div>
                    <div class="service-info-value" style="font-size: 0.75rem; word-break: break-all;">config.yaml</div>
                </div>
            </div>
        `;
        this.updateServiceButtons(false);
    }

    showMockConfig() {
        const container = document.getElementById('configContent');
        if (!container) return;
        
        const t = this.i18n.t.bind(this.i18n);
        const mockConfig = {
            models: {
                'Qwen/Qwen2-7B-Instruct': { port: 8000, required_memory: '16GB', supports_images: true },
                'Qwen/Qwen2-14B-Instruct': { port: 8001, required_memory: '24GB', supports_images: true },
                'Qwen/Qwen2-72B-Instruct': { port: 8002, required_memory: '80GB', supports_images: false }
            },
            settings: {
                concurrency_limit: 4,
                max_queue_length: 100,
                request_timeout: 60,
                warmup_model: 'Qwen/Qwen2-7B-Instruct'
            }
        };
        
        this.renderConfig(mockConfig, container);
    }

    showMockQuickSwitch() {
        this.lastModelsData = {
            'Qwen/Qwen2-7B-Instruct': { running: false, port: 8000, memory: '16GB' },
            'Qwen/Qwen2-14B-Instruct': { running: true, port: 8001, memory: '24GB' },
            'Qwen/Qwen2-72B-Instruct': { running: false, port: 8002, memory: '80GB' }
        };
        this.renderUnifiedModels();
    }

    showMockCurrentModel() {
        const container = document.getElementById('currentModelInfo');
        if (!container) return;
        
        const t = this.i18n.t.bind(this.i18n);
        container.innerHTML = `
            <div class="current-model-info">
                <div class="current-model-label">${t('gpuMonitor.currentModel')}</div>
                <div class="current-model-value">
                    <span class="no-model">${t('gpuMonitor.noModelRunning')}</span>
                </div>
            </div>
        `;
    }
}
