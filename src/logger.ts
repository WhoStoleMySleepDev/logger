import {
  readFileSync,
  existsSync,
  appendFileSync,
  mkdirSync,
  statSync,
  renameSync,
  unlinkSync,
} from 'fs';
import { resolve, dirname } from 'path';

/**
 * Logger utility for creating structured log files
 */

export interface LoggerOptions {
  logFilePath: string;
  maxFileSize?: number;
  maxFiles?: number;
}

export interface LoggerConfig extends LoggerOptions {
  /**
   * Environment-specific configurations
   */
  env?: {
    development?: Partial<LoggerOptions>;
    production?: Partial<LoggerOptions>;
    test?: Partial<LoggerOptions>;
  };
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

    const filePath = resolve(this.options.logFilePath);
    const dir = dirname(filePath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    appendFileSync(filePath, JSON.stringify(logEntry) + '\n', 'utf-8');
    this.rotateIfNeeded(filePath);
  }

  private rotateIfNeeded(filePath: string): void {
    const maxFileSize = this.options.maxFileSize ?? 10 * 1024 * 1024;
    const maxFiles = this.options.maxFiles ?? 5;

    if (!existsSync(filePath)) return;

    const { size } = statSync(filePath);
    if (size < maxFileSize) return;

    const oldestPath = `${filePath}.${maxFiles}`;
    if (existsSync(oldestPath)) {
      unlinkSync(oldestPath);
    }

    for (let i = maxFiles - 1; i >= 1; i--) {
      const src = `${filePath}.${i}`;
      const dest = `${filePath}.${i + 1}`;
      if (existsSync(src)) {
        renameSync(src, dest);
      }
    }

    renameSync(filePath, `${filePath}.1`);
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

/**
 * Load configuration from various config file formats
 */
function loadConfigFile(configPath?: string): LoggerConfig | null {
  const possiblePaths = configPath
    ? [configPath]
    : [
        'logger.config.js',
        'logger.config.ts',
        'logger.config.json',
        '.loggerrc',
        '.loggerrc.json',
      ];

  for (const path of possiblePaths) {
    try {
      const fullPath = resolve(process.cwd(), path);
      if (existsSync(fullPath)) {
        if (path.endsWith('.json')) {
          const content = readFileSync(fullPath, 'utf-8');
          return JSON.parse(content) as LoggerConfig;
        } else {
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Get configuration from environment variables
 */
function getEnvConfig(): Partial<LoggerOptions> {
  const config: Partial<LoggerOptions> = {};

  if (process.env['LOG_FILE_PATH']) {
    config.logFilePath = process.env['LOG_FILE_PATH'];
  }

  if (process.env['LOG_MAX_FILE_SIZE']) {
    config.maxFileSize = parseInt(process.env['LOG_MAX_FILE_SIZE'], 10);
  }

  if (process.env['LOG_MAX_FILES']) {
    config.maxFiles = parseInt(process.env['LOG_MAX_FILES'], 10);
  }

  return config;
}

/**
 * Create a logger with configuration from files, environment, or defaults
 */
export function createLogger(
  options?: Partial<LoggerOptions>,
  configPath?: string
): Logger {
  // Load config from file
  const fileConfig = loadConfigFile(configPath);

  // Get environment config
  const envConfig = getEnvConfig();

  // Determine current environment
  const nodeEnv = process.env['NODE_ENV'] || 'development';

  // Build final configuration
  let finalOptions: LoggerOptions;

  if (options) {
    // Direct options take precedence
    finalOptions = {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      ...options,
    } as LoggerOptions;
  } else if (fileConfig) {
    // Use file config with environment overrides
    const baseConfig = {
      maxFileSize: 10 * 1024 * 1024,
      maxFiles: 5,
      ...fileConfig,
    };

    // Apply environment-specific config
    if (
      fileConfig.env &&
      fileConfig.env[nodeEnv as keyof typeof fileConfig.env]
    ) {
      Object.assign(
        baseConfig,
        fileConfig.env[nodeEnv as keyof typeof fileConfig.env]
      );
    }

    // Apply environment variables
    Object.assign(baseConfig, envConfig);

    finalOptions = baseConfig as LoggerOptions;
  } else {
    // Use environment config or defaults
    finalOptions = {
      logFilePath: './logs/app.log',
      maxFileSize: 10 * 1024 * 1024,
      maxFiles: 5,
      ...envConfig,
      ...(options || {}),
    } as LoggerOptions;
  }

  return new Logger(finalOptions);
}
