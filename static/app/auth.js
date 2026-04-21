// 认证模块 - 处理token管理和API调用封装
import { t } from './i18n.js';
/**
 * 认证管理类
 */
class AuthManager {
    constructor() {
        this.tokenKey = 'authToken';
        this.csrfKey = 'csrfToken';
        this.expiryKey = 'authTokenExpiry';
        this.baseURL = window.location.origin;
    }

    getTokenFromCookie() {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'auth_token') {
                return value;
            }
        }
        return null;
    }

    getCsrfToken() {
        return sessionStorage.getItem(this.csrfKey) || null;
    }

    setCsrfToken(token) {
        sessionStorage.setItem(this.csrfKey, token);
    }

    clearCsrfToken() {
        sessionStorage.removeItem(this.csrfKey);
    }

    getExpiryFromCookie() {
        return localStorage.getItem(this.expiryKey);
    }

    setExpiry(expiry) {
        localStorage.setItem(this.expiryKey, expiry.toString());
    }

    getToken() {
        return this.getTokenFromCookie();
    }

    getTokenExpiry() {
        const expiry = this.getExpiryFromCookie();
        return expiry ? parseInt(expiry) : null;
    }

    checkTokenExpiry() {
        const expiry = this.getTokenExpiry();
        if (!expiry) return;

        const timeUntilExpiry = expiry - Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        if (timeUntilExpiry < fiveMinutes && timeUntilExpiry > 0) {
            this.refreshCsrfToken();
        }
    }

    async refreshCsrfToken() {
        try {
            const response = await fetch('/api/csrf-token', {
                method: 'GET',
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                this.setCsrfToken(data.csrfToken);
            }
        } catch (e) {
            console.warn('Failed to refresh CSRF token:', e);
        }
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

    saveToken(token, rememberMe = false, expiry) {
        if (expiry) {
            this.setExpiry(expiry);
        }
        this.clearCsrfToken();
    }

    clearToken() {
        this.clearCsrfToken();
        localStorage.removeItem(this.expiryKey);
        document.cookie = 'auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = 'csrf_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
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

    getCsrfToken() {
        return this.authManager.getCsrfToken();
    }

    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        const csrfToken = this.getCsrfToken();
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }

        return headers;
    }

    handleUnauthorized() {
        this.authManager.clearToken();
        window.location.href = '/login.html';
    }

    async request(endpoint, options = {}) {
        let apiPath = endpoint;
        if (!apiPath.startsWith('/api')) {
            apiPath = '/api' + apiPath;
        }
        const url = `${this.baseURL}${apiPath}`;
        const headers = {
            ...this.getAuthHeaders(),
            ...options.headers
        };

        const config = {
            ...options,
            headers,
            credentials: 'include'
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
        const csrfToken = this.getCsrfToken();
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }

        const config = {
            method: 'POST',
            headers,
            body: formData,
            credentials: 'include'
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
    const authManager = new AuthManager();
    
    // 检查是否已经有有效的token
    if (authManager.isTokenValid()) {
        // 验证token是否仍然有效（使用validate-token接口）
        try {
            const apiClient = new ApiClient();
            await apiClient.get('/validate-token');
            return true;
        } catch (error) {
            // Token无效，清除并重定向到登录页
            authManager.clearToken();
            window.location.href = '/login.html';
            return false;
        }
    } else {
        // 没有有效token，重定向到登录页
        window.location.href = '/login.html';
        return false;
    }
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
            credentials: 'include',
            body: JSON.stringify({
            password,
            rememberMe
            })
        });

        const data = await response.json();

        if (data.success) {
            const authManager = new AuthManager();
            const expiryTime = rememberMe ? Date.now() + (7 * 24 * 60 * 60 * 1000) : Date.now() + (24 * 60 * 60 * 1000);
            authManager.saveToken('cookie', rememberMe, expiryTime);

            if (data.csrfToken) {
                authManager.setCsrfToken(data.csrfToken);
            }

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

function getCsrfToken() {
    const authManager = new AuthManager();
    return authManager.getCsrfToken();
}

function setCsrfToken(token) {
    const authManager = new AuthManager();
    authManager.setCsrfToken(token);
}

// 导出实例到 window（兼容旧代码）
window.authManager = authManager;
window.apiClient = apiClient;
window.initAuth = initAuth;
window.logout = logout;
window.login = login;
window.getCsrfToken = getCsrfToken;
window.setCsrfToken = setCsrfToken;

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