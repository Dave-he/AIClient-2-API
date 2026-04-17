import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from '../../src/views/Dashboard.vue';
import Header from '../../src/components/Header.vue';
import Sidebar from '../../src/components/Sidebar.vue';

jest.mock('axios');
const axios = require('axios');

const mockRouter = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', component: Dashboard }]
});

describe('Dashboard End-to-End Tests', () => {
  beforeEach(() => {
    axios.get.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Dashboard Component', () => {
    test('should render dashboard section with correct title', async () => {
      axios.get.mockResolvedValueOnce({ 
        data: { 
          uptime: 3600,
          appVersion: '1.0.0',
          nodeVersion: 'v20.0.0',
          serverTime: new Date().toISOString(),
          platform: 'linux',
          pid: '1234'
        } 
      });
      axios.get.mockResolvedValueOnce({ 
        data: { cpu: { usage: 25 }, memory: { usagePercent: '50' }, gpu: { usage: 30 } } 
      });
      axios.get.mockResolvedValueOnce({ data: { devices: [] } });
      axios.get.mockResolvedValueOnce({ data: { success: false } });
      axios.get.mockResolvedValueOnce({ data: { providers: {} } });
      axios.get.mockResolvedValueOnce({ data: {} });

      const wrapper = mount(Dashboard, {
        global: {
          plugins: [mockRouter]
        }
      });

      await wrapper.vm.$nextTick();
      
      expect(wrapper.find('section#dashboard').exists()).toBe(true);
      expect(wrapper.find('h2#dashboard-title').text()).toBe('系统概览');
    });

    test('should render stats container with CPU, memory, and GPU stats', async () => {
      axios.get.mockResolvedValueOnce({ 
        data: { 
          uptime: 3600,
          appVersion: '1.0.0',
          nodeVersion: 'v20.0.0',
          serverTime: new Date().toISOString(),
          platform: 'linux',
          pid: '1234'
        } 
      });
      axios.get.mockResolvedValueOnce({ 
        data: { cpu: { usage: 25 }, memory: { usagePercent: '50' }, gpu: { usage: 30 } } 
      });
      axios.get.mockResolvedValueOnce({ data: { devices: [] } });
      axios.get.mockResolvedValueOnce({ data: { success: false } });
      axios.get.mockResolvedValueOnce({ data: { providers: {} } });
      axios.get.mockResolvedValueOnce({ data: {} });

      const wrapper = mount(Dashboard, {
        global: {
          plugins: [mockRouter]
        }
      });

      await wrapper.vm.$nextTick();

      const statsContainer = wrapper.find('.stats-container');
      expect(statsContainer.exists()).toBe(true);
      
      const statItems = wrapper.findAll('.stat-item');
      expect(statItems.length).toBeGreaterThanOrEqual(4);
    });

    test('should render provider status panel', async () => {
      axios.get.mockResolvedValueOnce({ 
        data: { 
          uptime: 3600,
          appVersion: '1.0.0',
          nodeVersion: 'v20.0.0',
          serverTime: new Date().toISOString(),
          platform: 'linux',
          pid: '1234'
        } 
      });
      axios.get.mockResolvedValueOnce({ 
        data: { cpu: { usage: 25 }, memory: { usagePercent: '50' }, gpu: { usage: 30 } } 
      });
      axios.get.mockResolvedValueOnce({ data: { devices: [] } });
      axios.get.mockResolvedValueOnce({ data: { success: false } });
      axios.get.mockResolvedValueOnce({ 
        data: { 
          providers: {
            'gemini-cli-oauth': [{ isHealthy: true, requestCount: 10 }],
            'claude-custom': [{ isHealthy: true, requestCount: 5 }]
          }
        } 
      });
      axios.get.mockResolvedValueOnce({ data: {} });

      const wrapper = mount(Dashboard, {
        global: {
          plugins: [mockRouter]
        }
      });

      await wrapper.vm.$nextTick();

      const providerPanel = wrapper.find('.provider-status-panel');
      expect(providerPanel.exists()).toBe(true);
      
      const providerCards = wrapper.findAll('.provider-card');
      expect(providerCards.length).toBe(2);
    });

    test('should render expandable section for advanced info', async () => {
      axios.get.mockResolvedValueOnce({ 
        data: { 
          uptime: 3600,
          appVersion: '1.0.0',
          nodeVersion: 'v20.0.0',
          serverTime: new Date().toISOString(),
          platform: 'linux',
          pid: '1234'
        } 
      });
      axios.get.mockResolvedValueOnce({ 
        data: { cpu: { usage: 25 }, memory: { usagePercent: '50' }, gpu: { usage: 30 } } 
      });
      axios.get.mockResolvedValueOnce({ data: { devices: [] } });
      axios.get.mockResolvedValueOnce({ data: { success: false } });
      axios.get.mockResolvedValueOnce({ data: { providers: {} } });
      axios.get.mockResolvedValueOnce({ data: {} });

      const wrapper = mount(Dashboard, {
        global: {
          plugins: [mockRouter]
        }
      });

      await wrapper.vm.$nextTick();

      const expandableSection = wrapper.find('.expandable-section');
      expect(expandableSection.exists()).toBe(true);
      
      const summary = wrapper.find('.section-summary');
      expect(summary.exists()).toBe(true);
      expect(summary.text()).toContain('高级信息');
    });
  });

  describe('Header Component', () => {
    test('should render header with title', () => {
      const wrapper = mount(Header);
      
      expect(wrapper.find('header.header').exists()).toBe(true);
      expect(wrapper.find('.header-title').text()).toBe('AIClient2API 管理控制台');
    });

    test('should have status badge indicating online status', () => {
      const wrapper = mount(Header);
      
      const statusBadge = wrapper.find('.status-badge');
      expect(statusBadge.exists()).toBe(true);
      expect(statusBadge.text()).toContain('在线');
    });

    test('should have theme toggle button', () => {
      const wrapper = mount(Header);
      
      const themeToggle = wrapper.find('.theme-toggle');
      expect(themeToggle.exists()).toBe(true);
    });

    test('should have logout and restart buttons', () => {
      const wrapper = mount(Header);
      
      const logoutBtn = wrapper.find('#logoutBtn');
      const restartBtn = wrapper.find('#restartBtn');
      
      expect(logoutBtn.exists()).toBe(true);
      expect(restartBtn.exists()).toBe(true);
    });

    test('should have Kiro buy link', () => {
      const wrapper = mount(Header);
      
      const kiroLink = wrapper.find('.kiro-buy-link');
      expect(kiroLink.exists()).toBe(true);
      expect(kiroLink.text()).toContain('AI账号购买');
    });
  });

  describe('Sidebar Component', () => {
    test('should render sidebar with navigation items', () => {
      const wrapper = mount(Sidebar);
      
      expect(wrapper.find('aside.sidebar').exists()).toBe(true);
      
      const navItems = wrapper.findAll('.nav-item');
      expect(navItems.length).toBeGreaterThan(0);
    });

    test('should have dashboard navigation item', () => {
      const wrapper = mount(Sidebar);
      
      const dashboardNav = wrapper.find('[data-section="dashboard"]');
      expect(dashboardNav.exists()).toBe(true);
      expect(dashboardNav.text()).toContain('仪表盘');
    });

    test('should have all expected navigation sections', () => {
      const expectedSections = [
        'dashboard', 'guide', 'tutorial', 'config', 'providers', 
        'custom-models', 'upload-config', 'usage', 'plugins', 'logs', 'gpu-monitor'
      ];
      
      const wrapper = mount(Sidebar);
      
      expectedSections.forEach(section => {
        const navItem = wrapper.find(`[data-section="${section}"]`);
        expect(navItem.exists()).toBe(true);
      });
    });
  });
});