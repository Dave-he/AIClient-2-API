import { AsyncLocalStorage } from 'async_hooks';
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { appendFile } from 'fs/promises';
import { createHash } from 'crypto';
import { hostname } from 'os';

const isBrowser = typeof window !== 'undefined';

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4
};

const LOG_COLORS = isBrowser ? {
  DEBUG: '#3498db',
  INFO: '#2ecc71',
  WARN: '#f39c12',
  ERROR: '#e74c3c',
  RESET: '#333333'
} : {
  DEBUG: '\x1b[34m',
  INFO: '\x1b[32m',
  WARN: '\x1b[33m',
  ERROR: '\x1b[31m',
  RESET: '\x1b[0m'
};

const requestContextStorage = isBrowser ? null : new AsyncLocalStorage();

export const TRACE_SPAN_TYPES = {
  REQUEST: 'request',
  DATABASE: 'database',
  EXTERNAL_API: 'external_api',
  PROCESSING: 'processing',
  CACHE: 'cache'
};

class TraceSpan {
  constructor(name, type) {
    this.name = name;
    this.type = type;
    this.startTime = Date.now();
    this.endTime = null;
    this.duration = null;
    this.metadata = {};
    this.children = [];
    this.parentId = null;
  }

  setMetadata(key, value) {
    this.metadata[key] = value;
  }

  addChild(span) {
    span.parentId = this.name;
    this.children.push(span);
  }

  end() {
    this.endTime = Date.now();
    this.duration = this.endTime - this.startTime;
    return this.duration;
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      startTime: new Date(this.startTime).toISOString(),
      endTime: this.endTime ? new Date(this.endTime).toISOString() : null,
      duration: this.duration,
      metadata: this.metadata,
      children: this.children.map(c => c.toJSON())
    };
  }
}

class Logger {
  constructor() {
    this.level = LOG_LEVELS.INFO;
    this.prefix = '[AIClient]';
    this.enableConsole = true;
    this.logBuffer = [];
    this.maxBufferSize = 100;
    this.enabled = true;

    this.logDir = 'logs';
    this.maxFileSize = 10485760;
    this.maxFiles = 10;
    this.outputMode = 'all';
    this.includeRequestId = true;
    this.includeTimestamp = true;
    this.currentLogFile = null;
    this.currentLogSize = 0;
    
    this._writeStream = null;
    this._writeQueue = [];
    this._isFlushing = false;
    this._logDirEnsured = false;

    this.samplingRate = 1.0;
    this.sampledRequestIds = new Set();
    this.maxSampledRequests = 100;

    this.performanceSpans = new Map();
    this.requestTimings = [];
    this.maxRequestTimings = 100;
  }

  initialize(options = {}) {
    const {
      enabled = true,
      outputMode = 'all',
      logLevel = 'info',
      logDir = 'logs',
      includeRequestId = true,
      includeTimestamp = true,
      maxFileSize = 10485760,
      maxFiles = 10,
      samplingRate = 1.0,
      maxSampledRequests = 100,
      maxRequestTimings = 100
    } = options;

    this.enabled = enabled;
    this.outputMode = outputMode;
    this.logDir = logDir;
    this.maxFileSize = maxFileSize;
    this.maxFiles = maxFiles;
    this.includeRequestId = includeRequestId;
    this.includeTimestamp = includeTimestamp;
    this.samplingRate = samplingRate;
    this.maxSampledRequests = maxSampledRequests;
    this.maxRequestTimings = maxRequestTimings;

    const levelValue = LOG_LEVELS[logLevel.toUpperCase()] ?? LOG_LEVELS.INFO;
    this.setLevel(levelValue);
  }

  setLevel(level) {
    if (Object.values(LOG_LEVELS).includes(level)) {
      this.level = level;
    }
  }

  setPrefix(prefix) {
    this.prefix = prefix;
  }

  shouldLog(level) {
    return this.enabled && level >= this.level;
  }

  _shouldSample(requestId) {
    if (this.samplingRate >= 1.0) return true;
    if (this.samplingRate <= 0) return false;
    
    if (this.sampledRequestIds.has(requestId)) return true;
    
    if (Math.random() < this.samplingRate) {
      if (this.sampledRequestIds.size >= this.maxSampledRequests) {
        const oldest = Array.from(this.sampledRequestIds)[0];
        this.sampledRequestIds.delete(oldest);
      }
      this.sampledRequestIds.add(requestId);
      return true;
    }
    
    return false;
  }

  getLogFilePath() {
    if (isBrowser) {
      return null;
    }
    const now = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    return `${this.logDir}/aiclient-${dateStr}.log`;
  }

  getStructuredLogFilePath() {
    if (isBrowser) {
      return null;
    }
    const now = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    return `${this.logDir}/aiclient-${dateStr}-structured.log`;
  }

  ensureLogDirSync() {
    if (isBrowser || this._logDirEnsured) {
      return;
    }
    try {
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true });
      }
      this._logDirEnsured = true;
    } catch (error) {
      console.error('Failed to create log directory:', error.message);
    }
  }

  _rotateStreamIfNeeded() {
    const logFile = this.getLogFilePath();
    if (!logFile) {
      return false;
    }
    if (this.currentLogFile && logFile !== this.currentLogFile) {
      this._closeStream();
      return true;
    }
    if (this.currentLogFile && this.currentLogSize >= this.maxFileSize) {
      this._closeStream();
      this._cleanupOldLogsSync();
      return true;
    }
    return false;
  }

  _closeStream() {
    if (this._writeStream) {
      this._writeStream.end();
      this._writeStream = null;
    }
    this.currentLogFile = null;
    this.currentLogSize = 0;
  }

  _enqueueLog(message, structuredMessage = null) {
    this._writeQueue.push({ message, structuredMessage });
    if (!this._isFlushing) {
      this._flushQueue();
    }
  }

  async _flushQueue() {
    if (this._isFlushing || this._writeQueue.length === 0) {
      return;
    }
    this._isFlushing = true;

    try {
      this.ensureLogDirSync();
      this._rotateStreamIfNeeded();

      const logFile = this.getLogFilePath();
      const structuredLogFile = this.getStructuredLogFilePath();
      
      if (!logFile) {
        this._writeQueue = [];
        this._isFlushing = false;
        return;
      }

      if (!this._writeStream) {
        this._writeStream = createWriteStream(logFile, { flags: 'a' });
        this._writeStream.on('error', (err) => {
          console.error('Log stream error:', err.message);
          this._writeStream = null;
        });
        this.currentLogFile = logFile;
        if (existsSync(logFile)) {
          this.currentLogSize = statSync(logFile).size;
        }
      }

      const batch = this._writeQueue.splice(0, 50);
      let textContent = '';
      let structuredContent = '';
      
      for (const item of batch) {
        textContent += item.message + '\n';
        if (item.structuredMessage) {
          structuredContent += JSON.stringify(item.structuredMessage) + '\n';
        }
      }
      
      this._writeStream.write(textContent);
      this.currentLogSize += Buffer.byteLength(textContent, 'utf8');

      if (structuredContent && structuredLogFile) {
        try {
          await appendFile(structuredLogFile, structuredContent);
        } catch (e) {
          console.error('Failed to write structured log:', e.message);
        }
      }
    } catch (error) {
      console.error('Failed to flush log queue:', error.message);
    } finally {
      this._isFlushing = false;
      if (this._writeQueue.length > 0) {
        this._flushQueue();
      }
    }
  }

  getCurrentRequestId() {
    if (isBrowser) {
      return null;
    }
    const store = requestContextStorage.getStore();
    return store ? store.requestId : null;
  }

  getCurrentTraceId() {
    if (isBrowser) {
      return null;
    }
    const store = requestContextStorage.getStore();
    return store ? store.traceId : null;
  }

  formatMessage(level, message, ...args) {
    const requestId = this.getCurrentRequestId();
    const traceId = this.getCurrentTraceId();
    const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level);
    const color = LOG_COLORS[levelName] || LOG_COLORS.RESET;

    const structuredMessage = {
      timestamp: new Date().toISOString(),
      level: levelName.toLowerCase(),
      message,
      requestId,
      traceId,
      service: 'AIClient-2-API',
      host: isBrowser ? 'browser' : hostname()
    };

    if (args.length > 0) {
      try {
        const extraInfo = [];
        const metadata = {};
        for (const arg of args) {
          if (arg instanceof Error) {
            metadata.error = {
              message: arg.message,
              stack: arg.stack
            };
            extraInfo.push(arg.message);
          } else if (typeof arg === 'object') {
            Object.assign(metadata, arg);
            extraInfo.push(JSON.stringify(arg));
          } else {
            extraInfo.push(String(arg));
          }
        }
        if (Object.keys(metadata).length > 0) {
          structuredMessage.metadata = metadata;
        }
        structuredMessage.extra = extraInfo.join(' ');
      } catch (e) {
        structuredMessage.extra = '[Arguments serialization error]';
      }
    }

    const parts = [];
    if (this.includeTimestamp) {
      parts.push(structuredMessage.timestamp);
    }
    parts.push(this.prefix);
    
    if (!isBrowser) {
      parts.push(`${color}[${levelName}]${LOG_COLORS.RESET}`);
    } else {
      parts.push(`[${levelName}]`);
    }
    
    parts.push(message);
    
    if (this.includeRequestId && requestId) {
      parts.push(`[req:${requestId}]`);
    }
    
    if (traceId) {
      parts.push(`[trace:${traceId}]`);
    }
    
    if (args.length > 0) {
      try {
        const extraInfo = args.map(arg => {
          if (typeof arg === 'object') {
            return JSON.stringify(arg, null, 2);
          }
          return String(arg);
        }).join(' ');
        parts.push(extraInfo);
      } catch (e) {
        parts.push('[Arguments serialization error]');
      }
    }

    return {
      console: parts.join(' '),
      file: parts.join(' '),
      color,
      levelName,
      structured: structuredMessage
    };
  }

  _log(level, message, ...args) {
    if (!this.shouldLog(level)) return;

    const requestId = this.getCurrentRequestId();
    if (!this._shouldSample(requestId)) {
      if (level >= LOG_LEVELS.WARN) {
      } else {
        return;
      }
    }

    const { console: consoleMsg, file: fileMsg, color, levelName, structured } = this.formatMessage(level, message, ...args);

    this.logBuffer.push({
      timestamp: new Date().toISOString(),
      level: levelName,
      message: consoleMsg,
      requestId,
      structured
    });

    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    if (this.enableConsole) {
      if (isBrowser) {
        const logMethod = level === LOG_LEVELS.DEBUG ? 'debug' :
                          level === LOG_LEVELS.INFO ? 'info' :
                          level === LOG_LEVELS.WARN ? 'warn' : 'error';
        console[logMethod](`%c${consoleMsg}`, `color: ${color}`);
      } else {
        const logMethod = level === LOG_LEVELS.DEBUG ? 'debug' :
                          level === LOG_LEVELS.INFO ? 'info' :
                          level === LOG_LEVELS.WARN ? 'warn' : 'error';
        console[logMethod](consoleMsg);
      }
    }

    if (this.outputMode !== 'console' && this.outputMode !== 'browser') {
      this._enqueueLog(fileMsg, structured);
    }
  }

  debug(message, ...args) {
    this._log(LOG_LEVELS.DEBUG, message, ...args);
  }

  info(message, ...args) {
    this._log(LOG_LEVELS.INFO, message, ...args);
  }

  warn(message, ...args) {
    this._log(LOG_LEVELS.WARN, message, ...args);
  }

  error(message, ...args) {
    let fullMessage = message;
    const extraArgs = [...args];
    if (args[0] instanceof Error) {
      fullMessage += ` - ${args[0].message}`;
      if (args[0].stack) {
        extraArgs.push({ stack: args[0].stack });
      }
    }
    this._log(LOG_LEVELS.ERROR, fullMessage, ...extraArgs);
  }

  startSpan(name, type = TRACE_SPAN_TYPES.PROCESSING) {
    const span = new TraceSpan(name, type);
    const requestId = this.getCurrentRequestId();
    if (requestId) {
      span.setMetadata('requestId', requestId);
    }
    
    const activeSpans = this.performanceSpans.get(requestId) || [];
    if (activeSpans.length > 0) {
      const parent = activeSpans[activeSpans.length - 1];
      parent.addChild(span);
    }
    activeSpans.push(span);
    this.performanceSpans.set(requestId, activeSpans);
    
    return span;
  }

  endSpan(span, requestId = null) {
    const duration = span.end();
    const reqId = requestId || this.getCurrentRequestId();
    
    const timing = {
      requestId: reqId,
      spanName: span.name,
      type: span.type,
      duration,
      timestamp: new Date().toISOString(),
      metadata: span.metadata
    };
    
    this.requestTimings.unshift(timing);
    if (this.requestTimings.length > this.maxRequestTimings) {
      this.requestTimings.pop();
    }

    if (duration > 1000) {
      this.warn(`Slow operation detected: ${span.name} took ${duration}ms`, { duration, type: span.type });
    }

    if (reqId) {
      const activeSpans = this.performanceSpans.get(reqId) || [];
      const index = activeSpans.indexOf(span);
      if (index !== -1) {
        activeSpans.splice(index, 1);
        this.performanceSpans.set(reqId, activeSpans);
      }
    }

    return duration;
  }

  logRequestTiming(requestId, path, method, duration, statusCode, error = null) {
    const timing = {
      requestId,
      path,
      method,
      duration,
      statusCode,
      error: error ? error.message : null,
      timestamp: new Date().toISOString()
    };
    
    this.requestTimings.unshift(timing);
    if (this.requestTimings.length > this.maxRequestTimings) {
      this.requestTimings.pop();
    }

    if (duration > 5000) {
      this.warn(`Slow request detected: ${method} ${path} took ${duration}ms`, timing);
    }
  }

  generateRequestId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${timestamp}${random}`;
  }

  generateTraceId() {
    const hash = createHash('sha256');
    hash.update(`${Date.now()}-${Math.random()}-${process.pid}`);
    return hash.digest('hex').substr(0, 32);
  }

  runWithContext(requestId, fn, traceId = null) {
    if (isBrowser) {
      return fn();
    }
    const effectiveTraceId = traceId || this.generateTraceId();
    return requestContextStorage.run({ requestId, traceId: effectiveTraceId }, fn);
  }

  runWithNewContext(fn) {
    if (isBrowser) {
      return fn();
    }
    const requestId = this.generateRequestId();
    const traceId = this.generateTraceId();
    return requestContextStorage.run({ requestId, traceId }, fn);
  }

  addToBuffer(message) {
    this.logBuffer.push({
      timestamp: new Date().toISOString(),
      level: 'LOG',
      message
    });
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  getBuffer() {
    return [...this.logBuffer];
  }

  clearBuffer() {
    this.logBuffer = [];
  }

  enableConsoleLogging(enabled) {
    this.enableConsole = enabled;
  }

  getRequestId() {
    return this.getCurrentRequestId();
  }

  getTraceId() {
    return this.getCurrentTraceId();
  }

  clearRequestContext(requestId = null) {
    if (isBrowser) {
      return;
    }
    const store = requestContextStorage.getStore();
    if (store) {
      if (!requestId || store.requestId === requestId) {
        store.requestId = null;
      }
    }
    this.performanceSpans.delete(requestId);
  }

  async flush() {
    await this._flushQueue();
  }

  _cleanupOldLogsSync() {
    if (isBrowser) {
      return;
    }
    try {
      if (!existsSync(this.logDir)) {
        return;
      }
      const files = readdirSync(this.logDir).filter(f => f.endsWith('.log'));
      if (files.length <= this.maxFiles * 2) {
        return;
      }
      const fileStats = files.map(f => ({
        name: f,
        mtime: statSync(`${this.logDir}/${f}`).mtime.getTime()
      }));
      fileStats.sort((a, b) => a.mtime - b.mtime);
      const toDelete = fileStats.slice(0, fileStats.length - this.maxFiles * 2);
      for (const file of toDelete) {
        unlinkSync(`${this.logDir}/${file.name}`);
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error.message);
    }
  }

  async clearTodayLog() {
    if (isBrowser) {
      return false;
    }
    
    try {
      const logFile = this.getLogFilePath();
      const structuredLogFile = this.getStructuredLogFilePath();
      
      if (!logFile) {
        return false;
      }
      
      // 关闭当前写入流
      if (this._writeStream) {
        this._writeStream.end();
        this._writeStream = null;
      }
      
      // 清空日志文件内容
      if (existsSync(logFile)) {
        writeFileSync(logFile, '');
      }
      if (structuredLogFile && existsSync(structuredLogFile)) {
        writeFileSync(structuredLogFile, '');
      }
      
      // 重置日志大小
      this.currentLogSize = 0;
      
      // 重新创建写入流，确保后续日志能正常写入
      this._writeStream = createWriteStream(logFile, { flags: 'a' });
      this._writeStream.on('error', (err) => {
        console.error('Log stream error:', err.message);
        this._writeStream = null;
      });
      this.currentLogFile = logFile;
      
      return true;
    } catch (error) {
      console.error('Failed to clear today log:', error.message);
      return false;
    }
  }

  async clearAllLogs() {
    if (isBrowser) {
      return { success: false, error: 'Not available in browser' };
    }
    
    try {
      this.ensureLogDirSync();
      
      if (!existsSync(this.logDir)) {
        return { success: true, message: 'Log directory does not exist', clearedCount: 0 };
      }
      
      const currentLogFile = this.getLogFilePath();
      const currentStructuredLogFile = this.getStructuredLogFilePath();
      
      // 关闭当前写入流
      if (this._writeStream) {
        this._writeStream.end();
        this._writeStream = null;
      }
      
      const files = readdirSync(this.logDir).filter(f => f.endsWith('.log'));
      let clearedCount = 0;
      const errors = [];
      
      for (const file of files) {
        const filePath = `${this.logDir}/${file}`;
        try {
          // 如果是当前日志文件，清空内容而不是删除
          if (filePath === currentLogFile || filePath === currentStructuredLogFile) {
            writeFileSync(filePath, '');
          } else {
            unlinkSync(filePath);
          }
          clearedCount++;
        } catch (err) {
          errors.push({ file, error: err.message });
        }
      }
      
      // 重置日志大小
      this.currentLogSize = 0;
      
      // 重新创建写入流，确保后续日志能正常写入
      if (currentLogFile) {
        this._writeStream = createWriteStream(currentLogFile, { flags: 'a' });
        this._writeStream.on('error', (err) => {
          console.error('Log stream error:', err.message);
          this._writeStream = null;
        });
        this.currentLogFile = currentLogFile;
      }
      
      return {
        success: true,
        message: `Cleared ${clearedCount} log files`,
        clearedCount,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error('Failed to clear all logs:', error.message);
      return { success: false, error: error.message };
    }
  }

  async cleanupOldLogs() {
    if (isBrowser) {
      return;
    }
    this._cleanupOldLogsSync();
  }

  getPerformanceStats() {
    const timings = [...this.requestTimings];
    
    if (timings.length === 0) {
      return {
        count: 0,
        avgDuration: 0,
        p50: 0,
        p90: 0,
        p99: 0,
        min: 0,
        max: 0
      };
    }

    const durations = timings.map(t => t.duration).sort((a, b) => a - b);
    const count = durations.length;
    const sum = durations.reduce((a, b) => a + b, 0);
    
    return {
      count,
      avgDuration: Math.round(sum / count),
      p50: durations[Math.floor(count * 0.5)] || 0,
      p90: durations[Math.floor(count * 0.9)] || 0,
      p99: durations[Math.floor(count * 0.99)] || 0,
      min: durations[0] || 0,
      max: durations[count - 1] || 0
    };
  }

  getStatus() {
    return {
      enabled: this.enabled,
      logLevel: Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === this.level),
      outputMode: this.outputMode,
      bufferSize: this.logBuffer.length,
      maxBufferSize: this.maxBufferSize,
      samplingRate: this.samplingRate,
      sampledRequests: this.sampledRequestIds.size,
      performanceStats: this.getPerformanceStats()
    };
  }
}

const logger = new Logger();

function setLogLevel(level) {
  logger.setLevel(level);
}

function getLogLevel() {
  return logger.level;
}

export { logger, setLogLevel, getLogLevel, LOG_LEVELS };
export default logger;