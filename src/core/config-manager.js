import * as fs from 'fs';
import { promises as pfs } from 'fs';
import { INPUT_SYSTEM_PROMPT_FILE } from '../utils/common.js';
import { MODEL_PROVIDER } from '../utils/constants.js';
import logger from '../utils/logger.js';

export let CONFIG = {}; // Make CONFIG exportable
export let PROMPT_LOG_FILENAME = ''; // Make PROMPT_LOG_FILENAME exportable

const ALL_MODEL_PROVIDERS = Object.values(MODEL_PROVIDER);

const VALIDATION_RULES = {
    SERVER_PORT: {
        type: 'int',
        min: 1,
        max: 65535,
        required: true,
        errorMsg: 'SERVER_PORT must be between 1 and 65535'
    },
    LOGIN_EXPIRY: {
        type: 'int',
        min: 60,
        max: 86400,
        errorMsg: 'LOGIN_EXPIRY must be between 60 and 86400 seconds'
    },
    LOGIN_MAX_ATTEMPTS: {
        type: 'int',
        min: 1,
        max: 100,
        errorMsg: 'LOGIN_MAX_ATTEMPTS must be between 1 and 100'
    },
    LOGIN_LOCKOUT_DURATION: {
        type: 'int',
        min: 60,
        max: 86400,
        errorMsg: 'LOGIN_LOCKOUT_DURATION must be between 60 and 86400 seconds'
    },
    LOGIN_MIN_INTERVAL: {
        type: 'int',
        min: 1000,
        max: 60000,
        errorMsg: 'LOGIN_MIN_INTERVAL must be between 1000 and 60000 milliseconds'
    },
    REQUEST_MAX_RETRIES: {
        type: 'int',
        min: 0,
        max: 10,
        errorMsg: 'REQUEST_MAX_RETRIES must be between 0 and 10'
    },
    REQUEST_BASE_DELAY: {
        type: 'int',
        min: 100,
        max: 60000,
        errorMsg: 'REQUEST_BASE_DELAY must be between 100 and 60000 milliseconds'
    },
    CREDENTIAL_SWITCH_MAX_RETRIES: {
        type: 'int',
        min: 0,
        max: 20,
        errorMsg: 'CREDENTIAL_SWITCH_MAX_RETRIES must be between 0 and 20'
    },
    MAX_ERROR_COUNT: {
        type: 'int',
        min: 1,
        max: 100,
        errorMsg: 'MAX_ERROR_COUNT must be between 1 and 100'
    },
    CRON_NEAR_MINUTES: {
        type: 'int',
        min: 1,
        max: 120,
        errorMsg: 'CRON_NEAR_MINUTES must be between 1 and 120 minutes'
    },
    LOG_LEVEL: {
        type: 'enum',
        values: ['debug', 'info', 'warn', 'error'],
        errorMsg: 'LOG_LEVEL must be one of: debug, info, warn, error'
    },
    LOG_OUTPUT_MODE: {
        type: 'enum',
        values: ['console', 'file', 'all', 'none'],
        errorMsg: 'LOG_OUTPUT_MODE must be one of: console, file, all, none'
    },
    SYSTEM_PROMPT_MODE: {
        type: 'enum',
        values: ['overwrite', 'append'],
        errorMsg: 'SYSTEM_PROMPT_MODE must be one of: overwrite, append'
    },
    PROMPT_LOG_MODE: {
        type: 'enum',
        values: ['none', 'console', 'file'],
        errorMsg: 'PROMPT_LOG_MODE must be one of: none, console, file'
    },
    LOG_MAX_FILE_SIZE: {
        type: 'int',
        min: 1024,
        max: 1073741824,
        errorMsg: 'LOG_MAX_FILE_SIZE must be between 1024 bytes (1KB) and 1073741824 bytes (1GB)'
    },
    LOG_MAX_FILES: {
        type: 'int',
        min: 1,
        max: 100,
        errorMsg: 'LOG_MAX_FILES must be between 1 and 100'
    },
    SCHEDULED_HEALTH_CHECK: {
        type: 'object',
        properties: {
            enabled: { type: 'bool' },
            interval: { type: 'int', min: 10000, max: 86400000, errorMsg: 'SCHEDULED_HEALTH_CHECK.interval must be between 10000ms (10s) and 86400000ms (24h)' },
            startupRun: { type: 'bool' }
        }
    },
    TLS_SIDECAR_PORT: {
        type: 'int',
        min: 1,
        max: 65535,
        errorMsg: 'TLS_SIDECAR_PORT must be between 1 and 65535'
    }
};

function validateConfig(config) {
    const errors = [];
    const warnings = [];

    for (const [key, rule] of Object.entries(VALIDATION_RULES)) {
        const value = config[key];
        
        if (rule.required && value === undefined) {
            errors.push(`[CONFIG ERROR] Missing required configuration: ${key}`);
            continue;
        }

        if (value === undefined || value === null) {
            continue;
        }

        switch (rule.type) {
            case 'int':
                if (!Number.isInteger(value)) {
                    errors.push(`[CONFIG ERROR] ${key} must be an integer. Got: ${typeof value} (value: ${value})`);
                } else if (rule.min !== undefined && value < rule.min) {
                    errors.push(`[CONFIG ERROR] ${key} must be >= ${rule.min}. Got: ${value}`);
                } else if (rule.max !== undefined && value > rule.max) {
                    errors.push(`[CONFIG ERROR] ${key} must be <= ${rule.max}. Got: ${value}`);
                }
                break;

            case 'enum':
                if (!rule.values.includes(value)) {
                    errors.push(`[CONFIG ERROR] ${key} must be one of [${rule.values.join(', ')}]. Got: ${value}`);
                }
                break;

            case 'bool':
                if (typeof value !== 'boolean') {
                    errors.push(`[CONFIG ERROR] ${key} must be a boolean. Got: ${typeof value} (value: ${value})`);
                }
                break;

            case 'string':
                if (typeof value !== 'string') {
                    errors.push(`[CONFIG ERROR] ${key} must be a string. Got: ${typeof value}`);
                } else if (rule.minLength !== undefined && value.length < rule.minLength) {
                    errors.push(`[CONFIG ERROR] ${key} must be at least ${rule.minLength} characters. Got: ${value.length}`);
                } else if (rule.maxLength !== undefined && value.length > rule.maxLength) {
                    errors.push(`[CONFIG ERROR] ${key} must be at most ${rule.maxLength} characters. Got: ${value.length}`);
                } else if (rule.pattern && !rule.pattern.test(value)) {
                    errors.push(`[CONFIG ERROR] ${key} format is invalid.`);
                }
                break;

            case 'object':
                if (typeof value !== 'object' || Array.isArray(value)) {
                    errors.push(`[CONFIG ERROR] ${key} must be an object. Got: ${typeof value}`);
                } else if (rule.properties) {
                    for (const [propKey, propRule] of Object.entries(rule.properties)) {
                        const propValue = value[propKey];
                        if (propValue === undefined) continue;
                        
                        if (propRule.type === 'int') {
                            if (!Number.isInteger(propValue)) {
                                errors.push(`[CONFIG ERROR] ${key}.${propKey} must be an integer. Got: ${typeof propValue} (value: ${propValue})`);
                            } else if (propRule.min !== undefined && propValue < propRule.min) {
                                errors.push(propRule.errorMsg || `[CONFIG ERROR] ${key}.${propKey} must be >= ${propRule.min}. Got: ${propValue}`);
                            } else if (propRule.max !== undefined && propValue > propRule.max) {
                                errors.push(propRule.errorMsg || `[CONFIG ERROR] ${key}.${propKey} must be <= ${propRule.max}. Got: ${propValue}`);
                            }
                        } else if (propRule.type === 'bool') {
                            if (typeof propValue !== 'boolean') {
                                errors.push(`[CONFIG ERROR] ${key}.${propKey} must be a boolean. Got: ${typeof propValue} (value: ${propValue})`);
                            }
                        } else if (propRule.type === 'enum') {
                            if (!propRule.values.includes(propValue)) {
                                errors.push(`[CONFIG ERROR] ${key}.${propKey} must be one of [${propRule.values.join(', ')}]. Got: ${propValue}`);
                            }
                        }
                    }
                }
                break;
        }
    }

    if (config.REQUIRED_API_KEY === '123456') {
        warnings.push('[CONFIG WARNING] Using default API key (123456). For security, please change this in production.');
    }

    if (config.LOG_LEVEL === 'debug' && process.env.NODE_ENV === 'production') {
        warnings.push('[CONFIG WARNING] Debug log level is not recommended in production environment.');
    }

    if (config.PROXY_URL && !isValidUrl(config.PROXY_URL)) {
        warnings.push(`[CONFIG WARNING] PROXY_URL format may be invalid: ${config.PROXY_URL}`);
    }

    return { errors, warnings };
}

function isValidUrl(string) {
    try {
        const url = new URL(string);
        return ['http:', 'https:', 'socks:', 'socks5:'].includes(url.protocol);
    } catch {
        return false;
    }
}

function applyConfigValidation(config) {
    const { errors, warnings } = validateConfig(config);

    if (warnings.length > 0) {
        logger.warn('[Config Validation] Configuration warnings:');
        warnings.forEach(warning => {
            logger.warn(`  - ${warning}`);
        });
    }

    if (errors.length > 0) {
        logger.error('[Config Validation] Configuration errors detected:');
        errors.forEach(error => {
            logger.error(`  - ${error}`);
        });
        throw new Error(`Configuration validation failed with ${errors.length} error(s)`);
    }

    logger.info('[Config Validation] Configuration validation passed');
}

function normalizeConfiguredProviders(config) {
    const fallbackProvider = MODEL_PROVIDER.GEMINI_CLI;
    const dedupedProviders = [];

    const addProvider = (value) => {
        if (typeof value !== 'string') {
            return;
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return;
        }
        const matched = ALL_MODEL_PROVIDERS.find((provider) => provider.toLowerCase() === trimmed.toLowerCase());
        if (!matched) {
            logger.warn(`[Config Warning] Unknown model provider '${trimmed}'. This entry will be ignored.`);
            return;
        }
        if (!dedupedProviders.includes(matched)) {
            dedupedProviders.push(matched);
        }
    };

    const rawValue = config.MODEL_PROVIDER;
    if (Array.isArray(rawValue)) {
        rawValue.forEach((entry) => addProvider(typeof entry === 'string' ? entry : String(entry)));
    } else if (typeof rawValue === 'string') {
        rawValue.split(',').forEach(addProvider);
    } else if (rawValue != null) {
        addProvider(String(rawValue));
    }

    if (dedupedProviders.length === 0) {
        dedupedProviders.push(fallbackProvider);
    }

    config.DEFAULT_MODEL_PROVIDERS = dedupedProviders;
    config.MODEL_PROVIDER = dedupedProviders[0];
}

/**
 * Initializes the server configuration from config.json and command-line arguments.
 * @param {string[]} args - Command-line arguments.
 * @param {string} [configFilePath='configs/config.json'] - Path to the configuration file.
 * @returns {Object} The initialized configuration object.
 */
export async function initializeConfig(args = process.argv.slice(2), configFilePath = 'configs/config.json') {
    const defaultConfig = {
        REQUIRED_API_KEY: "123456",
        SERVER_PORT: 3000,
        HOST: '0.0.0.0',
        MODEL_PROVIDER: MODEL_PROVIDER.GEMINI_CLI,
        SYSTEM_PROMPT_FILE_PATH: INPUT_SYSTEM_PROMPT_FILE, // Default value
        SYSTEM_PROMPT_MODE: 'append',
        PROXY_URL: null, // HTTP/HTTPS/SOCKS5 代理地址，如 http://127.0.0.1:7890 或 socks5://127.0.0.1:1080
        PROXY_ENABLED_PROVIDERS: [], // 启用代理的提供商列表，如 ['gemini-cli-oauth', 'claude-kiro-oauth']
        PROMPT_LOG_BASE_NAME: "prompt_log",
        PROMPT_LOG_MODE: "none",
        REQUEST_MAX_RETRIES: 3,
        REQUEST_BASE_DELAY: 1000,
        CREDENTIAL_SWITCH_MAX_RETRIES: 5, // 坏凭证切换最大重试次数（用于认证错误后切换凭证）
        CRON_NEAR_MINUTES: 15,
        CRON_REFRESH_TOKEN: false,
        LOGIN_EXPIRY: 3600, // 登录过期时间（秒），默认1小时
        LOGIN_MAX_ATTEMPTS: 5, // 最大失败重试次数
        LOGIN_LOCKOUT_DURATION: 1800, // 锁定持续时间（秒），默认30分钟
        LOGIN_MIN_INTERVAL: 5000, // 两次尝试之间的最小间隔（毫秒），默认1秒
        PROVIDER_POOLS_FILE_PATH: null, // 新增号池配置文件路径
        MAX_ERROR_COUNT: 10, // 提供商最大错误次数
        CUSTOM_MODELS_FILE_PATH: null, // 自定义模型配置文件路径
        SYSTEM_PROMPT_REPLACEMENTS: [], // 系统提示词内容替换规则，例如: [{"old": "AI", "new": "Bot"}, {"old": "OpenAI", "new": "Gemini"}]
        SCHEDULED_HEALTH_CHECK: {
            enabled: false,
            interval: 600000,
            startupRun: false
        },
        providerFallbackChain: {}, // 跨类型 Fallback 链配置
        LOG_ENABLED: true,
        LOG_OUTPUT_MODE: "all",
        LOG_LEVEL: "info",
        LOG_DIR: "logs",
        LOG_INCLUDE_REQUEST_ID: true,
        LOG_INCLUDE_TIMESTAMP: true,
        LOG_MAX_FILE_SIZE: 10485760,
        LOG_MAX_FILES: 10,
        TLS_SIDECAR_ENABLED: false, // 启用 Go uTLS sidecar（需要编译 tls-sidecar 二进制）
        TLS_SIDECAR_ENABLED_PROVIDERS: [], // 启用 TLS Sidecar 的提供商列表
        TLS_SIDECAR_PORT: 9090,     // sidecar 监听端口
        TLS_SIDECAR_BINARY_PATH: null, // 自定义二进制路径（默认自动搜索）
        TLS_SIDECAR_PROXY_URL: null    // TLS Sidecar 专用的上游代理地址
    };

    let currentConfig = { ...defaultConfig };

    try {
        const configData = fs.readFileSync(configFilePath, 'utf8');
        const loadedConfig = JSON.parse(configData);
        Object.assign(currentConfig, loadedConfig);
        logger.info('[Config] Loaded configuration from configs/config.json');
    } catch (error) {
        if (error.code !== 'ENOENT') {
            logger.error('[Config Error] Failed to load configs/config.json:', error.message);
        } else {
            logger.info('[Config] configs/config.json not found, using default configuration.');
        }
    }


    // CLI argument definitions: { flag, configKey, type, validValues? }
    // type: 'string' | 'int' | 'bool' | 'enum'
    const cliArgDefs = [
        { flag: '--api-key',              configKey: 'REQUIRED_API_KEY',       type: 'string' },
        { flag: '--log-prompts',          configKey: 'PROMPT_LOG_MODE',        type: 'enum', validValues: ['console', 'file'] },
        { flag: '--port',                 configKey: 'SERVER_PORT',            type: 'int' },
        { flag: '--model-provider',       configKey: 'MODEL_PROVIDER',         type: 'string' },
        { flag: '--system-prompt-file',   configKey: 'SYSTEM_PROMPT_FILE_PATH', type: 'string' },
        { flag: '--system-prompt-mode',   configKey: 'SYSTEM_PROMPT_MODE',     type: 'enum', validValues: ['overwrite', 'append'] },
        { flag: '--host',                 configKey: 'HOST',                   type: 'string' },
        { flag: '--prompt-log-base-name', configKey: 'PROMPT_LOG_BASE_NAME',   type: 'string' },
        { flag: '--cron-near-minutes',    configKey: 'CRON_NEAR_MINUTES',      type: 'int' },
        { flag: '--cron-refresh-token',   configKey: 'CRON_REFRESH_TOKEN',     type: 'bool' },
        { flag: '--provider-pools-file',  configKey: 'PROVIDER_POOLS_FILE_PATH', type: 'string' },
        { flag: '--custom-models-file',   configKey: 'CUSTOM_MODELS_FILE_PATH', type: 'string' },
        { flag: '--max-error-count',      configKey: 'MAX_ERROR_COUNT',        type: 'int' },
        { flag: '--login-max-attempts',   configKey: 'LOGIN_MAX_ATTEMPTS',     type: 'int' },
        { flag: '--login-lockout-duration', configKey: 'LOGIN_LOCKOUT_DURATION', type: 'int' },
        { flag: '--login-min-interval',   configKey: 'LOGIN_MIN_INTERVAL',     type: 'int' },
        { flag: '--scheduled-health-check-enabled', configKey: 'SCHEDULE_HEALTH_CHECK_ENABLED', type: 'bool' },
        { flag: '--scheduled-health-check-interval', configKey: 'SCHEDULE_HEALTH_CHECK_INTERVAL', type: 'int' },
    ];

    // Parse command-line arguments using definitions
    const flagMap = new Map(cliArgDefs.map(def => [def.flag, def]));
    for (let i = 0; i < args.length; i++) {
        const def = flagMap.get(args[i]);
        if (!def) continue;

        if (i + 1 >= args.length) {
            logger.warn(`[Config Warning] ${def.flag} flag requires a value.`);
            continue;
        }

        const rawValue = args[++i];
        switch (def.type) {
            case 'string':
                currentConfig[def.configKey] = rawValue;
                break;
            case 'int':
                currentConfig[def.configKey] = parseInt(rawValue, 10);
                break;
            case 'bool':
                currentConfig[def.configKey] = rawValue.toLowerCase() === 'true';
                break;
            case 'enum':
                if (def.validValues.includes(rawValue)) {
                    currentConfig[def.configKey] = rawValue;
                } else {
                    logger.warn(`[Config Warning] Invalid value for ${def.flag}. Expected one of: ${def.validValues.join(', ')}.`);
                }
                break;
        }
    }

    // 合并定时健康检查的 CLI 配置
    if (currentConfig.SCHEDULE_HEALTH_CHECK_ENABLED !== undefined) {
        currentConfig.SCHEDULED_HEALTH_CHECK.enabled = currentConfig.SCHEDULE_HEALTH_CHECK_ENABLED;
    }
    if (currentConfig.SCHEDULE_HEALTH_CHECK_INTERVAL !== undefined) {
        currentConfig.SCHEDULED_HEALTH_CHECK.interval = currentConfig.SCHEDULE_HEALTH_CHECK_INTERVAL;
    }

    normalizeConfiguredProviders(currentConfig);

    applyConfigValidation(currentConfig);

    if (!currentConfig.SYSTEM_PROMPT_FILE_PATH) {
        currentConfig.SYSTEM_PROMPT_FILE_PATH = INPUT_SYSTEM_PROMPT_FILE;
    }
    currentConfig.SYSTEM_PROMPT_CONTENT = await getSystemPromptFileContent(currentConfig.SYSTEM_PROMPT_FILE_PATH);

    // 加载号池配置
    if (!currentConfig.PROVIDER_POOLS_FILE_PATH) {
        currentConfig.PROVIDER_POOLS_FILE_PATH = 'configs/provider_pools.json';
    }
    if (currentConfig.PROVIDER_POOLS_FILE_PATH) {
        try {
            const poolsData = await pfs.readFile(currentConfig.PROVIDER_POOLS_FILE_PATH, 'utf8');
            currentConfig.providerPools = JSON.parse(poolsData);
            logger.info(`[Config] Loaded provider pools from ${currentConfig.PROVIDER_POOLS_FILE_PATH}`);
        } catch (error) {
            logger.error(`[Config Error] Failed to load provider pools from ${currentConfig.PROVIDER_POOLS_FILE_PATH}: ${error.message}`);
            currentConfig.providerPools = {};
        }
    } else {
        currentConfig.providerPools = {};
    }

    // 加载自定义模型配置
    if (!currentConfig.CUSTOM_MODELS_FILE_PATH) {
        currentConfig.CUSTOM_MODELS_FILE_PATH = 'configs/custom_models.json';
    }
    try {
        if (fs.existsSync(currentConfig.CUSTOM_MODELS_FILE_PATH)) {
            const customModelsData = fs.readFileSync(currentConfig.CUSTOM_MODELS_FILE_PATH, 'utf8');
            currentConfig.customModels = JSON.parse(customModelsData);
            logger.info(`[Config] Loaded custom models from ${currentConfig.CUSTOM_MODELS_FILE_PATH}`);
        } else {
            currentConfig.customModels = [];
        }
    } catch (error) {
        logger.error(`[Config Error] Failed to load custom models from ${currentConfig.CUSTOM_MODELS_FILE_PATH}: ${error.message}`);
        currentConfig.customModels = [];
    }

    // Set PROMPT_LOG_FILENAME based on the determined config
    if (currentConfig.PROMPT_LOG_MODE === 'file') {
        const now = new Date();
        const pad = (num) => String(num).padStart(2, '0');
        const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        PROMPT_LOG_FILENAME = `${currentConfig.PROMPT_LOG_BASE_NAME}-${timestamp}.log`;
    } else {
        PROMPT_LOG_FILENAME = ''; // Clear if not logging to file
    }

    // Assign to the exported CONFIG
    Object.assign(CONFIG, currentConfig);

    // Initialize logger
    logger.initialize({
        enabled: CONFIG.LOG_ENABLED ?? true,
        outputMode: CONFIG.LOG_OUTPUT_MODE || "all",
        logLevel: CONFIG.LOG_LEVEL || "info",
        logDir: CONFIG.LOG_DIR || "logs",
        includeRequestId: CONFIG.LOG_INCLUDE_REQUEST_ID ?? true,
        includeTimestamp: CONFIG.LOG_INCLUDE_TIMESTAMP ?? true,
        maxFileSize: CONFIG.LOG_MAX_FILE_SIZE || 10485760,
        maxFiles: CONFIG.LOG_MAX_FILES || 10
    });

    // Cleanup old logs periodically
    logger.cleanupOldLogs();

    return CONFIG;
}

/**
 * Gets system prompt content from the specified file path.
 * @param {string} filePath - Path to the system prompt file.
 * @returns {Promise<string|null>} File content, or null if the file does not exist, is empty, or an error occurs.
 */
export async function getSystemPromptFileContent(filePath) {
    try {
        await pfs.access(filePath, pfs.constants.F_OK);
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.warn(`[System Prompt] Specified system prompt file not found: ${filePath}`);
        } else {
            logger.error(`[System Prompt] Error accessing system prompt file ${filePath}: ${error.message}`);
        }
        return null;
    }

    try {
        const content = await pfs.readFile(filePath, 'utf8');
        if (!content.trim()) {
            return null;
        }
        logger.info(`[System Prompt] Loaded system prompt from ${filePath}`);
        return content;
    } catch (error) {
        logger.error(`[System Prompt] Error reading system prompt file ${filePath}: ${error.message}`);
        return null;
    }
}

export { ALL_MODEL_PROVIDERS, normalizeConfiguredProviders };

