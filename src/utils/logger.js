import { AsyncLocalStorage } from 'async_hooks';
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs';

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
      maxFiles = 10
    } = options;

    this.enabled = enabled;
    this.outputMode = outputMode;
    this.logDir = logDir;
    this.maxFileSize = maxFileSize;
    this.maxFiles = maxFiles;
    this.includeRequestId = includeRequestId;
    this.includeTimestamp = includeTimestamp;

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

  getLogFilePath() {
    if (isBrowser) {
      return null;
    }
    const now = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    return `${this.logDir}/aiclient-${dateStr}.log`;
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

  _enqueueLog(message) {
    this._writeQueue.push(message);
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
      const content = batch.join('\n') + '\n';
      this._writeStream.write(content);
      this.currentLogSize += Buffer.byteLength(content, 'utf8');
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

  formatMessage(level, message, ...args) {
    const parts = [];

    if (this.includeTimestamp) {
      parts.push(new Date().toISOString());
    }

    parts.push(this.prefix);

    const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level);
    const color = LOG_COLORS[levelName] || LOG_COLORS.RESET;

    if (!isBrowser) {
      parts.push(`${color}[${levelName}]${LOG_COLORS.RESET}`);
    } else {
      parts.push(`[${levelName}]`);
    }

    parts.push(message);

    const requestId = this.getCurrentRequestId();
    if (this.includeRequestId && requestId) {
      parts.push(`[req:${requestId}]`);
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

    const formatted = parts.join(' ');

    return {
      console: formatted,
      file: formatted,
      color,
      levelName
    };
  }

  _log(level, message, ...args) {
    if (!this.shouldLog(level)) return;

    const { console: consoleMsg, file: fileMsg, color, levelName } = this.formatMessage(level, message, ...args);

    this.logBuffer.push({
      timestamp: new Date().toISOString(),
      level: levelName,
      message: consoleMsg
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
      this._enqueueLog(fileMsg);
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

  runWithContext(requestId, fn) {
    if (isBrowser) {
      return fn();
    }
    return requestContextStorage.run({ requestId }, fn);
  }

  getRequestId() {
    return this.getCurrentRequestId();
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
      if (files.length <= this.maxFiles) {
        return;
      }
      const fileStats = files.map(f => ({
        name: f,
        mtime: statSync(`${this.logDir}/${f}`).mtime.getTime()
      }));
      fileStats.sort((a, b) => a.mtime - b.mtime);
      const toDelete = fileStats.slice(0, fileStats.length - this.maxFiles);
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
      if (!logFile) {
        return false;
      }
      
      this._closeStream();
      
      if (existsSync(logFile)) {
        writeFileSync(logFile, '');
        this.currentLogSize = 0;
        return true;
      }
      return true;
    } catch (error) {
      console.error('Failed to clear today log:', error.message);
      return false;
    }
  }
}

const logger = new Logger();

function setLogLevel(level) {
  logger.setLevel(level);
}

function getLogLevel() {
  return logger.level;
}

export { logger, setLogLevel, getLogLevel };
export default logger;
