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
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            if (!body) {
                return resolve({});
            }
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(new Error("Invalid JSON in request body."));
            }
        });
        req.on('error', err => {
            reject(err);
        });
    });
}