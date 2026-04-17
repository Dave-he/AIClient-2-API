import logger from './logger.js';
import { MODEL_PROTOCOL_PREFIX } from './constants.js';
import { getProtocolPrefix } from './request-handlers.js';

export const ERROR_CODES = {
    AUTH_ERROR: 'AUTH_ERROR',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    RATE_LIMITED: 'RATE_LIMITED',
    MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
    INVALID_REQUEST: 'INVALID_REQUEST',
    SERVER_ERROR: 'SERVER_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
    CONFIG_ERROR: 'CONFIG_ERROR'
};

export const ERROR_MESSAGES = {
    [ERROR_CODES.AUTH_ERROR]: 'Authentication failed. Please check your credentials.',
    [ERROR_CODES.PERMISSION_DENIED]: 'Access denied. Insufficient permissions.',
    [ERROR_CODES.RATE_LIMITED]: 'Too many requests. Rate limit exceeded.',
    [ERROR_CODES.MODEL_NOT_FOUND]: 'Model not found or not available.',
    [ERROR_CODES.INVALID_REQUEST]: 'Invalid request parameters.',
    [ERROR_CODES.SERVER_ERROR]: 'Server error occurred.',
    [ERROR_CODES.NETWORK_ERROR]: 'Network error occurred.',
    [ERROR_CODES.TIMEOUT_ERROR]: 'Request timed out.',
    [ERROR_CODES.VALIDATION_ERROR]: 'Validation failed.',
    [ERROR_CODES.PROVIDER_UNAVAILABLE]: 'Provider unavailable.',
    [ERROR_CODES.CONFIG_ERROR]: 'Configuration error.'
};

export class APIError extends Error {
    constructor(code, message, details = {}, statusCode = 500) {
        super(message || ERROR_MESSAGES[code]);
        this.name = 'APIError';
        this.code = code;
        this.details = details;
        this.statusCode = statusCode;
        this.timestamp = new Date().toISOString();
        this.errorId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    toJSON() {
        return {
            error: {
                code: this.code,
                message: this.message,
                details: this.details,
                timestamp: this.timestamp,
                errorId: this.errorId,
                statusCode: this.statusCode
            }
        };
    }
}

export class AuthError extends APIError {
    constructor(message, details = {}) {
        super(ERROR_CODES.AUTH_ERROR, message, details, 401);
        this.name = 'AuthError';
    }
}

export class PermissionError extends APIError {
    constructor(message, details = {}) {
        super(ERROR_CODES.PERMISSION_DENIED, message, details, 403);
        this.name = 'PermissionError';
    }
}

export class RateLimitError extends APIError {
    constructor(message, details = {}) {
        super(ERROR_CODES.RATE_LIMITED, message, details, 429);
        this.name = 'RateLimitError';
    }
}

export class ModelNotFoundError extends APIError {
    constructor(message, details = {}) {
        super(ERROR_CODES.MODEL_NOT_FOUND, message, details, 404);
        this.name = 'ModelNotFoundError';
    }
}

export class ValidationError extends APIError {
    constructor(message, details = {}) {
        super(ERROR_CODES.VALIDATION_ERROR, message, details, 400);
        this.name = 'ValidationError';
    }
}

export class NetworkError extends APIError {
    constructor(message, details = {}) {
        super(ERROR_CODES.NETWORK_ERROR, message, details, 503);
        this.name = 'NetworkError';
    }
}

export class TimeoutError extends APIError {
    constructor(message, details = {}) {
        super(ERROR_CODES.TIMEOUT_ERROR, message, details, 504);
        this.name = 'TimeoutError';
    }
}

export class ServerError extends APIError {
    constructor(message, details = {}) {
        super(ERROR_CODES.SERVER_ERROR, message, details, 500);
        this.name = 'ServerError';
    }
}

export class ConfigError extends APIError {
    constructor(message, details = {}) {
        super(ERROR_CODES.CONFIG_ERROR, message, details, 500);
        this.name = 'ConfigError';
    }
}

export class ProviderUnavailableError extends APIError {
    constructor(message, details = {}) {
        super(ERROR_CODES.PROVIDER_UNAVAILABLE, message, details, 503);
        this.name = 'ProviderUnavailableError';
    }
}

function _getProviderSpecificSuggestions(statusCode, provider) {
    const protocolPrefix = provider ? getProtocolPrefix(provider) : null;
    
    const defaultSuggestions = {
        auth: [
            'Verify your API key or credentials are valid',
            'Check if your credentials have expired',
            'Ensure the API key has the necessary permissions'
        ],
        permission: [
            'Check if your account has the necessary permissions',
            'Verify the API endpoint is accessible with your credentials',
            'Contact your administrator if permissions are restricted'
        ],
        rateLimit: [
            'The request has been automatically retried with exponential backoff',
            'If the issue persists, try reducing the request frequency',
            'Consider upgrading your API quota if available'
        ],
        serverError: [
            'The request has been automatically retried',
            'If the issue persists, try again in a few minutes',
            'Check the service status page for outages'
        ],
        clientError: [
            'Check your request format and parameters',
            'Verify the model name is correct',
            'Ensure all required fields are provided'
        ]
    };
    
    switch (protocolPrefix) {
        case MODEL_PROTOCOL_PREFIX.GEMINI:
            return {
                auth: [
                    'Verify your OAuth credentials are valid',
                    'Try re-authenticating by deleting the credentials file',
                    'Check if your Google Cloud project has the necessary permissions'
                ],
                permission: [
                    'Ensure your Google Cloud project has the Gemini API enabled',
                    'Check if your account has the necessary permissions',
                    'Verify the project ID is correct'
                ],
                rateLimit: [
                    'The request has been automatically retried with exponential backoff',
                    'If the issue persists, try reducing the request frequency',
                    'Consider upgrading your Google Cloud API quota'
                ],
                serverError: [
                    'The request has been automatically retried',
                    'If the issue persists, try again in a few minutes',
                    'Check Google Cloud status page for service outages'
                ],
                clientError: [
                    'Check your request format and parameters',
                    'Verify the model name is a valid Gemini model',
                    'Ensure all required fields are provided'
                ]
            };
            
        case MODEL_PROTOCOL_PREFIX.OPENAI:
        case MODEL_PROTOCOL_PREFIX.OPENAI_RESPONSES:
            return {
                auth: [
                    'Verify your OpenAI API key is valid',
                    'Check if your API key has expired or been revoked',
                    'Ensure the API key is correctly formatted (starts with sk-)'
                ],
                permission: [
                    'Check if your OpenAI account has access to the requested model',
                    'Verify your organization settings allow this operation',
                    'Ensure you have sufficient credits in your account'
                ],
                rateLimit: [
                    'The request has been automatically retried with exponential backoff',
                    'If the issue persists, try reducing the request frequency',
                    'Consider upgrading your OpenAI usage tier for higher limits'
                ],
                serverError: [
                    'The request has been automatically retried',
                    'If the issue persists, try again in a few minutes',
                    'Check OpenAI status page (status.openai.com) for outages'
                ],
                clientError: [
                    'Check your request format and parameters',
                    'Verify the model name is a valid OpenAI model',
                    'Ensure the message format is correct (role and content fields)'
                ]
            };
            
        case MODEL_PROTOCOL_PREFIX.CLAUDE:
            return {
                auth: [
                    'Verify your Anthropic API key is valid',
                    'Check if your API key has expired or been revoked',
                    'Ensure the x-api-key header is correctly set'
                ],
                permission: [
                    'Check if your Anthropic account has access to the requested model',
                    'Verify your account is in good standing',
                    'Ensure you have sufficient credits in your account'
                ],
                rateLimit: [
                    'The request has been automatically retried with exponential backoff',
                    'If the issue persists, try reducing the request frequency',
                    'Consider upgrading your Anthropic usage tier for higher limits'
                ],
                serverError: [
                    'The request has been automatically retried',
                    'If the issue persists, try again in a few minutes',
                    'Check Anthropic status page for service outages'
                ],
                clientError: [
                    'Check your request format and parameters',
                    'Verify the model name is a valid Claude model',
                    'Ensure the message format follows Anthropic API specifications'
                ]
            };
            
        default:
            return defaultSuggestions;
    }
}

export function handleError(res, error, provider = null, fromProvider = null, req = null) {
    let statusCode;
    let errorCode;
    let errorMessage;
    let suggestions = [];
    
    if (error instanceof APIError) {
        statusCode = error.statusCode;
        errorCode = error.code;
        errorMessage = error.message;
    } else {
        statusCode = error.response?.status || error.statusCode || error.status || error.code || 500;
        errorCode = _mapStatusCodeToErrorCode(statusCode);
        errorMessage = error.message;
    }

    if (!fromProvider && req && req.url) {
        if (req.url.includes('/v1/messages')) fromProvider = MODEL_PROTOCOL_PREFIX.CLAUDE;
        else if (req.url.includes('/v1/chat/completions')) fromProvider = MODEL_PROTOCOL_PREFIX.OPENAI;
        else if (req.url.includes('/v1beta/models')) fromProvider = MODEL_PROTOCOL_PREFIX.GEMINI;
    }

    if (fromProvider) {
        const errorResponse = createErrorResponse(error, fromProvider);
        if (!res.headersSent) {
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify(errorResponse));
        _logError(error, statusCode, errorCode, req);
        return;
    }

    const hasOriginalMessage = errorMessage && errorMessage.trim() !== '';
    
    const providerSuggestions = _getProviderSpecificSuggestions(statusCode, provider);
    
    switch (statusCode) {
        case 401:
            errorMessage = hasOriginalMessage ? errorMessage : ERROR_MESSAGES[ERROR_CODES.AUTH_ERROR];
            suggestions = providerSuggestions.auth;
            break;
        case 403:
            errorMessage = hasOriginalMessage ? errorMessage : ERROR_MESSAGES[ERROR_CODES.PERMISSION_DENIED];
            suggestions = providerSuggestions.permission;
            break;
        case 429:
            errorMessage = hasOriginalMessage ? errorMessage : ERROR_MESSAGES[ERROR_CODES.RATE_LIMITED];
            suggestions = providerSuggestions.rateLimit;
            break;
        case 500:
        case 502:
        case 503:
        case 504:
            errorMessage = hasOriginalMessage ? errorMessage : ERROR_MESSAGES[ERROR_CODES.SERVER_ERROR];
            suggestions = providerSuggestions.serverError;
            break;
        default:
            if (statusCode >= 400 && statusCode < 500) {
                errorMessage = hasOriginalMessage ? errorMessage : `Client error (${statusCode}): ${error.message}`;
                suggestions = providerSuggestions.clientError;
            } else if (statusCode >= 500) {
                errorMessage = hasOriginalMessage ? errorMessage : `Server error (${statusCode}): ${error.message}`;
                suggestions = providerSuggestions.serverError;
            }
    }

    _logError(error, statusCode, errorCode, req, suggestions);

    if (res.writableEnded || res.destroyed) {
        logger.warn('[Server] Response already ended or destroyed, skipping error response');
        return;
    }

    if (!res.headersSent) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    }

    const errorPayload = {
        error: {
            code: errorCode,
            message: errorMessage,
            statusCode: statusCode,
            suggestions: suggestions.length > 0 ? suggestions : undefined,
            details: error.response?.data || error.details || undefined,
            timestamp: new Date().toISOString()
        }
    };
    
    try {
        res.end(JSON.stringify(errorPayload));
    } catch (writeError) {
        logger.error('[Server] Failed to write error response:', writeError.message);
    }
}

function _mapStatusCodeToErrorCode(statusCode) {
    switch (statusCode) {
        case 401: return ERROR_CODES.AUTH_ERROR;
        case 403: return ERROR_CODES.PERMISSION_DENIED;
        case 429: return ERROR_CODES.RATE_LIMITED;
        case 404: return ERROR_CODES.MODEL_NOT_FOUND;
        case 400: return ERROR_CODES.VALIDATION_ERROR;
        case 503: return ERROR_CODES.PROVIDER_UNAVAILABLE;
        case 504: return ERROR_CODES.TIMEOUT_ERROR;
        default: return ERROR_CODES.SERVER_ERROR;
    }
}

function _logError(error, statusCode, errorCode, req, suggestions = []) {
    const logContext = {
        statusCode,
        errorCode,
        requestId: error.errorId || undefined,
        path: req?.url,
        method: req?.method,
        timestamp: new Date().toISOString()
    };
    
    logger.error(`[Server] Request failed (${statusCode}): ${error.message}`, logContext);
    
    if (suggestions.length > 0) {
        logger.error('[Server] Suggestions:');
        suggestions.forEach((suggestion, index) => {
            logger.error(`  ${index + 1}. ${suggestion}`);
        });
    }
    
    if (error.stack) {
        logger.error('[Server] Error stack:', error.stack);
    }
    
    if (error.details) {
        logger.error('[Server] Error details:', error.details);
    }
}

export function createErrorResponse(error, providerType) {
    const protocol = getProtocolPrefix(providerType);
    const status = error.response?.status || error.statusCode || error.status || 500;
    const message = error.message || 'Unknown error';
    const code = error.code || _mapStatusCodeToErrorCode(status);
    
    if (protocol === MODEL_PROTOCOL_PREFIX.OPENAI) {
        return {
            error: {
                message: message,
                type: code.toLowerCase().replace('_', '.'),
                param: null,
                code: status
            }
        };
    } else if (protocol === MODEL_PROTOCOL_PREFIX.CLAUDE) {
        return {
            type: 'error',
            error: {
                type: code.toLowerCase().replace('_', '.'),
                message: message
            }
        };
    } else if (protocol === MODEL_PROTOCOL_PREFIX.GEMINI) {
        return {
            error: {
                code: status,
                message: message,
                status: code
            }
        };
    }
    
    return { 
        error: {
            code: code,
            message: message,
            statusCode: status
        }
    };
}

export function createStreamErrorResponse(error, providerType) {
    const protocol = getProtocolPrefix(providerType);
    const message = error.message || 'Unknown error';
    const escapedMessage = message.replace(/"/g, '\\"');
    
    if (protocol === MODEL_PROTOCOL_PREFIX.OPENAI) {
        return `data: {"error":{"message":"${escapedMessage}","type":"server_error"}}\n\n`;
    } else if (protocol === MODEL_PROTOCOL_PREFIX.CLAUDE) {
        return `event: error\ndata: {"type":"error","error":{"type":"server_error","message":"${escapedMessage}"}}\n\n`;
    } else if (protocol === MODEL_PROTOCOL_PREFIX.GEMINI) {
        return `data: {"error":{"message":"${escapedMessage}"}}\n\n`;
    }
    
    return `data: {"error":"${escapedMessage}"}\n\n`;
}

export function wrapError(error, context = {}) {
    if (error instanceof APIError) {
        error.details = { ...error.details, ...context };
        return error;
    }
    
    const statusCode = error.response?.status || error.statusCode || error.status || error.code || 500;
    const errorCode = _mapStatusCodeToErrorCode(statusCode);
    
    return new APIError(errorCode, error.message, { ...context, originalError: error.message }, statusCode);
}