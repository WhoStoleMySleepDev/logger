# @wsms/logger

A lightweight TypeScript logging utility for creating structured log files with flexible configuration support.

## Features

- 📝 Structured logging with JSON format
- 🎯 Multiple log levels (debug, info, warn, error)
- ⚡ Async writes via WriteStream — non-blocking event loop (~700k logs/sec)
- 📁 Configurable log file paths
- 🔄 Log rotation support
- 👶 Child loggers with inherited context
- ⚙️ **Configuration files support** (JSON)
- 🌍 **Environment variables support**
- 🏭 **Environment-specific configurations**
- 📦 TypeScript support with full type definitions
- ✅ Comprehensive test coverage
- 🚀 Zero dependencies

## Installation

```bash
npm install @wsms/logger
```

## Usage

### Basic Usage

```typescript
import { createLogger } from '@wsms/logger';

// Automatically loads configuration from config files
const logger = createLogger();

logger.info('Application started');
logger.error('Something went wrong', { userId: 123 });
```

### With Direct Options

```typescript
import { createLogger } from '@wsms/logger';

const logger = createLogger({
  logFilePath: './logs/app.log',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
});

logger.info('Application started');
```

### With Custom Config Path

```typescript
import { createLogger } from '@wsms/logger';

const logger = createLogger(undefined, './config/custom-logger.json');
```

### Child Loggers

Child loggers share the parent's stream and add default context fields to every entry:

```typescript
const logger = createLogger({ logFilePath: './logs/app.log' });

const httpLogger = logger.child({ component: 'http' });
const dbLogger   = logger.child({ component: 'db' });

httpLogger.info('request received', { method: 'GET', path: '/users' });
// → {"level":"info","message":"request received","component":"http","data":{...}}

dbLogger.error('query failed');
// → {"level":"error","message":"query failed","component":"db"}
```

Children can be nested — contexts merge:

```typescript
const reqLogger = httpLogger.child({ requestId: 'abc-123' });
reqLogger.info('handler called');
// → {..., "component":"http", "requestId":"abc-123"}
```

### Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  await logger.flush(); // wait for write buffer to drain
  await logger.close(); // close the file descriptor
  process.exit(0);
});
```

## Configuration

### Configuration Files

Create one of these files in your project root:

- `logger.config.json`
- `.loggerrc.json`

#### Example `logger.config.json`

```json
{
  "logFilePath": "./logs/app.log",
  "maxFileSize": 10485760,
  "maxFiles": 5,
  "env": {
    "development": {
      "logFilePath": "./logs/dev.log",
      "maxFileSize": 1048576
    },
    "production": {
      "logFilePath": "/var/log/app.log",
      "maxFiles": 20
    },
    "test": {
      "logFilePath": "./logs/test.log",
      "maxFiles": 1
    }
  }
}
```

### Environment Variables

Override configuration with environment variables:

- `LOG_FILE_PATH` - Path to log file
- `LOG_MAX_FILE_SIZE` - Maximum file size in bytes
- `LOG_MAX_FILES` - Maximum number of files
- `NODE_ENV` - Current environment (development/production/test)

```bash
LOG_FILE_PATH="./logs/custom.log" LOG_MAX_FILES=10 node app.js
```

### Configuration Priority

1. **Direct options** passed to `createLogger(options)`
2. **Configuration file**
3. **Environment variables**
4. **Default values**

## Log Format

Each log entry is written as a single JSON line (JSONL) to the log file:

```json
{"timestamp":"2026-03-04T12:00:00.000Z","level":"info","message":"Application started"}
{"timestamp":"2026-03-04T12:00:01.000Z","level":"error","message":"Something went wrong","data":{"userId":123}}
```

## Log Rotation

Rotation is triggered **by file size** after each write. When the file exceeds `maxFileSize`:

1. `app.log.5` is deleted (if `maxFiles` is 5)
2. Existing rotated files are shifted: `.log.4` → `.log.5`, `.log.3` → `.log.4`, etc.
3. Current file is renamed: `app.log` → `app.log.1`
4. Next write creates a fresh `app.log`

## API

### `createLogger(options?, configPath?)`

Creates a logger instance with automatic configuration loading.

#### Parameters

- `options?: Partial<LoggerOptions>` - Direct configuration options
- `configPath?: string` - Custom path to configuration file

### `Logger`

#### Constructor

```typescript
constructor(options: LoggerOptions)
```

#### Options

- `logFilePath: string` - Path to log file
- `maxFileSize?: number` - Maximum file size before rotation (default: 10MB)
- `maxFiles?: number` - Maximum number of log files to keep (default: 5)

#### Methods

- `debug(message: string, data?: unknown): void`
- `info(message: string, data?: unknown): void`
- `warn(message: string, data?: unknown): void`
- `error(message: string, data?: unknown): void`
- `child(context: Record<string, unknown>): Logger` — child logger with extra default fields
- `flush(): Promise<void>` — wait for stream buffer to drain
- `close(): Promise<void>` — close the file descriptor

### Log Levels

- `LogLevel.DEBUG`
- `LogLevel.INFO`
- `LogLevel.WARN`
- `LogLevel.ERROR`

## Examples

### Development vs Production

```typescript
import { createLogger } from '@wsms/logger';

// Will automatically use environment-specific config
const logger = createLogger();

if (process.env.NODE_ENV === 'production') {
  logger.info('Production mode active');
} else {
  logger.debug('Development mode active');
}
```

### With Data

```typescript
logger.debug('User action', {
  userId: 123,
  action: 'login',
  timestamp: new Date().toISOString(),
});
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build project
npm run build

# Lint code
npm run lint

# Format code
npm run format
```

## License

MIT
