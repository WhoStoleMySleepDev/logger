jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
  statSync: jest.fn().mockReturnValue({ size: 0 }),
  renameSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

import { Logger } from '../logger';
import * as fs from 'node:fs';
import { resolve } from 'node:path';

describe('Logger', () => {
  const mockLogFilePath = '/tmp/test.log';
  const resolvedPath = resolve(mockLogFilePath);

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({ size: 0 });
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

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        resolvedPath,
        expect.stringContaining('"level":"debug"'),
        'utf-8'
      );
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        resolvedPath,
        expect.stringContaining(message),
        'utf-8'
      );
    });

    it('should log info messages', () => {
      const message = 'Info message';
      logger.info(message);

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        resolvedPath,
        expect.stringContaining('"level":"info"'),
        'utf-8'
      );
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        resolvedPath,
        expect.stringContaining(message),
        'utf-8'
      );
    });

    it('should log warning messages', () => {
      const message = 'Warning message';
      logger.warn(message);

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        resolvedPath,
        expect.stringContaining('"level":"warn"'),
        'utf-8'
      );
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        resolvedPath,
        expect.stringContaining(message),
        'utf-8'
      );
    });

    it('should log error messages', () => {
      const message = 'Error message';
      logger.error(message);

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        resolvedPath,
        expect.stringContaining('"level":"error"'),
        'utf-8'
      );
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        resolvedPath,
        expect.stringContaining(message),
        'utf-8'
      );
    });

    it('should log messages with data', () => {
      const message = 'Message with data';
      const data = { userId: 123, action: 'login' };

      logger.info(message, data);

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        resolvedPath,
        expect.stringContaining('"data":'),
        'utf-8'
      );
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        resolvedPath,
        expect.stringContaining('"userId":123'),
        'utf-8'
      );
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        resolvedPath,
        expect.stringContaining('"action":"login"'),
        'utf-8'
      );
    });

    it('should write one JSON line per log entry', () => {
      logger.info('test');

      const [, content] = (fs.appendFileSync as jest.Mock).mock.calls[0];
      expect(content).toMatch(/^\{.*\}\n$/);
    });

    it('should create log directory if it does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      logger.info('test');

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
      });
    });
  });

  describe('log rotation', () => {
    it('should rotate when file exceeds maxFileSize', () => {
      const maxFileSize = 1024;
      const logger = new Logger({
        logFilePath: mockLogFilePath,
        maxFileSize,
        maxFiles: 3,
      });

      (fs.statSync as jest.Mock).mockReturnValue({ size: maxFileSize + 1 });

      logger.info('trigger rotation');

      expect(fs.renameSync).toHaveBeenCalledWith(
        resolvedPath,
        `${resolvedPath}.1`
      );
    });

    it('should not rotate when file is within size limit', () => {
      const logger = new Logger({
        logFilePath: mockLogFilePath,
        maxFileSize: 1024,
      });

      (fs.statSync as jest.Mock).mockReturnValue({ size: 100 });

      logger.info('no rotation');

      expect(fs.renameSync).not.toHaveBeenCalled();
    });

    it('should delete oldest file when maxFiles is exceeded', () => {
      const maxFiles = 3;
      const logger = new Logger({
        logFilePath: mockLogFilePath,
        maxFileSize: 1,
        maxFiles,
      });

      (fs.statSync as jest.Mock).mockReturnValue({ size: 2 });

      logger.info('trigger rotation');

      expect(fs.unlinkSync).toHaveBeenCalledWith(`${resolvedPath}.${maxFiles}`);
    });
  });
});
