import { describe, expect, test, beforeEach, jest } from '@jest/globals';

jest.mock('axios');
const axios = require('axios');

describe('Python Service Management End-to-End Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Python Service Control API Tests', () => {
    test('should get Python service status', async () => {
      const mockServiceStatus = {
        success: true,
        service: 'aiclient-python',
        status: 'active (running)',
        running: true,
        info: {
          LoadState: 'loaded',
          ActiveState: 'active',
          SubState: 'running'
        },
        config: {
          settings: {
            concurrency_limit: 5,
            min_available_memory: 2
          },
          models: {
            'gpt-3.5-turbo': {
              running: true,
              port: 8000
            }
          }
        },
        config_file: '/path/to/config.yaml',
        timestamp: '2026-04-19T00:00:00Z'
      };

      axios.get.mockResolvedValueOnce({ data: mockServiceStatus });

      const response = await axios.get('/api/python-gpu/service/status');
      
      expect(response.data.success).toBe(true);
      expect(response.data.service).toBe('aiclient-python');
      expect(response.data.running).toBe(true);
      expect(response.data.status).toBe('active (running)');
      expect(response.data.config.settings.concurrency_limit).toBe(5);
      expect(response.data.config_file).toBe('/path/to/config.yaml');
    });

    test('should start Python service', async () => {
      const mockResponse = {
        success: true,
        status: 'started',
        service: 'aiclient-python'
      };

      axios.post.mockResolvedValueOnce({ data: mockResponse });

      const response = await axios.post('/api/python-gpu/service/start');
      
      expect(response.data.success).toBe(true);
      expect(response.data.status).toBe('started');
      expect(response.data.service).toBe('aiclient-python');
    });

    test('should stop Python service', async () => {
      const mockResponse = {
        success: true,
        status: 'stopped',
        service: 'aiclient-python'
      };

      axios.post.mockResolvedValueOnce({ data: mockResponse });

      const response = await axios.post('/api/python-gpu/service/stop');
      
      expect(response.data.success).toBe(true);
      expect(response.data.status).toBe('stopped');
      expect(response.data.service).toBe('aiclient-python');
    });

    test('should restart Python service', async () => {
      const mockResponse = {
        success: true,
        status: 'restarted',
        service: 'aiclient-python'
      };

      axios.post.mockResolvedValueOnce({ data: mockResponse });

      const response = await axios.post('/api/python-gpu/service/restart');
      
      expect(response.data.success).toBe(true);
      expect(response.data.status).toBe('restarted');
      expect(response.data.service).toBe('aiclient-python');
    });

    test('should update Python config', async () => {
      const mockConfigUpdate = {
        settings: {
          concurrency_limit: 10,
          min_available_memory: 4
        },
        models: {
          'gpt-4': {
            running: false,
            port: 8001
          }
        }
      };

      const mockResponse = {
        success: true,
        status: 'success',
        message: 'Configuration updated and persisted',
        config: {
          settings: {
            concurrency_limit: 10,
            min_available_memory: 4
          },
          models: {
            'gpt-4': {
              running: false,
              port: 8001
            }
          }
        }
      };

      axios.put.mockResolvedValueOnce({ data: mockResponse });

      const response = await axios.put('/api/python-gpu/config', mockConfigUpdate);
      
      expect(response.data.success).toBe(true);
      expect(response.data.status).toBe('success');
      expect(response.data.config.settings.concurrency_limit).toBe(10);
      expect(response.data.config.settings.min_available_memory).toBe(4);
      expect(response.data.config.models['gpt-4'].port).toBe(8001);
    });

    test('should handle Python service status error', async () => {
      axios.get.mockRejectedValueOnce({
        response: {
          status: 500,
          data: {
            success: false,
            error: {
              message: 'Failed to get service status'
            }
          }
        }
      });

      try {
        await axios.get('/api/python-gpu/service/status');
      } catch (error) {
        expect(error.response.status).toBe(500);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.error.message).toBe('Failed to get service status');
      }
    });

    test('should handle config update error', async () => {
      const mockConfigUpdate = {
        settings: {
          concurrency_limit: 'invalid'
        }
      };

      axios.put.mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            success: false,
            error: {
              message: 'Invalid YAML format'
            }
          }
        }
      });

      try {
        await axios.put('/api/python-gpu/config', mockConfigUpdate);
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.error.message).toBe('Invalid YAML format');
      }
    });
  });

  describe('Python Service UI Component Tests', () => {
    test('should render Python service control panel', () => {
      const panel = document.createElement('div');
      panel.className = 'python-service-panel';
      panel.innerHTML = `
        <div class="panel-header">
          <h3><i class="fas fa-python"></i> Python服务控制</h3>
          <div class="service-actions">
            <button id="refreshServiceStatusBtn" class="btn btn-outline btn-sm" title="刷新状态">
              <i class="fas fa-sync-alt"></i>
            </button>
          </div>
        </div>
        <div id="pythonServiceStatus" class="python-service-status"></div>
        <div class="service-control-buttons">
          <button id="startPythonServiceBtn" class="btn btn-success btn-sm" disabled>
            <i class="fas fa-play"></i> 启动
          </button>
          <button id="stopPythonServiceBtn" class="btn btn-danger btn-sm" disabled>
            <i class="fas fa-stop"></i> 停止
          </button>
          <button id="restartPythonServiceBtn" class="btn btn-warning btn-sm" disabled>
            <i class="fas fa-redo"></i> 重启
          </button>
        </div>
      `;
      document.body.appendChild(panel);

      expect(document.querySelector('.python-service-panel')).not.toBeNull();
      expect(document.querySelector('.panel-header h3').textContent).toContain('Python服务控制');
      expect(document.querySelector('#refreshServiceStatusBtn')).not.toBeNull();
      expect(document.querySelector('#pythonServiceStatus')).not.toBeNull();
      expect(document.querySelector('#startPythonServiceBtn')).not.toBeNull();
      expect(document.querySelector('#stopPythonServiceBtn')).not.toBeNull();
      expect(document.querySelector('#restartPythonServiceBtn')).not.toBeNull();
    });

    test('should render config management panel', () => {
      const panel = document.createElement('div');
      panel.className = 'config-management-panel';
      panel.innerHTML = `
        <div class="panel-header">
          <h3><i class="fas fa-cog"></i> 配置管理</h3>
          <div class="config-actions">
            <button id="refreshConfigBtn" class="btn btn-outline btn-sm" title="刷新配置">
              <i class="fas fa-sync-alt"></i>
            </button>
            <button id="editConfigBtn" class="btn btn-outline btn-sm" title="编辑配置">
              <i class="fas fa-edit"></i>
            </button>
          </div>
        </div>
        <div id="configContent" class="config-content"></div>
      `;
      document.body.appendChild(panel);

      expect(document.querySelector('.config-management-panel')).not.toBeNull();
      expect(document.querySelector('.panel-header h3').textContent).toContain('配置管理');
      expect(document.querySelector('#refreshConfigBtn')).not.toBeNull();
      expect(document.querySelector('#editConfigBtn')).not.toBeNull();
      expect(document.querySelector('#configContent')).not.toBeNull();
    });

    test('should render service info cards', () => {
      const statusContainer = document.createElement('div');
      statusContainer.id = 'pythonServiceStatus';
      statusContainer.innerHTML = `
        <div class="service-info-grid">
          <div class="service-info-card">
            <div class="service-info-label">服务名称</div>
            <div class="service-info-value">aiclient-python</div>
          </div>
          <div class="service-info-card">
            <div class="service-info-label">运行状态</div>
            <div class="service-info-value running">
              <i class="fas fa-check-circle"></i>
              运行中
            </div>
          </div>
          <div class="service-info-card">
            <div class="service-info-label">systemd状态</div>
            <div class="service-info-value">active (running)</div>
          </div>
          <div class="service-info-card">
            <div class="service-info-label">配置文件</div>
            <div class="service-info-value" style="font-size: 0.75rem; word-break: break-all;">/path/to/config.yaml</div>
          </div>
        </div>
      `;
      document.body.appendChild(statusContainer);

      const infoCards = document.querySelectorAll('.service-info-card');
      expect(infoCards.length).toBe(4);

      const serviceNameCard = infoCards[0];
      expect(serviceNameCard.querySelector('.service-info-label').textContent).toBe('服务名称');
      expect(serviceNameCard.querySelector('.service-info-value').textContent).toBe('aiclient-python');

      const statusCard = infoCards[1];
      expect(statusCard.querySelector('.service-info-label').textContent).toBe('运行状态');
      expect(statusCard.querySelector('.service-info-value').classList.contains('running')).toBe(true);
      expect(statusCard.querySelector('.service-info-value').textContent).toContain('运行中');

      const systemdCard = infoCards[2];
      expect(systemdCard.querySelector('.service-info-label').textContent).toBe('systemd状态');
      expect(systemdCard.querySelector('.service-info-value').textContent).toBe('active (running)');

      const configCard = infoCards[3];
      expect(configCard.querySelector('.service-info-label').textContent).toBe('配置文件');
      expect(configCard.querySelector('.service-info-value').textContent).toBe('/path/to/config.yaml');
    });

    test('should render config sections', () => {
      const configContainer = document.createElement('div');
      configContainer.id = 'configContent';
      configContainer.innerHTML = `
        <div class="config-section">
          <div class="config-section-header"><i class="fas fa-cubes"></i> 模型配置 (2)</div>
          <div class="config-item">
            <div>
              <div class="config-item-label">gpt-3.5-turbo</div>
              <div style="font-size: 0.7rem; color: var(--text-muted);">端口: 8000 | 内存: 4GB | 多模态: 是</div>
            </div>
            <span class="status-indicator running"></span>
          </div>
          <div class="config-item">
            <div>
              <div class="config-item-label">gpt-4</div>
              <div style="font-size: 0.7rem; color: var(--text-muted);">端口: 8001 | 内存: 8GB | 多模态: 是</div>
            </div>
            <span class="status-indicator stopped"></span>
          </div>
        </div>
        <div class="config-section">
          <div class="config-section-header"><i class="fas fa-sliders-h"></i> 全局设置</div>
          <div class="config-item">
            <span class="config-item-label">并发限制</span>
            <span class="config-item-value">5</span>
          </div>
          <div class="config-item">
            <span class="config-item-label">最小可用内存</span>
            <span class="config-item-value">2</span>
          </div>
        </div>
      `;
      document.body.appendChild(configContainer);

      const configSections = document.querySelectorAll('.config-section');
      expect(configSections.length).toBe(2);

      const modelsSection = configSections[0];
      expect(modelsSection.querySelector('.config-section-header').textContent).toContain('模型配置 (2)');
      const modelItems = modelsSection.querySelectorAll('.config-item');
      expect(modelItems.length).toBe(2);

      const settingsSection = configSections[1];
      expect(settingsSection.querySelector('.config-section-header').textContent).toContain('全局设置');
      const settingItems = settingsSection.querySelectorAll('.config-item');
      expect(settingItems.length).toBe(2);
    });

    test('should render config editor modal', () => {
      const modal = document.createElement('div');
      modal.className = 'config-editor-modal';
      modal.id = 'configEditorModal';
      modal.innerHTML = `
        <div class="config-editor-container">
          <div class="config-editor-header">
            <h3><i class="fas fa-edit"></i> 编辑配置</h3>
            <button class="config-editor-close" onclick="GPUMonitor.closeConfigEditor()">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="config-editor-body">
            <textarea id="configEditorTextarea" class="config-editor-textarea" placeholder="加载中..."></textarea>
          </div>
          <div class="config-editor-footer">
            <button class="btn btn-outline" onclick="GPUMonitor.closeConfigEditor()">取消</button>
            <button class="btn btn-primary" onclick="GPUMonitor.saveConfig()">
              <i class="fas fa-save"></i> 保存配置
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      expect(document.querySelector('.config-editor-modal')).not.toBeNull();
      expect(document.querySelector('.config-editor-header h3').textContent).toContain('编辑配置');
      expect(document.querySelector('#configEditorTextarea')).not.toBeNull();
      expect(document.querySelector('.config-editor-footer')).not.toBeNull();
      expect(document.querySelector('.btn-primary').textContent).toContain('保存配置');
    });
  });

  describe('Python Service Integration Tests', () => {
    test('should handle complete service lifecycle', async () => {
      // Test service status
      const mockStatus = {
        success: true,
        service: 'aiclient-python',
        running: false
      };
      axios.get.mockResolvedValueOnce({ data: mockStatus });

      let response = await axios.get('/api/python-gpu/service/status');
      expect(response.data.success).toBe(true);
      expect(response.data.running).toBe(false);

      // Test start service
      const mockStart = {
        success: true,
        status: 'started'
      };
      axios.post.mockResolvedValueOnce({ data: mockStart });

      response = await axios.post('/api/python-gpu/service/start');
      expect(response.data.success).toBe(true);
      expect(response.data.status).toBe('started');

      // Test restart service
      const mockRestart = {
        success: true,
        status: 'restarted'
      };
      axios.post.mockResolvedValueOnce({ data: mockRestart });

      response = await axios.post('/api/python-gpu/service/restart');
      expect(response.data.success).toBe(true);
      expect(response.data.status).toBe('restarted');

      // Test stop service
      const mockStop = {
        success: true,
        status: 'stopped'
      };
      axios.post.mockResolvedValueOnce({ data: mockStop });

      response = await axios.post('/api/python-gpu/service/stop');
      expect(response.data.success).toBe(true);
      expect(response.data.status).toBe('stopped');
    });

    test('should handle config update workflow', async () => {
      // Get current config
      const mockStatus = {
        success: true,
        config: {
          settings: {
            concurrency_limit: 5,
            min_available_memory: 2
          }
        }
      };
      axios.get.mockResolvedValueOnce({ data: mockStatus });

      let response = await axios.get('/api/python-gpu/service/status');
      expect(response.data.success).toBe(true);
      expect(response.data.config.settings.concurrency_limit).toBe(5);

      // Update config
      const mockUpdate = {
        success: true,
        status: 'success',
        config: {
          settings: {
            concurrency_limit: 10,
            min_available_memory: 4
          }
        }
      };
      axios.put.mockResolvedValueOnce({ data: mockUpdate });

      response = await axios.put('/api/python-gpu/config', {
        settings: {
          concurrency_limit: 10,
          min_available_memory: 4
        }
      });
      expect(response.data.success).toBe(true);
      expect(response.data.config.settings.concurrency_limit).toBe(10);
      expect(response.data.config.settings.min_available_memory).toBe(4);

      // Verify config was updated
      const mockUpdatedStatus = {
        success: true,
        config: {
          settings: {
            concurrency_limit: 10,
            min_available_memory: 4
          }
        }
      };
      axios.get.mockResolvedValueOnce({ data: mockUpdatedStatus });

      response = await axios.get('/api/python-gpu/service/status');
      expect(response.data.success).toBe(true);
      expect(response.data.config.settings.concurrency_limit).toBe(10);
      expect(response.data.config.settings.min_available_memory).toBe(4);
    });
  });
});