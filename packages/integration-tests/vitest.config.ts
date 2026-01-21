import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 120000,
    globals: true,
    include: ['src/tests/**/*.test.ts'],
    setupFiles: ['./src/setup/global-setup.ts'],
    sequence: {
      concurrent: false,
    },
    maxWorkers: 1,
    minWorkers: 1,
    // Environment variables are inherited from the shell
    // Override defaults only if not set externally
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'mysql://msqpay:pass@localhost:3307/msqpay_test',
      REDIS_HOST: process.env.REDIS_HOST || 'localhost',
      REDIS_PORT: process.env.REDIS_PORT || '6380',
      BLOCKCHAIN_RPC_URL: process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8546',
      CHAIN_ID: process.env.CHAIN_ID || '31337',
      PAY_SERVER_URL: process.env.PAY_SERVER_URL || 'http://localhost:3011',
      RELAYER_URL: process.env.RELAY_API_URL || process.env.RELAYER_URL || 'http://localhost:3012',
    },
  },
});
