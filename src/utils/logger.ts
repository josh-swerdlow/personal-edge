type LogLevel = 'VERBOSE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVELS: Record<LogLevel, number> = {
  VERBOSE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
};

// Get log level from environment or localStorage (DEV only)
function getLogLevel(): LogLevel {
  const isDev = !import.meta.env.PROD;

  // In DEV: check localStorage first (allows runtime control via window function)
  if (isDev) {
    const stored = localStorage.getItem('logLevel');
    if (stored && Object.keys(LOG_LEVELS).includes(stored)) {
      return stored as LogLevel;
    }
  }

  // Check environment variable (works in both DEV and PROD)
  const envLevel = import.meta.env.VITE_LOG_LEVEL;
  if (envLevel && Object.keys(LOG_LEVELS).includes(envLevel)) {
    return envLevel as LogLevel;
  }

  // Default: INFO in production, DEBUG in development
  return isDev ? 'DEBUG' : 'INFO';
}

let currentLogLevel = getLogLevel();

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
}

export const logger = {
  verbose: (...args: any[]) => {
    if (shouldLog('VERBOSE')) {
      console.log('[VERBOSE]', ...args);
    }
  },

  debug: (...args: any[]) => {
    if (shouldLog('DEBUG')) {
      console.log('[DEBUG]', ...args);
    }
  },

  info: (...args: any[]) => {
    if (shouldLog('INFO')) {
      console.info('[INFO]', ...args);
    }
  },

  warn: (...args: any[]) => {
    if (shouldLog('WARN')) {
      console.warn('[WARN]', ...args);
    }
  },

  error: (...args: any[]) => {
    if (shouldLog('ERROR')) {
      console.error('[ERROR]', ...args);
    }
  },

  // Update log level at runtime (DEV only)
  setLevel: (level: LogLevel) => {
    if (!import.meta.env.PROD) {
      if (Object.keys(LOG_LEVELS).includes(level)) {
        currentLogLevel = level;
        localStorage.setItem('logLevel', level);
        console.log(`[Logger] Log level set to: ${level}`);
      } else {
        console.warn(`[Logger] Invalid log level: ${level}. Valid levels: ${Object.keys(LOG_LEVELS).join(', ')}`);
      }
    } else {
      console.warn('[Logger] setLogLevel is only available in development mode');
    }
  },

  // Get current log level
  getLevel: (): LogLevel => {
    return currentLogLevel;
  },
};

// Expose to window for runtime control (DEV only)
if (typeof window !== 'undefined' && !import.meta.env.PROD) {
  (window as any).setLogLevel = (level: LogLevel) => {
    logger.setLevel(level);
  };
  (window as any).getLogLevel = () => logger.getLevel();
  console.log(`[Logger] Log level control available. Current level: ${currentLogLevel}`);
  console.log(`[Logger] Use window.setLogLevel('VERBOSE'|'DEBUG'|'INFO'|'WARN'|'ERROR') to change`);
}

