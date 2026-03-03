import {
  type WriteStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'fs';
import { dirname, resolve } from 'path';

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
  private readonly filePath: string;
  private readonly dir: string;
  private readonly maxFileSize: number;
  private readonly maxFiles: number;
  private stream: WriteStream | null = null;
  private currentSize = 0;
  private initialized = false;
  private readonly context: Record<string, unknown>;
  private root: Logger;

  // Extreme mode: batch writes per event-loop tick via setImmediate
  private extremeMode = false;
  private extremeQueue: string[] = [];
  private extremeFlushScheduled = false;

  public constructor(
    options: LoggerOptions,
    context: Record<string, unknown> = {}
  ) {
    this.maxFileSize = options.maxFileSize ?? 10 * 1024 * 1024;
    this.maxFiles = options.maxFiles ?? 5;
    this.filePath = resolve(options.logFilePath);
    this.dir = dirname(this.filePath);
    this.context = context;
    this.root = this;
  }

  private init(): void {
    if (this.initialized) return;

    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }

    this.currentSize = existsSync(this.filePath)
      ? statSync(this.filePath).size
      : 0;

    // Open the file synchronously so it exists on disk before any rotation
    // attempt. createWriteStream's own open() is async and would create a race
    // condition in tight synchronous loops where rotate() is called before the
    // file is physically created.
    const fd = openSync(this.filePath, 'a');
    this.stream = createWriteStream(this.filePath, { fd, autoClose: true });
    this.initialized = true;
  }

  private writeEntry(line: string): void {
    this.init();
    this.stream!.write(line);
    this.currentSize += Buffer.byteLength(line, 'utf-8');

    if (this.currentSize >= this.maxFileSize) {
      this.rotate();
    }
  }

  private writeEntryBuffered(line: string): void {
    this.extremeQueue.push(line);
    if (!this.extremeFlushScheduled) {
      this.extremeFlushScheduled = true;
      setImmediate(() => {
        const batch = this.extremeQueue.join('');
        this.extremeQueue = [];
        this.extremeFlushScheduled = false;
        this.writeEntry(batch);
      });
    }
  }

  public log(level: LogLevel, message: string, data?: unknown): void {
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
    };
    if (data !== undefined) {
      entry['data'] = data;
    }
    const line = JSON.stringify(entry) + '\n';

    const root = this.root;
    if (root.extremeMode) {
      root.writeEntryBuffered(line);
    } else {
      root.writeEntry(line);
    }
  }

  private rotate(): void {
    this.stream?.end();
    this.stream = null;
    this.initialized = false;

    const oldestPath = `${this.filePath}.${this.maxFiles}`;
    if (existsSync(oldestPath)) {
      unlinkSync(oldestPath);
    }

    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const src = `${this.filePath}.${i}`;
      const dest = `${this.filePath}.${i + 1}`;
      if (existsSync(src)) {
        renameSync(src, dest);
      }
    }

    renameSync(this.filePath, `${this.filePath}.1`);
    this.currentSize = 0;
  }

  /**
   * Create a child logger that inherits this logger's config and shares
   * its write stream, with additional default context fields.
   */
  public child(context: Record<string, unknown>): Logger {
    const child = new Logger(
      {
        logFilePath: this.filePath,
        maxFileSize: this.maxFileSize,
        maxFiles: this.maxFiles,
      },
      { ...this.context, ...context }
    );
    child.root = this.root;
    return child;
  }

  /**
   * Enable extreme mode: writes are batched per event-loop tick via
   * setImmediate, reducing the number of stream.write() syscalls.
   */
  public enableExtremeMode(): void {
    this.root.extremeMode = true;
  }

  /**
   * Returns a promise that resolves once the stream's write buffer drains.
   */
  public flush(): Promise<void> {
    const root = this.root;
    return new Promise<void>((res) => {
      if (!root.stream || !root.stream.writableNeedDrain) return res();
      root.stream.once('drain', res);
    });
  }

  /**
   * Gracefully closes the underlying write stream.
   */
  public close(): Promise<void> {
    const root = this.root;
    return new Promise<void>((res) => {
      if (!root.stream) return res();
      root.stream.end(res);
      root.stream = null;
      root.initialized = false;
    });
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
  const fileConfig = loadConfigFile(configPath);
  const envConfig = getEnvConfig();
  const nodeEnv = process.env['NODE_ENV'] || 'development';

  let finalOptions: LoggerOptions;

  if (options) {
    finalOptions = {
      maxFileSize: 10 * 1024 * 1024,
      maxFiles: 5,
      ...options,
    } as LoggerOptions;
  } else if (fileConfig) {
    const baseConfig = {
      maxFileSize: 10 * 1024 * 1024,
      maxFiles: 5,
      ...fileConfig,
    };

    if (
      fileConfig.env &&
      fileConfig.env[nodeEnv as keyof typeof fileConfig.env]
    ) {
      Object.assign(
        baseConfig,
        fileConfig.env[nodeEnv as keyof typeof fileConfig.env]
      );
    }

    Object.assign(baseConfig, envConfig);
    finalOptions = baseConfig as LoggerOptions;
  } else {
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
