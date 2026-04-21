const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4
};

const LOG_COLORS = {
  DEBUG: '#3498db',
  INFO: '#2ecc71',
  WARN: '#f39c12',
  ERROR: '#e74c3c',
  RESET: '#333333'
};

class BrowserLogger {
  constructor() {
    this.level = LOG_LEVELS.INFO;
    this.prefix = '[AIClient]';
    this.enableConsole = true;
    this.logBuffer = [];
    this.maxBufferSize = 100;
    this.enabled = true;
    this.requestId = null;
  }

  initialize(options = {}) {
    const {
      enabled = true,
      logLevel = 'info'
    } = options;

    this.enabled = enabled;
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

  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level);
    const color = LOG_COLORS[levelName] || LOG_COLORS.RESET;

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
      console: formatted,
      file: formatted,
      color,
      levelName
    };
  }

  _log(level, message, ...args) {
    if (!this.shouldLog(level)) return;

    const { console: consoleMsg, color, levelName } = this.formatMessage(level, message, ...args);

    this.logBuffer.push({
      timestamp: new Date().toISOString(),
      level: levelName,
      message: consoleMsg
    });

    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    if (this.enableConsole) {
      const logMethod = level === LOG_LEVELS.DEBUG ? 'debug' :
                        level === LOG_LEVELS.INFO ? 'info' :
                        level === LOG_LEVELS.WARN ? 'warn' : 'error';
      console[logMethod](`%c${consoleMsg}`, `color: ${color}`);
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
    const previousRequestId = this.requestId;
    this.requestId = requestId;
    try {
      return fn();
    } finally {
      this.requestId = previousRequestId;
    }
  }

  getRequestId() {
    return this.requestId;
  }

  clearRequestContext() {
    this.requestId = null;
  }
}

export const logger = new BrowserLogger();

export const setLogLevel = (level) => {
  logger.setLevel(level);
};

export const getLogLevel = () => {
  return logger.level;
};

export default logger;
