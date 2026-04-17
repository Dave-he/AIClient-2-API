const translations = {
  en: {
    common: {
      save: 'Save',
      cancel: 'Cancel',
      confirm: 'Confirm',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
      ok: 'OK',
      close: 'Close',
      yes: 'Yes',
      no: 'No',
      loading: 'Loading...',
      success: 'Success',
      error: 'Error',
      warning: 'Warning',
      info: 'Info',
      copied: 'Copied!',
      confirmDelete: 'Are you sure you want to delete?'
    },
    dashboard: {
      title: 'System Overview',
      uptime: 'Uptime',
      cpu: 'CPU',
      memory: 'Memory',
      gpu: 'GPU',
      systemMonitor: 'System Monitor',
      providerStatus: 'Provider Status',
      availableModels: 'Available Models'
    },
    providers: {
      title: 'Provider Pool Management',
      activeConnections: 'Active Connections',
      activeProviders: 'Active Providers',
      healthyProviders: 'Healthy Providers',
      addNode: 'Add Node',
      editNode: 'Edit Node',
      deleteNode: 'Delete Node',
      healthCheck: 'Health Check',
      name: 'Name',
      type: 'Type',
      status: 'Status',
      healthy: 'Healthy',
      unhealthy: 'Unhealthy',
      warning: 'Warning'
    },
    config: {
      title: 'Configuration',
      apiKey: 'API Key',
      host: 'Host',
      port: 'Port',
      enabledProviders: 'Enabled Providers',
      proxyUrl: 'Proxy URL',
      saveConfig: 'Save Configuration',
      resetConfig: 'Reset Configuration'
    },
    login: {
      title: 'Login',
      username: 'Username',
      password: 'Password',
      rememberMe: 'Remember Me',
      login: 'Login',
      forgotPassword: 'Forgot Password?',
      invalidCredentials: 'Invalid username or password'
    },
    models: {
      title: 'Custom Models',
      modelName: 'Model Name',
      baseModel: 'Base Model',
      provider: 'Provider',
      maxTokens: 'Max Tokens',
      temperature: 'Temperature',
      topP: 'Top P',
      frequencyPenalty: 'Frequency Penalty',
      presencePenalty: 'Presence Penalty',
      enabled: 'Enabled',
      addModel: 'Add Model',
      editModel: 'Edit Model',
      deleteModel: 'Delete Model'
    }
  },
  zh: {
    common: {
      save: '保存',
      cancel: '取消',
      confirm: '确认',
      delete: '删除',
      edit: '编辑',
      add: '添加',
      ok: '确定',
      close: '关闭',
      yes: '是',
      no: '否',
      loading: '加载中...',
      success: '成功',
      error: '错误',
      warning: '警告',
      info: '信息',
      copied: '已复制!',
      confirmDelete: '确定要删除吗?'
    },
    dashboard: {
      title: '系统概览',
      uptime: '运行时间',
      cpu: 'CPU',
      memory: '内存',
      gpu: 'GPU',
      systemMonitor: '系统资源监控',
      providerStatus: '提供商状态',
      availableModels: '可用模型'
    },
    providers: {
      title: '提供商池管理',
      activeConnections: '活动连接',
      activeProviders: '活跃提供商',
      healthyProviders: '健康提供商',
      addNode: '添加节点',
      editNode: '编辑节点',
      deleteNode: '删除节点',
      healthCheck: '健康检查',
      name: '名称',
      type: '类型',
      status: '状态',
      healthy: '健康',
      unhealthy: '不健康',
      warning: '警告'
    },
    config: {
      title: '配置',
      apiKey: 'API密钥',
      host: '主机',
      port: '端口',
      enabledProviders: '启用的提供商',
      proxyUrl: '代理URL',
      saveConfig: '保存配置',
      resetConfig: '重置配置'
    },
    login: {
      title: '登录',
      username: '用户名',
      password: '密码',
      rememberMe: '记住我',
      login: '登录',
      forgotPassword: '忘记密码?',
      invalidCredentials: '用户名或密码错误'
    },
    models: {
      title: '自定义模型',
      modelName: '模型名称',
      baseModel: '基础模型',
      provider: '提供商',
      maxTokens: '最大Token数',
      temperature: '温度',
      topP: 'Top P',
      frequencyPenalty: '频率惩罚',
      presencePenalty: '存在惩罚',
      enabled: '已启用',
      addModel: '添加模型',
      editModel: '编辑模型',
      deleteModel: '删除模型'
    }
  }
};

class I18n {
  constructor() {
    this.locale = 'zh';
    this.fallbackLocale = 'en';
    this.translations = translations;
  }

  setLocale(locale) {
    if (this.translations[locale]) {
      this.locale = locale;
      localStorage.setItem('locale', locale);
    }
  }

  getLocale() {
    return this.locale;
  }

  t(key, params = {}) {
    const keys = key.split('.');
    let translation = this.translations[this.locale];
    
    if (!translation) {
      translation = this.translations[this.fallbackLocale];
    }

    for (const k of keys) {
      if (translation && typeof translation === 'object' && k in translation) {
        translation = translation[k];
      } else {
        translation = key;
        break;
      }
    }

    if (typeof translation === 'string' && Object.keys(params).length > 0) {
      return translation.replace(/\{(\w+)\}/g, (_, paramKey) => {
        return params[paramKey] || `{${paramKey}}`;
      });
    }

    return translation;
  }

  getLocales() {
    return Object.keys(this.translations);
  }

  loadTranslations(newTranslations) {
    this.translations = { ...this.translations, ...newTranslations };
  }
}

export const i18n = new I18n();

export const t = (key, params = {}) => i18n.t(key, params);

export const setLocale = (locale) => i18n.setLocale(locale);

export const getLocale = () => i18n.getLocale();

export default i18n;