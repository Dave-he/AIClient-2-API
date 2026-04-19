import { logger } from './logger.js';

class ErrorHandler {
  constructor() {
    this.errors = [];
    this.listeners = new Set();
    this.maxErrors = 100;
  }

  captureError(error, context = {}) {
    const errorInfo = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      timestamp: new Date().toISOString(),
      message: error.message || 'Unknown error',
      stack: error.stack || '',
      name: error.name || 'Error',
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        ...context
      },
      type: this.determineErrorType(error)
    };

    this.errors.unshift(errorInfo);
    if (this.errors.length > this.maxErrors) {
      this.errors.pop();
    }

    logger.error('Captured error:', errorInfo);
    
    this.notifyListeners(errorInfo);
    
    return errorInfo;
  }

  determineErrorType(error) {
    if (error.response) {
      const status = error.response.status;
      if (status >= 500) return 'server_error';
      if (status >= 400) return 'client_error';
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return 'network_error';
    }
    if (error.name === 'TypeError') return 'type_error';
    if (error.name === 'ReferenceError') return 'reference_error';
    return 'unknown_error';
  }

  notifyListeners(errorInfo) {
    this.listeners.forEach(listener => {
      try {
        listener(errorInfo);
      } catch (e) {
        logger.error('Error listener failed:', e);
      }
    });
  }

  addListener(listener) {
    this.listeners.add(listener);
  }

  removeListener(listener) {
    this.listeners.delete(listener);
  }

  getErrors(count = 20) {
    return this.errors.slice(0, count);
  }

  getErrorById(id) {
    return this.errors.find(e => e.id === id);
  }

  clearErrors() {
    this.errors = [];
  }

  reportError(errorInfo) {
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/error-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(errorInfo)
      }).catch(e => {
        logger.error('Failed to report error:', e);
      });
    }
  }

  handleApiError(error, showToast = true) {
    const errorInfo = this.captureError(error, {
      source: 'api',
      url: error.config?.url,
      method: error.config?.method
    });

    if (showToast) {
      this.showErrorToast(errorInfo);
    }

    return errorInfo;
  }

  handleVueError(error, instance, info) {
    const errorInfo = this.captureError(error, {
      source: 'vue',
      component: instance?.$options?.name || 'Unknown',
      info
    });

    return errorInfo;
  }

  showErrorToast(errorInfo) {
    const toastMessage = this.getFriendlyErrorMessage(errorInfo);
    
    if (window.$toast) {
      window.$toast.error(toastMessage, 5000);
    }
  }

  getFriendlyErrorMessage(errorInfo) {
    switch (errorInfo.type) {
      case 'server_error':
        return '服务器内部错误，请稍后重试';
      case 'client_error':
        return '请求参数错误，请检查输入';
      case 'network_error':
        return '网络连接失败，请检查网络';
      case 'type_error':
        return '数据类型错误';
      case 'reference_error':
        return '引用错误';
      default:
        return errorInfo.message || '发生未知错误';
    }
  }

  setupGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
      this.captureError(event.error, { source: 'global' });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(event.reason, { source: 'promise' });
    });
  }
}

export const errorHandler = new ErrorHandler();

export const ERROR_CODES = {
    AUTH_ERROR: 'auth_error',
    PERMISSION_ERROR: 'permission_error',
    RATE_LIMIT_ERROR: 'rate_limit_error',
    MODEL_NOT_FOUND: 'model_not_found',
    VALIDATION_ERROR: 'validation_error',
    NETWORK_ERROR: 'network_error',
    TIMEOUT_ERROR: 'timeout_error',
    SERVER_ERROR: 'server_error',
    CONFIG_ERROR: 'config_error',
    PROVIDER_UNAVAILABLE: 'provider_unavailable'
};

export class APIError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = 'APIError';
        this.code = options.code || ERROR_CODES.SERVER_ERROR;
        this.status = options.status || 500;
        this.details = options.details;
    }
}

export class AuthError extends APIError {
    constructor(message, options = {}) {
        super(message, { ...options, code: ERROR_CODES.AUTH_ERROR, status: options.status || 401 });
        this.name = 'AuthError';
    }
}

export class PermissionError extends APIError {
    constructor(message, options = {}) {
        super(message, { ...options, code: ERROR_CODES.PERMISSION_ERROR, status: options.status || 403 });
        this.name = 'PermissionError';
    }
}

export class RateLimitError extends APIError {
    constructor(message, options = {}) {
        super(message, { ...options, code: ERROR_CODES.RATE_LIMIT_ERROR, status: options.status || 429 });
        this.name = 'RateLimitError';
        this.retryAfter = options.retryAfter;
    }
}

export class ModelNotFoundError extends APIError {
    constructor(message, options = {}) {
        super(message, { ...options, code: ERROR_CODES.MODEL_NOT_FOUND, status: options.status || 404 });
        this.name = 'ModelNotFoundError';
    }
}

export class ValidationError extends APIError {
    constructor(message, options = {}) {
        super(message, { ...options, code: ERROR_CODES.VALIDATION_ERROR, status: options.status || 400 });
        this.name = 'ValidationError';
    }
}

export class NetworkError extends APIError {
    constructor(message, options = {}) {
        super(message, { ...options, code: ERROR_CODES.NETWORK_ERROR, status: options.status || 503 });
        this.name = 'NetworkError';
    }
}

export class TimeoutError extends APIError {
    constructor(message, options = {}) {
        super(message, { ...options, code: ERROR_CODES.TIMEOUT_ERROR, status: options.status || 504 });
        this.name = 'TimeoutError';
    }
}

export class ServerError extends APIError {
    constructor(message, options = {}) {
        super(message, { ...options, code: ERROR_CODES.SERVER_ERROR, status: options.status || 500 });
        this.name = 'ServerError';
    }
}

export class ConfigError extends APIError {
    constructor(message, options = {}) {
        super(message, { ...options, code: ERROR_CODES.CONFIG_ERROR, status: options.status || 500 });
        this.name = 'ConfigError';
    }
}

export class ProviderUnavailableError extends APIError {
    constructor(message, options = {}) {
        super(message, { ...options, code: ERROR_CODES.PROVIDER_UNAVAILABLE, status: options.status || 503 });
        this.name = 'ProviderUnavailableError';
    }
}

export function wrapError(error, options = {}) {
    if (error instanceof APIError) {
        return error;
    }
    return new ServerError(error.message || 'Unknown error', options);
}

export function handleError(res, error, providerType, fromProvider, req) {
    const status = error.status || error.response?.status || 500;
    const message = error.message || 'Internal Server Error';
    
    const protocol = getProtocolPrefix(providerType);
    let errorResponse;
    
    if (protocol === 'openai' || protocol === 'codex') {
        errorResponse = {
            error: {
                message: message,
                type: 'server_error',
                param: null,
                code: status
            }
        };
    } else if (protocol === 'claude') {
        errorResponse = {
            type: 'error',
            error: {
                type: 'server_error',
                message: message
            }
        };
    } else if (protocol === 'gemini') {
        errorResponse = {
            error: {
                code: status,
                message: message,
                status: status >= 500 ? 'INTERNAL' : 'INVALID_ARGUMENT'
            }
        };
    } else {
        errorResponse = { error: message };
    }
    
    if (!res.headersSent) {
        res.writeHead(status, { 'Content-Type': 'application/json' });
    }
    res.end(JSON.stringify(errorResponse));
}

function getProtocolPrefix(provider) {
    if (!provider) return 'openai';
    
    if (provider === 'openai-codex-oauth') {
        return 'codex';
    }
    
    if (provider === 'local-model') {
        return 'openai';
    }

    const hyphenIndex = provider.indexOf('-');
    if (hyphenIndex !== -1) {
        return provider.substring(0, hyphenIndex);
    }
    return provider;
}

export function useErrorHandler() {
  return {
    captureError: (error, context) => errorHandler.captureError(error, context),
    handleApiError: (error, showToast) => errorHandler.handleApiError(error, showToast),
    handleVueError: (error, instance, info) => errorHandler.handleVueError(error, instance, info),
    getErrors: (count) => errorHandler.getErrors(count),
    getErrorById: (id) => errorHandler.getErrorById(id),
    clearErrors: () => errorHandler.clearErrors(),
    addListener: (listener) => errorHandler.addListener(listener),
    removeListener: (listener) => errorHandler.removeListener(listener)
  };
}
