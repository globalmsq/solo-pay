import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default defineConfig(
  js.configs.recommended,
  tseslint.configs.strict,
  prettierConfig,
  {
    files: ['packages/demo/**/*.{ts,tsx}'],
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
