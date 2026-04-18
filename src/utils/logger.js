import fs from 'fs/promises';
import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4
};

const LOG_COLORS = {
  DEBUG: '\x1b[34m',
  INFO: '\x1b[32m',
  WARN: '\x1b[33m',
  ERROR: '\x1b[31m',
  RESET: '\x1b[0m'
};

class Logger {
  constructor() {
    this.level = LOG_LEVELS.INFO;
    this.prefix = '[AIClient]';
    this.enableConsole = true;
    this.logBuffer = [];
    this.maxBufferSize = 100;
    this.logDir = 'logs';
    this.maxFileSize = 10485760;
    this.maxFiles = 10;
    this.outputMode = 'all';
    this.includeRequestId = true;
    this.includeTimestamp = true;
    this.enabled = true;
    this.currentLogFile = null;
    this.fileWritePromise = Promise.resolve();
    this.asyncLocalStorage = new AsyncLocalStorage();
  }

  async initialize(options) {
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
    this.includeRequestId = includeRequestId;
    this.includeTimestamp = includeTimestamp;
    this.maxFileSize = maxFileSize;
    this.maxFiles = maxFiles;

    const levelValue = LOG_LEVELS[logLevel.toUpperCase()] ?? LOG_LEVELS.INFO;
    this.setLevel(levelValue);

    if (outputMode === 'file' || outputMode === 'all') {
      await this._ensureLogDirExists();
      this.currentLogFile = await this._getCurrentLogFile();
    }
  }

  async _ensureLogDirExists() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (e) {
      console.error(`[Logger] Failed to create log directory: ${e.message}`);
    }
  }

  async _getCurrentLogFile() {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return path.join(this.logDir, `${dateStr}.log`);
  }

  async _getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  async _rotateLogFile() {
    if (!this.currentLogFile) return;
    
    try {
      const size = await this._getFileSize(this.currentLogFile);
      if (size >= this.maxFileSize) {
        const dir = path.dirname(this.currentLogFile);
        const base = path.basename(this.currentLogFile, '.log');
        let i = 1;
        let newName;
        do {
          newName = path.join(dir, `${base}.${i}.log`);
          i++;
        } while (await this._fileExists(newName));
        
        await fs.rename(this.currentLogFile, newName);
        this.currentLogFile = await this._getCurrentLogFile();
        await this.cleanupOldLogs();
      }
    } catch (e) {
      console.error(`[Logger] Failed to rotate log file: ${e.message}`);
    }
  }

  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async _writeToFile(message) {
    if (!this.enabled) return;
    if (this.outputMode !== 'file' && this.outputMode !== 'all') return;
    if (!this.currentLogFile) return;

    this.fileWritePromise = this.fileWritePromise.then(async () => {
      try {
        await this._rotateLogFile();
        const line = `${message}\n`;
        await fs.appendFile(this.currentLogFile, line);
      } catch (e) {
        console.error(`[Logger] Failed to write to log file: ${e.message}`);
      }
    }).catch(() => {});
  }

  async cleanupOldLogs() {
    try {
      await this._ensureLogDirExists();
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.endsWith('.log'));
      
      logFiles.sort((a, b) => b.localeCompare(a));
      
      if (logFiles.length > this.maxFiles) {
        const filesToDelete = logFiles.slice(this.maxFiles);
        for (const file of filesToDelete) {
          try {
            await fs.unlink(path.join(this.logDir, file));
          } catch (e) {}
        }
      }
    } catch (e) {}
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

  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level);
    const color = LOG_COLORS[levelName] || '';
    const reset = LOG_COLORS.RESET;
    
    let formatted = `${timestamp} ${this.prefix} [${levelName}] ${message}`;
    
    if (args.length > 0) {
      try {
        formatted += ' ' + args.map(arg => {
          if (typeof arg === 'object') {
            return JSON.stringify(arg, null, 2);
          }
          return String(arg);
        }).join(' ');
      } catch (e) {
        formatted += ' [Arguments serialization error]';
      }
    }
    
    return {
      console: `${timestamp} ${this.prefix} ${color}[${levelName}]${reset} ${message}`,
      file: formatted
    };
  }

  debug(message, ...args) {
    if (!this.shouldLog(LOG_LEVELS.DEBUG)) return;
    
    const { console: consoleMsg, file: fileMsg } = this.formatMessage(LOG_LEVELS.DEBUG, message, ...args);
    this.addToBuffer(fileMsg);
    
    if (this.outputMode === 'console' || this.outputMode === 'all') {
      console.debug(consoleMsg);
    }
    
    this._writeToFile(fileMsg);
  }

  info(message, ...args) {
    if (!this.shouldLog(LOG_LEVELS.INFO)) return;
    
    const { console: consoleMsg, file: fileMsg } = this.formatMessage(LOG_LEVELS.INFO, message, ...args);
    this.addToBuffer(fileMsg);
    
    if (this.outputMode === 'console' || this.outputMode === 'all') {
      console.info(consoleMsg);
    }
    
    this._writeToFile(fileMsg);
  }

  warn(message, ...args) {
    if (!this.shouldLog(LOG_LEVELS.WARN)) return;
    
    const { console: consoleMsg, file: fileMsg } = this.formatMessage(LOG_LEVELS.WARN, message, ...args);
    this.addToBuffer(fileMsg);
    
    if (this.outputMode === 'console' || this.outputMode === 'all') {
      console.warn(consoleMsg);
    }
    
    this._writeToFile(fileMsg);
  }

  error(message, error, ...args) {
    if (!this.shouldLog(LOG_LEVELS.ERROR)) return;
    
    let fullMessage = message;
    const extraArgs = [...args];
    if (error instanceof Error) {
      fullMessage += ` - ${error.message}`;
      if (error.stack) {
        extraArgs.push({ stack: error.stack });
      }
    }
    
    const { console: consoleMsg, file: fileMsg } = this.formatMessage(LOG_LEVELS.ERROR, fullMessage, ...extraArgs);
    this.addToBuffer(fileMsg);
    
    if (this.outputMode === 'console' || this.outputMode === 'all') {
      console.error(consoleMsg);
    }
    
    this._writeToFile(fileMsg);
  }

  addToBuffer(message) {
    this.logBuffer.push(message);
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
    return this.asyncLocalStorage.run({ requestId }, fn);
  }

  getRequestId() {
    return this.asyncLocalStorage.getStore()?.requestId;
  }

  clearRequestContext() {
  }
}

export const logger = new Logger();

export const setLogLevel = (level) => {
  logger.setLevel(level);
};

export const getLogLevel = () => {
  return logger.level;
};

export default logger;