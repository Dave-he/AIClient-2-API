class PerformanceMonitor {
  constructor() {
    this.metrics = {
      apiCalls: 0,
      apiErrors: 0,
      apiLatency: [],
      pageLoadTime: 0,
      componentRenderTimes: {},
      memoryUsage: []
    };
    this.startTimes = new Map();
    this.enabled = true;
  }

  startTimer(key) {
    if (!this.enabled) return;
    this.startTimes.set(key, performance.now());
  }

  endTimer(key) {
    if (!this.enabled) return null;
    const startTime = this.startTimes.get(key);
    if (!startTime) return null;
    
    const duration = performance.now() - startTime;
    this.startTimes.delete(key);
    
    if (!this.metrics.componentRenderTimes[key]) {
      this.metrics.componentRenderTimes[key] = [];
    }
    this.metrics.componentRenderTimes[key].push(duration);
    
    return duration;
  }

  recordApiCall(duration, success = true) {
    if (!this.enabled) return;
    
    this.metrics.apiCalls++;
    if (!success) {
      this.metrics.apiErrors++;
    }
    this.metrics.apiLatency.push(duration);
    
    if (this.metrics.apiLatency.length > 100) {
      this.metrics.apiLatency.shift();
    }
  }

  recordPageLoadTime() {
    if (!this.enabled) return;
    
    const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
    this.metrics.pageLoadTime = loadTime;
  }

  recordMemoryUsage() {
    if (!this.enabled) return;
    
    if (window.performance && window.performance.memory) {
      this.metrics.memoryUsage.push({
        timestamp: Date.now(),
        used: window.performance.memory.usedJSHeapSize,
        total: window.performance.memory.totalJSHeapSize,
        limit: window.performance.memory.jsHeapSizeLimit
      });
      
      if (this.metrics.memoryUsage.length > 50) {
        this.metrics.memoryUsage.shift();
      }
    }
  }

  getStats() {
    const latencyData = this.metrics.apiLatency;
    const avgLatency = latencyData.length > 0 
      ? latencyData.reduce((a, b) => a + b, 0) / latencyData.length 
      : 0;
    const maxLatency = latencyData.length > 0 ? Math.max(...latencyData) : 0;
    const minLatency = latencyData.length > 0 ? Math.min(...latencyData) : 0;
    
    const errorRate = this.metrics.apiCalls > 0 
      ? (this.metrics.apiErrors / this.metrics.apiCalls) * 100 
      : 0;

    const componentStats = {};
    for (const [name, times] of Object.entries(this.metrics.componentRenderTimes)) {
      if (times.length > 0) {
        componentStats[name] = {
          count: times.length,
          avg: times.reduce((a, b) => a + b, 0) / times.length,
          max: Math.max(...times),
          min: Math.min(...times)
        };
      }
    }

    return {
      api: {
        totalCalls: this.metrics.apiCalls,
        errors: this.metrics.apiErrors,
        errorRate: errorRate.toFixed(2),
        avgLatency: avgLatency.toFixed(2),
        maxLatency: maxLatency.toFixed(2),
        minLatency: minLatency.toFixed(2)
      },
      pageLoad: {
        time: this.metrics.pageLoadTime
      },
      components: componentStats,
      memory: this.metrics.memoryUsage.length > 0 
        ? this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1] 
        : null
    };
  }

  reset() {
    this.metrics = {
      apiCalls: 0,
      apiErrors: 0,
      apiLatency: [],
      pageLoadTime: 0,
      componentRenderTimes: {},
      memoryUsage: []
    };
    this.startTimes.clear();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }
}

export const performanceMonitor = new PerformanceMonitor();

export const measurePerformance = (fn, key) => {
  performanceMonitor.startTimer(key);
  const result = fn();
  performanceMonitor.endTimer(key);
  return result;
};

export const measureAsyncPerformance = async (fn, key) => {
  performanceMonitor.startTimer(key);
  try {
    const result = await fn();
    return result;
  } finally {
    performanceMonitor.endTimer(key);
  }
};

export default performanceMonitor;