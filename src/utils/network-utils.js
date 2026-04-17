export const RETRYABLE_NETWORK_ERRORS = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ENETUNREACH',
    'EHOSTUNREACH',
    'EPIPE',
    'EAI_AGAIN',
    'ECONNABORTED',
    'ESOCKETTIMEDOUT',
];

export const DEFAULT_MAX_REQUEST_SIZE_MB = 10;
export const DEFAULT_IMAGE_TIMEOUT_SECONDS = 60;

export function getMaxRequestSize(config) {
    const mb = config?.MAX_REQUEST_SIZE_MB || DEFAULT_MAX_REQUEST_SIZE_MB;
    return mb * 1024 * 1024;
}

export function getImageTimeoutSeconds(config) {
    return config?.IMAGE_TIMEOUT_SECONDS || DEFAULT_IMAGE_TIMEOUT_SECONDS;
}

export function isRetryableNetworkError(error) {
    if (!error) return false;
    
    const errorCode = error.code || '';
    const errorMessage = error.message || '';
    
    return RETRYABLE_NETWORK_ERRORS.some(errId =>
        errorCode === errId || errorMessage.includes(errId)
    );
}

export function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    let ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
    
    if (ip && ip.includes('::ffff:')) {
        ip = ip.replace('::ffff:', '');
    }
    
    return ip || 'unknown';
}

export function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let totalSize = 0;
        
        req.on('data', chunk => {
            totalSize += chunk.length;
            if (totalSize > MAX_REQUEST_SIZE) {
                req.destroy(new Error('Request size exceeds maximum allowed size'));
                reject(new Error('Request size exceeds maximum allowed size (10MB)'));
                return;
            }
            chunks.push(chunk);
        });
        
        req.on('end', () => {
            if (chunks.length === 0) {
                return resolve({});
            }
            
            const buffer = Buffer.concat(chunks);
            const contentType = req.headers['content-type'] || '';
            
            if (contentType.includes('application/json')) {
                try {
                    const bodyStr = buffer.toString('utf8');
                    resolve(bodyStr ? JSON.parse(bodyStr) : {});
                } catch (error) {
                    reject(new Error("Invalid JSON in request body."));
                }
            } else if (contentType.includes('multipart/form-data')) {
                resolve({ _rawBody: buffer, _contentType: contentType });
            } else {
                try {
                    const bodyStr = buffer.toString('utf8');
                    resolve(bodyStr ? JSON.parse(bodyStr) : {});
                } catch {
                    resolve({ _rawBody: buffer, _contentType: contentType });
                }
            }
        });
        
        req.on('error', err => {
            reject(err);
        });
    });
}

export function containsImageContent(body) {
    if (!body || !body.messages || !Array.isArray(body.messages)) {
        return false;
    }
    
    for (const message of body.messages) {
        if (!message.content) continue;
        
        if (Array.isArray(message.content)) {
            for (const part of message.content) {
                if (typeof part === 'object' && part.image_url) {
                    return true;
                }
            }
        }
    }
    return false;
}

export function countImageParts(body) {
    let count = 0;
    
    if (body && body.messages && Array.isArray(body.messages)) {
        for (const message of body.messages) {
            if (message.content && Array.isArray(message.content)) {
                for (const part of message.content) {
                    if (typeof part === 'object' && part.image_url) {
                        count++;
                    }
                }
            }
        }
    }
    
    return count;
}