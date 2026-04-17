const getEnv = (key, defaultValue = undefined) => {
  const value = import.meta.env[key];
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return value;
};

const getEnvNumber = (key, defaultValue = undefined) => {
  const value = getEnv(key);
  if (value === undefined) {
    return defaultValue;
  }
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
};

const getEnvBoolean = (key, defaultValue = false) => {
  const value = getEnv(key);
  if (value === undefined) {
    return defaultValue;
  }
  return value === 'true' || value === '1' || value === true;
};

export const env = {
  port: getEnvNumber('VITE_PORT', 5173),
  previewPort: getEnvNumber('VITE_PREVIEW_PORT', 9090),
  apiBaseUrl: getEnv('VITE_API_BASE_URL', 'http://localhost:30000'),
  appName: getEnv('VITE_APP_NAME', 'AIClient-2-API'),
  appVersion: getEnv('VITE_APP_VERSION', '1.0.0'),
  enableDebug: getEnvBoolean('VITE_ENABLE_DEBUG', false),
  enableToast: getEnvBoolean('VITE_ENABLE_TOAST', true),
  cspEnabled: getEnvBoolean('VITE_CSP_ENABLED', true)
};

export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return env.apiBaseUrl;
};

export default env;