import { describe, it, expect } from '@jest/globals';
import { 
    APIError, 
    AuthError, 
    PermissionError, 
    RateLimitError, 
    ValidationError, 
    ProviderError, 
    ConfigurationError, 
    NotFoundError, 
    ServiceUnavailableError, 
    handleError,
    wrapError,
    ERROR_CODES,
    ERROR_MESSAGES
} from '../src/utils/error-handler.js';

describe('Error Handler', () => {
    describe('ERROR_CODES', () => {
        it('should have all expected error codes', () => {
            expect(ERROR_CODES.AUTH_ERROR).toBe('AUTH_ERROR');
            expect(ERROR_CODES.PERMISSION_ERROR).toBe('PERMISSION_ERROR');
            expect(ERROR_CODES.RATE_LIMIT_ERROR).toBe('RATE_LIMIT_ERROR');
            expect(ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
            expect(ERROR_CODES.PROVIDER_ERROR).toBe('PROVIDER_ERROR');
            expect(ERROR_CODES.CONFIG_ERROR).toBe('CONFIG_ERROR');
            expect(ERROR_CODES.NOT_FOUND_ERROR).toBe('NOT_FOUND_ERROR');
            expect(ERROR_CODES.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE');
            expect(ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
        });
    });

    describe('APIError', () => {
        it('should create an APIError with default values', () => {
            const error = new APIError('TEST_ERROR', 'Test message');
            
            expect(error.name).toBe('APIError');
            expect(error.code).toBe('TEST_ERROR');
            expect(error.message).toBe('Test message');
            expect(error.details).toEqual({});
            expect(error.statusCode).toBe(500);
            expect(error.timestamp).toBeDefined();
            expect(error.errorId).toBeDefined();
        });

        it('should create an APIError with custom details and statusCode', () => {
            const details = { field: 'test' };
            const error = new APIError('VALIDATION_ERROR', 'Validation failed', details, 400);
            
            expect(error.details).toEqual(details);
            expect(error.statusCode).toBe(400);
        });

        it('should generate unique errorId', () => {
            const error1 = new APIError('TEST_ERROR', 'Test 1');
            const error2 = new APIError('TEST_ERROR', 'Test 2');
            
            expect(error1.errorId).not.toBe(error2.errorId);
        });
    });

    describe('AuthError', () => {
        it('should create an AuthError with default statusCode 401', () => {
            const error = new AuthError('Invalid token');
            
            expect(error.name).toBe('AuthError');
            expect(error.code).toBe('AUTH_ERROR');
            expect(error.statusCode).toBe(401);
        });
    });

    describe('PermissionError', () => {
        it('should create a PermissionError with default statusCode 403', () => {
            const error = new PermissionError('Insufficient permissions');
            
            expect(error.name).toBe('PermissionError');
            expect(error.code).toBe('PERMISSION_ERROR');
            expect(error.statusCode).toBe(403);
        });
    });

    describe('RateLimitError', () => {
        it('should create a RateLimitError with default statusCode 429', () => {
            const error = new RateLimitError('Too many requests');
            
            expect(error.name).toBe('RateLimitError');
            expect(error.code).toBe('RATE_LIMIT_ERROR');
            expect(error.statusCode).toBe(429);
        });
    });

    describe('ValidationError', () => {
        it('should create a ValidationError with default statusCode 400', () => {
            const error = new ValidationError('Invalid input');
            
            expect(error.name).toBe('ValidationError');
            expect(error.code).toBe('VALIDATION_ERROR');
            expect(error.statusCode).toBe(400);
        });
    });

    describe('ProviderError', () => {
        it('should create a ProviderError with default statusCode 503', () => {
            const error = new ProviderError('Provider unavailable');
            
            expect(error.name).toBe('ProviderError');
            expect(error.code).toBe('PROVIDER_ERROR');
            expect(error.statusCode).toBe(503);
        });
    });

    describe('ConfigurationError', () => {
        it('should create a ConfigurationError with default statusCode 500', () => {
            const error = new ConfigurationError('Invalid config');
            
            expect(error.name).toBe('ConfigurationError');
            expect(error.code).toBe('CONFIG_ERROR');
            expect(error.statusCode).toBe(500);
        });
    });

    describe('NotFoundError', () => {
        it('should create a NotFoundError with default statusCode 404', () => {
            const error = new NotFoundError('Resource not found');
            
            expect(error.name).toBe('NotFoundError');
            expect(error.code).toBe('NOT_FOUND_ERROR');
            expect(error.statusCode).toBe(404);
        });
    });

    describe('ServiceUnavailableError', () => {
        it('should create a ServiceUnavailableError with default statusCode 503', () => {
            const error = new ServiceUnavailableError('Service is down');
            
            expect(error.name).toBe('ServiceUnavailableError');
            expect(error.code).toBe('SERVICE_UNAVAILABLE');
            expect(error.statusCode).toBe(503);
        });
    });

    describe('wrapError', () => {
        it('should wrap a plain Error into APIError', () => {
            const originalError = new Error('Original error');
            const wrapped = wrapError(originalError);
            
            expect(wrapped).toBeInstanceOf(APIError);
            expect(wrapped.message).toBe('Original error');
            expect(wrapped.code).toBe('INTERNAL_ERROR');
        });

        it('should return APIError as-is', () => {
            const apiError = new AuthError('Auth failed');
            const wrapped = wrapError(apiError);
            
            expect(wrapped).toBe(apiError);
            expect(wrapped).toBeInstanceOf(AuthError);
        });
    });

    describe('handleError', () => {
        it('should set correct headers and status code', () => {
            const mockRes = {
                setHeader: jest.fn(),
                writeHead: jest.fn(),
                end: jest.fn()
            };
            
            const error = new AuthError('Unauthorized');
            handleError(mockRes, error, 'test-provider', 'test-request-id');
            
            expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
            expect(mockRes.writeHead).toHaveBeenCalledWith(401);
            
            const response = JSON.parse(mockRes.end.mock.calls[0][0]);
            expect(response.error.code).toBe('AUTH_ERROR');
            expect(response.error.message).toBe('Unauthorized');
            expect(response.error.errorId).toBeDefined();
        });
    });
});