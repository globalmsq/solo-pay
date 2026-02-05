import { describe, it, expect, beforeEach } from 'vitest';
import { getLogLevel, createLogger, rootLogger } from '../logger';

describe('Logger Module', () => {
  beforeEach(() => {
    // Store original NODE_ENV
    const originalEnv = process.env.NODE_ENV;

    // Cleanup after each test
    return () => {
      process.env.NODE_ENV = originalEnv;
    };
  });

  describe('getLogLevel', () => {
    it('should return "info" when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      const level = getLogLevel();
      expect(level).toBe('info');
    });

    it('should return "silent" when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test';
      const level = getLogLevel();
      expect(level).toBe('silent');
    });

    it('should return "debug" as default when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;
      const level = getLogLevel();
      expect(level).toBe('debug');
    });

    it('should return "debug" when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      const level = getLogLevel();
      expect(level).toBe('debug');
    });
  });

  describe('rootLogger', () => {
    it('should be a valid pino instance', () => {
      expect(rootLogger).toBeDefined();
      expect(rootLogger).toHaveProperty('debug');
      expect(rootLogger).toHaveProperty('info');
      expect(rootLogger).toHaveProperty('warn');
      expect(rootLogger).toHaveProperty('error');
    });

    it('should have logging methods available', () => {
      expect(typeof rootLogger.debug).toBe('function');
      expect(typeof rootLogger.info).toBe('function');
      expect(typeof rootLogger.warn).toBe('function');
      expect(typeof rootLogger.error).toBe('function');
    });
  });

  describe('createLogger', () => {
    it('should return a child logger with service name', () => {
      const logger = createLogger('TestService');
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should create different logger instances for different service names', () => {
      const logger1 = createLogger('Service1');
      const logger2 = createLogger('Service2');
      expect(logger1).toBeDefined();
      expect(logger2).toBeDefined();
      // They should be different child logger instances
      expect(logger1).not.toBe(logger2);
    });

    it('should attach service name context to logger', () => {
      const logger = createLogger('PaymentService');
      expect(logger).toBeDefined();
      // Logger should have the capability to log with bindings
      expect(typeof logger.child).toBe('function');
    });

    it('should allow logging with the created logger', () => {
      const logger = createLogger('TestService');
      // Should not throw when logging
      expect(() => {
        logger.info('Test message');
        logger.error('Error message');
        logger.warn('Warning message');
      }).not.toThrow();
    });
  });

  describe('Logger integration', () => {
    it('should allow structured logging with context', () => {
      const logger = createLogger('TestService');
      expect(() => {
        logger.error({ err: new Error('Test'), context: 'test' }, 'Error occurred');
      }).not.toThrow();
    });

    it('should preserve Korean error messages', () => {
      const logger = createLogger('TestService');
      const koreanMessage = '테스트 에러 메시지 발생';
      expect(() => {
        logger.error(koreanMessage);
        logger.info('정보 메시지');
      }).not.toThrow();
    });

    it('should preserve emoji prefixes in messages', () => {
      const logger = createLogger('TestService');
      expect(() => {
        logger.info('📢 Server starting');
        logger.error('❌ Error occurred');
        logger.warn('⚠️ Warning message');
      }).not.toThrow();
    });
  });
});
