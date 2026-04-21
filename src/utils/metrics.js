import logger from './logger.js';

export const METRIC_TYPES = {
    COUNTER: 'counter',
    GAUGE: 'gauge',
    HISTOGRAM: 'histogram',
    SUMMARY: 'summary'
};

class Metric {
    constructor(name, type, options = {}) {
        this.name = name;
        this.type = type;
        this.help = options.help || '';
        this.labels = options.labels || [];
        this.value = type === METRIC_TYPES.COUNTER ? 0 : (type === METRIC_TYPES.GAUGE ? 0 : []);
        this.timestamp = Date.now();
        this.resetTime = this.timestamp;
    }

    inc(value = 1) {
        if (this.type === METRIC_TYPES.COUNTER) {
            this.value += value;
        } else if (this.type === METRIC_TYPES.GAUGE) {
            this.value += value;
        }
        this.timestamp = Date.now();
    }

    dec(value = 1) {
        if (this.type === METRIC_TYPES.GAUGE) {
            this.value -= value;
        }
        this.timestamp = Date.now();
    }

    set(value) {
        if (this.type === METRIC_TYPES.GAUGE) {
            this.value = value;
        } else if (this.type === METRIC_TYPES.HISTOGRAM) {
            this.value.push({ value, timestamp: Date.now() });
            if (this.value.length > 1000) {
                this.value.shift();
            }
        } else if (this.type === METRIC_TYPES.SUMMARY) {
            this.value.push({ value, timestamp: Date.now() });
            if (this.value.length > 1000) {
                this.value.shift();
            }
        }
        this.timestamp = Date.now();
    }

    reset() {
        this.value = this.type === METRIC_TYPES.COUNTER ? 0 : (this.type === METRIC_TYPES.GAUGE ? 0 : []);
        this.resetTime = Date.now();
        this.timestamp = Date.now();
    }

    toJSON() {
        const base = {
            name: this.name,
            type: this.type,
            help: this.help,
            timestamp: new Date(this.timestamp).toISOString(),
            resetTime: new Date(this.resetTime).toISOString()
        };

        if (this.type === METRIC_TYPES.HISTOGRAM || this.type === METRIC_TYPES.SUMMARY) {
            base.count = this.value.length;
            base.values = this.value.slice(-100);
            if (this.value.length > 0) {
                const values = this.value.map(v => v.value);
                base.stats = {
                    min: Math.min(...values),
                    max: Math.max(...values),
                    avg: values.reduce((a, b) => a + b, 0) / values.length,
                    p50: this._calculatePercentile(values, 0.5),
                    p90: this._calculatePercentile(values, 0.9),
                    p99: this._calculatePercentile(values, 0.99)
                };
            }
        } else {
            base.value = this.value;
        }

        return base;
    }

    _calculatePercentile(values, percentile) {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.floor(sorted.length * percentile);
        return sorted[Math.min(index, sorted.length - 1)];
    }
}

export class MetricsManager {
    constructor() {
        this.metrics = new Map();
        this.labels = {};
        this.startTime = Date.now();
        this.gcInterval = null;
        this.enableGc = true;
        this.maxMetricAge = 3600000;
    }

    register(name, type, options = {}) {
        if (this.metrics.has(name)) {
            logger.warn(`[MetricsManager] Metric "${name}" already registered`);
            return this.metrics.get(name);
        }

        const metric = new Metric(name, type, options);
        this.metrics.set(name, metric);
        logger.info(`[MetricsManager] Registered metric: ${name} (${type})`);
        return metric;
    }

    get(name) {
        return this.metrics.get(name);
    }

    inc(name, value = 1) {
        const metric = this.metrics.get(name);
        if (metric) {
            metric.inc(value);
        } else {
            logger.warn(`[MetricsManager] Metric "${name}" not found, creating counter`);
            const newMetric = this.register(name, METRIC_TYPES.COUNTER);
            newMetric.inc(value);
        }
    }

    dec(name, value = 1) {
        const metric = this.metrics.get(name);
        if (metric) {
            metric.dec(value);
        } else {
            logger.warn(`[MetricsManager] Metric "${name}" not found, creating gauge`);
            const newMetric = this.register(name, METRIC_TYPES.GAUGE);
            newMetric.dec(value);
        }
    }

    set(name, value) {
        const metric = this.metrics.get(name);
        if (metric) {
            metric.set(value);
        } else {
            logger.warn(`[MetricsManager] Metric "${name}" not found, creating gauge`);
            const newMetric = this.register(name, METRIC_TYPES.GAUGE);
            newMetric.set(value);
        }
    }

    observe(name, value) {
        const metric = this.metrics.get(name);
        if (metric) {
            if (metric.type === METRIC_TYPES.HISTOGRAM || metric.type === METRIC_TYPES.SUMMARY) {
                metric.set(value);
            } else {
                logger.warn(`[MetricsManager] Metric "${name}" is not a histogram or summary`);
            }
        } else {
            logger.warn(`[MetricsManager] Metric "${name}" not found, creating histogram`);
            const newMetric = this.register(name, METRIC_TYPES.HISTOGRAM);
            newMetric.set(value);
        }
    }

    reset(name) {
        const metric = this.metrics.get(name);
        if (metric) {
            metric.reset();
        }
    }

    resetAll() {
        this.metrics.forEach(metric => metric.reset());
        logger.info('[MetricsManager] All metrics reset');
    }

    setLabels(labels) {
        this.labels = { ...this.labels, ...labels };
    }

    getLabels() {
        return { ...this.labels };
    }

    startGc() {
        if (this.gcInterval) return;
        
        this.gcInterval = setInterval(() => {
            const now = Date.now();
            let cleaned = 0;
            
            this.metrics.forEach((metric, name) => {
                if (now - metric.timestamp > this.maxMetricAge && 
                    (metric.type === METRIC_TYPES.HISTOGRAM || metric.type === METRIC_TYPES.SUMMARY)) {
                    this.metrics.delete(name);
                    cleaned++;
                }
            });
            
            if (cleaned > 0) {
                logger.debug(`[MetricsManager] Cleaned ${cleaned} stale metrics`);
            }
        }, 60000);
        
        logger.info('[MetricsManager] GC started');
    }

    stopGc() {
        if (this.gcInterval) {
            clearInterval(this.gcInterval);
            this.gcInterval = null;
            logger.info('[MetricsManager] GC stopped');
        }
    }

    getMetrics(prefix = '') {
        const result = {};
        
        this.metrics.forEach((metric, name) => {
            if (prefix && !name.startsWith(prefix)) return;
            result[name] = metric.toJSON();
        });
        
        return result;
    }

    getMetricsByType(type) {
        const result = {};
        
        this.metrics.forEach((metric, name) => {
            if (metric.type === type) {
                result[name] = metric.toJSON();
            }
        });
        
        return result;
    }

    getSummary() {
        const counters = {};
        const gauges = {};
        const histograms = {};
        
        this.metrics.forEach((metric, name) => {
            const data = metric.toJSON();
            if (metric.type === METRIC_TYPES.COUNTER) {
                counters[name] = data.value;
            } else if (metric.type === METRIC_TYPES.GAUGE) {
                gauges[name] = data.value;
            } else if (metric.type === METRIC_TYPES.HISTOGRAM) {
                histograms[name] = {
                    count: data.count,
                    stats: data.stats
                };
            }
        });
        
        return {
            startTime: new Date(this.startTime).toISOString(),
            uptime: Date.now() - this.startTime,
            counters,
            gauges,
            histograms
        };
    }

    exportPrometheusFormat() {
        const lines = [];
        
        this.metrics.forEach((metric, name) => {
            const data = metric.toJSON();
            
            if (metric.type === METRIC_TYPES.COUNTER) {
                lines.push(`# HELP ${name} ${data.help || 'No description'}`);
                lines.push(`# TYPE ${name} counter`);
                lines.push(`${name} ${data.value}`);
            } else if (metric.type === METRIC_TYPES.GAUGE) {
                lines.push(`# HELP ${name} ${data.help || 'No description'}`);
                lines.push(`# TYPE ${name} gauge`);
                lines.push(`${name} ${data.value}`);
            } else if (metric.type === METRIC_TYPES.HISTOGRAM && data.stats) {
                lines.push(`# HELP ${name} ${data.help || 'No description'}`);
                lines.push(`# TYPE ${name} histogram`);
                lines.push(`${name}_count ${data.count}`);
                lines.push(`${name}_sum ${data.stats ? data.stats.avg * data.count : 0}`);
                if (data.stats) {
                    lines.push(`${name}_bucket{le="0.1"} ${data.count}`);
                    lines.push(`${name}_bucket{le="1"} ${data.count}`);
                    lines.push(`${name}_bucket{le="10"} ${data.count}`);
                    lines.push(`${name}_bucket{le="+Inf"} ${data.count}`);
                }
            }
        });
        
        return lines.join('\n') + '\n';
    }

    destroy() {
        this.stopGc();
        this.metrics.clear();
        logger.info('[MetricsManager] Destroyed');
    }
}

let metricsManagerInstance = null;

export function getMetricsManager() {
    if (!metricsManagerInstance) {
        metricsManagerInstance = new MetricsManager();
    }
    return metricsManagerInstance;
}

export function initializeMetricsManager() {
    metricsManagerInstance = new MetricsManager();
    return metricsManagerInstance;
}

export function initDefaultMetrics() {
    const mm = getMetricsManager();
    
    mm.register('requests_total', METRIC_TYPES.COUNTER, { help: 'Total number of requests' });
    mm.register('requests_success', METRIC_TYPES.COUNTER, { help: 'Number of successful requests' });
    mm.register('requests_error', METRIC_TYPES.COUNTER, { help: 'Number of failed requests' });
    mm.register('requests_duration_ms', METRIC_TYPES.HISTOGRAM, { help: 'Request duration in milliseconds' });
    
    mm.register('providers_healthy', METRIC_TYPES.GAUGE, { help: 'Number of healthy providers' });
    mm.register('providers_unhealthy', METRIC_TYPES.GAUGE, { help: 'Number of unhealthy providers' });
    mm.register('providers_total', METRIC_TYPES.GAUGE, { help: 'Total number of providers' });
    
    mm.register('tokens_refreshed', METRIC_TYPES.COUNTER, { help: 'Number of token refreshes' });
    mm.register('tokens_refresh_failures', METRIC_TYPES.COUNTER, { help: 'Number of token refresh failures' });
    
    mm.register('cache_hits', METRIC_TYPES.COUNTER, { help: 'Number of cache hits' });
    mm.register('cache_misses', METRIC_TYPES.COUNTER, { help: 'Number of cache misses' });
    
    mm.register('active_connections', METRIC_TYPES.GAUGE, { help: 'Number of active connections' });
    mm.register('sse_clients', METRIC_TYPES.GAUGE, { help: 'Number of connected SSE clients' });
    
    mm.startGc();
    
    logger.info('[MetricsManager] Default metrics initialized');
}

export function recordRequest(durationMs, success = true) {
    const mm = getMetricsManager();
    mm.inc('requests_total');
    if (success) {
        mm.inc('requests_success');
    } else {
        mm.inc('requests_error');
    }
    mm.observe('requests_duration_ms', durationMs);
}

export function recordProviderStatus(providerType, healthy, count = 1) {
    const mm = getMetricsManager();
    if (healthy) {
        mm.inc('providers_healthy', count);
        mm.dec('providers_unhealthy', count);
    } else {
        mm.inc('providers_unhealthy', count);
        mm.dec('providers_healthy', count);
    }
}

export function recordTokenRefresh(success = true) {
    const mm = getMetricsManager();
    if (success) {
        mm.inc('tokens_refreshed');
    } else {
        mm.inc('tokens_refresh_failures');
    }
}

export function recordCacheHit() {
    const mm = getMetricsManager();
    mm.inc('cache_hits');
}

export function recordCacheMiss() {
    const mm = getMetricsManager();
    mm.inc('cache_misses');
}