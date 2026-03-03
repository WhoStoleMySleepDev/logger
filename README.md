# @wsm/logger

A lightweight TypeScript logging utility for creating structured log files with flexible configuration support.

## Features

- 📝 Structured logging with JSON format
- 🎯 Multiple log levels (debug, info, warn, error)
- 📁 Configurable log file paths
- 🔄 Log rotation support
- ⚙️ **Configuration files support** (JSON, JS, TS)
- 🌍 **Environment variables support**
- 🏭 **Environment-specific configurations**
- 📦 TypeScript support with full type definitions
- ✅ Comprehensive test coverage
- 🚀 Zero dependencies

## Installation

```bash
npm install @wsm/logger
```

## Usage

### Basic Usage

```typescript
import { createLogger } from '@wsm/logger';

// Automatically loads configuration from config files
const logger = createLogger();

logger.info('Application started');
logger.error('Something went wrong', { userId: 123 });
```

### With Direct Options

```typescript
import { createLogger } from '@wsm/logger';

const logger = createLogger({
  logFilePath: './logs/app.log',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
});

logger.info('Application started');
```

### With Custom Config Path

```typescript
import { createLogger } from '@wsm/logger';

const logger = createLogger(undefined, './config/custom-logger.json');
```

## Configuration

### Configuration Files

Create one of these files in your project root:

- `logger.config.json`
- `logger.config.js`
- `logger.config.ts`
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

### Log Levels

- `LogLevel.DEBUG`
- `LogLevel.INFO`
- `LogLevel.WARN`
- `LogLevel.ERROR`

## Examples

### Development vs Production

```typescript
import { createLogger } from '@wsm/logger';

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
