import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const nodeGlobals = {
  console: 'readonly',
  fetch: 'readonly',
  process: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  URL: 'readonly',
};

const browserGlobals = {
  console: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  MediaDeviceKind: 'readonly',
  navigator: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  URL: 'readonly',
  window: 'readonly',
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'recordings/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/api/src/**/*.ts', 'apps/api/vitest.config.ts'],
    languageOptions: {
      globals: nodeGlobals,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}', 'apps/web/vite.config.ts'],
    languageOptions: {
      globals: browserGlobals,
      parserOptions: {
        ecmaFeatures: {jsx: true},
      },
    },
  },
  {
    files: ['tests/**/*.ts', 'playwright.config.ts'],
    languageOptions: {
      globals: {
        ...browserGlobals,
        process: 'readonly',
      },
    },
  },
);
