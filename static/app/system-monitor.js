const API_BASE_URL = '/api/python';
const DASHBOARD_POLL_INTERVAL_MS = 10000;
const TOKEN_POLL_INTERVAL_MS = 120000;

let systemMonitorInstance = null;

export class SystemMonitor {
    constructor() {
        if (systemMonitorInstance) {
            return systemMonitorInstance;
        }
        
        this.pollingInterval = null;
        this.chart = null;
        this.gpuChart = null;
        this.currentChartType = 'cpu';
        this.cpuHistoryData = [];
        this.memoryHistoryData = [];
        this.gpuHistoryData = [];
        this.gpuTempHistoryData = [];
        this.maxDataPoints = 60;
        this.isInitialized = false;
        
        this.pythonGpuChart = null;
        this.currentPythonChartType = 'utilization';
        this.currentPythonGpuTimeRange = 'hour';
        this.pythonGpuUtilizationHistory = [];
        this.pythonGpuMemoryHistory = [];
        this.pythonGpuTempHistory = [];
        this.pythonGpuConnected = false;

        this.tokenChart = null;
        this.currentTokenTimeRange = 'hour';
        this.tokenChartData = {};
        this.tokenDataPollingInterval = null;
        this.isRefreshing = false;
        this.lastPythonGpuHistorySampleAt = 0;
        
        this.modelsList = [];
        this.currentModel = null;
        
        this.initializeDefaultData();
        console.log('[SystemMonitor] Constructor finished, initial data:', {
            cpu: this.cpuHistoryData.length,
            memory: this.memoryHistoryData.length,
            gpu: this.gpuHistoryData.length
        });
        
        systemMonitorInstance = this;
        this.init();
    }

    initializeDefaultData() {
        const defaultCpuValues = [15, 18, 12, 25, 20, 17, 14, 22, 19, 21, 16, 13, 20, 24, 18, 15, 22, 25, 19, 16];
        const defaultMemoryValues = [45, 47, 46, 48, 45, 49, 47, 46, 48, 45, 47, 46, 48, 49, 47, 45, 46, 48, 47, 49];
        const defaultGpuValues = [30, 35, 28, 40, 32, 38, 33, 42, 36, 39, 31, 29, 34, 41, 37, 32, 36, 40, 35, 33];
        const defaultGpuTempValues = [45, 47, 44, 50, 46, 48, 45, 49, 47, 48, 46, 44, 47, 49, 48, 46, 47, 49, 48, 46];
        
        this.cpuHistoryData = [...defaultCpuValues];
        this.memoryHistoryData = [...defaultMemoryValues];
        this.gpuHistoryData = [...defaultGpuValues];
        this.gpuTempHistoryData = [...defaultGpuTempValues];
        
        console.log('[SystemMonitor] Default data initialized');
    }

    init() {
        const initWhenReady = () => {
            if (this.isInitialized) return;
            
            console.log('[SystemMonitor] Initializing...');
            const dashboardSection = document.getElementById('dashboard');
            const gpuMonitorSection = document.getElementById('gpu-monitor');

            if (!dashboardSection && !gpuMonitorSection) {
                console.log('[SystemMonitor] Dashboard or GPU monitor not found, retrying...');
                setTimeout(initWhenReady, 500);
                return;
            }

            this.isInitialized = true;
            this.setupEventListeners();
            this.startPolling();
            
            // 延迟初始化图表，确保DOM已完全渲染
            setTimeout(() => {
                this.ensureChartInitialized();
                this.ensurePythonGpuChartInitialized();
                this.ensureTokenChartInitialized();
            }, 500);
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(initWhenReady, 300);
            });
        } else {
            setTimeout(initWhenReady, 300);
        }
        
        window.addEventListener('componentsLoaded', () => {
            setTimeout(initWhenReady, 200);
        });
    }

    setupEventListeners() {
        const pythonChartTabs = document.querySelectorAll('.chart-type-tab');
        pythonChartTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                pythonChartTabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.currentPythonChartType = e.target.dataset.pythonChartType;
                this.updatePythonGpuLegend();
                this.updatePythonGpuChart();
            });
        });

        const gpuTimeRangeTabs = document.querySelectorAll('.gpu-time-range .time-range-tab');
        gpuTimeRangeTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                gpuTimeRangeTabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.currentPythonGpuTimeRange = e.target.dataset.pythonTimeRange;
                this.resetPythonGpuHistory();
                this.loadGpuHistoryFromServer(true);
            });
        });

        const refreshPythonGpuBtn = document.getElementById('refreshPythonGpuBtn');
        if (refreshPythonGpuBtn) {
            refreshPythonGpuBtn.addEventListener('click', () => this.refreshPythonGpuStatus({ forceRefresh: true, forceSample: true }));
        }

        const refreshProviderBtn = document.getElementById('refreshProviderStatusBtn');
        if (refreshProviderBtn) {
            refreshProviderBtn.addEventListener('click', () => {
                window.providerManager?.loadProviders(true);
            });
        }

        const timeRangeTabs = document.querySelectorAll('.token-trend-panel .time-range-tab[data-time-range]');
        timeRangeTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                timeRangeTabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.currentTokenTimeRange = e.target.dataset.timeRange;
                this.loadTokenUsageData();
                this.updateTokenChart();
            });
        });

        document.addEventListener('section-change', (event) => {
            if (event.detail.section === 'dashboard') {
                this.refreshAllStatus({ force: true });
                this.ensureChartInitialized();
                this.ensurePythonGpuChartInitialized();
                this.ensureTokenChartInitialized();
                this.loadTokenUsageData();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (this.shouldPollDashboard()) {
                this.refreshAllStatus({ force: true });
                this.loadTokenUsageData();
            }
        });

        window.addEventListener('resize', () => {
            this.ensureChartInitialized();
            this.ensurePythonGpuChartInitialized();
            this.ensureTokenChartInitialized();
        });
    }

    updateLegend() {
        const legendContainer = document.getElementById('systemChartLegend');
        if (!legendContainer) return;

        const legendItems = legendContainer.querySelectorAll('.legend-item');
        
        legendItems.forEach((item, index) => {
            const types = ['cpu', 'memory', 'gpu', 'gpu-temp'];
            const type = types[index];
            
            if (this.currentChartType === 'all') {
                item.style.display = 'flex';
            } else if (this.currentChartType === type || 
                      (this.currentChartType === 'gpu' && (type === 'gpu' || type === 'gpu-temp'))) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    isCurrentSection(sectionId) {
        const activeSection = document.querySelector('.section.active');
        return activeSection?.id === sectionId;
    }

    shouldPollDashboard() {
        return document.visibilityState === 'visible' && this.isCurrentSection('dashboard');
    }

    getPythonGpuMaxDataPoints() {
        switch (this.currentPythonGpuTimeRange) {
            case 'day':
                return 144;
            case 'week':
                return 168;
            default:
                return 120;
        }
    }

    resetPythonGpuHistory() {
        this.pythonGpuUtilizationHistory = [];
        this.pythonGpuMemoryHistory = [];
        this.pythonGpuTempHistory = [];
        this.lastPythonGpuHistorySampleAt = 0;
        this.updatePythonGpuChart();
    }

    appendPythonGpuHistoryPoint(data, { force = false } = {}) {
        if (!data) return;

        const now = Date.now();
        if (!force && this.lastPythonGpuHistorySampleAt && (now - this.lastPythonGpuHistorySampleAt) < (DASHBOARD_POLL_INTERVAL_MS - 1000)) {
            return;
        }

        const totalMemory = Number(data.total_memory || 0);
        const usedMemory = Number(data.used_memory || 0);
        const maxPoints = this.getPythonGpuMaxDataPoints();
        const utilization = Number(data.utilization || data.gpu_utilization || 0);
        const memoryUtilization = Number(
            data.memory_utilization ||
            (totalMemory > 0 ? Math.round((usedMemory / totalMemory) * 100) : 0)
        );
        const temperature = Number(data.temperature || 0);

        this.addToHistory(this.pythonGpuUtilizationHistory, utilization, maxPoints);
        this.addToHistory(this.pythonGpuMemoryHistory, memoryUtilization, maxPoints);
        this.addToHistory(this.pythonGpuTempHistory, temperature, maxPoints);
        this.lastPythonGpuHistorySampleAt = now;
    }

    startPolling() {
        this.stopPolling();
        this.refreshAllStatus({ force: true });
        this.loadTokenUsageData();
        this.pollingInterval = setInterval(() => {
            if (this.shouldPollDashboard()) {
                this.refreshAllStatus();
            }
        }, DASHBOARD_POLL_INTERVAL_MS);
        
        this.startTokenDataPolling();
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.stopTokenDataPolling();
    }

    startTokenDataPolling() {
        this.stopTokenDataPolling();
        this.tokenDataPollingInterval = setInterval(() => {
            if (this.shouldPollDashboard()) {
                this.loadTokenUsageData();
            }
        }, TOKEN_POLL_INTERVAL_MS);
    }

    stopTokenDataPolling() {
        if (this.tokenDataPollingInterval) {
            clearInterval(this.tokenDataPollingInterval);
            this.tokenDataPollingInterval = null;
        }
    }

    async refreshAllStatus({ force = false } = {}) {
        if (!force && !this.shouldPollDashboard()) {
            return;
        }

        if (this.isRefreshing) {
            return;
        }

        this.isRefreshing = true;
        try {
            await Promise.all([
                this.updateSystemStatsFromServer(),
                this.refreshPythonGpuStatus({ forceRefresh: force })
            ]);
            
            this.ensureChartInitialized();
            this.updateChart();
            this.ensurePythonGpuChartInitialized();
            this.updatePythonGpuChart();
        } finally {
            this.isRefreshing = false;
        }
    }

    async refreshPythonGpuStatus({ forceRefresh = false, forceSample = false } = {}) {
        const container = document.getElementById('pythonGpuConnectionStatus');
        if (!container) return;

        try {
            const { monitorCache } = await import('./monitor-cache.js');
            const result = await monitorCache.getSummary(forceRefresh);

            if (!result || !result.success) {
                throw new Error(result?.error || 'Failed to get monitor summary');
            }

            const gpuData = result.gpu || {};
            this.pythonGpuConnected = gpuData.status === 'available';
            this.renderPythonGpuConnectionStatus(this.pythonGpuConnected);
            
            const data = {
                ...gpuData,
                utilization: gpuData.utilization || gpuData.gpu_utilization || 0,
                memory_utilization: gpuData.memory_utilization || 
                    (gpuData.total_memory && gpuData.used_memory 
                        ? Math.round((gpuData.used_memory / gpuData.total_memory) * 100) 
                        : 0),
                temperature: gpuData.temperature || 0,
                power_draw: gpuData.power_draw || gpuData.power || 0,
                name: gpuData.name || 'Unknown',
                total_memory: gpuData.total_memory,
                used_memory: gpuData.used_memory,
                available_memory: gpuData.available_memory
            };
            
            this.renderPythonGpuStatus(data);
            this.updatePythonGpuVisibility(true);

            if (this.pythonGpuConnected) {
                this.appendPythonGpuHistoryPoint(data, { force: forceRefresh || forceSample });
            }
        } catch (error) {
            console.log('[SystemMonitor] Using fallback API:', error.message);
            await this.refreshPythonGpuStatusFallback({ forceSample });
        }
    }

    async refreshPythonGpuStatusFallback({ forceSample = false } = {}) {
        const container = document.getElementById('pythonGpuConnectionStatus');
        if (!container) return;

        try {
            const token = window.authManager ? window.authManager.getToken() : null;
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`/api/python-gpu/status`, {
                method: 'GET',
                headers,
                timeout: 5000
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to get GPU status');
            }
            const data = result;
            this.pythonGpuConnected = data.status === 'available';
            this.renderPythonGpuConnectionStatus(this.pythonGpuConnected);
            this.renderPythonGpuStatus(data);
            this.updatePythonGpuVisibility(true);

            if (this.pythonGpuConnected) {
                this.appendPythonGpuHistoryPoint(data, { force: forceSample });
            }
        } catch (error) {
            this.pythonGpuConnected = false;
            this.renderPythonGpuConnectionStatus(false);
            this.updatePythonGpuVisibility(false);
            console.log('[SystemMonitor] Python GPU connection failed:', error.message);
        }
    }

    updatePythonGpuVisibility(isConnected) {
        const dashboardGpuPanel = document.querySelector('.python-gpu-monitor');

        if (dashboardGpuPanel) {
            dashboardGpuPanel.style.display = isConnected ? '' : 'none';
        }
    }

    renderPythonGpuConnectionStatus(connected) {
        const container = document.getElementById('pythonGpuConnectionStatus');
        if (!container) return;

        if (connected) {
            container.innerHTML = `<span class="status-badge online"><i class="fas fa-circle"></i> <span>已连接</span></span>`;
        } else {
            container.innerHTML = `<span class="status-badge offline"><i class="fas fa-circle"></i> <span>未连接</span></span>`;
        }
    }

    renderPythonGpuStatus(data) {
        if (!data || data.status === 'unavailable') {
            document.getElementById('pythonGpuUtilization').textContent = '--';
            document.getElementById('pythonGpuMemory').textContent = '--';
            document.getElementById('pythonGpuTemp').textContent = '--';
            document.getElementById('pythonGpuPower').textContent = '--';
            document.getElementById('pythonGpuName').textContent = data?.message || '未检测到GPU';
            document.getElementById('pythonGpuTotalMemory').textContent = '--';
            document.getElementById('pythonGpuUsedMemory').textContent = '--';
            document.getElementById('pythonGpuAvailableMemory').textContent = '--';
            return;
        }

        const totalMemoryGB = data.total_memory / (1024 ** 3);
        const usedMemoryGB = data.used_memory / (1024 ** 3);
        const availableMemoryGB = data.available_memory / (1024 ** 3);

        document.getElementById('pythonGpuUtilization').textContent = `${data.utilization || 0}%`;
        document.getElementById('pythonGpuMemory').textContent = `${data.memory_utilization || 0}%`;
        document.getElementById('pythonGpuTemp').textContent = `${data.temperature || 0}°C`;
        document.getElementById('pythonGpuPower').textContent = `${data.power_draw || 0}W`;
        document.getElementById('pythonGpuName').textContent = data.name || 'Unknown';
        document.getElementById('pythonGpuTotalMemory').textContent = `${totalMemoryGB.toFixed(1)} GB`;
        document.getElementById('pythonGpuUsedMemory').textContent = `${usedMemoryGB.toFixed(1)} GB`;
        document.getElementById('pythonGpuAvailableMemory').textContent = `${availableMemoryGB.toFixed(1)} GB`;
    }

    updatePythonGpuLegend() {
        const legendContainer = document.getElementById('pythonGpuChartLegend');
        if (!legendContainer) return;

        const legendItems = legendContainer.querySelectorAll('.legend-item');
        
        legendItems.forEach((item, index) => {
            const types = ['utilization', 'memory', 'temperature'];
            const type = types[index];
            
            if (this.currentPythonChartType === 'all') {
                item.style.display = 'flex';
            } else if (this.currentPythonChartType === type) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    ensurePythonGpuChartInitialized() {
        const canvas = document.getElementById('pythonGpuChart');
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        
        if (rect.width <= 0 || rect.height <= 0) {
            const container = canvas.parentElement;
            if (container) {
                const containerRect = container.getBoundingClientRect();
                if (containerRect.width > 0 && containerRect.height > 0) {
                    this.pythonGpuChart = null;
                    this.initPythonGpuChart();
                }
            }
            return;
        }

        if (!this.pythonGpuChart) {
            this.initPythonGpuChart();
        } else if (this.pythonGpuChart.width !== rect.width || this.pythonGpuChart.height !== rect.height) {
            this.pythonGpuChart = null;
            this.initPythonGpuChart();
        }
        
        this.updatePythonGpuLegend();
        this.updatePythonGpuChart();
    }

    initPythonGpuChart() {
        const canvas = document.getElementById('pythonGpuChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        let rect = canvas.getBoundingClientRect();
        
        if (rect.width === 0 || rect.height === 0) {
            const container = canvas.parentElement;
            if (container) {
                const containerRect = container.getBoundingClientRect();
                rect = {
                    width: Math.max(containerRect.width - 32, 300),
                    height: 160
                };
            } else {
                rect = { width: 400, height: 160 };
            }
        }

        if (rect.width <= 0 || rect.height <= 0) {
            rect = { width: 400, height: 160 };
        }

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        this.pythonGpuChart = {
            ctx,
            width: rect.width,
            height: rect.height,
            padding: { top: 15, right: 15, bottom: 28, left: 40 }
        };
    }

    updatePythonGpuChart() {
        if (!this.pythonGpuChart) {
            this.ensurePythonGpuChartInitialized();
        }

        if (!this.pythonGpuChart) return;

        const { ctx, width, height, padding } = this.pythonGpuChart;
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, width, height);

        let datasets = [];
        let dataLength = 0;

        if (this.currentPythonChartType === 'utilization' || this.currentPythonChartType === 'all') {
            if (this.pythonGpuUtilizationHistory.length > 0) {
                datasets.push({
                    data: [...this.pythonGpuUtilizationHistory],
                    color: '#8b5cf6',
                    label: 'GPU使用率',
                    gradient: ['#8b5cf6', '#a78bfa']
                });
                dataLength = Math.max(dataLength, this.pythonGpuUtilizationHistory.length);
            }
        }

        if (this.currentPythonChartType === 'memory' || this.currentPythonChartType === 'all') {
            if (this.pythonGpuMemoryHistory.length > 0) {
                datasets.push({
                    data: [...this.pythonGpuMemoryHistory],
                    color: '#3b82f6',
                    label: '显存使用率',
                    gradient: ['#3b82f6', '#60a5fa']
                });
                dataLength = Math.max(dataLength, this.pythonGpuMemoryHistory.length);
            }
        }

        if (this.currentPythonChartType === 'temperature' || this.currentPythonChartType === 'all') {
            if (this.pythonGpuTempHistory.length > 0) {
                datasets.push({
                    data: [...this.pythonGpuTempHistory],
                    color: '#ef4444',
                    label: 'GPU温度',
                    gradient: ['#ef4444', '#f87171'],
                    isTemperature: true
                });
                dataLength = Math.max(dataLength, this.pythonGpuTempHistory.length);
            }
        }

        if (dataLength === 0) {
            this.renderPythonGpuEmptyChart();
            return;
        }

        let allValues = [];
        datasets.forEach(ds => allValues.push(...ds.data.filter(v => v > 0)));
        const minValue = allValues.length > 0 ? Math.min(...allValues) * 0.9 : 0;
        const maxValue = allValues.length > 0 ? Math.max(...allValues) * 1.1 : 100;

        this.drawGrid(ctx, chartWidth, chartHeight, padding, minValue, maxValue);
        this.drawAxes(ctx, chartWidth, chartHeight, padding, minValue, maxValue, true);
        datasets.forEach(ds => {
            this.drawArea(ctx, chartWidth, chartHeight, padding, ds, minValue, maxValue);
            this.drawLine(ctx, chartWidth, chartHeight, padding, ds, minValue, maxValue);
        });
        datasets.forEach(ds => {
            this.drawPoint(ctx, chartWidth, chartHeight, padding, ds, minValue, maxValue);
        });
    }

    renderPythonGpuEmptyChart() {
        if (!this.pythonGpuChart) return;
        const { ctx, width, height } = this.pythonGpuChart;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#6b7280';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据', width / 2, height / 2);
    }

    async updateSystemStatsFromServer() {
        try {
            const token = localStorage.getItem('authToken');
            console.log('[SystemMonitor] Auth token exists:', !!token);
            
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch('/api/system/monitor', { headers });
            
            console.log('[SystemMonitor] API response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('[SystemMonitor] Received data:', data);
                
                const cpuValueEl = document.getElementById('cpuValue');
                const memoryValueEl = document.getElementById('memoryValue');
                const memoryTotalEl = document.getElementById('memoryTotal');
                const cpuCoresEl = document.getElementById('cpuCores');
                
                const memoryUsageEl = document.getElementById('memoryUsage');
                const cpuUsageEl = document.getElementById('cpuUsage');
                
                if (cpuValueEl) cpuValueEl.textContent = `${data.cpu.usage.toFixed(1)}%`;
                if (memoryValueEl) memoryValueEl.textContent = `${parseFloat(data.memory.usagePercent).toFixed(1)}%`;
                if (memoryTotalEl) memoryTotalEl.textContent = data.memory.total;
                if (cpuCoresEl) cpuCoresEl.textContent = data.cpu.cores.toString();
                
                if (memoryUsageEl) memoryUsageEl.textContent = `${data.memory.used || '--'} / ${data.memory.total || '--'}`;
                if (cpuUsageEl) cpuUsageEl.textContent = `${data.cpu.usage.toFixed(1)}%`;

                if (data.cpu.history && data.cpu.history.length > 0) {
                    console.log('[SystemMonitor] Server CPU history length:', data.cpu.history.length);
                    
                    if (this.cpuHistoryData.length === 0) {
                        this.cpuHistoryData = [...data.cpu.history];
                    } else if (data.cpu.history.length > this.cpuHistoryData.length) {
                        this.cpuHistoryData = [...data.cpu.history];
                    } else {
                        const lastServerValue = data.cpu.history[data.cpu.history.length - 1];
                        if (lastServerValue !== this.cpuHistoryData[this.cpuHistoryData.length - 1]) {
                            this.addToHistory(this.cpuHistoryData, lastServerValue);
                        }
                    }
                    console.log('[SystemMonitor] CPU history length after update:', this.cpuHistoryData.length);
                } else {
                    this.updateSystemStatsLocally();
                }
                
                if (data.memory.history && data.memory.history.length > 0) {
                    console.log('[SystemMonitor] Server Memory history length:', data.memory.history.length);
                    
                    if (this.memoryHistoryData.length === 0) {
                        this.memoryHistoryData = [...data.memory.history];
                    } else if (data.memory.history.length > this.memoryHistoryData.length) {
                        this.memoryHistoryData = [...data.memory.history];
                    } else {
                        const lastServerValue = data.memory.history[data.memory.history.length - 1];
                        if (lastServerValue !== this.memoryHistoryData[this.memoryHistoryData.length - 1]) {
                            this.addToHistory(this.memoryHistoryData, lastServerValue);
                        }
                    }
                    console.log('[SystemMonitor] Memory history length after update:', this.memoryHistoryData.length);
                } else {
                    this.updateSystemStatsLocally();
                }
            } else {
                console.log('[SystemMonitor] API not ok (status:', response.status, '), falling back to local');
                this.updateSystemStatsLocally();
            }
        } catch (error) {
            console.error('[SystemMonitor] API error:', error);
            this.updateSystemStatsLocally();
        }
    }

    updateSystemStatsLocally() {
        const cpuUsage = this.getCpuUsagePercent();
        const memoryInfo = this.getMemoryInfo();

        const cpuEl = document.getElementById('cpuValue');
        const memEl = document.getElementById('memoryValue');
        const memTotalEl = document.getElementById('memoryTotal');
        
        const memoryUsageEl = document.getElementById('memoryUsage');
        const cpuUsageEl = document.getElementById('cpuUsage');

        if (cpuEl) cpuEl.textContent = cpuUsage;
        if (memEl) memEl.textContent = memoryInfo.usagePercent;
        if (memTotalEl) memTotalEl.textContent = memoryInfo.total;
        
        if (memoryUsageEl) memoryUsageEl.textContent = `${memoryInfo.used} / ${memoryInfo.total}`;
        if (cpuUsageEl) cpuUsageEl.textContent = cpuUsage;

        this.addToHistory(this.cpuHistoryData, parseFloat(cpuUsage));
        this.addToHistory(this.memoryHistoryData, parseFloat(memoryInfo.usagePercent));
    }

    addToHistory(history, value, maxPoints = this.maxDataPoints) {
        if (!isNaN(value)) {
            history.push(value);
            if (history.length > maxPoints) {
                history.shift();
            }
        }
    }

    getCpuUsagePercent() {
        if (typeof window !== 'undefined' && window.__cpuInfo) {
            const cpus = window.__cpuInfo || [];
            let totalIdle = 0;
            let totalTick = 0;

            for (const cpu of cpus) {
                for (const type in cpu.times) {
                    totalTick += cpu.times[type];
                    if (type === 'idle') {
                        totalIdle += cpu.times[type];
                    }
                }
            }

            const currentCpuInfo = {
                idle: totalIdle,
                total: totalTick
            };

            let cpuPercent = 0;

            if (this.previousCpuInfo) {
                const idleDiff = currentCpuInfo.idle - this.previousCpuInfo.idle;
                const totalDiff = currentCpuInfo.total - this.previousCpuInfo.total;

                if (totalDiff > 0) {
                    cpuPercent = 100 - (100 * idleDiff / totalDiff);
                }
            }

            this.previousCpuInfo = currentCpuInfo;

            return `${cpuPercent.toFixed(1)}%`;
        }
        
        if (typeof navigator !== 'undefined') {
            const baseValue = 10 + Math.random() * 20;
            const variation = Math.sin(Date.now() / 2000) * 5;
            const cpuPercent = Math.max(5, Math.min(50, baseValue + variation));
            return `${cpuPercent.toFixed(1)}%`;
        }
        
        return '0.0%';
    }

    getMemoryInfo() {
        if (typeof window !== 'undefined' && window.__memoryInfo) {
            const { total, free } = window.__memoryInfo;
            const used = total - free;
            const usagePercent = ((used / total) * 100).toFixed(1);

            const formatBytes = (bytes) => {
                if (bytes === 0) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            };

            return {
                total: formatBytes(total),
                used: formatBytes(used),
                free: formatBytes(free),
                usagePercent: `${usagePercent}%`
            };
        }
        
        if (typeof navigator !== 'undefined') {
            const baseValue = 45 + Math.random() * 15;
            const variation = Math.sin(Date.now() / 3000) * 3;
            const usagePercent = Math.max(35, Math.min(70, baseValue + variation));
            
            return {
                total: '16.00 GB',
                used: `${(usagePercent * 0.16).toFixed(2)} GB`,
                free: `${((100 - usagePercent) * 0.16).toFixed(2)} GB`,
                usagePercent: `${usagePercent.toFixed(1)}%`
            };
        }
        
        return {
            total: '--',
            used: '--',
            free: '--',
            usagePercent: '--'
        };
    }

    async refreshGpuStatus() {
        const container = document.getElementById('gpuStatusContent');
        if (!container) return;

        try {
            const token = window.authManager ? window.authManager.getToken() : null;
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`/api/python-gpu/status`, {
                method: 'GET',
                headers,
                timeout: 5000
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to get GPU status');
            }
            const data = result;
            this.renderGpuStatus(data, container);

            if (data.status === 'available') {
                const utilization = data.utilization || 0;
                const temperature = data.temperature || 0;
                
                this.addToHistory(this.gpuHistoryData, utilization);
                this.addToHistory(this.gpuTempHistoryData, temperature);
                
                const gpuValEl1 = document.getElementById('gpuValue');
                if (gpuValEl1) gpuValEl1.textContent = `${utilization}%`;
            }
        } catch (error) {
            container.innerHTML = `
                <div class="status-loading">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>无法获取GPU状态</span>
                    <p class="error-hint">错误信息: ${error.message}</p>
                    <p class="error-suggestion">请确保Python控制器服务已启动</p>
                </div>
                <div class="node-env-info">
                    <div class="env-header">Node.js 环境信息</div>
                    <div class="env-details">
                        <div class="env-item">
                            <span class="env-label">Node.js 版本</span>
                            <span class="env-value">${window.__nodeVersion || '--'}</span>
                        </div>
                        <div class="env-item">
                            <span class="env-label">运行模式</span>
                            <span class="env-value">${window.__serviceMode || '--'}</span>
                        </div>
                        <div class="env-item">
                            <span class="env-label">进程 PID</span>
                            <span class="env-value">${window.__processPid || '--'}</span>
                        </div>
                        <div class="env-item">
                            <span class="env-label">平台</span>
                            <span class="env-value">${window.__platform || '--'}</span>
                        </div>
                    </div>
                </div>
            `;
            const gpuValElErr = document.getElementById('gpuValue');
            if (gpuValElErr) gpuValElErr.textContent = '--';
        }
    }

    async loadGpuHistoryFromServer(forceRefresh = false) {
        try {
            await this.refreshPythonGpuStatus({ forceRefresh, forceSample: true });
        } catch (error) {
            console.log('[SystemMonitor] Failed to load GPU history:', error);
        }
    }

    renderGpuStatus(data, container) {
        if (!data || data.status === 'unavailable') {
            container.innerHTML = `
                <div class="status-loading">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${data?.message || '未检测到GPU'}</span>
                </div>
                <div class="node-env-info">
                    <div class="env-header">Node.js 环境信息</div>
                    <div class="env-details">
                        <div class="env-item">
                            <span class="env-label">Node.js 版本</span>
                            <span class="env-value">${window.__nodeVersion || '--'}</span>
                        </div>
                        <div class="env-item">
                            <span class="env-label">运行模式</span>
                            <span class="env-value">${window.__serviceMode || '--'}</span>
                        </div>
                        <div class="env-item">
                            <span class="env-label">进程 PID</span>
                            <span class="env-value">${window.__processPid || '--'}</span>
                        </div>
                        <div class="env-item">
                            <span class="env-label">平台</span>
                            <span class="env-value">${window.__platform || '--'}</span>
                        </div>
                    </div>
                </div>
            `;
            const gpuValElUnavail = document.getElementById('gpuValue');
            if (gpuValElUnavail) gpuValElUnavail.textContent = '--';
            return;
        }

        const totalMemoryGB = data.total_memory / (1024 ** 3);
        const usedMemoryGB = data.used_memory / (1024 ** 3);
        const availableMemoryGB = data.available_memory / (1024 ** 3);
        const memoryPercent = data.memory_utilization || 0;
        const memoryClass = memoryPercent > 90 ? 'high' : memoryPercent > 70 ? 'medium' : 'low';
        const utilization = data.utilization || 0;
        const temperature = data.temperature || 0;

        const gpuValElMain = document.getElementById('gpuValue');
        if (gpuValElMain) gpuValElMain.textContent = `${utilization}%`;

        container.innerHTML = `
            <div class="gpu-card">
                <div class="gpu-name">${data.name || 'GPU'}</div>
                <div class="gpu-metrics">
                    <div class="metric-item">
                        <div class="metric-label">显存使用</div>
                        <div class="metric-value">${usedMemoryGB.toFixed(1)} / ${totalMemoryGB.toFixed(1)} GB</div>
                        <div class="memory-bar">
                            <div class="memory-fill ${memoryClass}" style="width: ${memoryPercent}%"></div>
                        </div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">温度</div>
                        <div class="metric-value">${temperature}°C</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">使用率</div>
                        <div class="metric-value">${utilization}%</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">可用显存</div>
                        <div class="metric-value">${availableMemoryGB.toFixed(1)} GB</div>
                    </div>
                </div>
            </div>
        `;
    }

    ensureChartInitialized() {
        const canvas = document.getElementById('systemChart');
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        
        if (rect.width <= 0 || rect.height <= 0) {
            const container = canvas.parentElement;
            if (container) {
                const containerRect = container.getBoundingClientRect();
                if (containerRect.width > 0 && containerRect.height > 0) {
                    this.chart = null;
                    this.initChart();
                }
            }
            return;
        }

        if (!this.chart) {
            this.initChart();
        } else if (this.chart.width !== rect.width || this.chart.height !== rect.height) {
            this.chart = null;
            this.initChart();
        }
        
        this.updateChart();
    }

    initChart() {
        const canvas = document.getElementById('systemChart');
        console.log('[SystemMonitor] Canvas element:', canvas);
        
        if (!canvas) {
            console.log('[SystemMonitor] Canvas not found');
            return;
        }

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        let rect = canvas.getBoundingClientRect();
        console.log('[SystemMonitor] Canvas rect:', rect);
        
        if (rect.width === 0 || rect.height === 0) {
            console.log('[SystemMonitor] Canvas has zero size, trying container...');
            const container = canvas.parentElement;
            if (container) {
                const containerRect = container.getBoundingClientRect();
                console.log('[SystemMonitor] Container rect:', containerRect);
                rect = {
                    width: Math.max(containerRect.width - 32, 300),
                    height: Math.max(containerRect.height - 32, 200)
                };
            } else {
                rect = { width: 400, height: 250 };
            }
        }

        if (rect.width <= 0 || rect.height <= 0) {
            console.log('[SystemMonitor] Invalid dimensions:', rect);
            rect = { width: 400, height: 250 };
        }

        console.log('[SystemMonitor] Setting canvas size:', rect.width * dpr, 'x', rect.height * dpr);
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        this.chart = {
            ctx,
            width: rect.width,
            height: rect.height,
            padding: { top: 15, right: 15, bottom: 28, left: 40 }
        };
        
        console.log('[SystemMonitor] Chart initialized successfully');
    }

    updateChart() {
        console.log('[SystemMonitor] updateChart called');
        
        if (!this.chart) {
            console.log('[SystemMonitor] Chart not initialized, trying to initialize...');
            this.ensureChartInitialized();
        }

        if (!this.chart) {
            console.log('[SystemMonitor] Chart still not initialized after ensureChartInitialized');
            return;
        }

        const { ctx, width, height, padding } = this.chart;
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        console.log('[SystemMonitor] Chart dimensions:', { width, height, chartWidth, chartHeight, padding });

        ctx.clearRect(0, 0, width, height);

        let datasets = [];
        let dataLength = 0;
        
        console.log('[SystemMonitor] Current chart type:', this.currentChartType);
        console.log('[SystemMonitor] CPU history:', this.cpuHistoryData.slice(-5));
        console.log('[SystemMonitor] Memory history:', this.memoryHistoryData.slice(-5));
        console.log('[SystemMonitor] GPU history:', this.gpuHistoryData.slice(-5));

        if (this.currentChartType === 'cpu' || this.currentChartType === 'all') {
            if (this.cpuHistoryData.length > 0) {
                datasets.push({
                    data: [...this.cpuHistoryData],
                    color: '#3b82f6',
                    label: 'CPU使用率',
                    gradient: ['#3b82f6', '#60a5fa']
                });
                dataLength = Math.max(dataLength, this.cpuHistoryData.length);
            }
        }

        if (this.currentChartType === 'memory' || this.currentChartType === 'all') {
            if (this.memoryHistoryData.length > 0) {
                datasets.push({
                    data: [...this.memoryHistoryData],
                    color: '#f59e0b',
                    label: '内存使用率',
                    gradient: ['#f59e0b', '#fbbf24']
                });
                dataLength = Math.max(dataLength, this.memoryHistoryData.length);
            }
        }

        if (this.currentChartType === 'gpu' || this.currentChartType === 'all') {
            if (this.gpuHistoryData.length > 0) {
                datasets.push({
                    data: [...this.gpuHistoryData],
                    color: '#8b5cf6',
                    label: 'GPU使用率',
                    gradient: ['#8b5cf6', '#a78bfa']
                });
                dataLength = Math.max(dataLength, this.gpuHistoryData.length);
            }
            if (this.gpuTempHistoryData.length > 0) {
                datasets.push({
                    data: [...this.gpuTempHistoryData],
                    color: '#ef4444',
                    label: 'GPU温度',
                    gradient: ['#ef4444', '#f87171'],
                    isTemperature: true
                });
                dataLength = Math.max(dataLength, this.gpuTempHistoryData.length);
            }
        }

        console.log('[SystemMonitor] Datasets:', datasets.length, 'Data length:', dataLength);

        if (dataLength === 0) {
            console.log('[SystemMonitor] No data to display');
            this.renderEmptyChart();
            return;
        }

        let allValues = [];
        datasets.forEach(ds => allValues.push(...ds.data.filter(v => v > 0)));
        const minValue = allValues.length > 0 ? Math.min(...allValues) * 0.9 : 0;
        const maxValue = allValues.length > 0 ? Math.max(...allValues) * 1.1 : 100;

        console.log('[SystemMonitor] Value range:', { minValue, maxValue });

        this.drawGrid(ctx, chartWidth, chartHeight, padding, minValue, maxValue);
        this.drawAxes(ctx, chartWidth, chartHeight, padding, minValue, maxValue, false);
        datasets.forEach(ds => {
            this.drawArea(ctx, chartWidth, chartHeight, padding, ds, minValue, maxValue);
            this.drawLine(ctx, chartWidth, chartHeight, padding, ds, minValue, maxValue);
        });
        datasets.forEach(ds => {
            this.drawPoint(ctx, chartWidth, chartHeight, padding, ds, minValue, maxValue);
        });
        
        console.log('[SystemMonitor] Chart drawn successfully');
    }

    renderEmptyChart() {
        const { ctx, width, height } = this.chart;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#6b7280';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据', width / 2, height / 2);
    }

    drawGrid(ctx, chartWidth, chartHeight, padding, minValue, maxValue) {
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartHeight / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();
        }

        ctx.setLineDash([]);
    }

    drawAxes(ctx, chartWidth, chartHeight, padding, minValue, maxValue, showTimeLabels, isTemperature = false) {
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
            ctx.fillText(Math.round(value) + (isTemperature ? '°C' : '%'), padding.left - 8, y + 4);
        }

        ctx.textAlign = 'center';
        let timeLabels;
        if (showTimeLabels && this.currentPythonGpuTimeRange) {
            switch(this.currentPythonGpuTimeRange) {
                case 'hour':
                    timeLabels = ['-60m', '-45m', '-30m', '-15m', '现在'];
                    break;
                case 'day':
                    timeLabels = ['-24h', '-18h', '-12h', '-6h', '现在'];
                    break;
                case 'week':
                    timeLabels = ['-7d', '-5d', '-3d', '-1d', '现在'];
                    break;
                default:
                    timeLabels = ['-60s', '-45s', '-30s', '-15s', '现在'];
            }
        } else {
            timeLabels = ['-60s', '-45s', '-30s', '-15s', '现在'];
        }
        for (let i = 0; i < 5; i++) {
            const x = padding.left + (chartWidth / 4) * i;
            ctx.fillText(timeLabels[i], x, padding.top + chartHeight + 22);
        }
    }

    drawArea(ctx, chartWidth, chartHeight, padding, dataset, minValue, maxValue) {
        const dataLength = dataset.data.length;
        if (dataLength < 2) return;

        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
        gradient.addColorStop(0, dataset.gradient[0] + '66');
        gradient.addColorStop(1, dataset.gradient[1] + '0D');

        ctx.fillStyle = gradient;
        ctx.beginPath();

        dataset.data.forEach((value, index) => {
            const x = padding.left + (chartWidth / (dataLength - 1)) * index;
            const y = padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;

            if (index === 0) {
                ctx.moveTo(x, padding.top + chartHeight);
                ctx.lineTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        const lastX = padding.left + (chartWidth / (dataLength - 1)) * (dataLength - 1);
        ctx.lineTo(lastX, padding.top + chartHeight);
        ctx.closePath();
        ctx.fill();
    }

    drawLine(ctx, chartWidth, chartHeight, padding, dataset, minValue, maxValue) {
        const dataLength = dataset.data.length;
        if (dataLength < 2) return;

        ctx.strokeStyle = dataset.color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        dataset.data.forEach((value, index) => {
            const x = padding.left + (chartWidth / (dataLength - 1)) * index;
            const y = padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                const prevX = padding.left + (chartWidth / (dataLength - 1)) * (index - 1);
                const prevY = padding.top + chartHeight - ((dataset.data[index - 1] - minValue) / (maxValue - minValue)) * chartHeight;
                
                const cpX = (prevX + x) / 2;
                ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2);
            }
        });

        ctx.stroke();
    }

    drawPoint(ctx, chartWidth, chartHeight, padding, dataset, minValue, maxValue) {
        const dataLength = dataset.data.length;
        if (dataLength === 0) return;

        const lastIndex = dataLength - 1;
        const value = dataset.data[lastIndex];
        if (value <= 0) return;

        const x = dataLength === 1
            ? padding.left + chartWidth / 2
            : padding.left + (chartWidth / (dataLength - 1)) * lastIndex;
        const y = padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;

        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = dataset.color;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = dataset.color;
        ctx.fill();
    }

    async loadTokenUsageData() {
        try {
            const token = localStorage.getItem('authToken');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

            const response = await fetch(`/api/usage/stats?range=${encodeURIComponent(this.currentTokenTimeRange)}`, { headers });
            
            if (response.ok) {
                const data = await response.json();
                this.tokenChartData = {
                    range: data.range || this.currentTokenTimeRange,
                    trend: data.trend || [],
                    hourlyData: data.hourlyData || [],
                    totalRequests: data.totalRequests || 0,
                    totalTokens: data.totalTokens || 0,
                    inputTokens: data.inputTokens || 0,
                    outputTokens: data.outputTokens || 0
                };
                this.updateTokenChart();
            }
        } catch (error) {
            console.log('[SystemMonitor] Failed to load token usage data:', error);
        }
    }

    ensureTokenChartInitialized() {
        const canvas = document.getElementById('tokenTrendChart');
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        
        if (rect.width <= 0 || rect.height <= 0) {
            const container = canvas.parentElement;
            if (container) {
                const containerRect = container.getBoundingClientRect();
                if (containerRect.width > 0 && containerRect.height > 0) {
                    this.tokenChart = null;
                    this.initTokenChart();
                }
            }
            return;
        }

        if (!this.tokenChart) {
            this.initTokenChart();
        } else if (this.tokenChart.width !== rect.width || this.tokenChart.height !== rect.height) {
            this.tokenChart = null;
            this.initTokenChart();
        }
        
        this.updateTokenChart();
    }

    ensureGpuChartInitialized() {
        const canvas = document.getElementById('gpuChart');
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        
        if (rect.width <= 0 || rect.height <= 0) {
            const container = canvas.parentElement;
            if (container) {
                const containerRect = container.getBoundingClientRect();
                if (containerRect.width > 0 && containerRect.height > 0) {
                    this.gpuChart = null;
                    this.initGpuChart();
                }
            }
            return;
        }

        if (!this.gpuChart) {
            this.initGpuChart();
        } else if (this.gpuChart.width !== rect.width || this.gpuChart.height !== rect.height) {
            this.gpuChart = null;
            this.initGpuChart();
        }
        
        this.updateGpuChart();
    }

    initGpuChart() {
        const canvas = document.getElementById('gpuChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        let rect = canvas.getBoundingClientRect();
        
        // 优先使用容器的尺寸
        const container = canvas.parentElement;
        if (container) {
            const containerRect = container.getBoundingClientRect();
            if (containerRect.width > 0 && containerRect.height > 0) {
                rect = {
                    width: containerRect.width - 32, // 减去内边距
                    height: containerRect.height - 32 // 减去内边距
                };
            }
        }
        
        // 确保尺寸有效
        if (rect.width <= 0 || rect.height <= 0) {
            rect = { width: 400, height: 300 };
        }

        // 设置canvas尺寸
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        // 调整padding以确保图表内容不会被裁剪
        this.gpuChart = {
            ctx,
            width: rect.width,
            height: rect.height,
            padding: { top: 20, right: 20, bottom: 35, left: 50 }
        };
    }

    updateGpuChart() {
        if (!this.gpuChart) {
            this.ensureGpuChartInitialized();
        }

        if (!this.gpuChart) return;

        const { ctx, width, height, padding } = this.gpuChart;
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // 清除画布
        ctx.clearRect(0, 0, width, height);

        let datasets = [];
        let dataLength = 0;

        // 添加GPU使用率数据
        if (this.gpuHistoryData.length > 0) {
            datasets.push({
                data: [...this.gpuHistoryData],
                color: '#8b5cf6',
                label: 'GPU使用率',
                gradient: ['#8b5cf6', '#a78bfa']
            });
            dataLength = Math.max(dataLength, this.gpuHistoryData.length);
        }
        // 添加GPU温度数据
        if (this.gpuTempHistoryData.length > 0) {
            datasets.push({
                data: [...this.gpuTempHistoryData],
                color: '#ef4444',
                label: 'GPU温度',
                gradient: ['#ef4444', '#f87171'],
                isTemperature: true
            });
            dataLength = Math.max(dataLength, this.gpuTempHistoryData.length);
        }

        // 如果没有数据，显示空状态
        if (dataLength === 0) {
            this.renderGpuEmptyChart();
            return;
        }

        // 计算数据范围
        let allValues = [];
        datasets.forEach(ds => allValues.push(...ds.data.filter(v => v > 0)));
        const minValue = allValues.length > 0 ? Math.min(...allValues) * 0.9 : 0;
        const maxValue = allValues.length > 0 ? Math.max(...allValues) * 1.1 : 100;

        // 绘制网格
        this.drawGrid(ctx, chartWidth, chartHeight, padding, minValue, maxValue);
        // 绘制坐标轴
        // 检查是否有温度数据
        const hasTemperatureData = datasets.some(ds => ds.isTemperature);
        this.drawAxes(ctx, chartWidth, chartHeight, padding, minValue, maxValue, false, hasTemperatureData);
        // 绘制数据集
        datasets.forEach(ds => {
            // 绘制面积图
            this.drawArea(ctx, chartWidth, chartHeight, padding, ds, minValue, maxValue);
            // 绘制折线
            this.drawLine(ctx, chartWidth, chartHeight, padding, ds, minValue, maxValue);
        });
        // 绘制数据点
        datasets.forEach(ds => {
            this.drawPoint(ctx, chartWidth, chartHeight, padding, ds, minValue, maxValue);
        });
    }

    renderGpuEmptyChart() {
        if (!this.gpuChart) return;
        const { ctx, width, height } = this.gpuChart;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#6b7280';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据', width / 2, height / 2);
    }

    initTokenChart() {
        const canvas = document.getElementById('tokenTrendChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        let rect = canvas.getBoundingClientRect();
        
        if (rect.width === 0 || rect.height === 0) {
            const container = canvas.parentElement;
            if (container) {
                const containerRect = container.getBoundingClientRect();
                rect = {
                    width: Math.max(containerRect.width - 32, 300),
                    height: 160
                };
            } else {
                rect = { width: 400, height: 160 };
            }
        }

        if (rect.width <= 0 || rect.height <= 0) {
            rect = { width: 400, height: 160 };
        }

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        this.tokenChart = {
            ctx,
            width: rect.width,
            height: rect.height,
            padding: { top: 15, right: 15, bottom: 28, left: 40 }
        };
    }

    generateTokenTimeRangeData(data, range) {
        if (Array.isArray(data?.trend) && data.trend.length > 0) {
            return {
                labels: data.trend.map(item => item.label || item.hour || item.key || ''),
                promptTokens: data.trend.map(item => Math.round(item.promptTokens || 0)),
                completionTokens: data.trend.map(item => Math.round(item.completionTokens || 0)),
                totalTokens: data.trend.map(item => Math.round(item.totalTokens || item.tokens || 0))
            };
        }

        const now = new Date();
        const result = { labels: [], promptTokens: [], completionTokens: [], totalTokens: [] };
        
        let interval, count;
        switch(range) {
            case 'hour':
                interval = 60 * 1000;
                count = 60;
                break;
            case 'day':
                interval = 60 * 60 * 1000;
                count = 24;
                break;
            case 'week':
                interval = 24 * 60 * 60 * 1000;
                count = 7;
                break;
            default:
                interval = 60 * 1000;
                count = 60;
        }

        for (let i = count - 1; i >= 0; i--) {
            const time = new Date(now.getTime() - i * interval);
            let label;
            
            if (range === 'hour') {
                label = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
            } else if (range === 'day') {
                label = `${time.getHours().toString().padStart(2, '0')}:00`;
            } else {
                const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
                label = weekdays[time.getDay()];
            }
            
            result.labels.push(label);
            
            let prompt = 0, completion = 0, total = 0;
            
            if (range === 'hour') {
                const minuteKey = time.toISOString().slice(0, 16);
                if (data.minuteData && data.minuteData[minuteKey]) {
                    const d = data.minuteData[minuteKey];
                    prompt = d.promptTokens || 0;
                    completion = d.completionTokens || 0;
                    total = d.totalTokens || 0;
                }
            } else if (range === 'day') {
                const hourKey = time.toISOString().slice(0, 13);
                if (data.hourly && data.hourly[hourKey]) {
                    const d = data.hourly[hourKey];
                    prompt = d.promptTokens || 0;
                    completion = d.completionTokens || 0;
                    total = d.totalTokens || 0;
                } else if (data.daily) {
                    const dateKey = time.toISOString().slice(0, 10);
                    if (data.daily[dateKey]) {
                        const d = data.daily[dateKey];
                        prompt += (d.promptTokens || 0) / 24;
                        completion += (d.completionTokens || 0) / 24;
                        total += (d.totalTokens || 0) / 24;
                    }
                }
            } else {
                const dateKey = time.toISOString().slice(0, 10);
                if (data.daily && data.daily[dateKey]) {
                    const d = data.daily[dateKey];
                    prompt = d.promptTokens || 0;
                    completion = d.completionTokens || 0;
                    total = d.totalTokens || 0;
                }
            }
            
            result.promptTokens.push(Math.round(prompt));
            result.completionTokens.push(Math.round(completion));
            result.totalTokens.push(Math.round(total));
        }
        
        return result;
    }

    updateTokenChart() {
        if (!this.tokenChart) {
            this.ensureTokenChartInitialized();
        }

        if (!this.tokenChart) return;

        const { ctx, width, height, padding } = this.tokenChart;
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, width, height);

        const chartData = this.generateTokenTimeRangeData(this.tokenChartData, this.currentTokenTimeRange);
        
        if (chartData.labels.length === 0) {
            ctx.fillStyle = '#6b7280';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('暂无数据', width / 2, height / 2);
            return;
        }

        const allValues = [...chartData.promptTokens, ...chartData.completionTokens, ...chartData.totalTokens];
        const maxValue = Math.max(...allValues.filter(v => v > 0), 1);
        const minValue = 0;

        this.drawGrid(ctx, chartWidth, chartHeight, padding);
        this.drawTokenAxes(ctx, chartWidth, chartHeight, padding, chartData.labels, minValue, maxValue);

        const datasets = [
            { data: chartData.promptTokens, color: '#3b82f6', gradient: ['#3b82f6', '#60a5fa'], label: '输入 Token' },
            { data: chartData.completionTokens, color: '#10b981', gradient: ['#10b981', '#34d399'], label: '输出 Token' },
            { data: chartData.totalTokens, color: '#8b5cf6', gradient: ['#8b5cf6', '#a78bfa'], label: '总 Token' }
        ];

        datasets.forEach(ds => {
            this.drawArea(ctx, chartWidth, chartHeight, padding, ds, minValue, maxValue);
            this.drawLine(ctx, chartWidth, chartHeight, padding, ds, minValue, maxValue);
        });

        datasets.forEach(ds => {
            this.drawPoint(ctx, chartWidth, chartHeight, padding, ds, minValue, maxValue);
        });
    }

    drawTokenAxes(ctx, chartWidth, chartHeight, padding, labels, minValue, maxValue) {
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
            const value = Math.round(maxValue - ((maxValue - minValue) / gridLines) * i);
            const formattedValue = this.formatTokenValue(value);
            ctx.fillText(formattedValue, padding.left - 8, y + 4);
        }

        ctx.textAlign = 'center';
        const step = Math.ceil(labels.length / 5);
        for (let i = 0; i < labels.length; i += step) {
            const x = padding.left + (chartWidth / (labels.length - 1)) * i;
            ctx.fillText(labels[i], x, padding.top + chartHeight + 22);
        }
    }

    formatTokenValue(value) {
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + 'M';
        } else if (value >= 1000) {
            return (value / 1000).toFixed(1) + 'K';
        }
        return value.toString();
    }

    async loadModelsList() {
        const container = document.getElementById('quickSwitchContent');
        if (!container) return;

        try {
            const response = await fetch(`${API_BASE_URL}/models/status`, {
                method: 'GET',
                timeout: 10000
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const modelsObj = data?.models || {};
            this.modelsList = Object.entries(modelsObj).map(([name, status]) => ({
                name,
                ...status
            }));
        } catch (error) {
            console.log('[SystemMonitor] Failed to load models list:', error.message);
            container.innerHTML = `
                <div class="status-loading">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>无法加载模型列表</span>
                    <p class="error-hint">错误信息: ${error.message}</p>
                    <p class="error-suggestion">请确保Python控制器服务已启动</p>
                    <button class="btn btn-primary btn-sm mt-2" onclick="window.systemMonitor.loadModelsAndRender()">
                        <i class="fas fa-sync-alt"></i> 重试
                    </button>
                </div>
            `;
        }
    }

    async loadCurrentModel() {
        try {
            const response = await fetch(`${API_BASE_URL}/models/summary`, {
                method: 'GET',
                timeout: 5000
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data && data.running_model) {
                this.currentModel = data.running_model;
            } else {
                this.currentModel = null;
            }
        } catch (error) {
            console.log('[SystemMonitor] Failed to load current model:', error.message);
        }
    }

    async loadModelsAndRender() {
        try {
            await Promise.all([
                this.loadModelsList(),
                this.loadCurrentModel()
            ]);
            this.renderQuickSwitchPanel();
        } catch (error) {
            console.log('[SystemMonitor] Failed to load models:', error.message);
        }
    }

    renderQuickSwitchPanel() {
        const container = document.getElementById('quickSwitchContent');
        if (!container) return;

        if (this.modelsList.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-cube"></i>
                    <p>暂无可用模型</p>
                    <p class="hint">请在 Python Controller 中配置模型</p>
                </div>
            `;
            return;
        }

        const currentModelName = this.currentModel?.name || this.currentModel;
        
        let html = `
            <div class="current-model-info">
                <div class="current-model-label">当前运行模型</div>
                <div class="current-model-value">
                    ${currentModelName ? `<span class="model-name">${currentModelName}</span>` : '<span class="no-model">-</span>'}
                </div>
            </div>
            <div class="models-switch-list">
        `;

        this.modelsList.forEach(model => {
            const isRunning = model.name === currentModelName;
            const statusClass = isRunning ? 'status-running' : model.running ? 'status-running' : 'status-stopped';
            const statusText = isRunning ? '当前运行' : model.running ? '运行中' : '已停止';
            
            html += `
                <div class="model-switch-item" data-model="${model.name}">
                    <div class="model-switch-header">
                        <div class="model-switch-info">
                            <div class="model-switch-name">${model.name}</div>
                            <div class="model-switch-details">
                                <span class="model-switch-port">端口: ${model.port || '-'}</span>
                                <span class="model-switch-memory">${model.required_memory || '-'}</span>
                            </div>
                        </div>
                        <span class="model-switch-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="model-switch-actions">
                        ${isRunning ? `
                            <button class="btn btn-danger btn-sm" onclick="window.systemMonitor.stopModel('${model.name}')">
                                <i class="fas fa-stop"></i> 停止
                            </button>
                        ` : model.running ? `
                            <button class="btn btn-primary btn-sm" onclick="window.systemMonitor.switchModel('${model.name}')">
                                <i class="fas fa-exchange-alt"></i> 切换到此
                            </button>
                        ` : `
                            <button class="btn btn-success btn-sm" onclick="window.systemMonitor.startModel('${model.name}')">
                                <i class="fas fa-play"></i> 启动
                            </button>
                        `}
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;
    }

    async switchModel(modelName) {
        const container = document.getElementById('quickSwitchContent');
        if (!container) return;

        const modelItem = container.querySelector(`[data-model="${modelName}"]`);
        if (modelItem) {
            modelItem.querySelector('.model-switch-actions').innerHTML = `
                <button class="btn btn-primary btn-sm disabled" disabled>
                    <i class="fas fa-spinner fa-spin"></i> 切换中...
                </button>
            `;
        }

        try {
            const token = window.authManager ? window.authManager.getToken() : null;
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch(`${API_BASE_URL}/models/${encodeURIComponent(modelName)}/switch`, {
                method: 'POST',
                headers,
                timeout: 120000
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.currentModel = { name: modelName, ...data };
            const { monitorCache } = await import('./monitor-cache.js');
            monitorCache.invalidateCache();
            this.renderQuickSwitchPanel();
            this.showToast('模型切换成功', 'success');
        } catch (error) {
            console.error('[SystemMonitor] Failed to switch model:', error.message);
            this.renderQuickSwitchPanel();
            this.showToast(`切换失败: ${error.message}`, 'error');
        }
    }

    async startModel(modelName) {
        const container = document.getElementById('quickSwitchContent');
        if (!container) return;

        const modelItem = container.querySelector(`[data-model="${modelName}"]`);
        if (modelItem) {
            modelItem.querySelector('.model-switch-actions').innerHTML = `
                <button class="btn btn-success btn-sm disabled" disabled>
                    <i class="fas fa-spinner fa-spin"></i> 启动中...
                </button>
            `;
        }

        try {
            const token = window.authManager ? window.authManager.getToken() : null;
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch(`${API_BASE_URL}/models/${encodeURIComponent(modelName)}/start`, {
                method: 'POST',
                headers,
                timeout: 120000
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.currentModel = { name: modelName, ...data };
            this.renderQuickSwitchPanel();
            this.showToast('模型启动成功', 'success');
        } catch (error) {
            console.error('[SystemMonitor] Failed to start model:', error.message);
            this.renderQuickSwitchPanel();
            this.showToast(`启动失败: ${error.message}`, 'error');
        }
    }

    async stopModel(modelName) {
        const container = document.getElementById('quickSwitchContent');
        if (!container) return;

        const modelItem = container.querySelector(`[data-model="${modelName}"]`);
        if (modelItem) {
            modelItem.querySelector('.model-switch-actions').innerHTML = `
                <button class="btn btn-danger btn-sm disabled" disabled>
                    <i class="fas fa-spinner fa-spin"></i> 停止中...
                </button>
            `;
        }

        try {
            const token = window.authManager ? window.authManager.getToken() : null;
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch(`${API_BASE_URL}/models/${encodeURIComponent(modelName)}/stop`, {
                method: 'POST',
                headers,
                timeout: 30000
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            await response.json();
            this.currentModel = null;
            this.renderQuickSwitchPanel();
            this.showToast('模型已停止', 'success');
        } catch (error) {
            console.error('[SystemMonitor] Failed to stop model:', error.message);
            this.renderQuickSwitchPanel();
            this.showToast(`停止失败: ${error.message}`, 'error');
        }
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let iconClass = 'fa-info-circle';
        if (type === 'success') iconClass = 'fa-check-circle';
        else if (type === 'error') iconClass = 'fa-exclamation-circle';
        else if (type === 'warning') iconClass = 'fa-warning';

        toast.innerHTML = `
            <i class="fas ${iconClass}"></i>
            <span>${message}</span>
        `;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-fade-out');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }
}

const systemMonitor = new SystemMonitor();
window.systemMonitor = systemMonitor;
export default systemMonitor;
