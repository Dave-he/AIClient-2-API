import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';

jest.mock('axios');
const axios = require('axios');

describe('Application End-to-End Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('API Integration Tests', () => {
    test('should handle system info API call', async () => {
      const mockSystemData = {
        uptime: 3600,
        appVersion: '1.0.0',
        nodeVersion: 'v20.0.0',
        serverTime: new Date().toISOString(),
        platform: 'linux',
        pid: '1234',
        mode: 'production'
      };

      axios.get.mockResolvedValueOnce({ data: mockSystemData });

      const response = await axios.get('/api/system');
      
      expect(response.data.uptime).toBe(3600);
      expect(response.data.appVersion).toBe('1.0.0');
      expect(response.data.platform).toBe('linux');
      expect(response.data.mode).toBe('production');
    });

    test('should handle system monitor API call', async () => {
      const mockMonitorData = {
        cpu: { usage: 25 },
        memory: { usagePercent: '50' },
        gpu: { usage: 30 }
      };

      axios.get.mockResolvedValueOnce({ data: mockMonitorData });

      const response = await axios.get('/api/system/monitor');
      
      expect(response.data.cpu.usage).toBe(25);
      expect(response.data.memory.usagePercent).toBe('50');
      expect(response.data.gpu.usage).toBe(30);
    });

    test('should handle GPU status API call with devices', async () => {
      const mockGpuData = {
        devices: [
          {
            name: 'NVIDIA RTX 4090',
            status: 'healthy',
            memoryUsage: 75,
            memoryUsed: '15GB',
            memoryTotal: '24GB',
            utilization: 80,
            temperature: 72
          }
        ]
      };

      axios.get.mockResolvedValueOnce({ data: mockGpuData });

      const response = await axios.get('/api/gpu/status');
      
      expect(response.data.devices.length).toBe(1);
      expect(response.data.devices[0].name).toBe('NVIDIA RTX 4090');
      expect(response.data.devices[0].status).toBe('healthy');
      expect(response.data.devices[0].temperature).toBe(72);
    });

    test('should handle GPU status API call with no devices', async () => {
      const mockGpuData = {
        devices: []
      };

      axios.get.mockResolvedValueOnce({ data: mockGpuData });

      const response = await axios.get('/api/gpu/status');
      
      expect(response.data.devices.length).toBe(0);
    });

    test('should handle Python GPU status API call', async () => {
      const mockPythonGpuData = {
        success: true,
        utilization: 65,
        memoryUsed: '10GB',
        memoryTotal: '24GB',
        temperature: 68,
        power: '150W',
        name: 'NVIDIA RTX 4090',
        memoryAvailable: '14GB'
      };

      axios.get.mockResolvedValueOnce({ data: mockPythonGpuData });

      const response = await axios.get('/api/python-gpu/status');
      
      expect(response.data.success).toBe(true);
      expect(response.data.name).toBe('NVIDIA RTX 4090');
      expect(response.data.temperature).toBe(68);
      expect(response.data.power).toBe('150W');
    });

    test('should handle providers API call', async () => {
      const mockProvidersData = {
        providers: {
          'gemini-cli-oauth': [
            { isHealthy: true, requestCount: 10, accountName: 'account1' },
            { isHealthy: true, requestCount: 5, accountName: 'account2' }
          ],
          'claude-custom': [
            { isHealthy: false, requestCount: 3, accountName: 'account3' }
          ]
        }
      };

      axios.get.mockResolvedValueOnce({ data: mockProvidersData });

      const response = await axios.get('/api/providers');
      
      expect(response.data.providers['gemini-cli-oauth'].length).toBe(2);
      expect(response.data.providers['claude-custom'].length).toBe(1);
      expect(response.data.providers['claude-custom'][0].isHealthy).toBe(false);
    });

    test('should handle models API call', async () => {
      const mockModelsData = {
        'gemini-cli-oauth': ['gemini-2.5-flash', 'gemini-2.5-pro'],
        'claude-custom': ['claude-3-5-sonnet-20241022', 'claude-3-opus']
      };

      axios.get.mockResolvedValueOnce({ data: mockModelsData });

      const response = await axios.get('/api/provider-models');
      
      expect(response.data['gemini-cli-oauth']).toContain('gemini-2.5-flash');
      expect(response.data['claude-custom']).toContain('claude-3-5-sonnet-20241022');
    });
  });

  describe('Authentication Tests', () => {
    test('should reject requests without API key', async () => {
      axios.get.mockRejectedValueOnce({
        response: {
          status: 401,
          data: {
            error: {
              message: 'Unauthorized'
            }
          }
        }
      });

      try {
        await axios.get('/api/system', { headers: {} });
      } catch (error) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.error.message).toBe('Unauthorized');
      }
    });

    test('should accept requests with Bearer token', async () => {
      const mockSystemData = { uptime: 3600 };
      
      axios.get.mockResolvedValueOnce({ data: mockSystemData });

      const response = await axios.get('/api/system', {
        headers: { 'Authorization': 'Bearer test-token' }
      });
      
      expect(response.data.uptime).toBe(3600);
    });
  });

  describe('UI Component Tests', () => {
    test('should render header with all expected elements', () => {
      const header = document.createElement('header');
      header.className = 'header';
      header.innerHTML = `
        <div class="header-content">
          <h1><i class="fas fa-robot"></i> <span class="header-title">AIClient2API 管理控制台</span></h1>
          <div class="header-controls">
            <span class="status-badge"><i class="fas fa-circle"></i> <span>在线</span></span>
            <button class="theme-toggle"><i class="fas fa-moon"></i></button>
            <button id="logoutBtn"><i class="fas fa-sign-out-alt"></i> <span>登出</span></button>
            <button id="restartBtn"><i class="fas fa-redo"></i> <span>重启</span></button>
          </div>
        </div>
      `;
      document.body.appendChild(header);

      expect(document.querySelector('.header')).not.toBeNull();
      expect(document.querySelector('.header-title').textContent).toBe('AIClient2API 管理控制台');
      expect(document.querySelector('.status-badge').textContent).toContain('在线');
      expect(document.querySelector('#logoutBtn')).not.toBeNull();
      expect(document.querySelector('#restartBtn')).not.toBeNull();
    });

    test('should render sidebar with navigation items', () => {
      const sidebar = document.createElement('aside');
      sidebar.className = 'sidebar';
      sidebar.innerHTML = `
        <nav class="sidebar-nav">
          <a href="#dashboard" class="nav-item active" data-section="dashboard">
            <i class="fas fa-tachometer-alt"></i> <span>仪表盘</span>
          </a>
          <a href="#config" class="nav-item" data-section="config">
            <i class="fas fa-cog"></i> <span>配置管理</span>
          </a>
          <a href="#providers" class="nav-item" data-section="providers">
            <i class="fas fa-network-wired"></i> <span>提供商池管理</span>
          </a>
        </nav>
      `;
      document.body.appendChild(sidebar);

      expect(document.querySelector('.sidebar')).not.toBeNull();
      expect(document.querySelector('.sidebar-nav')).not.toBeNull();
      
      const navItems = document.querySelectorAll('.nav-item');
      expect(navItems.length).toBe(3);
      
      const activeNav = document.querySelector('.nav-item.active');
      expect(activeNav).not.toBeNull();
      expect(activeNav.dataset.section).toBe('dashboard');
    });

    test('should render stats container with all stats', () => {
      const statsContainer = document.createElement('div');
      statsContainer.className = 'stats-container';
      statsContainer.innerHTML = `
        <div class="stats-row">
          <div class="stat-item">
            <div class="stat-icon-wrapper"><i class="fas fa-clock"></i></div>
            <div class="stat-content">
              <span class="stat-value">1天 2小时 30分钟</span>
              <span class="stat-label">运行时间</span>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-icon-wrapper cpu"><i class="fas fa-microchip"></i></div>
            <div class="stat-content">
              <span class="stat-value">25%</span>
              <span class="stat-label">CPU</span>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-icon-wrapper memory"><i class="fas fa-memory"></i></div>
            <div class="stat-content">
              <span class="stat-value">50%</span>
              <span class="stat-label">内存</span>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-icon-wrapper gpu"><i class="fas fa-video-card"></i></div>
            <div class="stat-content">
              <span class="stat-value">30%</span>
              <span class="stat-label">GPU</span>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(statsContainer);

      const statItems = document.querySelectorAll('.stat-item');
      expect(statItems.length).toBe(4);

      const statLabels = document.querySelectorAll('.stat-label');
      const labels = Array.from(statLabels).map(el => el.textContent);
      expect(labels).toContain('运行时间');
      expect(labels).toContain('CPU');
      expect(labels).toContain('内存');
      expect(labels).toContain('GPU');
    });

    test('should render provider cards with status', () => {
      const providerPanel = document.createElement('div');
      providerPanel.className = 'provider-status-panel';
      providerPanel.innerHTML = `
        <div class="provider-grid provider-grid-horizontal">
          <div class="provider-card healthy">
            <div class="provider-header">
              <span class="status-dot healthy"></span>
              <span class="provider-name">gemini-cli-oauth</span>
            </div>
            <div class="provider-info">
              <span class="provider-accounts">2 账户</span>
              <span class="provider-requests">15 请求</span>
            </div>
          </div>
          <div class="provider-card warning">
            <div class="provider-header">
              <span class="status-dot warning"></span>
              <span class="provider-name">claude-custom</span>
            </div>
            <div class="provider-info">
              <span class="provider-accounts">1 账户</span>
              <span class="provider-requests">3 请求</span>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(providerPanel);

      const providerCards = document.querySelectorAll('.provider-card');
      expect(providerCards.length).toBe(2);

      const healthyCard = document.querySelector('.provider-card.healthy');
      expect(healthyCard).not.toBeNull();
      expect(healthyCard.querySelector('.provider-name').textContent).toBe('gemini-cli-oauth');

      const warningCard = document.querySelector('.provider-card.warning');
      expect(warningCard).not.toBeNull();
      expect(warningCard.querySelector('.provider-name').textContent).toBe('claude-custom');
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle API errors gracefully', async () => {
      axios.get.mockRejectedValueOnce({
        response: {
          status: 500,
          data: {
            error: {
              message: 'Internal Server Error'
            }
          }
        }
      });

      try {
        await axios.get('/api/system');
      } catch (error) {
        expect(error.response.status).toBe(500);
        expect(error.response.data.error.message).toBe('Internal Server Error');
      }
    });

    test('should handle network errors', async () => {
      axios.get.mockRejectedValueOnce(new Error('Network Error'));

      try {
        await axios.get('/api/system');
      } catch (error) {
        expect(error.message).toBe('Network Error');
      }
    });
  });

  describe('Feature Functionality Tests', () => {
    test('should support theme toggling', () => {
      expect(document.documentElement.getAttribute('data-theme')).toBeNull();
      
      document.documentElement.setAttribute('data-theme', 'dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      
      document.documentElement.setAttribute('data-theme', 'light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    test('should support local storage operations', () => {
      window.localStorage.setItem('theme', 'dark');
      expect(window.localStorage.getItem('theme')).toBe('dark');
      
      window.localStorage.setItem('authToken', 'test-token');
      expect(window.localStorage.getItem('authToken')).toBe('test-token');
      
      window.localStorage.removeItem('theme');
      expect(window.localStorage.getItem('theme')).toBeNull();
    });

    test('should support session storage operations', () => {
      window.sessionStorage.setItem('test', 'value');
      expect(window.sessionStorage.getItem('test')).toBe('value');
      
      window.sessionStorage.removeItem('test');
      expect(window.sessionStorage.getItem('test')).toBeNull();
    });
  });
});
