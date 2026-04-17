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
    return level >= this.level;
  }

  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level);
    const color = LOG_COLORS[levelName] || '';
    const reset = LOG_COLORS.RESET;
    
    let formatted = `${timestamp} ${this.prefix} ${color}[${levelName}]${reset} ${message}`;
    
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
    
    return formatted;
  }

  debug(message, ...args) {
    if (!this.shouldLog(LOG_LEVELS.DEBUG)) return;
    
    const formatted = this.formatMessage(LOG_LEVELS.DEBUG, message, ...args);
    this.addToBuffer(formatted);
    
    if (this.enableConsole) {
      console.debug(formatted);
    }
  }

  info(message, ...args) {
    if (!this.shouldLog(LOG_LEVELS.INFO)) return;
    
    const formatted = this.formatMessage(LOG_LEVELS.INFO, message, ...args);
    this.addToBuffer(formatted);
    
    if (this.enableConsole) {
      console.info(formatted);
    }
  }

  warn(message, ...args) {
    if (!this.shouldLog(LOG_LEVELS.WARN)) return;
    
    const formatted = this.formatMessage(LOG_LEVELS.WARN, message, ...args);
    this.addToBuffer(formatted);
    
    if (this.enableConsole) {
      console.warn(formatted);
    }
  }

  error(message, error, ...args) {
    if (!this.shouldLog(LOG_LEVELS.ERROR)) return;
    
    let fullMessage = message;
    if (error instanceof Error) {
      fullMessage += ` - ${error.message}`;
      if (error.stack) {
        args.push({ stack: error.stack });
      }
    }
    
    const formatted = this.formatMessage(LOG_LEVELS.ERROR, fullMessage, ...args);
    this.addToBuffer(formatted);
    
    if (this.enableConsole) {
      console.error(formatted);
    }
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
}

export const logger = new Logger();

export const setLogLevel = (level) => {
  logger.setLevel(level);
};

export const getLogLevel = () => {
  return logger.level;
};

export default logger;