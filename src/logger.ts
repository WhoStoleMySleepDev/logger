/**
 * Logger utility for creating structured log files
 */

export interface LoggerOptions {
  logFilePath: string;
  maxFileSize?: number;
  maxFiles?: number;
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

export class Logger {
  private options: LoggerOptions;

  public constructor(options: LoggerOptions) {
    this.options = {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      ...options,
    };
  }

  public log(level: LogLevel, message: string, data?: unknown): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };

    // TODO: Implement file writing logic using this.options.logFilePath
    // For now, just reference the options to avoid TypeScript warnings
    const filePath = this.options.logFilePath;
    console.log(`[Logger: ${filePath}]`, JSON.stringify(logEntry, null, 2));
  }

  public debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  public info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  public warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  public error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data);
  }
}
