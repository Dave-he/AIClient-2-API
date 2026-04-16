import logger from './logger.js';
import { getRequestBody } from './network-utils.js';
import { convertData } from '../convert/convert.js';
import { ProviderStrategyFactory } from './provider-strategies.js';
import { getPluginManager } from '../core/plugin-manager.js';
import { MODEL_PROVIDER, MODEL_PROTOCOL_PREFIX } from './constants.js';
import { handleStreamRequest, handleUnaryRequest, logConversation } from './request-handlers.js';
import { getCustomModelConfig } from '../providers/provider-models.js';

function resolveCustomModelRouting(model, currentProvider, customModelConfig) {
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

export async function handleContentGenerationRequest(req, res, service, endpointType, CONFIG, PROMPT_LOG_FILENAME, providerPoolManager, pooluuid, requestPath = null) {
    const originalRequestBody = await getRequestBody(req);

    if (!originalRequestBody) {
        throw new Error("Request body is missing for content generation.");
    }

    const clientProviderMap = {
        'openai_chat': MODEL_PROTOCOL_PREFIX.OPENAI,
        'openai_responses': MODEL_PROTOCOL_PREFIX.OPENAI_RESPONSES,
        'claude_message': MODEL_PROTOCOL_PREFIX.CLAUDE,
        'gemini_content': MODEL_PROTOCOL_PREFIX.GEMINI,
    };

    const fromProvider = clientProviderMap[endpointType];
    let toProvider = CONFIG.actualProviderType || CONFIG.MODEL_PROVIDER;
    let actualUuid = pooluuid;
    
    if (!fromProvider) {
        throw new Error(`Unsupported endpoint type for content generation: ${endpointType}`);
    }

    let { model, isStream } = _extractModelAndStreamInfo(req, originalRequestBody, fromProvider);

    if (!model) {
        throw new Error("Could not determine the model from the request.");
    }
    
    const customModelConfig = getCustomModelConfig(model, CONFIG.MODEL_PROVIDER);
    CONFIG.customConfig = customModelConfig || null;
    if (customModelConfig) {
        const customRouting = resolveCustomModelRouting(model, CONFIG.MODEL_PROVIDER, customModelConfig);
        logger.info(`[Custom Model] Resolved '${model}' to actual model '${customRouting.actualModel}'`);
        
        if (customRouting.actualProvider && customRouting.actualProvider !== CONFIG.MODEL_PROVIDER) {
            CONFIG.MODEL_PROVIDER = customRouting.actualProvider;
            toProvider = customRouting.actualProvider;
            logger.info(`[Custom Model] Switched provider to '${CONFIG.MODEL_PROVIDER}' based on custom model config`);
        }

        if (customRouting.actualModel) {
            model = customRouting.actualModel;
        }
    }

    logger.info(`[Content Generation] Model: ${model}, Stream: ${isStream}`);

    let actualCustomName = CONFIG.customName;

    const shouldSelectByPool = providerPoolManager && (CONFIG.MODEL_PROVIDER === MODEL_PROVIDER.AUTO || (CONFIG.providerPools && CONFIG.providerPools[CONFIG.MODEL_PROVIDER]));
    if (!service || shouldSelectByPool) {
        const { getApiServiceWithFallback } = await import('../services/service-manager.js');
        const result = await getApiServiceWithFallback(CONFIG, model, { acquireSlot: shouldSelectByPool });

        service = result.service;
        toProvider = result.actualProviderType;
        actualUuid = result.uuid || pooluuid;
        actualCustomName = result.serviceConfig?.customName || CONFIG.customName;

        if (result.actualModel && result.actualModel !== model) {
            logger.info(`[Content Generation] Model Fallback: ${model} -> ${result.actualModel}`);
            model = result.actualModel;
        }

        if (result.isFallback) {
            logger.info(`[Content Generation] Fallback activated: ${CONFIG.MODEL_PROVIDER} -> ${toProvider} (uuid: ${actualUuid})`);
        } else {
            logger.info(`[Content Generation] Selected service adapter based on model: ${model}`);
        }
    }

    let processedRequestBody = originalRequestBody;
    if (CONFIG._monitorRequestId) {
        processedRequestBody._monitorRequestId = CONFIG._monitorRequestId;
    }
    
    if (CONFIG.requestBaseUrl) {
        processedRequestBody._requestBaseUrl = CONFIG.requestBaseUrl;
    }

    const fromPrefix = getProtocolPrefix(fromProvider);
    const toPrefix = getProtocolPrefix(toProvider);
    
    if (fromPrefix !== toPrefix) {
        logger.info(`[Request Convert] Converting request from ${fromProvider} to ${toProvider}`);
        processedRequestBody = convertData(originalRequestBody, 'request', fromProvider, toProvider);
    } else {
        logger.info(`[Request Convert] Request format matches backend provider. No conversion needed.`);
    }
    
    if (requestPath && toPrefix === MODEL_PROTOCOL_PREFIX.FORWARD) {
        logger.info(`[Forward API] Request path: ${requestPath}`);
        processedRequestBody.endpoint = requestPath;
    }

    processedRequestBody = await _applySystemPromptFromFile(CONFIG, processedRequestBody, toProvider);
    await _manageSystemPrompt(processedRequestBody, toProvider);

    const promptText = extractPromptText(processedRequestBody, toProvider);
    
    if (customModelConfig) {
        _applyCustomModelParameters(processedRequestBody, customModelConfig, toProvider);
    }

    await logConversation('input', promptText, CONFIG.PROMPT_LOG_MODE, PROMPT_LOG_FILENAME);
    
    const credentialSwitchMaxRetries = CONFIG.CREDENTIAL_SWITCH_MAX_RETRIES || 5;
    const retryContext = { CONFIG, currentRetry: 0, maxRetries: credentialSwitchMaxRetries };
    
    if (isStream) {
        await handleStreamRequest(res, service, model, processedRequestBody, fromProvider, toProvider, CONFIG.PROMPT_LOG_MODE, PROMPT_LOG_FILENAME, providerPoolManager, actualUuid, actualCustomName, retryContext);
    } else {
        await handleUnaryRequest(res, service, model, processedRequestBody, fromProvider, toProvider, CONFIG.PROMPT_LOG_MODE, PROMPT_LOG_FILENAME, providerPoolManager, actualUuid, actualCustomName, retryContext);
    }

    try {
        const pluginManager = getPluginManager();
        await pluginManager.executeHook('onContentGenerated', {
            ...CONFIG,
            originalRequestBody,
            processedRequestBody,
            fromProvider,
            toProvider,
            model,
            isStream
        });
    } catch (e) { /* 静默失败，不影响主流程 */ }
}

function _extractModelAndStreamInfo(req, requestBody, fromProvider) {
    const strategy = ProviderStrategyFactory.getStrategy(getProtocolPrefix(fromProvider));
    return strategy.extractModelAndStreamInfo(req, requestBody);
}

async function _applySystemPromptFromFile(config, requestBody, toProvider) {
    const strategy = ProviderStrategyFactory.getStrategy(getProtocolPrefix(toProvider));
    return strategy.applySystemPromptFromFile(config, requestBody);
}

export async function _manageSystemPrompt(requestBody, provider) {
    const strategy = ProviderStrategyFactory.getStrategy(getProtocolPrefix(provider));
    await strategy.manageSystemPrompt(requestBody);
}

export function extractPromptText(requestBody, provider) {
    const strategy = ProviderStrategyFactory.getStrategy(getProtocolPrefix(provider));
    return strategy.extractPromptText(requestBody);
}

function _applyCustomModelParameters(requestBody, customConfig, provider) {
    const protocol = getProtocolPrefix(provider);
    const hasConfiguredValue = (value) => value !== undefined && value !== null;

    const mappings = {
        temperature: {
            [MODEL_PROTOCOL_PREFIX.OPENAI]: 'temperature',
            [MODEL_PROTOCOL_PREFIX.OPENAI_RESPONSES]: 'temperature',
            [MODEL_PROTOCOL_PREFIX.CLAUDE]: 'temperature',
            [MODEL_PROTOCOL_PREFIX.GEMINI]: 'generationConfig.temperature'
        },
        maxTokens: {
            [MODEL_PROTOCOL_PREFIX.OPENAI]: 'max_tokens',
            [MODEL_PROTOCOL_PREFIX.OPENAI_RESPONSES]: 'max_output_tokens',
            [MODEL_PROTOCOL_PREFIX.CLAUDE]: 'max_tokens',
            [MODEL_PROTOCOL_PREFIX.GEMINI]: 'generationConfig.maxOutputTokens'
        },
        topP: {
            [MODEL_PROTOCOL_PREFIX.OPENAI]: 'top_p',
            [MODEL_PROTOCOL_PREFIX.OPENAI_RESPONSES]: 'top_p',
            [MODEL_PROTOCOL_PREFIX.CLAUDE]: 'top_p',
            [MODEL_PROTOCOL_PREFIX.GEMINI]: 'generationConfig.topP'
        }
    };

    const setNestedProperty = (obj, path, value) => {
        const parts = path.split('.');
        let curr = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!curr[parts[i]]) curr[parts[i]] = {};
            curr = curr[parts[i]];
        }
        curr[parts[parts.length - 1]] = value;
        logger.debug(`[Custom Model] Applied nested parameter ${path}=${value}`);
    };

    Object.keys(mappings).forEach(key => {
        const value = customConfig[key];
        const targetPath = mappings[key][protocol];
        
        if (hasConfiguredValue(value) && targetPath) {
            if (targetPath.includes('.')) {
                setNestedProperty(requestBody, targetPath, value);
            } else {
                requestBody[targetPath] = value;
                logger.debug(`[Custom Model] Applied ${key}=${value} to request (${targetPath})`);
            }
        }
    });
}

export function getProtocolPrefix(provider) {
    if (provider === 'openai-codex-oauth') {
        return 'codex';
    }

    const hyphenIndex = provider.indexOf('-');
    if (hyphenIndex !== -1) {
        return provider.substring(0, hyphenIndex);
    }
    return provider;
}