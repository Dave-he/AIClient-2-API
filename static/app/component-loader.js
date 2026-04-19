/**
 * 组件加载器 - 用于动态加载 HTML 组件片段
 * Component Loader - For dynamically loading HTML component fragments
 */

// 组件缓存
const componentCache = new Map();

/**
 * 加载单个组件
 * @param {string} componentPath - 组件文件路径
 * @returns {Promise<string>} - 组件 HTML 内容
 */
async function loadComponent(componentPath) {
    // 检查缓存
    if (componentCache.has(componentPath)) {
        return componentCache.get(componentPath);
    }

    try {
        const response = await fetch(componentPath);
        if (!response.ok) {
            throw new Error(`Failed to load component: ${componentPath} (${response.status})`);
        }
        const html = await response.text();
        // 缓存组件
        componentCache.set(componentPath, html);
        return html;
    } catch (error) {
        console.error(`Error loading component ${componentPath}:`, error);
        throw error;
    }
}

/**
 * 从HTML内容中提取并加载CSS链接
 * @param {string} html - HTML内容
 */
function extractAndLoadCSS(html) {
    const linkRegex = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
    let match;
    const loadedStylesheets = new Set();
    
    // 获取已加载的样式表
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        loadedStylesheets.add(link.href);
    });
    
    while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1];
        const fullUrl = new URL(href, window.location.origin).href;
        
        if (!loadedStylesheets.has(fullUrl)) {
            const linkElement = document.createElement('link');
            linkElement.rel = 'stylesheet';
            linkElement.href = href;
            document.head.appendChild(linkElement);
            loadedStylesheets.add(fullUrl);
        }
    }
}

/**
 * 移除HTML内容中的<link>标签
 * @param {string} html - HTML内容
 * @returns {string} - 清理后的HTML内容
 */
function removeLinkTags(html) {
    return html.replace(/<link\s+[^>]*rel=["']stylesheet["'][^>]*>/gi, '');
}

/**
 * 将组件插入到指定容器
 * @param {string} componentPath - 组件文件路径
 * @param {string|HTMLElement} container - 容器选择器或元素
 * @param {string} position - 插入位置: 'replace', 'append', 'prepend', 'beforeend', 'afterbegin'
 * @returns {Promise<void>}
 */
async function insertComponent(componentPath, container, position = 'beforeend') {
    const html = await loadComponent(componentPath);
    
    // 提取并加载CSS链接
    extractAndLoadCSS(html);
    
    // 移除<link>标签，只保留HTML内容
    const cleanHtml = removeLinkTags(html);
    
    const containerElement = typeof container === 'string' 
        ? document.querySelector(container) 
        : container;
    
    if (!containerElement) {
        throw new Error(`Container not found: ${container}`);
    }

    if (position === 'replace') {
        containerElement.innerHTML = cleanHtml;
    } else {
        containerElement.insertAdjacentHTML(position, cleanHtml);
    }
}

/**
 * 批量加载多个组件
 * @param {Array<{path: string, container: string, position?: string}>} components - 组件配置数组
 * @returns {Promise<void>}
 */
async function loadComponents(components) {
    const promises = components.map(({ path, container, position }) => 
        insertComponent(path, container, position)
    );
    await Promise.all(promises);
}

/**
 * 初始化页面组件
 * 加载所有页面组件并插入到相应位置
 * @returns {Promise<void>}
 */
async function initializeComponents() {
    const basePath = 'components/';
    
    // 定义组件配置
    const componentConfigs = [
        { path: `${basePath}header.html`, container: '.container', position: 'afterbegin' },
        { path: `${basePath}sidebar.html`, container: '#sidebar-container', position: 'replace' },
        { path: `${basePath}section-config.html`, container: '#content-container', position: 'beforeend' },
        { path: `${basePath}section-upload-config.html`, container: '#content-container', position: 'beforeend' },
        { path: `${basePath}section-providers.html`, container: '#content-container', position: 'beforeend' },
        { path: `${basePath}section-usage.html`, container: '#content-container', position: 'beforeend' },
        { path: `${basePath}section-logs.html`, container: '#content-container', position: 'beforeend' },
        { path: `${basePath}section-plugins.html`, container: '#content-container', position: 'beforeend' },
    ];

    try {
        // 首先加载 header
        await insertComponent(`${basePath}header.html`, '.container', 'afterbegin');
        
        // 然后加载 sidebar
        await insertComponent(`${basePath}sidebar.html`, '#sidebar-container', 'replace');
        
        // 最后加载所有 section 组件
        const sectionComponents = [
            { path: `${basePath}section-dashboard.html`, container: '#content-container', position: 'beforeend' },
            { path: `${basePath}section-guide.html`, container: '#content-container', position: 'beforeend' },
            { path: `${basePath}section-tutorial.html`, container: '#content-container', position: 'beforeend' },
            { path: `${basePath}section-config.html`, container: '#content-container', position: 'beforeend' },
            { path: `${basePath}section-upload-config.html`, container: '#content-container', position: 'beforeend' },
            { path: `${basePath}section-providers.html`, container: '#content-container', position: 'beforeend' },
            { path: `${basePath}section-custom-models.html`, container: '#content-container', position: 'beforeend' },
            { path: `${basePath}section-usage.html`, container: '#content-container', position: 'beforeend' },
            { path: `${basePath}section-logs.html`, container: '#content-container', position: 'beforeend' },
            { path: `${basePath}section-plugins.html`, container: '#content-container', position: 'beforeend' },
            { path: `${basePath}section-gpu-monitor.html`, container: '#content-container', position: 'beforeend' },
        ];
        
        await loadComponents(sectionComponents);
        
        console.log('All components loaded successfully');
        // 触发组件加载完成事件
        window.dispatchEvent(new CustomEvent('componentsLoaded'));
        
    } catch (error) {
        console.error('Failed to initialize components:', error);
        throw error;
    }
}

/**
 * 清除组件缓存
 */
function clearComponentCache() {
    componentCache.clear();
}

// 导出函数
export {
    loadComponent,
    insertComponent,
    loadComponents,
    initializeComponents,
    clearComponentCache
};