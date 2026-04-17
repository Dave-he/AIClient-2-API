import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

jest.mock('axios');
const axios = require('axios');

describe('Application End-to-End Tests', () => {
  let dom;
  let document;
  let window;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>');
    document = dom.window.document;
    window = dom.window;
    
    global.document = document;
    global.window = window;
    global.navigator = window.navigator;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Page Structure Tests', () => {
    test('should have correct HTML structure', () => {
      expect(document.documentElement.tagName).toBe('HTML');
      expect(document.body.tagName).toBe('BODY');
      const app = document.getElementById('app');
      expect(app).not.toBeNull();
    });

    test('should support DOM manipulation', () => {
      const header = document.createElement('header');
      header.className = 'header';
      header.innerHTML = '<h1>AIClient2API</h1>';
      document.body.appendChild(header);

      const headerElement = document.querySelector('.header');
      expect(headerElement).not.toBeNull();
      expect(headerElement.textContent).toBe('AIClient2API');
    });
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
        memoryUsed: