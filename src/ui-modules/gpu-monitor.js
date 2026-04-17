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
                logger.info('WebSocket