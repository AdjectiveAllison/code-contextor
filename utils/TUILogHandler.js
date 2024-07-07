import chalk from "chalk";

export class TUILogHandler {
  constructor(maxBufferSize = 1000) {
    this.logBuffer = [];
    this.maxBufferSize = maxBufferSize;
  }

  log(level, message) {
    const coloredMessage = this.colorMessage(level, message);
    this.logBuffer.push({ level, message: coloredMessage });

    // Keep buffer size under control
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  getBuffer() {
    return this.logBuffer;
  }

  clearBuffer() {
    this.logBuffer = [];
  }

  getLatestLogs(count = 10) {
    return this.logBuffer.slice(-count);
  }

  colorMessage(level, message) {
    switch (level) {
      case "ERROR":
        return chalk.red(message);
      case "WARN":
        return chalk.yellow(message);
      case "INFO":
        return chalk.blue(message);
      case "DEBUG":
        return chalk.gray(message);
      default:
        return message;
    }
  }
}
