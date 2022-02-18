module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    'import',
    '@typescript-eslint',
  ],
  settings: {
    node: {
      tryExtensions: ['.ts', '.js'],
    },
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'prettier',
    'plugin:node/recommended',
  ],
  rules: {
    "@typescript-eslint/no-non-null-assertion": 0,
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    'node/no-unsupported-features/es-syntax': 'off',
    'node/no-extraneous-import': 'off',
    "node/no-missing-import": ["error", {
      "allowModules": ["vscode"]
    }]
  }
};
