import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default defineConfig(
  js.configs.recommended,
  tseslint.configs.strict,
  prettierConfig,
  {
    files: ['apps/demo/**/*.{ts,tsx}'],
  },
  // TypeScript files (msqpay-client)
  {
    files: ['packages/msqpay-client/src/**/*.ts'],
    languageOptions: {
      parserOptions: { project: false }, // Faster linting without type checking
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearInterval: 'readonly',
        setInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        // CDN-loaded dependencies
        ethers: 'readonly',
        MetaMaskSDK: 'readonly',
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-extraneous-class': 'off',
      'no-case-declarations': 'off',
      '@typescript-eslint/no-explicit-any': 'warn', // CDN globals require any
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/coverage/**',
    '**/artifacts/**',
    '**/cache/**',
    '**/typechain-types/**',
    '**/subgraph/generated/**',
    '**/webpack.config.js',
    'packages/msqpay-client/apps/**',
  ]),
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);
