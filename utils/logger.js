import chalk from "chalk";
import { TUILogHandler } from "./TUILogHandler.js";

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

// Store console handlers and TUI handler
let consoleHandlers = {
  error: console.error,
  warn: console.warn,
  info: console.log,
  debug: console.log,
};
let tuiHandler = null;

// Helper function to format log messages
const formatLogMessage = (level, message, args) => {
  const timestamp = getTimestamp();
  let formattedMessage = `[${level}] ${timestamp} - ${message}`;
  if (args.length > 0) {
    formattedMessage +=
      " " +
      args
        .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg))
        .join(" ");
  }
  return formattedMessage;
};

// Main logger object
export const logger = {
  error: (message, ...args) => {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      const formattedMessage = formatLogMessage("ERROR", message, args);
      if (tuiHandler) {
        tuiHandler.log("ERROR", formattedMessage);
      } else {
        consoleHandlers.error(chalk.red(formattedMessage));
      }
    }
  },

  warn: (message, ...args) => {
    if (currentLogLevel >= LOG_LEVELS.WARN) {
      const formattedMessage = formatLogMessage("WARN", message, args);
      if (tuiHandler) {
        tuiHandler.log("WARN", formattedMessage);
      } else {
        consoleHandlers.warn(chalk.yellow(formattedMessage));
      }
    }
  },

  info: (message, ...args) => {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      const formattedMessage = formatLogMessage("INFO", message, args);
      if (tuiHandler) {
        tuiHandler.log("INFO", formattedMessage);
      } else {
        consoleHandlers.info(chalk.blue(formattedMessage));
      }
    }
  },

  debug: (message, ...args) => {
    if (currentLogLevel >= LOG_LEVELS.DEBUG) {
      const formattedMessage = formatLogMessage("DEBUG", message, args);
      if (tuiHandler) {
        tuiHandler.log("DEBUG", formattedMessage);
      } else {
        consoleHandlers.debug(chalk.gray(formattedMessage));
      }
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

  // Switch to TUI logging mode
  switchToTUIMode: () => {
    if (!tuiHandler) {
      tuiHandler = new TUILogHandler();
    }
    logger.info("Switching to TUI logging mode");
  },

  // Switch back to console logging mode
  switchToConsoleMode: () => {
    if (tuiHandler) {
      // Log any remaining messages in the TUI buffer
      const buffer = tuiHandler.getBuffer();
      buffer.forEach(({ level, message }) => {
        consoleHandlers[level.toLowerCase()](message);
      });
      tuiHandler = null;
    }
    logger.info("Switched to console logging mode");
  },

  // Get the TUI log handler (if in TUI mode)
  getTUIHandler: () => tuiHandler,
};

// Export LOG_LEVELS for external use if needed
export { LOG_LEVELS };
