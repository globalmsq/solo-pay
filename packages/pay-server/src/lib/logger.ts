import pino from 'pino';

/**
 * Determines the appropriate log level based on the NODE_ENV environment variable.
 *
 * Log level mapping:
 * - production: 'info' (only important messages)
 * - test: 'silent' (suppress all logs during testing)
 * - development/other: 'debug' (verbose logging for development)
 *
 * @returns {string} The log level to use
 */
export function getLogLevel(): string {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      return 'info';
    case 'test':
      return 'silent';
    default:
      return 'debug';
  }
}

/**
 * Root Pino logger instance configured with appropriate log level.
 * This is the base logger from which all service loggers are created as children.
 * All child loggers inherit the root logger's configuration and add their own context.
 */
export const rootLogger = pino({
  level: getLogLevel(),
});

/**
 * Factory function to create a service-specific child logger.
 *
 * Each service logger includes:
 * - Service name binding for context
 * - Inherited configuration from rootLogger
 * - All standard Pino logging methods (info, error, warn, debug)
 *
 * Usage:
 * const logger = createLogger('PaymentService');
 * logger.info('Payment processed');
 * logger.error({ err }, 'Payment failed');
 *
 * @param {string} serviceName - The name of the service using this logger
 * @returns {pino.Logger} A child logger instance with service name context
 */
export function createLogger(serviceName: string): pino.Logger {
  return rootLogger.child({ service: serviceName });
}
