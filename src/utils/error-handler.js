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
