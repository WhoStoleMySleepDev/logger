jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  openSync: jest.fn().mockReturnValue(42),
  createWriteStream: jest.fn(),
  statSync: jest.fn().mockReturnValue({ size: 0 }),
  renameSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

import { Logger, LogLevel } from '../logger';
import * as fs from 'node:fs';
import { resolve } from 'node:path';

describe('Logger', () => {
  const mockLogFilePath = '/tmp/test.log';
  const resolvedPath = resolve(mockLogFilePath);

  let mockStream: {
    write: jest.Mock;
    end: jest.Mock;
    writableNeedDrain: boolean;
    once: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStream = {
      write: jest.fn(),
      end: jest.fn((cb?: () => void) => cb?.()),
      writableNeedDrain: false,
      once: jest.fn(),
    };
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({ size: 0 });
    (fs.createWriteStream as jest.Mock).mockReturnValue(mockStream);
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
      logger.debug('Debug message');

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('"level":"debug"')
      );
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Debug message')
      );
    });

    it('should log info messages', () => {
      logger.info('Info message');

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('"level":"info"')
      );
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Info message')
      );
    });

    it('should log warning messages', () => {
      logger.warn('Warning message');

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('"level":"warn"')
      );
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Warning message')
      );
    });

    it('should log error messages', () => {
      logger.error('Error message');

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('"level":"error"')
      );
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Error message')
      );
    });

    it('should log messages with data', () => {
      logger.info('Message with data', { userId: 123, action: 'login' });

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('"data":')
      );
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('"userId":123')
      );
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('"action":"login"')
      );
    });

    it('should write one JSON line per log entry', () => {
      logger.info('test');

      const [content] = (mockStream.write as jest.Mock).mock.calls[0];
      expect(content).toMatch(/^\{.*\}\n$/);
    });

    it('should not include data field when data is undefined', () => {
      logger.info('no data');

      const [content] = (mockStream.write as jest.Mock).mock.calls[0];
      expect(content).not.toContain('"data"');
    });

    it('should open stream to the resolved log file path', () => {
      logger.info('test');

      expect(fs.openSync).toHaveBeenCalledWith(resolvedPath, 'a');
      expect(fs.createWriteStream).toHaveBeenCalledWith(resolvedPath, {
        fd: 42,
        autoClose: true,
      });
    });

    it('should create log directory if it does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      logger.info('test');

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
      });
    });

    it('should only open the stream once across multiple writes', () => {
      logger.info('first');
      logger.info('second');
      logger.info('third');

      expect(fs.createWriteStream).toHaveBeenCalledTimes(1);
    });
  });

  describe('log rotation', () => {
    it('should rotate when cumulative size exceeds maxFileSize', () => {
      const maxFileSize = 1024;
      const logger = new Logger({
        logFilePath: mockLogFilePath,
        maxFileSize,
        maxFiles: 3,
      });

      // Start with size just under the limit; one write pushes it over
      (fs.statSync as jest.Mock).mockReturnValue({ size: maxFileSize - 1 });

      logger.info('trigger rotation');

      expect(fs.renameSync).toHaveBeenCalledWith(
        resolvedPath,
        `${resolvedPath}.1`
      );
    });

    it('should not rotate when file is within size limit', () => {
      const logger = new Logger({
        logFilePath: mockLogFilePath,
        maxFileSize: 10 * 1024 * 1024,
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

    it('should reopen the stream after rotation', () => {
      const logger = new Logger({
        logFilePath: mockLogFilePath,
        maxFileSize: 1,
      });

      (fs.statSync as jest.Mock).mockReturnValue({ size: 2 });

      logger.info('first write triggers rotation');
      logger.info('second write uses new stream');

      expect(fs.createWriteStream).toHaveBeenCalledTimes(2);
    });
  });

  describe('child loggers', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({ logFilePath: mockLogFilePath });
    });

    it('should include child context in log entries', () => {
      const child = logger.child({ component: 'auth' });
      child.info('login');

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('"component":"auth"')
      );
    });

    it('should share the parent stream (createWriteStream called once)', () => {
      const child = logger.child({ component: 'auth' });
      logger.info('parent write');
      child.info('child write');

      expect(fs.createWriteStream).toHaveBeenCalledTimes(1);
    });

    it('should merge nested child contexts', () => {
      const child1 = logger.child({ component: 'auth' });
      const child2 = child1.child({ requestId: 'req-123' });

      child2.info('nested child log');

      const [content] = (mockStream.write as jest.Mock).mock.calls[0];
      expect(content).toContain('"component":"auth"');
      expect(content).toContain('"requestId":"req-123"');
    });

    it('child context should not bleed into parent logs', () => {
      const child = logger.child({ component: 'auth' });
      child.info('child message');
      logger.info('parent message');

      const calls = (mockStream.write as jest.Mock).mock.calls;
      const parentCall = calls[1][0] as string;
      expect(parentCall).not.toContain('"component"');
    });
  });

  describe('flush and close', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({ logFilePath: mockLogFilePath });
    });

    it('should resolve flush when stream is not draining', async () => {
      logger.info('test');
      await expect(logger.flush()).resolves.toBeUndefined();
    });

    it('should wait for drain event when stream needs draining', async () => {
      logger.info('test');
      mockStream.writableNeedDrain = true;

      let drained = false;
      const flushPromise = logger.flush().then(() => {
        drained = true;
      });

      expect(drained).toBe(false);

      const drainCallback = (mockStream.once as jest.Mock).mock.calls.find(
        ([event]) => event === 'drain'
      )?.[1] as (() => void) | undefined;
      drainCallback?.();

      await flushPromise;
      expect(drained).toBe(true);
    });

    it('should close the stream', async () => {
      logger.info('test');
      await logger.close();

      expect(mockStream.end).toHaveBeenCalled();
    });

    it('should resolve close when no stream is open', async () => {
      await expect(logger.close()).resolves.toBeUndefined();
    });

    it('should use log level enum values', () => {
      const logger2 = new Logger({ logFilePath: mockLogFilePath });
      logger2.log(LogLevel.INFO, 'enum test');

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('"level":"info"')
      );
    });
  });
});
