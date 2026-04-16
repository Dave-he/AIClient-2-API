export { MODEL_PROTOCOL_PREFIX, MODEL_PROVIDER } from './constants.js';

export { RETRYABLE_NETWORK_ERRORS, isRetryableNetworkError, getClientIp, getRequestBody } from './network-utils.js';

export { formatExpiryTime, formatLog, formatExpiryLog } from './format-utils.js';

export { isAuthorized } from './auth-utils.js';

export { ENDPOINT_TYPE } from './model-list-handler.js';

export { handleStreamRequest, handleUnaryRequest, handleUnifiedResponse, extractResponseText, createErrorResponse, createStreamErrorResponse, logConversation } from './request-handlers.js';

export { handleModelListRequest } from './model-list-handler.js';

export { handleContentGenerationRequest, _manageSystemPrompt, extractPromptText } from './content-handler.js';

export { handleError } from './error-handler.js';

import { getProtocolPrefix as requestHandlersPrefix } from './request-handlers.js';
import { getProtocolPrefix as modelListPrefix } from './model-list-handler.js';
import { getProtocolPrefix as contentHandlerPrefix } from './content-handler.js';

export const FETCH_SYSTEM_PROMPT_FILE = './configs/fetch_system_prompt.txt';
export const INPUT_SYSTEM_PROMPT_FILE = './configs/input_system_prompt.txt';

export const API_ACTIONS = {
    GENERATE_CONTENT: 'generateContent',
    STREAM_GENERATE_CONTENT: 'streamGenerateContent',
};

export function getProtocolPrefix(provider) {
    return requestHandlersPrefix(provider);
}

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
                if (typeof requestBody.systemInstruction === 'string') {
                    return requestBody.systemInstruction;
                } else if (requestBody.systemInstruction.parts && Array.isArray(requestBody.systemInstruction.parts)) {
                    return requestBody.systemInstruction.parts.map(part => part.text || '').join('');
                }
            }
            if (requestBody.system_instruction) {
                if (typeof requestBody.system_instruction === 'string') {
                    return requestBody.system_instruction;
                } else if (requestBody.system_instruction.parts && Array.isArray(requestBody.system_instruction.parts)) {
                    return requestBody.system_instruction.parts.map(part => part.text || '').join('');
                }
            }
            return null;

        case MODEL_PROTOCOL_PREFIX.CLAUDE:
            if (requestBody.system && typeof requestBody.system === 'string') {
                return requestBody.system;
            }
            return null;

        default:
            return null;
    }
}