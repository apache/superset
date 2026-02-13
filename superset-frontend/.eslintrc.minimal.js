/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Register TypeScript require hook so ESLint can load .ts plugin files
require('tsx/cjs');

/**
 * MINIMAL ESLint config - ONLY for rules OXC doesn't support
 * This config is designed to be run alongside OXC linter
 *
 * Only covers:
 * - Custom Superset plugins (theme-colors, icons, i18n)
 * - Prettier formatting
 * - File progress indicator
 */

module.exports = {
  root: true,
  // Don't report on eslint-disable comments for rules we don't have
  reportUnusedDisableDirectives: false,
  // Simple parser - no TypeScript needed since OXC handles that
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
    requireConfigFile: false,
    babelOptions: {
      presets: ['@babel/preset-react', '@babel/preset-env'],
    },
  },
  env: {
    browser: true,
    node: true,
    es2020: true,
  },
  plugins: [
    // ONLY custom Superset plugins that OXC doesn't support
    'theme-colors',
    'icons',
    'i18n-strings',
    'file-progress',
    'prettier',
  ],
  rules: {
    // === ONLY rules that OXC cannot handle ===

    // Prettier integration (formatting)
    'prettier/prettier': 'error',

    // Custom Superset plugins
    'theme-colors/no-literal-colors': 'error',
    'icons/no-fa-icons-usage': 'error',
    'i18n-strings/no-template-vars': 'error',
    'file-progress/activate': 1,

    // Explicitly turn off all other rules to avoid conflicts
    // when the config gets merged with other configs
    'import/no-unresolved': 'off',
    'import/extensions': 'off',
    '@typescript-eslint/naming-convention': 'off',
  },
  overrides: [
    {
      // Disable custom rules in test/story files
      files: [
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.stories.*',
        '**/test/**',
        '**/tests/**',
        '**/spec/**',
        '**/__tests__/**',
        '**/__mocks__/**',
        'cypress-base/**',
        'packages/superset-ui-core/src/theme/index.tsx',
      ],
      rules: {
        'theme-colors/no-literal-colors': 0,
        'icons/no-fa-icons-usage': 0,
        'i18n-strings/no-template-vars': 0,
        'file-progress/activate': 0,
      },
    },
  ],
  // Only check src/ files where theme/icon rules matter
  ignorePatterns: [
    'node_modules',
    'dist',
    'build',
    '.next',
    'coverage',
    '*.min.js',
    'vendor',
    // Skip packages/plugins since they have different theming rules
    'packages/**',
    'plugins/**',
    // Skip generated/external files
    '*.generated.*',
    '*.config.js',
    'webpack.*',
    // Temporary analysis files
    '*.js', // Skip all standalone JS files in root
    '*.json',
  ],
};
