import pino from 'pino';

function getLogLevel(): string {
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

const rootLogger = pino({
  level: getLogLevel(),
});

export function createLogger(serviceName: string): pino.Logger {
  return rootLogger.child({ service: serviceName });
}
