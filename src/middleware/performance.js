import zlib from 'zlib';
import logger from '../utils/logger.js';

const COMPRESSION_TYPES = ['text/html', 'text/plain', 'text/css', 'application/javascript', 'application/json', 'text/javascript', 'application/xml', 'text/xml', 'application/svg+xml'];

const shouldCompress = (contentType) => {
    if (!contentType) return false;
    const lowerType = contentType.toLowerCase().split(';')[0];
    return COMPRESSION_TYPES.includes(lowerType);
};

export class CompressionMiddleware {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.threshold = options.threshold || 1024;
        this.level = options.level || zlib.constants.Z_DEFAULT_COMPRESSION;
    }

    async handle(req, res, next) {
        if (!this.enabled) {
            return next();
        }

        const acceptEncoding = req.headers['accept-encoding'] || '';
        const hasGzip = acceptEncoding.includes('gzip');
        const hasBrotli = acceptEncoding.includes('br');

        if (!hasGzip && !hasBrotli) {
            return next();
        }

        const originalWriteHead = res.writeHead.bind(res);
        const originalEnd = res.end.bind(res);
        const chunks = [];

        res.writeHead = function(statusCode, headers) {
            res.statusCode = statusCode;
            res._headers = { ...headers };
        };

        const self = this;
        res.end = function(data, encoding, callback) {
            if (!data || data.length === 0) {
                originalWriteHead(res.statusCode || 200, res._headers || {});
                return originalEnd.call(this, data, encoding, callback);
            }

            const contentType = res._headers?.['content-type'] || '';
            
            if (!shouldCompress(contentType) || Buffer.byteLength(data) < self.threshold) {
                originalWriteHead(res.statusCode || 200, res._headers || {});
                return originalEnd.call(this, data, encoding, callback);
            }

            const compressionMethod = hasBrotli ? 'brotli' : 'gzip';
            const compressor = compressionMethod === 'brotli' 
                ? zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: self.level } })
                : zlib.createGzip({ level: self.level });

            const bufferData = Buffer.isBuffer(data) ? data : Buffer.from(data, encoding);

            compressor.on('data', (chunk) => chunks.push(chunk));
            compressor.on('end', () => {
                const compressedData = Buffer.concat(chunks);
                const newHeaders = {
                    ...res._headers,
                    'Content-Encoding': compressionMethod,
                    'Content-Length': compressedData.length,
                    'Vary': 'Accept-Encoding'
                };
                originalWriteHead(res.statusCode || 200, newHeaders);
                originalEnd.call(this, compressedData, null, callback);
            });

            compressor.on('error', (err) => {
                logger.warn('[Compression] Error compressing response:', err.message);
                originalWriteHead(res.statusCode || 200, res._headers || {});
                originalEnd.call(this, data, encoding, callback);
            });

            compressor.end(bufferData);
        };

        return next();
    }
}

export class CacheControlMiddleware {
    constructor(options = {}) {
        this.rules = options.rules || [
            { path: /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/, maxAge: 86400 },
            { path: /\.(html)$/, noCache: true },
            { path: /^\/api\//, noCache: true }
        ];
    }

    handle(req, res, next) {
        const url = req.url || '';
        
        for (const rule of this.rules) {
            if (rule.path.test(url)) {
                if (rule.noCache) {
                    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                    res.setHeader('Pragma', 'no-cache');
                    res.setHeader('Expires', '0');
                } else if (rule.maxAge) {
                    res.setHeader('Cache-Control', `public, max-age=${rule.maxAge}`);
                }
                break;
            }
        }

        return next();
    }
}

export class PerformanceMetricsMiddleware {
    constructor() {
        this.requestCounts = new Map();
        this.totalRequests = 0;
        this.totalResponseTime = 0;
    }

    handle(req, res, next) {
        const startTime = Date.now();
        const url = req.url || '';
        
        this.totalRequests++;
        
        const originalEnd = res.end.bind(res);
        res.end = function(data, encoding, callback) {
            const responseTime = Date.now() - startTime;
            this.totalResponseTime += responseTime;
            
            const path = url.split('?')[0];
            const pathStats = this.requestCounts.get(path) || { count: 0, totalTime: 0, min: Infinity, max: 0 };
            pathStats.count++;
            pathStats.totalTime += responseTime;
            pathStats.min = Math.min(pathStats.min, responseTime);
            pathStats.max = Math.max(pathStats.max, responseTime);
            this.requestCounts.set(path, pathStats);
            
            res.setHeader('X-Response-Time', `${responseTime}ms`);
            res.setHeader('X-Request-Id', Math.random().toString(36).substring(2, 15));
            
            return originalEnd.call(this, data, encoding, callback);
        }.bind(this);

        return next();
    }

    getStats() {
        const avgResponseTime = this.totalRequests > 0 
            ? (this.totalResponseTime / this.totalRequests).toFixed(2) 
            : 0;
        
        const pathStats = {};
        this.requestCounts.forEach((stats, path) => {
            pathStats[path] = {
                count: stats.count,
                avgTime: (stats.totalTime / stats.count).toFixed(2),
                minTime: stats.min,
                maxTime: stats.max
            };
        });

        return {
            totalRequests: this.totalRequests,
            avgResponseTime,
            paths: pathStats
        };
    }
}

export const compressionMiddleware = new CompressionMiddleware({
    enabled: true,
    threshold: 1024,
    level: zlib.constants.Z_DEFAULT_COMPRESSION
});

export const cacheControlMiddleware = new CacheControlMiddleware();

export const performanceMetricsMiddleware = new PerformanceMetricsMiddleware();
