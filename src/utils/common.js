import { MODEL_PROTOCOL_PREFIX, MODEL_PROVIDER } from './constants.js';
export { MODEL_PROTOCOL_PREFIX, MODEL_PROVIDER };

// ==================== 时间与时区 ====================

/**
 * 获取北京时间 (UTC+8) 的日期字符串 (YYYY-MM-DD)
 * @returns {string} - YYYY-MM-DD 格式的日期字符串
 */
export function getBeijingDateString() {
    const now = new Date();
    // 强制增加 8 小时偏移来模拟 UTC+8
    const utc8Time = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return utc8Time.toISOString().split('T')[0];
}

// ==================== 网络错误处理 ====================
export { RETRYABLE_NETWORK_ERRORS, isRetryableNetworkError, getClientIp, getRequestBody } from './network-utils.js';

export { formatExpiryTime, formatLog, formatExpiryLog } from './format-utils.js';

export { isAuthorized } from './auth-utils.js';

export { ENDPOINT_TYPE } from './model-list-handler.js';

export { handleStreamRequest, handleUnaryRequest, handleUnifiedResponse, extractResponseText, createErrorResponse, createStreamErrorResponse, logConversation } from './request-handlers.js';

export { handleModelListRequest } from './model-list-handler.js';

export { handleContentGenerationRequest, _manageSystemPrompt, extractPromptText } from './content-handler.js';

export { 
    handleError, 
    ERROR_CODES, 
    APIError, 
    AuthError, 
    PermissionError, 
    RateLimitError, 
    ModelNotFoundError, 
    ValidationError, 
    NetworkError, 
    TimeoutError, 
    ServerError, 
    ConfigError, 
    ProviderUnavailableError,
    wrapError
} from './error-handler.js';

export { getProtocolPrefix } from './request-handlers.js';

export const FETCH_SYSTEM_PROMPT_FILE = './configs/fetch_system_prompt.txt';
export const INPUT_SYSTEM_PROMPT_FILE = './configs/input_system_prompt.txt';

export const API_ACTIONS = {
    GENERATE_CONTENT: 'generateContent',
    STREAM_GENERATE_CONTENT: 'streamGenerateContent',
};

export function resolveCustomModelRouting(model, currentProvider, customModelConfig) {
    if (!customModelConfig) {
        return {
            isCustomModel: false,
            model,
            provider: currentProvider,
            actualModel: model,
            actualProvider: currentProvider,
            config: null
        };
    }

    const customActualProvider = customModelConfig.actualProvider || customModelConfig.provider;
    const customActualModel = customModelConfig.actualModel || customModelConfig.id || model;

    return {
        isCustomModel: true,
        model: customActualModel,
        provider: customActualProvider || currentProvider,
        actualModel: customActualModel,
        actualProvider: customActualProvider || currentProvider,
        config: customModelConfig
    };
}

export function extractSystemPromptFromRequestBody(requestBody, protocolPrefix) {
    if (!requestBody) {
        return null;
    }

    switch (protocolPrefix) {
        case MODEL_PROTOCOL_PREFIX.OPENAI:
        case MODEL_PROTOCOL_PREFIX.CODEX:
        case MODEL_PROTOCOL_PREFIX.FORWARD:
            if (requestBody.messages && Array.isArray(requestBody.messages)) {
                const systemMessage = requestBody.messages.find(msg => msg.role === 'system');
                return systemMessage ? systemMessage.content : null;
            }
            return null;

        case MODEL_PROTOCOL_PREFIX.GEMINI:
            if (requestBody.systemInstruction) {
                return requestBody.systemInstruction;
            }
            if (requestBody.system) {
                return typeof requestBody.system === 'string' ? requestBody.system : requestBody.system.content;
            }
            return null;

        case MODEL_PROTOCOL_PREFIX.CLAUDE:
            if (requestBody.system) {
                return requestBody.system;
            }
            return null;

        default:
            return null;
    }
}

