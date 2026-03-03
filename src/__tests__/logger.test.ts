import { Logger } from '../logger';

describe('Logger', () => {
  const mockLogFilePath = '/tmp/test.log';

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create logger with default options', () => {
      const logger = new Logger({ logFilePath: mockLogFilePath });

      expect(logger).toBeInstanceOf(Logger);
    });

    it('should create logger with custom options', () => {
      const logger = new Logger({
        logFilePath: mockLogFilePath,
        maxFileSize: 1024,
        maxFiles: 2,
      });

      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe('log methods', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({ logFilePath: mockLogFilePath });
    });

    it('should log debug messages', () => {
      const message = 'Debug message';
      logger.debug(message);

      expect(console.log).toHaveBeenCalledWith(
        `[Logger: ${mockLogFilePath}]`,
        expect.stringContaining('"level": "debug"')
      );
      expect(console.log).toHaveBeenCalledWith(
        `[Logger: ${mockLogFilePath}]`,
        expect.stringContaining(message)
      );
    });

    it('should log info messages', () => {
      const message = 'Info message';
      logger.info(message);

      expect(console.log).toHaveBeenCalledWith(
        `[Logger: ${mockLogFilePath}]`,
        expect.stringContaining('"level": "info"')
      );
      expect(console.log).toHaveBeenCalledWith(
        `[Logger: ${mockLogFilePath}]`,
        expect.stringContaining(message)
      );
    });

    it('should log warning messages', () => {
      const message = 'Warning message';
      logger.warn(message);

      expect(console.log).toHaveBeenCalledWith(
        `[Logger: ${mockLogFilePath}]`,
        expect.stringContaining('"level": "warn"')
      );
      expect(console.log).toHaveBeenCalledWith(
        `[Logger: ${mockLogFilePath}]`,
        expect.stringContaining(message)
      );
    });

    it('should log error messages', () => {
      const message = 'Error message';
      logger.error(message);

      expect(console.log).toHaveBeenCalledWith(
        `[Logger: ${mockLogFilePath}]`,
        expect.stringContaining('"level": "error"')
      );
      expect(console.log).toHaveBeenCalledWith(
        `[Logger: ${mockLogFilePath}]`,
        expect.stringContaining(message)
      );
    });

    it('should log messages with data', () => {
      const message = 'Message with data';
      const data = { userId: 123, action: 'login' };

      logger.info(message, data);

      expect(console.log).toHaveBeenCalledWith(
        `[Logger: ${mockLogFilePath}]`,
        expect.stringContaining('"data":')
      );
      expect(console.log).toHaveBeenCalledWith(
        `[Logger: ${mockLogFilePath}]`,
        expect.stringContaining('"userId": 123')
      );
      expect(console.log).toHaveBeenCalledWith(
        `[Logger: ${mockLogFilePath}]`,
        expect.stringContaining('"action": "login"')
      );
    });
  });
});
