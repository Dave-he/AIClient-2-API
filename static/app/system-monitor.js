const CONTROLLER_BASE_URL = 'http://localhost:5000';

let systemMonitorInstance = null;

export class SystemMonitor {
    constructor() {
        if (systemMonitorInstance) {
            return systemMonitorInstance;
        }
        
        this.pollingInterval = null;
        this.chart = null;
        this.currentChartType = 'cpu';
        this.cpuHistoryData = [];
        this.memoryHistoryData = [];
        this.gpuHistoryData = [];
        this.gpuTempHistoryData = [];
        this.maxDataPoints = 60;
        this.isInitialized = false;
        
        systemMonitorInstance = this;
        this.init();
    }

    init() {
        const initWhenReady = () => {
            if (this.isInitialized) return;
            
            console.log('[SystemMonitor] Initializing...');
            const dashboardSection = document.getElementById('dashboard');
            
            if (!dashboardSection) {
                console.log('[SystemMonitor] Dashboard not found, retrying...');
                setTimeout(initWhenReady, 500);
                return;
            }
            
            this.isInitialized = true;
            this.setupEventListeners();
            this.startPolling();
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
        const chartTabs = document.querySelectorAll('.chart-tab');
        chartTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                chartTabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.currentChartType = e.target.dataset.chartType;
                this.updateLegend();
                this.updateChart();
            });
        });

        const refreshBtn = document.getElementById('refreshGpuStatusBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshGpuStatus());
        }

        document.addEventListener('section-change', (event) => {
            if (event.detail.section === 'dashboard') {
                this.refreshAllStatus();
            }
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

    startPolling() {
        this.stopPolling();
        this.refreshAllStatus();
        this.pollingInterval = setInterval(() => {
            this.refreshAllStatus();
        }, 2000);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    async refreshAllStatus() {
        await Promise.all([
            this.updateSystemStatsFromServer(),
            this.refreshGpuStatus()
        ]);
        this.updateChart();
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
                
                if (cpuValueEl) cpuValueEl.textContent = `${data.cpu.usage.toFixed(1)}%`;
                if (memoryValueEl) memoryValueEl.textContent = `${parseFloat(data.memory.usagePercent).toFixed(1)}%`;
                if (memoryTotalEl) memoryTotalEl.textContent = data.memory.total;
                if (cpuCoresEl) cpuCoresEl.textContent = data.cpu.cores.toString();

                if (data.cpu.history && data.cpu.history.length > 0) {
                    this.cpuHistoryData = [...data.cpu.history];
                    console.log('[SystemMonitor] CPU history length:', this.cpuHistoryData.length);
                }
                if (data.memory.history && data.memory.history.length > 0) {
                    this.memoryHistoryData = [...data.memory.history];
                    console.log('[SystemMonitor] Memory history length:', this.memoryHistoryData.length);
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

        document.getElementById('cpuValue')?.textContent = cpuUsage;
        document.getElementById('memoryValue')?.textContent = memoryInfo.usagePercent;
        document.getElementById('memoryTotal')?.textContent = memoryInfo.total;

        this.addToHistory(this.cpuHistoryData, parseFloat(cpuUsage));
        this.addToHistory(this.memoryHistoryData, parseFloat(memoryInfo.usagePercent));
    }

    addToHistory(history, value) {
        if (!isNaN(value)) {
            history.push(value);
            if (history.length > this.maxDataPoints) {
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
                }
                totalIdle += cpu.times.idle;
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
            const response = await fetch(`${CONTROLLER_BASE_URL}/manage/gpu`, {
                method: 'GET',
                timeout: 5000
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.renderGpuStatus(data, container);

            if (data.primary) {
                if (data.primary.utilization !== undefined) {
                    this.addToHistory(this.gpuHistoryData, data.primary.utilization);
                }
                if (data.primary.temperature !== undefined) {
                    this.addToHistory(this.gpuTempHistoryData, data.primary.temperature);
                }
            }
        } catch (error) {
            container.innerHTML = `
                <div class="status-loading">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>无法获取GPU状态</span>
                </div>
            `;
            document.getElementById('gpuValue')?.textContent = '--';
            this.addToHistory(this.gpuHistoryData, 0);
            this.addToHistory(this.gpuTempHistoryData, 0);
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
            document.getElementById('gpuValue')?.textContent = '--';
            return;
        }

        const gpu = data.primary;
        const memoryPercent = (gpu.used_memory / gpu.total_memory) * 100;
        const memoryClass = memoryPercent > 90 ? 'high' : memoryPercent > 70 ? 'medium' : 'low';

        document.getElementById('gpuValue')?.textContent = `${gpu.utilization || 0}%`;

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
                        <div class="metric-value">${gpu.utilization || 0}%</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">可用显存</div>
                        <div class="metric-value">${(gpu.available_memory / (1024**3)).toFixed(1)} GB</div>
                    </div>
                </div>
            </div>
        `;
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
                    width: containerRect.width - 32,
                    height: containerRect.height - 32
                };
            }
        }

        if (rect.width <= 0 || rect.height <= 0) {
            console.log('[SystemMonitor] Invalid dimensions:', rect);
            return;
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
            console.log('[SystemMonitor] Initializing chart...');
            this.initChart();
        }

        if (!this.chart) {
            console.log('[SystemMonitor] Chart not initialized');
            return;
        }

        console.log('[SystemMonitor] Chart dimensions:', this.chart.width, 'x', this.chart.height);
        
        const { ctx, width, height, padding } = this.chart;
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, width, height);

        let datasets = [];
        let dataLength = 0;
        
        console.log('[SystemMonitor] Current chart type:', this.currentChartType);
        console.log('[SystemMonitor] CPU history length:', this.cpuHistoryData.length);
        console.log('[SystemMonitor] Memory history length:', this.memoryHistoryData.length);
        console.log('[SystemMonitor] GPU history length:', this.gpuHistoryData.length);

        if (this.currentChartType === 'cpu' || this.currentChartType === 'all') {
            datasets.push({
                data: [...this.cpuHistoryData],
                color: '#3b82f6',
                label: 'CPU使用率',
                gradient: ['#3b82f6', '#60a5fa']
            });
            dataLength = Math.max(dataLength, this.cpuHistoryData.length);
        }

        if (this.currentChartType === 'memory' || this.currentChartType === 'all') {
            datasets.push({
                data: [...this.memoryHistoryData],
                color: '#f59e0b',
                label: '内存使用率',
                gradient: ['#f59e0b', '#fbbf24']
            });
            dataLength = Math.max(dataLength, this.memoryHistoryData.length);
        }

        if (this.currentChartType === 'gpu' || this.currentChartType === 'all') {
            datasets.push({
                data: [...this.gpuHistoryData],
                color: '#8b5cf6',
                label: 'GPU使用率',
                gradient: ['#8b5cf6', '#a78bfa']
            });
            datasets.push({
                data: [...this.gpuTempHistoryData],
                color: '#ef4444',
                label: 'GPU温度',
                gradient: ['#ef4444', '#f87171'],
                isTemperature: true
            });
            dataLength = Math.max(dataLength, this.gpuHistoryData.length, this.gpuTempHistoryData.length);
        }

        if (dataLength === 0) {
            this.renderEmptyChart();
            return;
        }

        let allValues = [];
        datasets.forEach(ds => allValues.push(...ds.data.filter(v => v > 0)));
        const minValue = allValues.length > 0 ? Math.min(...allValues) * 0.9 : 0;
        const maxValue = allValues.length > 0 ? Math.max(...allValues) * 1.1 : 100;

        this.drawGrid(ctx, chartWidth, chartHeight, padding, minValue, maxValue);
        this.drawAxes(ctx, chartWidth, chartHeight, padding, minValue, maxValue);
        datasets.forEach(ds => {
            this.drawArea(ctx, chartWidth, chartHeight, padding, ds, minValue, maxValue);
            this.drawLine(ctx, chartWidth, chartHeight, padding, ds, minValue, maxValue);
        });
        datasets.forEach(ds => {
            this.drawPoint(ctx, chartWidth, chartHeight, padding, ds, minValue, maxValue);
        });
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
            ctx.fillText(Math.round(value) + (this.currentChartType === 'gpu' ? '°C' : '%'), padding.left - 8, y + 4);
        }

        ctx.textAlign = 'center';
        const timeLabels = ['-60s', '-45s', '-30s', '-15s', '现在'];
        for (let i = 0; i < 5; i++) {
            const x = padding.left + (chartWidth / 4) * i;
            ctx.fillText(timeLabels[i], x, padding.top + chartHeight + 22);
        }
    }

    drawArea(ctx, chartWidth, chartHeight, padding, dataset, minValue, maxValue) {
        const dataLength = dataset.data.length;
        if (dataLength < 2) return;

        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
        gradient.addColorStop(0, dataset.gradient[0] + '40');
        gradient.addColorStop(1, dataset.gradient[1] + '05');

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

        const x = padding.left + (chartWidth / (dataLength - 1)) * lastIndex;
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
}

const systemMonitor = new SystemMonitor();
export default systemMonitor;