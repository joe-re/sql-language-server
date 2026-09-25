import js from '@eslint/js'
import importPlugin from 'eslint-plugin-import'
import nodePlugin from 'eslint-plugin-n'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/out/',
      '**/bin/',
      '**/npm_bin/',
      'packages/sql-parser/',
      'packages/sqlint/schema.conf.js',
      '**/vitest.config.mts',
      '**/migrations/',
      '**/webpack.config.js',
      'example/monaco_editor/models/',
      'example/monaco_editor/config/config.js',
      'example/monaco_editor/src/client/client.ts',
      'example/monaco_editor/src/server/server.ts',
      'eslint.config.mjs',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  nodePlugin.configs['flat/recommended'],
  prettierRecommended,
  {
    plugins: { import: importPlugin },
    languageOptions: {
      globals: globals.node,
    },
    settings: {
      node: {
        tryExtensions: ['.ts', '.js'],
      },
    },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 0,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'n/no-unsupported-features/es-syntax': 'off',
      'n/no-extraneous-import': 'off',
      // node:sqlite is still experimental on Node 22, but adopted deliberately
      'n/no-unsupported-features/node-builtins': [
        'error',
        { ignores: ['sqlite'] },
      ],
      'n/no-missing-import': ['error', { allowModules: ['vscode'] }],
      'import/first': 0,
      'import/named': 2,
      'import/namespace': 2,
      'import/default': 2,
      'import/export': 2,
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [
            {
              pattern: '@classdo/**',
              group: 'internal',
            },
          ],
          pathGroupsExcludedImportTypes: [],
          'newlines-between': 'never',
        },
      ],
    },
  },
  {
    // TypeScript already reports unresolved imports, including directory (index.ts) imports
    files: ['**/*.ts'],
    rules: {
      'n/no-missing-import': 'off',
    },
  }
)
