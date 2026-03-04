# @wsms/logger

A lightweight TypeScript logging utility for structured file logging with flexible configuration support.

## Features

- Structured logging in JSONL format
- Multiple log levels: `debug`, `info`, `warn`, `error`
- Async writes via WriteStream — non-blocking (~700k logs/sec)
- Daily log rotation with optional size limit per file
- Child loggers with inherited context
- Configuration via JSON file or environment variables
- Environment-specific configuration blocks
- Full TypeScript support with type definitions
- Zero dependencies

## Installation

```bash
npm install @wsms/logger
```

## Usage

### Basic

```ts
import { createLogger } from '@wsms/logger';

const logger = createLogger({ logFilePath: './logs/app.log' });

logger.info('Application started');
logger.error('Something went wrong', { userId: 123 });
```

### With Config File

Automatically loads `logger.config.json` or `.loggerrc.json` from the project root:

```ts
const logger = createLogger();
```

Custom path:

```ts
const logger = createLogger(undefined, './config/logger.json');
```

### Rotation Options

```ts
// Daily rotation (default) — no size limit
const logger = createLogger({
  logFilePath: './logs/app.log',
});

// Daily rotation + size limit per daily file
const logger = createLogger({
  logFilePath: './logs/app.log',
  maxFileSize: 50 * 1024 * 1024, // 50 MB per daily file
  maxFiles: 5,
  maxDays: 30,
});

// Size-only rotation — no date in filename
const logger = createLogger({
  logFilePath: './logs/app.log',
  rotateByDate: false,
  maxFileSize: 10 * 1024 * 1024,
  maxFiles: 5,
});
```

### Child Loggers

Child loggers share the parent's write stream and add default context fields to every entry:

```ts
const logger = createLogger({ logFilePath: './logs/app.log' });

const httpLogger = logger.child({ component: 'http' });
const dbLogger   = logger.child({ component: 'db' });

httpLogger.info('request received', { method: 'GET', path: '/users' });
// → {"level":"info","message":"request received","component":"http","data":{...}}

dbLogger.error('query failed');
// → {"level":"error","message":"query failed","component":"db"}
```

Contexts merge when nesting children:

```ts
const reqLogger = httpLogger.child({ requestId: 'abc-123' });
reqLogger.info('handler called');
// → {..., "component":"http", "requestId":"abc-123"}
```

### Graceful Shutdown

```ts
process.on('SIGTERM', async () => {
  await logger.flush(); // drain write buffer
  await logger.close(); // close the file descriptor
  process.exit(0);
});
```

## Configuration

### Config File

Create one of these files in your project root:

- `logger.config.json`
- `.loggerrc.json`

```json
{
  "logFilePath": "./logs/app.log",
  "maxFileSize": 10485760,
  "maxFiles": 5,
  "env": {
    "development": {
      "logFilePath": "./logs/dev.log"
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

| Variable | Description |
|---|---|
| `LOG_FILE_PATH` | Path to log file |
| `LOG_MAX_FILE_SIZE` | Maximum file size in bytes |
| `LOG_MAX_FILES` | Maximum number of rotated files to keep |
| `LOG_ROTATE_BY_DATE` | Enable/disable daily rotation (`true`/`false`) |
| `LOG_MAX_DAYS` | Maximum number of daily log files to keep |
| `NODE_ENV` | Current environment (`development`/`production`/`test`) |

```bash
LOG_FILE_PATH="./logs/app.log" LOG_MAX_DAYS=30 node app.js
```

### Configuration Priority

1. Direct options passed to `createLogger(options)`
2. Configuration file
3. Environment variables
4. Default values

## Log Format

Each entry is written as a single JSON line (JSONL):

```json
{"timestamp":"2024-01-01T12:00:00.000Z","level":"info","message":"Application started"}
{"timestamp":"2024-01-01T12:00:01.000Z","level":"error","message":"Something went wrong","data":{"userId":123}}
```

## Log Rotation

### Daily (default)

A new file is created each day:

```
logs/app-2024-01-01.log
logs/app-2024-01-02.log
```

Set `maxDays` to automatically delete files older than N days.

### Daily + size limit

Set `maxFileSize` to also rotate within a day:

```
logs/app-2024-01-01.log      ← current
logs/app-2024-01-01.log.1
logs/app-2024-01-01.log.2
```

### Size-only (`rotateByDate: false`)

Classic numbered rotation — no date in filename. When the file exceeds `maxFileSize`:

1. Oldest file is deleted (if `maxFiles` reached)
2. Existing files are shifted: `.log.4` → `.log.5`, etc.
3. Current file is renamed: `app.log` → `app.log.1`
4. Next write creates a fresh `app.log`

## API

### `createLogger(options?, configPath?)`

| Parameter | Type | Description |
|---|---|---|
| `options` | `Partial<LoggerOptions>` | Direct configuration options |
| `configPath` | `string` | Custom path to configuration file |

### `LoggerOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `logFilePath` | `string` | — | Path to log file |
| `rotateByDate` | `boolean` | `true` | Daily rotation with date in filename |
| `maxDays` | `number` | unlimited | Max number of daily files to keep |
| `maxFileSize` | `number` | unlimited | Max file size before rotating within a day |
| `maxFiles` | `number` | `5` | Max number of size-rotated files to keep |

### Logger Methods

| Method | Description |
|---|---|
| `debug(message, data?)` | Log at debug level |
| `info(message, data?)` | Log at info level |
| `warn(message, data?)` | Log at warn level |
| `error(message, data?)` | Log at error level |
| `child(context)` | Create a child logger with extra default fields |
| `flush()` | Wait for write buffer to drain |
| `close()` | Close the file descriptor |

## Development

```bash
npm install
npm run build
npm test
npm run test:coverage
npm run lint
```

## Related

- [`@wsms/logger-connect-nuxt`](https://github.com/WhoStoleMySleepDev/logger-connect-nuxt) — Nuxt 3/4 module with auto-imported `useLogger()` for server routes and components

## License

MIT
