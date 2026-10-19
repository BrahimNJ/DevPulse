// @ts-check
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['node_modules/', 'dist/', 'coverage/']),
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      complexity: ['error', 10],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
  {
    // JavaScript files declare return types in JSDoc, which this rule cannot see.
    files: ['**/*.js', '**/*.mjs'],
    rules: { '@typescript-eslint/explicit-function-return-type': 'off' },
  },
  // Turns off stylistic rules that would conflict with Prettier.
  prettier,
  // eslint-config-prettier disables curly, but the 'all' option never conflicts with it.
  { rules: { curly: ['error', 'all'] } },
);
