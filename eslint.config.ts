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
  // JavaScript files (msqpay-client)
  {
    files: ['packages/msqpay-client/src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        ethers: 'readonly',
        MetaMaskSDK: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearInterval: 'readonly',
        setInterval: 'readonly',
        requestAnimationFrame: 'readonly',
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      '@typescript-eslint/no-unused-vars': 'off', // Disable TS rule for JS files
      '@typescript-eslint/no-extraneous-class': 'off', // Allow static-only classes
      'no-case-declarations': 'off', // Allow declarations in case blocks (we use braces)
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
  ]),
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);
