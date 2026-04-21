import logger from './logger.js';
import { convertData } from '../convert/convert.js';
import { getPluginManager } from '../core/plugin-manager.js';
import { MODEL_PROTOCOL_PREFIX } from './constants.js';

function getPluginHookRequestId(config) {
    return config?._monitorRequestId || config?._pluginRequestId || null;
}

export async function handleStreamRequest(res, service, model, requestBody, fromProvider, toProvider, PROMPT_LOG_MODE, PROMPT_LOG_FILENAME, providerPoolManager, pooluuid, customName, retryContext = null) {
    let fullResponseText = '';
    let responseClosed = false;
    let anyDataSent = retryContext?.anyDataSent || false;
    
    const maxRetries = retryContext?.maxRetries ?? 5;
    const currentRetry = retryContext?.currentRetry ?? 0;
    const CONFIG = retryContext?.CONFIG;
    const isRetry = currentRetry > 0;
    
    let clientDisconnected = retryContext?.clientDisconnected || { value: false };
    if (!isRetry) {
        clientDisconnected = { value: false };
    }

    let cleanupDone = false;
    const cleanup = () => {
        if (cleanupDone) return;
        cleanupDone = true;
        res.off('close', onClientClose);
        res.off('error', onClientError);
    };

    const onClientClose = () => {
        clientDisconnected.value = true;
        logger.info('[Stream] Client disconnected, stopping stream processing');
        cleanup();
    };
    
    const onClientError = (err) => {
        clientDisconnected.value = true;
        logger.error('[Stream] Response stream error:', err.message);
        cleanup();
    };
    
    res.on('close', onClientClose);
    res.on('error', onClientError);

    if (!isRetry) {
        await handleUnifiedResponse(res, '', true);
    }

    let hasToolCall = false;
    let hasMessageStop = false;

    try {
        const needsConversion = getProtocolPrefix(fromProvider) !== getProtocolPrefix(toProvider);
        requestBody.model = model;
        const nativeStream = await service.generateContentStream(model, requestBody);
        const addEvent = getProtocolPrefix(fromProvider) === MODEL_PROTOCOL_PREFIX.CLAUDE || 
                         getProtocolPrefix(fromProvider) === MODEL_PROTOCOL_PREFIX.OPENAI_RESPONSES;
        const streamRequestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

        for await (const nativeChunk of nativeStream) {
            if (clientDisconnected.value) {
                logger.info('[Stream] Stopping iteration due to client disconnect');
                break;
            }
            
            const chunkText = extractResponseText(nativeChunk, toProvider);
            if (chunkText && !Array.isArray(chunkText)) {
                fullResponseText += chunkText;
            }

            const chunkToSend = needsConversion
                ? convertData(nativeChunk, 'streamChunk', toProvider, fromProvider, model, streamRequestId)
                : nativeChunk;

            const hookRequestId = getPluginHookRequestId(CONFIG);
            if (hookRequestId) {
                try {
                    const pluginManager = getPluginManager();
                    await pluginManager.executeHook('onStreamChunk', {
                        nativeChunk,
                        chunkToSend,
                        fromProvider,
                        toProvider,
                        model,
                        requestId: hookRequestId
                    });
                } catch (e) {
                    logger.debug('[Plugin] onStreamChunk hook failed:', e?.message || e);
                }
            }

            if (!chunkToSend) {
                continue;
            }

            const chunksToSend = Array.isArray(chunkToSend) ? chunkToSend : [chunkToSend];

            for (const chunk of chunksToSend) {
                if (clientDisconnected.value) {
                    break;
                }

                if (chunk?.type === 'done') {
                    continue;
                }
                
                if (chunk.choices?.[0]?.delta?.tool_calls || chunk.choices?.[0]?.finish_reason === 'tool_calls') {
                    hasToolCall = true;
                }
                if (chunk.type === 'content_block_start' && chunk.content_block?.type === 'tool_use') {
                    hasToolCall = true;
                }
                if (chunk.type === 'message_delta' && (chunk.delta?.stop_reason === 'tool_use' || chunk.stop_reason === 'tool_use')) {
                    hasToolCall = true;
                }
                if (chunk.candidates?.[0]?.content?.parts?.some(p => p.functionCall)) {
                    hasToolCall = true;
                }

                if (hasToolCall && needsConversion) {
                    if (chunk.choices?.[0]?.finish_reason === 'stop') {
                        chunk.choices[0].finish_reason = 'tool_calls';
                    } else if (chunk.type === 'message_delta' && chunk.delta?.stop_reason === 'end_turn') {
                        chunk.delta.stop_reason = 'tool_use';
                    } else if (chunk.candidates?.[0]?.finishReason === 'STOP' || chunk.candidates?.[0]?.finishReason === 'stop') {
                        chunk.candidates[0].finishReason = 'TOOL_CALLS';
                    }
                }

                if (
                    chunk?.choices?.some(choice => choice?.finish_reason) ||
                    chunk?.type === 'message_stop' ||
                    chunk?.type === 'done' ||
                    chunk?.candidates?.some(candidate => candidate?.finishReason)
                ) {
                    hasMessageStop = true;
                }

                if (addEvent) {
                    if (!clientDisconnected.value && !res.writableEnded) {
                        try {
                            res.write(`event: ${chunk.type}\n`);
                            anyDataSent = true;
                        } catch (writeErr) {
                            logger.error('[Stream] Failed to write event:', writeErr.message);
                            clientDisconnected.value = true;
                            break;
                        }
                    }
                }

                if (!clientDisconnected.value && !res.writableEnded) {
                    try {
                        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                        anyDataSent = true;
                    } catch (writeErr) {
                        logger.error('[Stream] Failed to write data:', writeErr.message);
                        clientDisconnected.value = true;
                        break;
                    }
                }
            }
        }

        if (providerPoolManager && pooluuid) {
            const customNameDisplay = customName ? `, ${customName}` : '';
            logger.info(`[Provider Pool] Increasing usage count for ${toProvider} (${pooluuid}${customNameDisplay}) after successful stream request`);
            providerPoolManager.markProviderHealthy(toProvider, { uuid: pooluuid });
        }

    } catch (error) {
        logger.error('\n[Server] Error during stream processing:', error.stack);
        
        if (clientDisconnected.value) {
            logger.info('[Stream] Skipping error response due to client disconnect');
            responseClosed = true;
            return;
        }
        
        if (anyDataSent) {
            logger.info(`[Stream Retry] Cannot retry: data already sent to client`);
            const errorPayload = createStreamErrorResponse(error, fromProvider);
            if (!res.writableEnded) {
                try {
                    res.write(errorPayload);
                    res.end();
                } catch (writeErr) {
                    logger.error('[Stream] Failed to write error response:', writeErr.message);
                }
            }
            responseClosed = true;
            return;
        }
        
        const status = error.response?.status;
        const skipErrorCount = error.skipErrorCount === true;
        const shouldSwitchCredential = error.shouldSwitchCredential === true;
        let credentialMarkedUnhealthy = error.credentialMarkedUnhealthy === true;
        
        if (!credentialMarkedUnhealthy && !skipErrorCount && providerPoolManager && pooluuid) {
            if (error.response?.status === 400) {
                logger.info(`[Provider Pool] Skipping unhealthy marking for ${toProvider} (${pooluuid}) due to status 400 (client error)`);
            } else {
                logger.info(`[Provider Pool] Marking ${toProvider} as unhealthy due to stream error (status: ${status || 'unknown'})`);
                providerPoolManager.markProviderUnhealthy(toProvider, { uuid: pooluuid }, error.message);
                credentialMarkedUnhealthy = true;
            }
        }
        
        if (shouldSwitchCredential && !credentialMarkedUnhealthy) {
            credentialMarkedUnhealthy = true;
        }
        
        if (credentialMarkedUnhealthy && currentRetry < maxRetries && providerPoolManager && CONFIG) {
            const randomDelay = Math.floor(Math.random() * 10000);
            logger.info(`[Stream Retry] Credential marked unhealthy. Waiting ${randomDelay}ms before retry ${currentRetry + 1}/${maxRetries} with different credential...`);
            await new Promise(resolve => setTimeout(resolve, randomDelay));
            
            try {
                const { getApiServiceWithFallback } = await import('../services/service-manager.js');
                const result = await getApiServiceWithFallback(CONFIG, model, { acquireSlot: true });
                
                if (result && result.service) {
                    logger.info(`[Stream Retry] Switched to new credential: ${result.uuid} (provider: ${result.actualProviderType})`);
                    
                    const newRetryContext = {
                        ...retryContext,
                        CONFIG,
                        currentRetry: currentRetry + 1,
                        maxRetries,
                        clientDisconnected,
                        anyDataSent
                    };
                    
                    return await handleStreamRequest(
                        res,
                        result.service,
                        result.actualModel || model,
                        requestBody,
                        fromProvider,
                        result.actualProviderType || toProvider,
                        PROMPT_LOG_MODE,
                        PROMPT_LOG_FILENAME,
                        providerPoolManager,
                        result.uuid,
                        result.serviceConfig?.customName || customName,
                        newRetryContext
                    );
                } else {
                    logger.info(`[Stream Retry] No healthy credential available for retry.`);
                }
            } catch (retryError) {
                logger.error(`[Stream Retry] Failed to get alternative service:`, retryError.message);
            }
        }

        const errorPayload = createStreamErrorResponse(error, fromProvider);
        if (!clientDisconnected.value && !res.writableEnded) {
            try {
                res.write(errorPayload);
                res.end();
            } catch (writeErr) {
                logger.error('[Stream] Failed to write error response:', writeErr.message);
            }
        }
        responseClosed = true;
    } finally {
        if (providerPoolManager && pooluuid) {
            providerPoolManager.releaseSlot(toProvider, pooluuid);
        }

        cleanup();
        
        if (!responseClosed && !clientDisconnected.value && !isRetry) {
            const clientProtocol = getProtocolPrefix(fromProvider);
            if (!res.writableEnded) {
                try {
                    if (clientProtocol === MODEL_PROTOCOL_PREFIX.OPENAI) {
                        if (!hasMessageStop) {
                            res.write('data: [DONE]\n\n');
                            hasMessageStop = true;
                        }
                    } else if (clientProtocol === MODEL_PROTOCOL_PREFIX.OPENAI_RESPONSES) {
                    } else if (clientProtocol === MODEL_PROTOCOL_PREFIX.CLAUDE) {
                        if (!hasMessageStop) {
                            res.write('event: message_stop\n');
                            res.write('data: {"type":"message_stop"}\n\n');
                            hasMessageStop = true;
                        }
                    } else if (clientProtocol === MODEL_PROTOCOL_PREFIX.GEMINI) {
                        if (!hasMessageStop) {
                            res.write('data: {"candidates":[{"finishReason":"STOP"}]}\n\n');
                            hasMessageStop = true;
                        }
                    }
                    res.end();
                } catch (writeErr) {
                    logger.error('[Stream] Failed to write completion marker:', writeErr.message);
                }
            }
        }
        
        if (!isRetry) {
            await logConversation('output', fullResponseText, PROMPT_LOG_MODE, PROMPT_LOG_FILENAME);
        }
    }
}

export async function handleUnaryRequest(res, service, model, requestBody, fromProvider, toProvider, PROMPT_LOG_MODE, PROMPT_LOG_FILENAME, providerPoolManager, pooluuid, customName, retryContext = null) {
    const maxRetries = retryContext?.maxRetries ?? 5;
    const currentRetry = retryContext?.currentRetry ?? 0;
    const CONFIG = retryContext?.CONFIG;
    
    try {
        const needsConversion = getProtocolPrefix(fromProvider) !== getProtocolPrefix(toProvider);
        requestBody.model = model;
        const nativeResponse = await service.generateContent(model, requestBody);
        const responseText = extractResponseText(nativeResponse, toProvider);

        let clientResponse = nativeResponse;
        if (needsConversion) {
            logger.info(`[Response Convert] Converting response from ${toProvider} to ${fromProvider}`);
            clientResponse = convertData(nativeResponse, 'response', toProvider, fromProvider, model);
        }

        const hookRequestId = getPluginHookRequestId(CONFIG);
        if (hookRequestId) {
            try {
                const pluginManager = getPluginManager();
                await pluginManager.executeHook('onUnaryResponse', {
                    nativeResponse,
                    clientResponse,
                    fromProvider,
                    toProvider,
                    model,
                    requestId: hookRequestId
                });
            } catch (e) {}
        }

        await handleUnifiedResponse(res, JSON.stringify(clientResponse), false);
        await logConversation('output', responseText, PROMPT_LOG_MODE, PROMPT_LOG_FILENAME);
        
        if (providerPoolManager && pooluuid) {
            const customNameDisplay = customName ? `, ${customName}` : '';
            logger.info(`[Provider Pool] Increasing usage count for ${toProvider} (${pooluuid}${customNameDisplay}) after successful unary request`);
            providerPoolManager.markProviderHealthy(toProvider, { uuid: pooluuid });
        }
    } catch (error) {
        logger.error('\n[Server] Error during unary processing:', error.stack);
        
        const status = error.response?.status;
        const skipErrorCount = error.skipErrorCount === true;
        const shouldSwitchCredential = error.shouldSwitchCredential === true;
        let credentialMarkedUnhealthy = error.credentialMarkedUnhealthy === true;
        
        if (!credentialMarkedUnhealthy && !skipErrorCount && providerPoolManager && pooluuid) {
            if (error.response?.status === 400) {
                logger.info(`[Provider Pool] Skipping unhealthy marking for ${toProvider} (${pooluuid}) due to status 400 (client error)`);
            } else {
                logger.info(`[Provider Pool] Marking ${toProvider} as unhealthy due to unary error (status: ${status || 'unknown'})`);
                providerPoolManager.markProviderUnhealthy(toProvider, { uuid: pooluuid }, error.message);
                credentialMarkedUnhealthy = true;
            }
        }
        
        if (shouldSwitchCredential && !credentialMarkedUnhealthy) {
            credentialMarkedUnhealthy = true;
        }
        
        if (credentialMarkedUnhealthy && currentRetry < maxRetries && providerPoolManager && CONFIG) {
            const randomDelay = Math.floor(Math.random() * 10000);
            logger.info(`[Unary Retry] Credential marked unhealthy. Waiting ${randomDelay}ms before retry ${currentRetry + 1}/${maxRetries} with different credential...`);
            await new Promise(resolve => setTimeout(resolve, randomDelay));
            
            try {
                const { getApiServiceWithFallback } = await import('../services/service-manager.js');
                const result = await getApiServiceWithFallback(CONFIG, model, { acquireSlot: true });
                
                if (result && result.service) {
                    logger.info(`[Unary Retry] Switched to new credential: ${result.uuid} (provider: ${result.actualProviderType})`);
                    
                    const newRetryContext = {
                        ...retryContext,
                        CONFIG,
                        currentRetry: currentRetry + 1,
                        maxRetries
                    };
                    
                    return await handleUnaryRequest(
                        res,
                        result.service,
                        result.actualModel || model,
                        requestBody,
                        fromProvider,
                        result.actualProviderType || toProvider,
                        PROMPT_LOG_MODE,
                        PROMPT_LOG_FILENAME,
                        providerPoolManager,
                        result.uuid,
                        result.serviceConfig?.customName || customName,
                        newRetryContext
                    );
                } else {
                    logger.info(`[Unary Retry] No healthy credential available for retry.`);
                }
            } catch (retryError) {
                logger.error(`[Unary Retry] Failed to get alternative service:`, retryError.message);
            }
        }

        const errorResponse = createErrorResponse(error, fromProvider);
        const statusCode = error.status || error.code || (error.response && error.response.status) || 500;
        await handleUnifiedResponse(res, JSON.stringify(errorResponse), false, statusCode);
    } finally {
        if (providerPoolManager && pooluuid) {
            providerPoolManager.releaseSlot(toProvider, pooluuid);
        }
    }
}

export async function handleUnifiedResponse(res, responsePayload, isStream, statusCode = 200) {
    if (isStream) {
        res.writeHead(200, { 
            "Content-Type": "text/event-stream", 
            "Cache-Control": "no-cache", 
            "Connection": "keep-alive", 
            "Transfer-Encoding": "chunked" 
        });
    } else {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    }

    if (isStream) {
    } else {
        res.end(responsePayload);
    }
}

export function extractResponseText(response, providerType) {
    const protocol = getProtocolPrefix(providerType);
    
    if (protocol === MODEL_PROTOCOL_PREFIX.OPENAI) {
        if (response.choices && response.choices[0] && response.choices[0].message) {
            return response.choices[0].message.content;
        }
    } else if (protocol === MODEL_PROTOCOL_PREFIX.CLAUDE) {
        if (response.content && response.content[0]) {
            return response.content[0].text;
        }
    } else if (protocol === MODEL_PROTOCOL_PREFIX.GEMINI) {
        if (response.candidates && response.candidates[0] && 
            response.candidates[0].content && response.candidates[0].content.parts) {
            return response.candidates[0].content.parts.map(p => p.text || p.functionCall?.name).join('');
        }
    }
    
    return null;
}

export function createErrorResponse(error, providerType) {
    const protocol = getProtocolPrefix(providerType);
    const status = error.response?.status;
    const message = error.message || 'Unknown error';
    
    if (protocol === MODEL_PROTOCOL_PREFIX.OPENAI) {
        return {
            error: {
                message: message,
                type: 'server_error',
                param: null,
                code: status || null
            }
        };
    } else if (protocol === MODEL_PROTOCOL_PREFIX.CLAUDE) {
        return {
            type: 'error',
            error: {
                type: 'server_error',
                message: message
            }
        };
    } else if (protocol === MODEL_PROTOCOL_PREFIX.GEMINI) {
        return {
            error: {
                code: status || 500,
                message: message,
                status: 'INTERNAL'
            }
        };
    }
    
    return { error: message };
}

export function createStreamErrorResponse(error, providerType) {
    const protocol = getProtocolPrefix(providerType);
    const message = error.message || 'Unknown error';
    
    if (protocol === MODEL_PROTOCOL_PREFIX.OPENAI) {
        return `data: {"error":{"message":"${message}","type":"server_error"}}\n\n`;
    } else if (protocol === MODEL_PROTOCOL_PREFIX.CLAUDE) {
        return `event: error\ndata: {"type":"error","error":{"type":"server_error","message":"${message}"}}\n\n`;
    } else if (protocol === MODEL_PROTOCOL_PREFIX.GEMINI) {
        return `data: {"error":{"message":"${message}"}}\n\n`;
    }
    
    return `data: {"error":"${message}"}\n\n`;
}

export function getProtocolPrefix(provider) {
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

export async function logConversation(type, content, logMode, logFilename) {
    if (logMode === 'none') return;
    if (!content) return;

    const timestamp = new Date().toLocaleString();
    const logEntry = `${timestamp} [${type.toUpperCase()}]:\n${content}\n--------------------------------------\n`;

    if (logMode === 'console') {
        logger.info(logEntry);
    } else if (logMode === 'file') {
        const { promises: fs } = await import('fs');
        try {
            await fs.appendFile(logFilename, logEntry);
        } catch (err) {
            logger.error(`[Error] Failed to write conversation log to ${logFilename}:`, err);
        }
    }
}