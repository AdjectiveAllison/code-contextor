import chalk from "chalk";

// Define log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Set the current log level (can be changed dynamically)
let currentLogLevel = LOG_LEVELS.INFO;

// Create a timestamp string
const getTimestamp = () => new Date().toISOString();

// Main logger object
export const logger = {
  error: (message, ...args) => {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      console.error(
        chalk.red(`[ERROR] ${getTimestamp()} - ${message}`),
        ...args,
      );
    }
  },

  warn: (message, ...args) => {
    if (currentLogLevel >= LOG_LEVELS.WARN) {
      console.warn(
        chalk.yellow(`[WARN] ${getTimestamp()} - ${message}`),
        ...args,
      );
    }
  },

  info: (message, ...args) => {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      console.log(chalk.blue(`[INFO] ${getTimestamp()} - ${message}`), ...args);
    }
  },

  debug: (message, ...args) => {
    if (currentLogLevel >= LOG_LEVELS.DEBUG) {
      console.log(
        chalk.gray(`[DEBUG] ${getTimestamp()} - ${message}`),
        ...args,
      );
    }
  },

  // Set the log level
  setLogLevel: (level) => {
    if (LOG_LEVELS.hasOwnProperty(level)) {
      currentLogLevel = LOG_LEVELS[level];
      logger.info(`Log level set to ${level}`);
    } else {
      logger.warn(`Invalid log level: ${level}. Using default (INFO).`);
    }
  },

  // Get the current log level
  getLogLevel: () => {
    return Object.keys(LOG_LEVELS).find(
      (key) => LOG_LEVELS[key] === currentLogLevel,
    );
  },
};

// Export LOG_LEVELS for external use if needed
export { LOG_LEVELS };
