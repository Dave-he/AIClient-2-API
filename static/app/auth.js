// 认证模块 - 处理token管理和API调用封装
import { t } from './i18n.js';
/**
 * 认证管理类
 */
class AuthManager {
    constructor() {
        this.tokenKey = 'authToken';
        this.expiryKey = 'authTokenExpiry';
        this.baseURL = window.location.origin;
    }

    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    getTokenExpiry() {
        const expiry = localStorage.getItem(this.expiryKey);
        return expiry ? parseInt(expiry) : null;
    }

    isTokenValid() {
        const token = this.getToken();
        const expiry = this.getTokenExpiry();

        if (!token) return false;

        if (expiry && Date.now() > expiry) {
            this.clearToken();
            return false;
        }

        return true;
    }

    saveToken(token, rememberMe = false) {
        localStorage.setItem(this.tokenKey, token);

        if (rememberMe) {
            const expiryTime = Date.now() + (7 * 24 * 60 * 60 * 1000);
            localStorage.setItem(this.expiryKey, expiryTime.toString());
        }
    }

    clearToken() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.expiryKey);
    }

    async logout() {
        this.clearToken();
        window.location.href = '/login.html';
    }
}

/**
 * API调用封装类
 */
class ApiClient {
    constructor() {
        this.authManager = new AuthManager();
        this.baseURL = window.location.origin;
    }

    getAuthHeaders() {
        const token = this.authManager.getToken();
        return token ? {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        } : {
            'Content-Type': 'application/json'
        };
    }

    handleUnauthorized() {
        this.authManager.clearToken();
        window.location.href = '/login.html';
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}/api${endpoint}`;
        const headers = {
            ...this.getAuthHeaders(),
            ...options.headers
        };

        const config = {
            ...options,
            headers
        };

        try {
            const response = await fetch(url, config);

            if (response.status === 401) {
                this.handleUnauthorized();
                throw new Error(t('common.unauthorized'));
            }

            const contentType = response.headers.get('content-type');
            let data;
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                let errorMessage;
                if (data && typeof data === 'object') {
                    const code = (data.error && data.error.messageCode) || data.messageCode;
                    if (code) {
                        const translated = t(code);
                        if (translated !== code) {
                            errorMessage = translated;
                        }
                    }

                    if (!errorMessage) {
                        errorMessage = (data.error && data.error.message) || data.message;
                    }
                }

                if (!errorMessage) {
                    errorMessage = `${t('common.requestFailed')} (${t('common.status')}: ${response.status})`;
                }
                throw new Error(errorMessage);
            }

            return data;
        } catch (error) {
            if (error.message === t('common.unauthorized')) {
                throw error;
            }
            console.error('API请求错误:', error);
            throw error;
        }
    }

    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    async upload(endpoint, formData) {
        const url = `${this.baseURL}/api${endpoint}`;

        const headers = {};
        const token = this.authManager.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            method: 'POST',
            headers,
            body: formData
        };

        try {
            const response = await fetch(url, config);

            if (response.status === 401) {
                this.handleUnauthorized();
                throw new Error(t('common.unauthorized'));
            }

            const contentType = response.headers.get('content-type');
            let data;
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                const errorMessage = (data && typeof data === 'object' && data.error && data.error.message)
                    || (data && typeof data === 'object' && data.message)
                    || `${t('common.uploadFailed')} (${t('common.status')}: ${response.status})`;
                throw new Error(errorMessage);
            }

            return data;
        } catch (error) {
            if (error.message === t('common.unauthorized')) {
                throw error;
            }
            console.error('API请求错误:', error);
            throw error;
        }
    }
}

/**
 * 初始化认证检查
 */
async function initAuth() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            window.location.href = '/login.html';
            return false;
        }

        const response = await fetch('/api/validate-token', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (data.valid) {
            return true;
        }
    } catch (error) {
        console.warn('Token validation failed:', error);
    }

    window.location.href = '/login.html';
    return false;
}

/**
 * 登出函数
 */
async function logout() {
    const authManager = new AuthManager();
    await authManager.logout();
}

/**
 * 登录函数（供登录页面使用）
 */
async function login(password, rememberMe = false) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
            password,
            rememberMe
            })
        });

        const data = await response.json();

        if (data.success) {
            const authManager = new AuthManager();
            authManager.saveToken(data.token, rememberMe);
            return { success: true };
        } else {
            return { success: false, message: data.message };
        }
    } catch (error) {
        console.error('登录错误:', error);
        return { success: false, message: '登录失败，请检查网络连接' };
    }
}

// 创建单例实例
const authManager = new AuthManager();
const apiClient = new ApiClient();

/**
 * 获取带认证的请求头（便捷函数）
 * @returns {Object} 包含认证信息的请求头
 */
function getAuthHeaders() {
    return apiClient.getAuthHeaders();
}

window.authManager = authManager;
window.apiClient = apiClient;
window.initAuth = initAuth;
window.logout = logout;
window.login = login;

// 导出认证管理器类和API客户端类供其他模块使用
window.AuthManager = AuthManager;
window.ApiClient = ApiClient;

// ES6 模块导出
export {
    AuthManager,
    ApiClient,
    authManager,
    apiClient,
    initAuth,
    logout,
    login,
    getAuthHeaders
};

console.log('认证模块已加载');