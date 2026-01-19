import rootConfig from '../../eslint.config';
import nextPlugin from '@next/eslint-plugin-next';

export default [
  ...rootConfig,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
  },
  {
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
  { ignores: ['**/postcss.config.cjs'] },
];
