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
    // Environment variables are inherited from the shell
    // Override defaults only if not set externally
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'mysql://solopay:pass@localhost:3306/solopay',
      REDIS_HOST: process.env.REDIS_HOST || 'localhost',
      REDIS_PORT: process.env.REDIS_PORT || '6379',
      BLOCKCHAIN_RPC_URL: process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545',
      CHAIN_ID: process.env.CHAIN_ID || '31337',
      GATEWAY_URL: process.env.GATEWAY_URL || 'http://localhost:3001',
      RELAYER_URL: process.env.RELAY_API_URL || process.env.RELAYER_URL || 'http://localhost:3002',
    },
  },
});
