import {
  type WriteStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'fs';
import { basename, dirname, extname, join, resolve } from 'path';

/**
 * Logger utility for creating structured log files
 */

export interface LoggerOptions {
  logFilePath: string;
  /**
   * Maximum file size in bytes before rotating.
   * When rotateByDate is true, rotation happens within the daily file.
   * @default undefined (no limit)
   */
  maxFileSize?: number;
  maxFiles?: number;
  /**
   * Rotate log file daily, naming files app-YYYY-MM-DD.log.
   * @default true
   */
  rotateByDate?: boolean;
  /**
   * Maximum number of daily log files to keep.
   * Older files are deleted on each daily rotation.
   * @default undefined (no limit)
   */
  maxDays?: number;
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
  private readonly maxFileSize: number | undefined;
  private readonly maxFiles: number;
  private readonly rotateByDate: boolean;
  private readonly maxDays: number | undefined;
  private activeFilePath: string;
  private currentDate: string;
  private stream: WriteStream | null = null;
  private currentSize = 0;
  private initialized = false;
  private readonly context: Record<string, unknown>;
  private root: Logger;

  public constructor(
    options: LoggerOptions,
    context: Record<string, unknown> = {}
  ) {
    this.maxFileSize = options.maxFileSize;
    this.maxFiles = options.maxFiles ?? 5;
    this.rotateByDate = options.rotateByDate ?? true;
    this.maxDays = options.maxDays;
    this.filePath = resolve(options.logFilePath);
    this.dir = dirname(this.filePath);
    this.context = context;
    this.root = this;
    this.currentDate = new Date().toISOString().slice(0, 10);
    this.activeFilePath = this.rotateByDate
      ? this.getDateFilePath(this.currentDate)
      : this.filePath;
  }

  private getDateFilePath(date: string): string {
    const ext = extname(this.filePath);
    if (!ext) return `${this.filePath}-${date}`;
    return `${this.filePath.slice(0, -ext.length)}-${date}${ext}`;
  }

  private init(): void {
    if (this.initialized) return;

    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }

    this.currentSize = existsSync(this.activeFilePath)
      ? statSync(this.activeFilePath).size
      : 0;

    // Open the file synchronously so it exists on disk before any rotation
    // attempt. createWriteStream's own open() is async and would create a race
    // condition in tight synchronous loops where rotate() is called before the
    // file is physically created.
    const fd = openSync(this.activeFilePath, 'a');
    this.stream = createWriteStream(this.activeFilePath, {
      fd,
      autoClose: true,
    });
    this.initialized = true;
  }

  private rotateDateFile(newDate: string): void {
    this.stream?.end();
    this.stream = null;
    this.initialized = false;
    this.currentDate = newDate;
    this.activeFilePath = this.getDateFilePath(newDate);
    this.currentSize = 0;
    this.cleanupOldDays();
  }

  private cleanupOldDays(): void {
    if (!this.maxDays) return;

    const ext = extname(this.filePath);
    const base = basename(this.filePath, ext);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.maxDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const toDelete = readdirSync(this.dir).filter((f) => {
      if (!f.startsWith(`${base}-`)) return false;
      if (ext && !f.endsWith(ext)) return false;
      const dateStr = ext
        ? f.slice(base.length + 1, -ext.length)
        : f.slice(base.length + 1);
      return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && dateStr < cutoffStr;
    });

    for (const file of toDelete) {
      unlinkSync(join(this.dir, file));
    }
  }

  private writeEntry(line: string): void {
    if (this.rotateByDate) {
      const today = new Date().toISOString().slice(0, 10);
      if (today !== this.currentDate) {
        this.rotateDateFile(today);
      }
    }

    this.init();
    this.stream!.write(line);
    this.currentSize += Buffer.byteLength(line, 'utf-8');

    if (
      this.maxFileSize !== undefined &&
      this.currentSize >= this.maxFileSize
    ) {
      this.rotate();
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
    this.root.writeEntry(line);
  }

  private rotate(): void {
    this.stream?.end();
    this.stream = null;
    this.initialized = false;

    const base = this.activeFilePath;
    const oldestPath = `${base}.${this.maxFiles}`;
    if (existsSync(oldestPath)) {
      unlinkSync(oldestPath);
    }

    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const src = `${base}.${i}`;
      const dest = `${base}.${i + 1}`;
      if (existsSync(src)) {
        renameSync(src, dest);
      }
    }

    renameSync(base, `${base}.1`);
    this.currentSize = 0;
  }

  /**
   * Create a child logger that inherits this logger's config and shares
   * its write stream, with additional default context fields.
   */
  public child(context: Record<string, unknown>): Logger {
    const childOptions: LoggerOptions = {
      logFilePath: this.filePath,
      maxFiles: this.maxFiles,
      rotateByDate: this.rotateByDate,
    };
    if (this.maxFileSize !== undefined) {
      childOptions.maxFileSize = this.maxFileSize;
    }
    if (this.maxDays !== undefined) {
      childOptions.maxDays = this.maxDays;
    }
    const child = new Logger(childOptions, { ...this.context, ...context });
    child.root = this.root;
    return child;
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

  if (process.env['LOG_ROTATE_BY_DATE'] !== undefined) {
    config.rotateByDate = process.env['LOG_ROTATE_BY_DATE'] !== 'false';
  }

  if (process.env['LOG_MAX_DAYS']) {
    config.maxDays = parseInt(process.env['LOG_MAX_DAYS'], 10);
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
      maxFiles: 5,
      ...options,
    } as LoggerOptions;
  } else if (fileConfig) {
    const baseConfig = {
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
      maxFiles: 5,
      ...envConfig,
      ...(options || {}),
    } as LoggerOptions;
  }

  return new Logger(finalOptions);
}
