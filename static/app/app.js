// 主应用入口文件 - 模块化版本

// 导入所有模块
import {
    providerStats,
    REFRESH_INTERVALS
} from './constants.js';

import {
    showToast,
    getProviderStats
} from './utils.js';

import { t } from './i18n.js';

import {
    initFileUpload,
    fileUploadHandler
} from './file-upload.js';

import { 
    initNavigation 
} from './navigation.js';

import {
    initEventListeners,
    setDataLoaders,
    setReloadConfig
} from './event-handlers.js';

import {
    initEventStream,
    setProviderLoaders,
    setConfigLoaders
} from './event-stream.js';

import {
    loadSystemInfo,
    updateTimeDisplay,
    loadProviders,
    openProviderManager,
    showAuthModal,
    executeGenerateAuthUrl,
    handleGenerateAuthUrl,
    showAddProviderGroupModal
} from './provider-manager.js';

import {
    loadConfiguration,
    saveConfiguration,
    generateApiKey
} from './config-manager.js';

import {
    showProviderManagerModal,
    refreshProviderConfig,
    showModelSwitchModal,
    switchModel,
    startModel,
    stopModel
} from './modal.js';

import {
    initRoutingExamples
} from './routing-examples.js';

import {
    initUploadConfigManager,
    loadConfigList,
    viewConfig,
    deleteConfig,
    closeConfigModal,
    copyConfigContent,
    reloadConfig
} from './upload-config-manager.js';

import {
    initUsageManager,
    refreshUsage
} from './usage-manager.js';

import {
    initImageZoom
} from './image-zoom.js';

import {
    initPluginManager,
    togglePlugin
} from './plugin-manager.js';

import {
    initTutorialManager
} from './tutorial-manager.js';

import {
    CustomModelsManager
} from './custom-models-manager.js';

import { SystemMonitor } from './system-monitor.js';
import { GPUMonitorModule } from './gpu-monitor.js';

/**
 * 加载初始数据
 */
function loadInitialData() {
    loadSystemInfo();
    loadProviders();
    loadConfiguration();
    if (window.customModelsManager) {
        window.customModelsManager.load();
    }
}

/**
 * 初始化Provider切换器
 */
function initProviderSwitcher() {
    const providerSwitchBtn = document.getElementById('providerSwitchBtn');
    const providerDropdown = document.getElementById('providerDropdown');
    const providerList = document.getElementById('providerList');
    const currentProviderEl = document.getElementById('currentProvider');
    
    if (!providerSwitchBtn || !providerDropdown || !providerList) {
        console.log('Provider switcher elements not found');
        return;
    }
    
    // 切换下拉菜单显示/隐藏
    providerSwitchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        providerDropdown.classList.toggle('show');
    });
    
    // 点击页面其他地方关闭下拉菜单
    document.addEventListener('click', (e) => {
        if (!providerSwitchBtn.contains(e.target) && !providerDropdown.contains(e.target)) {
            providerDropdown.classList.remove('show');
        }
    });
    
    // 加载提供商列表
    async function loadProviderList() {
        try {
            providerList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> <span data-i18n="common.loading">加载中...</span></div>';
            
            const data = await window.apiClient.get('/api/providers/dynamic');
            if (!data || !data.providers) return;
            
            const providers = data.providers;
            const providerTypes = Object.keys(providers);
            
            if (providerTypes.length === 0) {
                providerList.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-secondary);">暂无可用的Provider</div>';
                return;
            }
            
            // 加载提供商配置以获取显示名称
            const staticData = await window.apiClient.get('/api/providers/static');
            const providerConfigs = staticData?.supportedProviders || [];
            const configMap = providerConfigs.reduce((map, config) => {
                map[config.id] = config;
                return map;
            }, {});
            
            providerList.innerHTML = '';
            
            providerTypes.forEach(providerType => {
                const accounts = providers[providerType] || [];
                const healthyCount = accounts.filter(acc => acc.isHealthy && !acc.isDisabled).length;
                const totalCount = accounts.length;
                const isHealthy = healthyCount > 0;
                
                const providerItem = document.createElement('div');
                providerItem.className = 'provider-item';
                providerItem.dataset.providerType = providerType;
                
                const displayName = configMap[providerType]?.name || providerType;
                
                providerItem.innerHTML = `
                    <span class="provider-name">${displayName}</span>
                    <span class="provider-status ${isHealthy ? 'status-healthy' : 'status-unhealthy'}">
                        ${healthyCount}/${totalCount}
                    </span>
                `;
                
                providerItem.addEventListener('click', async () => {
                    try {
                        // 切换默认提供商
                        const configData = await window.apiClient.get('/api/config');
                        const newConfig = {
                            ...configData,
                            MODEL_PROVIDER: providerType
                        };
                        
                        await window.apiClient.put('/api/config', newConfig);
                        
                        // 更新当前显示
                        currentProviderEl.textContent = displayName;
                        providerDropdown.classList.remove('show');
                        
                        // 显示成功消息
                        showToast(t('common.success'), `已切换到 ${displayName}`, 'success');
                        
                        // 重新加载配置和提供商数据
                        loadConfiguration();
                        loadProviders(true);
                    } catch (error) {
                        console.error('Failed to switch provider:', error);
                        showToast(t('common.error'), '切换Provider失败', 'error');
                    }
                });
                
                providerList.appendChild(providerItem);
            });
        } catch (error) {
            console.error('Failed to load provider list:', error);
            providerList.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--danger-color);">加载Provider列表失败</div>';
        }
    }
    
    // 初始加载
    loadProviderList();
    
    // 定期刷新提供商列表
    setInterval(loadProviderList, REFRESH_INTERVALS.SYSTEM_INFO);
    
    // 点击按钮时刷新列表
    providerSwitchBtn.addEventListener('click', () => {
        if (providerDropdown.classList.contains('show')) {
            loadProviderList();
        }
    });
}

/**
 * 初始化应用
 */
function initApp() {
    // 设置数据加载器
    setDataLoaders(loadInitialData, saveConfiguration);
    
    // 设置reloadConfig函数
    setReloadConfig(reloadConfig);
    
    // 设置提供商加载器
    setProviderLoaders(loadProviders, refreshProviderConfig);
    
    // 设置配置加载器
    setConfigLoaders(loadConfigList);
    
    // 初始化各个模块
    initNavigation();
    initEventListeners();
    initEventStream();
    initFileUpload(); // 初始化文件上传功能
    initRoutingExamples(); // 初始化路径路由示例功能
    initUploadConfigManager(); // 初始化配置管理功能
    initUsageManager(); // 初始化用量管理功能
    initImageZoom(); // 初始化图片放大功能
    initPluginManager(); // 初始化插件管理功能
    initTutorialManager(); // 初始化教程管理功能
    initProviderSwitcher(); // 初始化Provider切换器
    
    // 初始化自定义模型管理
    window.customModelsManager = new CustomModelsManager();
    
    // 初始化系统监控
    window.systemMonitor = new SystemMonitor();
    
    // 初始化GPU监控模块
    window.GPUMonitor = new GPUMonitorModule();
    
    initMobileMenu(); // 初始化移动端菜单
    loadInitialData();
    
    // 显示欢迎消息
    showToast(t('common.success'), t('common.welcome'), 'success');
    
    // 每5秒更新服务器时间和运行时间显示
    setInterval(() => {
        updateTimeDisplay();
    }, 5000);
    
    // 定期刷新系统信息
    setInterval(() => {
        loadProviders();

        if (providerStats.activeProviders > 0) {
            const stats = getProviderStats(providerStats);
            console.log('=== 提供商统计报告 ===');
            console.log(`活跃提供商: ${stats.activeProviders}`);
            console.log(`健康提供商: ${stats.healthyProviders} (${stats.healthRatio})`);
            console.log(`总账户数: ${stats.totalAccounts}`);
            console.log(`总请求数: ${stats.totalRequests}`);
            console.log(`总错误数: ${stats.totalErrors}`);
            console.log(`成功率: ${stats.successRate}`);
            console.log(`平均每提供商请求数: ${stats.avgUsagePerProvider}`);
            console.log('========================');
        }
    }, REFRESH_INTERVALS.SYSTEM_INFO);

}

/**
 * 初始化移动端菜单
 */
function initMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const headerControls = document.getElementById('headerControls');
    
    if (!mobileMenuToggle || !headerControls) {
        console.log('Mobile menu elements not found');
        return;
    }
    
    // 默认隐藏header-controls
    headerControls.style.display = 'none';
    
    let isMenuOpen = false;
    
    mobileMenuToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Mobile menu toggle clicked, current state:', isMenuOpen);
        
        isMenuOpen = !isMenuOpen;
        
        if (isMenuOpen) {
            headerControls.style.display = 'flex';
            mobileMenuToggle.innerHTML = '<i class="fas fa-times"></i>';
            console.log('Menu opened');
        } else {
            headerControls.style.display = 'none';
            mobileMenuToggle.innerHTML = '<i class="fas fa-bars"></i>';
            console.log('Menu closed');
        }
    });
    
    // 点击页面其他地方关闭菜单
    document.addEventListener('click', (e) => {
        if (isMenuOpen && !mobileMenuToggle.contains(e.target) && !headerControls.contains(e.target)) {
            isMenuOpen = false;
            headerControls.style.display = 'none';
            mobileMenuToggle.innerHTML = '<i class="fas fa-bars"></i>';
            console.log('Menu closed by clicking outside');
        }
    });
}

// 等待组件加载完成后初始化应用
// 组件加载器会在所有组件加载完成后触发 'componentsLoaded' 事件
window.addEventListener('componentsLoaded', initApp);

// 如果组件已经加载完成（例如页面刷新后），也需要初始化
// 检查是否有组件已经存在
document.addEventListener('DOMContentLoaded', () => {
    // 如果 sidebar 和 content 已经有内容，说明组件已加载
    const sidebarContainer = document.getElementById('sidebar-container');
    const contentContainer = document.getElementById('content-container');
    
    // 如果容器不存在或为空，说明使用的是组件加载方式，等待 componentsLoaded 事件
    // 如果容器已有内容，说明是静态 HTML，直接初始化
    if (sidebarContainer && contentContainer) {
        const hasContent = sidebarContainer.children.length > 0 || contentContainer.children.length > 0;
        if (hasContent) {
            // 静态 HTML 方式，直接初始化
            initApp();
        }
        // 否则等待 componentsLoaded 事件
    }
});

// 导出全局函数供其他模块使用
window.loadProviders = loadProviders;
window.openProviderManager = openProviderManager;
window.showProviderManagerModal = showProviderManagerModal;
window.refreshProviderConfig = refreshProviderConfig;
window.fileUploadHandler = fileUploadHandler;
window.showAuthModal = showAuthModal;
window.executeGenerateAuthUrl = executeGenerateAuthUrl;
window.handleGenerateAuthUrl = handleGenerateAuthUrl;
window.showAddProviderGroupModal = showAddProviderGroupModal;
window.showModelSwitchModal = showModelSwitchModal;
window.switchModel = switchModel;
window.startModel = startModel;
window.stopModel = stopModel;

// 配置管理相关全局函数
window.viewConfig = viewConfig;
window.deleteConfig = deleteConfig;
window.loadConfigList = loadConfigList;
window.closeConfigModal = closeConfigModal;
window.copyConfigContent = copyConfigContent;
window.reloadConfig = reloadConfig;
window.generateApiKey = generateApiKey;

// 用量管理相关全局函数
window.refreshUsage = refreshUsage;

// 插件管理相关全局函数
window.togglePlugin = togglePlugin;

// 导出调试函数
window.getProviderStats = () => getProviderStats(providerStats);

console.log('AIClient2API 管理控制台已加载 - 模块化版本');
