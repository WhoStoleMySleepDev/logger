import { createLogger, Logger } from '../logger';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';

describe('createLogger', () => {
  const testConfigPath = resolve(process.cwd(), 'logger.config.json');
  const testConfigContent = {
    logFilePath: './logs/test-from-config.log',
    maxFileSize: 5 * 1024 * 1024,
    maxFiles: 3,
    env: {
      development: {
        logFilePath: './logs/test-dev.log',
        maxFileSize: 1 * 1024 * 1024,
      },
      production: {
        logFilePath: './logs/test-prod.log',
        maxFiles: 10,
      },
    },
  };

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();

    // Clean up test config file if it exists
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();

    // Clean up test config file
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  describe('with direct options', () => {
    it('should create logger with provided options', () => {
      const logger = createLogger({
        logFilePath: './logs/direct.log',
        maxFileSize: 2 * 1024 * 1024,
        maxFiles: 7,
      });

      expect(logger).toBeInstanceOf(Logger);

      logger.info('Test message');

      expect(console.log).toHaveBeenCalledWith(
        '[Logger: ./logs/direct.log]',
        expect.stringContaining('"level": "info"')
      );
    });

    it('should use defaults when options are partial', () => {
      const logger = createLogger({
        logFilePath: './logs/partial.log',
      });

      expect(logger).toBeInstanceOf(Logger);

      logger.info('Test message');

      expect(console.log).toHaveBeenCalledWith(
        '[Logger: ./logs/partial.log]',
        expect.stringContaining('"level": "info"')
      );
    });
  });

  describe('with config file', () => {
    beforeEach(() => {
      writeFileSync(testConfigPath, JSON.stringify(testConfigContent, null, 2));
    });

    it('should load configuration from JSON config file', () => {
      const logger = createLogger();

      expect(logger).toBeInstanceOf(Logger);

      logger.info('Test message');

      expect(console.log).toHaveBeenCalledWith(
        '[Logger: ./logs/test-from-config.log]',
        expect.stringContaining('"level": "info"')
      );
    });

    it('should apply environment-specific config', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      const logger = createLogger();

      expect(logger).toBeInstanceOf(Logger);

      logger.info('Test message');

      expect(console.log).toHaveBeenCalledWith(
        '[Logger: ./logs/test-dev.log]',
        expect.stringContaining('"level": "info"')
      );

      // Restore original env
      if (originalEnv) {
        process.env['NODE_ENV'] = originalEnv;
      } else {
        delete process.env['NODE_ENV'];
      }
    });

    it('should use custom config path', () => {
      const customConfigPath = resolve(process.cwd(), 'custom-logger.json');
      writeFileSync(
        customConfigPath,
        JSON.stringify({
          logFilePath: './logs/custom.log',
          maxFiles: 15,
        })
      );

      const logger = createLogger(undefined, customConfigPath);

      expect(logger).toBeInstanceOf(Logger);

      logger.info('Test message');

      expect(console.log).toHaveBeenCalledWith(
        '[Logger: ./logs/custom.log]',
        expect.stringContaining('"level": "info"')
      );

      // Clean up
      unlinkSync(customConfigPath);
    });
  });

  describe('with environment variables', () => {
    let originalEnv: Record<string, string | undefined>;

    beforeEach(() => {
      originalEnv = {
        LOG_FILE_PATH: process.env['LOG_FILE_PATH'],
        LOG_MAX_FILE_SIZE: process.env['LOG_MAX_FILE_SIZE'],
        LOG_MAX_FILES: process.env['LOG_MAX_FILES'],
        NODE_ENV: process.env['NODE_ENV'],
      };
    });

    afterEach(() => {
      // Restore original environment variables
      Object.keys(originalEnv).forEach((key) => {
        if (originalEnv[key]) {
          process.env[key] = originalEnv[key];
        } else {
          delete process.env[key];
        }
      });
    });

    it('should use environment variables for configuration', () => {
      process.env['LOG_FILE_PATH'] = './logs/from-env.log';
      process.env['LOG_MAX_FILE_SIZE'] = '8388608'; // 8MB
      process.env['LOG_MAX_FILES'] = '12';

      const logger = createLogger();

      expect(logger).toBeInstanceOf(Logger);

      logger.info('Test message');

      expect(console.log).toHaveBeenCalledWith(
        '[Logger: ./logs/from-env.log]',
        expect.stringContaining('"level": "info"')
      );
    });

    it('should prioritize direct options over environment variables', () => {
      process.env['LOG_FILE_PATH'] = './logs/from-env.log';
      process.env['LOG_MAX_FILE_SIZE'] = '8388608';

      const logger = createLogger({
        logFilePath: './logs/direct-override.log',
      });

      expect(logger).toBeInstanceOf(Logger);

      logger.info('Test message');

      expect(console.log).toHaveBeenCalledWith(
        '[Logger: ./logs/direct-override.log]',
        expect.stringContaining('"level": "info"')
      );
    });
  });

  describe('priority order', () => {
    beforeEach(() => {
      // Set up environment variables
      process.env['LOG_FILE_PATH'] = './logs/env-priority.log';
      process.env['LOG_MAX_FILES'] = '20';

      // Set up config file
      writeFileSync(
        testConfigPath,
        JSON.stringify({
          logFilePath: './logs/config-priority.log',
          maxFileSize: 3 * 1024 * 1024,
          maxFiles: 5,
        })
      );
    });

    afterEach(() => {
      // Clean up environment variables
      delete process.env['LOG_FILE_PATH'];
      delete process.env['LOG_MAX_FILES'];
    });

    it('should prioritize: direct options > config file > env vars > defaults', () => {
      // Direct options should win
      const logger = createLogger({
        logFilePath: './logs/direct-priority.log',
      });

      logger.info('Test message');

      expect(console.log).toHaveBeenCalledWith(
        '[Logger: ./logs/direct-priority.log]',
        expect.stringContaining('"level": "info"')
      );
    });

    it('should use config file when no direct options provided', () => {
      // Remove logFilePath from env to test config file priority
      delete process.env['LOG_FILE_PATH'];

      const logger = createLogger();

      logger.info('Test message');

      expect(console.log).toHaveBeenCalledWith(
        '[Logger: ./logs/config-priority.log]',
        expect.stringContaining('"level": "info"')
      );
    });
  });

  describe('fallback behavior', () => {
    it('should use defaults when no configuration is available', () => {
      const logger = createLogger();

      expect(logger).toBeInstanceOf(Logger);

      logger.info('Test message');

      expect(console.log).toHaveBeenCalledWith(
        '[Logger: ./logs/app.log]',
        expect.stringContaining('"level": "info"')
      );
    });
  });
});
