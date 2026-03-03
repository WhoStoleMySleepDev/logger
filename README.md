# @wms/logger

A lightweight TypeScript logging utility for creating structured log files.

## Features

- 📝 Structured logging with JSON format
- 🎯 Multiple log levels (debug, info, warn, error)
- 📁 Configurable log file paths
- 🔄 Log rotation support
- 📦 TypeScript support with full type definitions
- ✅ Comprehensive test coverage
- 🚀 Zero dependencies

## Installation

```bash
npm install @whostolemysleep/logging-util
```

## Usage

```typescript
import { Logger, LogLevel } from '@whostolemysleep/logging-util';

const logger = new Logger({
  logFilePath: './logs/app.log',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
});

// Basic logging
logger.info('Application started');
logger.error('Something went wrong', { userId: 123 });

// With data
logger.debug('User action', {
  userId: 123,
  action: 'login',
  timestamp: new Date().toISOString(),
});
```

## API

### `Logger`

#### Constructor

```typescript
constructor(options: LoggerOptions)
```

#### Options

- `logFilePath: string` - Path to the log file
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

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build the project
npm run build

# Lint code
npm run lint

# Format code
npm run format
```

## License

MIT
